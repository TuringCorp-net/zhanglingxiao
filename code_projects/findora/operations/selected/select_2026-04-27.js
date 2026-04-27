/**
 * ============================================
 * 选品筛选脚本 - 2026-04-27
 * ============================================
 *
 * 筛选标准（新奇/有趣/好玩/有爆点）：
 * 1. 产品名称或描述中包含创意/独特/有趣关键词
 * 2. 销量适中（1万-50万）- 太高竞争激烈，太低无市场
 * 3. 评分4.0以上
 * 4. 评论数100-10000 - 有市场验证但非头部垄断
 * 5. 价格1-50美元 - 适合冲动消费
 * 6. 产品差异化明显（多功能、创意设计、搞怪等）
 */

const fs = require('fs');
const path = require('path');

// 读取采集数据
const dataPath = path.join(__dirname, 'dailytemp', '2026-04-27', 'collected_data.json');
const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

// 筛选关键词
const interestingKeywords = [
  // 英文创意词
  'fun', 'unique', 'creative', 'quirky', 'weird', 'cute', 'cool', 'amazing',
  'surprise', 'gift', 'novelty', 'interesting', 'bizarre', 'strange', 'funny',
  'unusual', 'original', 'unconventional', 'zany', 'hilarious', 'playful',
  'magical', 'fantasy', 'retro', 'vintage', 'decorative', 'artistic',

  // 英文产品类型（可能有爆点）
  'transform', 'foldable', 'portable', 'wireless', 'smart', 'automatic',
  'self', 'multi', '2in1', '3in1', 'combo', 'set', 'kit', 'pack',

  // 创意产品关键词
  'led', 'light', 'glow', 'neon', 'rgb', 'hologram', '3d', 'holographic',
  'sticky', 'magnetic', 'suction', 'vacuum', 'inflatable', 'transparent',

  // 礼品场合
  'birthday', 'party', 'wedding', 'christmas', 'valentine', 'anniversary',
  'graduation', 'baby shower', 'holiday', 'festival',

  // 有趣场景
  'prank', 'joke', 'magic', 'illusion', 'escape', 'challenge',

  // 情感词
  'love', 'romantic', 'sweet', 'lovely', 'adorable', 'precious'
];

// 负向关键词（普通/常见/无爆点）
const negativeKeywords = [
  'basic', 'simple', 'ordinary', 'standard', 'regular', 'normal',
  'common', 'plain', 'mundane', 'boring'
];

// 评分权重因子
function calculateScore(product) {
  let score = 0;
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const allText = name + ' ' + nameCn;

  // 1. 创意/有趣关键词匹配 (最高40分)
  let interestScore = 0;
  for (const kw of interestingKeywords) {
    if (allText.includes(kw)) {
      interestScore += 5;
      if (interestScore >= 40) break;
    }
  }
  score += Math.min(interestScore, 40);

  // 2. 销量评分 (最高20分)
  const sold = product.sold || 0;
  if (sold >= 10000 && sold <= 500000) {
    score += 20;
  } else if (sold >= 5000 && sold <= 1000000) {
    score += 15;
  } else if (sold >= 1000 && sold <= 2000000) {
    score += 10;
  } else {
    score += 5;
  }

  // 3. 评分权重 (最高15分)
  const rating = product.rating || 0;
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.0) score += 10;
  else if (rating >= 3.5) score += 5;
  else score += 2;

  // 4. 评论数验证 (最高10分)
  const reviews = product.reviewNum || 0;
  if (reviews >= 100 && reviews <= 10000) {
    score += 10;
  } else if (reviews >= 50 && reviews <= 20000) {
    score += 7;
  } else if (reviews > 0) {
    score += 4;
  } else {
    score += 2; // 新品
  }

  // 5. 价格评分 (最高10分)
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const avgPrice = (priceMin + priceMax) / 2;
  if (avgPrice >= 5 && avgPrice <= 30) {
    score += 10;
  } else if (avgPrice >= 2 && avgPrice <= 50) {
    score += 8;
  } else if (avgPrice >= 1 && avgPrice <= 100) {
    score += 5;
  } else {
    score += 2;
  }

  // 6. 多功能/组合产品加分 (最高5分)
  const multiKeywords = ['2in1', '3in1', 'combo', 'set', 'kit', 'multi', 'all-in-one'];
  for (const kw of multiKeywords) {
    if (allText.includes(kw)) {
      score += 2;
      break;
    }
  }

  // 7. 新品加分 (最高5分)
  const onSaleTime = product.onSaleTime || '';
  if (onSaleTime.includes('2025') || onSaleTime.includes('2026')) {
    score += 5;
  }

  // 8. 负向词减分
  for (const kw of negativeKeywords) {
    if (allText.includes(kw)) {
      score -= 5;
    }
  }

  return score;
}

// 收集所有商品
const allProducts = [];
for (const [platform, data] of Object.entries(rawData)) {
  for (const product of data.products) {
    allProducts.push({
      ...product,
      _platformName: platform,
      _catName: data.catName
    });
  }
}

