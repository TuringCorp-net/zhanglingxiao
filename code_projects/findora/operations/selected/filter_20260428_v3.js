/**
 * 选品筛选脚本 - 2026-04-28
 *
 * 从 raw_products.json 读取采集数据，按"新奇/有趣/好玩/有爆点"筛选10个商品
 */

const fs = require('fs');
const path = require('path');

// 读取原始数据
const dataPath = path.join(__dirname, 'dailytemp/2026-04-28/raw_products.json');
console.log('读取数据:', dataPath);

const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
// 原始数据可能是数组或 {products: [...]} 对象
const products = Array.isArray(rawData) ? rawData : (rawData.products || []);

console.log(`\n原始商品数: ${products.length}`);
console.log(`各平台分布:`);

const byPlatform = {};
products.forEach(p => {
  const platform = p.platform || 'unknown';
  if (!byPlatform[platform]) byPlatform[platform] = 0;
  byPlatform[platform]++;
});
for (const [platform, count] of Object.entries(byPlatform)) {
  console.log(`  ${platform}: ${count} 个`);
}

// ================================
// 选品标准（根据 selector 角色要求）
// ================================
// 1. 新奇 - 市场上少见的创意产品
// 2. 有趣 - 让人眼前一亮的产品
// 3. 好玩 - 有娱乐属性或互动性
// 4. 有爆点 - 有话题性、社交媒体传播潜力
//
// 筛选维度：
// - 商品名称（英文优先，中文参考）
// - 价格区间（$5-$50 最佳，太便宜没利润，太贵转化低）
// - 评论数（100-5000 中等评论数，说明是新品或中等产品）
// - 评分（4.0+）
// - 销量（中等销量，避免过饱和）

// 兴趣关键词（新奇特产品特征词）
const INTEREST_KEYWORDS = [
  // 有趣/搞怪
  'funny', 'quirky', 'unique', 'weird', 'cute', 'novelty', 'weird', 'bizarre',
  '趣味', '搞怪', '创意', '新奇', '有趣', '可爱', '独特',
  // 实用创意
  'multi-function', '2-in-1', '3-in-1', 'all-in-one', 'portable', 'foldable', 'compact',
  '多功能', '便携', '折叠', '迷你', '小型',
  // 装饰/礼品
  'decor', 'gift', 'party', 'holiday', 'christmas', 'halloween', 'birthday',
  '装饰', '礼品', '派对', '节日', '礼物',
  // 科技感
  'smart', 'led', 'rgb', 'wireless', 'bluetooth', 'rechargeable', 'automatic',
  '智能', 'LED', '无线', '蓝牙', '自动',
  // 家居生活
  'kitchen', 'bedroom', 'bathroom', 'office', 'storage', 'organizer',
  '厨房', '卧室', '浴室', '办公', '收纳', '整理',
  // 户外/旅行
  'outdoor', 'camping', 'travel', 'hiking', 'backpack', 'portable',
  '户外', '露营', '旅行', '便携',
  // 宠物/儿童
  'pet', 'dog', 'cat', 'kids', 'children', 'baby', 'toys',
  '宠物', '狗', '猫', '儿童', '宝宝', '玩具'
];

// 排除关键词（红海/过饱和类目）
const EXCLUDE_KEYWORDS = [
  'cable', 'case', 'cover', 'protector', 'charger', 'adapter',
  '数据线', '手机壳', '保护套', '充电器', '适配器',
  'generic', 'basic', 'standard', 'simple',
  '普通', '基础', '标准', '简单'
];

