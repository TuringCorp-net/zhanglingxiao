/**
 * 选品筛选脚本 - 2026-05-02
 *
 * 按照"新奇/有趣/好玩/有爆点"原则，从52个商品中筛选10个精选
 */

const fs = require('fs');
const path = require('path');

const TODAY = '2026-05-02';
const OUTPUT_DIR = path.join(__dirname, 'operations/selected');
const TEMP_DIR = path.join(__dirname, 'operations/selected/dailytemp', TODAY);

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'raw_products.json'), 'utf-8'));
const products = rawData.products;

console.log('='.repeat(60));
console.log(`选品筛选开始 - ${TODAY}`);
console.log(`待筛选商品: ${products.length} 个`);
console.log('='.repeat(60));

/**
 * 选品评分函数
 * 评估维度：
 * 1. 有趣/新奇程度 (0-30分)
 * 2. 热点契合度 (0-25分)
 * 3. 视觉吸引力/话题性 (0-25分)
 * 4. 销量基础 (0-20分)
 */
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || product.goodsNameCn || '').toLowerCase();
  const reasons = [];

  // === 有趣/新奇程度 (0-30分) ===
  // 有特殊元素
  const interestingKeywords = [
    'glitter', 'sparkle', 'shimmer', 'glow', 'neon', 'led',
    'cake topper', 'cake decoration', 'cake topper',
    'mermaid', 'unicorn', 'dinosaur', 'dragon',
    'custom', 'personalized', '定制',
    'y2k', 'retro', 'punk', 'vintage',
    'kpop', 'k-pop', 'bts', 'stray', 'metallica', 'rock band',
    'film camera', 'kodak', 'polaroid',
    'robot', 'anime', 'roblox',
    'graduation', 'grad', 'graduate', '毕业',
    'wedding', 'wedding cake', '婚礼'
  ];

  let interestingScore = 0;
  for (const kw of interestingKeywords) {
    if (name.includes(kw)) {
      interestingScore += 5;
      reasons.push(`含"${kw}"元素`);
    }
  }
  score += Math.min(interestingScore, 30);

  // === 热点契合度 (0-25分) ===
  let hotspotScore = 0;
  const hotspots = [
    { keyword: '2026', score: 15, reason: '2026年热点' },
    { keyword: 'class of 2026', score: 10, reason: '2026届毕业热点' },
    { keyword: 'fifa', score: 10, reason: '2026世界杯热点' },
    { keyword: 'world cup', score: 10, reason: '2026世界杯热点' },
    { keyword: 'y2k', score: 8, reason: 'Y2K复古潮流' },
    { keyword: 'kpop', score: 8, reason: 'K-pop文化热点' },
    { keyword: 'stray kids', score: 8, reason: '韩流明星' },
    { keyword: 'metallica', score: 6, reason: '摇滚经典' },
    { keyword: 'graduation', score: 8, reason: '毕业季热点' },
    { keyword: 'mermaid', score: 6, reason: '美人鱼梦幻元素' },
    { keyword: 'roblox', score: 8, reason: 'Roblox游戏热点' },
  ];

  for (const h of hotspots) {
    if (name.includes(h.keyword)) {
      hotspotScore += h.score;
      reasons.push(h.reason);
      break;
    }
  }
  score += Math.min(hotspotScore, 25);

  // === 视觉吸引力/话题性 (0-25分) ===
  let visualScore = 0;
  const visualKeywords = [
    'glitter', 'sparkle', 'shimmer', 'golden', 'black', 'pink',
    'neon', 'led', 'fluorescent',
    'print', 'graphic', 'pattern',
    'glitter', 'mermaid', 'sparkle'
  ];

  for (const kw of visualKeywords) {
    if (name.includes(kw)) {
      visualScore += 4;
    }
  }
  score += Math.min(visualScore, 25);

  // === 销量基础 (0-20分) ===
  const sold = product.sold || 0;
  if (sold > 100) score += 10;
  else if (sold > 50) score += 6;
  else if (sold > 20) score += 3;

  return { score, reasons, sold };
}

// 对所有商品评分
const scored = products.map((p, i) => {
  const { score, reasons, sold } = scoreProduct(p);
  return {
    index: i,
    product: p,
    score,
    reasons,
    sold
  };
});

