/**
 * 选品筛选脚本 - 2026-05-02
 *
 * 筛选标准：
 * 1. 新奇/有趣/好玩/有爆点
 * 2. 避免过于普通的大众商品
 * 3. 考虑销量、评分、上架时间等因素
 */

const fs = require('fs');
const path = require('path');

const findoraRoot = path.resolve(__dirname, '../..');
const rawDataPath = path.join(findoraRoot, 'operations/selected/dailytemp/2026-05-02/raw_products.json');
const outputDir = path.join(findoraRoot, 'operations/selected/dailytemp/2026-05-02');

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));
const products = rawData.products;

console.log('='.repeat(60));
console.log('[筛选] 开始筛选精选商品');
console.log(`[筛选] 待筛选商品数量: ${products.length}`);
console.log('='.repeat(60));

// ============ 筛选逻辑 ============

/**
 * 计算商品"有趣度"评分
 * - 独特性：商品名称是否有独特卖点
 * - 实用性：是否解决实际问题
 * - 趣味性：是否有趣味元素
 * - 爆点：是否有话题性
 */
function calculateFunScore(product) {
  let score = 0;
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();

  // 趣味关键词加分
  const funKeywords = [
    'fun', 'cute', 'adorable', 'creative', 'unique', 'interesting',
    'playful', 'quirky', ' novelty', 'whimsical', 'bizarre', 'funny',
    'cool', 'awesome', 'amazing', 'crazy', 'weird', 'special'
  ];
  for (const kw of funKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 15;
    }
  }

  // 宠物类趣味产品加分
  const petFunKeywords = [
    'calming', 'raincoat', 'costume', 'halloween', 'christmas', 'party',
    'dress up', 'outfit', 'accessories', 'toy', 'bed', 'house', 'cushion'
  ];
  for (const kw of petFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 10;
    }
  }

  // 服饰类趣味产品加分
  const fashionFunKeywords = [
    'trendy', 'vintage', 'boho', 'minimalist', 'statement', 'layered',
    'stacked', 'layering', 'choker', 'bracelet', 'necklace', 'earring'
  ];
  for (const kw of fashionFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 10;
    }
  }

  // 家用电器类趣味产品加分
  const applianceFunKeywords = [
    'smart', 'automatic', 'led', 'usb', 'mini', 'portable', 'compact',
    ' multifunctional', ' 3-in-1', '2-in-1', 'rechargeable'
  ];
  for (const kw of applianceFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 10;
    }
  }

  // 销量加权（销量高但不过于大众）
  const sold = product.sold || 0;
  if (sold >= 100 && sold < 5000) {
    score += 20;  // 中等销量，验证过市场接受度
  } else if (sold >= 50 && sold < 100) {
    score += 25;  // 较低销量，可能是新品或细分市场
  } else if (sold >= 10 && sold < 50) {
    score += 30;  // 极低销量，可能是新上架的有趣产品
  }

  // 评分加权（评分太低不好，太高可能太普通）
  const rating = product.rating || 0;
  if (rating >= 4.0 && rating < 4.5) {
    score += 10;  // 4星左右，有改进空间但可接受
  } else if (rating >= 4.5 && rating < 4.8) {
    score += 5;   // 4.5星以上，高质量
  }

  // 评论数适中加分（评论太多可能是大众商品）
  const reviewNum = product.reviewNum || 0;
  if (reviewNum >= 5 && reviewNum < 50) {
    score += 15;
  } else if (reviewNum >= 1 && reviewNum < 5) {
    score += 10;
  }

  // 上架时间：越新越有爆点潜力
  const onSaleTime = product.onSaleTime || product.mallOpenTime || '';
  if (onSaleTime) {
    const saleDate = new Date(onSaleTime);
    const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 7) {
      score += 20;  // 7天内上架
    } else if (daysAgo <= 14) {
      score += 15;  // 14天内上架
    } else if (daysAgo <= 21) {
      score += 10;  // 21天内上架
    }
  }

  // 价格因素：价格太低可能质量差，太高可能没竞争力
  const priceMin = product.goodsPriceMin || 0;
  if (priceMin >= 3 && priceMin <= 30) {
    score += 10;  // 价格适中
  }

  // 排除过于普通的商品
  const boringKeywords = [
    'basic', 'simple', 'standard', 'ordinary', 'generic', 'plain',
    'common', 'regular', 'normal', 'typical'
  ];
  for (const kw of boringKeywords) {
    if (name.includes(kw)) {
      score -= 20;
    }
  }

  return score;
}

// 对每个商品计算有趣度评分
const scoredProducts = products.map((p, index) => ({
  ...p,
  _index: index,
  funScore: calculateFunScore(p)
}));

// 按有趣度评分排序，取前20进行人工审核
scoredProducts.sort((a, b) => b.funScore - a.funScore);

// 选取前15个进入候选名单
const candidates = scoredProducts.slice(0, 15);

// 输出候选商品供审核
console.log('\n[筛选] 候选商品（按有趣度评分排序）：');
candidates.forEach((p, i) => {
  console.log(`\n${i + 1}. [${p.platform}] ${p.platformCatName} - ${p.channel}`);
  console.log(`   名称: ${(p.goodsNameEn || p.goodsName || 'N/A').substring(0, 80)}...`);
  console.log(`   价格: $${p.goodsPriceMin} ~ $${p.goodsPriceMax}`);
  console.log(`   销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`   有趣度评分: ${p.funScore}`);
});

// 最终选出10个
const selectedProducts = candidates.slice(0, 10);

// 生成编号 YYYYMMDD-NNN
const today = '20260502';
const selectedWithIds = selectedProducts.map((p, i) => {
  const id = `${today}-${String(i + 1).padStart(3, '0')}`;
  return {
    ...p,
    selectionId: id
  };
});

// 保存筛选结果
const selectionResult = {
  crawlDate: rawData.crawlDate,
  filterDate: new Date().toISOString(),
  totalProducts: products.length,
  candidatesCount: candidates.length,
  selectedCount: selectedWithIds.length,
  selectionCriteria: '新奇/有趣/好玩/有爆点',
  products: selectedWithIds.map(p => ({
    selectionId: p.selectionId,
    platform: p.platform,
    platformCatName: p.platformCatName,
    channel: p.channel,
    goodsNameEn: p.goodsNameEn || p.goodsName,
    goodsNameCn: p.goodsNameCn,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    sold: p.sold,
    rating: p.rating,
    reviewNum: p.reviewNum,
    thumbnail: p.thumbnail,
    thumbnailCn: p.thumbnailCn,
    goodsId: p.goodsId,
    onSaleTime: p.onSaleTime,
    funScore: p.funScore
  }))
};

// 保存结果
const selectedJsonPath = path.join(outputDir, 'selected_products.json');
fs.writeFileSync(selectedJsonPath, JSON.stringify(selectionResult, null, 2));

console.log('\n' + '='.repeat(60));
console.log('[筛选] 筛选完成！');
console.log(`[筛选] 精选商品数量: ${selectedWithIds.length}`);
console.log(`[筛选] 结果已保存至: ${selectedJsonPath}`);
console.log('='.repeat(60));

// 导出结果供后续使用
module.exports = selectedWithIds;
