/**
 * ============================================
 * 生成选品Markdown文档 - 2026-04-30
 * ============================================
 */

const fs = require('fs');
const path = require('path');

// 加载筛选结果
const selectedData = JSON.parse(fs.readFileSync('./dailytemp/2026-04-30/selected_20260430_final.json', 'utf8'));
const selected = selectedData.selectedProducts;

// 输出目录
const OUTPUT_DIR = '../selected/2026-04-30';

// 确保目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log(`\n========================================`);
console.log(`生成选品Markdown文档 - 2026-04-30`);
console.log(`========================================\n`);

// 生成每个商品的markdown文件
const generatedFiles = [];

selected.forEach((product, i) => {
  const fileName = `C20260430-${String(i + 1).padStart(3, '0')}.md`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // 构建markdown内容
  const md = `# ${product.name}

## 商品信息

| 字段 | 值 |
|------|-----|
| 编号 | ${fileName.replace('.md', '')} |
| 平台 | ${product.platform} |
| 类目 | ${product.category} |
| 商品ID | ${product.goodsId} |
| 价格 | ${product.price} |
| 销量 | ${product.sold.toLocaleString()} |
| 评分 | ${product.rating} |
| 评论数 | ${product.reviews.toLocaleString()} |
| 评分 | ${product.score} |

## 商品特色

${product.features.map(f => `- ${f}`).join('\n')}

## 选品理由

${product.reason}

## 商品链接

${product.thumbnail ? `![商品图片](${product.thumbnail})` : '*暂无图片*'}

## 原始数据

\`\`\`json
${JSON.stringify(product, null, 2)}
\`\`\`
`;

  fs.writeFileSync(filePath, md);
  console.log(`✓ ${fileName} - ${product.name.substring(0, 50)}...`);
  generatedFiles.push({ fileName, product });
});

// 生成汇总报告
const reportFileName = `${OUTPUT_DIR}/../20260430_selector_report.md`;
const reportContent = `# 选品报告 - 2026-04-30

> 生成时间: ${new Date().toISOString()}

## 采集统计

| 指标 | 数值 |
|------|------|
| 原始商品数 | ${selectedData.totalProducts} |
| 去重商品数 | ${selectedData.uniqueProducts} |
| 精选商品数 | ${selected.length} |

## 平台分布

${Object.entries(selectedData.platformDistribution).map(([p, c]) => `- ${p}: ${c}个`).join('\n')}

## 采集类目

| 平台 | 类目ID | 类目名称 | 采集状态 |
|------|--------|----------|----------|
| Temu | 31148 | 运动与户外用品 | ✅ 已采集 |
| Shein | 3195 | 运动与户外 | ✅ 已采集 |
| Amazon | 2972638011 | 庭院、草坪和园艺 | ✅ 已采集 |
| Sumaitong | 200000345 | 女装 | ✅ 已采集 |
| TikTok | 600154 | Textiles & Soft Furnishings | ✅ 已采集 |

## 精选商品列表

${selected.map(p => `### ${p.rank}. [${p.platform}] ${p.name}

- **价格**: ${p.price}
- **销量**: ${p.sold.toLocaleString()}
- **评分**: ${p.rating} (${p.reviews.toLocaleString()}条评论)
- **特点**: ${p.features.join(', ')}
- **选品理由**: ${p.reason}
- **文件**: ${`C20260430-${String(p.rank).padStart(3, '0')}.md`}
`).join('\n---\n')}

## 生成文件

${generatedFiles.map(f => `- ${f.fileName}`).join('\n')}
`;

fs.writeFileSync(reportFileName, reportContent);
console.log(`\n✓ 汇总报告已生成: 20260430_selector_report.md`);

console.log(`\n========================================`);
console.log(`生成完成！共 ${generatedFiles.length} 个文件`);
console.log(`========================================\n`);

module.exports = { generatedFiles };