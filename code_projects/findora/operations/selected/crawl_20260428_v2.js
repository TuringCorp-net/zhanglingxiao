/**
 * 选品 Agent 数据采集脚本
 *
 * 功能：
 * 1. 读取 crawl_state，按 lastCrawled 排序找出每平台最久未采集的类目
 * 2. 使用 jjy_api.js 采集数据：每平台 × 4子渠道 × Top10 = 200个待筛选商品
 * 3. 落盘到 operations/selected/dailytemp/YYYY-MM-DD/
 * 4. 筛选新奇/有趣/好玩/有爆点的商品
 * 5. 入选商品写入 operations/selected/ 目录（每个商品一个 markdown 文件）
 * 6. 更新 crawl_state 的 lastCrawled 时间
 */

const fs = require('fs');
const path = require('path');
const JJYAPITool = require('../tools/jjy_api.js');

// ============ 配置 ============
const CRAWL_STATE_PATH = path.join(__dirname, 'crawl_state.js');
const DAILY_TEMP_DIR = path.join(__dirname, 'dailytemp', getDateString());
const OUTPUT_DIR = path.join(__dirname);

// ============ 辅助函数 ============
function getDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 从 crawl_state.js 加载状态
 */
function loadCrawlState() {
  // 动态 require
  const stateModule = require(CRAWL_STATE_PATH);
  return stateModule;
}

/**
 * 找出每个平台最久未采集的类目
 */
function findOldestCategories(state) {
  const result = [];

  for (const [platformKey, platformData] of Object.entries(state.platforms)) {
    const categories = platformData.categories || [];

    // 找出 lastCrawled 为 null 或最早的类目
    let oldest = null;
    for (const cat of categories) {
      if (oldest === null) {
        oldest = cat;
      } else if (cat.lastCrawled === null && oldest.lastCrawled !== null) {
        oldest = cat;
      } else if (cat.lastCrawled !== null && oldest.lastCrawled !== null && new Date(cat.lastCrawled) < new Date(oldest.lastCrawled)) {
        oldest = cat;
      } else if (cat.lastCrawled !== null && oldest.lastCrawled === null) {
        // 保持 oldest 不变（null 表示从未采集）
      }
    }

    if (oldest) {
      result.push({
        platform: platformKey,
        platformName: platformData.name,
        catId: oldest.catId,
        catName: oldest.catName,
        lastCrawled: oldest.lastCrawled
      });
    }
  }

  return result;
}

/**
 * 筛选新奇有趣的商品
 * 规则：新奇/有趣/好玩/有爆点
 * 改进：去重 + 多样化关键词
 */
function filterInterestingProducts(products) {
  const interesting = [];
  const seenGoodsIds = new Set();  // 用于去重

  // 关键词列表 - 按类型分组，确保多样性
  const keywordGroups = {
    // 创意/趣味类
    creative: ['fun', 'unique', 'novel', 'quirky', 'weird', 'crazy', 'cool', 'awesome', 'amazing', 'interesting', 'cute', 'adorable', 'whimsical', 'bizarre', 'surprise', 'unexpected'],
    // 游戏/玩具类
    game: ['game', 'toy', 'puzzle', 'magic', 'prank', 'joke', 'hidden', 'transform', 'multi-functional', '2in1', '3in1', '4in1', '5in1'],
    // 流行/热门类
    trending: ['viral', 'trending', 'popular', 'best seller', 'hot', 'top rated', 'must have'],
    // 特殊用途/场景类
    scene: ['for party', 'for kids', 'for women', 'for men', 'gift', 'decor', 'for home', 'for office'],
    // 视觉效果类
    visual: ['led', 'glowing', 'fluorescent', 'neon', 'rainbow', 'gradient', 'holographic', 'glitter', 'shimmer'],
    // 便携/多功能类
    portable: ['inflatable', 'foldable', 'portable', 'mini', 'tiny', 'compact', 'travel', 'lightweight']
  };

  // 合并所有关键词
  const allKeywords = Object.values(keywordGroups).flat();

  for (const product of products) {
    // 去重检查
    const goodsId = product.goodsId || product.detailUrl || `${product.platform}_${product.goodsNameEn}`;
    if (seenGoodsIds.has(goodsId)) {
      continue;
    }
    seenGoodsIds.add(goodsId);

    const title = (product.goodsNameEn || product.goodsName || '').toLowerCase();
    const titleCn = (product.goodsNameCn || '').toLowerCase();

    // 检查是否匹配有趣关键词
    let isInteresting = false;
    let matchReason = '';
    let matchGroup = '';

    // 按组检查，确保多样性
    for (const [group, keywords] of Object.entries(keywordGroups)) {
      for (const keyword of keywords) {
        if (title.includes(keyword) || titleCn.includes(keyword)) {
          isInteresting = true;
          matchReason = keyword;
          matchGroup = group;
          break;
        }
      }
      if (isInteresting) break;
    }

    // 价格在合理范围内
    const priceMin = product.goodsPriceMin || 0;
    const priceMax = product.goodsPriceMax || priceMin;
    const avgPrice = (priceMin + priceMax) / 2;

    // 销量不能太低
    const sold = product.sold || 0;

    // 综合评分
    if (isInteresting && avgPrice >= 1 && avgPrice <= 150 && sold >= 50) {
      interesting.push({
        ...product,
        _matchReason: matchReason,
        _matchGroup: matchGroup,
        _avgPrice: avgPrice,
        _score: sold * 0.001 + avgPrice * 0.5
      });
    }
  }

  // 按综合评分排序
  interesting.sort((a, b) => b._score - a._score);

  return interesting;
}

