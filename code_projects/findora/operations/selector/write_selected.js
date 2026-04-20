/**
 * 将筛选结果写入 selected 目录
 * 每个商品一个 markdown 文件
 */

const fs = require('fs');
const path = require('path');

const selectionDate = '2026-04-20';

// 加载筛选结果
const result = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../selected/dailytemp/2026-04-20/selected_products.json'),
  'utf8'
));

// 创建输出目录
const outputDir = path.join(__dirname, '../selected', selectionDate.replace(/-/g, ''));
fs.mkdirSync(outputDir, { recursive: true });

console.log('========================================');
console.log('写入选品结果到 selected 目录');
console.log('========================================\n');

// 生成每个商品的 markdown 文件
result.selections.forEach((item, index) => {
  const id = item.id;
  const fileName = `${id}.md`;
  const filePath = path.join(outputDir, fileName);

  // 补全图片URL
  let imageUrl = item.thumbnail;
  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }

  // 构建商品链接
  let detailUrl = '';
  if (item.platform === 'temu') {
    detailUrl = `https://www.temu.com/g-${item.goodsId}.html`;
  } else if (item.platform === 'shein') {
    detailUrl = `https://www.shein.com/product-detail/${item.goodsId}.html`;
  } else if (item.platform === 'amazon') {
    detailUrl = `https://www.amazon.com/dp/${item.goodsId}`;
  } else if (item.platform === 'sumaitong') {
    detailUrl = `https://www.aliexpress.com/item/${item.goodsId}.html`;
  } else if (item.platform === 'tiktok') {
    detailUrl = `https://www.tiktok.com/shop/product/${item.goodsId}`;
  }

  const markdown = `---
id: "${id}"
platform: "${item.platform}"
category: "${item.category}"
channel: "${item.channel}"
goodsId: "${item.goodsId}"
goodsName: "${item.goodsName.replace(/"/g, "'")}"
thumbnail: "${imageUrl}"
detailUrl: "${detailUrl}"
sold: ${item.sold}
priceMin: ${item.priceMin}
priceMax: ${item.priceMax}
reviewNum: ${item.reviewNum}
rating: ${item.rating}
score: ${item.score}
selectionReason: "${item.selectionReason}"
selectionDate: "${selectionDate}"
createdAt: "${new Date().toISOString()}"
---

# ${item.goodsName}

## 基本信息

| 属性 | 值 |
|------|-----|
| 商品ID | ${item.goodsId} |
| 平台 | ${item.platform.toUpperCase()} |
| 类目 | ${item.category} |
| 渠道 | ${item.channel} |
| 销量 | ${item.sold} |
| 价格 | $${item.priceMin} ~ $${item.priceMax} |
| 评论数 | ${item.reviewNum} |
| 评分 | ${item.rating} |

## 选品理由

${item.selectionReason}

## 商品图片

![商品图片](${imageUrl})

## 商品链接

[查看商品详情](${detailUrl})

## 综合评分

**${item.score}** 分

---
*由 Selector Agent 自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;

  fs.writeFileSync(filePath, markdown);
  console.log(`✓ ${index + 1}. ${fileName} - ${item.goodsName.substring(0, 50)}...`);
});

console.log(`\n========================================`);
console.log(`完成! 共写入 ${result.selections.length} 个商品到 ${outputDir}`);
console.log(`========================================`);

// 同时更新 crawl_state.js 的 lastCrawled
updateCrawlState(result);

function updateCrawlState(selectionResult) {
  // 读取 crawl_state.js
  const statePath = path.join(__dirname, '../selected/crawl_state.js');
  let stateContent = fs.readFileSync(statePath, 'utf8');

  // 获取本次采集的平台和类目
  const crawledData = {};
  selectionResult.selections.forEach(item => {
    const key = `${item.platform}:${item.category}`;
    if (!crawledData[key]) {
      crawledData[key] = { platform: item.platform, category: item.category };
    }
  });

  console.log('\n更新 crawl_state.js 的 lastCrawled 时间...');

  // 生成新的 lastUpdated
  const now = new Date().toISOString();
  stateContent = stateContent.replace(
    /lastUpdated:\s*"[^"]*"/,
    `lastUpdated: "${now}"`
  );

  // 更新各平台的 lastCrawled（只更新本次采集涉及的类目）
  // 本次采集的类目：
  // - temu: 图书 (catId 44933)
  // - shein: 食品和饮料 (catId 13086)
  // - amazon: 视频游戏 (catId 468642)
  // - sumaitong: 玩具 (catId 26)
  // - tiktok: Muslim Fashion (catId 601303)

  // 使用更简单的替换方式：直接替换每个类目的 lastCrawled
  // 注意：需要使用精确匹配，避免误匹配
  const categoriesToUpdate = [
    { platform: 'temu', catId: 44933, catName: '图书' },
    { platform: 'shein', catId: 13086, catName: '食品和饮料' },
    { platform: 'amazon', catId: 468642, catName: '视频游戏' },
    { platform: 'sumaitong', catId: 26, catName: '玩具' },
    { platform: 'tiktok', catId: 601303, catName: 'Muslim Fashion' }
  ];

  categoriesToUpdate.forEach(({ platform, catId, catName }) => {
    // 匹配特定平台下的特定类目
    // 格式：{ catId: xxx, catName: "xxx", lastCrawled: null }
    const regex = new RegExp(`(\\{ catId: ${catId}, catName: "${catName}", lastCrawled: )null`);
    stateContent = stateContent.replace(regex, `$1"${now}"`);
  });

  fs.writeFileSync(statePath, stateContent);
  console.log('✓ crawl_state.js 已更新');
}