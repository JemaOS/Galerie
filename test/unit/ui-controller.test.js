const UIController = require('../../scripts/ui-controller.js');
const GalleryUtils = require('../../scripts/utils.js');

// Mock global objects
global.GalleryUtils = GalleryUtils;
global.window.audioPlayer = { init: jest.fn() };

describe('UIController', () => {
  let uiController;
  let mockFileHandler;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="app"></div>
      <div id="loading-screen"></div>
      <div id="file-grid"></div>
      <div id="drop-zone"></div>
      <div id="empty-state"></div>
      <button id="landing-open-btn"></button>
      <div id="card-images"></div>
      <div id="card-pdf"></div>
      <div id="card-video"></div>
      <div id="card-audio"></div>
      <input type="file" id="file-input" />
      <div id="toast-container"></div>
      <div id="info-modal" class="hidden">
        <button id="modal-close-btn"></button>
        <button id="modal-close-action"></button>
        <span id="modal-filename"></span>
        <span id="modal-filetype"></span>
        <span id="modal-filesize"></span>
        <span id="modal-filedate"></span>
        <div id="modal-dimensions-row"></div>
        <span id="modal-dimensions"></span>
      </div>
      <span id="file-count"></span>
    `;

    // Mock FileHandler
    mockFileHandler = {
      files: [],
      filteredFiles: [],
      selectedFiles: new Set(),
      loadFiles: jest.fn().mockResolvedValue([]),
      selectAllVisible: jest.fn(),
      toggleFileSelection: jest.fn(),
      getSelectedFiles: jest.fn().mockReturnValue([]),
      removeFiles: jest.fn(),
      getImageMetadata: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
      getVideoMetadata: jest.fn().mockResolvedValue({ width: 100, height: 100, duration: 10 })
    };

    uiController = new UIController(mockFileHandler);
  });

  test('should initialize correctly', async () => {
    await uiController.init();
    expect(document.getElementById('loading-screen').classList.contains('hidden')).toBe(true);
    expect(window.audioPlayer.init).toHaveBeenCalled();
  });

  test('should trigger file input', () => {
    uiController.init();
    const input = document.getElementById('file-input');
    const clickSpy = jest.spyOn(input, 'click');
    
    uiController.triggerFileInput('image');
    expect(input.accept).toBe('image/*');
    expect(clickSpy).toHaveBeenCalled();
  });

  test('should handle file selection', async () => {
    await uiController.init();
    const input = document.getElementById('file-input');
    
    // Mock files
    const file = new File([''], 'test.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', {
      value: [file]
    });
    
    await uiController.handleFileSelect({ target: input });
    
    expect(mockFileHandler.loadFiles).toHaveBeenCalledWith([file]);
  });

  test('should show toast', () => {
    uiController.init();
    uiController.showToast('Test message', 'success');
    
    const toast = document.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toContain('Test message');
    expect(toast.classList.contains('success')).toBe(true);
  });

  test('should show file modal', async () => {
    uiController.init();
    const file = {
      name: 'test.jpg',
      type: 'image',
      size: 1024,
      lastModified: Date.now(),
      file: new File([''], 'test.jpg', { type: 'image/jpeg' })
    };
    
    await uiController.showFileModal(file);
    
    const modal = document.getElementById('info-modal');
    expect(modal.classList.contains('hidden')).toBe(false);
    expect(document.getElementById('modal-filename').textContent).toBe('test.jpg');
  });
});
