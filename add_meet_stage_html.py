import sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add #btn-toggle-meet-stage in nav-right if not present
meet_nav_btn = '''          <button class="nav-icon-btn" id="btn-toggle-meet-stage" data-tooltip="Conference Stage (Google Meet View)">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 14H5V6h14v12zM8 10h8v4H8z"/>
            </svg>
          </button>
'''

if 'id="btn-toggle-meet-stage"' not in html:
    target_btn = '<button class="nav-icon-btn" id="btn-open-whiteboard"'
    if target_btn in html:
        html = html.replace(target_btn, meet_nav_btn + target_btn)
        print('[SUCCESS] Inserted #btn-toggle-meet-stage into nav-right')
    else:
        print('[ERROR] Could not find #btn-open-whiteboard in index.html')
        sys.exit(1)
else:
    print('[INFO] #btn-toggle-meet-stage already present')

# 2. Add #meet-stage-viewport right after </section> of friends-viewport
meet_stage_html = '''        <!-- B3. Google Meet & Conference Stage Viewport -->
        <section class="meet-stage-viewport" id="meet-stage-viewport" style="display: none;">
          <!-- Top Meeting Header Bar -->
          <div class="meet-top-header">
            <div class="meet-header-left">
              <div class="meet-room-code-tag">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
                <span id="meet-room-code">dtq-geaw-mhs</span>
              </div>
              <div class="meet-room-name-title" id="meet-room-title">
                24/7 Study Room
              </div>
              <div class="meet-live-timer-badge" id="meet-live-timer">13:22</div>
              <div class="meet-quality-tag">HD 1080p • 60 FPS</div>
            </div>

            <div class="meet-header-right">
              <button class="meet-view-switch-btn active" id="btn-meet-mode-spotlight" title="Spotlight Presentation View">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14H6v-6h6v6zm7 0h-5v-2h5v2zm0-4h-5v-2h5v2zm0-4h-5V7h5v2z"/></svg>
                Spotlight
              </button>
              <button class="meet-view-switch-btn" id="btn-meet-mode-grid" title="Equal Participant Grid View">
                <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M4 4h7v7H4V4zm9 0h7v7h-7V4zm-9 9h7v7H4v-7zm9 0h7v7h-7v-7z"/></svg>
                Grid View
              </button>
              <button class="meet-icon-action-btn" id="btn-meet-minimize" title="Switch to Text Chat">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
              </button>
              <button class="meet-icon-action-btn" id="btn-meet-fullscreen" title="Full Screen">
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
              </button>
            </div>
          </div>

          <!-- Stage Body (Spotlight on Left + Participant Sidebar on Right OR Grid) -->
          <div class="meet-stage-body" id="meet-stage-body">
            <!-- Dynamic Injection by uiController.renderMeetStage() -->
          </div>

          <!-- Floating Emoji Reactions Overlay Layer -->
          <div class="meet-reactions-overlay" id="meet-reactions-overlay"></div>

          <!-- Emoji Reactions Popup Tray (Hidden by default) -->
          <div class="meet-reactions-tray" id="meet-reactions-tray" style="display: none;">
            <button class="meet-reaction-btn" data-emoji="❤️">❤️</button>
            <button class="meet-reaction-btn" data-emoji="👏">👏</button>
            <button class="meet-reaction-btn" data-emoji="😂">😂</button>
            <button class="meet-reaction-btn" data-emoji="🎉">🎉</button>
            <button class="meet-reaction-btn" data-emoji="🔥">🔥</button>
            <button class="meet-reaction-btn" data-emoji="💡">💡</button>
            <button class="meet-reaction-btn" data-emoji="💯">💯</button>
          </div>

          <!-- Google Meet Floating Action Dock Bar -->
          <div class="meet-bottom-dock">
            <!-- Left Group: Mic & Camera with Mute Indicators -->
            <div class="meet-dock-group">
              <button class="meet-dock-btn" id="btn-dock-mic" title="Toggle Microphone">
                <svg class="dock-mic-on" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path fill="currentColor" d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <svg class="dock-mic-off" style="display:none;" viewBox="0 0 24 24" width="20" height="20">
                  <path fill="#ffffff" d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zm-4.02.17c0-.06.02-.11.02-.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.18l5.98 5.99zM4.27 3L3 4.27l6.01 6.01V11c0 1.66 1.33 3 2.99 3 .22 0 .44-.03.65-.08l1.66 1.66c-.71.33-1.5.52-2.31.52-2.76 0-5.3-2.24-5.3-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c1.33-.19 2.53-.74 3.53-1.54l3.2 3.2L21 18.27 4.27 3z"/>
                </svg>
              </button>

              <button class="meet-dock-btn" id="btn-dock-camera" title="Toggle Camera">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/>
                </svg>
              </button>
            </div>

            <div class="meet-dock-divider"></div>

            <!-- Center Group: Presentation & Collaboration -->
            <div class="meet-dock-group">
              <button class="meet-dock-btn" id="btn-dock-screenshare" title="Share your screen">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M20 18c1.1 0 1.99-.9 1.99-2L22 6c0-1.11-.9-2-2-2H4c-1.1 0-2 .89-2 2v10c0 1.1.89 2 2 2H0v2h24v-2h-4zM4 6h16v10H4V6z"/>
                </svg>
              </button>

              <button class="meet-dock-btn" id="btn-dock-reactions" title="Send a reaction">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/>
                </svg>
              </button>

              <button class="meet-dock-btn" id="btn-dock-raise-hand" title="Raise hand">
                <span style="font-size:18px;">✋</span>
              </button>

              <button class="meet-dock-btn" id="btn-dock-whiteboard" title="Open Interactive Whiteboard">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                </svg>
              </button>

              <!-- Hangup End Call Pill -->
              <button class="meet-dock-btn hangup" id="btn-dock-hangup" title="Leave call">
                <svg viewBox="0 0 24 24" width="22" height="22">
                  <path fill="#ffffff" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.7 12.3c.39.39.39 1.02 0 1.41-.39.39-1.02.39-1.41 0L12 13.41l-2.29 2.3c-.39.39-1.02.39-1.41 0-.39-.39-.39-1.02 0-1.41L10.59 12 8.3 9.71c-.39-.39-.39-1.02 0-1.41.39-.39 1.02-.39 1.41 0L12 10.59l2.29-2.3c.39-.39 1.02-.39 1.41 0 .39.39.39 1.02 0 1.41L13.41 12l2.29 2.3z"/>
                </svg>
              </button>
            </div>

            <div class="meet-dock-divider"></div>

            <!-- Right Group: People, Chat & Activities -->
            <div class="meet-dock-group">
              <button class="meet-dock-btn" id="btn-dock-people" title="Show participants">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
                <span class="meet-dock-badge" id="meet-dock-people-badge">34</span>
              </button>

              <button class="meet-dock-btn" id="btn-dock-chat" title="In-Call Chat">
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Slide-over In-Call Drawer -->
          <div class="meet-side-drawer" id="meet-side-drawer" style="display: none;">
            <div class="meet-drawer-header">
              <div class="meet-drawer-tabs">
                <button class="meet-drawer-tab-btn active" id="tab-in-call-chat">In-Call Chat</button>
                <button class="meet-drawer-tab-btn" id="tab-in-call-people">People (34)</button>
              </div>
              <button class="meet-icon-action-btn" id="btn-close-meet-drawer" title="Close Drawer">✕</button>
            </div>

            <!-- Drawer Body -->
            <div class="meet-drawer-body" id="meet-drawer-body">
              <!-- Rendered messages or participant list -->
            </div>

            <!-- Drawer Footer (Chat Input) -->
            <div class="meet-drawer-footer" id="meet-drawer-footer">
              <div class="meet-chat-input-row">
                <input type="text" id="meet-in-call-input" placeholder="Send a message to everyone..." autocomplete="off">
                <button class="meet-chat-send-btn" id="btn-send-in-call-msg">
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
                </button>
              </div>
            </div>
          </div>
        </section>
'''

