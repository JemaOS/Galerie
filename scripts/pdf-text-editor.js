/*
 * Copyright (C) 2025 Jema Technology
 *
 * PDF Text Editor - Adobe Acrobat DC Level Precision
 *
 * This module provides high-precision text editing capabilities for PDFs,
 * with accurate font detection, color sampling, and text positioning.
 */

// Comprehensive Font Mapping Dictionary - Extended for maximum compatibility
const FONT_MAPPINGS = {
    // Standard PDF Fonts
    'times': '"Times New Roman", "Times", serif',
    'timesnewroman': '"Times New Roman", "Times", serif',
    'helvetica': '"Helvetica", "Arial", sans-serif',
    'courier': '"Courier New", "Courier", monospace',
    'symbol': 'Symbol, sans-serif',
    'zapfdingbats': 'ZapfDingbats, sans-serif',

    // Windows
    'arial': '"Arial", "Helvetica", sans-serif',
    'verdana': '"Verdana", "Geneva", sans-serif',
    'tahoma': '"Tahoma", "Geneva", sans-serif',
    'trebuchet': '"Trebuchet MS", "Helvetica", sans-serif',
    'trebuchetms': '"Trebuchet MS", "Helvetica", sans-serif',
    'georgia': '"Georgia", "Times", serif',
    'garamond': '"Garamond", "Georgia", "Times New Roman", serif',
    'palatino': '"Palatino Linotype", "Book Antiqua", "Palatino", serif',
    'palatinolinotype': '"Palatino Linotype", "Book Antiqua", "Palatino", serif',
    'comicsans': '"Comic Sans MS", "Comic Sans", cursive',
    'comicsansms': '"Comic Sans MS", "Comic Sans", cursive',
    'impact': '"Impact", "Charcoal", sans-serif',
    'lucidaconsole': '"Lucida Console", "Monaco", monospace',
    'lucidasans': '"Lucida Sans Unicode", "Lucida Grande", sans-serif',
    'segoe': '"Segoe UI", "Tahoma", "Geneva", "Verdana", sans-serif',
    'segoeui': '"Segoe UI", "Tahoma", "Geneva", "Verdana", sans-serif',
    'calibri': '"Calibri", "Candara", "Segoe", "Segoe UI", "Optima", "Arial", sans-serif',
    'cambria': '"Cambria", "Georgia", serif',
    'candara': '"Candara", "Calibri", "Segoe", "Segoe UI", "Optima", "Arial", sans-serif',
    'constantia': '"Constantia", "Lucida Bright", "Georgia", serif',
    'corbel': '"Corbel", "Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", "DejaVu Sans", "Bitstream Vera Sans", "Liberation Sans", "Verdana", "Verdana Ref", sans-serif',
    'franklingothic': '"Franklin Gothic Medium", "Arial Narrow", "Arial", sans-serif',
    'bookantiqua': '"Book Antiqua", "Palatino", "Palatino Linotype", "Palatino LT STD", "Georgia", serif',
    'centurygothic': '"Century Gothic", "CenturyGothic", "AppleGothic", sans-serif',
    'bookmanoldstyle': '"Bookman Old Style", "Bookman", "URW Bookman L", "Georgia", serif',

    // macOS
    'helveticaneue': '"Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'sanfrancisco': '"San Francisco", "BlinkMacSystemFont", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", sans-serif',
    'baskerville': '"Baskerville", "Baskerville Old Face", "Hoefler Text", "Garamond", serif',
    'didot': '"Didot", "Didot LT STD", "Hoefler Text", "Garamond", serif',
    'americantypewriter': '"American Typewriter", "Courier New", monospace',
    'andalemono': '"Andale Mono", "Courier New", monospace',
    'monaco': '"Monaco", "Consolas", "Lucida Console", monospace',
    'gillsans': '"Gill Sans", "Gill Sans MT", "Calibri", sans-serif',
    'hoeflertext': '"Hoefler Text", "Baskerville Old Face", "Garamond", "Times New Roman", serif',
    'lucidagrande': '"Lucida Grande", "Lucida Sans Unicode", "Lucida Sans", "Geneva", "Verdana", sans-serif',
    'optima': '"Optima", "Segoe", "Segoe UI", "Candara", "Calibri", "Arial", sans-serif',

    // Adobe/Pro
    'minion': '"Minion Pro", "Minion", "Georgia", "Times New Roman", serif',
    'minionpro': '"Minion Pro", "Minion", "Georgia", "Times New Roman", serif',
    'myriad': '"Myriad Pro", "Myriad", "Helvetica", "Arial", sans-serif',
    'myriadpro': '"Myriad Pro", "Myriad", "Helvetica", "Arial", sans-serif',
    'caslon': '"Adobe Caslon Pro", "Caslon", "Baskerville", serif',
    'adobecaslonpro': '"Adobe Caslon Pro", "Caslon", "Baskerville", serif',
    'futura': '"Futura", "Trebuchet MS", "Arial", sans-serif',
    'bodoni': '"Bodoni MT", "Bodoni 72", "Didot", "Times New Roman", serif',
    'frutiger': '"Frutiger", "Frutiger Linotype", "Segoe UI", "Verdana", sans-serif',
    'bembo': '"Bembo", "Book Antiqua", "Palatino", serif',
    'rockwell': '"Rockwell", "Courier Bold", "Courier", "Georgia", serif',
    'avenir': '"Avenir", "Avenir Next", "Helvetica Neue", "Arial", sans-serif',
    'avenirnext': '"Avenir Next", "Avenir", "Helvetica Neue", "Arial", sans-serif',
    'gotham': '"Gotham", "Proxima Nova", "Montserrat", "Helvetica Neue", "Arial", sans-serif',
    'proximanova': '"Proxima Nova", "Montserrat", "Gotham", "Helvetica Neue", "Arial", sans-serif',

    // Google/Web
    'roboto': '"Roboto", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'opensans': '"Open Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'lato': '"Lato", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'montserrat': '"Montserrat", "Proxima Nova", "Gotham", "Helvetica Neue", "Arial", sans-serif',
    'oswald': '"Oswald", "Impact", "Arial Narrow", sans-serif',
    'sourcesanspro': '"Source Sans Pro", "Open Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'slabo': '"Slabo 27px", "Slabo 13px", "Georgia", serif',
    'raleway': '"Raleway", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'ptsans': '"PT Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'ptserif': '"PT Serif", "Georgia", "Times New Roman", serif',
    'merriweather': '"Merriweather", "Georgia", serif',
    'notosans': '"Noto Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'notoserif': '"Noto Serif", "Georgia", serif',
    'ubuntu': '"Ubuntu", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'playfairdisplay': '"Playfair Display", "Georgia", serif',
    'lora': '"Lora", "Georgia", serif',
    'muli': '"Muli", "Verdana", sans-serif',
    'titilliumweb': '"Titillium Web", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'nunito': '"Nunito", "Rounded Mplus 1c", "Varela Round", "Arial", sans-serif',
    'rubik': '"Rubik", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'worksans': '"Work Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'poppins': '"Poppins", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'firasans': '"Fira Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'crimsontext': '"Crimson Text", "Garamond", "Georgia", serif',
    'karla': '"Karla", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'consolas': '"Consolas", "Monaco", "Lucida Console", monospace',
    'menlo': '"Menlo", "Consolas", "Monaco", monospace',
    'dejavusansmono': '"DejaVu Sans Mono", "Menlo", "Consolas", monospace',
    'inconsolata': '"Inconsolata", "Courier New", monospace',
    'droidsans': '"Droid Sans", "Helvetica Neue", "Helvetica", "Arial", sans-serif',
    'droidserif': '"Droid Serif", "Georgia", serif',
    'robotoslab': '"Roboto Slab", "Rockwell", "Courier Bold", "Courier", serif',
    'arvo': '"Arvo", "Courier Bold", "Courier", serif',
    'bitstreamverasans': '"Bitstream Vera Sans", "Verdana", "Helvetica", "Arial", sans-serif',
};

