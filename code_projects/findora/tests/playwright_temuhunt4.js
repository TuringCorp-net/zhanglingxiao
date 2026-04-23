const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 尝试常见的URL模式
  const urls = [
    'https://temuhunt.com/products/hot',
    'https://temuhunt.com/products/new',
    'https://temuhunt.com/hot-products',
    'https://temuhunt.com/bestsellers',
    'https://temuhunt.com/product/hot-sale',
    'https://temuhunt.com/goods/hot-sale',
    'https://temuhunt.com/temu/hot-sale'
  ];
  
  for (const url of urls) {
    console.log(`\n=== Testing: ${url} ===`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const goodsCount = await page.evaluate(() => document.querySelectorAll('.goods-card').length);
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
      console.log(`Goods cards: ${goodsCount}`);
      console.log(`Body: ${bodyText.replace(/\n/g, ' ')}`);
    } catch (e) {
      console.log(`Error: ${e.message.substring(0, 100)}`);
    }
  }
  
  await browser.close();
})();
