#!/usr/bin/env node

/**
 * Findora 商品上架脚本 - 2026-05-04
 * Operator Agent 使用：将 PASS 目录的商品上架到 Findora
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

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

// 从markdown提取summary（推广文案部分）
function extractSummary(markdownContent) {
  // 查找 "## Curated Marketing Copy" 开始
  const startIdx = markdownContent.indexOf('# Curated Marketing Copy');
  if (startIdx === -1) return markdownContent;

  // 找到下一个 ## 或文件结束
  let endIdx = markdownContent.indexOf('\n## ', startIdx + 1);
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf('\n\n## ', startIdx + 1);
  }
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf('\n\n---\n', startIdx + 1);
  }
  if (endIdx === -1) {
    endIdx = markdownContent.length;
  }

  let summary = markdownContent.substring(startIdx, endIdx).trim();
  // 移除标题行
  summary = summary.replace(/^# Curated Marketing Copy\n\n?/, '');

  return summary;
}

// 解析标签
function extractTags(markdownContent) {
  const tags = [];

  // 提取 Multi-dimensional Tags 行
  const tagLineMatch = markdownContent.match(/## Multi-dimensional Tags\n\n([^\n#]+)/);
  if (tagLineMatch && tagLineMatch[1]) {
    const lineTags = tagLineMatch[1].split(' ')
      .map(t => t.replace(/^#/, '').trim())
      .filter(t => t && t.length > 1);
    tags.push(...lineTags);
  }

  return tags;
}

// 主函数
async function main() {
  const fs = require('fs');
  const path = require('path');

  const passDir = path.join(process.cwd(), 'operations/pass/2026-05-04');

  console.log('=== Findora 商品上架开始 (2026-05-04) ===\n');

  // 读取目录下的所有md文件
  const files = fs.readdirSync(passDir).filter(f => f.endsWith('.md'));
  console.log(`找到 ${files.length} 个商品文件\n`);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(passDir, filename);

    console.log(`[${i + 1}/${files.length}] 处理: ${filename}`);

    // 读取md文件
    try {
      const mdContent = fs.readFileSync(filePath, 'utf-8');

      // 解析frontmatter
      const fmMatch = mdContent.match(/^---\n([\s\S]*?)\n---/);
      if (!fmMatch) {
        console.log('  ⚠️ 未找到frontmatter');
        continue;
      }

      const frontmatter = {};
      fmMatch[1].split('\n').forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.substring(0, colonIdx).trim();
          const value = line.substring(colonIdx + 1).trim();
          frontmatter[key] = value;
        }
      });

      // 解析价格
      const priceStr = frontmatter.price || '';
      let priceMin = 0, priceMax = 0;
      if (priceStr.includes('~')) {
        const prices = priceStr.split('~').map(p => parseFloat(p.replace(/[^0-9.]/g, '')));
        priceMin = prices[0] || 0;
        priceMax = prices[1] || priceMin;
      } else {
        priceMin = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;
        priceMax = priceMin;
      }

      // 提取封面图
      const imageMatch = mdContent.match(/!\[商品图片\]\(([^)]+)\)/);
      const coverImage = imageMatch ? imageMatch[1] : '';

      // 构建source_url
      const platform = frontmatter.platform || '';
      const goodsId = frontmatter.goodsId || '';
      let sourceUrl = '';
      if (platform === 'temu') {
        sourceUrl = `https://www.temu.com/g-${goodsId}.html`;
      } else if (platform === 'shein') {
        sourceUrl = `https://www.shein.com/item-${goodsId}.html`;
      } else if (platform === 'amazon') {
        sourceUrl = `https://www.amazon.com/dp/${goodsId}`;
      } else if (platform === 'sumaitong') {
        sourceUrl = `https://www.aliexpress.com/item/${goodsId}.html`;
      } else {
        sourceUrl = `https://example.com/product/${goodsId}`;
      }

      // 提取summary和tags
      const summary = extractSummary(mdContent);
      const tags = extractTags(mdContent);

      // 构建category映射
      const categoryMap = {
        'temu': 'Kitchenware',
        'shein': 'Kids Fashion',
        'amazon': 'Electronics',
        'sumaitong': 'Home Decor',
        'tiktok': 'Trending'
      };
      const mainCategory = categoryMap[platform] || 'General';

      const product = {
        source_platform: platform,
        source_url: sourceUrl,
        original_title: frontmatter.title || '',
        title: frontmatter.title || '',
        category: mainCategory,
        subcategory: frontmatter.category || '',
        price_min: priceMin,
        price_max: priceMax,
        currency: 'USD',
        cover_image: coverImage,
        summary: summary,
        source_md: mdContent,
        source_filename: filename,
        tags: tags
      };

      console.log(`  - 平台: ${platform}`);
      console.log(`  - 类目: ${mainCategory}`);
      console.log(`  - 价格: $${priceMin}`);
      console.log(`  - 标签: ${tags.slice(0, 5).join(', ')}${tags.length > 5 ? '...' : ''}`);
      console.log(`  - Summary长度: ${summary.length} 字符`);

      // 创建商品
      try {
        console.log('  - 正在上传到Findora API...');
        const result = await createProduct(product);

        if (result.ok) {
          console.log(`  ✅ 上架成功! Product ID: ${result.data.id}`);
          console.log(`     R2 Key: ${result.data.r2_object_key || 'N/A'}`);
        } else {
          console.log(`  ❌ 上架失败: ${JSON.stringify(result.error)}`);
        }
      } catch (err) {
        console.error(`  ❌ API调用失败: ${err.message}`);
      }

    } catch (err) {
      console.error(`  ❌ 读取文件失败: ${err.message}`);
    }

    // 延迟避免请求过快
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n=== 商品上架完成 ===');
}

main().catch(console.error);