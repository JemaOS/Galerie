/*
 * Copyright (C) 2025 Jema Technology
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * Handles annotation/drawing functionality
 */
class AnnotationManager {
  constructor(uiController) {
    this.uiController = uiController;
    this.isActive = false;
    
    // Pages Map: id -> { canvas, ctx, id, container }
    this.pages = new Map();
    
    // Persistence
    this.savedContent = new Map(); // id -> HTMLCanvasElement (snapshot)
    this.savedText = new Map(); // id -> Array of text states
    
    // State
    this.currentTool = 'pen'; // pen, marker, eraser, text
    this.currentColor = '#ef5350'; // Default red
    
    // Tool specific sizes
    this.toolSizes = {
        pen: 4,
        marker: 10,
        eraser: 30
    };
    this.currentSize = this.toolSizes['pen'];
    
    this.currentFont = 'Roboto';
    this.currentFontSize = 14;
    this.isBold = false;
    this.isItalic = false;
    this.textAlign = 'left';
    this.isDrawing = false;
    this.lastPoint = null;
    this.activeInput = null; // For text tool
    this.textWrappers = []; // Store active text objects (DOM elements)
    
    // History
    this.history = [];
    this.historyStep = -1;
    this.tempState = null; // To store state before drawing
    
    // UI Elements
    this.propertiesContainer = null;
    this.cursorElement = null;
    
    // Bind methods
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.handlePointerEnter = this.handlePointerEnter.bind(this);
    this.handlePointerLeave = this.handlePointerLeave.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleDocumentMouseDown = this.handleDocumentMouseDown.bind(this);
    this.renderLoop = this.renderLoop.bind(this);
  }

