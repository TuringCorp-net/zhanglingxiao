/**
 * Operator Agent - 批量上架商品脚本
 * 用途：将pass目录下的商品批量上架到Findora系统
 */

const API_BASE = 'https://findora.turingcorp.net';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 5个通过审核的商品
const products = [
  {
    filename: '20260503-003_mom_story_journal.md',
    source_md_path: 'operations/pass/2026-05-03/20260503-003_mom_story_journal.md'
  },
  {
    filename: '20260503-004_dad_story_journal.md',
    source_md_path: 'operations/pass/2026-05-03/20260503-004_dad_story_journal.md'
  },
  {
    filename: '20260503-005_spiritual_warfare_prayer.md',
    source_md_path: 'operations/pass/2026-05-03/20260503-005_spiritual_warfare_prayer.md'
  },
  {
    filename: '20260503-009_baby_first_steps_socks.md',
    source_md_path: 'operations/pass/2026-05-03/20260503-009_baby_first_steps_socks.md'
  },
  {
    filename: '20260503-010_peel_off_lip_liner.md',
    source_md_path: 'operations/pass/2026-05-03/20260503-010_peel_off_lip_liner.md'
  }
];

async function createProduct(product) {
  const response = await fetch(`${API_BASE}/api/admin/products`, {
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

async function updateProductTags(productId, tags) {
  const response = await fetch(`${API_BASE}/api/admin/products/${productId}/tags`, {
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

async function createTag(tagData) {
  const response = await fetch(`${API_BASE}/api/admin/tags`, {
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

// 从markdown中提取信息
function extractProductInfo(markdown, filename) {
  // 提取基本信息
  const platformMatch = markdown.match(/- 平台:\s*(\w+)/);
  const categoryMatch = markdown.match(/- 品类:\s*([^\n]+)/);
  const priceMatch = markdown.match(/- 价格区间:\s*([0-9.~,\s]+)/);
  const salesMatch = markdown.match(/- 销量:\s*(\d+)/);
  const ratingMatch = markdown.match(/- 评分:\s*([0-9.]+)/);
  const originalTitleMatch = markdown.match(/#\s+(.+)/);
  const productIdMatch = markdown.match(/- 商品ID:\s*(\d+)/);

  // 构造source_url
  const platform = platformMatch ? platformMatch[1] : 'unknown';
  const productId = productIdMatch ? productIdMatch[1] : '';
  let sourceUrl = '';
  if (platform === 'temu') {
    sourceUrl = `https://www.temu.com/g-6011${productId}.html`;
  } else if (platform === 'tiktok') {
    sourceUrl = `https://www.tiktok.com/@shop/product/${productId}`;
  } else if (platform === 'shein') {
    sourceUrl = `https://www.shein.com/product/${productId}.html`;
  }

  // 提取推广文案（summary）
  const summaryMatch = markdown.match(/### 推广文案 \(Promotional Copy\)[\s\S]+?(?=\n###|\n---\n)/);
  const summary = summaryMatch ? summaryMatch[0].replace(/### 推广文案 \(Promotional Copy\)\n+/, '').trim() : '';

  // 提取标签
  const tagsMatch = markdown.match(/\| 维度 \| 标签 \|[\s\S]+?(?=\n###|\n---\n)/);
  const tags = [];
  if (tagsMatch) {
    const tagLines = tagsMatch[0].split('\n').filter(line => line.startsWith('|') && !line.includes('维度'));
    tagLines.forEach(line => {
      const parts = line.split('|').filter(p => p.trim());
      if (parts[1]) {
        const tagValues = parts[1].split(',').map(t => t.trim()).filter(t => t);
        tags.push(...tagValues);
      }
    });
  }

  return {
    source_platform: platform,
    source_url: sourceUrl,
    original_title: originalTitleMatch ? originalTitleMatch[1] : filename,
    title: originalTitleMatch ? originalTitleMatch[1] : filename,
    category: mapCategory(categoryMatch ? categoryMatch[1].trim() : 'other'),
    subcategory: '',
    tags: tags,
    price_min: priceMatch ? parseFloat(priceMatch[1].split('~')[0].trim()) : null,
    price_max: priceMatch ? parseFloat(priceMatch[1].split('~')[1].trim()) : null,
    currency: 'USD',
    cover_image: '',
    summary: summary,
    source_md: markdown,
    source_filename: filename
  };
}

function mapCategory(category) {
  const categoryMap = {
    '母婴用品': 'baby',
    'Books, Magazines & Audio': 'books',
    '美容与健康': 'beauty'
  };
  return categoryMap[category] || 'other';
}

async function main() {
  console.log('=== 开始批量上架商品 ===\n');

  // 首先创建可能需要的新标签
  const newTagsToCreate = [
    { name: 'Y2K Revival', slug: 'y2k-revival', layer: 'style', dimension_level: 2 },
    { name: 'Heritage Gift', slug: 'heritage-gift', layer: 'function', dimension_level: 2 },
    { name: 'Faith Journey', slug: 'faith-journey', layer: 'audience', dimension_level: 2 },
    { name: 'First Steps', slug: 'first-steps', layer: 'function', dimension_level: 2 },
    { name: 'Memory Keeper', slug: 'memory-keeper', layer: 'function', dimension_level: 2 }
  ];

  console.log('--- 准备创建新标签 ---');
  for (const tag of newTagsToCreate) {
    try {
      const result = await createTag(tag);
      if (result.ok) {
        console.log(`✅ 创建标签: ${tag.name} -> ${result.data.id}`);
      } else if (result.error?.code === 'TAG_ALREADY_EXISTS') {
        console.log(`ℹ️  标签已存在: ${tag.name}`);
      }
    } catch (e) {
      console.log(`⚠️ 创建标签失败: ${tag.name} - ${e.message}`);
    }
  }

  console.log('\n--- 开始上架商品 ---\n');

  // 处理每个商品
  for (const product of products) {
    console.log(`\n📦 处理商品: ${product.filename}`);

    try {
      // 读取markdown文件
      const fs = await import('fs');
      const markdown = fs.readFileSync(product.source_md_path, 'utf-8');

      // 提取商品信息
      const productData = extractProductInfo(markdown, product.filename);

      console.log(`   - 平台: ${productData.source_platform}`);
      console.log(`   - 类目: ${productData.category}`);
      console.log(`   - 标题: ${productData.original_title.substring(0, 50)}...`);
      console.log(`   - 标签数: ${productData.tags.length}`);

      // 创建商品
      const createResult = await createProduct(productData);

      if (createResult.ok) {
        console.log(`   ✅ 商品创建成功: ${createResult.data.id}`);

        // 更新商品标签
        const tagResult = await updateProductTags(createResult.data.id, productData.tags);
        if (tagResult.ok) {
          console.log(`   ✅ 标签更新成功`);
        } else {
          console.log(`   ⚠️ 标签更新失败: ${tagResult.error?.message}`);
        }
      } else {
        console.log(`   ❌ 商品创建失败: ${createResult.error?.message}`);
      }
    } catch (e) {
      console.log(`   ❌ 处理失败: ${e.message}`);
    }
  }

  console.log('\n=== 批量上架完成 ===');
}

main().catch(console.error);