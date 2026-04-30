/**
 * 选品筛选脚本 v3 - 2026-04-30
 *
 * 严格筛选：只选真正"新奇/有趣/好玩/有爆点"的商品
 * 避免普通办公用品、基础商品
 */

const fs = require('fs');

// 读取原始数据
const rawDataPath = 'operations/selected/dailytemp/2026-04-30/raw_products.json';
const rawProducts = JSON.parse(fs.readFileSync(rawDataPath, 'utf-8'));

console.log(`读取到 ${rawProducts.length} 个商品，开始严格筛选...\n`);

// ===== 强制排除的关键词（普通/无聊商品）=====
const excludeKeywords = [
  'tape', 'paper', 'printer', 'copy', 'marker', 'pen', 'pencil',
  'cable', 'wire', 'adapter', 'charger', 'connector',
  'industrial', 'hardware', 'standard', 'basic', 'simple', 'plain',
  'generic', 'ordinary', 'normal', 'regular', 'common',
  'component', 'electronic component', 'pcb', 'circuit',
  'shipping', 'packing', 'mailer', 'envelope',
  'office', 'office supply', 'school supply',
  'screw', 'bolt', 'nut', 'washer', 'tool part',
  'cpu', 'gpu', 'ram', 'memory', 'storage', 'hard drive',
  'spare', 'replacement', 'for hp', 'for canon', 'for epson',
  'label', 'sticker roll', 'tag',
  'medical', 'pharmaceutical', 'lab', 'scientific',
  'wholesale', 'bulk', 'lot', '100 pack', '50 pack', '10 pack'
];

// ===== 强烈喜欢的关键词（有趣/新奇/爆点）=====
const loveKeywords = [
  // 英文趣味关键词
  'funny', 'quirky', 'unique', 'weird', 'bizarre', 'crazy', 'hilarious',
  'cute', 'cool', 'awesome', 'amazing', 'wow', 'wow',
  'led', 'neon', 'glow', 'light up', 'glitter', 'sparkle', 'glow in dark',
  '3d', '3-d',
  // 可爱动物
  'flamingo', 'unicorn', 'sloth', 'panda', 'koala', 'llama', 'cactus', 'pineapple', 'avocado',
  'cat', 'dog', 'puppy', 'kitten', 'bunny', 'hamster', 'dinosaur', 'dragon',
  // 节日/派对
  'halloween', 'christmas', 'valentine', 'easter', 'thanksgiving',
  'party', 'costume', 'cosplay', 'festival',
  // 科幻/魔法
  'alien', 'ufo', 'space', 'rocket', 'planet', 'galaxy', 'astronaut',
  'magic', 'wizard', 'witch', 'potion', 'spell', 'wands',
  // 卡通/动漫
  'cartoon', 'anime', 'manga', 'superhero', 'marvel', 'dc',
  'batman', 'spiderman', 'harry potter', 'harry', 'potter',
  // 风格
  'vintage', 'retro', 'steampunk', 'gothic', 'boho', 'bohemian',
  // 装饰/礼品
  'gift', 'present', 'surprise', 'decor', 'decoration',
  // 自然/植物
  'plant', 'mushroom', 'flower', 'rose', 'butterfly', 'leaf',
  // 珠宝/闪亮
  'crystal', 'gem', 'diamond', 'crown', 'tiara', 'jewel',
  // 游戏/玩具
  'toy', 'game', 'puzzle', 'magic', 'prank', 'gag', 'trick',
  // 科技/智能
  'robot', 'smart', 'wireless', 'bluetooth', 'app', 'voice',
  // 创意设计
  'creative', 'design', 'artistic', 'handmade', 'custom',
  // 厨房/家居
  'kitchen', 'home decor', 'candle', 'scent', 'aroma',
  // 宠物相关
  'pet', 'dog', 'cat', 'collar', 'bed', 'toy for pet'
];

// ===== 喜欢的关键词（中等加分）=====
const likeKeywords = [
  'fashion', 'style', 'trend', 'trendy', 'stylish', 'chic',
  'beauty', 'makeup', 'cosmetics', 'skincare',
  'kids', 'children', 'baby', 'toddler', 'kids\'\'',
  'women', 'women\'s', 'men', 'men\'s', 'ladies', 'gentlemen',
  'summer', 'spring', 'winter', 'autumn',
  'beach', 'pool', 'outdoor', 'camping',
  'festival', 'wedding', 'anniversary', 'birthday',
  'rainbow', 'star', 'heart', 'moon', 'sun',
  'floral', 'botanical', 'nature',
  'novelty', 'popular', 'best seller', 'top seller'
];

