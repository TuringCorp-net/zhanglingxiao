/**
 * 创建高频优质标签到平台标签体系
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 本次审核发现的优质标签
const QUALITY_TAGS = [
  // 风格标签
  { name: 'Vintage Style', slug: 'vintage-style', layer: 'style' },
  { name: 'Retro Aesthetic', slug: 'retro-aesthetic', layer: 'style' },
  { name: 'Dad Style', slug: 'dad-style', layer: 'style' },
  { name: 'Cozy Aesthetic', slug: 'cozy-aesthetic', layer: 'style' },
  { name: 'Dreamcore', slug: 'dreamcore', layer: 'style' },

  // 功能标签
  { name: 'Conversation Starter', slug: 'conversation-starter', layer: 'function' },
  { name: 'Ice Breaker', slug: 'ice-breaker', layer: 'function' },
  { name: 'Room Transformation', slug: 'room-transformation', layer: 'function' },
  { name: 'Mood Setter', slug: 'mood-setter', layer: 'function' },
  { name: 'Family Photo Prop', slug: 'family-photo-prop', layer: 'function' },
  { name: 'Gift Ready', slug: 'gift-ready', layer: 'function' },
  { name: 'Remote Control', slug: 'remote-control', layer: 'function' },

  // 情感标签
  { name: 'Humorous', slug: 'humorous', layer: 'function' },
  { name: 'Relatable', slug: 'relatable', layer: 'function' },
  { name: 'Magical', slug: 'magical', layer: 'function' },
  { name: 'Nostalgic', slug: 'nostalgic', layer: 'function' },
  { name: 'Dreamy', slug: 'dreamy', layer: 'function' },
  { name: 'Romantic', slug: 'romantic', layer: 'function' },

  // 场景标签
  { name: 'Game Day', slug: 'game-day', layer: 'function' },
  { name: 'Tailgate Party', slug: 'tailgate-party', layer: 'function' },
  { name: "Father's Day", slug: 'fathers-day', layer: 'function' },
  { name: 'BBQ Essential', slug: 'bbq-essential', layer: 'function' },
  { name: 'Halloween Costume', slug: 'halloween-costume', layer: 'function' },
  { name: 'Family Photo', slug: 'family-photo', layer: 'function' },
  { name: 'Party Atmosphere', slug: 'party-atmosphere', layer: 'function' },
  { name: 'Meditation', slug: 'meditation', layer: 'function' },
  { name: 'Date Night', slug: 'date-night', layer: 'function' },

  // 人群标签
  { name: 'Sports Fans', slug: 'sports-fans', layer: 'audience' },
  { name: 'College Students', slug: 'college-students', layer: 'audience' },
  { name: 'Dads', slug: 'dads', layer: 'audience' },
  { name: 'Parents', slug: 'parents', layer: 'audience' },
  { name: 'Toddlers', slug: 'toddlers', layer: 'audience' },
  { name: 'Dreamers', slug: 'dreamers', layer: 'audience' },
  { name: 'Couples', slug: 'couples', layer: 'audience' },

  // 文化标签
  { name: 'NCAA Culture', slug: 'ncaa-culture', layer: 'function' },
  { name: 'College Sports', slug: 'college-sports', layer: 'function' },
  { name: 'Dad Joke Culture', slug: 'dad-joke-culture', layer: 'function' },
  { name: 'Beer Culture', slug: 'beer-culture', layer: 'function' },
  { name: 'Fan Culture', slug: 'fan-culture', layer: 'function' },
  { name: 'Aurora Borealis', slug: 'aurora-borealis', layer: 'function' },
  { name: 'Shark Week', slug: 'shark-week', layer: 'function' },

  // 价格标签
  { name: 'Ultra Budget', slug: 'ultra-budget', layer: 'price' },
  { name: 'Impulse Buy', slug: 'impulse-buy', layer: 'price' },
  { name: 'Value Gift', slug: 'value-gift', layer: 'price' },

  // 平台标签
  { name: 'TikTok Trending', slug: 'tiktok-trending', layer: 'function' },
  { name: 'Viral Potential', slug: 'viral-potential', layer: 'function' },
  { name: 'Best Seller', slug: 'best-seller', layer: 'function' }
];

async function createTag(tag) {
  const response = await fetch(`${API_BASE}/admin/tags`, {
    method: 'POST',
    headers: {
      'X-Admin-Key': ADMIN_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: tag.name,
      slug: tag.slug,
      layer: tag.layer,
      dimension_level: 2
    })
  });
  return response.json();
}

async function main() {
  console.log('=== 创建优质标签到平台体系 ===\n');
  console.log(`准备创建 ${QUALITY_TAGS.length} 个优质标签...\n`);

  let successCount = 0;
  let skipCount = 0;
  let failCount = 0;

  for (const tag of QUALITY_TAGS) {
    try {
      const result = await createTag(tag);
      if (result.ok) {
        console.log(`✓ 创建: ${tag.name} (${tag.slug}) - ${tag.layer}`);
        successCount++;
      } else if (result.error?.code === 'TAG_ALREADY_EXISTS') {
        console.log(`- 跳过(已存在): ${tag.name}`);
        skipCount++;
      } else {
        console.log(`✗ 失败: ${tag.name} - ${JSON.stringify(result.error)}`);
        failCount++;
      }
    } catch (err) {
      console.log(`✗ 异常: ${tag.name} - ${err.message}`);
      failCount++;
    }
  }

  console.log('\n=== 任务完成 ===');
  console.log(`成功: ${successCount}`);
  console.log(`跳过(已存在): ${skipCount}`);
  console.log(`失败: ${failCount}`);
}

main().catch(console.error);