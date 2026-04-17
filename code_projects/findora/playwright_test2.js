const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  const page = await context.newPage();
  
  console.log('Navigating to temaishuju.com...');
  await page.goto('https://www.temaishuju.com/goods/hot-sale', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000); // 等待更多动态内容
  
  // 获取页面标题
  const title = await page.title();
  console.log('Page title:', title);
  
  // 尝试查找商品卡片
  const goods = await page.evaluate(() => {
    // 尝试多种选择器
    const selectors = [
      '.goods-card',
      '[class*="goods-card"]',
      '[class*="product-card"]',
      '[class*="item-card"]',
      '.ant-card',
      '[class*="list-item"]',
      'table tr'
    ];
    
    let results = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push({selector: sel, count: els.length, samples: Array.from(els).slice(0, 2).map(el => ({
          text: el.innerText?.substring(0, 150)?.replace(/\n/g, ' | '),
          html: el.outerHTML?.substring(0, 200)
        }))});
      }
    }
    return results;
  });
  
  console.log('\n=== Found elements ===');
  console.log(JSON.stringify(goods, null, 2));
  
  // 获取所有文本内容片段
  const bodyText = await page.evaluate(() => {
    const body = document.body.innerText;
    // 找所有包含价格的文本
    const lines = body.split('\n').filter(l => l.trim().length > 0);
    return lines.slice(0, 50);
  });
  
  console.log('\n=== Body text sample ===');
  bodyText.forEach(t => console.log(t.substring(0, 100)));
  
  await browser.close();
})();
