#!/usr/bin/env node

/**
 * Findora 商品上架脚本 - 2026-04-27批次
 * Operator Agent 使用：将 PASS 目录的商品上架到 Findora
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

const fs = require('fs');
const path = require('path');

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

// 从markdown提取summary（策划文案部分）
function extractSummary(markdownContent) {
  // 提取策划文案部分
  const startIdx = markdownContent.indexOf('## 策划文案');
  if (startIdx === -1) return '';

  // 找到下一个 ## 标记或文件结束
  let endIdx = markdownContent.indexOf('\n## ', startIdx + 1);
  if (endIdx === -1) {
    endIdx = markdownContent.length;
  }

  let summary = markdownContent.substring(startIdx, endIdx).trim();
  // 移除"## 策划文案"标题行
  summary = summary.replace(/^## 策划文案\n\n?/, '');

  return summary;
}

// 解析标签 - 从多维度标签表格提取
function extractTags(markdownContent) {
  const tags = [];

  // 提取多维度标签表格部分
  const tagSectionMatch = markdownContent.match(/## 多维度标签\n[\s\S]*?(?=\n---)/);
  if (!tagSectionMatch) {
    console.log('  ⚠️ 未找到标签矩阵部分');
    return tags;
  }

  const tagSection = tagSectionMatch[0];

  // 提取所有 | 维度 | 标签 | 行中的标签
  const lines = tagSection.split('\n');
  for (const line of lines) {
    // 匹配表格行: | 平台 | Temu Bestseller |
    const rowMatch = line.match(/^\|\s*[\*\*]*[一-龥a-zA-Z ]+[\*\*]*\s*\|\s*([\w\s-]+(?:\s*,\s*[\w\s-]+)*)\s*\|/);
    if (rowMatch && rowMatch[1]) {
      const rowTags = rowMatch[1].split(',').map(t => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(t => t && t.length > 1);
      tags.push(...rowTags);
    }
  }

  return [...new Set(tags)]; // 去重
}

// 从markdown提取商品基本信息
function parseProduct(mdContent, sourceFilename) {
  // 提取基本信息
  const lines = mdContent.split('\n');
  let platform = '', category = '', productId = '', title = '', priceMin = 0, priceMax = 0, currency = 'USD', image = '';

  for (const line of lines) {
    if (line.includes('平台') && line.includes('|')) {
      const match = line.match(/\|.*平台.*\|\s*([^\|]+)\s*\|/);
      if (match) platform = match[1].trim();
    }
    if (line.includes('类目') && line.includes('|')) {
      const match = line.match(/\|.*类目.*\|\s*([^\|]+)\s*\|/);
      if (match) category = match[1].trim();
    }
    if (line.includes('商品ID') && line.includes('|')) {
      const match = line.match(/\|.*商品ID.*\|\s*([^\|]+)\s*\|/);
      if (match) productId = match[1].trim();
    }
    if (line.includes('**英文名称**')) {
      const match = line.match(/\*\*英文名称\*\*:\s*(.+)/);
      if (match) title = match[1].trim();
    }
    if (line.includes('价格区间') && line.includes('$')) {
      const match = line.match(/\$[\d.]+/g);
      if (match && match.length >= 1) {
        priceMin = parseFloat(match[0].replace('$', ''));
        if (match.length >= 2) priceMax = parseFloat(match[1].replace('$', ''));
        else priceMax = priceMin;
      }
    }
    if (line.includes('价格') && !line.includes('价格区间') && line.includes('$')) {
      const match = line.match(/\$[\d.]+/);
      if (match && priceMin === 0) {
        priceMin = parseFloat(match[0].replace('$', ''));
        priceMax = priceMin;
      }
    }
    if (line.includes('图片')) {
      const match = line.match(/https?:\/\/[^\s]+\.(jpg|jpeg|png|webp)/i);
      if (match) image = match[0];
    }
  }

  // 提取原始标题
  const originalTitleMatch = mdContent.match(/\*\*英文名称\*\*:\s*(.+)/);
  const originalTitle = originalTitleMatch ? originalTitleMatch[1].trim() : '';

  // 提取来源URL
  let sourceUrl = '';
  const urlMatch = mdContent.match(/详情页:\s*(https?:\/\/[^\s]+)/);
  if (urlMatch) sourceUrl = urlMatch[1].trim();

  // 映射类目
  const categoryMap = {
    '玩具与游戏': 'toys',
    '杂货店': 'grocery',
    '女装': 'fashion',
    '照明灯饰': 'lighting',
    'Home Improvement (家居装修)': 'home'
  };

  const subcategoryMap = {
    '玩具与游戏': 'games',
    '杂货店': 'beverage',
    '女装': 'tops',
    '照明灯饰': 'lights',
    'Home Improvement (家居装修)': 'lighting'
  };

  // 映射平台
  const platformMap = {
    'Temu': 'temu',
    'Amazon': 'amazon',
    'Shein': 'shein',
    'Sumaitong (速卖通)': 'aliexpress',
    'TikTok': 'tiktok'
  };

  return {
    source_platform: platformMap[platform] || platform,
    source_url: sourceUrl,
    original_title: originalTitle,
    title: originalTitle.split(',')[0].split('(')[0].trim(), // 使用原始名称作为默认标题
    category: categoryMap[category] || 'general',
    subcategory: subcategoryMap[category] || 'other',
    price_min: priceMin || 5,
    price_max: priceMax || priceMin || 5,
    currency: currency,
    cover_image: image,
    source_md: mdContent,
    source_filename: sourceFilename
  };
}

// 主函数
async function main() {
  const passDir = 'operations/pass/2026-04-27';

  // 本次需要上架的商品
  const sourceFiles = [
    '20260427-001.md',
    '20260427-002.md',
    '20260427-007.md',
    '20260427-008.md',
    '20260427-010.md'
  ];

  console.log('=== Findora 商品上架开始 (2026-04-27批次) ===\n');

  for (let i = 0; i < sourceFiles.length; i++) {
    const sourceFilename = sourceFiles[i];
    const filePath = path.join(process.cwd(), passDir, sourceFilename);

    console.log(`\n[${i + 1}/${sourceFiles.length}] 处理: ${sourceFilename}`);

    // 读取md文件
    try {
      const mdContent = fs.readFileSync(filePath, 'utf-8');
      const product = parseProduct(mdContent, sourceFilename);

      // 提取summary（推广文案）
      const summary = extractSummary(mdContent);
      product.summary = summary;

      // 提取tags
      const tags = extractTags(mdContent);
      product.tags = tags;

      console.log(`  - 标题: ${product.title.substring(0, 50)}...`);
      console.log(`  - 平台: ${product.source_platform}`);
      console.log(`  - 价格: $${product.price_min}-${product.price_max}`);
      console.log(`  - 图片: ${product.cover_image.substring(0, 60)}...`);
      console.log(`  - 标签数量: ${tags.length}`);
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
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== 商品上架完成 ===');
}

main().catch(console.error);
