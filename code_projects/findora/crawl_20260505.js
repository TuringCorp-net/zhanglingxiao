/**
 * 选品采集脚本 - 2026-05-05
 *
 * 目标类目（各平台最久未采集）：
 * - Temu:     美容和个人护理 (catId=18768)
 * - Shein:    工具和家居装修 (catId=4327)
 * - Amazon:   乐器 (catId=11091801)
 * - Sumaitong: 运动鞋服及包配 (catId=201768104)
 * - TikTok:   Phones & Electronics (catId=601739)
 *
 * 采集方式：每平台 × 4子渠道 × Top10 = 200个待筛选商品
 */

const fs = require('fs');
const path = require('path');
const JJYAPITool = require('./operations/tools/jjy_api.js');
const crawlState = require('./operations/selected/crawl_state.js');

const TODAY = '2026-05-05';

// 5个目标类目
const TARGETS = [
  { platform: 'temu',      catId: 18768,      catName: '美容和个人护理', sort: 'sold' },
  { platform: 'shein',     catId: 4327,       catName: '工具和家居装修', sort: 'sold' },
  { platform: 'amazon',    catId: 11091801,   catName: '乐器',          sort: 'monthSold' },
  { platform: 'sumaitong', catId: 201768104,  catName: '运动鞋服及包配', sort: 'totalSold' },
  { platform: 'tiktok',    catId: 601739,     catName: 'Phones & Electronics', sort: 'totalSold' },
];

// 4个子渠道（通过不同参数组合模拟）
const CHANNELS = [
  { name: '热销商品', extra: {} },
  { name: '热销新品', extra: { onSaleTimeStart: '2026-01-01' } },
  { name: '新店热销', extra: { priceMin: 1, priceMax: 50 } },
  { name: '大卖新品', extra: { onSaleTimeStart: '2026-01-01', priceMin: 5 } },
];

