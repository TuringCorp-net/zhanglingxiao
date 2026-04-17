const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to thunt.ai/cn/product-database...');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  
  // 等待更长时间让数据加载
  console.log('Waiting for data to load...');
  await page.waitForTimeout(10000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // 尝试查找任何表格行或商品
  const dataElements = await page.evaluate(() => {
    const selectors = [
      '.goods-card',
      '[class*="goods"]',
      '[class*="product"]',
      'table tr',
      '[class*="list-item"]',
      '[class*="data-row"]'
    ];
    
    let results = {};
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = { count: els.length, sample: els[0]?.innerText?.substring(0, 100) };
      }
    }
    return results;
  });
  
  console.log('\n=== Data elements ===');
  console.log(JSON.stringify(dataElements, null, 2));
  
  // 尝试截图
  await page.screenshot({ path: '/tmp/thunt_screenshot.png', fullPage: true });
  console.log('\nScreenshot saved to /tmp/thunt_screenshot.png');
  
  // 检查页面HTML长度
  const htmlLength = await page.evaluate(() => document.body.innerHTML.length);
  console.log('HTML length:', htmlLength);
  
  await browser.close();
})();
