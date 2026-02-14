import { chromium } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate PNG icons from SVG sources at various sizes
 * Also generates ICO files for Windows file association support
 */
async function generateIcons() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // All icon sizes needed for PWA and Windows file associations
  // Windows requires: 16, 24, 32, 48, 64, 256 for proper file association icons
  const icons = [
    // Small sizes for Windows file associations
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-16x16.png', size: 16 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-24x24.png', size: 24 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-32x32.png', size: 32 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-48x48.png', size: 48 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-64x64.png', size: 64 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-128x128.png', size: 128 },
    
    // Standard PWA sizes
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-192x192.png', size: 192 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-256x256.png', size: 256 },
    { input: 'icons/icon-512x512.svg', output: 'icons/icon-512x512.png', size: 512 }
  ];

  console.log('Generating PNG icons...\n');

  for (const icon of icons) {
    const page = await context.newPage();
    const inputPath = path.resolve(process.cwd(), icon.input);
    const outputPath = path.resolve(process.cwd(), icon.output);
    
    console.log(`Converting ${icon.input} to ${icon.output} (${icon.size}x${icon.size})...`);
    
    // Read the SVG content
    const svgContent = fs.readFileSync(inputPath, 'utf8');
    
    // Create an HTML page that properly scales the SVG to fill the viewport
    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${icon.size}px;
      height: ${icon.size}px;
      overflow: hidden;
    }
    svg {
      width: ${icon.size}px;
      height: ${icon.size}px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
    
    // Set viewport to match icon size
    await page.setViewportSize({ width: icon.size, height: icon.size });
    
    // Load the HTML content with embedded SVG
    await page.setContent(html);
    
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
  
  // Generate file type icons for MSIX packaging
  await generateFileTypeIcons();
}

/**
 * Generate ICO file from PNG sources for Windows file associations
 * ICO files can contain multiple sizes, which Windows uses for different contexts
 */
async function generateIcoFile() {
  console.log('\nGenerating ICO file for Windows...');
  
  try {
    // Try to use png-to-ico if available - using dynamic import for ESM
    const pngToIcoModule = await import('png-to-ico');
    const pngToIco = pngToIcoModule.default;
    
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

/**
 * Generate file type icons with Galerie branding for MSIX packaging
 * These icons are used for Windows file associations in the packaged app
 */
async function generateFileTypeIcons() {
  console.log('\n=== Generating File Type Icons for MSIX ===\n');
  
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // File type icons to generate
  const fileTypes = [
    { name: 'pdf', svg: 'icons/filetypes/pdf-icon.svg' },
    { name: 'audio', svg: 'icons/filetypes/audio-icon.svg' },
    { name: 'video', svg: 'icons/filetypes/video-icon.svg' },
    { name: 'image', svg: 'icons/filetypes/image-icon.svg' }
  ];
  
  // Windows icon sizes needed for file associations
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  
  // Ensure output directory exists
  const outputDir = path.resolve(process.cwd(), 'icons/filetypes');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  for (const fileType of fileTypes) {
    const svgPath = path.resolve(process.cwd(), fileType.svg);
    
    // Check if SVG exists
    if (!fs.existsSync(svgPath)) {
      console.log(`⚠ SVG not found: ${fileType.svg}, skipping...`);
      continue;
    }
    
    console.log(`Processing ${fileType.name} icons...`);
    
    // Read the SVG content
    const svgContent = fs.readFileSync(svgPath, 'utf8');
    
    const pngFiles = [];
    
    for (const size of sizes) {
      const page = await context.newPage();
      const outputPath = path.resolve(outputDir, `${fileType.name}-${size}x${size}.png`);
      
      // Create an HTML page that properly scales the SVG to fill the viewport
      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: ${size}px;
      height: ${size}px;
      overflow: hidden;
    }
    svg {
      width: ${size}px;
      height: ${size}px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent}
</body>
</html>`;
      
      // Set viewport to match icon size
      await page.setViewportSize({ width: size, height: size });
      
      // Load the HTML content with embedded SVG
      await page.setContent(html);
      
      // Take screenshot with transparency
      await page.screenshot({ path: outputPath, omitBackground: true });
      
      console.log(`  ✓ Generated ${fileType.name}-${size}x${size}.png`);
      pngFiles.push(outputPath);
      
      await page.close();
    }
    
    // Generate ICO file for this file type
    await generateFileTypeIco(fileType.name, pngFiles);
  }
  
  await browser.close();
  console.log('\nFile type icon generation complete!');
}

/**
 * Generate ICO file for a specific file type
 */
async function generateFileTypeIco(fileTypeName, pngFiles) {
  try {
    // Using dynamic import for ESM compatibility
    const pngToIcoModule = await import('png-to-ico');
    const pngToIco = pngToIcoModule.default;
    
    // Verify all source files exist
    const existingFiles = pngFiles.filter(f => fs.existsSync(f));
    if (existingFiles.length === 0) {
      console.log(`  ⚠ No PNG files found for ${fileTypeName} ICO generation`);
      return;
    }
    
    const buf = await pngToIco(existingFiles);
    const icoPath = path.resolve(process.cwd(), `icons/filetypes/${fileTypeName}.ico`);
    fs.writeFileSync(icoPath, buf);
    
    console.log(`  ✓ Generated icons/filetypes/${fileTypeName}.ico`);
    
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      console.log(`  ⚠ png-to-ico not available, skipping ${fileTypeName}.ico`);
    } else {
      console.error(`  ✗ Error generating ${fileTypeName}.ico:`, err.message);
    }
  }
}

// Main execution - using top-level await (ESM style)
try {
  await generateIcons();
} catch (err) {
  console.error('Error generating icons:', err);
  process.exit(1);
}
