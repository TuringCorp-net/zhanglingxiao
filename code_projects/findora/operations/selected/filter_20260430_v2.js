/**
 * 选品筛选脚本 - 2026-04-30
 *
 * 按"新奇/有趣/好玩/有爆点"标准，从200个商品中筛选出10个精选商品
 */

const fs = require('fs');
const path = require('path');

// 读取原始数据
const rawDataPath = 'operations/selected/dailytemp/2026-04-30/raw_products.json';
const rawProducts = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));

console.log(`读取到 ${rawProducts.length} 个商品，开始筛选...`);

// 定义"有趣/新奇"关键词权重
// 正向关键词：加分，负向关键词：减分
const positiveKeywords = [
  'funny', 'unique', 'quirky', 'creative', 'cute', 'cool', 'weird', 'bizarre',
  'interesting', 'novel', 'surprise', 'gift', 'decor', 'party', 'holiday',
  '有趣', '创意', '可爱', '搞怪', '新奇', '独特', '节日', '派对', '装饰',
  '趣味', '搞笑', '惊喜', '好玩', '圣诞', '万圣节', '情人节', '婚礼',
  'led', 'light', 'glow', 'neon', 'rainbow', 'sparkle', 'glitter',
  'toy', 'game', 'puzzle', 'kids', 'children', 'baby', 'pet', 'animal',
  'flamingo', 'unicorn', 'dragon', 'ghost', 'skull', 'skeleton', 'pirate',
  'cartoon', 'anime', 'manga', 'superhero', 'marvel', 'star wars', 'harry potter',
  'vintage', 'retro', 'steampunk', 'gothic', 'punk', 'rock',
  'festival', 'cosplay', 'halloween', 'christmas', 'easter', 'valentine',
  'cactus', 'pineapple', 'avocado', 'sloth', 'llama', 'koala', 'panda',
  'mushroom', 'planet', 'space', 'alien', 'ufo', 'rocket', 'galaxy',
  'magic', 'crystal', 'gem', 'diamond', 'pearl', 'crown', 'tiara',
  'butterfly', 'flower', 'rose', 'peony', 'floral', 'botanical',
  '3d', '3D', 'paper', 'origami', 'fold', 'cube', 'pyramid'
];

const negativeKeywords = [
  'industrial', 'boring', 'plain', 'standard', 'basic', 'simple',
  'ordinary', 'normal', 'regular', 'typical', 'common', 'generic',
  'official', 'standard', 'cable', 'wire', 'adapter', 'connector',
  'industrial', 'medical', 'electronic', 'component', 'part'
];

