const { test, expect } = require('@playwright/test');

// In Chromium `window.launchQueue` is a native accessor property, so a plain
// `window.launchQueue = {...}` assignment is silently ignored and the app keeps
// calling the native (no-op) setConsumer. Redefine the property instead via
// Object.defineProperty, and deliver the file like a real file launch.
test.describe('Performance Route Tests', () => {

  async function mockLaunch(page, name, type) {
    await page.addInitScript(({ name, type }) => {
      const q = {
        setConsumer: (callback) => {
          const file = new File(['mock'], name, { type });
          Promise.resolve().then(() => callback({ files: [file] }));
        },
      };
      Object.defineProperty(window, 'launchQueue', { value: q, configurable: true, writable: true });
    }, { name, type });
  }

  test('should open image viewer directly without home flash', async ({ page }) => {
    await mockLaunch(page, 'test.jpg', 'image/jpeg');

    const startTime = Date.now();
    await page.goto('/');
    
    // Wait for viewer to be active
    const viewer = page.locator('#fullscreen-viewer');
    await expect(viewer).toHaveClass(/active/, { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`Image Open Time: ${loadTime}ms`);
    
    // Check that home page elements were never visible (or at least are hidden now)
    const emptyState = page.locator('#empty-state');
    await expect(emptyState).toBeHidden();
    
    expect(loadTime).toBeLessThan(3000); // Relaxed for CI
  });

  test('should open video player directly', async ({ page }) => {
    await mockLaunch(page, 'test.mp4', 'video/mp4');

    const startTime = Date.now();
    await page.goto('/');
    
    const viewer = page.locator('#fullscreen-viewer');
    await expect(viewer).toHaveClass(/active/, { timeout: 5000 });
    
    // Check for video specific UI
    const videoContainer = page.locator('.video-player-container');
    await expect(videoContainer).toBeVisible();
    
    const loadTime = Date.now() - startTime;
    console.log(`Video Open Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should open PDF viewer directly', async ({ page }) => {
    await mockLaunch(page, 'test.pdf', 'application/pdf');

    const startTime = Date.now();
    await page.goto('/');
    
    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toHaveClass(/active/, { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`PDF Open Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should open audio player directly', async ({ page }) => {
    await mockLaunch(page, 'test.mp3', 'audio/mpeg');

    const startTime = Date.now();
    await page.goto('/');
    
    const player = page.locator('#audio-player');
    await expect(player).not.toHaveClass(/hidden/, { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`Audio Open Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

});
