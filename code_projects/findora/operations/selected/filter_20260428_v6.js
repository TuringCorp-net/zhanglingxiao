/**
 * 选品筛选脚本 - 2026-04-28
 *
 * 按照"新奇/有趣/好玩/有爆点"的原则筛选商品
 * 生成10个入选商品，写入 selected 目录
 */

const fs = require('fs');

// 读取所有采集结果
const collectedData = JSON.parse(fs.readFileSync('operations/selected/2026-04-28/collected_1777345351104.json', 'utf-8'));
const supplementData = JSON.parse(fs.readFileSync('operations/selected/2026-04-28/supplement_1777345380995.json', 'utf-8'));

// 合并所有商品
const allProducts = [
  ...collectedData.products,
  ...supplementData.products
];

console.log(`总待筛选商品: ${allProducts.length}`);

// 筛选逻辑
// 1. 新奇有趣：名称中包含特定关键词
// 2. 有爆点：销量高、评论多、评分高
// 3. 排除：太普通、无特色的商品

const INTERESTING_KEYWORDS = [
  // 新奇特
  'funny', 'unique', 'novelty', 'quirky', 'cute', 'cool', 'weird', 'strange',
  '创意', '新奇', '搞笑', '可爱', '独特', '搞怪', '爆款', '网红', '热销',
  'mini', 'portable', 'foldable', 'wireless', 'smart', 'led', 'rgb',
  '玩具', '游戏', '礼物', '礼品', '装饰', '装饰品', '派对', '节日',
  'kids', 'children', 'baby', 'pet', 'cat', 'dog',
  // 热门品类
  'phone', 'case', 'holder', 'charger', 'cable', 'earphone', 'headphone',
  'kitchen', 'home', 'garden', 'outdoor', 'sports', 'fitness',
  'makeup', 'beauty', 'skin', 'hair', 'fashion', 'jewelry'
];

const BAN_WORDS = [
  '批发', '定制', 'oem', 'odm', 'bulk', 'wholesale',
  '二手', 'used', 'refurbished'
];

// 评分商品
function scoreProduct(product) {
  let score = 0;

  // 销量评分 (最高40分)
  const sold = product.sold || 0;
  if (sold > 50000) score += 40;
  else if (sold > 20000) score += 30;
  else if (sold > 10000) score += 20;
  else if (sold > 5000) score += 15;
  else if (sold > 1000) score += 10;
  else if (sold > 100) score += 5;

  // 评论数评分 (最高20分)
  const reviews = product.reviewNum || 0;
  if (reviews > 10000) score += 20;
  else if (reviews > 5000) score += 15;
  else if (reviews > 1000) score += 10;
  else if (reviews > 100) score += 5;

  // 评分评分 (最高15分)
  const rating = product.rating || 0;
  if (rating >= 4.8) score += 15;
  else if (rating >= 4.5) score += 10;
  else if (rating >= 4.0) score += 5;

  // 新品加分 (上架时间30天内) (最高15分)
  if (product.onSaleTime) {
    const saleDate = new Date(product.onSaleTime);
    const daysSinceSale = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSale <= 7) score += 15;
    else if (daysSinceSale <= 14) score += 12;
    else if (daysSinceSale <= 30) score += 8;
  }

  // 有趣关键词匹配 (最高10分)
  const nameLower = (product.goodsNameEn || '').toLowerCase();
  const nameCn = product.goodsNameCn || '';
  for (const kw of INTERESTING_KEYWORDS) {
    if (nameLower.includes(kw.toLowerCase()) || nameCn.includes(kw)) {
      score += 2;
      if (score >= 10) break;
    }
  }

  return score;
}

// 检查是否应该排除
function shouldExclude(product) {
  const nameLower = (product.goodsNameEn || '').toLowerCase();
  const nameCn = product.goodsNameCn || '';

  for (const ban of BAN_WORDS) {
    if (nameLower.includes(ban.toLowerCase()) || nameCn.includes(ban)) {
      return true;
    }
  }

  // 排除太便宜的商品（可能有质量问题）
  if (product.goodsPriceMin !== null && product.goodsPriceMin < 2) {
    return true;
  }

  return false;
}

// 筛选商品
const scoredProducts = allProducts
  .filter(p => !shouldExclude(p))
  .map(p => ({
    ...p,
    _score: scoreProduct(p)
  }))
  .sort((a, b) => b._score - a._score);

// 取前15个候选
const candidates = scoredProducts.slice(0, 15);

