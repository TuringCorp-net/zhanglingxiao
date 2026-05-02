/**
 * ============================================
 * 选品采集脚本 - 2026-05-02 第二次采集
 * ============================================
 *
 * 规则：按 lastCrawled 排序，选每个平台最久未采集的类目
 * 每个平台 + 类目 × 4子渠道 × Top10 = 200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 各平台最久未采集的类目（按 crawl_state.js 分析）
const TARGET_CATEGORIES = [
  { platform: 'temu', catId: 1, catName: 'CD和黑胶唱片' },
  { platform: 'shein', catId: 2032, catName: '家居与生活' },
  { platform: 'amazon', catId: 2619525011, catName: '家电' },
  { platform: 'sumaitong', catId: 6, catName: '家用电器' },
  { platform: 'tiktok', catId: 604206, catName: 'Toys & Hobbies' }
];

// 4个子渠道
const CHANNELS = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

async function main() {
  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  console.log('========================================');
  console.log('选品采集脚本 - 2026-05-02 第二次');
  console.log('========================================');
  console.log(`目标类目: ${TARGET_CATEGORIES.length} 个平台\n`);

  // 采集每个平台的类目
  for (const { platform, catId, catName } of TARGET_CATEGORIES) {
    console.log(`\n>>> ${platform} - ${catName} (${catId})`);

    for (const channel of CHANNELS) {
      const channelName = channel.name;

      try {
        console.log(`  [${channelName}] 采集中...`);

        const result = await jjyApi.search({
          keyword: '',
          platform: platform,
          categoryId: catId,
          page: 1,
          size: 10,
          sort: platform === 'amazon' ? 'monthSold' : 'sold'
        });

        if (result.success && result.products.length > 0) {
          result.products.forEach(p => {
            p.sourcePlatform = platform;
            p.sourceCatId = catId;
            p.sourceCatName = catName;
            p.sourceChannel = channelName;
          });
          allProducts.push(...result.products);
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`    ✗ 无数据或失败: ${result.error || '未知错误'}`);
          errors.push({
            platform,
            catId,
            catName,
            channel: channelName,
            error: result.error || '无数据'
          });
        }
      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
        errors.push({
          platform,
          catId,
          catName,
          channel: channelName,
          error: e.message
        });
      }

      // 避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n========================================');
  console.log(`采集完成: ${allProducts.length} 个商品, ${errors.length} 个失败`);
  console.log('========================================');

  // 落盘
  const fs = require('fs');
  const result = {
    date: '2026-05-02',
    session: 'v2',
    totalProducts: allProducts.length,
    failedCount: errors.length,
    targetCategories: TARGET_CATEGORIES,
    errors: errors,
    products: allProducts
  };

  fs.writeFileSync(
    './raw_products_20260502_v2.json',
    JSON.stringify(result, null, 2)
  );
  console.log('\n✓ 数据已保存至 raw_products_20260502_v2.json');

  return result;
}

main().catch(console.error);
