/**
 * Findora 商品上架脚本
 * 读取 operations/pass/YYYY-MM-DD 目录下的 .md 文件，上架到 Findora API
 */

import { readdir, readFile } from 'node:fs/promises';
import { join, basename } from 'node:path';

// ===== 配置 =====
const API_BASE = 'https://findora.turingcorp.net/api';
const PASS_DIR = './operations/pass/2026-04-29';
const ADMIN_KEY = process.env.ADMIN_KEY || 'YOUR_ADMIN_KEY_HERE';

// ===== 工具函数 =====

/**
 * 从 MD 文件内容中提取信息
 */
function parseMarkdown(content: string, filename: string) {
  // 提取标题
  const titleMatch = content.match(/^#\s+.+-\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : filename;

  // 提取商品名称
  const productNameMatch = content.match(/##\s+商品名称\s*\n\s*\n(.+)/);
  const productName = productNameMatch ? productNameMatch[1].trim() : title;

  // 提取平台
  const platformMatch = content.match(/\|\s*平台\s*\|\s*(.+)\s*\|/);
  const platform = platformMatch ? platformMatch[1].trim() : '';

  // 提取商品ID
  const productIdMatch = content.match(/\|\s*商品ID\s*\|\s*(.+)\s*\|/);
  const productId = productIdMatch ? productIdMatch[1].trim() : '';

  // 提取价格
  const priceMatch = content.match(/\|\s*价格\s*\|\s*\$?([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // 提取链接
  const urlMatch = content.match(/https?:\/\/[^\s]+\.(?:com|net|html)[^\s]*/);
  const sourceUrl = urlMatch ? urlMatch[0].trim() : '';

  // 提取图片
  const imageMatch = content.match(/!\[商品图片\]\(([^)]+)\)/);
  const coverImage = imageMatch ? imageMatch[1].trim() : '';

  // 提取类目
  const categoryMatch = content.match(/\|\s*类目\s*\|\s*(.+)\s*\|/);
  const category = categoryMatch ? categoryMatch[1].trim() : 'general';

  // 提取二次策划的推广文案（Headline + Sub-headline + Body Copy）
  const summaryMatch = content.match(/##\s+二次策划\s+-\s+推广文案\s*([\s\S]+?)(?=##\s+多维度标签|$)/);
  const summary = summaryMatch ? summaryMatch[1].trim() : '';

  // 提取标签（从多维度标签表格）
  const tags: string[] = [];
  const tagMatches = content.matchAll(/\|\s*标签名称\s*\|\n\|[-\s|]+\|\n((?:.+\|\n?)+?)(?=\n\|[^|]+\|标签类型|$)/g);
  for (const match of tagMatches) {
    const tagLines = match[1].split('\n');
    for (const line of tagLines) {
      const tagName = line.replace(/\|/g, '').trim();
      if (tagName && tagName !== '标签名称') {
        tags.push(tagName);
      }
    }
  }

  // 额外提取标签表格内容
  const allTagsMatch = content.match(/##\s+多维度标签\s*\|[\s\S]+?\n\|[-\s|]+\|([\s\S]+?)(?=##\s+来源链接|$)/);
  if (allTagsMatch) {
    const tagLines = allTagsMatch[1].split('\n');
    for (const line of tagLines) {
      const tagName = line.replace(/\|/g, '').trim();
      if (tagName) {
        tags.push(tagName);
      }
    }
  }

  // 清理重复标签
  const uniqueTags = [...new Set(tags)].filter(t => t && t !== '标签名称');

  // 映射平台名称
  const platformMap: Record<string, string> = {
    'Shein': 'shein',
    'Temu': 'temu',
    'Amazon': 'amazon',
    '速卖通': 'sumaitong',
    'TikTok': 'tiktok',
  };
  const sourcePlatform = platformMap[platform] || platform.toLowerCase();

  // 映射类目
  const categoryMap: Record<string, string> = {
    '办公和学校用品': 'stationery',
    '美容和个人护理': 'beauty',
    '家居用品': 'home',
    '婚礼及重要场合': 'wedding',
  };
  const mappedCategory = categoryMap[category] || category.toLowerCase();

  return {
    source_platform: sourcePlatform,
    source_url: sourceUrl,
    original_title: productName,
    title: productName,
    category: mappedCategory,
    price_min: price,
    price_max: price,
    currency: 'USD',
    cover_image: coverImage.startsWith('//') ? 'https:' + coverImage : coverImage,
    summary: summary,
    tags: uniqueTags,
    source_md: content,
    source_filename: filename,
  };
}

/**
 * 调用 API 创建商品
 */
async function createProduct(product: ReturnType<typeof parseMarkdown>) {
  const response = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY,
    },
    body: JSON.stringify(product),
  });

  const result = await response.json();
  return { status: response.status, data: result };
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始上架商品...\n');

  // 读取 pass 目录下的所有 .md 文件
  const files = await readdir(PASS_DIR);
  const mdFiles = files.filter(f => f.endsWith('.md'));

  console.log(`📁 找到 ${mdFiles.length} 个商品文件\n`);

  const results: Array<{ file: string; success: boolean; data?: unknown; error?: string }> = [];

  for (const file of mdFiles) {
    const filePath = join(PASS_DIR, file);
    console.log(`\n📦 处理: ${file}`);

    try {
      const content = await readFile(filePath, 'utf-8');
      const product = parseMarkdown(content, file);

      console.log(`   标题: ${product.title}`);
      console.log(`   平台: ${product.source_platform}`);
      console.log(`   价格: $${product.price_min}`);
      console.log(`   标签: ${product.tags.slice(0, 5).join(', ')}...`);

      const result = await createProduct(product);
      console.log(`   状态: ${result.status}`);

      if (result.status === 200 || result.status === 201) {
        console.log(`   ✅ 成功: ${JSON.stringify(result.data)}`);
        results.push({ file, success: true, data: result.data });
      } else {
        console.log(`   ❌ 失败: ${JSON.stringify(result.data)}`);
        results.push({ file, success: false, error: JSON.stringify(result.data) });
      }
    } catch (error) {
      console.log(`   ❌ 错误: ${error}`);
      results.push({ file, success: false, error: String(error) });
    }
  }

  // 总结
  console.log('\n========== 上架结果 ==========\n');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log(`成功: ${successCount}/${mdFiles.length}`);
  console.log(`失败: ${failCount}/${mdFiles.length}`);

  if (failCount > 0) {
    console.log('\n失败详情:');
    for (const r of results.filter(r => !r.success)) {
      console.log(`  - ${r.file}: ${r.error}`);
    }
  }

  console.log('\n✅ 上架完成!');
}

main().catch(console.error);