/**
 * 生成商品 markdown 文件内容
 */
function generateProductMarkdown(product, index) {
  const dateStr = getDateString().replace(/-/g, '');
  const fileId = `${dateStr}-${String(index).padStart(3, '0')}`;

  const priceDisplay = product.goodsPriceMin && product.goodsPriceMax
    ? `$${product.goodsPriceMin} - $${product.goodsPriceMax}`
    : product.goodsPriceMin ? `$${product.goodsPriceMin}` : 'N/A';

  const soldDisplay = product.sold ? (product.sold >= 10000 ? `${(product.sold / 10000).toFixed(1)}万` : product.sold) : 'N/A';
  const ratingDisplay = product.rating ? `${product.rating}分` : 'N/A';
  const reviewDisplay = product.reviewNum ? `${product.reviewNum}条` : 'N/A';

  return `# ${fileId}

## 商品信息

- **商品ID**: ${fileId}
- **平台**: ${product.platform || 'N/A'}
- **类目**: ${product._categoryName || 'N/A'}
- **采集时间**: ${getTimestamp()}

## 商品名称

- **英文名称**: ${product.goodsNameEn || product.goodsName || 'N/A'}
- **中文名称**: ${product.goodsNameCn || 'N/A'}

## 价格与销量

- **价格**: ${priceDisplay}
- **销量**: ${soldDisplay}
- **评分**: ${ratingDisplay}
- **评论数**: ${reviewDisplay}

## 图片

- **缩略图**: ${product.thumbnail || product.thumbnailCn || 'N/A'}

## 链接

- **详情URL**: ${product.detailUrl || product.goodsId ? `https://www.temu.com/g-${product.goodsId}.html` : 'N/A'}

## 选品理由

- **匹配关键词**: ${product._matchReason || 'N/A'}
- **综合评分**: ${product._score ? product._score.toFixed(2) : 'N/A'}
- **平均价格**: $${product._avgPrice ? product._avgPrice.toFixed(2) : 'N/A'}

## 原始数据

\`\`\`json
${JSON.stringify(product, null, 2)}
\`\`\`
`;
}

/**
 * 主采集流程
 */
