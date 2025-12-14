const GalleryUtils = require('../../scripts/utils.js');

describe('Security Unit Tests', () => {
  test('getSafeText should escape HTML', () => {
    const unsafe = '<script>alert("xss")</script>';
    const safe = GalleryUtils.getSafeText(unsafe);
    expect(safe).not.toContain('<script>');
    // Use split string to avoid tool unescaping issues if any
    expect(safe).toContain('&' + 'lt;script' + '&' + 'gt;');
  });

  test('sanitizeFilename should remove dangerous characters', () => {
    const unsafe = '../../etc/passwd';
    const safe = GalleryUtils.sanitizeFilename(unsafe);
    expect(safe).not.toContain('..');
    expect(safe).not.toContain('/');
    // ../../etc/passwd -> .._.._etc_passwd -> ____etc_passwd
    expect(safe).toBe('____etc_passwd');
  });
});
