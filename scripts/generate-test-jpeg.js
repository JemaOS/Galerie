/*
 * Copyright (C) 2025 Jema Technology
 *
 * Generate a large JPEG fixture used to benchmark opening a big photo.
 * Output: test/fixtures/large-5700x8000.jpg (5700x8000, ~45.6 MP).
 *
 * Usage: node scripts/generate-test-jpeg.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const WIDTH = 5700;
const HEIGHT = 8000;

async function createTestJpeg() {
  // A gradient plus pseudo-random noise. A flat fill would compress to a few KB
  // and not exercise the JPEG entropy-decode cost realistically; noise keeps the
  // file in the multi-megabyte range like a real photo.
  const noise = Buffer.alloc(WIDTH * HEIGHT * 3);
  let seed = 0x12345678;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed & 0xff;
  };
  for (let i = 0; i < noise.length; i += 3) {
    const j = i / 3;
    const x = j % WIDTH;
    const y = Math.floor(j / WIDTH);
    noise[i] = ((x * 255 / WIDTH) ^ rand()) & 0xff;
    noise[i + 1] = ((y * 255 / HEIGHT) ^ rand()) & 0xff;
    noise[i + 2] = (((x + y) * 255 / (WIDTH + HEIGHT)) ^ rand()) & 0xff;
  }

  const dir = path.join(__dirname, '../test/fixtures');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'large-5700x8000.jpg');

  await sharp(noise, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
    .jpeg({ quality: 85, progressive: false })
    .toFile(out);

  console.log(`Created ${out} (${WIDTH}x${HEIGHT})`);
}

createTestJpeg().catch(error => {
  console.error('Error creating test JPEG:', error);
  process.exit(1);
});