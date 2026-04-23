const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.temaishuju.com/goods/hot-sale', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 提取商品完整信息
  const goods = await page.evaluate(() => {
    const cards = document.querySelectorAll('.goods-card');
    return Array.from(cards).map((card, i) => {
      const link = card.querySelector('a[href*="temu"]') || card.querySelector('a');
      const priceEl = card.querySelector('[class*="price"]');
      const salesEl = card.querySelector('[class*="sales"]');
      
      return {
        index: i + 1,
        text: card.innerText?.substring(0, 200)?.replace(/\n/g, ' | '),
        link: link?.href || 'N/A',
        price: priceEl?.innerText || 'N/A',
        sales: salesEl?.innerText || 'N/A'
      };
    });
  });
  
  console.log('=== 商品列表 ===');
  goods.forEach(g => {
    console.log(`\n${g.index}. ${g.text}`);
    console.log(`   链接: ${g.link}`);
  });
  
  // 保存完整数据
  require('fs').writeFileSync('/tmp/goods_list.json', JSON.stringify(goods, null, 2));
  console.log('\n\nSaved to /tmp/goods_list.json');
  
  await browser.close();
})();
