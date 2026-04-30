/**
 * ============================================
 * 商品筛选脚本 v2 - 2026-04-30
 * ============================================
 *
 * 改进：
 * 1. 去重：根据goodsId去重
 * 2. 增加平台多样性
 * 3. 强化新奇有趣商品加权
 */

const fs = require('fs');

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync('./dailytemp/2026-04-30/raw_products.json', 'utf8'));
const products = rawData.products;

console.log(`\n========================================`);
console.log(`选品筛选 v2 - 2026-04-30`);
console.log(`========================================`);
console.log(`待筛选商品总数: ${products.length}\n`);

// ============================================
// 1. 去重：根据goodsId去重
// ============================================
const uniqueProductsMap = new Map();
for (const p of products) {
  const key = `${p._platform}-${p.goodsId}`;
  if (!uniqueProductsMap.has(key)) {
    uniqueProductsMap.set(key, p);
  }
}
const uniqueProducts = Array.from(uniqueProductsMap.values());
console.log(`去重后商品数: ${uniqueProducts.length}`);

// ============================================
// 选品关键词评分
// ============================================
const HOT_KEYWORDS = [
  // 创意/新奇
  '创意', '新奇', '独特', '特别', '趣味', '可爱', '搞怪', '爆款',
  'ins', 'viral', 'trending', 'unique', 'fun', 'cute', 'cool',
  '多功能', '多用', '合一', '套装', '组合', '礼盒', '2件装', '3件套',
  // 热门品类
  '智能', '电动', '自动', '无线', '充电', 'LED', '夜灯',
  '防水', '便携', '折叠', '迷你', '小型', '薄款',
  '网红', '爆款', '热销',
  // 节日/场景
  '礼物', '生日', '圣诞', '情人节', '母亲节', '父亲节',
  '婚礼', '派对', '乔迁', '开业', "Mother's day", 'Gift', 'Gift box'
];

const SPECIAL_KEYWORDS = [
  // 新奇特商品关键词
  '解谜', '机关', 'AR', '智能感应', '声控', '遥控',
  '变形', '折叠', '磁吸', '充电', '发光', '变色',
  '懒人', '神器', '黑科技', '爆款', '网红'
];

/**
 * 计算商品评分
 */
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '') + (product.goodsNameCn || '');

  // 1. 销量评分 (最高30分)
  const sold = product.sold || 0;
  const soldScore = Math.min(30, Math.log10(sold + 1) * 5);
  score += soldScore;

  // 2. 评分评分 (最高20分)
  const rating = product.rating || 0;
  score += rating * 4;

  // 3. 评论数评分 (最高10分)
  const reviews = product.reviewNum || 0;
  let reviewScore = 0;
  if (reviews >= 100 && reviews <= 50000) {
    reviewScore = 10;
  } else if (reviews > 50000) {
    reviewScore = 6;
  } else if (reviews > 0) {
    reviewScore = Math.min(5, reviews / 20);
  }
  score += reviewScore;

  // 4. 价格评分 (最高10分)
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const avgPrice = (priceMin + priceMax) / 2;
  let priceScore = 0;
  if (avgPrice >= 5 && avgPrice <= 30) {
    priceScore = 10;
  } else if (avgPrice > 30 && avgPrice <= 50) {
    priceScore = 7;
  } else if (avgPrice > 0 && avgPrice < 5) {
    priceScore = 5;
  }
  score += priceScore;

  // 5. 新奇特关键词加分 (最高15分)
  let specialScore = 0;
  for (const kw of SPECIAL_KEYWORDS) {
    if (name.toLowerCase().includes(kw.toLowerCase())) specialScore += 3;
  }
  score += Math.min(15, specialScore);

  // 6. 热销关键词加分 (最高10分)
  let hotScore = 0;
  for (const kw of HOT_KEYWORDS) {
    if (name.toLowerCase().includes(kw.toLowerCase())) hotScore += 2;
  }
  score += Math.min(10, hotScore);

  // 7. 平台多样性加权（Shein/TikTok加分）
  if (product._platform === 'shein') score += 3;
  if (product._platform === 'tiktok') score += 2;

  return {
    score,
    soldScore,
    ratingScore: rating * 4,
    reviewScore,
    priceScore,
    specialScore: Math.min(15, specialScore),
    hotScore: Math.min(10, hotScore)
  };
}

