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
 */

class PdfViewer {
  constructor(fileHandler, uiController) {
    this.fileHandler = fileHandler;
    this.uiController = uiController;
    
    this.currentFile = null;
    this.pdfDoc = null;
    this.pageNum = 1;
    this.pageRendering = false;
    this.pageNumPending = null;
    this.scale = 1.0;
    this.MAX_ZOOM = 5.0;
    this.renderedScale = 1.0;
    this.zoomTimeout = null;
    this.rotation = 0;
    this.canvas = null;
    this.ctx = null;
    this.isOpen = false;
    this.isEditMode = false;
    this.isTextEditMode = false;
    this.isZooming = false; // Track zoom state to prevent page superposition
    
    this.elements = {};
    
    this.annotationManager = null;
    this.textEditor = null;
    this.activeRenderTasks = new Map();
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
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    if (this.elements.close) {
      this.elements.close.addEventListener('click', () => this.close());
    }
    
    this.elements.zoomIn.addEventListener('click', () => this.onZoomIn());
    this.elements.zoomOut.addEventListener('click', () => this.onZoomOut());
    
    if (this.elements.editZoomIn) {
        this.elements.editZoomIn.addEventListener('click', () => this.onZoomIn());
    }
    if (this.elements.editZoomOut) {
        this.elements.editZoomOut.addEventListener('click', () => this.onZoomOut());
    }

    this.elements.rotate.addEventListener('click', () => this.rotate());
    
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
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      // Don't trigger shortcuts if typing in annotation text input
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

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

  }