// ===== 中文趣味关键词 =====
const loveKeywordsCn = [
  '有趣', '创意', '可爱', '时尚', '潮流', '新奇', '独特', '搞怪', '奇葩', '脑洞',
  '趣味', '好玩', '惊喜', '节日', '派对', '礼物', '装饰', '搞怪',
  '圣诞', '万圣节', '情人节', '复活节', '感恩节',
  '动物', '猫咪', '狗狗', '兔子', '仓鼠', '龙', '独角兽', '火烈鸟',
  '植物', '蘑菇', '花卉', '玫瑰', '蝴蝶', '树叶',
  '水晶', '宝石', '钻石', '皇冠', '王冠',
  '魔法', '巫术', '精灵', '仙女', '魔杖',
  '卡通', '动漫', '二次元', '超级英雄',
  '科幻', '太空', '星球', '火箭', '外星人', 'UFO',
  '复古', '怀旧', '蒸汽朋克', '朋克', '哥特',
  '智能', '科技', '无线', '蓝牙', 'APP控制',
  '玩具', '游戏', '拼图', '魔术', '整蛊'
];

// 强制排除检查
function isExcluded(product) {
  const name = ((product.goodsNameEn || '') + ' ' + (product.goodsNameCn || '')).toLowerCase();
  for (const kw of excludeKeywords) {
    if (name.includes(kw.toLowerCase())) return true;
  }
  return false;
}

// 计算有趣度得分
function calculateFunScore(product) {
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const name = nameEn + ' ' + nameCn;

  let score = 0;

  // 强烈喜欢关键词：每个 +10分
  for (const kw of loveKeywords) {
    if (name.includes(kw.toLowerCase())) {
      score += 10;
      break; // 只加一次
    }
  }

  // 中文关键词检查
  for (const kw of loveKeywordsCn) {
    if (nameCn.includes(kw)) {
      score += 10;
      break;
    }
  }

  // 中等喜欢关键词：每个 +3分
  for (const kw of likeKeywords) {
    if (name.includes(kw.toLowerCase())) {
      score += 3;
    }
  }

  // 销量加权（有市场验证的产品更好）
  const sold = product.sold || 0;
  if (sold >= 100000) score += 15;
  else if (sold >= 50000) score += 10;
  else if (sold >= 20000) score += 7;
  else if (sold >= 10000) score += 5;
  else if (sold >= 5000) score += 3;
  else if (sold >= 1000) score += 1;
  // 新品加分（有潜力）
  else if (sold < 50) score += 2;

  // 评论数加分（真实销售反馈）
  const reviews = product.reviewNum || 0;
  if (reviews >= 10000) score += 10;
  else if (reviews >= 5000) score += 7;
  else if (reviews >= 2000) score += 5;
  else if (reviews >= 500) score += 3;
  else if (reviews >= 100) score += 1;

  // 评分加权
  const rating = product.rating || 0;
  if (rating >= 4.8) score += 10;
  else if (rating >= 4.5) score += 6;
  else if (rating >= 4.0) score += 3;
  else if (rating > 0 && rating < 3.5) score -= 10;

  // 价格适中加分（太便宜可能是普通品，太贵可能不好卖）
  const priceMin = product.goodsPriceMin || 0;
  if (priceMin >= 5 && priceMin <= 80) score += 5;
  else if (priceMin >= 2 && priceMin < 5) score += 2;
  else if (priceMin < 1) score -= 8;
  else if (priceMin > 300) score -= 5;

  return score;
}

