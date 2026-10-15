const i18n = require('../../scripts/i18n.js');

describe('i18n language persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('choosing a language persists it for the next launch', () => {
    i18n.setI18nLang('en');
    expect(localStorage.getItem(i18n.I18N_STORAGE_KEY)).toBe('en');
    expect(i18n.getCurrentI18nLang()).toBe('en');
    expect(i18n.readStoredLang()).toBe('en');
  });

  test('an unknown language falls back to English and is saved', () => {
    i18n.setI18nLang('zz');
    expect(i18n.getCurrentI18nLang()).toBe('en');
    expect(localStorage.getItem(i18n.I18N_STORAGE_KEY)).toBe('en');
  });

  test('readStoredLang ignores an unknown stored value', () => {
    localStorage.setItem(i18n.I18N_STORAGE_KEY, 'zz');
    expect(i18n.readStoredLang()).toBe(null);
  });
});
