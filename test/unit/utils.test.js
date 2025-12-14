const GalleryUtils = require('../../scripts/utils.js');

describe('GalleryUtils', () => {
  test('formatFileSize returns correct string', () => {
    expect(GalleryUtils.formatFileSize(0)).toBe('0 Bytes');
    expect(GalleryUtils.formatFileSize(1024)).toBe('1 KB');
    expect(GalleryUtils.formatFileSize(1024 * 1024)).toBe('1 MB');
  });

  test('formatDuration returns correct string', () => {
    expect(GalleryUtils.formatDuration(0)).toBe('00:00');
    expect(GalleryUtils.formatDuration(61)).toBe('01:01');
    expect(GalleryUtils.formatDuration(3661)).toBe('01:01:01');
  });

  test('getFileType returns correct type', () => {
    expect(GalleryUtils.getFileType('image.jpg')).toBe('image');
    expect(GalleryUtils.getFileType('video.mp4')).toBe('video');
    expect(GalleryUtils.getFileType('audio.mp3')).toBe('audio');
    expect(GalleryUtils.getFileType('doc.pdf')).toBe('pdf');
    expect(GalleryUtils.getFileType('unknown.xyz')).toBe('unknown');
  });

  test('sanitizeFilename removes invalid characters', () => {
    expect(GalleryUtils.sanitizeFilename('file/name.jpg')).toBe('file_name.jpg');
    expect(GalleryUtils.sanitizeFilename('file:name.jpg')).toBe('file_name.jpg');
  });
});
