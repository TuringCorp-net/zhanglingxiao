/**
 * 运营总监 - 商品上架脚本
 * 读取 pass/2026-05-03 目录下的商品文件，上架到 Findora 数据库
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 平台映射
const PLATFORM_MAP = {
  'Shein': 'shein',
  'Temu': 'temu',
  '速卖通': 'sumaitong',
  'Amazon': 'amazon',
  'TikTok': 'tiktok'
};

// 提取商品信息的函数
function extractProductInfo(mdContent, filename) {
  // 提取原始标题
  const titleMatch = mdContent.match(/\|\s*名称\s*\|\s*([^\n|]+)\s*\|/);
  const originalTitle = titleMatch ? titleMatch[1].trim() : filename;

  // 提取平台
  const platformMatch = mdContent.match(/\|\s*平台\s*\|\s*([^\n|]+)\s*\|/);
  const platformRaw = platformMatch ? platformMatch[1].trim() : 'unknown';
  const platform = PLATFORM_MAP[platformRaw] || 'unknown';

  // 提取类目
  const categoryMatch = mdContent.match(/\|\s*类目\s*\|\s*([^\n|]+)\s*\|/);
  const category = categoryMatch ? categoryMatch[1].trim() : 'uncategorized';

  // 提取价格
  const priceMatch = mdContent.match(/\|\s*价格\s*\|\s*\$?([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // 提取缩略图
  const imageMatch = mdContent.match(/\|\s*缩略图\s*\|\s*([^\n|]+)\s*\|/);
  const coverImage = imageMatch ? 'https:' + imageMatch[1].trim().replace(/^\/\//, '') : '';

  // 提取销量
  const salesMatch = mdContent.match(/\|\s*销量\s*\|\s*(\d+)/);
  const sales = salesMatch ? parseInt(salesMatch[1]) : 0;

  // 提取推广文案
  const summaryMatch = mdContent.match(/## 推广文案（Curator 二次策划）[\s\S]*?(?=## 多维度标签矩阵|## 文件信息|$)/);
  const summary = summaryMatch ? summaryMatch[0].trim() : '';

  // 提取标签
  const tags = [];
  const tagMatches = mdContent.matchAll(/\|\s*标签内容\s*\|\s*([^\n|]+)\s*\|/g);
  for (const match of tagMatches) {
    const tagStr = match[1].trim();
    if (tagStr && tagStr !== '标签内容') {
      const individualTags = tagStr.split(',').map(t => t.trim()).filter(t => t);
      tags.push(...individualTags);
    }
  }

  // 生成source_url（从缩略图推断）
  const sourceUrl = coverImage ? `https://${coverImage.split('?')[0]}` : '';

  return {
    originalTitle,
    platform,
    category,
    price,
    coverImage: coverImage ? 'https://' + coverImage : '',
    sales,
    summary,
    tags: [...new Set(tags)].slice(0, 20), // 去重并限制数量
    sourceUrl,
    filename
  };
}

// 调用 API 创建商品
async function createProduct(product) {
  const response = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST',
    headers: {
      'X-Admin-Key': ADMIN_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      source_platform: product.platform,
      source_url: product.sourceUrl || `https://example.com/${product.filename}`,
      original_title: product.originalTitle,
      title: product.originalTitle,
      category: product.category.toLowerCase().replace(/\s+/g, '-'),
      tags: product.tags,
      price_min: product.price,
      price_max: product.price,
      currency: 'USD',
      cover_image: product.coverImage,
      summary: product.summary,
      source_md: product.mdContent,
      source_filename: product.filename
    })
  });

  return response.json();
}

// 更新商品标签
async function updateProductTags(productId, tags) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
    method: 'PATCH',
    headers: {
      'X-Admin-Key': ADMIN_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tags })
  });

  return response.json();
}

// 主函数
async function main() {
  // 读取pass目录中的商品文件
  const passDir = 'operations/pass/2026-05-03';
  const fs = require('fs');
  const path = require('path');

  console.log('=== 运营总监商品上架任务 ===\n');

  // 获取目录下所有.md文件
  const files = fs.readdirSync(passDir).filter(f => f.endsWith('.md'));
  console.log(`找到 ${files.length} 个待上架商品:\n`);

  const results = [];

  for (const file of files) {
    const filePath = path.join(passDir, file);
    const mdContent = fs.readFileSync(filePath, 'utf-8');
    const product = extractProductInfo(mdContent, file);
    product.mdContent = mdContent;

    console.log(`处理商品: ${file}`);
    console.log(`  - 标题: ${product.originalTitle}`);
    console.log(`  - 平台: ${product.platform}`);
    console.log(`  - 类目: ${product.category}`);
    console.log(`  - 价格: $${product.price}`);
    console.log(`  - 标签数量: ${product.tags.length}`);
    console.log('');

    try {
      const result = await createProduct(product);
      if (result.ok) {
        console.log(`  ✓ 上架成功: ${result.data.id}`);
        results.push({ file, status: 'success', id: result.data.id });

        // 更新标签
        if (product.tags.length > 0) {
          await updateProductTags(result.data.id, product.tags);
        }
      } else {
        console.log(`  ✗ 上架失败: ${JSON.stringify(result.error)}`);
        results.push({ file, status: 'failed', error: result.error });
      }
    } catch (err) {
      console.log(`  ✗ 上架异常: ${err.message}`);
      results.push({ file, status: 'error', error: err.message });
    }
  }

  console.log('\n=== 上架完成 ===');
  console.log(`成功: ${results.filter(r => r.status === 'success').length}`);
  console.log(`失败: ${results.filter(r => r.status !== 'success').length}`);
}

// 运行
main().catch(console.error);