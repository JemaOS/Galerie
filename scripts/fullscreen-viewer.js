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

 // JemaOS Gallery - Fullscreen Viewer

/**
 * Handles fullscreen media viewing experience
 */

class FullscreenViewer {
  constructor(fileHandler, uiController) {
    this.fileHandler = fileHandler;
    this.uiController = uiController;
    
    this.currentFile = null;
    this.currentIndex = 0;
    this.files = [];
    this.isOpen = false;
    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;
    this.isFullscreen = false;
    this.zoomLevel = 1;
    this.videoPlayer = null;
    this.autoHideControls = true;
    this.controlsTimeout = null;
    
    this.elements = {};
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.swipeThreshold = 50;
    
    this.annotationManager = null;
    this.transform = { x: 0, y: 0, scale: 1 };
    this.rotation = 0;
    this.isEditMode = false;

    // Adjustment State
    this.adjustments = {
        brightness: 0,
        exposure: 0,
        contrast: 0,
        highlights: 0,
        shadows: 0,
        vignette: 0,
        saturation: 0,
        warmth: 0,
        tint: 0,
        sharpness: 0
    };

    // History
    this.history = [];
    this.historyStep = -1;
    
    // Zoom optimization timeouts
    this.filterUpdateTimeout = null;
    this.zoomingClassTimeout = null;
  }

