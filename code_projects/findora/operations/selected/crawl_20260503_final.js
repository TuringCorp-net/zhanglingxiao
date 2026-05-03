/**
 * ============================================
 * 选品采集脚本 - 2026-05-03
 * ============================================
 *
 * 工作流程：
 * 1. 按 crawl_state.js 找最久未采集的类目
 * 2. 采集 5个平台 × 4子渠道 × Top10 = 200个商品
 * 3. 落盘到 dailytemp/2026-05-03/
 * 4. 返回结果供筛选
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 今天的日期
const TODAY = '2026-05-03';

// 每个平台最久未采集的类目
const TARGET_CATEGORIES = {
  temu: { catId: 2542, catName: '电子' },
  shein: { catId: 3650, catName: '家电' },
  amazon: { catId: 3760911, catName: '美容与护理' },
  sumaitong: { catId: 13, catName: '家装（硬装）' },
  tiktok: { catId: 951432, catName: 'Collectibles' }
};

// 4个子渠道
const SUB_CHANNELS = [
  { name: '热销商品', path: '/goods/hot-sale' },
  { name: '热销新品', path: '/goods/hot-sale-new' },
  { name: '新店热销', path: '/new-mall-hot-sale' },
  { name: '大卖新品', path: '/goods/big-sale-new' }
];

async function crawl() {
  console.log('='.repeat(50));
  console.log(`选品采集开始 - ${TODAY}`);
  console.log('='.repeat(50));

  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  // 遍历每个平台
  for (const [platform, cat] of Object.entries(TARGET_CATEGORIES)) {
    console.log(`\n>>> 采集 ${platform} - ${cat.catName} (catId=${cat.catId})`);

    for (const channel of SUB_CHANNELS) {
      console.log(`   ${channel.name}...`);

      try {
        const result = await jjyApi.search({
          platform,
          categoryId: cat.catId,
          sort: 'sold',
          page: 1,
          size: 10
        });

        if (result.success && result.products.length > 0) {
          const productsWithMeta = result.products.map(p => ({
            ...p,
            _platform: platform,
            _catName: cat.catName,
            _channel: channel.name,
            _crawlDate: TODAY
          }));

          allProducts.push(...productsWithMeta);
          console.log(`      ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`      ✗ 无数据: ${result.error || '未知错误'}`);
          errors.push({ platform, channel: channel.name, error: result.error });
        }
      } catch (e) {
        console.log(`      ✗ 异常: ${e.message}`);
        errors.push({ platform, channel: channel.name, error: e.message });
      }

      // 请求间隔，避免过快
      await new Promise(r => setTimeout(r, 500));
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`采集完成: 共 ${allProducts.length} 个商品`);
  console.log(`失败: ${errors.length} 个子渠道`);
  console.log('='.repeat(50));

  return { products: allProducts, errors };
}

// 执行
if (require.main === module) {
  (async () => {
    try {
      const result = await crawl();
      console.log('\n结果预览（前5个）:');
      result.products.slice(0, 5).forEach((p, i) => {
        console.log(`${i+1}. [${p._platform}] ${p.goodsNameEn?.substring(0, 50)}`);
      });
    } catch (e) {
      console.error('采集失败:', e.message);
    }
  })();
}

module.exports = { crawl, TARGET_CATEGORIES, SUB_CHANNELS };