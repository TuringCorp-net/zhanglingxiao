/**
 * ============================================
 * 2026-04-29 选品采集脚本
 * ============================================
 *
 * 待采集类目（按"最久未采集"原则选择）：
 * 1. Temu - 家电 catId: 2096
 * 2. Shein - 工具和家居装修 catId: 4327
 * 3. Amazon - 健康与家居 catId: 3760901
 * 4. 速卖通 - 美容健康 catId: 66
 * 5. TikTok - Pet Supplies catId: 602118
 *
 * 每类目采集4个子渠道（热销商品、热销新品、新店热销、大卖新品）× Top 10
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 采集配置
const COLLECTION_CONFIG = {
  // 平台 + 最久未采集的类目
  targets: [
    { platform: 'temu', catId: 2096, catName: '家电', siteId: null },
    { platform: 'shein', catId: 4327, catName: '工具和家居装修', siteId: null },
    { platform: 'amazon', catId: 3760901, catName: '健康与家居', siteId: null },
    { platform: 'sumaitong', catId: 66, catName: '美容健康', siteId: 1 },
    { platform: 'tiktok', catId: 602118, catName: 'Pet Supplies', siteId: 1 }
  ],

  // 子渠道配置
  channels: [
    { name: '热销商品', sort: 'sold', page: 1, size: 10 },
    { name: '热销新品', sort: 'onSaleTime', order: 'descend', page: 1, size: 10 },
    { name: '新店热销', sort: 'mallOpenTime', order: 'ascend', page: 1, size: 10 },
    { name: '大卖新品', sort: 'monthSold', order: 'descend', page: 1, size: 10 }
  ],

  // 价格范围（USD）
  priceRange: { min: 5, max: 100 },

  // 时间范围（最近90天上架）
  timeRange: {
    start: '2026-01-29'  // 90天前
  }
};

// 存储采集结果
const collectedProducts = [];
const failedQueries = [];

async function collect() {
  const jjyApi = new JJYAPITool();

  console.log('==========================================');
  console.log('选品采集开始 - 2026-04-29');
  console.log('==========================================\n');

  // 遍历每个平台类目
  for (const target of COLLECTION_CONFIG.targets) {
    console.log(`\n>>> 采集 ${target.platform} - ${target.catName} (catId: ${target.catId})`);

    // 遍历每个子渠道
    for (const channel of COLLECTION_CONFIG.channels) {
      console.log(`    [${channel.name}] 排序: ${channel.sort}`);

      try {
        const params = {
          platform: target.platform,
          categoryId: target.catId,
          sort: channel.sort,
          order: channel.order || 'descend',
          page: channel.page,
          size: channel.size,
          priceMin: COLLECTION_CONFIG.priceRange.min,
          priceMax: COLLECTION_CONFIG.priceRange.max,
          onSaleTimeStart: COLLECTION_CONFIG.timeRange.start
        };

        // 速卖通和TikTok需要siteId
        if (target.siteId) {
          params.siteId = target.siteId;
        }

        const result = await jjyApi.search(params);

        if (result.success) {
          const count = result.products.length;
          console.log(`        ✓ 成功获取 ${count} 个商品`);

          // 添加元数据标记
          result.products.forEach(p => {
            p._collectionMeta = {
              platform: target.platform,
              catId: target.catId,
              catName: target.catName,
              channel: channel.name,
              sortField: channel.sort,
              collectedAt: new Date().toISOString()
            };
          });

          collectedProducts.push(...result.products);
        } else {
          console.log(`        ✗ 失败: ${result.error}`);
          failedQueries.push({
            platform: target.platform,
            catId: target.catId,
            channel: channel.name,
            error: result.error
          });
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`        ✗ 异常: ${e.message}`);
        failedQueries.push({
          platform: target.platform,
          catId: target.catId,
          channel: channel.name,
          error: e.message
        });
      }
    }
  }

  // 去重（基于 goodsId）
  const uniqueProducts = [];
  const seenIds = new Set();
  for (const p of collectedProducts) {
    const key = `${p.platform}-${p.goodsId}`;
    if (!seenIds.has(key)) {
      seenIds.add(key);
      uniqueProducts.push(p);
    }
  }

  console.log('\n==========================================');
  console.log('采集完成');
  console.log(`总计: ${collectedProducts.length} 个商品（含重复）`);
  console.log(`去重后: ${uniqueProducts.length} 个商品`);
  console.log(`失败查询: ${failedQueries.length} 个`);
  console.log('==========================================');

  // 保存结果
  const fs = require('fs');
  const resultPath = __dirname + '/dailytemp/2026-04-29/raw_products.json';
  fs.writeFileSync(resultPath, JSON.stringify({
    collectedAt: new Date().toISOString(),
    totalProducts: uniqueProducts.length,
    rawCount: collectedProducts.length,
    failedQueries,
    products: uniqueProducts
  }, null, 2));

  console.log(`\n结果已保存: ${resultPath}`);

  return { products: uniqueProducts, failedQueries };
}

// 执行采集
if (require.main === module) {
  collect().then(result => {
    console.log('\n采集任务完成!');
    process.exit(0);
  }).catch(e => {
    console.error('采集失败:', e);
    process.exit(1);
  });
}

module.exports = { collect, COLLECTION_CONFIG };