  /**
   * Initialize annotation mode
   * @param {Array|HTMLElement} targets - Array of {id, container, target} OR single container
   * @param {HTMLElement} [target] - Target element (if first arg is container)
   * @param {Object} options - Options including propertiesContainer
   */
  start(targets, target, options = {}) {
    if (this.isActive) return;
    
    this.options = options;

    let items = [];
    if (Array.isArray(targets)) {
        items = targets;
    } else {
        items = [{ container: targets, target: target, id: 'default' }];
    }
    
    this.isActive = true;
    this.pages.clear();
    this.savedContent.clear();
    this.savedText.clear();
    this.history = [];
    this.historyStep = -1;
    this.textWrappers = [];
    
    items.forEach(item => {
        this.addPage(item.id || 'default', item.container, item.target);
    });

    if (this.options.propertiesContainer) {
        if (this.propertiesContainer === this.options.propertiesContainer) {
            this.updatePropertiesVisibility();
        } else {
            this.renderProperties(this.options.propertiesContainer);
    }

    this.createCursor();
    this.setupGlobalListeners();
    
    console.log('Annotation mode started');
  }

  addPage(id, container, target) {
      if (this.pages.has(id)) return;
      
      const canvas = this.createCanvas(container, target);
      
      const page = { canvas, ctx: canvas.getContext('2d'), id, container };
      this.pages.set(id, page);
      
      // Replay history
      this.redrawPage(id);
      
      // Attach listeners to canvas
      this.attachCanvasListeners(canvas);
      
      // Apply tool cursor
      this.updateCursorStyle(canvas);
      
      // Restore text wrappers
      if (this.savedText.has(id)) {
          const texts = this.savedText.get(id);
          texts.forEach(state => {
              this.restoreTextWrapper(state, page);
          });
      }
  }

  removePage(id) {
      if (!this.pages.has(id)) return;
      
      const page = this.pages.get(id);
      
      // Detach listeners
      this.detachCanvasListeners(page.canvas);

      // Save text wrappers
      const pageTexts = this.textWrappers.filter(w => w.parentElement === page.container);
      const textStates = pageTexts.map(w => this.serializeTextWrapper(w));
      this.savedText.set(id, textStates);
      
      // Remove text wrappers from DOM and list
      pageTexts.forEach(w => {
          if (this.activeWrapper === w) {
              this.deselectText(w);
          }
          w.remove();
          const idx = this.textWrappers.indexOf(w);
          if (idx > -1) this.textWrappers.splice(idx, 1);
      });
      
      // Remove canvas
      page.canvas.remove();
      this.pages.delete(id);
  }

  /**
   * Pause annotation mode (hide UI, disable interaction, keep state)
   */
  pause() {
      this.isActive = false;
      this.pages.forEach(p => p.canvas.style.pointerEvents = 'none');
      if (this.cursorElement) this.cursorElement.classList.add('hidden');
      if (this.propertiesContainer) this.propertiesContainer.classList.add('hidden');
  }

  /**
   * Resume annotation mode
   */
  resume() {
      this.isActive = true;
      this.pages.forEach(p => p.canvas.style.pointerEvents = 'auto');
      if (this.propertiesContainer) this.propertiesContainer.classList.remove('hidden');
  }

  /**
   * Check if initialized
   */
  hasCanvas() {
      return this.pages.size > 0;
  }

  /**
   * Stop annotation mode
   */
  stop(keepUI = false) {
    if (!this.isActive && this.pages.size === 0) return;
    
    this.isActive = false;
    
    this.cancelTextInput();
    this.removeGlobalListeners();
    
    if (!keepUI && this.propertiesContainer) {
        this.propertiesContainer.innerHTML = '';
        this.propertiesContainer = null;
    }
    
    this.destroy();
  }
  
  destroy() {
      this.cancelTextInput();
      if (this.cursorElement) {
          this.cursorElement.remove();
          this.cursorElement = null;
      }
      this.pages.forEach(p => p.canvas.remove());
      this.pages.clear();
      this.savedContent.clear();
      this.savedText.clear();
      this.textWrappers = [];
      this.isActive = false;
  }

  createCursor() {
      if (this.cursorElement) return;
      
      this.cursorElement = document.createElement('div');
      this.cursorElement.className = 'eraser-cursor hidden';
      this.cursorElement.style.position = 'fixed';
      this.cursorElement.style.pointerEvents = 'none';
      this.cursorElement.style.border = '2px dashed #000';
      this.cursorElement.style.boxShadow = '0 0 0 2px rgba(255, 255, 255, 0.5)';
      this.cursorElement.style.borderRadius = '50%';
      this.cursorElement.style.zIndex = '9999';
      this.cursorElement.style.transform = 'translate(-50%, -50%)';
      
      document.body.appendChild(this.cursorElement);
  }

  updateCursor(x, y) {
      if (!this.cursorElement) return;
      this.cursorElement.style.left = `${x}px`;
      this.cursorElement.style.top = `${y}px`;
      this.cursorElement.style.width = `${this.currentSize * 2}px`;
      this.cursorElement.style.height = `${this.currentSize * 2}px`;
  }

  createCanvas(container, target) {
    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';
    this.updateCanvasSize(canvas, target);
    canvas.targetElement = target;
    container.appendChild(canvas);
    return canvas;
  }

  updateCanvasSize(canvas, target) {
    if (!target || !canvas) return;
    
    let width, height;
    
    if (target.tagName === 'IMG') {
      width = target.naturalWidth || target.width;
      height = target.naturalHeight || target.height;
      
      if (width === 0) width = target.clientWidth;
      if (height === 0) height = target.clientHeight;
      
      canvas.width = width;
      canvas.height = height;
      
      canvas.style.width = target.style.width || '100%';
      canvas.style.height = target.style.height || '100%';
      canvas.style.objectFit = getComputedStyle(target).objectFit;
      
    } else if (target.tagName === 'CANVAS') {
      width = target.width;
      height = target.height;
      
      canvas.width = width;
      canvas.height = height;
      
      canvas.style.width = target.style.width;
      canvas.style.height = target.style.height;
    }
  }

  renderProperties(container) {
    this.propertiesContainer = container;
    container.innerHTML = '';

    // --- Size Group ---
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'sidebar-group size-group';
    const sizeLabel = document.createElement('div');
    sizeLabel.className = 'group-label';
    sizeLabel.textContent = 'TAILLE';
    sizeGroup.appendChild(sizeLabel);
    const sizeOptions = document.createElement('div');
    sizeOptions.className = 'size-options';
    [1, 2, 4, 8, 16].forEach(size => {
        const btn = document.createElement('button');
        btn.className = `size-btn ${this.currentSize === size ? 'active' : ''}`;
        btn.dataset.size = size;
        btn.title = `${size}px`;
        btn.addEventListener('click', () => this.setSize(size));
        const line = document.createElement('div');
        line.className = 'size-shape';
        line.style.height = `${Math.max(2, size / 2)}px`;
        line.style.width = '24px';
        line.style.borderRadius = '2px';
        line.style.backgroundColor = 'currentColor';
        btn.appendChild(line);
        sizeOptions.appendChild(btn);
    });
    sizeGroup.appendChild(sizeOptions);
    container.appendChild(sizeGroup);

    // --- Text Options ---
    const textOptionsGroup = document.createElement('div');
    textOptionsGroup.className = 'text-options-group hidden';
    
    // Font
    const fontGroup = document.createElement('div');
    fontGroup.className = 'sidebar-group';
    const fontLabel = document.createElement('div');
    fontLabel.className = 'group-label';
    fontLabel.textContent = 'Police';
    fontGroup.appendChild(fontLabel);
    const fontControls = document.createElement('div');
    fontControls.className = 'font-controls';
    const fontFamilySelect = document.createElement('select');
    fontFamilySelect.className = 'font-family-select';
    ['Roboto', 'Arial', 'Times New Roman', 'Courier New'].forEach(font => {
        const option = document.createElement('option');
        option.value = font;
        option.textContent = font;
        if (font === this.currentFont) option.selected = true;
        fontFamilySelect.appendChild(option);
    });
    fontFamilySelect.addEventListener('change', (e) => {
        this.currentFont = e.target.value;
        this.updateActiveInputStyle();
    });
    fontControls.appendChild(fontFamilySelect);
    const fontSizeSelect = document.createElement('select');
    fontSizeSelect.className = 'font-size-select';
    [12, 14, 16, 18, 20, 24, 30, 36, 48].forEach(size => {
        const option = document.createElement('option');
        option.value = size;
        option.textContent = size;
        if (size === this.currentFontSize) option.selected = true;
        fontSizeSelect.appendChild(option);
    });
    fontSizeSelect.addEventListener('change', (e) => {
        this.currentFontSize = Number.parseInt(e.target.value);
        this.updateActiveInputStyle();
    });
    fontControls.appendChild(fontSizeSelect);
    fontGroup.appendChild(fontControls);
    textOptionsGroup.appendChild(fontGroup);

    // Styles
    const styleGroup = document.createElement('div');
    styleGroup.className = 'sidebar-group';
    const styleLabel = document.createElement('div');
    styleLabel.className = 'group-label';
    styleLabel.textContent = 'Styles';
    styleGroup.appendChild(styleLabel);
    const styleControls = document.createElement('div');
    styleControls.className = 'style-controls';
    const toggleGroup = document.createElement('div');
    toggleGroup.className = 'style-toggle-group';
    const boldBtn = document.createElement('button');
    boldBtn.className = `style-btn ${this.isBold ? 'active' : ''}`;
    boldBtn.innerHTML = '<i class="material-icons">format_bold</i>';
    boldBtn.addEventListener('click', () => {
        this.isBold = !this.isBold;
        boldBtn.classList.toggle('active');
        this.updateActiveInputStyle();
    });
    toggleGroup.appendChild(boldBtn);
    const italicBtn = document.createElement('button');
    italicBtn.className = `style-btn ${this.isItalic ? 'active' : ''}`;
    italicBtn.innerHTML = '<i class="material-icons">format_italic</i>';
    italicBtn.addEventListener('click', () => {
        this.isItalic = !this.isItalic;
        italicBtn.classList.toggle('active');
        this.updateActiveInputStyle();
    });
    toggleGroup.appendChild(italicBtn);
    styleControls.appendChild(toggleGroup);
    const alignGroup = document.createElement('div');
    alignGroup.className = 'style-toggle-group';
    [{ id: 'left', icon: 'format_align_left' }, { id: 'center', icon: 'format_align_center' }, { id: 'right', icon: 'format_align_right' }, { id: 'justify', icon: 'format_align_justify' }].forEach(align => {
        const btn = document.createElement('button');
        btn.className = `style-btn ${this.textAlign === align.id ? 'active' : ''}`;
        btn.dataset.align = align.id;
        btn.innerHTML = `<i class="material-icons">${align.icon}</i>`;
        btn.addEventListener('click', () => {
            this.textAlign = align.id;
            alignGroup.querySelectorAll('.style-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.updateActiveInputStyle();
        });
        alignGroup.appendChild(btn);
    });
    styleControls.appendChild(alignGroup);
    styleGroup.appendChild(styleControls);
    textOptionsGroup.appendChild(styleGroup);

    // Text Color
    const textColorGroup = document.createElement('div');
    textColorGroup.className = 'sidebar-group';
    const textColorLabel = document.createElement('div');
    textColorLabel.className = 'group-label';
    textColorLabel.textContent = 'Couleur du texte';
    textColorGroup.appendChild(textColorLabel);
    const textColorGrid = document.createElement('div');
    textColorGrid.className = 'color-grid';
    const colors = ['#000000', '#3c4043', '#9aa0a6', '#dadce0', '#ffffff', '#ff8a80', '#ffff8d', '#ccff90', '#a7ffeb', '#d7ccc8', '#f44336', '#fdd835', '#4caf50', '#6569d0', '#795548', '#b71c1c', '#ff9800', '#1b5e20', '#1976d2', '#3e2723'];
    colors.forEach(color => {
        const btn = document.createElement('button');
        btn.className = `color-btn ${this.currentColor === color ? 'active' : ''}`;
        btn.dataset.color = color;
        btn.style.backgroundColor = color;
        btn.addEventListener('click', () => this.setColor(color));
        textColorGrid.appendChild(btn);
    });
    textColorGroup.appendChild(textColorGrid);
    textOptionsGroup.appendChild(textColorGroup);
    container.appendChild(textOptionsGroup);

    // --- Color Group ---
    const colorGroup = document.createElement('div');
    colorGroup.className = 'sidebar-group color-group';
    const colorLabel = document.createElement('div');
    colorLabel.className = 'group-label';
    colorLabel.textContent = 'COULEUR';
    colorGroup.appendChild(colorLabel);
    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';
    const finalColors = ['#000000', '#5f6368', '#bdc1c6', '#ffffff', '#ff8a80', '#ffff8d', '#ccff90', '#a7ffeb', '#f44336', '#fdd835', '#4caf50', '#6569d0', '#d32f2f', '#f57c00', '#388e3c', '#1976d2', '#c2185b', '#7b1fa2', '#512da8', '#3e2723'];
    finalColors.forEach(color => {
        const btn = document.createElement('button');
        btn.className = `color-btn ${this.currentColor === color ? 'active' : ''}`;
        btn.dataset.color = color;
        btn.style.backgroundColor = color;
        btn.addEventListener('click', () => this.setColor(color));
        colorGrid.appendChild(btn);
    });
    colorGroup.appendChild(colorGrid);
    container.appendChild(colorGroup);

    // --- Eraser Options ---
    const eraserOptionsGroup = document.createElement('div');
    eraserOptionsGroup.className = 'eraser-options-group hidden';
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Appliquer automatiquement';
    toggleContainer.appendChild(toggleLabel);
    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = true;
    toggleSwitch.appendChild(toggleInput);
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleSwitch.appendChild(toggleSlider);
    toggleContainer.appendChild(toggleSwitch);
    eraserOptionsGroup.appendChild(toggleContainer);
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'slider-container';
    const sliderHeader = document.createElement('div');
    sliderHeader.className = 'slider-header';
    const sliderLabel = document.createElement('div');
    sliderLabel.style.display = 'flex';
    sliderLabel.style.alignItems = 'center';
    sliderLabel.style.gap = '8px';
    sliderLabel.innerHTML = '<i class="material-icons" style="font-size: 18px;">radio_button_checked</i> Taille du pinceau';
    sliderHeader.appendChild(sliderLabel);
    const sliderValue = document.createElement('span');
    sliderValue.className = 'slider-value';
    sliderValue.textContent = this.currentSize;
    sliderHeader.appendChild(sliderValue);
    sliderContainer.appendChild(sliderHeader);
    const rangeSlider = document.createElement('input');
    rangeSlider.type = 'range';
    rangeSlider.className = 'range-slider';
    rangeSlider.min = '1';
    rangeSlider.max = '100';
    rangeSlider.value = this.currentSize;
    rangeSlider.addEventListener('input', (e) => {
        const size = Number.parseInt(e.target.value);
        this.setSize(size);
        sliderValue.textContent = size;
    });
    sliderContainer.appendChild(rangeSlider);
    eraserOptionsGroup.appendChild(sliderContainer);
    container.appendChild(eraserOptionsGroup);
    
    this.updatePropertiesVisibility();
  }

  setupGlobalListeners() {
    globalThis.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
  }

  removeGlobalListeners() {
    globalThis.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
  }

  attachCanvasListeners(canvas) {
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointerout', this.handlePointerUp);
    canvas.addEventListener('pointerenter', this.handlePointerEnter);
    canvas.addEventListener('pointerleave', this.handlePointerLeave);
  }

  detachCanvasListeners(canvas) {
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointerout', this.handlePointerUp);
    canvas.removeEventListener('pointerenter', this.handlePointerEnter);
    canvas.removeEventListener('pointerleave', this.handlePointerLeave);
  }

  handleDocumentMouseDown(e) {
      if (!this.isActive) return;
      if (e.target.closest('.text-input-wrapper')) return;
      if (e.target.classList.contains('annotation-canvas')) return;
      if (this.propertiesContainer?.contains(e.target)) return;
      if (e.target.closest('.pdf-toolbar') || e.target.closest('.viewer-toolbar')) return;
      if (e.target.closest('.context-menu')) return;
      if (this.activeWrapper) {
          this.deselectText(this.activeWrapper);
      }
  }

  handleKeyDown(e) {
      if (!this.isActive) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.activeWrapper?.classList.contains('selected')) {
              if (document.activeElement === this.activeInput) return;
              e.preventDefault();
              this.cancelTextInput();
          }
      }
  }

