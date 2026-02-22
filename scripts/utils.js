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

// JemaOS Gallery - Utility Functions

/**
 * Utility functions for the JemaOS Gallery
 */

class GalleryUtils {
  /**
   * Format file size in human readable format
   * @param {number} bytes - File size in bytes
   * @param {number} decimals - Number of decimal places
   * @returns {string} Formatted file size
   */
  static formatFileSize(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = Math.max(0, decimals);
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  /**
   * Format duration in human readable format
   * @param {number} seconds - Duration in seconds
   * @returns {string} Formatted duration
   */
  static formatDuration(seconds) {
    if (!seconds || seconds < 0) return '00:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Format date in human readable format
   * @param {Date|string|number} date - Date to format
   * @returns {string} Formatted date
   */
  static formatDate(date) {
    const d = new Date(date);
    const now = new Date();
    const diff = now - d;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return 'Aujourd\'hui';
    } else if (days === 1) {
      return 'Hier';
    } else if (days < 7) {
      return `Il y a ${days} jours`;
    } else if (days < 30) {
      const weeks = Math.floor(days / 7);
      return `Il y a ${weeks} semaine${weeks > 1 ? 's' : ''}`;
    } else {
      return d.toLocaleDateString();
    }
  }

  /**
   * Get file type category from file extension or MIME type
   * @param {string} filename - File name or path
   * @param {string} mimeType - MIME type
   * @returns {string} File type category
   */
  static getFileType(filename, mimeType = '') {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mime = mimeType.toLowerCase();
    
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'tiff', 'ico', 'raw', 'cr2', 'nef', 'arw', 'dng', 'heic', 'heif', 'avif', 'jfif', 'pjpeg', 'pjp', 'apng', 'cur'];
    const videoExtensions = ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp', '3g2', 'ogv', 'mts', 'm2ts', 'ts', 'vob', 'divx', 'xvid', 'hevc', 'h264', 'h265'];
    const audioExtensions = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus', 'm4b', 'mid', 'midi', 'kar'];
    const pdfExtensions = ['pdf'];
    
    if (imageExtensions.includes(ext) || mime.startsWith('image/')) {
      return 'image';
    }
    
    if (videoExtensions.includes(ext) || mime.startsWith('video/')) {
      return 'video';
    }
    
    if (audioExtensions.includes(ext) || mime.startsWith('audio/')) {
      return 'audio';
    }
    
    if (pdfExtensions.includes(ext) || mime === 'application/pdf') {
      return 'pdf';
    }
    
    return 'unknown';
  }

  /**
   * Get file icon based on type
   * @param {string} type - File type
   * @returns {string} Material icon name
   */
  static getFileIcon(type) {
    const icons = {
      image: 'image',
      video: 'play_circle',
      audio: 'library_music',
      pdf: 'picture_as_pdf',
      unknown: 'insert_drive_file'
    };
    
    return icons[type] || icons.unknown;
  }

  /**
   * Debounce function to limit function calls
   * @param {Function} func - Function to debounce
   * @param {number} wait - Wait time in milliseconds
   * @returns {Function} Debounced function
   */
  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Throttle function to limit function calls
   * @param {Function} func - Function to throttle
   * @param {number} limit - Limit in milliseconds
   * @returns {Function} Throttled function
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Generate unique ID
   * @returns {string} Unique identifier
   */
  // Using crypto.randomUUID() for ID generation - provides cryptographically secure random IDs
  static generateId() {
    return Date.now().toString(36) + '-' + crypto.randomUUID();
  }

