/**
 * 选品筛选脚本 - 2026-04-29 第二轮
 *
 * 筛选标准：奇/有趣/好玩/有爆点
 * 1. 产品名称/描述中有独特卖点或创意元素
 * 2. 产品设计或功能有趣味性
 * 3. 价格/销量表现出爆品潜力
 * 4. 适合社交媒体传播的特色
 */

const fs = require('fs');

// 读取采集数据
const inputPath = __dirname + '/dailytemp/2026-04-29/crawl_20260429_v2.json';
const rawData = JSON.parse(fs.readFileSync(inputPath, 'utf-8'));

const allProducts = rawData.data;
console.log(`读取到 ${allProducts.length} 个商品，开始筛选...\n`);

// 筛选关键词（用于识别有潜力的商品）
const funKeywords = [
  // 趣味/创意
  'fun', 'cute', 'unique', 'novel', 'cool', 'quirky', 'creative', 'whimsical', 'playful',
  'interesting', 'amusing', 'entertaining', 'hilarious', 'ridiculous', 'absurd',
  // 游戏/玩具
  'game', 'toy', 'puzzle', 'magic', 'trick', 'prank', 'escape', 'adventure',
  // 流行/热点
  'trending', 'viral', 'tiktok', 'instagram', 'youtube', 'influencer',
  // 节日/派对
  'party', 'halloween', 'christmas', 'cosplay', 'costume', 'festival',
  // 创意功能
  'transform', 'multi-functional', 'portable', 'compact', 'wearable', 'smart',
  // 特殊用途
  'gift', 'surprise', 'mystery', 'hidden', 'secret', 'collectible', 'limited'
];

const funChineseKeywords = [
  // 趣味/创意
  '趣味', '可爱', '独特', '新奇', '创意', '搞怪', '有趣', '好玩', '爆款', '热门', '网红', '爆款',
  // 游戏/玩具
  '游戏', '玩具', '魔术', '整蛊', '道具', '互动',
  // 节日/派对
  '派对', '万圣节', '圣诞', 'cosplay', 'cos', '节日',
  // 创意功能
  '变形', '多功能', '便携', '智能',
  // 特殊用途
  '礼物', '惊喜', '神秘', '收藏', '限量'
];

// 评分函数
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const catName = (product.sourceCatName || '').toLowerCase();

  // 名称包含趣味关键词
  funKeywords.forEach(kw => {
    if (name.includes(kw)) score += 3;
  });

  funChineseKeywords.forEach(kw => {
    if (nameCn.includes(kw)) score += 3;
  });

  // 名称长度适中（太短可能信息不足，太长可能有详细描述）
  const nameLen = name.length;
  if (nameLen >= 20 && nameLen <= 100) score += 2;
  if (nameLen >= 50 && nameLen <= 80) score += 1;

  // 销量表现（越高越好，但需要有基本量）
  const sold = product.sold || 0;
  if (sold >= 1000) score += 2;
  if (sold >= 5000) score += 2;
  if (sold >= 10000) score += 2;
  if (sold >= 50000) score += 3;

  // 价格适中（太便宜可能质量差，太贵可能难卖）
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || 0;
  const avgPrice = (priceMin + priceMax) / 2;
  if (avgPrice >= 5 && avgPrice <= 50) score += 1;

  // 评论数（表明有真实购买）
  const reviewNum = product.reviewNum || 0;
  if (reviewNum >= 50) score += 1;
  if (reviewNum >= 200) score += 1;
  if (reviewNum >= 500) score += 1;

  // 评分（表明质量OK）
  const rating = product.rating || 0;
  if (rating >= 4.0) score += 1;
  if (rating >= 4.5) score += 1;

  // 有图片（可能有特色设计）
  if (product.thumbnail) score += 1;

  return score;
}

// 去重（基于 goodsId 或名称）
function deduplicate(products) {
  const seen = new Set();
  const result = [];

  products.forEach(p => {
    const key = p.goodsId || p.goodsNameEn || '';
    if (!seen.has(key)) {
      seen.add(key);
      result.push(p);
    }
  });

  return result;
}

// 应用筛选
const scoredProducts = allProducts.map(p => ({
  ...p,
  score: scoreProduct(p)
}));

// 按分数排序，取前50
const topScored = scoredProducts
  .filter(p => p.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, 50);

// 去重
const deduped = deduplicate(topScored);

// 从去重结果中选取最终10个（保持多样性）
const finalSelected = [];
const platformCount = {};

