const { chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

/**
 * Generate PNG icons from SVG sources at various sizes
 * Also generates ICO file for Windows file association support
 */
async function generateIcons() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // All icon sizes needed for PWA and Windows file associations
  // Windows requires: 16, 24, 32, 48, 64, 256 for proper file association icons
  const icons = [
    // Small sizes for Windows file associations
    { input: 'icons/icon.svg', output: 'icons/icon-16x16.png', size: 16 },
    { input: 'icons/icon.svg', output: 'icons/icon-24x24.png', size: 24 },
    { input: 'icons/icon.svg', output: 'icons/icon-32x32.png', size: 32 },
    { input: 'icons/icon.svg', output: 'icons/icon-48x48.png', size: 48 },
    { input: 'icons/icon.svg', output: 'icons/icon-64x64.png', size: 64 },
    { input: 'icons/icon.svg', output: 'icons/icon-128x128.png', size: 128 },
    
    // Standard PWA sizes
    { input: 'icons/icon-192x192.svg', output: 'icons/icon-192x192.png', size: 192 },
    { input: 'icons/icon.svg', output: 'icons/icon-256x256.png', size: 256 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-512x512.png', size: 512 }
  ];

  console.log('Generating PNG icons...\n');

  for (const icon of icons) {
    const page = await context.newPage();
    const inputPath = path.resolve(process.cwd(), icon.input);
    const outputPath = path.resolve(process.cwd(), icon.output);
    
    console.log(`Converting ${icon.input} to ${icon.output} (${icon.size}x${icon.size})...`);
    
    // Load the SVG file
    await page.goto(`file://${inputPath}`);
    
    // Set viewport to match icon size
    await page.setViewportSize({ width: icon.size, height: icon.size });
    
    // Take screenshot
    // omitBackground: true is used to preserve transparency if the SVG has a transparent background
    await page.screenshot({ path: outputPath, omitBackground: true });
    
    console.log(`  ✓ Generated ${icon.output}`);
    await page.close();
  }

  await browser.close();
  console.log('\nPNG icon generation complete!');
  
  // Generate ICO file for Windows
  await generateIcoFile();
}

/**
 * Generate ICO file from PNG sources for Windows file associations
 * ICO files can contain multiple sizes, which Windows uses for different contexts
 */
async function generateIcoFile() {
  console.log('\nGenerating ICO file for Windows...');
  
  try {
    // Try to use png-to-ico if available
    const { default: pngToIco } = require('png-to-ico');
    
    // ICO should contain these sizes for best Windows compatibility
    const icoSources = [
      'icons/icon-16x16.png',
      'icons/icon-24x24.png',
      'icons/icon-32x32.png',
      'icons/icon-48x48.png',
      'icons/icon-64x64.png',
      'icons/icon-128x128.png',
      'icons/icon-256x256.png'
    ].map(p => path.resolve(process.cwd(), p));
    
    // Verify all source files exist
    const missingFiles = icoSources.filter(f => !fs.existsSync(f));
    if (missingFiles.length > 0) {
      console.error('Missing PNG files for ICO generation:', missingFiles);
      console.log('Skipping ICO generation. Run PNG generation first.');
      return;
    }
    
    const buf = await pngToIco(icoSources);
    const icoPath = path.resolve(process.cwd(), 'icons/icon.ico');
    fs.writeFileSync(icoPath, buf);
    
    console.log('  ✓ Generated icons/icon.ico');
    console.log('\nICO file generation complete!');
    
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log('\n⚠ png-to-ico package not found.');
      console.log('To generate ICO files, install it with:');
      console.log('  npm install --save-dev png-to-ico');
      console.log('\nThen run this script again.');
    } else {
      console.error('Error generating ICO file:', err);
    }
  }
}

// Main execution
generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
