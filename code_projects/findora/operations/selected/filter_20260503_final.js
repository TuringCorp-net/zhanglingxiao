/**
 * ============================================
 * 选品筛选器 - 2026-05-03
 * ============================================
 *
 * 筛选标准：新奇、有趣、好玩、有爆点
 * 目标：选出 10 个优质商品
 */

const fs = require('fs');
const path = require('path');

const TODAY = '2026-05-03';
const OUTPUT_DIR = path.join(__dirname, 'dailytemp', TODAY);

// 关键词评分表 - 用于识别有趣/新奇商品
const KEYWORDS = {
  // 高分词：有趣/新奇
  positive: [
    'funny', 'unique', 'creative', 'novelty', 'quirky', 'weird', 'cool', 'cute',
    'amazing', 'awesome', 'magic', 'smart', 'innovative', 'crazy', 'surprise',
    'gift', 'decor', 'led', 'light', 'colorful', 'crystal', 'floral', 'vintage',
    'retro', 'cute', 'lovely', 'beautiful', 'mini', 'portable', 'portable', 'wireless',
    'bluetooth', 'usb', 'charging', 'fast', 'power', 'battery', 'solar'
  ],
  // 扣分词：普通/无趣
  negative: [
    'generic', 'plain', 'basic', 'ordinary', 'standard', 'simple', 'boring'
  ]
};

/**
 * 评估商品吸引力分数
 */
function scoreProduct(product) {
  let score = 0;
  const name = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = name + ' ' + nameCn;

  // 销量加分（相对值）
  const sold = product.sold || 0;
  if (sold > 10000) score += 15;
  else if (sold > 5000) score += 10;
  else if (sold > 1000) score += 7;
  else if (sold > 100) score += 4;

  // 评论数加分
  const reviewNum = product.reviewNum || 0;
  if (reviewNum > 500) score += 6;
  else if (reviewNum > 100) score += 4;
  else if (reviewNum > 10) score += 2;

  // 评分加分
  const rating = product.rating || 0;
  if (rating >= 4.8) score += 4;
  else if (rating >= 4.5) score += 3;
  else if (rating >= 4.0) score += 1;

  // 正向关键词加分 - 新奇有趣类
  const noveltyKeywords = [
    'funny', 'unique', 'creative', 'novelty', 'quirky', 'weird', 'cool', 'cute',
    'amazing', 'magic', 'smart', 'innovative', 'crazy', 'surprise', 'mini', 'portable',
    'led', 'light', 'crystal', 'floral', 'vintage', 'retro', 'lovely', 'beautiful',
    'wireless', 'bluetooth', 'solar', 'transformer', 'robot', 'gaming', 'toy', 'game',
    'decor', 'gift', 'party', 'holiday', 'christmas', 'halloween', 'festival',
    '3d', 'hologram', 'laser', 'voice', 'sensor', 'automatic', 'smart', 'eco'
  ];

  for (const kw of noveltyKeywords) {
    if (fullName.includes(kw)) score += 3;
  }

  // 扣分词：普通/无趣/过于常见
  const negativeKeywords = [
    'generic', 'plain', 'basic', 'ordinary', 'standard', 'simple', 'boring',
    'normal', 'regular', 'common'
  ];

  for (const kw of negativeKeywords) {
    if (fullName.includes(kw)) score -= 3;
  }

  // 价格适中加分（有趣商品通常价格不会太低或太高）
  const priceMin = product.goodsPriceMin || 0;
  if (priceMin >= 5 && priceMin < 100) score += 3;
  else if (priceMin >= 1 && priceMin < 5) score += 1;
  else if (priceMin >= 100 && priceMin < 300) score += 1;

  // 有图片加分
  if (product.thumbnail) score += 1;

  // 上架时间新鲜度加分（新品更有潜力）
  if (product.onSaleTime) {
    const saleDate = new Date(product.onSaleTime);
    const daysSinceSale = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceSale < 30) score += 4;
    else if (daysSinceSale < 90) score += 2;
    else if (daysSinceSale > 365) score -= 2;
  }

  return score;
}

/**
 * 计算商品相似度（用于去重）
 */
