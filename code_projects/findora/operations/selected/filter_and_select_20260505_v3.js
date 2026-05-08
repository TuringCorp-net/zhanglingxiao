/**
 * 选品精筛脚本 — 2026-05-05 (第3轮)
 *
 * 从原始候选数据中精选 Top 10，做更好的去重和多样性保证，
 * 并生成 per-product markdown 文件 + 更新 crawl_state
 */

const fs = require('fs');
const path = require('path');

const TODAY = '2026-05-05';
const INPUT_FILE = path.join(__dirname, 'dailytemp', '2026-05-05-v3', 'candidates.json');

// ============================================
// 更精细的选品评分（修复版）
// ============================================

function scoreProduct(product, platform, catName, subChannel) {
  let score = 0;
  const reasons = [];
  const tags = [];

  // 1. 销售能力
  const sold = product.sold || 0;
  if (sold >= 100000) { score += 35; reasons.push(`🔥热销爆款(销量${(sold/1000).toFixed(0)}k)`); tags.push('hot'); }
  else if (sold >= 50000) { score += 28; reasons.push(`热销好品(销量${(sold/1000).toFixed(0)}k)`); tags.push('hot'); }
  else if (sold >= 10000) { score += 20; reasons.push(`畅销品(销量${(sold/1000).toFixed(0)}k)`); tags.push('hot'); }
  else if (sold >= 1000) { score += 12; reasons.push(`销量不错(${sold})`); }
  else if (sold > 0) { score += 5; }
  else { score -= 3; }

  // 2. 口碑信号
  const reviewNum = product.reviewNum || 0;
  const rating = parseFloat(product.rating) || 0;
  if (reviewNum >= 1000 && rating >= 4.5) { score += 30; reasons.push(`⭐口碑炸裂(评论${(reviewNum/1000).toFixed(1)}k/评分${rating})`); tags.push('trusted'); }
  else if (reviewNum >= 200 && rating >= 4.2) { score += 22; reasons.push(`好评如潮(评论${reviewNum}/评分${rating})`); tags.push('trusted'); }
  else if (reviewNum >= 50 && rating >= 4.0) { score += 14; reasons.push(`口碑不错(评论${reviewNum})`); }
  else if (reviewNum > 0) { score += 6; }
  else { score -= 2; } // 无评论扣分

  // 3. 新奇/趣味/创意 信号
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = nameEn + ' ' + nameCn;

  const highNovelty = ['smart', 'wireless', 'portable', 'mini', 'led', 'magnetic', '3d', 'magic',
    '智能', '无线', '便携', '迷你', '磁吸', '魔法', '蓝牙', '多功能', '折叠',
    'creative', 'novel', 'unique', 'cool', 'funny', 'cartoon', 'glowing', 'rechargeable',
    '创意', '新奇', '独特', '趣味', '卡通', '发光', '可充电', '网红'];
  const mediumNovelty = ['bluetooth', 'usb', 'waterproof', 'silicone', 'foldable', 'multifunction',
    '太阳能', '防水', '硅胶', '可爱', '简约'];

  let noveltyHits = 0;
  for (const kw of highNovelty) { if (fullName.includes(kw)) noveltyHits += 2; }
  for (const kw of mediumNovelty) { if (fullName.includes(kw)) noveltyHits += 1; }

  if (noveltyHits >= 8) { score += 35; reasons.push(`✨超级新奇(趣味元素密集)`); tags.push('novel'); }
  else if (noveltyHits >= 5) { score += 25; reasons.push(`相当有趣(多个新奇元素)`); tags.push('novel'); }
  else if (noveltyHits >= 3) { score += 15; reasons.push(`有新意`); }
  else if (noveltyHits >= 1) { score += 6; }

  // 4. 价格吸引力
  const price = product.goodsPriceMin || product.goodsPriceMax || 0;
  if (price >= 5 && price <= 25) { score += 12; reasons.push(`💰价格友好($${price})`); tags.push('bargain'); }
  else if (price < 5) { score += 8; reasons.push(`超低价($${price})`); tags.push('bargain'); }
  else if (price > 25 && price <= 50) { score += 6; reasons.push(`中档价($${price})`); }
  else if (price > 50) { score += 1; } // 高价不扣分但也不加分

  // 5. 上架时间信号
  const onSaleTime = product.onSaleTime;
  if (onSaleTime) {
    try {
      const daysOnSale = Math.floor((new Date(TODAY) - new Date(onSaleTime)) / (1000 * 60 * 60 * 24));
      if (daysOnSale <= 7) { score += 18; reasons.push(`🆕上架≤7天`); tags.push('new'); }
      else if (daysOnSale <= 30) { score += 10; reasons.push(`近期上架(${daysOnSale}天)`); tags.push('new'); }
      else if (daysOnSale <= 90) { score += 4; }
    } catch (e) { /* ignore date parse error */ }
  }

  // 6. 平台+类目组合稀有度加分（鼓励多样性）
  if (catName === '摩托车装备配件') { score += 8; reasons.push(`🏍️ 稀缺品类(摩托车装备)`); }
  if (catName === '汽车用品') { score += 4; reasons.push(`🚗 汽车新奇好物`); }
  if (catName === '健康与家居') { score += 3; reasons.push(`🏥 健康类好物`); }

  // 7. 子渠道加分
  if (subChannel === '热销新品' || subChannel === '最近新品') { score += 6; reasons.push(`新品渠道`); }
  if (subChannel === '高评分热销') { score += 4; }

  return { score, reasons, tags };
}

