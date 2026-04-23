const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 获取完整表格数据 ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 移除登录弹窗
  await page.evaluate(() => {
    const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
    if (dialog) dialog.remove();
  });
  await page.waitForTimeout(500);
  
  // 获取表格所有数据
  const tableData = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    const data = [];
    rows.forEach((row, i) => {
      const cells = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText?.trim()?.replace(/\n/g, ' '));
      const link = row.querySelector('a[href*="product-detail"]')?.href;
      if (cells.length > 0 && cells.some(c => c)) {
        data.push({ row: i, cells, link });
      }
    });
    return data;
  });
  
  console.log('总行数:', tableData.length);
  console.log('\n=== 表格前10行 ===');
  tableData.slice(0, 10).forEach(row => {
    console.log(`\n行${row.row}: ${row.cells.join(' | ')}`);
    if (row.link) console.log(`  链接: ${row.link}`);
  });
  
  // 截图
  await page.screenshot({ path: '/tmp/thunt_table.png', fullPage: true });
  console.log('\n截图: /tmp/thunt_table.png');
  
  await browser.close();
})();
