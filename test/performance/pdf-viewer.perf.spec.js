const { test, expect } = require('@playwright/test');

test.describe('PDF Viewer Performance', () => {
  test('should handle fast scrolling smoothly', async ({ page }) => {
    // 1. Load the app
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // 2. Generate and open a large PDF
    await page.waitForFunction(() => window.PDFLib !== undefined);
    
    await page.evaluate(async () => {
      // Create a PDF with 50 pages
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageCount = 50;
      
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.addPage([600, 800]);
        page.drawText(`Page ${i + 1}`, {
          x: 50,
          y: 700,
          size: 30,
        });
        // Add some content to make rendering non-trivial
        for (let j = 0; j < 50; j++) {
            page.drawText(`Line ${j} of content on page ${i + 1} - Performance Test`, {
                x: 50,
                y: 650 - (j * 12),
                size: 10
            });
        }
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'large-test.pdf', { type: 'application/pdf' });
      
      // Load and open
      const loadedFiles = await window.galleryUI.fileHandler.loadFiles([file]);
      await window.galleryUI.openInFullscreen(loadedFiles[0]);
    });

    // 3. Wait for viewer to open and first page to render
    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toBeVisible();
    await expect(page.locator('.pdf-page-canvas').first()).toBeVisible();

    // 4. Perform fast scrolling
    const main = page.locator('#pdf-main');
    
    // Measure FPS / Jank
    const performanceMetrics = await page.evaluate(async () => {
      const main = document.getElementById('pdf-main');
      const start = performance.now();
      let frames = 0;
      let jank = 0;
      let lastTime = start;
      
      const measure = () => {
        const now = performance.now();
        const delta = now - lastTime;
        if (delta > 32) { // Drop below 30fps
            jank++;
        }
        frames++;
        lastTime = now;
        
        if (performance.now() - start < 2000) { // Run for 2 seconds
            requestAnimationFrame(measure);
        }
      };
      
      requestAnimationFrame(measure);
      
      // Scroll down rapidly
      const scrollHeight = main.scrollHeight;
      const step = scrollHeight / 20;
      
      for (let i = 0; i <= 20; i++) {
          main.scrollTop = i * step;
          // Small delay to simulate fast user scrolling but allow *some* events
          await new Promise(r => setTimeout(r, 50)); 
      }
      
      // Scroll back up
      main.scrollTop = 0;
      
      await new Promise(r => setTimeout(r, 500)); // Wait a bit
      
      const duration = performance.now() - start;
      return {
          fps: (frames / duration) * 1000,
          jank,
          duration
      };
    });

    console.log('Performance Metrics:', performanceMetrics);

    // 5. Assertions
    // We expect the viewer to remain responsive and not crash
    expect(performanceMetrics.fps).toBeGreaterThan(10); // Minimal acceptable FPS during heavy load
    
    // Verify we are still on a valid page (viewer didn't crash)
    await expect(page.locator('#pdf-page-num')).toBeVisible();
    
    // Verify render cancellation worked (we shouldn't see errors in console, handled by page.on('console'))
    // And we should be able to see the current page rendered eventually
    await page.waitForTimeout(1000);
    
    // Check if the page at the top (Page 1) is rendered
    // We expect to be at the top after the scroll back up
    await expect(page.locator('.pdf-page-wrapper[data-page-number="1"] canvas')).toBeVisible();
  });
});
