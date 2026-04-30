/**
 * ============================================
 * 选品筛选脚本 - 2026-04-30
 * ============================================
 *
 * 筛选标准：
 * 1. 新奇/有趣/好玩/有爆点
 * 2. 销量达到一定基础（>1000）
 * 3. 价格区间合理（$5-$100）
 * 4. 评分和评论数合理
 *
 * 目标：选出10个最有价值的商品
 */

const fs = require('fs');
const path = require('path');

// 读取原始数据
const rawDataPath = path.join(__dirname, 'dailytemp', '2026-04-30', 'raw_products.json');
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));

// 收集所有商品
let allProducts = [];

for (const category of rawData) {
  for (const [channel, data] of Object.entries(category.channels)) {
    if (data.success && data.products) {
      for (const product of data.products) {
        allProducts.push({
          ...product,
          sourcePlatform: category.platform,
          sourceCatName: category.catName,
          sourceChannel: channel
        });
      }
    }
  }
}

console.log(`共收集商品: ${allProducts.length} 个`);

// 去重（基于 goodsId）
const seenIds = new Set();
allProducts = allProducts.filter(p => {
  if (p.goodsId && seenIds.has(p.goodsId)) return false;
  if (p.goodsId) seenIds.add(p.goodsId);
  return true;
});
console.log(`去重后: ${allProducts.length} 个`);

// 筛选标准评分函数
function scoreProduct(product) {
  let score = 0;

  // 销量评分 (最高40分)
  const sold = product.sold || 0;
  if (sold > 50000) score += 40;
  else if (sold > 20000) score += 35;
  else if (sold > 10000) score += 30;
  else if (sold > 5000) score += 25;
  else if (sold > 2000) score += 20;
  else if (sold > 1000) score += 15;
  else if (sold > 500) score += 10;
  else if (sold > 100) score += 5;

  // 评论数评分 (最高20分)
  const reviews = product.reviewNum || 0;
  if (reviews > 5000) score += 20;
  else if (reviews > 2000) score += 15;
  else if (reviews > 1000) score += 12;
  else if (reviews > 500) score += 10;
  else if (reviews > 100) score += 7;
  else if (reviews > 50) score += 5;
  else if (reviews > 10) score += 3;

  // 评分评分 (最高15分)
  const rating = product.rating || 0;
  if (rating >= 4.8) score += 15;
  else if (rating >= 4.5) score += 12;
  else if (rating >= 4.0) score += 10;
  else if (rating >= 3.5) score += 7;
  else if (rating >= 3.0) score += 5;

  // 价格评分 (最高15分) - 偏好中间价位
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const avgPrice = (priceMin + priceMax) / 2;

  if (avgPrice >= 10 && avgPrice <= 30) score += 15;
  else if (avgPrice >= 5 && avgPrice <= 50) score += 12;
  else if (avgPrice >= 3 && avgPrice <= 80) score += 8;
  else if (avgPrice > 0) score += 5;

  // 新奇度评分 (最高10分) - 基于关键词
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const allName = nameEn + ' ' + nameCn;

  // 有趣/新奇关键词
  const funKeywords = [
    'funny', 'novelty', 'unique', 'weird', 'quirky', 'cute', 'cool',
    '趣味', '搞怪', '新奇', '创意', '可爱', '爆款', '网红', '热卖',
    'game', 'led', 'light', 'remote', 'wireless', 'smart', 'portable',
    'kids', 'children', 'baby', 'gift', 'decor', 'party', 'holiday',
    'robot', '3d', 'magic', 'transform', 'fold', 'mini', 'compact'
  ];

  let funCount = 0;
  for (const kw of funKeywords) {
    if (allName.includes(kw)) funCount++;
  }
  score += Math.min(funCount * 2, 10);

  return score;
}

// 筛选并排序
const filteredProducts = allProducts
  .filter(p => {
    // 基础过滤：需要有名称和商品ID
    if (!p.goodsNameEn && !p.goodsName) return false;
    // 价格合理
    const priceMax = p.goodsPriceMax || p.goodsPriceMin || 0;
    if (priceMax > 200) return false; // 排除太贵的
    if (priceMax <= 0) return false; // 排除价格异常的
    return true;
  })
  .map(p => ({
    ...p,
    selectionScore: scoreProduct(p)
  }))
  .sort((a, b) => b.selectionScore - a.selectionScore);

// 取前10个
const selectedProducts = filteredProducts.slice(0, 10);

console.log('\n=== 精选商品 Top 10 ===');
selectedProducts.forEach((p, i) => {
  const price = p.goodsPriceMin === p.goodsPriceMax
    ? `$${p.goodsPriceMin}`
    : `$${p.goodsPriceMin}-$${p.goodsPriceMax}`;
  console.log(`${i + 1}. [${p.sourcePlatform}] ${p.goodsNameEn?.substring(0, 50) || p.goodsName?.substring(0, 50)}`);
  console.log(`   价格: ${price} | 销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`   评分: ${p.selectionScore}`);
});

// 生成报告
const report = {
  date: '2026-04-30',
  totalCollected: allProducts.length,
  totalSelected: selectedProducts.length,
  categories: rawData.map(c => ({
    platform: c.platform,
    catName: c.catName,
    channels: Object.keys(c.channels)
  })),
  selectedProducts: selectedProducts.map((p, i) => ({
    rank: i + 1,
    goodsId: p.goodsId,
    goodsName: p.goodsNameEn || p.goodsName || 'N/A',
    goodsNameCn: p.goodsNameCn || '',
    thumbnail: p.thumbnail,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    sold: p.sold,
    rating: p.rating,
    reviewNum: p.reviewNum,
    sourcePlatform: p.sourcePlatform,
    sourceCatName: p.sourceCatName,
    sourceChannel: p.sourceChannel,
    selectionScore: p.selectionScore
  }))
};

// 保存报告
const reportPath = path.join(__dirname, 'dailytemp', '2026-04-30', 'selection_report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
console.log(`\n报告已保存至: ${reportPath}`);

// 返回精选商品供后续处理
module.exports = selectedProducts;
