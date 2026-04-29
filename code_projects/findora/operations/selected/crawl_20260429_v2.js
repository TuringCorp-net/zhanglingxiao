/**
 * 选品采集脚本 - 2026-04-29 第二轮
 *
 * 目标类目：
 * 1. Temu: 视频游戏 (catId=23177, lastCrawled=null)
 * 2. Shein: 宝贝儿 (catId=3224, lastCrawled=null)
 * 3. Amazon: 狩猎&渔具 (catId=706813011, lastCrawled=null)
 * 4. 速卖通: 电话和通讯 (catId=509, lastCrawled=null)
 * 5. TikTok: Pre-Owned (catId=856720, lastCrawled=null)
 *
 * 每类目 × 4子渠道 × Top10 = 200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 目标类目配置
const targetCategories = [
  { platform: 'temu', catId: 23177, catName: '视频游戏' },
  { platform: 'shein', catId: 3224, catName: '宝贝儿' },
  { platform: 'amazon', catId: 706813011, catName: '狩猎&渔具' },
  { platform: 'sumaitong', catId: 509, catName: '电话和通讯' },
  { platform: 'tiktok', catId: 856720, catName: 'Pre-Owned' }
];

// 4个子渠道
const subChannels = [
  { name: '热销商品', suffix: '/goods/hot-sale' },
  { name: '热销新品', suffix: '/goods/hot-sale-new' },
  { name: '新店热销', suffix: '/goods/new-mall-hot-sale' },
  { name: '大卖新品', suffix: '/goods/big-sale-new' }
];

// 采集结果
const results = {
  timestamp: new Date().toISOString(),
  targetCategories: targetCategories,
  data: []
};

// jjy_api 实例（由 main 函数初始化）
let jjyApi = null;

async function crawlCategory(platform, catId, catName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`开始采集: ${platform} - ${catName} (catId=${catId})`);
  console.log('='.repeat(60));

  const categoryData = {
    platform,
    catId,
    catName,
    subChannels: []
  };

  for (const channel of subChannels) {
    console.log(`\n  -> ${channel.name}...`);

    try {
      // 使用 jjy_api 的 search 方法，按销量排序
      const result = await jjyApi.search({
        platform,
        categoryId: catId,
        sort: 'sold',
        order: 'descend',
        size: 10,
        page: 1
      });

      if (result.success && result.products.length > 0) {
        console.log(`     成功获取 ${result.products.length} 个商品`);

        categoryData.subChannels.push({
          channel: channel.name,
          channelUrl: `https://www.${getPlatformDomain(platform)}${channel.suffix}?catId=${catId}`,
          total: result.total,
          products: result.products
        });

        // 将商品添加到结果中
        result.products.forEach(p => {
          p.sourcePlatform = platform;
          p.sourceCatName = catName;
          p.sourceChannel = channel.name;
        });
        results.data.push(...result.products);

      } else {
        console.log(`     获取失败或无数据: ${result.error || 'unknown'}`);
        categoryData.subChannels.push({
          channel: channel.name,
          channelUrl: `https://www.${getPlatformDomain(platform)}${channel.suffix}?catId=${catId}`,
          error: result.error || '无数据',
          products: []
        });
      }

      // 每个子渠道间隔1秒
      await sleep(1000);

    } catch (e) {
      console.log(`     错误: ${e.message}`);
      categoryData.subChannels.push({
        channel: channel.name,
        channelUrl: `https://www.${getPlatformDomain(platform)}${channel.suffix}?catId=${catId}`,
        error: e.message,
        products: []
      });
    }
  }

  return categoryData;
}

function getPlatformDomain(platform) {
  const domains = {
    'temu': 'temaishuju.com',
    'shein': 'sheinshuju.com',
    'amazon': 'amazonshuju.com',
    'sumaitong': 'sumaitongshuju.com',
    'tiktok': 'tiktokshuju.com'
  };
  return domains[platform] || 'temaishuju.com';
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('='.repeat(60));
  console.log('选品采集脚本 - 2026-04-29 第二轮');
  console.log('='.repeat(60));
  console.log(`开始时间: ${results.timestamp}`);
  console.log(`目标类目: ${targetCategories.length} 个`);
  console.log(`预计采集: ${targetCategories.length * 4 * 10} 个商品`);
  console.log('='.repeat(60));

  // 初始化 jjy_api
  jjyApi = new JJYAPITool();
  await jjyApi.init();

  const categoryResults = [];

  // 依次采集每个类目
  for (const target of targetCategories) {
    const categoryResult = await crawlCategory(target.platform, target.catId, target.catName);
    categoryResults.push(categoryResult);

    // 类目之间间隔2秒
    await sleep(2000);
  }

  // 汇总结果
  results.categoryResults = categoryResults;
  results.totalProducts = results.data.length;
  results.completedAt = new Date().toISOString();

  console.log('\n');
  console.log('='.repeat(60));
  console.log('采集完成汇总');
  console.log('='.repeat(60));
  console.log(`总采集商品数: ${results.totalProducts}`);
  console.log(`完成时间: ${results.completedAt}`);

  categoryResults.forEach(cr => {
    const totalProducts = cr.subChannels.reduce((sum, sc) => sum + sc.products.length, 0);
    console.log(`- ${cr.platform}/${cr.catName}: ${totalProducts} 个商品`);
  });

  // 保存结果
  const fs = require('fs');
  const outputPath = __dirname + '/dailytemp/2026-04-29/crawl_20260429_v2.json';

  // 确保目录存在
  const dir = __dirname + '/dailytemp/2026-04-29';
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\n结果已保存至: ${outputPath}`);

  return results;
}

main().catch(console.error);