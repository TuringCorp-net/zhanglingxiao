/**
 * ============================================
 * 商品筛选脚本 - 2026-04-30
 * ============================================
 *
 * 选品逻辑（按重要性排序）：
 * 1. 新奇有趣 - 商品本身有特色、有创意
 * 2. 销量高 - 市场验证，需求真实
 * 3. 评分高 - 质量有保障
 * 4. 评论数 - 有真实评价（太少说明新，太多可能竞争激烈）
 * 5. 价格合理 - 有利润空间
 */

const fs = require('fs');

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync('./dailytemp/2026-04-30/raw_products.json', 'utf8'));
const products = rawData.products;

console.log(`\n========================================`);
console.log(`选品筛选 - 2026-04-30`);
console.log(`========================================`);
console.log(`待筛选商品总数: ${products.length}\n`);

// ============================================
// 选品关键词评分（越高越可能是好商品）
// ============================================
const HOT_KEYWORDS = [
  // 创意/新奇
  '创意', '新奇', '独特', '特别', '趣味', '可爱', '搞怪', '爆款',
  'ins', 'viral', 'trending', 'unique', 'fun', 'cute', 'cool',
  '多功能', '多用', '合一', '套装', '组合', '礼盒',
  // 热门品类
  '智能', '电动', '自动', '无线', '充电', 'LED', '夜灯',
  '防水', '便携', '折叠', '迷你', '小型', '薄款',
  '网红', '爆款', '热销', '爆款',
  // 节日/场景
  '礼物', '生日', '圣诞', '情人节', '母亲节', '父亲节',
  '婚礼', '派对', '乔迁', '开业'
];

const BAD_KEYWORDS = [
  // 太普通
  '普通', '基础', '标准', '常规',
  // 质量存疑
  '二手', '翻新', '组装', '散装'
];

/**
 * 计算商品评分
 */
function scoreProduct(product) {
  let score = 0;

  // 1. 销量评分 (最高40分)
  // 销量从0到100万，分数线性增长
  const sold = product.sold || 0;
  const soldScore = Math.min(40, (sold / 100000) * 10);
  score += soldScore;

  // 2. 评分评分 (最高20分)
  const rating = product.rating || 0;
  score += rating * 4; // 5分满分 = 20分

  // 3. 评论数评分 (最高10分)
  // 评论数100-10000之间最理想
  const reviews = product.reviewNum || 0;
  let reviewScore = 0;
  if (reviews >= 100 && reviews <= 10000) {
    reviewScore = 10;
  } else if (reviews > 10000) {
    reviewScore = 5;
  } else if (reviews > 0) {
    reviewScore = Math.min(5, reviews / 20);
  }
  score += reviewScore;

  // 4. 价格评分 (最高10分)
  // 价格5-30美元最理想
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const avgPrice = (priceMin + priceMax) / 2;
  let priceScore = 0;
  if (avgPrice >= 3 && avgPrice <= 30) {
    priceScore = 10;
  } else if (avgPrice > 30 && avgPrice <= 50) {
    priceScore = 7;
  } else if (avgPrice > 0 && avgPrice < 3) {
    priceScore = 5;
  }
  score += priceScore;

  // 5. 关键词评分 (最高20分)
  const name = (product.goodsNameEn || '') + (product.goodsNameCn || '');
  let keywordScore = 0;
  for (const kw of HOT_KEYWORDS) {
    if (name.includes(kw)) keywordScore += 3;
  }
  for (const kw of BAD_KEYWORDS) {
    if (name.includes(kw)) keywordScore -= 5;
  }
  score += Math.min(20, keywordScore);

  // 6. 图片质量加分
  if (product.thumbnail && !product.thumbnail.includes('placeholder')) {
    score += 2;
  }

  return {
    score,
    soldScore,
    ratingScore: rating * 4,
    reviewScore,
    priceScore,
    keywordScore: Math.min(20, keywordScore)
  };
}

/**
 * 分析商品特色
 */
