/**
 * 选品采集脚本 - 2026-05-02
 *
 * 工作流程：
 * 1. 从 crawl_state.js 获取"最久未采集"的类目
 * 2. 使用 jjy_api.js 采集数据
 * 3. 每个平台 × 4子渠道 × Top10 = 200个待筛选商品
 */

const path = require('path');
const fs = require('fs');

// 动态设置模块路径到 findora 项目
const findoraRoot = path.resolve(__dirname, '../..');
const jjyApiPath = path.join(findoraRoot, 'operations/tools/jjy_api.js');

let jjyApi;
try {
  jjyApi = require(jjyApiPath);
  console.log('[采集] JJY API 模块加载成功');
} catch (e) {
  console.error('[采集] JJY API 模块加载失败:', e.message);
  process.exit(1);
}

// 本次采集目标（最久未采集的类目）
const crawlTargets = [
  {
    platform: 'temu',
    catId: 1464,
    catName: '宠物用品',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'shein',
    catId: 3631,
    catName: '服饰配饰',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'amazon',
    catId: 2617941011,
    catName: '艺术、手工艺',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'sumaitong',
    catId: 6,
    catName: '家用电器',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'tiktok',
    catId: 603014,
    catName: 'Sports & Outdoor',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  }
];

// 平台默认排序字段
const platformSortMap = {
  'temu': 'sold',
  'shein': 'sold',
  'amazon': 'monthSold',
  'sumaitong': 'totalSold',
  'tiktok': 'totalSold'
};

// 日期范围：最近30天
const dateRange = {
  start: '2026-04-02',
  end: '2026-05-02'
};

// 输出目录
const outputDir = path.join(findoraRoot, 'operations/selected/dailytemp/2026-05-02');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 执行采集
async function runCrawl() {
  const api = new jjyApi();
  const allProducts = [];
  const results = {};

  console.log('='.repeat(60));
  console.log('[采集] 开始执行选品采集任务');
  console.log(`[采集] 日期范围: ${dateRange.start} ~ ${dateRange.end}`);
  console.log('='.repeat(60));

  for (const target of crawlTargets) {
    console.log(`\n[采集] 正在采集: ${target.platform} - ${target.catName} (catId: ${target.catId})`);
    results[target.platform] = { success: 0, failed: 0, products: [] };

    for (const channel of target.channels) {
      console.log(`[采集]   子渠道: ${channel}`);

      try {
        // 根据子渠道调整关键词
        let keyword = '';
        if (channel === '热销新品') keyword = 'new';
        if (channel === '新店热销') keyword = 'new store';
        if (channel === '大卖新品') keyword = 'hot new';

        const sort = platformSortMap[target.platform];

        // 调用 API 搜索
        const result = await api.search({
          keyword: keyword,
          platform: target.platform,
          categoryId: target.catId,
          onSaleTimeStart: dateRange.start,
          sort: sort,
          page: 1,
          size: 10
        });

        if (result.success && result.products.length > 0) {
          // 添加渠道标记
          const products = result.products.map(p => ({
            ...p,
            channel: channel,
            platformCatId: target.catId,
            platformCatName: target.catName
          }));

          results[target.platform].products.push(...products);
          results[target.platform].success++;
          allProducts.push(...products);

          console.log(`[采集]     ✓ 成功获取 ${result.products.length} 个商品`);
        } else {
          results[target.platform].failed++;
          console.log(`[采集]     ✗ 获取失败或无数据`);
        }
      } catch (e) {
        results[target.platform].failed++;
        console.log(`[采集]     ✗ 异常: ${e.message}`);
      }

      // 请求间隔，避免过快
      await sleep(500);
    }

    console.log(`[采集] ${target.platform} 采集完成: 成功${results[target.platform].success}个子渠道, 失败${results[target.platform].failed}个`);
  }

  // 保存原始数据
  const rawDataPath = path.join(outputDir, 'raw_products.json');
  fs.writeFileSync(rawDataPath, JSON.stringify({
    crawlDate: new Date().toISOString(),
    dateRange: dateRange,
    targets: crawlTargets.map(t => ({ platform: t.platform, catId: t.catId, catName: t.catName })),
    totalProducts: allProducts.length,
    results: results,
    products: allProducts
  }, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('[采集] 采集完成！');
  console.log(`[采集] 共采集 ${allProducts.length} 个商品`);
  console.log(`[采集] 原始数据已保存至: ${rawDataPath}`);
  console.log('='.repeat(60));

  return allProducts;
}

// 执行
runCrawl()
  .then(products => {
    console.log(`\n[采集] 可用于筛选的商品数量: ${products.length}`);
    process.exit(0);
  })
  .catch(e => {
    console.error('[采集] 执行失败:', e);
    process.exit(1);
  });