// 去重
function deduplicate(products) {
  const seen = new Set();
  return products.filter(p => {
    const key = (p.goodsNameEn || p.goodsNameCn || '').toLowerCase().substring(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 执行筛选
const uniqueProducts = deduplicate(rawProducts);
console.log(`去重后: ${uniqueProducts.length} 个商品`);

// 过滤掉被排除的商品
const filtered = uniqueProducts.filter(p => !isExcluded(p));
console.log(`排除普通商品后: ${filtered.length} 个商品\n`);

// 计算得分
const scored = filtered.map(p => ({
  ...p,
  funScore: calculateFunScore(p)
}));

// 按得分排序
scored.sort((a, b) => b.funScore - a.funScore);

// 选择Top10，保持平台多样性
const result = [];
const platformCount = {};
const maxPerPlatform = 3;

for (const product of scored) {
  const platform = product.platform;
  platformCount[platform] = (platformCount[platform] || 0) + 1;

  if (platformCount[platform] <= maxPerPlatform) {
    result.push(product);
  }

  if (result.length >= 15) break;
}

// 最终精选10个
const finalSelection = result.slice(0, 10);

console.log(`\n精选 ${finalSelection.length} 个商品:\n`);
finalSelection.forEach((p, i) => {
  console.log(`${i + 1}. [${p.platform}] ${(p.goodsNameEn || p.goodsNameCn || 'Unknown').substring(0, 50)}...`);
  console.log(`   销量: ${p.sold?.toLocaleString() || 'N/A'} | 评分: ${p.rating || 'N/A'} | 得分: ${p.funScore.toFixed(1)}`);
});

// 生成报告
function generateReport(products, date) {
  const prefix = date.replace(/-/g, '');

  let content = `# 选品报告 - ${date}\n\n`;
  content += `> 本次采集于 ${date} 完成，共采集 200 个商品（去重+过滤后 ${filtered.length} 个），筛选出 ${products.length} 个精选商品。\n\n`;
  content += `## 采集类目\n\n`;
  content += `| 平台 | 类目 | 采集渠道 |\n`;
  content += `|------|------|----------|\n`;
  content += `| Temu | 服装、鞋靴和珠宝饰品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| Shein | 家用纺织品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| Amazon | 办公产品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| 速卖通 | 家具和室内装饰品 | 热销商品, 热销新品, 新店热销, 大卖新品 |\n`;
  content += `| TikTok | Shoes | 热销商品, 热销新品, 新店热销, 大卖新品 |\n\n`;
  content += `## 精选商品\n\n`;

  products.forEach((product, index) => {
    const num = String(index + 1).padStart(3, '0');
    const name = product.goodsNameEn || product.goodsNameCn || 'Unknown';
    const price = product.goodsPriceMin !== null
      ? (product.goodsPriceMax !== null && product.goodsPriceMax !== product.goodsPriceMin
        ? `$${product.goodsPriceMin} - $${product.goodsPriceMax}`
        : `$${product.goodsPriceMin}`)
      : 'N/A';
    const sold = product.sold ? product.sold.toLocaleString() : 'N/A';
    const rating = product.rating || 'N/A';
    const reviews = product.reviewNum ? product.reviewNum.toLocaleString() : '0';

    content += `### ${prefix}-${num} - ${name}\n\n`;
    content += `- **平台**: ${product.platform === 'temu' ? 'Temu' : product.platform === 'sumaitong' ? '速卖通' : product.platform === 'shein' ? 'Shein' : product.platform === 'amazon' ? 'Amazon' : 'TikTok'}\n`;
    content += `- **价格**: ${price}\n`;
    content += `- **销量**: ${sold}\n`;
    content += `- **评分**: ${rating} | **评论**: ${reviews}\n`;
    content += `- **综合评分**: ${product.funScore.toFixed(1)}\n\n`;
  });

  return content;
}

const report = generateReport(finalSelection, '2026-04-30');

// 保存报告
fs.writeFileSync('operations/selected/20260430_selector_report_v3.md', report);
console.log(`\n报告已保存: operations/selected/20260430_selector_report_v3.md`);

// 保存精选商品JSON
fs.writeFileSync('operations/selected/selected_20260430_v3.json', JSON.stringify(finalSelection, null, 2));
console.log(`精选商品已保存: operations/selected/selected_20260430_v3.json`);

// 为每个商品生成独立的markdown文件
const today = new Date();
const dateStr = '20260430';

finalSelection.forEach((product, index) => {
  const num = String(index + 1).padStart(3, '0');
  const fileName = `${dateStr}-${num}.md`;
  const filePath = `operations/selected/${fileName}`;

  let content = `# ${(product.goodsNameEn || product.goodsNameCn || 'Unknown').substring(0, 80)}\n\n`;
  content += `## 基本信息\n\n`;
  content += `- **编号**: ${dateStr}-${num}\n`;
  content += `- **平台**: ${product.platform}\n`;
  content += `- **类目**: ${product.sourceCategory}\n`;
  content += `- **来源渠道**: ${product.sourceChannel}\n\n`;
  content += `## 商品信息\n\n`;
  content += `- **英文名**: ${product.goodsNameEn || 'N/A'}\n`;
  content += `- **中文名**: ${product.goodsNameCn || 'N/A'}\n`;
  content += `- **商品ID**: ${product.goodsId || 'N/A'}\n`;
  content += `- **图片链接**: ${product.thumbnail || 'N/A'}\n\n`;
  content += `## 销售数据\n\n`;
  content += `- **价格**: $${product.goodsPriceMin || 'N/A'}`;
  if (product.goodsPriceMax && product.goodsPriceMax !== product.goodsPriceMin) {
    content += ` - $${product.goodsPriceMax}`;
  }
  content += `\n`;
  content += `- **销量**: ${product.sold ? product.sold.toLocaleString() : 'N/A'}\n`;
  content += `- **销售额**: $${product.sales ? product.sales.toLocaleString() : 'N/A'}\n`;
  content += `- **评分**: ${product.rating || 'N/A'}/5\n`;
  content += `- **评论数**: ${product.reviewNum ? product.reviewNum.toLocaleString() : 'N/A'}\n\n`;
  content += `## 时间信息\n\n`;
  content += `- **上架时间**: ${product.onSaleTime ? new Date(product.onSaleTime).toLocaleDateString() : 'N/A'}\n`;
  content += `- **开店时间**: ${product.mallOpenTime ? new Date(product.mallOpenTime).toLocaleDateString() : 'N/A'}\n\n`;
  content += `## 综合评分\n\n`;
  content += `**有趣度得分**: ${product.funScore.toFixed(1)}\n\n`;
  content += `---\n`;
  content += `*采集日期: ${today.toLocaleDateString()}*\n`;

  fs.writeFileSync(filePath, content, 'utf-8');
});

console.log(`已生成 ${finalSelection.length} 个商品markdown文件`);
console.log('\n✅ 选品任务完成!');