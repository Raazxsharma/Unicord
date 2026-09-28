/**
 * UniCord Real-Time Cross-Device Network Engine
 * Uses public MQTT WebSocket broker for chat & presence synchronization,
 * and PeerJS WebRTC with robust STUN traversal for live audio calls.
 */

class NetworkEngine {
  constructor() {
    this.mqttClient = null;
    this.peer = null;
    this.peerId = null;
    this.activeVoiceCallPeers = new Map(); // peerId -> MediaConnection
    this.remoteAudioElements = new Map();  // peerId -> HTMLAudioElement
    this.remotePresence = new Map();       // userId -> { name, channelId, peerId, lastSeen, avatarBg, avatarText }
    this.heartbeatTimer = null;
    this.userId = this.getOrCreateUserId();
    this.isConnected = false;
  }

  getOrCreateUserId() {
    let id = localStorage.getItem('unicord_unique_user_id');
    if (!id) {
      id = 'student_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('unicord_unique_user_id', id);

      const me = window.stateManager?.state?.currentUser;
      if (me && (me.name === 'Aarav (BBA)' || !me.name)) {
        const studentNames = ['Student', 'Hosteller', 'DayScholar', 'CampusPeer'];
        const randomNum = Math.floor(100 + Math.random() * 900);
        const randomPrefix = studentNames[Math.floor(Math.random() * studentNames.length)];
        me.name = `${randomPrefix}_${randomNum}`;
        me.avatarText = me.name.substring(0, 2).toUpperCase();
        me.id = id;
        window.stateManager.saveState();
      }
    }
    return id;
  }

  init() {
    this.initMQTT();
    this.initPeerJS();
  }

