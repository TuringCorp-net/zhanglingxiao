/**
 * 选品筛选脚本 v5 - 2026-04-27
 * 目标：按"新奇/有趣/好玩/有爆点"筛选商品，生成10个去重后的入选商品
 */

const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync(
  '/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected/dailytemp/2026-04-27/raw_products.json',
  'utf-8'
));

const products = rawData.products;
console.log(`总共 ${products.length} 个商品待筛选\n`);

// 去重：基于 goodsId 去重
const uniqueMap = new Map();
products.forEach(p => {
  const key = `${p.platform}-${p.goodsId}`;
  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, p);
  }
});
const uniqueProducts = Array.from(uniqueMap.values());
console.log(`去重后: ${uniqueProducts.length} 个商品\n`);

// 评分函数 - 综合考虑新奇度、销量、评分
function scoreProduct(p) {
  let score = 0;

  // 销量分数 (0-30)
  const sold = p.sold || 0;
  score += Math.min(30, Math.log10(sold + 1) * 8);

  // 评分分数 (0-20)
  const rating = p.rating || 0;
  score += rating * 3;

  // 新奇特关键词加分
  const nameLower = (p.goodsNameEn || '').toLowerCase();
  const noveltyKeywords = [
    'fun', 'creative', 'unique', 'novel', 'quirky', 'quirk', 'cute', 'magic',
    'transform', 'surprise', 'play', 'game', 'puzzle', 'diy', 'handmade',
    'personalized', 'custom', 'gift', 'party', 'decor', 'decorative',
    'projector', 'lamp', 'light', 'led', 'neon', 'glow', 'animal', 'cartoon',
    'astronaut', 'robot', 'fantasy', 'space', 'galaxy', 'crystal', 'rainbow',
    'sensory', 'fidget', 'stress', 'relax', 'zen', 'candle', 'aromatherapy',
    'hologram', '3d', 'glow', 'flashing', 'animated', 'retro', 'vintage',
    'handheld', 'console', 'game', 'sticky', 'slime', 'squishy',
    'figurine', 'plush', 'toy', 'kids', 'children', 'baby'
  ];

  noveltyKeywords.forEach(kw => {
    if (nameLower.includes(kw)) score += 3;
  });

  // 评论数加分
  const reviews = p.reviewNum || 0;
  if (reviews > 100) score += 3;
  if (reviews > 1000) score += 3;
  if (reviews > 5000) score += 3;

  // 价格适中加分 (避免太便宜或太贵的)
  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 80) score += 3;

  // 新品加分（上架时间在近30天内）
  const onSaleTime = p.onSaleTime ? new Date(p.onSaleTime) : null;
  if (onSaleTime) {
    const daysSinceSale = (Date.now() - onSaleTime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSale < 30) score += 5;
    if (daysSinceSale < 90) score += 2;
  }

  return score;
}

// 排除关键词（太普通/无趣的商品）
const excludeKeywords = [
  'plain', 'basic', 'standard', 'simple', 'ordinary',
  'cable', 'charger for', 'case for', 'cover for', 'protector',
  'generic', 'bulk', 'wholesale', 'replacement', 'spare'
];

function shouldExclude(p) {
  const nameLower = (p.goodsNameEn || '').toLowerCase();
  for (const kw of excludeKeywords) {
    if (nameLower.includes(kw)) return true;
  }
  return false;
}

// 筛选
const scoredProducts = uniqueProducts
  .filter(p => !shouldExclude(p))
  .map(p => ({ ...p, score: scoreProduct(p) }))
  .sort((a, b) => b.score - a.score);

// 确保多样性：每个平台最多选2个
const platformLimit = 2;
const selected = [];
const platformCount = {};

for (const p of scoredProducts) {
  const platform = p.platform;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  if (platformCount[platform] <= platformLimit && selected.length < 10) {
    selected.push(p);
  }

  if (selected.length >= 10) break;
}

console.log('===== 最终筛选结果 =====\n');
selected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.catName}`);
  console.log(`   ${p.goodsNameEn?.substring(0, 80)}...`);
  console.log(`   销量: ${p.sold?.toLocaleString()} | 价格: $${p.goodsPriceMin} | 评分: ${p.rating} | 评论: ${p.reviewNum?.toLocaleString()}`);
  console.log(`   来源: ${p.source} | 综合评分: ${p.score.toFixed(1)}`);
  console.log('');
});

// 保存最终结果
const result = {
  timestamp: new Date().toISOString(),
  totalScreened: uniqueProducts.length,
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

console.log(`已保存 ${selected.length} 个商品至 selected_20260427_v2.json`);
console.log('\n===== 平台分布 =====');
Object.entries(platformCount).forEach(([platform, count]) => {
  const selectedCount = selected.filter(p => p.platform === platform).length;
  console.log(`${platform}: 入选 ${selectedCount} 个`);
});