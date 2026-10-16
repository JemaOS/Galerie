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

// Dedicated route used by the manifest's file_handlers action. Opening a file
// launches the PWA on this path, so a direct file launch is known synchronously
// (before the first paint) and the home page is never shown, even if the file
// handle is only delivered later (e.g. after the file access permission prompt).
const FILE_LAUNCH_PATH = '/open';

function isFileLaunchRoute() {
  try {
    return globalThis.location.pathname.replace(/\/+$/, '') === FILE_LAUNCH_PATH;
  } catch (error) {
    return false;
  }
}

class JemaOSGallery {
  fileHandler = null;
  uiController = null;
  fullscreenViewer = null;
  pdfViewer = null;
  isInitialized = false;
  // Set true when the app is opened straight into a file (File Handling API,
  // share target). The home page is then never shown: the viewer is displayed
  // directly.
  directLaunch = false;
  // File Handling API state: whether the launch consumer has reported yet, the
  // files it carried (opened once the components exist), and the promise used to
  // wait for that report before revealing the home page.
  _launchReported = false;
  _pendingLaunchFiles = null;
  _launchDecisionPromise = null;
  _resolveLaunchDecision = null;
  swRegistration = null;
  // True when the app was opened on the dedicated file-handler route, i.e. the
  // OS is about to hand us a file: the home page must never be shown.
  _fileRoute = false;

  constructor() {
    this._launchDecisionPromise = new Promise(resolve => {
      this._resolveLaunchDecision = resolve;
    });
    this._fileRoute = isFileLaunchRoute();
    if (this._fileRoute) {
      this.directLaunch = true;
    }
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
      
      // Apply translations (initial language comes from the system)
      applyI18n();

      // On the file-handler route the app was opened to show a file: hide the
      // home page from the very first paint (no flash) while we wait for the file.
      if (this._fileRoute && document.body) {
        document.body.classList.add('launching');
      }

      // Register the File Handling API consumer before anything slow, so launch
      // params (a file opened from the OS) are delivered as early as possible.
      this.setupFileHandlers();
      
      // Initialize components
      await this.initializeComponents();
      
      // Setup PWA features
      await this.setupPWA();
      
      // Handle shared files without blocking startup: this awaits
      // navigator.serviceWorker.ready, which on a cold first run only resolves
      // after the whole precache installs. Do not gate the loading screen on it.
      this.handleSharedFiles().catch(error => {
        console.warn('[App] handleSharedFiles failed:', error);
      });
      
      // Setup global error handling
      this.setupErrorHandling();

      // Wait for the File Handling API to report a launch before deciding whether
      // the home page is shown. On JemaOS the launch params arrive
      // asynchronously, so deciding any earlier flashes the home page before the
      // file actually opens.
      await this.waitForLaunchDecision();

      // Mark as initialized
      this.isInitialized = true;

      // Temporary on-screen diagnostic (auto-hides): lets a launch problem be
      // reported without devtools. TODO: remove once launching is confirmed.
      this._showLaunchDiagnostic();

      if (this.directLaunch) {
        // Opening straight into a file: keep the home page hidden and show the
        // viewer directly (no fade, no black flash).
        document.body.classList.add('launching');
      } else {
        // Hide loading screen (reveals the home page)
        this.showLoadingScreen(false);
      }

      // Open the file that launched the app, now that the components exist.
      if (this._pendingLaunchFiles) {
        const files = this._pendingLaunchFiles;
        this._pendingLaunchFiles = null;
        await this._consumeLaunchFiles(files);
      } else if (this._fileRoute) {
        // We were opened on the file route but no file was delivered (e.g. the
        // user navigated there directly): do not leave a blank window, fall back
        // to the home page.
        this.revealApp();
      }

      // Re-apply translations after the first paint
      applyI18n();
      updateLanguageSelectorVisibility();
      
      console.log('✅ JemaOS Gallery initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize JemaOS Gallery:', error);
      this.showError(t('initFailed'));
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
    globalThis.galleryApp = this;
    globalThis.galleryFileHandler = this.fileHandler;
    globalThis.galleryUI = this.uiController;
    globalThis.fullscreenViewer = this.fullscreenViewer;
  }

