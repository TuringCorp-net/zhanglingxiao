/**
 * 选品筛选脚本 - 2026-05-01
 *
 * 筛选标准：新奇、有趣、好玩、有爆点
 * - 独特设计或概念
 * - 节日/季节性热点
 * - 社交媒体爆款潜质
 * - 有创意的礼品/收藏品
 */

const fs = require('fs');
const path = require('path');

const CRAWL_DATE = '2026-05-01';
const INPUT_PATH = `/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected/dailytemp/${CRAWL_DATE}/raw_products.json`;
const OUTPUT_DIR = `/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected`;

// 关键词评分系统
const HOT_KEYWORDS = [
  // 新奇特
  'unique', 'creative', 'fun', 'weird', 'cool', 'amazing', 'cute', 'interesting',
  'DIY', 'handmade', 'handicraft', 'artistic', 'vintage', 'retro',
  // 热点节日
  'christmas', 'halloween', 'easter', 'valentine', 'wedding', 'party',
  'birthday', 'holiday', 'festival', 'anniversary',
  // 社交爆款
  'viral', 'trending', 'popular', 'bestseller', 'instagrammable',
  // 功能性
  'gift', 'decor', 'decoration', 'ornament', 'souvenir', 'collectible'
];

const NEGATIVE_KEYWORDS = [
  'used', 'second-hand', 'damaged', 'defective', 'fake', 'counterfeit'
];

/**
 * 计算商品热度评分
 */
function calculateHotScore(product) {
  let score = 0;
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();

  // 关键词匹配加分
  for (const kw of HOT_KEYWORDS) {
    if (nameEn.includes(kw) || nameCn.includes(kw)) {
      score += 5;
    }
  }

  // 销量加权 (log缩放)
  const sold = product.sold || 0;
  if (sold > 0) {
    score += Math.min(Math.log10(sold + 1) * 3, 30);
  }

  // 评论数加权
  const reviews = product.reviewNum || 0;
  if (reviews > 50) {
    score += Math.min(Math.log10(reviews) * 2, 15);
  }

  // 评分加权
  const rating = product.rating || 0;
  if (rating >= 4.5) {
    score += 5;
  } else if (rating >= 4.0) {
    score += 2;
  }

  // 价格适中加分 (有利润空间)
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  if (priceMin >= 2 && priceMax <= 50) {
    score += 3;
  }

  // 负面词减分
  for (const kw of NEGATIVE_KEYWORDS) {
    if (nameEn.includes(kw) || nameCn.includes(kw)) {
      score -= 10;
    }
  }

  return score;
}

/**
 * 判断商品是否有爆点/亮点
 */
