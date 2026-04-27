/**
 * 选品筛选脚本 - 2026-04-27 (优化版)
 *
 * 从200个已采集商品中筛选出10个"新奇/有趣/好玩/有爆点"的商品
 * - 去重处理
 * - 确保平台多样性
 */

const fs = require('fs');

// 加载已采集的商品
const rawData = JSON.parse(fs.readFileSync(__dirname + '/raw_products.json', 'utf8'));
const products = rawData.products;

console.log(`待筛选商品: ${products.length} 个\n`);

// 选品标准评估函数
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();

  // 新奇加分（创意/有趣关键词）
  const noveltyKeywords = [
    'fun', 'unique', 'creative', 'weird', 'quirky', 'crazy', 'cool', 'novel',
    'magic', 'surprise', 'glow', 'rainbow', 'fluffy', 'cute', 'funny',
    'astronaut', 'space', 'galaxy', 'nebula', 'projector', 'night light',
    '解压', '创意', '新奇', '有趣', '搞怪', '爆款', '网红', '礼品'
  ];
  noveltyKeywords.forEach(kw => {
    if (name.includes(kw) || nameCn.includes(kw)) score += 2;
  });

  // 好玩加分（玩具/游戏相关）
  const playKeywords = [
    'toy', 'game', 'play', 'kid', 'child', 'baby', 'party', 'gift',
    'bubble', 'fidget', 'sensory', 'sticker', 'puzzle', 'building', 'block',
    '气球', '派对', '玩具', '游戏', '泡泡', '拼插', '积木'
  ];
  playKeywords.forEach(kw => {
    if (name.includes(kw) || nameCn.includes(kw)) score += 1;
  });

  // 销量高加分
  const sold = product.sold || 0;
  if (sold > 200000) score += 4;
  else if (sold > 100000) score += 3;
  else if (sold > 50000) score += 2;
  else if (sold > 10000) score += 1;

  // 评分高加分
  const rating = product.rating || 0;
  if (rating >= 4.9) score += 3;
  else if (rating >= 4.7) score += 2;
  else if (rating >= 4.5) score += 1;

  // 评论数加分
  const reviews = product.reviewNum || 0;
  if (reviews > 10000) score += 3;
  else if (reviews > 5000) score += 2;
  else if (reviews > 1000) score += 1;

  return score;
}

// 去重：根据goodsId去重
const seen = new Set();
const uniqueProducts = products.filter(p => {
  if (seen.has(p.goodsId)) return false;
  seen.add(p.goodsId);
  return true;
});

console.log(`去重后商品: ${uniqueProducts.length} 个\n`);

// 评分所有商品
const scored = uniqueProducts.map(p => ({
  ...p,
  score: scoreProduct(p)
}));

// 按平台分组
const platformGroups = {};
scored.forEach(p => {
  const plat = p.platform || 'unknown';
  if (!platformGroups[plat]) platformGroups[plat] = [];
  platformGroups[plat].push(p);
});

// 从每个平台选择最好的商品，确保多样性
const selected = [];
const seenGoodsId = new Set();

Object.entries(platformGroups).forEach(([plat, items]) => {
  // 按分数排序
  items.sort((a, b) => b.score - a.score);
  // 取前2个，确保多平台
  let count = 0;
  for (const item of items) {
    if (count >= 2) break;
    if (!seenGoodsId.has(item.goodsId)) {
      selected.push(item);
      seenGoodsId.add(item.goodsId);
      count++;
    }
  }
});

// 剩余从高分商品中补充
if (selected.length < 10) {
  const remaining = scored
    .filter(p => !seenGoodsId.has(p.goodsId))
    .sort((a, b) => b.score - a.score);

  const needed = 10 - selected.length;
  selected.push(...remaining.slice(0, needed));
}

// 最终筛选10个
const finalSelected = selected.slice(0, 10);

// 输出结果
console.log('=== 筛选结果（10个去重商品）===\n');
finalSelected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.catName}`);
  console.log(`   名称: ${p.goodsNameEn.substring(0, 80)}...`);
  console.log(`   价格: $${p.goodsPriceMin} - ${p.goodsPriceMax ? '$' + p.goodsPriceMax : '无'}`);
  console.log(`   销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`   商品ID: ${p.goodsId}`);
  console.log(`   评分: ${p.score}`);
  console.log('');
});

// 保存筛选结果
fs.writeFileSync(__dirname + '/selected_20260427.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  selected: finalSelected
}, null, 2));

console.log(`已保存筛选结果到 selected_20260427.json`);