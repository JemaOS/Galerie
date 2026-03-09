/**
 * Tiled Image Renderer Module
 * 
 * Handles tiled rendering of huge images (>16384px or >268 megapixels) using
 * a canvas-based tile pyramid approach. Works with tile-worker.js Web Worker
 * for background tile generation.
 * 
 * Exports: TileCache, TiledImageRenderer, ProgressiveImageLoader (on window)
 */

// ============================================================================
// TileCache — LRU cache for ImageBitmap tiles with memory budget management
// ============================================================================

class TileCache {
    /**
     * Create a new TileCache.
     * @param {Object} [options={}]
     * @param {number} [options.maxEntries=512] - Maximum number of cached tiles
     * @param {number} [options.maxMemoryMB=256] - Maximum memory budget in megabytes
     */
    constructor(options = {}) {
        this.maxEntries = options.maxEntries || 512;
        this.maxMemoryMB = options.maxMemoryMB || 256;
        this.currentMemoryBytes = 0;
        /** @type {Map<string, {bitmap: ImageBitmap, size: number, lastAccess: number}>} */
        this.cache = new Map();
    }

    /**
     * Generate a cache key from tile coordinates.
     * @param {number} level - Pyramid level index
     * @param {number} tileX - Tile column
     * @param {number} tileY - Tile row
     * @returns {string} Cache key
     */
    static key(level, tileX, tileY) {
        return `${level}:${tileX}:${tileY}`;
    }

    /**
     * Get a tile from the cache, updating its access time.
     * @param {number} level - Pyramid level index
     * @param {number} tileX - Tile column
     * @param {number} tileY - Tile row
     * @returns {ImageBitmap|null} The cached tile bitmap, or null if not found
     */
    get(level, tileX, tileY) {
        const k = TileCache.key(level, tileX, tileY);
        const entry = this.cache.get(k);
        if (!entry) return null;
        // Update access time for LRU tracking
        entry.lastAccess = performance.now();
        return entry.bitmap;
    }

    /**
     * Store a tile in the cache, evicting old entries if over budget.
     * @param {number} level - Pyramid level index
     * @param {number} tileX - Tile column
     * @param {number} tileY - Tile row
     * @param {ImageBitmap} bitmap - The tile bitmap to cache
     */
    set(level, tileX, tileY, bitmap) {
        const k = TileCache.key(level, tileX, tileY);

        // If this key already exists, remove the old entry first
        if (this.cache.has(k)) {
            const old = this.cache.get(k);
            this.currentMemoryBytes -= old.size;
            old.bitmap.close();
            this.cache.delete(k);
        }

        const size = this._estimateSize(bitmap);
        this.currentMemoryBytes += size;

        this.cache.set(k, {
            bitmap: bitmap,
            size: size,
            lastAccess: performance.now()
        });

        // Evict if over budget
        this._evict();
    }

    /**
     * Check if a tile exists in the cache.
     * @param {number} level - Pyramid level index
     * @param {number} tileX - Tile column
     * @param {number} tileY - Tile row
     * @returns {boolean} True if the tile is cached
     */
    has(level, tileX, tileY) {
        return this.cache.has(TileCache.key(level, tileX, tileY));
    }

    /**
     * Evict least recently used tiles until the cache is within budget.
     * @private
     */
    _evict() {
        const maxBytes = this.maxMemoryMB * 1024 * 1024;

        while (this.cache.size > this.maxEntries || this.currentMemoryBytes > maxBytes) {
            if (this.cache.size === 0) break;

            // Find the least recently used entry
            let oldestKey = null;
            let oldestTime = Infinity;

            for (const [key, entry] of this.cache) {
                if (entry.lastAccess < oldestTime) {
                    oldestTime = entry.lastAccess;
                    oldestKey = key;
                }
            }

            if (oldestKey !== null) {
                const entry = this.cache.get(oldestKey);
                this.currentMemoryBytes -= entry.size;
                entry.bitmap.close();
                this.cache.delete(oldestKey);
            } else {
                break;
            }
        }
    }

    /**
     * Estimate the memory size of an ImageBitmap in bytes.
     * Assumes 4 bytes per pixel (RGBA).
     * @param {ImageBitmap} bitmap
     * @returns {number} Estimated size in bytes
     * @private
     */
    _estimateSize(bitmap) {
        return bitmap.width * bitmap.height * 4;
    }

