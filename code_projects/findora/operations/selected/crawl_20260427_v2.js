/**
 * 选品采集脚本 - 2026-04-27
 *
 * 选择每个平台最久未采集的类目：
 * - Temu: 25439 玩具与游戏
 * - Shein: 4436 女装
 * - Amazon: 16310101 杂货店
 * - Sumaitong: 39 照明灯饰
 * - TikTok: 604968 Home Improvement
 *
 * 每平台4个子渠道 × Top10 = 40个/平台
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 子渠道定义
const channels = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

// 采集配置
const platforms = [
  { name: 'temu', catId: 25439, catName: '玩具与游戏' },
  { name: 'shein', catId: 4436, catName: '女装' },
  { name: 'amazon', catId: 16310101, catName: '杂货店' },
  { name: 'sumaitong', catId: 39, catName: '照明灯饰' },
  { name: 'tiktok', catId: 604968, catName: 'Home Improvement' }
];

async function crawl() {
  console.log('=== 选品采集开始 ===\n');
  const jjyApi = new JJYAPITool();
  await jjyApi.init();

  const allProducts = [];
  const timestamp = new Date().toISOString();

  for (const platform of platforms) {
    console.log(`\n--- 采集 ${platform.name} / ${platform.catName} ---`);

    // 4个子渠道
    for (const channel of channels) {
      console.log(`  > ${channel.name}...`);

      try {
        const result = await jjyApi.search({
          keyword: '',
          platform: platform.name,
          categoryId: platform.catId,
          sort: platform.name === 'temu' ? 'sold' :
                platform.name === 'shein' ? 'sold' :
                platform.name === 'amazon' ? 'monthSold' : 'totalSold',
          size: 10
        });

        if (result.success && result.products.length > 0) {
          result.products.forEach(p => {
            p.source = `${platform.name}-${channel.name}`;
            p.catName = platform.catName;
          });
          allProducts.push(...result.products);
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`    ✗ 失败: ${result.error || '无数据'}`);
        }
      } catch (e) {
        console.log(`    ✗ 错误: ${e.message}`);
      }
    }
  }

  console.log(`\n=== 共采集 ${allProducts.length} 个商品 ===`);

  // 保存到临时目录
  const fs = require('fs');
  const dir = __dirname;
  fs.writeFileSync(
    `${dir}/raw_products.json`,
    JSON.stringify({ timestamp, products: allProducts }, null, 2)
  );

  return allProducts;
}

crawl().then(products => {
  console.log('采集完成，文件已保存到 raw_products.json');
}).catch(e => {
  console.error('采集失败:', e.message);
  process.exit(1);
});