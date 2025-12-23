# Windows PWA File Association Icons - Technical Analysis

## Executive Summary

Windows 11 is showing generic white icons for files associated with the Galerie PWA (.flac, .pdf, etc.) despite having PNG icons configured in the manifest's `file_handlers`. This document analyzes the root cause and provides a concrete implementation plan.

---

## 1. How Windows Handles PWA File Association Icons

### The Windows Shell Icon System

Windows uses a specific icon resolution system for file associations:

1. **Registry-Based**: File associations are stored in the Windows Registry under:
   - `HKEY_CURRENT_USER\Software\Classes\<extension>`
   - `HKEY_CLASSES_ROOT\<extension>`

2. **Icon Format Requirements**: Windows Shell expects icons in specific formats:
   - **ICO format** is the native Windows icon format
   - **PNG** can work but must be embedded in specific ways
   - Icons must include multiple sizes in a single .ico file

3. **Required Icon Sizes for Windows**:
   - 16x16 - Small icons in lists
   - 24x24 - Medium icons
   - 32x32 - Default icon size
   - 48x48 - Large icons
   - 64x64 - Extra large
   - 256x256 - Jumbo icons and thumbnails

### How Chromium PWAs Register File Handlers on Windows

When a PWA with `file_handlers` is installed:

1. Chromium creates a **ProgID** in the registry for the PWA
2. It registers file extensions under `HKEY_CURRENT_USER\Software\Classes`
3. The icon path is set to point to the PWA's icon

**Critical Issue**: Chromium's current implementation has limitations in how it handles file handler icons on Windows.

---

## 2. Known Limitations - Chromium Bug Analysis

### Primary Issue: Chromium Bug #1162671

There is a **known Chromium bug** regarding PWA file handler icons on Windows:

