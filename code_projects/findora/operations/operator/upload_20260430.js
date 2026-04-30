/**
 * Operator审核通过商品上架脚本
 * 将2026-04-30通过审核的5个精选商品上架到Findora数据库
 *
 * 使用方式: node operations/operator/upload_20260430.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';
const fs = require('fs');

// 通过审核的5个商品
const PRODUCTS_TO_UPLOAD = [
  {
    filename: 'C20260430-001.md',
    mdPath: 'operations/pass/2026-04-30/C20260430-001.md',
    platform: 'temu',
    category: 'home',
    sourceUrl: 'https://www.temu.com/g-601099573015643.html',
    originalTitle: '6pcs super soft microfiber bath towel set, 2 bath towels 27 x 55 inches, 2 hand towels 13 x 30 inches',
    title: 'Cloud-Soft Luxury: Your Complete 6-Piece Bath Sanctuary',
    priceMin: 20.25,
    priceMax: 35.76,
    coverImage: 'https://img.kwcdn.com/product/fancy/b00f36ee-9676-4b87-8a08-1746bd3e8b90.jpg'
  },
  {
    filename: 'C20260430-002.md',
    mdPath: 'operations/pass/2026-04-30/C20260430-002.md',
    platform: 'amazon',
    category: 'garden',
    sourceUrl: 'https://www.amazon.com/dp/B00LHE5OSQ',
    originalTitle: "Wagner's 53002 Farmer's Delight Cherry Flavored Wild Bird Food, 10-Pound Bag",
    title: 'Welcome the Birds Home: Premium Cherry-Flavored Wild Bird Food',
    priceMin: 12.48,
    priceMax: 12.48,
    coverImage: 'https://m.media-amazon.com/images/I/81gIvBzsnaL._AC_UL320_.jpg'
  },
  {
    filename: 'C20260430-003.md',
    mdPath: 'operations/pass/2026-04-30/C20260430-003.md',
    platform: 'tiktok',
    category: 'textiles',
    sourceUrl: 'https://tiktok.com/product/1729405570499645529',
    originalTitle: 'Oversized Wearable Blanket Hoodie for Women & Adults, Super Soft, Warm & Cozy with Giant Front Pocket',
    title: 'The Coziest Thing You\'ll Ever Own: Oversized Wearable Blanket Hoodie',
    priceMin: 16.49,
    priceMax: 24.69,
    coverImage: 'https://p19-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/c359f0e1e6d74dab835011eb2730edda~tplv-fhlh96nyum-crop-webp:1200:1200.webp?dr=12190&t=555f072d&ps=933b5bde&shp=8dbd94bf&shcp=d741f1be&idc=useast8&from=2378011839'
  },
  {
    filename: 'C20260430-004.md',
    mdPath: 'operations/pass/2026-04-30/C20260430-004.md',
    platform: 'tiktok',
    category: 'textiles',
    sourceUrl: 'https://tiktok.com/product/1729396676166849042',
    originalTitle: 'Solid Color Satin Fitted Sheet and Pillowcase Set, Silky Bed Sheets, Soft Breathable Sheet, Soft & Comfortable',
    title: 'Sleep Like Royalty: Silky Satin Sheet Set That Feels Like a Five-Star Hotel',
    priceMin: 9.9,
    priceMax: 9.9,
    coverImage: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/761669a184464afcbae01b4763a5efc3~tplv-fhlh96nyum-crop-webp:1200:1200.webp?dr=12190&t=555f072d&ps=933b5bde&shp=8dbd94bf&shcp=d741f1be&idc=useast5&from=2378011839'
  },
  {
    filename: 'C20260430-007.md',
    mdPath: 'operations/pass/2026-04-30/C20260430-007.md',
    platform: 'shein',
    category: 'sports',
    sourceUrl: 'https://www.shein.com/Musera-Sport-Solid-Ruched-Bust-Open-Back-Halter-Sports-Bra-p-414445019.html',
    originalTitle: 'Musera Sport Solid Ruched Bust Open Back Halter Sports Bra, Active Comfy Workout Gym Running Run Clothes',
    title: 'Turn Heads at the Gym: Ruched Bust Halter Sports Bra with Open Back Detail',
    priceMin: 7.31,
    priceMax: 7.31,
    coverImage: '//img.ltwebstatic.com/v4/j/pi/2026/03/06/3e/1772766731588c78a783f6771d42dcd3eef428244d_thumbnail_405x552.jpg'
  }
];

function extractAllTags(mdContent) {
  const tags = new Set();

  // 提取所有标签部分
  const tagMatches = mdContent.matchAll(/### (?:核心标签|场景标签|人群标签|情感标签|价值标签|平台标签)[^\n]*\n([\s\S]*?)(?=###|##|$)/g);
  for (const match of tagMatches) {
    const tagSection = match[1];
    const tagList = tagSection.match(/`([^`]+)`/g);
    if (tagList) {
      tagList.forEach(t => tags.add(t.replace(/`/g, '')));
    }
  }

  return Array.from(tags);
}

function extractFullSummary(mdContent) {
  // 提取完整推广文案部分
  const summaryStart = mdContent.indexOf('## 推广文案');
  const summaryEnd = mdContent.indexOf('## 多维度标签');

  if (summaryStart !== -1 && summaryEnd !== -1) {
    return mdContent.substring(summaryStart + '## 推广文案'.length, summaryEnd).trim();
  }

  // 备用：提取整个推广文案部分
  const bodyStart = mdContent.indexOf('### Headline');
  if (bodyStart !== -1) {
    return mdContent.substring(bodyStart).trim();
  }

  return mdContent;
}

async function uploadProduct(product) {
  console.log(`\n========== 处理商品: ${product.filename} ==========`);

  // 读取md文件内容
  const mdContent = fs.readFileSync(product.mdPath, 'utf-8');

  // 提取完整推广文案作为summary
  const summary = extractFullSummary(mdContent);
  console.log('推广文案长度:', summary.length, '字符');

  // 提取所有标签
  const tags = extractAllTags(mdContent);
  console.log('提取标签数量:', tags.length);

  // 构建API请求体
  const requestBody = {
    source_platform: product.platform,
    source_url: product.sourceUrl,
    original_title: product.originalTitle,
    title: product.title,
    summary: summary,  // 完整的推广文案
    category: product.category,
    subcategory: '',
    tags: tags,
    price_min: product.priceMin,
    price_max: product.priceMax,
    currency: 'USD',
    cover_image: product.coverImage,
    images: [product.coverImage],
    pros: tags.slice(0, 5),
    cons: [],
    use_cases: ['Daily Use', 'Gift', 'Self-Care'],
    target_audience: ['Value Shoppers', 'Quality Seekers', 'Self-Care Enthusiasts'],
    shipping_notes: '',
    source_md: mdContent,  // 完整md文件内容
    source_filename: product.filename  // 原始文件名
  };

  console.log('请求信息:', JSON.stringify({
    platform: product.platform,
    category: product.category,
    title: product.title,
    price: `${product.priceMin}-${product.priceMax}`,
    tags: tags.slice(0, 5)
  }, null, 2));

  // 调用API创建商品
  try {
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
  } catch (error) {
    console.error('API调用失败:', error);
    return { ok: false, error: error.message };
  }
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
        data: result.data || result.error,
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