if 'id="meet-stage-viewport"' not in html:
    target_sec = '</section>\n\n        <!-- B3. Right Member List Sidebar'
    if target_sec in html:
        html = html.replace(target_sec, '</section>\n\n' + meet_stage_html + '\n        <!-- B3. Right Member List Sidebar')
        print('[SUCCESS] Inserted #meet-stage-viewport')
    else:
        # Fallback search
        fallback_target = '<aside class="members-sidebar"'
        if fallback_target in html:
            html = html.replace(fallback_target, meet_stage_html + '\n        ' + fallback_target)
            print('[SUCCESS] Inserted #meet-stage-viewport before members-sidebar')
        else:
            print('[ERROR] Could not find members-sidebar target')
            sys.exit(1)
else:
    print('[INFO] #meet-stage-viewport already present')

# 3. Add #meet-mini-dock before </body>
mini_dock_html = '''  <!-- Floating Mini Dock when browsing text channels while in voice -->
  <div class="meet-mini-dock" id="meet-mini-dock" style="display: none;">
    <div class="meet-mini-status">
      <div class="meet-mini-dot"></div>
      <div class="meet-mini-text" id="meet-mini-channel-text">Connected: 24/7 Study Room (Sourabh Singh presenting)</div>
    </div>
    <button class="meet-mini-btn-expand" id="btn-mini-return-stage">Return to Stage</button>
    <button class="meet-mini-btn-leave" id="btn-mini-leave-voice">Disconnect</button>
  </div>
'''

if 'id="meet-mini-dock"' not in html:
    if '</body>' in html:
        html = html.replace('</body>', mini_dock_html + '\n</body>')
        print('[SUCCESS] Inserted #meet-mini-dock before </body>')
    else:
        print('[ERROR] Could not find </body>')
        sys.exit(1)
else:
    print('[INFO] #meet-mini-dock already present')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('[COMPLETE] index.html updated successfully with Meet Stage structure!')
