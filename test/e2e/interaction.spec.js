const { test, expect } = require('@playwright/test');
const sharp = require('sharp');

// A real image so the input-triggered load actually opens the viewer.
let pngBuffer;
test.beforeAll(async () => {
  pngBuffer = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 30, g: 120, b: 200 } } })
    .png()
    .toBuffer();
});

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
    // Drive the real user flow: choosing an image file loads it and opens the
    // viewer. (Calling fileHandler.loadFiles directly only fills the grid; it
    // never opens the viewer -- that is the UIController's job.)
    await page.locator('#file-input').setInputFiles({
      name: 'photo.png',
      mimeType: 'image/png',
      buffer: pngBuffer,
    });

    await expect(page.locator('#fullscreen-viewer')).toHaveClass(/active/, { timeout: 5000 });
  });
});
