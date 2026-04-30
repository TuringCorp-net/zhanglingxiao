/**
 * 选品筛选脚本 - 2026-04-30
 *
 * 筛选标准：
 * 1. 新奇特 - 造型/功能有趣
 * 2. 差异化 - 有独特卖点
 * 3. 视觉冲击力 - 适合社媒传播
 * 4. 销量适中 - 避免太卷的红海或没市场的蓝海
 */

const fs = require('fs');
const path = require('path');

// 读取原始数据
const rawData = fs.readFileSync(path.join(__dirname, 'dailytemp', '2026-04-30', 'all_products.json'), 'utf8');
const allProducts = JSON.parse(rawData);

console.log('='.repeat(60));
console.log('选品筛选开始 - 2026-04-30');
console.log('='.repeat(60));
console.log(`待筛选商品: ${allProducts.length} 个\n`);

// 筛选逻辑
const filterRules = {
  // 排除的商品类型
  excludeKeywords: [
    'phone case', 'case for iphone', 'case for samsung',
    'screen protector', 'glass protector',
    'towel', 'sponge', 'scrub',
    'hair ties', 'elastic band', 'hair band',
    'nail file', 'nail buffer',
    'toilet brush', 'cleaning brush',
    'cable', 'charger', 'usb',
    'generic', 'basic', 'simple',
    'replacement', 'spare'
  ],

  // 优先保留的关键词（有趣/新奇相关）
  preferKeywords: [
    'fun', 'cute', 'unique', 'novelty', 'quirky', 'weird', 'bizarre',
    'transform', 'foldable', 'portable', 'mini', 'compact',
    'light up', 'glowing', 'led', 'neon', 'rgb',
    'gift', 'surprise', 'magic', 'illusion',
    'robot', 'automatic', 'smart', 'ai',
    'pet', 'dog', 'cat', 'animal',
    'kids', 'children', 'baby', 'toy',
    'game', 'puzzle', 'cube',
    'deco', 'decor', 'art', 'artistic',
    'vintage', 'retro', 'steampunk', 'gothic',
    'fashion', 'style', 'trendy', 'viral',
    'hobby', 'craft', 'creative',
    'fitness', 'yoga', 'exercise', 'gym',
    'outdoor', 'camping', 'hiking', 'travel',
    'kitchen', 'cooking', 'baking',
    'home', 'garden', 'plant'
  ],

  // 价格区间（美元）
  priceRange: { min: 5, max: 100 },

  // 销量范围
  soldRange: { min: 100, max: 500000 }
};

/**
 * 计算商品评分
 */
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '').toLowerCase();
  const cnName = (product.goodsNameCn || '').toLowerCase();

  // 1. 优先关键词加分
  for (const kw of filterRules.preferKeywords) {
    if (name.includes(kw) || cnName.includes(kw)) {
      score += 5;
    }
  }

  // 2. 新品加分（近30天上架）
  const onSaleTime = product.onSaleTime ? new Date(product.onSaleTime) : null;
  if (onSaleTime) {
    const daysSinceOnSale = (Date.now() - onSaleTime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceOnSale <= 30) score += 10;
    else if (daysSinceOnSale <= 90) score += 5;
    else if (daysSinceOnSale <= 180) score += 2;
  }

  // 3. 评论数适中加分（有一定反馈但不是太卷）
  const reviewNum = product.reviewNum || 0;
  if (reviewNum >= 50 && reviewNum <= 5000) score += 8;
  else if (reviewNum > 5000) score += 3;

  // 4. 评分高加分
  if (product.rating >= 4.7) score += 5;
  else if (product.rating >= 4.5) score += 3;
  else if (product.rating >= 4.0) score += 1;

  // 5. 价格适中加分（太低没利润，太高难转化）
  const price = product.goodsPriceMin || 0;
  if (price >= 8 && price <= 50) score += 5;
  else if (price >= 5 && price <= 80) score += 3;

  // 6. 销量适中加分（避免太卷的红海）
  const sold = product.sold || 0;
  if (sold >= 500 && sold <= 200000) score += 5;
  else if (sold >= 200 && sold <= 500000) score += 3;

  // 7. 有缩略图加分
  if (product.thumbnail) score += 2;

  // 8. 有商品ID加分（可追踪）
  if (product.goodsId) score += 1;

  return score;
}

/**
 * 检查是否应该排除
 */
function shouldExclude(product) {
  const name = ((product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '')).toLowerCase();

  for (const kw of filterRules.excludeKeywords) {
    if (name.includes(kw)) return true;
  }
  return false;
}

// 筛选流程
console.log('【第一轮】排除低质商品...');
const afterExclude = allProducts.filter(p => !shouldExclude(p));
console.log(`  排除 ${allProducts.length - afterExclude.length} 个，剩余 ${afterExclude.length} 个\n`);

console.log('【第二轮】评分排序...');
const scored = afterExclude.map(p => ({
  ...p,
  _score: scoreProduct(p)
}));

const sorted = scored.sort((a, b) => b._score - a._score);

// 显示评分最高的20个
console.log('\n评分最高的20个候选商品:');
sorted.slice(0, 20).forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.goodsNameEn.substring(0, 60)}...`);
  console.log(`   价格: $${p.goodsPriceMin || '?'}-${p.goodsPriceMax || '?'} | 销量: ${p.sold?.toLocaleString() || '?'} | 评价: ${p.reviewNum || 0} | 评分: ${p.rating || '?'} | 分: ${p._score}`);
});

// 选取前10个
const selected = sorted.slice(0, 10);

console.log('\n' + '='.repeat(60));
console.log('【最终入选】10个精选商品:');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n--- 商品 ${i + 1} ---`);
  console.log(`平台: ${p.platform}`);
  console.log(`类目: ${p._catId}`);
  console.log(`来源: ${p._source}`);
  console.log(`名称(EN): ${p.goodsNameEn}`);
  console.log(`名称(CN): ${p.goodsNameCn}`);
  console.log(`价格: $${p.goodsPriceMin || '?'} ~ $${p.goodsPriceMax || '?'}`);
  console.log(`销量: ${p.sold?.toLocaleString() || '?'}`);
  console.log(`评价数: ${p.reviewNum || 0}`);
  console.log(`评分: ${p.rating || '?'}`);
  console.log(`上架时间: ${p.onSaleTime || '?'}`);
  console.log(`商品ID: ${p.goodsId}`);
  console.log(`缩略图: ${p.thumbnail || '?'}`);
  console.log(`评分: ${p._score}`);
});

// 保存结果
const outputFile = path.join(__dirname, 'selected_20260430_v4.json');
fs.writeFileSync(outputFile, JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log(`筛选完成！${selected.length} 个商品已保存至: ${outputFile}`);
console.log('='.repeat(60));

module.exports = selected;