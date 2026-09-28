import sys

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# 1. Add #btn-open-whiteboard in nav-right if not present
wb_button = '''          <button class="nav-icon-btn" id="btn-open-whiteboard" data-tooltip="Study Whiteboard (Activity)">
            <svg viewBox="0 0 24 24" width="22" height="22">
              <path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </button>
'''

if 'id="btn-open-whiteboard"' not in html:
    target_btn = '<button class="nav-icon-btn" id="btn-toggle-soundboard"'
    if target_btn in html:
        html = html.replace(target_btn, wb_button + target_btn)
        print('[SUCCESS] Inserted #btn-open-whiteboard into nav-right')
    else:
        print('[ERROR] Could not find #btn-toggle-soundboard in index.html')
        sys.exit(1)
else:
    print('[INFO] #btn-open-whiteboard already present in index.html')

# 2. Add Whiteboard Activity Modal markup before modal-image-lightbox
wb_modal = '''  <!-- Study Whiteboard Modal (Discord Activity) -->
  <div id="modal-study-whiteboard" class="whiteboard-modal-overlay" style="display: none;">
    <div class="whiteboard-container">
      <!-- Header -->
      <div class="whiteboard-header">
        <div class="whiteboard-title-group">
          <div class="whiteboard-badge">
            <svg viewBox="0 0 24 24" width="12" height="12"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ACTIVITY
          </div>
          <div class="whiteboard-title">
            <span>🎨 UniCord Study Whiteboard</span>
            <span class="whiteboard-channel-tag" id="wb-channel-tag">#general</span>
          </div>
          <div class="whiteboard-collab-avatars">
            <div class="wb-collab-avatar" style="background-color: #5865f2;">YOU</div>
            <div class="wb-collab-avatar" style="background-color: #23a55a;">PR</div>
            <div class="wb-collab-avatar" style="background-color: #f0b232;">RH</div>
          </div>
          <span class="wb-collab-label">Live Board</span>
        </div>

        <div class="whiteboard-actions">
          <button id="wb-btn-post-chat" class="wb-btn wb-btn-primary" title="Post this drawing to the current chat channel">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            Post to Chat
          </button>
          <button id="wb-btn-export" class="wb-btn wb-btn-secondary" title="Export as PNG">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
            Export PNG
          </button>
          <button id="wb-btn-clear" class="wb-btn wb-btn-danger" title="Clear Canvas">
            <svg viewBox="0 0 24 24" width="16" height="16"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            Clear
          </button>
          <button id="wb-btn-close" class="wb-btn-close" title="Close Whiteboard">✕</button>
        </div>
      </div>

      <!-- Main Canvas Viewport -->
      <div class="whiteboard-body">
        <!-- Template Selection Bar -->
        <div class="wb-templates-bar">
          <span class="wb-template-label">Templates:</span>
          <button class="wb-template-pill active" data-template="blank">Blank</button>
          <button class="wb-template-pill" data-template="flowchart">CS Flowchart</button>
          <button class="wb-template-pill" data-template="math">Math & Graph</button>
          <button class="wb-template-pill" data-template="brainstorm">Sticky Notes</button>
        </div>

        <!-- Sticky Notes Layer -->
        <div id="whiteboard-stickies-container" class="wb-stickies-container"></div>

        <!-- HTML5 Drawing Canvas -->
        <canvas id="study-whiteboard-canvas"></canvas>

        <!-- Floating Bottom Dock Toolbar -->
        <div class="whiteboard-floating-toolbar">
          <!-- Tools -->
          <div class="wb-tool-group">
            <button class="wb-tool-btn active" data-tool="pen" title="Pen (P)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="highlighter" title="Highlighter (H)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.24 3.01l4.75 4.75-10.74 10.74-4.75-4.75 10.74-10.74zM4.75 19.25l-2.25 2.25 4.5 0 2.25-2.25-4.5 0z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="rect" title="Rectangle (R)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M3 3v18h18V3H3zm16 16H5V5h14v14z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="circle" title="Circle (C)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="arrow" title="Arrow / Line (A)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M16.01 11H4v2h12.01v3L20 12l-3.99-4v3z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="text" title="Text Note (T)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M5 4v3h5.5v12h3V7H19V4H5z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="sticky" title="Sticky Note (S)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h10l6-6V5c0-1.1-.9-2-2-2zm-5 16H5V5h14v9h-5v5z"/></svg>
            </button>
            <button class="wb-tool-btn" data-tool="eraser" title="Eraser (E)">
              <svg viewBox="0 0 24 24" width="20" height="20"><path fill="currentColor" d="M15.14 3c-.76 0-1.53.3-2.12.88L3.88 13.02a3 3 0 0 0 0 4.24l2.86 2.86A3 3 0 0 0 8.86 21h10.14v-2H11.7l6.56-6.56a3 3 0 0 0 0-4.24l-1-1A3 3 0 0 0 15.14 3z"/></svg>
            </button>
          </div>

          <div class="wb-toolbar-divider"></div>

          <!-- Color Swatches -->
          <div class="wb-color-group">
            <div class="wb-color-swatch active" data-color="#5865F2" style="background-color: #5865F2;" title="Blurple"></div>
            <div class="wb-color-swatch" data-color="#FFFFFF" style="background-color: #FFFFFF;" title="White"></div>
            <div class="wb-color-swatch" data-color="#00D2FF" style="background-color: #00D2FF;" title="Neon Cyan"></div>
            <div class="wb-color-swatch" data-color="#23A55A" style="background-color: #23A55A;" title="Emerald Green"></div>
            <div class="wb-color-swatch" data-color="#FEE75C" style="background-color: #FEE75C;" title="Electric Yellow"></div>
            <div class="wb-color-swatch" data-color="#EB459E" style="background-color: #EB459E;" title="Hot Pink"></div>
            <div class="wb-color-swatch" data-color="#ED4245" style="background-color: #ED4245;" title="Coral Red"></div>
          </div>

          <div class="wb-toolbar-divider"></div>

          <!-- Stroke Size -->
          <div class="wb-size-group">
            <button class="wb-size-btn wb-size-thin active" data-size="thin" title="Fine Stroke">
              <div class="wb-size-dot"></div>
            </button>
            <button class="wb-size-btn wb-size-medium" data-size="medium" title="Medium Stroke">
              <div class="wb-size-dot"></div>
            </button>
            <button class="wb-size-btn wb-size-thick" data-size="thick" title="Thick Stroke">
              <div class="wb-size-dot"></div>
            </button>
          </div>

          <div class="wb-toolbar-divider"></div>

          <!-- Undo / Redo -->
          <div class="wb-tool-group">
            <button id="wb-btn-undo" class="wb-tool-btn" title="Undo (Ctrl+Z)">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>
            </button>
            <button id="wb-btn-redo" class="wb-tool-btn" title="Redo (Ctrl+Y)">
              <svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
'''

if 'id="modal-study-whiteboard"' not in html:
    target_modal = '<!-- IMAGE LIGHTBOX MODAL -->'
    if target_modal in html:
        html = html.replace(target_modal, wb_modal + '\n' + target_modal)
        print('[SUCCESS] Inserted #modal-study-whiteboard before image lightbox')
    else:
        print('[ERROR] Could not find <!-- IMAGE LIGHTBOX MODAL --> in index.html')
        sys.exit(1)
else:
    print('[INFO] #modal-study-whiteboard already present in index.html')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('[COMPLETE] index.html updated!')
