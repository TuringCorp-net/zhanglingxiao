/**
 * Operator审核通过商品上架脚本
 * 将2026-04-29通过审核的4个精选商品上架到Findora数据库
 *
 * 使用方式: node operations/operator/upload_pass_products.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';

// 待上架商品列表（手动指定商品信息）
const PRODUCTS_TO_UPLOAD = [
  {
    filename: 'C20260429-001.md',
    mdPath: 'operations/pass/2026-04-29/C20260429-001.md',
    platform: 'temu',
    category: 'automotive',
    sourceUrl: 'https://www.temu.com/g-606166197328867.html',
    originalTitle: 'Portable Car Windshield Sunshade, Universal Foldable Front Window Sunshade for Auto SUV Truck, Heat Shield & UV Protection, Summer Car Accessories',
    title: 'Your Car Deserves a Cool Summer — Not a 140°F Oven on Wheels',
    priceMin: 7.9,
    priceMax: 7.9,
    coverImage: 'https://img.kwcdn.com/product/fancy/45fbbd5a-451b-46e6-89cc-79001d0aeff4.jpg',
    tags: ['CarShade', 'HeatProtection', 'UVBlock', 'FoldableSunshade', 'SummerDrivingEssentials', 'UniversalCarShade', 'DashboardProtection', 'HotCarHack', 'CarCooling', 'AutoAccessories']
  },
  {
    filename: 'C20260429-002.md',
    mdPath: 'operations/pass/2026-04-29/C20260429-002.md',
    platform: 'temu',
    category: 'beauty',
    sourceUrl: 'https://www.temu.com/g-601100162212953.html',
    originalTitle: 'Electric Foot Exfoliator - 6 Interchangeable Heads - USB Rechargeable Foot Care Tool for Whole Body Spa Treatment',
    title: 'Sandpaper Feet? Never Again. Get Baby-Soft Soles in Just 10 Minutes.',
    priceMin: 8.19,
    priceMax: 8.3,
    coverImage: 'https://img.kwcdn.com/product/fancy/c9ac234e-2cf2-4eb7-9801-d04d60b61325.jpg',
    tags: ['At-Home Spa', 'Foot Care', 'USB Rechargeable', 'Self-Care', 'Foot Exfoliator', 'Spa Day', 'Body Care', 'Summer Sandals', 'Wellness', 'Soft Skin']
  },
  {
    filename: 'C20260429-003.md',
    mdPath: 'operations/pass/2026-04-29/C20260429-003.md',
    platform: 'shein',
    category: 'office',
    sourceUrl: 'https://www.shein.com/Frida-Kahlo-X-SHEIN-59-Pcs-Floral-Figure-Graphic-Sticker-Pack-p-56038392.html',
    originalTitle: 'Frida Kahlo X SHEIN 59 Pcs Floral Figure Graphic Sticker Pack',
    title: '59 Pieces of Artistic Rebellion: Make Everything Unapologetically You',
    priceMin: 2.13,
    priceMax: 2.13,
    coverImage: '//img.ltwebstatic.com/images3_pi/2025/02/11/c1/1739241588cc1e4390c18191773500e543f95c5fa3_thumbnail_405x552.jpg',
    tags: ['Art Stickers', 'Frida Kahlo', 'Collectible Art', 'Waterproof Stickers', 'Journal Decor', 'Boho Aesthetic', 'Self-Expression', 'Creative Gift', 'Laptop Stickers', 'Personalization']
  },
  {
    filename: 'C20260429-004.md',
    mdPath: 'operations/pass/2026-04-29/C20260429-004.md',
    platform: 'shein',
    category: 'office',
    sourceUrl: 'https://www.shein.com/Pop-Mart-Azura-X-SHEIN-25pcs-Cartoon-Themed-Shiny-And-Colorful-Stickers-p-73519439.html',
    originalTitle: 'Pop Mart Azura X SHEIN 25pcs Cartoon Themed Shiny And Colorful Stickers',
    title: 'Unbox the Sparkle: Where Pop Mart Magic Meets Everyday Glam',
    priceMin: 2.21,
    priceMax: 2.21,
    coverImage: '//img.ltwebstatic.com/v4/j/pi/2025/05/27/8a/1748347688225f7de9d16aefa314b6cfc2d013ac70_thumbnail_220x293.jpg',
    tags: ['Pop Mart', 'Holographic Stickers', 'Kawaii', 'Gen Z', 'Sparkle', 'Collectibles', 'Y2K', 'Sticker Lovers', 'Cute Culture', 'Gift Sticker']
  }
];

async function uploadProduct(product) {
  const fs = require('fs');

  console.log(`\n========== 处理商品: ${product.filename} ==========`);

  // 读取md文件内容
  const mdContent = fs.readFileSync(product.mdPath, 'utf-8');

  // 提取完整推广文案作为summary
  const summary = extractSummary(mdContent);
  console.log('推广文案摘要 (前200字符):', summary.substring(0, 200) + '...');

  // 构建API请求体
  const requestBody = {
    source_platform: product.platform,
    source_url: product.sourceUrl,
    original_title: product.originalTitle,
    title: product.title,
    summary: summary,  // 完整的推广文案
    category: product.category,
    subcategory: 'stickers',
    tags: product.tags,
    price_min: product.priceMin,
    price_max: product.priceMax,
    currency: 'USD',
    cover_image: product.coverImage,
    images: [product.coverImage],
    pros: product.tags.slice(0, 5),
    cons: [],
    use_cases: ['Daily Accessories', 'Gift', 'Collection'],
    target_audience: ['Gen Z', 'Sticker Collectors', 'Kawaii Lovers'],
    shipping_notes: '',
    source_md: mdContent,  // 完整md文件内容
    source_filename: product.filename  // 原始文件名
  };

  console.log('请求信息:', JSON.stringify({
    platform: product.platform,
    category: product.category,
    title: product.title,
    price: `${product.priceMin}-${product.priceMax}`,
    tags: product.tags.slice(0, 5)
  }, null, 2));

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

  return result;
}

function extractSummary(mdContent) {
  const summaryParts = [];

  // Headline
  const headlineMatch = mdContent.match(/\*\*Headline\*\*\s*\n\s*"?\*\*(.+)\*\*"?/);
  if (headlineMatch) {
    summaryParts.push(`### ${headlineMatch[1]}`);
  }

  // Sub-headline
  const subheadlineMatch = mdContent.match(/Sub-headline\s*\n(.+)/);
  if (subheadlineMatch) {
    summaryParts.push(`**${subheadlineMatch[1].trim()}**`);
  }

  // Body Copy - 提取完整内容
  const bodyMatch = mdContent.match(/Body Copy\n\n([\s\S]*?)(?=\n---\n|##\s+多维度标签)/);
  if (bodyMatch) {
    summaryParts.push(bodyMatch[1].trim());
  } else {
    // 备用：提取推广文案部分
    const curatorMatch = mdContent.match(/二次策划 - 推广文案[\s\S]*?(?=## 多维度标签)/);
    if (curatorMatch) {
      summaryParts.push(curatorMatch[0].replace('二次策划 - 推广文案', '').trim());
    }
  }

  if (summaryParts.length > 0) {
    return summaryParts.join('\n\n');
  }

  // 如果没有提取到，返回整个md内容
  return mdContent;
}

async function main() {
  console.log('开始上架商品...');
  console.log('='.repeat(50));

  const results = [];
  for (const product of PRODUCTS_TO_UPLOAD) {
    try {
      const result = await uploadProduct(product);
      results.push({
        filename: product.filename,
        success: result.ok || result.success,
        data: result.data,
        error: result.error
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

  console.log('\n' + '='.repeat(50));
  console.log('上架结果汇总:');
  console.log(JSON.stringify(results, null, 2));

  // 统计
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`\n成功: ${successCount}, 失败: ${failCount}`);

  // 如果有成功的商品，输出商品ID
  if (successCount > 0) {
    console.log('\n成功上架的商品:');
    results.filter(r => r.success).forEach(r => {
      console.log(`- ${r.filename}: ${r.data?.id || 'unknown'}`);
    });
  }

  return results;
}

main().catch(console.error);
