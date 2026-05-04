/**
 * 选品采集脚本 - 2026-05-04
 *
 * 工作流程：
 * 1. 读取 crawl_state，按 lastCrawled 排序找出每个平台最久未采集的类目
 * 2. 使用 jjy_api.js 获取每个类目在4个子渠道的数据（每个渠道Top10）
 * 3. 落盘到 dailytemp/2026-05-04/
 * 4. 返回采集结果供筛选
 *
 * 本次采集类目：
 * - temu: 玩具与游戏 (catId=25439) - 距上次采集7天+
 * - shein: 珠宝和手表 (catId=3634) - 距上次采集7天+
 * - amazon: 视频游戏 (catId=468642) - 距上次采集7天+
 * - sumaitong: 办公、文化及教育用品 (catId=21) - 距上次采集8天+
 * - tiktok: Beauty & Personal Care (catId=601450) - 距上次采集8天+
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 今日目录
const today = '2026-05-04';
const tempDir = path.join(__dirname, 'dailytemp', today);

// 确保目录存在
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

async function main() {
  console.log('='.repeat(60));
  console.log(`选品采集开始 - ${today}`);
  console.log('='.repeat(60));

  const jjyApi = new JJYAPITool();
  await jjyApi.init();

  const results = {
    timestamp: new Date().toISOString(),
    platforms: {}
  };

  // 本次采集的类目配置（从 crawl_state 分析得出）
  const targetCategories = [
    { platform: 'temu', catId: 25439, catName: '玩具与游戏', sort: 'sold' },
    { platform: 'shein', catId: 3634, catName: '珠宝和手表', sort: 'sold' },
    { platform: 'amazon', catId: 468642, catName: '视频游戏', sort: 'monthSold' },
    { platform: 'sumaitong', catId: 21, catName: '办公、文化及教育用品', sort: 'totalSold', siteId: 1 },
    { platform: 'tiktok', catId: 601450, catName: 'Beauty & Personal Care', sort: 'totalSold', siteId: 1 }
  ];

  // 4个子渠道配置
  const channels = [
    { name: 'hot-sale', title: '热销商品' },
    { name: 'hot-sale-new', title: '热销新品' },
    { name: 'new-mall-hot-sale', title: '新店热销' },
    { name: 'big-sale-new', title: '大卖新品' }
  ];

  for (const target of targetCategories) {
    console.log(`\n>>> 采集 ${target.platform} - ${target.catName}`);
    results.platforms[target.platform] = {
      catId: target.catId,
      catName: target.catName,
      channels: {}
    };

    for (const channel of channels) {
      console.log(`   [${channel.title}]...`);

      try {
        // 构建搜索参数 - 使用categoryId筛选
        const searchParams = {
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort,
          page: 1,
          size: 10
        };

        // sumaitong 和 tiktok 需要 siteId
        if (target.siteId) {
          searchParams.siteId = target.siteId;
        }

        const result = await jjyApi.search(searchParams);

        results.platforms[target.platform].channels[channel.name] = {
          title: channel.title,
          success: result.success,
          total: result.total || 0,
          products: result.products || []
        };

        if (result.success && result.products.length > 0) {
          console.log(`      ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`      ✗ 获取失败: ${result.error || '无数据'}`);
        }

        // 避免请求过快
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`      ✗ 异常: ${e.message}`);
        results.platforms[target.platform].channels[channel.name] = {
          title: channel.title,
          success: false,
          error: e.message,
          products: []
        };
      }
    }
  }

  // 保存原始数据
  const outputPath = path.join(tempDir, 'raw_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\n✓ 原始数据已保存到: ${outputPath}`);

  // 统计汇总
  let totalProducts = 0;
  let successChannels = 0;

  for (const [platform, data] of Object.entries(results.platforms)) {
    for (const [channel, channelData] of Object.entries(data.channels)) {
      if (channelData.success) {
        successChannels++;
        totalProducts += channelData.products.length;
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('采集汇总:');
  console.log(`  - 平台: 5`);
  console.log(`  - 成功渠道: ${successChannels}/20`);
  console.log(`  - 总商品数: ${totalProducts}`);
  console.log('='.repeat(60));

  // 返回结果供后续筛选
  return results;
}

main().then(results => {
  process.stdout.write(JSON.stringify(results));
}).catch(e => {
  console.error('采集失败:', e);
  process.exit(1);
});