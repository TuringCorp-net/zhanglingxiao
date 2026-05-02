/**
 * 选品筛选脚本 - 2026-05-02 (v2)
 *
 * 筛选标准：
 * 1. 新奇/有趣/好玩/有爆点
 * 2. 避免过于普通的大众商品
 * 3. 考虑销量、评分、上架时间等因素
 * 4. 去重：同款商品只选一次
 */

const fs = require('fs');
const path = require('path');

const findoraRoot = path.resolve(__dirname, '../..');
const rawDataPath = path.join(findoraRoot, 'operations/selected/dailytemp/2026-05-02/raw_products.json');
const outputDir = path.join(findoraRoot, 'operations/selected');

// 加载原始数据
const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));
let products = rawData.products;

console.log('='.repeat(60));
console.log('[筛选] 开始筛选精选商品');
console.log(`[筛选] 待筛选商品数量: ${products.length}`);
console.log('='.repeat(60));

// ============ 筛选逻辑 ============

/**
 * 计算商品"有趣度"评分
 */
function calculateFunScore(product) {
  let score = 0;
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();

  // 趣味关键词加分
  const funKeywords = [
    'fun', 'cute', 'adorable', 'creative', 'unique', 'interesting',
    'playful', 'quirky', 'whimsical', 'bizarre', 'funny',
    'cool', 'awesome', 'amazing', 'crazy', 'weird', 'special', 'new'
  ];
  for (const kw of funKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 15;
    }
  }

  // 宠物类趣味产品加分
  const petFunKeywords = [
    'calming', 'raincoat', 'costume', 'halloween', 'christmas', 'party',
    'dress up', 'outfit', 'accessories', 'toy', 'bed', 'house', 'cushion',
    'wedding', 'puffy', 'teething', 'portable water', 'water bottle'
  ];
  for (const kw of petFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 12;
    }
  }

  // 家用电器类趣味产品加分
  const applianceFunKeywords = [
    'smart', 'automatic', 'led', 'usb', 'mini', 'portable', 'compact',
    'rechargeable', 'bladeless', 'clip', 'hanging', 'neck', '3-in-1', '2-in-1'
  ];
  for (const kw of applianceFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 12;
    }
  }

  // 服饰类趣味产品加分
  const fashionFunKeywords = [
    'trendy', 'vintage', 'boho', 'minimalist', 'statement', 'layered',
    'stacked', 'layering', 'choker', 'bracelet', 'necklace', 'earring',
    'trendy', 'vintage', 'boho'
  ];
  for (const kw of fashionFunKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 10;
    }
  }

  // 销量加权（销量高但不过于大众）
  const sold = product.sold || 0;
  if (sold >= 100 && sold < 5000) {
    score += 15;  // 中等销量
  } else if (sold >= 50 && sold < 100) {
    score += 20;  // 较低销量，可能是新品或细分市场
  } else if (sold >= 10 && sold < 50) {
    score += 25;  // 极低销量，可能是新上架的有趣产品
  }

  // 评分加权
  const rating = product.rating || 0;
  if (rating >= 4.0 && rating < 4.5) {
    score += 8;
  } else if (rating >= 4.5 && rating < 4.8) {
    score += 5;
  } else if (rating >= 4.8) {
    score += 3;
  }

  // 评论数适中加分
  const reviewNum = product.reviewNum || 0;
  if (reviewNum >= 5 && reviewNum < 50) {
    score += 12;
  } else if (reviewNum >= 1 && reviewNum < 5) {
    score += 8;
  }

  // 上架时间：越新越有爆点潜力
  const onSaleTime = product.onSaleTime || product.mallOpenTime || '';
  if (onSaleTime) {
    const saleDate = new Date(onSaleTime);
    const daysAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo <= 7) {
      score += 18;
    } else if (daysAgo <= 14) {
      score += 12;
    } else if (daysAgo <= 21) {
      score += 8;
    }
  }

  // 价格因素
  const priceMin = product.goodsPriceMin || 0;
  if (priceMin >= 3 && priceMin <= 30) {
    score += 8;
  }

  // 排除过于普通的商品
  const boringKeywords = ['basic', 'simple standard', 'ordinary generic', 'plain', 'common regular'];
  for (const kw of boringKeywords) {
    if (name.includes(kw)) {
      score -= 15;
    }
  }

  return score;
}

