/**
 * 生成选品报告 Markdown 文件 - 2026-05-04
 */

const fs = require('fs');

// 读取筛选结果
const selected = JSON.parse(fs.readFileSync(__dirname + '/selected_20260504_v2.json', 'utf8'));
const today = '2026-05-04';
const dateStr = today.replace(/-/g, '');

console.log('===========================================');
console.log('  生成选品 Markdown 报告');
console.log('===========================================');

selected.forEach((p, i) => {
  const seq = String(i + 1).padStart(3, '0');
  const fileName = `${today}-${seq}.md`;
  
  const content = `---
productId: ${p.goodsId || 'N/A'}
platform: ${p.platform}
category: ${p.category}
sourceChannel: ${p.channel}
collectedAt: ${new Date().toISOString()}
noveltyScore: ${p.noveltyScore}
sold: ${p.sold || 0}
reviewNum: ${p.reviewNum || 0}
rating: ${p.rating || 'N/A'}
priceRange: $${p.priceMin || 0} ~ $${p.priceMax || 0}
---

# ${p.rank}. ${p.goodsName || 'N/A'}

## 基本信息

| 项目 | 内容 |
|------|------|
| **平台** | ${p.platform} |
| **类目** | ${p.category} |
| **渠道** | ${p.channel} |
| **商品ID** | ${p.goodsId || 'N/A'} |
| **新奇指数** | ⭐ ${p.noveltyScore} |

## 商品信息

**英文名**: ${p.goodsName || 'N/A'}

**中文名**: ${p.goodsNameCn || 'N/A'}

## 价格与销量

| 指标 | 数值 |
|------|------|
| **价格区间** | $${p.priceMin || 0} ~ $${p.priceMax || 0} |
| **销量** | ${(p.sold || 0).toLocaleString()} |
| **评论数** | ${p.reviewNum || 0} |
| **评分** | ${p.rating || 'N/A'} |

## 选品理由

> 基于销量(${p.sold || 0}件)、评论数(${p.reviewNum || 0})、评分(${p.rating || 'N/A'}分)综合评估，
> 该商品具有较高的市场验证度和消费者认可度，适合作为潜力爆款推荐。

## 链接

${p.detailUrl ? `[查看商品详情](${p.detailUrl})` : '*商品链接待补充*'}

${p.thumbnail ? `![](${p.thumbnail})` : ''}
`;

  fs.writeFileSync(__dirname + '/' + fileName, content);
  console.log(`✓ 已生成: ${fileName}`);
});

console.log(`\n✅ 共生成 ${selected.length} 个 Markdown 文件`);
