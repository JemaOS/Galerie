const { test, expect } = require('@playwright/test');

test.describe('PDF Multipage Performance', () => {
  test('should maintain stable performance across multiple pages', async ({ page }) => {
    // 1. Load the app
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // 2. Generate and open a 3-page PDF
    await page.waitForFunction(() => window.PDFLib !== undefined);
    
    await page.evaluate(async () => {
      const pdfDoc = await PDFLib.PDFDocument.create();
      // Add 3 pages
      for (let i = 0; i < 3; i++) {
        const page = pdfDoc.addPage([800, 1000]);
        page.drawText(`Page ${i + 1}`, { x: 50, y: 900, size: 30 });
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'multipage-test.pdf', { type: 'application/pdf' });
      
      // Load and open
      const loadedFiles = await window.galleryUI.fileHandler.loadFiles([file]);
      await window.galleryUI.openInFullscreen(loadedFiles[0]);
    });

    // 3. Wait for viewer to open
    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toBeVisible();
    await expect(page.locator('.pdf-page-canvas').first()).toBeVisible();

    // 4. Enter Annotation Mode
    await page.click('#pdf-edit-mode');
    await expect(page.locator('#pdf-edit-toolbar')).toBeVisible();
    
    // Select Pen tool
    await page.click('#pdf-edit-toolbar button[data-tool="pen"]');

    // Helper function to measure drawing performance
    const measureDrawing = async () => {
      await page.evaluate(() => {
        window.perfMetrics = {
          start: performance.now(),
          frames: 0,
          jank: 0,
          lastTime: performance.now(),
          isRunning: true
        };
        
        const measure = () => {
          if (!window.perfMetrics.isRunning) return;
          const now = performance.now();
          const delta = now - window.perfMetrics.lastTime;
          if (delta > 32) { // Drop below 30fps
              window.perfMetrics.jank++;
          }
          window.perfMetrics.frames++;
          window.perfMetrics.lastTime = now;
          requestAnimationFrame(measure);
        };
        
        requestAnimationFrame(measure);
      });
    };

    const stopMeasurement = async () => {
      return await page.evaluate(() => {
        window.perfMetrics.isRunning = false;
        const duration = performance.now() - window.perfMetrics.start;
        return {
            fps: (window.perfMetrics.frames / duration) * 1000,
            jank: window.perfMetrics.jank,
            duration
        };
      });
    };

    const drawComplexShape = async (pageLocator) => {
      const box = await pageLocator.boundingBox();
      if (!box) throw new Error('Canvas not found');

      // Perform 30 rapid strokes
      for (let i = 0; i < 30; i++) {
          const startX = box.x + 100 + (i * 5);
          const startY = box.y + 100 + (i * 5);
          
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          // Draw a squiggle
          await page.mouse.move(startX + 20, startY + 20);
          await page.mouse.move(startX - 20, startY + 40);
          await page.mouse.move(startX + 20, startY + 60);
          await page.mouse.up();
          
          // Small delay
          await page.waitForTimeout(5);
      }
    };

    // --- Page 1 ---
    console.log('Testing Page 1...');
    // Ensure we are on page 1
    await page.evaluate(() => window.pdfViewer.scrollToPage(1));
    const canvas1 = page.locator('.pdf-page-wrapper[data-page-number="1"] .annotation-canvas');
    await expect(canvas1).toBeVisible();
    
    await measureDrawing();
    await drawComplexShape(canvas1);
    const results1 = await stopMeasurement();
    console.log('Page 1 Results:', results1);

    // --- Page 2 ---
    console.log('Navigating to Page 2 and drawing (warmup)...');
    await page.evaluate(() => window.pdfViewer.scrollToPage(2));
    const canvas2 = page.locator('.pdf-page-wrapper[data-page-number="2"] .annotation-canvas');
    await expect(canvas2).toBeVisible();
    // Just draw, no measurement needed for intermediate page (or we can measure to be sure)
    await drawComplexShape(canvas2);

    // --- Page 3 ---
    console.log('Testing Page 3...');
    await page.evaluate(() => window.pdfViewer.scrollToPage(3));
    const canvas3 = page.locator('.pdf-page-wrapper[data-page-number="3"] .annotation-canvas');
    await expect(canvas3).toBeVisible();

    await measureDrawing();
    await drawComplexShape(canvas3);
    const results3 = await stopMeasurement();
    console.log('Page 3 Results:', results3);

    // Assertions
    expect(results1.fps).toBeGreaterThan(20); // Baseline expectation
    expect(results3.fps).toBeGreaterThan(20); // Should still be good

    // Compare Page 3 to Page 1
    // Allow some variance, but it shouldn't be drastically worse (e.g., half the FPS)
    // If the fix works, it should be very similar.
    // If the fix is missing (canvas history growing indefinitely), Page 3 would be much slower.
    
    const fpsRatio = results3.fps / results1.fps;
    console.log(`FPS Ratio (P3/P1): ${fpsRatio.toFixed(2)}`);
    
    // We expect the ratio to be close to 1.0, or at least > 0.7
    expect(fpsRatio).toBeGreaterThan(0.7);

    // Check for memory stability (indirectly via jank)
    // Jank shouldn't increase massively
    // expect(results3.jank).toBeLessThan(results1.jank + 10); 
    
    // Cleanup
    await page.click('#pdf-exit-edit');
  });
});
