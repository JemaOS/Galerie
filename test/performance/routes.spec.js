const { test, expect } = require('@playwright/test');

test.describe('Performance Route Tests', () => {
  
  test('should open image viewer directly without home flash', async ({ page }) => {
    // Mock file handling by injecting a file immediately upon load
    await page.addInitScript(() => {
      // Mock launchQueue
      window.launchQueue = {
        setConsumer: (callback) => {
          // Simulate immediate file launch
          const mockFile = new File(['fake image'], 'test.jpg', { type: 'image/jpeg' });
          callback({ files: [mockFile] });
        }
      };
    });

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
    await page.addInitScript(() => {
      window.launchQueue = {
        setConsumer: (callback) => {
          const mockFile = new File(['fake video'], 'test.mp4', { type: 'video/mp4' });
          callback({ files: [mockFile] });
        }
      };
    });

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
    await page.addInitScript(() => {
      window.launchQueue = {
        setConsumer: (callback) => {
          const mockFile = new File(['fake pdf'], 'test.pdf', { type: 'application/pdf' });
          callback({ files: [mockFile] });
        }
      };
    });

    const startTime = Date.now();
    await page.goto('/');
    
    const viewer = page.locator('#pdf-viewer');
    await expect(viewer).toHaveClass(/active/, { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`PDF Open Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

  test('should open audio player directly', async ({ page }) => {
    await page.addInitScript(() => {
      window.launchQueue = {
        setConsumer: (callback) => {
          const mockFile = new File(['fake audio'], 'test.mp3', { type: 'audio/mpeg' });
          callback({ files: [mockFile] });
        }
      };
    });

    const startTime = Date.now();
    await page.goto('/');
    
    const player = page.locator('#audio-player');
    await expect(player).not.toHaveClass(/hidden/, { timeout: 5000 });
    
    const loadTime = Date.now() - startTime;
    console.log(`Audio Open Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000);
  });

});
