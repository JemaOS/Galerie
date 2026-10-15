const fs = require('node:fs');
const path = require('node:path');

// The toast container must NOT be inside #app: during a direct file launch the
// app sets body.launching, which hides #app. If the update / toast notification
// lived inside #app it would be invisible exactly when the user opens the app by
// double-clicking a file, so the "new version available" prompt would never be
// seen.
describe('index.html structure invariants', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8');

  function depthInsideApp(id) {
    const appIdx = html.indexOf('id="app"');
    const elIdx = html.indexOf(`id="${id}"`);
    if (appIdx === -1 || elIdx === -1) return null;
    const segment = html.slice(appIdx, elIdx);
    const opens = (segment.match(/<div/g) || []).length;
    const closes = (segment.match(/<\/div>/g) || []).length;
    return opens - closes;
  }

  test('#toast-container is a direct child of <body>, not nested in #app', () => {
    // depth 0 means the same nesting level as #app itself (i.e. outside #app).
    expect(depthInsideApp('toast-container')).toBe(0);
  });

  test('#toast-container is declared after #app and is not hidden by utility class', () => {
    expect(html.indexOf('id="toast-container"')).toBeGreaterThan(html.indexOf('id="app"'));
    const tag = html.match(/<div id="toast-container"[^>]*>/)[0];
    expect(tag).not.toContain('hidden');
  });

  test('the toast layers above the fullscreen viewer', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'styles', 'main.css'), 'utf8');
    const toastZ = css.match(/--z-toast:\s*(\d+)/);
    expect(toastZ).toBeTruthy();
    // fullscreen viewer uses z-index: 2000
    expect(Number(toastZ[1])).toBeGreaterThan(2000);
  });
});