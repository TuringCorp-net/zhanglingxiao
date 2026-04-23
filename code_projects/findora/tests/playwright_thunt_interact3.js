const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试2: 类目筛选 ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 获取初始商品数量
  const initialRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('初始商品行数:', initialRows);
  
  // 查找类目选择器 - Element UI的select
  const categorySelect = await page.locator('.el-select').first();
  
  // 点击打开下拉框
  await categorySelect.click();
  console.log('点击类目选择器');
  await page.waitForTimeout(1000);
  
  // 查找下拉选项
  const options = await page.evaluate(() => {
    const dropdowns = document.querySelectorAll('.el-select-dropdown:not([style*="display: none"])');
    const options = [];
    dropdowns.forEach(dropdown => {
      const items = dropdown.querySelectorAll('.el-select-item, .el-option');
      items.forEach(item => {
        if (item.offsetParent !== null) { // 只取可见的
          options.push(item.innerText?.trim());
        }
      });
    });
    return options.slice(0, 20);
  });
  
  console.log('可选类目:', options.join(', '));
  
  // 选择第一个可见选项
  if (options.length > 0) {
    const firstOption = options[0];
    await page.locator(`.el-select-dropdown:visible .el-select-item:has-text("${firstOption}")`).click();
    console.log('选择类目:', firstOption);
    
    await page.waitForTimeout(3000);
    
    // 获取筛选后商品数量
    const filteredRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
    console.log('筛选后商品行数:', filteredRows);
  }
  
  // 截图
  await page.screenshot({ path: '/tmp/thunt_category_result.png', fullPage: true });
  console.log('截图保存到 /tmp/thunt_category_result.png');
  
  await browser.close();
})();
