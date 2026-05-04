/**
 * 选品筛选脚本 - 2026-05-04
 * 按照"新奇/有趣/好玩/有爆点"原则筛选商品
 */

const fs = require('fs');

// 读取原始数据
const rawData = JSON.parse(fs.readFileSync(__dirname + '/dailytemp/2026-05-04/raw_products.json', 'utf8'));
const products = rawData.products;

console.log('===========================================');
console.log('  选品筛选 - 2026-05-04');
console.log('===========================================');
console.log(`待筛选商品: ${products.length} 个\n`);

// ============================================
// 选品评分函数 - 评估商品的"新奇有趣爆点"指数
// ============================================
function calculateScore(product) {
  let score = 0;
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();

  // 销量加权 (销量越高越有市场验证)
  const sold = product.sold || 0;
  if (sold >= 10000) score += 30;
  else if (sold >= 5000) score += 25;
  else if (sold >= 2000) score += 20;
  else if (sold >= 1000) score += 15;
  else if (sold >= 500) score += 10;
  else if (sold >= 100) score += 5;

  // 评论数 - 有评论说明有真实购买
  const reviews = product.reviewNum || 0;
  if (reviews >= 1000) score += 15;
  else if (reviews >= 500) score += 12;
  else if (reviews >= 100) score += 8;
  else if (reviews >= 50) score += 5;
  else if (reviews >= 10) score += 3;

  // 评分 - 高评分说明质量可靠
  const rating = product.rating || 0;
  if (rating >= 4.8) score += 10;
  else if (rating >= 4.5) score += 7;
  else if (rating >= 4.0) score += 4;
  else if (rating >= 3.5) score += 2;

  // 新奇有趣关键词加分
  const funKeywords = [
    'fun', 'toy', 'game', 'puzzle', 'cute', 'novelty', 'unique', 'weird', 'strange',
    '趣味', '玩具', '游戏', '可爱', '新奇', '创意', '搞怪', '搞笑',
    'smart', 'led', 'rgb', 'wireless', 'bluetooth', 'auto', 'automatic', 'mini', 'portable',
    '智能', '科技', '迷你', '便携', '无线', '自动',
    'decor', 'decorative', 'gift', 'home', 'kitchen', 'organizer', 'holder',
    '装饰', '礼品', '家居', '厨房', '收纳', '创意',
    'pet', 'dog', 'cat', 'catnip', 'treat', 'feeder',
    '宠物', '狗', '猫', '猫爬架', '逗猫',
    'fitness', 'yoga', 'outdoor', 'camping', 'sport', 'exercise',
    '健身', '瑜伽', '户外', '运动', '减肥'
  ];

  for (const kw of funKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 5;
      break;
    }
  }

  // 价格适中
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const avgPrice = (priceMin + priceMax) / 2;
  if (avgPrice >= 5 && avgPrice <= 50) score += 10;
  else if (avgPrice >= 3 && avgPrice <= 80) score += 5;

  // 来源渠道加分
  if (product.sourceChannel === '热销新品' || product.sourceChannel === '新店热销') {
    score += 5;
  }

  return score;
}

// ============================================
// 执行筛选
// ============================================

// 去重
const uniqueMap = new Map();
for (const p of products) {
  const key = p.goodsId || p.goodsNameEn || JSON.stringify(p);
  if (!uniqueMap.has(key)) {
    uniqueMap.set(key, { ...p, _key: key });
  }
}
const uniqueProducts = Array.from(uniqueMap.values());
console.log(`去重后商品: ${uniqueProducts.length} 个`);

// 计算评分
const scoredProducts = uniqueProducts.map(p => ({
  ...p,
  noveltyScore: calculateScore(p)
}));

// 按评分排序
scoredProducts.sort((a, b) => b.noveltyScore - a.noveltyScore);

// 输出Top10
console.log('\n========== 精选Top 10 商品 ==========\n');

const selectedProducts = scoredProducts.slice(0, 10);
selectedProducts.forEach((p, i) => {
  console.log(`【${i + 1}】${p.platform} | ${p.sourceChannel} | ${p.sourceCategory}`);
  console.log(`    商品: ${p.goodsNameEn || p.goodsName || 'N/A'}`);
  console.log(`    中文: ${p.goodsNameCn || 'N/A'}`);
  console.log(`    价格: $${p.goodsPriceMin || 0} ~ $${p.goodsPriceMax || 0}`);
  console.log(`    销量: ${(p.sold || 0).toLocaleString()}`);
  console.log(`    评论: ${p.reviewNum || 0} | 评分: ${p.rating || 'N/A'}`);
  console.log(`    新奇指数: ${p.noveltyScore}`);
  console.log(`    ID: ${p.goodsId || 'N/A'}`);
  console.log('');
});

// 保存筛选结果
const selectedOutput = selectedProducts.map((p, i) => ({
  rank: i + 1,
  platform: p.platform,
  channel: p.sourceChannel,
  category: p.sourceCategory,
  goodsId: p.goodsId,
  goodsName: p.goodsNameEn || p.goodsName,
  goodsNameCn: p.goodsNameCn,
  priceMin: p.goodsPriceMin,
  priceMax: p.goodsPriceMax,
  sold: p.sold,
  reviewNum: p.reviewNum,
  rating: p.rating,
  noveltyScore: p.noveltyScore,
  thumbnail: p.thumbnail,
  detailUrl: p.detailUrl
}));

fs.writeFileSync(__dirname + '/selected_20260504_v2.json', JSON.stringify(selectedOutput, null, 2));
console.log(`✓ 筛选结果已保存: selected_20260504_v2.json`);
