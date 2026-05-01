/**
 * Operator审核通过商品上架脚本
 * 将2026-05-01通过审核的4个精选商品上架到Findora数据库
 *
 * 使用方式: node operations/operator/upload_20260501.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';
const fs = require('fs');

// 待上架商品列表
const PRODUCTS_TO_UPLOAD = [
  {
    filename: '20260501001.md',
    mdPath: 'operations/pass/2026-05-01/20260501001.md',
    platform: 'temu',
    category: 'home-decor',
    sourceUrl: '601099640053447',
    originalTitle: 'Wooden Hexagon DIY Craft Pieces',
    coverImage: 'https://img.kwcdn.com/product/fancy/3874c8ab-193b-4732-9a7b-4c01dd7f6216.jpg',
    priceMin: 2.5,
    priceMax: 2.58
  },
  {
    filename: '20260501002.md',
    mdPath: 'operations/pass/2026-05-01/20260501002.md',
    platform: 'temu',
    category: 'home-decor',
    sourceUrl: '601099608904087',
    originalTitle: '3D Two Crows on Rose Vintage Wall Art',
    coverImage: 'https://img.kwcdn.com/product/fancy/fcb15980-2b46-46a2-8f50-312b8ee0ece5.jpg',
    priceMin: 10.39,
    priceMax: 11.02
  },
  {
    filename: '20260501005.md',
    mdPath: 'operations/pass/2026-05-01/20260501005.md',
    platform: 'shein',
    category: 'fashion',
    sourceUrl: '414445019',
    originalTitle: 'Musera Sport Solid Ruched Bust Open Back Sports Bra',
    coverImage: '//img.ltwebstatic.com/v4/j/pi/2026/03/06/3e/1772766731588c78a783f6771d42dcd3eef428244d_thumbnail_405x552.jpg',
    priceMin: 7.31,
    priceMax: 7.31
  },
  {
    filename: '20260501010.md',
    mdPath: 'operations/pass/2026-05-01/20260501010.md',
    platform: 'temu',
    category: 'hobbies',
    sourceUrl: '601099578257941',
    originalTitle: "Women's Adult Colouring Book",
    coverImage: 'https://img.kwcdn.com/product/fancy/market/a28505b0934126eec4357128da2a636e_FnXlhgAMSaruC.jpeg',
    priceMin: 6.55,
    priceMax: 8.9
  }
];

/**
 * 从md文件中提取完整的推广文案作为summary
 * 包含Curated Marketing Copy部分的所有内容
 */
function extractSummary(mdContent) {
  // 提取 Curated Marketing Copy 部分的完整内容
  const copyMatch = mdContent.match(/## Curated Marketing Copy\n([\s\S]*?)(?=^## |$)/m);

  if (copyMatch) {
    return copyMatch[1].trim();
  }

  // 如果没有匹配到，返回整个md内容
  return mdContent;
}

/**
 * 从md文件中提取标签列表
 */
function extractTags(mdContent) {
  const tags = [];

  // 提取Keyword Tags部分的标签
  const keywordMatch = mdContent.match(/#Keyword Tags\n([^\n]+)/);
  if (keywordMatch) {
    const tagString = keywordMatch[1].replace(/#/g, '').trim();
    tags.push(...tagString.split(/[,，\s]+/).filter(t => t));
  }

  // 也提取多维度表格中的标签
  const categoryMatches = mdContent.matchAll(/\*\*[A-Za-z\s]+\*\*\s*[|\n]([^\n]+)/g);
  for (const match of categoryMatches) {
    const tagLine = match[1].replace(/\|/g, ',').replace(/#/g, '');
    tags.push(...tagLine.split(/[,，\s]+/).filter(t => t && t.length > 2));
  }

  // 去重
  return [...new Set(tags)];
}

/**
 * 提取Headline作为title
 */
function extractTitle(mdContent) {
  const headlineMatch = mdContent.match(/\*\*Headline\*\*\s*\n\s*\*\*(.+)\*\*/);
  if (headlineMatch) {
    return headlineMatch[1].trim();
  }

  // 备用：提取第一个标题
  const titleMatch = mdContent.match(/^#\s+(.+)/m);
  if (titleMatch) {
    return titleMatch[1].replace('Product Curated:', '').trim();
  }

  return '';
}

async function uploadProduct(product) {
  console.log(`\n========== 处理商品: ${product.filename} ==========`);

  // 读取md文件内容
  const mdContent = fs.readFileSync(product.mdPath, 'utf-8');

  // 提取推广文案作为summary（完整内容，保留markdown格式）
  const summary = extractSummary(mdContent);
  console.log('推广文案长度:', summary.length, '字符');
  console.log('推广文案前100字符:', summary.substring(0, 100) + '...');

  // 提取标题
  const title = extractTitle(mdContent) || product.originalTitle;
  console.log('商品标题:', title);

  // 提取标签
  const tags = extractTags(mdContent);
  console.log('提取到标签:', tags.slice(0, 10).join(', '), '...');

  // 构建API请求体
  const requestBody = {
    source_platform: product.platform,
    source_url: product.sourceUrl,
    original_title: product.originalTitle,
    title: title,
    summary: summary,  // 完整的推广文案，保持markdown格式
    category: product.category,
    tags: tags,
    price_min: product.priceMin,
    price_max: product.priceMax,
    currency: 'USD',
    cover_image: product.coverImage,
    images: [product.coverImage],
    pros: tags.slice(0, 5),
    cons: [],
    use_cases: ['Creative Projects', 'Gift', 'Home Decor'],
    target_audience: ['DIY Enthusiasts', 'Creative People'],
    source_md: mdContent,  // 完整md文件内容
    source_filename: product.filename  // 原始文件名
  };

  // 调用API创建商品
  const response = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify(requestBody)
  });

  const result = await response.json();
  console.log('API响应:', JSON.stringify(result, null, 2));

  return { ...result, tags };
}

async function main() {
  console.log('='.repeat(60));
  console.log('开始上架2026-05-01审核通过的4个商品...');
  console.log('='.repeat(60));

  const results = [];
  for (const product of PRODUCTS_TO_UPLOAD) {
    try {
      const result = await uploadProduct(product);
      results.push({
        filename: product.filename,
        success: result.ok || result.success,
        data: result.data,
        error: result.error,
        tags: result.tags
      });
    } catch (error) {
      console.error(`上传失败: ${product.filename}`, error);
      results.push({
        filename: product.filename,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('上架结果汇总:');
  console.log(JSON.stringify(results, null, 2));

  // 统计
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`\n成功: ${successCount}, 失败: ${failCount}`);

  // 输出成功上架的商品ID，用于后续更新标签
  if (successCount > 0) {
    console.log('\n成功上架的商品:');
    results.filter(r => r.success).forEach(r => {
      console.log(`- ${r.filename}: ID=${r.data?.id || 'unknown'}`);
      console.log(`  标签: ${r.tags?.slice(0, 5).join(', ')}...`);
    });
  }

  return results;
}

main().catch(console.error);