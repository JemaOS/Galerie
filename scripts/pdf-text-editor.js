/*
 * Copyright (C) 2025 Jema Technology
 */

// Comprehensive Font Mapping Dictionary
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
        const numPages = this.viewer.pdfDoc.numPages;
        for (let i = 1; i <= numPages; i++) {
            this.renderTextLayer(i);
        }
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
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {boolean} True if the color is grayscale
     */
    isGrayscale(r, g, b) {
        return Math.abs(r - g) < 10 && Math.abs(g - b) < 10 && Math.abs(r - b) < 10;
    }

    /**
     * Calculate luminance of a color
     * @param {number} r - Red component (0-255)
     * @param {number} g - Green component (0-255)
     * @param {number} b - Blue component (0-255)
     * @returns {number} Luminance value (0-255)
     */
    getLuminance(r, g, b) {
        return 0.299 * r + 0.587 * g + 0.114 * b;
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
     * Get smart background color by sampling OUTSIDE/AROUND the text bounding box
     * This samples the perimeter and nearby areas to find the dominant background color
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
        const w = width * dpr; // Scale width by DPR
        
        // Text box bounds (top-left origin for sampling)
        const boxLeft = Math.floor(x);
        const boxTop = Math.floor(yBaseline - height);
        const boxRight = Math.floor(x + w);
        const boxBottom = Math.floor(yBaseline);
        
        const samples = [];
        
        // Helper to safely get a pixel
        const getPixel = (px, py) => {
            const ix = Math.floor(px);
            const iy = Math.floor(py);
            if (ix < 0 || ix >= canvasWidth || iy < 0 || iy >= canvasHeight) return null;
            try {
                const data = ctx.getImageData(ix, iy, 1, 1).data;
                // Ignore transparent pixels
                if (data[3] < 10) return null;
                return [data[0], data[1], data[2]];
            } catch (e) {
                return null;
            }
        };

        // Sample OUTSIDE the text box - use larger padding to avoid text edges
        const padding = Math.max(4 * dpr, 8);
        
        // Sample multiple points along each edge (outside the box)
        const numSamplesPerEdge = 5;
        
        // Top edge (above the text)
        for (let i = 0; i < numSamplesPerEdge; i++) {
            const sampleX = boxLeft + (w * i / (numSamplesPerEdge - 1));
            samples.push(getPixel(sampleX, boxTop - padding));
            samples.push(getPixel(sampleX, boxTop - padding * 2));
        }
        
        // Bottom edge (below the text)
        for (let i = 0; i < numSamplesPerEdge; i++) {
            const sampleX = boxLeft + (w * i / (numSamplesPerEdge - 1));
            samples.push(getPixel(sampleX, boxBottom + padding));
            samples.push(getPixel(sampleX, boxBottom + padding * 2));
        }
        
        // Left edge (to the left of text)
        for (let i = 0; i < 3; i++) {
            const sampleY = boxTop + (height * i / 2);
            samples.push(getPixel(boxLeft - padding, sampleY));
            samples.push(getPixel(boxLeft - padding * 2, sampleY));
        }
        
        // Right edge (to the right of text)
        for (let i = 0; i < 3; i++) {
            const sampleY = boxTop + (height * i / 2);
            samples.push(getPixel(boxRight + padding, sampleY));
            samples.push(getPixel(boxRight + padding * 2, sampleY));
        }
        
        // Corners (further out)
        samples.push(getPixel(boxLeft - padding, boxTop - padding));
        samples.push(getPixel(boxRight + padding, boxTop - padding));
        samples.push(getPixel(boxLeft - padding, boxBottom + padding));
        samples.push(getPixel(boxRight + padding, boxBottom + padding));

        // Filter valid samples
        const valid = samples.filter(s => s !== null);
        
        if (valid.length === 0) {
            // Fallback: assume white background
            return [255, 255, 255];
        }

        // Count occurrences to find dominant (majority) color
        // Use finer quantization for grayscale colors to preserve subtle differences
        const colorCounts = {};
        const colorValues = {};
        
        valid.forEach(c => {
            // Use the quantizeColor method for better grayscale handling
            const key = this.quantizeColor(c[0], c[1], c[2]);
            colorCounts[key] = (colorCounts[key] || 0) + 1;
            // Store actual color values for this key (use first occurrence)
            if (!colorValues[key]) {
                colorValues[key] = c;
            }
        });

        // Find the most frequent color (dominant = background)
        let maxCount = 0;
        let dominantKey = null;
        
        for (const key in colorCounts) {
            if (colorCounts[key] > maxCount) {
                maxCount = colorCounts[key];
                dominantKey = key;
            }
        }

        return dominantKey ? colorValues[dominantKey] : [255, 255, 255];
    }

    /**
     * Get smart text color by sampling INSIDE the text bounding box
     * Text pixels are typically the minority color that contrasts with background
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
        const w = width * dpr; // Scale width by DPR
        
        // Define the text bounding box (sample INSIDE this area)
        const boxLeft = Math.max(0, Math.floor(x));
        const boxTop = Math.max(0, Math.floor(yBaseline - h));
        const boxWidth = Math.min(Math.floor(w), canvasWidth - boxLeft);
        const boxHeight = Math.min(Math.floor(h), canvasHeight - boxTop);
        
        if (boxWidth <= 0 || boxHeight <= 0) {
            return [0, 0, 0]; // Default to black
        }

        try {
            // Sample the entire text bounding box
            const imageData = ctx.getImageData(boxLeft, boxTop, boxWidth, boxHeight).data;
            
            // Collect all non-background colors with their frequencies
            const colorCounts = {};
            const colorValues = {};
            let totalNonBgPixels = 0;
            
            // Check if background is grayscale
            const bgIsGrayscale = this.isGrayscale(bgColor[0], bgColor[1], bgColor[2]);
            const bgLuminance = this.getLuminance(bgColor[0], bgColor[1], bgColor[2]);
            
            // Helper to check if a color is similar to background
            // For grayscale, use luminance-based comparison with tighter threshold
            const isBackground = (r, g, b) => {
                if (bgIsGrayscale && this.isGrayscale(r, g, b)) {
                    // For grayscale colors, use luminance difference
                    // Two grays with luminance difference > 20 should be considered different
                    const pixelLuminance = this.getLuminance(r, g, b);
                    return Math.abs(pixelLuminance - bgLuminance) < 20;
                }
                // For colored pixels, use RGB distance
                const dr = r - bgColor[0];
                const dg = g - bgColor[1];
                const db = b - bgColor[2];
                // Use tighter tolerance (30^2 = 900) to better distinguish text from background
                return (dr*dr + dg*dg + db*db) < 900;
            };

            for (let i = 0; i < imageData.length; i += 4) {
                const r = imageData[i];
                const g = imageData[i+1];
                const b = imageData[i+2];
                const a = imageData[i+3];

                // Skip transparent pixels
                if (a < 128) continue;
                
                // Skip background-like pixels
                if (isBackground(r, g, b)) continue;

                totalNonBgPixels++;
                
                // Use quantizeColor for better grayscale handling
                const key = this.quantizeColor(r, g, b);
                colorCounts[key] = (colorCounts[key] || 0) + 1;
                
                // Store actual color values
                if (!colorValues[key]) {
                    colorValues[key] = [r, g, b];
                }
            }

            // If no non-background pixels found, determine text color based on background
            if (totalNonBgPixels === 0 || Object.keys(colorCounts).length === 0) {
                // If background is light, text is probably black; if dark, text is probably white
                return bgLuminance > 128 ? [0, 0, 0] : [255, 255, 255];
            }

            // Find the most contrasting color among the non-background pixels
            // This is typically the actual text color
            // For grayscale PDFs: text is darker (lower luminance) than background
            let bestColor = null;
            let bestContrast = 0;
            let bestCount = 0;
            
            for (const key in colorCounts) {
                const count = colorCounts[key];
                const color = colorValues[key];
                const colorLuminance = this.getLuminance(color[0], color[1], color[2]);
                const contrast = Math.abs(colorLuminance - bgLuminance);
                
                // Prefer colors with higher contrast AND reasonable frequency
                // Weight by both contrast and frequency to find the actual text color
                // For grayscale: prefer darker colors (lower luminance) as text
                let score = contrast * Math.sqrt(count);
                
                // Bonus for darker colors in grayscale scenarios (text is typically darker)
                if (bgIsGrayscale && this.isGrayscale(color[0], color[1], color[2])) {
                    if (colorLuminance < bgLuminance) {
                        score *= 1.2; // Prefer darker colors as text
                    }
                }
                
                if (score > bestContrast || (score === bestContrast && count > bestCount)) {
                    bestContrast = score;
                    bestCount = count;
                    bestColor = color;
                }
            }

            // If we found a color, return it
            if (bestColor) {
                return bestColor;
            }

            // Fallback: return black or white based on background
            return bgLuminance > 128 ? [0, 0, 0] : [255, 255, 255];
            
        } catch (e) {
            // On error, return black or white based on background luminance
            const bgLuminance = 0.299 * bgColor[0] + 0.587 * bgColor[1] + 0.114 * bgColor[2];
            return bgLuminance > 128 ? [0, 0, 0] : [255, 255, 255];
        }
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
     * Merge adjacent text items on the same line
     * @param {Array} items
     * @returns {Array}
     */
    mergeTextItems(items, styles = {}) {
        // Filter empty items
        const validItems = items.filter(item => item.str.trim().length > 0);
        
        if (validItems.length === 0) return [];

        // Identify font styles (bold, italic, family)
        validItems.forEach(item => {
            if (item.fontName) {
                let fontName = item.fontName.toLowerCase();
                let fontFamily = null;
                
                // Check styles for real font name
                if (styles[item.fontName]) {
                    const style = styles[item.fontName];
                    if (style.fontFamily) {
                        fontFamily = style.fontFamily;
                        fontName = fontFamily.toLowerCase(); // Use real family for detection
                    }
                }

                // Check for bold
                item.isBold = fontName.includes('bold') ||
                             fontName.includes('bd') ||
                             fontName.includes('black') ||
                             fontName.includes('heavy') ||
                             fontName.includes('demi') ||
                             fontName.includes('med') ||
                             (styles[item.fontName] && styles[item.fontName].descent < -200); // Heuristic? No.

                // Check for italic
                item.isItalic = fontName.includes('italic') ||
                               fontName.includes('oblique') ||
                               fontName.includes('itl') ||
                               fontName.includes('obl') ||
                               fontName.includes('slanted');

                // Check for font family
                item.fontFamily = this.getFontFamily(fontFamily || item.fontName);
            }
        });

        // Group by Y with a tolerance
        const lines = [];
        
        // Helper to find a line group
        const findLine = (y) => {
            return lines.find(line => Math.abs(line.y - y) < 2); // 2 unit tolerance
        };

        validItems.forEach(item => {
            const y = item.transform[5];
            let line = findLine(y);
            if (!line) {
                line = { y: y, items: [] };
                lines.push(line);
            }
            line.items.push(item);
        });

        // Sort lines by Y (descending for PDF coordinates)
        lines.sort((a, b) => b.y - a.y);

        const mergedItems = [];

        lines.forEach(line => {
            // Sort items in line by X
            line.items.sort((a, b) => a.transform[4] - b.transform[4]);

            let current = null;

            line.items.forEach(item => {
                if (!current) {
                    current = { ...item };
                    return;
                }

                // Check compatibility
                const sameFont = item.fontName === current.fontName;
                // Check scale (approximate)
                const sameScaleX = Math.abs(item.transform[0] - current.transform[0]) < 0.01;
                const sameScaleY = Math.abs(item.transform[3] - current.transform[3]) < 0.01;
                // Check color
                const sameColor = this.areColorsSimilar(item.color, current.color);
                
                // Calculate gap
                const endX = current.transform[4] + current.width;
                const startX = item.transform[4];
                const gap = startX - endX;
                
                // Font size estimate (scaleX)
                const fontSize = Math.abs(current.transform[0]);
                
                // Merge threshold:
                // Allow merging if gap is reasonable (e.g., within same column)
                const maxGap = fontSize * 3;
                
                if (sameFont && sameScaleX && sameScaleY && sameColor && gap < maxGap) {
                    // Merge
                    let separator = '';
                    // Add space if gap is significant and no space exists
                    if (gap > fontSize * 0.15) {
                        if (!current.str.endsWith(' ') && !item.str.startsWith(' ')) {
                            separator = ' ';
                        }
                    }
                    
                    current.str += separator + item.str;
                    current.width += gap + item.width;
                    // current.transform stays as the start
                } else {
                    mergedItems.push(current);
                    current = { ...item };
                }
            });
            
            if (current) {
                mergedItems.push(current);
            }
        });

        return mergedItems;
    }

    /**
     * Render text layer for a page
     * @param {number} pageNum
     */
    async renderTextLayer(pageNum) {
        if (!this.viewer.pdfDoc || !this.isActive) return;

        // Check if already exists
        const wrapper = this.viewer.pageWrappers[pageNum];
        if (!wrapper) return;
        
        if (wrapper.querySelector('.pdf-text-layer')) {
            return; // Already rendered
        }

        const page = await this.viewer.pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        // Calculate effective scale to match viewer's canvas exactly (handling High DPI rounding)
        const dpr = window.devicePixelRatio || 1;
        const tempViewport = page.getViewport({ scale: this.viewer.scale * dpr, rotation: this.viewer.rotation });
        const physicalWidth = Math.floor(tempViewport.width);
        const logicalWidth = physicalWidth / dpr;
        
        const unscaledViewport = page.getViewport({ scale: 1.0, rotation: this.viewer.rotation });
        const effectiveScale = logicalWidth / unscaledViewport.width;
        
        const viewport = page.getViewport({ scale: effectiveScale, rotation: this.viewer.rotation });
        
        // Create text layer div
        const textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        // Allow pointer events to pass through the layer (for zoom/scroll)
        textLayer.style.pointerEvents = 'none';
        
        // Insert after canvas
        wrapper.appendChild(textLayer);

        // Process text items
        // We combine items that are on the same line to improve editing experience.
        // PDF.js often splits words or sentences into small chunks.
        
        const styles = textContent.styles;

        // Pre-process items to extract colors
        try {
            const canvas = wrapper.querySelector('canvas');
            if (canvas) {
                const ctx = canvas.getContext('2d');
                const dpr = window.devicePixelRatio || 1;
                
                textContent.items.forEach(item => {
                    if (!item.str.trim()) return;
                    
                    const tx = pdfjsLib.Util.transform(
                        viewport.transform,
                        item.transform
                    );
                    const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
                    // Calculate pixel width of the item
                    // item.width is in PDF units. tx[0] is scaleX.
                    // We need the magnitude of the horizontal vector (tx[0], tx[1])
                    const scaleX = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]));
                    const pixelWidth = item.width * scaleX;

                    const bgColor = this.getSmartBackgroundColor(ctx, tx, pixelWidth, fontHeight, dpr);
                    item.bgColor = bgColor;
                    item.color = this.getSmartTextColor(ctx, tx, pixelWidth, fontHeight, dpr, bgColor);
                });
            }
        } catch (e) {
            console.warn('Failed to sample colors', e);
        }

        const mergedItems = this.mergeTextItems(textContent.items, styles);

        mergedItems.forEach((item, index) => {
            const tx = pdfjsLib.Util.transform(
                viewport.transform,
                item.transform
            );

            const fontHeight = Math.sqrt((tx[2] * tx[2]) + (tx[3] * tx[3]));
            const fontWidth = Math.sqrt((tx[0] * tx[0]) + (tx[1] * tx[1]));

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

            // Apply font weight
            if (item.isBold) {
                el.style.fontWeight = 'bold';
                el.dataset.fontWeight = 'bold';
            }

            // Apply font style
            if (item.isItalic) {
                el.style.fontStyle = 'italic';
                el.dataset.fontStyle = 'italic';
            }

            // Styles
            // Position
            // pdf.js coordinates are bottom-left, but viewport transform handles it.
            // The tx array is [scaleX, skewY, skewX, scaleY, translateX, translateY]
            // We need to position the element.
            
            // Calculate angle
            const angle = Math.atan2(tx[1], tx[0]);
            const degree = angle * (180 / Math.PI);

            el.style.left = `${tx[4]}px`;
            el.style.top = `${tx[5] - fontHeight}px`; // Adjust for baseline
            
            el.style.fontSize = `${fontHeight}px`;
            // Use detected font family or fallback to style map or default
            const finalFontFamily = item.fontFamily || (styles[item.fontName] ? styles[item.fontName].fontFamily : 'sans-serif');
            el.style.fontFamily = finalFontFamily;
            el.dataset.fontFamily = finalFontFamily;

            if (degree !== 0) {
                el.style.transform = `rotate(${degree}deg)`;
            }
            
            // Interaction
            el.addEventListener('click', (e) => this.handleTextClick(e, el));
            el.addEventListener('blur', (e) => this.handleTextBlur(e, el));
            el.addEventListener('keydown', (e) => this.handleKeyDown(e, el));
            
            // Re-enable pointer events for the text item
            el.style.pointerEvents = 'auto';

            textLayer.appendChild(el);
        });
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
                isBold: el.dataset.fontWeight === 'bold',
                isItalic: el.dataset.fontStyle === 'italic',
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
     * Apply changes to PDF using pdf-lib
     * @param {PDFDocument} pdfDoc 
     */
    async applyChangesToPdf(pdfDoc) {
        const pages = pdfDoc.getPages();
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        // Embed standard fonts
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
            const { height } = page.getSize();

            for (const change of pageChanges.values()) {
                // 1. Redact old text
                // We need the bounding box.
                // transform is [scaleX, skewY, skewX, scaleY, x, y]
                const [scaleX, skewY, skewX, scaleY, x, y] = change.transform;
                
                // Calculate rotation
                const angleRad = Math.atan2(skewY, scaleX);
                const angleDeg = angleRad * (180 / Math.PI);
                
                const fontSize = Math.sqrt((scaleX * scaleX) + (skewY * skewY));
                
                // Draw rectangle to cover old text
                // We use the background color (white usually)
                // Adjust y for baseline and descenders
                // pdf-lib drawRectangle starts at bottom-left.
                // If rotated, it rotates around the origin (x,y).
                
                // Use sampled background color or default to white
                let redactionColor = rgb(1, 1, 1);
                if (change.bgColor) {
                    redactionColor = rgb(change.bgColor[0] / 255, change.bgColor[1] / 255, change.bgColor[2] / 255);
                }

                // Add padding to redaction to ensure full coverage
                // We expand slightly to cover anti-aliasing artifacts and potential font metric differences
                const paddingX = fontSize * 0.1;
                
                page.drawRectangle({
                    x: x - (paddingX / 2),
                    y: y - (fontSize * 0.25), // Increase descender coverage
                    width: change.width + paddingX,
                    height: fontSize * 1.35, // Increase height slightly
                    rotate: PDFLib.degrees(angleDeg),
                    color: redactionColor,
                });

                // 2. Draw new text
                let textColor = rgb(0, 0, 0);
                if (change.color) {
                    textColor = rgb(change.color[0] / 255, change.color[1] / 255, change.color[2] / 255);
                }

                // Select font based on family and style
                const family = change.fontFamily || 'sans-serif';
                const isBold = change.isBold;
                const isItalic = change.isItalic;
                
                // Map complex font families back to standard fonts for PDF generation
                let pdfFontFamily = 'sans-serif';
                const familyLower = family.toLowerCase();
                
                if (familyLower.includes('monospace') || familyLower.includes('courier') || familyLower.includes('console')) {
                    pdfFontFamily = 'monospace';
                } else if (familyLower.includes('serif') && !familyLower.includes('sans-serif')) {
                    pdfFontFamily = 'serif';
                }
                
                let selectedFont = fonts[pdfFontFamily].regular;
                if (fonts[pdfFontFamily]) {
                    if (isBold && isItalic) selectedFont = fonts[pdfFontFamily].boldItalic;
                    else if (isBold) selectedFont = fonts[pdfFontFamily].bold;
                    else if (isItalic) selectedFont = fonts[pdfFontFamily].italic;
                    else selectedFont = fonts[pdfFontFamily].regular;
                }

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
