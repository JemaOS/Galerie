const { test, expect } = require('@playwright/test');

test.describe('PDF annotation text position', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app:not(.hidden)');
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles('test/fixtures/test-bg.pdf');
    await page.waitForSelector('#pdf-viewer:not(.hidden)');
    await page.waitForSelector('.pdf-page-canvas');
    await page.click('#pdf-edit-mode');
    await page.click('#pdf-edit-toolbar button[data-tool="text"]');
    await page.waitForSelector('.annotation-canvas');
  });

  async function dragAndMeasure(page, x1, y1, x2, y2, label) {
    await page.mouse.move(x1, y1);
    await page.mouse.down();
    await page.mouse.move(x2, y2, { steps: 5 });

    // Mesure l'encadré pendant le tracé
    const box = await page.evaluate(() => {
      const box = document.querySelector('.pdf-page-wrapper div[style*="dashed"]');
      if (!box) return null;
      const r = box.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    await page.mouse.up();

    if (!box) {
      console.log(`[${label}] ENCADRÉ INTROUVABLE pendant le tracé`);
      return { found: false };
    }

    const errX = box.left - x1;
    const errY = box.top - y1;
    const errW = box.width - (x2 - x1);
    const errH = box.height - (y2 - y1);
    console.log(`[${label}] tracé(${x1},${y1})→(${x2},${y2}) | encadré left=${box.left.toFixed(1)} top=${box.top.toFixed(1)} w=${box.width.toFixed(1)} h=${box.height.toFixed(1)} | erreur: dx=${errX.toFixed(1)} dy=${errY.toFixed(1)} dw=${errW.toFixed(1)} dh=${errH.toFixed(1)}`);
    return { found: true, errX, errY, errW, errH };
  }

  test('encadré suit le pointeur à zoom 1', async ({ page }) => {
    const r = await dragAndMeasure(page, 400, 300, 600, 380, 'zoom1');
    expect(r.found).toBe(true);
    expect(Math.abs(r.errX)).toBeLessThan(3);
    expect(Math.abs(r.errY)).toBeLessThan(3);
    expect(Math.abs(r.errW)).toBeLessThan(3);
    expect(Math.abs(r.errH)).toBeLessThan(3);
  });

  test('encadré suit le pointeur à zoom 2', async ({ page }) => {
    // Zoom 2x via boutons (10 clics de +10%)
    for (let i = 0; i < 7; i++) await page.click('#pdf-edit-zoom-in');
    await page.waitForTimeout(600);
    const zoom = await page.locator('#pdf-zoom-level').textContent();
    console.log('niveau zoom:', zoom);

    const r = await dragAndMeasure(page, 500, 350, 700, 450, 'zoom~2');
    expect(r.found).toBe(true);
    expect(Math.abs(r.errX)).toBeLessThan(3);
    expect(Math.abs(r.errY)).toBeLessThan(3);
    expect(Math.abs(r.errW)).toBeLessThan(3);
    expect(Math.abs(r.errH)).toBeLessThan(3);
  });

  test('outils actifs après re-render qualité (zoom > 1.8)', async ({ page }) => {
    for (let i = 0; i < 10; i++) await page.click('#pdf-edit-zoom-in');
    await page.waitForTimeout(1200); // laisse le re-render qualité se faire

    const stillThere = await page.evaluate(() => {
      const c = document.querySelector('.annotation-canvas');
      return !!c && document.contains(c);
    });
    console.log('annotation-canvas présent après re-render:', stillThere);
    expect(stillThere).toBe(true);

    const r = await dragAndMeasure(page, 500, 350, 700, 450, 'zoom>1.8');
    expect(r.found).toBe(true);
    expect(Math.abs(r.errX)).toBeLessThan(4);
    expect(Math.abs(r.errY)).toBeLessThan(4);
  });
});
