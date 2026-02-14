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

// JemaOS Gallery - PDF Viewer

// Ensure worker is set
if (typeof pdfjsLib !== 'undefined') {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    // Tune image resources path for annotations
    if (!pdfjsLib.GlobalWorkerOptions.imageResourcesPath) {
        pdfjsLib.GlobalWorkerOptions.imageResourcesPath = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/images/';
    }
}

/**
 * Handles PDF viewing experience using PDF.js
 * 
 * ZOOM ARCHITECTURE (Adobe Reader Style):
 * ========================================
 * 1. Canvases are rendered ONCE at a fixed high resolution (BASE_RENDER_SCALE)
 * 2. Zoom is achieved purely through CSS transform: scale() on the container
 * 3. NO canvas re-rendering during zoom - only CSS changes
 * 4. NO layout changes during zoom - wrapper dimensions are updated via CSS
 * 5. Re-render only when zoom stops AND quality is significantly degraded
 */

class PdfViewer {
  // Fixed render scale - canvases are always rendered at this resolution
  static BASE_RENDER_SCALE = 1.5;
  static MAX_ZOOM = 5.0;
  static MIN_ZOOM = 0.2;

  constructor(fileHandler, uiController) {
    this.fileHandler = fileHandler;
    this.uiController = uiController;
    
    this.currentFile = null;
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    
    // Zoom state - this.scale is the VISUAL zoom level (what user sees)
    // Canvases are always rendered at BASE_RENDER_SCALE
    this.scale = 1.0;
    this.rotation = 0;
    
    this.canvas = null;
    this.ctx = null;
    this.isOpen = false;
    this.isEditMode = false;
    this.isTextEditMode = false;
    this.isSpaceHeld = false;
    
    this.elements = {};
    
    this.annotationManager = null;
    this.textEditor = null;
    this.activeRenderTasks = new Map();
    this.activeThumbnailRenderTasks = new Map();
    
    // Optimization: Track loaded pages for memory cleanup
    this.loadedPages = new Map();
    
    // Optimization: Render queue
    this.renderQueue = new Set();
    this.isProcessingQueue = false;

    // Page dimensions at scale=1.0 (base dimensions)
    this.basePageHeights = [];
    this.basePageWidths = [];
    this.pageTops = []; // Cache for page top positions
    
    this.lastActivePage = null; // Track last active page for efficient updates

    // Debounce timer for quality re-render
    this.qualityRenderTimeout = null;
    this.zoomRenderTimeout = null;
    this.isZooming = false;

    // Fast scroll optimization
    this.isFastScrolling = false;
    this.scrollEndTimeout = null;
  }

  /**
   * Initialize PDF viewer
   */
  init() {
    this.cacheElements();
    this.setupEventListeners();
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      viewer: document.getElementById('pdf-viewer'),
      container: document.getElementById('pdf-canvas-container'),
      filename: document.getElementById('pdf-filename'),
      pageNum: document.getElementById('pdf-page-num'),
      prevPageBtn: document.getElementById('pdf-prev-page'),
      nextPageBtn: document.getElementById('pdf-next-page'),
      pageCount: document.getElementById('pdf-page-count'),
      zoomLevel: document.getElementById('pdf-zoom-level'),
      
      // Default Toolbar
      defaultToolbar: document.getElementById('pdf-default-toolbar'),
      close: document.getElementById('pdf-close'),
      zoomIn: document.getElementById('pdf-zoom-in'),
      zoomOut: document.getElementById('pdf-zoom-out'),
      rotate: document.getElementById('pdf-rotate'),
      sidebarToggle: document.getElementById('pdf-sidebar-toggle'),
      sidebar: document.getElementById('pdf-sidebar'),
      editModeBtn: document.getElementById('pdf-edit-mode'),
      
      // Edit Toolbar
      editToolbar: document.getElementById('pdf-edit-toolbar'),
      exitEditBtn: document.getElementById('pdf-exit-edit'),
      undoEditBtn: document.getElementById('pdf-undo-edit'),
      redoEditBtn: document.getElementById('pdf-redo-edit'),
      editZoomIn: document.getElementById('pdf-edit-zoom-in'),
      editZoomOut: document.getElementById('pdf-edit-zoom-out'),
      editZoomLevel: document.getElementById('pdf-edit-zoom-level'),
      
      // Text Edit Button
      textEditBtn: document.getElementById('pdf-text-edit'),
      
      // Properties Sidebar
      propertiesSidebar: document.getElementById('pdf-properties-sidebar'),
      propertiesContainer: document.getElementById('pdf-properties-container'),
      
      // Split Save Button (Sidebar)
      saveSplitBtn: document.getElementById('pdf-save-split'),
      saveOptionsBtn: document.getElementById('pdf-save-options'),
      saveDropdown: document.getElementById('pdf-save-dropdown'),
      saveAsSplitBtn: document.getElementById('pdf-save-as-split'),

      // Split Save Button (Toolbar)
      toolbarSaveSplitBtn: document.getElementById('pdf-toolbar-save-split'),
      toolbarSaveOptionsBtn: document.getElementById('pdf-toolbar-save-options'),
      toolbarSaveDropdown: document.getElementById('pdf-toolbar-save-dropdown'),
      toolbarSaveAsSplitBtn: document.getElementById('pdf-toolbar-save-as-split'),
      
      // Fit buttons
      fitWidth: document.getElementById('pdf-fit-width'),
      fitPage: document.getElementById('pdf-fit-page'),
      
      // Main scrollable container
      main: document.getElementById('pdf-main'),
      zoomWrapper: document.getElementById('pdf-zoom-wrapper'),
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    this.setupPanning();
    this.setupBasicControls();
    this.setupNavigationControls();
    this.setupEditModeControls();
    this.setupKeyboardShortcuts();
    this.setupResizeHandling();
    this.setupWheelZoom();
  }

  /**
   * Setup basic control buttons (zoom, rotate, fit, sidebar)
   */
  setupBasicControls() {
    if (this.elements.close) {
      this.elements.close.addEventListener('click', () => this.close());
    }
    
    this.elements.zoomIn.addEventListener('click', () => this.zoomIn());
    this.elements.zoomOut.addEventListener('click', () => this.zoomOut());
    
    if (this.elements.editZoomIn) {
        this.elements.editZoomIn.addEventListener('click', () => this.zoomIn());
    }
    if (this.elements.editZoomOut) {
        this.elements.editZoomOut.addEventListener('click', () => this.zoomOut());
    }

    if (this.elements.rotate) {
        this.elements.rotate.addEventListener('click', () => this.rotate());
    }
    
    if (this.elements.fitWidth) {
      this.elements.fitWidth.addEventListener('click', () => this.fitToWidth());
    }
    if (this.elements.fitPage) {
      this.elements.fitPage.addEventListener('click', () => this.fitToPage());
    }
    
    this.elements.sidebarToggle.addEventListener('click', () => this.handleSidebarToggle());
    
    // Layout (Grid View) - Map to Sidebar Toggle
    const layoutBtn = document.getElementById('pdf-layout');
    if (layoutBtn) {
        layoutBtn.addEventListener('click', () => {
            this.elements.sidebar.classList.toggle('hidden');
        });
    }

    // Info
    const infoBtn = document.getElementById('pdf-info');
    if (infoBtn) {
        infoBtn.addEventListener('click', () => this.handleInfoClick());
    }

    // Print
    const printBtn = document.getElementById('pdf-print');
    if (printBtn) {
        printBtn.addEventListener('click', () => this.handlePrintClick());
    }
  }

  /**
   * Handle sidebar toggle click
   */
  handleSidebarToggle() {
    this.elements.sidebar.classList.toggle('hidden');
    if (!this.elements.sidebar.classList.contains('hidden')) {
        // Sidebar is now open, scroll to active thumbnail
        requestAnimationFrame(() => {
            const currentThumbnail = this.thumbnailWrappers[this.pageNum];
            if (currentThumbnail) {
                currentThumbnail.scrollIntoView({ behavior: 'auto', block: 'center' });
            }
        });
    }
  }

  /**
   * Handle info button click
   */
  handleInfoClick() {
    if (this.currentFile) {
        const ui = this.uiController || globalThis.galleryUI;
        if (ui) ui.showFileModal(this.currentFile);
    }
  }

  /**
   * Handle print button click
   */
  handlePrintClick() {
    if (this.currentFile) {
        GalleryUtils.printFile(this.currentFile.url, 'pdf');
    }
  }

  /**
   * Setup navigation controls (page number, prev/next)
   */
  setupNavigationControls() {
    this.elements.pageNum.addEventListener('change', (e) => this.handlePageNumChange(e));

    if (this.elements.prevPageBtn) {
        this.elements.prevPageBtn.addEventListener('click', () => this.onPrevPage());
    }

    if (this.elements.nextPageBtn) {
        this.elements.nextPageBtn.addEventListener('click', () => this.onNextPage());
    }
  }

  /**
   * Handle page number input change
   */
  handlePageNumChange(e) {
    const num = Number.parseInt(e.target.value);
    if (num >= 1 && num <= this.pdfDoc.numPages) {
      this.scrollToPage(num);
    } else {
      this.elements.pageNum.value = this.pageNum;
    }
  }

