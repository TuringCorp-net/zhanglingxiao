/**
 * 更新平台标签体系 (2026-05-02)
 * 基于4个PASS商品的标签矩阵，将优质标签纳入平台标签体系
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api/admin/tags';

// 从4个PASS商品提取的优质标签
const newTags = [
  // === 节日场景标签 (function, dimension_level 2) ===
  { name: 'Graduation 2026', slug: 'graduation-2026', layer: 'function', dimension_level: 2 },
  { name: 'Class of 2026', slug: 'class-of-2026', layer: 'function', dimension_level: 2 },
  { name: 'BS Degree', slug: 'bs-degree', layer: 'function', dimension_level: 2 },
  { name: 'Grad Party', slug: 'grad-party', layer: 'function', dimension_level: 2 },
  { name: 'Birthday Cake Topper', slug: 'birthday-cake-topper', layer: 'function', dimension_level: 2 },
  { name: '18th Birthday', slug: '18th-birthday', layer: 'function', dimension_level: 2 },
  { name: 'Milestone Celebration', slug: 'milestone-celebration', layer: 'function', dimension_level: 2 },

  // === 风格标签 (style, dimension_level 2) ===
  { name: 'Black Glitter', slug: 'black-glitter', layer: 'style', dimension_level: 2 },
  { name: 'Gold Acrylic', slug: 'gold-acrylic', layer: 'style', dimension_level: 2 },
  { name: 'Shiny Aesthetic', slug: 'shiny-aesthetic', layer: 'style', dimension_level: 2 },
  { name: 'Modern Design', slug: 'modern-design', layer: 'style', dimension_level: 2 },

  // === 功能标签 (function, dimension_level 2) ===
  { name: 'Cake Decoration', slug: 'cake-decoration', layer: 'function', dimension_level: 2 },
  { name: 'Party Decorations', slug: 'party-decorations', layer: 'function', dimension_level: 2 },
  { name: 'Reusable Decor', slug: 'reusable-decor', layer: 'function', dimension_level: 2 },
  { name: 'Photo-Worthy', slug: 'photo-worthy', layer: 'function', dimension_level: 2 },

  // === 人群标签 (audience, dimension_level 1) ===
  { name: 'Class of 2026 Grads', slug: 'class-of-2026-grads', layer: 'audience', dimension_level: 1 },
  { name: 'College Students', slug: 'college-students', layer: 'audience', dimension_level: 1 },
  { name: 'Science Majors', slug: 'science-majors', layer: 'audience', dimension_level: 1 },
  { name: 'Teens', slug: 'teens', layer: 'audience', dimension_level: 1 },
  { name: 'Party Planners', slug: 'party-planners', layer: 'audience', dimension_level: 1 },

  // === 情感标签 (function, dimension_level 2) ===
  { name: 'Humor Lifestyle', slug: 'humor-lifestyle', layer: 'function', dimension_level: 2 },
  { name: 'Gen Z Humor', slug: 'gen-z-humor', layer: 'function', dimension_level: 2 },
  { name: 'Gift for Grad', slug: 'gift-for-grad', layer: 'function', dimension_level: 2 },

  // === 美人鱼主题 (function, dimension_level 2) ===
  { name: 'Mermaid Party', slug: 'mermaid-party', layer: 'function', dimension_level: 2 },
  { name: 'Under the Sea', slug: 'under-the-sea', layer: 'function', dimension_level: 2 },
  { name: 'Glitter Aesthetic', slug: 'glitter-aesthetic', layer: 'style', dimension_level: 2 },
  { name: 'Dreamy Vibes', slug: 'dreamy-vibes', layer: 'style', dimension_level: 2 },
  { name: 'Kids Party', slug: 'kids-party', layer: 'function', dimension_level: 2 },
  { name: 'Baby Shower', slug: 'baby-shower', layer: 'function', dimension_level: 2 },
  { name: 'Iridescent', slug: 'iridescent', layer: 'style', dimension_level: 2 },

  // === 男装/音乐标签 (function, dimension_level 2) ===
  { name: 'Rock Band', slug: 'rock-band', layer: 'function', dimension_level: 2 },
  { name: 'Licensed Artwork', slug: 'licensed-artwork', layer: 'function', dimension_level: 2 },
  { name: 'Vintage Graphic Tee', slug: 'vintage-graphic-tee', layer: 'style', dimension_level: 2 },
  { name: 'Cotton Summer', slug: 'cotton-summer', layer: 'function', dimension_level: 2 },
  { name: 'Y2K Vibes', slug: 'y2k-vibes', layer: 'style', dimension_level: 2 },
  { name: 'Concert Essentials', slug: 'concert-essentials', layer: 'function', dimension_level: 2 },
  { name: 'Festival Fashion', slug: 'festival-fashion', layer: 'style', dimension_level: 2 },
  { name: 'Rockstar Aesthetic', slug: 'rockstar-aesthetic', layer: 'style', dimension_level: 2 },
  { name: 'Thrift Style', slug: 'thrift-style', layer: 'style', dimension_level: 2 },
  { name: 'New Arrival', slug: 'new-arrival', layer: 'function', dimension_level: 2 },
  { name: 'Black Fashion', slug: 'black-fashion', layer: 'style', dimension_level: 2 },
  { name: 'Music Lifestyle', slug: 'music-lifestyle', layer: 'function', dimension_level: 2 }
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
  console.log('🏷️ 开始更新平台标签体系 (2026-05-02)');
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