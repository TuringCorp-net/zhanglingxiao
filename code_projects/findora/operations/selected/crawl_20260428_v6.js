/**
 * 选品采集脚本 - 2026-04-28 (TikTok补充采集)
 */

const JJYAPITool = require('../tools/jjy_api');

const CRAWL_CONFIG = {
  topN: 10,
  daysRange: 30
};

// TikTok 尝试更多类目
const TIKTOK_CATEGORIES = [
  { platform: 'tiktok', catId: 604206, catName: 'Toys & Hobbies' },
  { platform: 'tiktok', catId: 600024, catName: 'Kitchenware' },
  { platform: 'tiktok', catId: 601450, catName: 'Beauty & Personal Care' }
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
  console.log('TikTok 补充采集');
  console.log('===========================================\n');

  for (const cat of TIKTOK_CATEGORIES) {
    console.log(`\n[TIKTOK] ${cat.catName} (catId: ${cat.catId})`);

    try {
      const searchResult = await jjyApi.search({
        platform: cat.platform,
        categoryId: cat.catId,
        onSaleTimeStart: dateRange.start,
        onSaleTimeEnd: dateRange.end,
        size: CRAWL_CONFIG.topN,
        sort: 'totalSold'
      });

      if (searchResult.success && searchResult.products.length > 0) {
        const products = searchResult.products.slice(0, CRAWL_CONFIG.topN);
        console.log(`  ✓ 获取 ${products.length} 个商品`);

        results.push(...products.map(p => ({
          ...p,
          _source: {
            platform: cat.platform,
            catId: cat.catId,
            catName: cat.catName,
            channel: 'search',
            channelTitle: '类目搜索'
          }
        })));
      } else {
        console.log(`  ✗ ${searchResult.error || '无数据'}`);
      }

      await new Promise(r => setTimeout(r, 200));

    } catch (e) {
      console.log(`  ✗ ${e.message}`);
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
  console.log(`TikTok 补充采集完成: ${uniqueResults.length} 个唯一商品`);
  console.log('===========================================');

  return {
    date: new Date().toISOString(),
    products: uniqueResults
  };
}

crawlAll()
  .then(result => {
    const fs = require('fs');
    const outputPath = `operations/selected/2026-04-28/tiktok_supplement_${Date.now()}.json`;
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\n结果已保存: ${outputPath}`);
    process.exit(0);
  })
  .catch(e => {
    console.error('采集失败:', e);
    process.exit(1);
  });
