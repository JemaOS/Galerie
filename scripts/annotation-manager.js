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
    this.canvases = []; // Array of canvas elements
    this.ctx = null; // Current context
    this.activeCanvas = null; // Current canvas being drawn on
    
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
    this.textWrappers = []; // Store active text objects
    
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
   * @param {HTMLElement|Array} containerOrTargets - Container or array of {container, target}
   * @param {HTMLElement} [target] - Element to match dimensions with (if first arg is container)
   * @param {Object} options - Options including propertiesContainer
   */
  start(containerOrTargets, target, options = {}) {
    if (this.isActive) return;
    
    this.options = options;

    let targets = [];
    if (Array.isArray(containerOrTargets)) {
        targets = containerOrTargets;
    } else {
        targets = [{ container: containerOrTargets, target: target }];
    }
    
    this.isActive = true;
    this.canvases = [];
    this.history = [];
    this.historyStep = -1;
    
    targets.forEach(item => {
        this.createCanvas(item.container, item.target);
    });

    if (this.options.propertiesContainer) {
        // Only render if not already rendered or if container changed
        if (this.propertiesContainer !== this.options.propertiesContainer) {
            this.renderProperties(this.options.propertiesContainer);
        } else {
            // Ensure visibility matches current tool
            this.updatePropertiesVisibility();
        }
    }

    this.createCursor();
    this.setupEventListeners();
    
    console.log('Annotation mode started');
  }

  /**
   * Pause annotation mode (hide UI, disable interaction, keep state)
   */
  pause() {
      this.isActive = false;
      this.canvases.forEach(c => c.style.pointerEvents = 'none');
      if (this.cursorElement) this.cursorElement.classList.add('hidden');
      // Hide properties
      if (this.propertiesContainer) this.propertiesContainer.classList.add('hidden');
  }

  /**
   * Resume annotation mode
   */
  resume() {
      this.isActive = true;
      this.canvases.forEach(c => c.style.pointerEvents = 'auto');
      if (this.propertiesContainer) this.propertiesContainer.classList.remove('hidden');
      // Cursor visibility will be handled by pointer events
  }

  /**
   * Check if initialized
   */
  hasCanvas() {
      return this.canvases.length > 0;
  }

  /**
   * Stop annotation mode
   */
  stop(keepUI = false) {
    if (!this.isActive && this.canvases.length === 0) return;
    
    this.isActive = false;
    
    // Cancel any active text input
    this.cancelTextInput();

    // Remove event listeners
    this.removeEventListeners();
    
    // Clear properties container
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
      this.canvases.forEach(canvas => canvas.remove());
      this.canvases = [];
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
      
      // Update size
      // Eraser size in canvas pixels vs screen pixels
      // We want visual size to match what will be erased
      // In draw(), lineWidth = currentSize * scale.
      // So diameter = currentSize * scale.
      // But we want screen pixels.
      // Screen diameter = (currentSize * scale) / scale = currentSize.
      // So just currentSize.
      // But let's make it slightly larger to be visible
      const size = Math.max(10, this.currentSize * 2); // Diameter = radius * 2? No, lineWidth is width.
      // If lineWidth is 10, the line is 10px wide.
      // So diameter is 10.
      // Let's use currentSize * 2 for better visibility or just currentSize?
      // In draw(), lineWidth = currentSize * pressure * 2 * scale.
      // Max pressure = 1. So max width = currentSize * 2 * scale.
      // So max screen width = currentSize * 2.
      
      this.cursorElement.style.width = `${this.currentSize * 2}px`;
      this.cursorElement.style.height = `${this.currentSize * 2}px`;
  }

  /**
   * Create canvas element
   */
  createCanvas(container, target) {
    const canvas = document.createElement('canvas');
    canvas.className = 'annotation-canvas';
    
    // Match dimensions
    this.updateCanvasSize(canvas, target);
    
    // Store reference to target for resizing
    canvas.targetElement = target;
    
    container.appendChild(canvas);
    this.canvases.push(canvas);
    return canvas;
  }

  /**
   * Update canvas size to match target
   */
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

  /**
   * Render properties UI into container
   */
  renderProperties(container) {
    this.propertiesContainer = container;
    container.innerHTML = '';

    // --- Size Group (Pen/Marker) ---
    const sizeGroup = document.createElement('div');
    sizeGroup.className = 'sidebar-group size-group';
    
    const sizeLabel = document.createElement('div');
    sizeLabel.className = 'group-label';
    sizeLabel.textContent = 'TAILLE';
    sizeGroup.appendChild(sizeLabel);

    const sizeOptions = document.createElement('div');
    sizeOptions.className = 'size-options';
    
    // Preset sizes (added 1px for fine signatures)
    const sizes = [1, 2, 4, 8, 16];
    sizes.forEach(size => {
        const btn = document.createElement('button');
        btn.className = `size-btn ${this.currentSize === size ? 'active' : ''}`;
        btn.dataset.size = size;
        btn.title = `${size}px`;
        btn.addEventListener('click', () => this.setSize(size));
        
        const line = document.createElement('div');
        line.className = 'size-shape';
        // Scale the shape height based on size
        line.style.height = `${Math.max(2, size / 2)}px`;
        line.style.width = '24px';
        line.style.borderRadius = '2px';
        line.style.backgroundColor = 'currentColor';
        btn.appendChild(line);
        
        sizeOptions.appendChild(btn);
    });
    sizeGroup.appendChild(sizeOptions);
    container.appendChild(sizeGroup);

    // --- Text Options Group ---
    const textOptionsGroup = document.createElement('div');
    textOptionsGroup.className = 'text-options-group hidden';

    // Font Section
    const fontGroup = document.createElement('div');
    fontGroup.className = 'sidebar-group';
    
    const fontLabel = document.createElement('div');
    fontLabel.className = 'group-label';
    fontLabel.textContent = 'Police';
    fontGroup.appendChild(fontLabel);

    const fontControls = document.createElement('div');
    fontControls.className = 'font-controls';

    // Font Family Dropdown
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

    // Font Size Dropdown
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
        this.currentFontSize = parseInt(e.target.value);
        this.updateActiveInputStyle();
    });
    fontControls.appendChild(fontSizeSelect);

    fontGroup.appendChild(fontControls);
    textOptionsGroup.appendChild(fontGroup);

    // Styles Section
    const styleGroup = document.createElement('div');
    styleGroup.className = 'sidebar-group';
    
    const styleLabel = document.createElement('div');
    styleLabel.className = 'group-label';
    styleLabel.textContent = 'Styles';
    styleGroup.appendChild(styleLabel);

    const styleControls = document.createElement('div');
    styleControls.className = 'style-controls';

    // Bold/Italic
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

    // Alignment
    const alignGroup = document.createElement('div');
    alignGroup.className = 'style-toggle-group';
    
    const alignments = [
        { id: 'left', icon: 'format_align_left' },
        { id: 'center', icon: 'format_align_center' },
        { id: 'right', icon: 'format_align_right' },
        { id: 'justify', icon: 'format_align_justify' }
    ];

    alignments.forEach(align => {
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

    // Text Color Section
    const textColorGroup = document.createElement('div');
    textColorGroup.className = 'sidebar-group';
    
    const textColorLabel = document.createElement('div');
    textColorLabel.className = 'group-label';
    textColorLabel.textContent = 'Couleur du texte';
    textColorGroup.appendChild(textColorLabel);

    // Reuse color grid logic but for text
    const textColorGrid = document.createElement('div');
    textColorGrid.className = 'color-grid';
    
    const colors = [
        '#000000', '#3c4043', '#9aa0a6', '#dadce0', '#ffffff',
        '#ff8a80', '#ffff8d', '#ccff90', '#a7ffeb', '#d7ccc8',
        '#f44336', '#fdd835', '#4caf50', '#6569d0', '#795548',
        '#b71c1c', '#ff9800', '#1b5e20', '#1976d2', '#3e2723'
    ];
    
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

    // --- Color Group (Pen/Marker) ---
    const colorGroup = document.createElement('div');
    colorGroup.className = 'sidebar-group color-group';
    
    const colorLabel = document.createElement('div');
    colorLabel.className = 'group-label';
    colorLabel.textContent = 'COULEUR';
    colorGroup.appendChild(colorLabel);

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';
    
    const finalColors = [
        '#000000', '#5f6368', '#bdc1c6', '#ffffff',
        '#ff8a80', '#ffff8d', '#ccff90', '#a7ffeb',
        '#f44336', '#fdd835', '#4caf50', '#6569d0',
        '#d32f2f', '#f57c00', '#388e3c', '#1976d2',
        '#c2185b', '#7b1fa2', '#512da8', '#3e2723'
    ];
    
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

    // --- Eraser Options Group ---
    const eraserOptionsGroup = document.createElement('div');
    eraserOptionsGroup.className = 'eraser-options-group hidden';

    // Auto Apply Toggle
    const toggleContainer = document.createElement('div');
    toggleContainer.className = 'toggle-container';
    
    const toggleLabel = document.createElement('span');
    toggleLabel.textContent = 'Appliquer automatiquement';
    toggleContainer.appendChild(toggleLabel);

    const toggleSwitch = document.createElement('label');
    toggleSwitch.className = 'toggle-switch';
    
    const toggleInput = document.createElement('input');
    toggleInput.type = 'checkbox';
    toggleInput.checked = true; // Default active as per screenshot
    toggleSwitch.appendChild(toggleInput);
    
    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-slider';
    toggleSwitch.appendChild(toggleSlider);
    
    toggleContainer.appendChild(toggleSwitch);
    eraserOptionsGroup.appendChild(toggleContainer);

    // Size Slider
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
        const size = parseInt(e.target.value);
        this.setSize(size);
        sliderValue.textContent = size;
    });
    
    sliderContainer.appendChild(rangeSlider);
    eraserOptionsGroup.appendChild(sliderContainer);

    container.appendChild(eraserOptionsGroup);
    
    // Initial visibility update
    this.updatePropertiesVisibility();
  }

  setupEventListeners() {
    this.canvases.forEach(canvas => {
        canvas.addEventListener('pointerdown', this.handlePointerDown);
        canvas.addEventListener('pointermove', this.handlePointerMove);
        canvas.addEventListener('pointerup', this.handlePointerUp);
        canvas.addEventListener('pointerout', this.handlePointerUp);
        canvas.addEventListener('pointerenter', this.handlePointerEnter);
        canvas.addEventListener('pointerleave', this.handlePointerLeave);
    });
    
    window.addEventListener('resize', this.handleResize);
    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('mousedown', this.handleDocumentMouseDown);
  }

  removeEventListeners() {
    this.canvases.forEach(canvas => {
        canvas.removeEventListener('pointerdown', this.handlePointerDown);
        canvas.removeEventListener('pointermove', this.handlePointerMove);
        canvas.removeEventListener('pointerup', this.handlePointerUp);
        canvas.removeEventListener('pointerout', this.handlePointerUp);
        canvas.removeEventListener('pointerenter', this.handlePointerEnter);
        canvas.removeEventListener('pointerleave', this.handlePointerLeave);
    });
    
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('mousedown', this.handleDocumentMouseDown);
  }

  handleDocumentMouseDown(e) {
      if (!this.isActive) return;
      
      // If clicking inside a text wrapper, ignore
      if (e.target.closest('.text-input-wrapper')) return;
      
      // If clicking on a canvas, ignore (handled by canvas listener)
      if (e.target.classList.contains('annotation-canvas')) return;
      
      // If clicking inside properties container, ignore
      if (this.propertiesContainer && this.propertiesContainer.contains(e.target)) return;
      
      // If clicking on toolbar, ignore
      if (e.target.closest('.pdf-toolbar') || e.target.closest('.viewer-toolbar')) return;
      
      // If clicking on context menu, ignore
      if (e.target.closest('.context-menu')) return;

      // Deselect active wrapper
      if (this.activeWrapper) {
          this.deselectText(this.activeWrapper);
      }
  }

  handleKeyDown(e) {
      if (!this.isActive) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (this.activeWrapper && this.activeWrapper.classList.contains('selected')) {
              // If typing in the textarea, don't delete the wrapper
              if (document.activeElement === this.activeInput) {
                  return;
              }
              
              e.preventDefault();
              this.cancelTextInput();
          }
      }
  }

  handleResize() {
      // Debounce resize
      if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
      this.resizeTimeout = setTimeout(() => {
          // Handle resize if needed
      }, 100);
  }

  handlePointerDown(e) {
    if (!this.isActive) return;
    
    // If we have an active wrapper, deselect it when clicking outside
    if (this.activeWrapper) {
        this.deselectText(this.activeWrapper);
    }

    e.preventDefault(); // Prevent scrolling
    
    this.activeCanvas = e.target;
    this.ctx = this.activeCanvas.getContext('2d', { willReadFrequently: true });
    
    // Calculate coordinate mapping
    const rect = this.activeCanvas.getBoundingClientRect();
    this.canvasRect = rect;
    
    const style = window.getComputedStyle(this.activeCanvas);
    const objectFit = style.objectFit;
    
    const bw = this.activeCanvas.width;
    const bh = this.activeCanvas.height;
    
    // Default values (fill/stretch behavior)
    this.scaleX = bw / rect.width;
    this.scaleY = bh / rect.height;
    this.offsetX = 0;
    this.offsetY = 0;
    
    if (objectFit === 'contain') {
        const targetRatio = bw / bh;
        const containerRatio = rect.width / rect.height;
        
        if (containerRatio > targetRatio) {
            // Pillarbox (bars on sides)
            // Image height matches container height
            const renderedWidth = rect.height * targetRatio;
            const renderedHeight = rect.height;
            
            this.offsetX = (rect.width - renderedWidth) / 2;
            this.offsetY = 0;
            this.scaleX = bw / renderedWidth;
            this.scaleY = bh / renderedHeight;
        } else {
            // Letterbox (bars on top/bottom)
            // Image width matches container width
            const renderedWidth = rect.width;
            const renderedHeight = rect.width / targetRatio;
            
            this.offsetX = 0;
            this.offsetY = (rect.height - renderedHeight) / 2;
            this.scaleX = bw / renderedWidth;
            this.scaleY = bh / renderedHeight;
        }
    }
    
    this.lastPoint = {
      x: (e.clientX - rect.left - this.offsetX) * this.scaleX,
      y: (e.clientY - rect.top - this.offsetY) * this.scaleY,
      pressure: e.pressure || 0.5
    };

    // Handle Text Tool
    if (this.currentTool === 'text') {
        this.isCreatingText = true;
        
        // Calculate start position relative to container
        const container = this.activeCanvas.parentElement;
        const rect = container.getBoundingClientRect();
        this.textStartPoint = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
        
        // Create visual feedback
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
    
    // Save state before drawing
    this.tempState = this.ctx.getImageData(0, 0, this.activeCanvas.width, this.activeCanvas.height);

    this.isDrawing = true;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    // Start path
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPoint.x, this.lastPoint.y);
    
    // Draw a dot if it's a tap
    this.draw(this.lastPoint);
    
    // Initialize points queue for rAF
    this.points = [];
    this.renderLoop();
  }

  handlePointerMove(e) {
    if (!this.isActive) return;
    
    // Update cursor
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
    // Only draw if we are on the same canvas we started on
    if (e.target !== this.activeCanvas) return;
    
    e.preventDefault();
    
    // Use coalesced events for higher precision if available
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    
    events.forEach(event => {
        const x = (event.clientX - this.canvasRect.left - this.offsetX) * this.scaleX;
        const y = (event.clientY - this.canvasRect.top - this.offsetY) * this.scaleY;
        
        this.points.push({
            x: x,
            y: y,
            pressure: event.pressure || 0.5
        });
    });
  }

  renderLoop() {
    if (!this.isDrawing) return;
    
    if (this.points.length > 0) {
        // Draw all points in queue
        for (const point of this.points) {
            this.draw(point);
            this.lastPoint = point;
        }
        this.points = [];
    }
    
    requestAnimationFrame(this.renderLoop);
  }

  handlePointerUp(e) {
    if (!this.isActive) return;
    
    if (this.isCreatingText) {
        this.isCreatingText = false;
        if (this.selectionBox) {
            const width = parseFloat(this.selectionBox.style.width);
            const height = parseFloat(this.selectionBox.style.height);
            const left = parseFloat(this.selectionBox.style.left);
            const top = parseFloat(this.selectionBox.style.top);
            
            this.selectionBox.remove();
            this.selectionBox = null;
            
            // Only create if size is significant (dragged)
            if (width > 10 && height > 10) {
                this.createTextInput(left, top, width, height);
            }
        }
        return;
    }

    if (this.isDrawing) {
        this.isDrawing = false;
        
        // Flush remaining points
        if (this.points && this.points.length > 0) {
            for (const point of this.points) {
                this.draw(point);
                this.lastPoint = point;
            }
            this.points = [];
        }

        if (this.ctx) {
            this.ctx.closePath();
            
            // Save action to history
            const newState = this.ctx.getImageData(0, 0, this.activeCanvas.width, this.activeCanvas.height);
            this.addAction({
                canvasIndex: this.canvases.indexOf(this.activeCanvas),
                before: this.tempState,
                after: newState
            });
        }
    }
  }

  addAction(action) {
      // Remove any redo steps
      if (this.historyStep < this.history.length - 1) {
          this.history = this.history.slice(0, this.historyStep + 1);
      }
      
      this.history.push(action);
      this.historyStep++;
      
      // Notify listener
      if (this.options.onAction) {
          this.options.onAction();
      }
  }

  undo() {
      if (this.historyStep >= 0) {
          this.isRestoring = true;
          const action = this.history[this.historyStep];
          
          if (!action.type || action.type === 'drawing') {
              const canvas = this.canvases[action.canvasIndex];
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.putImageData(action.before, 0, 0);
          } else if (action.type === 'text-add') {
              const wrapper = this.textWrappers.find(w => w.id === action.id);
              if (wrapper) {
                  this.removeTextWrapper(wrapper);
              }
          } else if (action.type === 'text-remove') {
              this.restoreTextWrapper(action.state);
          } else if (action.type === 'text-modify') {
              const wrapper = this.textWrappers.find(w => w.id === action.id);
              if (wrapper) {
                  this.applyTextState(wrapper, action.before);
              }
          }
          
          this.historyStep--;
          this.isRestoring = false;
      }
  }

  redo() {
      if (this.historyStep < this.history.length - 1) {
          this.isRestoring = true;
          this.historyStep++;
          const action = this.history[this.historyStep];
          
          if (!action.type || action.type === 'drawing') {
              const canvas = this.canvases[action.canvasIndex];
              const ctx = canvas.getContext('2d', { willReadFrequently: true });
              ctx.putImageData(action.after, 0, 0);
          } else if (action.type === 'text-add') {
              this.restoreTextWrapper(action.state);
          } else if (action.type === 'text-remove') {
              const wrapper = this.textWrappers.find(w => w.id === action.id);
              if (wrapper) {
                  this.removeTextWrapper(wrapper);
              }
          } else if (action.type === 'text-modify') {
              const wrapper = this.textWrappers.find(w => w.id === action.id);
              if (wrapper) {
                  this.applyTextState(wrapper, action.after);
              }
          }
          
          this.isRestoring = false;
      }
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
      return {
          id: wrapper.id,
          canvasIndex: this.canvases.indexOf(canvas),
          x: parseFloat(wrapper.style.left),
          y: parseFloat(wrapper.style.top),
          width: parseFloat(wrapper.style.width),
          height: parseFloat(wrapper.style.height),
          rotation: parseFloat(wrapper.dataset.rotation || 0),
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

  restoreTextWrapper(state) {
      // Temporarily set active canvas to the correct one for creation
      const originalActiveCanvas = this.activeCanvas;
      this.activeCanvas = this.canvases[state.canvasIndex];
      
      if (!this.activeCanvas) {
          this.activeCanvas = originalActiveCanvas;
          return;
      }

      this.createTextInput(state.x, state.y, state.width, state.height);
      const wrapper = this.activeWrapper;
      wrapper.id = state.id;
      wrapper.isNew = false; // Restored items are not new
      wrapper.dataset.rotation = state.rotation;
      wrapper.style.transform = `rotate(${state.rotation}deg)`;
      
      const input = wrapper.querySelector('textarea');
      input.value = state.text;
      
      // Apply styles
      Object.assign(input.style, state.styles);
      
      // Deselect to finalize restoration
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
      wrapper.id = `text-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      wrapper.className = 'text-input-wrapper';
      wrapper.style.position = 'absolute';
      wrapper.style.left = `${x}px`;
      wrapper.style.top = `${y}px`;
      wrapper.style.width = `${width}px`;
      wrapper.style.height = `${height}px`;
      wrapper.style.zIndex = '1000';
      // Border is handled by CSS (.selected class)
      wrapper.dataset.rotation = '0';
      wrapper.isNew = true; // Flag for history

      // --- Handles ---
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

      // Rotation Handle
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

      // Textarea
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
      
      // Move/Select Logic
      wrapper.addEventListener('mousedown', (e) => {
          e.stopPropagation(); // Prevent canvas interaction
          
          const wasSelected = wrapper.classList.contains('selected');
          const input = wrapper.querySelector('textarea');
          
          if (!wasSelected) {
              this.selectText(wrapper, false);
          }
          
          // If clicking handles, don't move here (handled by their own listeners)
          if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) {
              return;
          }

          // If input is editable (readOnly=false), allow text interaction (don't move)
          if (!input.readOnly) {
              return;
          }
          
          // Otherwise (readOnly=true), allow moving
          this.setupMoveHandler(e, wrapper);
      });

      // Double click to edit
      input.addEventListener('dblclick', () => {
          input.readOnly = false;
          input.focus();
      });

      // Handle Enter (Shift+Enter for new line)
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
      
      // Initial selection (editable for new)
      this.selectText(wrapper, true);
  }

  selectText(wrapper, enableEditing = false) {
      // Deselect others
      this.textWrappers.forEach(w => {
          if (w !== wrapper) this.deselectText(w);
      });
      
      wrapper.classList.add('selected');
      const input = wrapper.querySelector('textarea');
      input.readOnly = !enableEditing;
      
      if (enableEditing) {
          input.focus();
      }
      
      this.activeInput = input;
      this.activeWrapper = wrapper;
      
      // Save initial state for history
      this.initialTextState = this.serializeTextWrapper(wrapper);
  }

  deselectText(wrapper) {
      // Handle History
      if (this.initialTextState && !this.isRestoring) {
          const currentState = this.serializeTextWrapper(wrapper);
          const input = wrapper.querySelector('textarea');
          
          if (wrapper.isNew) {
              if (input.value.trim()) {
                  // New and has text -> Add to history
                  this.addAction({
                      type: 'text-add',
                      id: wrapper.id,
                      state: currentState
                  });
                  wrapper.isNew = false;
              } else {
                  // New and empty -> Remove
                  if (this.activeWrapper === wrapper) {
                      this.activeWrapper = null;
                      this.activeInput = null;
                  }
                  this.removeTextWrapper(wrapper);
                  return; // Stop here
              }
          } else {
              // Existing -> Check for changes (content or style that wasn't caught by other handlers)
              // We only check content here, as move/resize/style are handled by their own events usually.
              // But if user typed, we catch it here.
              if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
                  this.addAction({
                      type: 'text-modify',
                      id: wrapper.id,
                      before: this.initialTextState,
                      after: currentState
                  });
              }
          }
      }

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

  setupMoveHandler(e, wrapper) {
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const initialLeft = parseFloat(wrapper.style.left);
      const initialTop = parseFloat(wrapper.style.top);

      const onMouseMove = (e) => {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;
          wrapper.style.left = `${initialLeft + dx}px`;
          wrapper.style.top = `${initialTop + dy}px`;
      };

      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
          
          if (this.initialTextState && !this.isRestoring) {
              const currentState = this.serializeTextWrapper(wrapper);
              if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
                  this.addAction({
                      type: 'text-modify',
                      id: wrapper.id,
                      before: this.initialTextState,
                      after: currentState
                  });
                  this.initialTextState = currentState;
              }
          }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  }

  setupResizeHandler(handle, wrapper, pos) {
      handle.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          const startX = e.clientX;
          const startY = e.clientY;
          const initialWidth = parseFloat(wrapper.style.width);
          const initialHeight = parseFloat(wrapper.style.height);
          const initialLeft = parseFloat(wrapper.style.left);
          const initialTop = parseFloat(wrapper.style.top);
          
          const onMouseMove = (e) => {
              const dx = e.clientX - startX;
              const dy = e.clientY - startY;
              
              let newWidth = initialWidth;
              let newHeight = initialHeight;
              let newLeft = initialLeft;
              let newTop = initialTop;
              
              if (pos.includes('r')) newWidth = initialWidth + dx;
              if (pos.includes('l')) {
                  newWidth = initialWidth - dx;
                  newLeft = initialLeft + dx;
              }
              if (pos.includes('b')) newHeight = initialHeight + dy;
              if (pos.includes('t')) {
                  newHeight = initialHeight - dy;
                  newTop = initialTop + dy;
              }
              
              if (newWidth > 20) {
                  wrapper.style.width = `${newWidth}px`;
                  wrapper.style.left = `${newLeft}px`;
              }
              if (newHeight > 20) {
                  wrapper.style.height = `${newHeight}px`;
                  wrapper.style.top = `${newTop}px`;
              }
          };

          const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              
              if (this.initialTextState && !this.isRestoring) {
                  const currentState = this.serializeTextWrapper(wrapper);
                  if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
                      this.addAction({
                          type: 'text-modify',
                          id: wrapper.id,
                          before: this.initialTextState,
                          after: currentState
                      });
                      this.initialTextState = currentState;
                  }
              }
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
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

          const onMouseUp = () => {
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
              
              if (this.initialTextState && !this.isRestoring) {
                  const currentState = this.serializeTextWrapper(wrapper);
                  if (JSON.stringify(this.initialTextState) !== JSON.stringify(currentState)) {
                      this.addAction({
                          type: 'text-modify',
                          id: wrapper.id,
                          before: this.initialTextState,
                          after: currentState
                      });
                      this.initialTextState = currentState;
                  }
              }
          };

          document.addEventListener('mousemove', onMouseMove);
          document.addEventListener('mouseup', onMouseUp);
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
          const canvasRect = this.activeCanvas.getBoundingClientRect();
          
          // Calculate position relative to canvas
          const centerX = rect.left + rect.width / 2 - canvasRect.left;
          const centerY = rect.top + rect.height / 2 - canvasRect.top;
          
          const bw = this.activeCanvas.width;
          const bh = this.activeCanvas.height;
          const scaleX = bw / canvasRect.width;
          const scaleY = bh / canvasRect.height;
          
          const canvasCenterX = centerX * scaleX;
          const canvasCenterY = centerY * scaleY;
          const canvasWidth = rect.width * scaleX;
          const canvasHeight = rect.height * scaleY;
          
          const rotation = parseFloat(wrapper.dataset.rotation || 0);
          
          // Extract styles
          const style = window.getComputedStyle(input);
          const fontSize = parseFloat(style.fontSize) * scaleX;
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
          
          // Wrap text
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
                  }
                  else {
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
      this.ctx.translate(-width/2, -height/2); // Move to top-left of box
      
      const scale = this.scaleX || 1;
      const fontSize = this.currentFontSize * scale;
      
      this.ctx.font = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${fontSize}px ${this.currentFont}`;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.textAlign = this.textAlign;
      this.ctx.textBaseline = 'top';
      
      // Adjust x based on alignment
      let x = 0;
      if (this.textAlign === 'center') x = width / 2;
      if (this.textAlign === 'right') x = width;
      
      // Wrap text
      const words = text.split(/[\s\n]+/); // Split by whitespace or newline?
      // Actually we should preserve newlines
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
              }
              else {
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
               this.addAction({
                   type: 'text-remove',
                   id: this.activeWrapper.id,
                   state: this.serializeTextWrapper(this.activeWrapper)
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

  drawText(text, x, y) {
      if (!this.ctx) return;
      
      const scale = this.scaleX || 1;
      const fontSize = this.currentFontSize * scale;
      
      this.ctx.font = `${this.isItalic ? 'italic ' : ''}${this.isBold ? 'bold ' : ''}${fontSize}px ${this.currentFont}`;
      this.ctx.fillStyle = this.currentColor;
      this.ctx.textAlign = this.textAlign;
      this.ctx.textBaseline = 'top';
      
      const lines = text.split('\n');
      const lineHeight = fontSize * 1.2;
      
      lines.forEach((line, index) => {
          this.ctx.fillText(line, x, y + (index * lineHeight));
      });
  }

  draw(point) {
    if (!this.ctx) return;
    
    // Adjust line width based on scale (DPI)
    const scale = this.scaleX || 1;
    this.ctx.lineWidth = this.currentSize * (point.pressure * 2) * scale; // Pressure sensitivity
    if (this.ctx.lineWidth < 1) this.ctx.lineWidth = 1;
    
    if (this.currentTool === 'eraser') {
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter for eraser
    } else if (this.currentTool === 'marker') {
      this.ctx.globalCompositeOperation = 'multiply'; // Or source-over with opacity
      this.ctx.strokeStyle = this.hexToRgba(this.currentColor, 0.5);
      this.ctx.lineWidth = this.currentSize * 2; // Marker is thicker
    } else {
      this.ctx.globalCompositeOperation = 'source-over';
      this.ctx.strokeStyle = this.currentColor;
    }
    
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
    
    // For smoother lines, we could use quadratic curves, but lineTo is faster and easier for now
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
  }

  setTool(toolId) {
    this.currentTool = toolId;
    
    // Restore size for the tool
    if (this.toolSizes[toolId] !== undefined) {
        // We use setSize to ensure UI updates (buttons etc)
        // But we don't want to overwrite the saved size with the OLD currentSize
        // So we pass the saved size
        this.setSize(this.toolSizes[toolId]);
    }

    this.updatePropertiesVisibility();
    
    // Update cursor
    this.canvases.forEach(canvas => {
        if (toolId === 'eraser') {
            canvas.classList.add('eraser-mode');
            canvas.style.cursor = 'none'; // Hide default cursor
            if (this.cursorElement) this.cursorElement.classList.remove('hidden');
        } else if (toolId === 'text') {
            canvas.classList.remove('eraser-mode');
            canvas.style.cursor = 'text';
            if (this.cursorElement) this.cursorElement.classList.add('hidden');
        } else {
            canvas.classList.remove('eraser-mode');
            canvas.style.cursor = 'crosshair';
            if (this.cursorElement) this.cursorElement.classList.add('hidden');
        }
    });
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
    if (!this.propertiesContainer || !this.propertiesContainer.querySelector) return;

    const sizeGroup = this.propertiesContainer.querySelector('.size-group');
    const colorGroup = this.propertiesContainer.querySelector('.color-group');
    const textOptionsGroup = this.propertiesContainer.querySelector('.text-options-group');
    const eraserOptionsGroup = this.propertiesContainer.querySelector('.eraser-options-group');

    // Hide all first
    if (sizeGroup) sizeGroup.classList.add('hidden');
    if (colorGroup) colorGroup.classList.add('hidden');
    if (textOptionsGroup) textOptionsGroup.classList.add('hidden');
    if (eraserOptionsGroup) eraserOptionsGroup.classList.add('hidden');

    if (this.currentTool === 'text') {
        if (textOptionsGroup) textOptionsGroup.classList.remove('hidden');
    } else if (this.currentTool === 'eraser') {
        if (eraserOptionsGroup) {
            eraserOptionsGroup.classList.remove('hidden');
            // Update slider value if needed
            const slider = eraserOptionsGroup.querySelector('.range-slider');
            const valueDisplay = eraserOptionsGroup.querySelector('.slider-value');
            if (slider) slider.value = this.currentSize;
            if (valueDisplay) valueDisplay.textContent = this.currentSize;
        }
    } else {
        if (sizeGroup) sizeGroup.classList.remove('hidden');
        if (colorGroup) colorGroup.classList.remove('hidden');
    }
  }

  setColor(color) {
    this.currentColor = color;
    
    // Update UI
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
                  before: oldState,
                  after: newState
              });
              this.initialTextState = newState;
          }
      }
  }

  setSize(size) {
    this.currentSize = size;
    
    // Save size for current tool
    if (this.toolSizes[this.currentTool] !== undefined) {
        this.toolSizes[this.currentTool] = size;
    }
    
    // Update UI
    if (this.propertiesContainer) {
        const buttons = this.propertiesContainer.querySelectorAll('.size-btn');
        buttons.forEach(btn => {
            if (parseInt(btn.dataset.size) === size) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update cursor size immediately
    if (this.cursorElement) {
        this.cursorElement.style.width = `${this.currentSize * 2}px`;
        this.cursorElement.style.height = `${this.currentSize * 2}px`;
    }
  }
  
  hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Check if there are any annotations
   */
  hasChanges() {
      return this.historyStep > -1 || this.textWrappers.length > 0;
  }

  /**
   * Snapshot current state (drawings and text)
   */
  snapshot() {
      const state = {
          drawings: [],
          textWrappers: []
      };

      // Snapshot drawings
      this.canvases.forEach((canvas, index) => {
          // Create a temporary canvas to store the image
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = canvas.width;
          tempCanvas.height = canvas.height;
          const ctx = tempCanvas.getContext('2d');
          if (canvas.width > 0 && canvas.height > 0) {
              ctx.drawImage(canvas, 0, 0);
          }
          
          state.drawings.push({
              index: index,
              image: tempCanvas
          });
      });

      // Snapshot text
      this.textWrappers.forEach(wrapper => {
          state.textWrappers.push(this.serializeTextWrapper(wrapper));
      });

      return state;
  }

  /**
   * Restore state
   */
  restore(state) {
      if (!state) return;

      // Restore drawings
      state.drawings.forEach(item => {
          if (item.index < this.canvases.length) {
              const targetCanvas = this.canvases[item.index];
              const ctx = targetCanvas.getContext('2d');
              
              // Draw the old image scaled to the new canvas
              // This bakes the previous state
              if (item.image.width > 0 && item.image.height > 0) {
                  ctx.drawImage(item.image, 0, 0, targetCanvas.width, targetCanvas.height);
              }
          }
      });

      // Restore text
      // We need to adjust coordinates for the new scale
      // We can infer scale from the first canvas change
      if (state.drawings.length > 0 && this.canvases.length > 0) {
          const oldWidth = state.drawings[0].image.width;
          const newWidth = this.canvases[0].width;
          
          // Avoid division by zero
          const scaleFactor = oldWidth > 0 ? newWidth / oldWidth : 1;

          state.textWrappers.forEach(textState => {
              // Adjust state for new scale
              const newState = { ...textState };
              newState.x *= scaleFactor;
              newState.y *= scaleFactor;
              newState.width *= scaleFactor;
              newState.height *= scaleFactor;
              
              // Font size is in styles, need to parse?
              // serializeTextWrapper stores styles.fontSize as string "14px"
              if (newState.styles && newState.styles.fontSize) {
                  const oldSize = parseFloat(newState.styles.fontSize);
                  newState.styles.fontSize = `${oldSize * scaleFactor}px`;
              }
              
              this.restoreTextWrapper(newState);
          });
      }
  }
  
  clear() {
      this.canvases.forEach(canvas => {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
      this.history = [];
      this.historyStep = -1;
      this.textWrappers.forEach(w => w.remove());
      this.textWrappers = [];
  }
}

window.AnnotationManager = AnnotationManager;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AnnotationManager;
}