  /**
   * Setup PWA features
   */
  async setupPWA() {
    // Register service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        this.swRegistration = registration;
        console.log('📱 Service Worker registered:', registration.scope);

        // The update prompt is driven by a *waiting* worker: while one exists it
        // must be offered, on every launch, until the user applies it.
        this._announceUpdate = () => {
          if (registration.waiting) this.showUpdateNotification(registration);
        };

        const watchForUpdate = worker => {
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed') this._announceUpdate();
          });
        };

        registration.addEventListener('updatefound', () => {
          watchForUpdate(registration.installing);
        });
        // A worker may already be installing/waiting (the update was found before
        // this ran), or may be waiting from a previous session. Handle all three.
        watchForUpdate(registration.installing || registration.waiting);
        this._announceUpdate();

        // Check for a new deployment on every launch: right away, once the worker
        // is ready, and once more shortly after for slow networks.
        const checkForUpdate = () => registration.update().catch(err => {
          console.warn('Update check failed:', err);
        });
        checkForUpdate();
        navigator.serviceWorker.ready.then(checkForUpdate).catch(() => {});
        setTimeout(checkForUpdate, 4000);

        // Check for updates when the network comes back online.
        globalThis.addEventListener('online', () => {
          console.log('🌐 Network online - checking for updates...');
          checkForUpdate();
        });

        // Re-announce (and re-check) periodically while the app stays open, so a
        // pending update is never silently forgotten.
        setInterval(() => {
          this._announceUpdate();
          if (navigator.onLine) checkForUpdate();
        }, 60 * 1000);

        // Coming back to the foreground (PWA window re-opened from the shelf)
        // should offer the update again too.
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState !== 'visible') return;
          this._announceUpdate();
          if (navigator.onLine) checkForUpdate();
        });
        
      } catch (error) {
        console.warn('⚠️ Service Worker registration failed:', error);
      }
    }
    
    // Setup install prompt
    this.setupInstallPrompt();
    
    // Setup share target
    this.setupShareTarget();
  }

  /**
   * Setup install prompt
   */
  setupInstallPrompt() {
    let deferredPrompt = null;
    
    globalThis.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      
      // Show install button or notification
      this.showInstallPrompt(deferredPrompt);
    });
    
    globalThis.addEventListener('appinstalled', () => {
      console.log('📱 PWA was installed');
      this.showToast(t('installedSuccessfully'), 'success');
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
   * Register the File Handling API consumer as early as possible.
   *
   * The callback is invoked once a launch is queued (a file opened from the OS,
   * or a normal installed-app launch carrying no file). It only records the
   * launch: the files are opened by init() once the components exist, or right
   * away when the app is already running.
   */
  setupFileHandlers() {
    if (!('launchQueue' in globalThis)) return;

    globalThis.launchQueue.setConsumer((launchData) => {
      const files = launchData?.files || [];
      this._launchReported = true;
      console.log(`[launch] launchQueue reported ${files.length} file(s)`);

      if (files.length > 0) {
        // Mark synchronously (before any await) so init() skips the home page
        // and shows the viewer directly.
        this.directLaunch = true;
        document.body.classList.add('launching');
        this._pendingLaunchFiles = files;
      }

      // Let init() stop waiting and decide.
      this._resolveLaunchDecision?.();

      // A launch received while the app is already running (e.g. opening another
      // file) is opened immediately; the first launch is opened by init().
      if (this.isInitialized && files.length > 0) {
        this._consumeLaunchFiles(files);
      }
    });
  }

  /**
   * Wait for the launch consumer to report before revealing the home page.
   *
   * Only installed (windowed) launches enqueue launch params, so a plain browser
   * tab is never delayed. A timeout guards against a browser that never reports.
   */
  async waitForLaunchDecision() {
    if (this._launchReported) return;

    // Dedicated file route: a file is definitely coming from the OS, so wait for
    // it (it can arrive late, e.g. right after the file access permission prompt)
    // instead of ever revealing the home page.
    if (this._fileRoute) {
      const started = Date.now();
      await Promise.race([
        this._launchDecisionPromise,
        new Promise(resolve => setTimeout(resolve, 30000))
      ]);
      if (!this._launchReported) {
        console.warn(`[launch] no file delivered on ${FILE_LAUNCH_PATH} after ${Date.now() - started}ms`);
      }
      return;
    }

    if (!('launchQueue' in globalThis)) return;

    // A plain browser tab never receives launch params, so it must not be
    // delayed. Every other display mode (standalone, minimal-ui, tabbed,
    // fullscreen, overlay, ...) can be a file-handler launch, so wait for the
    // File Handling API to report before showing the home page.
    const isBrowserTab = globalThis.matchMedia?.('(display-mode: browser)')?.matches === true;
    if (isBrowserTab) return;

    const started = Date.now();
    await Promise.race([
      this._launchDecisionPromise,
      new Promise(resolve => setTimeout(resolve, 3000))
    ]);
    if (!this._launchReported) {
      console.warn(`[launch] no launch params after ${Date.now() - started}ms; showing the home page`);
    }
  }

  /**
   * Temporary on-screen diagnostic (auto-hides) so a launch problem can be
   * reported without devtools. Remove once file launching is confirmed.
   */
  _showLaunchDiagnostic() {
    try {
      if (!document.body) return;
      const mode = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay', 'browser', 'tabbed']
        .find(m => globalThis.matchMedia?.(`(display-mode: ${m})`)?.matches) || 'unknown';
      const el = document.createElement('div');
      el.setAttribute('data-launch-diagnostic', '');
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:2147483647;background:rgba(0,0,0,.88);color:#8fd6ff;font:12px/1.45 monospace;padding:8px 10px;border-radius:6px;max-width:92vw;white-space:pre-wrap;pointer-events:none';
      el.textContent = [
        `Galerie v${this.getVersion()}`,
        `path=${globalThis.location.pathname}`,
        `display-mode=${mode}`,
        `launchQueue=${'launchQueue' in globalThis}`,
        `route=${this._fileRoute}`,
        `launchReported=${this._launchReported}`,
      ].join('\n');
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 20000);

      // Running service worker version (the real deployed build).
      if (globalThis.navigator?.serviceWorker?.controller) {
        try {
          const channel = new MessageChannel();
          channel.port1.onmessage = (event) => {
            el.textContent += `\nsw=${event.data?.version || '?'}`;
          };
          globalThis.navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' }, [channel.port2]);
        } catch (error) {
          // ignore
        }
      }
    } catch (error) {
      // Diagnostic only: never break startup.
    }
  }

  /**
   * Load and open the files carried by a launch, or fall back to the home page.
   * @param {Array<FileSystemFileHandle>} files - Files carried by the launch
   */
  async _consumeLaunchFiles(files) {
    if (!files || files.length === 0) {
      this.revealApp();
      return;
    }

    const loadedFiles = await this.fileHandler.loadFiles(files);

    // Auto-open first file
    if (loadedFiles.length > 0) {
      // Directly open the viewer without rendering the grid first
      this.uiController.openInFullscreen(loadedFiles[0]);
    } else {
      this.revealApp();
    }
  }

  /**
   * Leave the "direct launch" state and reveal the home page (used when a launch
   * turns out to carry no usable file, and when the viewer closes).
   */
  revealApp() {
    document.body.classList.remove('launching');
    this.directLaunch = false;
    this.showLoadingScreen(false);
  }

  /**
   * Setup share target
   */
  async setupShareTarget() {
    // Check if this is a shared file request
    const urlParams = new URLSearchParams(globalThis.location.search);
    const sharedFiles = urlParams.get('shared-files');
    
    if (sharedFiles) {
      // Mark synchronously so init() can skip the home page and show the viewer
      // directly.
      this.directLaunch = true;
      document.body.classList.add('launching');
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
          this.uiController.showToast(t('sharedFiles', { count: files.length }), 'success');

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
    globalThis.addEventListener('error', (event) => {
      console.error('💥 Global error:', event.error);
      this.handleError(event.error);
    });
    
    // Unhandled promise rejection handler
    globalThis.addEventListener('unhandledrejection', (event) => {
      console.error('💥 Unhandled promise rejection:', event.reason);
      this.handleError(event.reason);
    });
    
    // File error handler
    globalThis.addEventListener('fileerror', (event) => {
      console.error('💥 File error:', event.detail);
      this.uiController.showToast(t('fileLoadError', { filename: event.detail.filename }), 'error');
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
    const message = t('unexpectedError');
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
      url: globalThis.location.href
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
      GalleryUtils.createElement('span', {}, t('newVersionAvailable')),
      GalleryUtils.createElement('button', {
        className: 'update-btn',
        style: 'margin-left: auto; padding: 4px 8px; background: var(--primary-color); color: white; border: none; border-radius: 4px; cursor: pointer;'
      }, t('update'))
    ]);
    
    let reloaded = false;
    const reload = () => {
      if (reloaded) return;
      reloaded = true;
      globalThis.location.reload();
    };

    toast.addEventListener('click', () => {
      if (registration?.waiting) {
        // Let the new worker take over, then reload once it controls the page.
        navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        // Fallback in case `controllerchange` never fires.
        setTimeout(reload, 2000);
      } else {
        reload();
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
      description: t('appDescription'),
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
    if (confirm(t('clearDataConfirm'))) {
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
      this.uiController.showToast(t('allDataCleared'), 'success');
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
        filter: this.fileHandler.currentFilter,
        language: globalThis.getCurrentI18nLang?.() || 'fr'
      },
      errorLogs: JSON.parse(localStorage.getItem('gallery-error-logs') || '[]')
    };
    
    const dataStr = JSON.stringify(settings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    
    GalleryUtils.downloadFile(URL.createObjectURL(dataBlob), 'gallery-settings.json');
    this.uiController.showToast(t('settingsExported'), 'success');
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
        throw new Error(t('invalidSettingsFile'));
      }
      
      // Apply preferences
      const prefs = settings.preferences;
      this.uiController.showFileInfo = prefs.showFileInfo !== false;
      this.fileHandler.setSorting(prefs.sortBy || 'name', prefs.sortOrder || 'asc');
      this.fileHandler.setFilter(prefs.filter || 'all');
      if (prefs.language) {
        globalThis.setI18nLang?.(prefs.language);
      }
      
      // Update UI
      this.uiController.updateUI();
      
      this.uiController.showToast(t('settingsImported'), 'success');
    } catch (error) {
      console.error('Failed to import settings:', error);
      this.uiController.showToast(t('settingsImportFailed'), 'error');
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
globalThis.galleryAppDebug = {
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
    if (globalThis.fullscreenViewer?.isOpen) {
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