const PdfTextEditor = require('../../scripts/pdf-text-editor.js');

describe('PdfTextEditor Font Detection', () => {
    let editor;

    beforeEach(() => {
        // Mock viewer
        const mockViewer = {};
        editor = new PdfTextEditor(mockViewer);
    });

    test('getFontFamily returns correct stack for Serif fonts', () => {
        expect(editor.getFontFamily('Garamond-Bold')).toContain('Garamond');
        expect(editor.getFontFamily('Garamond-Bold')).toContain('serif');
        
        expect(editor.getFontFamily('TimesNewRomanPSMT')).toContain('Times New Roman');
        expect(editor.getFontFamily('TimesNewRomanPSMT')).toContain('serif');
        
        expect(editor.getFontFamily('Palatino-Roman')).toContain('Palatino');
        expect(editor.getFontFamily('Georgia')).toContain('Georgia');
    });

    test('getFontFamily returns correct stack for Sans-Serif fonts', () => {
        expect(editor.getFontFamily('Arial-BoldMT')).toContain('Arial');
        expect(editor.getFontFamily('Arial-BoldMT')).toContain('sans-serif');
        
        expect(editor.getFontFamily('Helvetica')).toContain('Helvetica');
        expect(editor.getFontFamily('Verdana')).toContain('Verdana');
        expect(editor.getFontFamily('Tahoma')).toContain('Tahoma');
    });

    test('getFontFamily returns correct stack for Monospace fonts', () => {
        expect(editor.getFontFamily('CourierNewPSMT')).toContain('Courier New');
        expect(editor.getFontFamily('CourierNewPSMT')).toContain('monospace');
        
        expect(editor.getFontFamily('Consolas')).toContain('Consolas');
    });

    test('getFontFamily handles generic names', () => {
        expect(editor.getFontFamily('Times-Roman')).toBe('"Times New Roman", "Times", serif');
        expect(editor.getFontFamily('SomeSerifFont')).toContain('serif');
        expect(editor.getFontFamily('SomeSerifFont')).toContain('Times');
        expect(editor.getFontFamily('SomeSansFont')).toContain('sans-serif');
        expect(editor.getFontFamily('SomeSansFont')).toContain('Arial');
    });

    test('getFontFamily defaults to sans-serif', () => {
        expect(editor.getFontFamily('UnknownFont')).toBe('sans-serif');
        expect(editor.getFontFamily('')).toBe('sans-serif');
        expect(editor.getFontFamily(null)).toBe('sans-serif');
    });
    
    test('getFontFamily handles specific cases', () => {
        expect(editor.getFontFamily('ComicSansMS')).toContain('Comic Sans');
        expect(editor.getFontFamily('Impact')).toContain('Impact');
    });
});
