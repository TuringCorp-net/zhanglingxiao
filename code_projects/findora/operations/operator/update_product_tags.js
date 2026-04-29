/**
 * 批量更新商品标签脚本
 * 为2026-04-29上架的4个精选商品更新标签
 *
 * 使用方式: node operations/operator/update_product_tags.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';

// 上架成功的商品及其标签
const PRODUCTS_TAGS = [
  {
    productId: '363f4384-258b-426e-ac8c-e8b29bd0d4e7',
    filename: 'C20260429-001.md',
    tags: [
      'CarShade',
      'HeatProtection',
      'UVBlock',
      'FoldableSunshade',
      'SummerDrivingEssentials',
      'UniversalCarShade',
      'DashboardProtection',
      'HotCarHack',
      'CarCooling',
      'AutoAccessories',
      'SunShield',
      'RoadTripGear',
      'ParkingProtection'
    ]
  },
  {
    productId: 'ccc8a432-7466-45f4-b977-97ac9c5c2f01',
    filename: 'C20260429-002.md',
    tags: [
      'At-Home Spa',
      'Foot Care',
      'USB Rechargeable',
      'Self-Care',
      'Foot Exfoliator',
      'Spa Day',
      'Body Care',
      'Summer Sandals',
      'Wellness',
      'Soft Skin',
      'Shower Use',
      'Foot Care Obsessives'
    ]
  },
  {
    productId: 'b330529a-c69f-4a72-80f9-301e7df0b42a',
    filename: 'C20260429-003.md',
    tags: [
      'Art Stickers',
      'Frida Kahlo',
      'Collectible Art',
      'Waterproof Stickers',
      'Journal Decor',
      'Boho Aesthetic',
      'Self-Expression',
      'Creative Gift',
      'Laptop Stickers',
      'Personalization',
      '59 Pieces',
      'Mexican Art'
    ]
  },
  {
    productId: 'b554db84-8078-4d29-b54d-7548592a5755',
    filename: 'C20260429-004.md',
    tags: [
      'Pop Mart',
      'Holographic Stickers',
      'Kawaii',
      'Gen Z',
      'Sparkle',
      'Collectibles',
      'Y2K',
      'Sticker Lovers',
      'Cute Culture',
      'Gift Sticker',
      'Pop Mart IP',
      'Holographic Shine'
    ]
  }
];

async function updateProductTags(product) {
  console.log(`\n========== 更新商品标签: ${product.filename} ==========`);
  console.log('商品ID:', product.productId);
  console.log('标签:', product.tags.join(', '));

  const response = await fetch(`${API_BASE}/admin/products/${product.productId}/tags`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({
      tags: product.tags
    })
  });

  const result = await response.json();
  console.log('API响应:', JSON.stringify(result, null, 2));

  return result;
}

async function main() {
  console.log('开始批量更新商品标签...');
  console.log('='.repeat(50));

  const results = [];
  for (const product of PRODUCTS_TAGS) {
    try {
      const result = await updateProductTags(product);
      results.push({
        filename: product.filename,
        productId: product.productId,
        success: result.ok || result.success,
        data: result.data,
        error: result.error
      });
    } catch (error) {
      console.error(`更新失败: ${product.filename}`, error);
      results.push({
        filename: product.filename,
        productId: product.productId,
        success: false,
        error: error.message
      });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('标签更新结果汇总:');
  console.log(JSON.stringify(results, null, 2));

  // 统计
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  console.log(`\n成功: ${successCount}, 失败: ${failCount}`);
}

main().catch(console.error);
