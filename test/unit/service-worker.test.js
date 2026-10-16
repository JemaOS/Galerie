const fs = require('node:fs');
const path = require('node:path');

// The service worker must let a new deployment reach users without a manual
// version bump: documents are network-first and every other same-origin asset is
// stale-while-revalidate. A cache-first strategy for scripts/styles silently
// served the previous JS/CSS forever, so a deploy could ship new HTML while the
// app still ran old code and never surfaced an update.
describe('sw.js caching strategy', () => {
  const sw = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');

  test('documents are routed to networkFirst', () => {
    expect(sw).toMatch(/isDocument/);
    expect(sw).toMatch(/if \(isDocument && !isFileRoute\)\s*\{\s*event\.respondWith\(networkFirst\(/);
  });

  test('the file-handler route is served stale-while-revalidate for instant opens', () => {
    expect(sw).toMatch(/isFileRoute/);
    expect(sw).toMatch(/isDocument && !isFileRoute/);
  });

  test('static assets use stale-while-revalidate, not cache-first', () => {
    expect(sw).toMatch(/async function refreshFromNetwork\(/);
    expect(sw).toMatch(/async function serveStale\(/);
    expect(sw).toMatch(/event\.respondWith\(serveStale\(/);
    // The old behaviour must be gone.
    expect(sw).not.toMatch(/async function cacheFirst\(/);
  });

  test('revalidation bypasses the HTTP cache so fresh bytes win', () => {
    // Both the network-first and the revalidation path must revalidate.
    const noCache = sw.match(/fetch\(request, \{ cache: 'no-cache' \}\)/g) || [];
    expect(noCache.length).toBeGreaterThanOrEqual(2);
  });

  test('the worker still waits (update is proposed, not silently applied)', () => {
    // install must NOT call skipWaiting: a waiting worker is what triggers the
    // in-app "update available" prompt.
    const install = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('activate'"));
    expect(install).not.toMatch(/skipWaiting/);
    // ...and the prompt's acceptance path must still be handled.
    expect(sw).toMatch(/SKIP_WAITING/);
    expect(sw).toMatch(/skipWaiting\(\)/);
  });

  test('CACHE_NAME stays namespaced and was bumped for this change', () => {
    const m = sw.match(/const CACHE_NAME = '([^']+)';/);
    expect(m).toBeTruthy();
    expect(m[1]).toMatch(/^jemaos-gallery-v\d+\.\d+\.\d+$/);
    expect(m[1]).not.toBe('jemaos-gallery-v1.6.1');
  });
});
