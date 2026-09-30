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
  }

  init() {
    this.renderAll();
    this.setupTheme();
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

    window.stateManager.state.guilds.forEach(guild => {
      const item = document.createElement('div');
      item.className = `guild-item ${activeGuildId === guild.id ? 'active' : ''} ${guild.unread ? 'unread' : ''}`;
      item.setAttribute('data-tooltip', guild.name);

      item.innerHTML = `
        <div class="guild-pill"></div>
        <button class="guild-btn" style="background-color: ${guild.color}; color: #ffffff;">
          ${guild.initials}
        </button>
        ${guild.unread ? '<div class="guild-badge">1</div>' : ''}
      `;

      item.onclick = () => {
        window.stateManager.state.activeGuildId = guild.id;
        // Select first text channel in the guild
        const firstChan = guild.categories[0]?.channels[0];
        if (firstChan) {
          window.stateManager.state.activeChannelId = firstChan.id;
        }
        window.stateManager.saveState();
        this.renderAll();
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
      // Show DMs & Friends
      if (serverHeader) serverHeader.style.display = 'none';
      if (dmHeader) dmHeader.style.display = 'flex';
      if (channelsTree) channelsTree.style.display = 'none';
      if (dmsNav) dmsNav.style.display = 'block';
      if (chatViewport) chatViewport.style.display = 'none';
      if (friendsViewport) friendsViewport.style.display = 'flex';
      if (membersSidebar) membersSidebar.style.display = 'none';

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
              const avatarContent = hasPhoto ? '' : (p.avatarText || p.name.charAt(0));

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
    dmsNav.innerHTML = `
      <div class="channel-item active" style="margin-bottom: 8px;">
        <div class="channel-left">
          <svg class="channel-icon" viewBox="0 0 24 24"><path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
          <span class="channel-name">Friends</span>
        </div>
      </div>
      <div class="members-group-title">DIRECT MESSAGES</div>
    `;

    window.stateManager.state.friends.forEach(friend => {
      const fItem = document.createElement('div');
      fItem.className = 'channel-item';
      fItem.innerHTML = `
        <div class="channel-left">
          <div class="member-avatar-circle" style="width: 20px; height: 20px; font-size: 10px; background-color: ${friend.avatarBg};">
            ${friend.avatarText}
          </div>
          <span class="channel-name">${friend.name}</span>
        </div>
      `;
      fItem.onclick = () => {
        // Open Direct Message chat with friend
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
    if (msgInput) msgInput.placeholder = `Message #${ch.name}`;
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

    msgs.forEach((msg, idx) => {
      const item = document.createElement('div');
      item.className = 'message-item';
      item.setAttribute('data-msg-id', msg.id);

      const parsedHtml = window.MarkdownParser.parse(msg.content);

      const hasPhoto = !!msg.author.avatarPhoto;
      const avatarStyle = hasPhoto
        ? `background-image: url('${msg.author.avatarPhoto}'); background-size: cover; background-position: center; border: none;`
        : `background-color: ${msg.author.avatarBg || '#5865F2'};`;
      const avatarContent = hasPhoto ? '' : (msg.author.avatarText || msg.author.name.charAt(0));

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
          <div class="message-body">${parsedHtml}</div>
          ${msg.image ? `<img src="${msg.image}" class="message-attachment-image" alt="Attachment" />` : ''}
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
          <button class="msg-tool-btn" title="Reply" onclick="window.uiController.quoteReply('${msg.author.name}')">
            <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>
          </button>
          <button class="msg-tool-btn delete-btn" title="Delete Message" onclick="window.uiController.deleteMessage('${msg.id}')">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
          </button>
        </div>
      `;

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

    // Screen Share Tile if active
    if (window.stateManager.state.isScreenSharing) {
      const screenTile = document.createElement('div');
      screenTile.className = 'voice-screenshare-tile';
      screenTile.innerHTML = `
        <div class="screen-share-preview">
          <svg class="screen-share-icon" viewBox="0 0 24 24" width="48" height="48"><path fill="currentColor" d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.11 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/></svg>
          <div class="screen-share-title">${window.stateManager.state.currentUser.name}'s Screen (BBA Presentation Slides)</div>
        </div>
      `;
      stage.appendChild(screenTile);
    }

    participants.forEach(p => {
      const card = document.createElement('div');
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
    this.renderVoiceStage();
  }

  // 10. Reactions & Quotes
  addQuickReaction(msgId) {
    const emojis = ['👍', '❤️', '🔥', '📚', '🚀', '💯'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    this.toggleReaction(msgId, randomEmoji);
  }

  toggleReaction(msgId, emoji) {
    const ch = window.stateManager.getCurrentChannel();
    if (!ch) return;
    const msgs = window.stateManager.getChannelMessages(ch.id);
    const msg = msgs.find(m => m.id === msgId);
    if (!msg) return;

    if (!msg.reactions) msg.reactions = [];
    let r = msg.reactions.find(x => x.emoji === emoji);
    if (r) {
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
      msg.reactions.push({ emoji, count: 1, reacted: true });
    }
    window.stateManager.saveState();
    this.renderMessages();
  }

  quoteReply(username) {
    const input = document.getElementById('message-input');
    if (input) {
      input.value = `> Replying to @${username}:\n` + input.value;
      input.focus();
    }
  }

  openDirectMessageChat(friend) {
    window.stateManager.state.activeGuildId = 'home';
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
        avatarEl.textContent = member.avatarText || member.name.substring(0, 2).toUpperCase();
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
    if (discEl) discEl.textContent = member.discriminator ? `#${member.discriminator}` : '#UniCord';

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
          const msgInput = document.getElementById('message-input');
          if (msgInput) {
            msgInput.value = `@${member.name} ` + msgInput.value;
            msgInput.focus();
          }
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
