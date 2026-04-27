#!/usr/bin/env node

/**
 * Findora 标签更新脚本 - 2026-04-27批次
 * 为已上架商品更新标签
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 2026-04-27批次上架的商品及其标签
const productTags = [
  {
    product_id: 'be6027c0-40fb-4f48-97ed-96af45d5a430',
    filename: '20260427-001.md',
    tags: [
      'temu-bestseller', 'building-blocks', 'creative-toys', 'desk-decor', 'bedroom-decoration',
      'gift', 'valentines-day', 'mothers-day', 'christmas', 'birthday',
      'kids', 'teens', 'young-adults', 'couples', 'plant-lovers',
      'cute', 'aesthetic', 'creative', 'cozy', 'abs-plastic',
      'budget-friendly', 'gift-ready', 'stocking-stuffer', 'party-favor',
      'trending', 'instagram-worthy', 'thoughtful-gift', 'stress-relief',
      'creative-play', 'home-decor', 'romantic-gift'
    ]
  },
  {
    product_id: '052a3c34-5aa5-42ad-bc6d-b663772f26b0',
    filename: '20260427-002.md',
    tags: [
      'temu-bestseller', 'family-games', 'party-games', 'interactive-toys', 'stacking-cups',
      'game-night', 'party', 'family-gathering', 'class-activity',
      'christmas', 'birthday', 'new-years-eve',
      'kids-5-plus', 'families', 'party-hosts', 'teachers',
      'reflexes', 'reaction-time', 'hand-eye-coordination',
      'social-interaction', 'entertainment', 'team-building',
      'easy-to-learn', 'beginner-friendly', 'high-replayability',
      'ice-breaker', 'gift', 'family-gift'
    ]
  },
  {
    product_id: 'c283a4af-6eda-4f6b-8d9e-c6de24c1f84c',
    filename: '20260427-007.md',
    tags: [
      'aliexpress-bestseller', 'star-projector', 'night-light', 'ambient-lighting',
      'bedroom', 'kids-room', 'nursery', 'gaming-room', 'dorm',
      'birthday', 'christmas', 'childrens-day', 'baby-shower',
      'kids', 'teens', 'young-adults', 'space-enthusiasts',
      'cosmic', 'dreamy', 'cozy', 'sci-fi',
      'sleep-aid', 'mood-lighting', 'room-decor',
      'nebula-effect', 'star-projection', '360-rotation',
      'budget-friendly', 'gift-ready', 'unique-gift',
      'tiktok-viral', 'instagram-aesthetic', 'relaxing', 'calming'
    ]
  },
  {
    product_id: 'db877af9-8502-448e-995e-912e9831a03e',
    filename: '20260427-008.md',
    tags: [
      'aliexpress-bestseller', 'solar-lights', 'outdoor-lighting', 'garden-decor',
      'garden', 'patio', 'pathway', 'porch', 'driveway',
      'spring', 'summer', 'outdoor-season',
      'homeowners', 'garden-lovers', 'diy-enthusiasts',
      'modern', 'functional', 'minimalist',
      'motion-sensor', 'solar-powered', 'waterproof',
      'easy-install', 'no-wiring', 'wireless',
      'ultra-budget', 'solar-powered', 'eco-friendly',
      'housewarming-gift', 'garden-gift', 'outdoor-living'
    ]
  },
  {
    product_id: 'b7d075a0-4752-42c3-ad04-d7f0d55b056b',
    filename: '20260427-010.md',
    tags: [
      'tiktok-bestseller', 'star-projector', 'party-lights', 'music-sync-light',
      'bedroom', 'party', 'date-night', 'sleepover', 'gaming',
      'valentines-day', 'birthday', 'anniversary', 'halloween',
      'couples', 'gen-z', 'party-hosts', 'teens',
      'romantic', 'party', 'aesthetic', 'instagram-ready',
      'music-sync', 'color-changing', 'water-ripple-effect',
      'ocean-wave', 'star-projection', '3d-ripple',
      'budget-friendly', 'couples-gift', 'party-gift', 'unique-gift',
      'tiktok-viral', 'mood-setting', 'romantic', 'exciting'
    ]
  }
];

async function updateProductTags(productId, tags) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ tags })
  });

  return await response.json();
}

async function main() {
  console.log('=== 更新商品标签 (2026-04-27批次) ===\n');

  for (let i = 0; i < productTags.length; i++) {
    const item = productTags[i];
    console.log(`[${i + 1}/${productTags.length}] 更新 ${item.filename}`);
    console.log(`  Product ID: ${item.product_id}`);
    console.log(`  标签数量: ${item.tags.length}`);

    try {
      const result = await updateProductTags(item.product_id, item.tags);

      if (result.ok) {
        console.log(`  ✅ 标签更新成功!`);
        console.log(`     标签: ${result.data.tags.slice(0, 5).join(', ')}...`);
      } else {
        console.log(`  ❌ 更新失败: ${JSON.stringify(result.error)}`);
      }
    } catch (err) {
      console.error(`  ❌ API调用失败: ${err.message}`);
    }

    console.log('');
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('=== 标签更新完成 ===');
}

main().catch(console.error);
