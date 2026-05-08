/**
 * 选品采集脚本 — 2026-05-05 (第2轮)
 *
 * 按 crawl_state.js 规则，每平台选择"最久未采集"的类目（排除今早已采集的）：
 * - TEMU:     家电 (2096)                      上次: 2026-04-29
 * - Shein:    玩具和游戏 (4328)                 上次: 2026-04-28
 * - Amazon:   服装、鞋履和珠宝 (7141123011)      上次: 2026-04-27
 * - 速卖通:   运动鞋服及包配 (201768104)         上次: null (从未采集)
 * - TikTok:   Home Improvement (604968)         上次: 2026-04-27
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
    catId: 2096,
    catName: '家电',
    sort: 'sold'
  },
  {
    platform: 'shein',
    platformName: 'Shein',
    catId: 4328,
    catName: '玩具和游戏',
    sort: 'sold'
  },
  {
    platform: 'amazon',
    platformName: 'Amazon',
    catId: 7141123011,
    catName: '服装、鞋履和珠宝',
    sort: 'monthSold'
  },
  {
    platform: 'sumaitong',
    platformName: '速卖通',
    catId: 201768104,
    catName: '运动鞋服及包配',
    sort: 'totalSold'
  },
  {
    platform: 'tiktok',
    platformName: 'TikTok',
    catId: 604968,
    catName: 'Home Improvement',
    sort: 'totalSold'
  }
];

// 4个子渠道的搜索策略
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
  const outputDir = path.join(__dirname, 'dailytemp', '2026-05-05-v2');
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

      if (ch.params.sort) {
        searchParams.sort = ch.params.sort;
      } else {
        searchParams.sort = target.sort;
      }
      searchParams.order = 'descend';

      if (ch.params.onSaleTimeStart) {
        searchParams.onSaleTimeStart = ch.params.onSaleTimeStart;
      }
      if (ch.params.onSaleTimeEnd) {
        searchParams.onSaleTimeEnd = ch.params.onSaleTimeEnd;
      }

      // sumaitong 和 tiktok 需要 siteId
      if (target.platform === 'sumaitong' || target.platform === 'tiktok') {
        searchParams.siteId = 1;
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
  let successPlatforms = 0;
  let failPlatforms = 0;
  for (const [platform, data] of Object.entries(allResults)) {
    const successCount = data.subChannels.filter(r => r.success).length;
    console.log(`${data.platform} (${data.catName}): ${data.totalProducts} 个商品 (${successCount}/${data.subChannels.length} 子渠道成功)`);
    grandTotal += data.totalProducts;
    if (data.totalProducts > 0) successPlatforms++;
    else failPlatforms++;
  }
  console.log(`总计: ${grandTotal} 个商品, ${successPlatforms} 平台成功, ${failPlatforms} 平台失败`);
  console.log(`\n[采集] 完成!`);

  // 输出JSON供后续筛选使用
  console.log('\n[JSON_OUTPUT]');
  console.log(JSON.stringify({ grandTotal, successPlatforms, failPlatforms, outputFile: rawFile }));
}

main().catch(e => {
  console.error('[采集] 致命错误:', e.message);
  console.log('\n[JSON_OUTPUT]');
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
