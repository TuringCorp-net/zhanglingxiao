/**
 * 修复推广文案脚本
 * 为2026-05-01上架的4个商品更新完整的推广文案(summary)
 *
 * 使用方式: node operations/operator/fix_summary_20260501.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';
const fs = require('fs');

// 商品ID和对应文件
const PRODUCTS = [
  {
    productId: 'd05ef10f-3686-4b0d-867b-c3bc42dab6eb',
    filename: '20260501001.md',
    mdPath: 'operations/pass/2026-05-01/20260501001.md'
  },
  {
    productId: '5a43e538-462e-4e70-8d6f-457c71102e47',
    filename: '20260501002.md',
    mdPath: 'operations/pass/2026-05-01/20260501002.md'
  },
  {
    productId: 'dff3296c-ff27-4e29-b116-9038eae5409e',
    filename: '20260501005.md',
    mdPath: 'operations/pass/2026-05-01/20260501005.md'
  },
  {
    productId: '0d3216bb-732e-428f-bdf4-e2f963612327',
    filename: '20260501010.md',
    mdPath: 'operations/pass/2026-05-01/20260501010.md'
  }
];

/**
 * 提取完整的Curated Marketing Copy部分作为summary
 */
function extractFullSummary(mdContent) {
  // 匹配 Curated Marketing Copy 部分的完整内容
  // 从 "## Curated Marketing Copy" 到下一个 "## " 或文件结尾
  const regex = /## Curated Marketing Copy\n([\s\S]*?)(?=^## |^##$)/m;
  const match = mdContent.match(regex);

  if (match && match[1]) {
    return match[1].trim();
  }

  // 备用方案：尝试匹配 "### Headline" 到 "---" 之间的内容
  const headlineMatch = mdContent.match(/### Headline\n([\s\S]*?)(?=^---|^### )/m);
  if (headlineMatch && headlineMatch[1]) {
    return headlineMatch[1].trim();
  }

  console.log('警告: 无法提取推广文案，使用原始文件内容');
  return mdContent;
}

async function updateProductSummary(product) {
  console.log(`\n========== 更新商品文案: ${product.filename} ==========`);
  console.log('商品ID:', product.productId);

  // 读取md文件内容
  const mdContent = fs.readFileSync(product.mdPath, 'utf-8');

  // 提取完整的推广文案
  const summary = extractFullSummary(mdContent);
  console.log('推广文案长度:', summary.length, '字符');
  console.log('推广文案前200字符:');
  console.log(summary.substring(0, 200));

  // 调用API更新商品
  const response = await fetch(`${API_BASE}/admin/products/${product.productId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({
      summary: summary
    })
  });

  const result = await response.json();
  console.log('API响应:', JSON.stringify(result, null, 2));

  return result;
}

async function main() {
  console.log('='.repeat(60));
  console.log('开始更新2026-05-01上架商品的推广文案...');
  console.log('='.repeat(60));

  const results = [];
  for (const product of PRODUCTS) {
    try {
      const result = await updateProductSummary(product);
      results.push({
        filename: product.filename,
        productId: product.productId,
        success: result.ok || result.success,
        data: result.data,
        error: result.error
      });
    } catch (error) {
      console.error(`更新失败: ${product.filename}`, error);
      results.push({
        filename: product.filename,
        productId: product.productId,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('更新结果汇总:');
  console.log(JSON.stringify(results, null, 2));

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`\n成功: ${successCount}, 失败: ${failCount}`);
}

main().catch(console.error);