deduped.forEach(p => {
  if (finalSelected.length >= 10) return;

  const platform = p.sourcePlatform;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  // 每个平台最多选3个
  if (platformCount[platform] <= 3) {
    finalSelected.push(p);
  }
});

console.log('筛选结果:');
console.log('='.repeat(60));

finalSelected.forEach((p, i) => {
  console.log(`\n[${i + 1}] ${p.sourcePlatform}/${p.sourceCatName} - ${p.sourceChannel}`);
  console.log(`    名称: ${p.goodsNameEn?.substring(0, 80)}...`);
  console.log(`    中文: ${p.goodsNameCn?.substring(0, 40)}`);
  console.log(`    价格: $${p.goodsPriceMin} - $${p.goodsPriceMax}`);
  console.log(`    销量: ${p.sold}`);
  console.log(`    评论: ${p.reviewNum} | 评分: ${p.rating}`);
  console.log(`    图片: ${p.thumbnail?.substring(0, 60)}...`);
  console.log(`    评分: ${p.score}`);
});

// 生成选品报告
const report = {
  timestamp: new Date().toISOString(),
  totalProductsScanned: allProducts.length,
  productsScored: scoredProducts.filter(p => p.score > 0).length,
  finalSelectedCount: finalSelected.length,
  selectedProducts: finalSelected.map((p, i) => ({
    index: i + 1,
    platform: p.sourcePlatform,
    category: p.sourceCatName,
    channel: p.sourceChannel,
    goodsId: p.goodsId,
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    thumbnail: p.thumbnail,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    sold: p.sold,
    reviewNum: p.reviewNum,
    rating: p.rating,
    score: p.score,
    channelUrl: `https://www.${getPlatformDomain(p.sourcePlatform)}/goods/${getChannelSuffix(p.sourceChannel)}?catId=${p.catId || ''}`
  }))
};

function getPlatformDomain(platform) {
  const domains = {
    'temu': 'temaishuju.com',
    'shein': 'sheinshuju.com',
    'amazon': 'amazonshuju.com',
    'sumaitong': 'sumaitongshuju.com',
    'tiktok': 'tiktokshuju.com'
  };
  return domains[platform] || '';
}

function getChannelSuffix(channel) {
  const suffixes = {
    '热销商品': 'hot-sale',
    '热销新品': 'hot-sale-new',
    '新店热销': 'new-mall-hot-sale',
    '大卖新品': 'big-sale-new'
  };
  return suffixes[channel] || 'hot-sale';
}

// 保存筛选结果
const filterOutputPath = __dirname + '/dailytemp/2026-04-29/filter_20260429_v2.json';
fs.writeFileSync(filterOutputPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`\n筛选结果已保存至: ${filterOutputPath}`);

// 生成选品报告 markdown
const reportMd = `# 选品报告 - 2026-04-29 第二轮

**采集时间**: ${report.timestamp}
**扫描商品数**: ${report.totalProductsScanned}
**筛选通过数**: ${report.productsScored}
**最终入选数**: ${report.finalSelectedCount}

---

## 入选商品

${report.selectedProducts.map(p => `
### ${p.index}. ${p.platform.toUpperCase()} - ${p.category}

| 属性 | 值 |
|------|-----|
| 商品ID | ${p.goodsId || 'N/A'} |
| 英文名称 | ${p.goodsNameEn || 'N/A'} |
| 中文名称 | ${p.goodsNameCn || 'N/A'} |
| 渠道 | ${p.channel} |
| 价格 | $${p.goodsPriceMin} - $${p.goodsPriceMax} |
| 销量 | ${p.sold} |
| 评论数 | ${p.reviewNum} |
| 评分 | ${p.rating} |
| 选品评分 | ${p.score} |
| 来源链接 | ${p.channelUrl} |

![](${p.thumbnail})

---`).join('\n')}

## 筛选说明

筛选标准：新奇/有趣/好玩/有爆点

评估维度：
1. 产品名称/描述中的创意关键词
2. 价格适中（$5-$50）
3. 销量表现（基数量级）
4. 评论数和评分（表明真实性和质量）
5. 平台和类目多样性
`;

// 保存报告
const reportPath = __dirname + '/20260429_selector_report_v2.md';
fs.writeFileSync(reportPath, reportMd, 'utf-8');
console.log(`选品报告已保存至: ${reportPath}`);

module.exports = report;