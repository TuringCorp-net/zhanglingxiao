/**
 * 选品采集脚本 - 2026-04-28 (补充采集)
 *
 * 补充采集 Amazon 和 TikTok 平台
 */

const JJYAPITool = require('../tools/jjy_api');

// 采集配置
const CRAWL_CONFIG = {
  channels: [
    { name: 'hot-sale', title: '热销商品' },
    { name: 'hot-sale-new', title: '热销新品' },
    { name: 'new-mall-hot-sale', title: '新店热销' },
    { name: 'big-sale-new', title: '大卖新品' }
  ],
  topN: 10,
  daysRange: 30
};

// 补充采集的类目
const CRAWL_CATEGORIES = [
  { platform: 'amazon', catId: 165793011, catName: '玩具' },
  { platform: 'tiktok', catId: 601755, catName: 'Computers & Office Equipment' }
];

function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - CRAWL_CONFIG.daysRange);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0]
  };
}

async function crawlAll() {
  const jjyApi = new JJYAPITool();
  const results = [];
  const dateRange = getDateRange();

  console.log('===========================================');
  console.log('补充采集 - Amazon 玩具 & TikTok 办公设备');
  console.log('===========================================\n');

  for (const cat of CRAWL_CATEGORIES) {
    console.log(`\n[${cat.platform.toUpperCase()}] ${cat.catName} (catId: ${cat.catId})`);

    for (const channel of CRAWL_CONFIG.channels) {
      try {
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
          console.log(`  ${channel.title}: ✓ ${products.length} 个商品`);

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
          console.log(`  ${channel.title}: ✗ ${searchResult.error || '无数据'}`);
        }

        await new Promise(r => setTimeout(r, 200));

      } catch (e) {
        console.log(`  ${channel.title}: ✗ ${e.message}`);
      }
    }
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
  console.log(`补充采集完成: ${uniqueResults.length} 个唯一商品`);
  console.log('===========================================');

  return {
    date: new Date().toISOString(),
    categories: CRAWL_CATEGORIES,
    totalUnique: uniqueResults.length,
    products: uniqueResults
  };
}

crawlAll()
  .then(result => {
    const fs = require('fs');
    const outputPath = `operations/selected/2026-04-28/supplement_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n补充结果已保存: ${outputPath}`);
    process.exit(0);
  })
  .catch(e => {
    console.error('采集失败:', e);
    process.exit(1);
  });
