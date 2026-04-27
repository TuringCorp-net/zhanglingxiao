/**
 * 选品筛选脚本 v2 - 从原始数据中筛选有趣/新奇/好玩的商品
 * 确保多样性：每平台最多2个，且去重相似商品
 */
const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('operations/selected/dailytemp/2026-04-27/raw_data.json', 'utf8'));

// 收集所有商品并去重
const allProducts = [];
const seenIds = new Set();

for (const [platform, data] of Object.entries(rawData)) {
  for (const channelData of data.products) {
    for (const item of channelData.items) {
      // 去重（同名商品只保留一个）
      const id = `${item.goodsId || item.goodsNameEn}`;
      if (seenIds.has(id)) continue;
      seenIds.add(id);

      allProducts.push({
        ...item,
        platform,
        channel: channelData.channel,
        category: data.category
      });
    }
  }
}

console.log(`去重后共 ${allProducts.length} 个商品\n`);

// 评分关键词
const positiveKeywords = [
  'fun', 'party', 'game', 'kids', 'cute', 'unique', 'creative', 'play',
  'interesting', 'quirky', 'novelty', 'gadget', 'toy', 'magic', 'surprise',
  'crazy', 'cool', 'smart', 'portable', 'mini', 'puzzle', 'gift', 'decor',
  'light', 'colorful', 'rainbow', 'flashing', 'dance', 'music', 'karaoke',
  'glow', 'christmas', 'halloween', 'costume', 'mask', 'hat', 'mask',
  'remote', 'wireless', 'bluetooth', 'led', 'sound', 'voice'
];

// 负面关键词（普通/无聊商品）
const negativeKeywords = [
  'replacement', 'spare', 'generic', 'standard', 'normal', 'ordinary',
  'basic', 'simple', 'case', 'cover', 'protector'
];

function calculateInterestScore(product) {
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const cnName = (product.goodsNameCn || '').toLowerCase();
  const combinedName = name + ' ' + cnName;

  let score = 0;

  // 正面关键词匹配
  for (const kw of positiveKeywords) {
    if (combinedName.includes(kw)) {
      score += 3;
      // 多个正面词叠加
    }
  }

  // 负面关键词扣分
  for (const kw of negativeKeywords) {
    if (combinedName.includes(kw)) {
      score -= 1;
    }
  }

  // 评分加成
  if (product.rating >= 4.8) score += 2;
  else if (product.rating >= 4.5) score += 1;

  // 评论数加成（需要一定验证）
  if (product.reviewNum >= 5000) score += 3;
  else if (product.reviewNum >= 1000) score += 2;
  else if (product.reviewNum >= 100) score += 1;

  // 销量加成
  if (product.sold >= 100000) score += 2;
  else if (product.sold >= 50000) score += 1;
  else if (product.sold < 100) score -= 1;

  // 价格适中加分 ($1-$50)
  const price = product.goodsPriceMin || 0;
  if (price >= 1 && price <= 50) score += 0.5;

  // 有图片加分
  if (product.thumbnail && product.thumbnail.length > 10) score += 0.5;

  return score;
}

// 计算所有商品的趣味分数
const scored = allProducts.map(p => ({
  ...p,
  interestScore: calculateInterestScore(p)
}));

// 按分数排序
scored.sort((a, b) => b.interestScore - a.interestScore);

// 精选10个，确保多样性
const selected = [];
const usedPlatforms = {};

for (const product of scored) {
  if (selected.length >= 10) break;

  // 每平台最多选2个
  const platformCount = usedPlatforms[product.platform] || 0;
  if (platformCount >= 2) continue;

  // 相似商品去重（标题前50字符相同则视为相似）
  const nameKey = (product.goodsNameEn || '').substring(0, 50).toLowerCase();
  let isDuplicate = false;
  for (const existing of selected) {
    const existingKey = (existing.goodsNameEn || '').substring(0, 50).toLowerCase();
    if (nameKey === existingKey) {
      isDuplicate = true;
      break;
    }
  }
  if (isDuplicate) continue;

  selected.push(product);
  usedPlatforms[product.platform] = platformCount + 1;
}