class PdfTextEditor {
    constructor(viewer) {
        this.viewer = viewer;
        this.changes = new Map(); // Map<pageNum, Map<id, Change>>
        this.history = []; // Stack of changes for undo
        this.redoStack = []; // Stack of changes for redo
        this.isActive = false;
        this.textLayer = null;
        this.fontMap = new Map(); // Map font names to standard fonts
        this.previousText = null; // Track text before edit
        
        // Font metrics cache for precise positioning
        this.fontMetricsCache = new Map();
        
        // Color sampling configuration - Adobe-level precision
        this.colorConfig = {
            sampleRadius: 3,           // Pixels around text to sample
            colorTolerance: 15,        // RGB tolerance for color matching
            grayscaleTolerance: 10,    // Luminance tolerance for grayscale
            minContrastRatio: 2.5,     // Minimum contrast for text detection
            antiAliasThreshold: 0.3,   // Threshold for anti-aliased pixels
        };
        
        // Bind methods
        this.handleGlobalKeyDown = this.handleGlobalKeyDown.bind(this);
    }

    /**
     * Start text edit mode
     * @param {number} initialPageNum
     */
    async startTextEditMode(initialPageNum) {
        this.isActive = true;
        
        // Add global keydown listener for undo/redo
        document.addEventListener('keydown', this.handleGlobalKeyDown);

        // Render for all pages
        await this.refresh();
    }

    /**
     * Handle scale change (temporary visual update)
     * @param {number} newScale
     * @param {number} oldScale
     */
    onScaleChanged(newScale, oldScale) {
        // No-op: Scale is handled by the container's CSS transform in PdfViewer
        // We don't need to scale the text layer separately as it inherits the container's transform
    }

    /**
     * Reset text layer transforms after render completes
     * Called by refresh() after re-rendering text layers
     * Also called by performSynchronizedCommit() during zoom commit
     * This method is synchronous to allow it to be called within a single requestAnimationFrame
     */
    resetTransforms() {
        const layers = document.querySelectorAll('.pdf-text-layer');
        console.log('[PDF-TextEditor] resetTransforms: resetting ' + layers.length + ' layers');
        layers.forEach(layer => {
            // Reset transforms synchronously (caller is responsible for RAF timing)
            layer.style.transform = 'none';
            layer.style.transformOrigin = '';
        });
    }

    /**
     * Refresh all text layers (re-render)
     */
    async refresh() {
        console.log('[PDF-TextEditor] refresh: start');
        if (!this.isActive) return;
        
        const numPages = this.viewer.pdfDoc.numPages;
        const promises = [];
        for (let i = 1; i <= numPages; i++) {
            promises.push(this.renderTextLayer(i, true));
        }
        await Promise.all(promises);
        
        // Reset any temporary transforms after re-render
        this.resetTransforms();
        console.log('[PDF-TextEditor] refresh: complete');
    }

    /**
     * Stop text edit mode
     */
    stop() {
        this.isActive = false;
        document.removeEventListener('keydown', this.handleGlobalKeyDown);
        this.clearAllTextLayers();
    }

    /**
     * Clear all text layers
     */
    clearAllTextLayers() {
        const layers = document.querySelectorAll('.pdf-text-layer');
        layers.forEach(layer => layer.remove());
        this.textLayer = null;
    }

    /**
     * Check if a color is grayscale (R ≈ G ≈ B)
     * Uses configurable tolerance for precision
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {boolean} True if the color is grayscale
     */
    isGrayscale(r, g, b) {
        const tolerance = this.colorConfig?.grayscaleTolerance || 10;
        return Math.abs(r - g) < tolerance && Math.abs(g - b) < tolerance && Math.abs(r - b) < tolerance;
    }

    /**
     * Calculate relative luminance (WCAG formula)
     * More accurate than simple weighted average
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {number} Relative luminance (0-1)
     */
    getRelativeLuminance(r, g, b) {
        const sRGB = [r, g, b].map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
    }