/**
 * 简单名称相似度去重：提取前20个字符做对比
 */
function nameKey(name) {
  return (name || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 40);
}

/**
 * 从候选池中精选 Top N，保证多样性
 */
function selectDiverse(candidates, topN = 10) {
  // 分类候选
  const byPlatform = {};
  const byGoodsId = new Set();
  const deduped = [];

  for (const item of candidates) {
    const id = item.product.goodsId;
    const nk = nameKey(item.product.goodsNameEn || '');

    // goodsId 去重 & 名称相似度去重
    if (byGoodsId.has(id)) continue;

    // 检查是否与已选商品名称高度相似
    const isDup = deduped.some(d => {
      const dnk = nameKey(d.product.goodsNameEn || '');
      return dnk === nk;
    });
    if (isDup) continue;

    byGoodsId.add(id);
    deduped.push(item);
  }

  console.log(`[筛选] 去重后: ${deduped.length} 个唯一商品`);

  // 排序
  deduped.sort((a, b) => b.score - a.score);

  // 多样性选择
  const selected = [];
  const platformCount = {};
  const catCount = {};
  const MAX_PER_PLATFORM = 3;
  const MAX_PER_CAT = 3;

  for (const item of deduped) {
    const pf = item.platform;
    const cat = item.catName;
    const pfCnt = platformCount[pf] || 0;
    const catCnt = catCount[cat] || 0;

    if (pfCnt < MAX_PER_PLATFORM && catCnt < MAX_PER_CAT) {
      selected.push(item);
      platformCount[pf] = pfCnt + 1;
      catCount[cat] = catCnt + 1;
    }

    if (selected.length >= topN) break;
  }

  // 补足
  if (selected.length < topN) {
    for (const item of deduped) {
      if (!selected.includes(item)) {
        selected.push(item);
        if (selected.length >= topN) break;
      }
    }
  }

  return selected;
}

// ============================================
// 生成 Markdown 文件
// ============================================