    /**
     * Clear all tiles from the cache, closing all ImageBitmaps.
     */
    clear() {
        for (const entry of this.cache.values()) {
            entry.bitmap.close();
        }
        this.cache.clear();
        this.currentMemoryBytes = 0;
    }

    /**
     * Get cache statistics.
     * @returns {{entries: number, memoryMB: number, maxEntries: number, maxMemoryMB: number}}
     */
    get stats() {
        return {
            entries: this.cache.size,
            memoryMB: Math.round((this.currentMemoryBytes / (1024 * 1024)) * 100) / 100,
            maxEntries: this.maxEntries,
            maxMemoryMB: this.maxMemoryMB
        };
    }
}


// ============================================================================
// TiledImageRenderer — Canvas-based tile compositor for huge images
// ============================================================================

class TiledImageRenderer {
    /**
     * Create a new TiledImageRenderer.
     * @param {HTMLElement} container - DOM element to render into
     * @param {Object} [options={}]
     * @param {number} [options.tileSize=512] - Tile size in pixels
     * @param {Object} [options.cache] - Options passed to TileCache constructor
     */
    constructor(container, options = {}) {
        this.container = container;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.tileSize = options.tileSize || 512;
        this.tileCache = new TileCache(options.cache);
        /** @type {Worker|null} */
        this.worker = null;
        /** @type {Array<{width: number, height: number, cols: number, rows: number}>} */
        this.levels = [];
        this.imageWidth = 0;
        this.imageHeight = 0;
        /** Original image dimensions (for display scaling) */
        this.originalWidth = 0;
        this.originalHeight = 0;
        /** Actual bitmap dimensions sent to the worker */
        this.bitmapWidth = 0;
        this.bitmapHeight = 0;
        /** @type {string|null} */
        this.currentTaskId = null;
        this.isActive = false;
        /** @type {number|null} */
        this.pendingRender = null;
        /** @type {Function|null} */
        this._onTileReady = null;
        /** @type {Function|null} Callback fired when the first tile is rendered */
        this.onFirstTile = null;
        this._firstTileFired = false;

        /** Viewport state (set externally by the fullscreen viewer) */
        this.viewport = {
            x: 0,          // pan offset X (screen pixels)
            y: 0,          // pan offset Y (screen pixels)
            scale: 1,      // zoom level
            width: 0,      // container width
            height: 0      // container height
        };

        this._setupCanvas();
    }

    /**
     * Setup the canvas element to fill the container.
     * @private
     */
    _setupCanvas() {
        this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        this.container.appendChild(this.canvas);
        this._resizeCanvas();
    }

    /**
     * Resize the canvas to match the container dimensions, accounting for devicePixelRatio.
     * @private
     */
    _resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /**
     * Load an image from a Blob/File and begin tiled rendering if needed.
     * @param {Blob} blob - The image blob to load
     * @param {Object} [dimensions] - Pre-computed {width, height}
     * @returns {Promise<boolean>} True if tiled rendering is active, false if the image is small enough for a regular <img>
     */
    async load(blob, dimensions = null) {
        this.destroy();
        this._setupCanvas();  // Re-create canvas after destroy

        let width, height;
        if (dimensions) {
            width = dimensions.width;
            height = dimensions.height;
        } else {
            // Fallback: try to decode (may fail for huge images)
            const bitmap = await createImageBitmap(blob);
            width = bitmap.width;
            height = bitmap.height;
            bitmap.close();
        }

        this.imageWidth = width;
        this.imageHeight = height;

        // Check if tiled rendering is needed
        if (!TiledImageRenderer.needsTiling(width, height)) {
            return false;
        }

        // Scale down for worker — max 8192px on longest side
        // 16384 can cause OffscreenCanvas/drawImage failures on GPU texture limits
        // especially for very tall images where height hits the 16384 limit
        const MAX_WORKER_DIM = 8192;
        const scale = Math.min(1, MAX_WORKER_DIM / Math.max(width, height));
        const workerWidth = Math.round(width * scale);
        const workerHeight = Math.round(height * scale);

        // DEBUG: Log actual vs requested dimensions to diagnose truncation issues
        console.log(`[TileRenderer] Requested bitmap: ${workerWidth}x${workerHeight}, scale: ${scale}`);

        let bitmap;
        try {
            bitmap = await createImageBitmap(blob, {
                resizeWidth: workerWidth,
                resizeHeight: workerHeight,
                resizeQuality: 'high'
            });
            // DEBUG: Log actual bitmap dimensions
            console.log(`[TileRenderer] Actual bitmap: ${bitmap.width}x${bitmap.height}`);
        } catch (e) {
            // If resized decode fails too, try smaller
            try {
                const smallerScale = Math.min(1, 2048 / Math.max(width, height));
                bitmap = await createImageBitmap(blob, {
                    resizeWidth: Math.round(width * smallerScale),
                    resizeHeight: Math.round(height * smallerScale),
                    resizeQuality: 'medium'
                });
            } catch (e2) {
                console.error('Cannot decode image even at reduced size:', e2);
                return false;
            }
        }

        // Initialize worker
        this.worker = new Worker('scripts/tile-worker.js');
        this._onTileReady = this._handleWorkerMessage.bind(this);
        this.worker.onmessage = this._onTileReady;
        this.worker.onerror = (e) => {
            console.error('Tile worker error:', e);
        };

        // Generate pyramid
        this.currentTaskId = 'pyramid_' + Date.now();
        this.isActive = true;

        this.worker.postMessage({
            type: 'generatePyramid',
            taskId: this.currentTaskId,
            imageBitmap: bitmap,
            tileSize: this.tileSize,
            originalWidth: width,
            originalHeight: height
        }, [bitmap]); // transfer bitmap to worker

        return true;
    }

