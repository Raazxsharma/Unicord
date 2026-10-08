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
    this.initAudioHooks();
  }

  initAudioHooks() {
    window.audioEngine.onSpeakingChange = (isSpeaking, level) => {
      this.handleUserSpeaking(isSpeaking, level);
    };
  }

  async joinVoice(channelId, channelName, guildName) {
    if (window.stateManager.state.activeVoiceChannelId === channelId) {
      return; // Already in this channel
    }

    // If currently in another voice channel, leave first
    if (window.stateManager.state.activeVoiceChannelId) {
      this.leaveVoice(false);
    }

    window.stateManager.state.activeVoiceChannelId = channelId;

    // Play Join chime
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
        isMuted: window.stateManager.state.isMuted
      });
    }

    // Start background speaker simulation for other classmates in the room
    this.startBotVoiceSimulation(channelId);

    // Broadcast voice join to other real students across the internet
    if (window.networkEngine) {
      window.networkEngine.broadcastVoiceJoin(channelId);
    }

    window.stateManager.saveState();
    window.uiController.updateVoiceConnectionUI(true, channelName, guildName);
  }

  leaveVoice(playSound = true) {
    const channelId = window.stateManager.state.activeVoiceChannelId;
    if (!channelId) return;

    if (playSound) {
      window.audioEngine.playLeaveSound();
    }

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
    window.stateManager.state.isScreenSharing = false;
    window.stateManager.saveState();

    window.uiController.updateVoiceConnectionUI(false);
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

      const phrases = [
        "Hey! Can you hear me clearly in this voice channel?",
        "Yeah, my microphone is working! The voice quality sounds great.",
        "Hey Alex! I'm here in the channel, what are we working on?",
        "Testing, one two three. Can everyone in the voice room hear this?",
        "Audio is crystal clear on my end too!"
      ];
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
