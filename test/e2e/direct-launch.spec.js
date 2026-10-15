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

  test('viewer content fades in (animation applied to file elements)', async ({ page }) => {
    await installLaunchQueue(page, jpegBase64);
    await page.goto('/', { waitUntil: 'load' });
    await page.waitForSelector('.viewer-media img.viewer-image', { timeout: 10000 });
    const anim = await page.evaluate(() => {
      const el = document.querySelector('.viewer-media > *');
      const cs = getComputedStyle(el);
      return cs.animationName;
    });
    expect(anim).toContain('viewerContentIn');
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
});