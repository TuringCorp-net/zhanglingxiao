/**
 * 选品筛选脚本 FINAL v3 - 2026-04-30
 * 
 * 强制跨平台多样性：每个平台至少1个
 */

const fs = require('fs');
const data = JSON.parse(fs.readFileSync('dailytemp/2026-04-30/all_products.json', 'utf8'));

console.log('='.repeat(60));
console.log('选品筛选 FINAL v3 - 2026-04-30');
console.log('='.repeat(60));

// 评分函数
function score(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  let s = 10; // 基础分
  
  const novelties = ['led', 'rgb', 'neon', 'light', 'robot', 'smart', 'pet', 'cat', 'dog', 'puzzle', 'game', 'yoga', 'fitness', 'gym', 'camping', 'outdoor', 'art', 'craft', 'diy', 'decor', 'vintage', 'retro', 'party', 'christmas', 'gift', 'fun', 'cute', 'unique', 'car', 'fashion', 'travel'];
  for (const kw of novelties) {
    if (name.includes(kw)) s += 8;
  }
  
  if (p.rating >= 4.7) s += 8;
  else if (p.rating >= 4.4) s += 5;
  
  const r = p.reviewNum || 0;
  if (r >= 20 && r <= 5000) s += 6;
  
  const price = p.goodsPriceMin || 0;
  if (price >= 3 && price <= 60) s += 4;
  
  return s;
}

// 排除
const EXCLUDE = ['phone case', 'screen protector', 'tempered glass', 'generic', 'basic', 'towel', 'sponge', 'scrub', 'hair tie', 'elastic', 'nail file', 'cable', 'charger', 'usb'];
function isExclude(p) {
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();
  return EXCLUDE.some(e => name.includes(e));
}

const platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];
const selected = [];
const used = new Set();

// 第一步：每个平台强制选1个最好的
for (const platform of platforms) {
  const pList = data
    .filter(p => p.platform === platform && !isExclude(p))
    .map(p => ({ ...p, _score: score(p) }))
    .sort((a, b) => b._score - a._score);
  
  if (pList.length > 0) {
    const best = pList[0];
    const key = (best.goodsNameEn || '').substring(0, 40).toLowerCase();
    selected.push(best);
    used.add(key);
    console.log(`[${platform}] 选取: ${(best.goodsNameEn||'').substring(0, 50)}`);
  }
}

console.log(`\n已选 ${selected.length} 个（每个平台1个）`);

// 第二步：剩余位置选评分最高的
const remaining = data
  .filter(p => !used.has((p.goodsNameEn || '').substring(0, 40).toLowerCase()) && !isExclude(p))
  .map(p => ({ ...p, _score: score(p) }))
  .sort((a, b) => b._score - a._score);

for (const p of remaining) {
  if (selected.length >= 10) break;
  const key = (p.goodsNameEn || '').substring(0, 40).toLowerCase();
  if (used.has(key)) continue;
  selected.push(p);
  used.add(key);
}

// 输出
console.log('\n' + '='.repeat(60));
console.log('【最终入选】10个精选商品');
console.log('='.repeat(60));

selected.forEach((p, i) => {
  console.log(`\n${i+1}. [${(p.platform||'').toUpperCase()}]`);
  console.log(`   ${(p.goodsNameEn||'').substring(0, 75)}`);
  console.log(`   CN: ${(p.goodsNameCn||'').substring(0, 40)}`);
  console.log(`   价:$${p.goodsPriceMin||'?'} | 销:${(p.sold||0).toLocaleString()} | 评:${p.reviewNum||0} | 分:${p.rating||'?'}`);
  console.log(`   上架: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}`);
  console.log(`   ID: ${p.goodsId} | Thumbnail: ${p.thumbnail?.substring(0, 60) || '?'}`);
  console.log(`   类目: ${p._catId} | 来源: ${p._source}`);
});

fs.writeFileSync('selected_20260430_final.json', JSON.stringify(selected, null, 2));
console.log('\n' + '='.repeat(60));
console.log('已保存至: selected_20260430_final.json');
console.log('='.repeat(60));