// 计算商品的有趣度得分
function calculateFunScore(product) {
  const name = (product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '');
  const nameLower = name.toLowerCase();

  let score = 0;

  // 检查正向关键词
  for (const keyword of positiveKeywords) {
    if (nameLower.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // 检查负向关键词
  for (const keyword of negativeKeywords) {
    if (nameLower.includes(keyword.toLowerCase())) {
      score -= 3;
    }
  }

  // 销量加权（销量高说明市场接受度高）
  const sold = product.sold || 0;
  if (sold > 10000) score += Math.min(10, Math.log10(sold) * 2);
  if (sold > 100000) score += 10;
  if (sold > 500000) score += 10;

  // 评论数加权（评论多说明真实销售好）
  const reviews = product.reviewNum || 0;
  if (reviews > 100) score += 3;
  if (reviews > 1000) score += 3;
  if (reviews > 10000) score += 5;

  // 评分加权（高评分说明质量不错）
  const rating = product.rating || 0;
  if (rating >= 4.5) score += 5;
  else if (rating >= 4.0) score += 2;
  else if (rating > 0 && rating < 3.5) score -= 5;

  // 价格因素（价格太低可能是普通品，价格适中有特色）
  const priceMin = product.goodsPriceMin || 0;
  if (priceMin >= 5 && priceMin <= 50) score += 3;
  else if (priceMin < 2) score -= 2;
  else if (priceMin > 200) score -= 2;

  return score;
}

// 筛选函数
function filterProducts(products) {
  // 计算每个商品的有趣度得分
  const scored = products.map(p => ({
    ...p,
    funScore: calculateFunScore(p)
  }));

  // 按得分排序
  scored.sort((a, b) => b.funScore - a.funScore);

  // 选择Top商品，但保持平台多样性
  const result = [];
  const platformCount = {};
  const maxPerPlatform = 3; // 同一平台最多选3个

  for (const product of scored) {
    const platform = product.platform;
    platformCount[platform] = (platformCount[platform] || 0) + 1;

    if (platformCount[platform] <= maxPerPlatform) {
      result.push(product);
    }

    if (result.length >= 12) break; // 选12个，然后再精简到10个
  }

  return result;
}

// 生成精选报告
function generateSelectedReport(selectedProducts, date) {
  const prefix = date.replace(/-/g, '');

  let content = `# 选品报告 - ${date}\n\n`;
  content += `> 本次采集于 ${date} 完成，共采集 200 个商品，筛选出 ${selectedProducts.length} 个精选商品。\n\n`;
  content += `## 采集类目\n\n`;
  content += `| 平台 | 类目 | 采集渠道 |\n`;
  content += `|------|------|----------|\n`;
  content += `| Temu | 服装、鞋靴和珠宝饰品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| Shein | 家用纺织品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| Amazon | 办公产品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| 速卖通 | 家具和室内装饰品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| TikTok | Shoes | 热销商品, 热销新品, 新店热销, 大卖新品 |\n\n`;
  content += `## 精选商品\n\n`;

  selectedProducts.forEach((product, index) => {
    const num = String(index + 1).padStart(3, '0');
    const name = product.goodsNameEn || product.goodsNameCn || 'Unknown';
    const price = product.goodsPriceMin !== null
      ? (product.goodsPriceMax !== null && product.goodsPriceMax !== product.goodsPriceMin
        ? `${product.goodsPriceMin} - ${product.goodsPriceMax}`
        : `${product.goodsPriceMin}`)
      : 'N/A';
    const sold = product.sold ? product.sold.toLocaleString() : 'N/A';
    const rating = product.rating || 'N/A';
    const reviews = product.reviewNum ? product.reviewNum.toLocaleString() : '0';

    content += `### ${prefix}-${num} - ${name}\n\n`;
    content += `- **平台**: ${product.platform === 'temu' ? 'Temu' : product.platform === 'sumaitong' ? '速卖通' : product.platform === 'shein' ? 'Shein' : product.platform === 'amazon' ? 'Amazon' : 'TikTok'}\n`;
    content += `- **价格**: $${price}\n`;
    content += `- **销量**: ${sold}\n`;
    content += `- **评分**: ${rating} | **评论**: ${reviews}\n`;
    content += `- **综合评分**: ${product.funScore}\n`;
    content += `- **来源**: ${product.sourceChannel} / ${product.sourceCategory}\n\n`;
  });

  return content;
}

// 执行筛选
const selected = filterProducts(rawProducts).slice(0, 10);

console.log(`\n筛选完成，选出 ${selected.length} 个精选商品:\n`);
selected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.goodsNameEn?.substring(0, 60)}... (得分: ${p.funScore})`);
});

// 生成报告
const reportContent = generateSelectedReport(selected, '2026-04-30');

// 保存报告
const reportPath = 'operations/selected/20260430_selector_report_v2.md';
fs.writeFileSync(reportPath, reportContent, 'utf-8');
console.log(`\n报告已保存: ${reportPath}`);

// 保存精选商品JSON
const selectedJsonPath = 'operations/selected/selected_20260430_v2.json';
fs.writeFileSync(selectedJsonPath, JSON.stringify(selected, null, 2), 'utf-8');
console.log(`精选商品已保存: ${selectedJsonPath}`);

// 为每个商品生成独立的markdown文件
const today = new Date();
const dateStr = '20260430';

selected.forEach((product, index) => {
  const num = String(index + 1).padStart(3, '0');
  const fileName = `${dateStr}-${num}.md`;
  const filePath = `operations/selected/${fileName}`;

  let content = `# ${product.goodsNameEn || product.goodsNameCn || 'Unknown Product'}\n\n`;
  content += `## 基本信息\n\n`;
  content += `- **编号**: ${dateStr}-${num}\n`;
  content += `- **平台**: ${product.platform}\n`;
  content += `- **类目**: ${product.sourceCategory}\n`;
  content += `- **来源渠道**: ${product.sourceChannel}\n\n`;
  content += `## 商品信息\n\n`;
  content += `- **英文名**: ${product.goodsNameEn || 'N/A'}\n`;
  content += `- **中文名**: ${product.goodsNameCn || 'N/A'}\n`;
  content += `- **商品ID**: ${product.goodsId || 'N/A'}\n`;
  content += `- **图片**: ${product.thumbnail || 'N/A'}\n\n`;
  content += `## 销售数据\n\n`;
  content += `- **价格**: $${product.goodsPriceMin || 'N/A'} ${product.goodsPriceMax && product.goodsPriceMax !== product.goodsPriceMin ? `- $${product.goodsPriceMax}` : ''}\n`;
  content += `- **销量**: ${product.sold ? product.sold.toLocaleString() : 'N/A'}\n`;
  content += `- **销售额**: $${product.sales ? product.sales.toLocaleString() : 'N/A'}\n`;
  content += `- **评分**: ${product.rating || 'N/A'}/5\n`;
  content += `- **评论数**: ${product.reviewNum ? product.reviewNum.toLocaleString() : 'N/A'}\n\n`;
  content += `## 时间信息\n\n`;
  content += `- **上架时间**: ${product.onSaleTime ? new Date(product.onSaleTime).toLocaleDateString() : 'N/A'}\n`;
  content += `- **开店时间**: ${product.mallOpenTime ? new Date(product.mallOpenTime).toLocaleDateString() : 'N/A'}\n\n`;
  content += `## 综合评分\n\n`;
  content += `**有趣度得分**: ${product.funScore}\n\n`;
  content += `---\n`;
  content += `*采集日期: ${today.toLocaleDateString()}*\n`;

  fs.writeFileSync(filePath, content, 'utf-8');
  console.log(`已生成: ${filePath}`);
});

console.log('\n✅ 选品任务完成!');