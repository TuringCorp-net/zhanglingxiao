/**
 * 选品筛选脚本 - 2026-05-03
 *
 * 筛选标准：新奇/有趣/好玩/有爆点
 * 从50个候选商品中筛选出10个精选
 */

const fs = require('fs');

// 读取原始数据
const rawPath = './operations/selected/dailytemp/2026-05-03/raw_products_20260503.json';
const products = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

console.log('===============================================');
console.log('选品筛选开始 - 2026-05-03');
console.log('===============================================\n');

// 筛选逻辑：按"新奇/有趣/好玩/有爆点"评分
// 评分标准：
// - 新奇度：是否独特、不常见
// - 有趣度：功能有趣、有创意
// - 好玩度：适合年轻人、适合社交媒体
// - 爆点潜力：能否引发讨论/分享

const scoringRules = [
  // 有爆点的关键词
  { keywords: ['bean bag', '懒人沙发', '豆袋'], bonus: 15, reason: '舒适又可爱，适合社交分享' },
  { keywords: ['seashell', 'starfish', '海星', '贝壳'], bonus: 15, reason: '海滩手工感，夏季爆款元素' },
  { keywords: ['adjustable', '可调'], bonus: 8, reason: '多功能实用' },
  { keywords: ['fold', '折叠'], bonus: 10, reason: '便于收纳搬运，现代家居趋势' },
  { keywords: ['waterproof', '防水'], bonus: 5, reason: '户外场景实用' },
  { keywords: ['starfish', 'shell'], bonus: 12, reason: '手工感强，有故事性' },

  // 创意加分
  { keywords: ['grinder', '研磨器'], bonus: 10, reason: '厨房创意小工具' },
  { keywords: ['wine stopper', '酒塞'], bonus: 8, reason: '酒店氛围感' },
  { keywords: ['flosser', '冲牙'], bonus: 6, reason: '健康护理产品' },

  // 普通产品扣分
  { keywords: ['memory card', 'tf card', '存储卡', '内存卡'], bonus: -20, reason: '太普通，同质化严重' },
  { keywords: ['usb hub', 'hub', '拓展坞'], bonus: -15, reason: '太普通' },
  { keywords: ['mouse', '鼠标'], bonus: -10, reason: '太普通' },
  { keywords: ['laptop bag', '笔记本包'], bonus: -10, reason: '太普通' },
  { keywords: ['cleaning cloth', '清洁布'], bonus: -15, reason: '太普通' },
  { keywords: ['battery charger', '充电器'], bonus: -10, reason: '太普通' },
  { keywords: ['zip tie', '扎带'], bonus: -5, reason: '工业品，缺爆点' },

  // 高销量加分（验证市场接受度）
  // { minSold: 500000, bonus: 5, reason: '市场验证爆款' },
  // { minSold: 100000, bonus: 3, reason: '销量验证' },

  // 评分加分
  // { minRating: 4.9, bonus: 3, reason: '高评分产品' },
];

// 计算每个商品的"新奇有趣"得分
function calculateScore(product) {
  let score = 0;
  let reasons = [];

  // 基础分：销量越高，市场验证越好
  if (product.sold >= 100000) score += 5;
  else if (product.sold >= 50000) score += 3;
  else if (product.sold >= 10000) score += 1;

  // 评分加分
  if (product.rating >= 4.8) score += 3;
  else if (product.rating >= 4.5) score += 1;

  // 关键词匹配
  const name = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = name + ' ' + nameCn;

  for (const rule of scoringRules) {
    if (rule.keywords) {
      for (const kw of rule.keywords) {
        if (fullName.includes(kw.toLowerCase())) {
          score += rule.bonus;
          if (rule.reason) reasons.push(rule.reason);
          break;
        }
      }
    }
  }

  // 价格适中加分（太贵或太便宜都缺少爆点）
  const price = product.goodsPriceMin || 0;
  if (price >= 5 && price <= 50) score += 3;
  else if (price >= 1 && price <= 100) score += 1;

  return { score, reasons };
}

// 计算所有商品得分
const scoredProducts = products.map(p => {
  const { score, reasons } = calculateScore(p);
  return { ...p, funScore: score, funReasons: reasons };
});

// 按得分排序
scoredProducts.sort((a, b) => b.funScore - a.funScore);

// 取前15个候选，再人工精选10个
const top15 = scoredProducts.slice(0, 15);

