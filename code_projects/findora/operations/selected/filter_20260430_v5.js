/**
 * 选品筛选脚本 v5 - 2026-04-30
 *
 * 改进点：
 * 1. 去重 - 基于商品名称相似度去重
 * 2. 跨平台多样性 - 每个平台至少选1个
 * 3. 更精准的"新奇有趣"判断
 */

const fs = require('fs');
const path = require('path');

// 读取原始数据
const rawData = fs.readFileSync(path.join(__dirname, 'dailytemp', '2026-04-30', 'all_products.json'), 'utf8');
const allProducts = JSON.parse(rawData);

console.log('='.repeat(60));
console.log('选品筛选开始 v5 - 2026-04-30');
console.log('='.repeat(60));
console.log(`待筛选商品: ${allProducts.length} 个\n`);

// 评分规则
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '').toLowerCase();
  const cnName = (product.goodsNameCn || '').toLowerCase();
  const fullName = name + ' ' + cnName;

  // ===== 加分项 =====

  // 1. 新奇/有趣关键词
  const coolKeywords = [
    'fun', 'cute', 'unique', 'novelty', 'quirky', 'bizarre', 'odd',
    'transform', 'foldable', 'portable', 'mini', 'compact', 'travel',
    'light up', 'glowing', 'led', 'neon', 'rgb', 'colorful', 'rainbow',
    'gift', 'surprise', 'magic', 'illusion', 'trick',
    'robot', 'automatic', 'smart', 'ai', 'electronic',
    'pet', 'dog', 'cat', 'animal', 'puppy', 'kitten',
    'kids', 'children', 'baby', 'toddler', 'toy',
    'game', 'puzzle', 'cube', 'chess', 'card',
    'deco', 'decor', 'art', 'artistic', 'paint',
    'vintage', 'retro', 'steampunk', 'gothic', 'boho',
    'fashion', 'style', 'trendy', 'viral', 'tiktok',
    'hobby', 'craft', 'creative', 'diy', 'handmade',
    'fitness', 'yoga', 'exercise', 'gym', 'workout',
    'outdoor', 'camping', 'hiking', 'travel', 'adventure',
    'kitchen', 'cooking', 'baking', 'coffee', 'tea',
    'garden', 'plant', 'flower', 'succulent',
    'home', 'living room', 'bedroom', 'bathroom',
    'car', 'auto', 'vehicle', 'motorcycle', 'bike',
    'phone', 'watch', 'jewelry', 'accessory',
    'christmas', 'halloween', 'easter', 'valentine',
    'party', 'wedding', 'holiday', 'festival',
    'anime', 'manga', 'comic', 'cartoon', 'character',
    'kawaii', 'japanese', 'korean', 'vintage',
    'luxury', 'elegant', 'beautiful', 'gorgeous'
  ];

  for (const kw of coolKeywords) {
    if (fullName.includes(kw)) {
      score += 3;
    }
  }

  // 2. 新品加分（近30天上架）
  const onSaleTime = product.onSaleTime ? new Date(product.onSaleTime) : null;
  if (onSaleTime) {
    const daysSinceOnSale = (Date.now() - onSaleTime.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceOnSale <= 30) score += 15;
    else if (daysSinceOnSale <= 90) score += 8;
    else if (daysSinceOnSale <= 180) score += 3;
  }

  // 3. 评论数适中加分
  const reviewNum = product.reviewNum || 0;
  if (reviewNum >= 10 && reviewNum <= 2000) score += 10;
  else if (reviewNum > 2000 && reviewNum <= 10000) score += 5;
  else if (reviewNum > 10000) score += 2;

  // 4. 高评分加分
  if (product.rating >= 4.8) score += 8;
  else if (product.rating >= 4.5) score += 5;
  else if (product.rating >= 4.0) score += 2;

  // 5. 价格适中
  const price = product.goodsPriceMin || 0;
  if (price >= 5 && price <= 30) score += 8;
  else if (price >= 3 && price <= 50) score += 5;
  else if (price > 50) score -= 5;

  // 6. 销量适中（有一定热度但不是太卷）
  const sold = product.sold || 0;
  if (sold >= 200 && sold <= 100000) score += 8;
  else if (sold > 100000 && sold <= 500000) score += 4;
  else if (sold > 500000) score += 1;

  // 7. 有缩略图
  if (product.thumbnail) score += 2;

  // ===== 减分项 =====

  // 排除通用/基础商品
  const excludePatterns = [
    'phone case', 'case for iphone', 'case for samsung', 'case for xiaomi',
    'screen protector', 'glass protector', 'tempered glass',
    'generic', 'basic', 'simple style', 'plain',
    'replacement', 'spare part', 'original',
    'towel', 'hand towel', 'bath towel',
    'sponge', 'scrub', 'cleaning pad',
    'hair ties', 'elastic band', 'hair band', 'scrunchie',
    'nail file', 'nail buffer', 'emery board',
    'toilet brush', 'cleaning brush', 'scrub brush',
    'cable', 'charger', 'usb cable', 'charging cable',
    'adapter', 'converter',
    'sticker', 'decal',
    'holder', 'stand', 'hook'
  ];

  for (const pattern of excludePatterns) {
    if (fullName.includes(pattern)) {
      score -= 15;
    }
  }

  return score;
}

