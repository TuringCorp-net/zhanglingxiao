/**
 * 上架运营总监通过的PASS商品 (2026-05-01)
 * 根据 operations/candidate 目录下经Curator二次策划的商品
 * 筛选出更具爆款潜力的商品上架至Findora数据库
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api/admin/products';

// 4个PASS商品的核心数据
const passProducts = [
  // C20260501-002: 高强度双面纳米胶带
  {
    source_platform: 'temu',
    source_url: 'https://www.temu.com/g-601102161808663.html',
    original_title: '高强度双面纳米胶带 - 超强粘合力，可重复使用，多功能粘贴解决方案',
    title: 'The Tape That Fixes EVERYTHING (And Never Gives Up)',
    category: '艺术品、工艺品和缝纫用品',
    subcategory: '手工工具和用品',
    tags: ['double-sided-tape', 'nano-tape', 'adhesive-solutions', 'mounting-tape', 'home-organization', 'christmas-decor', 'car-accessories', 'craft-projects', 'diy-enthusiasts', 'home-owners', 'strong-hold', 'washable', 'reusable', 'impulse-buy'],
    price_min: 3.25,
    price_max: 3.55,
    currency: 'USD',
    cover_image: 'https://img.kwcdn.com/product/open/225877ed2c91416f882457c1af3ace7c-goods.jpeg',
    summary: `**The Tape That Fixes EVERYTHING (And Never Gives Up)**

You know that moment when you need to stick something—like RIGHT NOW—but regular tape is too weak, glue is too messy, and screws are just... overkill?

MEET YOUR NEW OBSESSION: Nano Tape That Actually Works.

This isn't your average sticky strip. This is the superhero of tapes—and 200,000 satisfied customers will back us up.

💪 **Holds Like It Means It** — Got 2.5kg of decorative light hanging? No problem. This nano-powder infused tape doesn't just stick—it LOCKS IN.

🔄 **Washes Clean, Sticks Again** — Peel it off, rinse it under the tap, and it's BACK. One tape, hundreds of uses. That's not just smart—it's practically free.

🏠 **Your Whole House Just Leveled Up:**
- Fix that wobbly picture frame (finally!)
- Keep your phone holder from sliding in the car
- Secure your area rug without the rug pad shuffle
- Hang Christmas lights without destroying your walls
- Fix your kid's broken toy BEFORE they notice

🎄 **Christmas? MORE Like Christmas EASY** — Stop wrestling with tangled light clips. Wrap, stick, DONE. Your future self will send you a thank-you card.

**Stop buying single-use tape that's basically tissue paper with adhesive. This is the tape that respects you.**`,
    source_md: require('fs').readFileSync('./operations/pass/2026-05-01/C20260501-002.md', 'utf8'),
    source_filename: 'C20260501-002.md'
  },

  // C20260501-005: 地板缝隙修复工具
  {
    source_platform: 'amazon',
    source_url: 'https://www.amazon.com/dp/FLOOR-GAP-REPAIR',
    original_title: '地板缝隙修复工具，重型木质和乙烯基地板用的复合地板工具，带橡胶垫的碳钢地板吸盘工具',
    title: 'Stop Staring at That Gap. FIX IT in 5 Minutes.',
    category: '电动和手动工具',
    subcategory: '地板工具',
    tags: ['floor-gap-repair', 'laminate-floor-tool', 'vinyl-floor-fixer', 'flooring-repair', 'home-renovation', 'floor-maintenance', 'home-owners', 'renters', 'suction-cup-design', 'lever-mechanism', 'amazon-choice', 'before-after-reveal'],
    price_min: 18.79,
    price_max: 18.79,
    currency: 'USD',
    cover_image: 'https://m.media-amazon.com/images/I/512--JLMUsL._AC_SX679_.jpg',
    summary: `**Stop Staring at That Gap. FIX IT in 5 Minutes.**

If you have vinyl or laminate flooring, you know this nightmare:
⚠️ A tiny gap between planks
⚠️ It catches EVERYTHING: dirt, dust, crumbs, pet hair
⚠️ It grows bigger every month
⚠️ You Google "how to fix floor gap" and get overwhelmed

Sound familiar? You're not alone. Floor gaps affect millions of homes—and most people just... live with them.

Until now.

🏆 **MEET THE TOOL 13 MILLION HOMES ARE USING:**

This isn't some gimmicky gadget. This is a heavy-duty carbon steel tool with a powerful suction cup that actually PULLS your floor planks back together.

🎯 **Why This Works (When Everything Else Fails):**
- **Suction Power**: Creates strong vacuum grip on your floor
- **Carbon Steel Body**: Built to last, won't bend or break
- **Rubber Pad Protection**: Won't scratch or damage your floor
- **Lever Principle**: Amplifies your force for effortless pulling

✨ **Works On:**
- Laminate flooring
- Vinyl planks (LVP, LVT)
- Engineered wood
- Floating floors
- Snap-together flooring

📊 **The Math Is Simple:**
- Call a professional: $200-500
- Rent equipment: $50-100
- This tool: $18.79

**Stop tolerating that gap. Stop avoiding that corner. Stop sweeping dirt back into the same spot every single day.**

This is the tool that makes your floor look like it did when it was brand new.`,
    source_md: require('fs').readFileSync('./operations/pass/2026-05-01/C20260501-005.md', 'utf8'),
    source_filename: 'C20260501-005.md'
  },

  // C20260501-007: 加压手持多头花洒
  {
    source_platform: 'tiktok',
    source_url: 'https://www.tiktok.com/product/phueut-pressurized-shower',
    original_title: '[Mother\'s Day Gift] Phueut Pressurized Handheld Multi-Head Shower',
    title: 'Your Shower Was Lying to You. This Fixes Everything.',
    category: 'Household Appliances',
    subcategory: '浴室用品',
    tags: ['handheld-shower-head', 'pressurized-shower', 'multi-head-shower', 'daily-shower', 'spa-experience', 'low-pressure-fix', 'bathroom-upgrade', 'home-owners', 'apartment-renters', 'pressure-boost', 'multi-spray', 'mothers-day-gift', 'fathers-day-gift'],
    price_min: 40.99,
    price_max: 40.99,
    currency: 'USD',
    cover_image: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-o',
    summary: `**Your Shower Was Lying to You. This Fixes Everything.**

Let's be honest. You've experienced this:

🚿 You turn on the shower. Water trickles. Trickles. You wait. Nothing changes.

🚿 You angle the head, adjust the knobs, stand on one foot—still feels like rain through a straw.

🚿 You Google "low water pressure in apartment" and get 47 answers, none of which help.

The problem isn't your plumbing. The problem is your showerhead.

💫 **INTRODUCING THE SHOWER HEAD THAT ACTUALLY DELIVERS:**

This isn't just a showerhead. It's a PRESSURE REVOLUTION for your bathroom.

✨ **MULTI-HEAD MAGIC:**
- 5+ spray modes in one handheld
- Switch from gentle rainfall to targeted massage
- Perfect for families—everyone gets their preferred experience

💪 **PRESSURE BOOSTED:**
- Micro-high-pressure technology
- Turns your weak trickle into a satisfying cascade
- Each nozzle optimized for maximum force

🛁 **Your New Shower Routine:**
Morning: "I need to WAKE UP" → Jet mode. Caffeine who?
Evening: "I need to DESTREss" → Rainfall mode. Spa who?

🎁 **The Gift That Keeps Giving:**
- Mother's Day? CHECK.
- Father's Day? Double-check.
- Christmas? Triple-check.
- "I have no idea what to get you" situation? FOURTH CHECK.

**Stop suffering through weak showers. This is the upgrade your bathroom has been waiting for.**

P.S. Install takes 5 minutes. No plumber needed. You're welcome.`,
    source_md: require('fs').readFileSync('./operations/pass/2026-05-01/C20260501-007.md', 'utf8'),
    source_filename: 'C20260501-007.md'
  },

  // C20260501-008: Dr.Flash 便携衣物蒸汽机
  {
    source_platform: 'tiktok',
    source_url: 'https://www.tiktok.com/product/dr-flash-garment-steamer',
    original_title: 'Dr.Flash Garment Steamer for Clothes, Portable Travel Steamer',
    title: 'The Last Iron You\'ll Ever Pack (Or Own)',
    category: 'Household Appliances',
    subcategory: '衣物护理',
    tags: ['garment-steamer', 'portable-steamer', 'travel-steamer', 'clothes-steamer', 'business-travel', 'vacation-packing', 'college-life', 'quick-refresh', 'business-professionals', 'frequent-travelers', 'students', 'quick-heat', 'continuous-steam', 'anti-wrinkle'],
    price_min: 29.98,
    price_max: 64,
    currency: 'USD',
    cover_image: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-o',
    summary: `**The Last Iron You'll Ever Pack (Or Own)**

You know this nightmare:
🧳 Business trip. Important meeting in 2 hours.
🧳 You open your suitcase. Your shirt looks like it lost a fight with a ball.
🧳 No iron in the hotel room. No dry cleaner nearby.
🧳 You wear the wrinkled shirt. You feel less confident all day.

WE'VE BEEN THERE. AND WE BUILT SOMETHING BETTER.

✨ **Introducing Dr.Flash: The Steamer That Fits in Your Bag**

This isn't your grandmother's iron. This is 21st-century wrinkle removal.

🔥 **WHY STEAMING > IRONING:**
- No ironing board needed (say goodbye to that awkward setup)
- No water stains or shine marks
- Works on ALL fabrics: silk, cotton, linen, wool, synthetics
- Safe on delicate materials that iron can't touch
- Kills 99.9% of bacteria while smoothing

🧳 **Perfect For:**
- Business travel (hello, confident presentations)
- Vacation packing (everything looks fresh after sitting in a bag)
- College students (dorm rooms don't have ironing boards)
- Quick touch-ups before date night
- Bridesmaids dress prep (no wrinkles on special day)

⚡ **How Fast?**
- Heats up in 30 seconds
- Ready to steam while you're still buttoning your shirt
- Continuous steam for 10+ minutes per fill

📊 **The Verdict:**
| Iron | Steamer |
|------|---------|
| Board required | Any surface |
| 15 min prep | 30 sec ready |
| Shiny patches | Even results |
| Delicate fabric = danger | Safe for everything |

**Stop looking like you slept in your suitcase. This pocket-sized powerhouse will make you look like you just walked out of a boutique.**`,
    source_md: require('fs').readFileSync('./operations/pass/2026-05-01/C20260501-008.md', 'utf8'),
    source_filename: 'C20260501-008.md'
  }
];

async function uploadProduct(product, index) {
  console.log(`\n[${index + 1}/4] 上传商品: ${product.source_filename}`);
  console.log(`   标题: ${product.title}`);
  console.log(`   平台: ${product.source_platform}`);
  console.log(`   类目: ${product.category}`);

  try {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify(product)
    });

    const result = await response.json();

    if (result.ok || result.success) {
      const productId = result.data?.id || result.id;
      console.log(`   ✅ 上架成功! Product ID: ${productId}`);
      return { success: true, id: productId, filename: product.source_filename };
    } else {
      console.log(`   ❌ 上架失败: ${JSON.stringify(result.error || result)}`);
      return { success: false, error: result.error || result, filename: product.source_filename };
    }
  } catch (error) {
    console.log(`   ❌ 网络错误: ${error.message}`);
    return { success: false, error: error.message, filename: product.source_filename };
  }
}

async function main() {
  console.log('🚀 开始上架 2026-05-01 PASS 商品 (共4个)');
  console.log('=' .repeat(60));

  const results = [];
  for (let i = 0; i < passProducts.length; i++) {
    const result = await uploadProduct(passProducts[i], i);
    results.push(result);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 上架结果汇总:');
  console.log('=' .repeat(60));

  const successCount = results.filter(r => r.success).length;
  console.log(`   成功: ${successCount}/4`);
  console.log(`   失败: ${results.length - successCount}/4`);

  if (successCount > 0) {
    console.log('\n   成功上架的商品ID:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.filename}: ${r.id}`);
    });
  }

  if (results.length - successCount > 0) {
    console.log('\n   失败详情:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.filename}: ${r.error}`);
    });
  }
}

main().catch(console.error);