  /**
   * Initialize fullscreen viewer
   */
  init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    this.setupTouchGestures();
    this.createSVGFilter();
  }

  createSVGFilter() {
      const id = `adjust-filter-${Date.now()}`;
      this.filterId = id;
      
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.display = 'none';
      svg.innerHTML = `
        <defs>
          <filter id="${id}" color-interpolation-filters="sRGB">
            <feComponentTransfer result="tonal">
              <feFuncR type="table" tableValues="0 1"/>
              <feFuncG type="table" tableValues="0 1"/>
              <feFuncB type="table" tableValues="0 1"/>
            </feComponentTransfer>
            <feGaussianBlur in="tonal" stdDeviation="1" result="blur"/>
            <feComposite in="tonal" in2="blur" operator="arithmetic" k1="0" k2="1" k3="0" k4="0"/>
          </filter>
        </defs>
      `;
      document.body.appendChild(svg);
      this.svgFilter = svg;
  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      viewer: document.getElementById('fullscreen-viewer'),
      defaultToolbar: document.getElementById('viewer-default-toolbar'),
      editToolbar: document.getElementById('viewer-edit-toolbar'),
      media: document.getElementById('viewer-media'),
      filename: document.getElementById('viewer-filename'),
      
      // Default Toolbar Buttons
      info: document.getElementById('viewer-info'),
      print: document.getElementById('viewer-print'),
      delete: document.getElementById('viewer-delete'),
      zoomOut: document.getElementById('viewer-zoom-out'),
      zoomIn: document.getElementById('viewer-zoom-in'),
      rotate: document.getElementById('viewer-rotate'),
      editModeBtn: document.getElementById('viewer-edit-mode'),
      fullscreenBtn: document.getElementById('viewer-fullscreen'),
      
      // Edit Toolbar Buttons
      exitEditBtn: document.getElementById('viewer-exit-edit'),
      undoEditBtn: document.getElementById('viewer-undo-edit'),
      redoEditBtn: document.getElementById('viewer-redo-edit'),
      
      // Sidebar & Properties
      sidebar: document.getElementById('viewer-properties-sidebar'),
      propertiesContainer: document.getElementById('viewer-properties-container'),
      
      // Split Save Button (Sidebar)
      saveSplitBtn: document.getElementById('viewer-save-split'),
      saveOptionsBtn: document.getElementById('viewer-save-options'),
      saveDropdown: document.getElementById('viewer-save-dropdown'),
      saveAsSplitBtn: document.getElementById('viewer-save-as-split'),

      // Split Save Button (Toolbar)
      toolbarSaveSplitBtn: document.getElementById('viewer-toolbar-save-split'),
      toolbarSaveOptionsBtn: document.getElementById('viewer-toolbar-save-options'),
      toolbarSaveDropdown: document.getElementById('viewer-toolbar-save-dropdown'),
      toolbarSaveAsSplitBtn: document.getElementById('viewer-toolbar-save-as-split')
    };
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Default Toolbar
    if (this.elements.info) {
        this.elements.info.addEventListener('click', () => {
            if (this.currentFile) {
                const ui = this.uiController || window.galleryUI;
                if (ui) ui.showFileModal(this.currentFile);
            }
        });
    }
    
    if (this.elements.print) {
        this.elements.print.addEventListener('click', () => {
            if (this.currentFile) {
                GalleryUtils.printFile(this.currentFile.url, this.currentFile.type);
            }
        });
    }

    if (this.elements.delete) this.elements.delete.addEventListener('click', () => this.uiController.deleteFiles([this.currentFile.id]));
    
    if (this.elements.zoomOut) this.elements.zoomOut.addEventListener('click', () => this.setZoom(this.zoomLevel - 0.1));
    if (this.elements.zoomIn) this.elements.zoomIn.addEventListener('click', () => this.setZoom(this.zoomLevel + 0.1));
    
    if (this.elements.rotate) {
        this.elements.rotate.addEventListener('click', () => {
            const oldRotation = this.rotation;
            this.rotation = (this.rotation + 90) % 360;
            const newRotation = this.rotation;
            
            this.addToHistory({
                type: 'rotation',
                undo: () => {
                    this.rotation = oldRotation;
                    this.applyTransform();
                },
                redo: () => {
                    this.rotation = newRotation;
                    this.applyTransform();
                }
            });
            this.applyTransform();
        });
    }

    if (this.elements.editModeBtn) {
        this.elements.editModeBtn.addEventListener('click', () => this.toggleEditMode(true));
    }

    if (this.elements.fullscreenBtn) {
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    }

    // Edit Toolbar
    if (this.elements.exitEditBtn) {
        this.elements.exitEditBtn.addEventListener('click', () => this.toggleEditMode(false));
    }

    if (this.elements.undoEditBtn) this.elements.undoEditBtn.addEventListener('click', () => this.undo());
    if (this.elements.redoEditBtn) this.elements.redoEditBtn.addEventListener('click', () => this.redo());

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

    // Viewer container events
    this.elements.viewer.addEventListener('click', (e) => {
      // Prevent accidental closing if double clicking to open
      if (this.openTime && Date.now() - this.openTime < 500) {
        return;
      }
    });
    
    // Media events
    this.elements.media.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this.isEditMode) {
          this.togglePlayPause();
      }
    });
    
    // Mouse movement for controls
    this.elements.viewer.addEventListener('mousemove', () => {
      this.showControls();
    });
    
    // Double click for fullscreen
    this.elements.media.addEventListener('dblclick', (e) => {
      e.preventDefault();
      if (!this.isEditMode) {
          this.toggleFullscreen();
      }
    });
    
    // Wheel for zoom (images) - optimized with exponential factor
    this.elements.media.addEventListener('wheel', (e) => {
      if (this.currentFile?.type === 'image') {
        e.preventDefault();
        
        const img = this.elements.media.querySelector('img');
        if (img && !img.classList.contains('zooming')) {
            img.classList.add('zooming');
        }
        
        let deltaY = e.deltaY;
        
        // Normalize deltaMode (1 = lines, 2 = pages)
        if (e.deltaMode === 1) {
            deltaY *= 16;
        } else if (e.deltaMode === 2) {
            deltaY *= 800;
        }

        // Facteur exponentiel (comme PDF viewer) - plus naturel
        const delta = -deltaY;
        const factor = Math.pow(1.01, delta);
        const newZoom = this.zoomLevel * factor;
        
        this.setZoom(newZoom, e.clientX, e.clientY);
        
        // Retirer la classe zooming après un délai
        if (this.zoomingClassTimeout) {
            clearTimeout(this.zoomingClassTimeout);
        }
        this.zoomingClassTimeout = setTimeout(() => {
            if (img) img.classList.remove('zooming');
        }, 150);
      }
    }, { passive: false });
    
    // Fullscreen change events
    document.addEventListener('fullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('webkitfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('mozfullscreenchange', () => this.handleFullscreenChange());
    document.addEventListener('MSFullscreenChange', () => this.handleFullscreenChange());
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      
      switch(e.key) {
        case 'Escape':
          if (this.isEditMode) {
             this.toggleEditMode(false);
          } else {
             this.close();
          }
          break;
        case ' ': // Space
          if (this.currentFile && (this.currentFile.type === 'video' || this.currentFile.type === 'audio')) {
            e.preventDefault();
            this.togglePlayPause();
          }
          break;
        case 'z':
        case 'Z':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                if (e.shiftKey) {
                    this.redo();
                } else {
                    this.undo();
                }
            }
            break;
      }
    });
  }

  /**
   * Setup touch gestures
   */
  setupTouchGestures() {
      // Pinch-to-zoom state
      let initialPinchDistance = null;
      let initialScale = 1;
      let pinchCenterX = 0;
      let pinchCenterY = 0;
      let isPinching = false;
      let pinchRafId = null;

      this.elements.viewer.addEventListener('touchstart', (e) => {
          // Handle pinch-to-zoom (2 fingers)
          if (e.touches.length === 2) {
              isPinching = true;
              initialPinchDistance = this.getDistance(e.touches[0], e.touches[1]);
              initialScale = this.zoomLevel;
              pinchCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              pinchCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              
              // Add zooming class to disable CSS transitions during gesture
              const img = this.elements.media.querySelector('img');
              if (img) img.classList.add('zooming');
          } else {
              // Single touch - swipe support
              this.touchStartX = e.changedTouches[0].screenX;
              this.touchStartY = e.changedTouches[0].screenY;
          }
      }, { passive: true });

      this.elements.viewer.addEventListener('touchmove', (e) => {
          if (isPinching && e.touches.length === 2) {
              e.preventDefault();
              
              const currentDistance = this.getDistance(e.touches[0], e.touches[1]);
              const scale = (currentDistance / initialPinchDistance) * initialScale;
              const newCenterX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
              const newCenterY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
              
              // Use requestAnimationFrame for smooth 60fps updates
              if (!pinchRafId) {
                  pinchRafId = requestAnimationFrame(() => {
                      this.setZoom(scale, newCenterX, newCenterY);
                      pinchRafId = null;
                  });
              }
          }
      }, { passive: false });

      this.elements.viewer.addEventListener('touchend', (e) => {
          if (isPinching && e.touches.length < 2) {
              isPinching = false;
              initialPinchDistance = null;
              
              // Remove zooming class to restore CSS transitions
              const img = this.elements.media.querySelector('img');
              if (img) img.classList.remove('zooming');
              
              // Cancel any pending animation frame
              if (pinchRafId) {
                  cancelAnimationFrame(pinchRafId);
                  pinchRafId = null;
              }
              return;
          }

          // Handle swipe gestures (single touch)
          if (this.zoomLevel > 1 || this.isEditMode || isPinching) return;

          const touchEndX = e.changedTouches[0].screenX;
          const touchEndY = e.changedTouches[0].screenY;
          
          const diffX = touchEndX - this.touchStartX;
          const diffY = touchEndY - this.touchStartY;

          if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > this.swipeThreshold) {
              if (diffY > 0) { // Swipe down
                  this.close();
              }
          }
      }, { passive: true });
  }

  /**
   * Calculate distance between two touch points
   * @param {Touch} touch1 - First touch point
   * @param {Touch} touch2 - Second touch point
   * @returns {number} Distance in pixels
   */
  getDistance(touch1, touch2) {
      const dx = touch1.clientX - touch2.clientX;
      const dy = touch1.clientY - touch2.clientY;
      return Math.sqrt(dx * dx + dy * dy);
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
  async toggleEditMode(active) {
      if (this.currentFile?.type !== 'image') {
          this.uiController.showToast('L\'édition n\'est disponible que pour les images', 'info');
          return;
      }

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
          this.elements.sidebar.classList.remove('hidden');
          
          // Default to Pen tool to match screenshot and user request
          this.setTool('pen');
          
      } else {
          this.elements.defaultToolbar.classList.remove('hidden');
          this.elements.editToolbar.classList.add('hidden');
          this.elements.sidebar.classList.add('hidden');
          
          if (this.annotationManager) {
              this.annotationManager.stop();
          }
          this.history = [];
          this.historyStep = -1;
          this.updateUndoRedoButtons();
          
          // Restore cursor based on zoom level
          const img = this.elements.media.querySelector('img');
          if (img) {
            img.style.cursor = this.zoomLevel > 1 ? 'grab' : 'default';
          }
      }
  }

  setTool(toolId) {
      // Update UI in Edit Toolbar
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

      if (toolId === 'adjust') {
          if (this.annotationManager) this.annotationManager.pause();
          this.renderAdjustmentUI();
      } else {
          // Drawing tools
          const img = this.elements.media.querySelector('img');
          if (img && this.annotationManager) {
              // If switching from Adjust, we need to ensure AnnotationManager starts
              if (!this.annotationManager.isActive) {
                  if (this.annotationManager.hasCanvas()) {
                      this.annotationManager.resume();
                      // Restore properties UI if it was overwritten (e.g. by Adjust tool)
                      this.annotationManager.renderProperties(this.elements.propertiesContainer);
                  } else {
                      this.annotationManager.start([{
                          container: this.elements.media,
                          target: img,
                          id: 'main'
                      }], null, {
                          propertiesContainer: this.elements.propertiesContainer,
                          onAction: () => {
                              this.addToHistory({
                                  type: 'annotation',
                                  undo: () => this.annotationManager.undo(),
                                  redo: () => this.annotationManager.redo()
                              });
                          }
                      });
                  }
              }
              this.annotationManager.setTool(toolId);
          }
      }
  }

  renderAdjustmentUI() {
      const container = this.elements.propertiesContainer;
      container.classList.remove('hidden');
      container.innerHTML = '';

      const groups = [
          {
              title: 'Clair',
              items: [
                  { id: 'brightness', label: 'Luminosité', icon: 'brightness_5', min: -100, max: 100 },
                  { id: 'exposure', label: 'Exposition', icon: 'exposure', min: -100, max: 100 },
                  { id: 'contrast', label: 'Contraste', icon: 'contrast', min: -100, max: 100 },
                  { id: 'highlights', label: 'Essentiel', icon: 'highlight', min: -100, max: 100 },
                  { id: 'shadows', label: 'Ombres', icon: 'brightness_4', min: -100, max: 100 },
                  { id: 'vignette', label: 'Vignette', icon: 'vignette', min: 0, max: 100 }
              ]
          },
          {
              title: 'Couleur',
              items: [
                  { id: 'saturation', label: 'Saturation', icon: 'invert_colors', min: -100, max: 100 },
                  { id: 'warmth', label: 'Chaleur', icon: 'thermostat', min: 0, max: 100 },
                  { id: 'tint', label: 'Teinte', icon: 'water_drop', min: -100, max: 100 },
                  { id: 'sharpness', label: 'Netteté', icon: 'diamond', min: 0, max: 100 }
              ]
          }
      ];

      groups.forEach(groupData => {
          const group = document.createElement('div');
          group.className = 'adjustment-group';
          
          const header = document.createElement('div');
          header.className = 'adjustment-header';
          header.textContent = groupData.title;
          group.appendChild(header);

          groupData.items.forEach(adj => {
              const item = document.createElement('div');
              item.className = 'adjustment-item';
              
              const labelRow = document.createElement('div');
              labelRow.className = 'adjustment-label-row';
              
              const label = document.createElement('div');
              label.className = 'adjustment-label';
              label.innerHTML = `<i class="material-icons" style="font-size: 16px;">${adj.icon}</i> ${adj.label}`;
              
              const valueDisplay = document.createElement('span');
              valueDisplay.textContent = this.adjustments[adj.id];
              
              labelRow.appendChild(label);
              labelRow.appendChild(valueDisplay);
              item.appendChild(labelRow);
              
              const slider = document.createElement('input');
              slider.type = 'range';
              slider.className = 'adjustment-slider';
              slider.min = adj.min;
              slider.max = adj.max;
              slider.value = this.adjustments[adj.id];
              
              slider.addEventListener('pointerdown', () => {
                  slider.dataset.startValue = this.adjustments[adj.id];
              });

              slider.addEventListener('input', (e) => {
                  const val = parseInt(e.target.value);
                  this.adjustments[adj.id] = val;
                  valueDisplay.textContent = val;
                  this.applyAdjustments();
              });

              slider.addEventListener('change', (e) => {
                  const newVal = parseInt(e.target.value);
                  const oldVal = parseInt(slider.dataset.startValue);
                  if (newVal !== oldVal) {
                      this.addAdjustmentToHistory(adj.id, oldVal, newVal);
                  }
              });
              
              item.appendChild(slider);
              group.appendChild(item);
          });

          container.appendChild(group);
      });
  }

  applyAdjustments() {
      const img = this.elements.media.querySelector('img');
      if (!img) return;

      const brightness = 100 + this.adjustments.brightness + this.adjustments.exposure;
      const contrast = 100 + this.adjustments.contrast;
      const saturation = 100 + this.adjustments.saturation;
      const sepia = this.adjustments.warmth;
      const hueRotate = this.adjustments.tint * 1.8;
      
      // Update SVG Filter for Highlights/Shadows
      const shadows = this.adjustments.shadows / 100; // -1 to 1
      const highlights = this.adjustments.highlights / 100; // -1 to 1
      
      const tableValues = [];
      for (let i = 0; i <= 20; i++) {
          let x = i / 20;
          let y = x;
          
          // Shadows (brighten darks)
          if (shadows !== 0) {
              // Influence factor: max at 0, decays to 0 at 1
              const influence = Math.exp(-x * 4);
              y += (1 - x) * influence * shadows * 0.6;
          }
          
          // Highlights (darken brights)
          if (highlights !== 0) {
              // Influence factor: max at 1, decays to 0 at 0
              const influence = Math.exp(-(1 - x) * 4);
              y -= x * influence * highlights * 0.6;
          }
          
          y = Math.max(0, Math.min(1, y));
          tableValues.push(y);
      }
      
      const tableStr = tableValues.join(' ');
      const filter = document.getElementById(this.filterId);
      if (filter) {
          ['R', 'G', 'B'].forEach(c => {
              const func = filter.querySelector(`feFunc${c}`);
              if (func) func.setAttribute('tableValues', tableStr);
          });
          
          // Update Sharpness
          const sharpness = this.adjustments.sharpness;
          const composite = filter.querySelector('feComposite');
          if (composite) {
              const strength = sharpness / 30;
              composite.setAttribute('k2', 1 + strength);
              composite.setAttribute('k3', -strength);
          }
      }

      img.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) url(#${this.filterId})`;

      // Vignette (using mask to reveal black background)
      if (this.adjustments.vignette > 0) {
          const v = this.adjustments.vignette;
          const stop = Math.max(0, 100 - v);
          const mask = `radial-gradient(circle, black ${stop}%, transparent 150%)`;
          img.style.webkitMaskImage = mask;
          img.style.maskImage = mask;
      } else {
          img.style.webkitMaskImage = 'none';
          img.style.maskImage = 'none';
      }
  }

  /**
   * Generate Image Blob with changes
   */
  async generateImageBlob() {
      const img = this.elements.media.querySelector('img');
      const annotationCanvas = this.elements.media.querySelector('.annotation-canvas');
      
      if (!img) return null;

      // Finalize any active text input
      if (this.annotationManager && this.annotationManager.activeInput) {
          this.annotationManager.finalizeTextInput();
      }

      const originalWidth = img.naturalWidth;
      const originalHeight = img.naturalHeight;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Swap dimensions if rotated 90 or 270
      if (this.rotation % 180 !== 0) {
          canvas.width = originalHeight;
          canvas.height = originalWidth;
      } else {
          canvas.width = originalWidth;
          canvas.height = originalHeight;
      }
      
      ctx.save();
      
      // Move to center
      ctx.translate(canvas.width / 2, canvas.height / 2);
      
      // Rotate
      ctx.rotate(this.rotation * Math.PI / 180);
      
      // Apply Filters
      const brightness = 100 + this.adjustments.brightness + this.adjustments.exposure;
      const contrast = 100 + this.adjustments.contrast;
      const saturation = 100 + this.adjustments.saturation;
      const sepia = this.adjustments.warmth;
      const hueRotate = this.adjustments.tint * 1.8;
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) url(#${this.filterId})`;

      // Draw image (centered)
      ctx.drawImage(img, -originalWidth / 2, -originalHeight / 2);
      
      // Draw Vignette
      if (this.adjustments.vignette > 0) {
          ctx.filter = 'none'; // Reset filter for gradient
          const v = this.adjustments.vignette;
          const radius = Math.max(originalWidth, originalHeight) / 2 * 1.5;
          const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
          
          const stop = Math.max(0, (100 - v) / 100);
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(stop, 'rgba(0,0,0,0)');
          grad.addColorStop(1, `rgba(0,0,0,${v/100})`); // Fade to black
          
          ctx.fillStyle = grad;
          ctx.fillRect(-originalWidth/2, -originalHeight/2, originalWidth, originalHeight);
      }

      // Draw annotations (without filter)
      ctx.filter = 'none';
      if (annotationCanvas) {
          ctx.drawImage(annotationCanvas, -originalWidth / 2, -originalHeight / 2);
      }
      
      // Draw text objects
      if (this.annotationManager) {
          ctx.save();
          ctx.translate(-originalWidth / 2, -originalHeight / 2);
          this.annotationManager.drawTextObjects(ctx);
          ctx.restore();
      }
      
      ctx.restore();
      
      // Convert to blob
      return await new Promise(resolve => canvas.toBlob(resolve, this.currentFile.mimeType));
  }

  // ... rest of the class (save, saveAs, etc.) ...
  // I need to include the rest of the methods here to complete the file rewrite.
  
  /**
   * Save changes
   */
  async save() {
    if (!this.currentFile || this.currentFile.type !== 'image') return;

    try {
        this.showLoading(true);
        
        const blob = await this.generateImageBlob();
        if (!blob) return;
        
        // Save
        const success = await this.fileHandler.saveFile(this.currentFile, blob);
        
        if (success) {
            this.uiController.showToast('Modifications enregistrées', 'success');
            // Reset state
            this.rotation = 0;
            if (this.annotationManager) this.annotationManager.clear(); // Clear history after save
            this.history = [];
            this.historyStep = -1;
            this.updateUndoRedoButtons();
            
            // Reset adjustments
            this.adjustments = { brightness: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, vignette: 0, saturation: 0, warmth: 0, tint: 0, sharpness: 0 };
            this.applyAdjustments(); // Reset visual filter
            
            // Reload the image to show the saved version (which now has the edits baked in)
            // We need to force a reload by updating the src with a timestamp or re-reading the file
            // Since fileHandler.saveFile updates the file in place, we can just reload the image element
            const img = this.elements.media.querySelector('img');
            if (img) {
                // Add a timestamp to force reload
                // Note: fileHandler.saveFile might have revoked the old URL and created a new one if it's blob-based
                // But usually it updates the file on disk/storage.
                // If we are using Blob URLs, we might need to re-create the URL from the file object if it was updated.
                // Assuming fileHandler updates the file object in place or we need to re-fetch it.
                
                // If the file handler updated the file content, we might need to refresh the URL if it's a blob URL that hasn't changed string-wise but content-wise.
                // However, for File System Access API, the file object might need to be re-read.
                
                // Let's try to re-load the file completely to be safe
                this.loadFile(this.currentFile);
            }
            
            // Keep edit mode active if it was active
            if (this.isEditMode) {
                // Re-enable edit mode after reload
                // We need to wait for the image to load first
                const newImg = this.elements.media.querySelector('img');
                if (newImg) {
                    newImg.addEventListener('load', () => {
                        if (this.isEditMode) {
                            // Re-initialize annotation manager
                            if (this.annotationManager) {
                                this.annotationManager.start([{
                                    container: this.elements.media,
                                    target: newImg,
                                    id: 'main'
                                }], null, {
                                    propertiesContainer: this.elements.propertiesContainer,
                                    onAction: () => {
                                        this.addToHistory({
                                            type: 'annotation',
                                            undo: () => this.annotationManager.undo(),
                                            redo: () => this.annotationManager.redo()
                                        });
                                    }
                                });
                            }
                            // Restore tool
                            const activeToolBtn = this.elements.editToolbar.querySelector('.tool-btn.active');
                            if (activeToolBtn) {
                                this.setTool(activeToolBtn.dataset.tool);
                            } else {
                                this.setTool('pen');
                            }
                        }
                    }, { once: true });
                }
            }
        } else {
            // Fallback to Save As
            this.saveAs(blob);
        }
        
    } catch (error) {
        console.error('Error saving changes:', error);
        this.uiController.showToast('Erreur lors de l\'enregistrement', 'error');
    } finally {
        this.showLoading(false);
    }
  }

  /**
   * Save As
   */
  async saveAs(blob = null) {
      if (!this.currentFile || this.currentFile.type !== 'image') return;

      try {
          this.showLoading(true);

          if (!blob) {
              blob = await this.generateImageBlob();
          }
          if (!blob) return;

          const newFile = await this.fileHandler.saveFileAs(this.currentFile, blob);
          
          if (newFile) {
              this.uiController.showToast('Fichier enregistré', 'success');
              this.open(newFile, this.currentIndex); // Switch to new file? Or just reload?
          }
      } catch (error) {
          console.error('Error saving file as:', error);
          this.uiController.showToast('Erreur lors de l\'enregistrement', 'error');
      } finally {
          this.showLoading(false);
      }
  }

  /**
   * Check if viewer is open
   * @returns {boolean} True if open
   */
  isViewerOpen() {
    return this.isOpen;
  }

  /**
   * Open viewer
   * @param {Object} file - File to open
   * @param {number} index - Index in file list
   * @param {Array} files - List of files
   */
  open(file, index, files) {
      this.currentFile = file;
      this.currentIndex = index;
      this.files = files || [file];
      this.isOpen = true;
      
      this.elements.viewer.classList.remove('hidden');
      this.elements.viewer.classList.add('active');
      
      this.loadFile(file);
      
      // Prevent body scroll
      document.body.style.overflow = 'hidden';
  }

  /**
   * Handle file deletion
   * @param {string} fileId - ID of deleted file
   */
  onFileDeleted(fileId) {
      const index = this.files.findIndex(f => f.id === fileId);
      if (index === -1) return;
      
      this.files.splice(index, 1);
      
      if (!this.currentFile || this.currentFile.id !== fileId) {
          // Deleted file was not the current one, just adjust index if needed
          if (index < this.currentIndex) {
              this.currentIndex--;
          }
          return;
      }
      
      // Current file was deleted
      if (this.files.length === 0) {
          this.close();
          return;
      }
      
      // Show next available file
      const newIndex = Math.min(index, this.files.length - 1);
      this.currentIndex = newIndex;
      this.currentFile = this.files[newIndex];
      this.loadFile(this.currentFile);
  }

  /**
   * Close viewer
   */
  close() {
      this.isOpen = false;
      this.elements.viewer.classList.remove('active');
      setTimeout(() => {
          this.elements.viewer.classList.add('hidden');
          this.cleanupMedia();
      }, 300); // Wait for transition
      
      // Restore body scroll
      document.body.style.overflow = '';
      
      // Exit fullscreen if active
      if (this.isFullscreen) {
          GalleryUtils.exitFullscreen();
      }
  }

  /**
   * Load file in viewer
   * @param {Object} file - File object
   */
  async loadFile(file) {
    // Show loading
    this.showLoading(true);
    
    // Reset history
    this.history = [];
    this.historyStep = -1;
    this.updateUndoRedoButtons();
    
    // Update filename
    this.elements.filename.textContent = file.name;
    
    // Clear media container
    this.elements.media.innerHTML = '';
    
    // Cleanup previous video player if exists
    if (this.videoPlayer) {
      this.videoPlayer.destroy();
      this.videoPlayer = null;
    }
    
    try {
      if (file.type === 'image') {
        await this.loadImage(file);
        // Show edit button
        if (this.elements.editModeBtn) this.elements.editModeBtn.style.display = '';
      } else if (file.type === 'video') {
        if (!window.VideoPlayer) {
             await window.loadScript('scripts/video-player.js');
        }
        this.videoPlayer = new VideoPlayer(this.elements.media, file, this.uiController);
        // Hide default toolbar as VideoPlayer has its own custom UI
        this.elements.defaultToolbar.style.display = 'none';
        // Hide edit button
        if (this.elements.editModeBtn) this.elements.editModeBtn.style.display = 'none';
      } else if (file.type === 'audio') {
        await this.loadAudio(file);
        // Hide edit button
        if (this.elements.editModeBtn) this.elements.editModeBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading file:', error);
      this.showError('Échec du chargement du fichier');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Load image
   * @param {Object} file - Image file
   */
  async loadImage(file) {
    const img = GalleryUtils.createElement('img', {
      src: file.url,
      alt: file.name,
      className: 'viewer-image',
      draggable: 'false'
    });
    
    // Setup zoom functionality
    let isDragging = false;
    let dragStart = { x: 0, y: 0 };
    this.transform = { x: 0, y: 0, scale: 1 };
    
    img.addEventListener('load', () => {
      this.elements.media.appendChild(img);
      this.resetZoom();
      // Reset adjustments on new load
      this.adjustments = { brightness: 0, exposure: 0, contrast: 0, highlights: 0, shadows: 0, vignette: 0, saturation: 0, warmth: 0, tint: 0, sharpness: 0 };
    });
    
    // Mouse events for dragging
    // We attach to media container to capture events even if clicking on canvas
    this.elements.media.addEventListener('mousedown', (e) => {
      if (this.zoomLevel > 1 && (!this.annotationManager || !this.annotationManager.isActive)) {
        isDragging = true;
        dragStart = { x: e.clientX - this.transform.x, y: e.clientY - this.transform.y };
        img.style.cursor = 'grabbing';
        img.classList.add('zooming');  // Disable CSS transitions during drag
        e.preventDefault();
      }
    });
    
    document.addEventListener('mousemove', (e) => {
      if (isDragging && this.zoomLevel > 1) {
        this.transform.x = e.clientX - dragStart.x;
        this.transform.y = e.clientY - dragStart.y;
        this.applyZoomTransformOnly();  // Lightweight transform (no filters)
      }
    });
    
    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        img.style.cursor = this.zoomLevel > 1 ? 'grab' : 'default';
        img.classList.remove('zooming');  // Restore CSS transitions
        
        // Apply full filters after drag if adjustments are active
        if (this.hasActiveAdjustments()) {
          this.applyTransform();
        }
      }
    });
  }

  /**
   * Load audio
   * @param {Object} file - Audio file
   */
  async loadAudio(file) {
    // For large files, create blob URL on-demand from the File object
    let audioSrc = file.url;
    if (file.isLargeFile && file.file) {
      console.log('[FullscreenViewer] Using File object directly for large audio file streaming');
      audioSrc = URL.createObjectURL(file.file);
      this.tempAudioBlobUrl = audioSrc; // Store for cleanup
    } else if (!file.url && file.file) {
      // Fallback: create blob URL from file
      audioSrc = URL.createObjectURL(file.file);
      this.tempAudioBlobUrl = audioSrc;
    }
    
    const audio = GalleryUtils.createElement('audio', {
      src: audioSrc,
      controls: true,
      className: 'viewer-audio',
      style: 'width: 80%; max-width: 600px; margin: auto; display: block;'
    });
    
    // Audio events
    audio.addEventListener('play', () => {
      this.isPlaying = true;
      this.updatePlayPauseButton();
    });
    
    audio.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayPauseButton();
    });
    
    audio.addEventListener('ended', () => {
      this.isPlaying = false;
      this.updatePlayPauseButton();
    });

    this.elements.media.appendChild(audio);
    
    // Auto-play
    try {
      await audio.play();
    } catch (e) {
      console.warn('Auto-play prevented:', e);
    }
  }



  /**
   * Toggle play/pause for videos and audio
   */
  togglePlayPause() {
    if (this.videoPlayer) {
      this.videoPlayer.togglePlayPause();
      return;
    }

    const media = this.elements.media.querySelector('audio');
    if (media) {
      if (media.paused) {
        media.play();
      } else {
        media.pause();
      }
    }
  }

  /**
   * Toggle fullscreen
   */
  async toggleFullscreen() {
    if (this.isFullscreen) {
      await GalleryUtils.exitFullscreen();
    } else {
      await GalleryUtils.enterFullscreen(document.documentElement);
    }
  }

  /**
   * Handle fullscreen change
   */
  handleFullscreenChange() {
    this.isFullscreen = !!(
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.mozFullScreenElement ||
      document.msFullscreenElement
    );
    
    this.updateFullscreenButton();
  }


  /**
   * Show controls
   */
  showControls() {
    this.elements.defaultToolbar.style.opacity = '1';
    this.elements.editToolbar.style.opacity = '1';
    this.elements.viewer.style.cursor = 'default';
    
    if (this.autoHideControls && !this.isEditMode) {
      clearTimeout(this.controlsTimeout);
      this.controlsTimeout = setTimeout(() => {
        this.hideControls();
      }, 3000);
    }
  }

  /**
   * Hide controls
   */
  hideControls() {
    if (this.isEditMode) return; // Don't hide in edit mode
    this.elements.defaultToolbar.style.opacity = '0';
    this.elements.viewer.style.cursor = 'none';
  }

  /**
   * Toggle controls
   */
  toggleControls() {
    const toolbarVisible = this.elements.defaultToolbar.style.opacity === '1';
    
    if (toolbarVisible) {
      this.hideControls();
    } else {
      this.showControls();
    }
  }

  /**
   * Update position display
   */
  updatePosition() {
    // Position is now updated in updateVideoProgress for videos
    // For images, we might want to show something else or nothing
  }

  /**
   * Update play/pause button
   */
  updatePlayPauseButton() {
    const icon = this.isPlaying ? 'pause' : 'play_arrow';
    // Update dynamic video controls
    const videoPlayBtn = this.elements.media.querySelector('.play-pause-btn i');
    if (videoPlayBtn) {
      videoPlayBtn.textContent = icon;
    }
  }

  /**
   * Update fullscreen button
   */
  updateFullscreenButton() {
    const icon = this.isFullscreen ? 'fullscreen_exit' : 'fullscreen';
    
    // Update default toolbar button
    if (this.elements.fullscreenBtn) {
        const iconEl = this.elements.fullscreenBtn.querySelector('i');
        if (iconEl) iconEl.textContent = icon;
        this.elements.fullscreenBtn.title = this.isFullscreen ? 'Quitter plein écran' : 'Plein écran';
    }

    // Update dynamic video controls
    const videoFullscreenBtn = this.elements.media.querySelector('.fullscreen-btn i');
    if (videoFullscreenBtn) {
      videoFullscreenBtn.textContent = icon;
    }
  }

  /**
   * Show loading state
   * @param {boolean} show - Show loading
   */
  showLoading(show) {
    // Loading spinner disabled to reduce latency
  }

  /**
   * Show error
   * @param {string} message - Error message
   */
  showError(message) {
    this.elements.media.innerHTML = `
      <div class="viewer-error">
        <i class="material-icons">error</i>
        <h3>Erreur</h3>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Set zoom level with optional focus point
   * @param {number} level - Zoom level
   * @param {number} [focusX] - X coordinate of focus point (client coordinates)
   * @param {number} [focusY] - Y coordinate of focus point (client coordinates)
   */
  setZoom(level, focusX, focusY) {
    const oldZoom = this.zoomLevel;
    const newZoom = Math.max(0.1, Math.min(5, level));
    
    // Seuil minimum - éviter les micro-changements
    if (Math.abs(newZoom - oldZoom) < 0.001) return;
    
    this.zoomLevel = newZoom;
    this.transform.scale = this.zoomLevel;
    
    // Reset translation if zoomed out to 1
    if (this.zoomLevel <= 1) {
        this.transform.x = 0;
        this.transform.y = 0;
    } else if (focusX !== undefined && focusY !== undefined) {
        // Calculate zoom towards focus point (cursor/finger position)
        const img = this.elements.media.querySelector('img');
        if (img) {
            const rect = this.elements.media.getBoundingClientRect();
            
            // Get the center of the media container
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            
            // Calculate the offset from center to focus point
            const offsetX = focusX - centerX;
            const offsetY = focusY - centerY;
            
            // Calculate the scale ratio
            const scaleRatio = this.zoomLevel / oldZoom;
            
            // Adjust transform to keep the focus point stationary
            // The formula: newTransform = oldTransform - offset * (scaleRatio - 1)
            this.transform.x = this.transform.x - offsetX * (scaleRatio - 1);
            this.transform.y = this.transform.y - offsetY * (scaleRatio - 1);
        }
    }
    
    // RAPIDE: Uniquement transform CSS (pas de filtres)
    this.applyZoomTransformOnly();
    
    // Update zoom level display
    const zoomLevelDisplay = this.elements.viewer.querySelector('.zoom-level');
    if (zoomLevelDisplay) {
      zoomLevelDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }
    
    // DEBOUNCE: Appliquer les filtres complets APRÈS le zoom (150ms)
    if (this.filterUpdateTimeout) {
        clearTimeout(this.filterUpdateTimeout);
    }
    this.filterUpdateTimeout = setTimeout(() => {
        this.filterUpdateTimeout = null;
        // Appliquer les filtres seulement si des ajustements sont actifs
        if (this.hasActiveAdjustments()) {
            this.applyTransform();
        }
    }, 150);
  }

  /**
   * Check if any image adjustments are active
   */
  hasActiveAdjustments() {
    if (!this.adjustments) return false;
    return this.adjustments.brightness !== 0 ||
           this.adjustments.contrast !== 0 ||
           this.adjustments.exposure !== 0 ||
           this.adjustments.saturation !== 0 ||
           this.adjustments.shadows !== 0 ||
           this.adjustments.highlights !== 0 ||
           this.adjustments.temperature !== 0 ||
           this.adjustments.tint !== 0 ||
           this.adjustments.vignette !== 0;
  }

  /**
   * Apply only zoom/pan/rotation transform - LIGHTWEIGHT for smooth zooming
   * Does NOT update filters/adjustments
   */
  applyZoomTransformOnly() {
    const img = this.elements.media.querySelector('img');
    const annotationCanvas = this.elements.media.querySelector('.annotation-canvas');
    const transform = `translate(${this.transform.x}px, ${this.transform.y}px) rotate(${this.rotation}deg) scale(${this.transform.scale})`;
    
    if (img) {
        img.style.transform = transform;
        img.style.cursor = this.transform.scale > 1 && (!this.annotationManager || !this.annotationManager.isActive) ? 'grab' : 'default';
    }
    
    if (annotationCanvas) {
        annotationCanvas.style.transform = transform;
    }
  }

  applyTransform() {
      const img = this.elements.media.querySelector('img');
      const annotationCanvas = this.elements.media.querySelector('.annotation-canvas');
      const transform = `translate(${this.transform.x}px, ${this.transform.y}px) rotate(${this.rotation}deg) scale(${this.transform.scale})`;
      
      if (img) {
          img.style.transform = transform;
          img.style.cursor = this.transform.scale > 1 && (!this.annotationManager || !this.annotationManager.isActive) ? 'grab' : 'default';
          this.applyImageFilters(img);
      }
      
      if (annotationCanvas) {
          annotationCanvas.style.transform = transform;
      }
  }

  applyImageFilters(img) {
      // Apply filters to the image element for live preview
      const brightness = 100 + this.adjustments.brightness + this.adjustments.exposure;
      const contrast = 100 + this.adjustments.contrast;
      const saturation = 100 + this.adjustments.saturation;
      const sepia = this.adjustments.warmth;
      const hueRotate = this.adjustments.tint * 1.8;
      
      this.updateSVGFilter();

      img.style.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) sepia(${sepia}%) hue-rotate(${hueRotate}deg) url(#${this.filterId})`;

      this.applyVignette(img);
  }

  updateSVGFilter() {
      const shadows = this.adjustments.shadows / 100;
      const highlights = this.adjustments.highlights / 100;
      
      const tableValues = this.calculateTableValues(shadows, highlights);
      const tableStr = tableValues.join(' ');
      
      const filter = document.getElementById(this.filterId);
      if (!filter) return;
      
      ['R', 'G', 'B'].forEach(c => {
          const func = filter.querySelector(`feFunc${c}`);
          if (func) func.setAttribute('tableValues', tableStr);
      });
      
      this.updateSharpness(filter);
  }

  calculateTableValues(shadows, highlights) {
      const tableValues = [];
      for (let i = 0; i <= 20; i++) {
          let x = i / 20;
          let y = x;
          
          if (shadows !== 0) {
              const influence = Math.exp(-x * 4);
              y += (1 - x) * influence * shadows * 0.6;
          }
          
          if (highlights !== 0) {
              const influence = Math.exp(-(1 - x) * 4);
              y -= x * influence * highlights * 0.6;
          }
          
          y = Math.max(0, Math.min(1, y));
          tableValues.push(y);
      }
      return tableValues;
  }

  updateSharpness(filter) {
      const sharpness = this.adjustments.sharpness;
      const composite = filter.querySelector('feComposite');
      if (!composite) return;
      
      const strength = sharpness / 30;
      composite.setAttribute('k2', 1 + strength);
      composite.setAttribute('k3', -strength);
  }

  applyVignette(img) {
      if (this.adjustments.vignette > 0) {
          const v = this.adjustments.vignette;
          const stop = Math.max(0, 100 - v);
          const mask = `radial-gradient(circle, black ${stop}%, transparent 150%)`;
          img.style.webkitMaskImage = mask;
          img.style.maskImage = mask;
      } else {
          img.style.webkitMaskImage = 'none';
          img.style.maskImage = 'none';
      }
  }

  /**
   * Reset zoom
   */
  resetZoom() {
    this.rotation = 0;
    this.setZoom(1);
  }


  addToHistory(action) {
      // Remove any redo steps
      if (this.historyStep < this.history.length - 1) {
          this.history = this.history.slice(0, this.historyStep + 1);
      }
      
      this.history.push(action);
      this.historyStep++;
      this.updateUndoRedoButtons();
  }

  addAdjustmentToHistory(adjId, oldVal, newVal) {
      this.addToHistory({
          type: 'adjustment',
          undo: () => {
              this.adjustments[adjId] = oldVal;
              this.applyAdjustments();
              this.renderAdjustmentUI();
          },
          redo: () => {
              this.adjustments[adjId] = newVal;
              this.applyAdjustments();
              this.renderAdjustmentUI();
          }
      });
  }

  undo() {
      if (this.historyStep >= 0) {
          const action = this.history[this.historyStep];
          if (action.undo) action.undo();
          this.historyStep--;
          this.updateUndoRedoButtons();
      }
  }

  redo() {
      if (this.historyStep < this.history.length - 1) {
          this.historyStep++;
          const action = this.history[this.historyStep];
          if (action.redo) action.redo();
          this.updateUndoRedoButtons();
      }
  }

  updateUndoRedoButtons() {
      if (this.elements.undoEditBtn) {
          this.elements.undoEditBtn.disabled = this.historyStep < 0;
          this.elements.undoEditBtn.style.opacity = this.historyStep < 0 ? '0.5' : '1';
      }
      if (this.elements.redoEditBtn) {
          this.elements.redoEditBtn.disabled = this.historyStep >= this.history.length - 1;
          this.elements.redoEditBtn.style.opacity = this.historyStep >= this.history.length - 1 ? '0.5' : '1';
      }
  }

  /**
   * Clean up media
   */
  cleanupMedia() {
    // Cleanup video player
    if (this.videoPlayer) {
      this.videoPlayer.destroy();
      this.videoPlayer = null;
      // Restore default toolbar
      this.elements.defaultToolbar.style.display = '';
    }

    // Pause any playing media (audio)
    const media = this.elements.media.querySelector('audio');
    if (media) {
      media.pause();
    }
    
    // Clean up temp audio blob URL if exists
    if (this.tempAudioBlobUrl) {
      URL.revokeObjectURL(this.tempAudioBlobUrl);
      this.tempAudioBlobUrl = null;
    }
    
    // Clear media container
    this.elements.media.innerHTML = '';
    
    // Reset state
    this.currentFile = null;
    this.currentTime = 0;
    this.duration = 0;
    this.isPlaying = false;
    this.zoomLevel = 1;
  }
}

// Export for use in other modules
window.FullscreenViewer = FullscreenViewer;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FullscreenViewer;
}