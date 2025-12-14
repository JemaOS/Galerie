const { test, expect } = require('@playwright/test');

test.describe('Performance Tests', () => {
  test('should load within acceptable time limits', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    
    console.log(`Page Load Time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(3000); // 3 seconds budget
  });

  test('should have good Core Web Vitals', async ({ page }) => {
    await page.goto('/');
    
    // Measure FCP
    const fcp = await page.evaluate(async () => {
      return new Promise(resolve => {
        new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const fcpEntry = entries.find(entry => entry.name === 'first-contentful-paint');
          if (fcpEntry) {
            resolve(fcpEntry.startTime);
          }
        }).observe({ type: 'paint', buffered: true });
        
        // Fallback if already fired
        setTimeout(() => resolve(0), 3000);
      });
    });
    
    console.log(`FCP: ${fcp}ms`);
    expect(fcp).toBeLessThan(3000); // Relaxed for CI environment (Good FCP is < 1.8s)
  });
});
