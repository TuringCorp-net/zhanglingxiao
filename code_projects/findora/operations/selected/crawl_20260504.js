/**
 * 选品 Agent 每日采集脚本 - 2026-05-04
 *
 * 工作流程：
 * 1. 从 crawl_state 读取状态，按 lastCrawled 排序
 * 2. 每平台选1个"最久未采集"的类目 → 共5个
 * 3. 使用 jjy_api.js 执行采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 4. 落盘到 dailytemp/2026-05-04/
 * 5. Selector 按"新奇/有趣/好玩/有爆点"筛选
 * 6. 入选商品写入 selected/ 目录
 * 7. 更新 crawl_state 的 lastCrawled 时间
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 今天日期
const today = '2026-05-04';
const dateStr = today.replace(/-/g, ''); // 20260504

// 输出目录
const outputDir = path.join(__dirname, 'dailytemp', today);
const selectedDir = __dirname;

// 确保目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 加载 crawl_state
const crawlState = require('./crawl_state.js');

/**
 * 找出每个平台最久未采集的类目
 */
function findOldestCategories(state) {
  const result = {};

  for (const [platformKey, platformData] of Object.entries(state.platforms)) {
    const categories = platformData.categories || [];

    // 过滤掉 lastCrawled 为 null 的类目
    const validCats = categories.filter(c => c.lastCrawled !== null);

    if (validCats.length === 0) continue;

    // 按 lastCrawled 升序排序（最老的在前）
    validCats.sort((a, b) => new Date(a.lastCrawled) - new Date(b.lastCrawled));

    // 取最久未采集的那个
    const oldest = validCats[0];
    result[platformKey] = {
      platformName: platformData.name,
      catId: oldest.catId,
      catName: oldest.catName,
      lastCrawled: oldest.lastCrawled
    };
  }

  return result;
}

/**
 * 4个子渠道的关键词
 */
const subChannels = [
  { name: '热销商品', keyword: '' },
  { name: '热销新品', keyword: '' },
  { name: '新店热销', keyword: '' },
  { name: '大卖新品', keyword: '' }
];

/**
 * 主采集函数
 */
