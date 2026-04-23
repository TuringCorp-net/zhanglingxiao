const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 测试2: 类目筛选 (精确定位) ===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 获取所有带有"类目"文本的元素
  const categoryElement = await page.locator('text=类目').first();
  if (await categoryElement.isVisible()) {
    console.log('找到"类目"文本');
    
    // 查找类目旁边的select (应该是第二个或第三个)
    const allSelects = await page.locator('.el-select').all();
    console.log('总共有', allSelects.length, '个el-select');
    
    // 点击第二个select（类目）
    await allSelects[1].click();
    console.log('点击了第二个select（应该是类目）');
    await page.waitForTimeout(1500);
    
    // 获取下拉选项
    const options = await page.evaluate(() => {
      const popup = document.querySelector('.el-popper:not([style*="display"])') ||
                    document.querySelector('.el-select-dropdown:not([style*="display"])') ||
                    document.querySelector('.el-scrollbar__wrap');
      if (popup) {
        const items = popup.querySelectorAll('.el-option, .el-select-item, .el-option span, li span');
        return Array.from(items).map(i => i.innerText?.trim()).filter(t => t && t.length < 30).slice(0, 15);
      }
      // 尝试直接从DOM获取
      const allLis = document.querySelectorAll('body *');
      const texts = [];
      for (const el of allLis) {
        if (el.shadowRoot) {
          const shadowItems = el.shadowRoot.querySelectorAll('.el-option, .el-select-item');
          shadowItems.forEach(item => texts.push(item.innerText?.trim()));
        }
      }
      return texts.slice(0, 15);
    });
    
    console.log('选项:', options.join(', '));
    
    // 截图查看状态
    await page.screenshot({ path: '/tmp/thunt_select_open.png' });
    console.log('截图已保存');
  }
  
  await browser.close();
})();
