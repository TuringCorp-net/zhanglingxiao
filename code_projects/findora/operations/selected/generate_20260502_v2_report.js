/**
 * ============================================
 * 生成选品报告 - 2026-05-02 第二次采集
 * ============================================
 */

const fs = require('fs');

// 生成日期字符串
const dateStr = '2026-05-02';
const sessionStr = 'v2';

// 读取精选商品
const selected = JSON.parse(fs.readFileSync('./selected_20260502_v2.json', 'utf8'));

let report = `# 选品报告 - ${dateStr} (第二次采集)

## 采集概况
- 总采集商品: 200 个
- 去重后商品: 50 个
- 精选商品: ${selected.length} 个

## 采集类目
- Temu: CD和黑胶唱片 (catId: 1)
- Shein: 家居与生活 (catId: 2032)
- Amazon: 家电 (catId: 2619525011)
- Sumaitong: 家用电器 (catId: 6)
- TikTok: Toys & Hobbies (catId: 604206)

## 精选商品

`;

// 生成每个商品的报告
selected.forEach((p, i) => {
  const num = String(i + 1).padStart(3, '0');
  const priceRange = p.goodsPriceMin && p.goodsPriceMax
    ? `$${p.goodsPriceMin} - $${p.goodsPriceMax}`
    : p.goodsPriceMin ? `$${p.goodsPriceMin}` : 'N/A';

  const matchedKw = p._scoreData?.matchedKeywords?.length > 0
    ? p._scoreData.matchedKeywords.join(', ')
    : '无特定热点关键词';

  report += `### ${i + 1}. ${p.goodsNameEn?.substring(0, 80)}

- **编号**: ${dateStr.replace(/-/g, '')}${num}
- **平台**: ${p.sourcePlatform}
- **类目**: ${p.sourceCatName}
- **价格**: ${priceRange}
- **销量**: ${p.sold}
- **评分**: ${p.rating || 'N/A'}
- **入选理由**: ${matchedKw}
- **图片**: ${p.thumbnail}
- **商品ID**: ${p.goodsId}

`;
});

// 写入报告
fs.writeFileSync(`./${dateStr.replace(/-/g, '')}${sessionStr}_selector_report.md`, report);
console.log(`✓ 报告已保存至 ${dateStr.replace(/-/g, '')}${sessionStr}_selector_report.md`);
