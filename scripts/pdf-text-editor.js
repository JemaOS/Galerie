/*
 * Copyright (C) 2025 Jema Technology
 */

class PdfTextEditor {
    constructor(viewer) {
        this.viewer = viewer;
        this.changes = new Map(); // Map<pageNum, Map<id, Change>>
        this.isActive = false;
        this.textLayer = null;
        this.fontMap = new Map(); // Map font names to standard fonts
    }

    /**
     * Start text edit mode
     * @param {number} initialPageNum
     */
    async startTextEditMode(initialPageNum) {
        this.isActive = true;
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
        const viewport = page.getViewport({ scale: this.viewer.scale, rotation: this.viewer.rotation });
        
        // Create text layer div
        const textLayer = document.createElement('div');
        textLayer.className = 'pdf-text-layer';
        textLayer.style.width = `${viewport.width}px`;
        textLayer.style.height = `${viewport.height}px`;
        
        // Insert after canvas
        wrapper.appendChild(textLayer);

        // Process text items
        // We need to combine items that are on the same line potentially, 
        // but for precise editing, individual items might be safer initially.
        // However, pdf.js often splits words. 
        // For this implementation, we will treat each item as an editable block.
        
        const styles = textContent.styles;

        textContent.items.forEach((item, index) => {
            if (!item.str.trim()) return; // Skip empty whitespace

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
            
            // Store original transform info for saving
            el.dataset.pdfTransform = JSON.stringify(item.transform);
            el.dataset.width = item.width;
            el.dataset.height = item.height;
            el.dataset.fontName = item.fontName;

            // Styles
            // Position
            // pdf.js coordinates are bottom-left, but viewport transform handles it.
            // The tx array is [scaleX, skewY, skewX, scaleY, translateX, translateY]
            // We need to position the element.
            
            // Calculate angle
            const angle = Math.atan2(tx[1], tx[0]);
            const degree = angle * (180 / Math.PI);

            el.style.left = `${tx[4]}px`;
            el.style.top = `${tx[5] - fontHeight}px`; // Adjust for baseline? pdf.js usually gives baseline y
            // Actually, for HTML, top is top-left. PDF is bottom-left.
            // viewport.transform handles the flip.
            // But HTML text is drawn from top-left (usually).
            // pdf.js text layer usually sets top to (y - fontSize).
            
            el.style.fontSize = `${fontHeight}px`;
            el.style.fontFamily = styles[item.fontName] ? styles[item.fontName].fontFamily : 'sans-serif';
            
            if (degree !== 0) {
                el.style.transform = `rotate(${degree}deg)`;
            }
            
            // Width adjustment to match PDF rendering width
            // el.style.width = `${item.width * (fontWidth / item.height)}px`; 
            // This is tricky. Let's rely on content size for now, or set min-width.
            
            // Interaction
            el.addEventListener('click', (e) => this.handleTextClick(e, el));
            el.addEventListener('blur', (e) => this.handleTextBlur(e, el));
            el.addEventListener('keydown', (e) => this.handleKeyDown(e, el));

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
        el.contentEditable = true;
        el.classList.add('editing');
        el.focus();
    }

    /**
     * Handle blur (focus lost) on text item
     * @param {Event} e 
     * @param {HTMLElement} el 
     */
    async handleTextBlur(e, el) {
        el.contentEditable = false;
        el.classList.remove('editing');
        this.activeElement = null;

        const newText = el.textContent;
        const originalText = el.dataset.originalText;

        if (newText !== originalText) {
            this.recordChange(el, newText);

            // Trigger preview update
            if (this.viewer && typeof this.viewer.refreshPreview === 'function') {
                await this.viewer.refreshPreview();
            }
        }
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

            // Trigger preview update (without saving to disk)
            if (this.viewer && typeof this.viewer.refreshPreview === 'function') {
                await this.viewer.refreshPreview();
            } else if (this.viewer && typeof this.viewer.save === 'function') {
                await this.viewer.save();
            }
        }
    }

    /**
     * Record a change
     * @param {HTMLElement} el 
     * @param {string} newText 
     */
    recordChange(el, newText) {
        const pageNum = parseInt(el.dataset.pageNum);
        const id = el.dataset.id;
        
        if (!this.changes.has(pageNum)) {
            this.changes.set(pageNum, new Map());
        }

        this.changes.get(pageNum).set(id, {
            id: id,
            pageNum: pageNum,
            originalText: el.dataset.originalText,
            newText: newText,
            transform: JSON.parse(el.dataset.pdfTransform),
            width: parseFloat(el.dataset.width),
            height: parseFloat(el.dataset.height),
            fontName: el.dataset.fontName
        });

        // Update dataset so subsequent edits compare against new text? 
        // No, we want to track from original for the redaction logic, 
        // but for UI we show new text.
        // Actually, if we edit twice, we need to update the "newText" in the change record.
        // The original text remains the same (what is in the PDF).
    }

    /**
     * Check if there are unsaved changes
     */
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

        // Embed standard font
        // Ideally we would map the original font, but that's hard without the font file.
        // We'll use Helvetica as a generic sans-serif.
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

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
                
                page.drawRectangle({
                    x: x,
                    y: y - (fontSize * 0.2), // Adjust for descenders
                    width: change.width,
                    height: fontSize * 1.2,
                    rotate: PDFLib.degrees(angleDeg),
                    color: rgb(1, 1, 1), // White
                });

                // 2. Draw new text
                page.drawText(change.newText, {
                    x: x,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: rgb(0, 0, 0),
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
window.PdfTextEditor = PdfTextEditor;
