/**
 * 选品筛选脚本 - 2026-04-27
 * 目标：按"新奇/有趣/好玩/有爆点"筛选商品，生成10个入选商品
 */

const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync(
  '/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected/dailytemp/2026-04-27/raw_products.json',
  'utf-8'
));

const products = rawData.products;
console.log(`总共 ${products.length} 个商品待筛选\n`);

// 选品逻辑：
// 1. 优先选择新奇特、有创意的商品
// 2. 避免普通日用品
// 3. 关注评分高、销量好的爆品潜质商品
// 4. 注重商品的娱乐性和话题性

// 评分函数 - 综合考虑新奇度、销量、评分
function scoreProduct(p) {
  let score = 0;

  // 销量分数 (0-30)
  const sold = p.sold || 0;
  score += Math.min(30, Math.log10(sold + 1) * 10);

  // 评分分数 (0-20)
  const rating = p.rating || 0;
  score += rating * 4;

  // 新奇特关键词加分
  const nameLower = (p.goodsNameEn || '').toLowerCase();
  const noveltyKeywords = [
    'fun', 'creative', 'unique', 'novel', 'quirky', 'quirk', 'cute', 'magic',
    'transform', 'surprise', 'play', 'game', 'puzzle', 'diy', 'handmade',
    'personalized', 'custom', 'gift', 'party', 'decor', 'decorative',
    'projector', 'lamp', 'light', 'led', 'neon', 'glow', 'animal', 'cartoon',
    'astronaut', 'robot', 'fantasy', 'space', 'galaxy', 'crystal', 'rainbow',
    'sensory', 'fidget', 'stress', 'relax', 'zen', 'candle', 'aromatherapy',
    'hologram', '3d', 'glow', 'flashing', 'animated'
  ];

  noveltyKeywords.forEach(kw => {
    if (nameLower.includes(kw)) score += 5;
  });

  // 评论数加分
  const reviews = p.reviewNum || 0;
  if (reviews > 100) score += 5;
  if (reviews > 1000) score += 5;
  if (reviews > 5000) score += 5;

  // 价格适中加分 (避免太便宜或太贵的)
  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) score += 5;

  return score;
}

// 排除关键词（太普通/无趣的商品）
const excludeKeywords = [
  'plain', 'basic', 'standard', 'simple', 'ordinary',
  'cable', 'charger', 'case', 'cover', 'protector',  // 手机配件太普通
  'kitchen', 'fork', 'spoon', 'plate', 'bowl',  // 厨房用品太普通
  'cleaning', 'mop', 'broom',  // 清洁工具
  'generic', 'bulk', 'wholesale'
];

function shouldExclude(p) {
  const nameLower = (p.goodsNameEn || '').toLowerCase();
  for (const kw of excludeKeywords) {
    if (nameLower.includes(kw)) return true;
  }
  return false;
}

// 筛选
const scoredProducts = products
  .filter(p => !shouldExclude(p))
  .map(p => ({ ...p, score: scoreProduct(p) }))
  .sort((a, b) => b.score - a.score);

// 确保多样性：每个平台最多选3个
const platformLimit = 3;
const selected = [];
const platformCount = {};

for (const p of scoredProducts) {
  const platform = p.platform;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  if (platformCount[platform] <= platformLimit && selected.length < 12) {
    selected.push(p);
  }

  if (selected.length >= 10) break;
}

console.log('===== 筛选结果 =====\n');
selected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.catName}`);
  console.log(`   ${p.goodsNameEn?.substring(0, 80)}...`);
  console.log(`   销量: ${p.sold} | 价格: $${p.goodsPriceMin} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`   来源: ${p.source} | 评分: ${p.score.toFixed(1)}`);
  console.log('');
});

// 保存最终结果
const result = {
  timestamp: new Date().toISOString(),
  totalScreened: products.length,
  selected: selected.map(p => ({
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    thumbnail: p.thumbnail,
    thumbnailCn: p.thumbnailCn,
    sold: p.sold,
    sales: p.sales,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    reviewNum: p.reviewNum,
    rating: p.rating,
    mallOpenTime: p.mallOpenTime,
    onSaleTime: p.onSaleTime,
    goodsId: p.goodsId,
    detailUrl: p.detailUrl,
    platform: p.platform,
    catItems: p.catItems,
    goodsName: p.goodsName,
    source: p.source,
    catName: p.catName,
    score: p.score
  }))
};

fs.writeFileSync(
  '/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected/selected_20260427_v2.json',
  JSON.stringify(result, null, 2)
);

console.log(`\n已保存 ${selected.length} 个商品至 selected_20260427_v2.json`);