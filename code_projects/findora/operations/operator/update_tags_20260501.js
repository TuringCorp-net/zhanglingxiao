/**
 * 更新平台标签体系 (2026-05-01)
 * 基于4个PASS商品的标签矩阵，将优质标签纳入平台标签体系
 *
 * 标签Layer说明：
 * - category: 类目标签 (dimension_level 1)
 * - function: 功能标签 (dimension_level 2)
 * - style: 风格标签 (dimension_level 2)
 * - audience: 人群标签 (dimension_level 1)
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api/admin/tags';

// 从4个PASS商品提取的优质标签
const newTags = [
  // === 功能标签 (function, dimension_level 2) ===
  { name: 'Nano Tape', slug: 'nano-tape', layer: 'function', dimension_level: 2 },
  { name: 'Adhesive Solutions', slug: 'adhesive-solutions', layer: 'function', dimension_level: 2 },
  { name: 'Mounting Tape', slug: 'mounting-tape', layer: 'function', dimension_level: 2 },
  { name: 'Floor Gap Repair', slug: 'floor-gap-repair', layer: 'function', dimension_level: 2 },
  { name: 'Laminate Floor Tool', slug: 'laminate-floor-tool', layer: 'function', dimension_level: 2 },
  { name: 'Vinyl Floor Fixer', slug: 'vinyl-floor-fixer', layer: 'function', dimension_level: 2 },
  { name: 'Suction Cup Design', slug: 'suction-cup-design', layer: 'function', dimension_level: 2 },
  { name: 'Lever Mechanism', slug: 'lever-mechanism', layer: 'function', dimension_level: 2 },
  { name: 'Pressure Boost', slug: 'pressure-boost', layer: 'function', dimension_level: 2 },
  { name: 'Multi-Spray', slug: 'multi-spray', layer: 'function', dimension_level: 2 },
  { name: 'Handheld Shower Head', slug: 'handheld-shower-head', layer: 'function', dimension_level: 2 },
  { name: 'Pressurized Shower', slug: 'pressurized-shower', layer: 'function', dimension_level: 2 },
  { name: 'Garment Steamer', slug: 'garment-steamer', layer: 'function', dimension_level: 2 },
  { name: 'Portable Steamer', slug: 'portable-steamer', layer: 'function', dimension_level: 2 },
  { name: 'Travel Steamer', slug: 'travel-steamer', layer: 'function', dimension_level: 2 },
  { name: 'Quick Heat', slug: 'quick-heat', layer: 'function', dimension_level: 2 },
  { name: 'Continuous Steam', slug: 'continuous-steam', layer: 'function', dimension_level: 2 },
  { name: 'Anti-Wrinkle', slug: 'anti-wrinkle', layer: 'function', dimension_level: 2 },
  { name: 'Strong Hold', slug: 'strong-hold', layer: 'function', dimension_level: 2 },
  { name: 'Reusable Adhesive', slug: 'reusable-adhesive', layer: 'function', dimension_level: 2 },
  { name: 'Washable', slug: 'washable', layer: 'function', dimension_level: 2 },
  { name: 'No-Damage', slug: 'no-damage', layer: 'function', dimension_level: 2 },

  // === 应用领域标签 (function, dimension_level 2) ===
  { name: 'Home Organization', slug: 'home-organization', layer: 'function', dimension_level: 2 },
  { name: 'Christmas Decor', slug: 'christmas-decor', layer: 'function', dimension_level: 2 },
  { name: 'Car Accessories', slug: 'car-accessories', layer: 'function', dimension_level: 2 },
  { name: 'Craft Projects', slug: 'craft-projects', layer: 'function', dimension_level: 2 },
  { name: 'Floor Maintenance', slug: 'floor-maintenance', layer: 'function', dimension_level: 2 },
  { name: 'Home Renovation', slug: 'home-renovation', layer: 'function', dimension_level: 2 },
  { name: 'Spa Experience', slug: 'spa-experience', layer: 'function', dimension_level: 2 },
  { name: 'Low Pressure Fix', slug: 'low-pressure-fix', layer: 'function', dimension_level: 2 },
  { name: 'Bathroom Upgrade', slug: 'bathroom-upgrade', layer: 'function', dimension_level: 2 },
  { name: 'Business Travel', slug: 'business-travel', layer: 'function', dimension_level: 2 },
  { name: 'Vacation Packing', slug: 'vacation-packing', layer: 'function', dimension_level: 2 },
  { name: 'Quick Refresh', slug: 'quick-refresh', layer: 'function', dimension_level: 2 },

  // === 人群标签 (audience, dimension_level 1) ===
  { name: 'DIY Enthusiasts', slug: 'diy-enthusiasts', layer: 'audience', dimension_level: 1 },
  { name: 'Home Owners', slug: 'home-owners', layer: 'audience', dimension_level: 1 },
  { name: 'Renters', slug: 'renters', layer: 'audience', dimension_level: 1 },
  { name: 'Business Professionals', slug: 'business-professionals', layer: 'audience', dimension_level: 1 },
  { name: 'Frequent Travelers', slug: 'frequent-travelers', layer: 'audience', dimension_level: 1 },
  { name: 'Students', slug: 'students', layer: 'audience', dimension_level: 1 },
  { name: 'Parents', slug: 'parents', layer: 'audience', dimension_level: 1 },
  { name: 'Apartment Renters', slug: 'apartment-renters', layer: 'audience', dimension_level: 1 },
  { name: 'Spa Lovers', slug: 'spa-lovers', layer: 'audience', dimension_level: 1 },

  // === 风格标签 (style, dimension_level 2) ===
  { name: 'Minimalist', slug: 'minimalist', layer: 'style', dimension_level: 2 },
  { name: 'Convenience First', slug: 'convenience-first', layer: 'style', dimension_level: 2 },
  { name: 'Professional Appearance', slug: 'professional-appearance', layer: 'style', dimension_level: 2 },
  { name: 'Luxury Feel', slug: 'luxury-feel', layer: 'style', dimension_level: 2 },

  // === 营销热点标签 (function, dimension_level 2) ===
  { name: 'Amazon Choice', slug: 'amazon-choice', layer: 'function', dimension_level: 2 },
  { name: 'Before After Reveal', slug: 'before-after-reveal', layer: 'function', dimension_level: 2 },
  { name: 'TikTok Viral', slug: 'tiktok-viral', layer: 'function', dimension_level: 2 },
  { name: 'Organization Hack', slug: 'organization-hack', layer: 'function', dimension_level: 2 },
  { name: 'Life Hack', slug: 'life-hack', layer: 'function', dimension_level: 2 },

  // === 消费心理标签 (function, dimension_level 2) ===
  { name: 'Impulse Buy', slug: 'impulse-buy', layer: 'function', dimension_level: 2 },
  { name: 'Stocking Stuffer', slug: 'stocking-stuffer', layer: 'function', dimension_level: 2 },
  { name: 'Cost Saver', slug: 'cost-saver', layer: 'function', dimension_level: 2 },
  { name: 'Professional Result', slug: 'professional-result', layer: 'function', dimension_level: 2 },
  { name: 'Instant Satisfaction', slug: 'instant-satisfaction', layer: 'function', dimension_level: 2 },

  // === 节日场景标签 (function, dimension_level 2) ===
  { name: "Mother's Day Gift", slug: 'mothers-day-gift', layer: 'function', dimension_level: 2 },
  { name: "Father's Day Gift", slug: 'fathers-day-gift', layer: 'function', dimension_level: 2 },
  { name: 'Christmas Gift', slug: 'christmas-gift', layer: 'function', dimension_level: 2 },
  { name: 'Housewarming Gift', slug: 'housewarming-gift', layer: 'function', dimension_level: 2 },
  { name: 'Graduation Gift', slug: 'graduation-gift', layer: 'function', dimension_level: 2 },
  { name: 'Wedding Gift', slug: 'wedding-gift', layer: 'function', dimension_level: 2 },
  { name: 'Business Gift', slug: 'business-gift', layer: 'function', dimension_level: 2 },
  { name: 'Back to School', slug: 'back-to-school', layer: 'function', dimension_level: 2 },

  // === 痛点解决标签 (function, dimension_level 2) ===
  { name: 'Wrinkled Clothes Fix', slug: 'wrinkled-clothes-fix', layer: 'function', dimension_level: 2 },
  { name: 'Travel Iron Problem', slug: 'travel-iron-problem', layer: 'function', dimension_level: 2 },
  { name: 'No Ironing Board', slug: 'no-ironing-board', layer: 'function', dimension_level: 2 },
  { name: 'Suitcase Crush', slug: 'suitcase-crush', layer: 'function', dimension_level: 2 },
  { name: 'Low Water Pressure', slug: 'low-water-pressure', layer: 'function', dimension_level: 2 },
  { name: 'Weak Shower', slug: 'weak-shower', layer: 'function', dimension_level: 2 },
  { name: 'Sticky Tape Fail', slug: 'sticky-tape-fail', layer: 'function', dimension_level: 2 },
  { name: 'No More Glue Mess', slug: 'no-more-glue-mess', layer: 'function', dimension_level: 2 },
  { name: 'Damage Free Hanging', slug: 'damage-free-hanging', layer: 'function', dimension_level: 2 },
  { name: 'Floor Gap Fix', slug: 'floor-gap-fix', layer: 'function', dimension_level: 2 },
  { name: 'Plank Separation', slug: 'plank-separation', layer: 'function', dimension_level: 2 }
];

async function createTag(tag) {
  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify(tag)
    });

    const result = await response.json();

    if (result.ok || result.success) {
      const tagId = result.data?.id || result.id;
      console.log(`   ✅ 创建标签: ${tag.name} (${tag.slug}) → ID: ${tagId}`);
      return { success: true, id: tagId, tag: tag.name };
    } else {
      // 可能是标签已存在
      if (result.error?.code === 'TAG_ALREADY_EXISTS' || result.error?.message?.includes('already exists')) {
        console.log(`   ⚠️ 标签已存在: ${tag.name} (${tag.slug})`);
        return { success: 'skipped', tag: tag.name, reason: 'already exists' };
      }
      console.log(`   ❌ 创建失败: ${tag.name} → ${JSON.stringify(result.error || result)}`);
      return { success: false, error: result.error || result, tag: tag.name };
    }
  } catch (error) {
    console.log(`   ❌ 网络错误: ${tag.name} → ${error.message}`);
    return { success: false, error: error.message, tag: tag.name };
  }
}

async function main() {
  console.log('🏷️ 开始更新平台标签体系 (2026-05-01)');
  console.log(`   共 ${newTags.length} 个标签待创建`);
  console.log('=' .repeat(60));

  // 按layer分组统计
  const byLayer = {
    'function': newTags.filter(t => t.layer === 'function'),
    'audience': newTags.filter(t => t.layer === 'audience'),
    'style': newTags.filter(t => t.layer === 'style'),
    'category': newTags.filter(t => t.layer === 'category')
  };

  console.log('\n📊 标签分布:');
  Object.entries(byLayer).forEach(([layer, tags]) => {
    if (tags.length > 0) {
      console.log(`   ${layer}: ${tags.length} 个`);
    }
  });

  console.log('\n🚀 开始创建标签...');
  const results = [];

  for (let i = 0; i < newTags.length; i++) {
    const tag = newTags[i];
    process.stdout.write(`[${i + 1}/${newTags.length}] `);
    const result = await createTag(tag);
    results.push(result);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 标签更新结果汇总:');
  console.log('=' .repeat(60));

  const successCount = results.filter(r => r.success === true).length;
  const skipCount = results.filter(r => r.success === 'skipped').length;
  const failCount = results.filter(r => r.success === false).length;

  console.log(`   ✅ 成功创建: ${successCount}`);
  console.log(`   ⚠️ 已存在跳过: ${skipCount}`);
  console.log(`   ❌ 创建失败: ${failCount}`);
  console.log(`   📝 总计: ${results.length}`);

  if (successCount > 0) {
    console.log('\n   新增标签:');
    results.filter(r => r.success === true).forEach(r => {
      console.log(`   + ${r.tag}`);
    });
  }

  if (failCount > 0) {
    console.log('\n   失败详情:');
    results.filter(r => r.success === false).forEach(r => {
      console.log(`   - ${r.tag}: ${r.error}`);
    });
  }

  console.log('\n✨ 标签体系更新完成!');
}

main().catch(console.error);