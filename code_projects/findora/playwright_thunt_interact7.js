const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试: 完整交互测试 ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 测试搜索功能
  console.log('\n--- 关键词搜索测试 ---');
  const searchInput = await page.locator('input[placeholder*="中英文关键词"]');
  await searchInput.fill('项链');
  await page.click('button:has-text("搜索")');
  await page.waitForTimeout(5000);
  
  let rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('搜索"项链"后行数:', rows);
  
  // 清空搜索
  await searchInput.clear();
  await page.click('button:has-text("重置")');
  await page.waitForTimeout(3000);
  
  rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('重置后行数:', rows);
  
  // 测试类目筛选
  console.log('\n--- 类目筛选测试 ---');
  const allSelects = await page.locator('.el-select').all();
  await allSelects[1].click(); // 类目
  await page.waitForTimeout(1000);
  
  // 选择"美容和个人护理"
  await page.click('text=美容和个人护理');
  console.log('选择了"美容和个人护理"');
  await page.waitForTimeout(5000);
  
  rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('类目筛选后行数:', rows);
  
  // 获取表格中的商品名称
  const products = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    const data = [];
    rows.forEach((row, i) => {
      if (i > 0 && i <= 5) { // 前5行数据
        const text = row.innerText?.replace(/\n/g, ' | ')?.substring(0, 150);
        data.push(text);
      }
    });
    return data;
  });
  console.log('\n前5行数据:');
  products.forEach((p, i) => console.log(`${i+1}. ${p}`));
  
  await page.screenshot({ path: '/tmp/thunt_final_test.png', fullPage: true });
  console.log('\n截图保存到 /tmp/thunt_final_test.png');
  
  await browser.close();
})();