  /**
   * Sanitize filename
   * @param {string} filename - Filename to sanitize
   * @returns {string} Sanitized filename
   */
  static sanitizeFilename(filename) {
    return filename
      .replaceAll(/[<>:"/\\|?*]/g, '_')
      .replaceAll(/\.\.+/g, '_')
      .replaceAll(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get file extension from filename
   * @param {string} filename - Filename
   * @returns {string} File extension
   */
  static getFileExtension(filename) {
    return filename.split('.').pop()?.toLowerCase() || '';
  }

  /**
   * Check if file is image
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   * @returns {boolean} True if image file
   */
  static isImageFile(filename, mimeType = '') {
    return this.getFileType(filename, mimeType) === 'image';
  }

  /**
   * Check if file is video
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   * @returns {boolean} True if video file
   */
  static isVideoFile(filename, mimeType = '') {
    return this.getFileType(filename, mimeType) === 'video';
  }

  /**
   * Check if file is audio
   * @param {string} filename - Filename
   * @param {string} mimeType - MIME type
   * @returns {boolean} True if audio file
   */
  static isAudioFile(filename, mimeType = '') {
    return this.getFileType(filename, mimeType) === 'audio';
  }

  /**
   * Create element with attributes
   * @param {string} tag - HTML tag
   * @param {Object} attributes - Element attributes
   * @param {string|Node|Array} content - Element content
   * @returns {HTMLElement} Created element
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'className') {
        element.className = value;
      } else if (key === 'dataset') {
        Object.entries(value).forEach(([dataKey, dataValue]) => {
          element.dataset[dataKey] = dataValue;
        });
      } else {
        element.setAttribute(key, value);
      }
    });
    
    if (content) {
      if (typeof content === 'string') {
        element.innerHTML = content;
      } else if (content instanceof Node) {
        element.appendChild(content);
      } else if (Array.isArray(content)) {
        content.forEach(item => {
          if (typeof item === 'string') {
            element.appendChild(document.createTextNode(item));
          } else if (item instanceof Node) {
            element.appendChild(item);
          }
        });
      }
    }
    
    return element;
  }

  /**
   * Download file
   * @param {string} url - File URL
   * @param {string} filename - Download filename
   */
  static downloadFile(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /**
   * Copy text to clipboard
   * @param {string} text - Text to copy
   * @returns {Promise<boolean>} Success status
   */
  static async copyToClipboard(text) {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        return true;
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
          // Modern Clipboard API
          await navigator.clipboard.writeText(text);
        } catch (clipboardErr) {
          // Fallback to execCommand
          document.execCommand('copy');
        }
        textArea.remove();
        return true;
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
  }

  /**
   * Share files using Web Share API
   * @param {File|Array<File>} files - Files to share
   * @param {string} title - Share title
   * @param {string} text - Share text
   * @returns {Promise<boolean>} Success status
   */
  static async shareFiles(files, title = 'Fichiers de la galerie', text = '') {
    if (!navigator.share) {
      console.warn('Web Share API not supported');
      return false;
    }
    
    try {
      const shareData = { title, text };
      
      if (files instanceof File) {
        shareData.files = [files];
      } else if (Array.isArray(files) && files.length > 0) {
        shareData.files = files;
      } else {
        return false;
      }
      
      await navigator.share(shareData);
      return true;
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Failed to share files:', error);
      }
      return false;
    }
  }

  /**
   * Check if file is supported
   * @param {File} file - File to check
   * @returns {boolean} True if supported
   */
  static isSupportedFile(file) {
    const supportedTypes = [
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
    ];
    
    return supportedTypes.includes(file.type) ||
           this.isImageFile(file.name, file.type) ||
           this.isVideoFile(file.name, file.type) ||
           this.isAudioFile(file.name, file.type) ||
           file.type === 'application/pdf' ||
           file.name.toLowerCase().endsWith('.pdf');
  }

  /**
   * Load image and return promise
   * @param {string} src - Image source
   * @returns {Promise<HTMLImageElement>} Image element
   */
  static loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Get image dimensions
   * @param {string} src - Image source
   * @returns {Promise<Object>} Image dimensions
   */
  static getImageDimensions(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = src;
    });
  }

  /**
   * Create video thumbnail
   * @param {string} videoSrc - Video source
   * @param {number} time - Time in seconds
   * @returns {Promise<string>} Thumbnail data URL
   */
  static async createVideoThumbnail(videoSrc, time = 1) {
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
      
      video.src = videoSrc;
      video.currentTime = Math.min(time, video.duration || time);
    });
  }

  /**
   * Validate drag and drop data
   * @param {DataTransfer} dataTransfer - Drag and drop data
   * @returns {boolean} True if valid
   */
  static isValidDragData(dataTransfer) {
    if (!dataTransfer) return false;
    
    // Check for files
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      return true;
    }
    
    // Check for supported types
    const types = Array.from(dataTransfer.types || []);
    return types.some(type => 
      type.startsWith('image/') || 
      type.startsWith('video/') || 
      type.startsWith('audio/')
    );
  }

  /**
   * Get safe text content
   * @param {string} text - Text to sanitize
   * @returns {string} Sanitized text
   */
  static getSafeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Check if device is touch device
   * @returns {boolean} True if touch device
   */
  static isTouchDevice() {
    return 'ontouchstart' in globalThis || 
           navigator.maxTouchPoints > 0 || 
           navigator.msMaxTouchPoints > 0;
  }

  /**
   * Check if fullscreen API is supported
   * @returns {boolean} True if supported
   */
  static isFullscreenSupported() {
    return !!(
      document.fullscreenEnabled ||
      document.webkitFullscreenEnabled ||
      document.mozFullScreenEnabled ||
      document.msFullscreenEnabled
    );
  }

  /**
   * Enter fullscreen
   * @param {Element} element - Element to make fullscreen
   * @returns {Promise<boolean>} Success status
   */
  static async enterFullscreen(element) {
    if (!this.isFullscreenSupported()) return false;
    
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      return true;
    } catch (error) {
      // Ignore permission errors which can happen if not triggered by user interaction
      if (error.name === 'NotAllowedError' || error.message.includes('Permissions check failed')) {
        console.warn('Fullscreen request denied (likely due to lack of user interaction):', error);
      } else {
        console.error('Failed to enter fullscreen:', error);
      }
      return false;
    }
  }

  /**
   * Exit fullscreen
   * @returns {Promise<boolean>} Success status
   */
  static async exitFullscreen() {
    if (!this.isFullscreenSupported()) return false;
    
    try {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        await document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        await document.mozCancelFullScreen();
      } else if (document.msExitFullscreen) {
        await document.msExitFullscreen();
      }
      return true;
    } catch (error) {
      console.error('Failed to exit fullscreen:', error);
      return false;
    }
  }

  /**
   * Print file
   * @param {string} url - File URL
   * @param {string} type - File type (image, pdf)
   */
  static printFile(url, type) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    
    document.body.appendChild(iframe);
    
    if (type === 'pdf') {
        iframe.src = url;
        iframe.onload = () => {
            try {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
            } catch (e) {
                console.error('Print failed', e);
            }
        };
    } else {
        // Image
        const doc = iframe.contentWindow.document;
        doc.open();
        doc.write(`<html><head><style>@page { margin: 0; } body { margin: 0; display: flex; justify-content: center; align-items: center; height: 100vh; } img { max-width: 100%; max-height: 100%; object-fit: contain; }</style></head><body><img src="${url}" onload="window.print();"></body></html>`);
        doc.close();
    }
    
    // Cleanup after a delay
    setTimeout(() => {
        if (document.body.contains(iframe)) {
            iframe.remove();
        }
    }, 60000); // 1 minute should be enough to trigger print dialog
  }
}

// Export for use in other modules
globalThis.GalleryUtils = GalleryUtils;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GalleryUtils;
}