/**
 * 更新 crawl_state.js 中的采集时间
 */

const fs = require('fs');
const path = require('path');

const statePath = path.join(__dirname, 'crawl_state.js');
const content = fs.readFileSync(statePath, 'utf8');

// 当前时间
const now = new Date().toISOString();
console.log(`更新采集时间: ${now}`);

// 本次采集的类目
const crawledCategories = [
  { platform: 'temu', catId: 24389 },
  { platform: 'shein', catId: 3636 },
  { platform: 'amazon', catId: 16310091 },
  { platform: 'sumaitong', catId: 1501 },
  { platform: 'tiktok', catId: 601755 }
];

let updatedContent = content;

// 更新每个类目的 lastCrawled
for (const cat of crawledCategories) {
  // 匹配模式: catId: xxx, catName: "...",
  //           { catId: xxx, catName: "...", lastCrawled: ... }
  // 需要替换 lastCrawled 为新的时间戳

  const patterns = [
    // 匹配单个类目定义
    new RegExp(`(catId: ${cat.catId},\\s*catName: "[^"]*",\\s*lastCrawled: )(\\w+|null)`, 'g'),
  ];

  for (const pattern of patterns) {
    updatedContent = updatedContent.replace(pattern, `$1"${now}"`);
  }
}

// 更新 lastUpdated
updatedContent = updatedContent.replace(
  /(lastUpdated: ")[^"]*(")/,
  `$1${now}$2`
);

// 添加本次采集记录
const crawlRecord = `// 本次采集: ${crawledCategories.map(c => `${c.platform}(${c.catId})`).join(', ')}`;
updatedContent = updatedContent.replace(
  /(\/\/ 本次采集:.*)/,
  `${crawlRecord}\n// 完成时间: ${now}`
);

// 保存
fs.writeFileSync(statePath, updatedContent, 'utf8');
console.log('crawl_state.js 已更新');

// 验证更新
const verifyContent = fs.readFileSync(statePath, 'utf8');
const success = crawledCategories.every(cat => {
  const regex = new RegExp(`catId: ${cat.catId},\\s*catName: "[^"]*",\\s*lastCrawled: "${now}"`);
  return regex.test(verifyContent);
});

if (success) {
  console.log('✓ 所有类目采集时间更新成功');
} else {
  console.log('✗ 部分类目可能未更新成功，请手动检查');
}
