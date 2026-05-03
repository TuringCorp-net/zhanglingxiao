/**
 * 2026-05-03 选品采集脚本
 *
 * 根据 crawl_state.js 规则：
 * 1. 找出5个平台"最久未采集"的类目
 * 2. 使用 jjy_api.js 采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 3. 落盘到 dailytemp/2026-05-03/
 * 4. 筛选出10个精选
 */

const jjyApi = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 加载 crawl_state
const crawlState = require('./crawl_state.js');

// 各平台的4个子渠道
const subChannels = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

// 找出每个平台"最久未采集"的类目
function findOldestCategories(state) {
  const oldestByPlatform = {};

  for (const [platformKey, platform] of Object.entries(state.platforms)) {
    // 找出 lastCrawled 最老的类目（null 也算老）
    let oldest = null;
    let oldestTime = null;

    for (const cat of platform.categories) {
      const catTime = cat.lastCrawled ? new Date(cat.lastCrawled) : new Date(0);
      if (!oldestTime || catTime < oldestTime) {
        oldestTime = catTime;
        oldest = cat;
      }
    }

    oldestByPlatform[platformKey] = {
      ...oldest,
      platform: platformKey,
      platformName: platform.name,
      sort: platform.sort
    };
  }

  return oldestByPlatform;
}

// 将商品写入临时目录
async function saveRawProducts(dateStr, products, platform, category) {
  const dir = path.join(__dirname, 'dailytemp', dateStr);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const fileName = `raw_${platform}_${category.catId}.json`;
  const filePath = path.join(dir, fileName);

  fs.writeFileSync(filePath, JSON.stringify({
    platform,
    category: category.catName,
    catId: category.catId,
    total: products.length,
    products: products
  }, null, 2));

  console.log(`[落盘] ${platform} - ${category.catName}: ${products.length} 个商品 → ${fileName}`);
}

// 按新奇/有趣/好玩/有爆点筛选
function filterProducts(rawProducts) {
  // 定义过滤关键词
  const keywords = {
    // 新奇有趣
    interesting: ['fun', 'novelty', 'unique', 'quirky', 'weird', 'cute', 'crazy', 'cool', 'amazing', 'magic', 'fidget', 'toys'],
    // 搞怪
    quirky: ['prank', 'joke', 'gag', 'trick', 'surprise', 'spinning', 'bubble', 'shooting', 'pop'],
    // 热点话题
    trending: ['viral', 'tiktok', 'trending', 'popular', 'best seller', 'bestselling', 'must have'],
    // 有趣玩具类
    toys: ['game', 'puzzle', 'lego', 'building', 'remote control', 'rc', 'drone', 'robot'],
    // 创意生活
    creative: ['led', 'light', 'glow', 'neon', 'projector', 'decor', 'gift', 'party'],
    // 减压
    stress: ['stress', 'relief', 'anxiety', 'squeeze', 'ball', 'massager', 'therapy']
  };

  // 评分最低要求（避免差评商品）
  const MIN_RATING = 3.5;

  // 价格范围（避免太贵或太便宜）
  const MIN_PRICE = 3;
  const MAX_PRICE = 50;

  // 销量门槛（要有基本销量，但不要太爆）
  const MIN_SOLD = 100;
  const MAX_SOLD = 50000;

  // 评分人数（避免评价太少）
  const MIN_REVIEWS = 10;

  const filtered = [];

  for (const p of rawProducts) {
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    const nameCn = (p.goodsNameCn || '').toLowerCase();
    const combined = name + ' ' + nameCn;

    // 检查是否匹配关键词
    let score = 0;
    let reasons = [];

    for (const [category, words] of Object.entries(keywords)) {
      for (const word of words) {
        if (combined.includes(word)) {
          score += 2;
          reasons.push(category);
          break;
        }
      }
    }

    // 评分过滤
    if (p.rating && p.rating < MIN_RATING) continue;

    // 价格过滤
    const price = p.goodsPriceMin || 0;
    if (price < MIN_PRICE || price > MAX_PRICE) continue;

    // 销量过滤
    const sold = p.sold || 0;
    if (sold < MIN_SOLD) continue;

    // 评论数过滤
    const reviews = p.reviewNum || 0;
    if (reviews < MIN_REVIEWS) continue;

    // 有评分才加分
    if (p.rating && p.rating >= 4.0) score += 1;
    if (p.rating && p.rating >= 4.5) score += 2;

    // 评论多加分
    if (reviews >= 100) score += 1;
    if (reviews >= 500) score += 1;

    if (score > 0 || reasons.length > 0) {
      filtered.push({
        ...p,
        _score: score,
        _reasons: [...new Set(reasons)]
      });
    }
  }

  // 按分数排序
  filtered.sort((a, b) => b._score - a._score);

  return filtered;
}

