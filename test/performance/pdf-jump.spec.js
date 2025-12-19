const { test, expect } = require('@playwright/test');

test.describe('PDF Viewer Jump Performance', () => {
  test('should cancel render tasks when jumping pages', async ({ page }) => {
    // 1. Load the app
    await page.goto('/');
    await expect(page.locator('#app')).toBeVisible();

    // 2. Generate and open a large PDF
    await page.waitForFunction(() => window.PDFLib !== undefined);
    
    await page.evaluate(async () => {
      // Create a PDF with 600 pages
      const pdfDoc = await PDFLib.PDFDocument.create();
      const pageCount = 600;
      
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.addPage([600, 800]);
        page.drawText(`Page ${i + 1}`, { x: 50, y: 700, size: 30 });
        // Add content to make rendering take some time
        for (let j = 0; j < 100; j++) {
            page.drawText(`Line ${j} - Content to slow down render`, { x: 50, y: 650 - (j * 5), size: 10 });
        }
      }
      
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const file = new File([blob], 'jump-test.pdf', { type: 'application/pdf' });
      
      // Load and open
      const loadedFiles = await window.galleryUI.fileHandler.loadFiles([file]);
      await window.galleryUI.openInFullscreen(loadedFiles[0]);
    });

    // 3. Wait for viewer
    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toBeVisible();
    await expect(page.locator('.pdf-page-canvas').first()).toBeVisible();

    // 4. Perform rapid jumping
    await page.evaluate(async () => {
        const viewer = window.pdfViewer;
        
        // Jump to page 100
        viewer.scrollToPage(100);
        await new Promise(r => setTimeout(r, 50)); // Wait a tiny bit to let render start
        
        // Jump to page 200
        viewer.scrollToPage(200);
        await new Promise(r => setTimeout(r, 50));
        
        // Jump to page 300
        viewer.scrollToPage(300);
        await new Promise(r => setTimeout(r, 50));
        
        // Jump to page 400
        viewer.scrollToPage(400);
    });

    // 5. Verify active render tasks
    const activeTasksCount = await page.evaluate(() => {
        return window.pdfViewer.activeRenderTasks.size;
    });

    console.log(`Active render tasks after jumping: ${activeTasksCount}`);

    // We expect very few active tasks (e.g., only for page 400 and maybe neighbors)
    // With buffer=1 and partial visibility, we might have ~5 active tasks (e.g. 398-402)
    // We want to ensure we don't have tasks from previous jumps (100, 200, 300)
    expect(activeTasksCount).toBeLessThan(8);
    
    // Verify we eventually render page 400
    await expect(page.locator('.pdf-page-wrapper[data-page-number="400"] canvas')).toBeVisible();
  });
});
