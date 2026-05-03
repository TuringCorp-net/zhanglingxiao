/**
 * 选品采集脚本 - 2026-05-03
 *
 * 工作流程：
 * 1. 按 crawl_state.js 记录的 lastCrawled，找出每平台最久未采集的类目
 * 2. 使用 jjy_api.js 执行采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 3. 落盘到 operations/selected/dailytemp/YYYY-MM-DD/
 */

// 引入依赖
const JJYAPITool = require('./operations/tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 日期
const today = '2026-05-03';
const dateStr = today.replace(/-/g, ''); // 20260503
const tempDir = path.join(__dirname, 'operations/selected/dailytemp', today);

// 确保目录存在
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 每个平台最久未采集的类目（基于 crawl_state.js）
const targets = [
  {
    platform: 'temu',
    catId: 17719,
    catName: '乐器',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'shein',
    catId: 2026,
    catName: '男人',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'amazon',
    catId: 283155,
    catName: '图书',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'sumaitong',
    catId: 200000532,
    catName: '新奇特及特殊用途服装',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'tiktok',
    catId: 802184,
    catName: 'Kids Fashion',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  }
];

// 子渠道端点映射
const channelPaths = {
  '热销商品': '/goods/hot-sale',
  '热销新品': '/goods/hot-sale-new',
  '新店热销': '/goods/new-mall-hot-sale',
  '大卖新品': '/goods/big-sale-new'
};

// 子渠道搜索关键词映射（用于4子渠道×10）
const channelKeywords = {
  '热销商品': 'trending popular',
  '热销新品': 'new arrival',
  '新店热销': 'new store',
  '大卖新品': 'bestseller'
};

async function run() {
  console.log('='.repeat(60));
  console.log('选品采集开始 - ' + new Date().toISOString());
  console.log('='.repeat(60));

  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  // 初始化
  console.log('\n[1] 初始化 JJY API...');
  try {
    await jjyApi.init();
  } catch (e) {
    console.error('初始化失败:', e.message);
    errors.push({ type: 'init', error: e.message });
  }

  // 执行采集
  console.log('\n[2] 开始采集...');
  for (const target of targets) {
    console.log(`\n>>> 平台: ${target.platform} | 类目: ${target.catName} (${target.catId})`);

    for (const channel of target.channels) {
      const keySuffix = channelKeywords[channel] || 'popular';
      console.log(`    ${channel}...`);

      try {
        // 搜索该类目下的热销商品（4个渠道，每个取10个）
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          keyword: keySuffix,
          size: 10,
          sort: target.platform === 'amazon' ? 'monthSold' : 'sold'
        });

        if (result.success && result.products.length > 0) {
          // 为每个商品添加元数据
          result.products.forEach(p => {
            p._source = {
              platform: target.platform,
              catId: target.catId,
              catName: target.catName,
              channel: channel,
              crawlTime: new Date().toISOString()
            };
          });

          allProducts.push(...result.products);
          console.log(`      获取到 ${result.products.length} 个商品`);
        } else {
          console.log(`      无数据或失败: ${result.error || 'unknown'}`);
          errors.push({
            type: 'search',
            platform: target.platform,
            catId: target.catId,
            channel: channel,
            error: result.error || 'no data'
          });
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.error(`      错误: ${e.message}`);
        errors.push({
          type: 'exception',
          platform: target.platform,
          catId: target.catId,
          channel: channel,
          error: e.message
        });
      }
    }
  }

  // 落盘原始数据
  console.log('\n[3] 落盘原始数据...');
  const rawFile = path.join(tempDir, `raw_${dateStr}.json`);
  fs.writeFileSync(rawFile, JSON.stringify({
    date: today,
    total: allProducts.length,
    errors: errors,
    products: allProducts
  }, null, 2), 'utf8');
  console.log(`写入: ${rawFile} (${allProducts.length} 个商品)`);

  // 输出统计
  console.log('\n[4] 采集统计:');
  console.log(`    总商品数: ${allProducts.length}`);
  console.log(`    错误数: ${errors.length}`);

  // 按平台统计
  const platformStats = {};
  for (const p of allProducts) {
    const plat = p._source?.platform || 'unknown';
    platformStats[plat] = (platformStats[plat] || 0) + 1;
  }
  console.log('    按平台分布:');
  for (const [plat, count] of Object.entries(platformStats)) {
    console.log(`      ${plat}: ${count}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('采集完成！');
  console.log('='.repeat(60));

  return { allProducts, errors, tempDir, dateStr };
}

// 运行
run().then(result => {
  console.log('\n返回结果供筛选使用...');
  module.exports = result;
}).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});