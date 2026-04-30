/**
 * ============================================
 * 生成选品MD文件脚本 - 2026-04-30
 * ============================================
 */

const fs = require('fs');
const path = require('path');

// 读取筛选报告
const reportPath = path.join(__dirname, 'dailytemp', '2026-04-30', 'selection_report.json');
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const today = '2026-04-30';
const idPrefix = today.replace(/-/g, '');

// 平台中文名映射
const platformNames = {
  temu: 'Temu',
  shein: 'Shein',
  amazon: 'Amazon',
  sumaitong: '速卖通',
  tiktok: 'TikTok'
};

// 生成MD内容
function generateMD(product, index) {
  const itemId = `${idPrefix}-${String(index + 1).padStart(3, '0')}`;
  const price = product.goodsPriceMin === product.goodsPriceMax
    ? `$${product.goodsPriceMin}`
    : `$${product.goodsPriceMin} - $${product.goodsPriceMax}`;

  const name = product.goodsName || product.goodsNameCn || 'N/A';

  return `# ${itemId}

## 基本信息

- **商品ID**: ${product.goodsId || 'N/A'}
- **商品名称**: ${name}
- **来源平台**: ${platformNames[product.sourcePlatform] || product.sourcePlatform}
- **来源类目**: ${product.sourceCatName}
- **采集渠道**: ${product.sourceChannel}

## 价格与销量

- **价格区间**: ${price}
- **销量**: ${product.sold ? product.sold.toLocaleString() : 'N/A'}
- **评分**: ${product.rating || 'N/A'}
- **评论数**: ${product.reviewNum ? product.reviewNum.toLocaleString() : 'N/A'}

## 筛选理由

<!-- 由 Selector Agent 自动生成初筛理由 -->

本商品来源于 **${product.sourceCatName}** 类目的 **${product.sourceChannel}**，
综合评分 ${product.selectionScore}，具有较高的市场热度。

## 原始数据

\`\`\`json
${JSON.stringify({
  goodsId: product.goodsId,
  goodsName: product.goodsName || product.goodsNameCn,
  thumbnail: product.thumbnail,
  goodsPriceMin: product.goodsPriceMin,
  goodsPriceMax: product.goodsPriceMax,
  sold: product.sold,
  rating: product.rating,
  reviewNum: product.reviewNum,
  sourcePlatform: product.sourcePlatform,
  sourceCatName: product.sourceCatName,
  sourceChannel: product.sourceChannel
}, null, 2)}
\`\`\`

---

*采集日期: ${today} | 选品编号: ${itemId}*
`;
}

// 生成选品报告MD
function generateReportMD(report) {
  let content = `# 选品报告 - ${report.date}\n\n`;
  content += `> 本次采集于 ${report.date} 完成，共采集 ${report.totalCollected} 个商品，筛选出 ${report.totalSelected} 个精选商品。\n\n`;

  content += `## 采集类目\n\n`;
  content += `| 平台 | 类目 | 采集渠道 |\n`;
  content += `|------|------|----------|\n`;
  for (const cat of report.categories) {
    content += `| ${platformNames[cat.platform] || cat.platform} | ${cat.catName} | ${cat.channels.join(', ')} |\n`;
  }

  content += `\n## 精选商品\n\n`;
  for (const p of report.selectedProducts) {
    const itemId = `${idPrefix}-${String(p.rank).padStart(3, '0')}`;
    const price = p.goodsPriceMin === p.goodsPriceMax
      ? `$${p.goodsPriceMin}`
      : `$${p.goodsPriceMin} - $${p.goodsPriceMax}`;
    content += `### ${itemId} - ${p.goodsName?.substring(0, 60) || 'N/A'}\n\n`;
    content += `- **平台**: ${platformNames[p.sourcePlatform] || p.sourcePlatform}\n`;
    content += `- **价格**: ${price}\n`;
    content += `- **销量**: ${p.sold?.toLocaleString() || 'N/A'}\n`;
    content += `- **评分**: ${p.rating || 'N/A'} | **评论**: ${p.reviewNum?.toLocaleString() || 'N/A'}\n`;
    content += `- **综合评分**: ${p.selectionScore}\n\n`;
  }

  return content;
}

// 生成MD文件
const outputDir = __dirname;
const reportContent = generateReportMD(report);

// 保存选品报告
const reportMDPath = path.join(outputDir, `${idPrefix}_selector_report.md`);
fs.writeFileSync(reportMDPath, reportContent, 'utf8');
console.log(`选品报告已保存: ${reportMDPath}`);

// 保存精选商品JSON
const selectedJSONPath = path.join(outputDir, `selected_${idPrefix}.json`);
fs.writeFileSync(selectedJSONPath, JSON.stringify(report.selectedProducts, null, 2), 'utf8');
console.log(`精选商品JSON已保存: ${selectedJSONPath}`);

// 为每个商品生成独立MD文件
for (let i = 0; i < report.selectedProducts.length; i++) {
  const product = report.selectedProducts[i];
  const itemId = `${idPrefix}-${String(i + 1).padStart(3, '0')}`;
  const mdContent = generateMD(product, i);
  const mdPath = path.join(outputDir, `${itemId}.md`);
  fs.writeFileSync(mdPath, mdContent, 'utf8');
  console.log(`商品MD已保存: ${mdPath}`);
}

console.log(`\n共生成 ${report.selectedProducts.length} 个商品MD文件`);
