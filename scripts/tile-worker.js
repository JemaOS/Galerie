/**
 * tile-worker.js — Web Worker for image tile pyramid generation
 *
 * Receives large images as ImageBitmap (zero-copy transfer) and generates
 * tiles for a multi-resolution pyramid using OffscreenCanvas.
 *
 * Message protocol:
 *   Main → Worker: generatePyramid, generateTile, cancel
 *   Worker → Main: pyramidInfo, tileReady, progress, error, complete
 */

/** @type {Set<string>} Task IDs that have been cancelled */
const cancelledTasks = new Set();

/**
 * Calculate pyramid level dimensions.
 *
 * Level 0 = original resolution
 * Level N = fits within a single tile (≤ tileSize × tileSize)
 *
 * @param {number} width  - Source image width
 * @param {number} height - Source image height
 * @param {number} tileSize - Tile dimension in pixels
 * @param {number} [maxLevel] - Optional cap on the number of levels
 * @returns {Array<{level: number, width: number, height: number, cols: number, rows: number}>}
 */
function calculateLevels(width, height, tileSize, maxLevel) {
    const levels = [];
    let lvl = 0;
    let w = width;
    let h = height;

    while (true) {
        const cols = Math.ceil(w / tileSize);
        const rows = Math.ceil(h / tileSize);
        levels.push({ level: lvl, width: w, height: h, cols, rows });

        // Stop when the image fits in a single tile
        if (w <= tileSize && h <= tileSize) break;
        // Stop if we've reached the caller-specified max level
        if (maxLevel !== undefined && maxLevel !== null && lvl >= maxLevel) break;

        lvl++;
        w = Math.max(1, Math.ceil(w / 2));
        h = Math.max(1, Math.ceil(h / 2));
    }

    return levels;
}

/**
 * Generate a single tile from a pre-scaled OffscreenCanvas.
 *
 * @param {OffscreenCanvas} scaledCanvas - Canvas at the current level's resolution
 * @param {number} tileX   - Column index
 * @param {number} tileY   - Row index
 * @param {number} tileSize - Nominal tile dimension
 * @param {number} levelWidth  - Full width at this level
 * @param {number} levelHeight - Full height at this level
 * @returns {Promise<ImageBitmap>}
 */
async function extractTile(scaledCanvas, tileX, tileY, tileSize, levelWidth, levelHeight) {
    const sx = tileX * tileSize;
    const sy = tileY * tileSize;
    // Edge tiles may be smaller than tileSize
    const sw = Math.min(tileSize, levelWidth - sx);
    const sh = Math.min(tileSize, levelHeight - sy);

    const tileCanvas = new OffscreenCanvas(sw, sh);
    const ctx = tileCanvas.getContext('2d');
    ctx.drawImage(scaledCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

    return tileCanvas.transferToImageBitmap();
}

/**
 * Handle `generatePyramid` — build the full tile pyramid.
 *
 * Generates levels from lowest resolution (fastest preview) to highest,
 * transferring each tile's ImageBitmap back to the main thread.
 *
 * @param {object} data - Message payload
 * @param {string} data.taskId
 * @param {ImageBitmap} data.imageBitmap
 * @param {number} [data.tileSize=512]
 * @param {number} [data.maxLevel]
 */
async function handleGeneratePyramid(data) {
    const { taskId, imageBitmap, tileSize = 512, maxLevel, originalWidth, originalHeight } = data;

    try {
        // The bitmap is a scaled-down version of the original image (max 4096px).
        // We calculate pyramid levels from the BITMAP dimensions (the actual pixel
        // data available) so that level metadata accurately reflects tile content.
        // The renderer uses originalWidth/originalHeight for display scaling.
        const bitmapWidth = imageBitmap.width;
        const bitmapHeight = imageBitmap.height;

        // Use original dimensions for display reference (fall back to bitmap dims)
        const origW = originalWidth || bitmapWidth;
        const origH = originalHeight || bitmapHeight;

        // 1. Calculate pyramid levels from the ACTUAL bitmap dimensions.
        //    This ensures each level's width/height matches the real tile content,
        //    eliminating the mismatch where level 0 claimed 8956×25756 but tiles
        //    were actually from a 1424×4096 bitmap.
        const levels = calculateLevels(bitmapWidth, bitmapHeight, tileSize, maxLevel);

        // 2. Filter out redundant levels that have the same tile grid.
        //    When the bitmap is already small, many levels produce identical 1×1 grids.
        const filteredLevels = [];
        let prevKey = null;
        for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const key = `${lvl.width}x${lvl.height}`;
            // Keep the level if it has a different resolution than the previous one
            if (key !== prevKey) {
                filteredLevels.push(lvl);
                prevKey = key;
            }
        }

        // Re-number levels sequentially after filtering
        for (let i = 0; i < filteredLevels.length; i++) {
            filteredLevels[i].level = i;
        }

        const totalTiles = filteredLevels.reduce((sum, l) => sum + l.cols * l.rows, 0);

        // 3. Send pyramid metadata — include original dimensions for display scaling
        self.postMessage({
            type: 'pyramidInfo',
            taskId,
            levels: filteredLevels,
            totalTiles,
            originalWidth: origW,
            originalHeight: origH,
            bitmapWidth: bitmapWidth,
            bitmapHeight: bitmapHeight
        });

        let completed = 0;

        // 4. Process levels from lowest resolution (last) to highest (first)
        for (let i = filteredLevels.length - 1; i >= 0; i--) {
            if (cancelledTasks.has(taskId)) {
                cancelledTasks.delete(taskId);
                return;
            }

            const lvl = filteredLevels[i];
            const canvasWidth = lvl.width;
            const canvasHeight = lvl.height;

            // Create an OffscreenCanvas at this level's resolution and draw the bitmap
            const scaledCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
            const ctx = scaledCanvas.getContext('2d');
            ctx.drawImage(imageBitmap, 0, 0, canvasWidth, canvasHeight);

            // 5. Slice into tiles using the actual level dimensions
            for (let ty = 0; ty < lvl.rows; ty++) {
                for (let tx = 0; tx < lvl.cols; tx++) {
                    // Check cancellation before each tile
                    if (cancelledTasks.has(taskId)) {
                        cancelledTasks.delete(taskId);
                        return;
                    }

                    const bitmap = await extractTile(
                        scaledCanvas, tx, ty, tileSize, canvasWidth, canvasHeight
                    );

                    // Transfer the bitmap back (zero-copy)
                    self.postMessage(
                        {
                            type: 'tileReady',
                            taskId,
                            level: lvl.level,
                            tileX: tx,
                            tileY: ty,
                            bitmap
                        },
                        [bitmap]
                    );

                    completed++;

                    // Send progress every 10 tiles
                    if (completed % 10 === 0 || completed === totalTiles) {
                        self.postMessage({
                            type: 'progress',
                            taskId,
                            completed,
                            total: totalTiles
                        });
                    }
                }
            }
        }

        // 6. Close source bitmap to free memory
        imageBitmap.close();

        // 7. Signal completion
        self.postMessage({
            type: 'complete',
            taskId
        });

    } catch (err) {
        self.postMessage({
            type: 'error',
            taskId,
            message: err.message || String(err)
        });
    }
}

