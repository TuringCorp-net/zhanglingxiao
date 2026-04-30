#!/usr/bin/env node

/**
 * Findora 2026-04-30 商品上架脚本
 * Operator Agent 使用：将 PASS 目录的商品上架到 Findora
 * 包括完整的推广文案 (summary) 和多维度标签
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 通过的商品信息
const products = [
  {
    filename: 'CUR-20260430-001.md',
    product_id: '606497983589039',
    source_platform: 'Temu',
    source_url: 'https://www.temu.com/2-Pack-Frosted-Privacy-Ceramic-Screen-Protector-suitable-for-Samsung-Galaxy-S26-S25-S24-S23-S22-S21-Plus-Edge-Ultra-Series-Offers-HD-Clarity-Bubble-Free-Installation-and-Shatterproof-Protection-g-0-0095011830000000050000000000000-6010110932000071001000000000000000060000000000000.html',
    original_title: '2-Pack Frosted Privacy Ceramic Screen Protector, Suitable for Samsung Galaxy S26/S25/S24/S23/S22/S21 Plus/Edge/Ultra Series, Offers HD Clarity, Bubble-Free Installation, and Shatterproof Protection',
    category: 'accessories',
    subcategory: 'screen-protector'
  },
  {
    filename: 'CUR-20260430-002.md',
    product_id: '605729989734574',
    source_platform: 'Temu',
    source_url: 'https://www.temu.com/Mini-Screwdriver-Set-Flat-and-Phillips-Small-Screwdriver-Set-Suitable-for-Electronics-Jewelry-Computers-Eyeglasses-Watches-Mobile-Phones-DIY-Projects-Computer-Repair-g-0-0095011830000000050000000000000-6010110932000071001000000000000000060000000000000.html',
    original_title: 'Mini Screwdriver Set, Flat and Phillips Small Screwdriver Set, Suitable for Electronics, Jewelry, Computers, Eyeglasses, Watches, Mobile Phones - DIY Projects - Computer Repair',
    category: 'tools',
    subcategory: 'repair-kit'
  },
  {
    filename: 'CUR-20260430-003.md',
    product_id: '606314105289849',
    source_platform: 'Temu',
    source_url: 'https://www.temu.com/Creative-Deer-Head-360-Rotating-Stainless-Steel-Phone-Lanyard-Connector-Ultra-Thin-Metal-Clip-Won-t-Damage-Your-Phone-Safe-Wrist-Strap-for-Phone-Case-Universal-Phone-Accessories-g-0-0095011830000000050000000000000-6010110932000071001000000000000000060000000000000.html',
    original_title: 'Creative Deer Head 360° Rotating Stainless Steel Phone Lanyard Connector, Ultra-Thin Metal Clip, Won\'t Damage Your Phone, Safe Wrist Strap for Phone Case, Universal Phone Accessories',
    category: 'accessories',
    subcategory: 'lanyard'
  },
  {
    filename: 'CUR-20260430-004.md',
    product_id: '601104050241705',
    source_platform: 'Temu',
    source_url: 'https://www.temu.com/1pc-Angry-Little-Penguin-Transparent-Space-Phone-Anti-Fall-Protection-Case-Suitable-for-iPhone-11-12-13-14-15-16-17-XS-XR-X-7-8-Plus-Pro-Max-SE-Series-g-0-0095011830000000050000000000000-6010110932000071001000000000000000060000000000000.html',
    original_title: '1pc Angry Little Penguin Transparent Space Phone Anti-Fall Protection Case, Suitable for iPhone 11 12 13 14 15 16 17 XS XR X 7 8 Plus Pro Max SE Series',
    category: 'accessories',
    subcategory: 'phone-case'
  }
];

// 从 markdown 提取完整推广文案 (summary)
function extractSummary(markdownContent) {
  // 提取 Curated Marketing Copy 部分作为 summary
  // 保留完整的 markdown 格式和 emoji
  const startMarker = '## Curated Marketing Copy (English)';
  const endMarker = '---';
  const endMarker2 = '## Multi-Dimensional Tags';

  const startIdx = markdownContent.indexOf(startMarker);
  if (startIdx === -1) return '';

  // 找到结束位置
  let endIdx = markdownContent.indexOf(endMarker2, startIdx);
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf(endMarker, startIdx + startMarker.length);
    if (endIdx !== -1) {
      // 继续往后找
      const nextEnd = markdownContent.indexOf(endMarker2, endIdx);
      if (nextEnd !== -1) endIdx = nextEnd;
    }
  }

  if (endIdx === -1) {
    endIdx = markdownContent.length;
  }

  let summary = markdownContent.substring(startIdx, endIdx).trim();

  return summary;
}

// 解析多维度标签
function extractTags(markdownContent) {
  const tags = [];
  const tagPattern = /#[\w-]+/g;
  const matches = markdownContent.match(tagPattern);
  if (matches) {
    // 去重
    const uniqueTags = [...new Set(matches)];
    tags.push(...uniqueTags);
  }
  return tags;
}

// 提取标题
function extractTitle(markdownContent) {
  const match = markdownContent.match(/### Headline\s*\n\s*\*\*(.+?)\*\*/);
  if (match && match[1]) {
    return match[1].trim();
  }
  return '';
}

