const { test, expect } = require('@playwright/test');
const path = require('node:path');

test.describe('PDF Text Editor', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
    // Load the app
    await page.goto('/');
    
    // Wait for app to be ready
    await page.waitForSelector('#app:not(.hidden)');
  });

  test('should detect background color and font styles correctly', async ({ page }) => {
    // Upload the test PDF
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles('test/fixtures/test-bg.pdf');

    // Wait for PDF viewer to open
    await page.waitForSelector('#pdf-viewer:not(.hidden)');
    await page.waitForSelector('.pdf-page-canvas');

    // Enter Edit Mode
    await page.click('#pdf-edit-mode');
    await page.click('button[data-tool="text-edit"]');
    
    // Wait for text layer to render
    await page.waitForSelector('.pdf-text-layer');
    await page.waitForSelector('.pdf-text-item');

    // 1. Check Background Color Detection (Text on Blue)
    const blueTextItem = page.locator('.pdf-text-item', { hasText: 'Text on Blue' });
    await expect(blueTextItem).toBeVisible();
    
    // Click to edit
    await blueTextItem.click();
    await expect(blueTextItem).toHaveClass(/editing/);

    // Check background color of the editing element
    // We check the inline style because computed style might be affected by rendering timing/environment
    const bgColor = await blueTextItem.evaluate(el => el.style.backgroundColor);
    console.log('Detected background color:', bgColor);
    
    // It should be the blue color: rgb(204, 230, 255)
    expect(bgColor).toBe('rgb(204, 230, 255)');

    // Click away to blur
    await page.mouse.click(0, 0);

    // 2. Check Font Family Detection (Helvetica -> Sans Serif)
    // Should NOT be Times New Roman
    const boldTextItem = page.locator('.pdf-text-item', { hasText: 'Bold Text' });
    await boldTextItem.click();
    
    const fontFamily = await boldTextItem.evaluate(el => el.style.fontFamily);
    console.log('Detected font family:', fontFamily);
    expect(fontFamily).toContain('Helvetica');
    expect(fontFamily).not.toContain('Times');

    // Click away
    await page.mouse.click(0, 0);

    // 3. Check Serif Detection
    const serifTextItem = page.locator('.pdf-text-item', { hasText: 'Serif Text' });
    await serifTextItem.click();
    
    const serifFontFamily = await serifTextItem.evaluate(el => el.style.fontFamily);
    console.log('Detected serif font family:', serifFontFamily);
    expect(serifFontFamily).toContain('Times');
  });
});
