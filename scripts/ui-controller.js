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

// JemaOS Gallery - UI Controller

const FILE_ICONS = {
  image: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>',
  video: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z"/></svg>',
  audio: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 3v9.28c-.47-.17-.97-.28-1.5-.28C8.01 12 6 14.01 6 16.5S8.01 21 10.5 21c2.31 0 4.2-1.75 4.45-4H15V6h4V3h-7z"/></svg>',
  pdf: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h2v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>',
  default: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 2c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6H6zm7 7V3.5L18.5 9H13z"/></svg>'
};

/**
 * Handles all UI interactions and rendering
 */

class UIController {
  constructor(fileHandler) {
    this.fileHandler = fileHandler;
    this.showFileInfo = true;
    this.toastContainer = null;
    this.contextMenu = null;
    this.isLoading = false;
    
    this.elements = {};
  }

  /**
   * Initialize UI controller
   */
  async init() {
    this.cacheElements();
    this.setupEventListeners();
    this.setupKeyboardShortcuts();
    
    // Initialize Audio Player
    if (globalThis.audioPlayer) {
      globalThis.audioPlayer.init();
    }

    this.updateUI();
    this.showLoadingScreen(false);

  }

  /**
   * Cache DOM elements
   */
  cacheElements() {
    this.elements = {
      // Main app
      app: document.getElementById('app'),
      loadingScreen: document.getElementById('loading-screen'),
      
      // Main content
      fileGrid: document.getElementById('file-grid'),
      dropZone: document.getElementById('drop-zone'),
      
      // File input
      fileInput: document.getElementById('file-input'),
      
      // Toast container
      toastContainer: document.getElementById('toast-container'),

      // Modal
      modal: document.getElementById('info-modal'),
      modalCloseBtn: document.getElementById('modal-close-btn'),
      modalCloseAction: document.getElementById('modal-close-action'),
      modalFilename: document.getElementById('modal-filename'),
      modalFiletype: document.getElementById('modal-filetype'),
      modalFilesize: document.getElementById('modal-filesize'),
      modalFiledate: document.getElementById('modal-filedate'),
      modalDimensionsRow: document.getElementById('modal-dimensions-row'),
      modalDimensions: document.getElementById('modal-dimensions')
    };
    
    this.toastContainer = this.elements.toastContainer;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Modal
    if (this.elements.modalCloseBtn) {
      this.elements.modalCloseBtn.addEventListener('click', () => this.closeModal());
    }
    if (this.elements.modalCloseAction) {
      this.elements.modalCloseAction.addEventListener('click', () => this.closeModal());
    }
    if (this.elements.modal) {
      this.elements.modal.addEventListener('click', (e) => {
        if (e.target === this.elements.modal) {
          this.closeModal();
        }
      });
    }

    // File input
    this.elements.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
    
    // Drag and drop
    this.setupDragDrop();
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      
      switch (e.key) {
        case 'Escape':
          this.handleEscape();
          break;
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            this.fileHandler.selectAllVisible();
            this.updateSelectionDisplay();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (this.fileHandler.selectedFiles.size > 0) {
            e.preventDefault();
            this.deleteSelected();
          }
          break;
      }
    });
  }

  /**
   * Trigger file input with specific type
   * @param {string} type - File type (image, video, audio, pdf)
   */
  triggerFileInput(type) {
    const input = this.elements.fileInput;
    
    // Set accept attribute based on type
    switch (type) {
      case 'image':
        input.accept = 'image/*';
        break;
      case 'video':
        input.accept = 'video/*';
        break;
      case 'audio':
        input.accept = 'audio/*';
        break;
      case 'pdf':
        input.accept = '.pdf,application/pdf';
        break;
      default:
        input.accept = 'image/*,video/*,audio/*';
    }
    
    input.click();
    
    // Reset accept after selection (handled in handleFileSelect or timeout)
    setTimeout(() => {
      input.accept = 'image/*,video/*,audio/*';
    }, 1000);
  }

  /**
   * Handle file select
   * @param {Event} e - Change event
   */
  async handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      this.showLoading(true);
      const loadedFiles = await this.fileHandler.loadFiles(files);
      this.showLoading(false);
      this.renderFiles();

      // Auto-open first file
      if (loadedFiles.length > 0) {
        this.openInFullscreen(loadedFiles[0]);
      }

      e.target.value = ''; // Reset input
      
      // Reset accept attribute
      this.elements.fileInput.accept = 'image/*,video/*,audio/*';
    }
  }

  /**
   * Setup drag and drop
   */
  setupDragDrop() {
    const dropZone = this.elements.dropZone;
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, this.preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
      document.addEventListener(eventName, () => {
        // Check if any viewer is open
        const isViewerOpen = (globalThis.fullscreenViewer?.isViewerOpen()) ||
                             (globalThis.pdfViewer?.isOpen) ||
                             (globalThis.audioPlayer?.elements?.container && !globalThis.audioPlayer.elements.container.classList.contains('hidden'));

        if (!isViewerOpen) {
          dropZone.classList.remove('hidden');
        }
      }, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
      document.addEventListener(eventName, () => {
        dropZone.classList.add('hidden');
      }, false);
    });
    
    document.addEventListener('drop', async (e) => {
      // Check if any viewer is open
      const isViewerOpen = (globalThis.fullscreenViewer?.isViewerOpen()) ||
                           (globalThis.pdfViewer?.isOpen) ||
                           (globalThis.audioPlayer?.elements?.container && !globalThis.audioPlayer.elements.container.classList.contains('hidden'));

      if (isViewerOpen) {
        console.log('Drop blocked because viewer is open');
        return;
      }

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        this.showLoading(true);
        const loadedFiles = await this.fileHandler.loadFiles(files);
        this.showLoading(false);
        this.renderFiles();

        // Auto-open first file
        if (loadedFiles.length > 0) {
          this.openInFullscreen(loadedFiles[0]);
        }

      }
    }, false);
  }

  /**
   * Prevent default drag behaviors
   * @param {Event} e - Event
   */
  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Render files in the grid
   */
  renderFiles() {
    this.elements.fileGrid.style.display = 'none';
    
    // If we have files but no viewer is open, open the first file immediately
    // This prevents showing a blank screen or the hidden home page
    if (this.fileHandler.files.length > 0 &&
        !globalThis.fullscreenViewer?.isViewerOpen() &&
        !globalThis.pdfViewer?.isOpen &&
        (!globalThis.audioPlayer?.elements?.container || globalThis.audioPlayer.elements.container.classList.contains('hidden'))) {
        
        // Use requestAnimationFrame to ensure this runs after the current call stack
        // but before the next repaint, making it feel instant
        requestAnimationFrame(() => {
            this.openInFullscreen(this.fileHandler.files[0]);
        });
    }
  }

  /**
   * Create file element
   * @param {Object} file - File object
   * @param {number} index - File index
   * @returns {HTMLElement} File element
   */
  createFileElement(file, index) {
    const fileItem = GalleryUtils.createElement('div', {
      className: 'file-item',
      dataset: { id: file.id, type: file.type }
    });
    
    // Selection checkbox
    const checkbox = GalleryUtils.createElement('input', {
      type: 'checkbox',
      className: 'file-checkbox-input',
      checked: this.fileHandler.selectedFiles.has(file.id) ? '' : null
    });
    
    checkbox.addEventListener('click', (e) => {
      e.stopPropagation();
      this.fileHandler.toggleFileSelection(file.id);
      this.updateSelectionDisplay();
    });
    
    fileItem.appendChild(checkbox);
    
    // File Icon
    const iconSvg = FILE_ICONS[file.type] || FILE_ICONS.default;
    const fileIcon = GalleryUtils.createElement('div', {
      className: `file-icon file-icon-${file.type || 'default'}`
    });
    fileIcon.innerHTML = iconSvg;
    fileItem.appendChild(fileIcon);

    // File Name
    const fileName = GalleryUtils.createElement('div', {
      className: 'file-name'
    }, file.name);
    
    fileItem.appendChild(fileName);
    
    // Click handler for opening in fullscreen
    fileItem.addEventListener('click', (e) => {
      // Don't trigger if clicking checkbox
      if (e.target === checkbox) return;

      this.openInFullscreen(file);
    });
    
    // Right-click context menu
    fileItem.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e, file);
    });
    
    // Selection state
    if (this.fileHandler.selectedFiles.has(file.id)) {
      fileItem.classList.add('selected');
    }
    
    return fileItem;
  }

  /**
   * Update selection display
   */
  updateSelectionDisplay() {
    // Update file item selection states
    document.querySelectorAll('.file-item').forEach(item => {
      const fileId = item.dataset.id;
      item.classList.toggle('selected', this.fileHandler.selectedFiles.has(fileId));
      
      const checkbox = item.querySelector('.file-checkbox input');
      if (checkbox) {
        checkbox.checked = this.fileHandler.selectedFiles.has(fileId);
      }
    });
  }

  /**
   * Show context menu
   * @param {Event} e - Click event
   * @param {Object} file - File object
   */
  showContextMenu(e, file) {
    this.closeContextMenu();
    
    this.contextMenu = GalleryUtils.createElement('div', {
      className: 'context-menu',
      style: `
        position: fixed;
        top: ${e.pageY}px;
        left: ${e.pageX}px;
        background: var(--surface-color);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-md);
        box-shadow: var(--shadow-lg);
        padding: var(--space-xs);
        z-index: var(--z-popover);
        min-width: 160px;
      `
    });
    
    const menuItems = [
      { icon: 'visibility', text: 'Ouvrir', action: () => this.openInFullscreen(file) },
      { icon: 'content_copy', text: 'Copier', action: () => this.copyFiles([file]) },
      { icon: 'download', text: 'Télécharger', action: () => this.downloadFiles([file]) },
      { icon: 'edit', text: 'Renommer', action: () => this.renameFiles([file]) },
      { icon: 'delete', text: 'Supprimer', action: () => this.deleteFiles([file.id]) }
    ];
    
    menuItems.forEach(item => {
      const menuItem = GalleryUtils.createElement('div', {
        className: 'context-menu-item',
        style: `
          display: flex;
          align-items: center;
          gap: var(--space-sm);
          padding: var(--space-sm) var(--space-md);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: background-color var(--transition-fast);
        `
      }, [
        GalleryUtils.createElement('i', {
          className: 'material-icons',
          style: 'font-size: 18px; color: var(--on-surface-variant);'
        }, item.icon),
        GalleryUtils.createElement('span', {
          style: 'color: var(--on-surface); font-size: var(--font-size-sm);'
        }, item.text)
      ]);
      
      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = 'var(--surface-variant)';
      });
      
      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
      });
      
      menuItem.addEventListener('click', () => {
        item.action();
        this.closeContextMenu();
      });
      
      this.contextMenu.appendChild(menuItem);
    });
    
    document.body.appendChild(this.contextMenu);
    
    // Close menu on outside click
    setTimeout(() => {
      document.addEventListener('click', this.closeContextMenu.bind(this), { once: true });
    }, 0);
  }

  /**
   * Close context menu
   */
  closeContextMenu() {
    if (this.contextMenu) {
      this.contextMenu.remove();
      this.contextMenu = null;
    }
  }

  /**
   * Show/hide loading state
   * @param {boolean} show - Show loading state
   */
  showLoading(show) {
    this.isLoading = show;
    this.elements.fileGrid.style.opacity = show ? '0.5' : '1';
  }

  /**
   * Show loading screen
   * @param {boolean} show - Show loading screen
   */
  showLoadingScreen(show) {
    this.elements.loadingScreen.classList.toggle('hidden', !show);
    this.elements.app.classList.toggle('hidden', show);
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, error, warning, info)
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    const toast = GalleryUtils.createElement('div', {
      className: `toast ${type}`
    }, [
      GalleryUtils.createElement('i', {
        className: 'material-icons'
      }, this.getToastIcon(type)),
      GalleryUtils.createElement('span', {}, message)
    ]);
    
    this.toastContainer.appendChild(toast);
    
    // Auto remove after duration
    setTimeout(() => {
      toast.remove();
    }, duration);
    
    // Manual close on click
    toast.addEventListener('click', () => {
      toast.remove();
    });
  }

  /**
   * Get toast icon
   * @param {string} type - Toast type
   * @returns {string} Icon name
   */
  getToastIcon(type) {
    const icons = {
      success: 'check_circle',
      error: 'error',
      warning: 'warning',
      info: 'info'
    };
    return icons[type] || icons.info;
  }

  /**
   * Handle escape key
   */
  handleEscape() {
    this.closeContextMenu();
    this.fileHandler.deselectAll();
    this.updateSelectionDisplay();
    

  }

  /**
   * Prompt user for folder access to enable navigation
   * @param {Object} currentFile - The currently open file
   * @param {string} direction - 'next' or 'previous'
   */
  async promptForFolderAccess(currentFile, direction) {
    try {
      const dirHandle = await globalThis.showDirectoryPicker({
        id: 'gallery-folder-access',
        mode: 'read'
      });
      
      if (!dirHandle) return;
      
      this.showLoading(true);
      
      // Load files from directory
      const newFiles = await this.fileHandler.loadFromDirectory(dirHandle);
      
      this.showLoading(false);
      
      if (newFiles.length === 0) {
        this.showToast('Aucun fichier compatible trouvé dans ce dossier', 'warning');
        return;
      }
      
      // Find current file in new list
      let newIndex = newFiles.findIndex(f => f.name === currentFile.name);
      
      // If not found (maybe name mismatch or different file), default to 0
      if (newIndex === -1) {
        console.warn('Current file not found in selected folder, defaulting to start');
        newIndex = 0;
      }
      
      // Update viewer
      if (window.fullscreenViewer) {
        window.fullscreenViewer.files = newFiles;
        window.fullscreenViewer.currentIndex = newIndex;
        window.fullscreenViewer.currentFile = newFiles[newIndex];
        window.fullscreenViewer.updateNavigation();
        
        // Proceed with navigation
        if (direction === 'next') {
          window.fullscreenViewer.showNext();
        } else if (direction === 'previous') {
          window.fullscreenViewer.showPrevious();
        }
      }
      
      this.renderFiles();
      
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Error requesting folder access:', error);
        this.showToast('Erreur d\'accès au dossier', 'error');
      }
      this.showLoading(false);
    }
  }

  /**
   * Open settings (placeholder)
   */
  openSettings() {
    this.showToast('Panneau de paramètres bientôt disponible !', 'info');
  }

  /**
   * Close all open viewers without removing files
   * @param {boolean} removeFiles - Whether to remove files when closing (default: false)
   */
  closeAllViewers(removeFiles = false) {
    const skipFileRemoval = !removeFiles;
    
    // Temporarily disable file removal in fullscreen viewer close
    if (window.fullscreenViewer) {
      window.fullscreenViewer._skipFileRemoval = skipFileRemoval;
      if (window.fullscreenViewer.isViewerOpen()) {
        window.fullscreenViewer.close();
      }
      window.fullscreenViewer._skipFileRemoval = false;
    }
    if (window.pdfViewer?.isOpen) {
      window.pdfViewer.close();
    }
    // Only close audio player if it's actually visible/open
    if (window.audioPlayer?.elements?.container &&
        !window.audioPlayer.elements.container.classList.contains('hidden')) {
      // Pass skipFileRemoval to audio player
      window.audioPlayer.close(skipFileRemoval);
    }
  }

  /**
   * Load and initialize audio player
   * @private
   */
  async _loadAudioPlayer() {
    this.showLoading(true);
    try {
      await window.loadScript('scripts/audio-player.js');
      if (window.audioPlayer) {
        window.audioPlayer.init();
      }
    } catch (error) {
      console.error('Failed to load audio player:', error);
      this.showToast('Erreur lors du chargement du lecteur audio', 'error');
      this.showLoading(false);
      return false;
    }
    this.showLoading(false);
    return true;
  }

  /**
   * Load and initialize PDF viewer
   * @private
   */
  async _loadPdfViewer() {
    this.showLoading(true);
    try {
      await window.loadScript('scripts/pdf-viewer.js');
      if (!window.pdfViewer) {
        window.pdfViewer = new PdfViewer(this.fileHandler, this);
        window.pdfViewer.init();
      }
    } catch (error) {
      console.error('Failed to load PDF viewer:', error);
      this.showToast('Erreur lors du chargement du lecteur PDF', 'error');
      this.showLoading(false);
      return false;
    }
    this.showLoading(false);
    return true;
  }

  /**
   * Get files list for viewer
   * @private
   * @returns {Array} Files array
   */
  _getFilesForViewer() {
    const hasActiveFilter = this.fileHandler.currentFilter !== 'all' || this.fileHandler.searchQuery !== '';
    return hasActiveFilter ? this.fileHandler.getFilteredFiles() : this.fileHandler.files;
  }

  /**
   * Open audio file in audio player
   * @private
   * @param {Object} file - File object
   */
  async _openAudioFile(file) {
    if (!window.audioPlayer) {
      const loaded = await this._loadAudioPlayer();
      if (!loaded) return;
    }

    if (window.audioPlayer) {
      const files = this.fileHandler.getFilteredFiles();
      const index = files.findIndex(f => f.id === file.id);
      window.audioPlayer.open(files, index);
    }
  }

  /**
   * Open PDF file in PDF viewer
   * @private
   * @param {Object} file - File object
   */
  async _openPdfFile(file) {
    if (!window.pdfViewer) {
      const loaded = await this._loadPdfViewer();
      if (!loaded) return;
    }

    if (window.pdfViewer) {
      window.pdfViewer.open(file);
    }
  }

  /**
   * Open file in fullscreen viewer
   * @private
   * @param {Object} file - File object
   */
  _openInFullscreenViewer(file) {
    if (!window.fullscreenViewer) return;

    const files = this._getFilesForViewer();
    const index = files.findIndex(f => f.id === file.id);
    window.fullscreenViewer.open(file, index, files);
  }

  /**
   * Open file in fullscreen, audio player, or PDF viewer
   * @param {Object} file - File object
   */
  async openInFullscreen(file) {
    // Close any existing viewers first to ensure only one is active
    // Pass false to NOT remove files when switching between viewers
    this.closeAllViewers(false);

    switch (file.type) {
      case 'audio':
        await this._openAudioFile(file);
        break;
      case 'pdf':
        await this._openPdfFile(file);
        break;
      case 'video':
      case 'image':
        this._openInFullscreenViewer(file);
        break;
      default:
        this._openInFullscreenViewer(file);
        break;
    }
  }

  /**
   * Delete selected files
   */
  deleteSelected() {
    const selectedFiles = this.fileHandler.getSelectedFiles();
    if (selectedFiles.length === 0) return;
    
    if (confirm(`Supprimer ${selectedFiles.length} fichier${selectedFiles.length !== 1 ? 's' : ''} ?`)) {
      const fileIds = selectedFiles.map(f => f.id);
      this.fileHandler.removeFiles(fileIds);
      this.renderFiles();
      this.showToast(`${selectedFiles.length} fichier${selectedFiles.length !== 1 ? 's' : ''} supprimé${selectedFiles.length !== 1 ? 's' : ''}`, 'success');
    }
  }

  /**
   * Delete files
   * @param {Array<string>} fileIds - Array of file IDs
   */
  deleteFiles(fileIds) {
    if (confirm(`Supprimer ${fileIds.length} fichier${fileIds.length !== 1 ? 's' : ''} ?`)) {
      this.fileHandler.removeFiles(fileIds);
      this.renderFiles();
      this.showToast(`${fileIds.length} fichier${fileIds.length !== 1 ? 's' : ''} supprimé${fileIds.length !== 1 ? 's' : ''}`, 'success');

      // Notify viewers
      if (globalThis.fullscreenViewer?.isViewerOpen()) {
          fileIds.forEach(id => globalThis.fullscreenViewer.onFileDeleted(id));
      }
      
      // Notify PDF viewer
      if (globalThis.pdfViewer?.isOpen && globalThis.pdfViewer?.currentFile) {
          if (fileIds.includes(window.pdfViewer.currentFile.id)) {
              window.pdfViewer.close();
          }
      }
    }
  }

  /**
   * Share selected files
   */
  async shareSelected() {
    const selectedFiles = this.fileHandler.getSelectedFiles();
    if (selectedFiles.length === 0) return;
    
    const success = await this.shareFiles(selectedFiles);
    if (success) {
      this.showToast(`Partagé ${selectedFiles.length} fichier${selectedFiles.length !== 1 ? 's' : ''}`, 'success');
    } else {
      this.showToast('Échec du partage des fichiers', 'error');
    }
  }

  /**
   * Share files
   * @param {Array<Object>} files - Files to share
   */
  async shareFiles(files) {
    try {
      if (files.length === 1) {
        return await GalleryUtils.shareFiles(files[0].file, files[0].name, 'Partagé depuis Galerie');
      } else {
        // For multiple files, create a zip or use native share with multiple files
        const fileList = files.map(f => f.file);
        return await GalleryUtils.shareFiles(fileList, 'Fichiers de la galerie', 'Partagé depuis Galerie');
      }
    } catch (error) {
      console.error('Error sharing files:', error);
      return false;
    }
  }

  /**
   * Copy selected files
   */
  async copySelected() {
    const selectedFiles = this.fileHandler.getSelectedFiles();
    if (selectedFiles.length === 0) return;
    
    const success = await this.copyFiles(selectedFiles);
    if (success) {
      this.showToast(`${selectedFiles.length} fichier${selectedFiles.length !== 1 ? 's' : ''} copié${selectedFiles.length !== 1 ? 's' : ''} dans le presse-papiers`, 'success');
    }
  }

  /**
   * Copy files
   * @param {Array<Object>} files - Files to copy
   */
  async copyFiles(files) {
    try {
      if (navigator.clipboard?.write) {
        const clipboardItems = files.map(file => 
          new ClipboardItem({ [file.file.type]: file.file })
        );
        await navigator.clipboard.write(clipboardItems);
        return true;
      } else {
        // Fallback: copy file names
        const fileNames = files.map(f => f.name).join('\n');
        return await GalleryUtils.copyToClipboard(fileNames);
      }
    } catch (error) {
      console.error('Error copying files:', error);
      return false;
    }
  }

  /**
   * Rename selected files (placeholder)
   */
  renameSelected() {
    this.showToast('Fonctionnalité de renommage bientôt disponible !', 'info');
  }

  /**
   * Rename files (placeholder)
   * @param {Array<Object>} files - Files to rename
   */
  renameFiles(files) {
    this.showToast('Fonctionnalité de renommage bientôt disponible !', 'info');
  }

  /**
   * Download files
   * @param {Array<Object>} files - Files to download
   */
  downloadFiles(files) {
    files.forEach(file => {
      GalleryUtils.downloadFile(file.url, file.name);
    });
    this.showToast(`${files.length} fichier${files.length !== 1 ? 's' : ''} téléchargé${files.length !== 1 ? 's' : ''}`, 'success');
  }

  /**
   * Fetch metadata for image or video files
   * @private
   * @param {Object} file - File object
   * @returns {Promise<Object|null>} Metadata object with width and height
   */
  async _fetchMediaMetadata(file) {
    try {
      if (file.type === 'image') {
        return await this.fileHandler.getImageMetadata(file.file);
      }
      if (file.type === 'video') {
        return await this.fileHandler.getVideoMetadata(file.file);
      }
      return null;
    } catch (e) {
      console.warn('Failed to fetch metadata', e);
      return null;
    }
  }

  /**
   * Get dimensions for media file
   * @private
   * @param {Object} file - File object
   * @returns {Promise<{width: number, height: number}|null>} Dimensions or null
   */
  async _getMediaDimensions(file) {
    const cachedWidth = file.metadata?.width;
    const cachedHeight = file.metadata?.height;

    if (cachedWidth && cachedHeight) {
      return { width: cachedWidth, height: cachedHeight };
    }

    const metadata = await this._fetchMediaMetadata(file);
    if (metadata) {
      // Cache it
      file.metadata = { ...file.metadata, ...metadata };
      return { width: metadata.width, height: metadata.height };
    }

    return null;
  }

  /**
   * Update modal with media dimensions
   * @private
   * @param {Object} file - File object
   */
  async _updateModalDimensions(file) {
    if (!this.elements.modalDimensionsRow) return;

    this.elements.modalDimensionsRow.style.display = 'none';

    if (file.type !== 'image' && file.type !== 'video') return;

    const dimensions = await this._getMediaDimensions(file);
    if (dimensions) {
      this.elements.modalDimensions.textContent = `${dimensions.width} x ${dimensions.height} px`;
      this.elements.modalDimensionsRow.style.display = 'flex';
    }
  }

  /**
   * Update modal with basic file info
   * @private
   * @param {Object} file - File object
   */
  _updateModalBasicInfo(file) {
    this.elements.modalFilename.textContent = file.name;
    this.elements.modalFiletype.textContent = file.type.toUpperCase();
    this.elements.modalFilesize.textContent = GalleryUtils.formatFileSize(file.size || 0);
    this.elements.modalFiledate.textContent = GalleryUtils.formatDate(file.lastModified || Date.now());
  }

  /**
   * Show file info modal
   * @param {Object} file - File object
   */
  async showFileModal(file) {
    if (!file) return;

    if (!this.elements.modal || !this.elements.modalFilename) return;

    this._updateModalBasicInfo(file);
    await this._updateModalDimensions(file);
    this.elements.modal.classList.remove('hidden');
  }

  /**
   * Close file info modal
   */
  closeModal() {
    if (this.elements.modal) {
      this.elements.modal.classList.add('hidden');
    }
  }

  /**
   * Update UI state
   */
  updateUI() {
    this.renderFiles();
    this.updateSelectionDisplay();
  }
}

// Export for use in other modules
globalThis.UIController = UIController;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIController;
}