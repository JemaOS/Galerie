// Setup file for Jest
// Mock browser APIs if needed
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();