// 提取价格
function extractPrice(markdownContent) {
  const match = markdownContent.match(/\*\*Price Range\*\*:\s*\$?([\d.]+)\s*(?:-|\-|to)\s*\$?([\d.]+)?/);
  if (match) {
    return {
      price_min: parseFloat(match[1]),
      price_max: match[2] ? parseFloat(match[2]) : parseFloat(match[1])
    };
  }
  // 另一种格式
  const match2 = markdownContent.match(/\$([\d.]+)\s*(?:-|\-|to)\s*\$([\d.]+)/);
  if (match2) {
    return {
      price_min: parseFloat(match2[1]),
      price_max: parseFloat(match2[2])
    };
  }
  const singlePrice = markdownContent.match(/\$\s*([\d.]+)/);
  if (singlePrice) {
    return {
      price_min: parseFloat(singlePrice[1]),
      price_max: parseFloat(singlePrice[1])
    };
  }
  return { price_min: null, price_max: null };
}

// 创建商品
async function createProduct(product) {
  const response = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify(product)
  });

  const result = await response.json();
  return result;
}

// 创建标签
async function createTag(tagData) {
  const response = await fetch(`${API_BASE}/admin/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify(tagData)
  });

  const result = await response.json();
  return result;
}

// 更新商品标签
async function updateProductTags(productId, tags) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ tags })
  });

  const result = await response.json();
  return result;
}

// 生成标签 slug
function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// 主函数
async function main() {
  const fs = require('fs');
  const path = require('path');

  console.log('=== Findora 2026-04-30 商品上架开始 ===\n');

  const createdTags = new Set();
  const allProductTags = [];

  // 第一步：读取所有 md 文件并准备商品数据
  console.log('📖 读取商品文件...\n');
  const productData = [];

  for (const product of products) {
    const filePath = path.join(process.cwd(), 'operations/pass/2026-04-30', product.filename);
    console.log(`处理: ${product.filename}`);

    try {
      const mdContent = fs.readFileSync(filePath, 'utf-8');

      // 提取数据
      const summary = extractSummary(mdContent);
      const tags = extractTags(mdContent);
      const title = extractTitle(mdContent) || product.original_title.substring(0, 80);
      const price = extractPrice(mdContent);

      // 准备 summary 字段
      const summaryData = {
        headline: title,
        markdown: summary
      };

      productData.push({
        ...product,
        title,
        summary: JSON.stringify(summaryData),
        tags,
        price_min: price.price_min,
        price_max: price.price_max
      });

      console.log(`  ✅ 标题: ${title.substring(0, 50)}...`);
      console.log(`  📊 标签数量: ${tags.length}`);
      console.log(`  💰 价格: $${price.price_min} - $${price.price_max}`);
      console.log(`  📝 Summary长度: ${summary.length} 字符\n`);

      allProductTags.push(...tags);

    } catch (err) {
      console.error(`  ❌ 读取失败: ${err.message}\n`);
    }
  }

  // 第二步：收集需要创建的标签
  console.log('\n🏷️ 分析标签体系...');
  const uniqueTags = [...new Set(allProductTags)];
  console.log(`   总计 ${uniqueTags.length} 个唯一标签`);

  // 第三步：上架商品
  console.log('\n🚀 开始上架商品...\n');

  for (let i = 0; i < productData.length; i++) {
    const product = productData[i];
    console.log(`[${i + 1}/${productData.length}] 上架: ${product.filename}`);

    try {
      // 构建 API 请求
      const apiPayload = {
        source_platform: product.source_platform,
        source_url: product.source_url,
        original_title: product.original_title,
        title: product.title,
        category: product.category,
        subcategory: product.subcategory,
        price_min: product.price_min,
        price_max: product.price_max,
        currency: 'USD',
        summary: product.summary, // 完整推广文案
        tags: product.tags,
        source_md: fs.readFileSync(
          path.join(process.cwd(), 'operations/pass/2026-04-30', product.filename),
          'utf-8'
        ),
        source_filename: product.filename
      };

      const result = await createProduct(apiPayload);

      if (result.ok) {
        console.log(`  ✅ 上架成功!`);
        console.log(`     Product ID: ${result.data.id}`);
        console.log(`     R2 Key: ${result.data.r2_object_key || 'N/A'}\n`);
      } else {
        console.log(`  ❌ 上架失败: ${JSON.stringify(result.error)}\n`);
      }
    } catch (err) {
      console.error(`  ❌ API调用失败: ${err.message}\n`);
    }

    // 延迟
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('=== 商品上架完成 ===');
}

main().catch(console.error);