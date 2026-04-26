#!/usr/bin/env node

/**
 * Findora 商品标签更新脚本
 * 为已上架商品更新标签
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 已上架商品及其标签
const productTags = [
  {
    product_id: '89d2dd34-9da0-4153-8656-e9a14f121063',
    filename: '20260426-001-C.md',
    tags: [
      'video-conference', 'remote-work', 'zoom-meeting', 'live-streaming', 'content-creation',
      'ring-light', 'selfie-light', 'fill-light', 'portable-lighting', 'rechargeable',
      'iphone-compatible', 'android-friendly', 'laptop-friendly', 'webcam-addon',
      'makeup-application', 'photography', 'video-call', 'online-meeting',
      'cri-97-plus', 'led-lighting', '60-led', 'adjustable-modes', 'cordless',
      'content-creators', 'remote-workers', 'beauty-enthusiasts', 'influencers',
      'christmas-gift', 'birthday-gift', 'graduation-gift', 'easter-gift',
      'budget-friendly', 'under-10-dollars',
      'wfh-essentials', 'work-from-home', 'digital-nomad'
    ]
  },
  {
    product_id: 'e408f6bf-1351-4adc-b269-d237367f52d4',
    filename: '20260426-003-C.md',
    tags: [
      'daily-commute', 'travel', 'outdoor', 'pet-owner', 'frequent-traveler',
      'anti-lost', 'bluetooth-tracker', 'sound-alert', 'reminder', 'gps-locate',
      'ios-compatible', 'android-compatible', 'smartphone-sync',
      'keys-tracking', 'wallet-finder', 'pet-collar', 'luggage-tag',
      'compact-design', 'light-weight', 'long-battery', 'smart-alert',
      'busy-professionals', 'pet-owners', 'travelers', 'forgetful-types', 'students',
      'christmas-gift', 'birthday-gift', 'graduation-gift', 'mothers-day',
      'budget-friendly', 'under-5-dollars',
      'smart-home-security', 'connected-life', 'pet-tech'
    ]
  },
  {
    product_id: 'd9ff7a13-1c4a-4402-8ce4-e4f21b28dd41',
    filename: '20260426-005-C.md',
    tags: [
      'beach-vacation', 'pool-party', 'water-sports', 'rain-hiking', 'island-getaway',
      'waterproof', 'ipx8', 'dry-bag', 'phone-protection', 'water-proof-case',
      'iphone-17', 'iphone-16', 'iphone-15', 'iphone-14', 'samsung-s25', 'universal-fit',
      'swimming', 'snorkeling', 'kayaking', 'beach-day', 'boating', 'winter-sports',
      'touch-screen-compatible', 'heavy-duty', 'easy-lock', 'clear-window',
      'beach-goers', 'swimmers', 'hikers', 'outdoor-adventurers', 'parents',
      'christmas-gift', 'birthday-gift', 'graduation-gift', 'mothers-day',
      'budget-friendly', 'value-pack', 'under-10-dollars',
      'water-sport-gear', 'travel-essentials', 'beach-life'
    ]
  },
  {
    product_id: 'fbee097d-cc6d-4faf-9558-f1e98b64ae7b',
    filename: '20260426-010-C.md',
    tags: [
      'vehicle-tracking', 'asset-protection', 'teen-monitoring', 'parking-assistance',
      'gps-tracker', 'real-time-tracking', 'magnetic-mount', 'anti-theft-alarm',
      'car-tracker', 'bike-tracker', 'trailer-tracker', 'asset-tracker',
      'vehicle-security', 'fleet-tracking', 'teen-safety', 'tool-protection',
      'app-controlled', 'real-time-location', 'compact-design', 'no-installation',
      'parents', 'car-owners', 'fleet-managers', 'outdoor-enthusiasts', 'diyers',
      'christmas-gift', 'fathers-day', 'graduation-gift', 'birthday-gift',
      'ultra-budget', 'under-5-dollars', 'high-value',
      'vehicle-security', 'asset-tracking', 'smart-protection', 'gps-tech'
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
  console.log('=== 更新商品标签 ===\n');

  for (let i = 0; i < productTags.length; i++) {
    const item = productTags[i];
    console.log(`[${i + 1}/${productTags.length}] 更新 ${item.filename}`);
    console.log(`  Product ID: ${item.product_id}`);
    console.log(`  标签数量: ${item.tags.length}`);

    try {
      const result = await updateProductTags(item.product_id, item.tags);

      if (result.ok) {
        console.log(`  ✅ 标签更新成功!`);
        console.log(`     当前标签: ${result.data.tags.join(', ')}`);
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