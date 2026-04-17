const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试: 选择"美容和个人护理"类目 ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 获取初始商品数量
  const initialRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('初始行数:', initialRows);
  
  // 点击类目select
  const allSelects = await page.locator('.el-select').all();
  await allSelects[1].click();  // 第二个是类目
  await page.waitForTimeout(1000);
  
  // 选择"美容和个人护理"
  await page.click('text=美容和个人护理');
  console.log('选择了"美容和个人护理"');
  await page.waitForTimeout(5000);  // 等待数据加载
  
  // 获取筛选后数量
  const filteredRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('筛选后行数:', filteredRows);
  
  // 获取第一行商品名称
  const firstProduct = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    if (rows.length > 1) {
      const cells = rows[1].querySelectorAll('td');
      return cells[0]?.innerText?.replace(/\n/g, ' | ')?.substring(0, 100);
    }
    return 'N/A';
  });
  console.log('第一行商品:', firstProduct);
  
  // 截图
  await page.screenshot({ path: '/tmp/thunt_category_filtered.png', fullPage: true });
  console.log('截图保存');
  
  await browser.close();
})();