    /**
     * Check if an image needs tiled rendering based on its dimensions.
     * @param {number} width - Image width in pixels
     * @param {number} height - Image height in pixels
     * @returns {boolean} True if the image exceeds tiling thresholds
     */
    static needsTiling(width, height) {
        const MAX_DIMENSION = 16384;
        const MAX_PIXELS = 268435456; // 16384 * 16384
        return width > MAX_DIMENSION || height > MAX_DIMENSION || (width * height) > MAX_PIXELS;
    }

    /**
     * Handle messages from the tile worker.
     * @param {MessageEvent} e - Worker message event
     * @private
     */
    _handleWorkerMessage(e) {
        const msg = e.data;
        if (msg.taskId !== this.currentTaskId) return;

        switch (msg.type) {
            case 'pyramidInfo':
                this.levels = msg.levels;
                // Store original and bitmap dimensions from the worker
                this.originalWidth = msg.originalWidth || this.imageWidth;
                this.originalHeight = msg.originalHeight || this.imageHeight;
                this.bitmapWidth = msg.bitmapWidth || this.originalWidth;
                this.bitmapHeight = msg.bitmapHeight || this.originalHeight;
                break;
            case 'tileReady':
                this.tileCache.set(msg.level, msg.tileX, msg.tileY, msg.bitmap);
                this.requestRender();
                if (this.onFirstTile && !this._firstTileFired) {
                    this._firstTileFired = true;
                    this.onFirstTile();
                }
                break;
            case 'progress':
                // Could emit event for progress bar
                break;
            case 'complete':
                // Pyramid generation complete
                break;
            case 'error':
                console.error('Tile worker error:', msg.message);
                break;
        }
    }

    /**
     * Request a render on the next animation frame (debounced).
     * Multiple calls before the next frame result in a single render.
     */
    requestRender() {
        if (this.pendingRender) return;
        this.pendingRender = requestAnimationFrame(() => {
            this.pendingRender = null;
            this.render();
        });
    }

    /**
     * Update the viewport state and trigger a re-render.
     * Called by the fullscreen viewer on zoom/pan.
     * @param {number} x - Pan offset X in screen pixels
     * @param {number} y - Pan offset Y in screen pixels
     * @param {number} scale - Zoom scale factor
     */
    updateViewport(x, y, scale) {
        this.viewport.x = x;
        this.viewport.y = y;
        this.viewport.scale = scale;
        this.requestRender();
    }

    /**
     * Main render method — composites visible tiles onto the canvas.
     * Performance-critical: runs on every frame during zoom/pan.
     */
    render() {
        if (!this.isActive || this.levels.length === 0 || !this.bitmapWidth) return;

        const ctx = this.ctx;
        const vp = this.viewport;

        // Clear canvas
        ctx.clearRect(0, 0, vp.width, vp.height);
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, vp.width, vp.height);

        // Disable image smoothing to prevent anti-aliasing artifacts at tile edges
        ctx.imageSmoothingEnabled = false;

        // Select the best pyramid level for current zoom
        const level = this._selectLevel(vp.scale);
        const levelInfo = this.levels[level];
        if (!levelInfo) return;

        // Level dimensions are now in bitmap coordinates (actual tile content).
        // We need to map from bitmap space to original image display space.
        // levelScale: ratio of this level's resolution to the bitmap's full resolution
        const levelScale = levelInfo.width / this.bitmapWidth;

