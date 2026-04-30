#!/usr/bin/env node

/**
 * Findora 2026-04-30 标签体系更新脚本
 * 将商品中的高质量标签添加到平台标签体系
 */

const API_BASE = 'https://findora.turingcorp.net/api';
const ADMIN_KEY = 'Findora-TuringCorp-13572468';

// 提取的所有标签及其分类
const tagsByCategory = {
  // Privacy & Security 标签
  'privacy-screen': 'function',
  'anti-spy': 'function',
  'screen-protection': 'function',
  'confidential-display': 'function',

  // Product Type 标签
  'frosted-glass': 'category',
  'ceramic-glass': 'category',
  'screen-protector': 'category',
  'matte-finish': 'style',
  'mini-toolkit': 'category',
  'screwdriver-set': 'category',
  'precision-driver': 'function',
  'diy-repair': 'audience',
  'lanyard-connector': 'category',
  'phone-lanyard': 'category',
  'wrist-strap': 'category',
  'anti-drop-clip': 'function',

  // Material 标签
  'tempered-ceramic': 'function',
  '9H-hardness': 'function',
  'premium-glass': 'style',
  'stainless-steel': 'function',
  'magnetic-tip': 'function',
  'metal-accessory': 'category',

  // Device Compatibility 标签
  'samsung-galaxy': 'audience',
  'galaxy-s-series': 'audience',
  'android-accessory': 'audience',

  // Use Case 标签
  'commuter-essential': 'audience',
  'office-worker': 'audience',
  'public-transit': 'audience',
  'travel-friendly': 'audience',
  'quick-fix': 'function',
  'on-the-go-repair': 'audience',
  'emergency-kit': 'function',
  'household-essential': 'audience',
  'universal-fit': 'function',
  'all-phones': 'audience',
  'case-compatible': 'function',

  // Feature 标签
  'bubble-free': 'function',
  'HD-clarity': 'function',
  'fingerprint-resistant': 'function',
  'shatterproof': 'function',
  'anti-rust': 'function',
  'durable-head': 'function',
  'rust-proof': 'function',
  'durable-finish': 'function',
  '360-rotation': 'function',
  'tangle-free': 'function',
  'anti-tangle': 'function',
  'smooth-spin': 'function',

  // Portability 标签
  'pocket-size': 'function',
  'compact-design': 'function',
  'drawer-organizer': 'function',
  'portable-kit': 'function',
  'lightweight': 'function',
  'easy-carry': 'function',
  'on-the-go': 'audience',

  // Value 标签
  'under-2-dollars': 'price',
  'impulse-buy': 'price',
  'budget-friendly': 'price',
  'high-value': 'price',
  '2-pack-bundle': 'function',
  'value-pack': 'function',

  // Target Audience 标签
  'tech-user': 'audience',
  'glasses-wearer': 'audience',
  'watch-owner': 'audience',
  'diy-enthusiast': 'audience',
  'first-time-buyer': 'audience',
  'business-user': 'audience',
  'privacy-conscious': 'audience',
  'samsung-lover': 'audience',
  'clumsy-friend': 'audience',
  'drop-prevention': 'function',
  'butterfingers': 'audience',
  'safety-first': 'audience',

  // Skill Level 标签
  'beginner-friendly': 'function',
  'no-experience-needed': 'function',
  'easy-use': 'function',

  // Problem Solved 标签
  'no-more-waiting': 'function',
  'self-sufficient': 'audience',
  'save-money-repair': 'function',
  'avoid-repair-shop': 'function',

  // Storage 标签
  'drawer-ready': 'function',
  'bag-stuffer': 'function',
  'glove-box-kit': 'function',

  // Quality Signal 标签
  '5-star-rated': 'style',
  'customer-favorite': 'style',
  'best-seller': 'style',
  'top-rated': 'style',
  'premium-build': 'style',
  'long-lasting': 'function',
  'worth-it': 'price',

  // Trend 标签
  'self-repair-movement': 'style',
  'right-to-repair': 'style',
  'sustainability': 'style',
  'reduce-e-waste': 'style',

  // Design 标签
  'deer-head': 'style',
  'animal-themed': 'style',
  'cute-accessory': 'style',
  'nature-inspired': 'style',
  'minimalist-cute': 'style',
  'nature-elegant': 'style',
  'understated-charm': 'style',

  // Function 标签
  'anti-loss': 'function',
  'drop-prevention': 'function',
  'security-accessory': 'function',
  'phone-safety': 'function',

  // Emotional Appeal 标签
  'cute-factor': 'style',
  'personality-accessory': 'style',
  'daily-companion': 'audience',
  'security-feeling': 'audience',

  // Use Case 标签
  'travel-accessory': 'audience',
  'daily-carry': 'audience',
  'festival-ready': 'audience',

  // Character Design 标签
  'angry-penguin': 'style',
  'grumpy-mood': 'style',
  'relatable-mascot': 'style',
  'mood-express': 'style',

  // Theme 标签
  'space-vibes': 'style',
  'cosmic-aesthetic': 'style',
  'astronaut-mood': 'style',
  'floating-design': 'style',

  // Product Type 标签
  'transparent-case': 'category',
  'space-shell': 'style',
  'mood-case': 'category',
  'statement-case': 'category',

  // Protection 标签
  'anti-fall': 'function',
  'shock-proof': 'function',
  'drop-defense': 'function',
  'reinforced-corners': 'function',

  // Aesthetic 标签
  'minimalist-cool': 'style',
  'dark-humor': 'style',
  'sarcastic-chic': 'style',
  'understated-rebel': 'style',

  // Target Audience 标签
  'mood-ring-generation': 'audience',
  'gen-z-humor': 'audience',
  'sarcastic-soul': 'audience',
  'introvert-pride': 'audience',

  // Emotional Appeal 标签
  'relatable-moment': 'style',
  'mood-match': 'style',
  'express-your-feels': 'function',
  'daily-humor': 'style',

  // Style 标签
  'quiet-fury': 'style',
  'chill-vibes': 'style',
  'lowkey-cool': 'style',
  'understated-power': 'style',

  // Design Style 标签
  'transparent-cosmos': 'style',
  'floating-art': 'style',
  'space-illustration': 'style',
  'minimal-graphic': 'style',

  // Trend Alignment 标签
  'mood-ring-2026': 'style',
  'emotional-expression': 'style',
  'relatable-merch': 'style',

  // Lifestyle Fit 标签
  'minimalist-design': 'style',
  'sleek-aesthetic': 'style',
  'professional-look': 'style',

  // Emotional Appeal 标签
  'your-secret-safe': 'style',
  'control-your-visibility': 'function',

  // Compatibility 标签
  'multi-purpose': 'function',
  'electronics-safe': 'function',
  'universal-tool': 'function',
  'lanyard-ready': 'function',

  // Storage 标签
  'kitchen-drawer': 'function',

  // Pack Size 标签
  'double-protection': 'function',
  'multi-purpose': 'function',
  'electronics-safe': 'function',
  'universal-tool': 'function',
  'lanyard-ready': 'function',

  // Emotional Appeal 标签
  'discreet-elegance': 'style',
  'drop-prevention': 'function',

  // Security 标签
  'anti-loss': 'function',
  'drop-prevention': 'function',
  'security-accessory': 'function',
  'phone-safety': 'function'
};

