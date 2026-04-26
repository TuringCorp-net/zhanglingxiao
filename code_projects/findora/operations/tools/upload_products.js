#!/usr/bin/env node

/**
 * Findora 商品上架脚本
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
  // 提取推广文案部分
  const startIdx = markdownContent.indexOf('## 推广文案 (Curated)');
  if (startIdx === -1) return '';

  // 找到下一个 ## 标记或文件结束
  let endIdx = markdownContent.indexOf('\n## ', startIdx + 1);
  if (endIdx === -1) {
    endIdx = markdownContent.indexOf('\n---\n## 原始数据');
  }
  if (endIdx === -1) {
    endIdx = markdownContent.length;
  }

  let summary = markdownContent.substring(startIdx, endIdx).trim();
  // 移除"## 推广文案 (Curated)"标题行
  summary = summary.replace(/^## 推广文案 \(Curated\)\n\n?/, '');

  return summary;
}

// 解析标签
function extractTags(markdownContent) {
  const tags = [];

  // 提取多维度标签矩阵部分 - 更强的匹配模式
  // 查找从 ## 多维度标签矩阵 开始到 ## 原始数据 之前的内容
  const tagSectionMatch = markdownContent.match(/## 多维度标签矩阵[\s\S]*?(?=\n## 原始数据)/);
  if (!tagSectionMatch) {
    console.log('  ⚠️ 未找到标签矩阵部分');
    return tags;
  }

  const tagSection = tagSectionMatch[0];
  console.log('  📋 标签部分长度:', tagSection.length);

  // 提取所有 | 维度 | 标签 | 行中的标签
  const lines = tagSection.split('\n');
  for (const line of lines) {
    // 匹配表格行: | 场景 | daily-commute, travel, outdoor |
    const rowMatch = line.match(/^\|\s*[\*\*]*[一-龥a-zA-Z ]+[\*\*]*\s*\|\s*([\w-]+(?:\s*,\s*[\w-]+)*)\s*\|/);
    if (rowMatch && rowMatch[1]) {
      const rowTags = rowMatch[1].split(',').map(t => t.trim()).filter(t => t);
      tags.push(...rowTags);
      console.log('  🏷️  提取到标签:', rowTags);
    }
  }

  return tags;
}

// 主函数
async function main() {
  const products = [
    // 001-C - Selfie Light (amazon)
    {
      source_platform: 'amazon',
      source_url: 'https://www.amazon.com/dp/B0C2C9QT91',
      original_title: 'ALTSON 60 LED Portable Selfie Light Video Conference Lighting with Clip & Camera Tripod Adapter Rechargeable 2200mAh CRI 97+, 3 Light Modes for Phone iPhone Webcam Laptop Photo Makeup',
      title: 'Your Face, Flawlessly Lit: The Pocket Studio That Turns Any Space Into a Glamour Stage',
      category: 'accessories',
      subcategory: 'lighting',
      price_min: 8.74,
      currency: 'USD',
      cover_image: 'https://m.media-amazon.com/images/I/71mi169ArHL._AC_UL320_.jpg',
      source_md: '', // 稍后填充
      source_filename: '20260426-001-C.md'
    },
    // 003-C - Bluetooth GPS Tracker (sumaitong)
    {
      source_platform: 'sumaitong',
      source_url: 'https://sumaitong.com/item/3256808998713855',
      original_title: 'Smart Bluetooth GPS Anti-Lose Tracker Sound Locate Msg Reminder Alarm for Keys Wallets Pets Compatible iOS Android',
      title: 'Never Lose Anything Again: The Tiny Bluetooth Guardian That Alerts You Before You Walk Away',
      category: 'security',
      subcategory: 'tracker',
      price_min: 1.13,
      currency: 'USD',
      cover_image: '//ae-pic-a1.aliexpress-media.com/kf/S56ff3f10d4ab40fe885432032b7bf8efe.png',
      source_md: '',
      source_filename: '20260426-003-C.md'
    },
    // 005-C - Waterproof Phone Pouch (amazon)
    {
      source_platform: 'amazon',
      source_url: 'https://www.amazon.com/dp/B0BQRDKRL6',
      original_title: 'Lamicall Waterproof Phone Pouch Case - [2 Pack][Easy Lock & Heavy Duty] IPX8 Water Proof Cell Phone Dry Bag for Beach, Gift Protector for iPhone 17 16 15 14 13 12 11 Pro Max Plus Air, Galaxy S25, 4-7"',
      title: "Your Phone's Best Bodyguard: Dive, Splash, and Freak Out—Because Your Phone Survives What You Don't",
      category: 'accessories',
      subcategory: 'waterproof-case',
      price_min: 8.46,
      currency: 'USD',
      cover_image: 'https://m.media-amazon.com/images/I/81YbMK6L8uL._AC_UY218_.jpg',
      source_md: '',
      source_filename: '20260426-005-C.md'
    },
    // 010-C - Mini GPS Tracker (sumaitong)
    {
      source_platform: 'sumaitong',
      source_url: 'https://sumaitong.com/item/3256806718362518',
      original_title: 'Mini Gps Locator Position App Gf07 Car Gps Tracker Magnetic Vehicle Gps Locator Anti-Lost Anti-Theft Alarm Gps Tracking Device',
      title: 'Know Where Everything Is—All the Time: The Magnetic GPS Tracker That Hides in Plain Sight',
      category: 'security',
      subcategory: 'gps-tracker',
      price_min: 1.73,
      currency: 'USD',
      cover_image: '//ae04.alicdn.com/kf/S40fc88fc808d4517b7cccb8c9f3c8e39I.jpeg',
      source_md: '',
      source_filename: '20260426-010-C.md'
    }
  ];

  const files = [
    'operations/pass/2026-04-26/20260426-001-C.md',
    'operations/pass/2026-04-26/20260426-003-C.md',
    'operations/pass/2026-04-26/20260426-005-C.md',
    'operations/pass/2026-04-26/20260426-010-C.md'
  ];

  const fs = require('fs');
  const path = require('path');

  console.log('=== Findora 商品上架开始 ===\n');

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const filePath = path.join(process.cwd(), files[i]);

    console.log(`\n[${i + 1}/${products.length}] 处理: ${product.source_filename}`);

    // 读取md文件
    try {
      const mdContent = fs.readFileSync(filePath, 'utf-8');
      product.source_md = mdContent;

      // 提取summary
      const summary = extractSummary(mdContent);
      product.summary = summary;

      // 提取tags
      const tags = extractTags(mdContent);
      product.tags = tags;

      console.log(`  - 标题: ${product.title}`);
      console.log(`  - 平台: ${product.source_platform}`);
      console.log(`  - 价格: $${product.price_min}`);
      console.log(`  - 标签数量: ${tags.length}`);
      console.log(`  - Summary长度: ${summary.length} 字符`);

    } catch (err) {
      console.error(`  ❌ 读取文件失败: ${err.message}`);
      continue;
    }

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

    // 延迟避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n=== 商品上架完成 ===');
}

main().catch(console.error);