/**
 * 2026-04-29 选品采集脚本
 * 采集每个平台最久未采集的类目
 */
const JJYAPITool = require('../../../tools/jjy_api.js');

const jjyApi = new JJYAPITool();

// 采集目标：每个平台选择最久未采集的类目
const targets = [
  { platform: 'temu', catId: 19858, catName: '汽车用品' },
  { platform: 'shein', catId: 2038, catName: '内衣和睡衣' },
  { platform: 'amazon', catId: 706813011, catName: '狩猎&渔具' },
  { platform: 'sumaitong', catId: 322, catName: '鞋子' },
  { platform: 'tiktok', catId: 856720, catName: 'Pre-Owned' }
];

// 4个子渠道
const channels = [
  { name: '热销商品', path: 'hot-sale' },
  { name: '热销新品', path: 'hot-sale-new' },
  { name: '新店热销', path: 'new-mall-hot-sale' },
  { name: '大卖新品', path: 'big-sale-new' }
];

async function crawl() {
  console.log('='.repeat(60));
  console.log('开始 2026-04-29 选品采集');
  console.log('='.repeat(60));

  const allResults = [];
  let productIdCounter = 1;

  for (const target of targets) {
    console.log(`\n[${target.platform.toUpperCase()}] 采集类目: ${target.catName} (ID: ${target.catId})`);

    for (const channel of channels) {
      console.log(`  └─ ${channel.name}...`);

      try {
        // 查询最近30天上架的商品，按销量排序
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          onSaleTimeStart: dateStr,
          size: 10,
          sort: 'sold'
        });

        if (result.success && result.products.length > 0) {
          console.log(`      获得 ${result.products.length} 个商品`);

          result.products.forEach(p => {
            allResults.push({
              id: `20260429-${String(productIdCounter++).padStart(3, '0')}`,
              platform: target.platform,
              category: target.catName,
              channel: channel.name,
              goodsNameEn: p.goodsNameEn,
              goodsNameCn: p.goodsNameCn,
              thumbnail: p.thumbnail,
              sold: p.sold,
              price: p.goodsPriceMin,
              reviewNum: p.reviewNum,
              rating: p.rating,
              onSaleTime: p.onSaleTime,
              goodsId: p.goodsId,
              source: `${target.platform} / ${target.catName} / ${channel.name}`
            });
          });
        } else {
          console.log(`      无数据或请求失败: ${result.error || 'unknown'}`);
        }

      } catch (e) {
        console.log(`      采集失败: ${e.message}`);
      }
    }
  }

  console.log(`\n总采集商品数: ${allResults.length}`);

  // 保存原始数据
  const fs = require('fs');
  const outputPath = __dirname + '/raw_products.json';
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf8');
  console.log(`原始数据已保存: ${outputPath}`);

  return allResults;
}

crawl().then(products => {
  console.log('\n采集完成!');
}).catch(e => {
  console.error('采集出错:', e);
  process.exit(1);
});