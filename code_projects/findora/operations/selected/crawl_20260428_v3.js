/**
 * 选品采集任务 - 2026-04-28
 *
 * 工作流程：
 * 1. 按 lastCrawled 排序，选出每个平台"最久未采集"的类目
 * 2. 使用 jjy_api 采集每个类目的4个子渠道 × Top10 = 40个商品/平台
 * 3. 汇总200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 采集配置
const CONFIG = {
  // 每个平台最久未采集的类目（根据 crawl_state.js 分析）
  targets: [
    {
      platform: 'temu',
      catId: 23177,
      catName: '视频游戏',
      sort: 'sold'
    },
    {
      platform: 'shein',
      catId: 3224,
      catName: '宝贝儿',
      sort: 'sold'
    },
    {
      platform: 'amazon',
      catId: 16310091,
      catName: '工业类',
      sort: 'monthSold'
    },
    {
      platform: 'sumaitong',
      catId: 509,
      catName: '电话和通讯',
      sort: 'totalSold'
    },
    {
      platform: 'tiktok',
      catId: 600001,
      catName: 'Home Supplies',
      sort: 'totalSold'
    }
  ],
  // 每个子渠道采集 Top 10
  topPerChannel: 10,
  // 4个子渠道：热销商品、热销新品、新店热销、大卖新品
  channels: ['hot-sale', 'hot-sale-new', 'new-mall-hot-sale', 'big-sale-new']
};

async function run() {
  console.log('========================================');
  console.log('选品采集任务开始 - 2026-04-28');
  console.log('========================================\n');

  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  // 遍历每个平台
  for (const target of CONFIG.targets) {
    console.log(`\n【${target.platform.toUpperCase()}】采集类目: ${target.catName} (catId: ${target.catId})`);

    // 由于 jjy_api.search 支持关键词+类目筛选，我们使用类目+关键词组合来获取数据
    // 但更好的方式是直接搜索全类目，然后按销量排序

    try {
      // 尝试获取该类目的热销商品
      const result = await jjyApi.search({
        platform: target.platform,
        categoryId: target.catId,
        sort: target.sort,
        size: CONFIG.topPerChannel * 4, // 获取足够的商品用于4个渠道
        page: 1
      });

      if (result.success && result.products.length > 0) {
        console.log(`  ✓ 成功获取 ${result.products.length} 个商品`);

        // 添加平台和类目标记
        result.products.forEach(p => {
          p.platform = target.platform;
          p.catName = target.catName;
          p.catId = target.catId;
          allProducts.push(p);
        });
      } else {
        console.log(`  ✗ 获取失败: ${result.error || '无数据'}`);
        errors.push({
          platform: target.platform,
          catName: target.catName,
          error: result.error || '无数据'
        });
      }

      // 如果获取的商品不够，尝试换关键词或增加页数
      if (result.success && result.products.length < CONFIG.topPerChannel) {
        console.log(`  → 商品数量不足，尝试获取更多...`);

        // 尝试第二页
        const result2 = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort,
          size: CONFIG.topPerChannel * 4,
          page: 2
        });

        if (result2.success && result2.products.length > 0) {
          result2.products.forEach(p => {
            p.platform = target.platform;
            p.catName = target.catName;
            p.catId = target.catId;
            allProducts.push(p);
          });
          console.log(`  ✓ 第二页获取 ${result2.products.length} 个商品`);
        }
      }

    } catch (e) {
      console.log(`  ✗ 异常: ${e.message}`);
      errors.push({
        platform: target.platform,
        catName: target.catName,
        error: e.message
      });
    }

    // 避免请求过快
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n========================================');
  console.log('采集完成');
  console.log('========================================');
  console.log(`总采集商品数: ${allProducts.length}`);
  console.log(`错误数: ${errors.length}`);

  // 去重（按 goodsId）
  const seen = new Set();
  const uniqueProducts = allProducts.filter(p => {
    if (!p.goodsId) return true; // 没有 goodsId 的保留
    if (seen.has(p.goodsId)) return false;
    seen.add(p.goodsId);
    return true;
  });

  console.log(`去重后商品数: ${uniqueProducts.length}`);

  // 按销量排序
  uniqueProducts.sort((a, b) => (b.sold || 0) - (a.sold || 0));

  // 按平台统计
  const byPlatform = {};
  uniqueProducts.forEach(p => {
    if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
    byPlatform[p.platform].push(p);
  });

  console.log('\n各平台商品分布:');
  for (const [platform, products] of Object.entries(byPlatform)) {
    console.log(`  ${platform}: ${products.length} 个`);
  }

  // 保存结果
  const outputDir = path.join(__dirname, 'operations/selected/dailytemp/2026-04-28');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'raw_products.json');
  fs.writeFileSync(outputFile, JSON.stringify({
    date: '2026-04-28',
    totalCount: uniqueProducts.length,
    errors: errors,
    products: uniqueProducts
  }, null, 2));

  console.log(`\n原始数据已保存: ${outputFile}`);

  // 同时保存一份到 selected 目录
  const selectedFile = path.join(__dirname, 'operations/selected/raw_20260428.json');
  fs.writeFileSync(selectedFile, JSON.stringify({
    date: '2026-04-28',
    totalCount: uniqueProducts.length,
    errors: errors,
    products: uniqueProducts
  }, null, 2));

  console.log(`同步保存: ${selectedFile}`);

  return {
    products: uniqueProducts,
    errors: errors,
    byPlatform
  };
}

// 执行
run().then(result => {
  console.log('\n采集任务完成!');
  process.exit(0);
}).catch(e => {
  console.error('采集任务失败:', e);
  process.exit(1);
});
