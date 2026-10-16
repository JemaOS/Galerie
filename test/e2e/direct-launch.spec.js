const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

// A tiny real JPEG so the File Handling launch can actually decode and display.
let jpegBase64;
test.beforeAll(async () => {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 100, b: 50 } } })
    .jpeg()
    .toBuffer();
  jpegBase64 = buf.toString('base64');
});

async function installLaunchQueue(page, base64) {
  await page.addInitScript((b64) => {
    const q = {
      setConsumer: (cb) => {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const file = new File([u8], 'photo.jpg', { type: 'image/jpeg' });
        Promise.resolve().then(() => cb({ files: [file] }));
      },
    };
    Object.defineProperty(window, 'launchQueue', { value: q, configurable: true, writable: true });
  }, base64);
}

// Simulate the real JemaOS timing: the app runs as an installed (windowed)
// PWA and the File Handling API delivers the file only after a delay, well after
// a microtask. The launch decision must wait for it instead of revealing the
// home page. `standalone: false` models a windowed launch that does NOT report
// the `standalone` display mode (the case that used to flash the home page).
async function installDelayedLaunchQueue(page, base64, delayMs, { standalone = true } = {}) {
  await page.addInitScript(({ b64, delay, isStandalone }) => {
    const nativeMatchMedia = window.matchMedia.bind(window);
    window.matchMedia = (query) => {
      const q = String(query);
      const isDisplayMode = q.includes('display-mode:');
      if (isDisplayMode) {
        const wanted = q.includes('display-mode: standalone') ? isStandalone : false;
        return {
          matches: wanted,
          media: query,
          addEventListener() {}, removeEventListener() {},
          addListener() {}, removeListener() {},
        };
      }
      return nativeMatchMedia(query);
    };

    const q = {
      setConsumer: (cb) => {
        const bin = atob(b64);
        const u8 = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
        const file = new File([u8], 'photo.jpg', { type: 'image/jpeg' });
        setTimeout(() => cb({ files: [file] }), delay);
      },
    };
    Object.defineProperty(window, 'launchQueue', { value: q, configurable: true, writable: true });
  }, { b64: base64, delay: delayMs, isStandalone: standalone });
}