// 输出结果
console.log('=== 精选商品（10个）===\n');
selected.forEach((p, i) => {
  console.log(`【${i + 1}】${p.platform.toUpperCase()} - ${p.channel}`);
  console.log(`  名称: ${p.goodsNameEn.substring(0, 80)}`);
  console.log(`  中文: ${p.goodsNameCn.substring(0, 60)}`);
  console.log(`  价格: $${p.goodsPriceMin} ~ $${p.goodsPriceMax || '?'}`);
  console.log(`  销量: ${p.sold} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
  console.log(`  图片: ${p.thumbnail}`);
  console.log(`  ID: ${p.goodsId}`);
  console.log(`  趣味分: ${p.interestScore.toFixed(1)}`);
  console.log('');
});

// 平台分布
console.log('=== 平台分布 ===');
const platformCount = {};
selected.forEach(p => {
  platformCount[p.platform] = (platformCount[p.platform] || 0) + 1;
});
for (const [platform, count] of Object.entries(platformCount)) {
  console.log(`  ${platform}: ${count} 个`);
}

// 生成 Markdown 文件
let mdContent = `# 选品报告 - 2026年4月27日

> 选品侦察员（Selector）出品
> 采集时间: 2026-04-27
> 数据来源: Temu/Shein/Amazon/Sumaitong/TikTok 各平台热销品类

## 选品标准

- **新奇**：有独特设计或创新功能
- **有趣**：令人愉悦或会心一笑
- **好玩**：互动性强或有娱乐价值
- **有爆点**：销量/评分/评论数据优秀

---

## 精选商品（10个）

`;

selected.forEach((p, i) => {
  const priceRange = p.goodsPriceMax ? `$${p.goodsPriceMin} ~ $${p.goodsPriceMax}` : `$${p.goodsPriceMin}`;

  mdContent += `### ${i + 1}. ${p.goodsNameEn}

**平台**: ${p.platform} | **类目**: ${p.category} | **渠道**: ${p.channel}

**中文名**: ${p.goodsNameCn}

**价格**: ${priceRange}

**数据**:
- 销量: ${p.sold}
- 评论数: ${p.reviewNum}
- 评分: ${p.rating}

**图片**: ${p.thumbnail}

**商品ID**: ${p.goodsId}

---

`;
});

mdContent += `
## 原始数据

原始采集数据已保存至: \`operations/selected/dailytemp/2026-04-27/raw_data.json\`

| 平台 | 商品数 |
|------|--------|
`;

for (const [platform, data] of Object.entries(rawData)) {
  const count = data.products.reduce((sum, c) => sum + c.items.length, 0);
  mdContent += `| ${platform} | ${count} |\n`;
}

mdContent += `
---

*此报告由选品侦察员（Selector）自动生成，仅作初筛参考*
`;

fs.writeFileSync('operations/selected/dailytemp/2026-04-27/selection_report.md', mdContent);
console.log('\n报告已保存: operations/selected/dailytemp/2026-04-27/selection_report.md');

// 生成每个商品的md文件
console.log('\n生成商品md文件...');
const today = '2026-04-27';
selected.forEach((p, i) => {
  const num = String(i + 1).padStart(3, '0');
  const filename = `S${today.replace(/-/g, '')}-${num}.md`;

  const productMd = `# ${p.goodsNameEn}

**平台**: ${p.platform} | **类目**: ${p.category}
**渠道**: ${p.channel}
**采集时间**: ${today}

## 基本信息

- **商品ID**: ${p.goodsId}
- **中文名**: ${p.goodsNameCn}
- **价格**: $${p.goodsPriceMin} ~ $${p.goodsPriceMax || '?'}
- **销量**: ${p.sold}
- **评论数**: ${p.reviewNum}
- **评分**: ${p.rating}

## 图片

![商品图片](${p.thumbnail})

## 原始数据

\`\`\`json
${JSON.stringify(p, null, 2)}
\`\`\`

---

*由 Selector 自动生成 | ${today}*
`;

  fs.writeFileSync(`operations/selected/${filename}`, productMd);
  console.log(`  生成: ${filename}`);
});

console.log('\n完成！');