/**
 * 选品采集脚本 — 2026-05-05
 *
 * 按 crawl_state.js 规则，每平台选择"最久未采集"的类目：
 * - TEMU:     手机和配件 (24252)           上次: 2026-04-28
 * - Shein:    女装 (4436)                    上次: 2026-04-27
 * - Amazon:   杂货店 (16310101)              上次: 2026-04-27
 * - 速卖通:   男女内衣及家居服 (200574005)   上次: null (从未采集)
 * - TikTok:   Health (700645)                上次: 2026-04-27
 *
 * 每平台4子渠道 × Top10 = 每平台40个 = 共200个候选商品
 * 时间范围：最近30天（2026-04-05 ~ 2026-05-05）
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 日期
const TODAY = '2026-05-05';
const DAYS_30_AGO = '2026-04-05';

// 本次采集目标
const TARGETS = [
  {
    platform: 'temu',
    platformName: 'Temu',
    catId: 24252,
    catName: '手机和配件',
    sort: 'sold'
  },
  {
    platform: 'shein',
    platformName: 'Shein',
    catId: 4436,
    catName: '女装',
    sort: 'sold'
  },
  {
    platform: 'amazon',
    platformName: 'Amazon',
    catId: 16310101,
    catName: '杂货店',
    sort: 'monthSold'
  },
  {
    platform: 'sumaitong',
    platformName: '速卖通',
    catId: 200574005,
    catName: '男女内衣及家居服',
    sort: 'totalSold'
  },
  {
    platform: 'tiktok',
    platformName: 'TikTok',
    catId: 700645,
    catName: 'Health',
    sort: 'totalSold'
  }
];

// 4个子渠道的搜索策略
// 由于API不直接支持"子渠道"概念，用不同参数组合模拟
const SUB_CHANNELS = [
  { name: '热销商品', desc: '按销量排序，不限时间', params: { sort: null, onSaleTimeStart: null, onSaleTimeEnd: null } },
  { name: '热销新品', desc: '按销量排序，最近30天上架', params: { sort: null, onSaleTimeStart: DAYS_30_AGO, onSaleTimeEnd: TODAY } },
  { name: '高评分热销', desc: '按评论数排序，不限时间', params: { sort: 'reviewNum', onSaleTimeStart: null, onSaleTimeEnd: null } },
  { name: '最近新品', desc: '按上架时间排序，最近30天', params: { sort: 'createTime', onSaleTimeStart: DAYS_30_AGO, onSaleTimeEnd: TODAY } }
];

async function main() {
  const jjyApi = new JJYAPITool();

  // 初始化
  console.log('[采集] 初始化 JJY API...');
  await jjyApi.init();
  console.log('[采集] 初始化完成\n');

  const allResults = {};
  const outputDir = path.join(__dirname, 'dailytemp', '2026-05-05');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // 逐个平台采集
  for (const target of TARGETS) {
    console.log(`\n========== ${target.platformName} | ${target.catName} (catId=${target.catId}) ==========`);

    const platformResults = [];

    for (const ch of SUB_CHANNELS) {
      console.log(`  [${ch.name}] ${ch.desc}`);

      const searchParams = {
        platform: target.platform,
        categoryId: target.catId,
        size: 10,
        page: 1
      };

      // 设置排序
      if (ch.params.sort) {
        searchParams.sort = ch.params.sort;
      } else {
        // 使用平台默认销量排序
        searchParams.sort = target.sort;
      }
      searchParams.order = 'descend';

      // 设置时间范围
      if (ch.params.onSaleTimeStart) {
        searchParams.onSaleTimeStart = ch.params.onSaleTimeStart;
      }
      if (ch.params.onSaleTimeEnd) {
        searchParams.onSaleTimeEnd = ch.params.onSaleTimeEnd;
      }

      try {
        const result = await jjyApi.search(searchParams);

        if (result.success && result.products.length > 0) {
          console.log(`    ✓ 获取到 ${result.products.length} 个商品 (总计 ${result.total})`);
        } else if (result.success) {
          console.log(`    △ 返回0个商品 (总计 ${result.total})`);
        } else {
          console.log(`    ✗ 失败: ${result.error}`);
        }

        platformResults.push({
          subChannel: ch.name,
          params: searchParams,
          success: result.success,
          total: result.total || 0,
          count: result.products ? result.products.length : 0,
          error: result.error || null,
          products: result.products || []
        });

        // 子渠道间短暂延迟，避免触发反爬
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
        platformResults.push({
          subChannel: ch.name,
          params: searchParams,
          success: false,
          total: 0,
          count: 0,
          error: e.message,
          products: []
        });
      }
    }

    allResults[target.platform] = {
      platform: target.platformName,
      catId: target.catId,
      catName: target.catName,
      subChannels: platformResults,
      totalProducts: platformResults.reduce((sum, r) => sum + r.count, 0)
    };

    console.log(`  汇总: ${allResults[target.platform].totalProducts} 个商品`);
  }

  // 保存原始数据
  const rawFile = path.join(outputDir, 'raw_products.json');
  fs.writeFileSync(rawFile, JSON.stringify(allResults, null, 2), 'utf-8');
  console.log(`\n[采集] 原始数据已保存: ${rawFile}`);

  // 统计数据
  console.log('\n========== 采集汇总 ==========');
  let grandTotal = 0;
  for (const [platform, data] of Object.entries(allResults)) {
    console.log(`${data.platform} (${data.catName}): ${data.totalProducts} 个商品`);
    grandTotal += data.totalProducts;
  }
  console.log(`总计: ${grandTotal} 个商品`);

  console.log('\n[采集] 完成!');
}

main().catch(e => {
  console.error('[采集] 致命错误:', e.message);
  process.exit(1);
});