async function run() {
  console.log('='.repeat(60));
  console.log(`[选品采集] 开始执行 - ${today}`);
  console.log('='.repeat(60));

  const jjyApi = new JJYAPITool();
  await jjyApi.init();

  // 找出每个平台最久未采集的类目
  const targetCategories = findOldestCategories(crawlState);
  console.log('\n[目标类目]');
  for (const [platform, info] of Object.entries(targetCategories)) {
    console.log(`  ${platform}: ${info.catName} (lastCrawled: ${info.lastCrawled})`);
  }

  // 存储所有采集到的商品
  const allProducts = [];
  const crawlStatus = {};
  const errors = [];

  // 遍历每个平台
  for (const [platformKey, target] of Object.entries(targetCategories)) {
    console.log(`\n[采集中] ${platformKey} - ${target.catName}`);

    const platformProducts = [];
    const now = new Date().toISOString();

    // 遍历4个子渠道
    for (const channel of subChannels) {
      try {
        console.log(`  → ${channel.name}...`);

        const result = await jjyApi.search({
          platform: platformKey,
          categoryId: target.catId,
          size: 10,
          sort: platformKey === 'amazon' ? 'monthSold' : 'sold'
        });

        if (result.success && result.products.length > 0) {
          // 添加来源信息
          result.products.forEach(p => {
            p._source = {
              platform: platformKey,
              platformName: target.platformName,
              catId: target.catId,
              catName: target.catName,
              channel: channel.name,
              crawlTime: now
            };
          });

          platformProducts.push(...result.products);
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`    ✗ 无数据: ${result.error || '空结果'}`);
          errors.push({
            platform: platformKey,
            catName: target.catName,
            channel: channel.name,
            error: result.error || '空结果'
          });
        }

        // 稍微延迟，避免请求过快
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`    ✗ 错误: ${e.message}`);
        errors.push({
          platform: platformKey,
          catName: target.catName,
          channel: channel.name,
          error: e.message
        });
      }
    }

    // 记录该平台已采集
    crawlStatus[platformKey] = {
      catId: target.catId,
      catName: target.catName,
      productsCount: platformProducts.length,
      lastCrawled: now
    };

    allProducts.push(...platformProducts);
    console.log(`  → ${platformKey} 本次共采集 ${platformProducts.length} 个商品`);
  }

  // 保存原始数据
  const rawFile = path.join(outputDir, `raw_products_${dateStr}.json`);
  fs.writeFileSync(rawFile, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`\n[保存] 原始数据 → ${rawFile}`);

  console.log(`\n[统计] 共采集 ${allProducts.length} 个商品`);
  if (errors.length > 0) {
    console.log(`[错误] ${errors.length} 个渠道采集失败`);
    errors.forEach(e => console.log(`  - ${e.platform}/${e.catName}/${e.channel}: ${e.error}`));
  }

  // 执行选品筛选
  console.log('\n' + '='.repeat(60));
  console.log('[选品筛选] 开始筛选 - "新奇/有趣/好玩/有爆点"');
  console.log('='.repeat(60));

  const selectedProducts = filterProducts(allProducts);

  console.log(`\n[筛选结果] 选出 ${selectedProducts.length} 个商品`);
  selectedProducts.forEach((p, i) => {
    console.log(`${i + 1}. [${p._source.platform}] ${p.goodsNameEn?.substring(0, 50)}`);
  });

  // 保存筛选结果
  const selectedFile = path.join(outputDir, `selected_${dateStr}.json`);
  fs.writeFileSync(selectedFile, JSON.stringify(selectedProducts, null, 2), 'utf-8');
  console.log(`\n[保存] 筛选结果 → ${selectedFile}`);

  // 生成 md 文档
  await generateMarkdownFiles(selectedProducts, dateStr);

  // 更新 crawl_state
  updateCrawlState(crawlStatus);

  console.log('\n' + '='.repeat(60));
  console.log('[完成] 选品采集任务完成');
  console.log('='.repeat(60));
}

/**
 * 选品筛选逻辑
 * 按照"新奇/有趣/好玩/有爆点"的标准
 */
function filterProducts(products) {
  // 评分和销量阈值
  const minRating = 4.0;
  const minSold = 100;

  // 关键词权重评分
  const positiveKeywords = [
    'fun', 'cute', 'unique', 'creative', 'weird', 'strange', 'bizarre',
    'novelty', 'quirky', 'interesting', 'cool', 'awesome', 'amazing',
    'surprise', 'gift', 'decor', 'decorative', 'party', 'holiday',
    'magic', 'light', 'led', 'rgb', 'colorful', 'crazy', 'funny',
    'prank', 'joke', 'riddle', 'puzzle', 'game', 'toy', 'kid',
    'pet', 'animal', 'cute', 'kawaii', 'sweet', 'lovely', 'adorable',
    'transform', 'multifunction', '2in1', '3in1', 'portable', 'mini',
    'gadget', 'device', 'smart', 'electronic', 'tech', 'innovative'
  ];

  const negativeKeywords = [
    'bulk', 'wholesale', 'case', 'replacement', 'part', 'accessory',
    'cable', 'charger', 'adapter', 'converter', 'connector', 'socket'
  ];

  // 计算商品评分
  const scoredProducts = products.map(p => {
    let score = 0;
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();

    // 基础分数：评分 + 销量对数
    score += (p.rating || 0) * 2;
    score += Math.log10(Math.max(p.sold || 1, 1)) * 3;

    // 关键词加分
    for (const kw of positiveKeywords) {
      if (name.includes(kw)) score += 5;
    }

    // 关键词减分
    for (const kw of negativeKeywords) {
      if (name.includes(kw)) score -= 10;
    }

    // 评论数适中加分（太少没参考，太多可能是普通品）
    const reviews = p.reviewNum || 0;
    if (reviews >= 10 && reviews <= 1000) score += 3;

    // 新品加分（onSaleTime 较近）
    if (p.onSaleTime) {
      const daysSinceSale = (Date.now() - new Date(p.onSaleTime).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceSale <= 30) score += 5;
      else if (daysSinceSale <= 90) score += 2;
    }

    return { ...p, _score: score };
  });

  // 按分数降序排序
  scoredProducts.sort((a, b) => b._score - a._score);

  // 过滤并取前10
  const filtered = scoredProducts
    .filter(p => p._score > 0) // 基础过滤
    .slice(0, 10);

  return filtered;
}

