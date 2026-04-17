const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  
  const sites = [
    { name: 'temaishuju (Temu)', url: 'https://www.temaishuju.com/goods/hot-sale' },
    { name: 'sheinshuju (Shein)', url: 'https://www.sheinshuju.com/goods/hot-sale' },
    { name: 'amazonshuju (Amazon)', url: 'https://www.amazonshuju.com/goods/hot-sale' }
  ];
  
  for (const site of sites) {
    console.log(`\n=== Testing: ${site.name} ===`);
    try {
      const page = await browser.newPage();
      await page.goto(site.url, { waitUntil: 'networkidle', timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const title = await page.title();
      const goodsCount = await page.evaluate(() => document.querySelectorAll('.goods-card').length);
      const hasFilters = await page.evaluate(() => {
        return document.body.innerText.includes('关键词') || 
               document.body.innerText.includes('品类') ||
               document.body.innerText.includes('价格');
      });
      
      console.log(`Title: ${title}`);
      console.log(`Goods cards: ${goodsCount}`);
      console.log(`Has filters: ${hasFilters}`);
      
      await page.close();
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
  
  await browser.close();
})();
