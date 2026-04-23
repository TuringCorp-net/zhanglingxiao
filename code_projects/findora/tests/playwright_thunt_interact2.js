const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试1: 关键词搜索 ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 获取初始商品数量
  const initialRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1); // 减1是表头
  console.log('初始商品行数:', initialRows);
  
  // 找到搜索框并输入
  const searchInput = await page.locator('input[placeholder*="中英文关键词"]');
  await searchInput.fill('项链');
  console.log('输入: 项链');
  
  // 点击搜索按钮
  await page.click('button:has-text("搜索")');
  console.log('点击搜索');
  
  // 等待结果
  await page.waitForTimeout(5000);
  
  // 获取搜索后商品数量
  const searchedRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('搜索后商品行数:', searchedRows);
  
  // 获取搜索结果的第一行商品名称
  const firstResult = await page.evaluate(() => {
    const rows = document.querySelectorAll('table tr');
    if (rows.length > 1) {
      return rows[1]?.querySelector('.product-info')?.innerText?.substring(0, 100) || rows[1]?.innerText?.substring(0, 100);
    }
    return 'N/A';
  });
  console.log('第一行商品:', firstResult?.replace(/\n/g, ' | '));
  
  // 截图
  await page.screenshot({ path: '/tmp/thunt_search_result.png', fullPage: true });
  console.log('截图保存到 /tmp/thunt_search_result.png');
  
  await browser.close();
})();