// 生成精选商品文档
function generateSelectedDocs(dateStr, selectedProducts) {
  const dir = path.join(__dirname);
  const reportPath = path.join(dir, `selection_report_${dateStr}.md`);

  let report = `# 选品报告 - ${dateStr}\n\n`;
  report += `生成时间: ${new Date().toISOString()}\n\n`;
  report += `## 精选商品\n\n`;

  selectedProducts.forEach((p, i) => {
    const id = `${dateStr.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`;
    const name = p.goodsNameEn || p.goodsName || 'Unknown';
    const nameCn = p.goodsNameCn || '';

    report += `### ${i + 1}. ${name}\n\n`;
    report += `- 编号: ${id}\n`;
    report += `- 平台: ${p.platform}\n`;
    report += `- 价格: ${p.goodsPriceMin || '?'} ~ ${p.goodsPriceMax || '?'}\n`;
    report += `- 销量: ${p.sold || '?'}\n`;
    report += `- 评分: ${p.rating || '?'} (${p.reviewNum || 0} 条评价)\n`;
    report += `- 标签: ${p._reasons?.join(', ') || '新奇有趣'}\n\n`;

    // 写入商品文档
    const docPath = path.join(dir, `${id}.md`);
    let doc = `# ${name}\n\n`;
    doc += `## 基本信息\n\n`;
    doc += `- 编号: ${id}\n`;
    doc += `- 平台: ${p.platform}\n`;
    doc += `- 品类: ${p.catName || p.category || 'Unknown'}\n`;
    doc += `- 价格区间: ${p.goodsPriceMin || '?'} ~ ${p.goodsPriceMax || '?'}\n`;
    doc += `- 销量: ${p.sold || '?'}\n`;
    doc += `- 评分: ${p.rating || '?'} (${p.reviewNum || 0} 条评价)\n`;
    doc += `- 上架时间: ${p.onSaleTime || '?'}\n`;
    doc += `- 商品ID: ${p.goodsId || '?'}\n`;
    doc += `- 缩略图: ${p.thumbnail || p.thumbnailCn || '?'}\n\n`;
    doc += `## 卖点分析\n\n`;
    doc += `- 中文名: ${nameCn || '无'}\n`;
    doc += `- 英文名: ${name}\n`;
    doc += `- 筛选标签: ${p._reasons?.join(', ') || '新奇有趣'}\n`;
    doc += `- 筛选评分: ${p._score || 0}\n\n`;
    doc += `## 数据来源\n\n`;
    doc += `- 采集日期: ${dateStr}\n`;
    doc += `- 采集平台: ${p.platform}\n`;
    doc += `- 子渠道: ${p.subChannel || '热销商品'}\n\n`;
    doc += `---\n`;
    doc += `*本文档由 Selector 自动生成，待 Curator 二次加工*\n`;

    fs.writeFileSync(docPath, doc);
    console.log(`[生成] ${id}.md`);
  });

  report += `\n---\n*本报告由 Selector 自动生成*\n`;
  fs.writeFileSync(reportPath, report);
  console.log(`[生成] selection_report_${dateStr}.md`);

  return { reportPath };
}

// 更新 crawl_state
function updateCrawlState(state, crawledPlatforms) {
  const now = new Date().toISOString();

  for (const [platformKey, category] of Object.entries(crawledPlatforms)) {
    if (state.platforms[platformKey]) {
      const cats = state.platforms[platformKey].categories;
      const cat = cats.find(c => c.catId === category.catId);
      if (cat) {
        cat.lastCrawled = now;
      }
    }
  }

  state.lastUpdated = now;

  return state;
}