        // The image is displayed at its original dimensions on screen.
        // vp.scale is the zoom relative to the "fit" size using imageWidth/imageHeight.
        const imageScreenWidth = this.imageWidth * vp.scale;
        const imageScreenHeight = this.imageHeight * vp.scale;

        // bitmapToOriginal: how much bigger the original image is vs the bitmap
        const bitmapToOriginal = this.originalWidth / this.bitmapWidth;

        // Each tile at this level covers (tileSize / levelScale) bitmap pixels,
        // which corresponds to (tileSize / levelScale * bitmapToOriginal) original pixels.
        // On screen, each tile should be drawn at:
        //   tileSize * bitmapToOriginal * vp.scale / levelScale  screen pixels
        // Simplified: tileSize * (vp.scale * bitmapToOriginal / levelScale)
        const tileScreenSize = this.tileSize * (vp.scale * bitmapToOriginal / levelScale);

        // Calculate which tiles are visible
        // Image top-left on screen is at (vp.x, vp.y) offset from container center
        const imgLeft = (vp.width - imageScreenWidth) / 2 + vp.x;
        const imgTop = (vp.height - imageScreenHeight) / 2 + vp.y;

        // Visible region in tile coordinates
        const startCol = Math.max(0, Math.floor(-imgLeft / tileScreenSize));
        const startRow = Math.max(0, Math.floor(-imgTop / tileScreenSize));
        const endCol = Math.min(levelInfo.cols - 1, Math.floor((vp.width - imgLeft) / tileScreenSize));
        const endRow = Math.min(levelInfo.rows - 1, Math.floor((vp.height - imgTop) / tileScreenSize));

        // Draw visible tiles
        for (let row = startRow; row <= endRow; row++) {
            for (let col = startCol; col <= endCol; col++) {
                const tile = this.tileCache.get(level, col, row);
                if (tile) {
                    // Calculate actual tile dimensions (edge tiles may be smaller than tileSize)
                    const actualTileW = tile.width;
                    const actualTileH = tile.height;

                    // Destination position
                    const dx = Math.round(imgLeft + col * tileScreenSize);
                    const dy = Math.round(imgTop + row * tileScreenSize);

                    // For edge tiles, scale proportionally based on actual tile size
                    const drawW = Math.round(actualTileW * (tileScreenSize / this.tileSize));
                    const drawH = Math.round(actualTileH * (tileScreenSize / this.tileSize));

                    // Draw with 0.5px overlap on each side to eliminate sub-pixel gaps
                    ctx.drawImage(tile, 0, 0, actualTileW, actualTileH,
                        dx - 0.5, dy - 0.5, drawW + 1, drawH + 1);
                } else {
                    // Try fallback: use a lower-resolution tile
                    this._drawFallbackTile(ctx, level, col, row, imgLeft, imgTop, tileScreenSize);
                }
            }
        }

