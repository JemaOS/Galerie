const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('node:fs');
const path = require('node:path');

async function createTestPdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 400]);


  // 1. Blue background rectangle
  page.drawRectangle({
    x: 50,
    y: 300,
    width: 200,
    height: 50,
    color: rgb(0.8, 0.9, 1), // Light blue
  });

  // 2. Text on blue background
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText('Text on Blue', {
    x: 60,
    y: 320,
    size: 20,
    font: helveticaFont,
    color: rgb(0, 0, 0),
  });

  // 3. Bold text
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  page.drawText('Bold Text', {
    x: 50,
    y: 250,
    size: 20,
    font: helveticaBold,
    color: rgb(0, 0, 0),
  });

  // 4. Italic text
  const helveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  page.drawText('Italic Text', {
    x: 50,
    y: 200,
    size: 20,
    font: helveticaOblique,
    color: rgb(0, 0, 0),
  });

  // 5. Times Roman (Serif)
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  page.drawText('Serif Text', {
    x: 50,
    y: 150,
    size: 20,
    font: timesRoman,
    color: rgb(0, 0, 0),
  });

  const pdfBytes = await pdfDoc.save();
  
  const dir = path.join(__dirname, '../test/fixtures');
  if (!fs.existsSync(dir)){
      fs.mkdirSync(dir, { recursive: true });
  }
  
  fs.writeFileSync(path.join(dir, 'test-bg.pdf'), pdfBytes);
  console.log('Created test/fixtures/test-bg.pdf');
}

try {
  await createTestPdf();
} catch (error) {
  console.error('Error creating test PDF:', error);
  process.exit(1);
}
