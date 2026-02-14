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

// JemaOS Gallery - Main Application

/**
 * Main application entry point
 */

class JemaOSGallery {
  constructor() {
    this.fileHandler = null;
    this.uiController = null;
    this.fullscreenViewer = null;
    this.pdfViewer = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the application
   */
  async init() {
    try {
      console.log('🚀 Initializing JemaOS Gallery...');
      
      // Show loading screen
      this.showLoadingScreen(true);
      
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        await new Promise(resolve => {
          document.addEventListener('DOMContentLoaded', resolve);
        });
      }
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup PWA features
      await this.setupPWA();
      
      // Handle shared files
      await this.handleSharedFiles();
      
      // Setup global error handling
      this.setupErrorHandling();
      
      // Mark as initialized
      this.isInitialized = true;
      
      // Hide loading screen
      this.showLoadingScreen(false);
      
      console.log('✅ JemaOS Gallery initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize JemaOS Gallery:', error);
      this.showError('Échec de l\'initialisation de la galerie. Veuillez rafraîchir la page.');
    }
  }

  /**
   * Initialize all components
   */
  async initializeComponents() {
    // Initialize file handler
    this.fileHandler = new FileHandler();
    await this.fileHandler.init();
    
    // Initialize fullscreen viewer
    this.fullscreenViewer = new FullscreenViewer(this.fileHandler, null);
    this.fullscreenViewer.init();
    
    // Initialize UI controller
    this.uiController = new UIController(this.fileHandler);
    await this.uiController.init();
    
    // Connect components
    this.fullscreenViewer.uiController = this.uiController;
    
    // Make components globally available
    window.galleryApp = this;
    window.galleryFileHandler = this.fileHandler;
    window.galleryUI = this.uiController;
    window.fullscreenViewer = this.fullscreenViewer;
  }

  /**
   * Setup PWA features
   */
  async setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('📱 Service Worker registered:', registration.scope);
        
