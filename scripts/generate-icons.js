const { chromium } = require('@playwright/test');
const path = require('path');

async function generateIcons() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  const icons = [
    {
      input: 'icons/icon-192x192.svg',
      output: 'icons/icon-192x192.png',
      size: 192
    },
    {
      input: 'icons/icon-512x512.svg',
      output: 'icons/icon-512x512.png',
      size: 512
    },
    {
      input: 'icons/icon.svg',
      output: 'icons/icon-256x256.png',
      size: 256
    }
  ];

  for (const icon of icons) {
    const page = await context.newPage();
    const inputPath = path.resolve(process.cwd(), icon.input);
    const outputPath = path.resolve(process.cwd(), icon.output);
    
    console.log(`Converting ${icon.input} to ${icon.output}...`);
    
    // Load the SVG file
    await page.goto(`file://${inputPath}`);
    
    // Set viewport to match icon size
    await page.setViewportSize({ width: icon.size, height: icon.size });
    
    // Take screenshot
    // omitBackground: true is used to preserve transparency if the SVG has a transparent background
    await page.screenshot({ path: outputPath, omitBackground: true });
    
    console.log(`Generated ${icon.output}`);
    await page.close();
  }

  await browser.close();
  console.log('Icon generation complete!');
}

generateIcons().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
