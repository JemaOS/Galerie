const { test, expect } = require('@playwright/test');

test.describe('PDF Viewer Zoom Stability', () => {
  test('should maintain relative scroll position when zooming', async ({ page }) => {
    // 1. Load the app
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // 2. Generate and open a PDF
    await page.waitForFunction(() => window.PDFLib !== undefined);
    
    await page.evaluate(async () => {
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageCount = 10;
      
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.addPage([600, 800]);
        page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 30 });
        // Draw a center line
        page.drawLine({
            start: { x: 0, y: 400 },
            end: { x: 600, y: 400 },
            thickness: 2,
            color: PDFLib.rgb(1, 0, 0),
        });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'zoom-test.pdf', { type: 'application/pdf' });
      
      const loadedFiles = await window.galleryUI.fileHandler.loadFiles([file]);
      await window.galleryUI.openInFullscreen(loadedFiles[0]);
    });

    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toBeVisible();
    
    // Wait for render
    await expect(page.locator('.pdf-page-canvas').first()).toBeVisible();

    // 3. Scroll to middle of page 5
    // Page height is approx 800px (plus margins/padding).
    // Let's just scroll to 50% of the document.
    
    const initialMetrics = await page.evaluate(async () => {
        const main = document.getElementById('pdf-main');
        // Scroll to middle
        main.scrollTop = main.scrollHeight / 2;
        await new Promise(r => setTimeout(r, 100)); // Wait for scroll
        
        return {
            scrollTop: main.scrollTop,
            scrollHeight: main.scrollHeight,
            clientHeight: main.clientHeight,
            centerRatio: (main.scrollTop + main.clientHeight / 2) / main.scrollHeight
        };
    });

    console.log('Initial Metrics:', initialMetrics);

    // 4. Zoom In multiple times
    const zoomInBtn = page.locator('#pdf-zoom-in');
    await zoomInBtn.click();
    await page.waitForTimeout(500); // Wait for debounce and render
    await zoomInBtn.click();
    await page.waitForTimeout(500);

    // 5. Check metrics
    const finalMetrics = await page.evaluate(() => {
        const main = document.getElementById('pdf-main');
        return {
            scrollTop: main.scrollTop,
            scrollHeight: main.scrollHeight,
            clientHeight: main.clientHeight,
            centerRatio: (main.scrollTop + main.clientHeight / 2) / main.scrollHeight
        };
    });

    console.log('Final Metrics:', finalMetrics);

    // The center ratio should be very close
    // Allow small margin of error due to rounding/padding
    const diff = Math.abs(initialMetrics.centerRatio - finalMetrics.centerRatio);
    console.log('Center Ratio Difference:', diff);
    
    expect(diff).toBeLessThan(0.05); // 5% tolerance
  });
});
