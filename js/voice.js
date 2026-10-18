/**
 * UniCord Voice Channel Controller
 * Manages voice connection, microphone analysis, speaker rings, and simulated room activity.
 */

class VoiceController {
  constructor() {
    this.botSpeakingInterval = null;
    this.cameraStream = null;
    this.screenStream = null;
    this.isCameraOn = false;
    this.callTimerInterval = null;
    this.callElapsedSeconds = 802; // Initial 13:22 to match realistic Google Meet session
    this.initAudioHooks();
  }

  initAudioHooks() {
    window.audioEngine.onSpeakingChange = (isSpeaking, level) => {
      this.handleUserSpeaking(isSpeaking, level);
    };
  }

  startCallTimer() {
    this.stopCallTimer();
    this.callTimerInterval = setInterval(() => {
      this.callElapsedSeconds++;
      const timerEl = document.getElementById('meet-live-timer');
      if (timerEl) {
        timerEl.textContent = this.getFormattedTime();
      }
    }, 1000);
  }

  stopCallTimer() {
    if (this.callTimerInterval) {
      clearInterval(this.callTimerInterval);
      this.callTimerInterval = null;
    }
  }

  getFormattedTime() {
    const mins = Math.floor(this.callElapsedSeconds / 60);
    const secs = this.callElapsedSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  async joinVoice(channelId, channelName, guildName) {
    if (window.stateManager.state.activeVoiceChannelId === channelId) {
      // Already in this channel, open stage view if requested
      window.uiController.showMeetStage(true, channelName, guildName);
      return;
    }

    // If currently in another voice channel, leave first
    if (window.stateManager.state.activeVoiceChannelId) {
      this.leaveVoice(false);
    }

    window.stateManager.state.activeVoiceChannelId = channelId;
    window.stateManager.state.activeStageChannelId = channelId;

    // Start timer & audio chime
    this.startCallTimer();
    window.audioEngine.playJoinSound();

    // Start live microphone detection
    await window.audioEngine.startMicrophoneDetection();

    // Add current user to channel participants
    if (!window.stateManager.state.voiceParticipants[channelId]) {
      window.stateManager.state.voiceParticipants[channelId] = [];
    }

    const me = window.stateManager.state.currentUser;
    const exists = window.stateManager.state.voiceParticipants[channelId].some(p => p.id === me.id);
    if (!exists) {
      window.stateManager.state.voiceParticipants[channelId].push({
        id: me.id,
        name: me.name,
        avatarText: me.avatarText,
        avatarBg: me.avatarBg,
        avatarPhoto: me.avatarPhoto || null,
        isSpeaking: false,
        isMuted: window.stateManager.state.isMuted,
        isHandRaised: false
      });
    }

    // Start background speaker simulation for other classmates in the room
    this.startBotVoiceSimulation(channelId);

    // Broadcast voice join to other real students across the internet
    if (window.networkEngine) {
      window.networkEngine.broadcastVoiceJoin(channelId);
    }

    // Choose initial view mode: spotlight if a presenter is actively presenting, otherwise grid
    const chanParticipants = window.stateManager.state.voiceParticipants[channelId] || [];
    const hasActivePresenter = chanParticipants.some(p => p.isPresenter);
    window.stateManager.state.meetViewMode = hasActivePresenter ? 'spotlight' : 'grid';
    window.stateManager.state.isDocPresenting = hasActivePresenter;

    window.stateManager.saveState();
    window.uiController.updateVoiceConnectionUI(true, channelName, guildName);
    window.uiController.showMeetStage(true, channelName, guildName);
  }

  leaveVoice(playSound = true) {
    const channelId = window.stateManager.state.activeVoiceChannelId;
    if (!channelId) return;

    if (playSound) {
      window.audioEngine.playLeaveSound();
    }

    this.stopCallTimer();

    // Broadcast voice leave to other real students
    if (window.networkEngine) {
      window.networkEngine.broadcastVoiceLeave(channelId);
    }

    window.audioEngine.stopMicrophoneDetection();

    // Remove user from participants
    const me = window.stateManager.state.currentUser;
    if (window.stateManager.state.voiceParticipants[channelId]) {
      window.stateManager.state.voiceParticipants[channelId] = 
        window.stateManager.state.voiceParticipants[channelId].filter(p => p.id !== me.id);
    }

    this.stopBotVoiceSimulation();
    this.stopCamera();
    this.stopScreenShare();
    if (window.audioEngine.lofiPlaying) {
      window.audioEngine.stopLofi();
    }

    window.stateManager.state.activeVoiceChannelId = null;
    window.stateManager.state.activeStageChannelId = null;
    window.stateManager.state.isScreenSharing = false;
    window.stateManager.state.isHandRaised = false;
    window.stateManager.saveState();

    window.uiController.updateVoiceConnectionUI(false);
    window.uiController.showMeetStage(false);
  }

  toggleHandRaise() {
    const isRaised = !window.stateManager.state.isHandRaised;
    window.stateManager.state.isHandRaised = isRaised;

    // Update in participant list
    const chId = window.stateManager.state.activeVoiceChannelId;
    if (chId && window.stateManager.state.voiceParticipants[chId]) {
      const me = window.stateManager.state.voiceParticipants[chId].find(p => p.id === window.stateManager.state.currentUser.id);
      if (me) me.isHandRaised = isRaised;
    }

    // Play pleasant notification sound
    if (isRaised) {
      if (window.audioEngine.playJoinSound) window.audioEngine.playJoinSound();
      this.sendInCallMessage(`✋ ${window.stateManager.state.currentUser.name} raised hand`);
    }

    window.stateManager.saveState();
    window.uiController.renderMeetStage();
  }

  sendReaction(emoji) {
    window.uiController.spawnFloatingReaction(emoji);
    
    // Play light pop sound
    if ('AudioContext' in window || 'webkitAudioContext' in window) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(540, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch (e) {}
    }

    // Close reactions tray
    const tray = document.getElementById('meet-reactions-tray');
    if (tray) tray.style.display = 'none';

    if (window.networkEngine) {
      window.networkEngine.broadcastReaction?.(emoji);
    }
  }

  toggleMeetViewMode(mode) {
    window.stateManager.state.meetViewMode = mode;
    window.stateManager.saveState();
    window.uiController.renderMeetStage();
  }

  toggleDocPresenting() {
    window.stateManager.state.isDocPresenting = !window.stateManager.state.isDocPresenting;
    if (window.stateManager.state.isDocPresenting) {
      window.stateManager.state.meetViewMode = 'spotlight';
    }
    window.stateManager.saveState();
    window.uiController.renderMeetStage();
  }

  toggleInCallDrawer(tab) {
    const current = window.stateManager.state.inCallDrawerOpen;
    window.stateManager.state.inCallDrawerOpen = current === tab ? null : tab;
    window.stateManager.saveState();
    window.uiController.renderMeetStage();
  }

  zoomPresentationDoc(delta) {
    let current = window.stateManager.state.docZoom || 100;
    current = Math.min(160, Math.max(70, current + delta));
    window.stateManager.state.docZoom = current;
    window.stateManager.saveState();
    
    const paper = document.getElementById('meet-doc-paper');
    const zoomLabel = document.getElementById('meet-doc-zoom-label');
    if (paper) paper.style.transform = `scale(${current / 100})`;
    if (zoomLabel) zoomLabel.textContent = `${current}%`;
  }

  toggleLaserPointer() {
    this.isLaserActive = !this.isLaserActive;
    window.uiController.renderMeetStage();
  }

  async togglePiP() {
    try {
      const vid = document.querySelector('.meet-video-screen');
      if (vid) {
        if (document.pictureInPictureElement) {
          await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled) {
          await vid.requestPictureInPicture();
        }
      }
    } catch (e) {
      console.warn('[UniCord PiP] Picture-in-picture error:', e);
    }
  }

  toggleFitMode() {
    const vid = document.querySelector('.meet-video-screen');
    if (!vid) return;
    const current = vid.style.objectFit || 'contain';
    vid.style.objectFit = current === 'contain' ? 'cover' : 'contain';
    const label = document.getElementById('screenshare-fit-label');
    if (label) label.textContent = vid.style.objectFit === 'cover' ? 'Fill' : 'Fit';
  }

  sendInCallMessage(text) {
    if (!text || !text.trim()) return;
    const msg = {
      id: 'im-' + Date.now(),
      author: window.stateManager.state.currentUser.name,
      time: this.getFormattedTime(),
      text: text.trim()
    };
    if (!window.stateManager.state.inCallMessages) {
      window.stateManager.state.inCallMessages = [];
    }
    window.stateManager.state.inCallMessages.push(msg);
    window.stateManager.saveState();
    window.uiController.renderMeetStage();

    // Auto response from Sourabh Singh only if he is actually in this voice channel
    const currentChId = window.stateManager.state.activeVoiceChannelId;
    const hasSourabhInRoom = window.stateManager.state.voiceParticipants[currentChId]?.some(p => p.name === 'Sourabh Singh');
    if (hasSourabhInRoom && (text.includes('?') || text.toLowerCase().includes('sir'))) {
      setTimeout(() => {
        const answers = [
          "Good question! As highlighted on page 9, consent management architecture is decentralized.",
          "Check the second paragraph under API Architecture, it mentions third-party aggregator tokens.",
          "Exactly right. We will explore Fraud and Regulations in the next slide."
        ];
        const ans = answers[Math.floor(Math.random() * answers.length)];
        window.stateManager.state.inCallMessages.push({
          id: 'im-reply-' + Date.now(),
          author: 'Sourabh Singh',
          time: this.getFormattedTime(),
          text: ans
        });
        window.stateManager.saveState();
        window.uiController.renderMeetStage();
      }, 2200);
    }
  }

  toggleMute() {
    const isMuted = !window.stateManager.state.isMuted;
    window.stateManager.state.isMuted = isMuted;

    if (isMuted) {
      window.audioEngine.playMuteSound();
    } else {
      window.audioEngine.playUnmuteSound();
    }

    // Actually enable or disable the live microphone track
    if (window.audioEngine?.micStream) {
      window.audioEngine.micStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }

    // Update in voice participants
    const chId = window.stateManager.state.activeVoiceChannelId;
    if (chId && window.stateManager.state.voiceParticipants[chId]) {
      const me = window.stateManager.state.voiceParticipants[chId].find(p => p.id === window.stateManager.state.currentUser.id);
      if (me) me.isMuted = isMuted;
    }

    // Broadcast mute state to other users in real time
    if (window.networkEngine) {
      window.networkEngine.broadcastMuteState(isMuted);
    }

    window.stateManager.saveState();
    window.uiController.updateUserBarControls();
    if (window.uiController.updateVoiceCardMuteState) {
      window.uiController.updateVoiceCardMuteState(window.stateManager.state.currentUser.id, isMuted);
    }
    window.uiController.renderChannels();
  }

  toggleDeafen() {
    const isDeafened = !window.stateManager.state.isDeafened;
    window.stateManager.state.isDeafened = isDeafened;

    window.audioEngine.playDeafenSound();

    if (isDeafened) {
      window.stateManager.state.isMuted = true;
      if (window.audioEngine?.micStream) {
        window.audioEngine.micStream.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
    }

    // Mute/unmute remote incoming audio
    if (window.networkEngine) {
      window.networkEngine.setRemoteAudioMuted(isDeafened);
    }

    window.stateManager.saveState();
    window.uiController.updateUserBarControls();
    if (window.uiController.updateVoiceCardMuteState) {
      window.uiController.updateVoiceCardMuteState(window.stateManager.state.currentUser.id, isDeafened || window.stateManager.state.isMuted);
    }
    window.uiController.renderChannels();
  }

  async toggleCamera() {
    if (this.isCameraOn) {
      this.stopCamera();
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          this.cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
            audio: false
          });
          this.cameraStream.getVideoTracks().forEach(track => {
            track.onended = () => this.stopCamera();
          });
        }
      } catch (e) {
        console.warn('[UniCord Camera] Camera permission or device unavailable, using simulated video', e);
      }
      this.isCameraOn = true;
    }
    if (window.networkEngine) window.networkEngine.reconnectWebRTC();
    window.uiController.renderVoiceStage();
    window.uiController.updateVoiceConnectionUI(true);
  }

  stopCamera() {
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    this.isCameraOn = false;
    if (window.networkEngine) window.networkEngine.reconnectWebRTC();
    window.uiController.renderVoiceStage();
    window.uiController.updateVoiceConnectionUI(true);
  }

  async toggleScreenShare() {
    if (window.stateManager.state.isScreenSharing) {
      this.stopScreenShare();
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          this.screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: {
              width: { ideal: 1920, max: 3840 },
              height: { ideal: 1080, max: 2160 },
              frameRate: { ideal: 60, max: 60 }
            },
            audio: false
          });
          this.screenStream.getVideoTracks().forEach(track => {
            track.onended = () => this.stopScreenShare();
          });
        }
      } catch (e) {
        console.warn('[UniCord ScreenShare] User cancelled or permission denied; using presentation preview mode', e);
      }
      window.stateManager.state.isScreenSharing = true;
      window.stateManager.saveState();
      if (window.networkEngine) window.networkEngine.reconnectWebRTC();
    }
    window.uiController.renderVoiceStage();
    window.uiController.updateVoiceConnectionUI(true);
  }

  stopScreenShare() {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach(t => t.stop());
      this.screenStream = null;
    }
    window.stateManager.state.isScreenSharing = false;
    window.stateManager.saveState();
    if (window.networkEngine) window.networkEngine.reconnectWebRTC();
    window.uiController.renderVoiceStage();
    window.uiController.updateVoiceConnectionUI(true);
  }

  handleUserSpeaking(isSpeaking, level) {
    if (window.stateManager.state.isMuted || window.stateManager.state.isDeafened) {
      isSpeaking = false;
    }

    const chId = window.stateManager.state.activeVoiceChannelId;
    if (!chId) return;

    // Update user speaking state
    const participants = window.stateManager.state.voiceParticipants[chId];
    if (participants) {
      const me = participants.find(p => p.id === window.stateManager.state.currentUser.id);
      if (me) {
        me.isSpeaking = isSpeaking;
      }
    }

    // Highlight user avatar with pulsing green halo in UI
    window.uiController.setUserSpeakingHighlight(isSpeaking);

    // Mic test meter in settings
    const micFill = document.getElementById('mic-test-fill');
    if (micFill) {
      micFill.style.width = Math.min(100, Math.max(0, level * 2)) + '%';
    }
  }

  startBotVoiceSimulation(channelId) {
    this.stopBotVoiceSimulation();

    // Trigger an initial greeting after joining so user immediately hears their voice!
    setTimeout(() => {
      this.playParticipantVoice(channelId);
    }, 1200);

    this.botSpeakingInterval = setInterval(() => {
      if (Math.random() > 0.35) {
        this.playParticipantVoice(channelId);
      }
    }, 6000);
  }

  playParticipantVoice(channelId) {
    const participants = window.stateManager.state.voiceParticipants[channelId];
    if (!participants || participants.length <= 1) return;

    // Pick only simulated/bot classmates, NEVER take over a real peer's voice!
    const classmates = participants.filter(p => 
      p.id !== window.stateManager.state.currentUser.id && 
      !p.isMuted && 
      !p.peerId && 
      !p.isRealPeer
    );
    if (classmates.length === 0) return;

    const speaker = classmates[Math.floor(Math.random() * classmates.length)];
    if (!speaker) return;

    // Turn on green speaking ring
    speaker.isSpeaking = true;
    if (window.uiController.setRemoteUserSpeakingHighlight) {
      window.uiController.setRemoteUserSpeakingHighlight(speaker.id, true);
    }
    window.uiController.renderChannels();

    // Check if user has deafened their headphones
    if (window.stateManager.state.isDeafened) {
      setTimeout(() => {
        speaker.isSpeaking = false;
        if (window.uiController.setRemoteUserSpeakingHighlight) {
          window.uiController.setRemoteUserSpeakingHighlight(speaker.id, false);
        }
        window.uiController.renderChannels();
      }, 1500);
      return;
    }

    // Play real audible voice through speakers using browser speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop any pending speech

      let phrases = [
        "Hey! Can you hear me clearly in this voice channel?",
        "Yeah, my microphone is working! The voice quality sounds great.",
        "Testing, one two three. Can everyone in the voice room hear this?",
        "Audio is crystal clear on my end too!"
      ];
      if (speaker.name === 'Sourabh Singh') {
        phrases = [
          "As shown on page 9, API consent architecture protects sensitive banking credentials.",
          "An API connects two independent systems in a structured and audited way.",
          "Next up in Fintech Ecosystem: Risk, Fraud and Regulation framework.",
          "Can everyone see the Fintech presentation notes on screen?",
          "Notice how third-party apps only receive authorized token data, never raw passwords."
        ];
      }
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      const utter = new SpeechSynthesisUtterance(phrase);

      utter.volume = 1.0;
      utter.rate = 1.0;

      // Female pitch for Sarah/Priya/Ananya, natural male pitch for Rohan/Ghost
      const isFemale = /sarah|priya|ananya/i.test(speaker.name);
      utter.pitch = isFemale ? 1.25 : 0.95;

      utter.onend = () => {
        speaker.isSpeaking = false;
        if (window.uiController.setRemoteUserSpeakingHighlight) {
          window.uiController.setRemoteUserSpeakingHighlight(speaker.id, false);
        }
        window.uiController.renderChannels();
      };

      utter.onerror = () => {
        speaker.isSpeaking = false;
        if (window.uiController.setRemoteUserSpeakingHighlight) {
          window.uiController.setRemoteUserSpeakingHighlight(speaker.id, false);
        }
        window.uiController.renderChannels();
      };

      window.speechSynthesis.speak(utter);
    } else {
      // Fallback timer if speech synthesis is not supported
      setTimeout(() => {
        speaker.isSpeaking = false;
        if (window.uiController.setRemoteUserSpeakingHighlight) {
          window.uiController.setRemoteUserSpeakingHighlight(speaker.id, false);
        }
        window.uiController.renderChannels();
      }, 2000);
    }
  }

  stopBotVoiceSimulation() {
    if (this.botSpeakingInterval) {
      clearInterval(this.botSpeakingInterval);
      this.botSpeakingInterval = null;
    }
  }
}

window.voiceController = new VoiceController();