  setupSplitButton() {
      // Sidebar Button
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

      // Toolbar Button
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
      
      // Close dropdowns when clicking outside
      document.addEventListener('click', (e) => {
          // Sidebar Dropdown
          if (this.elements.saveDropdown && this.elements.saveDropdown.classList.contains('show')) {
              if (!this.elements.saveOptionsBtn.contains(e.target) && !this.elements.saveDropdown.contains(e.target)) {
                  this.elements.saveDropdown.classList.remove('show');
              }
          }
          // Toolbar Dropdown
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
          // Load AnnotationManager if needed
          if (!this.annotationManager) {
              this.uiController.showLoading(true);
              try {
                  await window.loadScript('scripts/annotation-manager.js');
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
          
          // Collect all page wrappers and canvases
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
          
          // Stop text editor if active
          if (this.textEditor) {
              this.textEditor.stop();
              this.isTextEditMode = false;
          }
      }
  }

  async setTool(toolId) {
      // Handle text edit tool specially
      if (toolId === 'text-edit') {
          await this.toggleTextEditMode(true);
          
          // Update UI
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
      
      // Exit text edit mode when switching to other tools
      if (this.isTextEditMode) {
          await this.toggleTextEditMode(false);
          
          // Restore AnnotationManager properties panel since TextEditor overwrote it
          if (this.elements.propertiesContainer && this.annotationManager) {
              this.annotationManager.renderProperties(this.elements.propertiesContainer);
          }
      }
      
      if (this.annotationManager) this.annotationManager.setTool(toolId);
      
      // Update UI in Edit Toolbar
      const toolBtns = this.elements.editToolbar.querySelectorAll('.tool-btn');
      toolBtns.forEach(btn => {
          if (btn.dataset.tool === toolId) {
              btn.classList.add('active');
              // Highlight effect
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
          // Load Text Editor if needed
          if (!this.textEditor) {
              this.uiController.showLoading(true);
              try {
                  await window.loadScript('scripts/pdf-text-editor.js');
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
          
          // Pause annotation manager
          if (this.annotationManager) {
              this.annotationManager.pause();
          }
          
          // Start text edit mode for current page
          await this.textEditor.startTextEditMode(this.pageNum);
          
          // Add language selector to properties
          if (this.elements.propertiesContainer) {
              this.textEditor.renderLanguageSelector(this.elements.propertiesContainer);
          }
          
          // Show indicator
          this.showTextEditIndicator();
          
      } else {
          // Stop text editor
          if (this.textEditor) {
              this.textEditor.stop();
          }
          
          // Resume annotation manager
          if (this.annotationManager) {
              this.annotationManager.resume();
          }
          
          // Hide indicator
          this.hideTextEditIndicator();
      }
  }

  /**
   * Show text edit mode indicator
   */
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

  /**
   * Hide text edit mode indicator
   */
  hideTextEditIndicator() {
      const indicator = document.getElementById('text-edit-indicator');
      if (indicator) {
          indicator.style.display = 'none';
      }
  }

  /**
   * Open PDF file
   * @param {Object} file - File object
   * @param {Object} options - Options for opening (preserveState, scale, pageNum, etc.)
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
    
    // Show viewer
    this.elements.viewer.classList.remove('hidden');
    setTimeout(() => {
      this.elements.viewer.classList.add('active');
    }, 10);
    
    // Reset UI
    this.elements.defaultToolbar.classList.remove('hidden');
    this.elements.editToolbar.classList.add('hidden');
    this.elements.propertiesSidebar.classList.add('hidden');
    
    this.elements.filename.textContent = file.name;
    
    try {
      // Load PDF
      // Try loading with empty password directly in parameters to avoid prompt if possible
      const loadingTask = pdfjsLib.getDocument({
          url: file.url,
          password: '',
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
          cMapPacked: true,
      });
      
      loadingTask.onPassword = (updatePassword, reason) => {
          if (reason === pdfjsLib.PasswordResponses.NEED_PASSWORD) {
              // Try empty password again if requested
              updatePassword('');
          }
      };

      this.pdfDoc = await loadingTask.promise;
      
      if (this.pdfDoc) {
          this.elements.pageCount.textContent = this.pdfDoc.numPages;
          
          // Calculate initial scale to fit the page in viewport
          if (!options.preserveState || !options.scale) {
              await this.calculateInitialScale();
          }
          
          await this.render();
          
          // Restore scroll position if preserving state
          if (options.preserveState && options.scrollTop !== undefined) {
              const main = document.getElementById('pdf-main');
              if (main) {
                  // We need to wait for the rendering to at least create the elements
                  // render() is async but it awaits renderSinglePage which creates elements
                  // However, the browser might need a tick to update layout
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
    // Cancel all active renders
    if (this.activeRenderTasks) {
        this.activeRenderTasks.forEach(task => task.cancel());
        this.activeRenderTasks.clear();
    }

    // Auto-save on close if there are changes
    const hasTextChanges = this.textEditor && this.textEditor.hasChanges();
    const hasAnnotationChanges = this.annotationManager && this.annotationManager.hasChanges();
    
    if (hasTextChanges || hasAnnotationChanges || this.rotation !== 0) {
        await this.save();
    }

    this.isOpen = false;
    this.toggleEditMode(false);
    
    // Disconnect observers
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
    
    // Cleanup text editor
    if (this.textEditor) {
        await this.textEditor.destroy();
        this.textEditor = null;
    }
    
    this.elements.viewer.classList.remove('active');
    setTimeout(() => {
      this.elements.viewer.classList.add('hidden');
      this.elements.container.innerHTML = ''; // Clear canvas
    }, 300);

    // If we only have one file, return to home page (landing state)
    // The user mentioned "superposition avec une autre page où il ya deposer fichier".
    // This suggests that when closing or saving/reloading, the "Drop Zone" or "Empty State" is becoming visible underneath or on top.
    // If we have files, we shouldn't be showing the drop zone.
    // The logic here removes the file if it's the only one, which forces the "Empty State" / "Drop Zone" to appear.
    // This might be intended behavior for "closing" the viewer, but if the user just saved, they might not want to close the file.
    // However, this is the close() method.
    
    if (this.uiController && this.uiController.fileHandler) {
      if (this.uiController.fileHandler.files.length === 1) {
        const files = this.uiController.fileHandler.files;
        if (files.length > 0) {
          // Only remove if we are actually closing the viewer to go back to "nothing open"
          // If we are just reloading (which might call close/open), we shouldn't remove it.
          // But close() is usually user-initiated.
          // The issue might be that when saving, we trigger a reload which might momentarily show the background?
          // Or if the user is in edit mode and saves, does it close?
          // In save(), we call open() which might not call close() explicitly but re-initializes.
          
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
      // Load existing PDF
      const arrayBuffer = await fetch(this.currentFile.url).then(res => res.arrayBuffer());
      const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      
      // Apply rotation
      if (this.rotation !== 0) {
          pages.forEach(page => {
              const rotation = page.getRotation();
              const currentAngle = typeof rotation === 'object' ? rotation.angle : rotation;
              page.setRotation(PDFLib.degrees(currentAngle + this.rotation));
          });
      }
      
      // Apply text edits (OCR-based text modifications)
      if (this.textEditor && this.textEditor.hasChanges()) {
          await this.textEditor.applyChangesToPdf(pdfDoc);
          this.textEditor.clearPendingChanges();
      }
      
      // Apply annotations
      // Note: We need to ensure any active text input is finalized before saving
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
                      
                      ctx.drawImage(annotationCanvas, 0, 0);
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

      // Capture state before reload
      const currentScale = this.scale;
      // Rotation is baked into the PDF, so we reset it to 0, but we might want to preserve the view rotation if it wasn't baked?
      // The generatePdfBlob bakes the rotation. So the new PDF will be rotated.
      // So we should reset rotation to 0.
      // But we want to preserve scroll and zoom.
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
          
          // Generate blob with changes
          const blob = await this.generatePdfBlob();
          
          // Revoke previous preview URL if it exists to avoid memory leaks
          if (this.previewUrl) {
              URL.revokeObjectURL(this.previewUrl);
          }
          
          this.previewUrl = URL.createObjectURL(blob);
          
          // Update current file URL to point to the new blob
          // We keep the original file reference but update the URL
          // This ensures subsequent edits are based on this version
          this.currentFile.url = this.previewUrl;
          
          // Reset state that is now baked into the PDF
          this.rotation = 0;
          if (this.annotationManager) this.annotationManager.clear();
          // Note: generatePdfBlob already clears textEditor pending changes
          
          // Reload viewer with preserved state
          await this.open(this.currentFile, {
              preserveState: true,
              scale: currentScale,
              pageNum: currentPage,
              scrollTop: scrollTop,
              scrollLeft: scrollLeft,
              rotation: 0 // Reset rotation as it's baked
          });
          
          // Restore edit mode
          if (wasEditMode) {
              await this.toggleEditMode(true);
              // Restore tool
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

    // Capture edit mode state before it gets reset by open()
    const wasEditMode = this.isEditMode;
    let activeTool = null;
    if (wasEditMode) {
        const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
        if (activeToolBtn) {
            activeTool = activeToolBtn.dataset.tool;
        }
    }

    // Capture view state
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
            
            // Reload the PDF to show the saved version
            // We need to close and reopen or just re-render
            // Re-opening is safer to ensure we get the fresh file content
            // IMPORTANT: Do NOT call close() before open() if it triggers the "remove file" logic for single files.
            // this.open() handles resetting the UI.
            await this.open(this.currentFile, {
                preserveState: true,
                scale: currentScale,
                pageNum: currentPage,
                scrollTop: scrollTop,
                scrollLeft: scrollLeft,
                rotation: 0
            });
            
            // Restore edit mode if it was active
            if (wasEditMode) {
                await this.toggleEditMode(true);
                // Restore tool
                if (activeTool) {
                    this.setTool(activeTool);
                }
            }
        } else {
            // If save failed (e.g. no handle), try Save As
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
   */
  async render() {
    this.pageRendering = true;

    // Cancel all active renders
    if (this.activeRenderTasks) {
        this.activeRenderTasks.forEach(task => task.cancel());
        this.activeRenderTasks.clear();
    }
    
    // Capture Scroll Anchor (Relative Center)
    const main = document.getElementById('pdf-main');
    let anchorRatio = 0;
    let paddingTop = 0;
    
    // We use defaultPageHeight from the PREVIOUS render to calculate the old content height.
    // main.scrollHeight is unreliable because the CSS transform in applySmoothZoom scales the container,
    // changing the scrollHeight, but scrollTop remains unscaled.
    if (main && this.defaultPageHeight && this.pdfDoc) {
        const style = window.getComputedStyle(main);
        paddingTop = parseFloat(style.paddingTop) || 0;
        
        // Calculate logical content height from previous render state
        const contentHeight = this.pdfDoc.numPages * this.defaultPageHeight;
        
        const scrollTop = main.scrollTop;
        const clientHeight = main.clientHeight;
        
        // Center relative to content top
        const centerY = scrollTop + (clientHeight / 2) - paddingTop;
        
        if (contentHeight > 0) {
            anchorRatio = centerY / contentHeight;
        }
    }

    this.renderedScale = this.scale;
    
    // Capture Edit Mode State
    const wasEditMode = this.isEditMode;
    const wasTextEditMode = this.isTextEditMode;
    let activeTool = null;
    let annotationState = null;

    if (wasEditMode && this.annotationManager) {
        activeTool = this.annotationManager.currentTool;
        if (typeof this.annotationManager.snapshot === 'function') {
             annotationState = this.annotationManager.snapshot();
        }
        // Stop but keep UI to prevent blinking
        this.annotationManager.stop(true);
    }

    if (this.isTextEditMode && this.textEditor) {
        this.textEditor.stop();
    }

    // Get dimensions from first page to use as default for placeholders
    let defaultViewport = null;
    try {
        const firstPage = await this.pdfDoc.getPage(1);
        const dpr = window.devicePixelRatio || 1;
        // Calculate logical dimensions that match the physical pixel snapping
        const scaledViewport = firstPage.getViewport({ scale: this.scale * dpr, rotation: this.rotation });
        defaultViewport = {
            width: Math.floor(scaledViewport.width) / dpr,
            height: Math.floor(scaledViewport.height) / dpr
        };
    } catch (e) {
        console.error('Error getting first page dimensions', e);
        // Fallback
        defaultViewport = { width: 600, height: 800 };
    }

    this.defaultPageHeight = defaultViewport.height;
    this.defaultPageWidth = defaultViewport.width;

    // Reset any CSS transform that might have been applied
    this.elements.container.style.transform = 'none';

    // Update Container Height - use exact height to prevent extra white space
    const totalHeight = this.pdfDoc.numPages * this.defaultPageHeight;
    this.elements.container.style.height = `${totalHeight}px`;
    this.elements.container.style.minHeight = '';
    this.elements.container.style.position = 'relative';

    // Restore Scroll Position (Anchored)
    if (main && anchorRatio > 0) {
        // Use the calculated totalHeight as the new content height
        const newContentHeight = totalHeight;
        const newCenterY = anchorRatio * newContentHeight;
        const targetScrollTop = newCenterY + paddingTop - (main.clientHeight / 2);
        
        main.scrollTop = Math.max(0, targetScrollTop);
    }

    // Update Existing Wrappers (to avoid blank screen flash)
    if (this.pageWrappers && Object.keys(this.pageWrappers).length > 0) {
        Object.keys(this.pageWrappers).forEach(key => {
            const wrapper = this.pageWrappers[key];
            if (wrapper) {
                const pageNum = parseInt(wrapper.dataset.pageNumber);
                
                // Cancel any pending render for this page
                if (this.activeRenderTasks.has(pageNum)) {
                    try {
                        this.activeRenderTasks.get(pageNum).cancel();
                    } catch(e) { /* ignore */ }
                    this.activeRenderTasks.delete(pageNum);
                }
                
                // Invalidate render ID to prevent stale renders from completing
                delete wrapper.dataset.renderId;
                delete wrapper.dataset.rendering;
                
                // Update wrapper dimensions and position
                wrapper.style.width = `${this.defaultPageWidth}px`;
                wrapper.style.height = `${this.defaultPageHeight}px`;
                wrapper.style.top = `${(pageNum - 1) * this.defaultPageHeight}px`;
                // Centering is handled by CSS, just ensure position is absolute
                wrapper.style.position = 'absolute';
                wrapper.style.left = '50%';
                wrapper.style.transform = 'translateX(-50%)';
                
                // Mark as not loaded so it re-renders
                wrapper.dataset.loaded = 'false';
                
                // Stretch the old canvas to fill the new wrapper size
                // This prevents the white background from showing during zoom (the "white block" issue)
                const oldCanvas = wrapper.querySelector('canvas:not(.pdf-canvas-rendering)');
                if (oldCanvas) {
                    oldCanvas.style.width = '100%';
                    oldCanvas.style.height = '100%';
                }
                
                // Remove any canvases that were mid-render (they're now stale)
                const renderingCanvases = wrapper.querySelectorAll('.pdf-canvas-rendering');
                renderingCanvases.forEach(c => c.remove());
            }
        });
    } else {
        // First load or full reset
        this.pageWrappers = {};
        this.elements.container.innerHTML = '';
    }

    this.pageRendering = false;

    // Update UI
    this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    if (this.elements.editZoomLevel) {
        this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    }

    // Setup Virtual Scroll
    this.setupVirtualScroll();
    
    // Initial render of visible pages
    this.updateVisiblePages();
    
    // Reset zoom flag
    this.isZooming = false;
    
    if (this.renderPending) {
      this.renderPending = false;
      this.render();
      return;
    }
    
    if (this.observer) this.observer.disconnect();

    // Restore Edit Mode
    if (wasEditMode) {
        if (wasTextEditMode) {
            await this.toggleEditMode(true, null);
            await this.setTool('text-edit');
        } else if (activeTool) {
            await this.toggleEditMode(true, activeTool);
        } else {
            await this.toggleEditMode(true);
        }
        
        if (annotationState && this.annotationManager && typeof this.annotationManager.restore === 'function') {
            this.annotationManager.restore(annotationState);
        }
    }
  }

  /**
   * Create a placeholder for a page
   */
  createPagePlaceholder(num, container, wrappers, defaultViewport) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      wrapper.dataset.pageNumber = num;
      wrapper.dataset.loaded = 'false';
      
      // Set dimensions
      // We set the wrapper size to match the expected canvas size
      wrapper.style.width = `${defaultViewport.width}px`;
      wrapper.style.height = `${defaultViewport.height}px`;
      
      container.appendChild(wrapper);
      wrappers[num] = wrapper;
  }

  /**
   * Render page content (Lazy Load)
   */
  async renderPageContent(wrapper) {
      const num = parseInt(wrapper.dataset.pageNumber);

      if (wrapper.dataset.loaded === 'true') return;

      // Strict cancellation: If a task exists, cancel it and wait for cleanup
      if (this.activeRenderTasks.has(num)) {
          try {
              this.activeRenderTasks.get(num).cancel();
          } catch (e) {
              console.warn(`Error cancelling render for page ${num}:`, e);
          }
          this.activeRenderTasks.delete(num);
      }
      
      // Generate a unique render ID to track this specific render attempt
      const renderId = Date.now() + Math.random();
      wrapper.dataset.renderId = renderId;
      wrapper.dataset.rendering = 'true';

      try {
          const page = await this.pdfDoc.getPage(num);
          
          // Check if this render is still valid (not superseded by another render)
          if (wrapper.dataset.renderId != renderId) return;
          if (wrapper.dataset.rendering !== 'true') return;

          const dpr = window.devicePixelRatio || 1;
          // Super-sampling for sharper text rendering
          // Use 2x for high-quality text, similar to how Chrome renders PDFs
          const qualityScale = 2.0;
          
          // Use dpr * qualityScale in viewport scale for sharper rendering
          const viewport = page.getViewport({ scale: this.scale * dpr * qualityScale, rotation: this.rotation });
          
          // Set canvas dimensions to super-sampled pixels
          const physicalWidth = Math.floor(viewport.width);
          const physicalHeight = Math.floor(viewport.height);
          
          // Calculate CSS dimensions (logical pixels)
          const cssWidth = physicalWidth / (dpr * qualityScale);
          const cssHeight = physicalHeight / (dpr * qualityScale);

          // Update wrapper dimensions if different (handling mixed page sizes)
          wrapper.style.width = `${cssWidth}px`;
          wrapper.style.height = `${cssHeight}px`;

          // Create new canvas but DON'T append yet - render offscreen first
          const canvas = document.createElement('canvas');
          canvas.className = 'pdf-page-canvas pdf-canvas-rendering';
          
          // Set canvas dimensions to super-sampled pixels
          canvas.width = physicalWidth;
          canvas.height = physicalHeight;
          
          // Set CSS dimensions to logical pixels
          canvas.style.width = `${cssWidth}px`;
          canvas.style.height = `${cssHeight}px`;
          
          // Use crisp-edges for pixel-perfect downscaling
          canvas.style.imageRendering = 'auto';
          
          // Position absolutely to overlay during transition
          canvas.style.position = 'absolute';
          canvas.style.top = '0';
          canvas.style.left = '0';
          canvas.style.opacity = '0'; // Hidden until render complete
          
          const ctx = canvas.getContext('2d', { alpha: false });
          // Disable image smoothing to preserve sharp text edges during rendering
          ctx.imageSmoothingEnabled = false;
          
          // Append canvas (hidden) so it can render
          wrapper.appendChild(canvas);
          
          const renderTask = page.render({
              canvasContext: ctx,
              viewport: viewport,
              intent: 'print' // Trigger higher quality rendering path
          });

          // Store render task to allow cancellation
          this.activeRenderTasks.set(num, renderTask);

          await renderTask.promise;
          
          // Verify this render is still valid before swapping
          if (wrapper.dataset.renderId != renderId) {
              canvas.remove();
              return;
          }
          
          // ATOMIC SWAP: Use requestAnimationFrame to ensure single-frame update
          // This prevents any visual glitch between removing old and showing new
          requestAnimationFrame(() => {
              // Double-check validity again in case of race condition
              if (wrapper.dataset.renderId != renderId) {
                  canvas.remove();
                  return;
              }
              
              // Remove old canvases
              const oldCanvases = wrapper.querySelectorAll('canvas:not(.pdf-canvas-rendering)');
              oldCanvases.forEach(oldCanvas => {
                  // Clear canvas memory before removal
                  oldCanvas.width = 0;
                  oldCanvas.height = 0;
                  oldCanvas.remove();
              });
              
              // Reveal the new canvas immediately (no transition)
              canvas.classList.remove('pdf-canvas-rendering');
              canvas.style.opacity = '1';
              canvas.style.position = '';
              canvas.style.top = '';
              canvas.style.left = '';
              
              // Mark as loaded inside RAF to ensure proper sequencing
              wrapper.dataset.loaded = 'true';
              delete wrapper.dataset.rendering;
              delete wrapper.dataset.renderId;
          });

          this.activeRenderTasks.delete(num);
          
      } catch (error) {
          // Ignore cancellation errors
          if (error.name === 'RenderingCancelledException') {
              // Clean up any partially rendered canvas
              const renderingCanvas = wrapper.querySelector('.pdf-canvas-rendering');
              if (renderingCanvas) renderingCanvas.remove();
          } else {
              console.error(`Error rendering page ${num}:`, error);
          }
          this.activeRenderTasks.delete(num);
          delete wrapper.dataset.rendering;
          delete wrapper.dataset.renderId;
      }
  }

  /**
   * Unload page content to free memory
   */
  unloadPageContent(wrapper) {
      const num = parseInt(wrapper.dataset.pageNumber);

      // Cancel any pending render
      if (this.activeRenderTasks.has(num)) {
          try {
            this.activeRenderTasks.get(num).cancel();
          } catch(e) { /* ignore */ }
          this.activeRenderTasks.delete(num);
      }
      
      // Invalidate any pending render by clearing the render ID
      delete wrapper.dataset.rendering;
      delete wrapper.dataset.renderId;

      // Remove ALL canvases (including any being rendered)
      const allCanvases = wrapper.querySelectorAll('canvas');
      allCanvases.forEach(canvas => {
          // Clear canvas memory
          canvas.width = 0;
          canvas.height = 0;
          canvas.remove();
      });
      
      wrapper.innerHTML = ''; // Remove all content
      wrapper.dataset.loaded = 'false';
  }

  /**
   * Setup Virtual Scroll
   */
  setupVirtualScroll() {
      const main = document.getElementById('pdf-main');
      if (!main) return;

      // Remove existing listener if any
      if (this.scrollHandler) {
          main.removeEventListener('scroll', this.scrollHandler);
      }

      // Throttled scroll handler for DOM updates
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
  updateVisiblePages() {
      const main = document.getElementById('pdf-main');
      if (!main) return;

      const scrollTop = main.scrollTop;
      const clientHeight = main.clientHeight;
      const buffer = 1; // Number of pages to render outside viewport

      // Calculate range
      let startIndex = Math.floor(scrollTop / this.defaultPageHeight) - buffer;
      let endIndex = Math.ceil((scrollTop + clientHeight) / this.defaultPageHeight) + buffer;

      // Clamp
      startIndex = Math.max(1, startIndex);
      endIndex = Math.min(this.pdfDoc.numPages, endIndex);

      // Update DOM
      // 1. Remove wrappers out of range
      // 2. Add wrappers in range
      // 3. Update padding

      // Identify pages to keep
      const pagesToKeep = new Set();
      for (let i = startIndex; i <= endIndex; i++) {
          pagesToKeep.add(i);
      }

      // Remove old wrappers
      Object.keys(this.pageWrappers).forEach(key => {
          const pageNum = parseInt(key);
          if (!pagesToKeep.has(pageNum)) {
              const wrapper = this.pageWrappers[pageNum];
              if (wrapper && wrapper.parentNode) {
                  this.unloadPageContent(wrapper); // Cleanup resources
                  wrapper.remove();
              }
              delete this.pageWrappers[pageNum];
          }
      });

      // Add new wrappers
      const fragment = document.createDocumentFragment();
      let firstWrapper = null;

      for (let i = startIndex; i <= endIndex; i++) {
          if (!this.pageWrappers[i]) {
              const wrapper = document.createElement('div');
              wrapper.className = 'pdf-page-wrapper';
              wrapper.dataset.pageNumber = i;
              wrapper.dataset.loaded = 'false';
              wrapper.style.width = `${this.defaultPageWidth}px`;
              wrapper.style.height = `${this.defaultPageHeight}px`;
              
              // Use absolute positioning with transform for centering
              wrapper.style.position = 'absolute';
              wrapper.style.top = `${(i - 1) * this.defaultPageHeight}px`;
              wrapper.style.left = '50%';
              wrapper.style.transform = 'translateX(-50%)';

              this.elements.container.appendChild(wrapper);
              this.pageWrappers[i] = wrapper;
              
              // Trigger render
              this.renderPageContent(wrapper);
          }
      }

      // Update current page number based on scroll
      const centerPoint = scrollTop + (clientHeight / 2);
      const currentPage = Math.floor(centerPoint / this.defaultPageHeight) + 1;
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
   * Setup intersection observer to update page number
   * Deprecated in favor of scroll-based calculation in updateVisiblePages
   */
  setupIntersectionObserver() {
      // No-op for virtual scroll
  }

  /**
   * Update current page based on visibility
   * Deprecated
   */
  updateCurrentPage() {
      // No-op
  }

  /**
   * Scroll to specific page
   * @param {number} num - Page number
   */
  scrollToPage(num) {
    const main = document.getElementById('pdf-main');
    if (main) {
        const top = (num - 1) * this.defaultPageHeight;
        main.scrollTo({ top: top, behavior: 'auto' }); // Use auto for instant jump or smooth for animation
        
        // Force update immediately
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
      const firstPage = await this.pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1.0, rotation: this.rotation });
      
      const main = document.getElementById('pdf-main');
      if (!main) {
        this.scale = 1.0;
        return;
      }
      
      // Get available space (accounting for padding and sidebar)
      const availableWidth = main.clientWidth - 48; // 24px padding on each side
      const availableHeight = main.clientHeight - 48;
      
      // Calculate scale to fit width or height
      const scaleWidth = availableWidth / viewport.width;
      const scaleHeight = availableHeight / viewport.height;
      
      // Use the smaller scale to ensure the page fits entirely
      // But cap at 1.5 to avoid overly large pages
      // And minimum of 0.3 to avoid too small
      let optimalScale = Math.min(scaleWidth, scaleHeight);
      optimalScale = Math.max(0.3, Math.min(1.5, optimalScale));
      
      // Round to 1 decimal place
      this.scale = Math.round(optimalScale * 10) / 10;
      
      console.log(`PDF dimensions: ${viewport.width}x${viewport.height}, Available: ${availableWidth}x${availableHeight}, Scale: ${this.scale}`);
    } catch (error) {
      console.error('Error calculating scale:', error);
      this.scale = 1.0;
    }
  }

  /**
   * Zoom in
   */
  onZoomIn() {
    if (this.scale >= this.MAX_ZOOM) return;
    this.scale = Math.round((this.scale + 0.1) * 10) / 10;
    if (this.scale > this.MAX_ZOOM) this.scale = this.MAX_ZOOM;
    this.applySmoothZoom();
  }

  /**
   * Zoom out
   */
  onZoomOut() {
    if (this.scale <= 0.2) return;
    this.scale = Math.round((this.scale - 0.1) * 10) / 10;
    this.applySmoothZoom();
  }

  /**
   * Apply zoom without CSS transform to avoid glitches
   * Simply debounce and re-render at new scale
   */
  applySmoothZoom() {
      // Update UI immediately
      if (this.elements.zoomLevel) {
          this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }
      if (this.elements.editZoomLevel) {
          this.elements.editZoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
      }

      // Mark that we're in a zoom operation
      this.isZooming = true;
      
      // Debounce the actual render to avoid too many re-renders during rapid zoom
      if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
      this.zoomTimeout = setTimeout(() => {
          // Queue render - old canvases stay visible until new ones are ready
          this.queueRender();
      }, 100);
  }

  /**
   * Rotate
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.queueRender();
  }

  /**
   * Fit to width - scale PDF to fit the available width
   */
  async fitToWidth() {
    try {
      const currentPage = await this.pdfDoc.getPage(this.pageNum);
      const viewport = currentPage.getViewport({ scale: 1.0, rotation: this.rotation });
      
      const main = document.getElementById('pdf-main');
      if (!main) return;
      
      const availableWidth = main.clientWidth - 48; // accounting for padding
      this.scale = Math.round((availableWidth / viewport.width) * 10) / 10;
      this.scale = Math.max(0.2, Math.min(this.MAX_ZOOM, this.scale)); // Clamp between 0.2 and MAX_ZOOM
      
      this.queueRender();
    } catch (error) {
      console.error('Error fitting to width:', error);
    }
  }

  /**
   * Fit to page - scale PDF to fit entirely in viewport
   */
  async fitToPage() {
    try {
      const currentPage = await this.pdfDoc.getPage(this.pageNum);
      const viewport = currentPage.getViewport({ scale: 1.0, rotation: this.rotation });
      
      const main = document.getElementById('pdf-main');
      if (!main) return;
      
      const availableWidth = main.clientWidth - 48;
      const availableHeight = main.clientHeight - 48;
      
      const scaleWidth = availableWidth / viewport.width;
      const scaleHeight = availableHeight / viewport.height;
      
      this.scale = Math.round(Math.min(scaleWidth, scaleHeight) * 10) / 10;
      this.scale = Math.max(0.2, Math.min(this.MAX_ZOOM, this.scale));
      
      this.queueRender();
    } catch (error) {
      console.error('Error fitting to page:', error);
    }
  }

  /**
   * Render thumbnails in sidebar
   */
  async renderThumbnails() {
    const sidebar = this.elements.sidebar;
    sidebar.innerHTML = '<div class="pdf-sidebar-content"></div>';
    const container = sidebar.querySelector('.pdf-sidebar-content');
    
    this.thumbnailWrappers = [];

    // Create placeholders
    for (let num = 1; num <= this.pdfDoc.numPages; num++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-thumbnail';
      if (num === this.pageNum) wrapper.classList.add('active');
      wrapper.dataset.pageNumber = num;
      wrapper.dataset.loaded = 'false';
      
      // Click to scroll
      wrapper.addEventListener('click', () => {
        this.scrollToPage(num);
      });

      // Canvas
      const canvas = document.createElement('canvas');
      // Set a default size to avoid layout shift
      canvas.width = 140;
      canvas.height = 200; // Approx A4
      wrapper.appendChild(canvas);
      
      // Page Number
      const label = document.createElement('div');
      label.className = 'pdf-thumbnail-number';
      label.textContent = num;
      wrapper.appendChild(label);

      container.appendChild(wrapper);
      this.thumbnailWrappers[num] = wrapper;
    }

    this.setupThumbnailObserver();
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
          rootMargin: '100% 0px', // Render ahead
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
          
          // Calculate scale to match sidebar width (approx 140px + padding)
          // We want crisp thumbnails, so we consider devicePixelRatio
          const dpr = window.devicePixelRatio || 1;
          const targetWidth = 150; // Slightly larger than CSS width (140px)
          // Use 2x super-sampling for sharp thumbnails
          const qualityScale = 2.0;
          
          // Get unscaled viewport to calculate required scale
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const scale = (targetWidth / unscaledViewport.width) * dpr * qualityScale;
          
          const viewport = page.getViewport({ scale: scale });
          
          const ctx = canvas.getContext('2d', { alpha: false });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          
          // Set CSS size for proper downscaling
          canvas.style.width = `${viewport.width / (dpr * qualityScale)}px`;
          canvas.style.height = `${viewport.height / (dpr * qualityScale)}px`;
          
          // Disable smoothing for crisp text
          ctx.imageSmoothingEnabled = false;
          
          await page.render({
              canvasContext: ctx,
              viewport: viewport,
              intent: 'print' // Higher quality rendering
          }).promise;
          
          wrapper.dataset.loaded = 'true';
      } catch (error) {
          console.error(`Error rendering thumbnail ${num}:`, error);
      }
  }

  /**
   * Update active thumbnail based on current page
   * @param {number} pageNum - Current page number
   */
  updateActiveThumbnail(pageNum) {
    if (!this.thumbnailWrappers) return;

    // Remove active class from all
    this.thumbnailWrappers.forEach(wrapper => {
      if (wrapper) wrapper.classList.remove('active');
    });
    
    // Add to current
    const current = this.thumbnailWrappers[pageNum];
    if (current) {
      current.classList.add('active');
      // Scroll sidebar to keep thumbnail in view
      current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
}

window.PdfViewer = PdfViewer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PdfViewer;
}