// 主函数
async function main() {
  const dateStr = '2026-05-03';
  console.log(`\n========== ${dateStr} 选品采集 ==========\n`);

  // 初始化 API
  const api = new jjyApi();
  await api.init();

  // 找出最久未采集的类目
  const oldestCategories = findOldestCategories(crawlState);
  console.log('\n最久未采集的类目:');
  for (const [platform, cat] of Object.entries(oldestCategories)) {
    console.log(`  ${platform} - ${cat.catName} (上次: ${cat.lastCrawled || '从未'})`);
  }

  // 采集数据
  const allProducts = [];
  const crawledPlatforms = {};

  console.log('\n开始采集...');

  for (const [platform, category] of Object.entries(oldestCategories)) {
    console.log(`\n>>> ${platform} - ${category.catName}`);

    let platformProducts = [];

    for (const channel of subChannels) {
      console.log(`    ${channel.name}...`);

      try {
        // 构造搜索参数
        const params = {
          platform,
          categoryId: category.catId,
          size: 10,
          sort: category.sort || 'sold',
          order: 'descend'
        };

        const result = await api.search(params);

        if (result.success && result.products.length > 0) {
          const productsWithMeta = result.products.map(p => ({
            ...p,
            platform,
            catName: category.catName,
            catId: category.catId,
            subChannel: channel.name
          }));

          platformProducts.push(...productsWithMeta);
          allProducts.push(...productsWithMeta);
          console.log(`      获取 ${result.products.length} 个商品`);
        } else {
          console.log(`      无数据或失败: ${result.error || 'unknown'}`);
        }
      } catch (e) {
        console.log(`      错误: ${e.message}`);
      }

      // 每个子渠道间隔一下
      await new Promise(r => setTimeout(r, 300));
    }

    // 保存原始数据
    if (platformProducts.length > 0) {
      await saveRawProducts(dateStr, platformProducts, platform, category);
    }

    crawledPlatforms[platform] = category;

    // 平台间隔
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n总计采集: ${allProducts.length} 个商品`);

  // 去重（基于 goodsId）
  const seen = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (!p.goodsId) return true;
    if (seen.has(p.goodsId)) return false;
    seen.add(p.goodsId);
    return true;
  });

  console.log(`去重后: ${uniqueProducts.length} 个商品`);

  // 筛选精选
  const filtered = filterProducts(uniqueProducts);
  console.log(`筛选得分: ${filtered.length} 个商品`);

  // 取前10个
  const selected = filtered.slice(0, 10);
  console.log(`精选: ${selected.length} 个商品`);

  // 生成文档
  if (selected.length > 0) {
    const { reportPath } = generateSelectedDocs(dateStr, selected);
    console.log(`\n报告已生成: ${reportPath}`);
  }

  // 更新 crawl_state
  const updatedState = updateCrawlState(crawlState, crawledPlatforms);

  // 保存更新后的 state
  const stateContent = `/**
 * ============================================
 * 选品 Agent 每日采集状态文件
 * ============================================
 *
 * 工作流程：
 * 1. 定时触发 → 读取 state，按 lastCrawled 排序
 * 2. 每平台选1个"最久未采集"的类目 → 共5个
 * 3. 使用 jjy_api.js 工具执行采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 4. 落盘到 operations/selected/dailytemp/YYYY-MM-DD/
 * 5. Selector 按"新奇/有趣/好玩/有爆点"筛选
 * 6. 入选商品直接写入 operations/selected/ 目录（Curator 会来取）
 * 7. 更新 state 的 lastCrawled 时间
 *
 * 采集工具：operations/tools/jjy_api.js (JJYAPITool)
 *
 * 采集参数：
 * - 时间范围：最近30天
 * - 排序：按平台默认销量排序（降序）
 * - 每子渠道取：Top 10
 */

const crawlState = ${JSON.stringify(updatedState, null, 2)};

module.exports = crawlState;`;

  fs.writeFileSync(path.join(__dirname, 'crawl_state.js'), stateContent);
  console.log('\n[更新] crawl_state.js 已更新');

  // 保存采集到的原始商品
  const rawPath = path.join(__dirname, 'raw_products_latest.json');
  fs.writeFileSync(rawPath, JSON.stringify({
    date: dateStr,
    total: uniqueProducts.length,
    products: uniqueProducts
  }, null, 2));
  console.log(`[保存] raw_products_latest.json`);

  // 保存筛选结果
  const selectedPath = path.join(__dirname, 'selected_latest.json');
  fs.writeFileSync(selectedPath, JSON.stringify({
    date: dateStr,
    total: selected.length,
    products: selected
  }, null, 2));
  console.log(`[保存] selected_latest.json`);

  console.log('\n========== 采集完成 ==========\n');
}

main().catch(console.error);
