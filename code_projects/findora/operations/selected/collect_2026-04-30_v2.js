/**
 * 选品采集脚本 - 2026-04-30
 *
 * 采集目标：5个平台各1个最久未采集的类目
 * - Temu: 31148 运动与户外用品
 * - Shein: 3657 汽车类
 * - Amazon: 2972638011 庭院、草坪和园艺
 * - 速卖通: 1511 手表
 * - TikTok: 600154 Textiles & Soft Furnishings
 */

const jjyApi = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 采集配置
const config = {
  // 每个平台/类目/子渠道采集数量
  topN: 10,
  // 子渠道配置
  subChannels: [
    { name: '热销商品', path: '/goods/hot-sale' },
    { name: '热销新品', path: '/goods/hot-sale-new' },
    { name: '新店热销', path: '/goods/new-mall-hot-sale' },
    { name: '大卖新品', path: '/goods/big-sale-new' }
  ],
  // 采集计划：平台 -> {类目ID, 类目名称}
  platforms: [
    { platform: 'temu', catId: 31148, catName: '运动与户外用品' },
    { platform: 'shein', catId: 3657, catName: '汽车类' },
    { platform: 'amazon', catId: 2972638011, catName: '庭院、草坪和园艺' },
    { platform: 'sumaitong', catId: 1511, catName: '手表' },
    { platform: 'tiktok', catId: 600154, catName: 'Textiles & Soft Furnishings' }
  ]
};

// 输出目录
const outputDir = path.join(__dirname, 'dailytemp', '2026-04-30');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function collect() {
  console.log('='.repeat(60));
  console.log('选品采集开始 - 2026-04-30');
  console.log('='.repeat(60));

  const jjy = new jjyApi();

  const allResults = [];
  let totalCollected = 0;

  for (const plan of config.platforms) {
    console.log(`\n>>> 采集 ${plan.platform} - ${plan.catName} (catId: ${plan.catId})`);

    // 平台结果
    const platformResults = {
      platform: plan.platform,
      catId: plan.catId,
      catName: plan.catName,
      collectedAt: new Date().toISOString(),
      channels: []
    };

    for (const channel of config.subChannels) {
      try {
        console.log(`   [${channel.name}] 采集中...`);

        // 热销商品和新店热销不传类目ID（类目筛选对这些渠道不适用）
        // 热销新品和大卖新品可以使用类目筛选
        const searchParams = {
          platform: plan.platform,
          size: config.topN,
          sort: plan.platform === 'temu' ? 'sold' :
                plan.platform === 'shein' ? 'sold' :
                plan.platform === 'amazon' ? 'monthSold' : 'totalSold'
        };

        // 添加类目筛选（部分平台部分渠道支持）
        if (channel.name === '热销新品' || channel.name === '大卖新品') {
          searchParams.categoryId = plan.catId;
        }

        const result = await jjy.search(searchParams);

        if (result.success && result.products.length > 0) {
          console.log(`      ✓ 获得 ${result.products.length} 个商品`);

          // 添加来源标记
          const productsWithMeta = result.products.map(p => ({
            ...p,
            _source: channel.name,
            _platform: plan.platform,
            _catId: plan.catId
          }));

          platformResults.channels.push({
            channel: channel.name,
            count: result.products.length,
            products: productsWithMeta
          });

          allResults.push(...productsWithMeta);
          totalCollected += result.products.length;
        } else {
          console.log(`      ○ 无数据或失败`);
          platformResults.channels.push({
            channel: channel.name,
            count: 0,
            error: result.error || '无数据'
          });
        }

        // 请求间隔
        await new Promise(r => setTimeout(r, 500));

      } catch (err) {
        console.log(`      ✗ 错误: ${err.message}`);
        platformResults.channels.push({
          channel: channel.name,
          count: 0,
          error: err.message
        });
      }
    }

    // 保存平台结果
    const platformFile = path.join(outputDir, `${plan.platform}_${plan.catId}.json`);
    fs.writeFileSync(platformFile, JSON.stringify(platformResults, null, 2));
    console.log(`   [${plan.platform}] 平台采集完成`);
  }

  // 合并所有结果
  const mergedFile = path.join(outputDir, 'all_products.json');
  fs.writeFileSync(mergedFile, JSON.stringify(allResults, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log(`采集完成！总计: ${totalCollected} 个商品`);
  console.log(`数据保存至: ${outputDir}`);
  console.log('='.repeat(60));

  return { totalCollected, products: allResults, outputDir };
}

// 执行
collect().then(result => {
  console.log('\n采集任务完成');
  process.exit(0);
}).catch(err => {
  console.error('采集失败:', err);
  process.exit(1);
});