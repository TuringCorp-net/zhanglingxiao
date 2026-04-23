const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试（强制交互）===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 强制关闭弹窗
  await page.evaluate(() => {
    const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
    if (dialog) dialog.remove();
    const overlay = document.querySelector('.el-overlay, .v-modal');
    if (overlay) overlay.remove();
  });
  console.log('移除弹窗DOM');
  await page.waitForTimeout(1000);
  
  // 测试搜索
  console.log('\n--- 搜索测试 ---');
  const searchInput = await page.locator('input[placeholder*="中英文关键词"]');
  await searchInput.fill('项链');
  await page.locator('button:has-text("搜索")').click();
  await page.waitForTimeout(5000);
  
  let rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('搜索"项链"后行数:', rows);
  
  // 再次移除弹窗
  await page.evaluate(() => {
    const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
    if (dialog) dialog.remove();
  });
  await page.waitForTimeout(500);
  
  // 测试类目筛选
  console.log('\n--- 类目筛选 ---');
  const categorySelect = await page.locator('.el-select').nth(1);
  await categorySelect.click({ force: true });
  await page.waitForTimeout(1500);
  
  // 选择选项
  await page.locator('text=美容和个人护理').click({ force: true });
  console.log('选择"美容和个人护理"');
  await page.waitForTimeout(5000);
  
  rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('筛选后行数:', rows);
  
  // 获取数据
  const products = await page.evaluate(() => {
    const data = [];
    const rows = document.querySelectorAll('table tr');
    for (let i = 1; i <= 3 && i < rows.length; i++) {
      data.push(rows[i].innerText?.replace(/\n/g, ' | ')?.substring(0, 200));
    }
    return data;
  });
  console.log('\n前3行:');
  products.forEach((p, i) => console.log(`${i+1}. ${p}`));
  
  await browser.close();
})();
