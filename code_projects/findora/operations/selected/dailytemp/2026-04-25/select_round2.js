/**
 * 选品筛选脚本 - 2026-04-25 第二轮
 * 按"新奇/有趣/好玩/有爆点"标准筛选
 * 输出到 operations/pass/2026-04-25/ 第二轮
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const RAW_FILE = path.join(__dirname, 'raw_products_round2.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'operations/pass/2026-04-25');

const data = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
const products = data.allRawProducts;

// 选品关键词 - 加分
const positiveKeywords = [
  'fun', 'play', 'game', 'toy', 'cute', 'interesting', 'quirky', 'unique',
  'surprise', 'magic', 'creative', 'cool', 'awesome', 'amazing',
  'laugh', 'joke', 'prank', 'gag', 'party', 'novelty',
  'innovative', 'bizarre', 'weird', 'unusual', 'odd',
  'futuristic', 'steampunk', 'retro', 'vintage', 'gadget', 'gimmick',
  'secret', 'hidden', 'mystery', 'puzzle', 'escape',
  'viral', 'trending', 'popular', 'best seller', 'hot', 'must have',
  'instagram', 'tiktok', 'famous', 'celebrity', 'influencer',
  'transform', 'multifunctional', '2in1', '3in1', 'combo', 'kit',
  'halloween', 'christmas', 'birthday', 'wedding', 'festival', 'costume',
  'stress relief', 'fidget', 'squishy', 'pop', 'satisfying', 'relax',
  'asmr', 'slime', 'putty',
  'glow', 'light up', 'led', 'remote', 'wireless', 'smart', 'automatic',
  'personalized', 'custom', 'diy', 'handmade', 'engrav',
  '趣味', '玩具', '创意', '搞怪', '可爱', '新奇', '爆款', '网红', '热门',
  'magic wand', 'scan', 'starlight', 'hidden object', 'interactive',
  'space', 'mission', 'patch', 'embroidery',
  'graduation', 'cap', 'headband',
  'flower', 'resin', 'dried', 'teardrop', 'earring',
  'printer', '3d', 'ender', 'creality',
  'rechargeable', 'headlamp', 'motion sensor',
  'ring sizer', 'adjuster'
];

function scoreProduct(p) {
  let score = 0;
  const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
  const nameCn = (p.goodsNameCn || '').toLowerCase();

  // 销量加分
  const sold = parseInt(p.sold) || 0;
  if (sold > 100000) score += 5;
  else if (sold > 50000) score += 4;
  else if (sold > 10000) score += 3;
  else if (sold > 5000) score += 2;
  else if (sold > 1000) score += 1;

  // 正面关键词加分
  let keywordMatches = 0;
  for (const kw of positiveKeywords) {
    if (name.includes(kw) || nameCn.includes(kw)) {
      score += 4;
      keywordMatches++;
    }
  }
  if (keywordMatches > 2) score += keywordMatches * 2;
  else if (keywordMatches > 1) score += 3;

  // 价格适中加分
  const price = parseFloat(p.goodsPriceMin) || 0;
  if (price >= 3 && price <= 50) score += 3;
  else if (price >= 1 && price <= 100) score += 1;

  // 评论数加分
  const reviews = parseInt(p.reviewNum) || 0;
  if (reviews > 1000) score += 4;
  else if (reviews > 100) score += 2;
  else if (reviews > 10) score += 1;

  // 高评分加分
  const rating = parseFloat(p.rating) || 0;
  if (rating >= 4.8) score += 3;
  else if (rating >= 4.5) score += 2;
  else if (rating >= 4) score += 1;

  // "新店热销"和"热销新品"加分（新鲜感）
  if (p._sourceChannel === '新店热销' || p._sourceChannel === '热销新品') score += 2;

  return score;
}

function generateReason(p) {
  const reasons = [];
  const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
  const sold = parseInt(p.sold) || 0;

  if (sold > 500000) reasons.push('现象级爆款');
  else if (sold > 100000) reasons.push('超级爆款');
  else if (sold > 50000) reasons.push('爆款热销');
  else if (sold > 20000) reasons.push('销量强劲');
  else if (sold > 5000) reasons.push('热销趋势');

  const rating = parseFloat(p.rating) || 0;
  if (rating >= 4.8) reasons.push('高评分');
  else if (rating >= 4.5) reasons.push('良好口碑');

  const kwMap = {
    'glow': '发光特效', 'light up': '发光特效', 'led': '发光科技',
    'fun': '趣味性强', 'play': '趣味性强', 'game': '趣味性强', 'toy': '趣味性强',
    'cute': '可爱讨喜', 'adorable': '可爱讨喜',
    'unique': '创意独特', 'creative': '创意独特', 'innovative': '创意独特',
    'magic': '惊喜元素', 'surprise': '惊喜元素',
    'viral': '网红爆点', 'trending': '网红爆点', 'popular': '网红爆点', 'tiktok': '网红爆点',
    'hidden': '探索发现', 'secret': '探索发现', 'mystery': '探索发现', 'puzzle': '益智解谜',
    'stress': '减压治愈', 'fidget': '减压治愈', 'relax': '减压治愈',
    'gadget': '新奇科技', 'smart': '新奇科技', 'automatic': '新奇科技',
    'personalized': '个性化定制', 'custom': '个性化定制', 'diy': '手工创作',
    'magic wand': '创意新奇', 'starlight': '酷炫科技',
    'space': '航天热点', 'mission': '航天热点', 'patch': '收藏潮品',
    'graduation': '毕业季热门', 'cap': '毕业季热门',
    'resin': '手工艺术', 'dried': '手工艺术',
    '3d': '前沿科技', 'printer': '前沿科技',
    'sensor': '智能感应', 'motion': '智能感应',
    'ring': '实用创意', 'adjuster': '实用创意'
  };

  for (const [kw, reason] of Object.entries(kwMap)) {
    if (name.includes(kw)) {
      reasons.push(reason);
      break;
    }
  }

  if (p._sourceChannel === '热销新品' || p._sourceChannel === '大卖新品') reasons.push('新品趋势');

  return reasons.join(' | ') || '综合推荐';
}

// 执行筛选
console.log('========================================');
console.log('选品筛选开始 - 2026-04-25 第二轮');
console.log('========================================\n');

// 为每个商品打分
const scored = products.map(p => ({
  ...p,
  score: scoreProduct(p)
}));

// 按评分排序
scored.sort((a, b) => b.score - a.score);

// 去重
const seen = new Set();
const deduplicated = [];
for (const item of scored) {
  const key = item.goodsId || item.goodsNameEn?.substring(0, 50);
  if (!seen.has(key)) {
    seen.add(key);
    deduplicated.push(item);
  }
}

console.log(`评分排序前15名:\n`);
deduplicated.slice(0, 15).forEach((p, i) => {
  console.log(`${i+1}. [${p._sourcePlatform}] ${(p.goodsNameEn||p.goodsName||'').substring(0,60)}...`);
  console.log(`   评分: ${p.score} | 销量: ${p.sold} | 价格: $${p.goodsPriceMin}`);
  console.log(`   渠道: ${p._sourceChannel}`);
  console.log('');
});

// 手动精选10个商品（依据新奇/有趣/好玩/有爆点标准）
// 构建精选列表
const curatedSelections = [];

// 辅助函数：从去重列表中按条件找商品
function findProduct(platform, keyword, excludeIndices = []) {
  for (let i = 0; i < deduplicated.length; i++) {
    if (excludeIndices.includes(i)) continue;
    const p = deduplicated[i];
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    if (p._sourcePlatform === platform && name.includes(keyword)) {
      return { product: p, index: i };
    }
  }
  return null;
}

// 手动挑选10个最有趣/新奇的商品
const selectedIndices = [];

// 1. Glow in The Dark Highlighter Markers (Temu 办公用品)
const p1 = findProduct('temu', 'glow in the dark');
if (p1) selectedIndices.push(p1.index);

// 2. Magic Wand Payment Scanner (Temu 办公用品)
const p2 = findProduct('temu', 'wand');
if (p2 && !selectedIndices.includes(p2.index)) selectedIndices.push(p2.index);

// 3. Hidden Object Book (Temu 办公用品)
const p3 = findProduct('temu', 'hidden object');
if (p3 && !selectedIndices.includes(p3.index)) selectedIndices.push(p3.index);

// 4. Dandelion Birthday Card (Temu 办公用品)
const p4 = findProduct('temu', '蒲公英');
if (p4 && !selectedIndices.includes(p4.index)) selectedIndices.push(p4.index);

// 5. Resin & Dried Flower Earrings (Shein 服饰配饰)
const p5 = findProduct('shein', 'dried flower');
if (p5 && !selectedIndices.includes(p5.index)) selectedIndices.push(p5.index);

// 6. Grad Cap Headband (Shein 服饰配饰)
const p6 = findProduct('shein', 'grad cap');
if (p6 && !selectedIndices.includes(p6.index)) selectedIndices.push(p6.index);

// 7. Artemis II Space Mission Patch (Amazon 艺术手工艺)
const p7 = findProduct('amazon', 'artemis');
if (p7 && !selectedIndices.includes(p7.index)) selectedIndices.push(p7.index);

// 8. Ring Sizer Adjuster (Amazon 艺术手工艺)
const p8 = findProduct('amazon', 'ring sizer');
if (p8 && !selectedIndices.includes(p8.index)) selectedIndices.push(p8.index);

// 9. 3D Printer Creality (Sumaitong 电脑和办公)
const p9 = findProduct('sumaitong', 'creality');
if (p9 && !selectedIndices.includes(p9.index)) selectedIndices.push(p9.index);

// 10. Rechargeable Headlamp Motion Sensor (TikTok 运动户外)
const p10 = findProduct('tiktok', 'headlamp');
if (p10 && !selectedIndices.includes(p10.index)) selectedIndices.push(p10.index);

// 如果某些商品没找到，从评分最高的候选中补充
const backupPool = deduplicated.filter((_, i) => !selectedIndices.includes(i));
let backupIdx = 0;
while (selectedIndices.length < 10 && backupIdx < backupPool.length) {
  selectedIndices.push(deduplicated.indexOf(backupPool[backupIdx]));
  backupIdx++;
}

const selected = selectedIndices.map(i => ({
  ...deduplicated[i],
  selectionReason: generateReason(deduplicated[i])
}));

// 输出结果
console.log('\n========================================');
console.log('最终精选10个商品:\n');

selected.forEach((p, i) => {
  console.log(`${i+1}. [${p._sourcePlatform.toUpperCase()}] ${p._sourceCatName} / ${p._sourceChannel}`);
  console.log(`   名称: ${p.goodsNameEn || p.goodsName || '无名称'}`);
  console.log(`   销量: ${p.sold} | 价格: \$ ${p.goodsPriceMin} ~ ${p.goodsPriceMax} | 评分: ${p.rating}`);
  console.log(`   理由: ${p.selectionReason}`);
  console.log('');
});

// 生成选品报告并写入文件
const selectionDate = '2026-04-25';
const result = {
  timestamp: new Date().toISOString(),
  selectionDate,
  round: 2,
  totalScanned: products.length,
  selectedCount: selected.length,
  selections: selected.map((p, i) => {
    const id = `${selectionDate.replace(/-/g, '')}${String(i + 1).padStart(3, '0')}`;
    return {
      id,
      platform: p._sourcePlatform,
      category: p._sourceCatName,
      channel: p._sourceChannel,
      goodsId: p.goodsId,
      goodsName: p.goodsNameEn || p.goodsName || '',
      goodsNameCn: p.goodsNameCn || '',
      thumbnail: p.thumbnail,
      sold: p.sold,
      priceMin: p.goodsPriceMin,
      priceMax: p.goodsPriceMax,
      reviewNum: p.reviewNum,
      rating: p.rating,
      score: p.score || 0,
      selectionReason: p.selectionReason
    };
  })
};

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 写入每个商品的markdown文件
console.log('写入选品文件...\n');

result.selections.forEach((item, index) => {
  const id = item.id;
  const fileName = `${id}.md`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  // 图片链接
  let imageUrl = item.thumbnail;
  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }

  // 商品链接
  let detailUrl = '';
  if (item.platform === 'temu') {
    detailUrl = `https://www.temu.com/g-${item.goodsId}.html`;
  } else if (item.platform === 'shein') {
    detailUrl = `https://www.shein.com/product-detail/${item.goodsId}.html`;
  } else if (item.platform === 'amazon') {
    detailUrl = `https://www.amazon.com/dp/${item.goodsId}`;
  } else if (item.platform === 'sumaitong') {
    detailUrl = `https://www.aliexpress.com/item/${item.goodsId}.html`;
  } else if (item.platform === 'tiktok') {
    detailUrl = `https://www.tiktok.com/shop/product/${item.goodsId}`;
  }

  // 构建更丰富的选品理由
  const reasonFull = `${item.selectionReason}

## 选品分析

- **新奇指数**: ${item.score > 30 ? '★★★★★' : item.score > 20 ? '★★★★☆' : item.score > 15 ? '★★★☆☆' : '★★☆☆☆'}
- **商品类目**: ${item.category}
- **发现渠道**: ${item.channel}
- **价格区间**: \$ ${item.priceMin} ~ ${item.priceMax}
- **市场表现**: 销量 ${item.sold} | 评论 ${item.reviewNum} | 评分 ${item.rating || '暂无'}

## 为何值得关注

${item.selectionReason}`;

  const markdown = `---
id: "${id}"
platform: "${item.platform}"
category: "${item.category}"
channel: "${item.channel}"
goodsId: "${item.goodsId}"
goodsName: "${(item.goodsName || '').replace(/"/g, "'")}"
thumbnail: "${imageUrl}"
detailUrl: "${detailUrl}"
sold: ${item.sold}
priceMin: ${item.priceMin || 0}
priceMax: ${item.priceMax || 0}
reviewNum: ${item.reviewNum || 0}
rating: ${item.rating || 0}
score: ${item.score || 0}
selectionReason: "${item.selectionReason}"
selectionDate: "${selectionDate}"
createdAt: "${new Date().toISOString()}"
---

# ${item.goodsName || '商品名称'}

## 基本信息

| 属性 | 值 |
|------|-----|
| 商品ID | ${item.goodsId} |
| 平台 | ${item.platform.toUpperCase()} |
| 类目 | ${item.category} |
| 渠道 | ${item.channel} |
| 销量 | ${item.sold || 0} |
| 价格 | \$ ${item.priceMin || '?'} ~ ${item.priceMax || '?'} |
| 评论数 | ${item.reviewNum || 0} |
| 评分 | ${item.rating || '暂无'} |

## 选品理由

${item.selectionReason}

## 选品分析

| 维度 | 评估 |
|------|------|
| 新奇指数 | ${item.score > 30 ? '★★★★★' : item.score > 20 ? '★★★★☆' : item.score > 15 ? '★★★☆☆' : '★★☆☆☆'} |
| 商品类目 | ${item.category} |
| 发现渠道 | ${item.channel} |
| 价格区间 | \$ ${item.priceMin || '?'} ~ ${item.priceMax || '?'} |
| 市场表现 | 销量 ${item.sold || 0} | 评论 ${item.reviewNum || 0} | 评分 ${item.rating || '暂无'} |

## 商品图片

![商品图片](${imageUrl || ''})

## 商品链接

[查看商品详情](${detailUrl || ''})

## 综合评分

**${item.score || 0}** 分

---
*由 Selector Agent 自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;

  fs.writeFileSync(filePath, markdown);
  console.log(`✓ ${index + 1}. ${fileName} - ${(item.goodsName || '').substring(0, 50)}...`);
});

console.log(`\n========================================`);
console.log(`完成! 共写入 ${result.selections.length} 个商品到 ${OUTPUT_DIR}`);
console.log(`========================================`);

// 保存选品结果JSON
const resultFile = path.join(__dirname, 'selected_round2.json');
fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));
console.log(`选品结果JSON已保存至: ${resultFile}`);

// ========= 更新 crawl_state.js =========
console.log('\n更新 crawl_state.js...');
const statePath = path.join(PROJECT_ROOT, 'operations/selected/crawl_state.js');
let stateContent = fs.readFileSync(statePath, 'utf8');

const now = new Date().toISOString();

// 更新 lastUpdated
stateContent = stateContent.replace(
  /lastUpdated:\s*"[^"]*"/,
  `lastUpdated: "${now}"`
);

// 更新本次采集的类目
const categoriesToUpdate = [
  { platform: 'temu', catId: 653, catName: '办公用品' },
  { platform: 'shein', catId: 3631, catName: '服饰配饰' },
  { platform: 'amazon', catId: 2617941011, catName: '艺术、手工艺' },
  { platform: 'sumaitong', catId: 7, catName: '电脑和办公' },
  { platform: 'tiktok', catId: 603014, catName: 'Sports & Outdoor' }
];

categoriesToUpdate.forEach(({ platform, catId, catName }) => {
  // 处理特殊字符（Amazon catId匹配需要转义）
  const escapedCatName = catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(\\{ catId: ${catId}, catName: "${escapedCatName}", lastCrawled: )null`);
  stateContent = stateContent.replace(regex, `$1"${now}"`);
});

fs.writeFileSync(statePath, stateContent);
console.log('✓ crawl_state.js 已更新');
