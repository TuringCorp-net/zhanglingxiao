/**
 * 选品筛选脚本 FINAL - 2026-04-30
 *
 * 精选标准：新奇有趣有爆点
 */

const fs = require('fs');
const path = require('path');

const rawData = fs.readFileSync(path.join(__dirname, 'dailytemp', '2026-04-30', 'all_products.json'), 'utf8');
const allProducts = JSON.parse(rawData);

console.log('='.repeat(60));
console.log('选品筛选 FINAL - 2026-04-30');
console.log('='.repeat(60));
console.log(`待筛选: ${allProducts.length} 个\n`);

// 基础评分
function baseScore(p) {
  let score = 0;
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();

  if (p.rating >= 4.8) score += 10;
  else if (p.rating >= 4.5) score += 6;
  else if (p.rating >= 4.0) score += 3;

  const reviews = p.reviewNum || 0;
  if (reviews >= 50 && reviews <= 5000) score += 10;
  else if (reviews > 5000 && reviews <= 20000) score += 5;

  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 40) score += 8;
  else if (price >= 3 && price <= 60) score += 4;

  if (p.thumbnail) score += 2;

  return score;
}

// 新奇度评分
function noveltyScore(p) {
  let score = 0;
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();

  const strongNovelty = [
    'led', 'light up', 'glowing', 'neon', 'rgb', 'colorful', 'rainbow',
    'transform', 'foldable', 'portable', 'mini', 'compact',
    'robot', 'smart', 'automatic', 'ai', 'sensor',
    'magnetic', 'wireless', 'rechargeable',
    'pet', 'dog', 'cat', 'animal', 'puppy', 'kitten',
    'kids', 'children', 'baby', 'toddler',
    'game', 'puzzle', 'cube', 'chess', 'card game',
    'fitness', 'yoga', 'gym', 'workout', 'exercise',
    'outdoor', 'camping', 'hiking', 'travel',
    'kitchen', 'cooking', 'coffee', 'tea',
    'garden', 'plant', 'flower', 'succulent',
    'art', 'artistic', 'craft', 'diy', 'handmade',
    'party', 'wedding', 'holiday', 'festival', 'christmas',
    'anime', 'manga', 'comic', 'cartoon', 'character',
    'vintage', 'retro', 'steampunk', 'gothic', 'boho', 'kawaii',
    'gift', 'surprise', 'magic',
    'decor', 'deco', 'home', 'vase', 'lamp', 'light'
  ];

  for (const kw of strongNovelty) {
    if (name.includes(kw)) score += 5;
  }

  const midNovelty = [
    'cute', 'fun', 'unique', 'novelty', 'quirky', 'creative',
    'fashion', 'style', 'trendy', 'viral',
    'car', 'auto', 'vehicle', 'motorcycle',
    'watch', 'jewelry', 'accessory',
    'phone', 'tablet', 'laptop'
  ];

  for (const kw of midNovelty) {
    if (name.includes(kw)) score += 2;
  }

  const onSaleTime = p.onSaleTime ? new Date(p.onSaleTime) : null;
  if (onSaleTime) {
    const days = (Date.now() - onSaleTime.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 30) score += 15;
    else if (days <= 90) score += 8;
    else if (days <= 180) score += 3;
  }

  const sold = p.sold || 0;
  if (sold >= 100 && sold <= 50000) score += 8;
  else if (sold > 50000 && sold <= 200000) score += 4;

  return score;
}

const EXCLUDE = [
  'phone case', 'case for iphone', 'case for samsung',
  'screen protector', 'glass protector', 'tempered glass',
  'generic', 'basic style', 'simple style', 'plain',
  'replacement', 'spare',
  'towel', 'hand towel', 'bath towel',
  'sponge', 'scrub', 'cleaning pad', 'dish towel',
  'hair tie', 'elastic band', 'hair band', 'scrunchie',
  'nail file', 'nail buffer', 'emery board', 'nail clipper',
  'toilet brush', 'cleaning brush', 'scrub brush',
  'cable', 'charger', 'usb cable', 'charging cable',
  'adapter', 'converter'
];

function shouldExclude(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  return EXCLUDE.some(e => name.includes(e));
}

const candidates = allProducts
  .filter(p => !shouldExclude(p))
  .map(p => ({
    ...p,
    _base: baseScore(p),
    _novelty: noveltyScore(p),
    _total: baseScore(p) + noveltyScore(p)
  }))
  .sort((a, b) => b._total - a._total);

console.log('评分后的候选商品（前30）:');
candidates.slice(0, 30).forEach((p, i) => {
  const platform = (p.platform || '').toUpperCase().padEnd(10);
  const name = (p.goodsNameEn || '').substring(0, 50).padEnd(50);
  console.log(`${(i+1).toString().padStart(2)}. [${platform}] ${name} | ${p._total}`);
});

const selected = [];
const usedNames = new Set();

for (const p of candidates) {
  if (selected.length >= 10) break;
  const nameKey = (p.goodsNameEn || '').substring(0, 40).toLowerCase();
  if (usedNames.has(nameKey)) continue;
  selected.push(p);
  usedNames.add(nameKey);
}

console.log('\n' + '='.repeat(60));
console.log('【最终入选】10个精选商品');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n--- ${i + 1}. [${p.platform?.toUpperCase()}] ---`);
  console.log(`名称: ${p.goodsNameEn?.substring(0, 80)}`);
  console.log(`中文: ${p.goodsNameCn?.substring(0, 50)}`);
  console.log(`价格: $${p.goodsPriceMin || '?'} ~ $${p.goodsPriceMax || '?'}`);
  console.log(`销量: ${p.sold?.toLocaleString() || '?'} | 评价: ${p.reviewNum || 0} | 评分: ${p.rating || '?'}`);
  console.log(`上架: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}`);
  console.log(`商品ID: ${p.goodsId}`);
  console.log(`缩略图: ${p.thumbnail || '?'}`);
  console.log(`类目: ${p._catId} | 来源: ${p._source}`);
  console.log(`综合评分: ${p._total} (基础:${p._base} + 新奇:${p._novelty})`);
});

const outputFile = path.join(__dirname, 'selected_20260430_final.json');
fs.writeFileSync(outputFile, JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log(`保存至: ${outputFile}`);
console.log('='.repeat(60));

module.exports = selected;