console.log('=== 评分排名 Top 15 ===\n');
top15.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.goodsNameEn?.substring(0, 50) || '(无)'}`);
  console.log(`   得分: ${p.funScore} | 价格: ${p.goodsPriceMin} | 销量: ${p.sold} | 评分: ${p.rating}`);
  console.log(`   原因: ${p.funReasons.join(', ') || '无'}`);
  console.log('');
});

// 人工精选10个（确保多样性：多平台、多品类）
const selectedIndices = [];
const MAX_PER_PLATFORM = 3;

// 优先选择有明确"新奇/有趣"特征的商品
for (let i = 0; i < top15.length && selectedIndices.length < 10; i++) {
  const p = top15[i];

  // 平台平衡：同一平台最多3个
  const platformCount = selectedIndices.filter(idx => scoredProducts[idx].platform === p.platform).length;
  if (platformCount >= MAX_PER_PLATFORM && selectedIndices.length < 10) continue;

  // 优先选择有明确加分项的商品
  if (p.funScore > 0 && p.funReasons.length > 0) {
    selectedIndices.push(i);
  }
}

// 如果不够10个，从剩余高分商品中补充
if (selectedIndices.length < 10) {
  for (let i = 15; i < scoredProducts.length && selectedIndices.length < 10; i++) {
    if (!selectedIndices.includes(i)) {
      const p = scoredProducts[i];
      const platformCount = selectedIndices.filter(idx => scoredProducts[idx].platform === p.platform).length;
      if (platformCount < MAX_PER_PLATFORM) {
        selectedIndices.push(i);
      }
    }
  }
}

const selectedProducts = selectedIndices.slice(0, 10).map(idx => scoredProducts[idx]);

console.log('\n===============================================');
console.log('=== 最终精选 10 个商品 ===');
console.log('===============================================\n');

selectedProducts.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform.toUpperCase()}] ${p.goodsNameEn?.substring(0, 60)}`);
  console.log(`   价格: $${p.goodsPriceMin} | 销量: ${p.sold} | 评分: ${p.rating}`);
  console.log(`   特色: ${p.funReasons.join(' / ') || '市场热销款'}`);
  console.log('');
});

// 生成精选商品文件
const selectedDir = './operations/selected';
const today = '2026-05-03';

// 保存精选结果JSON
const selectedJson = selectedProducts.map((p, i) => ({
  id: `20260503-${String(i + 1).padStart(3, '0')}`,
  platform: p.platform,
  catName: p.targetCatName,
  goodsId: p.goodsId,
  goodsName: p.goodsNameEn || p.goodsName,
  price: p.goodsPriceMin,
  sold: p.sold,
  rating: p.rating,
  thumbnail: p.thumbnail,
  sourceChannel: p.sourceChannel,
  funReasons: p.funReasons,
  selectedAt: new Date().toISOString()
}));

fs.writeFileSync(
  `${selectedDir}/selected_20260503.json`,
  JSON.stringify(selectedJson, null, 2)
);

// 生成每个商品的markdown文件
for (let i = 0; i < selectedProducts.length; i++) {
  const p = selectedProducts[i];
  const fileId = `20260503-${String(i + 1).padStart(3, '0')}`;

  const mdContent = `---
id: ${fileId}
platform: ${p.platform}
category: ${p.targetCatName}
sourceChannel: ${p.sourceChannel}
selectedAt: ${new Date().toISOString()}
---

# ${p.goodsNameEn || p.goodsName || '未命名商品'}

## 基本信息

| 属性 | 值 |
|------|-----|
| 平台 | ${p.platform.toUpperCase()} |
| 类目 | ${p.targetCatName} |
| 来源渠道 | ${p.sourceChannel} |
| 价格 | $${p.goodsPriceMin} ~ $${p.goodsPriceMax || p.goodsPriceMin} |
| 销量 | ${p.sold} |
| 评分 | ${p.rating} |

## 商品ID

- **goodsId**: ${p.goodsId}

## 精选理由

${p.funReasons.length > 0 ? p.funReasons.map(r => `- ${r}`).join('\n') : '- 市场热销款，已验证销量'}

## 封面图

${p.thumbnail ? `![商品封面](${p.thumbnail})` : '无封面图'}

---

*由 Selector 自动筛选生成于 ${new Date().toISOString()}*
`;

  fs.writeFileSync(
    `${selectedDir}/${fileId}.md`,
    mdContent
  );
}

console.log('\n===============================================');
console.log('选品完成!');
console.log(`精选: 10 个商品`);
console.log(`结果已保存到: ${selectedDir}/`);
console.log(`- selected_20260503.json (汇总JSON)`);
console.log(`- 20260503-001.md ~ 20260503-010.md (商品详情)`);
console.log('===============================================');

// 输出统计
const platformStats = {};
selectedProducts.forEach(p => {
  platformStats[p.platform] = (platformStats[p.platform] || 0) + 1;
});
console.log('\n精选分布:');
Object.entries(platformStats).forEach(([platform, count]) => {
  console.log(`  - ${platform}: ${count}个`);
});