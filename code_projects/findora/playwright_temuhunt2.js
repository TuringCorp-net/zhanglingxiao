const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to temuhunt.com/product-database...');
  await page.goto('https://temuhunt.com/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(5000);
  
  // 尝试查找所有链接
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href]')).map(a => ({
      href: a.href,
      text: a.innerText?.substring(0, 80)
    })).filter(l => l.href && !l.href.startsWith('javascript'));
  });
  
  console.log('=== All links ===');
  links.forEach(l => console.log(`${l.text}: ${l.href}`));
  
  // 查找可能的菜单或导航
  const menus = await page.evaluate(() => {
    const menus = document.querySelectorAll('nav, .menu, .nav, [class*="menu"], [class*="nav"]');
    return Array.from(menus).map(m => ({
      tag: m.tagName,
      class: m.className?.substring(0, 50),
      text: m.innerText?.substring(0, 200)
    }));
  });
  
  console.log('\n=== Menus ===');
  console.log(JSON.stringify(menus, null, 2));
  
  // 查找任何表格或列表
  const tables = await page.evaluate(() => {
    const tables = document.querySelectorAll('table');
    return Array.from(tables).map(t => ({
      rows: t.rows?.length || 0,
      cols: t.rows?.[0]?.cells?.length || 0
    }));
  });
  
  console.log('\n=== Tables ===');
  console.log(JSON.stringify(tables, null, 2));
  
  await browser.close();
})();
