const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 尝试访问特姆选品助手
  console.log('=== Testing: temuhunt.com/temushuju ===');
  await page.goto('https://temuhunt.com/temushuju', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  let title = await page.title();
  console.log('Title:', title);
  
  let bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body preview:', bodyText.substring(0, 500));
  
  // 尝试查找商品卡片
  let goodsCount = await page.evaluate(() => document.querySelectorAll('.goods-card').length);
  console.log('Goods cards:', goodsCount);
  
  // 尝试product-database-introduce
  console.log('\n=== Testing: product-database-introduce ===');
  await page.goto('https://temuhunt.com/product-database-introduce', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  title = await page.title();
  console.log('Title:', title);
  
  bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body preview:', bodyText.substring(0, 500));
  
  // 尝试product-ranking-introduce
  console.log('\n=== Testing: product-ranking ===');
  await page.goto('https://temuhunt.com/product-ranking-introduce', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  title = await page.title();
  console.log('Title:', title);
  
  bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Body preview:', bodyText.substring(0, 500));
  
  await browser.close();
})();