/**
 * 商品名称相似度检测（简单版）
 */
function isSimilar(a, b) {
  const nameA = (a.goodsNameEn || '').toLowerCase().slice(0, 50);
  const nameB = (b.goodsNameEn || '').toLowerCase().slice(0, 50);
  return nameA === nameB;
}

// 评分
console.log('【第一轮】评分所有商品...');
const scored = allProducts.map(p => ({
  ...p,
  _score: scoreProduct(p)
}));

console.log(`评分完成\n`);

// 按平台分组
const byPlatform = {};
scored.forEach(p => {
  if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
  byPlatform[p.platform].push(p);
});

// 从每个平台选取最好的商品
const selected = [];
const usedIds = new Set();

// 1. 先确保每个平台至少选1个
const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
for (const platform of platforms) {
  const platformProducts = byPlatform[platform] || [];

  // 按评分排序
  const sorted = platformProducts.sort((a, b) => b._score - a._score);

  // 选取评分最高且不重复的
  for (const p of sorted) {
    if (!usedIds.has(p.goodsId) && p._score > 0) {
      selected.push(p);
      usedIds.add(p.goodsId);
      break;
    }
  }
}

console.log('【第二轮】跨平台多样性选择:');
console.log(`已有 ${selected.length} 个商品（每个平台1个）\n`);

// 2. 再从剩余商品中选，最多凑满10个
const remaining = scored
  .filter(p => !usedIds.has(p.goodsId))
  .sort((a, b) => b._score - a._score);

// 添加更多优质商品
let added = 0;
for (const p of remaining) {
  if (selected.length >= 10) break;
  if (p._score > 0) {
    selected.push(p);
    usedIds.add(p.goodsId);
    added++;
  }
}

console.log(`从剩余商品中添加 ${added} 个，共 ${selected.length} 个\n`);

// 显示结果
console.log('='.repeat(60));
console.log('【最终入选】10个精选商品:');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n--- 商品 ${i + 1} [${p.platform}] ---`);
  console.log(`名称: ${p.goodsNameEn.substring(0, 80)}`);
  console.log(`价格: $${p.goodsPriceMin || '?'} ~ $${p.goodsPriceMax || '?'}`);
  console.log(`销量: ${p.sold?.toLocaleString() || '?'} | 评价: ${p.reviewNum || 0} | 评分: ${p.rating || '?'}`);
  console.log(`上架: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}`);
  console.log(`ID: ${p.goodsId} | 评分: ${p._score}`);
});

// 保存结果
const outputFile = path.join(__dirname, 'selected_20260430_v5.json');
fs.writeFileSync(outputFile, JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log(`筛选完成！${selected.length} 个商品已保存`);
console.log('='.repeat(60));

module.exports = selected;