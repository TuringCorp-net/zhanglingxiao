#!/usr/bin/env node

/**
 * 标签体系更新脚本 - 2026-05-04
 * 从PASS商品中提取标签并创建/更新到Findora标签体系
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

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

// 从pass商品中提取的标签
const tagsToCreate = [
  // 商品1标签 (USB厨房搅拌机)
  { name: 'Garlic Blender', slug: 'garlic-blender', layer: 'function', dimension_level: 2 },
  { name: 'Kitchen Gadget', slug: 'kitchen-gadget', layer: 'function', dimension_level: 2 },
  { name: 'USB Rechargeable', slug: 'usb-rechargeable', layer: 'function', dimension_level: 2 },
  { name: 'Compact Cooking', slug: 'compact-cooking', layer: 'function', dimension_level: 2 },
  { name: 'Dorm Living', slug: 'dorm-living', layer: 'audience', dimension_level: 2 },
  { name: 'Apartment Cooking', slug: 'apartment-cooking', layer: 'use-case', dimension_level: 2 },
  { name: 'Meal Prep', slug: 'meal-prep', layer: 'use-case', dimension_level: 2 },
  { name: 'Small Kitchen', slug: 'small-kitchen', layer: 'use-case', dimension_level: 2 },
  { name: 'Home Cook', slug: 'home-cook', layer: 'audience', dimension_level: 2 },
  { name: 'Budget Friendly', slug: 'budget-friendly', layer: 'price', dimension_level: 2 },
  { name: 'Practical Kitchen', slug: 'practical-kitchen', layer: 'style', dimension_level: 2 },
  { name: 'Minimalist Kitchen', slug: 'minimalist-kitchen', layer: 'style', dimension_level: 2 },
  { name: 'Gift for Foodies', slug: 'gift-for-foodies', layer: 'use-case', dimension_level: 2 },

  // 商品5标签 (503件儿童发饰)
  { name: 'Hair Clips', slug: 'hair-clips', layer: 'function', dimension_level: 2 },
  { name: 'Scrunchies', slug: 'scrunchies', layer: 'function', dimension_level: 2 },
  { name: 'Pearl Clips', slug: 'pearl-clips', layer: 'style', dimension_level: 2 },
  { name: 'Butterfly Clips', slug: 'butterfly-clips', layer: 'style', dimension_level: 2 },
  { name: 'Girls Fashion', slug: 'girls-fashion', layer: 'category', dimension_level: 1 },
  { name: 'Kids Accessories', slug: 'kids-accessories', layer: 'category', dimension_level: 1 },
  { name: 'Sequin Hair', slug: 'sequin-hair', layer: 'style', dimension_level: 2 },
  { name: 'Daily Hair', slug: 'daily-hair', layer: 'use-case', dimension_level: 2 },
  { name: 'Hair Collection', slug: 'hair-collection', layer: 'use-case', dimension_level: 2 },
  { name: 'Gift for Girls', slug: 'gift-for-girls', layer: 'use-case', dimension_level: 2 },
  { name: 'Shein Best Seller', slug: 'shein-best-seller', layer: 'function', dimension_level: 2 },
  { name: 'Non-Damaging Hair', slug: 'non-damaging-hair', layer: 'function', dimension_level: 2 },
  { name: 'Kids Style', slug: 'kids-style', layer: 'style', dimension_level: 2 },
  { name: 'Accessory Box', slug: 'accessory-box', layer: 'function', dimension_level: 2 },
  { name: 'Sparkle Everyday', slug: 'sparkle-everyday', layer: 'style', dimension_level: 2 },

  // 商品9标签 (Fast & Furious钻石画)
  { name: 'Fast and Furious', slug: 'fast-and-furious', layer: 'brand', dimension_level: 2 },
  { name: 'Fan Art', slug: 'fan-art', layer: 'style', dimension_level: 2 },
  { name: 'Diamond Painting', slug: 'diamond-painting', layer: 'category', dimension_level: 1 },
  { name: 'Paul Walker Tribute', slug: 'paul-walker-tribute', layer: 'style', dimension_level: 2 },
  { name: 'Car Art', slug: 'car-art', layer: 'style', dimension_level: 2 },
  { name: 'Movie Fan', slug: 'movie-fan', layer: 'audience', dimension_level: 2 },
  { name: 'Man Cave', slug: 'man-cave', layer: 'use-case', dimension_level: 2 },
  { name: 'Rhinestone Art', slug: 'rhinestone-art', layer: 'style', dimension_level: 2 },
  { name: 'Car Culture', slug: 'car-culture', layer: 'style', dimension_level: 2 },
  { name: 'Legacy Art', slug: 'legacy-art', layer: 'style', dimension_level: 2 },
  { name: 'Therapeutic Craft', slug: 'therapeutic-craft', layer: 'function', dimension_level: 2 },
  { name: 'Fandom Craft', slug: 'fandom-craft', layer: 'use-case', dimension_level: 2 },
  { name: 'Home Decor', slug: 'home-decor', layer: 'category', dimension_level: 1 },
  { name: 'Hobby Crafting', slug: 'hobby-crafting', layer: 'use-case', dimension_level: 2 }
];

async function main() {
  console.log('=== 标签体系更新开始 (2026-05-04) ===\n');
  console.log(`计划创建 ${tagsToCreate.length} 个标签\n`);

  let created = 0;
  let skipped = 0;

  for (let i = 0; i < tagsToCreate.length; i++) {
    const tag = tagsToCreate[i];

    try {
      const result = await createTag(tag);

      if (result.ok) {
        console.log(`✅ [${i + 1}/${tagsToCreate.length}] 创建标签: ${tag.name} (${tag.slug})`);
        created++;
      } else {
        // 可能是重复标签（slug已存在）
        if (result.error?.code === 'TAG_ALREADY_EXISTS' || result.error?.code === 'SLUG_ALREADY_EXISTS') {
          console.log(`⏭️  [${i + 1}/${tagsToCreate.length}] 跳过已存在: ${tag.name}`);
          skipped++;
        } else {
          console.log(`⚠️  [${i + 1}/${tagsToCreate.length}] 创建失败: ${tag.name} - ${JSON.stringify(result.error)}`);
        }
      }
    } catch (err) {
      console.error(`❌ [${i + 1}/${tagsToCreate.length}] API错误: ${tag.name} - ${err.message}`);
    }

    // 延迟避免请求过快
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n=== 标签体系更新完成 ===');
  console.log(`创建成功: ${created}`);
  console.log(`跳过(已存在): ${skipped}`);
  console.log(`总计: ${tagsToCreate.length}`);
}

main().catch(console.error);