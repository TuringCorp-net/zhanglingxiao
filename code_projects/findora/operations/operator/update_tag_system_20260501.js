/**
 * 更新商品标签体系脚本
 * 为2026-05-01上架的4个商品确保标签正确关联
 *
 * 使用方式: node operations/operator/update_tag_system_20260501.js
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api';

// 4个已上架商品的标签
const PRODUCT_TAGS = [
  {
    productId: 'd05ef10f-3686-4b0d-867b-c3bc42dab6eb',
    filename: '20260501001.md',
    tags: [
      'DIY', 'Crafts', 'WoodenCrafts', 'HexagonArt', 'WallDecor', 'WeddingDecor',
      'HandmadeGifts', 'CraftSupplies', 'GeometricArt', 'FarmhouseDecor',
      'PinterestCrafts', 'CraftingForBeginners', 'HomeDecorIdeas', 'HexagonWall',
      'CreativeFun', 'AffordableCrafts', 'PartyDecorations', 'FestivalDecor',
      'CustomArt', 'CraftProject'
    ]
  },
  {
    productId: '5a43e538-462e-4e70-8d6f-457c71102e47',
    filename: '20260501002.md',
    tags: [
      'DarkAcademia', 'GothicDecor', 'CrowArt', 'VintageWallArt', 'RosesAndThorns',
      'DarkRomance', 'VictorianStyle', 'BirdLovers', 'BotanicalArt', 'HalloweenDecor',
      'HomeArt', 'EclecticDecor', 'BookLoverGift', 'HorrorFan', 'GothicHome',
      'WallDecor', 'ArtForCollectors', 'UniqueArt', 'MysteriousVibes', 'GothicAesthetic'
    ]
  },
  {
    productId: 'dff3296c-ff27-4e29-b116-9038eae5409e',
    filename: '20260501005.md',
    tags: [
      'SportsBra', 'WorkoutGear', 'Athleisure', 'FitnessFashion', 'GymStyle',
      'YogaBra', 'RunningBra', 'TennisStyle', 'PickleballFashion', 'ActiveWear',
      'FitnessInfluencer', 'GymFit', 'WorkoutMotivation', 'LadiesWhoLift', 'FitGirl',
      'GymInspiration', 'SportsBraStyle', 'WorkoutReady', 'ActiveLifestyle', 'FitnessAddict'
    ]
  },
  {
    productId: '0d3216bb-732e-428f-bdf4-e2f963612327',
    filename: '20260501010.md',
    tags: [
      'AdultColoringBook', 'StressRelief', 'AnxietyRelief', 'SelfCare', 'MentalHealth',
      'CreativeHobby', 'Relaxation', 'ColoringTherapy', 'Mandala', 'FloralDesign',
      'GeometricPatterns', 'ScreenFree', 'Mindfulness', 'ArtTherapy', 'CalmMind',
      'AdultColoring', 'GiftForHer', 'StockingStuffer', 'RelaxingActivity', 'TherapeuticArt'
    ]
  }
];

/**
 * 创建单个标签
 */
async function createTag(name, slug) {
  try {
    const response = await fetch(`${API_BASE}/admin/tags`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify({
        name: name,
        slug: slug,
        layer: 'function'
      })
    });

    const result = await response.json();
    if (result.ok) {
      console.log(`  创建标签成功: ${name}`);
      return true;
    } else if (result.error?.code === 'INVALID_PARAMS' && result.error?.message?.includes('Slug already exists')) {
      console.log(`  标签已存在: ${name}`);
      return false;
    } else {
      console.log(`  创建标签失败: ${name}, ${JSON.stringify(result.error)}`);
      return false;
    }
  } catch (error) {
    console.error(`  创建标签异常: ${name}`, error);
    return false;
  }
}

/**
 * 更新商品标签
 */
async function updateProductTags(productId, tags) {
  try {
    const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify({ tags })
    });

    const result = await response.json();
    console.log(`  更新商品标签: ${result.ok ? '成功' : '失败'}`);
    return result.ok;
  } catch (error) {
    console.error(`  更新商品标签异常:`, error);
    return false;
  }
}

/**
 * 转换标签名为slug格式
 */
function toSlug(name) {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .replace(/\s+/g, '')
    .replace(/([a-z])([A-Z])/g, '$1$2')
    .toLowerCase();
}

async function main() {
  console.log('='.repeat(60));
  console.log('开始更新标签体系...');
  console.log('='.repeat(60));

  // 收集所有需要创建的标签
  const allTags = new Set();
  for (const product of PRODUCT_TAGS) {
    for (const tag of product.tags) {
      allTags.add(tag);
    }
  }
  console.log(`\n共需要处理 ${allTags.size} 个唯一标签\n`);

  // 创建所有标签
  console.log('--- 创建标签 ---');
  const tagResults = [];
  for (const tagName of allTags) {
    const slug = toSlug(tagName);
    const result = await createTag(tagName, slug);
    tagResults.push({ name: tagName, slug, success: result });
  }

  const successTags = tagResults.filter(t => t.success).length;
  const existTags = tagResults.filter(t => !t.success).length;
  console.log(`\n标签创建完成: 成功 ${successTags}, 已存在 ${existTags}`);

  // 更新每个商品的标签
  console.log('\n--- 更新商品标签 ---');
  for (const product of PRODUCT_TAGS) {
    console.log(`\n处理商品: ${product.filename}`);
    console.log('商品ID:', product.productId);
    console.log('标签:', product.tags.join(', '));

    await updateProductTags(product.productId, product.tags);
  }

  console.log('\n' + '='.repeat(60));
  console.log('标签体系更新完成!');
  console.log('='.repeat(60));
}

main().catch(console.error);