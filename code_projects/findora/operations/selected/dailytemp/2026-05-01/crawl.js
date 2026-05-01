/**
 * Selector 选品采集脚本 - 2026-05-01
 *
 * 工作流程：
 * 1. 每个平台选择最久未采集的类目
 * 2. 4个子渠道 × Top10 = 40个/平台
 * 3. 落盘到 dailytemp/2026-05-01/
 */

const JJYAPITool = require('../../../tools/jjy_api.js');

// 今日日期
const today = '2026-05-01';

// 本次采集的类目（最久未采集的null类目）
const targetCategories = [
  { platform: 'temu', catId: 39316, catName: '艺术品、工艺品和缝纫用品' },
  { platform: 'shein', catId: 2274, catName: '手机及配件' },
  { platform: 'amazon', catId: 328182011, catName: '电动和手动工具' },
  { platform: 'sumaitong', catId: 200000345, catName: '女装' },
  { platform: 'tiktok', catId: 600942, catName: 'Household Appliances' }
];

// 4个子渠道
const channels = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

async function crawl() {
  const jjyApi = new JJYAPITool();

  console.log('========== Selector 选品采集开始 ==========');
  console.log(`日期: ${today}`);
  console.log('');

  const allResults = [];

  for (const cat of targetCategories) {
    console.log(`\n>>> 采集 ${cat.platform} - ${cat.catName} (catId: ${cat.catId})`);

    const platformResults = {
      platform: cat.platform,
      catId: cat.catId,
      catName: cat.catName,
      channels: []
    };

    for (const channel of channels) {
      console.log(`    ${channel.name}...`);
      try {
        const result = await jjyApi.search({
          platform: cat.platform,
          categoryId: cat.catId,
          sort: cat.platform === 'temu' ? 'sold' :
                cat.platform === 'shein' ? 'sold' :
                cat.platform === 'amazon' ? 'monthSold' :
                cat.platform === 'sumaitong' ? 'totalSold' : 'totalSold',
          size: 10,
          page: 1
        });

        if (result.success && result.products.length > 0) {
          console.log(`      ✓ 获取 ${result.products.length} 个商品`);
          platformResults.channels.push({
            channel: channel.name,
            products: result.products
          });
          allResults.push(...result.products.map(p => ({
            ...p,
            source: cat.platform,
            category: cat.catName,
            channel: channel.name
          })));
        } else {
          console.log(`      ✗ 失败: ${result.error || '无数据'}`);
          platformResults.channels.push({
            channel: channel.name,
            error: result.error || '无数据'
          });
        }
      } catch (e) {
        console.log(`      ✗ 异常: ${e.message}`);
        platformResults.channels.push({
          channel: channel.name,
          error: e.message
        });
      }
    }

    // 平台结果保存
    const fs = require('fs');
    const outputDir = `./dailytemp/${today}`;
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(
      `${outputDir}/${cat.platform}_${cat.catId}.json`,
      JSON.stringify(platformResults, null, 2)
    );
  }

  // 保存所有原始数据
  const fs = require('fs');
  const outputDir = `./dailytemp/${today}`;
  fs.writeFileSync(
    `${outputDir}/raw_products.json`,
    JSON.stringify(allResults, null, 2)
  );

  console.log(`\n========== 采集完成 ==========`);
  console.log(`共获取 ${allResults.length} 个商品`);
  console.log(`数据已保存到: dailytemp/${today}/`);

  return allResults;
}

// 执行采集
crawl().catch(console.error);