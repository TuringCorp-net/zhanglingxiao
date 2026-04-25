/**
 * 选品采集脚本 - 2026-04-25
 *
 * 每平台选1个"最久未采集"类目 × 4子渠道 × Top10
 * 使用 jjy_api.js 的 search API
 *
 * 子渠道模拟策略（因统一API只有 /api/v1/goods/search）：
 *   热销商品: sort=平台默认销量排序
 *   热销新品: sort=createTime（最新上架）
 *   新店热销: sort=平台默认销量排序 + onSaleTimeStart=30天前
 *   大卖新品: sort=平台默认销量排序 + page=2（翻页更多选择）
 */

const JJYAPITool = require('../../../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 今日选品配置：每平台选第一个 lastCrawled=null 的类目
const TODAY_SELECTIONS = {
  temu:       { catId: 1,      catName: "CD和黑胶唱片" },
  shein:      { catId: 2032,   catName: "家居与生活" },
  amazon:     { catId: 2619525011, catName: "家电" },
  sumaitong:  { catId: 6,      catName: "家用电器" },
  tiktok:     { catId: 604206, catName: "Toys & Hobbies" }
};

// 4个子渠道，通过 search 参数区分
const SUB_CHANNELS = [
  {
    name: "热销商品",
    getParams: (platform) => ({ sort: null, order: 'descend', page: 1 })
    // sort=null 使用平台默认（sold/totalSold）
  },
  {
    name: "热销新品",
    getParams: (platform) => ({ sort: 'createTime', order: 'descend', page: 1 })
    // 按上架时间排序 = 最新商品
  },
  {
    name: "新店热销",
    getParams: (platform) => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const dateStr = d.toISOString().split('T')[0];
      return { sort: null, order: 'descend', page: 1, onSaleTimeStart: dateStr };
    }
    // 最近30天上架的热销商品
  },
  {
    name: "大卖新品",
    getParams: (platform) => ({ sort: null, order: 'descend', page: 2 })
    // 销量排序第2页 = 更多热销商品
  }
];

const OUTPUT_DIR = __dirname;
const RAW_FILE = path.join(OUTPUT_DIR, 'raw_products.json');

async function crawlAll() {
  const jjyApi = new JJYAPITool();
  const allResults = {};
  const allRawProducts = [];

  console.log('='.repeat(60));
  console.log('选品采集任务 - 2026-04-25');
  console.log('使用 JJY API search 接口');
  console.log('='.repeat(60));

  for (const [platform, config] of Object.entries(TODAY_SELECTIONS)) {
    console.log(`\n--- [${platform.toUpperCase()}] ${config.catName} (catId=${config.catId}) ---`);
    const platformResults = {};

    for (const channel of SUB_CHANNELS) {
      console.log(`  [${channel.name}] 正在查询...`);

      const channelParams = channel.getParams(platform);

      let channelProducts = [];
      let channelError = null;

      try {
        const result = await jjyApi.search({
          platform,
          categoryId: config.catId,
          size: 10,
          ...channelParams
        });

        if (result.success) {
          channelProducts = result.products || [];
          console.log(`  [${channel.name}] ✓ 获取 ${channelProducts.length} 个商品 (total=${result.total})`);

          // 如果 total 很少（小类目），补充无 catId 搜索
          if (channelProducts.length < 5 && result.total < 20) {
            console.log(`  [${channel.name}] 类目商品少，补充平台级热门...`);
            try {
              const supplement = await jjyApi.search({
                platform,
                size: 5,
                sort: channelParams.sort,
                order: channelParams.order || 'descend'
              });
              if (supplement.success && supplement.products.length > 0) {
                channelProducts = channelProducts.concat(supplement.products);
                console.log(`  [${channel.name}] 补充后共 ${channelProducts.length} 个商品`);
              }
            } catch (e) { /* ignore */ }
          }
        } else {
          channelError = result.error || '未知错误';
          console.log(`  [${channel.name}] ✗ ${channelError}`);
        }
      } catch (e) {
        channelError = e.message;
        console.log(`  [${channel.name}] ✗ 异常: ${channelError}`);
      }

      platformResults[channel.name] = {
        success: !channelError,
        error: channelError,
        count: channelProducts.length,
        products: channelProducts
      };

      // 收集所有原始商品（去重：按 goodsId）
      const seen = new Set();
      for (const p of allRawProducts) seen.add(p.goodsId);
      for (const p of channelProducts) {
        if (!seen.has(p.goodsId)) {
          seen.add(p.goodsId);
          allRawProducts.push({
            ...p,
            _sourcePlatform: platform,
            _sourceChannel: channel.name,
            _sourceCatId: config.catId,
            _sourceCatName: config.catName
          });
        }
      }
    }

    allResults[platform] = {
      catId: config.catId,
      catName: config.catName,
      channels: platformResults
    };
  }

  // 汇总统计
  let totalWithProducts = 0;
  for (const [p, data] of Object.entries(allResults)) {
    for (const [ch, chData] of Object.entries(data.channels)) {
      if (chData.count > 0) totalWithProducts++;
    }
  }

  const output = {
    crawlDate: "2026-04-25",
    crawlTime: new Date().toISOString(),
    summary: {
      totalPlatforms: Object.keys(TODAY_SELECTIONS).length,
      totalSubChannels: Object.keys(TODAY_SELECTIONS).length * SUB_CHANNELS.length,
      subChannelsWithResults: totalWithProducts,
      totalRawProducts: allRawProducts.length
    },
    selections: TODAY_SELECTIONS,
    subChannels: SUB_CHANNELS.map(c => c.name),
    results: allResults,
    allRawProducts: allRawProducts
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(RAW_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`采集完成!`);
  console.log(`平台数: ${output.summary.totalPlatforms}`);
  console.log(`子渠道×平台: ${output.summary.totalSubChannels}`);
  console.log(`有效子渠道: ${output.summary.subChannelsWithResults}`);
  console.log(`去重后总商品: ${output.summary.totalRawProducts}`);
  console.log(`结果保存: ${RAW_FILE}`);
  console.log(`${'='.repeat(60)}`);

  return output;
}

crawlAll().catch(e => {
  console.error('采集失败:', e.message);
  process.exit(1);
});