function generateProductMd(item, index) {
  const p = item.product;
  const id = `2026-05-05-${String(index + 1).padStart(3, '0')}`;

  const priceStr = p.goodsPriceMax
    ? `$${p.goodsPriceMin} - $${p.goodsPriceMax}`
    : `$${p.goodsPriceMin || '?'}`;

  const detailUrl = (() => {
    switch (item.platform) {
      case 'temu': return p.goodsId ? `https://www.temu.com/goods_id=${p.goodsId}` : null;
      case 'shein': return p.goodsId ? `https://www.shein.com/product-p-${p.goodsId}.html` : null;
      case 'amazon': return p.goodsId ? `https://www.amazon.com/dp/${p.goodsId}` : null;
      case 'sumaitong': return p.goodsId ? `https://www.aliexpress.com/item/${p.goodsId}.html` : null;
      case 'tiktok': return p.goodsId ? `https://www.tiktok.com/product/${p.goodsId}` : null;
      default: return null;
    }
  })();

  const reasonsText = item.reasons.length > 0
    ? item.reasons.map(r => `- ${r}`).join('\n')
    : '- 综合评分较优';

  const tagsText = (item.tags || []).map(t => {
    const map = { hot: '🔥热销', trusted: '⭐口碑', novel: '✨新奇', bargain: '💰好价', new: '🆕新品' };
    return map[t] || t;
  }).join(' ');

  return {
    id,
    content: `# ${id} | ${((p.goodsNameEn || '').substring(0, 80))}

## 基本信息

| 属性 | 值 |
|------|-----|
| **商品ID** | ${id} |
| **平台** | ${item.platformName} |
| **类目** | ${item.catName} |
| **采集渠道** | ${item.subChannel} |
| **评分** | ${item.score} 分 |
| **标签** | ${tagsText || '(无)'} |

## 商品详情

| 属性 | 值 |
|------|-----|
| **商品名称(英)** | ${p.goodsNameEn || '(无)'} |
| **商品名称(中)** | ${p.goodsNameCn || '(无)'} |
| **价格** | ${priceStr} |
| **销量** | ${p.sold || 0} |
| **评论数** | ${p.reviewNum || 0} |
| **评分** | ${p.rating || 'N/A'} |
| **上架时间** | ${p.onSaleTime || '未知'} |
| **平台商品ID** | ${p.goodsId || '(无)'} |
| **商品链接** | ${detailUrl || '(暂无)'} |
| **缩略图** | ${p.thumbnail || '(无)'} |

## 选品理由

${reasonsText}

## 看点分析

商品名称中的亮点关键词说明该商品具有较好的市场吸引力。${item.score >= 70 ? '高评分表示该商品在销量、口碑、新奇度等方面综合表现突出，值得关注。' : '综合表现良好，有一定市场潜力。'}

---
*由 Selector 自动筛选生成 | ${new Date().toISOString()}*
`
  };
}

function generateSummaryMd(selected) {
  let md = `# 选品筛选报告 - 2026-05-05 (第3轮)\n\n`;
  md += `## 概述\n\n`;
  md += `- 采集来源：5平台 × 4渠道 × Top10\n`;
  md += `- 筛选标准：新奇、有趣、好玩、有爆点\n`;
  md += `- 入选数量：${selected.length}个\n`;
  md += `- 采集时间：${new Date().toISOString()}\n\n`;

  md += `## 本次采集类目\n\n`;
  md += `| 平台 | 类目 | CatID | 候选数 |\n`;
  md += `|------|------|-------|--------|\n`;
  const catSummary = {};
  for (const item of selected) {
    const key = `${item.platformName}|${item.catName}`;
    catSummary[key] = (catSummary[key] || 0) + 1;
  }

  const allCats = [...new Set(selected.map(s => `${s.platformName}|${s.catName}|${s.catId}`))];
  for (const cat of allCats) {
    const [pf, cn, id] = cat.split('|');
    md += `| ${pf} | ${cn} | ${id} | ${catSummary[`${pf}|${cn}`]} |\n`;
  }

  md += `\n## 入选商品\n\n`;
  for (let i = 0; i < selected.length; i++) {
    const item = selected[i];
    const p = item.product;
    const nameEn = (p.goodsNameEn || '').substring(0, 80);
    const priceStr = p.goodsPriceMax ? `$${p.goodsPriceMin}~$${p.goodsPriceMax}` : `$${p.goodsPriceMin || '?'}`;

    md += `\n### ${i + 1}. ${nameEn}\n`;
    md += `- **编号**: 2026-05-05-${String(i + 1).padStart(3, '0')}\n`;
    md += `- **平台**: ${item.platformName}\n`;
    md += `- **类目**: ${item.catName}\n`;
    md += `- **渠道**: ${item.subChannel}\n`;
    md += `- **价格**: ${priceStr}\n`;
    md += `- **销量**: ${(p.sold || 0).toLocaleString()}\n`;
    md += `- **评分**: ${item.score}分\n`;
    md += `- **选品理由**: ${item.reasons.join('; ')}\n`;
  }

  md += `\n---\n*Generated by Selector - ${new Date().toISOString()}*\n`;
  return md;
}

// ============================================
// 更新 crawl_state
// ============================================