/**
 * 生成 markdown 文档
 */
async function generateMarkdownFiles(products, dateStr) {
  for (let i = 0; i < products.length; i++) {
    const p = products[i];
    const num = String(i + 1).padStart(3, '0');
    const fileName = `${dateStr}-${num}.md`;
    const filePath = path.join(selectedDir, fileName);

    // 解析价格
    const priceDisplay = p.goodsPriceMin && p.goodsPriceMax
      ? `$${p.goodsPriceMin} ~ $${p.goodsPriceMax}`
      : (p.goodsPriceMin ? `$${p.goodsPriceMin}` : 'N/A');

    const md = `---
title: ${p.goodsNameEn || p.goodsName || 'Unknown Product'}
platform: ${p._source.platform}
category: ${p._source.catName}
channel: ${p._source.channel}
sold: ${p.sold || 'N/A'}
rating: ${p.rating || 'N/A'}
reviewNum: ${p.reviewNum || 0}
price: ${priceDisplay}
crawlTime: ${p._source.crawlTime}
goodsId: ${p.goodsId || 'N/A'}
---

# ${p.goodsNameEn || p.goodsName || 'Unknown Product'}

## 基本信息

| 属性 | 值 |
|------|-----|
| 平台 | ${p._source.platformName} |
| 类目 | ${p._source.catName} |
| 渠道 | ${p._source.channel} |
| 商品ID | ${p.goodsId || 'N/A'} |

## 销售数据

| 指标 | 数值 |
|------|------|
| 销量 | ${p.sold || 'N/A'} |
| 评分 | ${p.rating || 'N/A'} |
| 评论数 | ${p.reviewNum || 0} |
| 价格区间 | ${priceDisplay} |

## 商品描述

${p.goodsNameCn || p.goodsNameEn || p.goodsName || '暂无描述'}

## 图片

${p.thumbnail ? `![商品图片](${p.thumbnail})` : '暂无图片'}

## 采集信息

- 采集时间: ${p._source.crawlTime}
- 数据来源: ${p._source.platform}/${p._source.catName}/${p._source.channel}
`;

    fs.writeFileSync(filePath, md, 'utf-8');
    console.log(`[保存] ${fileName}`);
  }
}

/**
 * 更新 crawl_state
 */
function updateCrawlState(crawlStatus) {
  // 读取当前 state
  const statePath = path.join(__dirname, 'crawl_state.js');
  let stateContent = fs.readFileSync(statePath, 'utf-8');

  // 更新每个平台的最久未采集类目的 lastCrawled
  for (const [platformKey, info] of Object.entries(crawlStatus)) {
    // 查找对应的类目并更新
    const regex = new RegExp(
      `("catId":\\s*${info.catId}[\\s\\S]*?"lastCrawled":\\s*")[^"]*(")`,
      'g'
    );
    stateContent = stateContent.replace(
      regex,
      `$1${info.lastCrawled}$2`
    );
  }

  // 更新时间戳
  stateContent = stateContent.replace(
    /("lastUpdated":\s*")[^"]*(")/,
    `$1${new Date().toISOString()}$2`
  );

  fs.writeFileSync(statePath, stateContent, 'utf-8');
  console.log('\n[更新] crawl_state.js 已更新');

  // 保存采集状态记录
  const recordFile = path.join(outputDir, `crawl_status_${dateStr}.json`);
  fs.writeFileSync(recordFile, JSON.stringify({
    date: today,
    status: crawlStatus,
    updatedAt: new Date().toISOString()
  }, null, 2), 'utf-8');
}

// 执行
run().catch(e => {
  console.error('[错误]', e);
  process.exit(1);
});