- **Bug**: [chromium.googlesource.com - File Handler Icons](https://bugs.chromium.org/p/chromium/issues/detail?id=1162671)
- **Status**: The file_handlers icons array is not fully implemented on Windows
- **Behavior**: Windows falls back to the main PWA icon or shows generic icons

### What Actually Happens

1. The `icons` array inside `file_handlers` is **parsed but not used** for Windows file associations
2. Windows uses the **main PWA icon** from the top-level `icons` array
3. If the main icon format is not compatible, Windows shows a generic icon

### Current Chromium Behavior

```
file_handlers.icons → NOT USED for Windows file associations
manifest.icons → Used, but format/size may not be compatible
```

---

## 3. Root Cause Analysis for Galerie

Looking at the current [`manifest.json`](manifest.json):

### Current Icon Configuration

```json
"icons": [
  { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml" },
  { "src": "icons/icon-192x192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "icons/icon-256x256.png", "sizes": "256x256", "type": "image/png" }
]
```

### Problems Identified

1. **Missing Small Sizes**: No 16x16, 32x32, or 48x48 icons
2. **No ICO Format**: Windows prefers .ico files for file associations
3. **SVG Primary**: SVG is listed first but Windows Shell doesn't support SVG
4. **Purpose Attribute**: Using `"purpose": "any maskable"` may cause issues

---

## 4. Possible Solutions

### Solution A: Add Required PNG Sizes (Partial Fix)

Add smaller PNG sizes that Windows can use:
- 16x16, 32x32, 48x48, 64x64

**Pros**: Simple to implement
**Cons**: May not fully resolve the issue due to Chromium limitations

### Solution B: Create ICO File (Recommended)

Create a multi-resolution .ico file containing all required sizes.

**Pros**: Native Windows format, best compatibility
**Cons**: Requires additional tooling

### Solution C: Reinstall PWA After Icon Changes

After any icon changes, the PWA must be:
1. Uninstalled completely
2. Browser cache cleared
3. Reinstalled fresh

**Critical**: Windows caches file association icons aggressively.

---

## 5. Concrete Implementation Plan

### Phase 1: Create Required Icon Files

#### Step 1.1: Generate Additional PNG Sizes

Create these additional PNG files from the existing SVG:
- `icons/icon-16x16.png`
- `icons/icon-32x32.png`
- `icons/icon-48x48.png`
- `icons/icon-64x64.png`

#### Step 1.2: Create ICO File

Create `icons/icon.ico` containing all sizes:
- 16x16
- 32x32
- 48x48
- 64x64
- 128x128
- 256x256

**Tool Options**:
- Use `png-to-ico` npm package
- Use ImageMagick: `convert icon-*.png icon.ico`
- Use online converter

### Phase 2: Update manifest.json

#### Step 2.1: Update Main Icons Array

```json
"icons": [
  {
    "src": "icons/icon-16x16.png",
    "sizes": "16x16",
    "type": "image/png"
  },
  {
    "src": "icons/icon-32x32.png",
    "sizes": "32x32",
    "type": "image/png"
  },
  {
    "src": "icons/icon-48x48.png",
    "sizes": "48x48",
    "type": "image/png"
  },
  {
    "src": "icons/icon-64x64.png",
    "sizes": "64x64",
    "type": "image/png"
  },
  {
    "src": "icons/icon-192x192.png",
    "sizes": "192x192",
    "type": "image/png"
  },
  {
    "src": "icons/icon-256x256.png",
    "sizes": "256x256",
    "type": "image/png"
  },
  {
    "src": "icons/icon-512x512.png",
    "sizes": "512x512",
    "type": "image/png"
  },
  {
    "src": "icons/icon.svg",
    "sizes": "any",
    "type": "image/svg+xml",
    "purpose": "any"
  }
]
```

**Key Changes**:
1. PNG icons listed first (before SVG)
2. Added small sizes (16, 32, 48, 64)
3. Removed `maskable` from PNG icons
4. SVG moved to end as fallback

#### Step 2.2: Update file_handlers Icons

Update each file_handler to include small sizes:

```json
"icons": [
  { "src": "icons/icon-32x32.png", "sizes": "32x32", "type": "image/png" },
  { "src": "icons/icon-48x48.png", "sizes": "48x48", "type": "image/png" },
  { "src": "icons/icon-64x64.png", "sizes": "64x64", "type": "image/png" },
  { "src": "icons/icon-256x256.png", "sizes": "256x256", "type": "image/png" }
]
```

### Phase 3: Update Icon Generation Script

Modify [`scripts/generate-icons.js`](scripts/generate-icons.js:1) to:

1. Generate all required sizes
2. Optionally create ICO file

```javascript
const icons = [
  { input: 'icons/icon.svg', output: 'icons/icon-16x16.png', size: 16 },
  { input: 'icons/icon.svg', output: 'icons/icon-32x32.png', size: 32 },
  { input: 'icons/icon.svg', output: 'icons/icon-48x48.png', size: 48 },
  { input: 'icons/icon.svg', output: 'icons/icon-64x64.png', size: 64 },
  { input: 'icons/icon.svg', output: 'icons/icon-128x128.png', size: 128 },
  { input: 'icons/icon-192x192.svg', output: 'icons/icon-192x192.png', size: 192 },
  { input: 'icons/icon.svg', output: 'icons/icon-256x256.png', size: 256 },
  { input: 'icons/icon-512x512.svg', output: 'icons/icon-512x512.png', size: 512 }
];
```

### Phase 4: Add ICO Generation (Optional but Recommended)

Install `png-to-ico` package and add ICO generation:

```bash
npm install --save-dev png-to-ico
```

Add to generate-icons.js:
```javascript
const pngToIco = require('png-to-ico');

// After generating PNGs, create ICO
const icoSources = [
  'icons/icon-16x16.png',
  'icons/icon-32x32.png',
  'icons/icon-48x48.png',
  'icons/icon-64x64.png',
  'icons/icon-128x128.png',
  'icons/icon-256x256.png'
];

pngToIco(icoSources)
  .then(buf => fs.writeFileSync('icons/icon.ico', buf))
  .catch(console.error);
```

### Phase 5: Reinstall PWA

**Critical Steps**:

1. **Uninstall the existing PWA**:
   - Open Chrome/Edge
   - Go to `chrome://apps` or `edge://apps`
   - Right-click Galerie → Remove
   - Check "Also clear data"

2. **Clear Icon Cache** (Windows):
   ```cmd
   ie4uinit.exe -show
   ```
   Or restart Windows Explorer:
   ```cmd
   taskkill /f /im explorer.exe && start explorer.exe
   ```

3. **Reinstall the PWA**:
   - Navigate to the app URL
   - Install via browser prompt

---

## 6. Verification Steps

After implementation:

1. Check Windows Registry:
   ```
   HKEY_CURRENT_USER\Software\Classes\Applications\<pwa-id>
   ```

2. Verify file associations:
   - Right-click a .flac file → Properties
   - Check "Opens with" shows Galerie with correct icon

3. Test icon display:
   - View files in Explorer with different view modes
   - Small icons, Medium icons, Large icons, Extra large icons

---

## 7. Alternative Workarounds

If the above doesn't work due to Chromium limitations:

### Workaround A: Manual Registry Fix

Create a .reg file to manually set icons:
```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Classes\.flac\DefaultIcon]
@="C:\\path\\to\\icon.ico"
```

### Workaround B: Wait for Chromium Fix

Monitor Chromium bug tracker for updates to file_handlers icon support.

### Workaround C: Use Native App Wrapper

Consider wrapping the PWA with Electron or Tauri for full Windows integration.

---

## 8. Summary of Required Changes

| Task | Priority | Complexity |
|------|----------|------------|
| Generate 16x16, 32x32, 48x48, 64x64 PNGs | High | Low |
| Update manifest.json icons array | High | Low |
| Create ICO file | Medium | Low |
| Update generate-icons.js script | Medium | Medium |
| Reinstall PWA and clear cache | High | Low |

---

## 9. Files to Modify

1. **`icons/`** - Add new icon files:
   - icon-16x16.png
   - icon-32x32.png
   - icon-48x48.png
   - icon-64x64.png
   - icon-128x128.png
   - icon.ico (optional)

2. **`manifest.json`** - Update icons array and file_handlers

3. **`scripts/generate-icons.js`** - Add new sizes and ICO generation

4. **`package.json`** - Add png-to-ico dependency (if using ICO)

---

## 10. Expected Outcome

After implementing these changes:

- Windows Explorer should display the Galerie icon for associated files
- Icons should appear correctly at all zoom levels
- File type associations should show proper icons in "Open with" dialogs

**Note**: Due to Chromium's current limitations, 100% success is not guaranteed. The file_handlers icons feature is still evolving, and Windows integration may improve in future Chrome/Edge updates.