function updateCrawlState() {
  const stateFile = path.join(__dirname, 'crawl_state.js');
  let content = fs.readFileSync(stateFile, 'utf-8');

  const now = new Date().toISOString();

  // 更新本次采集的 5 个类目的 lastCrawled
  const updates = [
    { platform: 'temu', catId: 19858 },
    { platform: 'shein', catId: 2297 },
    { platform: 'amazon', catId: 3760901 },
    { platform: 'sumaitong', catId: 201355758 },
    { platform: 'tiktok', catId: 601152 }
  ];

  for (const up of updates) {
    // 在 content 中匹配类似 "catId": 19858, 后面跟着 "lastCrawled": "old-date"
    const regex = new RegExp(
      `("catId":\\s*${up.catId},[^}]*?"lastCrawled"):\\s*"[^"]*"`,
      's'
    );
    content = content.replace(regex, `$1: "${now}"`);
  }

  // 更新全局 lastUpdated
  content = content.replace(
    /"lastUpdated":\s*"[^"]*"/,
    `"lastUpdated": "${now}"`
  );

  fs.writeFileSync(stateFile, content, 'utf-8');
  console.log(`[状态] crawl_state.js 已更新 (${now})`);
}

// ============================================
// 主流程
// ============================================

function main() {
  // 读取原始候选数据
  const raw = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
  console.log(`[读取] 原始候选: ${raw.length} 个\n`);

  // 重新评分
  for (const item of raw) {
    const { score, reasons, tags } = scoreProduct(
      item.product, item.platform, item.catName, item.subChannel
    );
    item.score = score;
    item.reasons = reasons;
    item.tags = tags;
  }

  // 展示评分分布
  const scoreDist = {};
  for (const item of raw) {
    const bucket = Math.floor(item.score / 10) * 10;
    scoreDist[bucket] = (scoreDist[bucket] || 0) + 1;
  }
  console.log('[评分分布]');
  Object.keys(scoreDist).sort((a, b) => +b - +a).forEach(b => {
    console.log(`  ${b}-${+b + 9}分: ${scoreDist[b]} 个`);
  });

  // 精选
  const top10 = selectDiverse(raw, 10);

  console.log(`\n========== 精选 Top ${top10.length} 商品 ==========`);
  top10.forEach((item, i) => {
    const p = item.product;
    const priceStr = p.goodsPriceMax ? `$${p.goodsPriceMin}~$${p.goodsPriceMax}` : `$${p.goodsPriceMin || '?'}`;
    console.log(`\n${i + 1}. [${item.platformName}] ${item.catName} | 得分: ${item.score}`);
    console.log(`   商品: ${(p.goodsNameEn || '').substring(0, 80)}`);
    console.log(`   销量: ${p.sold} | 价格: ${priceStr} | 评论: ${p.reviewNum} | 评分: ${p.rating}`);
    console.log(`   渠道: ${item.subChannel}`);
    console.log(`   标签: ${(item.tags || []).join(', ')}`);
    console.log(`   理由: ${item.reasons.join('; ')}`);
  });

  // 生成 Markdown 文件
  console.log(`\n[生成] 创建 markdown 文件...`);

  const outputDir = path.join(__dirname, '2026-05-05');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  for (let i = 0; i < top10.length; i++) {
    const { id, content } = generateProductMd(top10[i], i);
    const filePath = path.join(__dirname, `${id}.md`);
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`  ✓ ${id}.md`);
  }

  // 生成汇总报告
  const summaryMd = generateSummaryMd(top10);
  const summaryPath = path.join(outputDir, 'selection_report_2026-05-05.md');
  fs.writeFileSync(summaryPath, summaryMd, 'utf-8');
  console.log(`  ✓ 汇总报告: ${summaryPath}`);

  // 更新 crawl_state
  updateCrawlState();

  // 保存精选结果 JSON
  const selectedPath = path.join(__dirname, 'selected_latest.json');
  fs.writeFileSync(selectedPath, JSON.stringify(top10.map((item, i) => ({
    rank: i + 1,
    id: `2026-05-05-${String(i + 1).padStart(3, '0')}`,
    platform: item.platformName,
    catName: item.catName,
    score: item.score,
    nameEn: (item.product.goodsNameEn || '').substring(0, 100),
    sold: item.product.sold,
    priceMin: item.product.goodsPriceMin,
    priceMax: item.product.goodsPriceMax,
    reviewNum: item.product.reviewNum,
    rating: item.product.rating,
    goodsId: item.product.goodsId,
    thumbnail: item.product.thumbnail,
    reasons: item.reasons,
    tags: item.tags || []
  })), null, 2), 'utf-8');
  console.log(`  ✓ selected_latest.json`);

  console.log(`\n[完成] 选品任务完成!`);
}

main();