async function main() {
  console.log('========================================');
  console.log('选品 Agent 数据采集脚本');
  console.log(`执行时间: ${getTimestamp()}`);
  console.log('========================================\n');

  // 创建输出目录
  if (!fs.existsSync(DAILY_TEMP_DIR)) {
    fs.mkdirSync(DAILY_TEMP_DIR, { recursive: true });
  }

  // 加载状态
  console.log('[Step 1] 加载 crawl_state...');
  const crawlState = loadCrawlState();

  // 找出最久未采集的类目
  console.log('[Step 2] 分析最久未采集的类目...');
  const oldestCategories = findOldestCategories(crawlState);

  console.log('最久未采集的类目:');
  for (const cat of oldestCategories) {
    console.log(`  - ${cat.platform} / ${cat.catName} (lastCrawled: ${cat.lastCrawled || '从未采集'})`);
  }
  console.log('');

  // 初始化 JJY API
  console.log('[Step 3] 初始化 JJY API...');
  const jjyApi = new JJYAPITool();
  await jjyApi.init();
  console.log('');

  // 采集数据
  console.log('[Step 4] 开始采集数据...');
  console.log('每个平台采集 4 个子渠道，每个子渠道 Top 10，共 200 个待筛选商品\n');

  const allProducts = [];
  const channelNames = ['热销商品', '热销新品', '新店热销', '大卖新品'];

  for (const cat of oldestCategories) {
    console.log(`\n>>> ${cat.platformName} - ${cat.catName}`);

    for (const channel of channelNames) {
      console.log(`    ${channel}...`);

      try {
        const result = await jjyApi.search({
          platform: cat.platform,
          categoryId: cat.catId,
          sort: 'sold',
          page: 1,
          size: 10
        });

        if (result.success && result.products.length > 0) {
          for (const product of result.products) {
            product._platform = cat.platform;
            product._platformName = cat.platformName;
            product._categoryName = cat.catName;
            product._channel = channel;
            allProducts.push(product);
          }
          console.log(`      ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`      ✗ 获取失败: ${result.error || '未知错误'}`);
        }
      } catch (e) {
        console.log(`      ✗ 请求异常: ${e.message}`);
      }

      // 适当延迟避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n[Step 5] 采集完成，共获取 ${allProducts.length} 个商品\n`);

  // 保存原始数据
  const rawDataPath = path.join(DAILY_TEMP_DIR, 'raw_products.json');
  fs.writeFileSync(rawDataPath, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`原始数据已保存到: ${rawDataPath}`);

  // 筛选有趣商品
  console.log('\n[Step 6] 筛选新奇/有趣/好玩/有爆点的商品...');
  const interestingProducts = filterInterestingProducts(allProducts);
  console.log(`筛选出 ${Math.min(10, interestingProducts.length)} 个候选商品`);

  // 保存筛选结果
  const filteredDataPath = path.join(DAILY_TEMP_DIR, 'filtered_products.json');
  fs.writeFileSync(filteredDataPath, JSON.stringify(interestingProducts.slice(0, 10), null, 2), 'utf-8');
  console.log(`筛选数据已保存到: ${filteredDataPath}`);

  // 生成选中商品的 markdown 文件
  console.log('\n[Step 7] 生成选中商品的 markdown 文件...');
  const dateStr = getDateString();

  for (let i = 0; i < Math.min(10, interestingProducts.length); i++) {
    const product = interestingProducts[i];
    const markdown = generateProductMarkdown(product, i + 1);

    const dateId = dateStr.replace(/-/g, '');
    const fileName = `${dateId}-${String(i + 1).padStart(3, '0')}.md`;
    const filePath = path.join(OUTPUT_DIR, fileName);

    fs.writeFileSync(filePath, markdown, 'utf-8');
    console.log(`  ✓ 生成 ${fileName}`);
  }

  // 更新 crawl_state
  console.log('\n[Step 8] 更新 crawl_state...');
  updateCrawlState(crawlState, oldestCategories);

  console.log('\n========================================');
  console.log('采集任务完成!');
  console.log(`结果文件: ${OUTPUT_DIR}/${dateStr.replace(/-/g, '')}-{001-010}.md`);
  console.log('========================================');
}

/**
 * 更新 crawl_state.js 的 lastCrawled 时间
 */
function updateCrawlState(state, crawledCategories) {
  const timestamp = getTimestamp();

  for (const cat of crawledCategories) {
    const platform = state.platforms[cat.platform];
    if (platform && platform.categories) {
      for (const category of platform.categories) {
        if (category.catId === cat.catId) {
          category.lastCrawled = timestamp;
          console.log(`  ✓ 更新 ${cat.platform}/${cat.catName} -> ${timestamp}`);
        }
      }
    }
  }

  state.lastUpdated = timestamp;

  // 重新写入文件
  const content = `/**
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

const crawlState = ${JSON.stringify(state, null, 2)};

module.exports = crawlState;
`;

  fs.writeFileSync(CRAWL_STATE_PATH, content, 'utf-8');
  console.log(`  ✓ 已更新 ${CRAWL_STATE_PATH}`);
}

// 执行
main().catch(console.error);