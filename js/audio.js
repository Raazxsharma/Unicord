/**
 * UniCord Web Audio Engine
 * Generates authentic Discord-style audio effects entirely with Web Audio API.
 * Handles microphone capture and voice activity detection (green speaking ring).
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.micStream = null;
    this.analyser = null;
    this.micSource = null;
    this.isListening = false;
    this.speakingThreshold = 18; // RMS threshold
    this.onSpeakingChange = null; // Callback: (isSpeaking, volumeLevel)
    this.isSpeaking = false;
    this.simulatedVoiceInterval = null;
  }

  // Ensure AudioContext is initialized on user gesture
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // 1. Join Voice Sound (Two-tone rising chime)
  playJoinSound() {
    this.initContext();
    const now = this.ctx.currentTime;
    
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    // F4 (349.23 Hz) to C5 (523.25 Hz)
    osc1.frequency.setValueAtTime(349.23, now);
    osc1.frequency.exponentialRampToValueAtTime(523.25, now + 0.12);

    osc2.frequency.setValueAtTime(523.25, now + 0.12);
    osc2.frequency.setValueAtTime(698.46, now + 0.18); // F5

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.15);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.45);
  }

  // 2. Leave Voice Sound (Two-tone descending drop)
  playLeaveSound() {
    this.initContext();
    const now = this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now); // C5
    osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.22); // C4

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.35);
  }

  // 3. Mute Sound (Muted low pop)
  playMuteSound() {
    this.initContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.09);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 4. Unmute Sound (Bright pop)
  playUnmuteSound() {
    this.initContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.09);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // 5. Deafen Sound
  playDeafenSound() {
    this.initContext();
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.linearRampToValueAtTime(130, now + 0.15);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  // 6. Message Ping Sound (Classic Discord marimba ping)
  playMessagePing() {
    this.initContext();
    const now = this.ctx.currentTime;

    const notes = [880, 1318.51]; // A5 and E6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);

      gain.gain.setValueAtTime(0.18, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.22);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.25);
    });
  }

  // 7. Outgoing Call Ring
  
  // Loopable Discord Ringtone Synthesizer
  startRingtone() {
    this.stopRingtone();
    this.initContext();
    this.isRinging = true;

    const playTone = () => {
      if (!this.isRinging || !this.ctx) return;
      const now = this.ctx.currentTime;

      const freqs = [440, 480];
      freqs.forEach(f => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 1.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.9);
      });
    };

    playTone();
    this.ringInterval = setInterval(() => {
      if (this.isRinging) playTone();
      else clearInterval(this.ringInterval);
    }, 3200);
  }

  stopRingtone() {
    this.isRinging = false;
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  playCallRing() {
    this.initContext();
    const now = this.ctx.currentTime;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc1.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(480, now);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.8);
    osc2.stop(now + 0.8);
  }

  // 8. Soundboard SFX Synthesizer
  playSoundboard(name) {
    this.initContext();
    const now = this.ctx.currentTime;

    switch (name) {
      case 'airhorn': {
        const freqs = [466.16, 466.16, 466.16, 622.25];
        freqs.forEach((f, i) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(f, now + i * 0.12);
          gain.gain.setValueAtTime(0.15, now + i * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.18);
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + i * 0.12);
          osc.stop(now + i * 0.12 + 0.2);
        });
        break;
      }
      case 'applause': {
        // Noise synthesis for clapping
        const bufferSize = this.ctx.sampleRate * 1.2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1000;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        whiteNoise.start(now);
        break;
      }
      case 'quack': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.25);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case 'bell': {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 1.5);
        break;
      }
      default:
        this.playMessagePing();
    }
  }

  // ----------------- MICROPHONE & VOICE ACTIVITY DETECTION -----------------
  async startMicrophoneDetection() {
    this.initContext();
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micSource = this.ctx.createMediaStreamSource(this.micStream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.micSource.connect(this.analyser);
      this.isListening = true;
      this._pollMicrophone();
      return true;
    } catch (err) {
      console.warn('[UniCord Audio] Microphone access not granted or not available. Using voice simulation mode.', err);
      this.startSimulatedVoiceDetection();
      return false;
    }
  }

  _pollMicrophone() {
    if (!this.isListening || !this.analyser) return;

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const isNowSpeaking = average > this.speakingThreshold;

    if (isNowSpeaking !== this.isSpeaking) {
      this.isSpeaking = isNowSpeaking;
      if (this.onSpeakingChange) {
        this.onSpeakingChange(this.isSpeaking, average);
      }
    }

    requestAnimationFrame(() => this._pollMicrophone());
  }

  // Simulated voice activity (when mic permission is absent or testing)
  startSimulatedVoiceDetection() {
    this.isListening = true;
    this.simulatedVoiceInterval = setInterval(() => {
      // Simulate random occasional speech when connected to voice
      const randomSpeaking = Math.random() > 0.65;
      if (randomSpeaking !== this.isSpeaking) {
        this.isSpeaking = randomSpeaking;
        if (this.onSpeakingChange) {
          this.onSpeakingChange(this.isSpeaking, randomSpeaking ? 65 : 5);
        }
      }
    }, 1200);
  }

  stopMicrophoneDetection() {
    this.isListening = false;
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.simulatedVoiceInterval) {
      clearInterval(this.simulatedVoiceInterval);
      this.simulatedVoiceInterval = null;
    }
    this.isSpeaking = false;
    if (this.onSpeakingChange) {
      this.onSpeakingChange(false, 0);
    }
  }

  // ==========================================
  // LO-FI MUSIC GENERATOR & PLAYER (WEB AUDIO)
  // ==========================================
  initLofiEngine() {
    this.lofiPlaying = false;
    this.lofiTrack = 'lofi-chill';
    this.lofiVolume = 0.4;
    this.lofiTimer = null;
    this.lofiGain = null;
    this.lofiChordIndex = 0;
    this.onLofiChange = null;

    this.lofiTracks = {
      'lofi-chill': {
        name: '☕ Coffee Shop Study',
        desc: 'Mellow Rhodes & Warm Chords',
        bpm: 72,
        chords: [
          [261.63, 329.63, 392.00, 493.88], // Cmaj7 (C4, E4, G4, B4)
          [220.00, 261.63, 329.63, 392.00], // Am7 (A3, C4, E4, G4)
          [293.66, 349.23, 440.00, 523.25], // Dm7 (D4, F4, A4, C5)
          [196.00, 261.63, 293.66, 392.00]  // G7sus4 (G3, C4, D4, G4)
        ],
        bass: [130.81, 110.00, 146.83, 98.00]
      },
      'lofi-night': {
        name: '🌙 2AM Deep Focus',
        desc: 'Chillhop Chimes & Soft Resonance',
        bpm: 64,
        chords: [
          [220.00, 261.63, 329.63, 440.00], // Am
          [174.61, 220.00, 261.63, 329.63], // Fmaj7
          [261.63, 329.63, 392.00, 523.25], // Cmaj
          [196.00, 246.94, 293.66, 392.00]  // Gmaj
        ],
        bass: [110.00, 87.31, 130.81, 98.00]
      },
      'lofi-ambient': {
        name: '🌧️ Rainy Campus Library',
        desc: 'Gentle Piano & Binaural Ambience',
        bpm: 56,
        chords: [
          [261.63, 392.00, 493.88, 659.25], // Cmaj9
          [329.63, 440.00, 493.88, 659.25], // Em7
          [220.00, 329.63, 392.00, 523.25], // Am7
          [174.61, 261.63, 329.63, 440.00]  // Fmaj7
        ],
        bass: [130.81, 164.81, 110.00, 87.31]
      }
    };
  }

  toggleLofi(trackId = null) {
    if (this.lofiPlaying) {
      if (trackId && trackId !== this.lofiTrack) {
        this.lofiTrack = trackId;
        if (this.onLofiChange) this.onLofiChange(true, this.lofiTracks[this.lofiTrack], this.lofiVolume);
        return;
      }
      this.stopLofi();
    } else {
      this.startLofi(trackId || this.lofiTrack);
    }
  }

  startLofi(trackId = 'lofi-chill') {
    this.initContext();
    if (!this.lofiTracks) this.initLofiEngine();

    this.lofiTrack = trackId;
    this.lofiPlaying = true;
    this.lofiChordIndex = 0;

    if (!this.lofiGain) {
      this.lofiGain = this.ctx.createGain();
      this.lofiGain.gain.setValueAtTime(this.lofiVolume, this.ctx.currentTime);
      this.lofiGain.connect(this.ctx.destination);
    } else {
      this.lofiGain.gain.setTargetAtTime(this.lofiVolume, this.ctx.currentTime, 0.1);
    }

    this._playNextLofiBar();

    const trackInfo = this.lofiTracks[this.lofiTrack];
    const beatInterval = (60 / trackInfo.bpm) * 4 * 1000;
    this.lofiTimer = setInterval(() => {
      this._playNextLofiBar();
    }, beatInterval);

    if (this.onLofiChange) {
      this.onLofiChange(true, trackInfo, this.lofiVolume);
    }
  }

  _playNextLofiBar() {
    if (!this.lofiPlaying || !this.ctx) return;
    const track = this.lofiTracks[this.lofiTrack] || this.lofiTracks['lofi-chill'];
    const chord = track.chords[this.lofiChordIndex % track.chords.length];
    const bassFreq = track.bass[this.lofiChordIndex % track.bass.length];
    this.lofiChordIndex++;

    const now = this.ctx.currentTime;
    const duration = (60 / track.bpm) * 3.8;

    // Filter node for mellow Lo-Fi warmth
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(1.5, now);
    filter.connect(this.lofiGain);

    // Play chord tones
    chord.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const noteGain = this.ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      // Subtle tape flutter detuning
      const detune = (Math.random() - 0.5) * 8;
      osc.frequency.setValueAtTime(freq, now);
      osc.detune.setValueAtTime(detune, now);

      noteGain.gain.setValueAtTime(0, now);
      noteGain.gain.linearRampToValueAtTime(0.06, now + 0.35 + (idx * 0.05));
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

      osc.connect(noteGain);
      noteGain.connect(filter);

      osc.start(now + (idx * 0.04));
      osc.stop(now + duration + 0.1);
    });

    // Sub Bass Note
    if (bassFreq) {
      const bassOsc = this.ctx.createOscillator();
      const bassGain = this.ctx.createGain();
      bassOsc.type = 'sine';
      bassOsc.frequency.setValueAtTime(bassFreq, now);

      bassGain.gain.setValueAtTime(0, now);
      bassGain.gain.linearRampToValueAtTime(0.12, now + 0.2);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + duration * 0.9);

      bassOsc.connect(bassGain);
      bassGain.connect(filter);

      bassOsc.start(now);
      bassOsc.stop(now + duration);
    }
  }

  stopLofi() {
    this.lofiPlaying = false;
    if (this.lofiTimer) {
      clearInterval(this.lofiTimer);
      this.lofiTimer = null;
    }
    if (this.lofiGain && this.ctx) {
      this.lofiGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
    }
    if (this.onLofiChange) {
      this.onLofiChange(false, this.lofiTracks ? this.lofiTracks[this.lofiTrack] : null, this.lofiVolume);
    }
  }

  setLofiVolume(val) {
    this.lofiVolume = Math.max(0, Math.min(1, val));
    if (this.lofiGain && this.ctx) {
      this.lofiGain.gain.setTargetAtTime(this.lofiVolume, this.ctx.currentTime, 0.05);
    }
    if (this.onLofiChange) {
      this.onLofiChange(this.lofiPlaying, this.lofiTracks ? this.lofiTracks[this.lofiTrack] : null, this.lofiVolume);
    }
  }
}

// Global Audio Engine Instance
window.audioEngine = new AudioEngine();