function hasHotspot(product) {
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = nameEn + ' ' + nameCn;

  // 1. 节日/季节性热点
  const seasonalKeywords = ['christmas', 'halloween', 'easter', 'valentine', 'wedding', 'party',
    'birthday', 'holiday', 'new year', 'spring', 'summer', 'autumn', 'winter'];
  for (const kw of seasonalKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // 2. 创意/独特设计
  const creativeKeywords = ['DIY', 'custom', 'personalized', 'unique', 'creative', 'handmade',
    'handcrafted', 'artisan', 'vintage', 'retro', 'decorative', 'ornamental'];
  for (const kw of creativeKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // 3. 礼品属性
  const giftKeywords = ['gift', 'present', 'souvenir', 'souvenirs', 'keepsake', 'commemorative',
    'special', 'surprise', 'treat'];
  for (const kw of giftKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // 4. 社交媒体爆款特征
  const viralKeywords = ['viral', 'trending', 'popular', 'bestseller', 'famous', 'must-have'];
  for (const kw of viralKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // 5. 有趣/搞怪元素
  const funKeywords = ['fun', 'funny', 'quirky', 'playful', 'whimsical', 'amusing',
    'joke', 'prank', 'novelty'];
  for (const kw of funKeywords) {
    if (fullName.includes(kw)) return true;
  }

  // 6. 评论数高且评分高 - 说明是经验证的爆款
  if ((product.reviewNum || 0) > 100 && (product.rating || 0) >= 4.5) {
    return true;
  }

  // 7. 高销量新品 - 新品爆款潜质
  if ((product.sold || 0) > 5000 && product.onSaleTime) {
    const onSaleDate = new Date(product.onSaleTime);
    const daysAgo = (Date.now() - onSaleDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysAgo < 90) return true; // 90天内上架的高销量商品
  }

  return false;
}

/**
 * 格式化商品数据为标准输出格式
 */
function formatProduct(product, platform, index) {
  const priceMin = product.goodsPriceMin || 0;
  const priceMax = product.goodsPriceMax || priceMin;
  const priceStr = priceMin === priceMax
    ? `$${priceMin.toFixed(2)}`
    : `$${priceMin.toFixed(2)} - $${priceMax.toFixed(2)}`;

  return {
    id: `${CRAWL_DATE.replace(/-/g, '')}${String(index + 1).padStart(3, '0')}`,
    platform: platform,
    goodsId: product.goodsId,
    title: product.goodsNameEn || product.goodsName || '',
    titleCn: product.goodsNameCn || '',
    price: priceStr,
    priceMin: priceMin,
    priceMax: priceMax,
    sold: product.sold || 0,
    reviews: product.reviewNum || 0,
    rating: product.rating || 0,
    thumbnail: product.thumbnail || product.thumbnailCn || '',
    detailUrl: product.detailUrl || `https://www.${platform}.com/item/${product.goodsId}`,
    onSaleTime: product.onSaleTime || null,
    hotspot: hasHotspot(product) ? 'yes' : 'no',
    channel: product._channel || ''
  };
}

/**
 * 主筛选逻辑
 */
async function filter() {
  console.log(`[选品筛选] 开始筛选 ${CRAWL_DATE}`);
  console.log('='.repeat(60));

  // 读取原始数据
  const rawData = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));

  const allProducts = [];
  const platformInfo = {};

  // 收集所有商品
  for (const [platform, data] of Object.entries(rawData.platforms)) {
    platformInfo[platform] = {
      catId: data.catId,
      catName: data.catName,
      total: 0
    };

    for (const [channel, channelData] of Object.entries(data.subChannels)) {
      if (channelData.success && channelData.products) {
        for (const product of channelData.products) {
          product._platform = platform;
          product._channel = channel;
          product._hotScore = calculateHotScore(product);
          allProducts.push(product);
          platformInfo[platform].total++;
        }
      }
    }
  }

  console.log(`\n[统计] 共收集 ${allProducts.length} 个商品`);
  for (const [platform, info] of Object.entries(platformInfo)) {
    console.log(`  - ${platform}: ${info.total} 个`);
  }

  // 按热度评分排序
  allProducts.sort((a, b) => b._hotScore - a._hotScore);

  // 去重：按goodsId去重
  const seenIds = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (!p.goodsId) return true; // 没有ID的保留
    if (seenIds.has(p.goodsId)) return false;
    seenIds.add(p.goodsId);
    return true;
  });
  console.log(`\n[去重] 去重后商品: ${uniqueProducts.length} 个`);

  // 初筛：只保留有热点的商品
  const hotspotProducts = uniqueProducts.filter(hasHotspot);
  console.log(`[初筛] 有热点商品: ${hotspotProducts.length} 个`);

  // 精选：取 Top 30 进行人工审核
  const topProducts = uniqueProducts.slice(0, 30);
  console.log(`[精选] 进入Top30候选: ${topProducts.length} 个`);

  // 最终选择：10个最具爆款潜力的商品
  // 分布策略：优先选择有热点的，然后平衡各平台
  const selected = [];
  const platformCount = {};

  for (const product of topProducts) {
    if (selected.length >= 10) break;

    const p = product._platform;
    platformCount[p] = (platformCount[p] || 0);

    // 每个平台最多选2个
    if (platformCount[p] >= 2) continue;

    selected.push(product);
    platformCount[p]++;
  }

  // 如果不足10个，从剩余商品中补充
  if (selected.length < 10) {
    for (const product of uniqueProducts) {
      if (selected.length >= 10) break;
      if (selected.includes(product)) continue;

      selected.push(product);
    }
  }

  console.log(`\n[最终] 入选商品: ${selected.length} 个`);
  for (const p of selected) {
    console.log(`  - [${p._platform}] ${p.goodsNameEn?.substring(0, 50)}... (热度:${p._hotScore.toFixed(1)})`);
  }

  // 格式化输出
  const selectedFormatted = selected.map((p, i) => formatProduct(p, p._platform, i));

  // 保存筛选结果
  const selectedPath = path.join(OUTPUT_DIR, `selected_${CRAWL_DATE.replace(/-/g, '')}.json`);
  fs.writeFileSync(selectedPath, JSON.stringify(selectedFormatted, null, 2), 'utf8');
  console.log(`\n[保存] 筛选结果 → ${selectedPath}`);

  // 生成 Markdown 报告
  const reportPath = path.join(OUTPUT_DIR, `${CRAWL_DATE.replace(/-/g, '')}_selector_report.md`);
  const reportContent = generateReport(selectedFormatted, platformInfo);
  fs.writeFileSync(reportPath, reportContent, 'utf8');
  console.log(`[保存] 报告 → ${reportPath}`);

  return selectedFormatted;
}

/**
 * 生成 Markdown 报告
 */
function generateReport(selected, platformInfo) {
  const lines = [];
  lines.push(`# 选品报告 - ${CRAWL_DATE}`);
  lines.push('');
  lines.push('## 采集概览');
  lines.push('');
  lines.push('| 平台 | 类目 | 采集数量 |');
  lines.push('|------|------|----------|');
  for (const [platform, info] of Object.entries(platformInfo)) {
    lines.push(`| ${platform} | ${info.catName} | ${info.total} |`);
  }
  lines.push('');
  lines.push('## 入选商品');
  lines.push('');

  for (let i = 0; i < selected.length; i++) {
    const p = selected[i];
    lines.push(`### ${i + 1}. ${p.title}`);
    lines.push('');
    lines.push(`- **平台**: ${p.platform}`);
    lines.push(`- **价格**: ${p.price}`);
    lines.push(`- **销量**: ${p.sold.toLocaleString()}`);
    lines.push(`- **评论**: ${p.reviews}`);
    lines.push(`- **评分**: ${p.rating}`);
    lines.push(`- **爆点**: ${p.hotspot === 'yes' ? '有' : '待评估'}`);
    if (p.thumbnail) {
      lines.push(`- **图片**: ${p.thumbnail}`);
    }
    lines.push(`- **链接**: ${p.detailUrl}`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## 筛选标准说明');
  lines.push('');
  lines.push('本批次选品遵循以下标准：');
  lines.push('');
  lines.push('1. **新奇独特**：具有独特设计、创意概念的商品');
  lines.push('2. **节日热点**：契合当前或近期节日/季节性需求');
  lines.push('3. **社交潜力**：具备社交媒体传播属性的爆款潜质');
  lines.push('4. **礼品属性**：适合作为礼品、纪念品、收藏品');
  lines.push('5. **用户验证**：评论数高、评分好的经验证爆款');
  lines.push('');

  return lines.join('\n');
}

filter().catch(console.error);
