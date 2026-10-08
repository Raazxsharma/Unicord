/**
 * UniCord Real-Time Cross-Device Network Engine
 * Uses public MQTT WebSocket broker for real-time presence & signaling,
 * and PeerJS WebRTC with robust Google STUN + OpenRelay TURN servers for crystal-clear live audio calls.
 */

class NetworkEngine {
  constructor() {
    this.mqttClient = null;
    this.peer = null;
    this.peerId = null;
    this.activeVoiceCallPeers = new Map(); // peerId -> MediaConnection
    this.remoteAudioElements = new Map();  // peerId -> HTMLAudioElement (keeps WebRTC clock active)
    this.remoteAudioNodes = new Map();     // peerId -> { source, analyser, gain }
    this.remotePresence = new Map();       // userId -> { name, channelId, peerId, lastSeen, avatarBg, avatarText, isMuted }
    this.heartbeatTimer = null;
    this.callRetryTimer = null;
    this.userId = this.getOrCreateUserId();
    this.sessionId = this.getOrCreateSessionId();
    this.isConnected = false;

    // Attach global user interaction handler to guarantee AudioContext is never suspended
    this.setupAudioUnlockListeners();
  }

  getOrCreateUserId() {
    let id = localStorage.getItem('unicord_unique_user_id');
    if (!id) {
      id = 'student_' + Math.random().toString(36).substring(2, 8);
      localStorage.setItem('unicord_unique_user_id', id);
    }
    // Ensure state currentUser ID matches network userId consistently
    const me = window.stateManager?.state?.currentUser;
    if (me) {
      me.id = id;
      if (!me.name || me.name === 'Alex' || me.name === 'Aarav (BBA)') {
        const studentNames = ['Student', 'Hosteller', 'DayScholar', 'CampusPeer', 'ProGamer', 'ApexMember'];
        const randomNum = Math.floor(100 + Math.random() * 900);
        const randomPrefix = studentNames[Math.floor(Math.random() * studentNames.length)];
        me.name = `${randomPrefix}_${randomNum}`;
        me.avatarText = me.name.substring(0, 2).toUpperCase();
      }
      window.stateManager.saveState();
    }
    return id;
  }

  getOrCreateSessionId() {
    let sess = sessionStorage.getItem('unicord_session_tab_id');
    if (!sess) {
      sess = Math.random().toString(36).substring(2, 7);
      sessionStorage.setItem('unicord_session_tab_id', sess);
    }
    return sess;
  }

  setupAudioUnlockListeners() {
    const unlock = () => {
      if (window.audioEngine?.ctx && window.audioEngine.ctx.state === 'suspended') {
        window.audioEngine.ctx.resume().catch(() => {});
      }
      this.remoteAudioElements.forEach(audio => {
        if (audio.paused) {
          audio.play().catch(() => {});
        }
      });
    };
    ['click', 'touchstart', 'keydown'].forEach(evt => {
      document.addEventListener(evt, unlock, { passive: true });
    });
  }

  init() {
    this.initMQTT();
    this.initPeerJS();
    this.startCallRetryMonitor();
  }

  // -------------------------------------------------------------
  // 1. MQTT WEBSOCKET CONNECTION FOR CHAT & PRESENCE SIGNALING
  // -------------------------------------------------------------
  initMQTT() {
    if (typeof mqtt === 'undefined') {
      console.warn('[UniCord Net] MQTT library not loaded, skipping cross-device sync.');
      return;
    }

    const brokerUrl = 'wss://broker.emqx.io:8084/mqtt';
    const clientId = 'unicord_' + this.userId + '_' + this.sessionId;

    try {
      this.mqttClient = mqtt.connect(brokerUrl, {
        clientId,
        clean: true,
        connectTimeout: 7000,
        reconnectPeriod: 2000
      });

      this.mqttClient.on('connect', () => {
        console.log('[UniCord Net] Connected to real-time cloud broker!');
        this.isConnected = true;

        this.mqttClient.subscribe('unicord/chat/#', { qos: 0 });
        this.mqttClient.subscribe('unicord/voice/#', { qos: 0 });
        this.mqttClient.subscribe('unicord/presence/#', { qos: 0 });

        this.startPresenceHeartbeat();

        // If user already joined a voice channel before MQTT finished connecting, broadcast now!
        const activeVoice = window.stateManager?.state?.activeVoiceChannelId;
        if (activeVoice) {
          this.broadcastVoiceJoin(activeVoice);
        }
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
        console.warn('[UniCord Net] MQTT connection error:', err);
      });
    } catch (e) {
      console.warn('[UniCord Net] Failed to initialize MQTT client:', e);
    }
  }