function scoreProduct(p) {
  let score = 0;
  const name = ((p.goodsNameEn || '') + ' ' + (p.goodsNameCn || '')).toLowerCase();

  // 1. 兴趣关键词匹配 (+10分/个)
  for (const kw of INTEREST_KEYWORDS) {
    if (name.includes(kw.toLowerCase())) {
      score += 10;
    }
  }

  // 2. 排除关键词 (-20分/个)
  for (const kw of EXCLUDE_KEYWORDS) {
    if (name.includes(kw.toLowerCase())) {
      score -= 20;
    }
  }

  // 3. 价格区间加分 ($5-$50 最佳)
  const price = p.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) {
    score += 15;
  } else if (price > 0 && price < 5) {
    score += 5;
  } else if (price > 50 && price <= 100) {
    score += 8;
  }

  // 4. 评论数适中加分 (100-5000)
  const reviews = p.reviewNum || 0;
  if (reviews >= 100 && reviews <= 5000) {
    score += 15;
  } else if (reviews > 0 && reviews < 100) {
    score += 10; // 新品加分
  } else if (reviews > 5000 && reviews <= 20000) {
    score += 5;
  }

  // 5. 评分加分 (4.0+)
  const rating = p.rating || 0;
  if (rating >= 4.5) {
    score += 10;
  } else if (rating >= 4.0) {
    score += 5;
  }

  // 6. 销量适中加分（避免过饱和和太冷门）
  const sold = p.sold || 0;
  if (sold >= 500 && sold <= 50000) {
    score += 10;
  } else if (sold > 0 && sold < 500) {
    score += 8; // 潜力新品
  } else if (sold > 50000 && sold <= 200000) {
    score += 3;
  }

  // 7. 图片质量加分（有缩略图）
  if (p.thumbnail && p.thumbnail.length > 0) {
    score += 5;
  }

  return score;
}

// 评分并排序
console.log('\n开始评分筛选...\n');

const scored = products.map((p, idx) => ({
  ...p,
  _score: scoreProduct(p),
  _index: idx
}));

// 按分数排序
scored.sort((a, b) => b._score - a._score);

// 显示前20名评分详情
console.log('===== 评分前20名 =====');
for (let i = 0; i < Math.min(20, scored.length); i++) {
  const p = scored[i];
  console.log(`${i + 1}. [${p.platform}] 评分:${p._score} 销量:${p.sold} 评论:${p.reviewNum} 价格:$${p.goodsPriceMin}-$${p.goodsPriceMax}`);
  console.log(`   ${(p.goodsNameEn || 'N/A').substring(0, 80)}...`);
}

// 选取前10名
const selected = scored.slice(0, 10);

// 生成选品报告
const today = '2026-04-28';
const reportPath = path.join(__dirname, '20260428_selector_report.md');

let report = `# 选品报告 - ${today}

## 采集概况

- **采集平台**: Temu, Shein, Amazon, 速卖通, TikTok
- **采集类目**: 视频游戏(Temu), 宝贝儿(Shein), 工业类(Amazon), 电话和通讯(速卖通), Home Supplies(TikTok)
- **原始商品数**: ${products.length}
- **筛选标准**: 新奇/有趣/好玩/有爆点
- **入选商品**: ${selected.length} 个

## 选品理由

| 排名 | 平台 | 商品名称 | 评分 | 销量 | 价格 | 入选理由 |
|------|------|----------|------|------|------|----------|
`;

