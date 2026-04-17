const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试2: 类目筛选 (改进版) ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 查找所有可见的el-select
  const selectsInfo = await page.evaluate(() => {
    const selects = document.querySelectorAll('.el-select');
    return Array.from(selects).map((s, i) => ({
      index: i,
      visible: s.offsetParent !== null,
      text: s.innerText?.substring(0, 80)
    })).filter(s => s.visible);
  });
  
  console.log('找到的select:', selectsInfo.map(s => `${s.index}: ${s.text}`).join('\n'));
  
  // 点击第一个可见的select
  if (selectsInfo.length > 0) {
    const firstSelect = selectsInfo[0];
    await page.click(`.el-select:nth-child(1)`);
    await page.waitForTimeout(1500);
    
    // 查找弹出的选项
    const dropdownInfo = await page.evaluate(() => {
      const popup = document.querySelector('.el-select-dropdown:not([style*="display: none"])') || 
                    document.querySelector('.el-scrollbar__wrap');
      if (popup) {
        const items = popup.querySelectorAll('.el-select-item, .el-option, li');
        return Array.from(items).slice(0, 15).map(i => i.innerText?.trim()).filter(t => t);
      }
      return [];
    });
    
    console.log('弹出的选项:', dropdownInfo.join(', '));
    
    // 点击第一个选项
    if (dropdownInfo.length > 0) {
      await page.click(`.el-select-dropdown:visible li:first-child`);
      console.log('点击了第一个选项');
      await page.waitForTimeout(3000);
      
      const filteredRows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
      console.log('筛选后行数:', filteredRows);
    }
  }
  
  await page.screenshot({ path: '/tmp/thunt_dropdown.png', fullPage: true });
  console.log('截图保存');
  
  await browser.close();
})();
