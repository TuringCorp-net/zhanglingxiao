/**
 * 选品采集脚本 - 定时任务执行入口
 *
 * 工作流程：
 * 1. 从 crawl_state.js 读取状态，找出每个平台最久未采集的类目
 * 2. 使用 jjy_api.js 执行采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 3. 落盘到 operations/selected/dailytemp/YYYY-MM-DD/
 * 4. Selector 按"新奇/有趣/好玩/有爆点"筛选
 * 5. 入选商品写入 operations/selected/ 目录
 * 6. 更新 crawl_state.js 的 lastCrawled 时间
 */

const fs = require('fs');
const path = require('path');
const crawlState = require('./crawl_state.js');
const JJYAPITool = require('../tools/jjy_api.js');

// 今日日期
const TODAY = new Date().toISOString().split('T')[0];

// 子渠道列表（4个）
const CHANNELS = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

/**
 * 找出每个平台最久未采集的类目
 */
function findOldestCategories(state) {
  const results = [];

  for (const [platformKey, platformData] of Object.entries(state.platforms)) {
    let oldestCat = null;
    let oldestTime = null;

    for (const cat of platformData.categories) {
      // null 表示从未采集，优先级最高
      if (cat.lastCrawled === null) {
        oldestCat = cat;
        oldestTime = null;
        break; // 优先选择从未采集的
      }

      const catTime = new Date(cat.lastCrawled);
      if (!oldestTime || catTime < oldestTime) {
        oldestTime = catTime;
        oldestCat = cat;
      }
    }

    if (oldestCat) {
      results.push({
        platform: platformKey,
        platformName: platformData.name,
        sort: platformData.sort,
        siteId: platformData.siteId,
        catId: oldestCat.catId,
        catName: oldestCat.catName,
        lastCrawled: oldestCat.lastCrawled
      });
    }
  }

  return results;
}

/**
 * 执行采集
 */
async function runCrawl() {
  const jjyApi = new JJYAPITool();

  console.log('========== 选品采集开始 ==========');
  console.log(`日期: ${TODAY}\n`);

  // 1. 找出每个平台最久未采集的类目
  const targetCategories = findOldestCategories(crawlState);
  console.log('目标类目:');
  targetCategories.forEach(c => {
    console.log(`  ${c.platformName}: ${c.catName} (catId=${c.catId}, 上次采集=${c.lastCrawled || '从未'})`);
  });
  console.log('');

  // 2. 执行采集
  const allProducts = [];

  for (const target of targetCategories) {
    console.log(`\n>>> 采集 ${target.platformName} - ${target.catName}`);
    console.log(`    平台: ${target.platform}, 类目ID: ${target.catId}`);

    for (const channel of CHANNELS) {
      console.log(`    - ${channel.name}...`);

      try {
        // 使用 jjy_api 搜索
        const result = await jjyApi.search({
          keyword: '',
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort,
          page: 1,
          size: 10
        });

        if (result.success && result.products.length > 0) {
          console.log(`      获取到 ${result.products.length} 个商品`);

          // 为每个商品添加平台和渠道信息
          for (const p of result.products) {
            allProducts.push({
              ...p,
              platform: target.platform,
              channel: channel.name,
              catName: target.catName,
              catId: target.catId
            });
          }
        } else {
          console.log(`      获取失败: ${result.error || '无数据'}`);
        }
      } catch (e) {
        console.log(`      错误: ${e.message}`);
      }
    }
  }

  console.log(`\n共采集到 ${allProducts.length} 个商品`);
  return allProducts;
}

/**
 * 保存原始数据到 dailytemp
 */
async function saveRawData(results) {
  const dataDir = path.join(__dirname, 'dailytemp', TODAY);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const rawFile = path.join(dataDir, 'raw_data.json');
  fs.writeFileSync(rawFile, JSON.stringify(results, null, 2));
  console.log(`[保存] 原始数据 -> ${rawFile}`);
}

/**
 * 选品筛选 - 按新奇/有趣/好玩/有爆点选择
 */
