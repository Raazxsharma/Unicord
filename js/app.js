/**
 * UniCord Main Application Bootstrap & Event Handlers
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize UI, Audio & Real-time Network
  window.uiController.init();



  const menuServerSettings = document.getElementById('menu-server-settings');
  if (menuServerSettings) {
    menuServerSettings.onclick = (e) => {
      e.stopPropagation();
      const serverDropdown = document.getElementById('server-dropdown');
      if (serverDropdown) serverDropdown.style.display = 'none';
      window.uiController.openServerSettingsModal();
    };
  }

  const inputServerName = document.getElementById('input-edit-server-name');
  const inputServerInitials = document.getElementById('input-edit-server-initials');
  const previewIcon = document.getElementById('server-edit-preview-icon');
  const previewText = document.getElementById('server-edit-preview-text');
  const previewName = document.getElementById('server-edit-preview-name');
  let selectedServerColor = '#5865F2';

  if (inputServerName) {
    inputServerName.oninput = (e) => {
      if (previewName) previewName.textContent = e.target.value.trim() || 'Server Name';
    };
  }
  if (inputServerInitials) {
    inputServerInitials.oninput = (e) => {
      if (previewText) previewText.textContent = e.target.value.trim().toUpperCase() || 'SRV';
    };
  }

  document.querySelectorAll('.color-circle').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.color-circle').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      selectedServerColor = btn.dataset.color;
      if (previewIcon) previewIcon.style.backgroundColor = selectedServerColor;
    };
  });

  const btnCloseServer = document.getElementById('btn-close-server-settings');
  const btnCancelServer = document.getElementById('btn-cancel-server-settings');
  const btnSaveServer = document.getElementById('btn-save-server-settings');
  const btnDeleteServer = document.getElementById('btn-delete-current-server');

  if (btnCloseServer) btnCloseServer.onclick = () => window.uiController.closeServerSettingsModal();
  if (btnCancelServer) btnCancelServer.onclick = () => window.uiController.closeServerSettingsModal();

  if (btnSaveServer) {
    btnSaveServer.onclick = () => {
      const modal = document.getElementById('modal-edit-server');
      const guildId = modal?.getAttribute('data-guild-id') || window.stateManager.state.activeGuildId;
      const newName = inputServerName?.value.trim() || 'My Server';
      const newInitials = inputServerInitials?.value.trim().toUpperCase() || newName.substring(0, 2).toUpperCase();
      const previewIcon = document.getElementById('server-edit-preview-icon');
      const currentColor = previewIcon ? previewIcon.style.backgroundColor : selectedServerColor;

      window.stateManager.updateGuild(guildId, {
        name: newName,
        initials: newInitials,
        color: currentColor
      });

      window.uiController.renderAll();
      if (guildId === window.stateManager.state.activeGuildId) {
        const serverNameLabel = document.getElementById('server-name-label');
        if (serverNameLabel) serverNameLabel.textContent = newName;
      }
      window.uiController.closeServerSettingsModal();
    };
  }

  if (btnDeleteServer) {
    btnDeleteServer.onclick = () => {
      const modal = document.getElementById('modal-edit-server');
      const guildId = modal?.getAttribute('data-guild-id') || window.stateManager.state.activeGuildId;
      if (confirm('Are you sure you want to delete this server? This action cannot be undone.')) {
        if (window.stateManager.deleteGuild(guildId)) {
          window.uiController.renderAll();
          window.uiController.closeServerSettingsModal();
        }
      }
    };
  }

  if (window.networkEngine) {
    window.networkEngine.init();
  }

  // Subscribe to state changes (multi-tab sync)
  
  // 12. Live Search in Messages
  const searchInput = document.querySelector('.search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      document.querySelectorAll('.message-item').forEach(item => {
        const body = item.querySelector('.message-body')?.textContent?.toLowerCase() || '';
        const user = item.querySelector('.message-username')?.textContent?.toLowerCase() || '';
        if (!q || body.includes(q) || user.includes(q)) {
          item.style.display = 'flex';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  window.stateManager.subscribe(() => {
    window.uiController.renderAll();
  });

  // 2. Chat Input & Send Handling
  const chatForm = document.getElementById('chat-form');
  const msgInput = document.getElementById('message-input');

  let currentAttachment = null;

  const showAttachmentPreview = (attachment) => {
    currentAttachment = attachment;
    const bar = document.getElementById('attachment-preview-bar');
    const thumb = document.getElementById('attachment-preview-thumb');
    const icon = document.getElementById('attachment-preview-icon');
    const nameEl = document.getElementById('attachment-preview-name');
    const sizeEl = document.getElementById('attachment-preview-size');

    if (!bar) return;
    bar.style.display = 'flex';
    if (nameEl) nameEl.textContent = attachment.name;
    if (sizeEl) sizeEl.textContent = attachment.size;

    if (attachment.isImage && thumb) {
      thumb.src = attachment.url;
      thumb.style.display = 'block';
      if (icon) icon.style.display = 'none';
    } else {
      if (thumb) thumb.style.display = 'none';
      if (icon) icon.style.display = 'flex';
    }
  };

  const clearAttachmentPreview = () => {
    currentAttachment = null;
    const bar = document.getElementById('attachment-preview-bar');
    const fInput = document.getElementById('file-upload-input');
    if (bar) bar.style.display = 'none';
    if (fInput) fInput.value = '';
  };

  const btnRemoveAttach = document.getElementById('btn-remove-attachment');
  if (btnRemoveAttach) {
    btnRemoveAttach.onclick = clearAttachmentPreview;
  }

  const sendMessage = () => {
    const text = msgInput.value.trim();
    if (!text && !currentAttachment) return;

    const ch = window.stateManager.getCurrentChannel();
    if (!ch) return;

    const me = window.stateManager.state.currentUser;
    const newMsg = {
      id: 'msg-' + Date.now(),
      author: {
        name: me.name,
        avatarText: me.avatarText,
        avatarBg: me.avatarBg,
        avatarPhoto: me.avatarPhoto || null,
        role: me.role,
        isBot: false
      },
      timestamp: 'Just now',
      content: text,
      attachment: currentAttachment ? { ...currentAttachment } : null
    };

    window.stateManager.addMessage(ch.id, newMsg);
    msgInput.value = '';
    msgInput.style.height = 'auto';
    clearAttachmentPreview();

    window.uiController.renderMessages();

    // Broadcast message to all connected classmates across the internet
    if (window.networkEngine) {
      window.networkEngine.broadcastChatMessage(ch.id, newMsg);
    }

    // Trigger campus bot or student responses
    if (text) {
      window.botEngine.processUserMessage(ch.id, text);
    }
  };

  if (msgInput) {
    msgInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Auto-expand textarea & typing indicator
    msgInput.addEventListener('input', () => {
      msgInput.style.height = 'auto';
      msgInput.style.height = Math.min(140, msgInput.scrollHeight) + 'px';
      
      const ch = window.stateManager.getCurrentChannel();
      if (ch && window.networkEngine) {
        window.networkEngine.broadcastTyping(ch.id);
      }
    });
  }

  const btnSendMessage = document.getElementById('btn-send-message');
  if (btnSendMessage) {
    btnSendMessage.onclick = sendMessage;
  }

  // 3. File & Image Attachment Staging & Upload
  const btnAttach = document.getElementById('btn-attach');
  const fileInput = document.getElementById('file-upload-input');

  const handleFileStaging = (file) => {
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const sizeKB = Math.round(file.size / 1024);
    const sizeStr = sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)} MB` : `${sizeKB} KB`;

    const reader = new FileReader();
    reader.onload = (e) => {
      showAttachmentPreview({
        name: file.name,
        size: sizeStr,
        type: file.type,
        isImage,
        url: e.target.result
      });
    };
    reader.readAsDataURL(file);
  };

  if (btnAttach && fileInput) {
    btnAttach.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      handleFileStaging(file);
    };
  }

  // Drag & Drop file staging onto chat form
  if (chatForm) {
    chatForm.addEventListener('dragover', (e) => {
      e.preventDefault();
      chatForm.style.borderColor = 'var(--brand)';
    });
    chatForm.addEventListener('dragleave', () => {
      chatForm.style.borderColor = 'transparent';
    });
    chatForm.addEventListener('drop', (e) => {
      e.preventDefault();
      chatForm.style.borderColor = 'transparent';
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileStaging(e.dataTransfer.files[0]);
      }
    });
  }

  // Lightbox Close Handlers
  const modalLightbox = document.getElementById('modal-image-lightbox');
  const btnCloseLightbox = document.getElementById('btn-close-lightbox');
  if (btnCloseLightbox && modalLightbox) {
    btnCloseLightbox.onclick = () => window.uiController.closeImageLightbox();
    modalLightbox.onclick = (e) => {
      if (e.target === modalLightbox) {
        window.uiController.closeImageLightbox();
      }
    };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modalLightbox.style.display === 'flex') {
        window.uiController.closeImageLightbox();
      }
    });
  }

  // 4. Voice Controls (Mute, Deafen, Disconnect, Screen Share, Camera, Lo-Fi)
  const btnMic = document.getElementById('btn-toggle-mic');
  const btnDeafen = document.getElementById('btn-toggle-deafen');
  const btnDisconnect = document.getElementById('btn-voice-disconnect');
  const btnScreenShare = document.getElementById('btn-toggle-screenshare');
  const btnCamera = document.getElementById('btn-toggle-camera');
  const btnLofi = document.getElementById('btn-toggle-lofi');
  const btnLofiPlay = document.getElementById('btn-lofi-play');
  const selectLofiTrack = document.getElementById('select-lofi-track');
  const sliderLofiVol = document.getElementById('slider-lofi-volume');
  const lofiBar = document.getElementById('lofi-radio-bar');

  if (btnMic) btnMic.onclick = () => window.voiceController.toggleMute();
  if (btnDeafen) btnDeafen.onclick = () => window.voiceController.toggleDeafen();
  if (btnDisconnect) btnDisconnect.onclick = () => window.voiceController.leaveVoice();
  if (btnScreenShare) btnScreenShare.onclick = () => window.voiceController.toggleScreenShare();
  if (btnCamera) btnCamera.onclick = () => window.voiceController.toggleCamera();

  if (btnLofi) {
    btnLofi.onclick = () => {
      if (lofiBar) {
        const isHidden = lofiBar.style.display === 'none';
        lofiBar.style.display = isHidden ? 'flex' : 'none';
      }
      if (window.audioEngine && !window.audioEngine.lofiPlaying) {
        window.audioEngine.startLofi();
      }
    };
  }

  if (btnLofiPlay) {
    btnLofiPlay.onclick = () => window.audioEngine.toggleLofi();
  }

  if (selectLofiTrack) {
    selectLofiTrack.onchange = (e) => window.audioEngine.startLofi(e.target.value);
  }

  if (sliderLofiVol) {
    sliderLofiVol.oninput = (e) => window.audioEngine.setLofiVolume(parseInt(e.target.value, 10) / 100);
  }

  // 5. Server Dropdown Menu
  const serverHeader = document.getElementById('server-header');
  const serverDropdown = document.getElementById('server-dropdown');

  if (serverHeader && serverDropdown) {
    serverHeader.onclick = (e) => {
      e.stopPropagation();
      const isOpen = serverDropdown.style.display === 'flex';
      serverDropdown.style.display = isOpen ? 'none' : 'flex';
      serverHeader.classList.toggle('open', !isOpen);
    };

    document.addEventListener('click', (e) => {
      if (!serverDropdown.contains(e.target) && e.target !== serverHeader) {
        serverDropdown.style.display = 'none';
        serverHeader.classList.remove('open');
      }
    });

    const menuCreateChan = document.getElementById('menu-create-channel');
    if (menuCreateChan) {
      menuCreateChan.onclick = () => {
        serverDropdown.style.display = 'none';
        serverHeader.classList.remove('open');
        window.uiController.openCreateChannelModal('cat-bba', 'General');
      };
    }
  }

  // 6. Direct Messages / Home Click
  const btnHome = document.getElementById('btn-home');
  if (btnHome) {
    btnHome.onclick = () => {
      window.stateManager.state.activeGuildId = 'home';
      window.stateManager.saveState();
      window.uiController.renderAll();
    };
  }

  // 7. Add Server Modal
  const btnAddGuild = document.getElementById('btn-add-guild');
  const modalAddServer = document.getElementById('modal-add-server');
  const closeAddServer = document.getElementById('close-add-server-modal');
  const cancelAddServer = document.getElementById('cancel-add-server');
  const confirmAddServer = document.getElementById('confirm-add-server');
  const newServerNameInput = document.getElementById('new-server-name');

  if (btnAddGuild && modalAddServer) {
    btnAddGuild.onclick = () => {
      modalAddServer.style.display = 'flex';
      if (newServerNameInput) {
        newServerNameInput.value = '';
        newServerNameInput.focus();
      }
    };

    const hideAddServerModal = () => {
      modalAddServer.style.display = 'none';
    };

    if (closeAddServer) closeAddServer.onclick = hideAddServerModal;
    if (cancelAddServer) cancelAddServer.onclick = hideAddServerModal;

    if (confirmAddServer) {
      confirmAddServer.onclick = () => {
        const name = (newServerNameInput.value.trim()) || 'My College Server';
        const colors = ['#5865F2', '#23a55a', '#f0b232', '#eb459e', '#00a8fc'];
        const chosenColor = colors[Math.floor(Math.random() * colors.length)];
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 3).toUpperCase();

        const newGuild = {
          id: 'guild-' + Date.now(),
          name,
          initials,
          color: chosenColor,
          categories: [
            {
              id: 'cat-' + Date.now(),
              name: 'TEXT CHANNELS',
              channels: [
                { id: 'chan-' + Date.now(), name: 'general', type: 'text', topic: `Welcome to ${name}!` }
              ]
            },
            {
              id: 'cat-v-' + Date.now(),
              name: 'VOICE CHANNELS',
              channels: [
                { id: 'chan-v-' + Date.now(), name: 'Lounge', type: 'voice', topic: 'Voice chat' }
              ]
            }
          ]
        };

        window.stateManager.addGuild(newGuild);
        window.stateManager.state.activeGuildId = newGuild.id;
        window.stateManager.state.activeChannelId = newGuild.categories[0].channels[0].id;
        window.stateManager.saveState();

        hideAddServerModal();
        window.uiController.renderAll();
      };
    }
  }

  // 8. Create Channel Modal
  const modalCreateChan = document.getElementById('modal-create-channel');
  const closeCreateChan = document.getElementById('close-create-channel-modal');
  const cancelCreateChan = document.getElementById('cancel-create-channel');
  const confirmCreateChan = document.getElementById('confirm-create-channel');
  const newChanNameInput = document.getElementById('new-channel-name');

  if (modalCreateChan) {
    const hideCreateChan = () => { modalCreateChan.style.display = 'none'; };
    if (closeCreateChan) closeCreateChan.onclick = hideCreateChan;
    if (cancelCreateChan) cancelCreateChan.onclick = hideCreateChan;

    if (confirmCreateChan) {
      confirmCreateChan.onclick = () => {
        const catId = modalCreateChan.getAttribute('data-target-cat-id');
        let name = (newChanNameInput.value.trim()) || 'new-channel';
        name = name.toLowerCase().replace(/\s+/g, '-');
        const selectedType = document.querySelector('input[name="channel-type"]:checked')?.value || 'text';

        const newChan = {
          id: 'chan-' + Date.now(),
          name,
          type: selectedType,
          topic: `Discuss ${name}`
        };

        const guildId = window.stateManager.state.activeGuildId;
        window.stateManager.addChannel(guildId, catId, newChan);
        window.stateManager.state.activeChannelId = newChan.id;
        window.stateManager.saveState();

        hideCreateChan();
        window.uiController.renderAll();
      };
    }
  }

  // 9. Fullscreen Settings Modal
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const settingsModal = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');

  if (btnOpenSettings && settingsModal) {
    btnOpenSettings.onclick = () => {
      settingsModal.style.display = 'flex';
      // Sync preview inputs with current user
      const me = window.stateManager.state.currentUser;
      const inputName = document.getElementById('settings-input-name');
      const inputBio = document.getElementById('settings-input-bio');
      const dispPreview = document.getElementById('settings-displayname-preview');
      const avatarPreview = document.getElementById('settings-avatar-preview');

      if (inputName) inputName.value = me.name;
      if (inputBio) inputBio.value = me.bio;
      if (dispPreview) dispPreview.textContent = me.name;
      if (avatarPreview) avatarPreview.textContent = me.avatarText;
    };

    if (btnCloseSettings) {
      btnCloseSettings.onclick = () => {
        settingsModal.style.display = 'none';
      };
    }

    // Tabs inside settings
    document.querySelectorAll('.settings-nav-item[data-tab]').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        document.querySelectorAll('.settings-pane').forEach(p => p.style.display = 'none');
        const target = document.getElementById(`pane-${tab}`);
        if (target) target.style.display = 'block';
      };
    });

    // Theme selector
    document.querySelectorAll('.theme-card').forEach(card => {
      card.onclick = () => {
        window.uiController.setTheme(card.dataset.theme);
      };
    });

    // Mic Test button
    const btnTestMic = document.getElementById('btn-test-mic');
    if (btnTestMic) {
      let testing = false;
      btnTestMic.onclick = async () => {
        if (!testing) {
          testing = true;
          btnTestMic.textContent = 'Stop Testing';
          await window.audioEngine.startMicrophoneDetection();
        } else {
          testing = false;
          btnTestMic.textContent = "Let's Check";
          window.audioEngine.stopMicrophoneDetection();
          const micFill = document.getElementById('mic-test-fill');
          if (micFill) micFill.style.width = '0%';
        }
      };
    }

    // Settings user inputs save
    const inputName = document.getElementById('settings-input-name');
    const inputBio = document.getElementById('settings-input-bio');

    if (inputName) {
      inputName.oninput = () => {
        const val = inputName.value.trim() || 'DiscordUser';
        window.stateManager.state.currentUser.name = val;
        window.stateManager.state.currentUser.avatarText = val.slice(0, 2).toUpperCase();
        window.stateManager.saveState();
        window.uiController.renderUserBar();
      };
    }

    if (inputBio) {
      inputBio.oninput = () => {
        window.stateManager.state.currentUser.bio = inputBio.value;
        window.stateManager.saveState();
      };
    }

    // Reset Demo Data
    const btnResetDemo = document.getElementById('btn-reset-demo-data');
    if (btnResetDemo) {
      btnResetDemo.onclick = () => {
        if (confirm('Reset UniCord demo data back to default university state?')) {
          window.stateManager.resetDemo();
          settingsModal.style.display = 'none';
          window.uiController.renderAll();
        }
      };
    }
  }

  // 10. Soundboard Popover & Buttons
  const btnToggleSoundboard = document.getElementById('btn-toggle-soundboard');
  const soundboardPop = document.getElementById('soundboard-popover');
  const btnCloseSoundboard = document.getElementById('btn-close-soundboard');
  const soundboardGrid = document.getElementById('soundboard-grid');

  const soundboardSounds = [
    { id: 'airhorn', name: 'Air Horn 📢' },
    { id: 'applause', name: 'Applause 👏' },
    { id: 'quack', name: 'Quack 🦆' },
    { id: 'bell', name: 'Campus Bell 🔔' }
  ];

  if (soundboardGrid) {
    soundboardSounds.forEach(s => {
      const tile = document.createElement('div');
      tile.className = 'soundboard-tile';
      tile.textContent = s.name;
      tile.onclick = () => window.audioEngine.playSoundboard(s.id);
      soundboardGrid.appendChild(tile);
    });
  }

  if (btnToggleSoundboard && soundboardPop) {
    btnToggleSoundboard.onclick = (e) => {
      e.stopPropagation();
      soundboardPop.style.display = soundboardPop.style.display === 'block' ? 'none' : 'block';
    };
    if (btnCloseSoundboard) {
      btnCloseSoundboard.onclick = () => { soundboardPop.style.display = 'none'; };
    }
  }

  // 10b. Study Whiteboard (Activity) Toggle
  const btnOpenWhiteboard = document.getElementById('btn-open-whiteboard');
  if (btnOpenWhiteboard) {
    btnOpenWhiteboard.onclick = () => {
      if (window.whiteboardEngine) {
        window.whiteboardEngine.toggle();
      }
    };
  }
  if (window.whiteboardEngine) {
    window.whiteboardEngine.init();
  }

  // Sound test buttons in Settings
  document.querySelectorAll('.sound-test-btn').forEach(btn => {
    btn.onclick = () => {
      const s = btn.dataset.sound;
      if (s === 'join') window.audioEngine.playJoinSound();
      if (s === 'leave') window.audioEngine.playLeaveSound();
      if (s === 'mute') window.audioEngine.playMuteSound();
      if (s === 'unmute') window.audioEngine.playUnmuteSound();
      if (s === 'message') window.audioEngine.playMessagePing();
      if (s === 'deafen') window.audioEngine.playDeafenSound();
      if (s === 'call') window.audioEngine.playCallRing();
    };
  });

  // 11. Emoji Picker
  const btnEmoji = document.getElementById('btn-emoji');
  const emojiPicker = document.getElementById('emoji-picker');
  const emojiGrid = document.getElementById('emoji-grid');
  const emojiSearch = document.getElementById('emoji-search');

  const campusEmojis = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰',
    '😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏',
    '🔥','💯','🚀','📚','🎓','☕','🍕','🍔','🍟','🎉','💡','🏆','🎮','⚽','🏀','🎸',
    '👍','👎','👏','🙌','🤝','💪','✌️','🤞','🤙','👋','❤️','💖','✨','⭐','🌟','💤'
  ];

  if (emojiGrid) {
    const renderEmojiTiles = (list) => {
      emojiGrid.innerHTML = '';
      list.forEach(em => {
        const item = document.createElement('div');
        item.className = 'emoji-item-btn';
        item.textContent = em;
        item.onclick = () => {
          if (msgInput) {
            msgInput.value += em;
            msgInput.focus();
          }
          emojiPicker.style.display = 'none';
        };
        emojiGrid.appendChild(item);
      });
    };

    renderEmojiTiles(campusEmojis);

    if (emojiSearch) {
      emojiSearch.oninput = () => {
        const q = emojiSearch.value.trim().toLowerCase();
        renderEmojiTiles(campusEmojis);
      };
    }
  }

  if (btnEmoji && emojiPicker) {
    btnEmoji.onclick = (e) => {
      e.stopPropagation();
      emojiPicker.style.display = emojiPicker.style.display === 'flex' ? 'none' : 'flex';
    };
  }

  // 12. User Status Menu
  const userSummaryBtn = document.getElementById('user-summary-btn');
  const statusMenu = document.getElementById('status-menu');
  const inputCustomStatus = document.getElementById('input-custom-status');
  const btnSaveCustomStatus = document.getElementById('btn-save-custom-status');

  if (userSummaryBtn && statusMenu) {
    userSummaryBtn.onclick = (e) => {
      e.stopPropagation();
      statusMenu.style.display = statusMenu.style.display === 'flex' ? 'none' : 'flex';
    };

    document.querySelectorAll('.status-option').forEach(opt => {
      opt.onclick = () => {
        const st = opt.dataset.status;
        window.stateManager.state.currentUser.status = st;
        window.stateManager.saveState();
        statusMenu.style.display = 'none';
        window.uiController.renderUserBar();
      };
    });

    if (btnSaveCustomStatus && inputCustomStatus) {
      btnSaveCustomStatus.onclick = () => {
        const custom = inputCustomStatus.value.trim();
        window.stateManager.state.currentUser.customStatus = custom;
        window.stateManager.saveState();
        statusMenu.style.display = 'none';
        window.uiController.renderUserBar();
      };
    }
  }

  // 13. Trigger Bot / Simulate Classmate Button
  const btnTriggerBot = document.getElementById('btn-trigger-bot');
  if (btnTriggerBot) {
    btnTriggerBot.onclick = () => {
      const ch = window.stateManager.getCurrentChannel();
      if (!ch) return;
      window.botEngine.handleBotCommand(ch.id, '@UniBot help');
    };
  }

  // 14. Global Keyboard Shortcuts & Document Click Closes
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (settingsModal) settingsModal.style.display = 'none';
      if (modalAddServer) modalAddServer.style.display = 'none';
      if (modalCreateChan) modalCreateChan.style.display = 'none';
      if (emojiPicker) emojiPicker.style.display = 'none';
      if (soundboardPop) soundboardPop.style.display = 'none';
      if (statusMenu) statusMenu.style.display = 'none';
    }
  });

  document.addEventListener('click', (e) => {
    if (emojiPicker && !emojiPicker.contains(e.target) && e.target !== btnEmoji) {
      emojiPicker.style.display = 'none';
    }
    if (soundboardPop && !soundboardPop.contains(e.target) && e.target !== btnToggleSoundboard) {
      soundboardPop.style.display = 'none';
    }
    if (statusMenu && !statusMenu.contains(e.target) && !userSummaryBtn.contains(e.target)) {
      statusMenu.style.display = 'none';
    }
  });

  // --- EDIT PROFILE MODAL HANDLERS ---
  const modalEditProfile = document.getElementById('modal-edit-profile');
  const btnOpenEditProfile = document.getElementById('btn-open-edit-profile');
  const btnCloseEditProfile = document.getElementById('close-edit-profile-modal');
  const btnCancelEditProfile = document.getElementById('cancel-edit-profile');
  const btnSaveEditProfile = document.getElementById('save-edit-profile');

  const inputEditName = document.getElementById('edit-display-name');
  const selectEditRole = document.getElementById('edit-student-role');
  const inputEditStatus = document.getElementById('edit-custom-status');
  const inputEditBanner = document.getElementById('edit-banner-color');
  const inputEditBio = document.getElementById('edit-bio');
  const avatarFileInput = document.getElementById('edit-avatar-file-input');
  const btnUploadAvatarFile = document.getElementById('btn-upload-avatar-file');
  const btnRemoveAvatarPhoto = document.getElementById('btn-remove-avatar-photo');

  if (btnOpenEditProfile) {
    btnOpenEditProfile.onclick = (e) => {
      e.stopPropagation();
      window.uiController.openEditProfileModal();
    };
  }

  // Open from status menu
  const statusOptEdit = document.getElementById('status-opt-edit-profile');
  if (statusOptEdit) {
    statusOptEdit.onclick = () => {
      const statusMenu = document.getElementById('status-menu');
      if (statusMenu) statusMenu.style.display = 'none';
      window.uiController.openEditProfileModal();
    };
  }

  const hideEditProfileModal = () => {
    if (modalEditProfile) modalEditProfile.style.display = 'none';
  };
  if (btnCloseEditProfile) btnCloseEditProfile.onclick = hideEditProfileModal;
  if (btnCancelEditProfile) btnCancelEditProfile.onclick = hideEditProfileModal;

  // Real-time Live Preview Updates as user types
  [inputEditName, selectEditRole, inputEditStatus, inputEditBanner, inputEditBio].forEach(input => {
    if (input) {
      input.addEventListener('input', () => window.uiController.updateLiveProfilePreview());
      input.addEventListener('change', () => window.uiController.updateLiveProfilePreview());
    }
  });

  // Avatar Swatches click
  document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(sw => {
    sw.onclick = () => {
      document.querySelectorAll('#edit-avatar-swatches .avatar-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      window.stateManager.state.currentUser.avatarBg = sw.dataset.color;
      window.uiController.updateLiveProfilePreview();
    };
  });

  // Photo upload with automatic square crop & lightweight compression
  if (btnUploadAvatarFile && avatarFileInput) {
    btnUploadAvatarFile.onclick = () => avatarFileInput.click();
    avatarFileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Crop and compress into clean 160x160 square JPEG for fast WebSockets & localStorage
          const canvas = document.createElement('canvas');
          const size = 160;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          const minDim = Math.min(img.width, img.height);
          const sx = (img.width - minDim) / 2;
          const sy = (img.height - minDim) / 2;
          ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          window.stateManager.state.currentUser.avatarPhoto = compressedDataUrl;
          if (btnRemoveAvatarPhoto) btnRemoveAvatarPhoto.style.display = 'inline-block';
          window.uiController.updateLiveProfilePreview();
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    };
  }

  if (btnRemoveAvatarPhoto) {
    btnRemoveAvatarPhoto.onclick = () => {
      window.stateManager.state.currentUser.avatarPhoto = null;
      btnRemoveAvatarPhoto.style.display = 'none';
      if (avatarFileInput) avatarFileInput.value = '';
      window.uiController.updateLiveProfilePreview();
    };
  }

  // Save Changes
  if (btnSaveEditProfile) {
    btnSaveEditProfile.onclick = () => {
      const me = window.stateManager.state.currentUser;
      if (inputEditName) me.name = inputEditName.value.trim() || 'Student';
      if (selectEditRole) me.role = selectEditRole.value;
      if (inputEditStatus) me.customStatus = inputEditStatus.value.trim();
      if (inputEditBanner) me.bannerColor = inputEditBanner.value;
      if (inputEditBio) me.bio = inputEditBio.value.trim();
      me.avatarText = me.name.substring(0, 2).toUpperCase();

      // If currently in a voice channel, update active participant entry
      const activeVc = window.stateManager.state.activeVoiceChannelId;
      if (activeVc && window.stateManager.state.voiceParticipants[activeVc]) {
        const p = window.stateManager.state.voiceParticipants[activeVc].find(x => x.id === me.id);
        if (p) {
          p.name = me.name;
          p.avatarText = me.avatarText;
          p.avatarBg = me.avatarBg;
          p.avatarPhoto = me.avatarPhoto || null;
          p.role = me.role;
          p.customStatus = me.customStatus;
          p.bio = me.bio;
          p.bannerColor = me.bannerColor;
        }
      }

      window.stateManager.saveState();
      hideEditProfileModal();

      // Update UI components immediately
      window.uiController.renderUserBar();
      window.uiController.renderChannels();
      window.uiController.renderVoiceStage();
      window.uiController.renderMembers();
      window.uiController.renderMessages();

      // Broadcast profile changes across the internet to all connected friends!
      if (window.networkEngine) {
        window.networkEngine.broadcastProfileUpdate();
        if (activeVc) {
          window.networkEngine.broadcastVoiceJoin(activeVc);
        }
      }

      // Play success chime
      window.audioEngine.playMessagePing();
    };
  }

});
