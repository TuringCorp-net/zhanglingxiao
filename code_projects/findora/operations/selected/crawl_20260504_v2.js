/**
 * 选品采集脚本 - 2026-05-04
 * 使用 jjy_api.js 采集5个平台的热销商品
 *
 * 采集策略：
 * - 每个平台选1个"最久未采集"的类目
 * - 4个子渠道 × Top10 = 40个/平台
 * - 共5个平台 = 200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 采集配置：每个平台最久未采集的类目
const CRAWL_CONFIG = {
  temu: {
    name: 'Temu',
    catId: 13512,
    catName: '家居装修',
    sort: 'sold'
  },
  shein: {
    name: 'Shein',
    catId: 2400,
    catName: '宠物用品',
    sort: 'sold'
  },
  amazon: {
    name: 'Amazon',
    catId: 172282,
    catName: '电子产品',
    sort: 'monthSold'
  },
  sumaitong: {
    name: '速卖通',
    catId: 18,
    catName: '运动及娱乐',
    sort: 'totalSold'
  },
  tiktok: {
    name: 'TikTok',
    catId: 605248,
    catName: 'Fashion Accessories',
    sort: 'totalSold'
  }
};

async function crawlPlatform(platform, config) {
  console.log(`\n========== 采集 ${config.name} - ${config.catName} ==========`);
  const jjyApi = new JJYAPITool();
  const results = [];

  // 4个子渠道
  const channels = ['热销商品', '热销新品', '新店热销', '大卖新品'];

  for (const channel of channels) {
    try {
      console.log(`  > ${channel}...`);
      const result = await jjyApi.search({
        platform: platform,
        categoryId: config.catId,
        sort: config.sort,
        size: 10,
        page: 1
      });

      if (result.success && result.products.length > 0) {
        // 添加来源信息
        const productsWithSource = result.products.map(p => ({
          ...p,
          sourceChannel: channel,
          sourceCategory: config.catName
        }));
        results.push(...productsWithSource);
        console.log(`    ✓ 获取 ${result.products.length} 个商品`);
      } else {
        console.log(`    ✗ 无数据或失败: ${result.error || 'unknown'}`);
      }
    } catch (e) {
      console.log(`    ✗ 异常: ${e.message}`);
    }
  }

  return results;
}

async function main() {
  console.log('===========================================');
  console.log('  选品采集任务开始 - 2026-05-04');
  console.log('===========================================');

  const allProducts = [];
  const crawlResults = {};

  for (const [platform, config] of Object.entries(CRAWL_CONFIG)) {
    const products = await crawlPlatform(platform, config);
    crawlResults[platform] = {
      platform: config.name,
      category: config.catName,
      count: products.length
    };
    allProducts.push(...products);
  }

  console.log('\n===========================================');
  console.log('  采集完成统计');
  console.log('===========================================');
  for (const [platform, info] of Object.entries(crawlResults)) {
    console.log(`  ${info.platform} (${info.category}): ${info.count} 个商品`);
  }
  console.log(`\n总计: ${allProducts.length} 个商品`);

  // 保存原始数据
  const fs = require('fs');
  const outputPath = __dirname + '/dailytemp/2026-05-04/raw_products.json';
  fs.mkdirSync(__dirname + '/dailytemp/2026-05-04', { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    crawlTime: new Date().toISOString(),
    crawlResults: crawlResults,
    totalProducts: allProducts.length,
    products: allProducts
  }, null, 2));
  console.log(`\n✓ 原始数据已保存: ${outputPath}`);

  return allProducts;
}

main().catch(console.error);