function similarity(p1, p2) {
  const name1 = (p1.goodsNameEn || '').toLowerCase();
  const name2 = (p2.goodsNameEn || '').toLowerCase();

  // 简单检查：名字前30个字符是否相同
  if (name1.substring(0, 30) === name2.substring(0, 30)) return 1.0;

  // 检查关键词重叠
  const words1 = new Set(name1.split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(name2.split(/\s+/).filter(w => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  let overlap = 0;
  for (const w of words1) {
    if (words2.has(w)) overlap++;
  }

  return overlap / Math.max(words1.size, words2.size);
}

/**
 * 格式化商品信息用于展示
 */
function formatProduct(product, index) {
  return {
    no: index,
    platform: product._platform || product.platform,
    catName: product._catName || '',
    channel: product._channel || '',
    goodsId: product.goodsId,
    goodsNameEn: product.goodsNameEn,
    goodsNameCn: product.goodsNameCn,
    price: `$${product.goodsPriceMin || '?'} - $${product.goodsPriceMax || '?'}`,
    sold: formatSold(product.sold),
    reviewNum: product.reviewNum || 0,
    rating: product.rating || 0,
    thumbnail: product.thumbnail,
    onSaleTime: product.onSaleTime,
    score: product._score || 0
  };
}

/**
 * 格式化销量数字
 */
function formatSold(sold) {
  if (!sold && sold !== 0) return 'N/A';
  if (sold >= 10000) return `${(sold / 10000).toFixed(1)}万`;
  if (sold >= 1000) return `${(sold / 1000).toFixed(1)}k`;
  return sold.toString();
}

/**
 * 生成商品 markdown 内容
 */
function generateMarkdown(product, no) {
  const id = `${TODAY.replace(/-/g, '')}-${String(no).padStart(3, '0')}`;

  return `---
id: ${id}
platform: ${product.platform}
category: ${product._catName || product.catName || 'N/A'}
channel: ${product._channel || 'N/A'}
crawlDate: ${TODAY}
score: ${product._score || 0}
---

# ${product.goodsNameEn || 'Untitled'}

${product.goodsNameCn || ''}

## 基本信息

| 属性 | 值 |
|------|-----|
| 平台 | ${product.platform} |
| 类目 | ${product._catName || 'N/A'} |
| 渠道 | ${product._channel || 'N/A'} |
| 商品ID | ${product.goodsId || 'N/A'} |
| 上架时间 | ${product.onSaleTime ? new Date(product.onSaleTime).toLocaleDateString() : 'N/A'} |

## 销售数据

| 指标 | 值 |
|------|-----|
| 价格 | $${product.goodsPriceMin || '?'} - $${product.goodsPriceMax || '?'} |
| 销量 | ${formatSold(product.sold)} |
| 评论数 | ${product.reviewNum || 0} |
| 评分 | ${product.rating || 'N/A'} |

## 图片

${product.thumbnail ? `![商品图片](${product.thumbnail})` : '(无图片)'}

## 链接

${product.detailUrl ? `[查看商品](${product.detailUrl})` : '(无链接)'}

---
*由 Selector 自动筛选生成 | ${new Date().toISOString()}*
`;
}

/**
 * 主筛选函数
 */
async function filter() {
  console.log('='.repeat(50));
  console.log(`选品筛选开始 - ${TODAY}`);
  console.log('='.repeat(50));

  // 读取原始数据
  const rawDataPath = path.join(OUTPUT_DIR, 'raw_products.json');
  let products = [];

  if (fs.existsSync(rawDataPath)) {
    const data = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));
    products = data.products || [];
    console.log(`从文件加载: ${products.length} 个商品`);
  } else {
    console.log('未找到原始数据文件');
    return;
  }

  // 评分
  console.log('\n开始评分...');
  products.forEach(p => {
    p._score = scoreProduct(p);
  });

  // 按分数排序
  products.sort((a, b) => b._score - a._score);

  console.log('\n评分完成！Top 20 商品：');
  products.slice(0, 20).forEach((p, i) => {
    console.log(`${i+1}. [${p.platform}] ${p._score}分 - ${p.goodsNameEn?.substring(0, 40)}`);
  });

  // 去重 + 选取 Top 10（不同平台/不同商品）
  const selected = [];
  const MAX_SIMILARITY = 0.7; // 相似度阈值

  for (const p of products) {
    if (selected.length >= 10) break;

    // 检查是否与已选商品过于相似
    let tooSimilar = false;
    for (const selectedP of selected) {
      if (similarity(p, selectedP) > MAX_SIMILARITY) {
        tooSimilar = true;
        break;
      }
    }

    if (!tooSimilar) {
      selected.push(p);
    }
  }

  console.log('\n去重后选取 10 个商品：');
  selected.forEach((p, i) => {
    console.log(`${i+1}. [${p.platform}] ${p._score}分 - ${p.goodsNameEn?.substring(0, 40)}`);
  });

  // 生成 markdown 文件
  console.log('\n生成 markdown 文件...');
  const selectedDir = path.join(__dirname);

  for (let i = 0; i < selected.length; i++) {
    const product = selected[i];
    const no = i + 1;
    const id = `${TODAY.replace(/-/g, '')}-${String(no).padStart(3, '0')}`;
    const filename = `${id}.md`;
    const filepath = path.join(selectedDir, filename);

    const content = generateMarkdown(product, no);
    fs.writeFileSync(filepath, content, 'utf-8');
    console.log(`✓ ${filename}: ${product.goodsNameEn?.substring(0, 30)}...`);
  }

  // 保存选中商品JSON
  const selectedJson = {
    date: TODAY,
    total: selected.length,
    products: selected.map((p, i) => formatProduct(p, i + 1))
  };
  fs.writeFileSync(
    path.join(selectedDir, `selected_${TODAY.replace(/-/g, '')}.json`),
    JSON.stringify(selectedJson, null, 2),
    'utf-8'
  );

  // 生成筛选报告
  const report = `# 选品筛选报告 - ${TODAY}

## 概述

- 采集来源：5平台 × 4渠道 × Top10 = 200个商品
- 筛选标准：新奇、有趣、好玩、有爆点
- 入选数量：10个

## 入选商品

${selected.map((p, i) => `
### ${i + 1}. ${p.goodsNameEn?.substring(0, 50)}
- 平台：${p.platform}
- 类目：${p._catName}
- 渠道：${p._channel}
- 价格：$${p.goodsPriceMin} - $${p.goodsPriceMax}
- 销量：${formatSold(p.sold)}
- 评分：${p._score}分
`).join('\n')}

---
*Generated by Selector - ${new Date().toISOString()}*
`;

  fs.writeFileSync(
    path.join(selectedDir, `selection_report_${TODAY}.md`),
    report,
    'utf-8'
  );

  console.log('\n' + '='.repeat(50));
  console.log('筛选完成！');
  console.log(`结果保存至: ${selectedDir}`);
  console.log('='.repeat(50));

  return selected;
}

// 执行
if (require.main === module) {
  filter().catch(console.error);
}

module.exports = { filter, scoreProduct };