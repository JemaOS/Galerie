const AnnotationManager = require('../../scripts/annotation-manager.js');

describe('AnnotationManager shape preview dirty-rect', () => {
  let mgr;
  beforeEach(() => {
    mgr = new AnnotationManager(null);
  });

  const canvas = { width: 5700, height: 8000 };

  test('_shapePreviewRect pads a line by its width and stays small', () => {
    const r = mgr._shapePreviewRect({ x: 1000, y: 2000 }, { x: 1100, y: 2050 }, 'line', 4, canvas);
    // ~100x50 plus padding on each side, nowhere near the full 5700x8000 canvas.
    expect(r.w).toBeGreaterThanOrEqual(100);
    expect(r.w).toBeLessThan(120);
    expect(r.h).toBeGreaterThanOrEqual(50);
    expect(r.h).toBeLessThan(70);
    expect(r.w * r.h).toBeLessThan(canvas.width * canvas.height / 100);
  });

  test('_shapePreviewRect reserves room for the arrow head', () => {
    const line = mgr._shapePreviewRect({ x: 500, y: 500 }, { x: 600, y: 500 }, 'line', 8, canvas);
    const arrow = mgr._shapePreviewRect({ x: 500, y: 500 }, { x: 600, y: 500 }, 'arrow', 8, canvas);
    expect(arrow.w).toBeGreaterThan(line.w);
  });

  test('_shapePreviewRect clamps to the canvas bounds', () => {
    const topLeft = mgr._shapePreviewRect({ x: 2, y: 2 }, { x: -50, y: -50 }, 'rect', 4, canvas);
    expect(topLeft.x).toBe(0);
    expect(topLeft.y).toBe(0);
    const bottomRight = mgr._shapePreviewRect({ x: 5698, y: 7998 }, { x: 9000, y: 9000 }, 'rect', 4, canvas);
    expect(bottomRight.x + bottomRight.w).toBeLessThanOrEqual(canvas.width);
    expect(bottomRight.y + bottomRight.h).toBeLessThanOrEqual(canvas.height);
  });

  test('_unionRect covers both rects (used to erase previous + new preview)', () => {
    const a = { x: 10, y: 10, w: 20, h: 20 };
    const b = { x: 100, y: 50, w: 30, h: 10 };
    expect(mgr._unionRect(a, b)).toEqual({ x: 10, y: 10, w: 120, h: 50 });
    expect(mgr._unionRect(null, b)).toBe(b);
    expect(mgr._unionRect(a, null)).toBe(a);
  });

  test('drawShapePreview only touches the dirty rect, not the whole canvas', () => {
    const calls = [];
    const ctx = {
      clearRect: (...args) => calls.push(['clearRect', ...args]),
      drawImage: (...args) => calls.push(['drawImage', ...args]),
    };
    mgr.activeCanvas = canvas;
    mgr.ctx = ctx;
    mgr.shapeStart = { x: 1000, y: 1000 };
    mgr.currentTool = 'line';
    mgr.currentColor = '#fff';
    mgr.currentSize = 4;
    mgr.shapeSnapshot = { width: 5700, height: 8000 }; // stands in for the snapshot canvas
    mgr.drawShape = () => {}; // isolate the clear/restore behaviour

    mgr.drawShapePreview({ x: 1050, y: 1080 });
    const clear = calls.find(c => c[0] === 'clearRect');
    expect(clear).toBeTruthy();
    // clearRect(x, y, w, h): neither dimension is the full canvas
    expect(clear[3]).toBeLessThan(canvas.width);
    expect(clear[4]).toBeLessThan(canvas.height);
    // the snapshot is restored with source AND destination rects (dirty region)
    const blit = calls.find(c => c[0] === 'drawImage');
    expect(blit.length).toBe(10); // ctx.drawImage(img, sx,sy,sw,sh, dx,dy,dw,dh)
  });

  test('drawShapePreview expands the dirty rect when the pointer moves far', () => {
    const calls = [];
    const ctx = {
      clearRect: (...args) => calls.push(['clearRect', ...args]),
      drawImage: () => {},
    };
    mgr.activeCanvas = canvas;
    mgr.ctx = ctx;
    mgr.shapeStart = { x: 1000, y: 1000 };
    mgr.currentTool = 'line';
    mgr.currentColor = '#fff';
    mgr.currentSize = 4;
    mgr.shapeSnapshot = { width: 5700, height: 8000 };
    mgr.drawShape = () => {};

    mgr.drawShapePreview({ x: 1050, y: 1000 });
    mgr.drawShapePreview({ x: 3000, y: 1000 }); // far away
    const clears = calls.filter(c => c[0] === 'clearRect');
    // second clear must cover from the old preview position to the new one
    expect(clears[1][1]).toBeLessThanOrEqual(1000);
    expect(clears[1][3]).toBeGreaterThan(1900);
    // still never the whole canvas
    expect(clears[1][3]).toBeLessThan(canvas.width);
  });
});