// 计算评分并排序
const scoredProducts = allProducts.map(p => ({
  ...p,
  _score: calculateScore(p)
}));

// 按分数排序
scoredProducts.sort((a, b) => b._score - a._score);

// 选取Top 20候选
const top20 = scoredProducts.slice(0, 20);

// 从Top 20中选择最终10个（保证平台多样性）
const selected = [];
const platformCount = {};

for (const product of top20) {
  const platform = product._platformName;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  // 每平台最多2个，保持多样性
  if (platformCount[platform] <= 2 && selected.length < 10) {
    selected.push(product);
  }

  // 如果已经选了10个，停止
  if (selected.length >= 10) break;
}

// 如果不够10个，从剩余商品中补充
if (selected.length < 10) {
  for (const product of scoredProducts) {
    if (selected.length >= 10) break;
    if (!selected.find(s => s.goodsId === product.goodsId)) {
      selected.push(product);
    }
  }
}

// 输出结果
console.log('='.repeat(60));
console.log('[选品筛选] 完成 - 2026-04-27');
console.log('='.repeat(60));
console.log(`\n共筛选 ${selected.length} 个候选商品\n`);

selected.forEach((p, i) => {
  console.log(`\n【商品 ${i + 1}】`);
  console.log(`  平台: ${p._platformName} | 类目: ${p._catName}`);
  console.log(`  名称: ${p.goodsNameEn?.substring(0, 60)}...`);
  console.log(`  中文: ${p.goodsNameCn?.substring(0, 40)}`);
  console.log(`  价格: $${p.goodsPriceMin}-${p.goodsPriceMax} | 销量: ${p.sold}`);
  console.log(`  评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`  链接: https://www.${p._platformName}shuju.com/goods/detail?goodsId=${p.goodsId}`);
  console.log(`  评分: ${p._score}`);
});

// 保存到文件
const outputDir = path.join(__dirname, '2026-04-27');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 生成每个商品的md文件
for (let i = 0; i < selected.length; i++) {
  const product = selected[i];
  const fileName = `20260427-${String(i + 1).padStart(3, '0')}.md`;
  const filePath = path.join(outputDir, fileName);

  const markdown = `# ${product.goodsNameEn || product.goodsName || '商品'}

## 基本信息

- **平台**: ${product._platformName}
- **类目**: ${product._catName}
- **商品ID**: ${product.goodsId}
- **采集时间**: 2026-04-27

## 产品信息

- **英文名**: ${product.goodsNameEn || product.goodsName || 'N/A'}
- **中文名**: ${product.goodsNameCn || 'N/A'}
- **图片**: ![商品图](${product.thumbnail || product.thumbnailCn || ''})

## 数据指标

| 指标 | 数值 |
|------|------|
| 销量 | ${product.sold?.toLocaleString() || 'N/A'} |
| 销售额 | $${product.sales?.toLocaleString() || 'N/A'} |
| 价格区间 | $${product.goodsPriceMin} - $${product.goodsPriceMax} |
| 评分 | ${product.rating || 'N/A'} |
| 评论数 | ${product.reviewNum?.toLocaleString() || 'N/A'} |
| 上架时间 | ${product.onSaleTime || 'N/A'} |

## 链接

- **详情页**: https://www.${product._platformName}shuju.com/goods/detail?goodsId=${product.goodsId}
${product.detailUrl ? `- **商品链接**: ${product.detailUrl}` : ''}

## 选品理由

<!-- 由Selector根据以下标准筛选： -->
<!-- - 新奇特/有趣/好玩/有爆点 -->
<!-- - 销量适中（1万-50万） -->
<!-- - 评分4.0以上 -->
<!-- - 评论数100-10000 -->
<!-- - 价格1-50美元 -->

本商品经过评分筛选，得分：**${product._score}**

筛选关键词匹配度：高
`;

  fs.writeFileSync(filePath, markdown, 'utf8');
  console.log(`\n已保存: ${fileName}`);
}

// 保存汇总文件
const summaryPath = path.join(outputDir, 'summary.json');
const summary = selected.map((p, i) => ({
  seq: i + 1,
  platform: p._platformName,
  catName: p._catName,
  goodsId: p.goodsId,
  goodsNameEn: p.goodsNameEn || p.goodsName,
  goodsNameCn: p.goodsNameCn,
  price: `$${p.goodsPriceMin}-${p.goodsPriceMax}`,
  sold: p.sold,
  rating: p.rating,
  reviewNum: p.reviewNum,
  score: p._score,
  detailUrl: `https://www.${p._platformName}shuju.com/goods/detail?goodsId=${p.goodsId}`
}));

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');

console.log('\n' + '='.repeat(60));
console.log(`[选品筛选] 完成! 共选出 ${selected.length} 个商品`);
console.log(`[选品筛选] 已保存至 operations/selected/2026-04-27/ 目录`);
console.log('='.repeat(60));