/**
 * Handle `generateTile` — produce a single tile on demand.
 *
 * @param {object} data - Message payload
 * @param {string} data.taskId
 * @param {ImageBitmap} data.imageBitmap
 * @param {number} data.level
 * @param {number} data.tileX
 * @param {number} data.tileY
 * @param {number} [data.tileSize=512]
 */
async function handleGenerateTile(data) {
    const { taskId, imageBitmap, level, tileX, tileY, tileSize = 512 } = data;

    try {
        // Calculate dimensions at the requested level
        const scale = 1 / Math.pow(2, level);
        const levelWidth = Math.max(1, Math.ceil(imageBitmap.width * scale));
        const levelHeight = Math.max(1, Math.ceil(imageBitmap.height * scale));

        // Draw the source image scaled to this level's resolution
        const scaledCanvas = new OffscreenCanvas(levelWidth, levelHeight);
        const ctx = scaledCanvas.getContext('2d');
        ctx.drawImage(imageBitmap, 0, 0, levelWidth, levelHeight);

        // Extract the requested tile
        const bitmap = await extractTile(
            scaledCanvas, tileX, tileY, tileSize, levelWidth, levelHeight
        );

        // Close source bitmap to free memory
        imageBitmap.close();

        // Transfer the tile back
        self.postMessage(
            {
                type: 'tileReady',
                taskId,
                level,
                tileX,
                tileY,
                bitmap
            },
            [bitmap]
        );

    } catch (err) {
        self.postMessage({
            type: 'error',
            taskId,
            message: err.message || String(err)
        });
    }
}

/**
 * Handle `cancel` — mark a task for cancellation.
 *
 * The in-progress pyramid loop checks this set before each tile.
 *
 * @param {object} data - Message payload
 * @param {string} data.taskId
 */
function handleCancel(data) {
    cancelledTasks.add(data.taskId);
}

/**
 * Main message handler — dispatches to the appropriate handler.
 */
self.onmessage = function (e) {
    const data = e.data;

    switch (data.type) {
        case 'generatePyramid':
            handleGeneratePyramid(data);
            break;

        case 'generateTile':
            handleGenerateTile(data);
            break;

        case 'cancel':
            handleCancel(data);
            break;

        default:
            self.postMessage({
                type: 'error',
                taskId: data.taskId || null,
                message: `Unknown message type: ${data.type}`
            });
    }
};
