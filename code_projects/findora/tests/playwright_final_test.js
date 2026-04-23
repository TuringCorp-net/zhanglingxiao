const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== thunt.ai 交互测试（最终版）===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 移除登录弹窗
  await page.evaluate(() => {
    const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
    if (dialog) dialog.remove();
  });
  
  // 1. 搜索测试
  console.log('\n--- 测试1: 关键词搜索"项链" ---');
  await page.locator('input[placeholder*="中英文关键词"]').fill('项链');
  await page.locator('button.search-button').click();  // 使用class精确匹配
  await page.waitForTimeout(5000);
  
  let rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('搜索后行数:', rows);
  
  // 移除弹窗
  await page.evaluate(() => {
    const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
    if (dialog) dialog.remove();
  });
  await page.waitForTimeout(500);
  
  // 2. 类目筛选测试
  console.log('\n--- 测试2: 类目筛选 ---');
  await page.locator('.el-select').nth(1).click({ force: true });  // 第二个select是类目
  await page.waitForTimeout(1000);
  
  // 选择"美容和个人护理"
  await page.locator('.el-select-dropdown:visible').locator('text=美容和个人护理').click({ force: true });
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
  console.log('\n前3行商品数据:');
  products.forEach((p, i) => console.log(`${i+1}. ${p}`));
  
  console.log('\n✅ 测试完成');
  await browser.close();
})();
