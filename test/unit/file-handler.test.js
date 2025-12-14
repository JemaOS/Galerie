const GalleryUtils = require('../../scripts/utils.js');
// Mock GalleryUtils globally
global.GalleryUtils = GalleryUtils;

const FileHandler = require('../../scripts/file-handler.js');

describe('FileHandler', () => {
  let fileHandler;

  beforeEach(() => {
    fileHandler = new FileHandler();
    // Mock localStorage
    const localStorageMock = (() => {
      let store = {};
      return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => {
          store[key] = value.toString();
        }),
        removeItem: jest.fn(key => {
          delete store[key];
        }),
        clear: jest.fn(() => {
          store = {};
        })
      };
    })();
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock
    });
  });

  test('should initialize with default values', () => {
    expect(fileHandler.files).toEqual([]);
    expect(fileHandler.currentFilter).toBe('all');
  });

  test('should validate supported files', () => {
    const validFile = new File([''], 'test.jpg', { type: 'image/jpeg' });
    expect(fileHandler.validateFile(validFile)).toBe(true);
  });

  test('should reject unsupported files', () => {
    const invalidFile = new File([''], 'test.exe', { type: 'application/x-msdownload' });
    // Mock console.warn to suppress output
    console.warn = jest.fn();
    expect(fileHandler.validateFile(invalidFile)).toBe(false);
  });

  test('should process file correctly', async () => {
    const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
    const result = await fileHandler.processFile(file);
    
    expect(result).not.toBeNull();
    expect(result.name).toBe('test.jpg');
    expect(result.type).toBe('image');
    expect(result.url).toBe('blob:mock-url');
  });

  test('should add file to collection', () => {
    const fileObject = {
      id: '123',
      name: 'test.jpg',
      size: 1000,
      lastModified: 1234567890,
      type: 'image'
    };
    
    fileHandler.addFile(fileObject);
    expect(fileHandler.files.length).toBe(1);
    expect(fileHandler.files[0]).toEqual(fileObject);
  });

  test('should filter files', () => {
    const imageFile = { id: '1', name: 'img.jpg', type: 'image', extension: 'jpg' };
    const videoFile = { id: '2', name: 'vid.mp4', type: 'video', extension: 'mp4' };
    
    fileHandler.files = [imageFile, videoFile];
    
    fileHandler.setFilter('image');
    expect(fileHandler.filteredFiles.length).toBe(1);
    expect(fileHandler.filteredFiles[0]).toEqual(imageFile);
    
    fileHandler.setFilter('video');
    expect(fileHandler.filteredFiles.length).toBe(1);
    expect(fileHandler.filteredFiles[0]).toEqual(videoFile);
    
    fileHandler.setFilter('all');
    expect(fileHandler.filteredFiles.length).toBe(2);
  });
});
