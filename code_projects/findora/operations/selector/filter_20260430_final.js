/**
 * ============================================
 * 商品筛选脚本 Final - 2026-04-30
 * ============================================
 *
 * 最终版本：
 * 1. 完全去重
 * 2. 强制平台多样性
 * 3. 选择真正有趣的商品
 */

const fs = require('fs');

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync('./dailytemp/2026-04-30/raw_products.json', 'utf8'));
const products = rawData.products;

console.log(`\n========================================`);
console.log(`选品筛选 Final - 2026-04-30`);
console.log(`========================================`);
console.log(`待筛选商品总数: ${products.length}\n`);

// ============================================
// 1. 完全去重：基于goodsId + platform
// ============================================
const seen = new Set();
const uniqueProducts = [];

for (const p of products) {
  const key = `${p._platform}-${p.goodsId}`;
  if (!seen.has(key)) {
    seen.add(key);
    uniqueProducts.push(p);
  }
}
console.log(`去重后商品数: ${uniqueProducts.length}`);

// ============================================
// 2. 计算选品评分
// ============================================
const SPECIAL_KEYWORDS = [
  '创意', '多功能', '套装', '礼盒', '2件', '3件', 'set',
  '解谜', '机关', '智能', '电动', '自动', '声控', '遥控',
  '变形', '磁吸', '充电', '发光', '变色', '懒人', '神器', '黑科技',
  '网红', 'viral', 'trending', 'unique', 'gift'
];

function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '');

  // 销量 (0-30分)
  const sold = product.sold || 0;
  score += Math.min(30, Math.log10(sold + 1) * 4);

  // 评分 (0-20分)
  score += (product.rating || 0) * 4;

  // 评论数 (0-10分) - 太少或太多都不是最优
  const reviews = product.reviewNum || 0;
  if (reviews >= 100 && reviews <= 30000) score += 10;
  else if (reviews > 30000) score += 5;
  else if (reviews > 0) score += 3;

  // 价格 (0-10分)
  const avgPrice = ((product.goodsPriceMin || 0) + (product.goodsPriceMax || product.goodsPriceMin || 0)) / 2;
  if (avgPrice >= 5 && avgPrice <= 30) score += 10;
  else if (avgPrice > 30 && avgPrice <= 50) score += 7;
  else if (avgPrice > 0 && avgPrice < 5) score += 5;

  // 新奇特关键词 (0-15分)
  let special = 0;
  for (const kw of SPECIAL_KEYWORDS) {
    if (name.toLowerCase().includes(kw.toLowerCase())) special += 3;
  }
  score += Math.min(15, special);

  // 母亲节热点加分
  if (/Mother|母亲节|mother/i.test(name)) score += 5;

  return score;
}

// 3. 按平台和评分排序
const scored = uniqueProducts.map(p => ({ product: p, score: scoreProduct(p) }));
scored.sort((a, b) => b.score - a.score);

// ============================================
// 4. 强制平台多样性选择
// ============================================
const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
const selected = [];
const usedKeys = new Set();

for (const p of scored) {
  if (selected.length >= 10) break;

  const key = `${p.product._platform}-${p.product.goodsId}`;
  if (usedKeys.has(key)) continue;

  // 检查该平台是否已选够2个
  const platformCount = selected.filter(s => s.product._platform === p.product._platform).length;
  if (platformCount >= 2) continue;

  usedKeys.add(key);
  selected.push(p);
}

// 如果不够10个，放宽限制
if (selected.length < 10) {
  for (const p of scored) {
    if (selected.length >= 10) break;

    const key = `${p.product._platform}-${p.product.goodsId}`;
    if (usedKeys.has(key)) continue;

    usedKeys.add(key);
    selected.push(p);
  }
}

// ============================================
// 5. 格式化输出
// ============================================
function analyzeProduct(product) {
  const name = (product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '');
  const features = [];

  if (/2件|3件|套装|组合|礼盒|set/i.test(name)) features.push('套装组合');
  if (/多功能|多用|all in one/i.test(name)) features.push('多功能');
  if (/电动|智能|automatic|smart/i.test(name)) features.push('科技感');
  if (/可爱|趣味|fun|cute/i.test(name)) features.push('趣味可爱');
  if (/礼物|gift/i.test(name)) features.push('送礼佳品');
  if (/防水|waterproof/i.test(name)) features.push('防水功能');
  if (/便携|折叠|mini|portable|fold/i.test(name)) features.push('便携小巧');
  if (/LED|light/i.test(name)) features.push('LED灯效');
  if (/无线|wireless/i.test(name)) features.push('无线便携');
  if (/ins|网红|trending|viral/i.test(name)) features.push('网红爆款');
  if (/Mother|母亲/i.test(name)) features.push('节日热点');
  if (/运动|sport|outdoor|gym|fitness/i.test(name)) features.push('运动户外');

  return features.length > 0 ? features : ['日用单品'];
}

const finalSelected = selected.map((s, i) => {
  const features = analyzeProduct(s.product);
  const price = s.product.goodsPriceMax > s.product.goodsPriceMin
    ? `$${s.product.goodsPriceMin}-${s.product.goodsPriceMax}`
    : `$${s.product.goodsPriceMin}`;

  const reasons = [];
  if (s.product.sold > 50000) reasons.push(`销量${s.product.sold}件`);
  if (s.product.rating >= 4.5) reasons.push(`评分${s.product.rating}`);
  if (s.product.reviewNum >= 100) reasons.push(`${s.product.reviewNum}条评价`);
  if (features.length > 0) reasons.push(features.join(', '));

  return {
    rank: i + 1,
    platform: s.product._platform.toUpperCase(),
    category: s.product._categoryName,
    name: (s.product.goodsNameEn || s.product.goodsNameCn || 'Unknown').substring(0, 100),
    price,
    sold: s.product.sold,
    rating: s.product.rating,
    reviews: s.product.reviewNum,
    thumbnail: s.product.thumbnail,
    goodsId: s.product.goodsId,
    features,
    score: Math.round(s.score * 10) / 10,
    reason: reasons.join('；')
  };
});

// ============================================
// 6. 输出结果
// ============================================
console.log('\n========== 精选商品 Top 10 ==========\n');

finalSelected.forEach(p => {
  console.log(`${p.rank}. [${p.platform}] ${p.name}`);
  console.log(`   价格: ${p.price} | 销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviews}`);
  console.log(`   特点: ${p.features.join(', ')}`);
  console.log(`   选品理由: ${p.reason}`);
  console.log('');
});

// 平台分布
console.log('\n========== 平台分布 ==========');
const dist = {};
finalSelected.forEach(p => {
  dist[p.platform] = (dist[p.platform] || 0) + 1;
});
Object.entries(dist).forEach(([p, c]) => console.log(`${p}: ${c}个`));

// 保存结果
const outputData = {
  date: '2026-04-30',
  totalProducts: products.length,
  uniqueProducts: uniqueProducts.length,
  selectedProducts: finalSelected,
  platformDistribution: dist
};

fs.writeFileSync('./dailytemp/2026-04-30/selected_20260430_final.json', JSON.stringify(outputData, null, 2));
console.log('\n最终结果已保存到: dailytemp/2026-04-30/selected_20260430_final.json');

module.exports = { selected: finalSelected };