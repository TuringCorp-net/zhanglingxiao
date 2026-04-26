/**
 * 选品处理脚本 - 保存数据并执行筛选
 */
const fs = require('fs');
const path = require('path');
const { runCrawl } = require('./crawl_runner.js');

// 今日日期
const TODAY = '2026-04-26';

// 保存原始数据
async function saveRawData(results) {
  const dataDir = path.join(__dirname, 'dailytemp', TODAY);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const rawFile = path.join(dataDir, 'raw_data.json');
  fs.writeFileSync(rawFile, JSON.stringify(results, null, 2));
  console.log(`[保存] 原始数据 -> ${rawFile}`);
}

// 选品筛选 - 按新奇/有趣/好玩/有爆点选择（去重版本）
function selectProducts(results) {
  console.log('\n========== 开始选品筛选 ==========');
  console.log(`待筛选商品: ${results.length} 个`);

  // 评分标准
  // 1. 销量高 - 有市场验证 (40%)
  // 2. 价格适中 - 有利润空间 (20%)
  // 3. 产品名有新奇/有趣/好玩关键词 (30%)
  // 4. 评论少但销量高 - 可能是新品爆款 (10%)

  const keywords = [
    'fun', 'cool', 'cute', 'novelty', 'unique', 'interesting', 'quirky', 'creative',
    'magic', 'surprise', 'gift', 'DIY', 'kit', 'set', 'game', 'toy',
    'led', 'light', 'wireless', 'smart', 'mini', 'portable',
    'kawaii', 'anime', 'vintage', 'retro', 'crazy', 'weird', 'strange',
    'new', 'latest', 'trending', 'popular', 'bestseller', 'hot',
    'kids', 'children', 'baby', 'family', 'party', 'christmas',
    'home', 'kitchen', 'office', 'travel', 'outdoor', 'fitness',
    'style', 'fashion', 'beauty', 'glamour', 'chic'
  ];

  // 按goodsId去重，保留第一个
  const seen = new Set();
  const uniqueResults = results.filter(p => {
    if (seen.has(p.goodsId)) return false;
    seen.add(p.goodsId);
    return true;
  });

  console.log(`去重后: ${uniqueResults.length} 个`);

  const scored = uniqueResults.map((p, idx) => {
    let score = 0;
    const name = (p.goodsNameEn || '').toLowerCase();
    const cnName = (p.goodsNameCn || '').toLowerCase();

    // 1. 新奇/有趣/好玩关键词匹配 (35%) - 优先考虑
    const noveltyKeywords = [
      'fun', 'cool', 'cute', 'novelty', 'unique', 'quirky', 'creative', 'magic',
      'surprise', 'gift', 'DIY', 'kit', 'game', 'toy', 'led', 'light',
      'wireless', 'smart', 'mini', 'portable', 'kawaii', 'anime', 'vintage',
      'retro', 'crazy', 'weird', 'strange', 'party', 'christmas', 'festival',
      'transform', 'magic', 'fantasy', 'dream', 'crystal', 'glow', 'rainbow',
      'robot', 'drone', '3d', 'hologram', 'interactive', 'sensor'
    ];
    let noveltyScore = 0;
    for (const kw of noveltyKeywords) {
      if (name.includes(kw) || cnName.includes(kw)) noveltyScore += 4;
    }
    score += Math.min(35, noveltyScore);

    // 2. 销量评分 (30%) - 有市场验证但不要太大众
    const soldScore = Math.min(30, Math.log10(Math.max(p.sold || 1, 1)) * 6);
    score += soldScore;

    // 3. 价格评分 (20%) - 5-30美元最佳
    const price = p.goodsPriceMin || 0;
    if (price >= 5 && price <= 15) score += 20;
    else if (price > 15 && price <= 25) score += 15;
    else if (price > 25 && price <= 35) score += 10;
    else if (price > 0 && price < 5) score += 8;

    // 4. 新品潜力 (15%) - 评论少但销量高
    const reviewRatio = (p.reviewNum || 0) / Math.max(p.sold || 1, 1);
    if (reviewRatio < 0.001 && (p.sold || 0) > 500) score += 15;
    else if (reviewRatio < 0.005 && (p.sold || 0) > 200) score += 10;
    else if (reviewRatio < 0.01) score += 5;

    // 5. 平台多样性加成 - 优先选择不同平台的商品
    // (这个在最后选的时候处理)

    return { ...p, _score: score, _index: idx };
  });

  // 按分数排序，取前15名
  scored.sort((a, b) => b._score - a._score);

  const top15 = scored.slice(0, 15);

  // 6. 平台多样性：选择10个不同平台的商品（优先选择不同平台的）
  const selected = [];
  const usedPlatforms = new Set();

  // 先选择每个平台评分最高的（最多1个）
  for (const p of top15) {
    if (selected.length >= 10) break;
    if (!usedPlatforms.has(p.platform)) {
      selected.push(p);
      usedPlatforms.add(p.platform);
    }
  }

  // 如果不足10个，补充其他高评分商品
  if (selected.length < 10) {
    for (const p of top15) {
      if (selected.length >= 10) break;
      if (!selected.includes(p)) {
        selected.push(p);
      }
    }
  }

  console.log('\n选中的10个商品:');
  selected.forEach((p, i) => {
    console.log(`${i + 1}. [${p.platform}/${p.channel}] ${p.goodsNameEn?.substring(0, 35)}...`);
    console.log(`   销量: ${p.sold}, 价格: $${p.goodsPriceMin}-${p.goodsPriceMax}, 评分: ${p._score.toFixed(1)}`);
  });

  return selected;
}

