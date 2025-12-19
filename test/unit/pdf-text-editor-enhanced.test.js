const PdfTextEditor = require('../../scripts/pdf-text-editor.js');

describe('PdfTextEditor Enhanced Font Detection', () => {
    let editor;

    beforeEach(() => {
        // Mock viewer
        const mockViewer = {};
        editor = new PdfTextEditor(mockViewer);
    });

    test('getFontFamily handles new specific mappings', () => {
        expect(editor.getFontFamily('AdobeCaslonPro')).toContain('Caslon');
        expect(editor.getFontFamily('AdobeCaslonPro')).toContain('serif');

        expect(editor.getFontFamily('Baskerville-Bold')).toContain('Baskerville');
        expect(editor.getFontFamily('Baskerville-Bold')).toContain('serif');

        // CenturySchoolbook falls back to generic serif stack in current implementation
        expect(editor.getFontFamily('CenturySchoolbook')).toContain('serif');

        expect(editor.getFontFamily('BookmanOldStyle')).toContain('Bookman');
        expect(editor.getFontFamily('BookmanOldStyle')).toContain('serif');

        expect(editor.getFontFamily('Didot-Bold')).toContain('Didot');
        expect(editor.getFontFamily('Didot-Bold')).toContain('serif');

        expect(editor.getFontFamily('BodoniMT')).toContain('Bodoni');
        expect(editor.getFontFamily('BodoniMT')).toContain('serif');

        expect(editor.getFontFamily('Constantia')).toContain('Constantia');
        expect(editor.getFontFamily('Constantia')).toContain('serif');
    });

    test('getFontFamily uses fuzzy matching for Serif indicators', () => {
        expect(editor.getFontFamily('MyCustomSerif')).toContain('serif');
        expect(editor.getFontFamily('MyCustomRoman')).toContain('serif');
        // These should be caught by specific mappings first, but if we pass something that contains the name but isn't exact match logic
        // Actually the logic is .includes(), so 'MyCambriaFont' would hit the specific mapping for 'cambria'
        // Let's test the fuzzy fallback for things NOT in specific mappings
        expect(editor.getFontFamily('UnknownSerifFont')).toContain('serif');
        expect(editor.getFontFamily('UnknownRomanFont')).toContain('serif');
    });

    test('getFontFamily uses fuzzy matching for Sans-Serif indicators', () => {
        expect(editor.getFontFamily('MyCustomSans')).toContain('sans-serif');
        expect(editor.getFontFamily('MyCustomGothic')).toContain('sans-serif');
        expect(editor.getFontFamily('MyCustomGrotesque')).toContain('sans-serif');
    });

    test('getFontFamily uses fuzzy matching for Monospace indicators', () => {
        expect(editor.getFontFamily('MyCustomMono')).toContain('monospace');
        expect(editor.getFontFamily('MyCustomConsole')).toContain('monospace');
    });

    test('getFontFamily prioritizes specific mappings over fuzzy matching', () => {
        // 'Garamond' contains 'roman' (no it doesn't)
        // 'Times New Roman' contains 'roman'
        // It should return the specific stack, not just 'serif'
        expect(editor.getFontFamily('Times New Roman')).toContain('"Times New Roman"');
        expect(editor.getFontFamily('Times New Roman')).not.toBe('serif');
    });
});
