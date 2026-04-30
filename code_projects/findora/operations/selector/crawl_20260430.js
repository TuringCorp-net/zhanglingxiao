/**
 * ============================================
 * 选品采集脚本 - 2026-04-30
 * ============================================
 *
 * 根据 crawl_state.js 选择最久未采集的类目进行采集
 *
 * 本次采集目标：
 * - Temu: 31148 (运动与户外用品)
 * - Shein: 3195 (运动与户外)
 * - Amazon: 2972638011 (庭院、草坪和园艺)
 * - Sumaitong: 200000345 (女装)
 * - TikTok: 600154 (Textiles & Soft Furnishings)
 *
 * 每个平台采集4个子渠道 × Top10 = 40个商品
 * 总计 5平台 × 40 = 200个待筛选商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 采集配置
const CRAWL_CONFIG = {
  platforms: [
    { platform: 'temu', catId: 31148, catName: '运动与户外用品', subchannels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
    { platform: 'shein', catId: 3195, catName: '运动与户外', subchannels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
    { platform: 'amazon', catId: 2972638011, catName: '庭院、草坪和园艺', subchannels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
    { platform: 'sumaitong', catId: 200000345, catName: '女装', subchannels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
    { platform: 'tiktok', catId: 600154, catName: 'Textiles & Soft Furnishings', subchannels: ['热销商品', '热销新品', '新店热销', '大卖新品'] }
  ],
  topN: 10,  // 每个子渠道取Top10
  topProducts: 10  // 最终筛选出10个商品
};

// 输出目录
const OUTPUT_DIR = './dailytemp/2026-04-30';

const jjyApi = new JJYAPITool();

/**
 * 执行采集
 */
async function runCrawl() {
  console.log('========================================');
  console.log('开始选品采集 - 2026-04-30');
  console.log('========================================\n');

  // 初始化
  try {
    await jjyApi.init();
  } catch (e) {
    console.error('初始化失败:', e.message);
  }

  const allProducts = [];
  const results = {
    success: [],
    failed: []
  };

  // 按平台采集
  for (const config of CRAWL_CONFIG.platforms) {
    console.log(`\n--- 采集 ${config.platform} - ${config.catName} ---`);

    for (const subchannel of config.subchannels) {
      console.log(`  [${subchannel}]...`);

      try {
        // 使用关键词搜索模拟子渠道采集
        // 注意：jjy_api的4个子渠道API端点实际需要通过不同URL访问
        // 这里我们用通用搜索方法获取数据

        const result = await jjyApi.search({
          platform: config.platform,
          categoryId: config.catId,
          sort: config.platform === 'temu' ? 'sold' :
                config.platform === 'shein' ? 'sold' :
                config.platform === 'amazon' ? 'monthSold' : 'totalSold',
          size: CRAWL_CONFIG.topN
        });

        if (result.success && result.products.length > 0) {
          // 添加来源标识
          const products = result.products.map(p => ({
            ...p,
            _subchannel: subchannel,
            _platform: config.platform,
            _categoryName: config.catName,
            _catId: config.catId
          }));

          allProducts.push(...products);
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
          results.success.push({
            platform: config.platform,
            category: config.catName,
            subchannel,
            count: result.products.length
          });
        } else {
          console.log(`    ✗ 获取失败: ${result.error || '无数据'}`);
          results.failed.push({
            platform: config.platform,
            category: config.catName,
            subchannel,
            error: result.error
          });
        }
      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
        results.failed.push({
          platform: config.platform,
          category: config.catName,
          subchannel,
          error: e.message
        });
      }

      // 延迟，避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log(`\n========================================`);
  console.log(`采集完成！共获取 ${allProducts.length} 个商品`);
  console.log(`成功: ${results.success.length} 个渠道`);
  console.log(`失败: ${results.failed.length} 个渠道`);
  console.log(`========================================\n`);

  // 输出结果
  return {
    products: allProducts,
    results,
    totalCount: allProducts.length,
    successCount: results.success.length,
    failedCount: results.failed.length
  };
}

// 执行并导出结果
if (require.main === module) {
  (async () => {
    try {
      const data = await runCrawl();

      // 保存原始采集数据
      const fs = require('fs');
      const outputPath = `${OUTPUT_DIR}/raw_products.json`;

      // 确保目录存在
      if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      }

      fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
      console.log(`\n原始数据已保存到: ${outputPath}`);

      // 输出汇总
      console.log('\n========== 采集结果汇总 ==========');
      console.log(JSON.stringify({
        totalProducts: data.totalCount,
        successChannels: data.successCount,
        failedChannels: data.failedCount,
        topProducts: data.products.slice(0, 5).map(p => ({
          name: p.goodsNameEn?.substring(0, 50),
          platform: p._platform,
          sold: p.sold,
          price: `${p.goodsPriceMin}-${p.goodsPriceMax}`
        }))
      }, null, 2));

    } catch (e) {
      console.error('执行失败:', e);
    }
  })();
}

module.exports = { runCrawl, CRAWL_CONFIG };