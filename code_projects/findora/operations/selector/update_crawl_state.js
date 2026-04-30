/**
 * ============================================
 * 更新 crawl_state.js - 2026-04-30
 * ============================================
 */

const fs = require('fs');

// 本次采集的类目
const UPDATED_CATEGORIES = [
  { platform: 'temu', catId: 31148, catName: '运动与户外用品' },
  { platform: 'shein', catId: 3195, catName: '运动与户外' },
  { platform: 'amazon', catId: 2972638011, catName: '庭院、草坪和园艺' },
  { platform: 'sumaitong', catId: 200000345, catName: '女装' },
  { platform: 'tiktok', catId: 600154, catName: 'Textiles & Soft Furnishings' }
];

const now = new Date().toISOString();

console.log(`\n========================================`);
console.log(`更新 crawl_state.js`);
console.log(`========================================`);
console.log(`更新时间: ${now}\n`);

// 读取原文件
const statePath = '../selected/crawl_state.js';
let stateContent = fs.readFileSync(statePath, 'utf8');

// 更新每个类目的lastCrawled时间
UPDATED_CATEGORIES.forEach(({ platform, catId, catName }) => {
  // 查找对应的catId并替换lastCrawled
  const regex = new RegExp(`(catId: ${catId}[\\s\\S]*?lastCrawled: )"(null|\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)"`);
  stateContent = stateContent.replace(regex, `$1"${now}"`);
  console.log(`✓ ${platform} - ${catName} (${catId})`);
});

// 更新lastUpdated
stateContent = stateContent.replace(
  /lastUpdated: "[\d\-T:.Z]+"/,
  `lastUpdated: "${now}"`
);

// 添加本次采集记录
const todayStr = new Date().toISOString().split('T')[0];
stateContent = stateContent.replace(
  /\/\/ 本次采集:[\s\S]*?\/\/ 完成时间:[\s\S]*?\n/,
  (match) => {
    return match + `// 本次采集: ${UPDATED_CATEGORIES.map(c => `${c.catId}(${c.catName})`).join(', ')}\n// 完成时间: ${now}\n`;
  }
);

// 写入更新后的文件
fs.writeFileSync(statePath, stateContent);

console.log(`\n✓ crawl_state.js 已更新`);
console.log(`========================================\n`);