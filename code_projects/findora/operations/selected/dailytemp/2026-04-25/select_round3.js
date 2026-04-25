/**
 * 选品筛选脚本 - 2026-04-25 第三轮
 * 按"新奇/有趣/好玩/有爆点"标准筛选
 * 从 round3 原始数据中精选10个商品
 * 输出到 operations/pass/2026-04-25/
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '../../../..');
const RAW_FILE = path.join(__dirname, 'raw_products_round3.json');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'operations/pass/2026-04-25');

const data = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
const products = data.allRawProducts;

// ===== 手动精选10个商品 =====
// 策略：覆盖5个平台，每个平台选2个新奇/有趣/好玩/有爆点的商品

const curatedSelections = [];

function findProduct(platform, keywords, matchAll = false) {
  for (const p of products) {
    if (p._sourcePlatform !== platform) continue;
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    if (matchAll) {
      if (keywords.every(kw => name.includes(kw))) return p;
    } else {
      if (keywords.some(kw => name.includes(kw))) return p;
    }
  }
  return null;
}

// 1. Temu - 搞怪大眼蛇狗玩具
const p1 = findProduct('temu', ['snake', 'plush'], true);
if (p1) curatedSelections.push({ product: p1, reason: '搞怪大眼长条蛇狗玩具，造型魔性有趣。10万+销量证明其受欢迎程度，会发声的BB纸+耐咬设计兼具趣味性和功能性。宠物玩具中的"奇葩"设计，极具话题性和传播力。' });

// 2. Temu - 超声波自动止吠器
const p2 = findProduct('temu', ['anti bark']);
if (p2) curatedSelections.push({ product: p2, reason: '超声波自动止吠器，利用声波技术训犬，堪称宠物界的"黑科技"。10万+销量+7253条评论证明其市场热度。对养狗家庭极具吸引力，解决真实痛点，内容种草潜力巨大。' });

// 3. Shein - Fairycore 海星贝壳编织包
const p3 = findProduct('shein', ['starfish']);
if (p3) curatedSelections.push({ product: p3, reason: 'Fairycore风格海星贝壳编织包，今年夏季大热趋势。ROMWE联名款，3.3万+销量。贝壳/海星造型独特吸睛，海滩度假场景匹配度高，极具社交媒体传播属性。#Fairycore趋势加持。' });

// 4. Shein - 护士听诊器图案药盒
const p4 = findProduct('shein', ['nurse', 'pill'], true);
if (p4) curatedSelections.push({ product: p4, reason: '护士听诊器图案药盒，趣味印花设计，小巧便携。仅$1的超低价位适合冲动消费。医药主题创意小物在社交媒体上有特定受众群体，兼具实用性和趣味性。' });

// 5. Amazon - 汽车清洁凝胶泥 (现象级爆款)
const p5 = findProduct('amazon', ['cleaning gel']);
if (p5) curatedSelections.push({ product: p5, reason: '汽车清洁凝胶泥，368万+销量的现象级爆款！可塑形进入车内任何缝隙清洁，ASMR解压效果十足。清洁+解压双重属性，视频展示效果极佳，内容网站的流量密码。' });

// 6. Amazon - 漂移木质汽车香薰
const p6 = findProduct('amazon', ['drift', 'freshener'], true);
if (p6) curatedSelections.push({ product: p6, reason: '漂移主题木质汽车香薰，35万+销量。将汽车文化与车载香薰结合，木质质感高级。视觉设计独特，适合做汽车周边/车载好物内容，男性用户群体精准触达。' });

// 7. 速卖通 - 手摇发电机充电宝
const p7 = findProduct('sumaitong', ['hand crank']);
if (p7) curatedSelections.push({ product: p7, reason: '手摇发电机20W应急充电宝，户外/末日生存题材热门单品。无需电池靠手摇发电，科技感+应急实用性兼具。近期极端天气频发，应急电源话题热度高，内容切入角度丰富。' });

// 8. 速卖通 - MOES智能场景开关
const p8 = findProduct('sumaitong', ['moes']);
if (p8) curatedSelections.push({ product: p8, reason: 'MOES智能ZigBee无线场景开关，智能家居热门单品。16.6万+销量，支持Tuya生态，12种自定义场景。智能家居改造必备，科技含量高，DIY智能家居内容赛道持续火热。' });

// 9. TikTok - 交叉腿办公椅
const p9 = findProduct('tiktok', ['criss cross', 'chair'], true);
if (p9) curatedSelections.push({ product: p9, reason: '可调节交叉腿办公椅，18万+销量的TikTok爆款！独特坐姿设计，盘腿而坐极为舒适。近年WFH居家办公趋势下，人体工学椅赛道火热，这款椅子设计新颖，TikTok上展示效果极佳。' });

// 10. TikTok - 厨房鸡肉撕碎机
const p10 = findProduct('tiktok', ['chicken shredder']);
if (p10) curatedSelections.push({ product: p10, reason: '厨房鸡肉撕碎机，$6.99的小巧厨房神器。手撕鸡肉不再费力，适合做沙拉/三明治/宠物鲜食。ASMR风格操作视频在TikTok上极易传播，厨房小工具品类一直是内容电商的常青树。' });

// 如果不足10个，从未入选的产品中按销量+新奇度补充
if (curatedSelections.length < 10) {
  console.log(`\n当前已选 ${curatedSelections.length} 个，需要补充...`);
  const selectedIds = new Set(curatedSelections.map(s => s.product.goodsId));

  const remaining = products
    .filter(p => !selectedIds.has(p.goodsId))
    .sort((a, b) => (b.sold || 0) - (a.sold || 0));

  const noveltyKw = ['smart', 'auto', 'led', 'cool', 'fun', 'cute', 'unique', 'magic', 'glow',
    'fidget', 'sensor', 'fold', 'portable', 'space', 'creative', 'new', '2026', 'pet', 'toy',
    'light', 'game', 'play', 'kit', 'set'];

  for (const p of remaining) {
    if (curatedSelections.length >= 10) break;
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    const hasNovelty = noveltyKw.some(kw => name.includes(kw));

    if (hasNovelty || (p.sold || 0) > 50000) {
      curatedSelections.push({
        product: p,
        reason: hasNovelty
          ? '产品含创新/新奇关键词，具备内容传播潜力，市场表现良好。'
          : '高销量热销商品，经过市场验证的爆款，具备复推价值。'
      });
    }
  }
}

// 最多取10个
const finalSelections = curatedSelections.slice(0, 10);

// 输出结果
console.log('========================================');
console.log('选品筛选开始 - 2026-04-25 第三轮');
console.log(`总扫描商品: ${products.length} 个`);
console.log('========================================\n');

const selectionDate = '2026-04-25';

// 检查已有文件确定编号
const existingFiles = fs.existsSync(OUTPUT_DIR) ? fs.readdirSync(OUTPUT_DIR) : [];
const usedIds = new Set();
existingFiles.forEach(f => {
  const m1 = f.match(/^(\d{8})(\d{3})\.md$/);
  if (m1) usedIds.add(m1[1] + m1[2]);
  const m2 = f.match(/^C(\d{8})(\d{3})\.md$/);
  if (m2) usedIds.add(m2[1] + m2[2]);
  const m3 = f.match(/^(\d{8})-(\d{3})\.md$/);
  if (m3) usedIds.add(m3[1] + m3[2]);
});

// 生成输出
let nextNum = 1;
const resultSelections = [];

finalSelections.forEach((item, index) => {
  const p = item.product;
  const reason = item.reason;

  // 唯一编号
  let id;
  do {
    id = `${selectionDate.replace(/-/g, '')}${String(nextNum).padStart(3, '0')}`;
    nextNum++;
  } while (usedIds.has(id));

  // 平台链接
  let detailUrl = '';
  const plat = p._sourcePlatform;
  if (plat === 'temu') detailUrl = `https://www.temu.com/g-${p.goodsId}.html`;
  else if (plat === 'shein') detailUrl = `https://www.shein.com/product-detail/${p.goodsId}.html`;
  else if (plat === 'amazon') detailUrl = `https://www.amazon.com/dp/${p.goodsId}`;
  else if (plat === 'sumaitong') detailUrl = `https://www.aliexpress.com/item/${p.goodsId}.html`;
  else if (plat === 'tiktok') detailUrl = `https://www.tiktok.com/shop/product/${p.goodsId}`;

  let imageUrl = p.thumbnail || '';
  if (imageUrl.startsWith('//')) imageUrl = 'https:' + imageUrl;

  const goodsName = p.goodsNameEn || p.goodsName || '';
  const sold = parseInt(p.sold) || 0;
  const rating = parseFloat(p.rating) || 0;
  const reviews = parseInt(p.reviewNum) || 0;

  // 新奇指数评分
  let score = 0;
  if (sold > 1000000) score += 5;
  else if (sold > 100000) score += 4;
  else if (sold > 10000) score += 3;
  else if (sold > 1000) score += 2;
  if (rating >= 4.8) score += 3;
  else if (rating >= 4.5) score += 2;
  if (reviews > 10000) score += 3;
  else if (reviews > 1000) score += 2;
  else if (reviews > 100) score += 1;

  let noveltyStars;
  if (score > 8) noveltyStars = '★★★★★';
  else if (score > 5) noveltyStars = '★★★★☆';
  else if (score > 3) noveltyStars = '★★★☆☆';
  else noveltyStars = '★★☆☆☆';

  resultSelections.push({
    id,
    platform: plat,
    category: p._sourceCatName,
    channel: p._sourceChannel,
    goodsId: p.goodsId,
    goodsName: goodsName,
    thumbnail: imageUrl,
    detailUrl,
    sold,
    priceMin: p.goodsPriceMin,
    priceMax: p.goodsPriceMax,
    reviewNum: reviews,
    rating,
    score,
    selectionReason: reason,
    noveltyStars
  });

  console.log(`${index+1}. [${plat.toUpperCase()}] ${p._sourceCatName} / ${p._sourceChannel}`);
  console.log(`   名称: ${goodsName.substring(0, 60)}`);
  console.log(`   销量: ${sold} | 价格: $${p.goodsPriceMin || '?'} | 评分: ${rating}`);
  console.log(`   新奇指数: ${noveltyStars}`);
  console.log('');
});

// 确保目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 写入markdown文件
console.log('写入选品文件...\n');

resultSelections.forEach((item) => {
  const fileName = `${item.id}.md`;
  const filePath = path.join(OUTPUT_DIR, fileName);

  const escapedName = (item.goodsName || '').replace(/"/g, "'");
  const escapedReason = (item.selectionReason || '').replace(/"/g, "'").substring(0, 200);

  const markdown = `---
id: "${item.id}"
platform: "${item.platform}"
category: "${item.category}"
channel: "${item.channel}"
goodsId: "${item.goodsId}"
goodsName: "${escapedName}"
thumbnail: "${item.thumbnail}"
detailUrl: "${item.detailUrl}"
sold: ${item.sold}
priceMin: ${item.priceMin || 0}
priceMax: ${item.priceMax || 0}
reviewNum: ${item.reviewNum || 0}
rating: ${item.rating || 0}
score: ${item.score || 0}
selectionReason: "${escapedReason}"
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
| 价格 | $ ${item.priceMin || '?'} ~ ${item.priceMax || '?'} |
| 评论数 | ${item.reviewNum || 0} |
| 评分 | ${item.rating || '暂无'} |

## 选品理由

${item.selectionReason}

## 选品分析

| 维度 | 评估 |
|------|------|
| 新奇指数 | ${item.noveltyStars || '★★★☆☆'} |
| 商品类目 | ${item.category} |
| 发现渠道 | ${item.channel} |
| 价格区间 | $ ${item.priceMin || '?'} ~ ${item.priceMax || '?'} |
| 市场表现 | 销量 ${item.sold || 0} | 评论 ${item.reviewNum || 0} | 评分 ${item.rating || '暂无'} |

## 商品图片

![商品图片](${item.thumbnail || ''})

## 商品链接

[查看商品详情](${item.detailUrl || ''})

## 综合评分

**${item.score || 0}** 分

---
*由 Selector Agent 自动生成于 ${new Date().toLocaleString('zh-CN')}*
`;

  fs.writeFileSync(filePath, markdown);
  console.log(`✓ ${fileName} - ${(item.goodsName || '').substring(0, 50)}`);
});

// 保存选品结果JSON
const resultFile = path.join(__dirname, 'selected_round3.json');
fs.writeFileSync(resultFile, JSON.stringify({
  timestamp: new Date().toISOString(),
  selectionDate,
  round: 3,
  totalScanned: products.length,
  selectedCount: resultSelections.length,
  selections: resultSelections.map(s => ({
    id: s.id,
    platform: s.platform,
    category: s.category,
    channel: s.channel,
    goodsId: s.goodsId,
    goodsName: s.goodsName,
    sold: s.sold,
    priceMin: s.priceMin,
    score: s.score,
    selectionReason: s.selectionReason
  }))
}, null, 2));
console.log(`\n选品结果JSON已保存至: ${resultFile}`);

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
  { platform: 'temu', catId: 1464, catName: '宠物用品' },
  { platform: 'shein', catId: 3637, catName: '箱包和行李箱' },
  { platform: 'amazon', catId: 15684181, catName: '汽车' },
  { platform: 'sumaitong', catId: 13, catName: '家装（硬装）' },
  { platform: 'tiktok', catId: 604453, catName: 'Furniture' }
];

categoriesToUpdate.forEach(({ platform, catId, catName }) => {
  const escapedCatName = catName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(\\{ catId: ${catId}, catName: "${escapedCatName}", lastCrawled: )null`);
  stateContent = stateContent.replace(regex, `$1"${now}"`);
});

fs.writeFileSync(statePath, stateContent);
console.log('✓ crawl_state.js 已更新');

console.log(`\n========================================`);
console.log(`完成! 共写入 ${resultSelections.length} 个商品到 ${OUTPUT_DIR}`);
console.log(`========================================`);
