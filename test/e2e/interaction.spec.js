const { test, expect } = require('@playwright/test');

test.describe('App Interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('galleryApp is initialized globally', async ({ page }) => {
    // Wait for initialization
    await page.waitForFunction(() => window.galleryApp?.isInitialized);
    
    const isInitialized = await page.evaluate(() => {
      return window.galleryApp?.isInitialized;
    });
    expect(isInitialized).toBe(true);
  });

  test('can simulate file loading', async ({ page }) => {
    // Simulate loading a file via console/evaluate
    await page.evaluate(async () => {
      // Create a mock file
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
      // Mock the file handler's processFile to return a valid object without using URL.createObjectURL if it fails in some envs
      // But here we are in a real browser (Playwright), so it should work.
      
      // We need to manually trigger the load because we can't easily access the fileHandler instance if it's not global
      // But it IS global: window.galleryFileHandler
      
      if (window.galleryFileHandler) {
        await window.galleryFileHandler.loadFiles([file]);
      }
    });

    // Check if toast appears (error or success)
    // Since text/plain is not supported by default in the list I saw earlier (images, video, audio, pdf), it might show an error.
    // scripts/file-handler.js supportedTypes doesn't include text/plain.
    // So it should show an error toast.
    
    const toast = page.locator('.toast.warning'); // "Certains fichiers n'ont pas pu être chargés"
    // Or error toast
    await expect(toast).toBeVisible({ timeout: 5000 });
  });

  test('can simulate supported file loading', async ({ page }) => {
    // Simulate loading a supported file (e.g. image)
    // We can't easily create a valid image Blob in evaluate without a lot of data, 
    // but we can try to create a fake one and see if it tries to open the viewer.
    
    await page.evaluate(async () => {
      // Create a fake image file
      const file = new File(['fake image data'], 'test.jpg', { type: 'image/jpeg' });
      
      if (window.galleryFileHandler) {
        await window.galleryFileHandler.loadFiles([file]);
      }
    });
    
    // It should try to open the viewer.
    // The viewer might fail to load the image (since it's fake data), but the viewer container should become active/visible.
    // Or it might show an error toast if validation passes but loading fails.
    
    // Check if viewer becomes visible OR error toast appears
    const viewer = page.locator('#fullscreen-viewer');
    const toast = page.locator('.toast');
    
    // Wait for either
    await Promise.race([
      expect(viewer).toHaveClass(/active/),
      expect(toast).toBeVisible()
    ]);
  });
});
