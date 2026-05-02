/**
 * ============================================
 * 更新 crawl_state.js - 2026-05-02 第二次采集
 * ============================================
 */

const fs = require('fs');

// 本次采集的类目
const UPDATED_CATEGORIES = [
  { platform: 'temu', catId: 1, catName: 'CD和黑胶唱片' },
  { platform: 'shein', catId: 2032, catName: '家居与生活' },
  { platform: 'amazon', catId: 2619525011, catName: '家电' },
  { platform: 'sumaitong', catId: 6, catName: '家用电器' },
  { platform: 'tiktok', catId: 604206, catName: 'Toys & Hobbies' }
];

const now = new Date().toISOString();

console.log('\n========================================');
console.log('更新 crawl_state.js');
console.log('========================================');
console.log('更新时间: ' + now + '\n');

// 读取原文件
const statePath = './crawl_state.js';
let stateContent = fs.readFileSync(statePath, 'utf8');

// 更新每个类目的lastCrawled时间
UPDATED_CATEGORIES.forEach(function(item) {
  const platform = item.platform;
  const catId = item.catId;
  const catName = item.catName;

  // 查找对应的catId并替换lastCrawled
  const regex = new RegExp('(catId: ' + catId + '[\\s\\S]*?lastCrawled: )"(null|\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z)"');
  stateContent = stateContent.replace(regex, '$1"' + now + '"');
  console.log('✓ ' + platform + ' - ' + catName + ' (' + catId + ')');
});

// 更新lastUpdated
stateContent = stateContent.replace(
  /lastUpdated: "[\d\-T:.Z]+"/,
  'lastUpdated: "' + now + '"'
);

// 添加本次采集记录
stateContent = stateContent.replace(
  /\/\/ 完成时间:[\s\S]*?\n/,
  function(match) {
    return match + '// 本次采集(v2): ' + UPDATED_CATEGORIES.map(function(c) { return c.catId + '(' + c.catName + ')'; }).join(', ') + '\n// 完成时间: ' + now + '\n';
  }
);

// 写入更新后的文件
fs.writeFileSync(statePath, stateContent);

console.log('\n✓ crawl_state.js 已更新');
console.log('========================================\n');