// 添加入选商品详情
const selectedProducts = [];
for (let i = 0; i < selected.length; i++) {
  const p = selected[i];

  // 生成唯一编号: C20260428-001 ~ C20260428-010
  const productId = `C${today.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;

  // 构建入选理由
  let reason = [];
  if (p._score >= 50) reason.push('高评分优质商品');
  if (p.reviewNum > 0 && p.reviewNum <= 500) reason.push('潜力新品');
  if (p.sold > 500 && p.sold <= 50000) reason.push('适中销量');
  if (p.goodsPriceMin >= 5 && p.goodsPriceMax <= 50) reason.push('价格区间佳');
  if (p.rating >= 4.5) reason.push('高评分');

  report += `| ${i + 1} | ${p.platform} | ${(p.goodsNameEn || 'N/A').substring(0, 40)} | ${p._score} | ${p.sold} | $${p.goodsPriceMin}-$${p.goodsPriceMax} | ${reason.join(', ')} |\n`;

  selectedProducts.push({
    id: productId,
    platform: p.platform,
    goodsId: p.goodsId,
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    thumbnail: p.thumbnail,
    thumbnailCn: p.thumbnailCn,
    sold: p.sold,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    reviewNum: p.reviewNum,
    rating: p.rating,
    score: p._score,
    catName: p.catName,
    catId: p.catId,
    onSaleTime: p.onSaleTime
  });
}

report += `
## 商品详情

`;
for (let i = 0; i < selectedProducts.length; i++) {
  const p = selectedProducts[i];
  report += `### ${i + 1}. ${p.goodsNameEn || 'N/A'}

- **商品ID**: ${p.id}
- **平台**: ${p.platform}
- **类目**: ${p.catName}
- **价格**: $${p.goodsPriceMin} - $${p.goodsPriceMax}
- **销量**: ${p.sold}
- **评论数**: ${p.reviewNum}
- **评分**: ${p.rating}
- **上架时间**: ${p.onSaleTime || 'N/A'}
- **缩略图**: ${p.thumbnail || 'N/A'}
- **商品链接**: ${p.goodsId ? `https://www.${p.platform}.com/item/${p.goodsId}.html` : 'N/A'}

`;
}

// 保存报告
fs.writeFileSync(reportPath, report, 'utf-8');
console.log(`\n选品报告已保存: ${reportPath}`);

// 保存选中的商品JSON
const selectedJsonPath = path.join(__dirname, 'selected_20260428_v3.json');
fs.writeFileSync(selectedJsonPath, JSON.stringify({
  date: today,
  totalCount: selectedProducts.length,
  products: selectedProducts
}, null, 2), 'utf-8');
console.log(`选中商品JSON已保存: ${selectedJsonPath}`);

// 同步到 dailytemp
const dailytempDir = path.join(__dirname, 'dailytemp', today);
if (!fs.existsSync(dailytempDir)) {
  fs.mkdirSync(dailytempDir, { recursive: true });
}
fs.writeFileSync(path.join(dailytempDir, 'selected.json'), JSON.stringify({
  date: today,
  totalCount: selectedProducts.length,
  products: selectedProducts
}, null, 2), 'utf-8');
console.log(`同步保存: ${path.join(dailytempDir, 'selected.json')}`);

// 生成每个商品的 markdown 文件
console.log('\n生成商品 Markdown 文件...');
for (let i = 0; i < selectedProducts.length; i++) {
  const p = selectedProducts[i];
  const productId = p.id;
  const mdPath = path.join(dailytempDir, `${productId}.md`);

  let md = `---
title: "${(p.goodsNameEn || 'N/A').replace(/"/g, '\\"')}"
platform: ${p.platform}
category: ${p.catName}
price: ${p.goodsPriceMin}-${p.goodsPriceMax}
currency: USD
sold: ${p.sold}
reviewNum: ${p.reviewNum}
rating: ${p.rating}
thumbnail: ${p.thumbnail}
goodsId: ${p.goodsId}
date: ${today}
productId: ${productId}
---

# ${p.goodsNameEn || 'N/A'}

${p.goodsNameCn ? `**中文名称**: ${p.goodsNameCn}\n` : ''}
**平台**: ${p.platform}
**类目**: ${p.catName}
**价格**: $${p.goodsPriceMin} - $${p.goodsPriceMax}
**销量**: ${p.sold}
**评论数**: ${p.reviewNum}
**评分**: ${p.rating}
**上架时间**: ${p.onSaleTime || 'N/A'}

![商品图片](${p.thumbnail || ''})

## 商品ID
${productId}

## 原始链接
${p.goodsId ? `https://www.${p.platform}.com/item/${p.goodsId}.html` : 'N/A'}
`;

  fs.writeFileSync(mdPath, md, 'utf-8');
  console.log(`  ✓ ${productId}.md`);
}

console.log('\n========================================');
console.log('选品任务完成!');
console.log(`入选商品: ${selectedProducts.length} 个`);
console.log(`报告: ${reportPath}`);
console.log('========================================');
