#!/usr/bin/env node

/**
 * Findora 商品上架脚本 - 2026-05-04 (下午批次)
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

// 从 markdown 内容提取推广文案 (summary)
function extractSummary(markdownContent) {
  // 查找 "### 推广文案（英文）" 或 "### Curated Marketing Copy"
  const markers = ['### 推广文案（英文）', '### Curated Marketing Copy', '### 英文推广文案'];
  let startIdx = -1;
  for (const marker of markers) {
    const idx = markdownContent.indexOf(marker);
    if (idx !== -1) {
      startIdx = idx + marker.length;
      break;
    }
  }
  if (startIdx === -1) {
    // 尝试查找 "推广文案" 段落
    const promoIdx = markdownContent.indexOf('推广文案');
    if (promoIdx !== -1) {
      // 从推广文案开始到下一个 ## 结束
      startIdx = promoIdx;
    } else {
      return markdownContent.substring(0, 2000); // 返回前2000字符
    }
  }

  // 从标记后开始，找到下一个 ### 或 --- 或文件结束
  let searchStart = startIdx;
  let endIdx = markdownContent.indexOf('\n### ', searchStart);
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf('\n---', searchStart);
  }
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf('\n## 备注', searchStart);
  }
  if (endIdx === -1) {
    endIdx = markdownContent.length;
  }

  let summary = markdownContent.substring(startIdx, endIdx).trim();
  // 移除可能的标题行
  summary = summary.replace(/^### 推广文案[（(]英文[)）]\n/, '');
  summary = summary.replace(/^### Curated Marketing Copy\n/, '');
  summary = summary.replace(/^推广文案\n/, '');

  return summary;
}

// 从 markdown 内容提取多维度标签
function extractTags(markdownContent) {
  const tags = [];

  // 查找多维度标签表格 (支持中英文)
  const markers = ['| 维度 | 标签 |', '| Dimension | Tags |', '### 多维度标签', '### Multi-dimensional Tags'];
  let tableStart = -1;
  for (const marker of markers) {
    const idx = markdownContent.indexOf(marker);
    if (idx !== -1) {
      tableStart = idx;
      break;
    }
  }
  if (tableStart === -1) return tags;

  // 解析表格行，提取标签
  const tableSection = markdownContent.substring(tableStart);
  const rows = tableSection.split('\n');

  for (const row of rows) {
    // 跳过表头、分隔线和空行
    if (row.includes('|---') || row.trim() === '' || row.includes('维度') || row.includes('Dimension')) continue;

    // 提取标签值（通常第二列，包含逗号分隔的多个标签）
    const cells = row.split('|').map(c => c.trim()).filter(c => c);
    if (cells.length >= 2 && cells[1]) {
      // 分割逗号或顿号分隔的标签
      let rowTags = cells[1].split(/[,，]/).map(t => t.trim()).filter(t => t && t.length > 1);
      tags.push(...rowTags);
    }
  }

  // 去重并清理
  return [...new Set(tags)].filter(t => !t.includes('|') && t.length < 50);
}

// 主函数
async function main() {
  const fs = require('fs');
  const path = require('path');

  const passDir = path.join(process.cwd(), 'operations/pass/2026-05-04');

  console.log('=== Findora 商品上架开始 (2026-05-04 下午批次) ===\n');

  // 读取目录下的所有md文件
  const files = fs.readdirSync(passDir).filter(f => f.endsWith('.md'));
  console.log(`找到 ${files.length} 个商品文件\n`);

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const filePath = path.join(passDir, filename);

    console.log(`[${i + 1}/${files.length}] 处理: ${filename}`);

    try {
      const mdContent = fs.readFileSync(filePath, 'utf-8');

      // 解析基本信息表格
      const getField = (label) => {
        const match = mdContent.match(new RegExp(`\\*\\*${label}\\*\\*\\s*[|\\s]*(.+?)($|\\n)`, 'i'));
        return match ? match[1].trim() : '';
      };

      const productId = getField('商品编号');
      const title = getField('商品名称');
      const platform = getField('平台');
      const goodsId = getField('商品ID');

      // 解析数据指标
      const getMetric = (label) => {
        const match = mdContent.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*([\\d,.]+)`));
        return match ? match[1].trim() : '';
      };
      const priceRange = getMetric('价格区间');

      // 解析价格
      let priceMin = 0, priceMax = 0;
      if (priceRange) {
        const prices = priceRange.replace(/[^0-9.~]/g, '').split('~');
        priceMin = parseFloat(prices[0]) || 0;
        priceMax = parseFloat(prices[1]) || priceMin;
      }

      // 提取封面图
      const imageMatch = mdContent.match(/!\[商品图片\]\(([^)]+)\)/);
      const coverImage = imageMatch ? imageMatch[1] : '';

      // 构建 source_url
      let sourceUrl = '';
      if (platform.toLowerCase() === 'temu') {
        sourceUrl = `https://www.temu.com/g-${goodsId}.html`;
      } else if (platform.toLowerCase() === 'shein') {
        sourceUrl = `https://www.shein.com/item-${goodsId}.html`;
      } else if (platform.toLowerCase() === 'amazon') {
        sourceUrl = `https://www.amazon.com/dp/${goodsId}`;
      } else {
        sourceUrl = `https://example.com/product/${goodsId}`;
      }

      // 提取 summary 和 tags
      const summary = extractSummary(mdContent);
      const tags = extractTags(mdContent);

      // 分类映射
      const categoryMap = {
        'Temu': 'Toys & Games',
        'Shein': 'Fashion',
        'Amazon': 'Electronics',
        'AliExpress': 'Home Goods'
      };
      const mainCategory = categoryMap[platform] || 'General';

      // 商品分类（从商品名称推断）
      let subcategory = 'General';
      if (title.toLowerCase().includes('game') || title.toLowerCase().includes('toy')) {
        subcategory = 'Board Games';
      } else if (title.toLowerCase().includes('earring') || title.toLowerCase().includes('jewelry')) {
        subcategory = 'Jewelry';
      } else if (title.toLowerCase().includes('blocks') || title.toLowerCase().includes('building')) {
        subcategory = 'Building Toys';
      } else if (title.toLowerCase().includes('stand') || title.toLowerCase().includes('tablet')) {
        subcategory = 'Tablet Accessories';
      } else if (title.toLowerCase().includes('notebook') || title.toLowerCase().includes('magic')) {
        subcategory = 'Educational Toys';
      } else if (title.toLowerCase().includes('car') || title.toLowerCase().includes('stunt')) {
        subcategory = 'Miniature Toys';
      }

      const product = {
        source_platform: platform,
        source_url: sourceUrl,
        original_title: title,
        title: title,
        category: mainCategory,
        subcategory: subcategory,
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
      console.log(`  - 商品: ${title.substring(0, 50)}${title.length > 50 ? '...' : ''}`);
      console.log(`  - 类目: ${mainCategory} > ${subcategory}`);
      console.log(`  - 价格: $${priceMin}${priceMax !== priceMin ? ` - $${priceMax}` : ''}`);
      console.log(`  - 标签数: ${tags.length}`);
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
      console.error(`  ❌ 处理失败: ${err.message}`);
    }

    // 延迟避免请求过快
    if (i < files.length - 1) {
      await new Promise(r => setTimeout(r, 800));
    }

    console.log('');
  }

  console.log('\n=== 商品上架完成 ===');
}

main().catch(console.error);