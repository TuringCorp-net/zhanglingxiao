/**
 * 选品筛选脚本 v2
 * 按照"新奇/有趣/好玩/有爆点"标准筛选商品，并去重
 */

const fs = require('fs');
const path = require('path');

// 加载原始数据
const data = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../selected/dailytemp/2026-04-20/raw_products.json'),
  'utf8'
));

const products = data.products;

// 选品关键词评分 - 正面加分词
const positiveKeywords = [
  // 有趣/好玩
  'fun', 'play', 'game', 'toy', 'cute', 'interesting', 'quirky', 'unique',
  'surprise', 'magic', 'creative', 'cool', 'awesome', 'amazing',
  'laugh', 'joke', 'prank', 'gag', 'party', 'novelty',

  // 新奇/创意
  'innovative', 'quirky', 'bizarre', 'weird', 'unusual', 'odd',
  'futuristic', 'steampunk', 'retro', 'vintage', 'gadget', 'gimmick',
  'secret', 'hidden', 'mystery', 'puzzle', 'escape',

  // 爆点/话题
  'viral', 'trending', 'popular', 'best seller', 'hot', 'must have',
  'instagram', 'tiktok', 'famous', 'celebrity', 'influencer',

  // 实用但有趣
  'transform', 'multifunctional', '2in1', '3in1', 'combo', 'kit',

  // 节日/派对
  'halloween', 'christmas', 'birthday', 'wedding', 'festival', 'costume',

  // 减压/治愈
  'stress relief', 'fidget', 'squishy', 'pop', 'satisfying', 'relax',
  'asmr', 'slime', 'putty',

  // 中文加分词
  '趣味', '玩具', '创意', '搞怪', '可爱', '新奇', '爆款', '网红', '热门',

  // 特殊属性
  'glow', 'light up', 'led', 'remote', 'wireless', 'smart', 'automatic'
];

// 判断商品是否有爆点/有趣的属性
function scoreProduct(p) {
  let score = 0;
  const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();

  // 销量加分
  const sold = parseInt(p.sold) || 0;
  if (sold > 100000) score += 8;
  else if (sold > 50000) score += 5;
  else if (sold > 20000) score += 3;
  else if (sold > 10000) score += 2;
  else if (sold > 5000) score += 1;

  // 正面关键词加分
  let keywordMatches = 0;
  for (const kw of positiveKeywords) {
    if (name.includes(kw)) {
      score += 3;
      keywordMatches++;
    }
  }
  // 关键词重复加分（多关键词匹配说明特性更丰富）
  if (keywordMatches > 1) score += keywordMatches;

  // 价格适中加分
  const price = parseFloat(p.goodsPriceMin) || 0;
  if (price >= 5 && price <= 50) score += 3;
  else if (price >= 2 && price <= 100) score += 1;

  // 评论数加分
  const reviews = parseInt(p.reviewNum) || 0;
  if (reviews > 500) score += 4;
  else if (reviews > 100) score += 2;
  else if (reviews > 50) score += 1;

  // 高评分加分
  const rating = parseFloat(p.rating) || 0;
  if (rating >= 4.8) score += 3;
  else if (rating >= 4.5) score += 2;
  else if (rating >= 4) score += 1;

  return score;
}

