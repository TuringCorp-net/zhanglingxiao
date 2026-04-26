/**
 * 选品采集脚本 - 按crawl_state规则执行
 * 采集目标：每个平台最久未采集的类目 × 4子渠道 × Top10
 */
const JJYAPITool = require('../tools/jjy_api.js');

// crawl_state.js 中的采集目标（每个平台最久未采集的类目）
const targetCategories = {
  temu: { catId: 4673, catName: '工业和科学', siteId: null },
  shein: { catId: 3650, catName: '家电', siteId: null },
  amazon: { catId: 3760911, catName: '美容与护理', siteId: null },
  sumaitong: { catId: 18, catName: '运动及娱乐', siteId: 1 },
  tiktok: { catId: 605248, catName: 'Fashion Accessories', siteId: 1 }
};

// 子渠道配置
const channels = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

async function runCrawl() {
  console.log('========== 选品采集开始 ==========');
  console.log(`采集时间: ${new Date().toISOString()}`);
  console.log('');

  const jjyApi = new JJYAPITool();
  const allResults = [];

  // 遍历每个平台
  for (const [platform, target] of Object.entries(targetCategories)) {
    console.log(`\n>>> 处理 ${platform} - ${target.catName} (catId=${target.catId})`);
    console.log('='.repeat(50));

    let platformResult = {
      platform,
      catName: target.catName,
      catId: target.catId,
      channels: []
    };

    // 确定排序字段
    const sortField = platform === 'amazon' ? 'monthSold' :
                     (platform === 'sumaitong' || platform === 'tiktok') ? 'totalSold' : 'sold';

    // 遍历4个子渠道
    for (const channel of channels) {
      console.log(`\n  [${channel.name}]`);

      try {
        // 调用API获取该平台+类目的Top10商品
        const result = await jjyApi.search({
          platform,
          categoryId: target.catId,
          size: 10,
          sort: sortField
        });

        if (result.success && result.products && result.products.length > 0) {
          console.log(`    获得 ${result.products.length} 个商品`);

          // 标记来源渠道
          const productsWithChannel = result.products.map((p, idx) => ({
            ...p,
            channel: channel.name,
            channelIndex: idx + 1,
            fullIndex: `${platform}_${channel.name}_${idx + 1}`
          }));

          platformResult.channels.push({
            channelName: channel.name,
            success: true,
            products: productsWithChannel
          });

          // 累加到总结果
          allResults.push(...productsWithChannel);
        } else {
          console.log(`    未获取到数据 ${result.error || ''}`);
          platformResult.channels.push({
            channelName: channel.name,
            success: false,
            error: result.error || '无数据'
          });
        }
      } catch (e) {
        console.log(`    错误: ${e.message}`);
        platformResult.channels.push({
          channelName: channel.name,
          success: false,
          error: e.message
        });
      }

      // 每个平台之间稍微延迟
      await new Promise(r => setTimeout(r, 500));
    }

    const totalCount = platformResult.channels.reduce((sum, ch) => sum + (ch.success ? ch.products.length : 0), 0);
    console.log(`  [${platform}] 小计: ${totalCount} 个商品`);
  }

  console.log('\n========== 采集完成 ==========');
  console.log(`总计获取: ${allResults.length} 个商品`);

  return allResults;
}

// 导出采集函数
module.exports = { runCrawl, targetCategories, channels };

// 直接运行
if (require.main === module) {
  (async () => {
    const results = await runCrawl();
    console.log('\n采集结果预览（前5个）:');
    results.slice(0, 5).forEach((p, i) => {
      console.log(`${i+1}. [${p.platform}/${p.channel}] ${p.goodsNameEn?.substring(0, 40)}...`);
      console.log(`   销量: ${p.sold}, 价格: ${p.goodsPriceMin}-${p.goodsPriceMax}`);
    });
  })();
}