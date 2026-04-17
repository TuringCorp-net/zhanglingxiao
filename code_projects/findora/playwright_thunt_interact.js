const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to thunt.ai...');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 1. 先检查页面实际有哪些选择器
  console.log('\n=== 检查页面选择器 ===');
  const selectors = await page.evaluate(() => {
    const results = {};
    const testSelectors = [
      '.goods-card', '.goods', '.product', '.product-card', '.item-card',
      'table', 'tr', 'td',
      '[class*="goods"]', '[class*="product"]', '[class*="item"]',
      '.ant-table', '.ant-row', '.ant-col'
    ];
    
    for (const sel of testSelectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results[sel] = { count: els.length, sample: els[0]?.className?.substring(0, 80) };
      }
    }
    return results;
  });
  console.log(JSON.stringify(selectors, null, 2));
  
  // 2. 查找搜索框和筛选器
  console.log('\n=== 查找搜索框和筛选器 ===');
  const inputs = await page.evaluate(() => {
    const inputs = document.querySelectorAll('input');
    return Array.from(inputs).map(inp => ({
      type: inp.type,
      placeholder: inp.placeholder,
      class: inp.className?.substring(0, 60),
      id: inp.id
    }));
  });
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  
  // 3. 查找下拉选择器
  const selects = await page.evaluate(() => {
    const selects = document.querySelectorAll('select, .ant-select');
    return Array.from(selects).map(s => ({
      tag: s.tagName,
      class: s.className?.substring(0, 60),
      options: s.querySelectorAll('option')?.length || s.querySelectorAll('.ant-select-item')?.length
    }));
  });
  console.log('Selects:', JSON.stringify(selects, null, 2));
  
  await browser.close();
})();
