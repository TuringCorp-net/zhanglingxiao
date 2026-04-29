/**
 * ============================================
 * 2026-04-29 选品筛选脚本
 * ============================================
 *
 * 筛选原则：新奇/有趣/好玩/有爆点
 *
 * 评分维度：
 * 1. 新奇特属性 - 产品名称中是否包含独特/创意/多功能等关键词
 * 2. 趣味性 - 是否有趣味性设计（卡通、可爱、有趣）
 * 3. 爆点潜力 - 多功能合一、新上架、销量上升趋势
 * 4. 实用性 - 有明确使用场景
 * 5. 差异化 - 与普通商品有明显区别
 */

const fs = require('fs');

// 读取原始数据
const rawData = JSON.parse(fs.readFileSync(__dirname + '/dailytemp/2026-04-29/raw_products.json', 'utf-8'));
const products = rawData.products;

// 评分关键词
const SCORE_KEYWORDS = {
  // 新奇特加分词
  novelty: [
    'multi-functional', '2-in-1', '3-in-1', '4-in-1', '5-in-1', 'multi', 'combo',
    'upgrade', 'new', 'innovative', 'creative', 'unique', 'portable', 'mini',
    'rechargeable', 'wireless', 'electric', 'automatic', 'smart', 'digital',
    '多功能', '二合一', '三合一', '四合一', '五合一', '升级', '创新', '创意',
    '便携', '迷你', '充电', '无线', '电动', '自动', '智能', '数字'
  ],
  // 趣味性加分词
  fun: [
    'cute', 'funny', 'cartoon', 'kawaii', 'colorful', 'fun', 'crazy', 'cool',
    'novelty', 'decorative', 'gift', 'party', 'holiday', 'christmas', 'halloween',
    'pet', 'animal', 'bear', 'cat', 'dog', 'bunny', 'panda', 'dinosaur',
    '卡通', '可爱', '趣味', '有趣', '装饰', '礼物', '节日', '宠物', '动物',
    '熊', '猫', '狗', '兔子', '熊猫', '恐龙', '小狗', '小猫咪'
  ],
  // 爆点潜力词
  trending: [
    'viral', 'trending', 'hot', 'bestseller', 'popular', 'sale', 'deal',
    'USB', 'LED', 'RGB', 'solar', 'eco', 'energy-saving', 'fast',
    '最新', '热销', '爆款', '流行', '畅销', '特卖', '爆款', '趋势'
  ],
  // 实用性场景词
  practical: [
    'kitchen', 'bathroom', 'bedroom', 'office', 'travel', 'camping', 'outdoor',
    'home', 'car', 'phone', 'kitchen', 'cleaning', 'storage', 'organizer',
    'kitchen', 'home', 'office', 'travel', 'fitness', 'gym', 'sport',
    '厨房', '浴室', '卧室', '办公室', '旅行', '露营', '户外', '家居', '汽车',
    '清洁', '收纳', '整理'
  ]
};

// 扣分词（太普通、没有差异化的商品）
const PENALTY_KEYWORDS = [
  'replacement', 'generic', 'standard', 'normal', 'basic', 'simple',
  '普通', '标准', '基本', '替换', '通用', '无品牌'
];

// 评分函数
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn + ' ' + product.goodsNameCn).toLowerCase();
  const nameCn = product.goodsNameCn || '';

  // 1. 新奇特加分 (最高 +30)
  const noveltyMatches = SCORE_KEYWORDS.novelty.filter(kw =>
    name.includes(kw.toLowerCase()) || nameCn.includes(kw)
  );
  score += Math.min(noveltyMatches.length * 5, 30);

  // 2. 趣味性加分 (最高 +25)
  const funMatches = SCORE_KEYWORDS.fun.filter(kw =>
    name.includes(kw.toLowerCase()) || nameCn.includes(kw)
  );
  score += Math.min(funMatches.length * 5, 25);

  // 3. 爆点潜力加分 (最高 +20)
  const trendMatches = SCORE_KEYWORDS.trending.filter(kw =>
    name.includes(kw.toLowerCase()) || nameCn.includes(kw)
  );
  score += Math.min(trendMatches.length * 5, 20);

  // 4. 实用性场景加分 (最高 +10)
  const practicalMatches = SCORE_KEYWORDS.practical.filter(kw =>
    name.includes(kw.toLowerCase()) || nameCn.includes(kw)
  );
  score += Math.min(practicalMatches.length * 3, 10);

  // 5. 扣分项 (最高 -20)
  const penaltyMatches = PENALTY_KEYWORDS.filter(kw =>
    name.includes(kw.toLowerCase()) || nameCn.includes(kw)
  );
  score -= Math.min(penaltyMatches.length * 5, 20);

  // 6. 销量加权 (有销量的更好)
  if (product.sold && product.sold > 100) {
    score += Math.min(Math.log10(product.sold) * 3, 15);
  }

  // 7. 评分加权
  if (product.rating && product.rating >= 4.5) {
    score += 5;
  }

  // 8. 评论数适中（太少可能质量不稳定，太多可能太成熟）
  if (product.reviewNum && product.reviewNum >= 5 && product.reviewNum <= 500) {
    score += 5;
  }

  // 9. 价格区间适中（太低可能质量差，太高可能难卖）
  const price = product.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) {
    score += 5;
  } else if (price > 50 && price <= 100) {
    score += 2;
  }

  // 10. 新上架商品加分
  if (product.onSaleTime) {
    const saleDate = new Date(product.onSaleTime);
    const now = new Date('2026-04-29');
    const daysSinceSale = (now - saleDate) / (1000 * 60 * 60 * 24);
    if (daysSinceSale <= 7) {
      score += 10; // 7天内上架
    } else if (daysSinceSale <= 30) {
      score += 5;  // 30天内上架
    }
  }

  // 11. 有缩略图加分
  if (product.thumbnail || product.thumbnailCn) {
    score += 3;
  }

  // 12. 多功能合一特殊加分
  if (name.includes('2-in-1') || name.includes('3-in-1') || name.includes('4-in-1') ||
      name.includes('5-in-1') || nameCn.includes('二合一') || nameCn.includes('三合一') ||
      nameCn.includes('四合一') || nameCn.includes('五合一')) {
    score += 10; // 多功能合一额外加分
  }

  return score;
}