async function main() {
  const jjyApi = new JJYAPITool();
  const allProducts = [];

  console.log('========== 选品采集开始 ==========');
  console.log(`日期: ${TODAY}`);
  console.log('目标类目:');
  TARGETS.forEach(t => console.log(`  ${t.platform}: ${t.catName} (catId=${t.catId})`));
  console.log('');

  // 逐平台逐渠道采集
  for (const target of TARGETS) {
    console.log(`\n>>> 采集 ${target.platform.toUpperCase()} - ${target.catName}`);

    for (const channel of CHANNELS) {
      console.log(`    [${channel.name}] 查询中...`);

      try {
        const result = await jjyApi.search({
          keyword: '',
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort,
          page: 1,
          size: 10,
          ...channel.extra
        });

        if (result.success && result.products.length > 0) {
          console.log(`      ✓ 获取 ${result.products.length} 个商品`);
          for (const p of result.products) {
            allProducts.push({
              ...p,
              _platform: target.platform,
              _channel: channel.name,
              _catName: target.catName,
              _catId: target.catId
            });
          }
        } else {
          console.log(`      ✗ 失败: ${result.error || '无数据'}`);
        }
      } catch (e) {
        console.log(`      ✗ 错误: ${e.message}`);
      }
    }
  }

  console.log(`\n========== 采集完成: 共 ${allProducts.length} 个商品 ==========`);

  // 保存原始数据
  const dataDir = path.join(__dirname, 'operations', 'selected', 'dailytemp', TODAY);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const rawFile = path.join(dataDir, 'raw_products.json');
  fs.writeFileSync(rawFile, JSON.stringify(allProducts, null, 2));
  console.log(`[保存] 原始数据 -> ${rawFile}`);

  // 选品筛选
  console.log('\n========== 开始选品筛选 ==========');
  console.log(`待筛选: ${allProducts.length} 个`);

  // 去重
  const seen = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (!p.goodsId) return true;
    if (seen.has(p.goodsId)) return false;
    seen.add(p.goodsId);
    return true;
  });
  console.log(`去重后: ${uniqueProducts.length} 个`);

  // 评分
  const noveltyKeywords = [
    'fun', 'cool', 'cute', 'novelty', 'unique', 'quirky', 'creative', 'magic',
    'surprise', 'gift', 'DIY', 'kit', 'game', 'toy', 'led', 'light',
    'wireless', 'smart', 'mini', 'portable', 'kawaii', 'anime', 'vintage',
    'retro', 'crazy', 'weird', 'strange', 'party', 'festival',
    'transform', 'fantasy', 'dream', 'crystal', 'glow', 'rainbow',
    'robot', 'drone', '3d', 'hologram', 'interactive', 'sensor',
    'beauty', 'makeup', 'nail', 'hair', 'skin', 'spa', 'massage',
    'tool', 'gadget', 'phone', 'case', 'charger', 'earphone', 'earbud',
    'musical', 'instrument', 'guitar', 'piano', 'drum', 'violin',
    'shoe', 'sneaker', 'sport', 'running', 'fitness', 'yoga'
  ];

  const scored = uniqueProducts.map((p, idx) => {
    let score = 0;
    const name = (p.goodsNameEn || '').toLowerCase();
    const cnName = (p.goodsNameCn || '').toLowerCase();

    // 1. 新奇/有趣关键词匹配 (35%)
    let noveltyScore = 0;
    for (const kw of noveltyKeywords) {
      if (name.includes(kw) || cnName.includes(kw)) noveltyScore += 4;
    }
    score += Math.min(35, noveltyScore);

    // 2. 销量评分 (30%)
    const sold = p.sold || 0;
    const soldScore = Math.min(30, Math.log10(Math.max(sold, 1)) * 6);
    score += soldScore;

    // 3. 价格评分 (20%) - 5-30美元最佳
    const price = p.goodsPriceMin || 0;
    if (price >= 5 && price <= 15) score += 20;
    else if (price > 15 && price <= 25) score += 15;
    else if (price > 25 && price <= 35) score += 10;
    else if (price > 0 && price < 5) score += 8;

    // 4. 新品潜力 (15%)
    const reviewRatio = (p.reviewNum || 0) / Math.max(sold, 1);
    if (reviewRatio < 0.001 && sold > 500) score += 15;
    else if (reviewRatio < 0.005 && sold > 200) score += 10;
    else if (reviewRatio < 0.01) score += 5;

    return { ...p, _score: score, _index: idx };
  });

  // 按分数排序
  scored.sort((a, b) => b._score - a._score);

  // 平台多样性：每个平台选 Top2（确保10个覆盖5平台）
  const selected = [];
  const platformCount = {};
  const platformPicks = {};

  for (const p of scored) {
    const plat = p._platform;
    if (!platformCount[plat]) platformCount[plat] = 0;

    if (platformCount[plat] < 2 && selected.length < 10) {
      selected.push(p);
      platformCount[plat]++;
      if (!platformPicks[plat]) platformPicks[plat] = [];
      platformPicks[plat].push(p);
    }
    if (selected.length >= 10) break;
  }

  // 如果不足10个，从剩余高分中补充
  if (selected.length < 10) {
    for (const p of scored) {
      if (selected.length >= 10) break;
      if (!selected.includes(p)) {
        selected.push(p);
      }
    }
  }

  console.log(`\n选中的 ${selected.length} 个商品:`);
  selected.forEach((p, i) => {
    const name = (p.goodsNameEn || '').substring(0, 50);
    console.log(`${i + 1}. [${p._platform}/${p._channel}] ${name}`);
    console.log(`   销量: ${p.sold}, 价格: $${p.goodsPriceMin || 0}-${p.goodsPriceMax || 0}, 评分: ${p._score.toFixed(1)}`);
  });

  // 保存筛选结果
  const selectedFile = path.join(dataDir, 'selected_products.json');
  fs.writeFileSync(selectedFile, JSON.stringify(selected, null, 2));

  // 生成商品Markdown文件
  console.log('\n========== 生成商品文件 ==========');
  const selectedDir = path.join(__dirname, 'operations', 'selected');

  selected.forEach((p, idx) => {
    const fileNum = String(idx + 1).padStart(3, '0');
    const fileName = `${TODAY.replace(/-/g, '')}-${fileNum}.md`;
    const filePath = path.join(selectedDir, fileName);

    const content = `# 商品选品报告

## 基本信息
- **采集编号**: ${TODAY.replace(/-/g, '')}-${fileNum}
- **日期**: ${TODAY}
- **平台**: ${p._platform}
- **类目**: ${p._catName} > ${p._channel}
- **商品ID**: ${p.goodsId || 'N/A'}

## 产品信息
- **英文名**: ${p.goodsNameEn || 'N/A'}
- **中文名**: ${p.goodsNameCn || 'N/A'}

## 销售数据
- **销量**: ${p.sold || 0}
- **价格区间**: $${p.goodsPriceMin || 0} - $${p.goodsPriceMax || 0}
- **评论数**: ${p.reviewNum || 0}
- **评分**: ${p.rating || 'N/A'}
${p.sales ? `- **销售额**: ${p.sales}` : ''}

## 图片
${p.thumbnail ? `![商品图片](${p.thumbnail})` : '（无图片）'}

## 商品链接
${p.detailUrl ? `[查看详情](${p.detailUrl})` : '（无链接）'}

## 选品评分
- **综合评分**: ${p._score.toFixed(1)}/100
- **平台**: ${p._platform}
- **渠道**: ${p._channel}

## 原始数据
\`\`\`json
${JSON.stringify(p, null, 2)}
\`\`\`
`;

    fs.writeFileSync(filePath, content);
    console.log(`[生成] ${fileName}`);
  });

  // 更新 crawl_state.js
  console.log('\n========== 更新 crawl_state.js ==========');
  const stateFile = path.join(__dirname, 'operations', 'selected', 'crawl_state.js');
  let stateContent = fs.readFileSync(stateFile, 'utf8');
  const now = new Date().toISOString();

  for (const target of TARGETS) {
    const catIdStr = target.catId.toString();
    const lines = stateContent.split('\n');
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes(`catId: ${catIdStr}`) || line.includes(`catId: ${catIdStr},`)) {
        const updatedLine = line.replace(
          /lastCrawled:\s*(null|"[^"]*")/,
          `lastCrawled: "${now}"`
        );
        if (updatedLine !== line) {
          lines[i] = updatedLine;
          updated = true;
          console.log(`[更新] ${target.platform} catId=${target.catId} -> lastCrawled: ${now}`);
        }
        break;
      }
    }

    if (updated) {
      stateContent = lines.join('\n');
    } else {
      console.log(`[警告] 未找到 ${target.platform} catId=${target.catId}`);
    }
  }

  // 更新 lastUpdated
  stateContent = stateContent.replace(
    /lastUpdated:\s*"[^"]*"/,
    `lastUpdated: "${now}"`
  );

  fs.writeFileSync(stateFile, stateContent);
  console.log(`[完成] crawl_state.js 已更新`);

  console.log('\n========== 全部完成 ==========');
  console.log(`生成文件: ${selected.length} 个Markdown + 原始数据`);
}

main().catch(err => {
  console.error('执行出错:', err);
  process.exit(1);
});
