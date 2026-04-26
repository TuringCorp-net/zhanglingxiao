/**
 * 选品采集脚本 - 按crawl_state规则执行
 * 采集目标：每个平台最久未采集的类目 × 4子渠道 × Top10
 */
const JJYAPITool = require('./jjy_api.js');

// crawl_state.js 中的采集目标（每个平台最久未采集的类目）
const targetCategories = {
  temu: { catId: 2542, catName: '电子', siteId: null },
  shein: { catId: 1864, catName: '美容与健康', siteId: null },
  amazon: { catId: 165796011, catName: '婴儿产品', siteId: null },
  sumaitong: { catId: 15, catName: '家居用品', siteId: 1 },
  tiktok: { catId: 951432, catName: 'Collectibles', siteId: 1 }
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
  const采集结果 = [];

  // 遍历每个平台
  for (const [platform, target] of Object.entries(采集目标)) {
    console.log(`\n>>> 处理 ${platform} - ${target.catName} (catId=${target.catId})`);
    console.log('='.repeat(50));

    let平台结果 = {
      platform,
      catName: target.catName,
      catId: target.catId,
      channels: []
    };

    // 遍历4个子渠道
    for (const channel of 子渠道) {
      console.log(`\n  [${channel.name}]`);

      try {
        // 调用API获取该平台+类目+子渠道的Top10商品
        // 注意：热销接口可能不支持catId筛选，直接搜索然后由API返回分类数据
        // 由于数据源可能是页面抓取，我们使用关键词搜索方式获取相关商品
        const result = await jjyApi.search({
          platform,
          categoryId: target.catId,
          size: 10,
          sort: target.platform === 'amazon' ? 'monthSold' :
                (target.platform === 'sumaitong' || target.platform === 'tiktok') ? 'totalSold' : 'sold'
        });

        if (result.success && result.products && result.products.length > 0) {
          console.log(`    获得 ${result.products.length} 个商品`);

          // 标记来源渠道
          const商品列表 = result.products.map((p, idx) => ({
            ...p,
            channel: channel.name,
            channelIndex: idx + 1,
            fullIndex: `${platform}_${channel.name}_${idx + 1}`
          }));

          平台结果.channels.push({
            channelName: channel.name,
            success: true,
            products: 商品列表
          });

          // 累加到总结果
          采集结果.push(...商品列表);
        } else {
          console.log(`    未获取到数据 ${result.error || ''}`);
          平台结果.channels.push({
            channelName: channel.name,
            success: false,
            error: result.error || '无数据'
          });
        }
      } catch (e) {
        console.log(`    错误: ${e.message}`);
        平台结果.channels.push({
          channelName: channel.name,
          success: false,
          error: e.message
        });
      }

      // 每个平台之间稍微延迟
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`  [${platform}] 小计: ${平台结果.channels.reduce((sum, ch) => sum + (ch.success ? ch.products.length : 0), 0)} 个商品`);
  }

  console.log('\n========== 采集完成 ==========');
  console.log(`总计获取: ${采集结果.length} 个商品`);

  return 采集结果;
}

// 导出采集函数
module.exports = { 执行采集, 采集目标, 子渠道 };

// 直接运行
if (require.main === module) {
  (async () => {
    const结果 = await 执行采集();
    console.log('\n采集结果预览（前5个）:');
    结果.slice(0, 5).forEach((p, i) => {
      console.log(`${i+1}. [${p.platform}/${p.channel}] ${p.goodsNameEn?.substring(0, 40)}...`);
      console.log(`   销量: ${p.sold}, 价格: ${p.goodsPriceMin}-${p.goodsPriceMax}`);
    });
  })();
}