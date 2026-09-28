/**
 * UniCord Study Whiteboard (Discord Activity)
 * Interactive collaborative canvas for campus study groups, flowcharts, formulas, and diagrams.
 */

class WhiteboardEngine {
  constructor() {
    this.isOpen = false;
    this.tool = 'pen'; // 'pen', 'highlighter', 'rect', 'circle', 'arrow', 'text', 'sticky', 'eraser'
    this.color = '#5865F2';
    this.strokeSize = 4;
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.lastX = 0;
    this.lastY = 0;
    
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = 30;

    this.canvas = null;
    this.ctx = null;
    this.container = null;
    this.stickiesContainer = null;
    this.draggedSticky = null;
    this.dragOffset = { x: 0, y: 0 };
    this.snapshot = null;

    this.stickyColors = ['yellow', 'cyan', 'pink', 'green'];
    this.stickyColorIdx = 0;
  }

  init() {
    this.canvas = document.getElementById('study-whiteboard-canvas');
    if (!this.canvas || !this.canvas.getContext) return;

    this.ctx = this.canvas.getContext('2d');
    this.container = document.getElementById('modal-study-whiteboard');
    this.stickiesContainer = document.getElementById('whiteboard-stickies-container');

    this.setupEventListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => {
      if (this.isOpen) this.resizeCanvas(true);
    });
  }

  open() {
    if (!this.container) this.init();
    if (!this.container) return;

    this.isOpen = true;
    this.container.style.display = 'flex';

    // Update active channel name in header
    const ch = window.stateManager ? window.stateManager.getCurrentChannel() : null;
    const chTag = document.getElementById('wb-channel-tag');
    if (chTag && ch) {
      chTag.textContent = `#${ch.name}`;
    }

    // Resize canvas to fill container accurately
    setTimeout(() => {
      this.resizeCanvas();
      if (this.undoStack.length === 0) {
        this.loadTemplate('blank');
      }
    }, 50);
  }

  close() {
    if (!this.container) return;
    this.isOpen = false;
    this.container.style.display = 'none';
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }

  resizeCanvas(preserveContent = false) {
    if (!this.canvas || !this.ctx) return;
    const body = document.querySelector('.whiteboard-body');
    if (!body) return;

    const rect = body.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    let savedData = null;
    if (preserveContent && this.canvas.width > 0 && this.canvas.height > 0) {
      try {
        savedData = this.canvas.toDataURL();
      } catch (e) {}
    }

    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = rect.width * dpr;
    this.canvas.height = rect.height * dpr;
    this.canvas.style.width = `${rect.width}px`;
    this.canvas.style.height = `${rect.height}px`;

    this.ctx.scale(dpr, dpr);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (savedData) {
      const img = new Image();
      img.onload = () => {
        this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = savedData;
    }
  }

  pushState() {
    if (!this.canvas || !this.canvas.getContext) return;
    try {
      if (this.undoStack.length >= this.maxHistory) {
        this.undoStack.shift();
      }
      this.undoStack.push(this.canvas.toDataURL());
      this.redoStack = []; // clear redo on new action
    } catch (e) {
      console.warn('Canvas save state warning:', e);
    }
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    const prevState = this.undoStack[this.undoStack.length - 1];
    this.restoreState(prevState);
  }

  redo() {
    if (this.redoStack.length === 0) return;
    const nextState = this.redoStack.pop();
    this.undoStack.push(nextState);
    this.restoreState(nextState);
  }

  restoreState(dataUrl) {
    if (!dataUrl || !this.ctx) return;
    const img = new Image();
    img.onload = () => {
      const body = document.querySelector('.whiteboard-body');
      const rect = body ? body.getBoundingClientRect() : { width: this.canvas.width, height: this.canvas.height };
      this.ctx.clearRect(0, 0, rect.width, rect.height);
      this.ctx.drawImage(img, 0, 0, rect.width, rect.height);
    };
    img.src = dataUrl;
  }

  clearCanvas() {
    if (!this.ctx || !this.canvas) return;
    const body = document.querySelector('.whiteboard-body');
    const rect = body ? body.getBoundingClientRect() : { width: this.canvas.width, height: this.canvas.height };
    this.ctx.clearRect(0, 0, rect.width, rect.height);

    // Also clear stickies
    if (this.stickiesContainer) {
      this.stickiesContainer.innerHTML = '';
    }

    this.pushState();
    this.showToast('🗑️ Canvas cleared');
  }

  getPointerPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  setupEventListeners() {
    if (!this.canvas || !this.canvas.getContext) return;

    // Pointer events on canvas
    const handleDown = (e) => {
      if (!this.isOpen) return;
      const pos = this.getPointerPos(e);
      this.startX = pos.x;
      this.startY = pos.y;
      this.lastX = pos.x;
      this.lastY = pos.y;
      this.isDrawing = true;

      if (this.tool === 'text') {
        this.isDrawing = false;
        this.openTextInput(pos.x, pos.y);
        return;
      }

      if (this.tool === 'sticky') {
        this.isDrawing = false;
        this.createStickyNote(pos.x, pos.y);
        return;
      }

      if (['rect', 'circle', 'arrow'].includes(this.tool)) {
        // Save snapshot for shape drag preview
        this.snapshot = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      } else {
        // Pen / Highlighter / Eraser start stroke
        this.drawStroke(pos.x, pos.y, true);
      }
    };

    const handleMove = (e) => {
      if (!this.isDrawing || !this.isOpen) return;
      e.preventDefault();
      const pos = this.getPointerPos(e);

      if (['rect', 'circle', 'arrow'].includes(this.tool)) {
        if (this.snapshot) {
          this.ctx.putImageData(this.snapshot, 0, 0);
        }
        this.drawShapePreview(pos.x, pos.y);
      } else {
        this.drawStroke(pos.x, pos.y, false);
      }

      this.lastX = pos.x;
      this.lastY = pos.y;
    };

    const handleUp = (e) => {
      if (!this.isDrawing || !this.isOpen) return;
      this.isDrawing = false;

      if (['rect', 'circle', 'arrow'].includes(this.tool)) {
        const pos = this.getPointerPos(e);
        if (this.snapshot) {
          this.ctx.putImageData(this.snapshot, 0, 0);
        }
        this.drawShapeCommit(pos.x, pos.y);
        this.snapshot = null;
      }

      this.pushState();
    };

    // Mouse bindings
    this.canvas.addEventListener('mousedown', handleDown);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    // Touch bindings for mobile/tablet/tablets with stylus
    this.canvas.addEventListener('touchstart', handleDown, { passive: false });
    window.addEventListener('touchmove', handleMove, { passive: false });
    window.addEventListener('touchend', handleUp, { passive: false });

    // Toolbar Tool Selection
    const toolBtns = document.querySelectorAll('.wb-tool-btn[data-tool]');
    toolBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        toolBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.tool = btn.dataset.tool;

        // Update cursor style
        const body = document.querySelector('.whiteboard-body');
        if (body) {
          if (this.tool === 'text') body.style.cursor = 'text';
          else if (this.tool === 'sticky') body.style.cursor = 'cell';
          else body.style.cursor = 'crosshair';
        }
      });
    });

    // Color Swatches
    const swatches = document.querySelectorAll('.wb-color-swatch[data-color]');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
        this.color = swatch.dataset.color;
      });
    });

    // Stroke Size Buttons
    const sizeBtns = document.querySelectorAll('.wb-size-btn[data-size]');
    sizeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        sizeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const size = btn.dataset.size;
        this.strokeSize = size === 'thin' ? 2 : size === 'medium' ? 5 : 12;
      });
    });

    // Undo / Redo / Clear / Export / Post
    const btnUndo = document.getElementById('wb-btn-undo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.undo());

    const btnRedo = document.getElementById('wb-btn-redo');
    if (btnRedo) btnRedo.addEventListener('click', () => this.redo());

    const btnClear = document.getElementById('wb-btn-clear');
    if (btnClear) btnClear.addEventListener('click', () => this.clearCanvas());

    const btnExport = document.getElementById('wb-btn-export');
    if (btnExport) btnExport.addEventListener('click', () => this.exportImage());

    const btnPostChat = document.getElementById('wb-btn-post-chat');
    if (btnPostChat) btnPostChat.addEventListener('click', () => this.postToChat());

    const btnClose = document.getElementById('wb-btn-close');
    if (btnClose) btnClose.addEventListener('click', () => this.close());

    // Template Selector Pills
    const templatePills = document.querySelectorAll('.wb-template-pill[data-template]');
    templatePills.forEach(pill => {
      pill.addEventListener('click', () => {
        templatePills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.loadTemplate(pill.dataset.template);
      });
    });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) this.redo();
        else this.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        this.redo();
        return;
      }
      if (e.key === 'Escape') {
        this.close();
        return;
      }

      // Quick tool hotkeys
      const hotkeys = {
        'p': 'pen',
        'h': 'highlighter',
        'e': 'eraser',
        'r': 'rect',
        'c': 'circle',
        'a': 'arrow',
        't': 'text',
        's': 'sticky'
      };
      if (hotkeys[e.key.toLowerCase()]) {
        const targetTool = hotkeys[e.key.toLowerCase()];
        const btn = document.querySelector(`.wb-tool-btn[data-tool="${targetTool}"]`);
        if (btn) btn.click();
      }
    });

    // Sticky Note Dragging
    window.addEventListener('mousemove', (e) => {
      if (!this.draggedSticky) return;
      e.preventDefault();
      const body = document.querySelector('.whiteboard-body');
      const rect = body.getBoundingClientRect();
      const x = e.clientX - rect.left - this.dragOffset.x;
      const y = e.clientY - rect.top - this.dragOffset.y;
      this.draggedSticky.style.left = `${Math.max(0, Math.min(rect.width - 200, x))}px`;
      this.draggedSticky.style.top = `${Math.max(0, Math.min(rect.height - 150, y))}px`;
    });

    window.addEventListener('mouseup', () => {
      if (this.draggedSticky) {
        this.draggedSticky = null;
      }
    });
  }

  drawStroke(x, y, isStart) {
    this.ctx.save();

    if (this.tool === 'highlighter') {
      this.ctx.globalAlpha = 0.35;
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = Math.max(16, this.strokeSize * 4);
    } else if (this.tool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.lineWidth = Math.max(24, this.strokeSize * 5);
    } else {
      // Pen
      this.ctx.strokeStyle = this.color;
      this.ctx.lineWidth = this.strokeSize;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastX, this.lastY);
    this.ctx.lineTo(x, y);
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawShapePreview(x, y) {
    this.ctx.save();
    this.ctx.strokeStyle = this.color;
    this.ctx.lineWidth = this.strokeSize;

    if (this.tool === 'rect') {
      this.ctx.strokeRect(this.startX, this.startY, x - this.startX, y - this.startY);
    } else if (this.tool === 'circle') {
      const radiusX = Math.abs(x - this.startX) / 2;
      const radiusY = Math.abs(y - this.startY) / 2;
      const centerX = Math.min(this.startX, x) + radiusX;
      const centerY = Math.min(this.startY, y) + radiusY;
      this.ctx.beginPath();
      this.ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (this.tool === 'arrow') {
      this.drawArrow(this.startX, this.startY, x, y);
    }

    this.ctx.restore();
  }

  drawShapeCommit(x, y) {
    this.drawShapePreview(x, y);
  }

  drawArrow(fromX, fromY, toX, toY) {
    const headlen = Math.max(12, this.strokeSize * 3);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    // Stem
    this.ctx.beginPath();
    this.ctx.moveTo(fromX, fromY);
    this.ctx.lineTo(toX, toY);
    this.ctx.stroke();

    // Arrowhead wings
    this.ctx.beginPath();
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    this.ctx.moveTo(toX, toY);
    this.ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    this.ctx.stroke();
  }

  openTextInput(x, y) {
    const body = document.querySelector('.whiteboard-body');
    if (!body) return;

    // Remove any existing input
    const existing = document.querySelector('.wb-text-overlay-input');
    if (existing) existing.remove();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'wb-text-overlay-input';
    input.style.left = `${x}px`;
    input.style.top = `${y - 14}px`;
    input.style.color = this.color;
    input.placeholder = 'Type note & hit Enter...';
    body.appendChild(input);

    input.focus();

    const commitText = () => {
      const text = input.value.trim();
      if (text) {
        this.ctx.save();
        this.ctx.fillStyle = this.color;
        this.ctx.font = `600 ${Math.max(16, this.strokeSize * 4)}px "gg sans", -apple-system, sans-serif`;
        this.ctx.fillText(text, x, y + 6);
        this.ctx.restore();
        this.pushState();
      }
      input.remove();
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commitText();
      } else if (e.key === 'Escape') {
        input.remove();
      }
    });

    input.addEventListener('blur', commitText);
  }

  createStickyNote(x, y, content = '💡 Key concept or exam reminder...') {
    if (!this.stickiesContainer) return;

    const colorClass = `wb-sticky-${this.stickyColors[this.stickyColorIdx % this.stickyColors.length]}`;
    this.stickyColorIdx++;

    const note = document.createElement('div');
    note.className = `wb-sticky-note ${colorClass}`;
    note.style.left = `${Math.max(20, x)}px`;
    note.style.top = `${Math.max(20, y)}px`;

    const user = window.stateManager ? window.stateManager.state.currentUser : null;
    const authorName = user ? user.name.split(' ')[0] : 'STUDENT';

    note.innerHTML = `
      <div class="wb-sticky-header">
        <span>📌 ${authorName}</span>
        <button class="wb-sticky-delete" title="Delete note">✕</button>
      </div>
      <div class="wb-sticky-text" contenteditable="true">${content}</div>
    `;

    // Delete handler
    note.querySelector('.wb-sticky-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      note.remove();
    });

    // Drag start
    note.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('wb-sticky-text') || e.target.classList.contains('wb-sticky-delete')) return;
      this.draggedSticky = note;
      const rect = note.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    });

    this.stickiesContainer.appendChild(note);
    this.showToast('📝 Sticky note added');
  }

  loadTemplate(templateName) {
    if (!this.ctx || !this.canvas) return;
    const body = document.querySelector('.whiteboard-body');
    const rect = body ? body.getBoundingClientRect() : { width: this.canvas.width, height: this.canvas.height };

    this.ctx.clearRect(0, 0, rect.width, rect.height);
    if (this.stickiesContainer) this.stickiesContainer.innerHTML = '';

    if (templateName === 'blank') {
      this.pushState();
      return;
    }

    if (templateName === 'flowchart') {
      // Draw CS Architecture / Flowchart starter
      this.ctx.save();
      this.ctx.lineWidth = 3;

      const drawBox = (bx, by, bw, bh, text, strokeCol) => {
        this.ctx.strokeStyle = strokeCol;
        this.ctx.fillStyle = '#2b2d31';
        this.ctx.strokeRect(bx, by, bw, bh);
        this.ctx.fillRect(bx, by, bw, bh);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '600 14px "gg sans", sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(text, bx + bw / 2, by + bh / 2);
      };

      const centerY = rect.height / 2 - 40;
      const bW = 200;
      const bH = 70;

      // Box 1: Client
      drawBox(80, centerY, bW, bH, '📱 Student Client (Web)', '#5865f2');

      // Arrow 1 -> 2
      this.ctx.strokeStyle = '#949ba4';
      this.ctx.lineWidth = 3;
      this.drawArrow(280, centerY + 35, 380, centerY + 35);

      // Box 2: Server
      drawBox(380, centerY, bW, bH, '⚡ UniCord Engine (MQTT)', '#23a55a');

      // Arrow 2 -> 3
      this.drawArrow(580, centerY + 35, 680, centerY + 35);

      // Box 3: Audio & Canvas
      drawBox(680, centerY, bW, bH, '🎨 Study Whiteboard & Voice', '#eb459e');

      this.ctx.restore();
      this.createStickyNote(rect.width - 240, 60, '💡 Tip: Connect your components with the Arrow tool (A)');
    } else if (templateName === 'math') {
      // Cartesian Coordinate Plane & Formula
      this.ctx.save();
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      // Grid lines
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      this.ctx.lineWidth = 1;
      for (let x = 0; x < rect.width; x += 40) {
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, rect.height);
        this.ctx.stroke();
      }
      for (let y = 0; y < rect.height; y += 40) {
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(rect.width, y);
        this.ctx.stroke();
      }

      // X & Y Axes
      this.ctx.strokeStyle = '#00d2ff';
      this.ctx.lineWidth = 3;
      this.drawArrow(60, cy, rect.width - 60, cy);
      this.drawArrow(cx, rect.height - 60, cx, 60);

      // Axis labels
      this.ctx.fillStyle = '#00d2ff';
      this.ctx.font = '700 16px "gg sans", sans-serif';
      this.ctx.fillText('X', rect.width - 45, cy + 5);
      this.ctx.fillText('Y', cx - 5, 45);

      // Parabola Curve
      this.ctx.strokeStyle = '#fee75c';
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      for (let px = -200; px <= 200; px += 5) {
        const py = -(0.01 * px * px);
        if (px === -200) this.ctx.moveTo(cx + px, cy + py);
        else this.ctx.lineTo(cx + px, cy + py);
      }
      this.ctx.stroke();

      // Formula text
      this.ctx.fillStyle = '#fee75c';
      this.ctx.font = '700 16px "gg sans", sans-serif';
      this.ctx.fillText('f(x) = ax² + bx + c', cx + 60, cy - 80);

      this.ctx.restore();
      this.createStickyNote(60, 60, '📐 Calculus & Coordinate Geometry Template loaded!');
    } else if (templateName === 'brainstorm') {
      // 3 Brainstorm Sticky Notes
      this.createStickyNote(100, 100, '🚀 Hackathon Project:\nAI Lecture Notes & Realtime Whiteboard');
      this.createStickyNote(360, 120, '📅 Team Sprint:\nDesign Review this Thursday at 5:00 PM');
      this.createStickyNote(620, 100, '📚 Chapter 4 & 5 Practice Questions uploaded to #notes-and-pyqs');
    }

    this.pushState();
    this.showToast(`📋 Template "${templateName}" loaded!`);
  }

  // Combine canvas drawing + sticky notes into a final data URL
  getMergedCanvasDataUrl() {
    const body = document.querySelector('.whiteboard-body');
    const rect = body ? body.getBoundingClientRect() : { width: 1200, height: 700 };

    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = rect.width;
    exportCanvas.height = rect.height;
    const expCtx = exportCanvas.getContext('2d');

    // Fill dark background
    expCtx.fillStyle = '#1e1f22';
    expCtx.fillRect(0, 0, rect.width, rect.height);

    // Draw grid dots
    expCtx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 0; x < rect.width; x += 24) {
      for (let y = 0; y < rect.height; y += 24) {
        expCtx.beginPath();
        expCtx.arc(x, y, 1.2, 0, Math.PI * 2);
        expCtx.fill();
      }
    }

    // Draw main drawing canvas
    expCtx.drawImage(this.canvas, 0, 0, rect.width, rect.height);

    // Render stickies on export
    const notes = document.querySelectorAll('.wb-sticky-note');
    notes.forEach(note => {
      const nRect = note.getBoundingClientRect();
      const bRect = body.getBoundingClientRect();
      const nx = nRect.left - bRect.left;
      const ny = nRect.top - bRect.top;
      const nw = nRect.width;
      const nh = nRect.height;

      // Note background
      expCtx.save();
      expCtx.fillStyle = note.classList.contains('wb-sticky-yellow') ? '#fee75c' :
                         note.classList.contains('wb-sticky-cyan')   ? '#79e2ff' :
                         note.classList.contains('wb-sticky-pink')   ? '#ff9ee2' : '#a3f7bf';
      expCtx.fillRect(nx, ny, nw, nh);

      // Top colored bar
      expCtx.fillStyle = 'rgba(0,0,0,0.15)';
      expCtx.fillRect(nx, ny, nw, 6);

      // Note text
      const textElem = note.querySelector('.wb-sticky-text');
      const text = textElem ? textElem.innerText : '';
      expCtx.fillStyle = '#1e1f22';
      expCtx.font = '500 13px "gg sans", sans-serif';
      
      const words = text.split(' ');
      let line = '';
      let lineY = ny + 28;
      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (expCtx.measureText(testLine).width > nw - 20 && n > 0) {
          expCtx.fillText(line, nx + 10, lineY);
          line = words[n] + ' ';
          lineY += 18;
        } else {
          line = testLine;
        }
      }
      expCtx.fillText(line, nx + 10, lineY);
      expCtx.restore();
    });

    // UniCord Watermark badge
    expCtx.save();
    expCtx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    expCtx.font = '700 11px "gg sans", sans-serif';
    expCtx.fillText('UniCord Study Whiteboard Activity', 16, rect.height - 14);
    expCtx.restore();

    return exportCanvas.toDataURL('image/png');
  }

  exportImage() {
    const dataUrl = this.getMergedCanvasDataUrl();
    const link = document.createElement('a');
    link.download = `UniCord-StudyWhiteboard-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
    this.showToast('💾 Exported as PNG to your downloads!');
  }

  postToChat() {
    const dataUrl = this.getMergedCanvasDataUrl();
    const ch = window.stateManager ? window.stateManager.getCurrentChannel() : null;
    if (!ch) {
      this.showToast('⚠️ No channel active');
      return;
    }

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
      content: '🎨 Shared a live drawing from **Study Whiteboard**:',
      attachment: {
        name: `Whiteboard-Drawing-${Date.now().toString().slice(-4)}.png`,
        size: '180 KB',
        type: 'image/png',
        isImage: true,
        url: dataUrl
      }
    };

    window.stateManager.addMessage(ch.id, newMsg);
    if (window.uiController) window.uiController.renderMessages();

    // Broadcast across devices
    if (window.networkEngine) {
      window.networkEngine.broadcastChatMessage(ch.id, newMsg);
    }

    this.showToast(`✅ Posted whiteboard to #${ch.name}!`);
    setTimeout(() => {
      this.close();
    }, 600);
  }

  showToast(message) {
    const existing = document.querySelector('.wb-toast-message');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'wb-toast-message';
    toast.innerHTML = `<span>${message}</span>`;

    const body = document.querySelector('.whiteboard-container');
    if (body) {
      body.appendChild(toast);
      setTimeout(() => {
        toast.remove();
      }, 2500);
    }
  }
}

// Global instance
window.whiteboardEngine = new WhiteboardEngine();
