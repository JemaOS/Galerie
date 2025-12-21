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
if (typeof pdfjsLib !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
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
  static BASE_RENDER_SCALE = 2.0;
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
    
    // Page dimensions at scale=1.0 (base dimensions)
    this.basePageHeights = [];
    this.basePageWidths = [];
    
    // Debounce timer for quality re-render
    this.qualityRenderTimeout = null;
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
        this.elements.rotate.addEventListener('click', () => {
            this.rotate();
        });
    }
    
    if (this.elements.fitWidth) {
      this.elements.fitWidth.addEventListener('click', () => this.fitToWidth());
    }
    if (this.elements.fitPage) {
      this.elements.fitPage.addEventListener('click', () => this.fitToPage());
    }
    
    this.elements.sidebarToggle.addEventListener('click', () => {
      this.elements.sidebar.classList.toggle('hidden');
    });
    
    this.elements.pageNum.addEventListener('change', (e) => {
      const num = parseInt(e.target.value);
      if (num >= 1 && num <= this.pdfDoc.numPages) {
        this.scrollToPage(num);
      } else {
        this.elements.pageNum.value = this.pageNum;
      }
    });

    // Window resize
    window.addEventListener('resize', () => {
        this.onWindowResize();
    });

    // Resize Observer for main container (handles sidebar toggle)
    if (this.elements.main) {
        this.resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => {
                this.onWindowResize();
            });
        });
        this.resizeObserver.observe(this.elements.main);
    }
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

      if (e.key === ' ' && !this.isSpaceHeld) {
          this.isSpaceHeld = true;
          this.updateCursor();
      }

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (this.annotationManager) {
              if (e.shiftKey) {
                  this.annotationManager.redo();
              } else {
                  this.annotationManager.undo();
              }
          }
      }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === ' ') {
            this.isSpaceHeld = false;
            this.updateCursor();
        }
    });
    
    // Edit Mode
    if (this.elements.editModeBtn) {
        this.elements.editModeBtn.addEventListener('click', () => this.toggleEditMode(true));
    }

    if (this.elements.exitEditBtn) {
        this.elements.exitEditBtn.addEventListener('click', () => this.toggleEditMode(false));
    }

    if (this.elements.undoEditBtn) this.elements.undoEditBtn.addEventListener('click', () => {
        if (this.isTextEditMode && this.textEditor) {
            this.textEditor.undo();
        } else if (this.annotationManager) {
            this.annotationManager.undo();
        }
    });
    
    if (this.elements.redoEditBtn) this.elements.redoEditBtn.addEventListener('click', () => {
        if (this.isTextEditMode && this.textEditor) {
            this.textEditor.redo();
        } else if (this.annotationManager) {
            this.annotationManager.redo();
        }
    });

    // Tool Buttons
    const toolBtns = this.elements.editToolbar.querySelectorAll('.tool-btn');
    toolBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tool = btn.dataset.tool;
            this.setTool(tool);
        });
    });

    // Split Save Button
    this.setupSplitButton();

    // Print
    const printBtn = document.getElementById('pdf-print');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (this.currentFile) {
                GalleryUtils.printFile(this.currentFile.url, 'pdf');
            }
        });
    }

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
        infoBtn.addEventListener('click', () => {
            if (this.currentFile) {
                const ui = this.uiController || window.galleryUI;
                if (ui) ui.showFileModal(this.currentFile);
            }
        });
    }

    // Wheel Event for Zoom (Ctrl+Wheel or Pinch)
    if (this.elements.viewer) {
        this.elements.viewer.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                
                const main = this.elements.main;
                const container = this.elements.container;
                
                if (!main || !container) return;

                // Get mouse position relative to viewport
                const mainRect = main.getBoundingClientRect();
                const mouseX = e.clientX - mainRect.left;
                const mouseY = e.clientY - mainRect.top;
                
                // Calculate focal point in content coordinates (at current scale)
                const contentX = (main.scrollLeft + mouseX) / this.scale;
                const contentY = (main.scrollTop + mouseY) / this.scale;
                
                // Calculate new scale
                const delta = -e.deltaY;
                const factor = Math.pow(1.01, delta);
                const oldScale = this.scale;
                let newScale = this.scale * factor;
                newScale = Math.max(PdfViewer.MIN_ZOOM, Math.min(PdfViewer.MAX_ZOOM, newScale));
                
                if (Math.abs(newScale - oldScale) < 0.001) return;
                
                // Apply zoom with focal point
                this.setZoom(newScale, contentX, contentY, mouseX, mouseY);
            }
        }, { passive: false });
    }
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
          main.classList.remove('grab');
          main.classList.remove('grabbing');
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
          if (this.elements.saveDropdown && this.elements.saveDropdown.classList.contains('show')) {
              if (!this.elements.saveOptionsBtn.contains(e.target) && !this.elements.saveDropdown.contains(e.target)) {
                  this.elements.saveDropdown.classList.remove('show');
              }
          }
          if (this.elements.toolbarSaveDropdown && this.elements.toolbarSaveDropdown.classList.contains('show')) {
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
          if (!this.annotationManager) {
              this.uiController.showLoading(true);
              try {
                  await window.loadScript('scripts/annotation-manager.js');
                  
                  if (typeof AnnotationManager === 'undefined') {
                      let retries = 0;
                      while (typeof AnnotationManager === 'undefined' && retries < 50) {
                          await new Promise(resolve => setTimeout(resolve, 50));
                          retries++;
                      }
                      if (typeof AnnotationManager === 'undefined') {
                          throw new Error('AnnotationManager class not found after loading script');
                      }
                  }

                  this.annotationManager = new AnnotationManager(this.uiController);
              } catch (e) {
                  console.error('Failed to load annotation manager', e);
                  this.uiController.showToast('Erreur de chargement des outils d\'édition', 'error');
                  this.uiController.showLoading(false);
                  this.isEditMode = false;
                  return;
              }
              this.uiController.showLoading(false);
          }

          this.elements.defaultToolbar.classList.add('hidden');
          this.elements.editToolbar.classList.remove('hidden');
          this.elements.propertiesSidebar.classList.remove('hidden');
          
          const targets = [];
          if (this.pageWrappers) {
            Object.values(this.pageWrappers).forEach(wrapper => {
              if (wrapper) {
                const canvas = wrapper.querySelector('canvas');
                if (canvas) {
                  targets.push({
                    container: wrapper,
                    target: canvas
                  });
                }
              }
            });
          }

          if (targets.length > 0) {
            this.annotationManager.start(targets, null, {
                propertiesContainer: this.elements.propertiesContainer
            });
            
            if (tool) {
                await this.setTool(tool);
            }
          } else {
            this.uiController.showToast('Impossible d\'annoter : aucun document chargé', 'error');
            this.toggleEditMode(false);
          }

      } else {
          this.elements.defaultToolbar.classList.remove('hidden');
          this.elements.editToolbar.classList.add('hidden');
          this.elements.propertiesSidebar.classList.add('hidden');
          
          if (this.annotationManager) this.annotationManager.stop();
          
          if (this.textEditor) {
              this.textEditor.stop();
              this.isTextEditMode = false;
          }
      }
      
      this.updateCursor();
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
          if (!this.textEditor) {
              this.uiController.showLoading(true);
              try {
                  await window.loadScript('scripts/pdf-text-editor.js');
                  
                  if (typeof PdfTextEditor === 'undefined') {
                      let retries = 0;
                      while (typeof PdfTextEditor === 'undefined' && retries < 50) {
                          await new Promise(resolve => setTimeout(resolve, 50));
                          retries++;
                      }
                      if (typeof PdfTextEditor === 'undefined') {
                          throw new Error('PdfTextEditor class not found after loading script');
                      }
                  }

                  this.textEditor = new PdfTextEditor(this);
              } catch (e) {
                  console.error('Failed to load text editor:', e);
                  this.uiController.showToast('Erreur de chargement de l\'éditeur de texte', 'error');
                  this.uiController.showLoading(false);
                  this.isTextEditMode = false;
                  return;
              }
              this.uiController.showLoading(false);
          }
          
          if (this.annotationManager) {
              this.annotationManager.pause();
          }
          
          await this.textEditor.startTextEditMode(this.pageNum);
          
          if (this.elements.propertiesContainer) {
              this.textEditor.renderLanguageSelector(this.elements.propertiesContainer);
          }
          
          this.showTextEditIndicator();
          
      } else {
          if (this.textEditor) {
              this.textEditor.stop();
          }
          
          if (this.annotationManager) {
              this.annotationManager.resume();
          }
          
          this.hideTextEditIndicator();
      }
      
      this.updateCursor();
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
    
    if (!options.preserveState) {
        this.pageNum = 1;
        this.scale = 1.0;
        this.rotation = 0;
    } else {
        if (options.pageNum) this.pageNum = options.pageNum;
        if (options.scale) this.scale = options.scale;
        if (options.rotation !== undefined) this.rotation = options.rotation;
    }

    this.isEditMode = false;
    
    this.elements.viewer.classList.remove('hidden');
    setTimeout(() => {
      this.elements.viewer.classList.add('active');
    }, 10);
    
    this.elements.defaultToolbar.classList.remove('hidden');
    this.elements.editToolbar.classList.add('hidden');
    this.elements.propertiesSidebar.classList.add('hidden');
    
    this.elements.filename.textContent = file.name;
    
    try {
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
      
      if (this.pdfDoc) {
          this.elements.pageCount.textContent = this.pdfDoc.numPages;
          
          if (!options.preserveState || !options.scale) {
              await this.calculateInitialScale();
          }
          
          await this.render();
          
          if (options.preserveState && options.scrollTop !== undefined) {
              const main = document.getElementById('pdf-main');
              if (main) {
                  setTimeout(() => {
                      main.scrollTop = options.scrollTop;
                      main.scrollLeft = options.scrollLeft;
                  }, 0);
              }
          }

          this.renderThumbnails();
      }
    } catch (error) {
      console.error('Error loading PDF:', error);
      this.uiController.showToast('Erreur lors du chargement du fichier PDF', 'error');
    }
  }

  /**
   * Close viewer
   */
  async close() {
    if (this.activeRenderTasks) {
        this.activeRenderTasks.forEach(task => task.cancel());
        this.activeRenderTasks.clear();
    }

    const hasTextChanges = this.textEditor && this.textEditor.hasChanges();
    const hasAnnotationChanges = this.annotationManager && this.annotationManager.hasChanges();
    
    if (hasTextChanges || hasAnnotationChanges || this.rotation !== 0) {
        await this.save();
    }

    this.isOpen = false;
    this.toggleEditMode(false);
    
    if (this.resizeObserver) {
        this.resizeObserver.disconnect();
        this.resizeObserver = null;
    }
    if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
    }
    if (this.lazyLoadObserver) {
        this.lazyLoadObserver.disconnect();
        this.lazyLoadObserver = null;
    }
    if (this.thumbnailObserver) {
        this.thumbnailObserver.disconnect();
        this.thumbnailObserver = null;
    }
    
    if (this.textEditor) {
        await this.textEditor.destroy();
        this.textEditor = null;
    }
    
    this.elements.viewer.classList.remove('active');
    setTimeout(() => {
      this.elements.viewer.classList.add('hidden');
      this.elements.container.innerHTML = '';
    }, 300);

    if (this.uiController && this.uiController.fileHandler) {
      if (this.uiController.fileHandler.files.length === 1) {
        const files = this.uiController.fileHandler.files;
        if (files.length > 0) {
          this.uiController.fileHandler.removeFile(files[0].id);
          this.uiController.renderFiles();
        }
      }
    }
  }

  /**
   * Generate PDF Blob with changes
   */
  async generatePdfBlob() {
      const arrayBuffer = await fetch(this.currentFile.url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      
      if (this.rotation !== 0) {
          pages.forEach(page => {
              const rotation = page.getRotation();
              const currentAngle = typeof rotation === 'object' ? rotation.angle : rotation;
              page.setRotation(PDFLib.degrees(currentAngle + this.rotation));
          });
      }
      
      if (this.textEditor && this.textEditor.hasChanges()) {
          await this.textEditor.applyChangesToPdf(pdfDoc);
          this.textEditor.clearPendingChanges();
      }
      
      if (this.annotationManager && this.annotationManager.activeInput) {
          this.annotationManager.finalizeTextInput();
      }

      if (this.annotationManager && this.annotationManager.hasChanges()) {
          for (let i = 0; i < pages.length; i++) {
              const pageNum = i + 1;
              const wrapper = this.pageWrappers[pageNum];
              if (wrapper) {
                  const annotationCanvas = wrapper.querySelector('.annotation-canvas');
                  if (annotationCanvas) {
                      const tempCanvas = document.createElement('canvas');
                      tempCanvas.width = annotationCanvas.width;
                      tempCanvas.height = annotationCanvas.height;
                      const ctx = tempCanvas.getContext('2d');
                      
                      if (annotationCanvas.width > 0 && annotationCanvas.height > 0) {
                          ctx.drawImage(annotationCanvas, 0, 0);
                      }
                      this.annotationManager.drawTextObjects(ctx, wrapper);
                      
                      const imageBytes = tempCanvas.toDataURL('image/png');
                      const image = await pdfDoc.embedPng(imageBytes);
                      const page = pages[i];
                      
                      const { width, height } = page.getSize();
                      
                      page.drawImage(image, {
                          x: 0,
                          y: 0,
                          width: width,
                          height: height,
                      });
                  }
              }
          }
      }
      
      const pdfBytes = await pdfDoc.save();
      return new Blob([pdfBytes], { type: 'application/pdf' });
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
   * Save changes to PDF
   */
  async save() {
    if (!this.currentFile) return;

    const wasEditMode = this.isEditMode;
    let activeTool = null;
    if (wasEditMode) {
        const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
        if (activeToolBtn) {
            activeTool = activeToolBtn.dataset.tool;
        }
    }

    const currentScale = this.scale;
    const currentPage = this.pageNum;
    const main = document.getElementById('pdf-main');
    const scrollTop = main ? main.scrollTop : 0;
    const scrollLeft = main ? main.scrollLeft : 0;

    try {
        this.uiController.showToast('Enregistrement du PDF...', 'info');
        
        const blob = await this.generatePdfBlob();
        const success = await this.fileHandler.saveFile(this.currentFile, blob);
        
        if (success) {
            this.uiController.showToast('PDF enregistré', 'success');
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
   * Render all pages
   * Pages are rendered at BASE_RENDER_SCALE, then CSS transform is used for visual zoom
   */
  async render() {
    this.pageRendering = true;

    try {
        // Cancel all active renders
        if (this.activeRenderTasks) {
            this.activeRenderTasks.forEach(task => task.cancel());
            this.activeRenderTasks.clear();
        }
        
        // Get base dimensions from first page
        const firstPage = await this.pdfDoc.getPage(1);
        const baseViewport = firstPage.getViewport({ scale: 1.0, rotation: this.rotation });
        
        // Initialize base page dimensions (at scale=1.0)
        this.basePageHeights = new Array(this.pdfDoc.numPages + 1).fill(baseViewport.height);
        this.basePageWidths = new Array(this.pdfDoc.numPages + 1).fill(baseViewport.width);
        
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
      
      const oldScale = this.scale;
      this.scale = newScale;
      
      // Update UI
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }
      
      // Apply CSS transform (instant, no re-render)
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
      
      // Schedule quality re-render if zoom is significantly different from render scale
      // Canvases are rendered at BASE_RENDER_SCALE, so check if visual quality is degraded
      const qualityRatio = this.scale / PdfViewer.BASE_RENDER_SCALE;
      if (qualityRatio > 1.5 || qualityRatio < 0.3) {
          // Quality is degraded, schedule re-render after zoom stops
          this.qualityRenderTimeout = setTimeout(() => {
              this.qualityRenderTimeout = null;
              // Re-render visible pages at current scale for better quality
              this.rerenderForQuality();
          }, 500);
      }
  }

  /**
   * Re-render visible pages for better quality after zoom
   * This is called after zoom stops if quality is degraded
   */
  async rerenderForQuality() {
      // For now, we keep the high-res render and rely on CSS scaling
      // This could be enhanced to re-render at a different scale if needed
      // But for most use cases, BASE_RENDER_SCALE=2.0 provides good quality up to 300% zoom
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
      // Recalculate container dimensions
      const totalBaseHeight = this.basePageHeights.slice(1).reduce((a, b) => a + b, 0);
      const maxBaseWidth = Math.max(...this.basePageWidths.slice(1));
      
      if (this.elements.container) {
          this.elements.container.style.width = `${maxBaseWidth}px`;
          this.elements.container.style.height = `${totalBaseHeight}px`;
      }
      
      // Update positions of active wrappers
      if (this.pageWrappers) {
          Object.entries(this.pageWrappers).forEach(([key, wrapper]) => {
              const pageNum = parseInt(key);
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
   * Render page content
   * Renders at BASE_RENDER_SCALE for high quality, uses CSS transform for display
   */
  async renderPageContent(wrapper) {
      const num = parseInt(wrapper.dataset.pageNumber);
      
      if (wrapper.dataset.loaded === 'true') return;
      if (wrapper.dataset.rendering === 'true') return;
      
      // Cancel any existing render for this page
      if (this.activeRenderTasks.has(num)) {
          try {
              this.activeRenderTasks.get(num).cancel();
          } catch (e) { /* ignore */ }
          this.activeRenderTasks.delete(num);
      }
      
      wrapper.dataset.rendering = 'true';

      try {
          const page = await this.pdfDoc.getPage(num);
          
          const dpr = window.devicePixelRatio || 1;
          
          // Render at BASE_RENDER_SCALE for high quality
          const renderScale = PdfViewer.BASE_RENDER_SCALE * dpr;
          const viewport = page.getViewport({ scale: renderScale, rotation: this.rotation });
          
          // Update base dimensions for this page (at scale=1.0)
          const baseViewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          
          // Check if dimensions changed from initial guess
          if (this.basePageWidths[num] !== baseViewport.width ||
              this.basePageHeights[num] !== baseViewport.height) {
              
              this.basePageWidths[num] = baseViewport.width;
              this.basePageHeights[num] = baseViewport.height;
              
              // Update this wrapper immediately
              wrapper.style.width = `${baseViewport.width}px`;
              wrapper.style.height = `${baseViewport.height}px`;
              
              // Trigger layout update to fix container size and other page positions
              this.updateLayout();
          }
          
          // Create canvas
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas';
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          // Canvas displays at base size (scale=1.0), CSS transform on container handles zoom
          // So we need to scale down the high-res canvas to base size
          const displayWidth = baseViewport.width;
          const displayHeight = baseViewport.height;
          canvas.style.width = `${displayWidth}px`;
          canvas.style.height = `${displayHeight}px`;
          
          const ctx = canvas.getContext('2d', { alpha: false });
          ctx.imageSmoothingEnabled = false;
          
          const renderTask = page.render({
              canvasContext: ctx,
              viewport: viewport,
              intent: 'print'
          });

          this.activeRenderTasks.set(num, renderTask);

          await renderTask.promise;
          
          this.activeRenderTasks.delete(num);
          
          // Swap canvas
          const oldCanvas = wrapper.querySelector('canvas');
          if (oldCanvas) {
              oldCanvas.remove();
          }
          wrapper.appendChild(canvas);
          
          wrapper.dataset.loaded = 'true';
          delete wrapper.dataset.rendering;
          
      } catch (error) {
          if (error.name !== 'RenderingCancelledException') {
              console.error(`Error rendering page ${num}:`, error);
          }
          this.activeRenderTasks.delete(num);
          delete wrapper.dataset.rendering;
      }
  }

  /**
   * Unload page content to free memory
   */
  unloadPageContent(wrapper) {
      const num = parseInt(wrapper.dataset.pageNumber);

      if (this.activeRenderTasks.has(num)) {
          try {
            this.activeRenderTasks.get(num).cancel();
          } catch(e) { /* ignore */ }
          this.activeRenderTasks.delete(num);
      }
      
      delete wrapper.dataset.rendering;

      const allCanvases = wrapper.querySelectorAll('canvas');
      allCanvases.forEach(canvas => {
          canvas.width = 0;
          canvas.height = 0;
          canvas.remove();
      });
      
      wrapper.innerHTML = '';
      wrapper.dataset.loaded = 'false';
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
      this.scrollHandler = () => {
          if (!ticking) {
              window.requestAnimationFrame(() => {
                  this.updateVisiblePages();
                  ticking = false;
              });
              ticking = true;
          }
      };

      main.addEventListener('scroll', this.scrollHandler, { passive: true });
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
      const buffer = 1;

      // Find visible page range
      let currentTop = 0;
      let startIndex = 1;
      
      for (let i = 1; i <= this.pdfDoc.numPages; i++) {
          if (currentTop + this.basePageHeights[i] > scrollTop) {
              startIndex = i;
              break;
          }
          currentTop += this.basePageHeights[i];
      }
      
      let endIndex = startIndex;
      let visibleHeight = 0;
      
      for (let i = startIndex; i <= this.pdfDoc.numPages; i++) {
          visibleHeight += this.basePageHeights[i];
          endIndex = i;
          if (currentTop + visibleHeight > scrollTop + clientHeight) {
              break;
          }
      }
      
      startIndex = Math.max(1, startIndex - buffer);
      endIndex = Math.min(this.pdfDoc.numPages, endIndex + buffer);

      // Remove wrappers out of range
      const pagesToKeep = new Set();
      for (let i = startIndex; i <= endIndex; i++) {
          pagesToKeep.add(i);
      }

      Object.keys(this.pageWrappers).forEach(key => {
          const pageNum = parseInt(key);
          if (!pagesToKeep.has(pageNum)) {
              const wrapper = this.pageWrappers[pageNum];
              if (wrapper && wrapper.parentNode) {
                  this.unloadPageContent(wrapper);
                  wrapper.remove();
              }
              delete this.pageWrappers[pageNum];
          }
      });

      // Add/render pages in range
      const renderPromises = [];

      for (let i = startIndex; i <= endIndex; i++) {
          let wrapper = this.pageWrappers[i];
          
          if (!wrapper) {
              wrapper = document.createElement('div');
              wrapper.className = 'pdf-page-wrapper';
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
              renderPromises.push(this.renderPageContent(wrapper));
          }
      }

      // Update current page number
      const centerPoint = scrollTop + (clientHeight / 2);
      let pageTop = 0;
      let currentPage = 1;
      for (let i = 1; i <= this.pdfDoc.numPages; i++) {
          if (pageTop + this.basePageHeights[i] > centerPoint) {
              currentPage = i;
              break;
          }
          pageTop += this.basePageHeights[i];
      }
      
      if (currentPage !== this.pageNum && currentPage >= 1 && currentPage <= this.pdfDoc.numPages) {
          this.pageNum = currentPage;
          this.elements.pageNum.value = currentPage;
          this.updateActiveThumbnail(currentPage);
      }

      if (renderPromises.length > 0) {
          await Promise.all(renderPromises);
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
      let top = 0;
      for (let i = 1; i < pageNum; i++) {
          top += this.basePageHeights[i];
      }
      return top;
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
    this.scale = 1.0;
  }

  /**
   * Rotate
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    
    try {
        this.renderThumbnails();
    } catch (e) {
        console.error('Error rendering thumbnails:', e);
    }

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
      
      // Get page width - prefer cached value, fallback to fetching from PDF
      let pageWidth = this.basePageWidths?.[this.pageNum] || this.basePageWidths?.[1];
      
      // If not cached, get directly from PDF
      if (!pageWidth) {
          const page = await this.pdfDoc.getPage(this.pageNum);
          const viewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          pageWidth = viewport.width;
      }
      
      if (!pageWidth) return;
      
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
      this.applyZoomTransform();
      
      // Center horizontally
      // If the container is wider than the viewport (because of other wider pages),
      // we need to scroll to center the current page.
      // The container width is maxBaseWidth * scale.
      // The current page is centered in the container.
      // So we want to scroll to (containerWidth - viewportWidth) / 2.
      
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
    } catch (error) {
      console.error('Error fitting to width:', error);
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
      
      if (!pageWidth || !pageHeight) return;
      
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
      
      // Center vertically on the current page
      // We need to scroll to the top of the current page minus half the available vertical space
      // But scrollToPage handles this better usually.
      // For fitToPage, we usually want to see the whole page, so scrolling to the top of the page is best.
      // However, if we just zoomed out to fit the page, we might want to center it vertically if there's space.
      // applyZoomTransform handles vertical centering via marginTop if the content is smaller than viewport.
      // If content is larger (multiple pages), we should scroll to the current page.
      
      this.scrollToPage(this.pageNum);
      
      this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }
    } catch (error) {
      console.error('Error fitting to page:', error);
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
              if (entry.isIntersecting) {
                  this.renderThumbnailContent(entry.target);
              }
          });
      }, options);

      this.thumbnailWrappers.forEach(wrapper => {
          if (wrapper) this.thumbnailObserver.observe(wrapper);
      });
  }

  /**
   * Render thumbnail content
   */
  async renderThumbnailContent(wrapper) {
      if (wrapper.dataset.loaded === 'true') return;
      
      const num = parseInt(wrapper.dataset.pageNumber);
      const canvas = wrapper.querySelector('canvas');
      
      try {
          const page = await this.pdfDoc.getPage(num);
          
          const dpr = window.devicePixelRatio || 1;
          const targetWidth = 150;
          const qualityScale = 2.0;
          
          const unscaledViewport = page.getViewport({ scale: 1.0, rotation: this.rotation });
          const scale = (targetWidth / unscaledViewport.width) * dpr * qualityScale;
          
          const viewport = page.getViewport({ scale: scale, rotation: this.rotation });
          
          const ctx = canvas.getContext('2d', { alpha: false });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          canvas.style.width = `${viewport.width / (dpr * qualityScale)}px`;
          canvas.style.height = `${viewport.height / (dpr * qualityScale)}px`;
          
          ctx.imageSmoothingEnabled = false;
          
          await page.render({
              canvasContext: ctx,
              viewport: viewport,
              intent: 'print'
          }).promise;
          
          wrapper.dataset.loaded = 'true';
      } catch (error) {
          console.error(`Error rendering thumbnail ${num}:`, error);
      }
  }

  /**
   * Update active thumbnail
   */
  updateActiveThumbnail(pageNum) {
    if (!this.thumbnailWrappers) return;

    this.thumbnailWrappers.forEach(wrapper => {
      if (wrapper) wrapper.classList.remove('active');
    });
    
    const current = this.thumbnailWrappers[pageNum];
    if (current) {
      current.classList.add('active');
      current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

window.PdfViewer = PdfViewer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PdfViewer;
}
