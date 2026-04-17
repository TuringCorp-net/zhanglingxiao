const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();
  
  console.log('Navigating to temaishuju.com...');
  await page.goto('https://www.temaishuju.com/goods/hot-sale', { waitUntil: 'networkidle', timeout: 30000 });
  
  // 等待一下让动态内容加载
  await page.waitForTimeout(3000);
  
  // 获取页面内容
  const content = await page.content();
  console.log('Page content length:', content.length);
  
  // 尝试查找商品数据
  const goods = await page.evaluate(() => {
    // 查找所有可能的商品元素
    const items = document.querySelectorAll('[class*="goods"], [class*="product"], [class*="item"]');
    return Array.from(items).slice(0, 5).map(el => ({
      text: el.innerText?.substring(0, 100),
      class: el.className?.substring(0, 50)
    }));
  });
  
  console.log('Found goods elements:', JSON.stringify(goods, null, 2));
  
  // 保存完整页面
  require('fs').writeFileSync('/tmp/temu_shuju_rendered.html', content);
  console.log('Saved to /tmp/temu_shuju_rendered.html');
  
  await browser.close();
})();