// 去重：根据 goodsId 或商品名称去重
function deduplicate(arr) {
  const seen = new Set();
  return arr.filter(p => {
    const key = p.goodsId || (p.goodsNameEn || p.goodsName || '').substring(0, 50);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// 对每个商品计算有趣度评分
const scoredProducts = products.map((p, index) => ({
  ...p,
  _index: index,
  funScore: calculateFunScore(p)
}));

// 去重
const deduplicatedProducts = deduplicate(scoredProducts);
console.log(`\n[筛选] 去重后商品数量: ${deduplicatedProducts.length}`);

// 按有趣度评分排序
deduplicatedProducts.sort((a, b) => b.funScore - a.funScore);

// 选取前12个进入候选名单（多选几个确保有10个可选）
const candidates = deduplicatedProducts.slice(0, 12);

// 输出候选商品供审核
console.log('\n[筛选] 候选商品（按有趣度评分排序）：');
candidates.forEach((p, i) => {
  console.log(`\n${i + 1}. [${p.platform}] ${p.platformCatName} - ${p.channel}`);
  console.log(`   名称: ${(p.goodsNameEn || p.goodsName || 'N/A').substring(0, 70)}...`);
  console.log(`   价格: $${p.goodsPriceMin} | 销量: ${p.sold} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
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

console.log('\n' + '='.repeat(60));
console.log('[筛选] 最终入选商品：');
selectedWithIds.forEach((p, i) => {
  console.log(`${i + 1}. ${p.selectionId} [${p.platform}] - ${(p.goodsNameEn || p.goodsName || '').substring(0, 50)}...`);
});
console.log('='.repeat(60));

// ============ 生成 Markdown 文档 ============
const mdDir = path.join(outputDir, today);
if (!fs.existsSync(mdDir)) {
  fs.mkdirSync(mdDir, { recursive: true });
}

selectedWithIds.forEach(p => {
  const mdContent = `---
selectionId: ${p.selectionId}
platform: ${p.platform}
platformCatName: ${p.platformCatName}
channel: ${p.channel}
crawlDate: ${rawData.crawlDate}
---

# ${p.selectionId} - ${p.platformCatName}

## 商品信息

| 字段 | 值 |
|------|-----|
| 平台 | ${p.platform} |
| 类目 | ${p.platformCatName} |
| 子渠道 | ${p.channel} |
| 编号 | ${p.selectionId} |

## 基本数据

- **商品名称（英文）**: ${p.goodsNameEn || p.goodsName || 'N/A'}
- **商品名称（中文）**: ${p.goodsNameCn || 'N/A'}
- **价格区间**: $${p.goodsPriceMin} ~ $${p.goodsPriceMax || p.goodsPriceMin}
- **销量**: ${p.sold}
- **评分**: ${p.rating || 'N/A'}
- **评论数**: ${p.reviewNum}
- **上架时间**: ${p.onSaleTime || p.mallOpenTime || 'N/A'}

## 销售数据

- **销售额**: $${p.sales || 'N/A'}
- **有趣度评分**: ${p.funScore}

## 链接

- **商品ID**: ${p.goodsId}
- **图片**: ${p.thumbnail}

## 选品理由

（由 Curator 填写）
`;

  const mdPath = path.join(mdDir, `${p.selectionId}.md`);
  fs.writeFileSync(mdPath, mdContent);
  console.log(`[文档] 已生成: ${mdPath}`);
});

// 保存 JSON 结果
const selectionJsonPath = path.join(mdDir, 'selected.json');
const selectionResult = {
  crawlDate: rawData.crawlDate,
  filterDate: new Date().toISOString(),
  totalProducts: products.length,
  deduplicatedProducts: deduplicatedProducts.length,
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

fs.writeFileSync(selectionJsonPath, JSON.stringify(selectionResult, null, 2));
console.log(`\n[结果] JSON结果已保存: ${selectionJsonPath}`);

console.log('\n' + '='.repeat(60));
console.log('[筛选] 筛选完成！');
console.log(`[筛选] 精选商品数量: ${selectedWithIds.length}`);
console.log(`[筛选] 文档目录: ${mdDir}`);
console.log('='.repeat(60));

module.exports = selectedWithIds;
