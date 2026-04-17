const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to thunt.ai/cn/product-database...');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 提取表格数据
  const goods = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    return Array.from(rows).map((row, i) => {
      const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText?.trim());
      const link = row.querySelector('a[href]')?.href;
      return { index: i, cells, link };
    }).filter(r => r.cells.length > 0 && r.cells[0] !== '商品');
  });
  
  console.log('=== Goods table (' + goods.length + ' rows) ===');
  goods.slice(0, 15).forEach(g => {
    console.log(`\n${g.index}: ${g.cells.join(' | ')}`);
    if (g.link) console.log(`  Link: ${g.link}`);
  });
  
  // 保存完整数据
  require('fs').writeFileSync('/tmp/thunt_goods.json', JSON.stringify(goods, null, 2));
  console.log('\n\nSaved to /tmp/thunt_goods.json');
  
  await browser.close();
})();
