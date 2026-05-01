/**
 * 选品采集脚本 - 2026-05-01
 *
 * 采集目标：每个平台最久未采集的类目
 * - temu: 收藏品和工艺品 (39278)
 * - shein: 运动与户外 (3195)
 * - amazon: 宠物用品 (2619533011)
 * - sumaitong: 箱包 (1524)
 * - tiktok: Tools & Hardware (604579)
 *
 * 每个类目 × 4子渠道 × Top10 = 200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

const CRAWL_DATE = '2026-05-01';
const OUTPUT_DIR = `/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/selected/dailytemp/${CRAWL_DATE}`;

const PLATFORM_CONFIGS = [
  {
    platform: 'temu',
    catId: 39278,
    catName: '收藏品和工艺品',
    subChannels: [
      { name: '热销商品', path: '/goods/hot-sale' },
      { name: '热销新品', path: '/goods/hot-sale-new' },
      { name: '新店热销', path: '/goods/new-mall-hot-sale' },
      { name: '大卖新品', path: '/goods/big-sale-new' }
    ]
  },
  {
    platform: 'shein',
    catId: 3195,
    catName: '运动与户外',
    subChannels: [
      { name: '热销商品', path: '/goods/hot-sale' },
      { name: '热销新品', path: '/goods/hot-sale-new' },
      { name: '新店热销', path: '/goods/new-mall-hot-sale' },
      { name: '大卖新品', path: '/goods/big-sale-new' }
    ]
  },
  {
    platform: 'amazon',
    catId: 2619533011,
    catName: '宠物用品',
    subChannels: [
      { name: '热销商品', path: '/goods/hot-sale' },
      { name: '热销新品', path: '/goods/hot-sale-new' },
      { name: '新店热销', path: '/goods/new-mall-hot-sale' },
      { name: '大卖新品', path: '/goods/big-sale-new' }
    ]
  },
  {
    platform: 'sumaitong',
    catId: 1524,
    catName: '箱包',
    subChannels: [
      { name: '热销商品', path: '/goods/hot-sale' },
      { name: '热销新品', path: '/goods/hot-sale-new' },
      { name: '新店热销', path: '/goods/new-mall-hot-sale' },
      { name: '大卖新品', path: '/goods/big-sale-new' }
    ]
  },
  {
    platform: 'tiktok',
    catId: 604579,
    catName: 'Tools & Hardware',
    subChannels: [
      { name: '热销商品', path: '/goods/hot-sale' },
      { name: '热销新品', path: '/goods/hot-sale-new' },
      { name: '新店热销', path: '/goods/new-mall-hot-sale' },
      { name: '大卖新品', path: '/goods/big-sale-new' }
    ]
  }
];

async function crawl() {
  console.log(`[选品采集] 开始采集 ${CRAWL_DATE}`);
  console.log('='.repeat(60));

  const jjyApi = new JJYAPITool();
  const fs = require('fs');
  const path = require('path');

  // 确保输出目录存在
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const allResults = {
    crawlDate: CRAWL_DATE,
    platforms: {},
    totalProducts: 0
  };

  for (const config of PLATFORM_CONFIGS) {
    console.log(`\n[${config.platform}] 采集类目: ${config.catName} (${config.catId})`);

    const platformData = {
      platform: config.platform,
      catId: config.catId,
      catName: config.catName,
      subChannels: {},
      allProducts: []
    };

    for (const channel of config.subChannels) {
      console.log(`  → ${channel.name}...`);

      try {
        // 使用API搜索该类目的商品
        const result = await jjyApi.search({
          platform: config.platform,
          categoryId: config.catId,
          size: 10,
          sort: config.platform === 'amazon' ? 'monthSold' : 'sold',
          order: 'descend'
        });

        if (result.success) {
          platformData.subChannels[channel.name] = {
            success: true,
            count: result.total,
            products: result.products
          };
          platformData.allProducts.push(...result.products);
          console.log(`    ✓ 获取 ${result.products.length} 个商品 (总计 ${result.total})`);
        } else {
          platformData.subChannels[channel.name] = {
            success: false,
            error: result.error,
            products: []
          };
          console.log(`    ✗ 获取失败: ${result.error}`);
        }
      } catch (e) {
        platformData.subChannels[channel.name] = {
          success: false,
          error: e.message,
          products: []
        };
        console.log(`    ✗ 异常: ${e.message}`);
      }

      // 避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }

    allResults.platforms[config.platform] = platformData;
    allResults.totalProducts += platformData.allProducts.length;

    console.log(`  ✓ ${config.platform} 共获取 ${platformData.allProducts.length} 个商品`);
  }

  // 保存原始数据
  const rawPath = path.join(OUTPUT_DIR, 'raw_products.json');
  fs.writeFileSync(rawPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`\n[保存] 原始数据 → ${rawPath}`);

  console.log(`\n[完成] 共获取 ${allResults.totalProducts} 个商品`);
  return allResults;
}

crawl().catch(console.error);