        // Handle service worker updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New update available
              this.showUpdateNotification(registration);
            }
          });
        });

        // Check for waiting worker immediately
        if (registration.waiting) {
          this.showUpdateNotification(registration);
        }
        
      } catch (error) {
        console.warn('⚠️ Service Worker registration failed:', error);
      }
    }
    
    // Setup install prompt
    this.setupInstallPrompt();
    
    // Setup file handlers
    this.setupFileHandlers();
    
    // Setup share target
    this.setupShareTarget();
  }

  /**
   * Setup install prompt
   */
  setupInstallPrompt() {
    let deferredPrompt = null;
    
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install button or notification
      this.showInstallPrompt(deferredPrompt);
    });
    
    window.addEventListener('appinstalled', () => {
      console.log('📱 PWA was installed');
      this.showToast('Galerie installée avec succès !', 'success');
    });
  }

  /**
   * Show install prompt
   * @param {Event} deferredPrompt - Install prompt event
   */
  showInstallPrompt(deferredPrompt) {
    // Install prompt UI removed as per request
    console.log('Install prompt available but UI is disabled');
  }

  /**
   * Setup file handlers
   */
  setupFileHandlers() {
    if ('launchQueue' in window) {
      window.launchQueue.setConsumer(async (launchData) => {
        if (launchData.files && launchData.files.length > 0) {
          const loadedFiles = await this.fileHandler.loadFiles(launchData.files);

          // Auto-open first file
          if (loadedFiles.length > 0) {
            // Directly open the viewer without rendering the grid first
            // This avoids the "flash" of the home page
            this.uiController.openInFullscreen(loadedFiles[0]);
          }
        }
      });
    }
  }

  /**
   * Setup share target
   */
  async setupShareTarget() {
    // Check if this is a shared file request
    const urlParams = new URLSearchParams(window.location.search);
    const sharedFiles = urlParams.get('shared-files');
    
    if (sharedFiles) {
      // Handle shared files
      await this.handleSharedFilesFromURL();
    }
  }

  /**
   * Handle shared files
   */
  async handleSharedFiles() {
    // Check if there are shared files in service worker
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      registration.active?.postMessage({ type: 'GET_SHARED_FILES' });
      
      navigator.serviceWorker.addEventListener('message', async (event) => {
        if (event.data.type === 'SHARED_FILES') {
          const { files } = event.data;
          const loadedFiles = await this.fileHandler.loadFiles(files);
          this.uiController.showToast(`Fichiers partagés : ${files.length}`, 'success');

          // Auto-open first file
          if (loadedFiles.length > 0) {
            // Directly open the viewer without rendering the grid first
            // This avoids the "flash" of the home page
            this.uiController.openInFullscreen(loadedFiles[0]);
          }
        }
      });
    }
  }

  /**
   * Handle shared files from URL
   */
  async handleSharedFilesFromURL() {
    // This would be implemented when the app receives shared files
    console.log('📤 Handling shared files from URL');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // Global error handler
    window.addEventListener('error', (event) => {
      console.error('💥 Global error:', event.error);
      this.handleError(event.error);
    });
    
    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      console.error('💥 Unhandled promise rejection:', event.reason);
      this.handleError(event.reason);
    });
    
    // File error handler
    window.addEventListener('fileerror', (event) => {
      console.error('💥 File error:', event.detail);
      this.uiController.showToast(`Erreur lors du chargement du fichier : ${event.detail.filename}`, 'error');
    });
  }

  /**
   * Handle errors
   * @param {Error} error - Error object
   */
  handleError(error) {
    // Log error
    console.error('Application error:', error);
    
    // Show user-friendly message
    // Always show French message for notifications
    const message = 'Une erreur inattendue est survenue';
    this.uiController.showToast(message, 'error');
    
    // Send error to analytics (if implemented)
    this.logError(error);
  }

  /**
   * Log error for debugging
   * @param {Error} error - Error object
   */
  logError(error) {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      url: window.location.href
    };
    
    // Store in localStorage for debugging
    const logs = JSON.parse(localStorage.getItem('gallery-error-logs') || '[]');
    logs.push(errorLog);
    
    // Keep only last 10 errors
    if (logs.length > 10) {
      logs.splice(0, logs.length - 10);
    }
    
    localStorage.setItem('gallery-error-logs', JSON.stringify(logs));
  }

  /**
   * Show loading screen
   * @param {boolean} show - Show loading screen
   */
  showLoadingScreen(show) {
    const loadingScreen = document.getElementById('loading-screen');
    const app = document.getElementById('app');
    
    if (loadingScreen && app) {
      loadingScreen.classList.toggle('hidden', !show);
      app.classList.toggle('hidden', show);
    }
  }

  /**
   * Show update notification
   * @param {ServiceWorkerRegistration} registration - Service Worker registration
   */
  showUpdateNotification(registration) {
    // Prevent duplicate notifications
    if (document.querySelector('.toast.update-notification')) return;

    const toast = GalleryUtils.createElement('div', {
      className: 'toast info update-notification',
      style: 'cursor: pointer;'
    }, [
      GalleryUtils.createElement('i', { className: 'material-icons' }, 'system_update'),
      GalleryUtils.createElement('span', {}, 'Nouvelle version disponible !'),
      GalleryUtils.createElement('button', {
        className: 'update-btn',
        style: 'margin-left: auto; padding: 4px 8px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;'
      }, 'Mettre à jour')
    ]);
    
    toast.addEventListener('click', () => {
      if (registration?.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        
        // Wait for the new service worker to take control
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          window.location.reload();
        }, { once: true });
      } else {
        window.location.reload();
      }
    });
    
    this.uiController.toastContainer.appendChild(toast);
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3000) {
    if (this.uiController) {
      this.uiController.showToast(message, type, duration);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    this.showToast(message, 'error', 5000);
  }

  /**
   * Get app version
   * @returns {string} App version
   */
  getVersion() {
    return '1.0.0';
  }

  /**
   * Get app info
   * @returns {Object} App information
   */
  getAppInfo() {
    return {
      name: 'Galerie',
      version: this.getVersion(),
      description: 'Une galerie de JemaOS pour visualiser des images, des vidéos et des fichiers audio',
      features: [
        'Multi-format support (Images, Videos, Audio)',
        'Fullscreen viewing with navigation',
        'Grid and list views',
        'Search and filtering',
        'PWA support',
        'Keyboard shortcuts',
        'Touch gestures',
        'Offline functionality'
      ]
    };
  }

  /**
   * Clear all data
   */
  clearAllData() {
    if (confirm('Ceci effacera toutes les données de la galerie. Êtes-vous sûr ?')) {
      // Clear files
      this.fileHandler.files = [];
      this.fileHandler.filteredFiles = [];
      this.fileHandler.selectedFiles.clear();
      
      // Clear storage
      localStorage.removeItem('jemaos-gallery-data');
      
      // Clear thumbnails cache
      this.fileHandler.thumbnails.clear();
      
      // Re-render UI
      this.uiController.renderFiles();
      this.uiController.showToast('Toutes les données ont été effacées', 'success');
    }
  }

  /**
   * Export settings
   */
  exportSettings() {
    const settings = {
      version: this.getVersion(),
      timestamp: new Date().toISOString(),
      preferences: {
        showFileInfo: this.uiController.showFileInfo,
        sortBy: this.fileHandler.currentSort.field,
        sortOrder: this.fileHandler.currentSort.order,
        filter: this.fileHandler.currentFilter
      },
      errorLogs: JSON.parse(localStorage.getItem('gallery-error-logs') || '[]')
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    GalleryUtils.downloadFile(URL.createObjectURL(dataBlob), 'gallery-settings.json');
    this.uiController.showToast('Paramètres exportés', 'success');
  }

  /**
   * Import settings
   */
  async importSettings(file) {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      // Validate settings
      if (!settings.version || !settings.preferences) {
        throw new Error('Fichier de paramètres invalide');
      }
      
      // Apply preferences
      const prefs = settings.preferences;
      this.uiController.showFileInfo = prefs.showFileInfo !== false;
      this.fileHandler.setSorting(prefs.sortBy || 'name', prefs.sortOrder || 'asc');
      this.fileHandler.setFilter(prefs.filter || 'all');
      
      // Update UI
      this.uiController.updateUI();
      
      this.uiController.showToast('Paramètres importés', 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.uiController.showToast('Échec de l\'importation des paramètres', 'error');
    }
  }

  /**
   * Debug function to log app state
   */
  debug() {
    console.group('🔍 JemaOS Gallery Debug Info');
    console.log('Version:', this.getVersion());
    console.log('Initialized:', this.isInitialized);
    console.log('Files:', {
      total: this.fileHandler.files.length,
      filtered: this.fileHandler.filteredFiles.length,
      selected: this.fileHandler.selectedFiles.size
    });
    console.log('UI State:', {
      filter: this.fileHandler.currentFilter,
      search: this.fileHandler.searchQuery
    });
    console.log('Fullscreen Viewer:', {
      open: this.fullscreenViewer.isOpen,
      currentFile: this.fullscreenViewer.currentFile?.name,
      index: this.fullscreenViewer.currentIndex
    });
    console.log('Storage Usage:', this.getStorageUsage());
    console.groupEnd();
  }

  /**
   * Get storage usage information
   * @returns {Object} Storage usage
   */
  getStorageUsage() {
    const usage = {
      localStorage: 0,
      indexedDB: 0,
      cache: 0
    };
    
    // Calculate localStorage usage
    for (let key in localStorage) {
      if (Object.hasOwn(localStorage, key)) {
        usage.localStorage += localStorage[key].length;
      }
    }
    
    return usage;
  }
}

// Initialize the application when DOM is ready
const galleryApp = new JemaOSGallery();

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => galleryApp.init());
} else {
  galleryApp.init();
}

// Make app available globally for debugging
window.galleryAppDebug = {
  app: galleryApp,
  clearData: () => galleryApp.clearAllData(),
  exportSettings: () => galleryApp.exportSettings(),
  debug: () => galleryApp.debug(),
  version: () => galleryApp.getVersion(),
  info: () => galleryApp.getAppInfo()
};

// Handle visibility change for performance optimization
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause any playing media
    if (window.fullscreenViewer?.isOpen) {
      const media = document.querySelector('#viewer-media video, #viewer-media audio');
      if (media && !media.paused) {
        media.pause();
      }
    }
  }
});

// Service Worker message handling
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data.type === 'UPDATE_AVAILABLE') {
      galleryApp.showUpdateNotification();
    }
  });
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JemaOSGallery;
}