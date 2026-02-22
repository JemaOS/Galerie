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

// JemaOS Gallery - File Handler

/**
 * Handles all file operations including loading, processing, and management
 */

class FileHandler {
  constructor() {
    this.files = [];
    this.filteredFiles = [];
    this.selectedFiles = new Set();
    this.currentFilter = 'all';
    this.currentSort = { field: 'name', order: 'asc' };
    this.searchQuery = '';
    this.thumbnails = new Map(); // Cache for thumbnails
    this.maxFileSize = Infinity; // No file size limit - browser handles large files via streaming
    this.supportedTypes = new Set([
      // Images
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
      'image/bmp', 'image/svg+xml', 'image/tiff', 'image/x-icon',
      'image/heic', 'image/heif', 'image/avif', 'image/apng', 'image/pjpeg',
      // Videos
      'video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo',
      'video/webm', 'video/ogg', 'video/x-matroska', 'video/3gpp',
      'video/mpeg', 'video/x-m4v', 'video/3gpp2', 'video/mp2t', 'video/x-f4v',
      'video/h264', 'video/h265', 'video/hevc', 'video/x-flv', 'video/x-divx', 'video/divx', 'video/vnd.avi',
      'video/quicktime', 'video/x-ms-wmv', 'video/x-ms-asf', 'video/x-matroska',
      'video/x-ms-vob',
      // Audio
      'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav',
      'audio/flac', 'audio/aac', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp4',
      'audio/opus', 'audio/midi', 'audio/x-midi', 'audio/x-ms-wma',
      // PDF
      'application/pdf'
    ]);
  }

  /**
   * Initialize file handler
   */
  async init() {
    this.loadFromStorage();
    this.setupEventListeners();
  }

  /**
   * Load files from a directory handle
   * @param {FileSystemDirectoryHandle} dirHandle - Directory handle
   * @returns {Promise<Array>} Loaded files
   */
  async loadFromDirectory(dirHandle) {
    const files = [];
    
    try {
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file') {
          try {
            const file = await entry.getFile();
            // Pass the handle to processFile so we can save back to it later
            const result = await this.processFile(file, entry);
            if (result) {
              files.push(result);
            }
          } catch (e) {
            console.warn('Error processing file entry:', entry.name, e);
          }
        }
      }
      
      // Sort files by name by default to ensure consistent order
      files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

      // Update internal state
      this.files = files;
      this.applyFilters();
      this.saveToStorage();
      