  /**
   * Setup edit mode controls
   */
  setupEditModeControls() {
    if (this.elements.editModeBtn) {
        this.elements.editModeBtn.addEventListener('click', () => this.toggleEditMode(true));
    }

    if (this.elements.exitEditBtn) {
        this.elements.exitEditBtn.addEventListener('click', () => this.toggleEditMode(false));
    }

    if (this.elements.undoEditBtn) {
        this.elements.undoEditBtn.addEventListener('click', () => this.handleUndo());
    }
    
    if (this.elements.redoEditBtn) {
        this.elements.redoEditBtn.addEventListener('click', () => this.handleRedo());
    }

    // Tool Buttons
    const toolBtns = this.elements.editToolbar.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => this.setTool(btn.dataset.tool));
    });

    // Split Save Button
    this.setupSplitButton();
  }

  /**
   * Handle undo action
   */
  handleUndo() {
    if (this.isTextEditMode && this.textEditor) {
        this.textEditor.undo();
    } else if (this.annotationManager) {
        this.annotationManager.undo();
    }
  }

  /**
   * Handle redo action
   */
  handleRedo() {
    if (this.isTextEditMode && this.textEditor) {
        this.textEditor.redo();
    } else if (this.annotationManager) {
        this.annotationManager.redo();
    }
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    document.addEventListener('keyup', (e) => this.handleKeyUp(e));
  }

  /**
   * Handle keydown events
   */
  handleKeyDown(e) {
    if (!this.isOpen) return;
    
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    if (e.key === ' ' && !this.isSpaceHeld) {
        this.isSpaceHeld = true;
        this.updateCursor();
    }

    this.handleNavigationKeys(e);
    this.handleEditKeys(e);
  }

  /**
   * Handle navigation keys
   */
  handleNavigationKeys(e) {
    if (e.key === 'Escape') {
      if (this.isEditMode) {
          this.toggleEditMode(false);
      } else {
          this.close();
      }
    } else if (e.key === 'ArrowLeft') {
      this.onPrevPage();
    } else if (e.key === 'ArrowRight') {
      this.onNextPage();
    }
  }

  /**
   * Handle edit mode keys (undo/redo)
   */
  handleEditKeys(e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!this.annotationManager) return;
        
        if (e.shiftKey) {
            this.annotationManager.redo();
        } else {
            this.annotationManager.undo();
        }
    }
  }

  /**
   * Handle keyup events
   */
  handleKeyUp(e) {
    if (e.key === ' ') {
        this.isSpaceHeld = false;
        this.updateCursor();
    }
  }

  /**
   * Setup resize handling
   */
  setupResizeHandling() {
    globalThis.addEventListener('resize', () => this.onWindowResize());

    if (this.elements.main) {
        this.resizeObserver = new ResizeObserver(() => {
            globalThis.requestAnimationFrame(() => this.onWindowResize());
        });
        this.resizeObserver.observe(this.elements.main);
    }
  }

  /**
   * Setup wheel zoom
   */
  setupWheelZoom() {
    if (!this.elements.viewer) return;
    
    this.elements.viewer.addEventListener('wheel', (e) => this.handleWheelZoom(e), { passive: false });
  }

  /**
   * Handle wheel zoom events
   */
  handleWheelZoom(e) {
    if (!e.ctrlKey) return;
    
    e.preventDefault();
    
    const main = this.elements.main;
    const container = this.elements.container;
    
    if (!main || !container) return;

    const { contentX, contentY, mouseX, mouseY } = this.calculateZoomFocalPoint(e, main);
    const newScale = this.calculateNewScale(e);
    
    if (Math.abs(newScale - this.scale) < 0.001) return;
    
    this.setZoom(newScale, contentX, contentY, mouseX, mouseY);
  }

  /**
   * Calculate focal point for zoom
   */
  calculateZoomFocalPoint(e, main) {
    const mainRect = main.getBoundingClientRect();
    const mouseX = e.clientX - mainRect.left;
    const mouseY = e.clientY - mainRect.top;
    
    const contentX = (main.scrollLeft + mouseX) / this.scale;
    const contentY = (main.scrollTop + mouseY) / this.scale;
    
    return { contentX, contentY, mouseX, mouseY };
  }

  /**
   * Calculate new scale from wheel event
   */
  calculateNewScale(e) {
    const delta = -e.deltaY;
    const factor = Math.pow(1.01, delta);
    const newScale = this.scale * factor;
    return Math.max(PdfViewer.MIN_ZOOM, Math.min(PdfViewer.MAX_ZOOM, newScale));
  }

  /**
   * Setup panning (drag-to-scroll)
   */
  setupPanning() {
      const main = this.elements.main;
      if (!main) return;

      let isDragging = false;
      let startX, startY, scrollLeft, scrollTop;

      main.addEventListener('mousedown', (e) => {
          if (this.isEditMode || this.isTextEditMode) return;
          if (e.button !== 0) return;
          if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(e.target.tagName)) return;
          if (!this.isSpaceHeld) return;

          const canScrollX = main.scrollWidth > main.clientWidth;
          const canScrollY = main.scrollHeight > main.clientHeight;
          
          if (!canScrollX && !canScrollY) return;

          isDragging = true;
          main.classList.add('grabbing');
          main.classList.remove('grab');
          
          startX = e.pageX - main.offsetLeft;
          startY = e.pageY - main.offsetTop;
          scrollLeft = main.scrollLeft;
          scrollTop = main.scrollTop;
          
          e.preventDefault();
      });

      main.addEventListener('mouseleave', () => {
          isDragging = false;
          main.classList.remove('grabbing');
      });

      main.addEventListener('mouseup', () => {
          isDragging = false;
          main.classList.remove('grabbing');
          if (this.isSpaceHeld) {
              main.classList.add('grab');
          }
      });

      main.addEventListener('mousemove', (e) => {
          if (!isDragging) return;
          
          e.preventDefault();
          const x = e.pageX - main.offsetLeft;
          const y = e.pageY - main.offsetTop;
          
          const walkX = (x - startX);
          const walkY = (y - startY);
          
          main.scrollLeft = scrollLeft - walkX;
          main.scrollTop = scrollTop - walkY;
      });
  }

  /**
   * Update cursor based on state
   */
  updateCursor() {
      const main = this.elements.main;
      if (!main) return;

      if (this.isEditMode || this.isTextEditMode) {
          main.classList.remove('grab', 'grabbing');
          main.style.cursor = '';
          return;
      }

      if (this.isSpaceHeld) {
          main.classList.add('grab');
      } else {
          main.classList.remove('grab', 'grabbing');
      }
  }

  setupSplitButton() {
      if (this.elements.saveSplitBtn) {
          this.elements.saveSplitBtn.addEventListener('click', () => this.save());
      }
      
      if (this.elements.saveOptionsBtn) {
          this.elements.saveOptionsBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.elements.saveDropdown.classList.toggle('show');
          });
      }
      
      if (this.elements.saveAsSplitBtn) {
          this.elements.saveAsSplitBtn.addEventListener('click', () => {
              this.saveAs();
              this.elements.saveDropdown.classList.remove('show');
          });
      }

      if (this.elements.toolbarSaveSplitBtn) {
          this.elements.toolbarSaveSplitBtn.addEventListener('click', () => this.save());
      }
      
      if (this.elements.toolbarSaveOptionsBtn) {
          this.elements.toolbarSaveOptionsBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              this.elements.toolbarSaveDropdown.classList.toggle('show');
          });
      }
      
      if (this.elements.toolbarSaveAsSplitBtn) {
          this.elements.toolbarSaveAsSplitBtn.addEventListener('click', () => {
              this.saveAs();
              this.elements.toolbarSaveDropdown.classList.remove('show');
          });
      }
      
      document.addEventListener('click', (e) => {
          if (this.elements.saveDropdown?.classList.contains('show')) {
              if (!this.elements.saveOptionsBtn.contains(e.target) && !this.elements.saveDropdown.contains(e.target)) {
                  this.elements.saveDropdown.classList.remove('show');
              }
          }
          if (this.elements.toolbarSaveDropdown?.classList.contains('show')) {
              if (!this.elements.toolbarSaveOptionsBtn.contains(e.target) && !this.elements.toolbarSaveDropdown.contains(e.target)) {
                  this.elements.toolbarSaveDropdown.classList.remove('show');
              }
          }
      });
  }

  /**
   * Toggle Edit Mode
   */
  async toggleEditMode(active, tool = 'pen') {
      this.isEditMode = active;

      if (active) {
          await this.activateEditMode(tool);
      } else {
          await this.deactivateEditMode();
      }
      
      this.updateCursor();
  }

  /**
   * Activate edit mode
   */
  async activateEditMode(tool) {
      const loaded = await this.loadAnnotationManager();
      if (!loaded) return;

      this.showEditModeUI();
      
      const targets = this.collectAnnotationTargets();
      if (targets.length === 0) {
          this.uiController.showToast('Impossible d\'annoter : aucun document chargé', 'error');
          this.toggleEditMode(false);
          return;
      }

      this.annotationManager.start(targets, null, {
          propertiesContainer: this.elements.propertiesContainer
      });
      
      if (tool) {
          await this.setTool(tool);
      }
  }

  /**
   * Load annotation manager if needed
   */
  async loadAnnotationManager() {
      if (this.annotationManager) return true;

      this.uiController.showLoading(true);
      try {
          await globalThis.loadScript('scripts/annotation-manager.js');
          
          if (typeof AnnotationManager === 'undefined') {
              const loaded = await this.waitForAnnotationManager();
              if (!loaded) {
                  throw new Error('AnnotationManager class not found after loading script');
              }
          }

          this.annotationManager = new AnnotationManager(this.uiController);
          this.uiController.showLoading(false);
          return true;
      } catch (e) {
          console.error('Failed to load annotation manager', e);
          this.uiController.showToast('Erreur de chargement des outils d\'édition', 'error');
          this.uiController.showLoading(false);
          this.isEditMode = false;
          return false;
      }
  }

  /**
   * Wait for AnnotationManager to be available
   */
  async waitForAnnotationManager() {
      let retries = 0;
      while (typeof AnnotationManager === 'undefined' && retries < 50) {
          await new Promise(resolve => setTimeout(resolve, 50));
          retries++;
      }
      return typeof AnnotationManager !== 'undefined';
  }

  /**
   * Show edit mode UI
   */
  showEditModeUI() {
      this.elements.defaultToolbar.classList.add('hidden');
      this.elements.editToolbar.classList.remove('hidden');
      this.elements.propertiesSidebar.classList.remove('hidden');
  }

  /**
   * Collect annotation targets from page wrappers
   */
  collectAnnotationTargets() {
      const targets = [];
      if (!this.pageWrappers) return targets;

      Object.values(this.pageWrappers).forEach(wrapper => {
          if (!wrapper) return;
          const canvas = wrapper.querySelector('canvas');
          if (canvas) {
              targets.push({
                  container: wrapper,
                  target: canvas,
                  id: Number.parseInt(wrapper.dataset.pageNumber)
              });
          }
      });
      return targets;
  }

  /**
   * Deactivate edit mode
   */
  async deactivateEditMode() {
      this.elements.defaultToolbar.classList.remove('hidden');
      this.elements.editToolbar.classList.add('hidden');
      this.elements.propertiesSidebar.classList.add('hidden');
      
      if (this.annotationManager) this.annotationManager.stop();
      
      if (this.textEditor) {
          this.textEditor.stop();
          this.isTextEditMode = false;
      }
  }

  async setTool(toolId) {
      if (toolId === 'text-edit') {
          await this.toggleTextEditMode(true);
          
          const toolBtns = this.elements.editToolbar.querySelectorAll('.tool-btn');
          toolBtns.forEach(btn => {
              if (btn.dataset.tool === toolId) {
                  btn.classList.add('active');
                  btn.style.backgroundColor = 'rgba(101, 105, 208, 0.2)';
                  btn.style.color = '#6569d0';
              } else {
                  btn.classList.remove('active');
                  btn.style.backgroundColor = '';
                  btn.style.color = '';
              }
          });
          return;
      }
      
      if (this.isTextEditMode) {
          await this.toggleTextEditMode(false);
          
          if (this.elements.propertiesContainer && this.annotationManager) {
              this.annotationManager.renderProperties(this.elements.propertiesContainer);
          }
      }
      
      if (this.annotationManager) this.annotationManager.setTool(toolId);
      
      const toolBtns = this.elements.editToolbar.querySelectorAll('.tool-btn');
      toolBtns.forEach(btn => {
          if (btn.dataset.tool === toolId) {
              btn.classList.add('active');
              btn.style.backgroundColor = 'rgba(101, 105, 208, 0.2)';
              btn.style.color = '#6569d0';
          } else {
              btn.classList.remove('active');
              btn.style.backgroundColor = '';
              btn.style.color = '';
          }
      });
  }

  /**
   * Toggle Text Edit Mode (OCR-based text editing)
   */
  async toggleTextEditMode(active) {
      this.isTextEditMode = active;
      
      if (active) {
          await this.activateTextEditMode();
      } else {
          await this.deactivateTextEditMode();
      }
      
      this.updateCursor();
  }

  /**
   * Activate text edit mode
   */
  async activateTextEditMode() {
      const loaded = await this.loadTextEditor();
      if (!loaded) return;
      
      if (this.annotationManager) {
          this.annotationManager.pause();
      }
      
      await this.textEditor.startTextEditMode(this.pageNum);
      
      if (this.elements.propertiesContainer) {
          this.textEditor.renderLanguageSelector(this.elements.propertiesContainer);
      }
      
      this.showTextEditIndicator();
  }

  /**
   * Load text editor if needed
   */
  async loadTextEditor() {
      if (this.textEditor) return true;

      this.uiController.showLoading(true);
      try {
          await globalThis.loadScript('scripts/pdf-text-editor.js');
          
          if (typeof PdfTextEditor === 'undefined') {
              const loaded = await this.waitForTextEditor();
              if (!loaded) {
                  throw new Error('PdfTextEditor class not found after loading script');
              }
          }

          this.textEditor = new PdfTextEditor(this);
          this.uiController.showLoading(false);
          return true;
      } catch (e) {
          console.error('Failed to load text editor:', e);
          this.uiController.showToast('Erreur de chargement de l\'éditeur de texte', 'error');
          this.uiController.showLoading(false);
          this.isTextEditMode = false;
          return false;
      }
  }

  /**
   * Wait for PdfTextEditor to be available
   */
  async waitForTextEditor() {
      let retries = 0;
      while (typeof PdfTextEditor === 'undefined' && retries < 50) {
          await new Promise(resolve => setTimeout(resolve, 50));
          retries++;
      }
      return typeof PdfTextEditor !== 'undefined';
  }

  /**
   * Deactivate text edit mode
   */
  async deactivateTextEditMode() {
      if (this.textEditor) {
          this.textEditor.stop();
      }
      
      if (this.annotationManager) {
          this.annotationManager.resume();
      }
      
      this.hideTextEditIndicator();
  }

  showTextEditIndicator() {
      let indicator = document.getElementById('text-edit-indicator');
      if (!indicator) {
          indicator = document.createElement('div');
          indicator.id = 'text-edit-indicator';
          indicator.className = 'pdf-edit-mode-indicator';
          indicator.innerHTML = `
              <i class="material-icons">edit_note</i>
              <span>Mode Édition de Texte - Cliquez sur le texte pour le modifier</span>
          `;
          document.body.appendChild(indicator);
      }
      indicator.style.display = 'flex';
  }

  hideTextEditIndicator() {
      const indicator = document.getElementById('text-edit-indicator');
      if (indicator) {
          indicator.style.display = 'none';
      }
  }

  /**
   * Open PDF file
   */
  async open(file, options = {}) {
    this.currentFile = file;
    this.isOpen = true;
    
    this.applyOpenOptions(options);
    this.resetEditMode();
    this.showViewerUI(file.name);
    
    try {
      await this.loadPdfDocument(file);
    } catch (error) {
      console.error('Error loading PDF:', error);
      this.uiController.showToast('Erreur lors du chargement du fichier PDF', 'error');
    }
  }

  /**
   * Apply options when opening PDF
   */
  applyOpenOptions(options) {
    if (!options.preserveState) {
      this.pageNum = 1;
      this.scale = 1.0;
      this.rotation = 0;
    } else {
      if (options.pageNum) this.pageNum = options.pageNum;
      if (options.scale) this.scale = options.scale;
      if (options.rotation !== undefined) this.rotation = options.rotation;
    }
  }

  /**
   * Reset edit mode state
   */
  resetEditMode() {
    this.isEditMode = false;
  }

  /**
   * Show viewer UI elements
   */
  showViewerUI(filename) {
    this.elements.viewer.classList.remove('hidden');
    setTimeout(() => {
      this.elements.viewer.classList.add('active');
    }, 10);
    
    this.elements.defaultToolbar.classList.remove('hidden');
    this.elements.editToolbar.classList.add('hidden');
    this.elements.propertiesSidebar.classList.add('hidden');
    
    this.elements.filename.textContent = filename;
  }

  /**
   * Load PDF document
   */
  async loadPdfDocument(file) {
    const loadingTask = pdfjsLib.getDocument({
      url: file.url,
      password: '',
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
      cMapPacked: true,
    });
    
    loadingTask.onPassword = (updatePassword, reason) => {
      if (reason === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
        updatePassword('');
      }
    };

    this.pdfDoc = await loadingTask.promise;
    
    if (!this.pdfDoc) return;
    
    this.elements.pageCount.textContent = this.pdfDoc.numPages;
    
    const options = arguments[1] || {};
    if (!options.preserveState || !options.scale) {
      await this.calculateInitialScale();
    }
    
    await this.render();
    
    if (options.preserveState && options.scrollTop !== undefined) {
      this.restoreScrollPosition(options.scrollTop, options.scrollLeft);
    }

    this.renderThumbnails();
  }

  /**
   * Restore scroll position
   */
  restoreScrollPosition(scrollTop, scrollLeft) {
    const main = document.getElementById('pdf-main');
    if (!main) return;
    
    setTimeout(() => {
      main.scrollTop = scrollTop;
      main.scrollLeft = scrollLeft;
    }, 0);
  }

  /**
   * Close viewer
   */
  async close() {
    this.cancelAllRenders();
    await this.saveChangesIfNeeded();

    this.isOpen = false;
    this.toggleEditMode(false);
    
    this.cleanupObservers();
    await this.cleanupTextEditor();
    this.hideViewerUI();
    this.cleanupSingleFile();
  }

  /**
   * Cancel all render tasks
   */
  cancelAllRenders() {
    if (this.activeRenderTasks) {
      this.activeRenderTasks.forEach(task => task.cancel());
      this.activeRenderTasks.clear();
    }
    this.cancelAllThumbnailRenders();
  }

  /**
   * Save changes if needed
   */
  async saveChangesIfNeeded() {
    const hasTextChanges = this.textEditor?.hasChanges();
    const hasAnnotationChanges = this.annotationManager?.hasChanges();
    
    if (hasTextChanges || hasAnnotationChanges || this.rotation !== 0) {
      await this.save();
    }
  }

  /**
   * Cleanup all observers
   */
  cleanupObservers() {
    const observers = [
      { name: 'resizeObserver', obj: this.resizeObserver },
      { name: 'observer', obj: this.observer },
      { name: 'lazyLoadObserver', obj: this.lazyLoadObserver },
      { name: 'thumbnailObserver', obj: this.thumbnailObserver }
    ];

    observers.forEach(({ name, obj }) => {
      if (obj) {
        obj.disconnect();
        this[name] = null;
      }
    });
  }

  /**
   * Cleanup text editor
   */
  async cleanupTextEditor() {
    if (this.textEditor) {
      await this.textEditor.destroy();
      this.textEditor = null;
    }
  }

  /**
   * Hide viewer UI
   */
  hideViewerUI() {
    this.elements.viewer.classList.remove('active');
    setTimeout(() => {
      this.elements.viewer.classList.add('hidden');
      this.elements.container.innerHTML = '';
    }, 300);
  }

  /**
   * Cleanup single file if only one file exists
   */
  cleanupSingleFile() {
    if (!this.uiController?.fileHandler) return;
    
    const { fileHandler } = this.uiController;
    if (fileHandler.files.length === 1) {
      const files = fileHandler.files;
      if (files.length > 0) {
        fileHandler.removeFile(files[0].id);
        this.uiController.renderFiles();
      }
    }
  }

  /**
   * Generate PDF Blob with changes
   */
  async generatePdfBlob() {
      const arrayBuffer = await fetch(this.currentFile.url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      
      await this.applyRotation(pdfDoc);
      await this.applyTextChanges(pdfDoc);
      this.finalizeAnnotationInput();
      await this.applyAnnotationChanges(pdfDoc);
      
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  /**
   * Apply rotation to all pages
   */
  async applyRotation(pdfDoc) {
      if (this.rotation === 0) return;
      
      const pages = pdfDoc.getPages();
      pages.forEach(page => {
          const rotation = page.getRotation();
          const currentAngle = typeof rotation === 'object' ? rotation.angle : rotation;
          page.setRotation(PDFLib.degrees(currentAngle + this.rotation));
      });
  }

  /**
   * Apply text editor changes
   */
  async applyTextChanges(pdfDoc) {
      if (!this.textEditor?.hasChanges()) return;
      
      await this.textEditor.applyChangesToPdf(pdfDoc);
      this.textEditor.clearPendingChanges();
  }

  /**
   * Finalize annotation text input
   */
  finalizeAnnotationInput() {
      if (this.annotationManager?.activeInput) {
          this.annotationManager.finalizeTextInput();
      }
  }

  /**
   * Apply annotation changes to PDF
   */
  async applyAnnotationChanges(pdfDoc) {
      if (!this.annotationManager?.hasChanges()) return;
      
      const pages = pdfDoc.getPages();
      for (let i = 0; i < pages.length; i++) {
          await this.embedAnnotationOnPage(pdfDoc, pages[i], i + 1);
      }
  }

  /**
   * Embed annotation image on a specific page
   */
  async embedAnnotationOnPage(pdfDoc, page, pageNum) {
      const wrapper = this.pageWrappers[pageNum];
      if (!wrapper) return;
      
      const annotationCanvas = wrapper.querySelector('.annotation-canvas');
      if (!annotationCanvas) return;
      
      const imageBytes = this.createAnnotationImage(annotationCanvas, wrapper);
      if (!imageBytes) return;
      
      const image = await pdfDoc.embedPng(imageBytes);
      const { width, height } = page.getSize();
      
      page.drawImage(image, {
          x: 0,
          y: 0,
          width: width,
          height: height,
      });
  }

  /**
   * Create annotation image from canvas
   */
  createAnnotationImage(annotationCanvas, wrapper) {
      if (annotationCanvas.width === 0 || annotationCanvas.height === 0) return null;
      
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = annotationCanvas.width;
      tempCanvas.height = annotationCanvas.height;
      const ctx = tempCanvas.getContext('2d');
      
      ctx.drawImage(annotationCanvas, 0, 0);
      this.annotationManager.drawTextObjects(ctx, wrapper);
      
      return tempCanvas.toDataURL('image/png');
  }

  /**
   * Refresh preview with current changes without saving to disk
   */
  async refreshPreview() {
      if (!this.currentFile) return;

      const currentScale = this.scale;
      const currentPage = this.pageNum;
      const main = document.getElementById('pdf-main');
      const scrollTop = main ? main.scrollTop : 0;
      const scrollLeft = main ? main.scrollLeft : 0;

      const wasEditMode = this.isEditMode;
      let activeTool = null;
      if (wasEditMode) {
          const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
          if (activeToolBtn) {
              activeTool = activeToolBtn.dataset.tool;
          }
      }

      try {
          this.uiController.showLoading(true);
          
          const blob = await this.generatePdfBlob();
          
          if (this.previewUrl) {
              URL.revokeObjectURL(this.previewUrl);
          }
          
          this.previewUrl = URL.createObjectURL(blob);
          this.currentFile.url = this.previewUrl;
          
          this.rotation = 0;
          if (this.annotationManager) this.annotationManager.clear();
          
          await this.open(this.currentFile, {
              preserveState: true,
              scale: currentScale,
              pageNum: currentPage,
              scrollTop: scrollTop,
              scrollLeft: scrollLeft,
              rotation: 0
          });
          
          if (wasEditMode) {
              await this.toggleEditMode(true);
              if (activeTool) {
                  this.setTool(activeTool);
              }
          }
          
          this.uiController.showLoading(false);
          
      } catch (error) {
          console.error('Error refreshing preview:', error);
          this.uiController.showToast('Erreur lors de la mise à jour de l\'aperçu', 'error');
          this.uiController.showLoading(false);
      }
  }

  /**
   * Get current save state (edit mode info, scroll position, etc.)
   */
  getSaveState() {
    const wasEditMode = this.isEditMode;
    let activeTool = null;
    if (wasEditMode) {
        const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
        if (activeToolBtn) {
            activeTool = activeToolBtn.dataset.tool;
        }
    }

    const main = document.getElementById('pdf-main');
    return {
        wasEditMode,
        activeTool,
        currentScale: this.scale,
        currentPage: this.pageNum,
        scrollTop: main ? main.scrollTop : 0,
        scrollLeft: main ? main.scrollLeft : 0
    };
  }

  /**
   * Handle successful save - restore state and UI
   */
  async handleSaveSuccess(state) {
    this.uiController.showToast('PDF enregistré', 'success');
    this.rotation = 0;
    if (this.annotationManager) this.annotationManager.clear();
    
    await this.open(this.currentFile, {
        preserveState: true,
        scale: state.currentScale,
        pageNum: state.currentPage,
        scrollTop: state.scrollTop,
        scrollLeft: state.scrollLeft,
        rotation: 0
    });
    
    if (state.wasEditMode) {
        await this.toggleEditMode(true);
        if (state.activeTool) {
            this.setTool(state.activeTool);
        }
    }
  }

  /**
   * Save changes to PDF
   */
  async save() {
    if (!this.currentFile) return;

    const state = this.getSaveState();

    try {
        this.uiController.showToast('Enregistrement du PDF...', 'info');
        
        const blob = await this.generatePdfBlob();
        const success = await this.fileHandler.saveFile(this.currentFile, blob);
        
        if (success) {
            await this.handleSaveSuccess(state);
        } else {
            this.saveAs(blob);
        }
        
    } catch (error) {
        console.error('Error saving PDF:', error);
        this.uiController.showToast('Erreur lors de l\'enregistrement', 'error');
    }
  }

  /**
   * Save PDF as new file
   */
  async saveAs(blob = null) {
      if (!this.currentFile) return;

      try {
          if (!blob) {
              this.uiController.showToast('Préparation du fichier...', 'info');
              blob = await this.generatePdfBlob();
          }

          const newFile = await this.fileHandler.saveFileAs(this.currentFile, blob);
          
          if (newFile) {
              this.uiController.showToast('Fichier enregistré', 'success');
              this.open(newFile);
          }
      } catch (error) {
          console.error('Error saving PDF as:', error);
          this.uiController.showToast('Erreur lors de l\'enregistrement', 'error');
      }
  }

  /**
   * Cancel all active page renders
   */
  cancelAllPageRenders() {
      if (this.activeRenderTasks) {
          this.activeRenderTasks.forEach(task => {
              try {
                  task.cancel();
              } catch (e) { /* ignore */ }
          });
          this.activeRenderTasks.clear();
      }
      
      // Clear pending queue
      if (this.renderQueue) {
          this.renderQueue.clear();
      }
  }

  /**
   * Render all pages
   * Pages are rendered at BASE_RENDER_SCALE, then CSS transform is used for visual zoom
   */
  async render() {
    this.pageRendering = true;

    try {
        // Cancel all active renders
        this.cancelAllPageRenders();
        
        // Get base dimensions from first page
        const firstPage = await this.pdfDoc.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1, rotation: this.rotation });
        
        // Initialize base page dimensions (at scale=1.0)
        this.basePageHeights = new Array(this.pdfDoc.numPages + 1).fill(baseViewport.height);
        this.basePageWidths = new Array(this.pdfDoc.numPages + 1).fill(baseViewport.width);
        
        // Calculate page tops (prefix sums)
        this.pageTops = new Array(this.pdfDoc.numPages + 1).fill(0);
        let currentTop = 0;
        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            this.pageTops[i] = currentTop;
            currentTop += this.basePageHeights[i];
        }

        // Ensure zoom wrapper exists
        if (!this.elements.zoomWrapper) {
            this.elements.zoomWrapper = document.getElementById('pdf-zoom-wrapper');
            if (!this.elements.zoomWrapper && this.elements.main) {
                this.elements.zoomWrapper = document.createElement('div');
                this.elements.zoomWrapper.id = 'pdf-zoom-wrapper';
                this.elements.main.appendChild(this.elements.zoomWrapper);
                this.elements.zoomWrapper.appendChild(this.elements.container);
            }
        }
        
        // Calculate total content size at base scale (scale=1.0)
        const totalBaseHeight = this.basePageHeights.slice(1).reduce((a, b) => a + b, 0);
        const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
        
        // Container holds content at BASE_RENDER_SCALE (for high-res canvases)
        // But we position pages as if at scale=1.0, then use CSS transform on container
        this.elements.container.style.width = `${maxBaseWidth}px`;
        this.elements.container.style.height = `${totalBaseHeight}px`;
        this.elements.container.style.position = 'absolute';
        this.elements.container.style.top = '0';
        this.elements.container.style.left = '0';
        
        // Apply CSS transform for current zoom level
        this.applyZoomTransform();
        
        // Clear and recreate page wrappers
        this.pageWrappers = {};
        this.elements.container.innerHTML = '';
        
        // Update UI
        this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        if (this.elements.editZoomLevel) {
            this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
        }

        // Setup Virtual Scroll
        this.setupVirtualScroll();
        
        // Initial render of visible pages
        await this.updateVisiblePages();
        
        this.updateCursor();
        
        if (this.observer) this.observer.disconnect();

    } catch (error) {
        console.error('Error in render():', error);
    } finally {
        this.pageRendering = false;
        
        if (this.renderPending) {
            this.renderPending = false;
            this.render();
        }
    }
  }

  /**
   * Apply CSS transform for zoom
   * This is the ONLY place where zoom visual changes happen
   */
  applyZoomTransform() {
      const container = this.elements.container;
      const wrapper = this.elements.zoomWrapper;
      const main = this.elements.main;
      
      if (!container || !wrapper || !main) return;
      
      // Apply scale transform to container
      container.style.transformOrigin = '0 0';
      container.style.transform = `scale(${this.scale})`;
      
      // Calculate visual dimensions
      const totalBaseHeight = this.basePageHeights.slice(1).reduce((a, b) => a + b, 0);
      const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
      const visualWidth = maxBaseWidth * this.scale;
      const visualHeight = totalBaseHeight * this.scale;
      
      // Update wrapper to match visual size (for scrollbars)
      wrapper.style.width = `${visualWidth}px`;
      wrapper.style.height = `${visualHeight}px`;
      
      // Center content if smaller than viewport
      const viewportWidth = main.clientWidth;
      const viewportHeight = main.clientHeight;
      
      if (visualWidth < viewportWidth) {
          wrapper.style.marginLeft = `${(viewportWidth - visualWidth) / 2}px`;
      } else {
          wrapper.style.marginLeft = '0px';
      }
      
      if (visualHeight < viewportHeight) {
          wrapper.style.marginTop = `${(viewportHeight - visualHeight) / 2}px`;
      } else {
          wrapper.style.marginTop = '0px';
      }
  }

  /**
   * Set zoom level with focal point
   * @param {number} newScale - New zoom level
   * @param {number} contentX - Focal point X in content coordinates (at scale=1.0)
   * @param {number} contentY - Focal point Y in content coordinates (at scale=1.0)
   * @param {number} mouseX - Mouse X relative to viewport
   * @param {number} mouseY - Mouse Y relative to viewport
   */
  setZoom(newScale, contentX, contentY, mouseX, mouseY) {
      const main = this.elements.main;
      if (!main) return;
      
      // 3. Clear Queue: Cancel any pending renders immediately
      this.cancelAllPageRenders();
      
      this.scale = newScale;
      
      // Update UI
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }
      
      // 1. CSS Scaling: Apply CSS transform (instant, no re-render)
      this.applyZoomTransform();
      
      // Adjust scroll to keep focal point under mouse
      if (contentX !== undefined && contentY !== undefined) {
          const newScrollLeft = (contentX * this.scale) - mouseX;
          const newScrollTop = (contentY * this.scale) - mouseY;
          
          main.scrollLeft = Math.max(0, newScrollLeft);
          main.scrollTop = Math.max(0, newScrollTop);
      }
      
      // Clear any pending quality render
      if (this.qualityRenderTimeout) {
          clearTimeout(this.qualityRenderTimeout);
          this.qualityRenderTimeout = null;
      }
      
      // 2. Debounce: Schedule quality re-render
      // Canvases are rendered at BASE_RENDER_SCALE, so check if visual quality is degraded
      const qualityRatio = this.scale / PdfViewer.BASE_RENDER_SCALE;
      if (qualityRatio > 1.2 || qualityRatio < 0.8) {
          // Quality is degraded, schedule re-render after zoom stops
          this.qualityRenderTimeout = setTimeout(() => {
              this.qualityRenderTimeout = null;
              // Re-render visible pages at current scale for better quality
              this.rerenderForQuality();
          }, 300);
      }
  }

  /**
   * Re-render visible pages for better quality after zoom
   * This is called after zoom stops if quality is degraded
   */
  async rerenderForQuality() {
      if (!this.pageWrappers) return;

      // Only re-render if we are zoomed in more than the base scale
      // and the difference is significant
      if (this.scale <= PdfViewer.BASE_RENDER_SCALE) return;

      const promises = [];
      
      // Iterate over all currently active (virtualized) wrappers
      for (const wrapper of Object.values(this.pageWrappers)) {
          // Check if this page needs higher quality
          const currentRenderScale = Number.parseFloat(wrapper.dataset.renderScale || 0);
          
          // If current render scale is significantly lower than current zoom level
          if (currentRenderScale < this.scale * 0.9) {
              promises.push(this.renderPageContent(wrapper, this.scale));
          }
      }
      
      if (promises.length > 0) {
          await Promise.all(promises);
      }
  }

  /**
   * Zoom in by 10%
   */
  zoomIn() {
      if (this.scale >= PdfViewer.MAX_ZOOM) return;
      
      const main = this.elements.main;
      const mainRect = main.getBoundingClientRect();
      
      // Use viewport center as focal point
      const mouseX = mainRect.width / 2;
      const mouseY = mainRect.height / 2;
      const contentX = (main.scrollLeft + mouseX) / this.scale;
      const contentY = (main.scrollTop + mouseY) / this.scale;
      
      let newScale = Math.round((this.scale + 0.1) * 10) / 10;
      if (newScale > PdfViewer.MAX_ZOOM) newScale = PdfViewer.MAX_ZOOM;
      
      this.setZoom(newScale, contentX, contentY, mouseX, mouseY);
  }

  /**
   * Zoom out by 10%
   */
  zoomOut() {
      if (this.scale <= PdfViewer.MIN_ZOOM) return;
      
      const main = this.elements.main;
      const mainRect = main.getBoundingClientRect();
      
      // Use viewport center as focal point
      const mouseX = mainRect.width / 2;
      const mouseY = mainRect.height / 2;
      const contentX = (main.scrollLeft + mouseX) / this.scale;
      const contentY = (main.scrollTop + mouseY) / this.scale;
      
      let newScale = Math.round((this.scale - 0.1) * 10) / 10;
      if (newScale < PdfViewer.MIN_ZOOM) newScale = PdfViewer.MIN_ZOOM;
      
      this.setZoom(newScale, contentX, contentY, mouseX, mouseY);
  }

  /**
   * Update layout when page dimensions change
   */
  updateLayout() {
      // Recalculate page tops
      let currentTop = 0;
      for (let i = 1; i <= this.pdfDoc.numPages; i++) {
          this.pageTops[i] = currentTop;
          currentTop += this.basePageHeights[i];
      }

      // Recalculate container dimensions
      const totalBaseHeight = currentTop; // Last currentTop is total height
      const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
      
      if (this.elements.container) {
          this.elements.container.style.width = `${maxBaseWidth}px`;
          this.elements.container.style.height = `${totalBaseHeight}px`;
      }
      
      // Update positions of active wrappers
      if (this.pageWrappers) {
          Object.entries(this.pageWrappers).forEach(([key, wrapper]) => {
              const pageNum = Number.parseInt(key);
              wrapper.style.top = `${this.getPageTop(pageNum)}px`;
              // Ensure width/height are correct
              wrapper.style.width = `${this.basePageWidths[pageNum]}px`;
              wrapper.style.height = `${this.basePageHeights[pageNum]}px`;
          });
      }
      
      // Update zoom transform (handles visual scaling and scrollbars)
      this.applyZoomTransform();
  }

  /**
   * Check if page should skip rendering
   */
  shouldSkipRender(wrapper, scaleOverride) {
      // If already rendering, don't interrupt
      if (wrapper.dataset.rendering === 'true') return true;
      
      // If loaded and no scale override (standard render), skip
      if (wrapper.dataset.loaded === 'true' && !scaleOverride) return true;
      
      return false;
  }

  /**
   * Calculate render scale with caps and dimension limits
   */
  calculateRenderScale(num, scaleOverride) {
      const dpr = window.devicePixelRatio || 1;
      const targetScale = scaleOverride || PdfViewer.BASE_RENDER_SCALE;
      let renderScale = Math.min(targetScale * dpr, 3.0);
      
      const MAX_CANVAS_DIM = 4096;
      const baseWidth = this.basePageWidths[num] || this.basePageWidths[1];
      const baseHeight = this.basePageHeights[num] || this.basePageHeights[1];
      
      if (baseWidth && baseHeight) {
          const estimatedWidth = baseWidth * renderScale;
          const estimatedHeight = baseHeight * renderScale;
          
          if (estimatedWidth > MAX_CANVAS_DIM || estimatedHeight > MAX_CANVAS_DIM) {
              const ratio = Math.min(MAX_CANVAS_DIM / estimatedWidth, MAX_CANVAS_DIM / estimatedHeight);
              renderScale *= ratio;
          }
      }
      
      return { renderScale, dpr };
  }

  /**
   * Check if current render quality is already sufficient
   */
  isRenderQualitySufficient(wrapper, renderScale, dpr) {
      if (wrapper.dataset.loaded !== 'true') return false;
      
      const currentRenderScale = Number.parseFloat(wrapper.dataset.renderScale || 0);
      const effectiveLogicalScale = renderScale / dpr;
      
      return currentRenderScale >= effectiveLogicalScale * 0.95;
  }

  /**
   * Cancel existing render task for a page
   */
  cancelExistingRender(num) {
      if (!this.activeRenderTasks.has(num)) return;
      
      try {
          this.activeRenderTasks.get(num).cancel();
      } catch (e) { /* ignore */ }
      this.activeRenderTasks.delete(num);
  }

  /**
   * Adjust viewport if dimensions exceed maximum
   */
  adjustViewportForMaxDimensions(page, renderScale, maxDim) {
      let viewport = page.getViewport({ scale: renderScale, rotation: this.rotation });
      
      if (viewport.width > maxDim || viewport.height > maxDim) {
          const ratio = Math.min(maxDim / viewport.width, maxDim / viewport.height);
          renderScale *= ratio;
          viewport = page.getViewport({ scale: renderScale, rotation: this.rotation });
      }
      
      return { viewport, renderScale };
  }

  /**
   * Update page dimensions if changed
   */
  updatePageDimensions(num, baseViewport, wrapper) {
      if (this.basePageWidths[num] === baseViewport.width &&
          this.basePageHeights[num] === baseViewport.height) {
          return;
      }
      
      this.basePageWidths[num] = baseViewport.width;
      this.basePageHeights[num] = baseViewport.height;
      
      wrapper.style.width = `${baseViewport.width}px`;
      wrapper.style.height = `${baseViewport.height}px`;
      
      this.updateLayout();
  }

  /**
   * Create and configure canvas element
   */
  createPageCanvas(viewport, baseViewport) {
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      canvas.style.width = `${baseViewport.width}px`;
      canvas.style.height = `${baseViewport.height}px`;
      
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      
      return { canvas, ctx };
  }

  /**
   * Schedule extended layers rendering
   */
  scheduleExtendedLayers(wrapper, num, page, viewport) {
      if (this.extendedLayerTimeout) clearTimeout(this.extendedLayerTimeout);
      
      const renderExtended = () => {
          if (!wrapper.isConnected) return;
          this.renderExtendedLayers(wrapper, num, page, viewport);
      };

      if (globalThis.requestIdleCallback) {
          globalThis.requestIdleCallback(() => {
              setTimeout(renderExtended, 200);
          }, { timeout: 1000 });
      } else {
          setTimeout(renderExtended, 200);
      }
  }

  /**
   * Render page content
   * Renders at BASE_RENDER_SCALE for high quality, uses CSS transform for display
   * @param {HTMLElement} wrapper - The page wrapper element
   * @param {number|null} scaleOverride - Optional scale to render at (defaults to BASE_RENDER_SCALE)
   */
  async renderPageContent(wrapper, scaleOverride = null) {
      const num = Number.parseInt(wrapper.dataset.pageNumber);
      
      if (this.shouldSkipRender(wrapper, scaleOverride)) return;

      const { renderScale, dpr } = this.calculateRenderScale(num, scaleOverride);
      
      if (this.isRenderQualitySufficient(wrapper, renderScale, dpr)) return;
      
      this.cancelExistingRender(num);
      wrapper.dataset.rendering = 'true';

      try {
          const page = await this.pdfDoc.getPage(num);
          
          if (this.loadedPages) {
              this.loadedPages.set(num, page);
          }
          
          const { viewport, renderScale: adjustedScale } = this.adjustViewportForMaxDimensions(
              page, renderScale, 4096
          );
          
          const baseViewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          this.updatePageDimensions(num, baseViewport, wrapper);
          
          const { canvas, ctx } = this.createPageCanvas(viewport, baseViewport);
          
          const renderTask = page.render({
              canvasContext: ctx,
              viewport: viewport,
              intent: 'print'
          });

          this.activeRenderTasks.set(num, renderTask);
          await renderTask.promise;
          
          this.activeRenderTasks.delete(num);
          
          const oldCanvas = wrapper.querySelector('canvas');
          if (oldCanvas) oldCanvas.remove();
          wrapper.appendChild(canvas);
          
          wrapper.dataset.loaded = 'true';
          wrapper.dataset.renderScale = (adjustedScale / dpr).toString();
          delete wrapper.dataset.rendering;
          
          this.scheduleExtendedLayers(wrapper, num, page, viewport);

      } catch (error) {
          if (error.name !== 'RenderingCancelledException') {
              console.error(`Error rendering page ${num}:`, error);
          }
          this.activeRenderTasks.delete(num);
          delete wrapper.dataset.rendering;
      }
  }

  /**
   * Render extended layers (Text & Annotations)
   * @param {HTMLElement} wrapper
   * @param {number} pageNum
   * @param {Object} page
   * @param {Object} viewport
   */
  async renderExtendedLayers(wrapper, pageNum, page, viewport) {
      if (wrapper.dataset.layersLoaded === 'true') return;
      
      try {
          // 1. Text Layer (for selection)
          // Only render if not in text edit mode (which has its own layer)
          if (!this.isTextEditMode) {
              const textContent = await page.getTextContent();
              
              const textLayerDiv = document.createElement('div');
              textLayerDiv.className = 'textLayer';
              textLayerDiv.style.width = `${viewport.width}px`;
              textLayerDiv.style.height = `${viewport.height}px`;
              textLayerDiv.style.transform = ''; // Reset any transform
              wrapper.appendChild(textLayerDiv);

              // Scale text layer to match canvas if needed
              // The viewport passed here is already scaled to renderScale
              // But the wrapper is sized at base dimensions (scale=1.0)
              // We need to ensure text layer fits the wrapper
              
              const baseViewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
              
              textLayerDiv.style.width = `${baseViewport.width}px`;
              textLayerDiv.style.height = `${baseViewport.height}px`;
              
              // PDF.js text layer rendering
              await pdfjsLib.renderTextLayer({
                  textContentSource: textContent,
                  container: textLayerDiv,
                  viewport: baseViewport,
                  textDivs: []
              }).promise;
          }

          // 2. Annotation Layer (links, forms)
          const annotations = await page.getAnnotations();
          if (annotations && annotations.length > 0) {
              const annotationLayerDiv = document.createElement('div');
              annotationLayerDiv.className = 'annotationLayer';
              annotationLayerDiv.style.width = `${viewport.width}px`;
              annotationLayerDiv.style.height = `${viewport.height}px`;
              wrapper.appendChild(annotationLayerDiv);
              
              const baseViewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
              annotationLayerDiv.style.width = `${baseViewport.width}px`;
              annotationLayerDiv.style.height = `${baseViewport.height}px`;

              await pdfjsLib.AnnotationLayer.render({
                  viewport: baseViewport,
                  div: annotationLayerDiv,
                  annotations: annotations,
                  page: page,
                  linkService: {
                      goToDestination: (dest) => { /* TODO: Implement jump */ },
                      getDestinationHash: (dest) => '#',
                      addLinkAttributes: (link, url) => {
                          link.target = '_blank';
                          link.rel = 'noopener noreferrer';
                      }
                  },
                  renderInteractiveForms: false // Disable for performance as requested
              });
          }

          // 3. Edit Mode Annotations
          if (this.isEditMode && this.annotationManager) {
              const canvas = wrapper.querySelector('canvas');
              if (canvas) {
                  this.annotationManager.addPage(pageNum, wrapper, canvas);
              }
          }
          
          wrapper.dataset.layersLoaded = 'true';

      } catch (error) {
          console.error(`Error rendering extended layers for page ${pageNum}:`, error);
      }
  }

  /**
   * Unload page content to free memory
   */
  unloadPageContent(wrapper) {
      const num = Number.parseInt(wrapper.dataset.pageNumber);

      if (this.isEditMode && this.annotationManager) {
          this.annotationManager.removePage(num);
      }

      if (this.activeRenderTasks.has(num)) {
          try {
            this.activeRenderTasks.get(num).cancel();
          } catch(e) { /* ignore */ }
          this.activeRenderTasks.delete(num);
      }
      
      // Cleanup PDF page resources
      if (this.loadedPages?.has(num)) {
          try {
              const page = this.loadedPages.get(num);
              page.cleanup();
              this.loadedPages.delete(num);
          } catch (e) {
              console.warn(`Error cleaning up page ${num}:`, e);
          }
      }
      
      delete wrapper.dataset.rendering;

      const allCanvases = wrapper.querySelectorAll('canvas');
      allCanvases.forEach(canvas => {
          canvas.width = 0;
          canvas.height = 0;
          canvas.remove();
      });
      
      // Remove text and annotation layers
      const layers = wrapper.querySelectorAll('.textLayer, .annotationLayer');
      layers.forEach(layer => layer.remove());
      
      wrapper.innerHTML = '';
      wrapper.dataset.loaded = 'false';
      delete wrapper.dataset.layersLoaded;
  }

  /**
   * Setup Virtual Scroll
   */
  setupVirtualScroll() {
      const main = document.getElementById('pdf-main');
      if (!main) return;

      if (this.scrollHandler) {
          main.removeEventListener('scroll', this.scrollHandler);
      }

      let ticking = false;
      let lastScrollTop = main.scrollTop;
      let lastScrollTime = Date.now();
      
      // Threshold for fast scrolling (pixels per ms)
      // Adjust based on testing, 2.5 is a reasonable starting point
      const FAST_SCROLL_THRESHOLD = 2.5;

      this.scrollHandler = () => {
          if (this.isZooming) return;

          const now = Date.now();
          const scrollTop = main.scrollTop;
          const dt = now - lastScrollTime;
          
          // Calculate velocity
          if (dt > 0) {
              const dy = Math.abs(scrollTop - lastScrollTop);
              const velocity = dy / dt;
              
              if (velocity > FAST_SCROLL_THRESHOLD) {
                  if (!this.isFastScrolling) {
                      this.isFastScrolling = true;
                      main.classList.add('fast-scrolling');
                      // Cancel ongoing renders to free resources
                      this.cancelAllPageRenders();
                  }
                  
                  // Reset timeout
                  if (this.scrollEndTimeout) {
                      clearTimeout(this.scrollEndTimeout);
                  }
                  
                  // Schedule end of fast scrolling
                  this.scrollEndTimeout = setTimeout(() => {
                      this.isFastScrolling = false;
                      main.classList.remove('fast-scrolling');
                      this.updateVisiblePages();
                  }, 150);
              } else if (this.isFastScrolling) {
                  // If we were fast scrolling but slowed down, keep the timeout running
                  // to debounce the stop event
                  if (this.scrollEndTimeout) {
                      clearTimeout(this.scrollEndTimeout);
                  }
                  this.scrollEndTimeout = setTimeout(() => {
                      this.isFastScrolling = false;
                      main.classList.remove('fast-scrolling');
                      this.updateVisiblePages();
                  }, 150);
              }
          }
          
          lastScrollTop = scrollTop;
          lastScrollTime = now;

          if (!ticking) {
              globalThis.requestAnimationFrame(() => {
                  this.updateVisiblePages();
                  ticking = false;
              });
              ticking = true;
          }
      };

      main.addEventListener('scroll', this.scrollHandler, { passive: true });
  }

  /**
   * Process the render queue sequentially
   * Prioritizes pages closest to the center of the viewport
   */
  async processRenderQueue() {
      if (this.isProcessingQueue) return;
      this.isProcessingQueue = true;

      const main = document.getElementById('pdf-main');
      if (!main) {
          this.isProcessingQueue = false;
          return;
      }

      try {
          while (this.renderQueue.size > 0) {
              // If fast scrolling started, stop processing
              if (this.isFastScrolling) {
                  this.renderQueue.clear();
                  break;
              }

              // Calculate center point for prioritization
              const scrollTop = main.scrollTop / this.scale;
              const clientHeight = main.clientHeight / this.scale;
              const centerPoint = scrollTop + (clientHeight / 2);

              // Convert Set to Array for sorting
              const queueArray = Array.from(this.renderQueue);
              
              // Sort by distance to center
              queueArray.sort((a, b) => {
                  const topA = this.getPageTop(a);
                  const topB = this.getPageTop(b);
                  const heightA = this.basePageHeights[a];
                  const heightB = this.basePageHeights[b];
                  
                  const centerA = topA + (heightA / 2);
                  const centerB = topB + (heightB / 2);
                  
                  return Math.abs(centerA - centerPoint) - Math.abs(centerB - centerPoint);
              });

              // Pick the best candidate
              const pageNum = queueArray[0];
              this.renderQueue.delete(pageNum);

              const wrapper = this.pageWrappers[pageNum];
              if (wrapper?.dataset.loaded === 'false' && wrapper?.dataset.rendering !== 'true') {
                  await this.renderPageContent(wrapper);
                  
                  // Small delay to yield to main thread
                  await new Promise(resolve => setTimeout(resolve, 0));
              }
          }
      } catch (error) {
          console.error('Error processing render queue:', error);
      } finally {
          this.isProcessingQueue = false;
          
          // If queue is not empty (e.g. added during processing), restart
          if (this.renderQueue.size > 0 && !this.isFastScrolling) {
              this.processRenderQueue();
          }
      }
  }

  /**
   * Binary search to find page index for a given position
   * @param {number} position - Scroll position (or center point)
   * @returns {number} Page index (1-based)
   */
  binarySearch(position) {
      let low = 1;
      let high = this.pdfDoc.numPages;
      
      while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const top = this.pageTops[mid];
          const bottom = top + this.basePageHeights[mid];
          
          if (position >= top && position < bottom) {
              return mid;
          } else if (position < top) {
              high = mid - 1;
          } else {
              low = mid + 1;
          }
      }
      
      return Math.min(Math.max(1, low), this.pdfDoc.numPages);
  }

  /**
   * Update visible pages based on scroll position
   */
  async updateVisiblePages() {
      const main = document.getElementById('pdf-main');
      if (!main) return;

      // Scroll position is in visual coordinates (scaled)
      // Convert to base coordinates for page calculation
      const scrollTop = main.scrollTop / this.scale;
      const clientHeight = main.clientHeight / this.scale;
      const buffer = 2; // Increased buffer for smoother scrolling

      // Find visible page range using binary search
      let startIndex = this.binarySearch(scrollTop);
      let endIndex = this.binarySearch(scrollTop + clientHeight);
      
      startIndex = Math.max(1, startIndex - buffer);
      endIndex = Math.min(this.pdfDoc.numPages, endIndex + buffer);

      // Remove wrappers out of range
      const pagesToKeep = new Set();
      for (let i = startIndex; i <= endIndex; i++) {
          pagesToKeep.add(i);
      }

      Object.keys(this.pageWrappers).forEach(key => {
          const pageNum = Number.parseInt(key);
          if (!pagesToKeep.has(pageNum)) {
              const wrapper = this.pageWrappers[pageNum];
              if (wrapper?.parentNode) {
                  this.unloadPageContent(wrapper);
                  wrapper.remove();
              }
              delete this.pageWrappers[pageNum];
              // Remove from render queue if pending
              this.renderQueue.delete(pageNum);
          }
      });

      // Add pages in range
      for (let i = startIndex; i <= endIndex; i++) {
          let wrapper = this.pageWrappers[i];
          
          if (!wrapper) {
              wrapper = document.createElement('div');
              wrapper.className = 'pdf-page-wrapper';
              // Optimization: CSS containment for performance
              wrapper.style.contain = 'content';
              wrapper.dataset.pageNumber = i;
              wrapper.dataset.loaded = 'false';
              
              // Position at base scale (CSS transform handles visual scale)
              wrapper.style.width = `${this.basePageWidths[i]}px`;
              wrapper.style.height = `${this.basePageHeights[i]}px`;
              wrapper.style.position = 'absolute';
              wrapper.style.top = `${this.getPageTop(i)}px`;
              wrapper.style.left = '50%';
              wrapper.style.transform = 'translateX(-50%)';

              this.elements.container.appendChild(wrapper);
              this.pageWrappers[i] = wrapper;
          }
          
          if (wrapper.dataset.loaded === 'false' && wrapper.dataset.rendering !== 'true') {
              // Only render content if NOT fast scrolling
              if (!this.isFastScrolling) {
                  this.renderQueue.add(i);
              }
          }
      }

      // Process the queue
      this.processRenderQueue();

      // Update current page number
      const centerPoint = scrollTop + (clientHeight / 2);
      const currentPage = this.binarySearch(centerPoint);
      
      if (currentPage !== this.pageNum && currentPage >= 1 && currentPage <= this.pdfDoc.numPages) {
          this.pageNum = currentPage;
          this.elements.pageNum.value = currentPage;
          this.updateActiveThumbnail(currentPage);
      }
  }

  /**
   * Queue render
   */
  queueRender() {
    if (this.pageRendering) {
      this.renderPending = true;
    } else {
      this.render();
    }
  }

  /**
   * Get top position of a page (at base scale)
   */
  getPageTop(pageNum) {
      return this.pageTops[pageNum] || 0;
  }

  /**
   * Scroll to specific page
   */
  scrollToPage(num) {
    const main = document.getElementById('pdf-main');
    if (main) {
        // Page top is at base scale, multiply by current scale for visual position
        const top = this.getPageTop(num) * this.scale;
        main.scrollTo({ top: top, behavior: 'auto' });
        
        this.updateVisiblePages();
        
        this.pageNum = num;
        this.elements.pageNum.value = num;
        this.updateActiveThumbnail(num);
    }
  }

  /**
   * Go to previous page
   */
  onPrevPage() {
    if (this.pageNum <= 1) return;
    this.scrollToPage(this.pageNum - 1);
  }

  /**
   * Go to next page
   */
  onNextPage() {
    if (this.pageNum >= this.pdfDoc.numPages) return;
    this.scrollToPage(this.pageNum + 1);
  }

  /**
   * Calculate initial scale to fit page in viewport
   */
  async calculateInitialScale() {
    try {
        if (!this.pdfDoc) {
            this.scale = 1.0;
            return;
        }

        const page = await this.pdfDoc.getPage(1);
        const viewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
        
        const main = document.getElementById('pdf-main');
        if (!main) {
            this.scale = 1.0;
            return;
        }
        
        // Available space minus padding (approx 48px for margins/scrollbars)
        const availableWidth = main.clientWidth - 48;
        const availableHeight = main.clientHeight - 48;
        
        if (availableWidth <= 0 || availableHeight <= 0) {
            this.scale = 1.0;
            return;
        }

        // Always use Fit Page (contain) logic regardless of orientation
        const scaleWidth = availableWidth / viewport.width;
        const scaleHeight = availableHeight / viewport.height;
        this.scale = Math.min(scaleWidth, scaleHeight);
        
        // Round to 2 decimal places
        this.scale = Math.round(this.scale * 100) / 100;
        
        // Clamp to valid range
        this.scale = Math.max(PdfViewer.MIN_ZOOM, Math.min(PdfViewer.MAX_ZOOM, this.scale));
        
    } catch (error) {
        console.error('Error calculating initial scale:', error);
        this.scale = 1.0;
    }
  }

  /**
   * Rotate
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    
    this.renderThumbnails()
        .catch(e => console.error('Error rendering thumbnails:', e));

    this.pageRendering = false;
    this.queueRender();
  }

  /**
   * Fit to width - scales the PDF so the page width fills the available viewport width
   */
  async fitToWidth() {
    try {
      if (!this.pdfDoc) return;
      
      const main = document.getElementById('pdf-main');
      if (!main) return;

      // 3. Clear Queue: Cancel any pending renders immediately
      this.cancelAllPageRenders();
      this.isZooming = true;
      
      // Get page width - prefer cached value, fallback to fetching from PDF
      let pageWidth = this.basePageWidths?.[this.pageNum] || this.basePageWidths?.[1];
      
      // If not cached, get directly from PDF
      if (!pageWidth) {
          const page = await this.pdfDoc.getPage(this.pageNum);
          const viewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          pageWidth = viewport.width;
      }
      
      if (!pageWidth) {
          this.isZooming = false;
          return;
      }
      
      // Available width minus padding for scrollbar and margins
      const availableWidth = main.clientWidth - 48;
      
      // Calculate scale: we want pageWidth * scale = availableWidth
      let newScale = availableWidth / pageWidth;
      
      // Round to 1 decimal place for cleaner display
      newScale = Math.round(newScale * 10) / 10;
      
      // Clamp to valid range
      newScale = Math.max(PdfViewer.MIN_ZOOM, Math.min(PdfViewer.MAX_ZOOM, newScale));
      
      console.log(`[PDF] fitToWidth: pageWidth=${pageWidth}, availableWidth=${availableWidth}, newScale=${newScale}`);
      
      this.scale = newScale;
      // 1. CSS Scaling: Apply CSS transform immediately
      this.applyZoomTransform();
      
      // Center horizontally
      const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
      const visualContainerWidth = maxBaseWidth * this.scale;
      const viewportWidth = main.clientWidth;
      
      if (visualContainerWidth > viewportWidth) {
          main.scrollLeft = (visualContainerWidth - viewportWidth) / 2;
      } else {
          main.scrollLeft = 0;
      }
      
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }

      // 2. Debounce: Schedule update and re-render
      if (this.zoomRenderTimeout) clearTimeout(this.zoomRenderTimeout);
      this.zoomRenderTimeout = setTimeout(() => {
          this.isZooming = false;
          this.updateVisiblePages();
          this.rerenderForQuality();
      }, 200);

    } catch (error) {
      console.error('Error fitting to width:', error);
      this.isZooming = false;
    }
  }

  /**
   * Fit to page - scales the PDF so the entire page fits in the viewport
   */
  async fitToPage() {
    try {
      if (!this.pdfDoc) return;
      
      const main = document.getElementById('pdf-main');
      if (!main) return;

      // 3. Clear Queue
      this.cancelAllPageRenders();
      this.isZooming = true;
      
      // Get page dimensions - prefer cached values, fallback to fetching from PDF
      let pageWidth = this.basePageWidths?.[this.pageNum] || this.basePageWidths?.[1];
      let pageHeight = this.basePageHeights?.[this.pageNum] || this.basePageHeights?.[1];
      
      // If not cached, get directly from PDF
      if (!pageWidth || !pageHeight) {
          const page = await this.pdfDoc.getPage(this.pageNum);
          const viewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          pageWidth = viewport.width;
          pageHeight = viewport.height;
      }
      
      if (!pageWidth || !pageHeight) {
          this.isZooming = false;
          return;
      }
      
      // Available space minus padding
      const availableWidth = main.clientWidth - 48;
      const availableHeight = main.clientHeight - 48;
      
      // Calculate scale for both dimensions
      const scaleWidth = availableWidth / pageWidth;
      const scaleHeight = availableHeight / pageHeight;
      
      // Use the smaller scale to ensure the entire page fits
      let newScale = Math.min(scaleWidth, scaleHeight);
      
      // Round to 1 decimal place
      newScale = Math.round(newScale * 10) / 10;
      
      // Clamp to valid range
      newScale = Math.max(PdfViewer.MIN_ZOOM, Math.min(PdfViewer.MAX_ZOOM, newScale));
      
      console.log(`[PDF] fitToPage: pageWidth=${pageWidth}, pageHeight=${pageHeight}, newScale=${newScale}`);
      
      this.scale = newScale;
      // 1. CSS Scaling
      this.applyZoomTransform();
      
      // Center horizontally
      const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
      const visualContainerWidth = maxBaseWidth * this.scale;
      const viewportWidth = main.clientWidth;
      
      if (visualContainerWidth > viewportWidth) {
          main.scrollLeft = (visualContainerWidth - viewportWidth) / 2;
      } else {
          main.scrollLeft = 0;
      }
      
      this.scrollToPage(this.pageNum);
      
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }

      // 2. Debounce
      if (this.zoomRenderTimeout) clearTimeout(this.zoomRenderTimeout);
      this.zoomRenderTimeout = setTimeout(() => {
          this.isZooming = false;
          this.updateVisiblePages();
          this.rerenderForQuality();
      }, 200);

    } catch (error) {
      console.error('Error fitting to page:', error);
      this.isZooming = false;
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
      if (!this.isOpen) return;
      this.applyZoomTransform();
  }

  /**
   * Render thumbnails in sidebar
   */
  async renderThumbnails() {
    this.cancelAllThumbnailRenders();

    const sidebar = this.elements.sidebar;
    const scrollTop = sidebar.scrollTop;

    sidebar.innerHTML = '<div class="pdf-sidebar-content"></div>';
    const container = sidebar.querySelector('.pdf-sidebar-content');
    
    this.thumbnailWrappers = [];

    const isLandscape = this.rotation % 180 === 90;
    const placeholderWidth = 140;
    const placeholderHeight = isLandscape ? 100 : 200;

    for (let num = 1; num <= this.pdfDoc.numPages; num++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-thumbnail';
      if (num === this.pageNum) wrapper.classList.add('active');
      wrapper.dataset.pageNumber = num;
      wrapper.dataset.loaded = 'false';
      
      wrapper.addEventListener('click', () => {
        this.scrollToPage(num);
      });

      const canvas = document.createElement('canvas');
      canvas.width = placeholderWidth;
      canvas.height = placeholderHeight;
      wrapper.appendChild(canvas);
      
      const label = document.createElement('div');
      label.className = 'pdf-thumbnail-number';
      label.textContent = num;
      wrapper.appendChild(label);

      container.appendChild(wrapper);
      this.thumbnailWrappers[num] = wrapper;
    }

    this.setupThumbnailObserver();
    
    if (scrollTop > 0) {
        sidebar.scrollTop = scrollTop;
    }
  }

  /**
   * Setup thumbnail observer
   */
  setupThumbnailObserver() {
      if (this.thumbnailObserver) {
          this.thumbnailObserver.disconnect();
      }

      const sidebar = this.elements.sidebar;
      
      const options = {
          root: sidebar,
          rootMargin: '100% 0px',
          threshold: 0
      };

      this.thumbnailObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
              const wrapper = entry.target;
              const num = Number.parseInt(wrapper.dataset.pageNumber);

              if (entry.isIntersecting) {
                  this.renderThumbnailContent(wrapper);
              } else {
                  this.cancelThumbnailRender(num);
              }
          });
      }, options);

      this.thumbnailWrappers.forEach(wrapper => {
          if (wrapper) this.thumbnailObserver.observe(wrapper);
      });
  }

  /**
   * Cancel thumbnail render task
   */
  cancelThumbnailRender(pageNum) {
      const task = this.activeThumbnailRenderTasks.get(pageNum);
      if (task) {
          if (task.idleId) {
              if (globalThis.cancelIdleCallback) {
                  globalThis.cancelIdleCallback(task.idleId);
              } else {
                  clearTimeout(task.idleId);
              }
          }
          if (task.renderTask) {
              try {
                  task.renderTask.cancel();
              } catch (e) { /* ignore */ }
          }
          this.activeThumbnailRenderTasks.delete(pageNum);
      }
  }

  /**
   * Cancel all active thumbnail renders
   */
  cancelAllThumbnailRenders() {
      if (this.activeThumbnailRenderTasks) {
          const pageNums = Array.from(this.activeThumbnailRenderTasks.keys());
          pageNums.forEach(pageNum => this.cancelThumbnailRender(pageNum));
          this.activeThumbnailRenderTasks.clear();
      }
  }

  /**
   * Render thumbnail content
   */
  async renderThumbnailContent(wrapper) {
      if (wrapper.dataset.loaded === 'true') return;
      
      const num = Number.parseInt(wrapper.dataset.pageNumber);

      // If already rendering/scheduled, don't schedule again
      if (this.activeThumbnailRenderTasks.has(num)) return;

      // Optimization: Defer thumbnail rendering if main page is busy
      if (this.pageRendering) {
          const timeoutId = setTimeout(() => {
              this.activeThumbnailRenderTasks.delete(num);
              if (wrapper.isConnected) {
                  this.renderThumbnailContent(wrapper);
              }
          }, 200);
          
          this.activeThumbnailRenderTasks.set(num, { idleId: timeoutId });
          return;
      }

      const performRender = async () => {
          // Remove idleId from tracking as we are starting execution
          const currentTask = this.activeThumbnailRenderTasks.get(num);
          if (currentTask) {
              currentTask.idleId = null;
          }

          if (wrapper.dataset.loaded === 'true') {
              this.activeThumbnailRenderTasks.delete(num);
              return;
          }
          
          // Double-check visibility
          if (!wrapper.isConnected || wrapper.offsetParent === null) {
               this.activeThumbnailRenderTasks.delete(num);
               return;
          }
          
          const canvas = wrapper.querySelector('canvas');
          
          try {
              const page = await this.pdfDoc.getPage(num);
              
              // Check visibility again after await
              if (!this.activeThumbnailRenderTasks.has(num)) {
                  page.cleanup();
                  return;
              }

              const dpr = window.devicePixelRatio || 1;
              const targetWidth = 140; // Match CSS width
              
              const unscaledViewport = page.getViewport({ scale: 1, rotation: this.rotation });
              const scale = (targetWidth / unscaledViewport.width) * dpr;
              
              const viewport = page.getViewport({ scale: scale, rotation: this.rotation });
              
              const ctx = canvas.getContext('2d', { alpha: false });
              canvas.height = viewport.height;
              canvas.width = viewport.width;
              
              canvas.style.width = `${viewport.width / dpr}px`;
              canvas.style.height = `${viewport.height / dpr}px`;
              
              ctx.imageSmoothingEnabled = false;
              
              const renderTask = page.render({
                  canvasContext: ctx,
                  viewport: viewport,
                  intent: 'display',
                  renderInteractiveForms: false
              });

              if (this.activeThumbnailRenderTasks.has(num)) {
                  this.activeThumbnailRenderTasks.get(num).renderTask = renderTask;
              }

              await renderTask.promise;
              
              wrapper.dataset.loaded = 'true';
              
              // Immediate cleanup to free memory
              page.cleanup();
              
          } catch (error) {
              if (error.name !== 'RenderingCancelledException') {
                  console.error(`Error rendering thumbnail ${num}:`, error);
              }
          } finally {
              this.activeThumbnailRenderTasks.delete(num);
          }
      };

      // Use requestIdleCallback if available to avoid blocking main thread
      if (globalThis.requestIdleCallback) {
          const idleId = globalThis.requestIdleCallback(() => performRender(), { timeout: 1000 });
          this.activeThumbnailRenderTasks.set(num, { idleId });
      } else {
          const idleId = setTimeout(performRender, 10);
          this.activeThumbnailRenderTasks.set(num, { idleId });
      }
  }

  /**
   * Update active thumbnail
   */
  updateActiveThumbnail(pageNum) {
    if (!this.thumbnailWrappers) return;

    // Remove active class from last active page
    if (this.lastActivePage && this.thumbnailWrappers[this.lastActivePage]) {
        this.thumbnailWrappers[this.lastActivePage].classList.remove('active');
    }

    const current = this.thumbnailWrappers[pageNum];
    if (current) {
      current.classList.add('active');
      this.lastActivePage = pageNum;
      
      // Use 'auto' behavior for better performance during rapid scrolling
      // Only scroll if the thumbnail is not fully visible
      const sidebar = this.elements.sidebar;
      const thumbnailTop = current.offsetTop;
      const thumbnailBottom = thumbnailTop + current.offsetHeight;
      const sidebarTop = sidebar.scrollTop;
      const sidebarBottom = sidebarTop + sidebar.clientHeight;
      
      if (thumbnailTop < sidebarTop || thumbnailBottom > sidebarBottom) {
          current.scrollIntoView({ behavior: 'auto', block: 'nearest' });
      }
    }
  }
}

globalThis.PdfViewer = PdfViewer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PdfViewer;
}
