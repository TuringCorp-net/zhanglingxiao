/**
 * 更新 crawl_state.js 的 lastCrawled 时间 - 2026-05-04
 * 
 * 本次采集的类目：
 * - Temu: 家居装修 (13512)
 * - Shein: 宠物用品 (2400)
 * - Amazon: 电子产品 (172282)
 * - 速卖通: 运动及娱乐 (18)
 * - TikTok: Fashion Accessories (605248)
 */

const fs = require('fs');
const path = require('path');

// 读取 crawl_state.js
const crawlStatePath = path.join(__dirname, 'crawl_state.js');
const content = fs.readFileSync(crawlStatePath, 'utf8');

// 本次采集时间
const now = new Date().toISOString();

// 需要更新的类目映射
const updates = {
  temu: { catId: 13512, catName: '家居装修' },
  shein: { catId: 2400, catName: '宠物用品' },
  amazon: { catId: 172282, catName: '电子产品' },
  sumaitong: { catId: 18, catName: '运动及娱乐' },
  tiktok: { catId: 605248, catName: 'Fashion Accessories' }
};

console.log('===========================================');
console.log('  更新 Crawl State - 2026-05-04');
console.log('===========================================');
console.log(`采集完成时间: ${now}\n`);

// 更新每个类目的 lastCrawled
let updatedContent = content;

// 解析并更新 JSON 部分
const jsonMatch = content.match(/const crawlState = (\{[\s\S]*?\});/);
if (jsonMatch) {
  const jsonStr = jsonMatch[1];
  const crawlState = eval('(' + jsonStr + ')');
  
  for (const [platform, update] of Object.entries(updates)) {
    if (crawlState.platforms[platform]) {
      const categories = crawlState.platforms[platform].categories;
      const cat = categories.find(c => c.catId === update.catId);
      if (cat) {
        const oldTime = cat.lastCrawled;
        cat.lastCrawled = now;
        console.log(`✓ ${platform} - ${update.catName} (${update.catId})`);
        console.log(`    ${oldTime || 'null'} → ${now}`);
      }
    }
  }
  
  // 更新 lastUpdated
  crawlState.lastUpdated = now;
  
  // 重新构建文件内容
  const newJson = JSON.stringify(crawlState, null, 2);
  const header = content.match(/(\/\*\*[\s\S]*?\*\/\nconst crawlState)/)[1];
  const footer = content.match(/module\.exports = crawlState;/)[0];
  
  updatedContent = header + ' = ' + newJson + ';\n\n' + footer;
}

// 保存更新后的文件
fs.writeFileSync(crawlStatePath, updatedContent);
console.log('\n✅ Crawl State 已更新');
console.log(`📁 文件: ${crawlStatePath}`);
