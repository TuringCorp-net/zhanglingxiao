const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('=== 完整交互测试（关闭弹窗）===');
  await page.goto('https://thunt.ai/cn/product-database', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(8000);
  
  // 关闭可能弹出的登录提示
  try {
    const closeBtn = await page.locator('.login-tips-wrap button, .el-dialog__close, [aria-label="关闭"]').first();
    if (await closeBtn.isVisible({ timeout: 2000 })) {
      await closeBtn.click();
      console.log('关闭了登录提示');
      await page.waitForTimeout(1000);
    }
  } catch (e) {
    console.log('没有登录提示或已关闭');
  }
  
  // 1. 搜索测试
  console.log('\n--- 搜索"项链" ---');
  const searchInput = await page.locator('input[placeholder*="中英文关键词"]');
  await searchInput.fill('项链');
  await page.click('button:has-text("搜索")');
  await page.waitForTimeout(5000);
  
  let rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('搜索后行数:', rows);
  
  // 关闭弹窗
  try {
    const dialog = await page.locator('.login-tips-wrap, .el-dialog').first();
    if (await dialog.isVisible({ timeout: 1000 })) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch(e) {}
  
  // 2. 类目筛选测试
  console.log('\n--- 类目筛选 ---');
  
  // 先获取当前筛选状态的文本
  const initialText = await page.evaluate(() => {
    const selects = document.querySelectorAll('.el-select');
    return Array.from(selects).map(s => s.innerText?.substring(0, 30)).join(' | ');
  });
  console.log('当前筛选状态:', initialText.replace(/\n/g, ' ').substring(0, 100));
  
  // 点击类目select
  const allSelects = await page.locator('.el-select').all();
  await allSelects[1].click();
  await page.waitForTimeout(1000);
  
  // 选择一个类目
  await page.click('text=美容和个人护理');
  console.log('选择了"美容和个人护理"');
  await page.waitForTimeout(5000);
  
  rows = await page.evaluate(() => document.querySelectorAll('table tr').length - 1);
  console.log('筛选后行数:', rows);
  
  // 获取前3行数据
  const products = await page.evaluate(() => {
    const data = [];
    const rows = document.querySelectorAll('table tr');
    for (let i = 1; i <= 3 && i < rows.length; i++) {
      data.push(rows[i].innerText?.replace(/\n/g, ' | ')?.substring(0, 200));
    }
    return data;
  });
  console.log('\n前3行数据预览:');
  products.forEach((p, i) => console.log(`${i+1}. ${p}`));
  
  console.log('\n✅ 交互测试完成');
  await browser.close();
})();