  handleResize() {
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
          // Handle resize if needed
      }, 100);
  }

  handlePointerDown(e) {
    if (!this.isActive) return;
    
    if (this.activeWrapper) {
        this.deselectText(this.activeWrapper);
    }

    e.preventDefault();
    
    this.activeCanvas = e.target;
    // Find page by canvas
    let pageId = null;
    for (const [id, page] of this.pages) {
        if (page.canvas === this.activeCanvas) {
            pageId = id;
            break;
        }
    }
    if (!pageId) return;
    
    this.ctx = this.pages.get(pageId).ctx;
    
    const rect = this.activeCanvas.getBoundingClientRect();
    this.canvasRect = rect;
    
    const style = globalThis.getComputedStyle(this.activeCanvas);
    const objectFit = style.objectFit;
    
    const bw = this.activeCanvas.width;
    const bh = this.activeCanvas.height;
    
    this.scaleX = bw / rect.width;
    this.scaleY = bh / rect.height;
    this.offsetX = 0;
    this.offsetY = 0;
    
    if (objectFit === 'contain') {
        const targetRatio = bw / bh;
        const containerRatio = rect.width / rect.height;
        if (containerRatio > targetRatio) {
            const renderedWidth = rect.height * targetRatio;
            this.offsetX = (rect.width - renderedWidth) / 2;
            this.scaleX = bw / renderedWidth;
        } else {
            const renderedHeight = rect.width / targetRatio;
            this.offsetY = (rect.height - renderedHeight) / 2;
            this.scaleY = bh / renderedHeight;
        }
    }
    
    this.lastPoint = {
      x: (e.clientX - rect.left - this.offsetX) * this.scaleX,
      y: (e.clientY - rect.top - this.offsetY) * this.scaleY,
      pressure: e.pressure || 0.5
    };

    if (this.currentTool === 'text') {
        this.isCreatingText = true;
        const container = this.activeCanvas.parentElement;
        const containerRect = container.getBoundingClientRect();
        this.textStartPoint = {
            x: e.clientX - containerRect.left,
            y: e.clientY - containerRect.top
        };
        
        this.selectionBox = document.createElement('div');
        this.selectionBox.style.position = 'absolute';
        this.selectionBox.style.left = `${this.textStartPoint.x}px`;
        this.selectionBox.style.top = `${this.textStartPoint.y}px`;
        this.selectionBox.style.width = '0px';
        this.selectionBox.style.height = '0px';
        this.selectionBox.style.border = '1px dashed #6569d0';
        this.selectionBox.style.backgroundColor = 'rgba(101, 105, 208, 0.1)';
        this.selectionBox.style.zIndex = '1000';
        this.selectionBox.style.pointerEvents = 'none';
        container.appendChild(this.selectionBox);
        return;
    }
    

    this.isDrawing = true;
    
    // Setup context for drawing
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else if (this.currentTool === 'marker') {
      this.ctx.globalCompositeOperation = 'multiply';
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, 0.5);
      this.ctx.lineWidth = this.currentSize * 2;
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
    }

    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    this.draw(this.lastPoint);
    
    this.strokePoints = [this.lastPoint]; // Store full stroke
    this.pendingPoints = []; // For render loop
    this.renderLoop();
  }

  handlePointerMove(e) {
    if (!this.isActive) return;
    
    if (this.currentTool === 'eraser' && this.cursorElement) {
        this.updateCursor(e.clientX, e.clientY);
    }

    if (this.isCreatingText && this.selectionBox) {
        const container = this.activeCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;
        const width = currentX - this.textStartPoint.x;
        const height = currentY - this.textStartPoint.y;
        this.selectionBox.style.width = `${Math.abs(width)}px`;
        this.selectionBox.style.height = `${Math.abs(height)}px`;
        this.selectionBox.style.left = `${width < 0 ? currentX : this.textStartPoint.x}px`;
        this.selectionBox.style.top = `${height < 0 ? currentY : this.textStartPoint.y}px`;
        return;
    }

    if (this.currentTool === 'text') return;
    if (!this.isDrawing) return;
    if (e.target !== this.activeCanvas) return;
    
    e.preventDefault();
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    events.forEach(event => {
        const x = (event.clientX - this.canvasRect.left - this.offsetX) * this.scaleX;
        const y = (event.clientY - this.canvasRect.top - this.offsetY) * this.scaleY;
        const point = { x, y, pressure: event.pressure || 0.5 };
        this.strokePoints.push(point);
        this.pendingPoints.push(point);
    });
  }

  renderLoop() {
    if (!this.isDrawing) return;
    if (this.pendingPoints.length > 0) {
        for (const point of this.pendingPoints) {
            this.draw(point);
            this.lastPoint = point;
        }
        this.pendingPoints = [];
    }
    requestAnimationFrame(this.renderLoop);
  }

  handlePointerUp(e) {
    if (!this.isActive) return;
    
    if (this.isCreatingText) {
        this.handleTextCreation();
        return;
    }

    if (this.isDrawing) {
        this.handleDrawingEnd();
    }
  }

  handleTextCreation() {
    this.isCreatingText = false;
    if (!this.selectionBox) return;
    
    const width = Number.parseFloat(this.selectionBox.style.width);
    const height = Number.parseFloat(this.selectionBox.style.height);
    const left = Number.parseFloat(this.selectionBox.style.left);
    const top = Number.parseFloat(this.selectionBox.style.top);
    this.selectionBox.remove();
    this.selectionBox = null;
    
    if (width > 10 && height > 10) {
        this.createTextInput(left, top, width, height);
    }
  }

  handleDrawingEnd() {
    this.isDrawing = false;
    this.flushPendingPoints();
    
    if (!this.ctx) return;
    
    this.ctx.closePath();
    const pageId = this.findPageIdByCanvas(this.activeCanvas);
    
    if (pageId) {
        this.addAction({
            type: 'drawing',
            pageId: pageId,
            tool: this.currentTool,
            color: this.currentColor,
            size: this.currentSize,
            points: this.strokePoints,
            scale: this.scaleX || 1
        });
    }
    this.strokePoints = [];
  }

  flushPendingPoints() {
    if (!this.pendingPoints || this.pendingPoints.length === 0) return;
    
    for (const point of this.pendingPoints) {
        this.draw(point);
        this.lastPoint = point;
    }
    this.pendingPoints = [];
  }

  findPageIdByCanvas(canvas) {
    for (const [id, page] of this.pages) {
        if (page.canvas === canvas) {
            return id;
        }
    }
    return null;
  }

  addAction(action) {
      if (this.historyStep < this.history.length - 1) {
          this.history = this.history.slice(0, this.historyStep + 1);
      }
      this.history.push(action);
      this.historyStep++;
      if (this.options.onAction) this.options.onAction();
  }

  undo() {
      if (this.historyStep < 0) return;
      
      this.isRestoring = true;
      const action = this.history[this.historyStep];
      
      if (!action.type || action.type === 'drawing') {
          this.undoDrawingAction(action);
      } else {
          this.undoTextAction(action);
      }
      
      this.historyStep--;
      this.isRestoring = false;
  }

  undoDrawingAction(action) {
      this.redrawPage(action.pageId);
  }

  undoTextAction(action) {
      switch (action.type) {
          case 'text-add':
              this.undoTextAdd(action);
              break;
          case 'text-remove':
              this.undoTextRemove(action);
              break;
          case 'text-modify':
              this.undoTextModify(action);
              break;
          default:
              break;
      }
  }

  undoTextAdd(action) {
      const wrapper = this.textWrappers.find(w => w.id === action.id);
      if (wrapper) this.removeTextWrapper(wrapper);
  }

  undoTextRemove(action) {
      this._restoreWrapperFromAction(action);
  }

  undoTextModify(action) {
      const wrapper = this.textWrappers.find(w => w.id === action.id);
      if (wrapper) this.applyTextState(wrapper, action.before);
  }

  redo() {
      if (this.historyStep >= this.history.length - 1) return;
      
      this.isRestoring = true;
      this.historyStep++;
      const action = this.history[this.historyStep];
      
      if (!action.type || action.type === 'drawing') {
          this.redrawPage(action.pageId);
      } else {
          this.redoTextAction(action);
      }
      
      this.isRestoring = false;
  }

  redoTextAction(action) {
      switch (action.type) {
          case 'text-add':
              this.redoTextAdd(action);
              break;
          case 'text-remove':
              this.redoTextRemove(action);
              break;
          case 'text-modify':
              this.redoTextModify(action);
              break;
          default:
              break;
      }
  }

  redoTextAdd(action) {
      this._restoreWrapperFromAction(action);
  }

  redoTextRemove(action) {
      const wrapper = this.textWrappers.find(w => w.id === action.id);
      if (wrapper) this.removeTextWrapper(wrapper);
  }

  redoTextModify(action) {
      const wrapper = this.textWrappers.find(w => w.id === action.id);
      if (wrapper) this.applyTextState(wrapper, action.after);
  }

  removeTextWrapper(wrapper) {
      if (this.activeWrapper === wrapper) {
          this.deselectText(wrapper);
      }
      wrapper.remove();
      this.textWrappers = this.textWrappers.filter(w => w !== wrapper);
  }

  serializeTextWrapper(wrapper) {
      const input = wrapper.querySelector('textarea');
      const canvas = wrapper.parentElement.querySelector('canvas');
      // Find pageId
      let pageId = null;
      for (const [id, page] of this.pages) {
          if (page.canvas === canvas) {
              pageId = id;
              break;
          }
      }
      
      return {
          id: wrapper.id,
          pageId: pageId,
          x: Number.parseFloat(wrapper.style.left),
          y: Number.parseFloat(wrapper.style.top),
          width: Number.parseFloat(wrapper.style.width),
          height: Number.parseFloat(wrapper.style.height),
          rotation: Number.parseFloat(wrapper.dataset.rotation || 0),
          text: input.value,
          styles: {
              fontFamily: input.style.fontFamily,
              fontSize: input.style.fontSize,
              color: input.style.color,
              fontWeight: input.style.fontWeight,
              fontStyle: input.style.fontStyle,
              textAlign: input.style.textAlign
          }
      };
  }

  restoreTextWrapper(state, page) {
      if (!page) return;
      
      // Temporarily set active canvas for creation
      const originalActiveCanvas = this.activeCanvas;
      this.activeCanvas = page.canvas;
      
      this.createTextInput(state.x, state.y, state.width, state.height);
      const wrapper = this.activeWrapper;
      wrapper.id = state.id;
      wrapper.isNew = false;
      wrapper.dataset.rotation = state.rotation;
      wrapper.style.transform = `rotate(${state.rotation}deg)`;
      
      const input = wrapper.querySelector('textarea');
      input.value = state.text;
      Object.assign(input.style, state.styles);
      
      this.deselectText(wrapper);
      
      this.activeCanvas = originalActiveCanvas;
  }

  applyTextState(wrapper, state) {
      wrapper.style.left = `${state.x}px`;
      wrapper.style.top = `${state.y}px`;
      wrapper.style.width = `${state.width}px`;
      wrapper.style.height = `${state.height}px`;
      wrapper.dataset.rotation = state.rotation;
      wrapper.style.transform = `rotate(${state.rotation}deg)`;
      const input = wrapper.querySelector('textarea');
      input.value = state.text;
      Object.assign(input.style, state.styles);
  }

  createTextInput(x, y, width, height) {
      const container = this.activeCanvas.parentElement;
      const wrapper = document.createElement('div');
      // Math.random for generating unique element IDs - not cryptographic
      wrapper.id = `text-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      wrapper.className = 'text-input-wrapper';
      wrapper.style.position = 'absolute';
      wrapper.style.left = `${x}px`;
      wrapper.style.top = `${y}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.style.zIndex = '1000';
      wrapper.dataset.rotation = '0';
      wrapper.isNew = true;

      const positions = ['tl', 'tr', 'bl', 'br', 't', 'r', 'b', 'l'];
      positions.forEach(pos => {
          const handle = document.createElement('div');
          handle.className = `resize-handle ${pos}`;
          handle.style.position = 'absolute';
          handle.style.width = '10px';
          handle.style.height = '10px';
          handle.style.background = 'white';
          handle.style.border = '1px solid #6569d0';
          handle.style.borderRadius = '50%';
          handle.style.zIndex = '1001';
          if (pos.includes('t')) handle.style.top = '-5px';
          if (pos.includes('b')) handle.style.bottom = '-5px';
          if (pos.includes('l')) handle.style.left = '-5px';
          if (pos.includes('r')) handle.style.right = '-5px';
          if (pos === 't' || pos === 'b') handle.style.left = 'calc(50% - 5px)';
          if (pos === 'l' || pos === 'r') handle.style.top = 'calc(50% - 5px)';
          if (pos === 'tl' || pos === 'br') handle.style.cursor = 'nwse-resize';
          if (pos === 'tr' || pos === 'bl') handle.style.cursor = 'nesw-resize';
          if (pos === 't' || pos === 'b') handle.style.cursor = 'ns-resize';
          if (pos === 'l' || pos === 'r') handle.style.cursor = 'ew-resize';
          wrapper.appendChild(handle);
          this.setupResizeHandler(handle, wrapper, pos);
      });

      const rotHandle = document.createElement('div');
      rotHandle.className = 'rotate-handle';
      rotHandle.style.position = 'absolute';
      rotHandle.style.top = '-25px';
      rotHandle.style.left = 'calc(50% - 5px)';
      rotHandle.style.width = '10px';
      rotHandle.style.height = '10px';
      rotHandle.style.background = 'white';
      rotHandle.style.border = '1px solid #6569d0';
      rotHandle.style.borderRadius = '50%';
      rotHandle.style.cursor = 'grab';
      rotHandle.style.zIndex = '1001';
      const rotLine = document.createElement('div');
      rotLine.className = 'rotate-line';
      rotLine.style.position = 'absolute';
      rotLine.style.top = '-15px';
      rotLine.style.left = '50%';
      rotLine.style.width = '1px';
      rotLine.style.height = '15px';
      rotLine.style.background = '#6569d0';
      wrapper.appendChild(rotLine);
      wrapper.appendChild(rotHandle);
      this.setupRotationHandler(rotHandle, wrapper);

      const input = document.createElement('textarea');
      input.className = 'annotation-text-input';
      input.style.width = '100%';
      input.style.height = '100%';
      input.style.resize = 'none';
      input.style.border = 'none';
      input.style.outline = 'none';
      input.style.background = 'transparent';
      input.style.fontFamily = this.currentFont;
      input.style.fontSize = `${this.currentFontSize}px`;
      input.style.color = this.currentColor;
      input.style.fontWeight = this.isBold ? 'bold' : 'normal';
      input.style.fontStyle = this.isItalic ? 'italic' : 'normal';
      input.style.textAlign = this.textAlign;
      input.style.padding = '4px';
      wrapper.appendChild(input);
      container.appendChild(wrapper);

      wrapper.addEventListener('mousedown', (e) => {
          e.stopPropagation();
          const wasSelected = wrapper.classList.contains('selected');
          const input = wrapper.querySelector('textarea');
          if (!wasSelected) this.selectText(wrapper, false);
          if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
          if (!input.readOnly) return;
          this.setupMoveHandler(e, wrapper);
      });

      input.addEventListener('dblclick', () => {
          input.readOnly = false;
          input.focus();
      });

      input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              this.finalizeTextInput();
          }
          if (e.key === 'Escape') {
              this.cancelTextInput();
          }
      });

      setTimeout(() => input.focus(), 10);
      this.activeInput = input;
      this.activeWrapper = wrapper;
      this.textWrappers.push(wrapper);
      this.selectText(wrapper, true);
  }

  selectText(wrapper, enableEditing = false) {
      this.textWrappers.forEach(w => {
          if (w !== wrapper) this.deselectText(w);
      });
      wrapper.classList.add('selected');
      const input = wrapper.querySelector('textarea');
      input.readOnly = !enableEditing;
      if (enableEditing) input.focus();
      this.activeInput = input;
      this.activeWrapper = wrapper;
      this.initialTextState = this.serializeTextWrapper(wrapper);
  }

  deselectText(wrapper) {
      if (this.initialTextState && !this.isRestoring) {
          this.handleTextStateChange(wrapper);
      }
      this.clearTextSelection(wrapper);
  }

  handleTextStateChange(wrapper) {
      const currentState = this.serializeTextWrapper(wrapper);
      const input = wrapper.querySelector('textarea');
      
      if (wrapper.isNew) {
          this.handleNewTextWrapper(wrapper, input, currentState);
      } else {
          this.handleExistingTextWrapper(wrapper, currentState);
      }
  }

  handleNewTextWrapper(wrapper, input, currentState) {
      if (input.value.trim()) {
          this.addAction({
              type: 'text-add',
              id: wrapper.id,
              pageId: currentState.pageId,
              state: currentState
          });
          wrapper.isNew = false;
      } else {
          this.removeEmptyTextWrapper(wrapper);
      }
  }

  removeEmptyTextWrapper(wrapper) {
      if (this.activeWrapper === wrapper) {
          this.activeWrapper = null;
          this.activeInput = null;
      }
      this.removeTextWrapper(wrapper);
  }

  handleExistingTextWrapper(wrapper, currentState) {
      if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
          this.addAction({
              type: 'text-modify',
              id: wrapper.id,
              pageId: currentState.pageId,
              before: this.initialTextState,
              after: currentState
          });
      }
  }

  clearTextSelection(wrapper) {
      wrapper.classList.remove('selected');
      const input = wrapper.querySelector('textarea');
      input.readOnly = true;
      input.blur();
      if (this.activeWrapper === wrapper) {
          this.activeWrapper = null;
          this.activeInput = null;
      }
      this.initialTextState = null;
  }

  _createInteractionEndHandler(wrapper, onMouseMove) {
      return () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', this._currentMouseUpHandler);
          this._handleInteractionEnd(wrapper);
      };
  }

  setupMoveHandler(e, wrapper) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const initialLeft = Number.parseFloat(wrapper.style.left);
      const initialTop = Number.parseFloat(wrapper.style.top);
      const onMouseMove = (e) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          wrapper.style.left = `${initialLeft + dx}px`;
          wrapper.style.top = `${initialTop + dy}px`;
      };
      this._currentMouseUpHandler = this._createInteractionEndHandler(wrapper, onMouseMove);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', this._currentMouseUpHandler);
  }

  setupResizeHandler(handle, wrapper, pos) {
      handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const startX = e.clientX;
          const startY = e.clientY;
          const initialWidth = Number.parseFloat(wrapper.style.width);
          const initialHeight = Number.parseFloat(wrapper.style.height);
          const initialLeft = Number.parseFloat(wrapper.style.left);
          const initialTop = Number.parseFloat(wrapper.style.top);
          const onMouseMove = (e) => {
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              let newWidth = initialWidth;
              let newHeight = initialHeight;
              let newLeft = initialLeft;
              let newTop = initialTop;
              if (pos.includes('r')) newWidth = initialWidth + dx;
              if (pos.includes('l')) { newWidth = initialWidth - dx; newLeft = initialLeft + dx; }
              if (pos.includes('b')) newHeight = initialHeight + dy;
              if (pos.includes('t')) { newHeight = initialHeight - dy; newTop = initialTop + dy; }
              if (newWidth > 20) { wrapper.style.width = `${newWidth}px`; wrapper.style.left = `${newLeft}px`; }
              if (newHeight > 20) { wrapper.style.height = `${newHeight}px`; wrapper.style.top = `${newTop}px`; }
          };
          this._currentMouseUpHandler = this._createInteractionEndHandler(wrapper, onMouseMove);
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', this._currentMouseUpHandler);
      });
  }

  setupRotationHandler(handle, wrapper) {
      handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const rect = wrapper.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const onMouseMove = (e) => {
              const dx = e.clientX - centerX;
              const dy = e.clientY - centerY;
              const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
              wrapper.style.transform = `rotate(${angle}deg)`;
              wrapper.dataset.rotation = angle;
          };
          this._currentMouseUpHandler = this._createInteractionEndHandler(wrapper, onMouseMove);
          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', this._currentMouseUpHandler);
      });
  }

  finalizeTextInput() {
      if (this.activeWrapper) {
          this.deselectText(this.activeWrapper);
      }
  }

  drawTextObjects(ctx, containerFilter = null) {
      this.textWrappers.forEach(wrapper => {
          if (containerFilter && !containerFilter.contains(wrapper)) return;
          const input = wrapper.querySelector('textarea');
          const text = input.value;
          if (!text.trim()) return;
          const rect = wrapper.getBoundingClientRect();
          // Find page for this wrapper
          let page = null;
          for (const p of this.pages.values()) {
              if (p.container === wrapper.parentElement) {
                  page = p;
                  break;
              }
          }
          if (!page) return;
          
          const canvasRect = page.canvas.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2 - canvasRect.left;
          const centerY = rect.top + rect.height / 2 - canvasRect.top;
          const bw = page.canvas.width;
          const bh = page.canvas.height;
          const scaleX = bw / canvasRect.width;
          const scaleY = bh / canvasRect.height;
          const canvasCenterX = centerX * scaleX;
          const canvasCenterY = centerY * scaleY;
          const canvasWidth = rect.width * scaleX;
          const canvasHeight = rect.height * scaleY;
          const rotation = Number.parseFloat(wrapper.dataset.rotation || 0);
          const style = globalThis.getComputedStyle(input);
          const fontSize = Number.parseFloat(style.fontSize) * scaleX;
          const fontFamily = style.fontFamily;
          const color = style.color;
          const fontWeight = style.fontWeight;
          const fontStyle = style.fontStyle;
          const textAlign = style.textAlign;
          
          ctx.save();
          ctx.translate(canvasCenterX, canvasCenterY);
          ctx.rotate(rotation * Math.PI / 180);
          ctx.translate(-canvasWidth/2, -canvasHeight/2);
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.fillStyle = color;
          ctx.textAlign = textAlign;
          ctx.textBaseline = 'top';
          let x = 0;
          if (textAlign === 'center') x = canvasWidth / 2;
          if (textAlign === 'right') x = canvasWidth;
          const paragraphs = text.split('\n');
          let y = 0;
          const lineHeight = fontSize * 1.2;
          paragraphs.forEach(paragraph => {
              const words = paragraph.split(' ');
              let line = '';
              for(let n = 0; n < words.length; n++) {
                  const testLine = line + words[n] + ' ';
                  const metrics = ctx.measureText(testLine);
                  const testWidth = metrics.width;
                  if (testWidth > canvasWidth && n > 0) {
                      ctx.fillText(line, x, y);
                      line = words[n] + ' ';
                      y += lineHeight;
                  } else {
                      line = testLine;
                  }
              }
              ctx.fillText(line, x, y);
              y += lineHeight;
          });
          ctx.restore();
      });
  }

  drawText(text, cx, cy, width, height, rotation) {
      if (!this.ctx) return;
      this.ctx.save();
      this.ctx.translate(cx, cy);
      this.ctx.rotate(rotation * Math.PI / 180);
      this.ctx.translate(-width/2, -height/2);
      const scale = this.scaleX || 1;
      const fontSize = this.currentFontSize * scale;
      this.ctx.font = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${fontSize}px ${this.currentFont}`;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.textAlign = this.textAlign;
      this.ctx.textBaseline = 'top';
      let x = 0;
      if (this.textAlign === 'center') x = width / 2;
      if (this.textAlign === 'right') x = width;
      const paragraphs = text.split('\n');
      let y = 0;
      const lineHeight = fontSize * 1.2;
      paragraphs.forEach(paragraph => {
          const words = paragraph.split(' ');
          let line = '';
          for(let n = 0; n < words.length; n++) {
              const testLine = line + words[n] + ' ';
              const metrics = this.ctx.measureText(testLine);
              const testWidth = metrics.width;
              if (testWidth > width && n > 0) {
                  this.ctx.fillText(line, x, y);
                  line = words[n] + ' ';
                  y += lineHeight;
              } else {
                  line = testLine;
              }
          }
          this.ctx.fillText(line, x, y);
          y += lineHeight;
      });
      this.ctx.restore();
  }

  cancelTextInput() {
      if (this.activeWrapper) {
          if (!this.activeWrapper.isNew && !this.isRestoring) {
               const state = this.serializeTextWrapper(this.activeWrapper);
               this.addAction({
                   type: 'text-remove',
                   id: this.activeWrapper.id,
                   pageId: state.pageId,
                   state: state
               });
          }
          if (this.activeWrapper.onRemove) this.activeWrapper.onRemove();
          this.activeWrapper.remove();
          this.textWrappers = this.textWrappers.filter(w => w !== this.activeWrapper);
          this.activeWrapper = null;
          this.activeInput = null;
      } else if (this.activeInput) {
          this.activeInput.remove();
          this.activeInput = null;
      }
  }

  draw(point) {
    if (!this.ctx) return;
    const scale = this.scaleX || 1;
    
    if (this.currentTool !== 'marker') {
        this.ctx.lineWidth = this.currentSize * (point.pressure * 2) * scale;
        if (this.ctx.lineWidth < 1) this.ctx.lineWidth = 1;
    }
    
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
  }

  setTool(toolId) {
    this.currentTool = toolId;
    if (this.toolSizes[toolId] !== undefined) {
        this.setSize(this.toolSizes[toolId]);
    }
    this.updatePropertiesVisibility();
    this.pages.forEach(page => {
        this.updateCursorStyle(page.canvas);
    });
  }
  
  updateCursorStyle(canvas) {
      if (this.currentTool === 'eraser') {
          canvas.classList.add('eraser-mode');
          canvas.style.cursor = 'none';
          if (this.cursorElement) this.cursorElement.classList.remove('hidden');
      } else if (this.currentTool === 'text') {
          canvas.classList.remove('eraser-mode');
          canvas.style.cursor = 'text';
          if (this.cursorElement) this.cursorElement.classList.add('hidden');
      } else {
          canvas.classList.remove('eraser-mode');
          canvas.style.cursor = 'crosshair';
          if (this.cursorElement) this.cursorElement.classList.add('hidden');
      }
  }

  handlePointerEnter(e) {
      if (this.currentTool === 'eraser' && this.cursorElement) {
          this.cursorElement.classList.remove('hidden');
          this.updateCursor(e.clientX, e.clientY);
      }
  }

  handlePointerLeave(e) {
      if (this.currentTool === 'eraser' && this.cursorElement) {
          this.cursorElement.classList.add('hidden');
      }
  }

  updatePropertiesVisibility() {
    if (!this.propertiesContainer?.querySelector) return;
    
    const groups = this.getPropertyGroups();
    this.hideAllPropertyGroups(groups);
    this.showToolSpecificGroups(groups);
  }

  getPropertyGroups() {
    return {
      sizeGroup: this.propertiesContainer.querySelector('.size-group'),
      colorGroup: this.propertiesContainer.querySelector('.color-group'),
      textOptionsGroup: this.propertiesContainer.querySelector('.text-options-group'),
      eraserOptionsGroup: this.propertiesContainer.querySelector('.eraser-options-group')
    };
  }

  hideAllPropertyGroups(groups) {
    Object.values(groups).forEach(group => {
      if (group) group.classList.add('hidden');
    });
  }

  showToolSpecificGroups(groups) {
    switch (this.currentTool) {
      case 'text':
        this.showTextOptions(groups.textOptionsGroup);
        break;
      case 'eraser':
        this.showEraserOptions(groups.eraserOptionsGroup);
        break;
      default:
        this.showDrawingOptions(groups);
        break;
    }
  }

  showTextOptions(textOptionsGroup) {
    if (textOptionsGroup) textOptionsGroup.classList.remove('hidden');
  }

  showEraserOptions(eraserOptionsGroup) {
    if (!eraserOptionsGroup) return;
    eraserOptionsGroup.classList.remove('hidden');
    this.updateEraserSlider(eraserOptionsGroup);
  }

  updateEraserSlider(eraserOptionsGroup) {
    const slider = eraserOptionsGroup.querySelector('.range-slider');
    const valueDisplay = eraserOptionsGroup.querySelector('.slider-value');
    if (slider) slider.value = this.currentSize;
    if (valueDisplay) valueDisplay.textContent = this.currentSize;
  }

  showDrawingOptions(groups) {
    if (groups.sizeGroup) groups.sizeGroup.classList.remove('hidden');
    if (groups.colorGroup) groups.colorGroup.classList.remove('hidden');
  }

  setColor(color) {
    this.currentColor = color;
    if (this.propertiesContainer) {
        const buttons = this.propertiesContainer.querySelectorAll('.color-btn');
        buttons.forEach(btn => {
            if (btn.dataset.color === color) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    this.updateActiveInputStyle();
  }

  updateActiveInputStyle() {
      if (!this.activeInput) return;
      const oldState = this.activeWrapper ? this.serializeTextWrapper(this.activeWrapper) : null;
      this.activeInput.style.fontFamily = this.currentFont;
      this.activeInput.style.fontSize = `${this.currentFontSize}px`;
      this.activeInput.style.color = this.currentColor;
      this.activeInput.style.fontWeight = this.isBold ? 'bold' : 'normal';
      this.activeInput.style.fontStyle = this.isItalic ? 'italic' : 'normal';
      this.activeInput.style.textAlign = this.textAlign;
      if (this.activeWrapper && oldState && !this.isRestoring) {
          const newState = this.serializeTextWrapper(this.activeWrapper);
          if (JSON.stringify(oldState) !== JSON.stringify(newState)) {
              this.addAction({
                  type: 'text-modify',
                  id: this.activeWrapper.id,
                  pageId: oldState.pageId,
                  before: oldState,
                  after: newState
              });
          }
      }
  }

  setSize(size) {
    this.currentSize = size;
    if (this.toolSizes[this.currentTool] !== undefined) {
        this.toolSizes[this.currentTool] = size;
    }
    if (this.propertiesContainer) {
        const buttons = this.propertiesContainer.querySelectorAll('.size-btn');
        buttons.forEach(btn => {
            if (Number.parseInt(btn.dataset.size) === size) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }
    if (this.cursorElement) {
        this.cursorElement.style.width = `${this.currentSize * 2}px`;
        this.cursorElement.style.height = `${this.currentSize * 2}px`;
    }
  }
  
  hexToRgba(hex, alpha) {
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  hasChanges() {
      return this.historyStep > -1 || this.textWrappers.length > 0;
  }

  snapshot() {
      // Snapshot active pages
      this.pages.forEach((page, id) => {
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = page.canvas.width;
          tempCanvas.height = page.canvas.height;
          tempCanvas.getContext('2d', { willReadFrequently: true }).drawImage(page.canvas, 0, 0);
          this.savedContent.set(id, tempCanvas);
      });
      
      // Snapshot active text
      // We need to update savedText with current textWrappers
      // Group by pageId
      const textByPage = new Map();
      this.textWrappers.forEach(w => {
          const state = this.serializeTextWrapper(w);
          if (state.pageId) {
              if (!textByPage.has(state.pageId)) textByPage.set(state.pageId, []);
              textByPage.get(state.pageId).push(state);
          }
      });
      
      // Merge with existing savedText (overwrite active pages)
      textByPage.forEach((texts, id) => {
          this.savedText.set(id, texts);
      });
      
      // Return serializable state?
      // For now just return true if we have data
      return true;
  }

  restore(state) {
      // Not implemented for full persistence yet, relies on savedContent/savedText
  }

  drawStroke(ctx, points, color, size, tool, scale = 1) {
      if (!points || points.length === 0) return;
      
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.strokeStyle = 'rgba(0,0,0,1)';
      } else if (tool === 'marker') {
          ctx.globalCompositeOperation = 'multiply';
          ctx.strokeStyle = this.hexToRgba(color, 0.5);
      } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.strokeStyle = color;
      }
      
      let lastPoint = points[0];
      
      // Draw first point (dot)
      ctx.beginPath();
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(lastPoint.x, lastPoint.y);
      
      if (tool === 'marker') {
          ctx.lineWidth = size * 2;
      } else {
          ctx.lineWidth = size * (lastPoint.pressure * 2) * scale;
          if (ctx.lineWidth < 1) ctx.lineWidth = 1;
      }
      ctx.stroke();
      
      // Draw rest
      for (let i = 1; i < points.length; i++) {
          const point = points[i];
          
          ctx.beginPath();
          ctx.moveTo(lastPoint.x, lastPoint.y);
          ctx.lineTo(point.x, point.y);
          
          if (tool === 'marker') {
              ctx.lineWidth = size * 2;
          } else {
              ctx.lineWidth = size * (point.pressure * 2) * scale;
              if (ctx.lineWidth < 1) ctx.lineWidth = 1;
          }
          
          ctx.stroke();
          lastPoint = point;
      }
      
      ctx.restore();
  }

  redrawPage(pageId) {
      const page = this.pages.get(pageId);
      if (!page) return;
      
      const ctx = page.ctx;
      ctx.clearRect(0, 0, page.canvas.width, page.canvas.height);
      
      // Replay history
      for (let i = 0; i <= this.historyStep; i++) {
          const action = this.history[i];
          if (action.pageId === pageId && (!action.type || action.type === 'drawing')) {
              this.drawStroke(ctx, action.points, action.color, action.size, action.tool, action.scale);
          }
      }
  }
  
  _restoreWrapperFromAction(action) {
      if (this.pages.has(action.pageId)) {
          this.restoreTextWrapper(action.state, this.pages.get(action.pageId));
      }
  }

  _handleInteractionEnd(wrapper) {
      if (this.initialTextState && !this.isRestoring) {
          const currentState = this.serializeTextWrapper(wrapper);
          if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
              this.addAction({
                  type: 'text-modify',
                  id: wrapper.id,
                  pageId: currentState.pageId,
                  before: this.initialTextState,
                  after: currentState
              });
              this.initialTextState = currentState;
          }
      }
  }

  clear() {
      this.pages.forEach(p => {
          const ctx = p.canvas.getContext('2d');
          ctx.clearRect(0, 0, p.canvas.width, p.canvas.height);
      });
      this.savedContent.clear();
      this.savedText.clear();
      this.history = [];
      this.historyStep = -1;
      this.textWrappers.forEach(w => w.remove());
      this.textWrappers = [];
  }
}

globalThis.AnnotationManager = AnnotationManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationManager;
}