  // 1. MQTT WEBSOCKET CONNECTION FOR REAL-TIME CHAT & PRESENCE
  initMQTT() {
    if (typeof mqtt === 'undefined') {
      console.warn('[UniCord Net] MQTT library not loaded, skipping cross-device sync.');
      return;
    }

    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    const clientId = 'unicord_' + this.userId + '_' + Math.random().toString(16).substring(2, 8);

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500
      });

      this.mqttClient.on('connect', () => {
        console.log('[UniCord Net] Connected to real-time cloud broker!');
        this.isConnected = true;

        this.mqttClient.subscribe('unicord/chat/#', { qos: 0 });
        this.mqttClient.subscribe('unicord/voice/#', { qos: 0 });
        this.mqttClient.subscribe('unicord/presence/#', { qos: 0 });

        this.startPresenceHeartbeat();
      });

      this.mqttClient.on('message', (topic, payload) => {
        try {
          const data = JSON.parse(payload.toString());
          this.handleIncomingMessage(topic, data);
        } catch (e) {
          console.error('[UniCord Net] Error parsing incoming message', e);
        }
      });

      this.mqttClient.on('error', (err) => {
        console.warn('[UniCord Net] MQTT connection error', err);
      });
    } catch (e) {
      console.warn('[UniCord Net] Failed to initialize MQTT client', e);
    }
  }

  // 2. PEERJS WEBRTC WITH ROBUST STUN SERVERS
  initPeerJS() {
    if (typeof Peer === 'undefined') {
      console.warn('[UniCord Net] PeerJS library not loaded.');
      return;
    }

    const cleanPeerId = 'unicord-' + this.userId.replace(/[^a-zA-Z0-9_-]/g, '');

    try {
      // Extensive public STUN servers for NAT traversal between mobile 4G/5G and Wi-Fi
      this.peer = new Peer(cleanPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        console.log('[UniCord Voice WebRTC] Peer online with ID:', id);
      });

      // Handle incoming voice call from friend
      this.peer.on('call', (call) => {
        console.log('[UniCord Voice WebRTC] Incoming voice call from:', call.peer);

        // Function to answer with stream
        const answerWithStream = (stream) => {
          call.answer(stream);
          this.setupRemoteAudioStream(call);
        };

        if (window.audioEngine?.micStream) {
          answerWithStream(window.audioEngine.micStream);
        } else {
          // If mic stream not initialized yet, request it or answer audio-only
          navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false
          }).then(stream => {
            window.audioEngine.micStream = stream;
            answerWithStream(stream);
          }).catch(err => {
            console.warn('[UniCord Voice] No mic available, answering to listen only:', err);
            // Create a silent audio track so WebRTC connection succeeds for listening!
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const dst = osc.connect(audioCtx.createMediaStreamDestination());
            osc.start();
            answerWithStream(dst.stream);
          });
        }
      });

      this.peer.on('error', (err) => {
        console.warn('[UniCord Voice WebRTC] Peer error:', err);
      });
    } catch (e) {
      console.warn('[UniCord Voice WebRTC] Failed to initialize PeerJS', e);
    }
  }

  setupRemoteAudioStream(call) {
    const peerId = call.peer;
    this.activeVoiceCallPeers.set(peerId, call);

    call.on('stream', (remoteStream) => {
      console.log('[UniCord Voice WebRTC] Received live audio stream from friend:', peerId);

      let audio = this.remoteAudioElements.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        audio.muted = false;
        audio.volume = 1.0;
        document.body.appendChild(audio);
        this.remoteAudioElements.set(peerId, audio);
      }

      audio.srcObject = remoteStream;
      audio.muted = false;
      audio.volume = 1.0;

      // Resume AudioContext if suspended
      if (window.audioEngine?.ctx && window.audioEngine.ctx.state === 'suspended') {
        window.audioEngine.ctx.resume();
      }

      // Ensure browser autoplay unlocks
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          console.log('[UniCord Voice] Autoplay waiting for user touch/click...');
          const unlock = () => {
            audio.play();
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
          };
          document.addEventListener('click', unlock, { once: true });
          document.addEventListener('touchstart', unlock, { once: true });
        });
      }

      // Analyze remote classmate's audio to light up their green speaking ring!
      this.attachRemoteSpeakingDetector(peerId, remoteStream);
    });

    call.on('close', () => {
      this.cleanupPeer(peerId);
    });

    call.on('error', (err) => {
      console.warn('[UniCord Voice WebRTC] Call stream error with peer:', peerId, err);
      this.cleanupPeer(peerId);
    });
  }

  attachRemoteSpeakingDetector(peerId, stream) {
    if (!window.audioEngine?.ctx) return;
    try {
      if (window.audioEngine.ctx.state === 'suspended') {
        window.audioEngine.ctx.resume();
      }

      const source = window.audioEngine.ctx.createMediaStreamSource(stream);
      const analyser = window.audioEngine.ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      const checkSpeech = () => {
        if (!this.activeVoiceCallPeers.has(peerId)) return;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length;
        const isSpeaking = avg > 14;

        const activeChan = window.stateManager?.state?.activeVoiceChannelId;
        if (activeChan) {
          const participants = window.stateManager.state.voiceParticipants[activeChan] || [];
          const target = participants.find(p => p.peerId === peerId || p.id === peerId);
          if (target && target.isSpeaking !== isSpeaking) {
            target.isSpeaking = isSpeaking;
            window.uiController?.renderVoiceStage();
            window.uiController?.renderChannels();
          }
        }

        requestAnimationFrame(checkSpeech);
      };
      requestAnimationFrame(checkSpeech);
    } catch (e) {
      console.warn('Error attaching remote speaker analyzer:', e);
    }
  }

  cleanupPeer(peerId) {
    this.activeVoiceCallPeers.delete(peerId);
    const audio = this.remoteAudioElements.get(peerId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.remoteAudioElements.delete(peerId);
    }
  }

  // 3. BROADCASTING OUTGOING ACTIONS
  broadcastChatMessage(channelId, message) {
    if (!this.mqttClient || !this.isConnected) return;
    const topic = `unicord/chat/${channelId}`;
    const payload = JSON.stringify({
      senderId: this.userId,
      channelId,
      message
    });
    this.mqttClient.publish(topic, payload);
  }

  broadcastVoiceJoin(channelId) {
    if (!this.mqttClient || !this.isConnected) return;
    const me = window.stateManager.state.currentUser;
    const topic = `unicord/voice/${channelId}`;
    const payload = JSON.stringify({
      type: 'JOIN',
      userId: this.userId,
      peerId: this.peerId,
      name: me.name,
      avatarText: me.avatarText,
      avatarBg: me.avatarBg,
      channelId
    });
    this.mqttClient.publish(topic, payload);
  }

  broadcastVoiceLeave(channelId) {
    if (!this.mqttClient || !this.isConnected) return;
    const topic = `unicord/voice/${channelId}`;
    const payload = JSON.stringify({
      type: 'LEAVE',
      userId: this.userId,
      peerId: this.peerId,
      channelId
    });
    this.mqttClient.publish(topic, payload);

    // Close all WebRTC voice calls
    this.activeVoiceCallPeers.forEach(call => {
      try { call.close(); } catch(e){}
    });
    this.activeVoiceCallPeers.clear();
    this.remoteAudioElements.forEach(audio => {
      audio.pause();
      audio.remove();
    });
    this.remoteAudioElements.clear();
  }

  startPresenceHeartbeat() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (!this.mqttClient || !this.isConnected) return;
      const me = window.stateManager.state.currentUser;
      const activeVoice = window.stateManager.state.activeVoiceChannelId;

      const payload = JSON.stringify({
        type: 'HEARTBEAT',
        userId: this.userId,
        peerId: this.peerId,
        name: me.name,
        avatarText: me.avatarText,
        avatarBg: me.avatarBg,
        activeVoiceChannelId: activeVoice,
        timestamp: Date.now()
      });

      this.mqttClient.publish('unicord/presence/global', payload);

      // Clean up stale peers
      this.purgeStalePresence();
    }, 3000);
  }

  purgeStalePresence() {
    const now = Date.now();
    let changed = false;

    this.remotePresence.forEach((info, uid) => {
      if (now - info.lastSeen > 8000) {
        this.remotePresence.delete(uid);
        if (info.channelId) {
          const list = window.stateManager.state.voiceParticipants[info.channelId];
          if (list) {
            window.stateManager.state.voiceParticipants[info.channelId] = list.filter(p => p.id !== uid);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      window.uiController?.renderChannels();
      window.uiController?.renderVoiceStage();
    }
  }

  // 4. HANDLING INCOMING MESSAGES FROM CLASSMATES
  handleIncomingMessage(topic, data) {
    if (data.senderId === this.userId || data.userId === this.userId) {
      return; // Ignore own messages
    }

    // Chat Message
    if (topic.startsWith('unicord/chat/')) {
      const channelId = topic.replace('unicord/chat/', '');
      const existing = window.stateManager.getChannelMessages(channelId);
      const exists = existing.some(m => m.id === data.message.id);
      if (!exists) {
        window.stateManager.addMessage(channelId, data.message);
        window.audioEngine?.playMessagePing();
        if (window.stateManager.state.activeChannelId === channelId) {
          window.uiController?.renderMessages();
        }
      }
      return;
    }

    // Voice Signaling & Presence
    if (topic.startsWith('unicord/voice/') || topic.startsWith('unicord/presence/')) {
      this.handleVoicePresence(data);
    }
  }

  handleVoicePresence(data) {
    const uid = data.userId;
    if (!uid || uid === this.userId) return;

    if (data.type === 'LEAVE') {
      this.remotePresence.delete(uid);
      const chId = data.channelId;
      if (chId && window.stateManager.state.voiceParticipants[chId]) {
        window.stateManager.state.voiceParticipants[chId] = 
          window.stateManager.state.voiceParticipants[chId].filter(p => p.id !== uid);
        window.uiController?.renderChannels();
        window.uiController?.renderVoiceStage();
      }
      return;
    }

    const activeVoice = data.activeVoiceChannelId || data.channelId;
    this.remotePresence.set(uid, {
      name: data.name,
      channelId: activeVoice,
      peerId: data.peerId,
      lastSeen: Date.now(),
      avatarBg: data.avatarBg,
      avatarText: data.avatarText
    });

    if (activeVoice) {
      if (!window.stateManager.state.voiceParticipants[activeVoice]) {
        window.stateManager.state.voiceParticipants[activeVoice] = [];
      }

      const list = window.stateManager.state.voiceParticipants[activeVoice];
      let p = list.find(x => x.id === uid);
      if (!p) {
        p = {
          id: uid,
          peerId: data.peerId,
          name: data.name,
          avatarText: data.avatarText || data.name.substring(0, 2).toUpperCase(),
          avatarBg: data.avatarBg || '#23a55a',
          isSpeaking: false,
          isMuted: false
        };
        list.push(p);
        window.uiController?.renderChannels();
        window.uiController?.renderVoiceStage();
      } else {
        p.peerId = data.peerId;
      }

      // If both of us are in this voice channel, connect via WebRTC!
      if (window.stateManager.state.activeVoiceChannelId === activeVoice && data.peerId && this.peer && this.peerId) {
        // Prevent collision/glare: only the peer with lexicographically smaller peerId calls
        if (this.peerId < data.peerId) {
          this.initiateVoiceCallToPeer(data.peerId);
        }
      }
    }
  }

  async initiateVoiceCallToPeer(remotePeerId) {
    if (this.activeVoiceCallPeers.has(remotePeerId)) return;
    if (!this.peer || !this.peerId) return;

    let myStream = window.audioEngine?.micStream;
    if (!myStream) {
      try {
        myStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
          video: false
        });
        window.audioEngine.micStream = myStream;
      } catch (e) {
        console.warn('Could not get mic stream for outgoing call', e);
        return;
      }
    }

    console.log('[UniCord Voice WebRTC] Calling classmate peer:', remotePeerId);
    try {
      const call = this.peer.call(remotePeerId, myStream);
      if (call) {
        this.setupRemoteAudioStream(call);
      }
    } catch (e) {
      console.warn('[UniCord Voice WebRTC] Call failed:', e);
    }
  }
}

window.networkEngine = new NetworkEngine();
