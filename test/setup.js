// Setup file for Jest
// Mock browser APIs if needed
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Load the i18n module so t()/applyI18n()/setI18nLang() are available in tests
require('../scripts/i18n.js');
