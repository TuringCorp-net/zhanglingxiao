/**
 * 选品筛选脚本 - 2026-05-02 下午场
 *
 * 筛选标准（新奇/有趣/好玩/有爆点）：
 * 1. 商品名称独特、有记忆点
 * 2. 销量适中（不要太低说明是垃圾，太高可能是红海）
 * 3. 评论数适中（说明有市场验证）
 * 4. 价格合理（有一定利润空间）
 * 5. 避免同质化严重的普通商品
 */

const fs = require('fs');

// 读取原始数据
const rawProducts = JSON.parse(fs.readFileSync('./operations/selected/dailytemp/2026-05-02/raw_products.json', 'utf-8'));

console.log('========================================');
console.log('选品筛选开始 - 2026-05-02 下午场');
console.log(`待筛选商品: ${rawProducts.length}`);
console.log('========================================\n');

// 评分函数：根据多维度给商品打分
function scoreProduct(p) {
  let score = 0;

  // 1. 销量评估（30分）
  // 希望销量在500-50000之间（有一定销量但不是完全红海）
  const sold = p.sold || 0;
  if (sold >= 500 && sold <= 50000) {
    score += 30;
  } else if (sold > 100 && sold < 500) {
    score += 20;
  } else if (sold > 50000) {
    score += 15; // 太高可能是红海
  } else {
    score += 5;
  }

  // 2. 评论数评估（20分）
  const reviews = p.reviewNum || 0;
  if (reviews >= 50 && reviews <= 2000) {
    score += 20;
  } else if (reviews > 10 && reviews < 50) {
    score += 15;
  } else if (reviews > 2000) {
    score += 10;
  }

  // 3. 评分评估（15分）
  const rating = p.rating || 0;
  if (rating >= 4.3 && rating <= 4.8) {
    score += 15;
  } else if (rating > 4.8) {
    score += 10; // 太高可能刷单
  } else if (rating >= 4.0) {
    score += 12;
  }

  // 4. 价格评估（20分）
  // 希望价格在8-50美元，有利润空间
  const price = p.goodsPriceMin || 0;
  if (price >= 8 && price <= 50) {
    score += 20;
  } else if (price > 3 && price < 8) {
    score += 15;
  } else if (price > 50 && price <= 100) {
    score += 12;
  }

  // 5. 商品名称独特性评估（15分）
  const name = (p.goodsNameEn || '').toLowerCase();
  const cnName = (p.goodsNameCn || '').toLowerCase();

  // 关键词加成：有特色、有趣味的词汇
  const bonusKeywords = [
    'unique', 'fun', 'cute', 'funny', 'novelty', 'quirky', 'creative', 'interesting',
    'cool', 'weird', 'unusual', 'creative', 'gadget', 'innovative', 'surprise',
    'gift', 'decor', 'home', 'kitchen', 'party', 'holiday', 'kids', 'pet',
    'led', 'light', 'smart', 'mini', 'portable', 'foldable', 'adjustable'
  ];

  const nameFull = name + ' ' + cnName;
  let bonusCount = 0;
  bonusKeywords.forEach(kw => {
    if (nameFull.includes(kw)) bonusCount++;
  });
  score += Math.min(15, bonusCount * 3);

  // 6. 惩罚项
  // 太普通的商品（如通用充电器、数据线等）
  const penaltyKeywords = ['generic', 'standard', 'basic', 'plain', 'simple'];
  penaltyKeywords.forEach(kw => {
    if (nameFull.includes(kw)) score -= 10;
  });

  return score;
}

// 对商品进行评分
const scoredProducts = rawProducts.map(p => ({
  ...p,
  score: scoreProduct(p)
}));

// 按平台去重：同一平台的相似商品只保留得分最高的
function deduplicate(products) {
  const seen = new Map();

  products.forEach(p => {
    // 用商品名称前30字符作为去重key
    const key = `${p.platform}-${(p.goodsNameEn || '').substring(0, 30).toLowerCase()}`;

    if (!seen.has(key) || seen.get(key).score < p.score) {
      seen.set(key, p);
    }
  });

  return Array.from(seen.values());
}

const deduplicated = deduplicate(scoredProducts);
console.log(`去重后商品: ${deduplicated.length}`);

// 按评分排序
deduplicated.sort((a, b) => b.score - a.score);

// 选取Top 15进入候选池
const candidates = deduplicated.slice(0, 15);

console.log('\n候选商品 Top 15:');
console.log('-'.repeat(80));
candidates.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.goodsNameEn?.substring(0, 50)}...`);
  console.log(`   价格: $${p.goodsPriceMin}-${p.goodsPriceMax} | 销量: ${p.sold} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
  console.log(`   得分: ${p.score}`);
  console.log('');
});

// 从候选池中精选10个（确保平台均衡）
function selectTop10(candidates) {
  const selected = [];
  const platformCount = {};

  // 优先选择不同平台的商品
  for (const p of candidates) {
    if (selected.length >= 10) break;

    const platform = p.platform;
    const count = platformCount[platform] || 0;

    // 每个平台最多选3个
    if (count < 3) {
      selected.push(p);
      platformCount[platform] = count + 1;
    }
  }

  // 如果不够10个，补充其他候选
  if (selected.length < 10) {
    for (const p of candidates) {
      if (selected.length >= 10) break;
      if (!selected.includes(p)) {
        selected.push(p);
      }
    }
  }

  return selected;
}

const finalSelected = selectTop10(candidates);

console.log('\n========================================');
console.log('最终精选 Top 10:');
console.log('========================================');
finalSelected.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${p.goodsNameEn?.substring(0, 60)}`);
  console.log(`   价格: $${p.goodsPriceMin}-${p.goodsPriceMax} | 销量: ${p.sold} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
});

// 保存精选结果
const outputDir = './operations/selected/dailytemp/2026-05-02';
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

fs.writeFileSync(`${outputDir}/selected.json`, JSON.stringify(finalSelected, null, 2), 'utf-8');
console.log(`\n精选结果已保存至: ${outputDir}/selected.json`);

module.exports = finalSelected;