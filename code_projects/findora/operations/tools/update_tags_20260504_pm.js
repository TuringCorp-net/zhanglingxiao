#!/usr/bin/env node

/**
 * 标签体系更新脚本 - 2026-05-04 (下午批次)
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

// 从 PASS 商品中提取的所有标签
const tagsToCreate = [
  // 商品1: 恐龙泡泡机 (20260504001)
  { name: 'Easter Egg Hunt', slug: 'easter-egg-hunt', layer: 'festival', dimension_level: 2 },
  { name: 'Summer Outdoor', slug: 'summer-outdoor', layer: 'festival', dimension_level: 2 },
  { name: 'Kids Birthday Party', slug: 'kids-birthday-party', layer: 'festival', dimension_level: 2 },
  { name: 'Pool Party', slug: 'pool-party', layer: 'festival', dimension_level: 2 },
  { name: 'Christmas Morning', slug: 'christmas-morning', layer: 'festival', dimension_level: 2 },
  { name: 'Halloween Treats', slug: 'halloween-treats', layer: 'festival', dimension_level: 2 },
  { name: 'Backyard BBQ', slug: 'backyard-bbq', layer: 'festival', dimension_level: 2 },
  { name: 'Kids Ages 3-10', slug: 'kids-ages-3-10', layer: 'audience', dimension_level: 2 },
  { name: 'Toddlers', slug: 'toddlers', layer: 'audience', dimension_level: 2 },
  { name: 'Party Hosts', slug: 'party-hosts', layer: 'audience', dimension_level: 2 },
  { name: 'Parents of Active Kids', slug: 'parents-of-active-kids', layer: 'audience', dimension_level: 2 },
  { name: 'Grandparents Seeking Gifts', slug: 'grandparents-seeking-gifts', layer: 'audience', dimension_level: 2 },
  { name: 'Dog Owners', slug: 'dog-owners', layer: 'audience', dimension_level: 2 },
  { name: 'Joy Trigger', slug: 'joy-trigger', layer: 'emotion', dimension_level: 2 },
  { name: 'Pure Play Magic', slug: 'pure-play-magic', layer: 'emotion', dimension_level: 2 },
  { name: 'Parenting Win', slug: 'parenting-win', layer: 'emotion', dimension_level: 2 },
  { name: 'Photo-Worthy Moments', slug: 'photo-worthy-moments', layer: 'emotion', dimension_level: 2 },
  { name: 'Satisfying ASMR', slug: 'satisfying-asmr', layer: 'content', dimension_level: 2 },
  { name: 'Party Supplies', slug: 'party-supplies', layer: 'content', dimension_level: 2 },
  { name: 'Outdoor Activity', slug: 'outdoor-activity', layer: 'content', dimension_level: 2 },
  { name: 'Sensory Play', slug: 'sensory-play', layer: 'content', dimension_level: 2 },
  { name: 'Impulse Buy Under $10', slug: 'impulse-buy-under-10', layer: 'psychology', dimension_level: 2 },
  { name: 'Gift-Ready', slug: 'gift-ready', layer: 'psychology', dimension_level: 2 },
  { name: 'Temu Top Seller', slug: 'temu-top-seller', layer: 'platform', dimension_level: 2 },
  { name: 'Viral TikTok Potential', slug: 'viral-tiktok-potential', layer: 'platform', dimension_level: 2 },
  { name: 'Gatling Design', slug: 'gatling-design', layer: 'feature', dimension_level: 2 },
  { name: 'Battery-Operated', slug: 'battery-operated', layer: 'feature', dimension_level: 2 },
  { name: 'Instant On', slug: 'instant-on', layer: 'feature', dimension_level: 2 },
  { name: 'Holiday Stocking Stuffer', slug: 'holiday-stocking-stuffer', layer: 'gift', dimension_level: 2 },

  // 商品2: 16孔口琴 (20260504002)
  { name: 'Kids Birthday', slug: 'kids-birthday', layer: 'festival', dimension_level: 2 },
  { name: 'Christmas Stocking Stuffer', slug: 'christmas-stocking-stuffer', layer: 'festival', dimension_level: 2 },
  { name: 'Back to School', slug: 'back-to-school', layer: 'festival', dimension_level: 2 },
  { name: 'Music Class', slug: 'music-class', layer: 'festival', dimension_level: 2 },
  { name: 'Easter Basket Addition', slug: 'easter-basket-addition', layer: 'festival', dimension_level: 2 },
  { name: 'Music-Curious Children', slug: 'music-curious-children', layer: 'audience', dimension_level: 2 },
  { name: 'First Instrument Buyers', slug: 'first-instrument-buyers', layer: 'audience', dimension_level: 2 },
  { name: 'Early Childhood Educators', slug: 'early-childhood-educators', layer: 'audience', dimension_level: 2 },
  { name: 'First Instrument Milestone', slug: 'first-instrument-milestone', layer: 'emotion', dimension_level: 2 },
  { name: 'Parent-Child Bonding', slug: 'parent-child-bonding', layer: 'emotion', dimension_level: 2 },
  { name: 'Musical Awakening', slug: 'musical-awakening', layer: 'emotion', dimension_level: 2 },
  { name: 'Music Tutorial Content', slug: 'music-tutorial-content', layer: 'content', dimension_level: 2 },
  { name: 'Child Development', slug: 'child-development', layer: 'content', dimension_level: 2 },
  { name: 'Educational Toys', slug: 'educational-toys', layer: 'content', dimension_level: 2 },
  { name: 'Low-Risk Musical Exploration', slug: 'low-risk-musical-exploration', layer: 'psychology', dimension_level: 2 },
  { name: 'Montessori-Aligned', slug: 'montessori-aligned', layer: 'platform', dimension_level: 2 },
  { name: '16 Holes', slug: '16-holes', layer: 'feature', dimension_level: 2 },
  { name: 'Authentic Sound Quality', slug: 'authentic-sound-quality', layer: 'feature', dimension_level: 2 },
  { name: 'No Assembly', slug: 'no-assembly', layer: 'feature', dimension_level: 2 },
  { name: 'Party Favor', slug: 'party-favor', layer: 'gift', dimension_level: 2 },

  // 商品3: 54张卡牌+12杯子+1拍铃桌游 (20260504003)
  { name: "New Year's Eve Party", slug: 'new-years-eve-party', layer: 'festival', dimension_level: 2 },
  { name: 'Birthday Party Game', slug: 'birthday-party-game', layer: 'festival', dimension_level: 2 },
  { name: 'Thanksgiving Family Time', slug: 'thanksgiving-family-time', layer: 'festival', dimension_level: 2 },
  { name: 'Holiday Gift Exchange', slug: 'holiday-gift-exchange', layer: 'festival', dimension_level: 2 },
  { name: 'Easter Gathering', slug: 'easter-gathering', layer: 'festival', dimension_level: 2 },
  { name: "Valentine's Day Couples", slug: 'valentines-day-couples', layer: 'festival', dimension_level: 2 },
  { name: 'Family Groups', slug: 'family-groups', layer: 'audience', dimension_level: 2 },
  { name: 'Friend Groups', slug: 'friend-groups', layer: 'audience', dimension_level: 2 },
  { name: 'Couples Game Night', slug: 'couples-game-night', layer: 'audience', dimension_level: 2 },
  { name: 'Classroom Teachers', slug: 'classroom-teachers', layer: 'audience', dimension_level: 2 },
  { name: 'Ice Breaker Seekers', slug: 'ice-breaker-seekers', layer: 'audience', dimension_level: 2 },
  { name: 'Competitive Fun', slug: 'competitive-fun', layer: 'emotion', dimension_level: 2 },
  { name: 'Family Bonding', slug: 'family-bonding', layer: 'emotion', dimension_level: 2 },
  { name: 'Party Atmosphere', slug: 'party-atmosphere', layer: 'emotion', dimension_level: 2 },
  { name: 'Nostalgic Game Night', slug: 'nostalgic-game-night', layer: 'emotion', dimension_level: 2 },
  { name: 'Party Games', slug: 'party-games', layer: 'content', dimension_level: 2 },
  { name: 'Family Game Night', slug: 'family-game-night', layer: 'content', dimension_level: 2 },
  { name: 'Social Party Games', slug: 'social-party-games', layer: 'content', dimension_level: 2 },
  { name: 'TikTok Challenge Potential', slug: 'tiktok-challenge-potential', layer: 'content', dimension_level: 2 },
  { name: 'Party Planning Essential', slug: 'party-planning-essential', layer: 'psychology', dimension_level: 2 },
  { name: 'Bell Mechanic', slug: 'bell-mechanic', layer: 'feature', dimension_level: 2 },
  { name: '54 Cards', slug: '54-cards', layer: 'feature', dimension_level: 2 },
  { name: 'Ready to Play', slug: 'ready-to-play', layer: 'feature', dimension_level: 2 },
  { name: 'No Setup Required', slug: 'no-setup-required', layer: 'feature', dimension_level: 2 },
  { name: 'Reusable', slug: 'reusable', layer: 'feature', dimension_level: 2 },
  { name: 'Housewarming Gift', slug: 'housewarming-gift', layer: 'gift', dimension_level: 2 },
  { name: 'Teacher Gift', slug: 'teacher-gift', layer: 'gift', dimension_level: 2 },

  // 商品4: 双面惯性特技越野迷你车模 (20260504004)
  { name: 'Classroom Prize', slug: 'classroom-prize', layer: 'festival', dimension_level: 2 },
  { name: 'Dual-Sided', slug: 'dual-sided', layer: 'feature', dimension_level: 2 },
  { name: 'Inertia-Powered', slug: 'inertia-powered', layer: 'feature', dimension_level: 2 },
  { name: 'Off-Road Design', slug: 'off-road-design', layer: 'feature', dimension_level: 2 },
  { name: 'No Batteries Needed', slug: 'no-batteries-needed', layer: 'feature', dimension_level: 2 },
  { name: 'Zero Setup', slug: 'zero-setup', layer: 'feature', dimension_level: 2 },
  { name: 'Stocking Stuffer', slug: 'stocking-stuffer', layer: 'gift', dimension_level: 2 },
  { name: 'Easter Egg Filler', slug: 'easter-egg-filler', layer: 'gift', dimension_level: 2 },
  { name: 'Halloween Trick-or-Treat', slug: 'halloween-trick-or-treat', layer: 'festival', dimension_level: 2 },
  { name: 'Boys and Girls', slug: 'boys-and-girls', layer: 'audience', dimension_level: 2 },
  { name: 'Car Enthusiasts', slug: 'car-enthusiasts', layer: 'audience', dimension_level: 2 },
  { name: 'Party Planners', slug: 'party-planners', layer: 'audience', dimension_level: 2 },
  { name: 'It Works Satisfaction', slug: 'it-works-satisfaction', layer: 'emotion', dimension_level: 2 },
  { name: 'Mechanical Wonder', slug: 'mechanical-wonder', layer: 'emotion', dimension_level: 2 },
  { name: 'Independent Play', slug: 'independent-play', layer: 'emotion', dimension_level: 2 },
  { name: 'Screen-Free Entertainment', slug: 'screen-free-entertainment', layer: 'emotion', dimension_level: 2 },
  { name: 'Collectible Appeal', slug: 'collectible-appeal', layer: 'emotion', dimension_level: 2 },
  { name: 'Physics Demo', slug: 'physics-demo', layer: 'content', dimension_level: 2 },
  { name: 'Toy Car Racing', slug: 'toy-car-racing', layer: 'content', dimension_level: 2 },
  { name: 'STEM-Adjacent Learning', slug: 'stem-adjacent-learning', layer: 'content', dimension_level: 2 },
  { name: 'Impulse Buy Under $3', slug: 'impulse-buy-under-3', layer: 'psychology', dimension_level: 2 },
  { name: 'Bulk Purchase Friendly', slug: 'bulk-purchase-friendly', layer: 'psychology', dimension_level: 2 },
  { name: 'Fidget Alternative', slug: 'fidget-alternative', layer: 'platform', dimension_level: 2 },
  { name: 'Small Toy Movement', slug: 'small-toy-movement', layer: 'platform', dimension_level: 2 },

  // 商品6: 可重复使用魔法练习笔记本 (20260504006)
  { name: "Mother's Day Crafting", slug: 'mothers-day-crafting', layer: 'festival', dimension_level: 2 },
  { name: 'Summer Brain Retention', slug: 'summer-brain-retention', layer: 'festival', dimension_level: 2 },
  { name: 'Teacher Supply', slug: 'teacher-supply', layer: 'festival', dimension_level: 2 },
  { name: 'Kids Ages 4-12', slug: 'kids-ages-4-12', layer: 'audience', dimension_level: 2 },
  { name: 'Eco-Conscious Parents', slug: 'eco-conscious-parents', layer: 'audience', dimension_level: 2 },
  { name: 'Montessori Families', slug: 'montessori-families', layer: 'audience', dimension_level: 2 },
  { name: 'Learning Enthusiasts', slug: 'learning-enthusiasts', layer: 'audience', dimension_level: 2 },
  { name: 'ADHD-Friendly', slug: 'adhd-friendly', layer: 'audience', dimension_level: 2 },
  { name: 'Eco-Positive Parenting', slug: 'eco-positive-parenting', layer: 'emotion', dimension_level: 2 },
  { name: 'Growth Mindset Teaching', slug: 'growth-mindset-teaching', layer: 'emotion', dimension_level: 2 },
  { name: 'Creative Freedom', slug: 'creative-freedom', layer: 'emotion', dimension_level: 2 },
  { name: 'Eco-Friendly Product', slug: 'eco-friendly-product', layer: 'content', dimension_level: 2 },
  { name: 'Brain Development', slug: 'brain-development', layer: 'content', dimension_level: 2 },
  { name: 'Wipe-Clean Activity', slug: 'wipe-clean-activity', layer: 'content', dimension_level: 2 },
  { name: 'Eco-Guilt-Free Purchase', slug: 'eco-guilt-free-purchase', layer: 'psychology', dimension_level: 2 },
  { name: 'Better Than Worksheets', slug: 'better-than-worksheets', layer: 'psychology', dimension_level: 2 },
  { name: 'Sustainable Living', slug: 'sustainable-living', layer: 'psychology', dimension_level: 2 },
  { name: 'Montessori Movement', slug: 'montessori-movement', layer: 'platform', dimension_level: 2 },
  { name: 'Zero-Waste Living', slug: 'zero-waste-living', layer: 'platform', dimension_level: 2 },
  { name: '32 Reusable Pages', slug: '32-reusable-pages', layer: 'feature', dimension_level: 2 },
  { name: 'Wipe-Clean', slug: 'wipe-clean', layer: 'feature', dimension_level: 2 },
  { name: 'Screen Alternative', slug: 'screen-alternative', layer: 'feature', dimension_level: 2 },
  { name: 'Birthday Educational Gift', slug: 'birthday-educational-gift', layer: 'gift', dimension_level: 2 },
  { name: 'Christmas Educational Gift', slug: 'christmas-educational-gift', layer: 'gift', dimension_level: 2 },
  { name: 'Grandparents Gift', slug: 'grandparents-gift', layer: 'gift', dimension_level: 2 },
  { name: 'Eco-Conscious Family', slug: 'eco-conscious-family', layer: 'gift', dimension_level: 2 }
];

async function main() {
  console.log('=== 标签体系更新开始 (2026-05-04 下午批次) ===\n');
  console.log(`计划创建 ${tagsToCreate.length} 个标签\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < tagsToCreate.length; i++) {
    const tag = tagsToCreate[i];

    try {
      const result = await createTag(tag);

      if (result.ok) {
        console.log(`✅ [${i + 1}/${tagsToCreate.length}] 创建标签: ${tag.name} (${tag.slug})`);
        created++;
      } else {
        // 可能是重复标签（slug已存在）
        if (result.error?.code === 'INVALID_PARAMS' && result.error?.message?.includes('already')) {
          console.log(`⏭️  [${i + 1}/${tagsToCreate.length}] 跳过已存在: ${tag.name}`);
          skipped++;
        } else {
          console.log(`⚠️  [${i + 1}/${tagsToCreate.length}] 创建失败: ${tag.name} - ${result.error?.message || JSON.stringify(result.error)}`);
          failed++;
        }
      }
    } catch (err) {
      console.error(`❌ [${i + 1}/${tagsToCreate.length}] API错误: ${tag.name} - ${err.message}`);
      failed++;
    }

    // 延迟避免请求过快
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n=== 标签体系更新完成 ===');
  console.log(`创建成功: ${created}`);
  console.log(`跳过(已存在): ${skipped}`);
  console.log(`失败: ${failed}`);
  console.log(`总计: ${tagsToCreate.length}`);
}

main().catch(console.error);