console.log('\n候选商品 TOP 15:');
candidates.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.goodsNameEn?.substring(0, 60)}...`);
  console.log(`   销量: ${p.sold} | 评论: ${p.reviewNum} | 评分: ${p.rating} | 分数: ${p._score}`);
});

// 最终选择10个（尽量覆盖不同平台）
const selected = [];
const platformCount = {};

for (const p of candidates) {
  if (selected.length >= 10) break;

  // 每个平台最多3个
  const platform = p.platform;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  if (platformCount[platform] <= 3) {
    selected.push(p);
  }
}

// 如果不够10个，补充
if (selected.length < 10) {
  for (const p of candidates) {
    if (selected.length >= 10) break;
    if (!selected.includes(p)) {
      selected.push(p);
    }
  }
}

console.log('\n===========================================');
console.log('最终入选商品 (10个):');
console.log('===========================================');

const today = '2026-04-28';
selected.forEach((p, i) => {
  const id = `${today}${String(i + 1).padStart(3, '0')}`;
  console.log(`${id}: [${p.platform.toUpperCase()}] ${p.goodsNameEn?.substring(0, 50)}`);
});

// 写入每个商品的 markdown 文件
for (let i = 0; i < selected.length; i++) {
  const p = selected[i];
  const id = `${today}${String(i + 1).padStart(3, '0')}`;

  const markdown = `---
id: ${id}
platform: ${p.platform}
catName: ${p._source?.catName || p.catName || ''}
catId: ${p._source?.catId || p.catId || ''}
goodsId: ${p.goodsId || p.detailUrl || ''}
goodsNameEn: ${p.goodsNameEn || ''}
goodsNameCn: ${p.goodsNameCn || ''}
sold: ${p.sold || 0}
reviewNum: ${p.reviewNum || 0}
rating: ${p.rating || 0}
priceMin: ${p.goodsPriceMin || ''}
priceMax: ${p.goodsPriceMax || ''}
thumbnail: ${p.thumbnail || ''}
onSaleTime: ${p.onSaleTime || ''}
channel: ${p._source?.channel || ''}
channelTitle: ${p._source?.channelTitle || ''}
score: ${p._score}
crawlDate: ${today}
---

# ${p.goodsNameEn || '商品'}

${p.goodsNameCn ? `**中文名**: ${p.goodsNameCn}` : ''}

## 基本信息

- **平台**: ${p.platform?.toUpperCase() || ''}
- **类目**: ${p._source?.catName || p.catName || ''}
- **商品ID**: ${p.goodsId || p.detailUrl || ''}
- **链接**: ${p.thumbnail ? '' : '无'}

## 销售数据

- **销量**: ${p.sold?.toLocaleString() || 'N/A'}
- **评论数**: ${p.reviewNum?.toLocaleString() || 'N/A'}
- **评分**: ${p.rating || 'N/A'}
- **价格**: ${p.goodsPriceMin ? `$${p.goodsPriceMin}` : ''} ${p.goodsPriceMax ? `~ $${p.goodsPriceMax}` : ''}

## 图片

${p.thumbnail ? `![商品图片](${p.thumbnail})` : '_暂无图片_'}

## 选品理由

> 待 Curator 补充

---

*选品侦察员生成于 ${today}*
`;

  const filePath = `operations/selected/${id}.md`;
  fs.writeFileSync(filePath, markdown);
  console.log(`已写入: ${filePath}`);
}

// 保存选品报告
const report = `# 选品报告 - 2026-04-28

## 采集概况

| 平台 | 类目 | 采集数量 | 备注 |
|------|------|----------|------|
| Temu | 手机和配件 | 40 | 成功 |
| Shein | 玩具和游戏 | 40 | 成功 |
| Amazon | 乐器 | 0 | API无数据，改采玩具4个 |
| 速卖通 | 工具 | 40 | 成功 |
| TikTok | 宠物用品等 | 0 | API无法获取数据 |

**总计采集**: ${allProducts.length} 个唯一商品
**筛选后入选**: 10 个商品

## 入选商品

${selected.map((p, i) => {
  const id = `${today}${String(i + 1).padStart(3, '0')}`;
  return `${i + 1}. **${id}** - [${p.platform.toUpperCase()}] ${p.goodsNameEn?.substring(0, 50)}... (销量: ${p.sold}, 评分: ${p.rating}, 分数: ${p._score})`;
}).join('\n')}

## API 问题反馈

1. **Amazon 乐器类目 (catId: 11091801)**: API 返回无数据
2. **TikTok 所有类目**: API 持续返回无数据，疑似平台限制

## 后续建议

1. 检查 Amazon 和 TikTok 的 API 接口是否正常
2. 考虑使用 Playwright 方案进行数据采集
3. 补充采集更多平台的热销类目

---

*选品侦察员生成于 ${today}*
`;

fs.writeFileSync('operations/selected/20260428_selector_report.md', report);
console.log('\n选品报告已保存: operations/selected/20260428_selector_report.md');
