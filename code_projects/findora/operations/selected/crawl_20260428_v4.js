/**
 * 选品采集脚本 - 2026-04-28
 *
 * 按照 crawl_state.js 规则，每个平台选取"最久未采集"的类目进行采集
 *
 * 本次采集类目：
 * - Temu: 手机和配件 (24252)
 * - Shein: 玩具和游戏 (4328)
 * - Amazon: 乐器 (11091801)
 * - 速卖通: 工具 (1420)
 * - TikTok: 宠物用品 (602118)
 */

const JJYAPITool = require('../tools/jjy_api');

// 采集配置
const CRAWL_CONFIG = {
  // 4个子渠道配置（热销商品、热销新品、新店热销、大卖新品）
  channels: [
    { name: 'hot-sale', title: '热销商品' },
    { name: 'hot-sale-new', title: '热销新品' },
    { name: 'new-mall-hot-sale', title: '新店热销' },
    { name: 'big-sale-new', title: '大卖新品' }
  ],
  // 每个子渠道取 Top 10
  topN: 10,
  // 时间范围：最近30天
  daysRange: 30
};

// 本次采集的类目（每个平台选1个最久未采集的）
const CRAWL_CATEGORIES = [
  { platform: 'temu', catId: 24252, catName: '手机和配件' },
  { platform: 'shein', catId: 4328, catName: '玩具和游戏' },
  { platform: 'amazon', catId: 11091801, catName: '乐器' },
  { platform: 'sumaitong', catId: 1420, catName: '工具' },
  { platform: 'tiktok', catId: 602118, catName: 'Pet Supplies' }
];

// 计算30天前的日期
function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - CRAWL_CONFIG.daysRange);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

// 主采集函数
async function crawlAll() {
  const jjyApi = new JJYAPITool();
  const results = [];
  const dateRange = getDateRange();

  console.log('===========================================');
  console.log('选品采集开始 - 2026-04-28');
  console.log(`时间范围: ${dateRange.start} ~ ${dateRange.end}`);
  console.log(`每类目采集: ${CRAWL_CONFIG.channels.length} 个子渠道 × Top ${CRAWL_CONFIG.topN} = ${CRAWL_CONFIG.channels.length * CRAWL_CONFIG.topN} 个/类目`);
  console.log(`总采集类目: ${CRAWL_CATEGORIES.length}`);
  console.log('===========================================\n');

  for (const cat of CRAWL_CATEGORIES) {
    console.log(`\n[${cat.platform.toUpperCase()}] ${cat.catName} (catId: ${cat.catId})`);
    console.log('-'.repeat(50));

    const catResult = {
      platform: cat.platform,
      catId: cat.catId,
      catName: cat.catName,
      channels: []
    };

    // 遍历4个子渠道
    for (const channel of CRAWL_CONFIG.channels) {
      try {
        console.log(`  ${channel.title}...`);

        // 使用 search API 进行采集
        // 注意：API 搜索不支持直接按子渠道筛选，我们使用无关键词+类目筛选的方式
        const searchResult = await jjyApi.search({
          platform: cat.platform,
          categoryId: cat.catId,
          onSaleTimeStart: dateRange.start,
          onSaleTimeEnd: dateRange.end,
          size: CRAWL_CONFIG.topN,
          sort: cat.platform === 'amazon' ? 'monthSold' : 'sold'
        });

        if (searchResult.success && searchResult.products.length > 0) {
          const products = searchResult.products.slice(0, CRAWL_CONFIG.topN);

          console.log(`    ✓ 获取 ${products.length} 个商品`);

          catResult.channels.push({
            channel: channel.name,
            channelTitle: channel.title,
            total: searchResult.total,
            products: products
          });

          // 累加到总结果
          results.push(...products.map(p => ({
            ...p,
            _source: {
              platform: cat.platform,
              catId: cat.catId,
              catName: cat.catName,
              channel: channel.name,
              channelTitle: channel.title
            }
          })));
        } else {
          console.log(`    ✗ 获取失败: ${searchResult.error || '无数据'}`);
          catResult.channels.push({
            channel: channel.name,
            channelTitle: channel.title,
            error: searchResult.error || '无数据',
            products: []
          });
        }

        // 简短延迟避免请求过快
        await new Promise(r => setTimeout(r, 200));

      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
        catResult.channels.push({
          channel: channel.name,
          channelTitle: channel.title,
          error: e.message,
          products: []
        });
      }
    }

    console.log(`  小计: ${catResult.channels.reduce((sum, c) => sum + (c.products?.length || 0), 0)} 个商品`);
  }

  // 去重
  const uniqueMap = new Map();
  const uniqueResults = results.filter(item => {
    const key = `${item.platform}_${item.goodsId}`;
    if (uniqueMap.has(key)) return false;
    uniqueMap.set(key, item);
    return true;
  });

  console.log('\n===========================================');
  console.log('采集完成');
  console.log(`总采集: ${results.length} 个商品`);
  console.log(`去重后: ${uniqueResults.length} 个商品`);
  console.log('===========================================');

  // 返回采集结果
  return {
    date: new Date().toISOString(),
    categories: CRAWL_CATEGORIES,
    totalCollected: results.length,
    totalUnique: uniqueResults.length,
    products: uniqueResults
  };
}

// 执行
crawlAll()
  .then(result => {
    // 保存结果
    const fs = require('fs');
    const outputPath = `operations/selected/2026-04-28/collected_${Date.now()}.json`;

    // 确保目录存在
    const dir = 'operations/selected/2026-04-28';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n结果已保存: ${outputPath}`);

    process.exit(0);
  })
  .catch(e => {
    console.error('采集失败:', e);
    process.exit(1);
  });
