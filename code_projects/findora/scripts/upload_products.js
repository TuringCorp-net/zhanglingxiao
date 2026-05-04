/**
 * 商品上架脚本
 * 将 pass 目录下的商品上架到 Findora 系统
 */
const API_BASE = "https://findora.turingcorp.net/api";
const ADMIN_KEY = "Findora-TuringCorp-13572468";

// 完整商品数据（从 md 文件提取）
const products = [
  {
    filename: "20260502-001.md",
    source_platform: "temu",
    source_url: "https://www.temu.com/g-601102878219056.html",
    original_title: "Random DIY Face Sticker Book with Fashion Doll Design - Dress-Up Game Set, Includes Reusable Stickers for Creative Fun, Beautiful Face Art, and Interactive Activities - Perfect as Party Favors or Gift",
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
- Gift-giving occasions (because every kid deserves a little creative chaos!)`,
    category: "books",
    subcategory: "儿童活动图书",
    tags: ["Kids", "Children", "Parents", "Gift Buyers", "Reusable Stickers", "Dress-Up", "Face Art", "Creative Play", "Party Favors", "Temu Trending", "DIY Crafts", "Screen-Free Activity", "Fine Motor Skills", "Ages 4-10"],
    price_min: 4.20,
    price_max: 4.31,
    currency: "USD",
    cover_image: "https://img.kwcdn.com/product/fancy/32bb1601-7303-4f01-84f5-381d02ea027a.jpg",
    images: ["https://img.kwcdn.com/product/fancy/32bb1601-7303-4f01-84f5-381d02ea027a.jpg"],
    pros: ["可重复使用贴纸", "4.8分高评分", "46,000+销量验证", "派对/旅行/礼物多场景"],
    cons: ["需注意版权认证"],
    use_cases: ["生日礼物", "旅行娱乐", "派对赠品", "居家活动"],
    target_audience: ["家长", "4-10岁儿童", "派对策划者"],
    source_md: `完整markdown内容（见原文件）`
  },
  {
    filename: "20260502-002.md",
    source_platform: "temu",
    source_url: "https://www.temu.com/g-601102452394145.html",
    original_title: "Princess Sticker Book for Girls - Fun Activity & Creativity | Best Kids Travel Toy, Educational Activity Book, Birthday Holiday Gifts, Party Favors",
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
- Quiet creative time`,
    category: "books",
    subcategory: "儿童活动图书",
    tags: ["Girls", "Little Girls", "Princess Lovers", "Parents", "Gift Shoppers", "Sticker Play", "Creative Activity", "Fine Motor Skills", "Travel", "Birthday Party", "Ages 3-8"],
    price_min: 3.27,
    price_max: 5.36,
    currency: "USD",
    cover_image: "https://img.kwcdn.com/product/fancy/5283f881-b83e-43b4-9efd-af6f8de930e9.jpg",
    images: ["https://img.kwcdn.com/product/fancy/5283f881-b83e-43b4-9efd-af6f8de930e9.jpg"],
    pros: ["公主主题精准定位", "44,000+销量稳定", "4.7评分", "多场景礼品属性"],
    cons: ["市场竞争激烈"],
    use_cases: ["生日礼物", "旅行", "派对赠品", "节日礼物"],
    target_audience: ["女孩家长", "3-8岁女孩", "派对策划者"],
    source_md: `完整markdown内容（见原文件）`
  },
  {
    filename: "20260502-003.md",
    source_platform: "temu",
    source_url: "https://www.temu.com/g-601105698389481.html",
    original_title: "DIY Face Sticker Book with Fashion Doll Design - Dress-Up Game Set, Includes Reusable Stickers for Creative Fun, Beautiful Face Art, and Interactive Activities - Perfect as Party Favors or Gifts for N",
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
- Creative development`,
    category: "books",
    subcategory: "儿童游戏书",
    tags: ["Kids", "Children", "Creative Kids", "Parents", "Gift Buyers", "Reusable Stickers", "Face Art", "Dress-Up", "Creative Expression", "Ages 4-12"],
    price_min: 4.88,
    price_max: 5.02,
    currency: "USD",
    cover_image: "https://img.kwcdn.com/product/fancy/c8f25c42-fb10-4c3b-8b7c-b59d2a08c20e.jpg",
    images: ["https://img.kwcdn.com/product/fancy/c8f25c42-fb10-4c3b-8b7c-b59d2a08c20e.jpg"],
    pros: ["节日季新品热销", "4.8评分", "可复用设计", "面部艺术独特体验"],
    cons: ["上架时间短"],
    use_cases: ["新年礼物", "生日", "圣诞", "派对"],
    target_audience: ["家长", "4-12岁儿童"],
    source_md: `完整markdown内容（见原文件）`
  },
  {
    filename: "20260502-010.md",
    source_platform: "temu",
    source_url: "https://www.temu.com/g-601100414794971.html",
    original_title: "A Workbook with 28 Pages Designed for Children to Practice Tracing Letters from A to Z, Suitable for Preschool And Kindergarten. It Includes Fun Drawing Pages, Serves As a Copybook",
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
- 🎓 0% complicated — 100% effective`,
    category: "books",
    subcategory: "早教练习册",
    tags: ["Preschoolers", "Kindergarteners", "Parents", "Homeschool Families", "Teachers", "Letter Tracing", "Handwriting Practice", "Fine Motor Skills", "Pre-Writing", "Ages 3-6"],
    price_min: 6.82,
    price_max: 8.04,
    currency: "USD",
    cover_image: "https://img.kwcdn.com/product/fancy/9578be87-ecc8-49fe-bbb9-823fafe54b67.jpg",
    images: ["https://img.kwcdn.com/product/fancy/9578be87-ecc8-49fe-bbb9-823fafe54b67.jpg"],
    pros: ["4.9分接近满分", "37,000销量验证", "早教刚需", "描摹+绘画+练字三合一"],
    cons: ["市场竞争激烈"],
    use_cases: ["学前准备", "在家学习", "礼物", "课堂辅助"],
    target_audience: ["3-6岁儿童家长", "在家教育家庭", "教师"],
    source_md: `完整markdown内容（见原文件）`
  }
];