      return files;
    } catch (error) {
      console.error('Error loading from directory:', error);
      this.showToast('Erreur lors du chargement du dossier', 'error');
      return [];
    }
  }

  /**
   * Load files from various sources
   * @param {FileList|Array<File>|FileSystemFileHandle} source - File source
   * @returns {Promise<Array>} Loaded files
   */
  async loadFiles(source) {
    const files = [];
    const errors = [];

    try {
      if (source instanceof FileList) {
        await this._processFileList(source, files, errors);
      } else if (Array.isArray(source)) {
        await this._processFileArray(source, files, errors);
      } else if (source && typeof source === 'object') {
        await this._processFileSystemSource(source, files, errors);
      }

      this._finalizeFileLoading(files, errors);
      return files;
    } catch (error) {
      console.error('Error loading files:', error);
      this.showToast('Erreur lors du chargement des fichiers', 'error');
      return [];
    }
  }

  /**
   * Process FileList (from file input or drag and drop)
   * @private
   */
  async _processFileList(fileList, files, errors) {
    for (const file of fileList) {
      const result = await this.processFile(file);
      if (result) {
        files.push(result);
      } else {
        errors.push(`${file.name} : Fichier non supporté ou invalide`);
      }
    }
  }

  /**
   * Process array of files or FileSystemHandles
   * @private
   */
  async _processFileArray(sourceArray, files, errors) {
    for (const item of sourceArray) {
      await this._processFileArrayItem(item, files, errors);
    }
  }

  /**
   * Process a single item from file array
   * @private
   */
  async _processFileArrayItem(item, files, errors) {
    let file = item;
    let handle = null;

    if (item.kind === 'file' && typeof item.getFile === 'function') {
      const fileResult = await this._getFileFromHandle(item, errors);
      if (!fileResult) return;
      file = fileResult.file;
      handle = fileResult.handle;
    }

    const result = await this.processFile(file, handle);
    if (result) {
      files.push(result);
    } else {
      errors.push(`${file.name || item.name} : Fichier non supporté ou invalide`);
    }
  }

  /**
   * Get file from FileSystemFileHandle
   * @private
   * @returns {Promise<Object|null>} Object with file and handle, or null if failed
   */
  async _getFileFromHandle(handleItem, errors) {
    try {
      const file = await handleItem.getFile();
      return { file, handle: handleItem };
    } catch (e) {
      if (e.name === 'NotFoundError') {
        console.warn(`[FileHandler] Skipping stale file handle: ${handleItem.name || 'unknown'} - file no longer exists`);
        return null;
      }
      console.error('Error getting file from handle:', e);
      errors.push(`${handleItem.name} : Échec de la lecture du fichier`);
      return null;
    }
  }

  /**
   * Process FileSystem API source
   * @private
   */
  async _processFileSystemSource(source, files, errors) {
    if (!source.getFile) return;

    const file = await source.getFile();
    const result = await this.processFile(file);
    if (result) {
      files.push(result);
    } else {
      errors.push(`${file.name} : Fichier non supporté ou invalide`);
    }
  }

  /**
   * Finalize file loading - add to collection and show errors
   * @private
   */
  _finalizeFileLoading(files, errors) {
    for (const file of files) {
      this.addFile(file);
    }

    this.saveToStorage();

    if (errors.length > 0) {
      this.showToast(`Certains fichiers n'ont pas pu être chargés : ${errors.join(', ')}`, 'warning');
    }
  }

  /**
   * Process individual file
   * @param {File} file - File to process
   * @param {FileSystemFileHandle} [handle] - Optional file handle
   * @returns {Promise<Object|null>} Processed file object
   */
  async processFile(file, handle = null) {
    // Validate file
    if (!this.validateFile(file)) {
      return null;
    }

    const fileType = GalleryUtils.getFileType(file.name, file.type);
    
    // For large video files (>500MB), don't create blob URL immediately
    // Instead, store the file reference and create URL on-demand
    // This prevents memory issues with very large files (4GB+)
    const isLargeFile = file.size > 500 * 1024 * 1024; // 500MB threshold
    const isStreamableType = fileType === 'video' || fileType === 'audio';
    
    let blobUrl = null;
    if (!isLargeFile || !isStreamableType) {
      // For smaller files or non-streamable types, create blob URL immediately
      blobUrl = URL.createObjectURL(file);
      console.log('[FileHandler] Created blob URL:', blobUrl, 'for file:', file.name);
    } else {
      console.log('[FileHandler] Large streamable file detected, deferring blob URL creation:', file.name, 'size:', GalleryUtils.formatFileSize(file.size));
    }
    
    const fileObject = {
      id: GalleryUtils.generateId(),
      file: file,
      handle: handle,
      name: file.name,
      size: file.size,
      type: fileType,
      mimeType: file.type,
      lastModified: file.lastModified,
      url: blobUrl,
      extension: GalleryUtils.getFileExtension(file.name),
      added: Date.now(),
      isLargeFile: isLargeFile && isStreamableType
    };

    // Generate thumbnail based on file type
    // Disabled for simple list view
    fileObject.thumbnail = null;

    // Get metadata for specific file types
    // Optimization: Skip metadata pre-loading to reduce latency

    fileObject.metadata = {};

    return fileObject;
  }

  /**
   * Validate file
   * @param {File} file - File to validate
   * @returns {boolean} True if valid
   */
  validateFile(file) {
    // Check if file exists
    if (!file) {
      return false;
    }

    // Check file size
    if (file.size > this.maxFileSize) {
      console.warn(`File ${file.name} is too large (${GalleryUtils.formatFileSize(file.size)})`);
      return false;
    }

    // Check file type
    // Relaxed validation: If it looks like a media file, try to open it regardless of exact MIME type match
    // This fixes issues where the browser reports an empty or generic MIME type for some files
    if (!this.supportedTypes.has(file.type) &&
        !GalleryUtils.isSupportedFile(file)) {
      
      // Last resort check by extension
      const ext = GalleryUtils.getFileExtension(file.name);
      const knownExtensions = [
        // Video
        'mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', '3gp', '3g2', 'mpg', 'mpeg', 'm4v', 'ts', 'mts', 'm2ts', 'vob', 'ogv', 'divx', 'xvid', 'hevc', 'h264', 'h265',
        // Audio
        'mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'opus', 'wma', 'mid', 'midi', 'kar', 'm4b',
        // Image
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'tif', 'ico', 'heic', 'heif', 'avif', 'jfif', 'pjpeg', 'pjp', 'apng', 'cur'
      ];
      
      if (knownExtensions.includes(ext)) {
        console.log(`Allowing file based on extension: ${file.name} (${file.type})`);
        return true;
      }

      console.warn(`Unsupported file type: ${file.type} for ${file.name}`);
      return false;
    }

    return true;
  }

  /**
   * Generate thumbnail for file
   * @param {Object} fileObject - File object
   * @returns {Promise<string>} Thumbnail data URL
   */
  async generateThumbnail(fileObject) {
    const cacheKey = `${fileObject.id}-${fileObject.lastModified}`;
    
    // Check cache first
    if (this.thumbnails.has(cacheKey)) {
      return this.thumbnails.get(cacheKey);
    }

    let thumbnail;

    try {
      if (fileObject.type === 'image') {
        thumbnail = await this.generateImageThumbnail(fileObject);
      } else if (fileObject.type === 'video') {
        thumbnail = await this.generateVideoThumbnail(fileObject);
      } else if (fileObject.type === 'audio') {
        thumbnail = this.generateAudioThumbnail(fileObject);
      } else if (fileObject.type === 'pdf') {
        thumbnail = this.generatePdfThumbnail(fileObject);
      } else {
        thumbnail = this.generateDefaultThumbnail(fileObject);
      }

      // Cache the thumbnail
      if (thumbnail) {
        this.thumbnails.set(cacheKey, thumbnail);
      }

      return thumbnail;
    } catch (error) {
      console.error('Error generating thumbnail:', error);
      return this.generateDefaultThumbnail(fileObject);
    }
  }

  /**
   * Generate image thumbnail
   * @param {Object} fileObject - File object
   * @returns {Promise<string>} Thumbnail data URL
   */
  async generateImageThumbnail(fileObject) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      img.onload = () => {
        try {
          // Calculate thumbnail size (max 200x200)
          const maxSize = 200;
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;

          // Draw image
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to data URL
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          resolve(thumbnail);
        } catch (error) {
          reject(error);
        }
        
        img.remove();
        canvas.remove();
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
        img.remove();
        canvas.remove();
      };

      img.src = fileObject.url;
    });
  }

  /**
   * Generate video thumbnail
   * @param {Object} fileObject - File object
   * @returns {Promise<string>} Thumbnail data URL
   */
  async generateVideoThumbnail(fileObject) {
    // Try using GalleryUtils method first
    const galleryUtilsThumbnail = await GalleryUtils.createVideoThumbnail(fileObject.url, 1).catch(() => null);
    if (galleryUtilsThumbnail) {
      return galleryUtilsThumbnail;
    }
    
    // Fallback to video element method
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.onloadedmetadata = () => {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        };

        video.onseeked = () => {
          try {
            ctx.drawImage(video, 0, 0);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnail);
          } catch (error) {
            reject(error);
          }
          video.remove();
          canvas.remove();
        };

        video.onerror = () => {
          reject(new Error('Failed to load video'));
          video.remove();
          canvas.remove();
        };

        video.src = fileObject.url;
        video.currentTime = 1; // Seek to 1 second
      });
  }

  /**
   * Generate PDF thumbnail
   * @param {Object} fileObject - File object
   * @returns {string} Thumbnail data URL (placeholder)
   */
  generatePdfThumbnail(fileObject) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 200, 200);
    
    // Border
    ctx.strokeStyle = '#dadce0';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, 200, 200);

    // PDF icon
    ctx.fillStyle = '#ea4335';
    ctx.font = '64px Material Icons';
    ctx.textAlign = 'center';
    ctx.fillText('picture_as_pdf', 100, 120);

    return canvas.toDataURL();
  }

  /**
   * Generate audio thumbnail
   * @param {Object} fileObject - File object
   * @returns {string} Thumbnail data URL (placeholder)
   */
  generateAudioThumbnail(fileObject) {
    // Create a simple audio waveform placeholder
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#3c4043';
    ctx.fillRect(0, 0, 200, 200);

    // Draw waveform bars
    ctx.fillStyle = '#34a853';
    for (let i = 0; i < 20; i++) {
      const x = i * 10 + 5;
      // Using crypto.getRandomValues for visual waveform heights
      const randomBuffer = new Uint32Array(1);
      crypto.getRandomValues(randomBuffer);
      const height = (randomBuffer[0] % 100) + 20;
      const y = 100 - height / 2;
      ctx.fillRect(x, y, 6, height);
    }

    // Audio icon
    ctx.fillStyle = '#ffffff';
    ctx.font = '48px Material Icons';
    ctx.textAlign = 'center';
    ctx.fillText('🎵', 100, 120);

    return canvas.toDataURL();
  }

  /**
   * Generate default thumbnail
   * @param {Object} fileObject - File object
   * @returns {string} Thumbnail data URL
   */
  generateDefaultThumbnail(fileObject) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#3c4043';
    ctx.fillRect(0, 0, 200, 200);

    // File icon
    ctx.fillStyle = '#9aa0a6';
    ctx.font = '64px Material Icons';
    ctx.textAlign = 'center';
    ctx.fillText('📄', 100, 120);

    return canvas.toDataURL();
  }

  /**
   * Get image metadata
   * @param {File} file - Image file
   * @returns {Promise<Object>} Image metadata
   */
  async getImageMetadata(file) {
    return new Promise((resolve) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight,
          aspectRatio: img.naturalWidth / img.naturalHeight
        });
        img.remove();
      };

      img.onerror = () => {
        resolve({ width: 0, height: 0, aspectRatio: 1 });
        img.remove();
      };

      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get video metadata
   * @param {File} file - Video file
   * @returns {Promise<Object>} Video metadata
   */
  async getVideoMetadata(file) {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        resolve({
          width: video.videoWidth,
          height: video.videoHeight,
          duration: video.duration,
          aspectRatio: video.videoWidth / video.videoHeight
        });
        video.remove();
      };

      video.onerror = () => {
        resolve({ width: 0, height: 0, duration: 0, aspectRatio: 1 });
        video.remove();
      };

      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Get audio metadata
   * @param {File} file - Audio file
   * @returns {Promise<Object>} Audio metadata
   */
  async getAudioMetadata(file) {
    return new Promise((resolve) => {
      const audio = document.createElement('audio');
      
      audio.onloadedmetadata = () => {
        resolve({
          duration: audio.duration
        });
        audio.remove();
      };

      audio.onerror = () => {
        resolve({ duration: 0 });
        audio.remove();
      };

      audio.src = URL.createObjectURL(file);
    });
  }

  /**
   * Add file to collection
   * @param {Object} fileObject - File object to add
   */
  addFile(fileObject) {
    // Check for duplicates
    const isDuplicate = this.files.some(f => 
      f.name === fileObject.name && 
      f.size === fileObject.size && 
      f.lastModified === fileObject.lastModified
    );

    if (!isDuplicate) {
      this.files.push(fileObject);
      this.applyFilters();
    }
  }

  /**
   * Remove file from collection
   * @param {string} fileId - File ID to remove
   */
  removeFile(fileId) {
    const index = this.files.findIndex(f => f.id === fileId);
    if (index !== -1) {
      const file = this.files[index];
      
      // Clean up URL
      console.log('[FileHandler] Revoking blob URL:', file.url, 'for file:', file.name);
      URL.revokeObjectURL(file.url);
      
      // Remove from files
      this.files.splice(index, 1);
      
      // Remove from selection
      this.selectedFiles.delete(fileId);
      
      // Clean up thumbnails cache
      const cacheKey = `${file.id}-${file.lastModified}`;
      this.thumbnails.delete(cacheKey);
      
      this.applyFilters();
      this.saveToStorage();
    }
  }

  /**
   * Remove multiple files
   * @param {Array<string>} fileIds - Array of file IDs to remove
   */
  removeFiles(fileIds) {
    fileIds.forEach(fileId => this.removeFile(fileId));
  }

  /**
   * Apply current filters and search
   */
  applyFilters() {
    let filtered = [...this.files];

    // Apply type filter
    if (this.currentFilter !== 'all') {
      filtered = filtered.filter(file => file.type === this.currentFilter);
    }

    // Apply search query
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(file => 
        file.name.toLowerCase().includes(query) ||
        file.extension.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (this.currentSort.field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'date':
          aValue = a.lastModified;
          bValue = b.lastModified;
          break;
        case 'size':
          aValue = a.size;
          bValue = b.size;
          break;
        case 'type':
          aValue = a.type;
          bValue = b.type;
          break;
        default:
          return 0;
      }

      if (this.currentSort.order === 'asc') {
        if (aValue < bValue) return -1;
        if (aValue > bValue) return 1;
        return 0;
      } else {
        if (aValue > bValue) return -1;
        if (aValue < bValue) return 1;
        return 0;
      }
    });

    this.filteredFiles = filtered;
    this.updateFileCount();
  }

  /**
   * Set filter
   * @param {string} filter - Filter type (all, images, videos, audio)
   */
  setFilter(filter) {
    this.currentFilter = filter;
    this.applyFilters();
  }

  /**
   * Set search query
   * @param {string} query - Search query
   */
  setSearchQuery(query) {
    this.searchQuery = query.trim();
    this.applyFilters();
  }

  /**
   * Set sorting
   * @param {string} field - Sort field
   * @param {string} order - Sort order (asc, desc)
   */
  setSorting(field, order) {
    this.currentSort = { field, order };
    this.applyFilters();
  }

  /**
   * Select file
   * @param {string} fileId - File ID to select
   */
  selectFile(fileId) {
    this.selectedFiles.add(fileId);
  }

  /**
   * Deselect file
   * @param {string} fileId - File ID to deselect
   */
  deselectFile(fileId) {
    this.selectedFiles.delete(fileId);
  }

  /**
   * Toggle file selection
   * @param {string} fileId - File ID to toggle
   */
  toggleFileSelection(fileId) {
    if (this.selectedFiles.has(fileId)) {
      this.deselectFile(fileId);
    } else {
      this.selectFile(fileId);
    }
  }

  /**
   * Select all visible files
   */
  selectAllVisible() {
    this.filteredFiles.forEach(file => {
      this.selectedFiles.add(file.id);
    });
  }

  /**
   * Deselect all files
   */
  deselectAll() {
    this.selectedFiles.clear();
  }

  /**
   * Get selected files
   * @returns {Array} Array of selected file objects
   */
  getSelectedFiles() {
    return this.files.filter(file => this.selectedFiles.has(file.id));
  }

  /**
   * Get filtered files
   * @returns {Array} Array of filtered file objects
   */
  getFilteredFiles() {
    return this.filteredFiles;
  }

  /**
   * Get all files
   * @returns {Array} Array of all file objects
   */
  getAllFiles() {
    return this.files;
  }

  /**
   * Update file count display
   */
  updateFileCount() {
    const countElement = document.getElementById('file-count');
    if (countElement) {
      const total = this.files.length;
      const filtered = this.filteredFiles.length;
      
      if (filtered === total) {
        countElement.textContent = `${total} fichier${total !== 1 ? 's' : ''}`;
      } else {
        countElement.textContent = `${filtered} sur ${total} fichier${total !== 1 ? 's' : ''}`;
      }
    }
  }

  /**
   * Save file content back to disk
   * @param {Object} fileObject - File object
   * @param {Blob} blob - New file content
   * @returns {Promise<boolean>} True if saved successfully
   */
  async saveFile(fileObject, blob) {
    try {
      if (fileObject.handle) {
        const writable = await fileObject.handle.createWritable();
        await writable.write(blob);
        await writable.close();
        
        // Update internal state
        fileObject.size = blob.size;
        fileObject.lastModified = Date.now();
        
        // Update URL
        URL.revokeObjectURL(fileObject.url);
        fileObject.url = URL.createObjectURL(blob);
        
        // Update thumbnail if needed
        const cacheKey = `${fileObject.id}-${fileObject.lastModified}`;
        this.thumbnails.delete(cacheKey);
        
        console.log(`[FileHandler] Saved changes to ${fileObject.name}`);
        return true;
      } else {
        console.warn('[FileHandler] No file handle available for saving');
        // Fallback to download if no handle (e.g. drag & drop without handle)
        // But for "Save", we usually expect to overwrite. If we can't, maybe we should treat it as Save As or fail?
        // For now, let's return false so the UI can decide to call saveFileAs or show error.
        return false;
      }
    } catch (error) {
      console.error('[FileHandler] Error saving file:', error);
      return false;
    }
  }

  /**
   * Save file as new file
   * @param {Object} originalFile - Original file object (for name suggestion)
   * @param {Blob} blob - New file content
   * @returns {Promise<Object|null>} New file object if successful
   */
  async saveFileAs(originalFile, blob) {
      try {
          if ('showSaveFilePicker' in window) {
              const options = {
                  suggestedName: originalFile.name,
                  types: [{
                      description: originalFile.type.toUpperCase(),
                      accept: { [originalFile.mimeType]: [originalFile.extension ? `.${originalFile.extension}` : ''] }
                  }],
              };
              
              const handle = await globalThis.showSaveFilePicker(options);
              const writable = await handle.createWritable();
              await writable.write(blob);
              await writable.close();
              
              const file = await handle.getFile();
              return await this.processFile(file, handle);
          } else {
              // Fallback to download
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = originalFile.name;
              document.body.appendChild(a);
              a.click();
              a.remove();
              URL.revokeObjectURL(url);
              return null; // Can't get file object back from download
          }
      } catch (error) {
          if (error.name !== 'AbortError') {
              console.error('Error saving file as:', error);
          }
          return null;
      }
  }

  /**
   * Save files to storage
   */
  saveToStorage() {
    try {
      const data = {
        files: this.files.map(file => ({
          id: file.id,
          name: file.name,
          size: file.size,
          type: file.type,
          mimeType: file.mimeType,
          lastModified: file.lastModified,
          extension: file.extension,
          added: file.added,
          // Note: We don't save the actual file or URL for security
        })),
        settings: {
          filter: this.currentFilter,
          sort: this.currentSort,
          search: this.searchQuery
        }
      };
      
      localStorage.setItem('jemaos-gallery-data', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to save to storage:', error);
    }
  }

  /**
   * Load files from storage
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem('jemaos-gallery-data');
      if (data) {
        const parsed = JSON.parse(data);
        
        // Restore settings
        if (parsed.settings) {
          this.currentFilter = parsed.settings.filter || 'all';
          this.currentSort = parsed.settings.sort || { field: 'name', order: 'asc' };
          this.searchQuery = parsed.settings.search || '';
        }

        // Note: We can't restore actual files from storage for security reasons
        // Files need to be re-uploaded by the user
      }
    } catch (error) {
      console.error('Failed to load from storage:', error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Handle file system access API
    if ('showOpenFilePicker' in window) {
      this.setupFileSystemListeners();
    }

    // Handle drag and drop
    this.setupDragDropListeners();

    // Handle paste events
    this.setupPasteListeners();
  }

  /**
   * Setup file system access listeners
   */
  setupFileSystemListeners() {
    // This would be called when user wants to access local files
    console.log('File System Access API is supported');
  }

  /**
   * Setup drag and drop listeners
   */
  setupDragDropListeners() {
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    document.addEventListener('drop', async (e) => {
      await this._handleDropEvent(e);
    });
  }

  /**
   * Check if any viewer is currently open
   * @private
   * @returns {boolean} True if any viewer is open
   */
  _isAnyViewerOpen() {
    return (globalThis.fullscreenViewer?.isViewerOpen()) ||
           (globalThis.pdfViewer?.isOpen) ||
           (globalThis.audioPlayer?.elements?.container && !globalThis.audioPlayer.elements.container.classList.contains('hidden'));
  }

  /**
   * Handle drop event
   * @private
   */
  async _handleDropEvent(e) {
    e.preventDefault();

    if (this._isAnyViewerOpen()) {
      console.log('Drop blocked because viewer is open');
      return;
    }

    const items = e.dataTransfer.items;
    if (items && await this._tryLoadFromHandles(items)) {
      return;
    }

    if (GalleryUtils.isValidDragData(e.dataTransfer)) {
      await this.loadFiles(e.dataTransfer.files);
    }
  }

  /**
   * Try to load files from FileSystemHandles
   * @private
   * @returns {Promise<boolean>} True if handles were loaded
   */
  async _tryLoadFromHandles(items) {
    const handles = [];

    for (const item of items) {
      if (item.kind !== 'file') continue;

      const handle = await this._getFileSystemHandle(item);
      if (handle) {
        handles.push(handle);
      }
    }

    if (handles.length > 0) {
      await this.loadFiles(handles);
      return true;
    }

    return false;
  }

  /**
   * Get FileSystemHandle from data transfer item
   * @private
   * @returns {Promise<FileSystemHandle|null>} The handle or null
   */
  async _getFileSystemHandle(item) {
    if (!item.getAsFileSystemHandle) return null;

    try {
      const handle = await item.getAsFileSystemHandle();
      return (handle?.kind === 'file') ? handle : null;
    } catch (err) {
      console.warn('Failed to get handle:', err);
      return null;
    }
  }

  /**
   * Setup paste listeners
   */
  setupPasteListeners() {
    document.addEventListener('paste', async (e) => {
      await this._handlePasteEvent(e);
    });
  }

  /**
   * Handle paste event
   * @private
   */
  async _handlePasteEvent(e) {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = this._extractFilesFromClipboard(items);
    if (files.length === 0) return;

    await this.loadFiles(files);
    this._showPasteSuccessToast(files.length);
  }

  /**
   * Extract supported files from clipboard items
   * @private
   * @returns {Array<File>} Array of supported files
   */
  _extractFilesFromClipboard(items) {
    const files = [];
    for (const item of items) {
      const file = this._getSupportedFileFromItem(item);
      if (file) files.push(file);
    }
    return files;
  }

  /**
   * Get supported file from clipboard item
   * @private
   * @returns {File|null} The file or null
   */
  _getSupportedFileFromItem(item) {
    if (item.kind !== 'file') return null;

    const file = item.getAsFile();
    return (file && GalleryUtils.isSupportedFile(file)) ? file : null;
  }

  /**
   * Show paste success toast
   * @private
   */
  _showPasteSuccessToast(count) {
    const pluralSuffix = count !== 1 ? 's' : '';
    this.showToast(`${count} fichier${pluralSuffix} collé${pluralSuffix}`, 'success');
  }

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {string} type - Toast type (success, error, warning, info)
   */
  showToast(message, type = 'info') {
    // This would be handled by the UI controller
    if (globalThis.galleryUI?.showToast) {
      globalThis.galleryUI.showToast(message, type);
    }
  }
}

// Export for use in other modules
globalThis.FileHandler = FileHandler;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileHandler;
}