        // Re-enable image smoothing for other drawing operations
        ctx.imageSmoothingEnabled = true;
    }

    /**
     * Select the best pyramid level for the current zoom scale.
     * Picks the level where tile pixels roughly match screen pixels (1:1 mapping).
     * @param {number} scale - Current viewport zoom scale
     * @returns {number} The selected pyramid level index
     * @private
     */
    _selectLevel(scale) {
        // Level dimensions are now in bitmap coordinates (actual tile content).
        // We want the level where one tile pixel ≈ one screen pixel.
        //
        // The bitmap covers the same visual area as the original image.
        // bitmapToOriginal = originalWidth / bitmapWidth (e.g. 8956/1424 ≈ 6.29)
        // At level L, the effective scale relative to the original image is:
        //   effectiveScale = levels[L].width / bitmapWidth / bitmapToOriginal
        //                  = levels[L].width / originalWidth
        // We want effectiveScale >= scale * 0.5 (allow some oversampling)

        const origW = this.originalWidth || this.imageWidth;
        let bestLevel = this.levels.length - 1; // start with lowest res
        for (let i = 0; i < this.levels.length; i++) {
            // effectiveScale: what fraction of the original image this level represents
            const effectiveScale = this.levels[i].width / origW;
            if (effectiveScale >= scale * 0.5) { // allow some oversampling
                bestLevel = i;
                break;
            }
        }
        return bestLevel;
    }

    /**
     * Draw a fallback tile from a lower resolution level when the target tile is not yet cached.
     * @param {CanvasRenderingContext2D} ctx - Canvas rendering context
     * @param {number} targetLevel - The desired pyramid level
     * @param {number} col - Tile column at the target level
     * @param {number} row - Tile row at the target level
     * @param {number} imgLeft - Image left edge in screen pixels
     * @param {number} imgTop - Image top edge in screen pixels
     * @param {number} tileScreenSize - Size of a tile on screen in pixels
     * @private
     */
    _drawFallbackTile(ctx, targetLevel, col, row, imgLeft, imgTop, tileScreenSize) {
        // Try each lower-res level (higher level number)
        for (let fallbackLevel = targetLevel + 1; fallbackLevel < this.levels.length; fallbackLevel++) {
            const targetInfo = this.levels[targetLevel];
            const fallbackInfo = this.levels[fallbackLevel];

            // How many target tiles does one fallback tile cover?
            const ratio = targetInfo.width / fallbackInfo.width;
            const fbCol = Math.floor(col / ratio);
            const fbRow = Math.floor(row / ratio);

            const tile = this.tileCache.get(fallbackLevel, fbCol, fbRow);
            if (tile) {
                // Calculate source region within the fallback tile
                const srcX = ((col / ratio) - fbCol) * this.tileSize;
                const srcY = ((row / ratio) - fbRow) * this.tileSize;
                const srcSize = this.tileSize / ratio;

                const dx = Math.round(imgLeft + col * tileScreenSize);
                const dy = Math.round(imgTop + row * tileScreenSize);
                const dxNext = Math.round(imgLeft + (col + 1) * tileScreenSize);
                const dyNext = Math.round(imgTop + (row + 1) * tileScreenSize);
                const dw = dxNext - dx;
                const dh = dyNext - dy;

                ctx.drawImage(tile, srcX, srcY, srcSize, srcSize, dx, dy, dw, dh);
                return;
            }
        }

        // No fallback available — draw placeholder
        const dx = Math.round(imgLeft + col * tileScreenSize);
        const dy = Math.round(imgTop + row * tileScreenSize);
        const dxNext = Math.round(imgLeft + (col + 1) * tileScreenSize);
        const dyNext = Math.round(imgTop + (row + 1) * tileScreenSize);
        const dw = dxNext - dx;
        const dh = dyNext - dy;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(dx, dy, dw, dh);
    }

    /**
     * Handle container resize — updates canvas dimensions and re-renders.
     */
    resize() {
        this._resizeCanvas();
        this.requestRender();
    }

    /**
     * Cleanup all resources: terminate worker, clear cache, remove canvas.
     */
    destroy() {
        this.isActive = false;
        if (this.pendingRender) {
            cancelAnimationFrame(this.pendingRender);
            this.pendingRender = null;
        }
        if (this.worker) {
            if (this.currentTaskId) {
                this.worker.postMessage({ type: 'cancel', taskId: this.currentTaskId });
            }
            this.worker.terminate();
            this.worker = null;
        }
        this.tileCache.clear();
        this.levels = [];
        this.currentTaskId = null;
        this.onFirstTile = null;
        this._firstTileFired = false;
        this.originalWidth = 0;
        this.originalHeight = 0;
        this.bitmapWidth = 0;
        this.bitmapHeight = 0;
        if (this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}


// ============================================================================
// ProgressiveImageLoader — Blurred preview → full tiled/normal image transition
// ============================================================================

class ProgressiveImageLoader {
    /**
     * Create a new ProgressiveImageLoader.
     * @param {HTMLElement} container - DOM element to render previews and tiles into
     */
    constructor(container) {
        this.container = container;
        /** @type {HTMLImageElement|null} */
        this.previewImg = null;
        /** @type {string|null} Blob URL for the preview image (must be revoked on cleanup) */
        this._previewBlobUrl = null;
        /** @type {TiledImageRenderer|null} */
        this.tiledRenderer = null;
        this.isHugeImage = false;
    }

    /**
     * Load an image with progressive enhancement.
     * Shows a blurred low-res preview immediately, then either activates the
     * tiled renderer for huge images or signals the caller to use a regular <img>.
     * 
     * @param {Blob} blob - The image blob to load
     * @param {Object} [knownDimensions] - Pre-computed dimensions {width, height}
     * @returns {Promise<{isHuge: boolean, renderer: TiledImageRenderer|null, dimensions: {width: number, height: number}}>}
     */
    async load(blob, knownDimensions = null) {
        // Step 1: Show low-res preview immediately
        try {
            let previewBitmap;
            try {
                previewBitmap = await createImageBitmap(blob, {
                    resizeWidth: Math.min(1024, knownDimensions ? knownDimensions.width : 1024),
                    resizeQuality: 'low'
                });
            } catch (_e) {
                // Safari fallback
                previewBitmap = await createImageBitmap(blob);
            }
            this._showPreview(previewBitmap);
        } catch (e) {
            console.warn('Could not create preview:', e);
        }

        // Step 2: Use known dimensions or try to detect
        let width, height;
        if (knownDimensions) {
            width = knownDimensions.width;
            height = knownDimensions.height;
        } else {
            // Fallback: try small decode (this shouldn't happen if called correctly)
            try {
                const testBitmap = await createImageBitmap(blob);
                width = testBitmap.width;
                height = testBitmap.height;
                testBitmap.close();
            } catch (e) {
                console.error('Cannot determine image dimensions:', e);
                return { isHuge: false, renderer: null, dimensions: { width: 0, height: 0 } };
            }
        }

        // Step 3: Check if tiled rendering is needed
        if (TiledImageRenderer.needsTiling(width, height)) {
            // Huge image — use tiled renderer
            this.isHugeImage = true;
            this.tiledRenderer = new TiledImageRenderer(this.container);
            await this.tiledRenderer.load(blob, { width, height });

            // Fade out preview once first tiles are ready
            this.tiledRenderer.onFirstTile = () => this._hidePreview();
            // Safety timeout in case tiles never arrive
            this._hidePreviewTimeout = setTimeout(() => {
                if (this.previewImg) this._hidePreview();
            }, 10000);

            return { isHuge: true, renderer: this.tiledRenderer, dimensions: { width, height } };
        } else {
            // Normal image — just return dimensions, let the caller use <img>
            this._hidePreview();
            return { isHuge: false, renderer: null, dimensions: { width, height } };
        }
    }

    /**
     * Show a blurred preview image using an <img> element.
     * Converts the bitmap to a blob URL so that object-fit:contain works correctly
     * (object-fit does NOT work on <canvas> elements).
     * @param {ImageBitmap} bitmap - The low-resolution preview bitmap
     * @private
     */
    _showPreview(bitmap) {
        if (!this.previewImg) {
            this.previewImg = document.createElement('img');
            this.previewImg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;object-fit:contain;filter:blur(8px);transition:opacity 0.5s;z-index:1;';
            this.container.appendChild(this.previewImg);
        }

        // Convert the ImageBitmap to a blob URL via an OffscreenCanvas
        const offscreen = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = offscreen.getContext('2d');
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close();

        offscreen.convertToBlob({ type: 'image/png' }).then(blob => {
            // Revoke any previous blob URL
            if (this._previewBlobUrl) {
                URL.revokeObjectURL(this._previewBlobUrl);
            }
            this._previewBlobUrl = URL.createObjectURL(blob);
            if (this.previewImg) {
                this.previewImg.src = this._previewBlobUrl;
                this.previewImg.style.opacity = '1';
            }
        }).catch(err => {
            console.warn('Could not convert preview to blob:', err);
        });
    }

    /**
     * Hide and remove the preview image with a fade-out transition.
     * Revokes the blob URL to free memory.
     * @private
     */
    _hidePreview() {
        if (this.previewImg) {
            this.previewImg.style.opacity = '0';
            const preview = this.previewImg;
            const blobUrl = this._previewBlobUrl;
            setTimeout(() => {
                if (preview && preview.parentNode) {
                    preview.parentNode.removeChild(preview);
                }
                if (this.previewImg === preview) {
                    this.previewImg = null;
                }
                // Revoke the blob URL to free memory
                if (blobUrl) {
                    URL.revokeObjectURL(blobUrl);
                }
                if (this._previewBlobUrl === blobUrl) {
                    this._previewBlobUrl = null;
                }
            }, 500);
        }
    }

    /**
     * Cleanup all resources: preview image and tiled renderer.
     */
    destroy() {
        if (this._hidePreviewTimeout) {
            clearTimeout(this._hidePreviewTimeout);
            this._hidePreviewTimeout = null;
        }
        this._hidePreview();
        if (this.tiledRenderer) {
            this.tiledRenderer.destroy();
            this.tiledRenderer = null;
        }
    }
}


// ============================================================================
// Export all classes as globals
// ============================================================================

window.TileCache = TileCache;
window.TiledImageRenderer = TiledImageRenderer;
window.ProgressiveImageLoader = ProgressiveImageLoader;
