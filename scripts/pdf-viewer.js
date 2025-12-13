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
    this.rotation = 0;
    this.canvas = null;
    this.ctx = null;
    this.isOpen = false;
    this.isEditMode = false;
    
    this.elements = {};
    
    this.annotationManager = new AnnotationManager(this.uiController);
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
    this.elements.rotate.addEventListener('click', () => this.rotate());
    
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
          if (e.shiftKey) {
              this.annotationManager.redo();
          } else {
              this.annotationManager.undo();
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

    if (this.elements.undoEditBtn) this.elements.undoEditBtn.addEventListener('click', () => this.annotationManager.undo());
    if (this.elements.redoEditBtn) this.elements.redoEditBtn.addEventListener('click', () => this.annotationManager.redo());

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
  toggleEditMode(active) {
      this.isEditMode = active;

      if (active) {
          this.elements.defaultToolbar.classList.add('hidden');
          this.elements.editToolbar.classList.remove('hidden');
          this.elements.propertiesSidebar.classList.remove('hidden');
          
          // Collect all page wrappers and canvases
          const targets = [];
          this.pageWrappers.forEach(wrapper => {
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

          if (targets.length > 0) {
            this.annotationManager.start(targets, null, {
                propertiesContainer: this.elements.propertiesContainer
            });
            // Default to pen tool, but don't force it if we are just toggling UI
            // Actually, start() resets state, so we should set a tool.
            // But if the user switches tools, we shouldn't reset to pen unless we are starting fresh.
            // Since toggleEditMode(true) is called when entering, setting 'pen' here is fine for initial entry.
            // However, the user issue is about switching tools and getting stuck or overlay issues.
            // The issue "superposition avec une autre page" suggests the annotation layer might be catching events it shouldn't,
            // or the "drop zone" is showing through?
            // If the user saves and then switches tools, maybe the state isn't clean.
            
            this.setTool('pen');
          } else {
            this.uiController.showToast('Impossible d\'annoter : aucun document chargé', 'error');
            this.toggleEditMode(false);
          }

      } else {
          this.elements.defaultToolbar.classList.remove('hidden');
          this.elements.editToolbar.classList.add('hidden');
          this.elements.propertiesSidebar.classList.add('hidden');
          
          this.annotationManager.stop();
      }
  }

  setTool(toolId) {
      this.annotationManager.setTool(toolId);
      
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
   * Open PDF file
   * @param {Object} file - File object
   */
  async open(file) {
    this.currentFile = file;
    this.isOpen = true;
    this.pageNum = 1;
    this.scale = 1.0;
    this.rotation = 0;
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
          password: ''
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
          this.render();
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
    // Auto-save on close if there are changes
    if (this.annotationManager.hasChanges() || this.rotation !== 0) {
        await this.save();
    }

    this.isOpen = false;
    this.toggleEditMode(false);
    
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
      
      // Apply annotations
      // Note: We need to ensure any active text input is finalized before saving
      if (this.annotationManager.activeInput) {
          this.annotationManager.finalizeTextInput();
      }

      if (this.annotationManager.hasChanges()) {
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
   * Save changes to PDF
   */
  async save() {
    if (!this.currentFile) return;

    try {
        this.uiController.showToast('Enregistrement du PDF...', 'info');
        
        const blob = await this.generatePdfBlob();
        const success = await this.fileHandler.saveFile(this.currentFile, blob);
        
        if (success) {
            this.uiController.showToast('PDF enregistré', 'success');
            this.rotation = 0;
            this.annotationManager.clear();
            
            // Reload the PDF to show the saved version
            // We need to close and reopen or just re-render
            // Re-opening is safer to ensure we get the fresh file content
            // IMPORTANT: Do NOT call close() before open() if it triggers the "remove file" logic for single files.
            // this.open() handles resetting the UI.
            await this.open(this.currentFile);
            
            // Restore edit mode if it was active
            if (this.isEditMode) {
                this.toggleEditMode(true);
                // Restore tool
                const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
                if (activeToolBtn) {
                    this.setTool(activeToolBtn.dataset.tool);
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
    this.elements.container.innerHTML = '';
    
    // If annotation was active, we need to stop it because the container is cleared
    if (this.isEditMode) {
        this.toggleEditMode(false);
    }

    this.pageWrappers = [];

    for (let num = 1; num <= this.pdfDoc.numPages; num++) {
      await this.renderSinglePage(num);
    }

    this.pageRendering = false;
    
    if (this.renderPending) {
      this.renderPending = false;
      this.render();
    }

    // Update UI
    this.elements.zoomLevel.textContent = `${Math.round(this.scale * 100)}%`;
    
    // Setup intersection observer
    this.setupIntersectionObserver();
  }

  /**
   * Render a single page
   * @param {number} num - Page number
   */
  async renderSinglePage(num) {
    try {
      const page = await this.pdfDoc.getPage(num);
      const dpr = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: this.scale, rotation: this.rotation });
      
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-page-wrapper';
      wrapper.dataset.pageNumber = num;
      
      const canvas = document.createElement('canvas');
      canvas.className = 'pdf-page-canvas';
      wrapper.appendChild(canvas);
      
      this.elements.container.appendChild(wrapper);
      this.pageWrappers[num] = wrapper;
      
      const ctx = canvas.getContext('2d');
      
      // Fix blurry text: account for device pixel ratio
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      
      ctx.scale(dpr, dpr);
      
      // Render context
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise;
      
      // Observe if observer is set up
      if (this.observer) {
        this.observer.observe(wrapper);
      }
    } catch (error) {
      console.error(`Error rendering page ${num}:`, error);
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
   */
  setupIntersectionObserver() {
    if (this.observer) {
      this.observer.disconnect();
    }

    const main = document.getElementById('pdf-main');
    if (!main) return;

    const options = {
      root: main,
      rootMargin: '0px',
      threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    };

    this.visiblePages = new Map();

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const pageNum = parseInt(entry.target.dataset.pageNumber);
        if (entry.isIntersecting) {
          this.visiblePages.set(pageNum, entry);
        } else {
          this.visiblePages.delete(pageNum);
        }
      });

      this.updateCurrentPage();
    }, options);

    // Observe existing wrappers
    this.pageWrappers.forEach(wrapper => {
      if (wrapper) this.observer.observe(wrapper);
    });
  }

  /**
   * Update current page based on visibility
   */
  updateCurrentPage() {
    let maxVisibleHeight = 0;
    let mostVisiblePage = this.pageNum;

    this.visiblePages.forEach((entry, pageNum) => {
      const visibleHeight = entry.intersectionRect.height;
      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        mostVisiblePage = pageNum;
      }
    });

    if (mostVisiblePage && this.pageNum !== mostVisiblePage) {
      this.pageNum = mostVisiblePage;
      this.elements.pageNum.value = mostVisiblePage;
      this.updateActiveThumbnail(mostVisiblePage);
    }
  }

  /**
   * Scroll to specific page
   * @param {number} num - Page number
   */
  scrollToPage(num) {
    if (this.pageWrappers && this.pageWrappers[num]) {
      this.pageWrappers[num].scrollIntoView({ behavior: 'smooth', block: 'start' });
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
   * Zoom in
   */
  onZoomIn() {
    this.scale += 0.1;
    this.queueRender();
  }

  /**
   * Zoom out
   */
  onZoomOut() {
    if (this.scale <= 0.2) return;
    this.scale -= 0.1;
    this.queueRender();
  }

  /**
   * Rotate
   */
  rotate() {
    this.rotation = (this.rotation + 90) % 360;
    this.queueRender();
  }

  /**
   * Render thumbnails in sidebar
   */
  async renderThumbnails() {
    const sidebar = this.elements.sidebar;
    sidebar.innerHTML = '<div class="pdf-sidebar-content"></div>';
    const container = sidebar.querySelector('.pdf-sidebar-content');
    
    this.thumbnailWrappers = [];

    for (let num = 1; num <= this.pdfDoc.numPages; num++) {
      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'pdf-thumbnail';
      if (num === this.pageNum) wrapper.classList.add('active');
      wrapper.dataset.pageNumber = num;
      
      // Click to scroll
      wrapper.addEventListener('click', () => {
        this.scrollToPage(num);
      });

      // Canvas
      const canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
      
      // Page Number
      const label = document.createElement('div');
      label.className = 'pdf-thumbnail-number';
      label.textContent = num;
      wrapper.appendChild(label);

      container.appendChild(wrapper);
      this.thumbnailWrappers[num] = wrapper;

      // Render content (async)
      // We use a separate promise chain to not block the UI
      this.pdfDoc.getPage(num).then(page => {
        const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnail
        const ctx = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        page.render({
          canvasContext: ctx,
          viewport: viewport
        });
      }).catch(error => {
        console.error(`Error rendering thumbnail for page ${num}:`, error);
      });
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
