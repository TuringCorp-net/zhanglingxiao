/**
 * 选品筛选脚本 - 从原始数据中筛选有趣/新奇/好玩的商品
 * 筛选标准：新奇、有趣、好玩、有爆点
 */
const fs = require('fs');

const rawData = JSON.parse(fs.readFileSync('operations/selected/dailytemp/2026-04-27/raw_data.json', 'utf8'));

// 收集所有商品
const allProducts = [];

for (const [platform, data] of Object.entries(rawData)) {
  for (const channelData of data.products) {
    for (const item of channelData.items) {
      allProducts.push({
        ...item,
        platform,
        channel: channelData.channel,
        category: data.category
      });
    }
  }
}

console.log(`总共收集到 ${allProducts.length} 个商品\n`);

// 筛选逻辑：寻找新奇/有趣/好玩的商品
// 关键词特征：fun/party/game/kids/cute/unique/creative/play/interesting/quirky/novelty/gadget/toy
// 评分>4.5 或 评论>1000 或 销量>50000 优先
// 价格适中（有趣的东西通常不太贵也不太便宜）

const interestingKeywords = [
  'fun', 'party', 'game', 'kids', 'cute', 'unique', 'creative', 'play',
  'interesting', 'quirky', 'novelty', 'gadget', 'toy', 'magic', 'surprise',
  'crazy', 'cool', 'smart', 'portable', 'mini', 'puzzle', 'gift', 'decor',
  'light', 'colorful', 'rainbow', 'flashing', 'dance', 'music', 'karaoke'
];

function isInteresting(product) {
  const name = (product.goodsNameEn || product.goodsName || '').toLowerCase();
  const cnName = (product.goodsNameCn || '').toLowerCase();

  let score = 0;

  // 关键词匹配
  for (const kw of interestingKeywords) {
    if (name.includes(kw) || cnName.includes(kw)) {
      score += 2;
    }
  }

  // 高评分
  if (product.rating >= 4.7) score += 1;

  // 高评论数
  if (product.reviewNum >= 500) score += 1;

  // 高销量
  if (product.sold >= 50000) score += 1;

  // 价格适中 (1-50美元)
  const price = product.goodsPriceMin || 0;
  if (price >= 1 && price <= 50) score += 0.5;

  return score;
}

// 计算所有商品的趣味分数并排序
const scored = allProducts.map(p => ({
  ...p,
  interestScore: isInteresting(p)
}));

scored.sort((a, b) => b.interestScore - a.interestScore);

// 取前30个候选，再精选10个有代表性的
const top30 = scored.slice(0, 30);

// 精选10个，确保跨平台和多样性
const selected = [];
const usedPlatforms = new Set();

for (const product of top30) {
  if (selected.length >= 10) break;

  // 确保多样性：每个平台最多选2个
  const platformCount = selected.filter(p => p.platform === product.platform).length;
  if (platformCount >= 2 && selected.length > 5) continue;

  selected.push(product);
}

// 输出结果
console.log('=== 精选商品（10个）===\n');
selected.forEach((p, i) => {
  console.log(`【${i + 1}】${p.platform.toUpperCase()} - ${p.channel}`);
  console.log(`  名称: ${p.goodsNameEn.substring(0, 80)}...`);
  console.log(`  中文: ${p.goodsNameCn.substring(0, 50)}`);
  console.log(`  价格: $${p.goodsPriceMin} ~ $${p.goodsPriceMax}`);
  console.log(`  销量: ${p.sold} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
  console.log(`  图片: ${p.thumbnail}`);
  console.log(`  链接: https://www.temu.com/search_result.html?search_key=${p.goodsId}`);
  console.log('');
});

// 生成 Markdown 文件
let mdContent = `# 选品报告 - 2026年4月27日

> 选品侦察员（Selector）出品 | 采集时间: 2026-04-27
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
  mdContent += `### ${i + 1}. ${p.goodsNameEn.substring(0, 80)}...

**平台**: ${p.platform} | **类目**: ${p.category} | **渠道**: ${p.channel}

**中文名**: ${p.goodsNameCn}

**价格**: $${p.goodsPriceMin} ~ $${p.goodsPriceMax}

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

总计采集: ${allProducts.length} 个商品
- Temu: ${rawData.temu.products.reduce((s, c) => s + c.items.length, 0)} 个
- Shein: ${rawData.shein.products.reduce((s, c) => s + c.items.length, 0)} 个
- Amazon: ${rawData.amazon.products.reduce((s, c) => s + c.items.length, 0)} 个
- Sumaitong: ${rawData.sumaitong.products.reduce((s, c) => s + c.items.length, 0)} 个
- TikTok: ${rawData.tiktok.products.reduce((s, c) => s + c.items.length, 0)} 个

---

*此报告由选品侦察员（Selector）自动生成，仅作初筛参考*
`;

fs.writeFileSync('operations/selected/dailytemp/2026-04-27/selection_report.md', mdContent);
console.log('\n报告已保存: operations/selected/dailytemp/2026-04-27/selection_report.md');