// 筛选并评分
console.log('==========================================');
console.log('选品筛选开始 - 2026-04-29');
console.log(`待筛选商品: ${products.length} 个`);
console.log('==========================================\n');

const scoredProducts = products.map(p => ({
  ...p,
  selectionScore: scoreProduct(p)
}));

// 按评分排序
scoredProducts.sort((a, b) => b.selectionScore - a.selectionScore);

// 取前30个候选，然后精选10个（覆盖不同平台和类目）
const candidates = scoredProducts.slice(0, 30);

// 精选10个（尽量覆盖多个平台）
const selected = [];
const usedPlatforms = new Set();
const usedLeafCats = new Set();

for (const p of candidates) {
  if (selected.length >= 10) break;

  // 获取叶子类目
  const leafCat = p.catItems ? p.catItems.find(c => c.isLeaf)?.catName : null;

  // 优先选择未覆盖的平台
  const platformPriority = !usedPlatforms.has(p.platform) ? 2 : 1;

  // 同一平台内避免类目重复
  const catPriority = leafCat && !usedLeafCats.has(leafCat) ? 1 : 0;

  if (platformPriority > 1 || (selected.length < 5 && catPriority > 0)) {
    selected.push(p);
    usedPlatforms.add(p.platform);
    if (leafCat) usedLeafCats.add(leafCat);
  }
}

// 如果不足10个，补充评分最高的
if (selected.length < 10) {
  for (const p of candidates) {
    if (selected.length >= 10) break;
    if (!selected.find(s => s.goodsId === p.goodsId)) {
      selected.push(p);
    }
  }
}

// 输出结果
console.log('筛选完成！\n');
console.log('==========================================');
console.log('精选 TOP 10 商品');
console.log('==========================================\n');

selected.forEach((p, i) => {
  console.log(`【${i + 1}】${p.goodsNameEn.substring(0, 60)}...`);
  console.log(`    平台: ${p.platform} | 类目: ${p._collectionMeta.catName}`);
  console.log(`    价格: $${p.goodsPriceMin || '-'} | 销量: ${p.sold || 0} | 评分: ${p.rating || 'N/A'}`);
  console.log(`    选品评分: ${p.selectionScore.toFixed(1)}`);
  console.log(`    商品ID: ${p.goodsId}`);
  console.log(`    缩略图: ${p.thumbnail || p.thumbnailCn || 'N/A'}`);
  console.log('');
});

// 保存筛选结果
const selectedData = {
  selectedAt: new Date().toISOString(),
  totalCandidates: products.length,
  selectedCount: selected.length,
  selectionCriteria: {
    novelty: '多功能、创新、便携、迷你、升级',
    fun: '可爱、趣味、卡通、宠物、礼物',
    trending: '热销、爆款、USB、LED、趋势',
    practical: '厨房、卧室、办公室、旅行、收纳'
  },
  selected: selected.map((p, i) => ({
    rank: i + 1,
    goodsId: p.goodsId,
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    platform: p.platform,
    catName: p._collectionMeta.catName,
    catId: p._collectionMeta.catId,
    channel: p._collectionMeta.channel,
    priceMin: p.goodsPriceMin,
    priceMax: p.goodsPriceMax,
    sold: p.sold,
    sales: p.sales,
    reviewNum: p.reviewNum,
    rating: p.rating,
    thumbnail: p.thumbnail,
    thumbnailCn: p.thumbnailCn,
    onSaleTime: p.onSaleTime,
    selectionScore: p.selectionScore
  }))
};

// 写入JSON
const jsonPath = __dirname + '/selected_20260429.json';
fs.writeFileSync(jsonPath, JSON.stringify(selectedData, null, 2));
console.log(`\n选品结果已保存: ${jsonPath}`);

module.exports = { selectedData, scoredProducts };
