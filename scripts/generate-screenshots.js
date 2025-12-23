const fs = require('fs');
const path = require('path');

// Check if sharp is available, otherwise provide instructions
let sharp;
try {
    sharp = require('sharp');
} catch (e) {
    console.log('Sharp not installed. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install sharp --save-dev', { stdio: 'inherit' });
    sharp = require('sharp');
}

const screenshotsDir = path.join(__dirname, '..', 'screenshots');

const screenshots = [
    { svg: 'desktop-wide.svg', png: 'desktop-wide.png', width: 1280, height: 720 },
    { svg: 'desktop-pdf.svg', png: 'desktop-pdf.png', width: 1280, height: 720 },
    { svg: 'mobile-narrow.svg', png: 'mobile-narrow.png', width: 540, height: 720 }
];

async function generateScreenshots() {
    console.log('Generating PNG screenshots from SVG...');
    
    for (const screenshot of screenshots) {
        const svgPath = path.join(screenshotsDir, screenshot.svg);
        const pngPath = path.join(screenshotsDir, screenshot.png);
        
        if (!fs.existsSync(svgPath)) {
            console.log(`SVG not found: ${svgPath}`);
            continue;
        }
        
        try {
            await sharp(svgPath)
                .resize(screenshot.width, screenshot.height)
                .png()
                .toFile(pngPath);
            
            console.log(`Generated: ${screenshot.png}`);
        } catch (error) {
            console.error(`Error generating ${screenshot.png}:`, error.message);
        }
    }
    
    console.log('Screenshot generation complete!');
}

generateScreenshots().catch(console.error);
