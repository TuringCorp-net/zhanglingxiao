/**
 * 选品筛选脚本 FINAL v2 - 2026-04-30
 * 
 * 策略：跨平台多样性 + 新奇有趣
 */

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dailytemp/2026-04-30/all_products.json', 'utf8'));

console.log('='.repeat(60));
console.log('选品筛选 FINAL v2 - 2026-04-30');
console.log('='.repeat(60));

// 新奇关键词
const NOVELTY = [
  'led', 'rgb', 'neon', 'light', 'lamp',
  'robot', 'smart', 'automatic', 'sensor', 'motion',
  'pet', 'dog', 'cat', 'puppy', 'kitten',
  'game', 'puzzle', 'cube', 'toy',
  'yoga', 'fitness', 'gym', 'workout', 'exercise',
  'camping', 'hiking', 'outdoor', 'travel',
  'kitchen', 'coffee', 'tea', 'wine',
  'garden', 'plant', 'flower',
  'art', 'craft', 'diy', 'handmade',
  'decor', 'vase', 'vintage', 'retro',
  'party', 'wedding', 'christmas', 'halloween',
  'gift', 'magic', 'fun', 'cute', 'unique',
  'car', 'motorcycle', 'fashion', 'viral'
];

// 排除关键词
const EXCLUDE = [
  'phone case', 'case for iphone', 'case for samsung',
  'screen protector', 'tempered glass',
  'generic', 'basic', 'plain',
  'replacement', 'spare',
  'towel', 'sponge', 'scrub',
  'hair tie', 'elastic band',
  'nail file', 'nail buffer',
  'toilet brush', 'cleaning brush',
  'cable', 'charger', 'usb'
];

function score(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  let s = 0;
  
  // 新奇关键词
  for (const kw of NOVELTY) {
    if (name.includes(kw)) s += 10;
  }
  
  // 评分
  if (p.rating >= 4.7) s += 8;
  else if (p.rating >= 4.4) s += 5;
  
  // 评论
  const r = p.reviewNum || 0;
  if (r >= 20 && r <= 3000) s += 8;
  
  // 价格
  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) s += 5;
  
  return s;
}

function isExclude(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  return EXCLUDE.some(e => name.includes(e));
}

// 按平台筛选
const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
const selected = [];
const used = new Set();

// 每个平台选2个
for (const platform of platforms) {
  const pList = data
    .filter(p => p.platform === platform && !isExclude(p))
    .map(p => ({ ...p, _score: score(p) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score);
  
  for (const p of pList) {
    if (selected.length >= 10) break;
    const key = (p.goodsNameEn || '').substring(0, 40).toLowerCase();
    if (used.has(key)) continue;
    selected.push(p);
    used.add(key);
  }
}

// 补充到10个
if (selected.length < 10) {
  const remaining = data
    .filter(p => !isExclude(p) && !used.has((p.goodsNameEn || '').substring(0, 40).toLowerCase()))
    .map(p => ({ ...p, _score: score(p) }))
    .filter(p => p._score > 0 || p.rating >= 4.5)
    .sort((a, b) => b._score - a._score);
  
  for (const p of remaining) {
    if (selected.length >= 10) break;
    const key = (p.goodsNameEn || '').substring(0, 40).toLowerCase();
    if (used.has(key)) continue;
    selected.push(p);
    used.add(key);
  }
}

// 输出
console.log('\n【最终入选】10个精选商品\n');
selected.forEach((p, i) => {
  console.log(`${i+1}. [${(p.platform||'').toUpperCase()}]`);
  console.log(`   ${(p.goodsNameEn||'').substring(0, 75)}`);
  console.log(`   价:$${p.goodsPriceMin||'?'} 销:${(p.sold||0).toLocaleString()} 评:${p.reviewNum||0} 分:${p.rating||'?'}`);
  console.log(`   ID:${p.goodsId} 评分:${p._score}\n`);
});

fs.writeFileSync('selected_20260430_final.json', JSON.stringify(selected, null, 2));
console.log('已保存至: selected_20260430_final.json');
