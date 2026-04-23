const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to thunt.ai/cn/product-database...');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  const title = await page.title();
  console.log('Page title:', title);
  
  // 获取商品卡片
  const goods = await page.evaluate(() => {
    const cards = document.querySelectorAll('.goods-card');
    return Array.from(cards).slice(0, 5).map((card, i) => ({
      index: i + 1,
      text: card.innerText?.substring(0, 200)?.replace(/\n/g, ' | '),
      link: card.querySelector('a[href*="temu"]')?.href || 'N/A'
    }));
  });
  
  console.log('\n=== Goods found: ' + goods.length + ' ===');
  goods.forEach(g => {
    console.log(`\n${g.index}. ${g.text}`);
    console.log(`   Link: ${g.link}`);
  });
  
  // 获取筛选器
  const filters = await page.evaluate(() => {
    const text = document.body.innerText;
    const hasFilters = text.includes('关键词') || text.includes('品类') || text.includes('价格');
    return { hasFilters, sample: text.substring(0, 500) };
  });
  
  console.log('\n=== Filters ===');
  console.log('Has filters:', filters.hasFilters);
  console.log('Body sample:', filters.sample.replace(/\n/g, ' | ').substring(0, 300));
  
  await browser.close();
})();