// 商品去重函数（基于goodsId和相似名称）
function deduplicate(arr) {
  const seen = new Set();
  const result = [];

  for (const item of arr) {
    const key = item.goodsId || item.goodsNameEn?.substring(0, 50);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

// 执行筛选
console.log('========================================');
console.log('选品筛选开始');
console.log('========================================\n');

// 为每个商品打分
const scored = products.map(p => ({
  ...p,
  score: scoreProduct(p)
}));

// 按评分排序
scored.sort((a, b) => b.score - a.score);

// 去重
const deduplicated = deduplicate(scored);

// 选取前15个（去重后应该能保证有10个以上）
const candidates = deduplicated.slice(0, 20);

// 为了多样性，我们从不同平台和不同类目中选取
const selected = [];
const selectedPlatforms = new Set();
const selectedChannels = new Set();

// 先选一个平台一个
for (const p of candidates) {
  if (selected.length >= 10) break;

  const platform = p.platform;
  const channel = p.channel;
  const cat = p.catName;

  // 每个平台最多选3个
  const platformCount = selected.filter(s => s.platform === platform).length;
  if (platformCount >= 3) continue;

  // 每个类目最多选2个
  const catCount = selected.filter(s => s.catName === cat).length;
  if (catCount >= 2) continue;

  selected.push(p);
}

// 如果还不够10个，从剩余候选中补充
if (selected.length < 10) {
  for (const p of candidates) {
    if (selected.length >= 10) break;
    if (!selected.find(s => s.goodsId === p.goodsId)) {
      selected.push(p);
    }
  }
}

// 输出结果
console.log('筛选结果（共选出10个商品）:\n');

selected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.catName} / ${p.channel}`);
  console.log(`   名称: ${p.goodsNameEn || p.goodsName}`);
  console.log(`   销量: ${p.sold} | 价格: $${p.goodsPriceMin} - $${p.goodsPriceMax} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
  console.log(`   商品ID: ${p.goodsId}`);
  console.log(`   图片: ${p.thumbnail}`);
  console.log(`   综合评分: ${p.score}`);
  console.log('');
});

// 生成唯一ID和选品报告
const selectionDate = '2026-04-20';
const result = {
  timestamp: new Date().toISOString(),
  selectionDate,
  totalScanned: products.length,
  selectedCount: selected.length,
  selections: selected.map((p, i) => {
    const id = `${selectionDate.replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      platform: p.platform,
      category: p.catName,
      channel: p.channel,
      goodsId: p.goodsId,
      goodsName: p.goodsNameEn || p.goodsName || '',
      goodsNameCn: p.goodsNameCn || '',
      thumbnail: p.thumbnail,
      sold: p.sold,
      priceMin: p.goodsPriceMin,
      priceMax: p.goodsPriceMax,
      reviewNum: p.reviewNum,
      rating: p.rating,
      score: p.score,
      selectionReason: generateReason(p)
    };
  })
};

console.log('========================================');
console.log('生成选品报告完成');
console.log('========================================');

fs.writeFileSync(
  path.join(__dirname, '../selected/dailytemp/2026-04-20/selected_products.json'),
  JSON.stringify(result, null, 2)
);

console.log(`\n选品结果已保存至: ../selected/dailytemp/2026-04-20/selected_products.json`);

function generateReason(p) {
  const reasons = [];
  const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
  const sold = parseInt(p.sold) || 0;

  if (sold > 100000) reasons.push('超级爆款');
  else if (sold > 50000) reasons.push('爆款热销');
  else if (sold > 20000) reasons.push('销量强劲');

  const rating = parseFloat(p.rating) || 0;
  if (rating >= 4.8) reasons.push('高评分');
  else if (rating >= 4.5) reasons.push('良好口碑');

  for (const kw of positiveKeywords) {
    if (name.includes(kw)) {
      if (kw === 'fun' || kw === 'play' || kw === 'cute') reasons.push('趣味性');
      else if (kw === 'unique' || kw === 'creative' || kw === 'innovative') reasons.push('创意独特');
      else if (kw === 'magic' || kw === 'surprise') reasons.push('惊喜元素');
      else if (kw === 'viral' || kw === 'trending' || kw === 'popular') reasons.push('网红爆点');
      else if (kw === 'glow' || kw === 'led' || kw === 'light up') reasons.push('发光特效');
      else if (kw === 'stress relief' || kw === 'fidget' || kw === 'relax') reasons.push('减压治愈');
      break;
    }
  }

  if (p.channel === '热销新品' || p.channel === '大卖新品') reasons.push('新品趋势');

  return reasons.join(' | ') || '综合推荐';
}