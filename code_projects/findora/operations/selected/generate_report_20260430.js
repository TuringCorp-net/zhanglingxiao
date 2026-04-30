/**
 * 生成选品报告 - 2026-04-30
 */

const fs = require('fs');
const selected = JSON.parse(fs.readFileSync('selected_20260430_final.json', 'utf8'));
const today = new Date().toISOString().split('T')[0];

let report = `# 选品报告 - ${today}

## 采集概要

- **采集日期**: ${today}
- **采集平台**: Temu, Shein, Amazon, 速卖通, TikTok
- **采集类目**: 
  - Temu: 运动与户外用品 (31148)
  - Shein: 汽车类 (3657)
  - Amazon: 庭院、草坪和园艺 (2972638011)
  - 速卖通: 手表 (1511)
  - TikTok: Textiles & Soft Furnishings (600154)
- **采集数量**: 200个商品
- **精选数量**: ${selected.length}个

## 精选商品

`;

selected.forEach((p, i) => {
  report += `### ${i + 1}. [${p.platform?.toUpperCase()}] ${(p._source || '')}
- **名称(EN)**: ${p.goodsNameEn || 'N/A'}
- **名称(CN)**: ${p.goodsNameCn || 'N/A'}
- **价格**: $${p.goodsPriceMin || '?'} ~ $${p.goodsPriceMax || '?'}
- **销量**: ${p.sold?.toLocaleString() || '?'}
- **评价数**: ${p.reviewNum || 0}
- **评分**: ${p.rating || '?'}
- **上架时间**: ${p.onSaleTime ? new Date(p.onSaleTime).toLocaleDateString() : '?'}
- **商品ID**: ${p.goodsId || 'N/A'}
- **缩略图**: ${p.thumbnail || 'N/A'}
- **类目**: ${p._catId || 'N/A'}

`;
});

report += `
## 选品标准

1. **新奇有趣**: 造型/功能有创意，适合社媒传播
2. **差异化**: 有独特卖点，避免同质化
3. **市场验证**: 有一定销量和评价，说明市场接受度高
4. **跨平台**: 5个平台各有代表，保证多样性

## 状态更新

以下类目的 lastCrawled 已更新为 ${today}：
- Temu: 31148 运动与户外用品
- Shein: 3657 汽车类
- Amazon: 2972638011 庭院、草坪和园艺
- 速卖通: 1511 手表
- TikTok: 600154 Textiles & Soft Furnishings

---
*由 Selector Agent 自动生成 - ${new Date().toLocaleString()}*
`;

fs.writeFileSync(`20260430_selector_report.md`, report);
console.log('报告已生成: 20260430_selector_report.md');