// 按分数排序，取Top15备选
scored.sort((a, b) => b.score - a.score);

// 展示Top15候选
console.log('\n=== Top 15 候选商品 ===\n');
scored.slice(0, 15).forEach((item, i) => {
  const p = item.product;
  const name = (p.goodsNameEn || p.goodsNameCn || '').substring(0, 50);
  console.log(`${i + 1}. [${p._source}] 评分:${item.score} 销量:${item.sold}`);
  console.log(`   ${name}...`);
  console.log(`   亮点: ${item.reasons.join(', ')}`);
  console.log();
});

// 最终筛选 - 考虑多样性，同平台最多选3个
const finalSelected = [];
const platformCount = {};

scored.forEach(item => {
  if (finalSelected.length >= 10) return;

  const platform = item.product._source;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  // 同平台最多3个
  if (platformCount[platform] <= 3) {
    finalSelected.push(item);
  }
});

// 如果不足10个，放宽限制
if (finalSelected.length < 10) {
  scored.forEach(item => {
    if (finalSelected.length >= 10) return;
    if (!finalSelected.includes(item)) {
      finalSelected.push(item);
    }
  });
}

console.log('\n' + '='.repeat(60));
console.log('=== 最终入选的10个精选商品 ===');
console.log('='.repeat(60) + '\n');

const selectedProducts = finalSelected.slice(0, 10).map((item, i) => {
  const p = item.product;
  const name = p.goodsNameEn || p.goodsNameCn || '';
  console.log(`${i + 1}. [${p._source.toUpperCase()}] 评分:${item.score} 销量:${item.sold}`);
  console.log(`   ${name}`);
  console.log(`   价格: $${p.goodsPriceMin || '?'} - $${p.goodsPriceMax || '?'}`);
  console.log(`   图片: ${p.thumbnail}`);
  console.log(`   亮点: ${item.reasons.join(', ')}`);
  console.log();

  return {
    id: `20260502${String(i + 1).padStart(3, '0')}`,
    product: p,
    score: item.score,
    selectionReasons: item.reasons
  };
});

// 保存筛选结果
const reportFile = path.join(OUTPUT_DIR, `20260502_selector_report.md`);
let report = `# 选品报告 - ${TODAY}\n\n`;
report += `## 采集概况\n`;
report += `- 总采集商品: ${products.length} 个\n`;
report += `- 失败采集: ${rawData.errors.length} 个\n`;
report += `- 精选商品: ${selectedProducts.length} 个\n\n`;
report += `## 采集类目\n`;
report += `- Temu: 各色美食 (catId: 42367)\n`;
report += `- Shein: 电子学 (catId: 2273)\n`;
report += `- Amazon: 运动与户外 (catId: 3375251)\n`;
report += `- Sumaitong: 男装 (catId: 200000343)\n`;
report += `- TikTok: Jewelry Accessories (catId: 953224) - 采集失败\n\n`;
report += `## 精选商品\n\n`;

selectedProducts.forEach((item, i) => {
  const p = item.product;
  report += `### ${i + 1}. ${p.goodsNameEn || p.goodsNameCn}\n\n`;
  report += `- **编号**: ${item.id}\n`;
  report += `- **平台**: ${p._source}\n`;
  report += `- **类目**: ${p._catName}\n`;
  report += `- **价格**: $${p.goodsPriceMin || '?'} - $${p.goodsPriceMax || '?'}\n`;
  report += `- **销量**: ${p.sold || 0}\n`;
  report += `- **评分**: ${item.score}\n`;
  report += `- **入选理由**: ${item.selectionReasons.join(', ')}\n`;
  report += `- **图片**: ${p.thumbnail}\n`;
  report += `- **商品ID**: ${p.goodsId || p.id || 'N/A'}\n\n`;
});

fs.writeFileSync(reportFile, report);
console.log(`\n报告已保存: ${reportFile}`);

// 保存JSON数据
const jsonFile = path.join(OUTPUT_DIR, `selected_20260502.json`);
fs.writeFileSync(jsonFile, JSON.stringify({
  date: TODAY,
  total: selectedProducts.length,
  products: selectedProducts
}, null, 2));
console.log(`数据已保存: ${jsonFile}`);

module.exports = { selectedProducts };
