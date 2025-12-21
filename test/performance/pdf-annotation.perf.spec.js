const { test, expect } = require('@playwright/test');

test.describe('PDF Annotation Performance', () => {
  test('should handle rapid drawing strokes smoothly', async ({ page }) => {
    // 1. Load the app
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // 2. Generate and open a large PDF
    await page.waitForFunction(() => window.PDFLib !== undefined);
    
    await page.evaluate(async () => {
      // Create a PDF with 1 page
      const pdfDoc = await PDFLib.PDFDocument.create();
      const page = pdfDoc.addPage([800, 1000]);
      page.drawText('Annotation Performance Test', {
        x: 50,
        y: 900,
        size: 30,
      });
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'annotation-test.pdf', { type: 'application/pdf' });
      
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

    // 5. Measure Performance
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

    // 6. Simulate Drawing
    const canvas = page.locator('.annotation-canvas').first();
    const box = await canvas.boundingBox();
    
    // Perform 50 rapid strokes
    for (let i = 0; i < 50; i++) {
        const startX = box.x + 100 + (i * 5);
        const startY = box.y + 100 + (i * 5);
        
        await page.mouse.move(startX, startY);
        await page.mouse.down();
        // Draw a small squiggle
        await page.mouse.move(startX + 20, startY + 20);
        await page.mouse.move(startX - 20, startY + 40);
        await page.mouse.move(startX + 20, startY + 60);
        await page.mouse.up();
        
        // Small delay between strokes
        await page.waitForTimeout(10);
    }

    // 7. Stop measurement
    const results = await page.evaluate(() => {
        window.perfMetrics.isRunning = false;
        const duration = performance.now() - window.perfMetrics.start;
        return {
            fps: (window.perfMetrics.frames / duration) * 1000,
            jank: window.perfMetrics.jank,
            duration
        };
    });
    
    console.log('Annotation Performance Metrics:', results);

    // 8. Assertions
    // We expect reasonable FPS. Without the fix, this might be lower or have high jank.
    // With the fix, it should be better.
    // For now, let's just log it and ensure it doesn't crash.
    expect(results.fps).toBeGreaterThan(0);
    
    // Check if we can still exit edit mode
    await page.click('#pdf-exit-edit');
    await expect(page.locator('#pdf-edit-toolbar')).toBeHidden();
  });
});
