/**
 * 选品采集脚本 - 2026-05-02
 *
 * 根据 crawl_state.js 选择"最久未采集"的类目:
 * 1. Temu - 各色美食 (catId: 42367)
 * 2. Shein - 电子学 (catId: 2273)
 * 3. Amazon - 运动与户外 (catId: 3375251)
 * 4. Sumaitong - 男装 (catId: 200000343)
 * 5. TikTok - Jewelry Accessories & Derivatives (catId: 953224)
 *
 * 每平台 x 4子渠道 x Top10 = 200个待筛选商品
 */

const JJYAPITool = require('./operations/tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 今天的日期
const TODAY = '2026-05-02';
const OUTPUT_DIR = path.join(__dirname, 'operations/selected/dailytemp', TODAY);

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 采集配置
const CRAWL_CONFIGS = [
  {
    platform: 'temu',
    catId: 42367,
    catName: '各色美食'
  },
  {
    platform: 'shein',
    catId: 2273,
    catName: '电子学'
  },
  {
    platform: 'amazon',
    catId: 3375251,
    catName: '运动与户外'
  },
  {
    platform: 'sumaitong',
    catId: 200000343,
    catName: '男装'
  },
  {
    platform: 'tiktok',
    catId: 953224,
    catName: 'Jewelry Accessories & Derivatives'
  }
];

// 子渠道关键词列表
const CHANNEL_KEYWORDS = [
  { name: '热销商品', keyword: '' },
  { name: '热销新品', keyword: 'new' },
  { name: '新店热销', keyword: 'new shop' },
  { name: '大卖新品', keyword: 'trending' }
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crawlAll() {
  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  console.log('='.repeat(60));
  console.log(`选品采集开始 - ${TODAY}`);
  console.log('='.repeat(60));

  // 计算30天前的日期
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const onSaleTimeStart = thirtyDaysAgo.toISOString().split('T')[0];
  console.log(`上架时间筛选: ${onSaleTimeStart} 至今\n`);

  // 按平台采集
  for (const config of CRAWL_CONFIGS) {
    console.log(`\n[${config.platform.toUpperCase()}] 采集类目: ${config.catName} (ID: ${config.catId})`);
    console.log('-'.repeat(50));

    let platformProducts = [];

    // 4个子渠道，每个取Top10
    for (const channel of CHANNEL_KEYWORDS) {
      console.log(`  → ${channel.name}...`);

      try {
        const result = await jjyApi.search({
          keyword: channel.keyword,
          platform: config.platform,
          categoryId: config.catId,
          onSaleTimeStart: onSaleTimeStart,
          size: 10,
          sort: 'sold',
          order: 'descend'
        });

        if (result.success && result.products.length > 0) {
          // 标记来源
          const productsWithMeta = result.products.map(p => ({
            ...p,
            _source: config.platform,
            _channel: channel.name,
            _catName: config.catName
          }));
          platformProducts.push(...productsWithMeta);
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
        } else {
          console.log(`    ✗ 无数据或失败: ${result.error || 'unknown'}`);
          errors.push({
            platform: config.platform,
            category: config.catName,
            channel: channel.name,
            error: result.error || 'no data'
          });
        }
      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
        errors.push({
          platform: config.platform,
          category: config.catName,
          channel: channel.name,
          error: e.message
        });
      }

      // 礼貌性延迟
      await sleep(500);
    }

    console.log(`  本次采集: ${platformProducts.length} 个商品`);
    allProducts.push(...platformProducts);
  }

  // 汇总
  console.log('\n' + '='.repeat(60));
  console.log(`采集完成! 总计: ${allProducts.length} 个商品`);
  console.log(`失败采集: ${errors.length} 个`);
  console.log('='.repeat(60));

  // 保存原始数据
  const rawFile = path.join(OUTPUT_DIR, 'raw_products.json');
  fs.writeFileSync(rawFile, JSON.stringify({
    date: TODAY,
    total: allProducts.length,
    errors: errors,
    products: allProducts
  }, null, 2));
  console.log(`\n原始数据已保存: ${rawFile}`);

  return { allProducts, errors };
}

// 执行采集
if (require.main === module) {
  crawlAll()
    .then(({ allProducts, errors }) => {
      console.log('\n采集任务完成');
      process.exit(0);
    })
    .catch(e => {
      console.error('采集失败:', e.message);
      process.exit(1);
    });
}

module.exports = { crawlAll };
