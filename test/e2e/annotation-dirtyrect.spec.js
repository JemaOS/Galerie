const { test, expect } = require('@playwright/test');

// Real-canvas integration test for the shape preview dirty-rect: the preview must
// restore only the touched region from the snapshot and leave the rest intact.
test.describe('Annotation shape preview (dirty-rect)', () => {
  test('restores pixels outside the dirty rect from the snapshot', async ({ page }) => {
    await page.goto('/');
    // annotation-manager is lazy-loaded by the app; load it directly for the test.
    await page.addScriptTag({ url: 'scripts/annotation-manager.js' });
    await page.waitForFunction(() => !!globalThis.AnnotationManager, null, { timeout: 15000 });

    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 300;
      const ctx = canvas.getContext('2d');
      // Background: solid green everywhere.
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, 400, 300);

      // Snapshot of the current (green) canvas.
      const snap = document.createElement('canvas');
      snap.width = 400; snap.height = 300;
      snap.getContext('2d').drawImage(canvas, 0, 0);

      const mgr = new globalThis.AnnotationManager(null);
      mgr.activeCanvas = canvas;
      mgr.ctx = ctx;
      mgr.currentTool = 'rect';
      mgr.currentColor = '#ff0000';
      mgr.currentSize = 4;
      mgr.shapeSnapshot = snap;
      mgr.shapeStart = { x: 100, y: 100 };

      // Draw a preview, then move it far away; the old area must be restored.
      mgr.drawShapePreview({ x: 150, y: 140 });
      mgr.drawShapePreview({ x: 300, y: 250 });

      const px = (x, y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      return {
        // far from any rect -> must still be untouched background
        farAway: px(5, 5),
        // where the first preview was, now restored -> background again
        restored: px(120, 115),
        // the current shape's stroke should be red somewhere on its top edge
        inside: px(300, 250),
      };
    });

    // background (green) untouched far from the shape
    expect(result.farAway[1]).toBeGreaterThan(200);
    // the abandoned preview area was restored to background
    expect(result.restored[1]).toBeGreaterThan(200);
  });

  test('drawing a shape pushes one history action and undo/redo keep it consistent', async ({ page }) => {
    await page.goto('/');
    // annotation-manager is lazy-loaded by the app; load it directly for the test.
    await page.addScriptTag({ url: 'scripts/annotation-manager.js' });
    await page.waitForFunction(() => !!globalThis.AnnotationManager, null, { timeout: 15000 });

    const result = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 500; canvas.height = 400;
      const ctx = canvas.getContext('2d');

      const mgr = new globalThis.AnnotationManager(null);
      mgr.options = {}; // start() normally sets this
      // Minimal page so addAction/redrawPage have a target.
      mgr.pages.set('p', { canvas, ctx, id: 'p', container: document.createElement('div') });
      mgr.activeCanvas = canvas;
      mgr.ctx = ctx;
      mgr.findPageIdByCanvas = () => 'p';
      mgr.history = [];
      mgr.historyStep = -1;

      // Simulate a completed shape gesture.
      mgr.isDrawing = true;
      mgr.currentTool = 'line';
      mgr.currentColor = '#ff0000';
      mgr.currentSize = 4;
      mgr.shapeStart = { x: 50, y: 50 };
      mgr.shapeEnd = { x: 200, y: 200 };
      mgr.handleShapeEnd();

      const afterDraw = mgr.history.length;
      mgr.undo();
      const afterUndo = mgr.historyStep;
      mgr.redo();
      const afterRedo = mgr.historyStep;
      return { afterDraw, afterUndo, afterRedo, type: mgr.history[0] && mgr.history[0].type };
    });

    expect(result.afterDraw).toBe(1);
    expect(result.type).toBe('shape');
    expect(result.afterUndo).toBe(-1);
    expect(result.afterRedo).toBe(0);
  });
});