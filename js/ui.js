/**
 * UniCord UI Controller
 * Manages DOM updates, renders guilds, channels, messages, voice stage, and modals.
 */

class UIController {

  // ================= SERVER EDIT & SETTINGS =================
  openServerSettingsModal() {
    const guild = window.stateManager.getCurrentGuild();
    if (!guild) return;

    const modal = document.getElementById('modal-edit-server');
    const nameInput = document.getElementById('input-edit-server-name');
    const initialsInput = document.getElementById('input-edit-server-initials');
    const previewIcon = document.getElementById('server-edit-preview-icon');
    const previewText = document.getElementById('server-edit-preview-text');
    const previewName = document.getElementById('server-edit-preview-name');

    if (!modal) return;

    modal.setAttribute('data-guild-id', guild.id);
    if (nameInput) nameInput.value = guild.name;
    if (initialsInput) initialsInput.value = guild.initials;
    if (previewText) previewText.textContent = guild.initials;
    if (previewName) previewName.textContent = guild.name;
    if (previewIcon) previewIcon.style.backgroundColor = guild.color || '#5865F2';

    // Highlight active color
    document.querySelectorAll('.color-circle').forEach(c => {
      c.classList.toggle('active', c.dataset.color === (guild.color || '#5865F2'));
    });

    modal.style.display = 'flex';
  }

  closeServerSettingsModal() {
    const modal = document.getElementById('modal-edit-server');
    if (modal) modal.style.display = 'none';
  }

  getSafeAvatarInitials(user) {
    if (!user) return '?';
    if (user.shortInitials) return user.shortInitials;
    if (user.isOthersTile) return '+29';
    if (user.avatarText && user.avatarText.length <= 2 && !user.avatarText.startsWith('#')) {
      return user.avatarText;
    }
    const cleanName = (user.name || '').replace(/\(You\)/g, '').trim();
    const parts = cleanName.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return cleanName.substring(0, 2).toUpperCase() || 'U';
  }

  // ================= 1-ON-1 DIRECT CALLING =================
  startDirectCall(friendId, friendName, avatarText, avatarBg, isVideo = false) {
    this.activeCallFriend = { id: friendId, name: friendName, avatarText, avatarBg, isVideo };
    
    // Play Discord Outgoing Call Ringtone
    if (window.audioEngine) {
      window.audioEngine.startRingtone();
    }

    this.showIncomingCallModal(friendName, avatarText, avatarBg);
  }

  showIncomingCallModal(callerName, avatarText, avatarBg) {
    const modal = document.getElementById('modal-incoming-call');
    if (!modal) return;

    const nameEl = document.getElementById('incoming-call-name');
    const avatarEl = document.getElementById('incoming-call-avatar');

    if (nameEl) nameEl.textContent = callerName;
    if (avatarEl) {
      avatarEl.textContent = avatarText;
      avatarEl.style.backgroundColor = avatarBg;
    }

    modal.style.display = 'flex';

    this.autoAnswerTimeout = setTimeout(() => {
      if (modal.style.display === 'flex') {
        this.acceptDirectCall();
      }
    }, 3200);
  }

  acceptDirectCall() {
    clearTimeout(this.autoAnswerTimeout);
    const inModal = document.getElementById('modal-incoming-call');
    if (inModal) inModal.style.display = 'none';

    if (window.audioEngine) {
      window.audioEngine.stopRingtone();
      window.audioEngine.playJoinSound();
    }

    const callOverlay = document.getElementById('direct-call-overlay');
    if (callOverlay) {
      callOverlay.style.display = 'flex';
      const friend = this.activeCallFriend || { name: 'Sarah', avatarText: 'SA', avatarBg: '#23a55a' };
      const fName = document.getElementById('direct-call-remote-name');
      const fAvatar = document.getElementById('direct-call-remote-avatar');
      const title = document.getElementById('direct-call-title-text');

      if (fName) fName.textContent = friend.name;
      if (fAvatar) {
        fAvatar.textContent = friend.avatarText;
        fAvatar.style.backgroundColor = friend.avatarBg;
      }
      if (title) title.textContent = `Call with ${friend.name}`;

      this.callDurationSec = 0;
      const timerEl = document.getElementById('direct-call-timer');
      if (this.callTimerInterval) clearInterval(this.callTimerInterval);
      this.callTimerInterval = setInterval(() => {
        this.callDurationSec++;
        const mins = String(Math.floor(this.callDurationSec / 60)).padStart(2, '0');
        const secs = String(this.callDurationSec % 60).padStart(2, '0');
        if (timerEl) timerEl.textContent = `${mins}:${secs}`;
      }, 1000);

      const remoteCard = document.getElementById('direct-call-remote-card');
      this.remoteSpeakingInterval = setInterval(() => {
        if (remoteCard) remoteCard.classList.toggle('speaking');
      }, 1800);
    }
  }

  declineDirectCall() {
    clearTimeout(this.autoAnswerTimeout);
    const inModal = document.getElementById('modal-incoming-call');
    if (inModal) inModal.style.display = 'none';

    if (window.audioEngine) {
      window.audioEngine.stopRingtone();
      window.audioEngine.playLeaveSound();
    }
  }

  endDirectCall() {
    if (this.callTimerInterval) clearInterval(this.callTimerInterval);
    if (this.remoteSpeakingInterval) clearInterval(this.remoteSpeakingInterval);

    const callOverlay = document.getElementById('direct-call-overlay');
    if (callOverlay) callOverlay.style.display = 'none';

    if (window.audioEngine) {
      window.audioEngine.stopRingtone();
      window.audioEngine.playLeaveSound();
    }
  }

  constructor() {
    this.selectedMember = null;
    this.isWhatsAppMode = localStorage.getItem('unicord_wa_mode') !== 'false';
    this.activeAudioPlayer = null;
    this.audioPlaybackSpeed = 1;
    this.currentQuoteReply = null;
  }

  init() {
    this.applyWhatsAppMode();
    this.renderAll();
    this.setupTheme();
  }

  toggleWhatsAppMode() {
    this.isWhatsAppMode = !this.isWhatsAppMode;
    localStorage.setItem('unicord_wa_mode', this.isWhatsAppMode);
    this.applyWhatsAppMode();
    this.renderMessages();
  }

  applyWhatsAppMode() {
    const viewport = document.getElementById('chat-viewport');
    const toggleBtn = document.getElementById('btn-toggle-wa-mode');
    const msgInput = document.getElementById('message-input');
    const ch = window.stateManager ? window.stateManager.getCurrentChannel() : null;

    if (viewport) {
      viewport.classList.toggle('whatsapp-mode', this.isWhatsAppMode);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle('active', this.isWhatsAppMode);
      toggleBtn.setAttribute('data-tooltip', this.isWhatsAppMode ? 'WhatsApp UI Active (Click to switch to Discord UI)' : 'Switch to WhatsApp UI');
    }
    if (msgInput) {
      msgInput.placeholder = this.isWhatsAppMode ? 'Type a message' : (ch ? `Message #${ch.name}` : 'Message');
    }
  }

