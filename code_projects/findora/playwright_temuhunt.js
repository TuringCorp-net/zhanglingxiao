const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to temuhunt.com/product-database...');
  await page.goto('https://temuhunt.com/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // 获取页面内容概览
  const bodyText = await page.evaluate(() => document.body.innerText);
  const lines = bodyText.split('\n').filter(l => l.trim().length > 0);
  console.log('\n=== Body text (first 80 lines) ===');
  lines.slice(0, 80).forEach(l => console.log(l.substring(0, 120)));
  
  // 查找商品相关元素
  const goods = await page.evaluate(() => {
    const selectors = [
      '.goods-card',
      '[class*="product"]',
      '[class*="item"]',
      'table tr',
      '[class*="card"]'
    ];
    
    let results = [];
    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length > 0) {
        results.push({
          selector: sel,
          count: els.length,
          sample: els[0]?.innerText?.substring(0, 200)?.replace(/\n/g, ' | ')
        });
      }
    }
    return results;
  });
  
  console.log('\n=== Found elements ===');
  console.log(JSON.stringify(goods, null, 2));
  
  // 保存完整页面
  const content = await page.content();
  require('fs').writeFileSync('/tmp/temuhunt_rendered.html', content);
  console.log('\nSaved to /tmp/temuhunt_rendered.html');
  
  await browser.close();
})();