// 已有标签（避免重复创建）
const existingTags = new Set([
  'screen-protector', 'privacy-screen', 'samsung-galaxy', 'android-accessory',
  'bubble-free', 'HD-clarity', 'shatterproof', 'premium-glass',
  'screwdriver-set', 'diy-repair', 'stainless-steel', 'pocket-size',
  'budget-friendly', 'impulse-buy', 'under-2-dollars',
  '5-star-rated', 'self-repair-movement', 'sustainability',
  'universal-fit', 'all-phones', 'compact-design', 'lightweight',
  'business-user', 'privacy-conscious', 'commuter-essential',
  'transparent-case', 'anti-fall', 'drop-defense', 'shock-proof',
  'gen-z-humor', 'mood-express', 'statement-case', 'cute-accessory',
  'space-vibes', 'festival-ready', 'daily-carry'
]);

// 创建标签
async function createTag(name, slug, layer) {
  // 跳过已有标签
  if (existingTags.has(slug)) {
    return { ok: true, data: { id: 'existing', message: 'Tag already exists' } };
  }

  const response = await fetch(`${API_BASE}/admin/tags`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ name, slug, layer })
  });

  return await response.json();
}

// 主函数
async function main() {
  console.log('=== Findora 2026-04-30 标签体系更新 ===\n');

  const tagsToCreate = Object.entries(tagsByCategory);
  console.log(`📊 共 ${tagsToCreate.length} 个标签需要处理\n`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const [tagSlug, layer] of tagsToCreate) {
    // 跳过已有标签
    if (existingTags.has(tagSlug)) {
      skippedCount++;
      console.log(`⏭️  跳过已有标签: #${tagSlug} (${layer})`);
      continue;
    }

    // 创建标签
    const tagName = tagSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    try {
      const result = await createTag(tagName, tagSlug, layer);

      if (result.ok) {
        createdCount++;
        console.log(`✅ 新增标签: #${tagSlug} (${layer}) - ID: ${result.data.id}`);
      } else {
        // 可能已存在（并发情况）
        if (result.error?.code === 'INVALID_PARAMS' && result.error?.message?.includes('Slug')) {
          skippedCount++;
          console.log(`⏭️  标签已存在: #${tagSlug}`);
        } else {
          console.log(`❌ 创建失败: #${tagSlug} - ${JSON.stringify(result.error)}`);
        }
      }
    } catch (err) {
      console.error(`❌ API错误: ${err.message}`);
    }

    // 延迟避免过快
    await new Promise(r => setTimeout(r, 100));
  }

  console.log(`\n=== 标签更新完成 ===`);
  console.log(`✅ 新增标签: ${createdCount}`);
  console.log(`⏭️  跳过/已有: ${skippedCount}`);
  console.log(`📊 总计处理: ${tagsToCreate.length}`);
}

main().catch(console.error);