    /**
     * Calculate luminance of a color (simple formula for speed)
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {number} Luminance value (0-255)
     */
    getLuminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
    }

    /**
     * Calculate contrast ratio between two colors (WCAG formula)
     * @param {Array} c1 - First color [r, g, b]
     * @param {Array} c2 - Second color [r, g, b]
     * @returns {number} Contrast ratio (1-21)
     */
    getContrastRatio(c1, c2) {
        const l1 = this.getRelativeLuminance(c1[0], c1[1], c1[2]);
        const l2 = this.getRelativeLuminance(c2[0], c2[1], c2[2]);
        const lighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (lighter + 0.05) / (darker + 0.05);
    }

    /**
     * Convert RGB to HSL for better color analysis
     * @param {number} r - Red (0-255)
     * @param {number} g - Green (0-255)
     * @param {number} b - Blue (0-255)
     * @returns {Array} [h, s, l] where h is 0-360, s and l are 0-1
     */
    rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
                case g: h = ((b - r) / d + 2) / 6; break;
                case b: h = ((r - g) / d + 4) / 6; break;
            }
        }
        return [h * 360, s, l];
    }

    /**
     * Quantize a color for grouping similar colors
     * Uses finer quantization (4) for grayscale colors to preserve subtle differences
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {string} Quantized color key
     */
    quantizeColor(r, g, b) {
        // Use finer quantization (4) for grayscale colors to preserve subtle differences
        // Use coarser quantization (8) for colored pixels
        if (this.isGrayscale(r, g, b)) {
            // For grayscale, use luminance-based quantization with fine precision
            const lum = Math.round(this.getLuminance(r, g, b) / 4) * 4;
            return `gray:${lum}`;
        } else {
            // For colored pixels, use standard RGB quantization
            return `${Math.round(r/8)*8},${Math.round(g/8)*8},${Math.round(b/8)*8}`;
        }
    }

    /**
     * ADOBE-LEVEL: Extract colors from PDF operator list
     * This reads the actual PDF graphics state operators (rg, RG, k, K, g, G, etc.)
     * Also tracks filled rectangles to detect background colors
     * @param {Object} operatorList - PDF.js operator list
     * @param {Array} textItems - Text content items
     * @returns {Object} Map of item index to color info
     */
    extractColorsFromOperatorList(operatorList, textItems) {
        const OPS = pdfjsLib.OPS;
        const colorState = {};
        
        // Current graphics state
        let currentFillColor = [0, 0, 0]; // Default black
        let currentStrokeColor = [0, 0, 0];
        
        // Track filled rectangles (potential backgrounds)
        const filledRects = [];
        let pendingRect = null;
        
        // Graphics state stack for save/restore
        const stateStack = [];
        
        // Track text positions for background matching
        const textPositions = textItems.map(item => ({
            x: item.transform[4],
            y: item.transform[5],
            width: item.width,
            height: Math.abs(item.transform[3]) || 12
        }));
        
        // Track text item index
        let textItemIndex = 0;
        
        const ops = operatorList.fnArray;
        const args = operatorList.argsArray;
        
        // First pass: collect all filled rectangles
        let tempFillColor = [0, 0, 0];
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            const opArgs = args[i];
            
            switch (op) {
                case OPS.setFillRGBColor:
                    if (opArgs && opArgs.length >= 3) {
                        tempFillColor = [
                            Math.round(opArgs[0] * 255),
                            Math.round(opArgs[1] * 255),
                            Math.round(opArgs[2] * 255)
                        ];
                    }
                    break;
                case OPS.setFillGray:
                    if (opArgs && opArgs.length >= 1) {
                        const gray = Math.round(opArgs[0] * 255);
                        tempFillColor = [gray, gray, gray];
                    }
                    break;
                case OPS.setFillCMYKColor:
                    if (opArgs && opArgs.length >= 4) {
                        const [c, m, y, k] = opArgs;
                        tempFillColor = [
                            Math.round(255 * (1 - c) * (1 - k)),
                            Math.round(255 * (1 - m) * (1 - k)),
                            Math.round(255 * (1 - y) * (1 - k))
                        ];
                    }
                    break;
                case OPS.rectangle:
                    if (opArgs && opArgs.length >= 4) {
                        pendingRect = {
                            x: opArgs[0],
                            y: opArgs[1],
                            width: opArgs[2],
                            height: opArgs[3],
                            color: [...tempFillColor]
                        };
                    }
                    break;
                case OPS.fill:
                case OPS.eoFill:
                case OPS.fillStroke:
                case OPS.eoFillStroke:
                    if (pendingRect) {
                        filledRects.push(pendingRect);
                        pendingRect = null;
                    }
                    break;
            }
        }
        
        console.log('[PDF-TextEditor] Found', filledRects.length, 'filled rectangles');
        
        // Second pass: extract text colors and match with backgrounds
        for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            const opArgs = args[i];
            
            switch (op) {
                case OPS.save:
                    stateStack.push({
                        fillColor: [...currentFillColor],
                        strokeColor: [...currentStrokeColor]
                    });
                    break;
                    
                case OPS.restore:
                    if (stateStack.length > 0) {
                        const state = stateStack.pop();
                        currentFillColor = state.fillColor;
                        currentStrokeColor = state.strokeColor;
                    }
                    break;
                    
                case OPS.setFillRGBColor:
                    if (opArgs && opArgs.length >= 3) {
                        currentFillColor = [
                            Math.round(opArgs[0] * 255),
                            Math.round(opArgs[1] * 255),
                            Math.round(opArgs[2] * 255)
                        ];
                    }
                    break;
                    
                case OPS.setStrokeRGBColor:
                    if (opArgs && opArgs.length >= 3) {
                        currentStrokeColor = [
                            Math.round(opArgs[0] * 255),
                            Math.round(opArgs[1] * 255),
                            Math.round(opArgs[2] * 255)
                        ];
                    }
                    break;
                    
                case OPS.setFillGray:
                    if (opArgs && opArgs.length >= 1) {
                        const gray = Math.round(opArgs[0] * 255);
                        currentFillColor = [gray, gray, gray];
                    }
                    break;
                    
                case OPS.setStrokeGray:
                    if (opArgs && opArgs.length >= 1) {
                        const gray = Math.round(opArgs[0] * 255);
                        currentStrokeColor = [gray, gray, gray];
                    }
                    break;
                    
                case OPS.setFillCMYKColor:
                    if (opArgs && opArgs.length >= 4) {
                        const [c, m, y, k] = opArgs;
                        currentFillColor = [
                            Math.round(255 * (1 - c) * (1 - k)),
                            Math.round(255 * (1 - m) * (1 - k)),
                            Math.round(255 * (1 - y) * (1 - k))
                        ];
                    }
                    break;
                    
                case OPS.setStrokeCMYKColor:
                    if (opArgs && opArgs.length >= 4) {
                        const [c, m, y, k] = opArgs;
                        currentStrokeColor = [
                            Math.round(255 * (1 - c) * (1 - k)),
                            Math.round(255 * (1 - m) * (1 - k)),
                            Math.round(255 * (1 - y) * (1 - k))
                        ];
                    }
                    break;
                    
                case OPS.showText:
                case OPS.showSpacedText:
                case OPS.nextLineShowText:
                case OPS.nextLineSetSpacingShowText:
                    if (textItemIndex < textItems.length) {
                        // Find background rectangle that contains this text
                        const textPos = textPositions[textItemIndex];
                        let bgColor = [255, 255, 255]; // Default white
                        
                        for (const rect of filledRects) {
                            // Check if text is inside this rectangle
                            // PDF coordinates: y increases upward
                            const rectTop = rect.y + rect.height;
                            const rectBottom = rect.y;
                            const rectLeft = rect.x;
                            const rectRight = rect.x + rect.width;
                            
                            if (textPos.x >= rectLeft - 5 &&
                                textPos.x <= rectRight + 5 &&
                                textPos.y >= rectBottom - 5 &&
                                textPos.y <= rectTop + 5) {
                                bgColor = rect.color;
                                break;
                            }
                        }
                        
                        colorState[textItemIndex] = {
                            fillColor: [...currentFillColor],
                            strokeColor: [...currentStrokeColor],
                            bgColor: bgColor
                        };
                        textItemIndex++;
                    }
                    break;
            }
        }
        
        // Fill remaining items with defaults
        for (let i = textItemIndex; i < textItems.length; i++) {
            if (!colorState[i]) {
                colorState[i] = {
                    fillColor: [0, 0, 0],
                    strokeColor: [0, 0, 0],
                    bgColor: [255, 255, 255]
                };
            }
        }
        
        console.log('[PDF-TextEditor] Extracted colors for', textItemIndex, 'text operations');
        
        return colorState;
    }

    /**
     * ADOBE-LEVEL: Sample text region colors using histogram analysis
     * This method samples the entire text bounding box and uses statistical
     * analysis to separate background from text colors
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} tx - Transform array
     * @param {number} width - Width in pixels
     * @param {number} fontHeight - Font height in pixels
     * @param {number} dpr - Device pixel ratio
     * @returns {Object} { background: [r,g,b], text: [r,g,b] }
     */
    sampleTextRegionColors(ctx, tx, width, fontHeight, dpr) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Coordinates in canvas pixels
        const x = tx[4] * dpr;
        const yBaseline = tx[5] * dpr;
        const h = fontHeight * dpr;
        const w = width * dpr;
        
        // Define sampling region with padding
        const padding = Math.max(2 * dpr, 4);
        const boxLeft = Math.max(0, Math.floor(x - padding));
        const boxTop = Math.max(0, Math.floor(yBaseline - h - padding));
        const boxRight = Math.min(canvasWidth, Math.floor(x + w + padding));
        const boxBottom = Math.min(canvasHeight, Math.floor(yBaseline + padding));
        const boxWidth = boxRight - boxLeft;
        const boxHeight = boxBottom - boxTop;
        
        if (boxWidth <= 0 || boxHeight <= 0) {
            return { background: [255, 255, 255], text: [0, 0, 0] };
        }
        
        try {
            const imageData = ctx.getImageData(boxLeft, boxTop, boxWidth, boxHeight).data;
            
            // Build color histogram - group by quantized color for better clustering
            const colorMap = new Map();
            let totalPixels = 0;
            
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i+1];
                const b = imageData[i+2];
                const a = imageData[i+3];
                
                if (a < 128) continue; // Skip transparent
                
                totalPixels++;
                
                // Quantize to reduce noise - group similar colors
                const qr = Math.round(r / 8) * 8;
                const qg = Math.round(g / 8) * 8;
                const qb = Math.round(b / 8) * 8;
                const key = `${qr},${qg},${qb}`;
                
                if (!colorMap.has(key)) {
                    colorMap.set(key, {
                        r: 0, g: 0, b: 0,
                        count: 0,
                        luminance: 0,
                        samples: []
                    });
                }
                const entry = colorMap.get(key);
                entry.r += r;
                entry.g += g;
                entry.b += b;
                entry.count++;
                entry.samples.push([r, g, b]);
            }
            
            if (colorMap.size === 0) {
                return { background: [255, 255, 255], text: [0, 0, 0] };
            }
            
            // Calculate average color and luminance for each cluster
            for (const [key, data] of colorMap) {
                data.r = Math.round(data.r / data.count);
                data.g = Math.round(data.g / data.count);
                data.b = Math.round(data.b / data.count);
                data.luminance = this.getLuminance(data.r, data.g, data.b);
            }
            
            // Sort colors by frequency
            const sortedColors = Array.from(colorMap.values()).sort((a, b) => b.count - a.count);
            
            // STRATEGY: The LIGHTEST color with significant count is the background
            // The DARKEST color with significant count is the text
            // This works for both white and gray backgrounds
            
            let bgCandidate = null;
            let textCandidate = null;
            let maxLuminance = -1;
            let minLuminance = 256;
            
            const minCountThreshold = totalPixels * 0.02; // At least 2% of pixels
            
            for (const color of sortedColors) {
                if (color.count < minCountThreshold) continue;
                
                // Track lightest (background)
                if (color.luminance > maxLuminance) {
                    maxLuminance = color.luminance;
                    bgCandidate = color;
                }
                
                // Track darkest (text)
                if (color.luminance < minLuminance) {
                    minLuminance = color.luminance;
                    textCandidate = color;
                }
            }
            
            // Fallback if no candidates found
            if (!bgCandidate) {
                bgCandidate = sortedColors[0];
            }
            if (!textCandidate) {
                textCandidate = bgCandidate.luminance > 128
                    ? { r: 0, g: 0, b: 0 }
                    : { r: 255, g: 255, b: 255 };
            }
            
            // If bg and text are the same, use contrasting color for text
            if (bgCandidate === textCandidate) {
                textCandidate = bgCandidate.luminance > 128
                    ? { r: 0, g: 0, b: 0 }
                    : { r: 255, g: 255, b: 255 };
            }
            
            // Check for colored text (saturation > 0.2)
            // If we find a saturated color, it's likely the text color
            for (const color of sortedColors) {
                if (color.count < minCountThreshold) continue;
                const [h, s, l] = this.rgbToHsl(color.r, color.g, color.b);
                if (s > 0.25 && color !== bgCandidate) {
                    textCandidate = color;
                    break;
                }
            }
            
            return {
                background: [bgCandidate.r, bgCandidate.g, bgCandidate.b],
                text: [textCandidate.r, textCandidate.g, textCandidate.b]
            };
            
        } catch (e) {
            console.error('[PDF-TextEditor] sampleTextRegionColors error:', e);
            return { background: [255, 255, 255], text: [0, 0, 0] };
        }
    }

    /**
     * Get smart background color by sampling INSIDE the text bounding box
     * Adobe-level precision: samples the lightest pixels inside the text area
     * which represent the background between/around text strokes
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} tx - Transform array [scaleX, skewY, skewX, scaleY, x, y]
     * @param {number} width - Width in pixels (already scaled)
     * @param {number} fontHeight - Font height in CSS pixels
     * @param {number} dpr - Device pixel ratio
     * @returns {Array|null} [r, g, b] or null if unable to sample
     */
    getSmartBackgroundColor(ctx, tx, width, fontHeight, dpr) {
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Coordinates in canvas pixels (already DPR-scaled from viewport transform)
        const x = tx[4] * dpr;
        const yBaseline = tx[5] * dpr;
        const height = fontHeight * dpr;
        const w = width * dpr;
        
        // Text box bounds
        const boxLeft = Math.max(0, Math.floor(x));
        const boxTop = Math.max(0, Math.floor(yBaseline - height));
        const boxWidth = Math.min(Math.floor(w), canvasWidth - boxLeft);
        const boxHeight = Math.min(Math.floor(height), canvasHeight - boxTop);
        
        if (boxWidth <= 0 || boxHeight <= 0) {
            return [255, 255, 255]; // Default white
        }

        try {
            // Sample the ENTIRE text bounding box
            const imageData = ctx.getImageData(boxLeft, boxTop, boxWidth, boxHeight).data;
            
            // Collect all pixels and find the LIGHTEST ones (background)
            // Text pixels are dark, background pixels are light
            const colorCounts = new Map();
            
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i+1];
                const b = imageData[i+2];
                const a = imageData[i+3];
                
                // Skip transparent pixels
                if (a < 200) continue;
                
                // Quantize for grouping
                const key = this.quantizeColor(r, g, b);
                
                if (!colorCounts.has(key)) {
                    colorCounts.set(key, { r: 0, g: 0, b: 0, count: 0, luminance: 0 });
                }
                
                const entry = colorCounts.get(key);
                entry.r += r;
                entry.g += g;
                entry.b += b;
                entry.count++;
                entry.luminance = this.getLuminance(r, g, b);
            }
            
            if (colorCounts.size === 0) {
                return [255, 255, 255];
            }
            
            // Find the LIGHTEST color with significant count
            // This is the background color (text is darker)
            let bestColor = null;
            let bestLuminance = -1;
            let bestCount = 0;
            
            for (const [key, data] of colorCounts) {
                const avgLum = this.getLuminance(
                    data.r / data.count,
                    data.g / data.count,
                    data.b / data.count
                );
                
                // Must have at least 5% of pixels to be considered background
                const minCount = (boxWidth * boxHeight) * 0.05;
                
                if (data.count >= minCount) {
                    // Prefer lighter colors (higher luminance = background)
                    if (avgLum > bestLuminance) {
                        bestLuminance = avgLum;
                        bestColor = data;
                        bestCount = data.count;
                    }
                }
            }
            
            if (bestColor && bestColor.count > 0) {
                return [
                    Math.round(bestColor.r / bestColor.count),
                    Math.round(bestColor.g / bestColor.count),
                    Math.round(bestColor.b / bestColor.count)
                ];
            }
            
            return [255, 255, 255];
            
        } catch (e) {
            return [255, 255, 255];
        }
    }

    /**
     * Get smart text color by sampling INSIDE the text bounding box
     * Adobe-level precision: uses contrast analysis, anti-aliasing detection, and weighted sampling
     * @param {CanvasRenderingContext2D} ctx
     * @param {Array} tx - Transform array
     * @param {number} width - Width in pixels (already scaled)
     * @param {number} fontHeight - Font height in CSS pixels
     * @param {number} dpr - Device pixel ratio
     * @param {Array} bgColor - Background color [r,g,b]
     * @returns {Array} [r, g, b] - detected text color
     */
    getSmartTextColor(ctx, tx, width, fontHeight, dpr, bgColor) {
        if (!bgColor) bgColor = [255, 255, 255];
        
        const canvasWidth = ctx.canvas.width;
        const canvasHeight = ctx.canvas.height;
        
        // Coordinates in canvas pixels
        const x = tx[4] * dpr;
        const yBaseline = tx[5] * dpr;
        const h = fontHeight * dpr;
        const w = width * dpr;
        
        // Define the text bounding box
        const boxLeft = Math.max(0, Math.floor(x));
        const boxTop = Math.max(0, Math.floor(yBaseline - h));
        const boxWidth = Math.min(Math.floor(w), canvasWidth - boxLeft);
        const boxHeight = Math.min(Math.floor(h), canvasHeight - boxTop);
        
        if (boxWidth <= 0 || boxHeight <= 0) {
            return this.getContrastingColor(bgColor);
        }

        try {
            const imageData = ctx.getImageData(boxLeft, boxTop, boxWidth, boxHeight).data;
            
            // ADOBE-LEVEL PRECISION: Collect ALL non-background pixels
            // Group by exact color (no quantization for initial collection)
            const exactColors = new Map();
            const bgLuminance = this.getLuminance(bgColor[0], bgColor[1], bgColor[2]);
            
            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i+1];
                const b = imageData[i+2];
                const a = imageData[i+3];

                // Skip transparent pixels
                if (a < 50) continue;
                
                // Skip pixels that are too similar to background
                const dr = r - bgColor[0];
                const dg = g - bgColor[1];
                const db = b - bgColor[2];
                const distSq = dr*dr + dg*dg + db*db;
                
                // Very low threshold - only skip if VERY close to background
                if (distSq < 50) continue;
                
                const key = `${r},${g},${b}`;
                if (!exactColors.has(key)) {
                    exactColors.set(key, { r, g, b, count: 0 });
                }
                exactColors.get(key).count++;
            }

            if (exactColors.size === 0) {
                return this.getContrastingColor(bgColor);
            }

            // Find the most frequent non-background color
            // This is the ACTUAL text color
            let bestColor = null;
            let bestCount = 0;
            let bestSaturation = 0;
            
            for (const [key, data] of exactColors) {
                const [h, s, l] = this.rgbToHsl(data.r, data.g, data.b);
                
                // Prioritize saturated colors (red, blue, etc.) over grayscale
                // If we find ANY saturated color with reasonable count, prefer it
                if (s > 0.2 && data.count > 5) {
                    if (s > bestSaturation || (s === bestSaturation && data.count > bestCount)) {
                        bestColor = data;
                        bestCount = data.count;
                        bestSaturation = s;
                    }
                }
                // For grayscale, just use frequency
                else if (bestSaturation < 0.2 && data.count > bestCount) {
                    bestColor = data;
                    bestCount = data.count;
                }
            }

            if (bestColor) {
                return [bestColor.r, bestColor.g, bestColor.b];
            }

            return this.getContrastingColor(bgColor);
            
        } catch (e) {
            return this.getContrastingColor(bgColor);
        }
    }

    /**
     * Get a contrasting color for the given background
     * @param {Array} bgColor - Background color [r, g, b]
     * @returns {Array} Contrasting color [r, g, b]
     */
    getContrastingColor(bgColor) {
        const bgLuminance = this.getLuminance(bgColor[0], bgColor[1], bgColor[2]);
        return bgLuminance > 128 ? [0, 0, 0] : [255, 255, 255];
    }

    /**
     * Check if two colors are similar
     * For grayscale colors, uses luminance-based comparison with tighter threshold
     * @param {Array} c1 - First color [r, g, b]
     * @param {Array} c2 - Second color [r, g, b]
     * @returns {boolean} True if colors are similar
     */
    areColorsSimilar(c1, c2) {
        if (!c1 || !c2) return true;
        
        // For grayscale colors, use luminance-based comparison
        if (this.isGrayscale(c1[0], c1[1], c1[2]) && this.isGrayscale(c2[0], c2[1], c2[2])) {
            const lum1 = this.getLuminance(c1[0], c1[1], c1[2]);
            const lum2 = this.getLuminance(c2[0], c2[1], c2[2]);
            // Two grays with luminance difference > 20 should be considered different
            return Math.abs(lum1 - lum2) < 20;
        }
        
        // For colored pixels, use RGB distance
        const dr = c1[0] - c2[0];
        const dg = c1[1] - c2[1];
        const db = c1[2] - c2[2];
        return (dr*dr + dg*dg + db*db) < 1000; // Tolerance ~30
    }

    /**
     * Get CSS font family stack from PDF font name
     * @param {string} fontName
     * @returns {string}
     */
    getFontFamily(fontName) {
        if (!fontName) return 'sans-serif';
        
        // Remove subset tag (e.g., ABCDEF+Arial)
        let cleanName = fontName;
        if (cleanName.includes('+')) {
            cleanName = cleanName.split('+')[1];
        }
        
        // Normalize: lowercase and remove spaces/dashes for matching
        const lower = cleanName.toLowerCase().replace(/[\s-]/g, '');
        
        // 1. Direct Mapping (Fastest)
        if (FONT_MAPPINGS[lower]) {
            return FONT_MAPPINGS[lower];
        }
        
        // 2. Fuzzy Matching with Keywords (Iterate through map keys)
        // This helps match variations like "Arial-BoldMT" or "TimesNewRomanPSMT"
        for (const key in FONT_MAPPINGS) {
            if (lower.includes(key)) {
                return FONT_MAPPINGS[key];
            }
        }

        // 3. Generic Fallbacks based on keywords
        
        // Sans-serif indicators (Check first to avoid matching "serif" in "sans-serif")
        if (lower.includes('sans') ||
            lower.includes('arial') ||
            lower.includes('helv') ||
            lower.includes('gothic') ||
            lower.includes('grotesque') ||
            lower.includes('swiss')) {
            return '"Helvetica", "Arial", sans-serif';
        }

        // Serif indicators
        if (lower.includes('serif') ||
            lower.includes('roman') ||
            lower.includes('baskerville') ||
            lower.includes('century') ||
            lower.includes('goudy') ||
            lower.includes('minion')) {
            return '"Times New Roman", "Times", serif';
        }

        // Monospace indicators
        if (lower.includes('mono') ||
            lower.includes('courier') ||
            lower.includes('code') ||
            lower.includes('typewriter') ||
            lower.includes('terminal') ||
            lower.includes('console')) {
            return '"Courier New", "Courier", monospace';
        }

        // Script/Handwriting
        if (lower.includes('script') ||
            lower.includes('hand') ||
            lower.includes('cursive') ||
            lower.includes('brush')) {
            return '"Comic Sans MS", "Comic Sans", cursive';
        }

        // Display/Black/Heavy
        if (lower.includes('display') ||
            lower.includes('black') ||
            lower.includes('impact') ||
            lower.includes('poster')) {
            return '"Impact", "Arial Black", sans-serif';
        }

        // 4. Default Fallback
        return 'sans-serif';
    }

    /**
     * Analyze font weight from PDF font name and metrics
     * Adobe-level precision for bold detection
     * @param {string} fontName - PDF font name
     * @param {Object} style - Font style from PDF.js
     * @returns {Object} { isBold: boolean, weight: number }
     */
    analyzeFontWeight(fontName, style) {
        // Check style metrics FIRST - they are often more reliable than the name
        if (style) {
            // Some PDFs encode weight in the font descriptor
            if (style.fontWeight) {
                const w = parseInt(style.fontWeight);
                if (!isNaN(w)) {
                    return { isBold: w >= 600, weight: w };
                }
                // Handle string values like 'bold'
                if (typeof style.fontWeight === 'string') {
                    const lowerWeight = style.fontWeight.toLowerCase();
                    if (lowerWeight === 'bold' || lowerWeight === 'bolder') {
                        return { isBold: true, weight: 700 };
                    }
                }
            }
            
            // Check for bold flag in style object
            if (style.bold || style.isBold) {
                return { isBold: true, weight: 700 };
            }
            
            // Check vertical flag (PDF.js uses this for some fonts)
            if (style.vertical === false && style.ascent && style.descent) {
                // Some heuristics based on font metrics
            }
        }

        if (!fontName) return { isBold: false, weight: 400 };
        
        const lower = fontName.toLowerCase();
        
        // Explicit weight indicators (most reliable)
        // Order matters! Check specific variations (SemiBold, ExtraBold) before generic Bold
        const weightPatterns = [
            { pattern: /(ultrabold|extrabold|ultra\s*bold|extra\s*bold)/i, weight: 800, isBold: true },
            { pattern: /(semibold|semi\s*bold|demibold|demi\s*bold|demi)/i, weight: 600, isBold: true },
            { pattern: /(black|heavy|ultra)/i, weight: 900, isBold: true },
            { pattern: /(bold|bd|,bold|\.bold|-bold|_bold)/i, weight: 700, isBold: true },
            { pattern: /(medium|med)/i, weight: 500, isBold: false },
            { pattern: /(extralight|ultra\s*light)/i, weight: 200, isBold: false },
            { pattern: /(light|lt)/i, weight: 300, isBold: false },
            { pattern: /(thin|hairline)/i, weight: 100, isBold: false },
        ];
        
        for (const { pattern, weight, isBold } of weightPatterns) {
            if (pattern.test(lower)) {
                return { isBold, weight };
            }
        }
        
        // Check for common bold font naming conventions
        // Many PDFs use font names like "ABCDEF+FontName,Bold" or "FontName-Bold"
        if (lower.includes(',bold') || lower.includes('-bold') || lower.includes('_bold') ||
            lower.endsWith('bold') || lower.includes('bold,') || lower.includes('bold-')) {
            return { isBold: true, weight: 700 };
        }
        
        // Check for "B" suffix which sometimes indicates bold (e.g., "ArialB", "HelveticaB")
        if (/[a-z]b$/i.test(fontName) || /[a-z]-b$/i.test(fontName)) {
            return { isBold: true, weight: 700 };
        }
        
        return { isBold: false, weight: 400 };
    }

    /**
     * Analyze font style (italic/oblique) from PDF font name and style object
     * @param {string} fontName - PDF font name
     * @param {Object} style - Font style from PDF.js
     * @returns {Object} { isItalic: boolean, style: string }
     */
    analyzeFontStyle(fontName, style) {
        // Check style object first if available
        if (style) {
            if (style.italic || style.isItalic) {
                return { isItalic: true, style: 'italic' };
            }
            // Check for oblique/italic in font family name from style
            if (style.fontFamily) {
                const lowerFamily = style.fontFamily.toLowerCase();
                if (lowerFamily.includes('italic') || lowerFamily.includes('oblique')) {
                    return { isItalic: true, style: 'italic' };
                }
            }
        }

        if (!fontName) return { isItalic: false, style: 'normal' };
        
        const lower = fontName.toLowerCase();
        
        const italicPatterns = [
            /(italic|ital|it)/i,
            /(oblique|obl|slanted|inclined)/i,
            /-it/i,
            /ita$/i,
        ];
        
        for (const pattern of italicPatterns) {
            if (pattern.test(lower)) {
                return { isItalic: true, style: 'italic' };
            }
        }
        
        return { isItalic: false, style: 'normal' };
    }

    /**
     * Process text items WITHOUT merging
     * Adobe Acrobat DC approach: Each text item is kept separate for precise editing
     * Only adds font style information
     * @param {Array} items
     * @param {Object} styles - Font styles from PDF.js
     * @returns {Array}
     */
    mergeTextItems(items, styles = {}) {
        // Filter empty items - keep items with at least some content
        const validItems = items.filter(item => item.str && item.str.length > 0);
        
        if (validItems.length === 0) return [];

        // Process each item individually - NO MERGING
        // This matches Adobe Acrobat DC behavior where each text run is editable separately
        validItems.forEach((item, idx) => {
            if (item.fontName) {
                let fontName = item.fontName;
                let fontFamily = null;
                const style = styles[item.fontName];
                
                // Check styles for real font name
                if (style && style.fontFamily) {
                    fontFamily = style.fontFamily;
                }

                // Analyze weight (bold detection)
                const weightInfo = this.analyzeFontWeight(fontName, style);
                item.isBold = weightInfo.isBold;
                item.fontWeight = weightInfo.weight;

                // Analyze style (italic detection)
                const styleInfo = this.analyzeFontStyle(fontName, style);
                item.isItalic = styleInfo.isItalic;
                item.fontStyle = styleInfo.style;

                // Get font family with fallbacks
                item.fontFamily = this.getFontFamily(fontFamily || fontName);
                
                // DEBUG: Log font info for first few items
                if (idx < 5) {
                    console.log(`[PDF-TextEditor] Font: "${fontName}" | Bold: ${item.isBold} (${item.fontWeight}) | Italic: ${item.isItalic} | Style obj:`, style);
                }
            }
        });

        // Merge adjacent items that are visually part of the same line and style
        // This fixes the issue where a sentence is split into multiple small boxes
        const merged = [];
        let current = null;

        validItems.forEach(item => {
            if (!current) {
                current = { ...item };
                return;
            }

            // Check if items are on the same line (similar Y position)
            const sameLine = Math.abs(item.transform[5] - current.transform[5]) < 5;
            
            // Check if items are adjacent horizontally
            const currentWidth = current.width;
            const gap = item.transform[4] - (current.transform[4] + currentWidth);
            // Allow larger gap for spaces (up to 50px)
            const isAdjacent = gap > -5 && gap < 50;

            if (sameLine && isAdjacent) {
                // Merge
                current.str += item.str;
                current.width += item.width + gap;
                
                // ADOBE-LEVEL PRECISION: Style Inheritance Strategy
                // When merging mixed styles (e.g. "Article" + "Garantie"), we must decide which style wins.
                // Strategy: "Rich" styles (Bold, Italic, Color) always win over "Plain" styles.
                
                // 1. Font Weight (Bold wins)
                if (item.isBold || item.fontWeight > current.fontWeight) {
                    current.isBold = true;
                    current.fontWeight = Math.max(current.fontWeight || 400, item.fontWeight || 700);
                }

                // 2. Font Style (Italic wins)
                if (item.isItalic || item.fontStyle === 'italic') {
                    current.isItalic = true;
                    current.fontStyle = 'italic';
                }

                // 3. Text Color (Saturated/Colored wins over Black/Gray)
                if (item.color && current.color) {
                    const [h1, s1, l1] = this.rgbToHsl(item.color[0], item.color[1], item.color[2]);
                    const [h2, s2, l2] = this.rgbToHsl(current.color[0], current.color[1], current.color[2]);
                    
                    // If new item is significantly more saturated, take its color
                    if (s1 > s2 + 0.1) {
                        current.color = item.color;
                    }
                    // If saturations are similar, but new item is darker (and not black), prefer it
                    // This helps with dark red vs black
                    else if (Math.abs(s1 - s2) < 0.1 && l1 < l2 && l1 > 0.1) {
                        current.color = item.color;
                    }
                }

                // 4. Background Color (Darker/Colored wins over White)
                if (item.bgColor && current.bgColor) {
                    const itemBgLum = this.getLuminance(item.bgColor[0], item.bgColor[1], item.bgColor[2]);
                    const currentBgLum = this.getLuminance(current.bgColor[0], current.bgColor[1], current.bgColor[2]);
                    
                    // If item has a darker background (e.g. gray vs white), use it
                    if (itemBgLum < 250 && itemBgLum < currentBgLum) {
                        current.bgColor = item.bgColor;
                    }
                }
                
            } else {
                merged.push(current);
                current = { ...item };
            }
        });

        if (current) {
            merged.push(current);
        }

        return merged;
    }

    /**
     * Render text layer for a page
     * @param {number} pageNum
     * @param {boolean} force - Force re-render
     */
    async renderTextLayer(pageNum, force = false) {
        console.log('[PDF-TextEditor] renderTextLayer: page=' + pageNum + ', force=' + force + ', start');
        if (!this.viewer.pdfDoc || !this.isActive) return;

        // Check if already exists
        const wrapper = this.viewer.pageWrappers[pageNum];
        if (!wrapper) return;
        
        const existingLayer = wrapper.querySelector('.pdf-text-layer');
        if (existingLayer && !force) {
            console.log('[PDF-TextEditor] renderTextLayer: page=' + pageNum + ', already rendered, skipping');
            return; // Already rendered
        }

        const page = await this.viewer.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Use scale 1.0 for the viewport because the container is sized at scale 1.0
        // and then zoomed via CSS transform.
        const viewport = page.getViewport({ scale: 1.0, rotation: this.viewer.rotation });
        
        // Create text layer div
        const textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        // Allow pointer events to pass through the layer (for zoom/scroll)
        textLayer.style.pointerEvents = 'none';
        
        // Process text items
        const styles = textContent.styles;

        // HYBRID APPROACH: Combine operator list extraction + canvas sampling
        // This ensures maximum accuracy across different PDF types
        
        const canvas = wrapper.querySelector('canvas');
        let ctx = null;
        let canvasViewport = null;
        const dpr = window.devicePixelRatio || 1;
        
        if (canvas) {
            ctx = canvas.getContext('2d', { willReadFrequently: true });
            const renderScale = this.viewer.baseRenderScale || 2.0;
            const canvasScale = renderScale * dpr;
            canvasViewport = page.getViewport({ scale: canvasScale, rotation: this.viewer.rotation });
        }
        
        // Step 1: Try to extract colors from operator list
        let operatorColors = {};
        try {
            const operatorList = await page.getOperatorList();
            operatorColors = this.extractColorsFromOperatorList(operatorList, textContent.items);
        } catch (e) {
            console.warn('[PDF-TextEditor] Operator list extraction failed:', e);
        }
        
        // Step 2: For each text item, use hybrid detection
        textContent.items.forEach((item, idx) => {
            if (!item.str.trim()) return;
            
            // Method 1: Operator list colors
            const opColors = operatorColors[idx];
            
            // Method 2: Canvas sampling
            let canvasColors = null;
            if (ctx && canvasViewport) {
                try {
                    const tx = pdfjsLib.Util.transform(
                        canvasViewport.transform,
                        item.transform
                    );
                    const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
                    const scaleX = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]));
                    const pixelWidth = item.width * scaleX;
                    canvasColors = this.sampleTextRegionColors(ctx, tx, pixelWidth, fontHeight, dpr);
                } catch (e) {
                    // Ignore sampling errors
                }
            }
            
            // HYBRID DECISION: Choose the best color source
            // Priority:
            // 1. If operator list has non-default colors, use them
            // 2. If canvas sampling found non-white background, use it
            // 3. Default to operator list or fallback
            
            let finalTextColor = [0, 0, 0];
            let finalBgColor = [255, 255, 255];
            
            // Check operator colors
            if (opColors) {
                const opFill = opColors.fillColor;
                const opBg = opColors.bgColor;
                
                // Use operator fill color if it's not default black
                if (opFill && !(opFill[0] === 0 && opFill[1] === 0 && opFill[2] === 0)) {
                    finalTextColor = opFill;
                } else if (opFill) {
                    finalTextColor = opFill;
                }
                
                // Use operator bg color if it's not default white
                if (opBg && !(opBg[0] === 255 && opBg[1] === 255 && opBg[2] === 255)) {
                    finalBgColor = opBg;
                }
            }
            
            // Check canvas colors - override if they found something interesting
            if (canvasColors) {
                const canvasBg = canvasColors.background;
                const canvasText = canvasColors.text;
                
                // If canvas found a non-white background, prefer it
                // (operator list often misses background rectangles)
                if (canvasBg && !(canvasBg[0] > 250 && canvasBg[1] > 250 && canvasBg[2] > 250)) {
                    finalBgColor = canvasBg;
                }
                
                // If canvas found a colored text (not black), prefer it
                const [h, s, l] = this.rgbToHsl(canvasText[0], canvasText[1], canvasText[2]);
                if (s > 0.2) {
                    finalTextColor = canvasText;
                }
            }
            
            item.color = finalTextColor;
            item.bgColor = finalBgColor;
        });

        const mergedItems = this.mergeTextItems(textContent.items, styles);

        mergedItems.forEach((item, index) => {
            // Use the viewport transform (scale 1.0) to convert PDF coordinates to CSS coordinates
            const tx = pdfjsLib.Util.transform(
                viewport.transform,
                item.transform
            );

            // Calculate font metrics from transform matrix
            // tx = [scaleX, skewY, skewX, scaleY, translateX, translateY]
            const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
            
            // Calculate the actual pixel width of the text
            // item.width is in PDF units.
            // Since we are at scale 1.0, 1 PDF unit = 1 CSS pixel (roughly, depending on user unit)
            // But we must account for the font scaling in the transform matrix.
            // Actually, item.width is usually in unscaled text space units?
            // No, PDF.js normalizes item.width to be consistent with the viewport scale.
            // So at scale 1.0, item.width should be the width in CSS pixels.
            const pixelWidth = item.width;

            // Create element
            const el = document.createElement('div');
            el.className = 'pdf-text-item';
            el.textContent = item.str;
            el.dataset.originalText = item.str;
            el.dataset.id = `page-${pageNum}-item-${index}`;
            el.dataset.pageNum = pageNum;
            
            // Store color info
            if (item.color) {
                el.dataset.color = JSON.stringify(item.color);
            }
            if (item.bgColor) {
                el.dataset.bgColor = JSON.stringify(item.bgColor);
            }

            // Check for pending changes
            if (this.changes.has(pageNum) && this.changes.get(pageNum).has(el.dataset.id)) {
                const change = this.changes.get(pageNum).get(el.dataset.id);
                el.textContent = change.newText;
                el.classList.add('modified');
                
                // Use stored color or black
                if (change.color) {
                    el.style.color = `rgb(${change.color[0]}, ${change.color[1]}, ${change.color[2]})`;
                } else if (item.color) {
                    el.style.color = `rgb(${item.color[0]}, ${item.color[1]}, ${item.color[2]})`;
                } else {
                    el.style.color = 'black';
                }
                
                if (el.dataset.bgColor) {
                    const bg = JSON.parse(el.dataset.bgColor);
                    el.style.backgroundColor = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
                } else {
                    el.style.backgroundColor = 'white';
                }
            }

            // Store original transform info for saving
            el.dataset.pdfTransform = JSON.stringify(item.transform);
            el.dataset.width = item.width;
            el.dataset.height = item.height;
            el.dataset.fontName = item.fontName;

            // Apply font weight with numeric value for precision
            // Force bold if detected, even if weight is missing
            if (item.isBold || item.fontWeight > 400) {
                // If isBold is true but weight is low/missing, force 700
                const weight = (item.fontWeight && item.fontWeight >= 600) ? item.fontWeight : 700;
                el.style.fontWeight = weight.toString();
                el.dataset.fontWeight = weight.toString();
                el.dataset.isBold = 'true';
            } else {
                el.style.fontWeight = '400';
                el.dataset.fontWeight = '400';
            }

            // Apply font style
            // Force italic if detected
            if (item.isItalic || item.fontStyle === 'italic') {
                el.style.fontStyle = 'italic';
                el.dataset.fontStyle = 'italic';
                el.dataset.isItalic = 'true';
            } else {
                el.style.fontStyle = 'normal';
                el.dataset.fontStyle = 'normal';
            }

            // Position and size
            // Calculate angle
            const angle = Math.atan2(tx[1], tx[0]);
            const degree = angle * (180 / Math.PI);

            el.style.left = `${tx[4]}px`;
            // Adjust top position to account for font descent and ascenders
            // Use a moderate buffer to cover original text without excessive overlap
            // We need to balance coverage with precision
            const paddingV = fontHeight * 0.1;
            const topOffset = fontHeight * 1.1;
            
            el.style.top = `${tx[5] - topOffset}px`;
            el.style.paddingTop = `${paddingV}px`;
            el.style.paddingBottom = `${paddingV}px`;
            
            // Set explicit width to match PDF text width exactly
            // Add a small buffer to width to prevent horizontal clipping of italic/wide chars
            el.style.width = `${pixelWidth + (fontHeight * 0.2)}px`;
            el.style.paddingLeft = `${fontHeight * 0.1}px`;
            el.style.paddingRight = `${fontHeight * 0.1}px`;
            // Adjust left position to account for padding
            el.style.left = `${tx[4] - (fontHeight * 0.1)}px`;
            
            // Height includes padding (box-sizing: border-box)
            // Content height = 1.2H - 0.1H - 0.1H = 1.0H (matches original)
            el.style.minHeight = `${fontHeight * 1.2}px`;
            el.style.height = 'auto';
            
            el.style.fontSize = `${fontHeight}px`;
            el.style.lineHeight = `${fontHeight}px`;
            
            // Use detected font family or fallback to style map or default
            const finalFontFamily = item.fontFamily || (styles[item.fontName] ? styles[item.fontName].fontFamily : 'sans-serif');
            el.style.fontFamily = finalFontFamily;
            el.dataset.fontFamily = finalFontFamily;
            
            // Ensure text doesn't overflow and scales to fit
            el.style.overflow = 'hidden';
            el.style.whiteSpace = 'nowrap';
            
            // Standard block display for better text flow and alignment
            el.style.display = 'block';

            if (degree !== 0) {
                el.style.transform = `rotate(${degree}deg)`;
                el.style.transformOrigin = 'left bottom';
            }
            
            // Interaction
            el.addEventListener('click', (e) => this.handleTextClick(e, el));
            el.addEventListener('blur', (e) => this.handleTextBlur(e, el));
            el.addEventListener('keydown', (e) => this.handleKeyDown(e, el));
            
            // Re-enable pointer events for the text item
            el.style.pointerEvents = 'auto';

            textLayer.appendChild(el);
        });

        // Swap layers
        if (existingLayer) {
            existingLayer.remove();
        }
        wrapper.appendChild(textLayer);
        console.log('[PDF-TextEditor] renderTextLayer: page=' + pageNum + ', complete');
    }

    /**
     * Handle click on text item
     * @param {Event} e 
     * @param {HTMLElement} el 
     */
    handleTextClick(e, el) {
        if (!this.isActive) return;
        e.stopPropagation();

        if (this.activeElement && this.activeElement !== el) {
            this.activeElement.blur();
        }

        this.activeElement = el;
        this.previousText = el.textContent; // Store original text before edit
        el.contentEditable = true;
        el.classList.add('editing');
        
        // Apply text color
        if (el.dataset.color) {
            const c = JSON.parse(el.dataset.color);
            el.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
        } else {
            el.style.color = 'black';
        }

        // Ensure font weight is preserved during edit
        if (el.dataset.fontWeight) {
            el.style.fontWeight = el.dataset.fontWeight;
        }

        // Apply background color to hide underlying text while editing
        if (el.dataset.bgColor) {
            const bg = JSON.parse(el.dataset.bgColor);
            el.style.backgroundColor = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
        } else {
            el.style.backgroundColor = 'white';
        }
        
        el.focus();
    }

    /**
     * Handle blur (focus lost) on text item
     * @param {Event} e 
     * @param {HTMLElement} el 
     */
    async handleTextBlur(e, el) {
        el.contentEditable = false;
        this.activeElement = null;

        const newText = el.textContent;
        // Check against previous text (what it was when we clicked)
        // to determine if a new change occurred
        if (this.previousText !== null && newText !== this.previousText) {
            this.recordChange(el, newText, this.previousText);
        }
        
        el.classList.remove('editing');

        // Update visual state based on whether text differs from original
        if (newText !== el.dataset.originalText) {
            el.classList.add('modified');
            
            if (el.dataset.color) {
                const c = JSON.parse(el.dataset.color);
                el.style.color = `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
            } else {
                el.style.color = 'black';
            }

            if (el.dataset.bgColor) {
                const bg = JSON.parse(el.dataset.bgColor);
                el.style.backgroundColor = `rgb(${bg[0]}, ${bg[1]}, ${bg[2]})`;
            } else {
                el.style.backgroundColor = 'white';
            }
        } else {
            el.classList.remove('modified');
            el.style.backgroundColor = '';
            el.style.color = '';
        }
        
        this.previousText = null;
    }

    /**
     * Handle key down
     * @param {Event} e
     * @param {HTMLElement} el
     */
    async handleKeyDown(e, el) {
        if (e.key === 'Enter') {
            e.preventDefault();
            el.blur();
            // Blur will trigger handleTextBlur which handles the preview update
        }
    }

    /**
     * Handle global key down for shortcuts
     * @param {KeyboardEvent} e
     */
    handleGlobalKeyDown(e) {
        if (!this.isActive) return;

        // Check for Ctrl+Z (Undo)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        }
        // Check for Ctrl+Y or Ctrl+Shift+Z (Redo)
        else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
        }
    }

    /**
     * Record a change
     * @param {HTMLElement} el 
     * @param {string} newText 
     */
    recordChange(el, newText, oldText = null) {
        const pageNum = parseInt(el.dataset.pageNum);
        const id = el.dataset.id;
        
        // Add to history
        this.history.push({
            type: 'text-edit',
            id: id,
            pageNum: pageNum,
            oldText: oldText !== null ? oldText : el.dataset.originalText,
            newText: newText
        });
        
        // Clear redo stack on new change
        this.redoStack = [];

        this.updateChangesMap(el, newText);
    }

    updateChangesMap(el, newText) {
        const pageNum = parseInt(el.dataset.pageNum);
        const id = el.dataset.id;
        const originalText = el.dataset.originalText;

        if (!this.changes.has(pageNum)) {
            this.changes.set(pageNum, new Map());
        }

        // If reverted to original, remove from changes map
        if (newText === originalText) {
            this.changes.get(pageNum).delete(id);
            if (this.changes.get(pageNum).size === 0) {
                this.changes.delete(pageNum);
            }
        } else {
            // Parse font weight - handle both numeric and string values
            let fontWeight = 400;
            if (el.dataset.fontWeight) {
                const parsed = parseInt(el.dataset.fontWeight);
                fontWeight = isNaN(parsed) ? (el.dataset.fontWeight === 'bold' ? 700 : 400) : parsed;
            }
            
            this.changes.get(pageNum).set(id, {
                id: id,
                pageNum: pageNum,
                originalText: originalText,
                newText: newText,
                transform: JSON.parse(el.dataset.pdfTransform),
                width: parseFloat(el.dataset.width),
                height: parseFloat(el.dataset.height),
                fontName: el.dataset.fontName,
                fontFamily: el.dataset.fontFamily,
                fontWeight: fontWeight,
                isBold: el.dataset.isBold === 'true' || fontWeight >= 600,
                isItalic: el.dataset.isItalic === 'true' || el.dataset.fontStyle === 'italic',
                bgColor: el.dataset.bgColor ? JSON.parse(el.dataset.bgColor) : null,
                color: el.dataset.color ? JSON.parse(el.dataset.color) : null
            });
        }
    }

    /**
     * Check if there are unsaved changes
     */
    async undo() {
        if (this.history.length === 0) return;

        const action = this.history.pop();
        this.redoStack.push(action);

        await this.applyAction(action, true);
    }

    async redo() {
        if (this.redoStack.length === 0) return;

        const action = this.redoStack.pop();
        this.history.push(action);

        await this.applyAction(action, false);
    }

    async applyAction(action, isUndo) {
        const targetText = isUndo ? action.oldText : action.newText;
        
        // Find element
        // Note: If preview was refreshed, DOM elements are new.
        // We need to find by ID.
        const selector = `.pdf-text-item[data-id="${action.id}"]`;
        const el = document.querySelector(selector);
        
        if (el) {
            el.textContent = targetText;
            this.updateChangesMap(el, targetText);
        } else {
            console.warn(`Could not find element for undo/redo: ${action.id}`);
        }
    }

    hasChanges() {
        return this.changes.size > 0;
    }

    /**
     * Clear pending changes
     */
    clearPendingChanges() {
        this.changes.clear();
    }

    /**
     * Render language selector (placeholder for now as requested by interface)
     */
    renderLanguageSelector(container) {
        container.innerHTML = `
            <div class="text-editor-properties">
                <div class="text-editor-prop-group">
                    <p style="font-size: 12px; color: #666;">
                        Cliquez sur le texte pour le modifier. Les modifications seront enregistrées lors de la sauvegarde du document.
                    </p>
                </div>
            </div>
        `;
    }

    /**
     * Determine PDF font family from CSS font family
     * @param {string} cssFamily - CSS font family string
     * @returns {string} PDF font family key
     */
    getPdfFontFamily(cssFamily) {
        if (!cssFamily) return 'sans-serif';
        
        const lower = cssFamily.toLowerCase();
        
        // Check for monospace indicators
        if (lower.includes('monospace') ||
            lower.includes('courier') ||
            lower.includes('console') ||
            lower.includes('mono')) {
            return 'monospace';
        }
        
        // Check for serif (but not sans-serif)
        if ((lower.includes('serif') && !lower.includes('sans-serif')) ||
            lower.includes('times') ||
            lower.includes('georgia') ||
            lower.includes('garamond') ||
            lower.includes('palatino') ||
            lower.includes('baskerville')) {
            return 'serif';
        }
        
        // Default to sans-serif
        return 'sans-serif';
    }

    /**
     * Apply changes to PDF using pdf-lib
     * Adobe-level precision for text replacement
     * @param {PDFDocument} pdfDoc
     */
    async applyChangesToPdf(pdfDoc) {
        const pages = pdfDoc.getPages();
        const { rgb, StandardFonts } = PDFLib;

        // Embed standard fonts with all variants
        const fonts = {
            'sans-serif': {
                regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
                bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
                italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
                boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
            },
            'serif': {
                regular: await pdfDoc.embedFont(StandardFonts.TimesRoman),
                bold: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
                italic: await pdfDoc.embedFont(StandardFonts.TimesRomanItalic),
                boldItalic: await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic),
            },
            'monospace': {
                regular: await pdfDoc.embedFont(StandardFonts.Courier),
                bold: await pdfDoc.embedFont(StandardFonts.CourierBold),
                italic: await pdfDoc.embedFont(StandardFonts.CourierOblique),
                boldItalic: await pdfDoc.embedFont(StandardFonts.CourierBoldOblique),
            }
        };

        for (const [pageNum, pageChanges] of this.changes) {
            const page = pages[pageNum - 1]; // 0-indexed
            const { width: pageWidth, height: pageHeight } = page.getSize();

            for (const change of pageChanges.values()) {
                // Extract transform components
                const [scaleX, skewY, skewX, scaleY, x, y] = change.transform;
                
                // Calculate rotation angle
                const angleRad = Math.atan2(skewY, scaleX);
                const angleDeg = angleRad * (180 / Math.PI);
                
                // Calculate font size from transform matrix
                const fontSize = Math.sqrt((scaleX * scaleX) + (skewY * skewY));
                
                // Calculate text width more accurately
                // Use the stored width or estimate from font metrics
                const textWidth = change.width || (fontSize * change.originalText.length * 0.5);
                
                // Determine background color for redaction
                let redactionColor = rgb(1, 1, 1); // Default white
                if (change.bgColor) {
                    redactionColor = rgb(
                        change.bgColor[0] / 255,
                        change.bgColor[1] / 255,
                        change.bgColor[2] / 255
                    );
                }

                // Calculate precise redaction rectangle
                // Account for font metrics: ascender, descender, and line height
                const ascenderRatio = 0.8;  // Typical ascender height ratio
                const descenderRatio = 0.2; // Typical descender depth ratio
                const paddingX = fontSize * 0.05; // Minimal horizontal padding
                const paddingY = fontSize * 0.1;  // Vertical padding for anti-aliasing
                
                const rectX = x - paddingX;
                const rectY = y - (fontSize * descenderRatio) - paddingY;
                const rectWidth = textWidth + (paddingX * 2);
                const rectHeight = fontSize * (ascenderRatio + descenderRatio) + (paddingY * 2);
                
                // Draw redaction rectangle
                page.drawRectangle({
                    x: rectX,
                    y: rectY,
                    width: rectWidth,
                    height: rectHeight,
                    rotate: PDFLib.degrees(angleDeg),
                    color: redactionColor,
                    borderWidth: 0,
                });

                // Determine text color
                let textColor = rgb(0, 0, 0); // Default black
                if (change.color) {
                    textColor = rgb(
                        change.color[0] / 255,
                        change.color[1] / 255,
                        change.color[2] / 255
                    );
                }

                // Select appropriate font variant
                const pdfFontFamily = this.getPdfFontFamily(change.fontFamily);
                const isBold = change.isBold || (change.fontWeight && change.fontWeight >= 600);
                const isItalic = change.isItalic;
                
                let selectedFont;
                const fontSet = fonts[pdfFontFamily];
                
                if (isBold && isItalic) {
                    selectedFont = fontSet.boldItalic;
                } else if (isBold) {
                    selectedFont = fontSet.bold;
                } else if (isItalic) {
                    selectedFont = fontSet.italic;
                } else {
                    selectedFont = fontSet.regular;
                }

                // Draw the new text
                page.drawText(change.newText, {
                    x: x,
                    y: y,
                    size: fontSize,
                    font: selectedFont,
                    color: textColor,
                    rotate: PDFLib.degrees(angleDeg),
                });
            }
        }
    }

    /**
     * Destroy/Cleanup
     */
    async destroy() {
        this.stop();
        this.changes.clear();
    }
}

// Export
if (typeof window !== 'undefined') {
    window.PdfTextEditor = PdfTextEditor;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PdfTextEditor;
}
