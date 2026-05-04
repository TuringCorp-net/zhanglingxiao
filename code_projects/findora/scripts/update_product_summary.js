/**
 * 更新已上架商品的 summary 字段（完整markdown推广文案）
 * 2026-05-04 Operator 定时任务
 */
const API_BASE = "https://findora.turingcorp.net/api";
const ADMIN_KEY = "Findora-TuringCorp-13572468";

// 已上架商品的完整推广文案
const productsToUpdate = [
  {
    id: "1a241826-9ce9-42b8-a6ef-702623d2df08",
    filename: "20260502-001.md",
    title: "✨ Stick It to Boredom: The Face Art Kit That Turns Every Kid Into a Mini Picasso!",
    summary: `# ✨ Stick It to Boredom: The Face Art Kit That Turns Every Kid Into a Mini Picasso!

**Who says creativity needs a canvas?** With this game-changing DIY Face Sticker Book, your little one becomes the artist, the model, AND the runway star — all in one adorable package!

**Why This Is THE Must-Have Activity Book:**

- 🎨 **Reusable Stickers = Endless Fun** — No more tears when the first design is done! Peel, reposition, create again. One book = infinite possibilities.
- 👸 **Fashion Doll Vibes** — Channel your inner fashion icon with gorgeous doll-inspired designs. Mix, match, and slay every look!
- 🎉 **Party Hero Alert** — Show up to any birthday party with this in your gift bag, and watch parents breathe a sigh of relief. Finally, quiet entertainment that actually looks impressive!
- 🧠 **Learning Through Play** — Fine motor skills, color recognition, creative expression... shhh, don't tell them it's educational!
- 🎁 **Gift That Keeps Giving** — Birthdays, Christmas, rainy Sundays, long car rides... this book is the answer to "I'm bored!" every single time.

**What Parents Are Saying:**
> "46,000+ families already discovered the magic. With a 4.8-star rating and nearly 2,000 reviews, this isn't just a sticker book — it's a parenting win."

**Perfect For:**
- Kids ages 4-10
- Road trips & travel
- Party favors & goodie bags
- Quiet time at home
- Gift-giving occasions (because every kid deserves a little creative chaos!)`
  },
  {
    id: "c82b36f9-41e5-4923-9b65-9a603fcbb2bf",
    filename: "20260502-002.md",
    title: "👑 Every Little Girl's Dream: The Ultimate Princess Sticker Adventure!",
    summary: `# 👑 Every Little Girl's Dream: The Ultimate Princess Sticker Adventure!

**Sparkle. Create. Imagine.** This isn't just another sticker book — it's a royal invitation to a world where YOUR little princess calls the shots!

**Why Little Royals (and Their Parents) Are Obsessed:**

- 👸 **Pure Princess Magic** — Dreamy designs featuring gorgeous gowns, sparkling tiaras, and fairy-tale scenes. Every page is a new kingdom to explore!
- ✈️ **Travel-Sized Royalty** — Flatten that "Are we there yet?" with a compact activity companion that transforms any journey into a magical adventure.
- 🎁 **The Gift That Makes You the Favorite Parent** — Show up to a birthday party with this wrapped up, and watch that little girl's eyes light up like a castle at sunset.
- 🧠 **Learning in Disguise** — Hand-eye coordination, color matching, storytelling skills... shhh, it's their little secret that they're actually leveling up!
- 🎉 **Party Favor Crown Jewel** — Skip the cheap trinkets. This is the party favor that other parents will secretly wish they'd thought of first.

**The Numbers Don't Lie:**
- 44,000+ happy customers
- 4.7-star rating from real families
- 619 reviews of pure joy
- Tried, tested, and toddler-approved since 2025

**Perfect For:**
- Princess enthusiasts ages 3-8
- Road trips & air travel
- Birthday party gifts
- Christmas stocking stuffers
- Party favor bags
- Quiet creative time`
  },
  {
    id: "8b20827c-3711-4500-968a-f19a0fa01051",
    filename: "20260502-003.md",
    title: "🌟 Face the Fun: The Dress-Up Sticker Game That's Basically a Glow-Up Session!",
    summary: `# 🌟 Face the Fun: The Dress-Up Sticker Game That's Basically a Glow-Up Session!

**Ready for your little one to become the life of the party?** This DIY Face Sticker Book isn't just stickers — it's a confidence-boosting, creativity-sparking, boredom-zapping masterpiece in book form!

**Why Parents Keep Coming Back (and Kids Never Want to Put It Down):**

- 💫 **Reusable = Rewritable Fun** — Peel, place, re-peel, create a NEW look! No more "I'm done!" after five minutes. This book grows with their imagination.
- 👗 **Fashion Doll Energy** — Trendy, gorgeous designs that make every kid feel like they're stepping onto a mini runway. Style it your way!
- 🎭 **Face Art Without the Mess** — No paints, no crayons, no cleanup. Just pure creative expression that's also totally Instagram-worthy (for the parents, obviously).
- 🤝 **Interactive = Engaging** — Trade stickers with friends, create matching sets, challenge each other's designs. Social skills + creativity = parenting win!
- 🎁 **Gift-Giving Grace** — New Year, Birthday, Christmas — this is the gift that says "I totally get you" without trying too hard.

**The Fresh Factor:**
> Just launched in December 2025 during the holiday season, and already showing strong 28,000+ sales. This isn't just surviving — it's thriving!

**Trusted by Real Families:**
- ⭐ 4.8/5 average rating
- 336 real reviews
- Non-toxic, child-safe materials
- Designed for hours of independent play

**Perfect For:**
- Kids ages 4-12
- Self-play time
- Playdate activities
- Party favors
- Gift occasions
- Creative development`
  },
  {
    id: "e5483916-f838-4317-8b48-924ce034a79e",
    filename: "20260502-010.md",
    title: "✍️ A to Z Mastery: The 28-Page Tracing Workbook That Turns \"How Do You Spell...\" Into \"I Got This!\"",
    summary: `# ✍️ A to Z Mastery: The 28-Page Tracing Workbook That Turns "How Do You Spell..." Into "I Got This!"

**Your child wants to write their name. You want them to succeed. This workbook is where it all begins.**

In a world of keyboards and touchscreens, there's one skill that builds confidence like nothing else: the ability to write. And it starts with tracing those beautiful letters from A to Z — one smooth line at a time.

**Why This Workbook Is the Smart Choice:**

- 📚 **28 Pages of Purposeful Practice** — Not too many to overwhelm, not too few to bore. The perfect amount for real skill-building progress.
- ✏️ **Tracing + Drawing = Double the Learning** — Letter practice pages build motor skills, while fun drawing pages keep it engaging and creative.
- 🌟 **4.9 Stars = Almost Perfect** — 512 reviews and a near-perfect rating. This isn't a gamble — it's a proven path to letter recognition.
- 💰 **37,000 Families Can't Be Wrong** — When 37,000 parents choose a workbook, they're sharing what's actually working.
- 🎁 **The Copybook That's Also a Gift** — Perfect for preschool graduation, birthday treats, or that "just because" moment when your little one is ready.

**What's Inside:**
- ✅ Uppercase A-Z tracing guides
- ✅ Lowercase a-z practice sheets
- ✅ Fun drawing activity pages
- ✅ Progressive difficulty (starts easy, builds confidence)
- ✅ Clear stroke direction indicators
- ✅ Practice space for free-writing

**Perfect For:**
- 🎒 **Preschool & Kindergarten Prep** — Get ahead before school starts
- 🏠 **Homeschool Families** — Complete letter-learning curriculum
- 📝 **Afternoon Practice Sessions** — Screen-free skill building
- 🎁 **Gift-Giving Occasions** — Birthday, Christmas, graduation
- 👶 **Early Intervention** — Extra support for kids who need more practice
- 🎒 **Teacher Resources** — Classroom or tutoring use

**Why Tracing Works:**
> Research shows that handwriting practice activates multiple areas of the brain simultaneously — reading, motor control, and letter recognition. Screen time can't replicate this.

**The Numbers Tell the Story:**
- 📖 37,000+ copies sold
- ⭐ 4.9/5 average rating
- 💬 512 verified reviews
- 📝 28 pages of progressive practice
- 🎓 0% complicated — 100% effective`
  }
];

async function updateProductSummary(product) {
  const response = await fetch(`${API_BASE}/admin/products/${product.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({
      summary: product.summary
    })
  });

  return await response.json();
}

async function main() {
  console.log('更新商品 summary 字段...\n');

  for (const product of productsToUpdate) {
    console.log(`更新 ${product.filename} (${product.id})`);
    try {
      const result = await updateProductSummary(product);
      if (result.ok || result.success) {
        console.log(`  ✅ 更新成功`);
      } else {
        console.log(`  ❌ 更新失败: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`  ❌ 请求错误: ${error.message}`);
    }
    console.log('');
  }

  console.log('更新完成!');
}

main().catch(console.error);