  // -------------------------------------------------------------
  // 2. PEERJS WEBRTC WITH GOOGLE STUN + OPENRELAY TURN SERVERS
  // -------------------------------------------------------------
  initPeerJS() {
    if (typeof Peer === 'undefined') {
      console.warn('[UniCord Net] PeerJS library not loaded.');
      return;
    }

    const cleanPeerId = 'unicord-' + this.userId.replace(/[^a-zA-Z0-9_-]/g, '') + '-' + this.sessionId;

    try {
      // Robust STUN + TURN servers to punch through university Wi-Fi, 4G/5G CGNAT, and Symmetric NAT firewalls
      this.peer = new Peer(cleanPeerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
            { urls: 'stun:stun3.l.google.com:19302' },
            { urls: 'stun:stun4.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' },
            {
              urls: [
                'turn:openrelay.metered.ca:80',
                'turn:openrelay.metered.ca:443',
                'turn:openrelay.metered.ca:443?transport=tcp'
              ],
              username: 'openrelayproject',
              credential: 'openrelayproject'
            }
          ]
        }
      });

      this.peer.on('open', (id) => {
        this.peerId = id;
        console.log('[UniCord Voice WebRTC] Peer registered online with ID:', id);

        // If currently in a voice channel, immediately announce with valid peerId!
        const activeVoice = window.stateManager?.state?.activeVoiceChannelId;
        if (activeVoice) {
          this.broadcastVoiceJoin(activeVoice);
        }
      });

      // Handle incoming voice call from peer/friend
      this.peer.on('call', async (call) => {
        console.log('[UniCord Voice WebRTC] Incoming voice call from friend:', call.peer);
        try {
          const myStream = await this.getOrCreateMicStream();
          call.answer(myStream);
          this.setupRemoteAudioStream(call);
        } catch (err) {
          console.warn('[UniCord Voice] Error answering incoming call:', err);
        }
      });

      this.peer.on('error', (err) => {
        console.warn('[UniCord Voice WebRTC] Peer error:', err);
        if (err.type === 'unavailable-id') {
          // If collision happens, pick a new session ID and reconnect
          this.sessionId = Math.random().toString(36).substring(2, 7);
          sessionStorage.setItem('unicord_session_tab_id', this.sessionId);
          setTimeout(() => this.initPeerJS(), 800);
        }
      });
    } catch (e) {
      console.warn('[UniCord Voice WebRTC] Failed to initialize PeerJS:', e);
    }
  }

  async getOrCreateMicStream() {
    let baseStream;
    if (window.audioEngine?.micStream && window.audioEngine.micStream.active) {
      baseStream = window.audioEngine.micStream;
    } else {
      try {
        baseStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: false
        });
        if (window.audioEngine) {
          window.audioEngine.micStream = baseStream;
        }
      } catch (err) {
        console.warn('[UniCord Voice] No mic access, creating silent stream for listening:', err);
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        const dummyCtx = new AudioCtx();
        const osc = dummyCtx.createOscillator();
        const dst = dummyCtx.createMediaStreamDestination();
        const gain = dummyCtx.createGain();
        gain.gain.value = 0;
        osc.connect(gain);
        gain.connect(dst);
        osc.start();
        baseStream = dst.stream;
      }
    }
    
    // Combine audio and video (screenshare) tracks for WebRTC
    const combined = new MediaStream();
    baseStream.getAudioTracks().forEach(t => combined.addTrack(t));
    
    if (window.stateManager?.state?.isScreenSharing && window.voiceController?.screenStream) {
      window.voiceController.screenStream.getVideoTracks().forEach(t => combined.addTrack(t));
    }
    return combined;
  }

  async reconnectWebRTC() {
    console.log('[UniCord Voice WebRTC] Reconnecting WebRTC to push new stream...');
    const activePeers = Array.from(this.activeVoiceCallPeers.keys());
    
    // Close existing calls
    activePeers.forEach(peerId => {
      const call = this.activeVoiceCallPeers.get(peerId);
      if (call) call.close();
      this.cleanupPeer(peerId);
    });

    // Wait a brief moment then redial all peers in the channel
    setTimeout(() => {
      activePeers.forEach(peerId => {
        this.initiateVoiceCallToPeer(peerId);
      });
    }, 500);
  }

  // -------------------------------------------------------------
  // 3. AUDIO STREAM ROUTING & WEB AUDIO GRAPH
  // -------------------------------------------------------------
  setupRemoteAudioStream(call) {
    const peerId = call.peer;
    this.activeVoiceCallPeers.set(peerId, call);

    call.on('stream', (remoteStream) => {
      console.log('[UniCord Voice WebRTC] Received live audio stream from friend:', peerId, remoteStream);
      
      const chId = window.stateManager?.state?.activeVoiceChannelId;
      if (chId) {
        const p = window.stateManager.state.voiceParticipants[chId]?.find(x => x.peerId === peerId || x.id === peerId);
        if (p) {
          p.remoteStream = remoteStream;
          window.uiController?.renderVoiceStage();
        }
      }

      // 1. Maintain a hidden HTML5 audio element (keeps Chrome WebRTC audio decode clock alive)
      let audio = this.remoteAudioElements.get(peerId);
      if (!audio) {
        audio = document.createElement('audio');
        audio.autoplay = true;
        audio.playsInline = true;
        // Play directly from HTML5 audio to bypass Chrome Web Audio API silent WebRTC bug
        audio.muted = window.stateManager?.state?.isDeafened || false;
        document.body.appendChild(audio);
        this.remoteAudioElements.set(peerId, audio);
      }
      audio.srcObject = remoteStream;
      audio.play().catch(() => {});

      // 2. Connect into Web Audio Graph (only for analyser green ring)
      this.attachRemoteAudioGraph(peerId, remoteStream);
    });

    call.on('close', () => {
      this.cleanupPeer(peerId);
    });

    call.on('error', (err) => {
      console.warn('[UniCord Voice WebRTC] Call error with peer:', peerId, err);
      this.cleanupPeer(peerId);
    });
  }

  attachRemoteAudioGraph(peerId, stream) {
    if (!window.audioEngine) return;
    window.audioEngine.initContext();
    const ctx = window.audioEngine.ctx;
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    try {
      // Cleanup previous graph for this peer if already existing
      if (this.remoteAudioNodes.has(peerId)) {
        try {
          const old = this.remoteAudioNodes.get(peerId);
          old.source.disconnect();
          old.analyser.disconnect();
        } catch (e) {}
        this.remoteAudioNodes.delete(peerId);
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      // Only connect source -> analyser for green ring. HTML5 <audio> handles playback.
      source.connect(analyser);

      this.remoteAudioNodes.set(peerId, { source, analyser });

      // Real-time green ring voice detection for friend's speaking activity
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
            if (window.uiController?.setRemoteUserSpeakingHighlight) {
              window.uiController.setRemoteUserSpeakingHighlight(target.id, isSpeaking);
            }
            window.uiController?.renderChannels();
          }
        }

        requestAnimationFrame(checkSpeech);
      };
      requestAnimationFrame(checkSpeech);
    } catch (e) {
      console.warn('[UniCord Voice WebRTC] Web Audio graph routing failed, falling back to direct audio tag:', e);
      // Fallback: If Web Audio routing fails, unmute HTML5 audio tag directly
      const audio = this.remoteAudioElements.get(peerId);
      if (audio) {
        audio.muted = false;
        audio.volume = 1.0;
        audio.play().catch(() => {});
      }
    }
  }

  setRemoteAudioMuted(isMuted) {
    this.remoteAudioElements.forEach(audio => {
      audio.muted = isMuted;
    });
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
    const nodes = this.remoteAudioNodes.get(peerId);
    if (nodes) {
      try {
        nodes.source.disconnect();
        nodes.analyser.disconnect();
        nodes.gain.disconnect();
      } catch (e) {}
      this.remoteAudioNodes.delete(peerId);
    }
  }

  // -------------------------------------------------------------
  // 4. BROADCASTING OUTGOING ACTIONS
  // -------------------------------------------------------------
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

  broadcastProfileUpdate() {
    if (!this.mqttClient || !this.isConnected) return;
    const me = window.stateManager.state.currentUser;
    const activeVoice = window.stateManager.state.activeVoiceChannelId;

    const payload = JSON.stringify({
      type: 'PROFILE_UPDATE',
      userId: this.userId,
      sessionId: this.sessionId,
      peerId: this.peerId,
      name: me.name,
      avatarText: me.avatarText,
      avatarBg: me.avatarBg,
      avatarPhoto: me.avatarPhoto || null,
      role: me.role || 'Student',
      customStatus: me.customStatus || '',
      bio: me.bio || '',
      bannerColor: me.bannerColor || '#5865F2',
      activeVoiceChannelId: activeVoice,
      isMuted: window.stateManager.state.isMuted,
      timestamp: Date.now()
    });

    this.mqttClient.publish('unicord/presence/global', payload);
    if (activeVoice) {
      this.mqttClient.publish(`unicord/voice/${activeVoice}`, payload);
    }
  }

  broadcastVoiceJoin(channelId) {
    if (!this.mqttClient || !this.isConnected) return;
    const me = window.stateManager.state.currentUser;
    const topic = `unicord/voice/${channelId}`;
    const payload = JSON.stringify({
      type: 'JOIN',
      userId: this.userId,
      sessionId: this.sessionId,
      peerId: this.peerId,
      name: me.name,
      avatarText: me.avatarText,
      avatarBg: me.avatarBg,
      avatarPhoto: me.avatarPhoto || null,
      role: me.role || 'Student',
      customStatus: me.customStatus || '',
      bio: me.bio || '',
      bannerColor: me.bannerColor || '#5865F2',
      channelId,
      isMuted: window.stateManager.state.isMuted
    });
    this.mqttClient.publish(topic, payload);
  }

  broadcastVoiceAck(channelId, toUserId) {
    if (!this.mqttClient || !this.isConnected) return;
    const me = window.stateManager.state.currentUser;
    const topic = `unicord/voice/${channelId}`;
    const payload = JSON.stringify({
      type: 'VOICE_ACK',
      userId: this.userId,
      sessionId: this.sessionId,
      peerId: this.peerId,
      targetUserId: toUserId,
      name: me.name,
      avatarText: me.avatarText,
      avatarBg: me.avatarBg,
      avatarPhoto: me.avatarPhoto || null,
      role: me.role || 'Student',
      customStatus: me.customStatus || '',
      bio: me.bio || '',
      bannerColor: me.bannerColor || '#5865F2',
      channelId,
      isMuted: window.stateManager.state.isMuted
    });
    this.mqttClient.publish(topic, payload);
  }

  broadcastMuteState(isMuted) {
    if (!this.mqttClient || !this.isConnected) return;
    const activeVoice = window.stateManager?.state?.activeVoiceChannelId;
    if (!activeVoice) return;
    const topic = `unicord/voice/${activeVoice}`;
    const payload = JSON.stringify({
      type: 'MUTE_STATE',
      userId: this.userId,
      peerId: this.peerId,
      isMuted,
      channelId: activeVoice
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
      try { call.close(); } catch (e) {}
    });
    this.activeVoiceCallPeers.clear();

    this.remoteAudioElements.forEach(audio => {
      audio.pause();
      audio.remove();
    });
    this.remoteAudioElements.clear();

    this.remoteAudioNodes.forEach(nodes => {
      try {
        nodes.source.disconnect();
        nodes.analyser.disconnect();
        nodes.gain.disconnect();
      } catch (e) {}
    });
    this.remoteAudioNodes.clear();
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
        sessionId: this.sessionId,
        peerId: this.peerId,
        name: me.name,
        avatarText: me.avatarText,
        avatarBg: me.avatarBg,
        avatarPhoto: me.avatarPhoto || null,
        role: me.role || 'Student',
        customStatus: me.customStatus || '',
        bio: me.bio || '',
        bannerColor: me.bannerColor || '#5865F2',
        activeVoiceChannelId: activeVoice,
        isMuted: window.stateManager.state.isMuted,
        timestamp: Date.now()
      });

      this.mqttClient.publish('unicord/presence/global', payload);

      // Clean up stale peers
      this.purgeStalePresence();
    }, 2500);
  }

  startCallRetryMonitor() {
    if (this.callRetryTimer) clearInterval(this.callRetryTimer);
    this.callRetryTimer = setInterval(() => {
      const activeVoice = window.stateManager?.state?.activeVoiceChannelId;
      if (!activeVoice || !this.peer || !this.peerId) return;

      this.remotePresence.forEach((info, uid) => {
        if (info.channelId === activeVoice && info.peerId && info.peerId !== this.peerId) {
          if (!this.activeVoiceCallPeers.has(info.peerId)) {
            // Determine who calls to avoid call collision
            if (this.peerId < info.peerId) {
              console.log('[UniCord Voice Retry] Auto-connecting to peer:', info.peerId);
              this.initiateVoiceCallToPeer(info.peerId);
            }
          }
        }
      });
    }, 3500);
  }

  purgeStalePresence() {
    const now = Date.now();
    let changed = false;

    this.remotePresence.forEach((info, uid) => {
      if (now - info.lastSeen > 9000) {
        this.remotePresence.delete(uid);
        if (info.channelId) {
          const list = window.stateManager.state.voiceParticipants[info.channelId];
          if (list) {
            window.stateManager.state.voiceParticipants[info.channelId] = list.filter(p => p.id !== uid && p.peerId !== info.peerId);
            changed = true;
          }
        }
      }
    });

    if (changed) {
      window.uiController?.renderChannels();
      window.uiController?.renderVoiceStage();
      window.uiController?.renderMembers();
    }
  }

  // -------------------------------------------------------------
  // 5. HANDLING INCOMING MESSAGES
  // -------------------------------------------------------------
  handleIncomingMessage(topic, data) {
    // Ignore self messages
    if (data.senderId === this.userId || (data.userId === this.userId && data.sessionId === this.sessionId)) {
      return;
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

        // Also track sender in remotePresence with profile info
        if (data.senderId && data.message.author) {
          const a = data.message.author;
          const prev = this.remotePresence.get(data.senderId) || {};
          this.remotePresence.set(data.senderId, {
            ...prev,
            name: a.name || prev.name,
            avatarText: a.avatarText || prev.avatarText,
            avatarBg: a.avatarBg || prev.avatarBg,
            avatarPhoto: a.avatarPhoto !== undefined ? a.avatarPhoto : prev.avatarPhoto,
            role: a.role || prev.role || 'Student',
            lastSeen: Date.now()
          });
          window.uiController?.renderMembers();
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
    if (!uid || (uid === this.userId && data.sessionId === this.sessionId)) return;

    if (data.type === 'LEAVE') {
      this.remotePresence.delete(uid);
      const chId = data.channelId;
      if (chId && window.stateManager.state.voiceParticipants[chId]) {
        window.stateManager.state.voiceParticipants[chId] = 
          window.stateManager.state.voiceParticipants[chId].filter(p => p.id !== uid && p.peerId !== data.peerId);
        window.uiController?.renderChannels();
        window.uiController?.renderVoiceStage();
      }
      if (data.peerId) {
        this.cleanupPeer(data.peerId);
      }
      window.uiController?.renderMembers();
      return;
    }

    if (data.type === 'MUTE_STATE') {
      const activeVoice = data.channelId;
      if (activeVoice && window.stateManager.state.voiceParticipants[activeVoice]) {
        const p = window.stateManager.state.voiceParticipants[activeVoice].find(x => x.id === uid || x.peerId === data.peerId);
        if (p) {
          p.isMuted = data.isMuted;
          window.uiController?.renderVoiceStage();
          window.uiController?.renderChannels();
        }
      }
      return;
    }

    const activeVoice = data.activeVoiceChannelId || data.channelId;
    const prev = this.remotePresence.get(uid) || {};
    this.remotePresence.set(uid, {
      name: data.name || prev.name,
      channelId: activeVoice,
      peerId: data.peerId || prev.peerId,
      lastSeen: Date.now(),
      avatarBg: data.avatarBg || prev.avatarBg,
      avatarText: data.avatarText || prev.avatarText,
      avatarPhoto: data.avatarPhoto !== undefined ? data.avatarPhoto : prev.avatarPhoto,
      role: data.role || prev.role || 'Student',
      customStatus: data.customStatus !== undefined ? data.customStatus : prev.customStatus,
      bio: data.bio !== undefined ? data.bio : prev.bio,
      bannerColor: data.bannerColor || prev.bannerColor,
      isMuted: data.isMuted || false
    });

    if (activeVoice) {
      if (!window.stateManager.state.voiceParticipants[activeVoice]) {
        window.stateManager.state.voiceParticipants[activeVoice] = [];
      }

      const list = window.stateManager.state.voiceParticipants[activeVoice];
      let p = list.find(x => x.id === uid || (x.peerId && x.peerId === data.peerId));
      if (!p) {
        p = {
          id: uid,
          peerId: data.peerId,
          isRealPeer: true,
          name: data.name,
          avatarText: data.avatarText || data.name.substring(0, 2).toUpperCase(),
          avatarBg: data.avatarBg || '#23a55a',
          avatarPhoto: data.avatarPhoto || null,
          role: data.role || 'Student',
          customStatus: data.customStatus || '',
          bio: data.bio || '',
          bannerColor: data.bannerColor || data.avatarBg || '#5865F2',
          isSpeaking: false,
          isMuted: data.isMuted || false
        };
        list.push(p);
        window.uiController?.renderChannels();
        window.uiController?.renderVoiceStage();
      } else {
        p.peerId = data.peerId || p.peerId;
        p.isRealPeer = true;
        if (data.name) p.name = data.name;
        if (data.avatarPhoto !== undefined) p.avatarPhoto = data.avatarPhoto;
        if (data.role) p.role = data.role;
        if (data.customStatus !== undefined) p.customStatus = data.customStatus;
        if (data.bio !== undefined) p.bio = data.bio;
        if (data.bannerColor) p.bannerColor = data.bannerColor;
        if (typeof data.isMuted === 'boolean') {
          p.isMuted = data.isMuted;
        }
        window.uiController?.renderChannels();
        window.uiController?.renderVoiceStage();
      }

      // If friend just sent JOIN and we are in the channel, send immediate VOICE_ACK back!
      if (data.type === 'JOIN' && window.stateManager.state.activeVoiceChannelId === activeVoice) {
        this.broadcastVoiceAck(activeVoice, uid);
      }

      // If both of us are in this voice channel, connect via WebRTC!
      if (window.stateManager.state.activeVoiceChannelId === activeVoice && data.peerId && this.peer && this.peerId) {
        // Prevent collision/glare: peer with lexicographically smaller peerId calls
        if (this.peerId < data.peerId) {
          this.initiateVoiceCallToPeer(data.peerId);
        }
      }
    }

    // Refresh member list so online peers show up with their latest profile!
    window.uiController?.renderMembers();
  }

  async initiateVoiceCallToPeer(remotePeerId) {
    if (this.activeVoiceCallPeers.has(remotePeerId)) return;
    if (!this.peer || !this.peerId) return;

    const myStream = await this.getOrCreateMicStream();
    console.log('[UniCord Voice WebRTC] Calling friend peer:', remotePeerId);

    try {
      const call = this.peer.call(remotePeerId, myStream);
      if (call) {
        this.setupRemoteAudioStream(call);
      }
    } catch (e) {
      console.warn('[UniCord Voice WebRTC] Call initiation failed:', e);
    }
  }
}

window.networkEngine = new NetworkEngine();
