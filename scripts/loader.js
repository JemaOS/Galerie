/*
 * Copyright (C) 2025 Jema Technology
 */

// Script Loader Utility

const loadedScripts = new Set();
const loadingScripts = new Map();

/**
 * Load a script dynamically
 * @param {string} url - URL of the script to load
 * @returns {Promise} Promise that resolves when the script is loaded
 */
function loadScript(url) {
  if (loadedScripts.has(url)) {
    return Promise.resolve();
  }

  // Check if script is already in DOM (e.g. loaded via HTML)
  if (document.querySelector(`script[src="${url}"]`)) {
      loadedScripts.add(url);
      return Promise.resolve();
  }

  if (loadingScripts.has(url)) {
    return loadingScripts.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    console.log(`[Loader] Loading script: ${url}`);
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => {
      console.log(`[Loader] Loaded script: ${url}`);
      loadedScripts.add(url);
      loadingScripts.delete(url);
      resolve();
    };
    script.onerror = (error) => {
      console.error(`[Loader] Failed to load script: ${url}`, error);
      loadingScripts.delete(url);
      reject(new Error(`Failed to load script: ${url}`));
    };
    document.body.appendChild(script);
  });

  loadingScripts.set(url, promise);
  return promise;
}

// Export globally
window.loadScript = loadScript;
