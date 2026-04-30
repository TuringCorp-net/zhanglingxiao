/**
 * 选品筛选脚本 v6 - 2026-04-30
 * 
 * 精选标准：新奇有趣有爆点
 * 1. 真正的创意/新奇产品
 * 2. 跨平台多样性
 * 3. 去重（严格）
 */

const fs = require('fs');
const path = require('path');

const rawData = fs.readFileSync(path.join(__dirname, 'dailytemp', '2026-04-30', 'all_products.json'), 'utf8');
const allProducts = JSON.parse(rawData);

console.log('='.repeat(60));
console.log('选品筛选 v6 - 2026-04-30');
console.log('='.repeat(60));

// 新奇特关键词（强烈特征）
const NOVELTY_KEYWORDS = [
  // 科技创意
  'robot', 'smart', 'automatic', 'ai ', 'sensor', 'motion', 'infrared',
  'led', 'rgb', 'neon', 'light up', 'glowing', 'glow', 'colorful',
  'wireless', 'magnetic', 'rechargeable', 'foldable', 'portable', 'mini',
  
  // 趣味生活
  'pet', 'dog', 'cat', 'animal', 'puppy', 'kitten',
  'kids', 'children', 'baby', 'toddler',
  'game', 'puzzle', 'cube', 'chess', 'card game', 'toy',
  'fitness', 'yoga', 'gym', 'workout', 'exercise',
  
  // 装饰创意
  'art', 'artistic', 'craft', 'diy', 'handmade',
  'decor', 'deco', 'vase', 'lamp', 'light',
  'vintage', 'retro', 'steampunk', 'boho', 'kawaii',
  'anime', 'manga', 'comic', 'character',
  
  // 特殊场景
  'camping', 'hiking', 'outdoor', 'travel',
  'kitchen', 'coffee', 'tea', 'wine',
  'garden', 'plant', 'flower', 'succulent',
  'party', 'wedding', 'holiday', 'christmas', 'halloween',
  'gift', 'surprise', 'magic',
  
  // 汽车/个性
  'car', 'auto', 'motorcycle', 'bike', 'vehicle',
  'fashion', 'style', 'trendy', 'viral', 'unique'
];

// 排除关键词
const EXCLUDE_KEYWORDS = [
  'phone case', 'case for iphone', 'case for samsung',
  'screen protector', 'tempered glass',
  'generic', 'basic style', 'plain',
  'replacement', 'spare part',
  'towel', 'sponge', 'scrub', 'cleaning pad',
  'hair tie', 'elastic band', 'scrunchie',
  'nail file', 'nail buffer', 'nail clipper',
  'toilet brush', 'cleaning brush',
  'cable', 'charger', 'usb', 'adapter'
];

function getNoveltyScore(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  let score = 0;
  
  // 新奇特征匹配
  for (const kw of NOVELTY_KEYWORDS) {
    if (name.includes(kw)) {
      score += 8;
      // 组合特征加分
      if (kw === 'led' || kw === 'rgb' || kw === 'neon') score += 5;
      if (kw === 'robot' || kw === 'smart' || kw === 'automatic') score += 5;
      if (kw === 'pet' || kw === 'dog' || kw === 'cat') score += 5;
      if (kw === 'game' || kw === 'puzzle' || kw === 'toy') score += 5;
    }
  }
  
  // 新品加分
  const onSaleTime = p.onSaleTime ? new Date(p.onSaleTime) : null;
  if (onSaleTime) {
    const days = (Date.now() - onSaleTime.getTime()) / (1000 * 60 * 60 * 24);
    if (days <= 30) score += 20;
    else if (days <= 60) score += 12;
    else if (days <= 90) score += 8;
  }
  
  // 评论适中（验证过市场）
  const reviews = p.reviewNum || 0;
  if (reviews >= 20 && reviews <= 2000) score += 8;
  else if (reviews > 2000) score += 3;
  
  // 评分
  if (p.rating >= 4.7) score += 5;
  else if (p.rating >= 4.4) score += 3;
  
  return score;
}

function shouldExclude(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  return EXCLUDE_KEYWORDS.some(e => name.includes(e));
}

// 评分并筛选
const candidates = allProducts
  .filter(p => !shouldExclude(p))
  .map(p => ({
    ...p,
    _novelty: getNoveltyScore(p)
  }))
  .filter(p => p._novelty > 0)
  .sort((a, b) => b._novelty - a._novelty);

// 按平台去重并选取
const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
const selected = [];
const usedNames = new Set();

for (const platform of platforms) {
  const platformProducts = candidates.filter(p => p.platform === platform);
  
  for (const p of platformProducts) {
    if (selected.length >= 10) break;
    
    // 名称去重（前50字符）
    const nameKey = (p.goodsNameEn || '').substring(0, 50).toLowerCase();
    if (usedNames.has(nameKey)) continue;
    
    selected.push(p);
    usedNames.add(nameKey);
  }
  
  if (selected.length >= 10) break;
}

// 如果不够10个，从剩余中补充
if (selected.length < 10) {
  for (const p of candidates) {
    if (selected.length >= 10) break;
    
    const nameKey = (p.goodsNameEn || '').substring(0, 50).toLowerCase();
    if (usedNames.has(nameKey)) continue;
    
    selected.push(p);
    usedNames.add(nameKey);
  }
}

// 显示结果
console.log('\n【最终入选】10个精选商品\n');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n${i + 1}. [${(p.platform || '').toUpperCase()}]`);
  console.log(`   ${p.goodsNameEn?.substring(0, 80)}`);
  console.log(`   价格: $${p.goodsPriceMin || '?'} | 销量: ${p.sold?.toLocaleString() || '?'} | 评价: ${p.reviewNum || 0} | 评分: ${p.rating || '?'}`);
  console.log(`   上架: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}`);
  console.log(`   ID: ${p.goodsId}`);
  console.log(`   新奇评分: ${p._novelty}`);
});

// 保存
fs.writeFileSync('selected_20260430_v6.json', JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log(`完成！保存至: selected_20260430_v6.json`);
console.log('='.repeat(60));

module.exports = selected;