/**
 * 分析商品特色
 */
function analyzeProduct(product) {
  const name = (product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '');
  const features = [];

  // 检测特色
  if (/2件|3件|套装|组合|礼盒|set/i.test(name)) features.push('套装组合');
  if (/多功能|多用|合一|all in one/i.test(name)) features.push('多功能');
  if (/电动|智能|automatic|smart/i.test(name)) features.push('科技感');
  if (/可爱|趣味|fun|cute/i.test(name)) features.push('趣味可爱');
  if (/礼物|礼品|gift/i.test(name)) features.push('送礼佳品');
  if (/防水|防晒|waterproof/i.test(name)) features.push('防护功能');
  if (/迷你|便携|折叠|mini|portable|fold/i.test(name)) features.push('便携小巧');
  if (/LED|夜灯|light/i.test(name)) features.push('LED灯效');
  if (/无线|充电|wireless|charging/i.test(name)) features.push('无线充电');
  if (/ins|viral|网红|trending/i.test(name)) features.push('网红爆款');
  if (/解谜|机关|puzzle/i.test(name)) features.push('解谜挑战');
  if (/母亲节|Mother/i.test(name)) features.push('母亲节热点');

  return features.length > 0 ? features : ['基础款'];
}

// ============================================
// 执行筛选
// ============================================

// 1. 计算所有商品评分
const scoredProducts = uniqueProducts.map(p => ({
  product: p,
  ...scoreProduct(p)
}));

// 2. 按评分排序
scoredProducts.sort((a, b) => b.score - a.score);

// 3. 选择Top商品
const topProducts = scoredProducts.slice(0, 30).map(sp => {
  const features = analyzeProduct(sp.product);
  const price = sp.product.goodsPriceMax > sp.product.goodsPriceMin
    ? `$${sp.product.goodsPriceMin}-${sp.product.goodsPriceMax}`
    : `$${sp.product.goodsPriceMin}`;

  // 生成选品理由
  const reasons = [];
  if (sp.soldScore > 15) reasons.push(`销量${sp.product.sold}件，市场验证充分`);
  if (sp.product.rating >= 4.5) reasons.push(`评分${sp.product.rating}分，口碑优秀`);
  if (sp.product.reviewNum >= 500) reasons.push(`${sp.product.reviewNum}条真实评价`);
  if (sp.product.goodsPriceMax <= 30) reasons.push('价格亲民，易于转化');
  if (features.length > 0) reasons.push(`特点: ${features.join(', ')}`);

  return {
    platform: sp.product._platform?.toUpperCase(),
    category: sp.product._categoryName,
    name: sp.product.goodsNameEn || sp.product.goodsNameCn || 'Unknown',
    nameCn: sp.product.goodsNameCn || '',
    price,
    sold: sp.product.sold,
    rating: sp.product.rating,
    reviews: sp.product.reviewNum,
    thumbnail: sp.product.thumbnail,
    goodsId: sp.product.goodsId,
    features,
    score: Math.round(sp.score * 10) / 10,
    reason: reasons.join('；')
  };
});

// 4. 精选10个，保持平台多样性
const selected = [];
const platformCount = {};

// 先按平台分布选择
for (const p of topProducts) {
  if (selected.length >= 10) break;

  // 确保平台多样性：同一平台最多2个
  platformCount[p.platform] = (platformCount[p.platform] || 0) + 1;
  if (platformCount[p.platform] <= 2) {
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

// 统计平台分布
console.log('\n========== 平台分布 ==========');
for (const [platform, count] of Object.entries(platformCount)) {
  console.log(`${platform}: ${count}个`);
}

// 保存筛选结果
const outputData = {
  date: '2026-04-30',
  totalProducts: products.length,
  uniqueProducts: uniqueProducts.length,
  selectedProducts: selected,
  platformDistribution: platformCount
};

fs.writeFileSync('./dailytemp/2026-04-30/selected_20260430_v2.json', JSON.stringify(outputData, null, 2));
console.log('\n筛选结果已保存到: dailytemp/2026-04-30/selected_20260430_v2.json');

// 导出
module.exports = { selected, topProducts };