function analyzeProduct(product) {
  const name = (product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '');
  const features = [];

  // 检测特色
  if (name.includes('2件') || name.includes('3件') || name.includes('套装')) features.push('套装组合');
  if (name.includes('多功能') || name.includes('多用')) features.push('多功能');
  if (name.includes('电动') || name.includes('智能')) features.push('科技感');
  if (name.includes('可爱') || name.includes('趣味')) features.push('趣味可爱');
  if (name.includes('礼物') || name.includes('礼品')) features.push('送礼佳品');
  if (name.includes('防水') || name.includes('防晒')) features.push('防护功能');
  if (name.includes('迷你') || name.includes('便携')) features.push('便携小巧');
  if (name.includes('LED') || name.includes('夜灯')) features.push('LED灯效');
  if (name.includes('无线') || name.includes('充电')) features.push('无线充电');
  if (name.includes('ins') || name.includes('网红')) features.push('网红爆款');

  return features.length > 0 ? features : ['基础款'];
}

/**
 * 生成商品摘要
 */
function generateSummary(product) {
  const features = analyzeProduct(product);
  const price = product.goodsPriceMax > product.goodsPriceMin
    ? `$${product.goodsPriceMin}-${product.goodsPriceMax}`
    : `$${product.goodsPriceMin}`;

  return {
    platform: product._platform?.toUpperCase(),
    category: product._categoryName,
    name: product.goodsNameEn || product.goodsNameCn || 'Unknown',
    nameCn: product.goodsNameCn || '',
    price,
    sold: product.sold,
    rating: product.rating,
    reviews: product.reviewNum,
    thumbnail: product.thumbnail,
    goodsId: product.goodsId,
    features,
    score: null, // 稍后填充
    reason: ''
  };
}

// ============================================
// 执行筛选
// ============================================

// 1. 计算所有商品评分
const scoredProducts = products.map(p => ({
  product: p,
  ...scoreProduct(p)
}));

// 2. 按评分排序
scoredProducts.sort((a, b) => b.score - a.score);

// 3. 选择Top 15（多选一些，后面再精选10个）
const topProducts = scoredProducts.slice(0, 20).map(sp => {
  const summary = generateSummary(sp.product);
  summary.score = Math.round(sp.score * 10) / 10;

  // 生成选品理由
  const reasons = [];
  if (sp.soldScore > 20) reasons.push(`销量${sp.product.sold}件，市场验证充分`);
  if (sp.product.rating >= 4.5) reasons.push(`评分${sp.product.rating}分，口碑优秀`);
  if (sp.product.reviewNum >= 500) reasons.push(`${sp.product.reviewNum}条真实评价`);
  if (sp.product.goodsPriceMax <= 20) reasons.push('价格亲民，易于转化');
  if (summary.features.length > 0) reasons.push(`产品特点: ${summary.features.join(', ')}`);

  summary.reason = reasons.join('；');
  return summary;
});

// 4. 精选10个，保持平台多样性
const selected = [];
const platformCount = {};

for (const p of topProducts) {
  if (selected.length >= 10) break;

  // 确保平台多样性：同一平台最多3个
  platformCount[p.platform] = (platformCount[p.platform] || 0) + 1;
  if (platformCount[p.platform] <= 3) {
    selected.push(p);
  }
}

// 如果不够10个，补充剩余的
if (selected.length < 10) {
  for (const p of topProducts) {
    if (selected.length >= 10) break;
    if (!selected.includes(p)) {
      selected.push(p);
    }
  }
}

// ============================================
// 输出结果
// ============================================

console.log('\n========== 精选商品 Top 10 ==========\n');

selected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.name.substring(0, 60)}...`);
  console.log(`   价格: ${p.price} | 销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviews}`);
  console.log(`   特点: ${p.features.join(', ')}`);
  console.log(`   选品理由: ${p.reason}`);
  console.log('');
});

// 保存筛选结果
const outputData = {
  date: '2026-04-30',
  totalProducts: products.length,
  selectedProducts: selected,
  platforms: platformCount
};

fs.writeFileSync('./dailytemp/2026-04-30/selected_20260430.json', JSON.stringify(outputData, null, 2));
console.log('\n筛选结果已保存到: dailytemp/2026-04-30/selected_20260430.json');

// 导出
module.exports = { selected, topProducts };