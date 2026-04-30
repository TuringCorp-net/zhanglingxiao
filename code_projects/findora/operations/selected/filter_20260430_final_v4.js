/**
 * 选品筛选脚本 FINAL v4 - 2026-04-30
 * 
 * 精选标准：新奇有趣有爆点
 * 确保：跨平台多样性、去重
 */

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dailytemp/2026-04-30/all_products.json', 'utf8'));

console.log('='.repeat(60));
console.log('选品筛选 FINAL v4 - 2026-04-30');
console.log('='.repeat(60));

// 评分
function score(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  let s = 5;
  
  // 新奇特征
  const novelties = [
    'led', 'rgb', 'neon', 'light', 'lamp',
    'robot', 'smart', 'automatic', 'sensor', 'motion',
    'pet', 'cat', 'dog', 'puppy', 'kitten',
    'puzzle', 'cube', 'toy', 'game',
    'yoga', 'fitness', 'gym', 'workout',
    'camping', 'hiking', 'outdoor', 'travel',
    'art', 'craft', 'diy', 'handmade',
    'decor', 'vase', 'vintage', 'retro',
    'party', 'wedding', 'christmas',
    'gift', 'fun', 'cute', 'unique', 'novelty',
    'car', 'motorcycle', 'fashion'
  ];
  for (const kw of novelties) {
    if (name.includes(kw)) s += 8;
  }
  
  // 评分
  if (p.rating >= 4.7) s += 8;
  else if (p.rating >= 4.4) s += 4;
  
  // 评论
  const r = p.reviewNum || 0;
  if (r >= 50 && r <= 5000) s += 6;
  else if (r > 5000) s += 2;
  
  // 价格
  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) s += 4;
  
  return s;
}

// 排除
const EXCLUDE = ['phone case', 'screen protector', 'tempered glass', 'generic', 'basic', 'plain', 'towel', 'sponge', 'scrub pad', 'hair tie', 'elastic band', 'nail file', 'cable', 'charger', 'usb', 'adapter'];
function isExclude(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  return EXCLUDE.some(e => name.includes(e));
}

// 去重
function isDupe(a, b) {
  const n1 = (a.goodsNameEn || '').substring(0, 45).toLowerCase();
  const n2 = (b.goodsNameEn || '').substring(0, 45).toLowerCase();
  return n1 === n2;
}

// 筛选
const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
const selected = [];
const usedKeys = new Set();

// 第一步：每个平台选最好的1个
for (const platform of platforms) {
  const pList = data
    .filter(p => p.platform === platform && !isExclude(p))
    .map(p => ({ ...p, _score: score(p) }))
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score);
  
  if (pList.length > 0) {
    const best = pList[0];
    const key = (best.goodsNameEn || '').substring(0, 45).toLowerCase();
    if (!usedKeys.has(key)) {
      selected.push(best);
      usedKeys.add(key);
      console.log(`[${platform}] ✓ ${(best.goodsNameEn||'').substring(0, 50)}`);
    }
  }
}

// 第二步：从剩余数据中选评分最高的（去重）
const remaining = data
  .filter(p => !usedKeys.has((p.goodsNameEn || '').substring(0, 45).toLowerCase()) && !isExclude(p))
  .map(p => ({ ...p, _score: score(p) }))
  .filter(p => p._score > 0)
  .sort((a, b) => b._score - a._score);

for (const p of remaining) {
  if (selected.length >= 10) break;
  const key = (p.goodsNameEn || '').substring(0, 45).toLowerCase();
  if (usedKeys.has(key)) continue;
  
  // 确保跨平台多样性（限制每个平台最多3个）
  const platformCount = selected.filter(s => s.platform === p.platform).length;
  if (platformCount >= 3) continue;
  
  selected.push(p);
  usedKeys.add(key);
}

// 输出
console.log('\n' + '='.repeat(60));
console.log('【最终入选】10个精选商品');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n${i+1}. [${(p.platform||'').toUpperCase()}] ${(p._source||'')}`);
  console.log(`   名称: ${(p.goodsNameEn||'').substring(0, 75)}`);
  console.log(`   中文: ${(p.goodsNameCn||'').substring(0, 40)}`);
  console.log(`   价格: $${p.goodsPriceMin||'?'} ~ $${p.goodsPriceMax||'?'}`);
  console.log(`   销量: ${(p.sold||0).toLocaleString()} | 评价: ${p.reviewNum||0} | 评分: ${p.rating||'?'}`);
  console.log(`   上架: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}`);
  console.log(`   ID: ${p.goodsId}`);
  console.log(`   缩略图: ${(p.thumbnail||'').substring(0, 70)}`);
});

fs.writeFileSync('selected_20260430_final.json', JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log(`完成！已保存 ${selected.length} 个商品至: selected_20260430_final.json`);
console.log('='.repeat(60));
