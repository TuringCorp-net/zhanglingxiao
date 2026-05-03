/**
 * 清理错误上架的商品并更新正确商品的标签
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 错误上架的历史商品ID（需要删除）
const WRONG_PRODUCTS = [
  'af926ffd-9330-4c9b-b9e0-5f77f1ed7f36',  // 20260503-001
  'c09a0783-979f-4732-a767-cc0e576ef35d',  // 20260503-003_mom_story_journal
  '815065bb-8f59-4c57-a0d1-6cb5a8536aa6',  // 20260503-004
  '674982d1-ca27-4c9e-8098-26ae08503105',  // 20260503-004_dad_story_journal
  'f745db8e-1939-458e-b533-ffdacabca8ac',  // 20260503-005
  '3ddff3ad-ce07-4619-8e10-b415501f046c',  // 20260503-005_spiritual_warfare
  '92e6423a-61ed-4bc8-bd7f-4ec1ed47758f',  // 20260503-007
  '4fefc498-c4f0-4781-b95e-9cbe29bbead2',  // 20260503-009_baby_first_steps
  'b192ef74-95fe-4d2a-b697-32b3a03996c4',  // 20260503-010
  '6f338616-3a98-453f-a4f6-e4a3734b195f'   // 20260503-010_peel_off_lip_liner
];

// 今天通过的4个商品及其标签
const CORRECT_PRODUCTS = [
  {
    id: 'eada281a-0d53-436d-ba84-e4fdbf4c5ad0',  // 20260503-002 Dad Needs A Beer
    filename: '20260503-002.md',
    tags: [
      'tag-type-dad-tshirt', 'tag-type-vintage-tee', 'tag-type-statement-shirt',
      'tag-scene-bbq', 'tag-scene-fathers-day', 'tag-scene-casual-wear',
      'tag-aud-fathers', 'tag-aud-dads', 'tag-aud-beer-lovers',
      'tag-emotion-humorous', 'tag-emotion-relatable', 'tag-emotion-nostalgic',
      'tag-function-conversation-starter', 'tag-function-gift',
      'tag-material-comfortable', 'tag-material-quality-fabric',
      'tag-culture-dad-joke', 'tag-culture-beer-culture', 'tag-culture-retro',
      'tag-price-under-15', 'tag-platform-shein-trending'
    ]
  },
  {
    id: 'a348d65c-97cc-4a6a-b878-c08186af2d9f',  // 20260503-003 Gators Tee
    filename: '20260503-003.md',
    tags: [
      'tag-type-ncaa-fan-tee', 'tag-type-team-jersey', 'tag-type-college-sports',
      'tag-scene-game-day', 'tag-scene-tailgate-party', 'tag-scene-campus-life',
      'tag-aud-college-students', 'tag-aud-sports-fans', 'tag-aud-alumni',
      'tag-emotion-patriotic', 'tag-emotion-team-spirit', 'tag-emotion-pride',
      'tag-function-fan-gear', 'tag-function-school-spirit',
      'tag-material-breathable-fabric', 'tag-material-durable-print',
      'tag-culture-ncaa', 'tag-culture-college-sports', 'tag-culture-florida-gators',
      'tag-price-ultra-budget', 'tag-price-under-10'
    ]
  },
  {
    id: '270d7ec3-8a80-4118-8332-daa8fb94c20b',  // 20260503-006 Shark Costume
    filename: '20260503-006.md',
    tags: [
      'tag-type-kids-costume', 'tag-type-toddler-costume', 'tag-type-family-costume',
      'tag-scene-halloween', 'tag-scene-family-photos', 'tag-scene-carnival',
      'tag-aud-toddlers', 'tag-aud-parents', 'tag-aud-young-kids',
      'tag-emotion-cute', 'tag-emotion-adorable', 'tag-emotion-playful',
      'tag-function-family-photo-prop', 'tag-function-matching-costume',
      'tag-material-child-safe', 'tag-material-soft-fabric',
      'tag-culture-shark-week', 'tag-culture-ocean-theme', 'tag-culture-family-fun',
      'tag-price-budget-friendly', 'tag-price-under-10',
      'tag-platform-aliexpress-trending'
    ]
  },
  {
    id: '3d1cd0a6-69c8-4c5e-a6a0-091e643d85e1',  // 20260503-009 Aurora Light
    filename: '20260503-009.md',
    tags: [
      'tag-type-aurora-projector', 'tag-type-night-light', 'tag-type-led-projector',
      'tag-type-ambient-light', 'tag-scene-bedroom', 'tag-scene-meditation',
      'tag-scene-party', 'tag-scene-gaming-room', 'tag-scene-date-night',
      'tag-aud-sleep-lovers', 'tag-aud-dreamers', 'tag-aud-couples',
      'tag-emotion-dreamy', 'tag-emotion-romantic', 'tag-emotion-calming',
      'tag-emotion-magical',
      'tag-function-remote-control', 'tag-function-timer', 'tag-function-multicolor',
      'tag-material-led-technology', 'tag-material-energy-efficient',
      'tag-culture-aurora-borealis', 'tag-culture-dreamcore', 'tag-culture-cozy-aesthetic',
      'tag-price-mid-range', 'tag-price-value-gift',
      'tag-platform-temu-trending'
    ]
  }
];

// 删除错误商品
async function deleteProduct(productId) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': ADMIN_KEY }
  });
  return response.json();
}

// 更新商品标签
async function updateTags(productId, tags) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
    method: 'PATCH',
    headers: {
      'X-Admin-Key': ADMIN_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ tags })
  });
  return response.json();
}

async function main() {
  console.log('=== 清理错误商品 ===\n');

  // 删除10个错误上架的历史商品
  for (const productId of WRONG_PRODUCTS) {
    try {
      const result = await deleteProduct(productId);
      if (result.ok) {
        console.log(`✓ 已删除: ${productId}`);
      } else {
        console.log(`✗ 删除失败: ${productId} - ${JSON.stringify(result.error)}`);
      }
    } catch (err) {
      console.log(`✗ 删除异常: ${productId} - ${err.message}`);
    }
  }

  console.log('\n=== 更新正确商品的标签 ===\n');

  // 更新4个正确商品的标签
  for (const product of CORRECT_PRODUCTS) {
    console.log(`更新 ${product.filename} (${product.id})`);
    console.log(`  标签数量: ${product.tags.length}`);
    try {
      const result = await updateTags(product.id, product.tags);
      if (result.ok) {
        console.log(`  ✓ 标签更新成功`);
      } else {
        console.log(`  ✗ 标签更新失败: ${JSON.stringify(result.error)}`);
      }
    } catch (err) {
      console.log(`  ✗ 更新异常: ${err.message}`);
    }
  }

  console.log('\n=== 任务完成 ===');
}

main().catch(console.error);