// Records whether #app (or the language selector, which lives outside #app)
// became visible, from the first paint onwards. Flagging only starts once the
// stylesheet is applied (detected by #app being hidden by CSS), so the pre-CSS
// default `display` is not a false positive.
async function watchAppVisibility(page) {
  await page.addInitScript(() => {
    window.__appEverVisible = false;
    window.__selectorEverVisible = false;
    let cssReady = false;
    const check = () => {
      const app = document.getElementById('app');
      if (!app) return;
      const appDisplay = getComputedStyle(app).display;
      if (!cssReady) {
        if (appDisplay === 'none') cssReady = true;
        return;
      }
      if (appDisplay !== 'none') window.__appEverVisible = true;
      const sel = document.getElementById('language-selector');
      if (sel && getComputedStyle(sel).display !== 'none') window.__selectorEverVisible = true;
    };
    const start = () => {
      check();
      const mo = new MutationObserver(check);
      mo.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
      setInterval(check, 5);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  });
}

test.describe('Direct file launch', () => {
  test('opening a file never shows the home page and fades in the viewer', async ({ page }) => {
    await installLaunchQueue(page, jpegBase64);
    await page.goto('/', { waitUntil: 'load' });

    // The viewer becomes active and the app enters "launching" mode.
    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForFunction(() => document.getElementById('fullscreen-viewer').classList.contains('active'), null, { timeout: 10000 });

    // Home page must be kept hidden while launching.
    const appDisplay = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display);
    expect(appDisplay).toBe('none');

    // ...and it must stay hidden once the image is shown.
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    const appDisplayAfter = await page.evaluate(() => getComputedStyle(document.getElementById('app')).display);
    expect(appDisplayAfter).toBe('none');
  });

  test('viewer content appears immediately: no fade-in and no fade-up from black', async ({ page }) => {
    await installLaunchQueue(page, jpegBase64);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    const state = await page.evaluate(() => {
      const media = document.querySelector('.viewer-media > *');
      const viewer = document.getElementById('fullscreen-viewer');
      return {
        contentAnimation: getComputedStyle(media).animationName,
        contentOpacity: getComputedStyle(media).opacity,
        viewerTransitionDuration: getComputedStyle(viewer).transitionDuration,
        viewerOpacity: getComputedStyle(viewer).opacity,
      };
    });
    // No content fade-in...
    expect(state.contentAnimation).toBe('none');
    expect(Number(state.contentOpacity)).toBe(1);
    // ...and the viewer is shown at once: its fade-up transition is disabled
    // during a direct launch, so there is no black fade before the file.
    expect(Number(state.viewerOpacity)).toBe(1);
    expect(state.viewerTransitionDuration).toBe('0s');
  });

  test('the home page is never shown during a direct launch (no flash)', async ({ page }) => {
    // Flag if #app ever becomes visible, from the first paint until well after
    // the launch settles. A premature reveal (e.g. during component init) shows
    // the home page for a frame before the viewer, which is what flashing is.
    await watchAppVisibility(page);

    await installLaunchQueue(page, jpegBase64);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    await page.waitForTimeout(500);

    // Neither the home page nor the language selector (which is outside #app)
    // may ever have been visible.
    expect(await page.evaluate(() => window.__appEverVisible)).toBe(false);
    expect(await page.evaluate(() => window.__selectorEverVisible)).toBe(false);
  });

  test('a launch reported late (real JemaOS timing) still avoids the home flash', async ({ page }) => {
    await watchAppVisibility(page);
    await installDelayedLaunchQueue(page, jpegBase64, 300);
    await page.goto('/', { waitUntil: 'load' });

    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => window.__appEverVisible)).toBe(false);
  });

  test('a late launch in a windowed mode that is NOT standalone still avoids the home flash', async ({ page }) => {
    // The old gate only waited for standalone/minimal-ui/overlay, so any other
    // windowed mode revealed the home page before the file. It must not.
    await watchAppVisibility(page);
    await installDelayedLaunchQueue(page, jpegBase64, 300, { standalone: false });
    await page.goto('/', { waitUntil: 'load' });

    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => window.__appEverVisible)).toBe(false);
  });

  test('a normal launch (no file) still shows the home page', async ({ page }) => {
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForFunction(() => !!globalThis.galleryUI, null, { timeout: 15000 });
    await page.waitForTimeout(300);
    const state = await page.evaluate(() => ({
      launching: document.body.classList.contains('launching'),
      appDisplay: getComputedStyle(document.getElementById('app')).display,
      viewerActive: document.getElementById('fullscreen-viewer').classList.contains('active'),
    }));
    expect(state.launching).toBe(false);
    expect(state.appDisplay).not.toBe('none');
    expect(state.viewerActive).toBe(false);
  });

  test('an update notification is visible during a direct launch (not hidden with #app)', async ({ page }) => {
    await installLaunchQueue(page, jpegBase64);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });

    // Simulate an "update available" toast while the app is in launch mode.
    const visible = await page.evaluate(() => {
      const tc = document.getElementById('toast-container');
      const toast = document.createElement('div');
      toast.className = 'toast info update-notification';
      toast.textContent = 'update';
      tc.appendChild(toast);
      const rect = toast.getBoundingClientRect();
      return {
        appHidden: getComputedStyle(document.getElementById('app')).display === 'none',
        toastContainerInApp: !!tc.closest('#app'),
        toastVisible: rect.width > 0 && rect.height > 0,
      };
    });

    // #app is hidden (direct launch) but the toast is outside it and therefore visible.
    expect(visible.appHidden).toBe(true);
    expect(visible.toastContainerInApp).toBe(false);
    expect(visible.toastVisible).toBe(true);
  });

  test('opening on the file route (/open) never shows the home page, even when the file arrives late', async ({ page }) => {
    await watchAppVisibility(page);
    // The file handle is delivered well after the first paint (as after a
    // permission prompt), beyond the non-route wait: the route alone must keep
    // the home page hidden.
    await installDelayedLaunchQueue(page, jpegBase64, 4000);

    // `serve` has no SPA fallback: serve index.html for /open like Vercel's rewrite.
    await page.route('**/open', route => route.fulfill({
      path: path.join(__dirname, '..', '..', 'index.html'),
      contentType: 'text/html',
    }));

    await page.goto('/open', { waitUntil: 'load' });
    await page.waitForFunction(() => document.body.classList.contains('launching'), null, { timeout: 10000 });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => window.__appEverVisible)).toBe(false);
  });
});