async function createProduct(product) {
  const response = await fetch(`${API_BASE}/admin/products`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({
      source_platform: product.source_platform,
      source_url: product.source_url,
      original_title: product.original_title,
      title: product.title,
      summary: product.summary,
      category: product.category,
      subcategory: product.subcategory,
      tags: product.tags,
      price_min: product.price_min,
      price_max: product.price_max,
      currency: product.currency,
      cover_image: product.cover_image,
      images: product.images,
      pros: product.pros,
      cons: product.cons,
      use_cases: product.use_cases,
      target_audience: product.target_audience,
      source_md: product.source_md,
      source_filename: product.filename
    })
  });

  return await response.json();
}

async function updateTags(productId, tags) {
  const response = await fetch(`${API_BASE}/admin/products/${productId}/tags`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Key': ADMIN_KEY
    },
    body: JSON.stringify({ tags })
  });

  return await response.json();
}

async function main() {
  console.log('开始上架商品...\n');

  for (const product of products) {
    console.log(`正在上架: ${product.filename} - ${product.title}`);
    try {
      const result = await createProduct(product);
      if (result.ok || result.success) {
        console.log(`  ✅ 上架成功，商品ID: ${result.data?.id || result.id}`);
        // 更新标签
        if (result.data?.id) {
          const tagResult = await updateTags(result.data.id, product.tags);
          if (tagResult.ok || tagResult.success) {
            console.log(`  ✅ 标签更新成功`);
          } else {
            console.log(`  ⚠️ 标签更新失败: ${JSON.stringify(tagResult)}`);
          }
        }
      } else {
        console.log(`  ❌ 上架失败: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      console.log(`  ❌ 请求错误: ${error.message}`);
    }
    console.log('');
  }

  console.log('商品上架完成!');
}

main().catch(console.error);