  renderAll() {
    this.renderGuilds();
    this.renderChannels();
    this.renderChannelHeader();
    this.renderMessages();
    this.renderMembers();
    this.renderUserBar();
    this.renderVoiceStage();
    this.renderFriends();
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('unicord_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }

  setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('unicord_theme', theme);
    document.querySelectorAll('.theme-card').forEach(card => {
      card.classList.toggle('active', card.dataset.theme === theme);
    });
  }

  // 1. Render Leftmost Guilds List
  renderGuilds() {
    const list = document.getElementById('guilds-list');
    const homeBtn = document.getElementById('guild-home');
    if (!list) return;

    list.innerHTML = '';
    const activeGuildId = window.stateManager.state.activeGuildId;

    if (homeBtn) {
      homeBtn.classList.toggle('active', activeGuildId === 'home');
    }

    window.stateManager.state.guilds.forEach((guild, index) => {
      const item = document.createElement('div');
      item.className = `guild-item ${activeGuildId === guild.id ? 'active' : ''} ${guild.unread ? 'unread' : ''}`;
      item.setAttribute('data-tooltip', guild.name);
      item.draggable = true;

      item.innerHTML = `
        <div class="guild-pill"></div>
        <button class="guild-btn" style="background-color: ${guild.color}; color: #ffffff;">
          ${guild.initials}
        </button>
        ${guild.unread ? '<div class="guild-badge">1</div>' : ''}
      `;

      item.onclick = () => {
        window.stateManager.state.activeGuildId = guild.id;
        guild.unread = false;
        // Select first text channel in the guild
        const firstChan = guild.categories[0]?.channels[0];
        if (firstChan) {
          window.stateManager.state.activeChannelId = firstChan.id;
        }
        window.stateManager.saveState();
        this.renderAll();
      };

      // Drag and Drop Logic
      item.ondragstart = (e) => {
        e.dataTransfer.setData('text/plain', index);
        item.style.opacity = '0.4';
      };

      item.ondragend = (e) => {
        item.style.opacity = '1';
        list.querySelectorAll('.guild-item').forEach(el => {
          el.style.transform = 'translateY(0)';
          el.style.borderTop = 'none';
          el.style.borderBottom = 'none';
        });
      };

      item.ondragover = (e) => {
        e.preventDefault(); // allow drop
      };

      item.ondragenter = (e) => {
        e.preventDefault();
        item.style.transform = 'translateY(4px)';
      };

      item.ondragleave = (e) => {
        item.style.transform = 'translateY(0)';
      };

      item.ondrop = (e) => {
        e.preventDefault();
        item.style.transform = 'translateY(0)';
        const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
        const toIndex = index;
        
        if (!isNaN(fromIndex) && fromIndex !== toIndex) {
          const guilds = window.stateManager.state.guilds;
          const movedItem = guilds.splice(fromIndex, 1)[0];
          guilds.splice(toIndex, 0, movedItem);
          window.stateManager.saveState();
          this.renderGuilds();
        }
      };

      list.appendChild(item);
    });
  }

  // 2. Render Channels Tree or Direct Messages
  renderChannels() {
    const serverHeader = document.getElementById('server-header');
    const dmHeader = document.getElementById('dm-header');
    const channelsTree = document.getElementById('channels-tree');
    const dmsNav = document.getElementById('dms-nav');
    const chatViewport = document.getElementById('chat-viewport');
    const friendsViewport = document.getElementById('friends-viewport');
    const membersSidebar = document.getElementById('members-sidebar');

    const activeGuildId = window.stateManager.state.activeGuildId;

    if (activeGuildId === 'home') {
      const isDM = window.stateManager.state.activeChannelId && window.stateManager.state.activeChannelId.startsWith('dm-');

      // Set headers and nav
      if (serverHeader) serverHeader.style.display = 'none';
      if (dmHeader) dmHeader.style.display = 'flex';
      if (channelsTree) channelsTree.style.display = 'none';
      if (dmsNav) dmsNav.style.display = 'block';
      if (membersSidebar) membersSidebar.style.display = 'none';

      // Toggle chat vs friends view
      if (isDM) {
        if (chatViewport) chatViewport.style.display = 'flex';
        if (friendsViewport) friendsViewport.style.display = 'none';
        this.renderChannelHeader();
        this.renderMessages();
      } else {
        if (chatViewport) chatViewport.style.display = 'none';
        if (friendsViewport) friendsViewport.style.display = 'flex';
      }

      this.renderDMsNav();
      return;
    }

    // Show Server Channels
    if (serverHeader) serverHeader.style.display = 'flex';
    if (dmHeader) dmHeader.style.display = 'none';
    if (channelsTree) channelsTree.style.display = 'block';
    if (dmsNav) dmsNav.style.display = 'none';
    if (chatViewport) chatViewport.style.display = 'flex';
    if (friendsViewport) friendsViewport.style.display = 'none';
    if (membersSidebar) membersSidebar.style.display = 'flex';

    const guild = window.stateManager.getCurrentGuild();
    if (!guild) return;

    const serverNameLabel = document.getElementById('server-name-label');
    if (serverNameLabel) serverNameLabel.textContent = guild.name;

    channelsTree.innerHTML = '';

    guild.categories.forEach(cat => {
      const catWrap = document.createElement('div');
      catWrap.className = 'category-wrapper';

      const catHeader = document.createElement('div');
      catHeader.className = 'category-header';
      catHeader.innerHTML = `
        <div class="category-title-wrap">
          <svg class="category-arrow" viewBox="0 0 24 24"><path fill="currentColor" d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z"/></svg>
          <span>${cat.name}</span>
        </div>
        <button class="category-add-btn" title="Create Channel" data-category-id="${cat.id}">
          <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      `;

      catHeader.querySelector('.category-title-wrap').onclick = () => {
        catWrap.classList.toggle('collapsed');
      };

      catHeader.querySelector('.category-add-btn').onclick = (e) => {
        e.stopPropagation();
        this.openCreateChannelModal(cat.id, cat.name);
      };

      const group = document.createElement('div');
      group.className = 'channels-group';

      cat.channels.forEach(ch => {
        const item = document.createElement('div');
        const isActive = window.stateManager.state.activeChannelId === ch.id;
        const isVoice = ch.type === 'voice';
        item.className = `channel-item ${isActive ? 'active' : ''}`;

        const iconSvg = isVoice
          ? `<svg class="channel-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`
          : `<svg class="channel-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M5.88 21H3.57l1.7-10H3v-2h2.64l.85-5h2.31l-.85 5h5.45l.85-5h2.31l-.85 5H18.9v2h-2.55l-1.7 10h2.31v2h-2.64l-.85 5h-2.31l.85-5H6.55l-.85 5H3.39l.85-5H2.1v-2h2.08zm2.04-10l-1.7 10h5.45l1.7-10H7.92z"/></svg>`;

        item.innerHTML = `
          <div class="channel-left">
            ${iconSvg}
            <span class="channel-name">${ch.name}</span>
          </div>
        `;

        item.onclick = () => {
          if (isVoice) {
            window.voiceController.joinVoice(ch.id, ch.name, guild.name);
          } else {
            window.stateManager.state.activeChannelId = ch.id;
            window.stateManager.saveState();
            this.renderAll();
          }
        };

        group.appendChild(item);

        // If voice channel, render active connected members list under it
        if (isVoice) {
          const participants = window.stateManager.state.voiceParticipants[ch.id] || [];
          if (participants.length > 0) {
            const voiceMembersList = document.createElement('div');
            voiceMembersList.className = 'voice-members-list';
            participants.forEach(p => {
              const vRow = document.createElement('div');
              vRow.className = `voice-member-item ${p.isSpeaking ? 'speaking' : ''}`;
              vRow.style.cursor = 'pointer';
              vRow.setAttribute('title', 'Click to view profile');

              const hasPhoto = !!p.avatarPhoto;
              const avatarStyle = hasPhoto
                ? `background-image: url('${p.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
                : `background-color: ${p.avatarBg || '#5865F2'};`;
              const avatarContent = hasPhoto ? '' : this.getSafeAvatarInitials(p);

              vRow.innerHTML = `
                <div class="voice-member-avatar ${p.isSpeaking ? 'speaking' : ''}" style="${avatarStyle}">
                  ${avatarContent}
                </div>
                <span class="voice-member-name">${p.name}</span>
                ${p.isMuted ? '<span style="font-size:10px; color:var(--red);">MUTED</span>' : ''}
              `;
              vRow.onclick = (e) => {
                e.stopPropagation();
                this.openMemberProfilePopover(p, e);
              };
              voiceMembersList.appendChild(vRow);
            });
            group.appendChild(voiceMembersList);
          }
        }
      });

      catWrap.appendChild(catHeader);
      catWrap.appendChild(group);
      channelsTree.appendChild(catWrap);
    });
  }

  // 3. Render DMs in Left Sidebar
  renderDMsNav() {
    const dmsNav = document.getElementById('dms-nav');
    if (!dmsNav) return;
    
    const isFriendsActive = !window.stateManager.state.activeChannelId || !window.stateManager.state.activeChannelId.startsWith('dm-');
    
    dmsNav.innerHTML = `
      <div class="channel-item ${isFriendsActive ? 'active' : ''}" style="margin-bottom: 8px;" onclick="window.uiController.openFriends()">
        <div class="channel-left">
          <svg class="channel-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <span class="channel-name">Friends</span>
        </div>
      </div>
      <div class="members-group-title">DIRECT MESSAGES</div>
    `;

    window.stateManager.state.friends.forEach(friend => {
      const myId = window.stateManager.state.currentUser.id;
      const dmId = 'dm-' + [myId, friend.id].sort().join('-');
      const isActive = window.stateManager.state.activeChannelId === dmId;
      const fItem = document.createElement('div');
      fItem.className = `channel-item ${isActive ? 'active' : ''}`;
      fItem.innerHTML = `
        <div class="channel-left">
          <div class="member-avatar-circle" style="width: 20px; height: 20px; font-size: 10px; background-color: ${friend.avatarBg}; display: flex; align-items: center; justify-content: center; color: white; border-radius: 50%; margin-right: 8px;">
            ${friend.avatarText}
          </div>
          <span class="channel-name">${friend.name}</span>
        </div>
      `;
      fItem.onclick = () => {
        this.openDirectMessageChat(friend);
      };
      dmsNav.appendChild(fItem);
    });
  }

  // 4. Render Channel Top Header
  renderChannelHeader() {
    const ch = window.stateManager.getCurrentChannel();
    if (!ch) return;

    const title = document.getElementById('nav-channel-title');
    const topic = document.getElementById('nav-channel-topic');
    const introTitle = document.getElementById('intro-channel-name');
    const introDesc = document.getElementById('intro-channel-desc');
    const msgInput = document.getElementById('message-input');

    if (title) title.textContent = ch.name;
    if (topic) topic.textContent = ch.topic || 'Welcome to this channel';
    if (introTitle) introTitle.textContent = `Welcome to #${ch.name}!`;
    if (introDesc) introDesc.textContent = `This is the start of the #${ch.name} channel for university discussions.`;
    if (msgInput) {
      msgInput.placeholder = this.isWhatsAppMode ? 'Type a message' : `Message #${ch.name}`;
    }
  }

  // 5. Render Messages Stream
  
  deleteMessage(msgId) {
    const ch = window.stateManager.getCurrentChannel();
    if (!ch) return;
    window.stateManager.deleteMessage(ch.id, msgId);
    this.renderMessages();
  }

  renderMessages() {
    const stream = document.getElementById('messages-stream');
    const container = document.getElementById('messages-container');
    const ch = window.stateManager.getCurrentChannel();
    if (!stream || !ch) return;

    const msgs = window.stateManager.getChannelMessages(ch.id);
    stream.innerHTML = '';

    if (this.isWhatsAppMode) {
      const dateDiv = document.createElement('div');
      dateDiv.className = 'wa-date-divider';
      dateDiv.innerHTML = `<svg viewBox="0 0 24 24" width="13" height="13"><path fill="#8696a0" d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg> <span>Messages are end-to-end encrypted • TODAY</span>`;
      stream.appendChild(dateDiv);
    }

    const myName = window.stateManager.state.currentUser.name;
    const waColors = ['#25d366', '#53bdeb', '#e542a3', '#f0b232', '#9c27b0', '#ff9800', '#00e676'];

    msgs.forEach((msg, idx) => {
      const isMe = msg.author.name === myName || msg.author.name === myName + ' (You)' || msg.isMe;
      const item = document.createElement('div');
      item.className = 'message-item' + (this.isWhatsAppMode ? (isMe ? ' wa-outgoing' : ' wa-incoming') : '');
      item.setAttribute('data-msg-id', msg.id);

      const parsedHtml = window.MarkdownParser.parse(msg.content);

      const hasPhoto = !!msg.author.avatarPhoto;
      const avatarStyle = hasPhoto
        ? `background-image: url('${msg.author.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
        : `background-color: ${msg.author.avatarBg || '#5865F2'};`;
      const avatarContent = hasPhoto ? '' : (msg.author.avatarText || msg.author.name.charAt(0));

      // Calculate author color for WhatsApp incoming messages
      let nameHash = 0;
      for (let i = 0; i < msg.author.name.length; i++) nameHash += msg.author.name.charCodeAt(i);
      const waAuthorColor = waColors[nameHash % waColors.length];

      // Build Quoted Reply Box (if present)
      let quotedHtml = '';
      if (msg.replyTo) {
        quotedHtml = `
          <div class="wa-quoted-box">
            <div class="wa-quoted-sender">${msg.replyTo.author || 'Member'}</div>
            <div class="wa-quoted-snippet">${msg.replyTo.text || ''}</div>
          </div>
        `;
      }

      // Build Voice Note Card (if voice message)
      let voiceNoteHtml = '';
      if (msg.isVoiceNote || msg.audioUrl) {
        const duration = msg.audioDuration || '0:08';
        const waveBars = [8, 14, 20, 16, 24, 12, 18, 26, 20, 14, 22, 17, 28, 20, 12, 16, 22, 18, 14, 10, 16, 20, 14, 8];
        voiceNoteHtml = `
          <div class="wa-voice-card" id="wa-voice-${msg.id}">
            <button class="wa-play-btn" onclick="window.uiController.playVoiceNote('${msg.id}', '${msg.audioUrl || ''}')" title="Play Voice Note">
              <svg viewBox="0 0 24 24" width="20" height="20" class="play-icon"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>
              <svg viewBox="0 0 24 24" width="20" height="20" class="pause-icon" style="display:none;"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
            </button>
            <div class="wa-wave-container" onclick="window.uiController.playVoiceNote('${msg.id}', '${msg.audioUrl || ''}')">
              ${waveBars.map(h => `<div class="wa-wave-bar" style="height: ${h}px;"></div>`).join('')}
            </div>
            <div class="wa-voice-info">
              <span class="wa-voice-timer" id="timer-${msg.id}">${duration}</span>
              <button class="wa-speed-btn" onclick="window.uiController.cycleAudioSpeed('${msg.id}')">1x</button>
            </div>
          </div>
        `;
      }

      // Build WhatsApp inline meta (Time + Double Blue Checkmarks)
      const metaHtml = `
        <span class="wa-meta-row">
          <span class="wa-time">${msg.timestamp || 'Just now'}</span>
          ${isMe ? '<span class="wa-double-check" title="Read">✓✓</span>' : ''}
        </span>
      `;

      if (this.isWhatsAppMode) {
        item.innerHTML = `
          ${!isMe ? `
          <div class="message-header">
            <span class="message-username" style="color: ${waAuthorColor} !important;" title="View Profile">${msg.author.name}</span>
            ${msg.author.isBot ? '<span class="message-tag-badge">BOT</span>' : ''}
            ${msg.author.role ? `<span style="font-size:10px; background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px; color: var(--text-muted);">${msg.author.role}</span>` : ''}
          </div>` : ''}
          ${quotedHtml}
          ${voiceNoteHtml}
          ${msg.content ? `<div class="message-body">${parsedHtml}</div>` : ''}
          ${msg.image ? `<img src="${msg.image}" class="message-attachment-image" style="max-width: 280px; border-radius: 8px; margin-top: 6px;" alt="Attachment" />` : ''}
          ${msg.attachment && msg.attachment.isImage ? `<img src="${msg.attachment.url}" class="message-attachment-image" style="max-width: 280px; border-radius: 8px; margin-top: 6px;" alt="Attachment" />` : ''}
          ${msg.attachment && !msg.attachment.isImage ? `<div style="margin-top: 6px; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; display: inline-block;">📄 <b>${msg.attachment.name}</b> (${msg.attachment.size})</div>` : ''}
          ${metaHtml}
          <div class="reactions-row" id="reactions-${msg.id}">
            ${(msg.reactions || []).map(r => `
              <div class="reaction-pill ${r.reacted ? 'reacted' : ''}" onclick="window.uiController.toggleReaction('${msg.id}', '${r.emoji}')">
                <span>${r.emoji}</span>
                <span>${r.count}</span>
              </div>
            `).join('')}
          </div>
          <div class="message-toolbar">
            <button class="msg-tool-btn emoji-quick-btn" title="Like" onclick="window.uiController.toggleReaction('${msg.id}', '👍')">👍</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Love" onclick="window.uiController.toggleReaction('${msg.id}', '❤️')">❤️</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Laugh" onclick="window.uiController.toggleReaction('${msg.id}', '😂')">😂</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Surprised" onclick="window.uiController.toggleReaction('${msg.id}', '😮')">😮</button>
            <button class="msg-tool-btn" title="Reply" onclick="window.uiController.handleReplyClick('${msg.id}')">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            </button>
            ${isMe ? `
            <button class="msg-tool-btn delete-btn" title="Delete Message" onclick="window.uiController.deleteMessage('${msg.id}')">
              <svg viewBox="0 0 24 24" width="15" height="15"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>` : ''}
          </div>
        `;
      } else {
        // Discord Classic Mode
        item.innerHTML = `
          <div class="message-avatar-wrap" style="cursor: pointer;" title="View Profile">
            <div class="message-avatar" style="${avatarStyle}">
              ${avatarContent}
            </div>
          </div>
          <div class="message-content-wrap">
            <div class="message-header">
              <span class="message-username" style="cursor: pointer;" title="View Profile">${msg.author.name}</span>
              ${msg.author.isBot ? '<span class="message-tag-badge">BOT</span>' : ''}
              ${msg.author.role ? `<span style="font-size:10px; background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px; color: var(--text-muted);">${msg.author.role}</span>` : ''}
              <span class="message-timestamp">${msg.timestamp}</span>
            </div>
            ${quotedHtml}
            ${voiceNoteHtml}
            ${msg.content ? `<div class="message-body">${parsedHtml}</div>` : ''}
            ${msg.image ? `<img src="${msg.image}" class="message-attachment-image" style="max-width: 300px; border-radius: 8px; margin-top: 8px;" alt="Attachment" />` : ''}
            ${msg.attachment && msg.attachment.isImage ? `<img src="${msg.attachment.url}" class="message-attachment-image" style="max-width: 300px; border-radius: 8px; margin-top: 8px;" alt="Attachment" />` : ''}
            ${msg.attachment && !msg.attachment.isImage ? `<div style="margin-top: 8px; padding: 12px; background: var(--bg-modifier-hover); border-radius: 4px; display: inline-block;">📄 <b>${msg.attachment.name}</b> (${msg.attachment.size})</div>` : ''}
            <div class="reactions-row" id="reactions-${msg.id}">
              ${(msg.reactions || []).map(r => `
                <div class="reaction-pill ${r.reacted ? 'reacted' : ''}" onclick="window.uiController.toggleReaction('${msg.id}', '${r.emoji}')">
                  <span>${r.emoji}</span>
                  <span>${r.count}</span>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="message-toolbar">
            <button class="msg-tool-btn emoji-quick-btn" title="Like" onclick="window.uiController.toggleReaction('${msg.id}', '👍')">👍</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Love" onclick="window.uiController.toggleReaction('${msg.id}', '❤️')">❤️</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Laugh" onclick="window.uiController.toggleReaction('${msg.id}', '😂')">😂</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Fire" onclick="window.uiController.toggleReaction('${msg.id}', '🔥')">🔥</button>
            <button class="msg-tool-btn emoji-quick-btn" title="Rocket" onclick="window.uiController.toggleReaction('${msg.id}', '🚀')">🚀</button>
            <button class="msg-tool-btn" title="Reply" onclick="window.uiController.handleReplyClick('${msg.id}')">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
            </button>
            ${isMe ? `
            <button class="msg-tool-btn delete-btn" title="Delete Message" onclick="window.uiController.deleteMessage('${msg.id}')">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>` : ''}
          </div>
        `;
      }

      // Click avatar or username to view full profile popover
      const avWrap = item.querySelector('.message-avatar-wrap');
      const uName = item.querySelector('.message-username');
      if (avWrap) avWrap.onclick = (e) => { e.stopPropagation(); this.openMemberProfilePopover(msg.author, e); };
      if (uName) uName.onclick = (e) => { e.stopPropagation(); this.openMemberProfilePopover(msg.author, e); };

      stream.appendChild(item);
    });

    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  // WhatsApp Voice Note Playback Controller
  playVoiceNote(msgId, audioUrl) {
    const card = document.getElementById(`wa-voice-${msgId}`);
    if (!card) return;

    const playIcon = card.querySelector('.play-icon');
    const pauseIcon = card.querySelector('.pause-icon');
    const bars = card.querySelectorAll('.wa-wave-bar');

    if (this.activeAudioPlayer && this.activeAudioPlayer.msgId === msgId) {
      // Pause
      this.activeAudioPlayer.audio.pause();
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      clearInterval(this.activeAudioPlayer.interval);
      this.activeAudioPlayer = null;
      return;
    }

    if (this.activeAudioPlayer) {
      this.activeAudioPlayer.audio.pause();
      clearInterval(this.activeAudioPlayer.interval);
      const prevPlay = this.activeAudioPlayer.card.querySelector('.play-icon');
      const prevPause = this.activeAudioPlayer.card.querySelector('.pause-icon');
      if (prevPlay) prevPlay.style.display = 'block';
      if (prevPause) prevPause.style.display = 'none';
    }

    let audio;
    if (audioUrl) {
      audio = new Audio(audioUrl);
    } else {
      if (window.audioEngine) window.audioEngine.playJoinSound();
      audio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
    }

    audio.playbackRate = this.audioPlaybackSpeed || 1;
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'block';

    let barIdx = 0;
    const interval = setInterval(() => {
      if (barIdx < bars.length) {
        bars[barIdx].classList.add('played');
        barIdx++;
      }
    }, 280);

    audio.onended = () => {
      if (playIcon) playIcon.style.display = 'block';
      if (pauseIcon) pauseIcon.style.display = 'none';
      bars.forEach(b => b.classList.remove('played'));
      clearInterval(interval);
      this.activeAudioPlayer = null;
    };

    audio.play().catch(e => console.log('Audio autoplay prevented:', e));
    this.activeAudioPlayer = { audio, msgId, card, interval };
  }

  cycleAudioSpeed(msgId) {
    const card = document.getElementById(`wa-voice-${msgId}`);
    if (!card) return;
    const btn = card.querySelector('.wa-speed-btn');
    if (!btn) return;

    if (this.audioPlaybackSpeed === 1) this.audioPlaybackSpeed = 1.5;
    else if (this.audioPlaybackSpeed === 1.5) this.audioPlaybackSpeed = 2;
    else this.audioPlaybackSpeed = 1;

    btn.textContent = `${this.audioPlaybackSpeed}x`;
    if (this.activeAudioPlayer && this.activeAudioPlayer.audio) {
      this.activeAudioPlayer.audio.playbackRate = this.audioPlaybackSpeed;
    }
  }

  quoteReply(authorName, textSnippet = '') {
    this.currentQuoteReply = { author: authorName, text: textSnippet.substring(0, 80) };
    const msgInput = document.getElementById('message-input');
    if (msgInput) {
      msgInput.focus();
      msgInput.placeholder = `Replying to ${authorName}...`;
    }
  }

  handleReplyClick(msgId) {
    const ch = window.stateManager ? window.stateManager.getCurrentChannel() : null;
    if (!ch) return;
    const msgs = window.stateManager.getChannelMessages(ch.id);
    const msg = msgs.find(m => m.id === msgId);
    if (msg) {
      this.quoteReply(msg.author.name, msg.content || '');
    }
  }

  // 6. Render Members Sidebar
  renderMembers() {
    const scrollable = document.getElementById('members-scrollable');
    if (!scrollable) return;
    scrollable.innerHTML = '';

    const me = window.stateManager.state.currentUser;
    const onlineClassmates = [
      {
        id: me.id,
        name: me.name + ' (You)',
        role: me.role || 'Server Owner',
        status: me.status || 'online',
        avatarText: me.avatarText,
        avatarBg: me.avatarBg,
        avatarPhoto: me.avatarPhoto || null,
        activity: me.customStatus || 'Online on UniCord',
        customStatus: me.customStatus,
        bio: me.bio || 'UniCord Campus Student',
        bannerColor: me.bannerColor || '#5865F2'
      }
    ];

    if (window.networkEngine?.remotePresence) {
      window.networkEngine.remotePresence.forEach((info, uid) => {
        onlineClassmates.push({
          id: uid,
          name: info.name,
          role: info.role || 'Student',
          status: 'online',
          avatarText: info.avatarText || info.name.substring(0, 2).toUpperCase(),
          avatarBg: info.avatarBg || '#23a55a',
          avatarPhoto: info.avatarPhoto || null,
          activity: info.customStatus || 'Online on UniCord',
          customStatus: info.customStatus,
          bio: info.bio || 'Proud campus classmate!',
          bannerColor: info.bannerColor || info.avatarBg || '#5865F2'
        });
      });
    }

    const groups = [
      { title: `ONLINE CLASSMATES — ${onlineClassmates.length}`, members: onlineClassmates },
      { title: 'CAMPUS BOT — 1', members: [
        { name: 'UniBot', role: 'Official Bot', status: 'online', avatarText: 'UB', avatarBg: '#5865F2', activity: 'Helping students 🤖', bio: 'Official Campus Assistant', bannerColor: '#5865F2' }
      ]},
      { title: 'CAMPUS LIFE LEADERS — 3', members: [
        { name: 'Tanmay (CR)', role: 'Class Representative', status: 'dnd', avatarText: 'TC', avatarBg: '#eb459e', activity: 'In Faculty Meeting 📝', bio: 'BBA 2026 Class Rep', bannerColor: '#eb459e' },
        { name: 'Rohan (Hostel Block B)', role: 'Hosteller', status: 'online', avatarText: 'RH', avatarBg: '#f0b232', activity: 'Listening to Spotify', bio: 'Block B Room 204', bannerColor: '#f0b232' },
        { name: 'Priya (Day Scholar)', role: 'Day Scholar', status: 'idle', avatarText: 'PR', avatarBg: '#23a55a', activity: 'Commuting 🚇', bio: 'South Campus Day Scholar', bannerColor: '#23a55a' }
      ]}
    ];

    groups.forEach(g => {
      const titleEl = document.createElement('div');
      titleEl.className = 'members-group-title';
      titleEl.textContent = g.title;
      scrollable.appendChild(titleEl);

      g.members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'member-card-row';

        const hasPhoto = !!m.avatarPhoto;
        const avatarStyle = hasPhoto
          ? `background-image: url('${m.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
          : `background-color: ${m.avatarBg};`;
        const avatarContent = hasPhoto ? '' : m.avatarText;

        row.innerHTML = `
          <div class="member-avatar-box">
            <div class="member-avatar-circle" style="${avatarStyle}">
              ${avatarContent}
            </div>
            <div class="status-indicator ${m.status}"></div>
          </div>
          <div class="member-info-col">
            <div class="member-row-name">${m.name}</div>
            <div class="member-row-activity">${m.activity || m.customStatus || ''}</div>
          </div>
        `;
        row.onclick = (e) => {
          this.openMemberProfilePopover(m, e);
        };
        scrollable.appendChild(row);
      });
    });
  }

  // 7. Render Voice Stage Grid (when in voice)
  renderVoiceStage() {
    const stage = document.getElementById('voice-stage-grid');
    const chId = window.stateManager.state.activeVoiceChannelId;
    if (!stage) return;

    if (!chId) {
      stage.style.display = 'none';
      return;
    }

    stage.style.display = 'grid';
    stage.innerHTML = '';

    const participants = window.stateManager.state.voiceParticipants[chId] || [];

    // Local Screen Share Tile if active
    if (window.stateManager.state.isScreenSharing && window.voiceController?.screenStream) {
      const screenTile = document.createElement('div');
      screenTile.className = 'voice-screenshare-tile';
      
      const vid = document.createElement('video');
      vid.style.width = '100%';
      vid.style.height = '100%';
      vid.style.objectFit = 'contain';
      vid.style.backgroundColor = '#000';
      vid.muted = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.srcObject = window.voiceController.screenStream;
      vid.onloadedmetadata = () => {
        vid.play().catch(e => console.warn('Local screen video play error:', e));
      };

      const overlay = document.createElement('div');
      overlay.className = 'screen-share-preview';
      overlay.style.position = 'absolute';
      overlay.style.bottom = '10px';
      overlay.style.left = '10px';
      overlay.innerHTML = `<div class="screen-share-title" style="background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;">You are sharing screen</div>`;
      
      screenTile.appendChild(vid);
      screenTile.appendChild(overlay);
      stage.appendChild(screenTile);
    }

    // Local Camera Tile if active
    if (window.voiceController?.isCameraOn && window.voiceController?.cameraStream) {
      const camTile = document.createElement('div');
      camTile.className = 'voice-screenshare-tile';
      
      const vid = document.createElement('video');
      vid.style.width = '100%';
      vid.style.height = '100%';
      vid.style.objectFit = 'cover';
      vid.style.backgroundColor = '#000';
      vid.style.transform = 'scaleX(-1)'; // Mirror camera
      vid.muted = true;
      vid.autoplay = true;
      vid.playsInline = true;
      vid.srcObject = window.voiceController.cameraStream;
      vid.onloadedmetadata = () => {
        vid.play().catch(e => console.warn('Local camera video play error:', e));
      };

      const overlay = document.createElement('div');
      overlay.className = 'screen-share-preview';
      overlay.style.position = 'absolute';
      overlay.style.bottom = '10px';
      overlay.style.left = '10px';
      overlay.innerHTML = `<div class="screen-share-title" style="background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 4px;">Your Camera</div>`;
      
      camTile.appendChild(vid);
      camTile.appendChild(overlay);
      stage.appendChild(camTile);
    }

    participants.forEach(p => {
      // Check if remote peer is sharing screen (has video track)
      if (p.remoteStream && p.remoteStream.getVideoTracks().length > 0) {
        const remoteScreenTile = document.createElement('div');
        remoteScreenTile.className = 'voice-screenshare-tile';
        
        if (!p.isWatchingStream) {
          remoteScreenTile.style.backgroundColor = '#1e1f22';
          remoteScreenTile.style.display = 'flex';
          remoteScreenTile.style.flexDirection = 'column';
          remoteScreenTile.style.alignItems = 'center';
          remoteScreenTile.style.justifyContent = 'center';
          remoteScreenTile.style.position = 'relative';

          const liveBadge = document.createElement('div');
          liveBadge.innerText = 'LIVE';
          liveBadge.style.position = 'absolute';
          liveBadge.style.top = '10px';
          liveBadge.style.left = '10px';
          liveBadge.style.background = '#f23f43';
          liveBadge.style.color = '#fff';
          liveBadge.style.padding = '2px 6px';
          liveBadge.style.borderRadius = '4px';
          liveBadge.style.fontSize = '12px';
          liveBadge.style.fontWeight = 'bold';
          remoteScreenTile.appendChild(liveBadge);

          const hasPhoto = !!p.avatarPhoto;
          const avatarStyle = hasPhoto
            ? `background-image: url('${p.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
            : `background-color: ${p.avatarBg || '#5865F2'};`;
          const avatarContent = hasPhoto ? '' : (p.avatarText || p.name.charAt(0));

          const infoWrap = document.createElement('div');
          infoWrap.style.textAlign = 'center';
          infoWrap.style.marginBottom = '16px';
          infoWrap.innerHTML = `
            <div style="width: 80px; height: 80px; border-radius: 50%; ${avatarStyle} margin: 0 auto 12px auto; display: flex; align-items: center; justify-content: center; font-size: 32px; font-weight: bold; color: #fff;">
              ${avatarContent}
            </div>
            <div style="color: #fff; font-weight: 600; font-size: 16px;">${p.name} is streaming</div>
          `;
          remoteScreenTile.appendChild(infoWrap);

          const watchBtn = document.createElement('button');
          watchBtn.className = 'btn-primary';
          watchBtn.innerText = 'Watch Stream';
          watchBtn.onclick = () => {
            p.isWatchingStream = true;
            this.renderVoiceStage();
          };
          remoteScreenTile.appendChild(watchBtn);

        } else {
          const vid = document.createElement('video');
          vid.style.width = '100%';
          vid.style.height = '100%';
          vid.style.objectFit = 'contain';
          vid.style.backgroundColor = '#000';
          vid.muted = true; // Audio is handled separately
          vid.autoplay = true;
          vid.playsInline = true;
          vid.srcObject = p.remoteStream;
          vid.onloadedmetadata = () => {
            vid.play().catch(e => console.warn('Remote screen video play error:', e));
          };

          const overlay = document.createElement('div');
          overlay.className = 'screen-share-preview';
          overlay.style.position = 'absolute';
          overlay.style.top = '10px';
          overlay.style.left = '10px';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.innerHTML = `
            <button style="background: rgba(0,0,0,0.6); border: none; padding: 4px; color: #fff; border-radius: 50%; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;" title="Stop Watching">
              <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M18.3 5.71a.996.996 0 0 0-1.41 0L12 10.59 7.11 5.7a.996.996 0 1 0-1.41 1.41L10.59 12 5.7 16.89a.996.996 0 1 0 1.41 1.41L12 13.41l4.89 4.89a.996.996 0 1 0 1.41-1.41L13.41 12l4.89-4.89c.38-.38.38-1.02 0-1.4z"/></svg>
            </button>
          `;
          
          overlay.querySelector('button').onclick = () => {
            p.isWatchingStream = false;
            this.renderVoiceStage();
          };
          
          const fullscreenBtn = document.createElement('button');
          fullscreenBtn.style.position = 'absolute';
          fullscreenBtn.style.top = '10px';
          fullscreenBtn.style.right = '10px';
          fullscreenBtn.style.background = 'rgba(0,0,0,0.6)';
          fullscreenBtn.style.border = 'none';
          fullscreenBtn.style.padding = '4px';
          fullscreenBtn.style.color = '#fff';
          fullscreenBtn.style.borderRadius = '4px';
          fullscreenBtn.style.cursor = 'pointer';
          fullscreenBtn.title = 'Full Screen';
          fullscreenBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>';
          
          fullscreenBtn.onclick = () => {
            if (vid.requestFullscreen) {
              vid.requestFullscreen();
            } else if (vid.webkitRequestFullscreen) {
              vid.webkitRequestFullscreen();
            } else if (vid.msRequestFullscreen) {
              vid.msRequestFullscreen();
            }
          };
          
          remoteScreenTile.appendChild(vid);
          remoteScreenTile.appendChild(overlay);
          remoteScreenTile.appendChild(fullscreenBtn);
        }
        
        stage.appendChild(remoteScreenTile);
      }

      const card = document.createElement('div');
      card.id = 'voice-card-' + p.id;
      card.className = `voice-card ${p.isSpeaking ? 'speaking' : ''}`;
      card.style.cursor = 'pointer';
      card.setAttribute('title', 'Click to view profile');

      const hasPhoto = !!p.avatarPhoto;
      const avatarStyle = hasPhoto
        ? `background-image: url('${p.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
        : `background-color: ${p.avatarBg || '#5865F2'};`;
      const avatarContent = hasPhoto ? '' : (p.avatarText || p.name.charAt(0));

      card.innerHTML = `
        <div class="voice-card-avatar" style="${avatarStyle}">
          ${avatarContent}
        </div>
        <div class="voice-card-name">
          <span>${p.name}</span>
          ${p.isMuted ? '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#f23f43" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l3.2 3.2L21 18.27 4.27 3z"/></svg>' : ''}
        </div>
        <div class="voice-card-tag">${p.isSpeaking ? '🟢 Speaking' : 'Connected'}</div>
      `;

      card.onclick = (e) => {
        this.openMemberProfilePopover(p, e);
      };

      stage.appendChild(card);
    });
  }

  // 7B. Render Google Meet & Conference Stage Viewport
  showMeetStage(show, channelName = '', guildName = '') {
    const stageViewport = document.getElementById('meet-stage-viewport');
    const chatViewport = document.getElementById('chat-viewport');
    const friendsViewport = document.getElementById('friends-viewport');
    const membersSidebar = document.getElementById('members-sidebar');
    const btnNavStage = document.getElementById('btn-toggle-meet-stage');
    const miniDock = document.getElementById('meet-mini-dock');

    if (!stageViewport) return;

    if (show) {
      stageViewport.style.display = 'flex';
      if (chatViewport) chatViewport.style.display = 'none';
      if (friendsViewport) friendsViewport.style.display = 'none';
      if (membersSidebar) membersSidebar.style.display = 'none';
      if (btnNavStage) btnNavStage.classList.add('active');
      if (miniDock) miniDock.style.display = 'none';

      const activeCh = this.findChannel(window.stateManager.state.activeVoiceChannelId);
      const effectiveName = channelName || (activeCh ? activeCh.name : 'Voice Room');
      const titleEl = document.getElementById('meet-room-title');
      if (titleEl) {
        titleEl.textContent = effectiveName;
      }
      this.renderMeetStage();
    } else {
      stageViewport.style.display = 'none';
      if (chatViewport) chatViewport.style.display = 'flex';
      if (membersSidebar) membersSidebar.style.display = 'flex';
      if (btnNavStage) btnNavStage.classList.remove('active');

      // If still connected to voice, show mini dock so user knows call is active
      const inVoice = !!window.stateManager.state.activeVoiceChannelId;
      if (miniDock) {
        miniDock.style.display = inVoice ? 'flex' : 'none';
        const miniText = document.getElementById('meet-mini-channel-text');
        if (miniText && inVoice) {
          const chId = window.stateManager.state.activeVoiceChannelId;
          const participants = window.stateManager.state.voiceParticipants[chId] || [];
          const presenter = participants.find(p => p.isPresenter || p.isSharingScreen);
          if (presenter) {
            miniText.textContent = `Connected: ${channelName || 'Voice Room'} (${presenter.name} presenting)`;
          } else {
            miniText.textContent = `Connected: ${channelName || 'Voice Room'}`;
          }
        }
      }
    }
  }

  toggleMeetStageView() {
    const stageViewport = document.getElementById('meet-stage-viewport');
    const inVoice = !!window.stateManager.state.activeVoiceChannelId;
    if (inVoice) {
      const isVisible = stageViewport && stageViewport.style.display === 'flex';
      this.showMeetStage(!isVisible);
    } else {
      const currentGuild = this.getCurrentGuild();
      const firstVc = currentGuild?.categories?.flatMap(c => c.channels)?.find(c => c.type === 'voice');
      if (firstVc) {
        window.voiceController.joinVoice(firstVc.id, firstVc.name, currentGuild.name);
      } else {
        window.voiceController.joinVoice('chan-voice-lounge', 'Lounge (General)', 'Unicord Central');
      }
    }
  }

  spawnFloatingReaction(emoji) {
    const container = document.getElementById('meet-reactions-overlay');
    if (!container) return;
    const item = document.createElement('div');
    item.className = 'floating-reaction-item';
    item.textContent = emoji;
    const startLeft = 32 + Math.random() * 36; // 32% - 68%
    item.style.left = startLeft + '%';
    container.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 3200);
  }

  initLaserPointerCanvas(canvas, container) {
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = container.clientWidth || 800;
      canvas.height = container.clientHeight || 600;
    };
    resize();

    let points = [];

    const onMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      points.push({ x, y, time: Date.now() });
      if (points.length > 30) points.shift();
    };

    container.onmousemove = onMouseMove;

    const render = () => {
      if (!window.voiceController?.isLaserActive || !document.contains(canvas)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      const now = Date.now();
      points = points.filter(p => now - p.time < 600);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (points.length > 1) {
        ctx.save();
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          const age = now - p2.time;
          const alpha = Math.max(0, 1 - age / 600);

          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `rgba(255, 59, 48, ${alpha * 0.85})`;
          ctx.lineWidth = 4 * alpha;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.restore();
      }

      if (points.length > 0) {
        const last = points[points.length - 1];
        ctx.save();
        // Laser outer glowing aura
        const gradient = ctx.createRadialGradient(last.x, last.y, 0, last.x, last.y, 16);
        gradient.addColorStop(0, 'rgba(255, 68, 68, 0.95)');
        gradient.addColorStop(0.35, 'rgba(255, 20, 40, 0.55)');
        gradient.addColorStop(1, 'rgba(255, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(last.x, last.y, 16, 0, Math.PI * 2);
        ctx.fill();

        // Laser core white-hot dot
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(last.x, last.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      requestAnimationFrame(render);
    };

    requestAnimationFrame(render);
  }

  renderMeetStage() {
    const stageViewport = document.getElementById('meet-stage-viewport');
    const body = document.getElementById('meet-stage-body');
    const chId = window.stateManager.state.activeVoiceChannelId;
    if (!stageViewport || !body || !chId) return;

    const state = window.stateManager.state;
    const participants = state.voiceParticipants[chId] || [];
    const isScreenSharing = state.isScreenSharing;
    const isMuted = state.isMuted;
    const isCameraOn = window.voiceController?.isCameraOn;
    const isHandRaised = state.isHandRaised;
    const mode = state.meetViewMode || 'grid';

    // 1. Update Header Buttons
    const btnSpotlight = document.getElementById('btn-meet-mode-spotlight');
    const btnGrid = document.getElementById('btn-meet-mode-grid');
    if (btnSpotlight) btnSpotlight.classList.toggle('active', mode === 'spotlight');
    if (btnGrid) btnGrid.classList.toggle('active', mode === 'grid');

    // 2. Update Dock Controls
    const dockMic = document.getElementById('btn-dock-mic');
    if (dockMic) {
      dockMic.classList.toggle('muted', isMuted);
      const onIcon = dockMic.querySelector('.dock-mic-on');
      const offIcon = dockMic.querySelector('.dock-mic-off');
      if (onIcon) onIcon.style.display = isMuted ? 'none' : 'block';
      if (offIcon) offIcon.style.display = isMuted ? 'block' : 'none';
    }

    const dockCam = document.getElementById('btn-dock-camera');
    if (dockCam) {
      dockCam.classList.toggle('active-blue', isCameraOn);
    }

    const dockScreen = document.getElementById('btn-dock-screenshare');
    if (dockScreen) {
      dockScreen.classList.toggle('active-blue', isScreenSharing);
    }

    const dockHand = document.getElementById('btn-dock-raise-hand');
    if (dockHand) {
      dockHand.classList.toggle('hand-raised', isHandRaised);
    }

    const dockPeopleBadge = document.getElementById('meet-dock-people-badge');
    if (dockPeopleBadge) {
      const totalCount = participants.reduce((sum, p) => sum + (p.isOthersTile ? (p.count || 1) : 1), 0);
      dockPeopleBadge.textContent = String(totalCount || 1);
    }

    body.innerHTML = '';

    // Active presenter check (NEVER fallback to fake Sourabh Singh!)
    const activePresenter = participants.find(p => p.isPresenter || p.isSharingScreen) || 
      (isScreenSharing ? { ...state.currentUser, isPresenter: true, isSharingScreen: true } : null);
    const isDocPresenting = state.isDocPresenting || (!isScreenSharing && activePresenter && activePresenter.isPresenter);

    // 3. Render Based on View Mode
    if (mode === 'grid' || (!isScreenSharing && !isDocPresenting && mode !== 'spotlight')) {
      // Gallery / Grid Mode: Clean responsive grid of all connected participants
      const gridContainer = document.createElement('div');
      gridContainer.className = 'meet-grid-view';

      participants.forEach(p => {
        if (p.isOthersTile) {
          const othersTile = document.createElement('div');
          othersTile.className = 'meet-tile-others';
          othersTile.onclick = () => window.voiceController.toggleInCallDrawer('people');
          othersTile.innerHTML = `
            <div class="meet-avatar-stack">
              <div class="meet-avatar-stack-item" style="background:#f0b232;">AK</div>
              <div class="meet-avatar-stack-item" style="background:#5865f2;">SM</div>
              <div class="meet-avatar-stack-item" style="background:#23a55a;">${p.count || 29}</div>
            </div>
            <div class="meet-others-label">${p.name || '29 others'}</div>
          `;
          gridContainer.appendChild(othersTile);
          return;
        }

        const tile = document.createElement('div');
        tile.className = `meet-tile ${p.isSpeaking ? 'speaking' : ''}`;
        tile.id = `meet-tile-${p.id}`;

        const hasPhoto = !!p.avatarPhoto;
        const avatarStyle = hasPhoto
          ? `background-image: url('${p.avatarPhoto}');`
          : `background-color: ${p.avatarBg || '#5865F2'};`;
        const avatarText = hasPhoto ? '' : this.getSafeAvatarInitials(p);

        tile.innerHTML = `
          <div class="meet-tile-avatar" style="${avatarStyle}">
            ${avatarText}
          </div>
          <div class="meet-tile-name-pill">
            ${p.isPresenter ? '📌 ' : ''}${p.name}
          </div>
          <div class="meet-tile-mic-badge ${p.isMuted ? 'muted' : ''}">
            ${p.isMuted 
              ? '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="#ffffff" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l3.2 3.2L21 18.27 4.27 3z"/></svg>' 
              : '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="#23a55a" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>'}
          </div>
          ${p.isHandRaised ? '<div class="meet-hand-raised-badge">✋</div>' : ''}
        `;
        tile.onclick = (e) => this.openMemberProfilePopover(p, e);
        gridContainer.appendChild(tile);
      });

      body.appendChild(gridContainer);
    } else {
      // Spotlight Mode (Presentation OR Active Speaker Spotlight)
      const spotlight = document.createElement('div');
      spotlight.className = 'meet-spotlight-area';

      // Pick presenter or active speaker
      const spotlightUser = activePresenter || 
        participants.find(p => p.isPinned) || 
        participants.find(p => p.isSpeaking && p.id !== state.currentUser.id) || 
        participants[0] || 
        state.currentUser;

      const presenterName = spotlightUser.name;
      const presenterInitials = this.getSafeAvatarInitials(spotlightUser);

      // Top Presentation / Spotlight Bar
      const banner = document.createElement('div');
      banner.className = 'meet-presentation-banner';
      banner.innerHTML = `
        <div class="meet-banner-top-row">
          <div class="meet-presenter-badge">
            <div class="meet-presenter-avatar-small">${presenterInitials}</div>
            <div class="meet-presenter-label">${presenterName} <span class="meet-presenting-subtag">${isScreenSharing ? '(Sharing Screen)' : (isDocPresenting ? '(Presenting)' : '(Spotlighted)')}</span></div>
            ${isDocPresenting || isScreenSharing ? '<svg viewBox="0 0 24 24" width="16" height="16" style="color:#bdc1c6; margin-left:4px;"><path fill="currentColor" d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg>' : ''}
          </div>

          <div style="display:flex; align-items:center; gap:8px;">
            <button class="meet-view-switch-btn ${isDocPresenting ? 'active' : ''}" onclick="window.voiceController.toggleDocPresenting()" style="padding:3px 10px; font-size:11px;">
              📄 Notes.docx
            </button>
            <button class="meet-view-switch-btn ${isScreenSharing ? 'active' : ''}" onclick="window.voiceController.toggleScreenShare()" style="padding:3px 10px; font-size:11px;">
              🖥️ Screen Share
            </button>
            <button class="meet-view-switch-btn" onclick="window.whiteboardController?.openModal()" style="padding:3px 10px; font-size:11px;">
              🎨 Whiteboard
            </button>
          </div>
        </div>

        ${isDocPresenting ? `
        <div class="meet-doc-shell-menubar">
          <div class="meet-doc-title-group">
            <div class="meet-doc-icon">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285f4" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
            </div>
            <div class="meet-doc-title-text">${state.activeMeetDocTitle || 'Fintech Ecosystem Notes.docx'}</div>
            <div class="meet-doc-menu-list">
              <span class="meet-doc-menu-item">File</span>
              <span class="meet-doc-menu-item">Edit</span>
              <span class="meet-doc-menu-item">View</span>
              <span class="meet-doc-menu-item">Tools</span>
              <span class="meet-doc-menu-item">Help</span>
            </div>
          </div>

          <div class="meet-doc-tools-right">
            <button class="meet-open-docs-btn" onclick="window.open('https://docs.google.com', '_blank')">
              <svg viewBox="0 0 24 24" width="14" height="14"><path fill="#1a73e8" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
              <span>Open with Google Docs ▾</span>
            </button>
            <div class="nav-divider" style="height:14px; margin:0 4px;"></div>
            <span class="meet-doc-page-badge">Page 9 / 18</span>
            <button class="meet-doc-tool-btn" onclick="window.voiceController.zoomPresentationDoc(-10)" title="Zoom Out">-</button>
            <span style="font-size:12px; color:#bdc1c6; font-family:var(--font-code);" id="meet-doc-zoom-label">${state.docZoom || 100}%</span>
            <button class="meet-doc-tool-btn" onclick="window.voiceController.zoomPresentationDoc(10)" title="Zoom In">+</button>
            <button class="meet-doc-tool-btn meet-laser-toggle-btn ${window.voiceController?.isLaserActive ? 'active' : ''}" onclick="window.voiceController.toggleLaserPointer()" title="Interactive Laser Pointer">
              🎯
            </button>
          </div>
        </div>
        ` : ''}
      `;
      spotlight.appendChild(banner);

      // Presentation Viewport
      const viewport = document.createElement('div');
      viewport.className = 'meet-presentation-viewport';

      if (isScreenSharing && window.voiceController?.screenStream) {
        // High-Tech Screenshare HUD Overlay
        const hud = document.createElement('div');
        hud.className = 'screenshare-hud-overlay';
        hud.innerHTML = `
          <div class="screenshare-telemetry-pill">
            <div class="screenshare-live-pulse"></div>
            <span>LIVE SCREENSHARE • 1080p @ 60 FPS • WebRTC HD • 4.8 Mbps</span>
          </div>
          <div class="screenshare-hud-buttons">
            <button class="screenshare-pill-btn ${window.voiceController?.isLaserActive ? 'active' : ''}" onclick="window.voiceController.toggleLaserPointer()">
              🎯 Laser Pointer
            </button>
            <button class="screenshare-pill-btn" onclick="window.voiceController.togglePiP()">
              🪟 Picture-in-Picture
            </button>
            <button class="screenshare-pill-btn" onclick="window.voiceController.toggleFitMode()" id="screenshare-fit-label">
              Fit
            </button>
            <button class="screenshare-pill-btn danger" onclick="window.voiceController.stopScreenShare()">
              ⏹ Stop Sharing
            </button>
          </div>
        `;
        viewport.appendChild(hud);

        const vid = document.createElement('video');
        vid.className = 'meet-video-screen';
        vid.muted = true;
        vid.autoplay = true;
        vid.playsInline = true;
        vid.srcObject = window.voiceController.screenStream;
        vid.onloadedmetadata = () => vid.play().catch(e => console.warn(e));
        viewport.appendChild(vid);
      } else if (isDocPresenting) {
        // Document Paper View
        const paper = document.createElement('div');
        paper.className = 'meet-doc-paper';
        paper.id = 'meet-doc-paper';
        paper.style.transform = `scale(${(state.docZoom || 100) / 100})`;
        paper.innerHTML = `
          <p style="color:#5f6368; font-size:13px; margin-bottom:14px; font-style:italic;">
            ...exactly the practical skill this unit is building toward, because it is precisely what a real analyst does before recommending that a company either partner with, or instead compete directly against, any given FinTech player in the market
          </p>

          <h3 style="font-size:18px; font-weight:700; color:#1a73e8; margin-top:16px; margin-bottom:10px;">
            API and Consent Architecture
          </h3>
          <p>
            An API, or Application Programming Interface, is simply a technical connection that lets two separate pieces of software talk to each other and exchange data in a structured, secure, and clearly defined way, and in FinTech specifically, APIs are what allow one company's app to securely pull your financial data from an entirely different institution, such as your bank, without ever exposing your actual login credentials to that second company directly.
          </p>
          <p>
            Consent architecture is the closely related layer of systems and permissions that specifically ensures this kind of sensitive data-sharing only ever happens with your own explicit, informed permission, and that you retain the ability to see exactly what data is being shared, with which specific companies, and to revoke that permission again at any time you choose to.
          </p>
          <div class="highlight-box">
            <strong>Key Mechanism:</strong> When a budgeting app shows you a combined, consolidated view of transactions from three or four completely different bank accounts you personally hold, all in one single screen, that convenience is only possible because of exactly this API and consent architecture working correctly and securely together behind the scenes.
          </div>

          <h3 style="font-size:18px; font-weight:700; color:#202124; margin-top:34px; margin-bottom:10px;">
            Day 6: Risk, Fraud and Regulation in FinTech
          </h3>
          <p>
            Today explains why a genuinely great FinTech idea can still fail completely without the right risk architecture and regulatory frameworks in place. Digital payments, tokenization, and customer authorization protocols rely heavily on audited data pipelines to prevent identity takeover and synthetic fraud.
          </p>
        `;
        viewport.appendChild(paper);

        // Floating Bottom-Right Inspection Capsule
        const capsule = document.createElement('div');
        capsule.className = 'meet-doc-floating-capsule';
        capsule.innerHTML = `
          <button class="meet-doc-tool-btn" onclick="window.voiceController.zoomPresentationDoc(-10)" title="Zoom Out">🔍 -</button>
          <span style="font-size:12px; font-family:var(--font-code); color:#e8eaed;">${state.docZoom || 100}%</span>
          <button class="meet-doc-tool-btn" onclick="window.voiceController.zoomPresentationDoc(10)" title="Zoom In">🔍 +</button>
          <div class="nav-divider" style="height:12px;"></div>
          <button class="meet-doc-tool-btn" onclick="window.print()" title="Print Notes">🖨️</button>
          <button class="meet-doc-tool-btn" onclick="document.getElementById('meet-stage-viewport')?.requestFullscreen?.()" title="Full Screen">⛶</button>
        `;
        viewport.appendChild(capsule);
      } else {
        // Speaker Hero Spotlight (when in spotlight mode without doc or screenshare)
        const heroTile = document.createElement('div');
        heroTile.className = `meet-hero-tile ${spotlightUser.isSpeaking ? 'speaking' : ''}`;
        const hasPhoto = !!spotlightUser.avatarPhoto;
        const avatarStyle = hasPhoto
          ? `background-image: url('${spotlightUser.avatarPhoto}');`
          : `background-color: ${spotlightUser.avatarBg || '#5865F2'};`;
        const avatarContent = hasPhoto ? '' : presenterInitials;

        heroTile.innerHTML = `
          <div class="meet-hero-avatar" style="${avatarStyle}">
            ${avatarContent}
          </div>
          <div class="meet-hero-info">
            <div class="meet-hero-name">
              <span>${spotlightUser.name}</span>
              ${spotlightUser.isMuted 
                ? '<span style="color:#ea4335; font-size:14px;" title="Muted">🔇</span>' 
                : '<span style="color:#23a55a; font-size:14px;" title="Mic Active">🎤</span>'}
              ${spotlightUser.isHandRaised ? '<span>✋</span>' : ''}
            </div>
            <div class="meet-hero-status">
              ${spotlightUser.isSpeaking ? 'Speaking now...' : (spotlightUser.handle || 'In Voice Channel')}
            </div>
          </div>
        `;
        viewport.appendChild(heroTile);
      }

      // Attach laser pointer interactive trail
      const laserCanvas = document.createElement('canvas');
      laserCanvas.className = 'meet-laser-canvas';
      laserCanvas.id = 'meet-laser-canvas';
      viewport.appendChild(laserCanvas);

      if (window.voiceController?.isLaserActive) {
        viewport.classList.add('meet-laser-active-cursor');
        this.initLaserPointerCanvas(laserCanvas, viewport);
      } else {
        viewport.classList.remove('meet-laser-active-cursor');
      }

      spotlight.appendChild(viewport);
      body.appendChild(spotlight);

      // B. Right Participants Sidebar (only if there are other participants)
      const others = participants.filter(p => p.id !== spotlightUser.id);
      if (others.length > 0 || isDocPresenting || isScreenSharing) {
        const sidebar = document.createElement('div');
        sidebar.className = 'meet-participants-sidebar';

        // 1. Top Card (Spotlight User)
        const presenterCard = document.createElement('div');
        presenterCard.className = `meet-presenter-card ${spotlightUser.isSpeaking ? 'speaking' : ''}`;
        presenterCard.id = `meet-tile-${spotlightUser.id}`;
        presenterCard.innerHTML = `
          <div class="meet-audio-wave">
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
            <div class="wave-bar"></div>
          </div>
          <div class="meet-presenter-avatar-large" style="background-color: ${spotlightUser.avatarBg || '#3c4043'};">
            ${presenterInitials}
          </div>
          <div class="meet-tile-name-pill">
            📌 ${spotlightUser.name} ${spotlightUser.handle || ''}
          </div>
        `;
        presenterCard.onclick = (e) => this.openMemberProfilePopover(spotlightUser, e);
        sidebar.appendChild(presenterCard);

        // 2. Bottom Grid
        const grid = document.createElement('div');
        grid.className = 'meet-participants-grid';

        others.forEach(p => {
          if (p.isOthersTile) {
            const othersTile = document.createElement('div');
            othersTile.className = 'meet-tile-others';
            othersTile.onclick = () => window.voiceController.toggleInCallDrawer('people');
            othersTile.innerHTML = `
              <div class="meet-avatar-stack">
                <div class="meet-avatar-stack-item" style="background:#1f3a60;">RJ</div>
                <div class="meet-avatar-stack-item" style="background:#234938;">AG</div>
                <div class="meet-avatar-stack-item" style="background:#543b18;">RH</div>
              </div>
              <div class="meet-others-label">${p.name || '29 others'}</div>
            `;
            grid.appendChild(othersTile);
            return;
          }

          const tile = document.createElement('div');
          tile.className = `meet-tile ${p.isSpeaking ? 'speaking' : ''}`;
          tile.id = `meet-tile-${p.id}`;

          const hasPhoto = !!p.avatarPhoto;
          const avatarStyle = hasPhoto
            ? `background-image: url('${p.avatarPhoto}');`
            : `background-color: ${p.avatarBg || '#5865F2'};`;
          const avatarText = hasPhoto ? '' : this.getSafeAvatarInitials(p);

          tile.innerHTML = `
            <div class="meet-tile-avatar" style="${avatarStyle}">
              ${avatarText}
            </div>
            <div class="meet-tile-name-pill">
              ${p.name}
            </div>
            <div class="meet-tile-mic-badge ${p.isMuted ? 'muted' : ''}">
              ${p.isMuted 
                ? '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="#ffffff" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l3.2 3.2L21 18.27 4.27 3z"/></svg>' 
                : '<svg viewBox="0 0 24 24" width="12" height="12"><path fill="#23a55a" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/></svg>'}
            </div>
            ${p.isHandRaised ? '<div class="meet-hand-raised-badge">✋</div>' : ''}
          `;
          tile.onclick = (e) => this.openMemberProfilePopover(p, e);
          grid.appendChild(tile);
        });

        sidebar.appendChild(grid);
        body.appendChild(sidebar);
      }
    }

    // 4. In-Call Drawer Rendering
    const drawer = document.getElementById('meet-side-drawer');
    const drawerBody = document.getElementById('meet-drawer-body');
    const drawerFooter = document.getElementById('meet-drawer-footer');
    const tabChat = document.getElementById('tab-in-call-chat');
    const tabPeople = document.getElementById('tab-in-call-people');

    if (drawer && drawerBody) {
      if (state.inCallDrawerOpen) {
        drawer.style.display = 'flex';
        const activeTab = state.inCallDrawerOpen;

        if (tabChat) tabChat.classList.toggle('active', activeTab === 'chat');
        if (tabPeople) tabPeople.classList.toggle('active', activeTab === 'people');

        if (activeTab === 'chat') {
          if (drawerFooter) drawerFooter.style.display = 'block';
          drawerBody.innerHTML = '';
          const msgs = state.inCallMessages || [];
          msgs.forEach(m => {
            const row = document.createElement('div');
            row.className = 'meet-in-call-msg';
            row.innerHTML = `
              <div class="meet-in-call-author">
                <span>${m.author}</span>
                <span class="meet-in-call-time">${m.time}</span>
              </div>
              <div class="meet-in-call-text">${m.text}</div>
            `;
            drawerBody.appendChild(row);
          });
          drawerBody.scrollTop = drawerBody.scrollHeight;
        } else if (activeTab === 'people') {
          if (drawerFooter) drawerFooter.style.display = 'none';
          drawerBody.innerHTML = `
            <div style="font-size:12px; font-weight:700; color:#8ab4f8; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:8px;">
              Meeting Participants (34)
            </div>
          `;

          // Hand Raise Queue if any
          const raised = participants.filter(p => p.isHandRaised);
          if (raised.length > 0) {
            const queueBox = document.createElement('div');
            queueBox.style.background = 'rgba(251,188,4,0.12)';
            queueBox.style.border = '1px solid rgba(251,188,4,0.3)';
            queueBox.style.padding = '10px 12px';
            queueBox.style.borderRadius = '8px';
            queueBox.style.marginBottom = '12px';
            queueBox.innerHTML = `
              <div style="font-size:12px; font-weight:bold; color:#fbbc04; margin-bottom:6px;">✋ Hand Raised Queue (${raised.length})</div>
              ${raised.map(r => `<div style="font-size:13px; color:#fff; display:flex; align-items:center; justify-content:space-between;"><span>${r.name}</span> <button onclick="window.voiceController.toggleHandRaise()" style="background:transparent; border:1px solid #fbbc04; color:#fbbc04; font-size:10px; border-radius:10px; padding:2px 6px; cursor:pointer;">Lower</button></div>`).join('')}
            `;
            drawerBody.appendChild(queueBox);
          }

          // Full Attendance List
          participants.forEach(p => {
            if (p.isOthersTile) return;
            const pRow = document.createElement('div');
            pRow.style.display = 'flex';
            pRow.style.alignItems = 'center';
            pRow.style.justifyContent = 'space-between';
            pRow.style.padding = '8px 10px';
            pRow.style.borderRadius = '8px';
            pRow.style.background = 'rgba(255,255,255,0.03)';
            pRow.innerHTML = `
              <div style="display:flex; align-items:center; gap:8px;">
                <div style="width:28px; height:28px; border-radius:50%; background:${p.avatarBg || '#5865F2'}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">
                  ${p.avatarText || p.name.charAt(0)}
                </div>
                <span style="font-size:13px; font-weight:600; color:#e8eaed;">${p.name} ${p.isPresenter ? '<span style="color:#8ab4f8; font-size:11px;">(Host)</span>' : ''}</span>
              </div>
              <span style="font-size:11px; color:${p.isMuted ? '#ea4335' : '#23a55a'}; font-weight:600;">
                ${p.isMuted ? 'Muted' : 'Speaking'}
              </span>
            `;
            drawerBody.appendChild(pRow);
          });
        }
      } else {
        drawer.style.display = 'none';
      }
    }
  }

  // 8. Render Friends Tab
  renderFriends() {
    const list = document.getElementById('friends-cards-list');
    const countHeading = document.getElementById('friends-count-heading');
    const activeNowList = document.getElementById('active-now-list');

    if (list) {
      list.innerHTML = '';
      const friends = window.stateManager.state.friends;
      if (countHeading) countHeading.textContent = `ONLINE — ${friends.filter(f => f.status !== 'offline').length}`;

      friends.forEach(f => {
        const item = document.createElement('div');
        item.className = 'friend-row-item';
        item.innerHTML = `
          <div class="friend-row-left">
            <div class="friend-avatar-wrap">
              <div class="friend-avatar" style="background-color: ${f.avatarBg}">${f.avatarText}</div>
              <div class="status-indicator ${f.status}"></div>
            </div>
            <div class="friend-names-col">
              <span class="friend-main-name">${f.name}</span>
              <span class="friend-sub-status">${f.customStatus || f.activity}</span>
            </div>
          </div>
          <div class="friend-actions-col">
            <button class="friend-action-btn" title="Message" onclick="window.uiController.openDirectMessageChat(${JSON.stringify(f).replace(/"/g, '&quot;')})">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            </button>
            <button class="friend-action-btn" title="Call" onclick="window.audioEngine.playCallRing()">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
            </button>
          </div>
        `;
        list.appendChild(item);
      });
    }

    if (activeNowList) {
      activeNowList.innerHTML = '';
      window.stateManager.state.friends.forEach(f => {
        if (f.activity) {
          const card = document.createElement('div');
          card.className = 'active-activity-card';
          card.innerHTML = `
            <div class="activity-user-row">
              <div class="activity-avatar" style="background-color: ${f.avatarBg}">${f.avatarText}</div>
              <span class="activity-user-name">${f.name}</span>
            </div>
            <div class="activity-text">${f.activity}</div>
            <div class="activity-detail">${f.activityDetail || ''}</div>
          `;
          activeNowList.appendChild(card);
        }
      });
    }
  }

  // 9. Update Bottom User Bar
  renderUserBar() {
    const me = window.stateManager.state.currentUser;
    const nameEl = document.getElementById('current-user-name');
    const subtextEl = document.getElementById('current-user-subtext');
    const avatarEl = document.getElementById('current-user-avatar');
    const initialsEl = document.getElementById('current-user-initials');
    const statusDot = document.getElementById('current-user-status-dot');

    if (nameEl) nameEl.textContent = me.name;
    if (subtextEl) subtextEl.textContent = me.customStatus || me.role;

    if (avatarEl) {
      if (me.avatarPhoto) {
        avatarEl.style.backgroundImage = `url(${me.avatarPhoto})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        if (initialsEl) initialsEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = me.avatarBg || '#5865F2';
        if (initialsEl) initialsEl.textContent = me.avatarText || me.name.substring(0, 2).toUpperCase();
      }
    }

    if (statusDot) {
      statusDot.className = `status-indicator ${me.status || 'online'}`;
    }

    this.updateUserBarControls();
  }

  updateUserBarControls() {
    const isMuted = window.stateManager.state.isMuted;
    const isDeafened = window.stateManager.state.isDeafened;

    const micOn = document.querySelector('#btn-toggle-mic .mic-on');
    const micOff = document.querySelector('#btn-toggle-mic .mic-off');
    const deafOn = document.querySelector('#btn-toggle-deafen .headphones-on');
    const deafOff = document.querySelector('#btn-toggle-deafen .headphones-off');

    if (micOn && micOff) {
      micOn.style.display = isMuted ? 'none' : 'block';
      micOff.style.display = isMuted ? 'block' : 'none';
    }
    if (deafOn && deafOff) {
      deafOn.style.display = isDeafened ? 'none' : 'block';
      deafOff.style.display = isDeafened ? 'block' : 'none';
    }
  }

  updateVoiceConnectionUI(isConnected, channelName = '', guildName = '') {
    const panel = document.getElementById('voice-connection-panel');
    const chanCurrent = document.getElementById('voice-channel-current');

    if (panel) {
      panel.style.display = isConnected ? 'flex' : 'none';
    }
    if (chanCurrent && isConnected) {
      chanCurrent.textContent = `${channelName} / ${guildName}`;
    }

    this.renderChannels();
    this.renderVoiceStage();
  }

  setUserSpeakingHighlight(isSpeaking) {
    const avatarWrap = document.querySelector('#user-summary-btn .avatar-wrap');
    if (avatarWrap) {
      avatarWrap.style.boxShadow = isSpeaking ? '0 0 0 2px var(--green)' : 'none';
    }
    const me = window.stateManager.state.currentUser;
    this.updateVoiceCardSpeakingState(me.id, isSpeaking);
  }

  setRemoteUserSpeakingHighlight(userId, isSpeaking) {
    this.updateVoiceCardSpeakingState(userId, isSpeaking);
  }

  updateVoiceCardSpeakingState(userId, isSpeaking) {
    const card = document.getElementById('voice-card-' + userId);
    if (card) {
      if (isSpeaking) {
        card.classList.add('speaking');
        const tag = card.querySelector('.voice-card-tag');
        if (tag) tag.innerText = '🟢 Speaking';
      } else {
        card.classList.remove('speaking');
        const tag = card.querySelector('.voice-card-tag');
        if (tag) tag.innerText = 'Connected';
      }
    }

    const meetTile = document.getElementById('meet-tile-' + userId);
    if (meetTile) {
      if (isSpeaking) {
        meetTile.classList.add('speaking');
      } else {
        meetTile.classList.remove('speaking');
      }
    }
  }

  updateVoiceCardMuteState(userId, isMuted) {
    const card = document.getElementById('voice-card-' + userId);
    if (card) {
      const nameCol = card.querySelector('.voice-card-name');
      if (nameCol) {
        const nameText = nameCol.querySelector('span') ? nameCol.querySelector('span').innerText : nameCol.innerText;
        nameCol.innerHTML = `
          <span>${nameText}</span>
          ${isMuted ? '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="#f23f43" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l3.2 3.2L21 18.27 4.27 3z"/></svg>' : ''}
        `;
      }
    }
  }


  // 10. Reactions & Quotes
  addQuickReaction(msgId) {
    const emojis = ['👍', '❤️', '🔥', '📚', '🚀', '💯'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    this.toggleReaction(msgId, randomEmoji);
  }

  toggleReaction(msgId, emoji) {
    this.toggleReactionLocal(msgId, emoji, true);
    const ch = window.stateManager.getCurrentChannel();
    if (ch && window.networkEngine) {
      window.networkEngine.broadcastMessageReaction(ch.id, msgId, emoji);
    }
  }

  toggleReactionLocal(msgId, emoji, isLocal = false) {
    const ch = window.stateManager.getCurrentChannel();
    if (!ch) return;
    const msgs = window.stateManager.getChannelMessages(ch.id);
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];
    let r = msg.reactions.find(x => x.emoji === emoji);
    if (r) {
      if (isLocal) {
        if (r.reacted) {
          r.count--;
          r.reacted = false;
          if (r.count <= 0) {
            msg.reactions = msg.reactions.filter(x => x !== r);
          }
        } else {
          r.count++;
          r.reacted = true;
        }
      } else {
        r.count++; // Remote user reacted
      }
    } else {
      msg.reactions.push({ emoji, count: 1, reacted: isLocal });
    }
    window.stateManager.saveState();
    this.renderMessages();
  }

  showTypingIndicator(name) {
    let typingBar = document.getElementById('typing-indicator-bar');
    if (!typingBar) {
      typingBar = document.createElement('div');
      typingBar.id = 'typing-indicator-bar';
      typingBar.style.padding = '0 20px 8px 20px';
      typingBar.style.fontSize = '12px';
      typingBar.style.color = 'var(--text-muted)';
      typingBar.style.fontWeight = 'bold';
      typingBar.style.fontStyle = 'italic';
      const container = document.getElementById('chat-input-area');
      if (container) container.parentNode.insertBefore(typingBar, container);
    }
    typingBar.textContent = `${name} is typing...`;
    
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      if (typingBar) typingBar.textContent = '';
    }, 2000);
  }

  openDirectMessageChat(friend) {
    const myId = window.stateManager.state.currentUser.id;
    window.stateManager.state.activeGuildId = 'home';
    window.stateManager.state.activeChannelId = 'dm-' + [myId, friend.id].sort().join('-');
    window.stateManager.saveState();
    this.renderAll();
  }

  openFriends() {
    window.stateManager.state.activeGuildId = 'home';
    window.stateManager.state.activeChannelId = null;
    window.stateManager.saveState();
    this.renderAll();
  }

  openMemberProfilePopover(member, event) {
    const pop = document.getElementById('member-profile-popover');
    if (!pop || !member) return;

    // 1. Banner
    const bannerEl = document.getElementById('popover-banner');
    if (bannerEl) {
      bannerEl.style.backgroundColor = member.bannerColor || member.avatarBg || '#5865F2';
    }

    // 2. Avatar
    const avatarEl = document.getElementById('popover-avatar');
    if (avatarEl) {
      if (member.avatarPhoto) {
        avatarEl.style.backgroundImage = `url(${member.avatarPhoto})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = 'none';
        avatarEl.style.backgroundColor = member.avatarBg || '#5865F2';
        const safeText = this.getSafeAvatarInitials(member);
        avatarEl.textContent = safeText;
        avatarEl.style.fontSize = safeText.length > 2 ? '18px' : '28px';
        avatarEl.style.overflow = 'hidden';
      }
    }

    // 3. Status Dot
    const statusDot = document.getElementById('popover-status');
    if (statusDot) {
      statusDot.className = `status-indicator ${member.status || 'online'}`;
    }

    // 4. Username & Tag
    const usernameEl = document.getElementById('popover-username');
    const discEl = document.getElementById('popover-discriminator');
    if (usernameEl) usernameEl.textContent = member.name.replace(' (You)', '');
    const handleTag = member.handle ? ` ${member.handle}` : (member.discriminator ? `#${member.discriminator}` : '#UniCord');
    if (discEl) discEl.textContent = handleTag;

    // 5. Custom Status
    const customStatusEl = document.getElementById('popover-custom-status');
    if (customStatusEl) {
      const statusText = member.customStatus || member.activity || 'Active on UniCord';
      customStatusEl.textContent = statusText;
      customStatusEl.style.display = statusText ? 'block' : 'none';
    }

    // 6. About Me / Bio
    const aboutEl = document.getElementById('popover-about');
    if (aboutEl) {
      aboutEl.textContent = member.bio || 'Proud university student on UniCord!';
    }

    // 7. Roles Tag
    const rolesContainer = document.getElementById('popover-roles');
    if (rolesContainer) {
      const roleText = member.role || 'Student';
      rolesContainer.innerHTML = `
        <div class="popover-role-tag">
          <span class="popover-role-dot" style="background-color: ${member.avatarBg || '#5865F2'}"></span>
          <span>${roleText}</span>
        </div>
      `;
    }

    // 8. Action button
    const btnDm = document.getElementById('popover-btn-dm');
    if (btnDm) {
      // Remove any previously added stage join button
      const oldStageBtn = document.getElementById('popover-btn-stage-join');
      if (oldStageBtn) oldStageBtn.remove();

      // Add prominent "Watch Stream / Join Voice Stage" button
      const btnStage = document.createElement('button');
      btnStage.id = 'popover-btn-stage-join';
      btnStage.className = 'btn-primary';
      btnStage.style.width = '100%';
      btnStage.style.marginBottom = '8px';
      btnStage.style.backgroundColor = '#23a55a';
      btnStage.style.display = 'flex';
      btnStage.style.alignItems = 'center';
      btnStage.style.justifyContent = 'center';
      btnStage.style.gap = '6px';
      btnStage.innerHTML = `<span>📺 Join Stage & Watch Presentation</span>`;
      btnStage.onclick = () => {
        pop.style.display = 'none';
        window.voiceController.joinVoice('chan-voice-lounge', 'Lounge (General)', 'Unicord Central');
      };
      btnDm.parentNode.insertBefore(btnStage, btnDm);

      const isSelf = member.id === window.stateManager.state.currentUser.id || member.name.includes('(You)');
      if (isSelf) {
        btnDm.textContent = '✏️ Edit Profile';
        btnDm.onclick = () => {
          pop.style.display = 'none';
          this.openEditProfileModal();
        };
      } else {
        btnDm.textContent = '💬 Message @' + member.name.replace(' (You)', '');
        btnDm.onclick = () => {
          pop.style.display = 'none';
          // Ensure they are in friends list
          let friend = window.stateManager.state.friends.find(f => f.id === member.id);
          if (!friend) {
            friend = {
              id: member.id,
              name: member.name,
              avatarText: member.avatarText,
              avatarBg: member.avatarBg,
              avatarPhoto: member.avatarPhoto,
              status: member.status || 'online',
              bio: member.bio || ''
            };
            window.stateManager.state.friends.push(friend);
            window.stateManager.saveState();
          }
          this.openDirectMessageChat(friend);
        };
      }
    }

    // 9. Smart Viewport Positioning
    let clientX = 100;
    let clientY = 100;
    if (event && event.currentTarget) {
      const rect = event.currentTarget.getBoundingClientRect();
      if (rect.left > window.innerWidth / 2) {
        clientX = Math.max(10, rect.left - 315);
      } else {
        clientX = Math.min(window.innerWidth - 320, rect.right + 15);
      }
      clientY = Math.min(window.innerHeight - 390, Math.max(15, rect.top - 20));
    } else if (event) {
      clientX = Math.min(window.innerWidth - 320, Math.max(10, event.clientX + 10));
      clientY = Math.min(window.innerHeight - 390, Math.max(10, event.clientY - 20));
    }

    pop.style.left = `${clientX}px`;
    pop.style.top = `${clientY}px`;
    pop.style.display = 'block';

    const closeHandler = (e) => {
      if (!pop.contains(e.target) && (!event || !event.currentTarget || !event.currentTarget.contains(e.target))) {
        pop.style.display = 'none';
        document.removeEventListener('click', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('click', closeHandler), 20);
  }

  openCreateChannelModal(categoryId, categoryName) {
    const modal = document.getElementById('modal-create-channel');
    const subtitle = document.getElementById('create-channel-subtitle');
    if (subtitle) subtitle.textContent = `in ${categoryName}`;
    if (modal) {
      modal.setAttribute('data-target-cat-id', categoryId);
      modal.style.display = 'flex';
      const input = document.getElementById('new-channel-name');
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  }

  openEditProfileModal() {
    const modal = document.getElementById('modal-edit-profile');
    if (!modal) return;

    const me = window.stateManager.state.currentUser;

    // Populate inputs
    const inputName = document.getElementById('edit-display-name');
    const selectRole = document.getElementById('edit-student-role');
    const inputStatus = document.getElementById('edit-custom-status');
    const inputBanner = document.getElementById('edit-banner-color');
    const inputBio = document.getElementById('edit-bio');

    if (inputName) inputName.value = me.name || '';
    if (selectRole) selectRole.value = me.role || 'BBA Student';
    if (inputStatus) inputStatus.value = me.customStatus || '';
    if (inputBanner) inputBanner.value = me.bannerColor || '#5865F2';
    if (inputBio) inputBio.value = me.bio || '';

    // Selected swatch
    document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(sw => {
      sw.classList.toggle('active', sw.dataset.color === me.avatarBg);
    });

    this.updateLiveProfilePreview();
    modal.style.display = 'flex';
  }

  updateLiveProfilePreview() {
    const inputName = document.getElementById('edit-display-name');
    const selectRole = document.getElementById('edit-student-role');
    const inputStatus = document.getElementById('edit-custom-status');
    const inputBanner = document.getElementById('edit-banner-color');
    const inputBio = document.getElementById('edit-bio');

    const prevName = document.getElementById('live-prev-name');
    const prevRole = document.getElementById('live-prev-role');
    const prevStatus = document.getElementById('live-prev-status');
    const prevBanner = document.getElementById('live-prev-banner');
    const prevBio = document.getElementById('live-prev-bio');
    const prevAvatar = document.getElementById('live-prev-avatar');

    const me = window.stateManager.state.currentUser;
    const nameVal = (inputName && inputName.value.trim()) || me.name;
    const roleVal = (selectRole && selectRole.value) || me.role;
    const statusVal = (inputStatus && inputStatus.value.trim()) || me.customStatus;
    const bannerVal = (inputBanner && inputBanner.value) || me.bannerColor || '#5865F2';
    const bioVal = (inputBio && inputBio.value.trim()) || me.bio;

    if (prevName) prevName.textContent = nameVal;
    if (prevRole) prevRole.textContent = roleVal;
    if (prevStatus) prevStatus.textContent = statusVal;
    if (prevBanner) prevBanner.style.backgroundColor = bannerVal;
    if (prevBio) prevBio.textContent = bioVal;

    if (prevAvatar) {
      if (me.avatarPhoto) {
        prevAvatar.style.backgroundImage = `url(${me.avatarPhoto})`;
        prevAvatar.textContent = '';
      } else {
        prevAvatar.style.backgroundImage = 'none';
        prevAvatar.style.backgroundColor = me.avatarBg || '#5865F2';
        prevAvatar.textContent = nameVal.substring(0, 2).toUpperCase();
      }
    }
  }

}

window.uiController = new UIController();
