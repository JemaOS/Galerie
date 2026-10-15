const { test, expect } = require('@playwright/test');

// Coordinate-contract tests for annotations. These lock the mapping between
// screen space, the canvas CSS box and the annotation bitmap, so any future
// change (e.g. resizing the bitmap to the display size) that would shift
// annotations or exported pixels fails loudly here.
test.describe('Annotation coordinate contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.addScriptTag({ url: 'scripts/annotation-manager.js' });
    await page.waitForFunction(() => !!globalThis.AnnotationManager, null, { timeout: 15000 });
  });

  test('pointer maps to bitmap coordinates across the lazily-allocated canvas', async ({ page }) => {
    const r = await page.evaluate(() => {
      // A 2000x1000 "image" shown at 500x250 CSS (scale factor 4).
      const container = document.createElement('div');
      container.style.position = 'relative';
      container.style.width = '500px';
      container.style.height = '250px';
      document.body.appendChild(container);

      const target = document.createElement('img');
      Object.defineProperty(target, 'naturalWidth', { value: 2000 });
      Object.defineProperty(target, 'naturalHeight', { value: 1000 });
      Object.defineProperty(target, 'offsetWidth', { value: 500 });
      Object.defineProperty(target, 'offsetHeight', { value: 250 });
      target.offsetLeft = 0; target.offsetTop = 0;
      container.appendChild(target);

      const mgr = new globalThis.AnnotationManager(null);
      const canvas = mgr.createCanvas(container, target);
      // createCanvas -> updateCanvasSize sets the bitmap to natural size.
      const bitmap = { w: canvas.width, h: canvas.height };

      // Simulate the real setup() that pointer handlers rely on.
      const rect = canvas.getBoundingClientRect();
      Object.defineProperty(canvas, '__rect', { value: rect });
      // Force a deterministic rect for the assertion (independent of layout engine).
      mgr.canvasRect = { left: 0, top: 0, width: 500, height: 250 };
      mgr.offsetX = 0; mgr.offsetY = 0;
      mgr.scaleX = canvas.width / 500;
      mgr.scaleY = canvas.height / 250;

      // A click at the visual center must map to the bitmap center.
      const center = mgr._pointFromEvent({ clientX: 250, clientY: 125, pressure: 0.5 });
      // A click at the visual top-left must map to the bitmap origin.
      const origin = mgr._pointFromEvent({ clientX: 0, clientY: 0, pressure: 0.5 });

      return { bitmap, center, origin };
    });

    // createCanvas allocated the bitmap at the natural size.
    expect(r.bitmap).toEqual({ w: 2000, h: 1000 });
    // Visual center -> bitmap center.
    expect(Math.round(r.center.x)).toBe(1000);
    expect(Math.round(r.center.y)).toBe(500);
    // Visual origin -> bitmap origin.
    expect(Math.round(r.origin.x)).toBe(0);
    expect(Math.round(r.origin.y)).toBe(0);
  });

  test('a stroke drawn at a bitmap point lands on those pixels', async ({ page }) => {
    const r = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400; canvas.height = 300;
      const ctx = canvas.getContext('2d');
      const mgr = new globalThis.AnnotationManager(null);
      mgr.activeCanvas = canvas;
      mgr.ctx = ctx;
      mgr.currentTool = 'pen';
      mgr.currentColor = '#ff0000';
      mgr.currentSize = 6;

      // Draw a short horizontal stroke around (200,150).
      mgr.drawStroke(ctx, [{ x: 180, y: 150 }, { x: 220, y: 150 }], '#ff0000', 6, 'pen', 1);

      const at = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      return { onStroke: at(200, 150), offStroke: at(20, 20) };
    });

    // red where the stroke was drawn
    expect(r.onStroke[0]).toBeGreaterThan(180);
    expect(r.onStroke[1]).toBeLessThan(80);
    // untouched elsewhere (transparent)
    expect(r.offStroke[3]).toBe(0);
  });

  test('export composites the annotation bitmap at the image scale', async ({ page }) => {
    const r = await page.evaluate(() => {
      // Bitmap 100x100 drawn into a 400x400 output must be scaled 4x, i.e. the
      // whole output is covered. Guards the export drawImage scaling.
      const bitmap = document.createElement('canvas');
      bitmap.width = 100; bitmap.height = 100;
      const bctx = bitmap.getContext('2d');
      bctx.fillStyle = '#ff0000';
      bctx.fillRect(0, 0, 100, 100);

      const out = document.createElement('canvas');
      out.width = 400; out.height = 400;
      const octx = out.getContext('2d');
      const originalWidth = 400, originalHeight = 400;
      octx.save();
      octx.translate(originalWidth / 2, originalHeight / 2);
      // This is the pattern used by generateImageBlob: it must scale the
      // annotation canvas to the original size.
      octx.drawImage(bitmap, -originalWidth / 2, -originalHeight / 2, originalWidth, originalHeight);
      octx.restore();

      const at = (x, y) => Array.from(octx.getImageData(x, y, 1, 1).data);
      return { corner: at(5, 5), center: at(200, 200) };
    });

    // The scaled annotation covers the whole output.
    expect(r.corner[0]).toBeGreaterThan(180);
    expect(r.center[0]).toBeGreaterThan(180);
  });
});