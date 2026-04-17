const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // 点击"开始使用"按钮
  console.log('Going to temushuju (特姆选品助手)...');
  await page.goto('https://temuhunt.com/temushuju', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  // 查找"开始使用"按钮
  const buttons = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button, a'));
    return btns.map(b => ({
      text: b.innerText?.substring(0, 50),
      href: b.href || b.getAttribute('onclick') || '',
      class: b.className?.substring(0, 50)
    })).filter(b => b.text || b.href);
  });
  
  console.log('Buttons/links found:');
  buttons.slice(0, 20).forEach(b => console.log(`  ${b.text}: ${b.href}`));
  
  // 尝试查找可能的数据入口
  const startBtns = buttons.filter(b => b.text?.includes('开始使用') || b.text?.includes('免费'));
  console.log('\nStart buttons:', startBtns);
  
  // 尝试找到实际商品数据URL
  const dataUrls = await page.evaluate(() => {
    // 查找包含特定关键词的链接
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    return allLinks
      .filter(a => a.href && (
        a.href.includes('hot') || 
        a.href.includes('product') ||
        a.href.includes('goods') ||
        a.href.includes('sale') ||
        a.href.includes('rank')
      ))
      .map(a => ({ text: a.innerText?.substring(0, 50), href: a.href }));
  });
  
  console.log('\nData-related URLs:');
  dataUrls.forEach(u => console.log(`  ${u.text}: ${u.href}`));
  
  await browser.close();
})();
