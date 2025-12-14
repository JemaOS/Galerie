const { test, expect } = require('@playwright/test');

test('has title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Galerie/);
});

test('loads main app', async ({ page }) => {
  await page.goto('/');
  
  // Wait for loading screen to disappear
  await expect(page.locator('#loading-screen')).toHaveClass(/hidden/);
  
  // Check if main app container is visible
  await expect(page.locator('#app')).toBeVisible();
});

test('file input exists', async ({ page }) => {
  await page.goto('/');
  
  // File input is hidden but should exist
  const fileInput = page.locator('#file-input');
  await expect(fileInput).toBeAttached();
});

test('GalleryUtils is available', async ({ page }) => {
  await page.goto('/');
  
  // Check if GalleryUtils is defined in window
  const isDefined = await page.evaluate(() => {
    return typeof window.GalleryUtils !== 'undefined';
  });
  
  expect(isDefined).toBe(true);
});
