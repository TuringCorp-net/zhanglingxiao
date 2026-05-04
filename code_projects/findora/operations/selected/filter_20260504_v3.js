/**
 * 选品筛选脚本 - 2026-05-04
 *
 * 筛选逻辑（按优先级）：
 * 1. 新奇有趣 - 商品名称或描述独特、创意
 * 2. 有爆点 - 销量高、评分高、评论多
 * 3. 适合内容创作 - 有视觉吸引力，适合展示
 * 4. 避免常规品 - 只选有特色的商品
 *
 * 输出：10个精选商品
 */

const fs = require('fs');
const path = require('path');

const today = '2026-05-04';
const rawDataPath = path.join(__dirname, 'dailytemp', today, 'raw_data.json');
const selectedDir = path.join(__dirname);

// 读取原始数据
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));

// 收集所有商品
const allProducts = [];

for (const [platform, platformData] of Object.entries(rawData.platforms)) {
  for (const [channel, channelData] of Object.entries(platformData.channels)) {
    if (channelData.success && channelData.products) {
      for (const product of channelData.products) {
        allProducts.push({
          ...product,
          channel: channelData.title,
          platformName: platform
        });
      }
    }
  }
}

console.log(`共有 ${allProducts.length} 个候选商品\n`);

// ==================== 筛选函数 ====================

// 排除词列表（常规商品/没有特色）
const excludeKeywords = [
  '常规', '普通', 'standard', 'basic', 'simple', 'ordinary'
];

// 特色关键词（优先选）
const interestingKeywords = [
  // 创意/新奇
  'magic', 'magic', '创意', '新奇特', 'unique', 'funny', 'quirky', 'weird',
  'surprise', 'gift', 'cute', 'kawaii', 'decorative', 'decor',

  // 玩具/游戏
  'toy', 'game', 'play', 'kids', 'children', 'toddler', 'baby',
  'bubble', 'bubble gun', 'machine', 'puzzle',

  // 装饰/礼品
  'christmas', 'wedding', 'party', 'birthday', 'holiday', 'festival',

  // 视觉吸引力
  'colorful', 'rainbow', 'glow', 'led', 'neon', 'light',

  // 功能特殊
  'automatic', 'reusable', 'foldable', 'portable', 'mini', 'miniature'
];

// 计算商品特色分数
function calculateScore(product) {
  let score = 0;
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = nameEn + ' ' + nameCn;

  // 特色关键词加分
  for (const keyword of interestingKeywords) {
    if (fullName.includes(keyword.toLowerCase())) {
      score += 5;
    }
  }

  // 销量加分（但不要太高，爆款可能已经被过度开发）
  const sold = product.sold || 0;
  if (sold >= 10000 && sold <= 100000) {
    score += 10; // 中等销量，有潜力
  } else if (sold > 100000 && sold < 500000) {
    score += 5; // 爆款但不算太卷
  }

  // 评分加分
  const rating = product.rating || 0;
  if (rating >= 4.5) score += 5;
  else if (rating >= 4.0) score += 2;

  // 评论数加分（有一定评论说明有人买）
  const reviews = product.reviewNum || 0;
  if (reviews >= 100 && reviews <= 5000) {
    score += 5;
  } else if (reviews > 5000) {
    score += 2;
  }

  // 新品加分（上架时间较近）
  if (product.onSaleTime) {
    const onSaleDate = new Date(product.onSaleTime);
    const daysSinceSale = (Date.now() - onSaleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSale < 30) {
      score += 8; // 30天内上架
    } else if (daysSinceSale < 90) {
      score += 4; // 90天内上架
    }
  }

  // 平台加权
  const platformBonus = {
    'tiktok': 3,  // TikTok的选品更有爆点
    'temu': 2,
    'shein': 2,
    'amazon': 1,
    'sumaitong': 1
  };
  score += platformBonus[product.platform] || 0;

  return score;
}

// 去重（按goodsName相似度）
function deduplicate(products) {
  const unique = [];
  const seenNames = new Set();

  for (const product of products) {
    // 提取商品名称的核心词
    const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
    // 去除常见词，保留核心特征
    const coreName = name.replace(/\d+/g, '').replace(/\s+/g, ' ').trim().substring(0, 50);

    if (!seenNames.has(coreName)) {
      seenNames.add(coreName);
      unique.push(product);
    }
  }

  return unique;
}

// 筛选函数
function filterProducts(products) {
  // 1. 排除明显常规商品
  const filtered = products.filter(p => {
    const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();

    // 排除包含排除词的
    for (const exclude of excludeKeywords) {
      if (name.includes(exclude.toLowerCase())) return false;
    }

    // 至少要有一个特色词，或者销量评论数据优秀
    let hasInterestingKeyword = false;
    for (const keyword of interestingKeywords) {
      if (name.includes(keyword.toLowerCase())) {
        hasInterestingKeyword = true;
        break;
      }
    }

    // 有特色词，或者数据表现好
    return hasInterestingKeyword || (p.sold > 5000 && p.rating > 4.0);
  });

  // 2. 计算分数
  const scored = filtered.map(p => ({
    ...p,
    score: calculateScore(p)
  }));

  // 3. 按分数排序
  scored.sort((a, b) => b.score - a.score);

  // 4. 去重
  const deduplicated = deduplicate(scored);

  return deduplicated;
}

// 执行筛选
const filteredProducts = filterProducts(allProducts);

// 取前10个
const selectedProducts = filteredProducts.slice(0, 10);

console.log('='.repeat(60));
console.log('精选商品 TOP 10：');
console.log('='.repeat(60));

selectedProducts.forEach((p, i) => {
  console.log(`\n【${i + 1}】${p.goodsNameEn?.substring(0, 60)}...`);
  console.log(`    平台: ${p.platform} | 渠道: ${p.channel}`);
  console.log(`    销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`    价格: $${p.goodsPriceMin} - $${p.goodsPriceMax}`);
  console.log(`    特色分数: ${p.score}`);
});

// 保存筛选结果
const selectedResult = {
  date: today,
  timestamp: new Date().toISOString(),
  totalCandidates: allProducts.length,
  selectedCount: selectedProducts.length,
  products: selectedProducts.map((p, i) => ({
    rank: i + 1,
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    platform: p.platform,
    platformName: p.platformName,
    channel: p.channel,
    sold: p.sold,
    rating: p.rating,
    reviewNum: p.reviewNum,
    priceMin: p.goodsPriceMin,
    priceMax: p.goodsPriceMax,
    thumbnail: p.thumbnail,
    goodsId: p.goodsId,
    score: p.score,
    onSaleTime: p.onSaleTime
  }))
};

fs.writeFileSync(
  path.join(selectedDir, 'selected_20260504_v3.json'),
  JSON.stringify(selectedResult, null, 2)
);

console.log('\n' + '='.repeat(60));
console.log(`✓ 筛选完成，已保存 ${selectedProducts.length} 个精选商品`);
console.log('='.repeat(60));

module.exports = selectedResult;