// 生成商品markdown文件
function generateProductFiles(selectedProducts) {
  console.log('\n========== 生成商品文件 ==========');
  const selectedDir = path.join(__dirname);

  selectedProducts.forEach((p, idx) => {
    // 生成文件名: YYYYMMDD-XXX.md
    const fileNum = String(idx + 1).padStart(3, '0');
    const fileName = `${TODAY.replace(/-/g, '')}-${fileNum}.md`;
    const filePath = path.join(selectedDir, fileName);

    const content = `# 商品选品报告

## 基本信息
- **采集编号**: ${TODAY.replace(/-/g, '')}-${fileNum}
- **平台**: ${p.platform}
- **类目**: ${p.channel}
- **商品ID**: ${p.goodsId || 'N/A'}

## 产品信息
- **英文名**: ${p.goodsNameEn || 'N/A'}
- **中文名**: ${p.goodsNameCn || 'N/A'}

## 销售数据
- **销量**: ${p.sold || 0}
- **价格区间**: $${p.goodsPriceMin || 0} - $${p.goodsPriceMax || 0}
- **评论数**: ${p.reviewNum || 0}
- **评分**: ${p.rating || 'N/A'}

## 图片
${p.thumbnail ? `![商品图片](${p.thumbnail})` : '（无图片）'}

## 商品链接
${p.detailUrl ? `[查看详情](${p.detailUrl})` : '（无链接）'}

## 原始数据
\`\`\`json
${JSON.stringify(p, null, 2)}
\`\`\`
`;

    fs.writeFileSync(filePath, content);
    console.log(`[生成] ${fileName}`);
  });
}

// 更新crawl_state.js
function updateCrawlState() {
  const stateFile = path.join(__dirname, 'crawl_state.js');
  let stateContent = fs.readFileSync(stateFile, 'utf8');
  const now = new Date().toISOString();

  // 目标类目 - 本次采集的5个平台类目
  const updates = [
    { platform: 'temu', catId: 2542 },
    { platform: 'shein', catId: 1864 },
    { platform: 'amazon', catId: 165796011 },
    { platform: 'sumaitong', catId: 15 },
    { platform: 'tiktok', catId: 951432 }
  ];

  for (const update of updates) {
    // 匹配格式: { catId: XXX, catName: "XXX", lastCrawled: "..." }
    // 需要同时匹配 catId 和 lastCrawled 字段
    const catIdPattern = update.catId.toString();
    const regex = new RegExp(
      `(\\{[\\s\\S]*?catId:\\s*${catIdPattern}[\\s\\S]*?lastCrawled:\\s*)"[^"]*"`,
      'g'
    );

    const match = stateContent.match(regex);
    if (match && match[0]) {
      stateContent = stateContent.replace(match[0], match[1] + `"${now}"`);
      console.log(`[更新] ${update.platform} catId=${update.catId} -> lastCrawled: ${now}`);
    } else {
      console.log(`[警告] 未找到 ${update.platform} catId=${update.catId}`);
    }
  }

  // 更新lastUpdated
  stateContent = stateContent.replace(
    /lastUpdated:\s*"[^"]*"/,
    `lastUpdated: "${now}"`
  );

  fs.writeFileSync(stateFile, stateContent);
  console.log(`[完成] crawl_state.js 更新`);
}

// 主流程
async function main() {
  console.log('========== 选品处理开始 ==========');
  console.log(`日期: ${TODAY}\n`);

  // 1. 执行采集
  const results = await runCrawl();
  console.log(`\n采集完成: 共 ${results.length} 个商品`);

  // 2. 保存原始数据
  await saveRawData(results);

  // 3. 筛选商品
  const selectedProducts = selectProducts(results);

  // 4. 生成商品文件
  generateProductFiles(selectedProducts);

  // 5. 更新crawl_state
  updateCrawlState();

  console.log('\n========== 处理完成 ==========');
}

main().catch(console.error);