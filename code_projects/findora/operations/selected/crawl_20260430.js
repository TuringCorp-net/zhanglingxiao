/**
 * 选品采集脚本 - 2026-04-30
 *
 * 按 crawl_state.js 的规则，每次选择每个平台最久未采集的类目
 * 采集参数：5平台 × 1类目 × 4渠道 × Top10 = 200个商品
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 目标日期
const TARGET_DATE = '2026-04-30';

// 每个平台选择的类目（最久未采集）
const TARGET_CATEGORIES = {
  temu: { catId: 27011, catName: '服装、鞋靴和珠宝饰品', channel: '热销商品' },
  shein: { catId: 4083, catName: '家用纺织品', channel: '热销商品' },
  amazon: { catId: 1064954, catName: '办公产品', channel: '热销商品' },
  sumaitong: { catId: 1503, catName: '家具和室内装饰品', channel: '热销商品' },
  tiktok: { catId: 601352, catName: 'Shoes', channel: '热销商品' }
};

// 4个渠道
const CHANNELS = [
  '热销商品',
  '热销新品',
  '新店热销',
  '大卖新品'
];

async function main() {
  console.log('='.repeat(60));
  console.log(`选品采集开始 - ${TARGET_DATE}`);
  console.log('='.repeat(60));

  const jjyApi = new JJYAPITool();

  // 初始化
  console.log('\n[1/4] 初始化 JJY API...');
  try {
    await jjyApi.init();
  } catch (e) {
    console.error('初始化失败:', e.message);
    process.exit(1);
  }

  // 采集所有平台
  console.log('\n[2/4] 采集商品...');
  const allProducts = [];

  for (const [platform, category] of Object.entries(TARGET_CATEGORIES)) {
    console.log(`\n--- ${platform.toUpperCase()} - ${category.catName} ---`);

    for (const channel of CHANNELS) {
      console.log(`  [${channel}] 采集中...`);

      try {
        const result = await jjyApi.search({
          keyword: '',  // 无关键词，按类目搜索
          platform: platform,
          categoryId: category.catId,
          sort: platform === 'amazon' ? 'monthSold' : 'sold',
          order: 'descend',
          page: 1,
          size: 10
        });

        if (result.success && result.products.length > 0) {
          console.log(`    ✓ 获取 ${result.products.length} 个商品`);
          result.products.forEach(p => {
            p.sourceChannel = channel;
            p.sourceCategory = category.catName;
            allProducts.push(p);
          });
        } else {
          console.log(`    ✗ 无数据 (${result.error || '未知错误'})`);
        }
      } catch (e) {
        console.log(`    ✗ 采集失败: ${e.message}`);
      }

      // 间隔1秒避免请求过快
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`\n总计采集: ${allProducts.length} 个商品`);

  // 保存原始数据
  const rawDataPath = `operations/selected/dailytemp/${TARGET_DATE}/raw_products.json`;
  const fs = require('fs');
  const dir = require('path').dirname(rawDataPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(rawDataPath, JSON.stringify(allProducts, null, 2));
  console.log(`原始数据已保存: ${rawDataPath}`);

  // 输出采集结果摘要
  console.log('\n[3/4] 各平台采集结果:');
  const platformCounts = {};
  for (const p of allProducts) {
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  }
  for (const [platform, count] of Object.entries(platformCounts)) {
    console.log(`  ${platform}: ${count} 个商品`);
  }

  console.log('\n[4/4] 采集完成，准备筛选...');
  return allProducts;
}

main().then(products => {
  console.log('\n采集阶段完成，共获取 ' + products.length + ' 个商品');
  process.exit(0);
}).catch(e => {
  console.error('执行失败:', e);
  process.exit(1);
});