function selectProducts(results) {
  console.log('\n========== 开始选品筛选 ==========');
  console.log(`待筛选商品: ${results.length} 个`);

  // 按goodsId去重，保留第一个
  const seen = new Set();
  const uniqueResults = results.filter(p => {
    if (!p.goodsId) return true; // 没有goodsId的保留
    if (seen.has(p.goodsId)) return false;
    seen.add(p.goodsId);
    return true;
  });

  console.log(`去重后: ${uniqueResults.length} 个`);

  // 评分标准
  const noveltyKeywords = [
    'fun', 'cool', 'cute', 'novelty', 'unique', 'quirky', 'creative', 'magic',
    'surprise', 'gift', 'DIY', 'kit', 'game', 'toy', 'led', 'light',
    'wireless', 'smart', 'mini', 'portable', 'kawaii', 'anime', 'vintage',
    'retro', 'crazy', 'weird', 'strange', 'party', 'christmas', 'festival',
    'transform', 'fantasy', 'dream', 'crystal', 'glow', 'rainbow',
    'robot', 'drone', '3d', 'hologram', 'interactive', 'sensor'
  ];

  const scored = uniqueResults.map((p, idx) => {
    let score = 0;
    const name = (p.goodsNameEn || '').toLowerCase();
    const cnName = (p.goodsNameCn || '').toLowerCase();

    // 1. 新奇/有趣/好玩关键词匹配 (35%)
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

    // 4. 新品潜力 (15%) - 评论少但销量高
    const reviewRatio = (p.reviewNum || 0) / Math.max(sold, 1);
    if (reviewRatio < 0.001 && sold > 500) score += 15;
    else if (reviewRatio < 0.005 && sold > 200) score += 10;
    else if (reviewRatio < 0.01) score += 5;

    return { ...p, _score: score, _index: idx };
  });

  // 按分数排序
  scored.sort((a, b) => b._score - a._score);

  const top15 = scored.slice(0, 15);

  // 平台多样性：选择10个不同平台的商品
  const selected = [];
  const usedPlatforms = new Set();

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
    console.log(`${i + 1}. [${p.platform}/${p.channel}] ${(p.goodsNameEn || '').substring(0, 35)}...`);
    console.log(`   销量: ${p.sold}, 价格: $${p.goodsPriceMin || 0}-${p.goodsPriceMax || 0}, 评分: ${p._score.toFixed(1)}`);
  });

  return selected;
}

/**
 * 生成商品markdown文件
 */
function generateProductFiles(selectedProducts) {
  console.log('\n========== 生成商品文件 ==========');
  const selectedDir = path.join(__dirname);

  selectedProducts.forEach((p, idx) => {
    const fileNum = String(idx + 1).padStart(3, '0');
    const fileName = `${TODAY.replace(/-/g, '')}-${fileNum}.md`;
    const filePath = path.join(selectedDir, fileName);

    const content = `# 商品选品报告

## 基本信息
- **采集编号**: ${TODAY.replace(/-/g, '')}-${fileNum}
- **平台**: ${p.platform}
- **类目**: ${p.catName} > ${p.channel}
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

/**
 * 更新 crawl_state.js
 */
function updateCrawlState(targetCategories) {
  const stateFile = path.join(__dirname, 'crawl_state.js');
  const now = new Date().toISOString();

  // 读取状态文件，手动重建以避免破坏文件结构
  const stateContent = fs.readFileSync(stateFile, 'utf8');

  // 使用更安全的替换方式：直接替换每个平台特定的 catId 行
  const lines = stateContent.split('\n');

  for (const target of targetCategories) {
    const catIdStr = target.catId.toString();

    // 查找包含特定 catId 的行并替换其中的 lastCrawled 值
    // 格式: { catId: 9711, catName: "家居、厨房用品", lastCrawled: null },
    let updated = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // 检查这行是否包含目标 catId
      if (line.includes(`catId: ${catIdStr}`) || line.includes(`catId: ${catIdStr},`)) {
        // 替换 lastCrawled 的值（可能是 null 或之前的日期）
        const updatedLine = line.replace(
          /lastCrawled:\s*(null|"[^"]*")/,
          `lastCrawled: "${now}"`
        );
        if (updatedLine !== line) {
          lines[i] = updatedLine;
          updated = true;
          console.log(`[更新] ${target.platformName} catId=${target.catId} -> lastCrawled: ${now}`);
        }
        break;
      }
    }

    if (!updated) {
      console.log(`[警告] 未找到 ${target.platformName} catId=${target.catId}`);
    }
  }

  // 更新 lastUpdated 行
  const finalContent = lines.join('\n').replace(
    /lastUpdated:\s*"[^"]*"/,
    `lastUpdated: "${now}"`
  );

  fs.writeFileSync(stateFile, finalContent);
  console.log(`[完成] crawl_state.js 更新`);
}

/**
 * 主流程
 */
async function main() {
  try {
    // 1. 找出目标类目
    const targetCategories = findOldestCategories(crawlState);

    // 2. 执行采集
    const results = await runCrawl();

    // 3. 保存原始数据
    await saveRawData(results);

    // 4. 筛选商品
    const selectedProducts = selectProducts(results);

    // 5. 生成商品文件
    generateProductFiles(selectedProducts);

    // 6. 更新 crawl_state
    updateCrawlState(targetCategories);

    console.log('\n========== 处理完成 ==========');
  } catch (e) {
    console.error('执行出错:', e);
  }
}

main();