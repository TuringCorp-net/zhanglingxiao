/**
 * 选品采集脚本 - 2026-04-25 第二轮
 *
 * 每平台选1个"最久未采集"类目 × 4子渠道 × Top10
 * 使用 jjy_api.js 的 search API
 *
 * 本次采集计划：
 *   Temu:     办公用品 (catId 653)
 *   Shein:    服饰配饰 (catId 3631)
 *   Amazon:   艺术、手工艺 (catId 2617941011)
 *   速卖通:    电脑和办公 (catId 7)
 *   TikTok:   Sports & Outdoor (catId 603014)
 */

const JJYAPITool = require('../../../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 本次采集配置
const TODAY_SELECTIONS = {
  temu:       { catId: 653,          catName: "办公用品" },
  shein:      { catId: 3631,         catName: "服饰配饰" },
  amazon:     { catId: 2617941011,   catName: "艺术、手工艺" },
  sumaitong:  { catId: 7,            catName: "电脑和办公" },
  tiktok:     { catId: 603014,       catName: "Sports & Outdoor" }
};

// 4个子渠道
const SUB_CHANNELS = [
  {
    name: "热销商品",
    getParams: (platform) => ({ sort: null, order: 'descend', page: 1 })
  },
  {
    name: "热销新品",
    getParams: (platform) => ({ sort: 'createTime', order: 'descend', page: 1 })
  },
  {
    name: "新店热销",
    getParams: (platform) => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      const dateStr = d.toISOString().split('T')[0];
      return { sort: null, order: 'descend', page: 1, onSaleTimeStart: dateStr };
    }
  },
  {
    name: "大卖新品",
    getParams: (platform) => ({ sort: null, order: 'descend', page: 2 })
  }
];

const OUTPUT_DIR = __dirname;
const RAW_FILE = path.join(OUTPUT_DIR, 'raw_products_round2.json');

async function crawlAll() {
  const jjyApi = new JJYAPITool();
  const allRawProducts = [];

  console.log('='.repeat(60));
  console.log('选品采集任务 - 2026-04-25 第二轮');
  console.log('使用 JJY API search 接口');
  console.log('='.repeat(60));

  for (const [platform, config] of Object.entries(TODAY_SELECTIONS)) {
    console.log(`\n--- [${platform.toUpperCase()}] ${config.catName} (catId=${config.catId}) ---`);

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

          // 如果商品较少，补充无catId搜索
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
  }

  // 汇总统计
  const output = {
    crawlDate: "2026-04-25",
    crawlTime: new Date().toISOString(),
    round: 2,
    summary: {
      totalPlatforms: Object.keys(TODAY_SELECTIONS).length,
      totalRawProducts: allRawProducts.length
    },
    selections: TODAY_SELECTIONS,
    subChannels: SUB_CHANNELS.map(c => c.name),
    allRawProducts: allRawProducts
  };

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  fs.writeFileSync(RAW_FILE, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(60)}`);
  console.log(`采集完成!`);
  console.log(`平台数: ${output.summary.totalPlatforms}`);
  console.log(`去重后总商品: ${output.summary.totalRawProducts}`);
  console.log(`结果保存: ${RAW_FILE}`);
  console.log(`${'='.repeat(60)}`);

  return output;
}

crawlAll().catch(e => {
  console.error('采集失败:', e.message);
  process.exit(1);
});
