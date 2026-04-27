/**
 * 选品采集脚本 - 2026-04-27
 * 按crawl_state规则：每平台选1个"最久未采集"的类目，4个子渠道各取Top10
 */
const JJYAPITool = require('../tools/jjy_api');

const CRAWL_CONFIG = {
  // 每平台最久未采集的类目
  targets: [
    { platform: 'temu', catId: 17719, catName: '乐器' },
    { platform: 'shein', catId: 2400, catName: '宠物用品' },
    { platform: 'amazon', catId: 172282, catName: '电子产品' },
    { platform: 'sumaitong', catId: 36, catName: '珠宝饰品及配件' },
    { platform: 'tiktok', catId: 700645, catName: 'Health' }
  ],
  // 4个子渠道
  channels: ['热销商品', '热销新品', '新店热销', '大卖新品'],
  // 每渠道取Top10
  topN: 10
};

async function run() {
  const jjyApi = new JJYAPITool();
  const results = {};
  const errors = [];

  console.log('=== 选品采集开始 ===');
  console.log(`目标平台: ${CRAWL_CONFIG.targets.map(t => t.platform).join(', ')}`);
  console.log(`采集时间: ${new Date().toISOString()}\n`);

  for (const target of CRAWL_CONFIG.targets) {
    console.log(`\n--- ${target.platform} / ${target.catName} (catId: ${target.catId}) ---`);
    results[target.platform] = { category: target.catName, products: [], errors: [] };

    for (const channel of CRAWL_CONFIG.channels) {
      try {
        console.log(`  [${channel}] 采集ing...`);
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          sort: 'sold',
          order: 'descend',
          size: CRAWL_CONFIG.topN
        });

        if (result.success) {
          console.log(`    成功: ${result.products.length} 个商品`);
          results[target.platform].products.push({
            channel,
            items: result.products
          });
        } else {
          console.log(`    失败: ${result.error}`);
          results[target.platform].errors.push({ channel, error: result.error });
        }
      } catch (e) {
        console.log(`    异常: ${e.message}`);
        results[target.platform].errors.push({ channel, error: e.message });
      }

      // 间隔500ms避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }
  }

  // 输出结果统计
  console.log('\n\n=== 采集结果统计 ===');
  for (const [platform, data] of Object.entries(results)) {
    const total = data.products.reduce((sum, p) => sum + p.items.length, 0);
    console.log(`${platform}: ${total} 个商品 (${data.errors.length} 个失败)`);
  }

  // 保存到临时目录
  const fs = require('fs');
  const outputPath = 'operations/selected/dailytemp/2026-04-27/raw_data.json';
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n原始数据已保存: ${outputPath}`);

  return results;
}

run().catch(console.error);