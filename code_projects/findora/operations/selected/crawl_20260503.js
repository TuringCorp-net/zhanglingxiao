/**
 * 选品采集脚本 - 2026-05-03
 *
 * 工作流程：
 * 1. 按 crawl_state.js 选择"最久未采集"的5个类目
 * 2. 每个类目执行4个子渠道（热销商品/热销新品/新店热销/大卖新品）× Top 10 = 40个/平台
 * 3. 共采集 200 个原始商品
 * 4. 落盘到 dailytemp/2026-05-03/
 *
 * 最久未采集的类目：
 * - Temu: 工业和科学(catId=4673)
 * - Shein: 箱包和行李箱(catId=3637)
 * - Amazon: 汽车(catId=15684181)
 * - Sumaitong: 电脑和办公(catId=7)
 * - TikTok: Furniture(catId=604453)
 */

const JJYAPITool = require('../tools/jjy_api.js');

// 采集目标配置
const TARGET_CATEGORIES = [
  { platform: 'temu', catId: 4673, catName: '工业和科学' },
  { platform: 'shein', catId: 3637, catName: '箱包和行李箱' },
  { platform: 'amazon', catId: 15684181, catName: '汽车' },
  { platform: 'sumaitong', catId: 7, catName: '电脑和办公' },
  { platform: 'tiktok', catId: 604453, catName: 'Furniture' }
];

// 4个子渠道
const SUB_CHANNELS = [
  { key: 'hot-sale', name: '热销商品' },
  { key: 'hot-sale-new', name: '热销新品' },
  { key: 'new-mall-hot-sale', name: '新店热销' },
  { key: 'big-sale-new', name: '大卖新品' }
];

async function main() {
  console.log('===============================================');
  console.log('选品采集开始 - 2026-05-03');
  console.log('===============================================\n');

  const jjyApi = new JJYAPITool();

  // 初始化
  console.log('[初始化] 正在连接JJY API...\n');
  await jjyApi.init();

  const allProducts = [];
  let totalCollected = 0;

  // 遍历每个类目
  for (const target of TARGET_CATEGORIES) {
    console.log(`\n--- [${target.platform.toUpperCase()}] ${target.catName}(${target.catId}) ---`);

    const platformProducts = [];

    // 遍历4个子渠道
    for (const channel of SUB_CHANNELS) {
      console.log(`  [${channel.name}] 采集 Top 10...`);

      try {
        // 搜索该类目下的商品
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          size: 10,
          page: 1
        });

        if (result.success && result.products.length > 0) {
          // 标记来源渠道
          const taggedProducts = result.products.map(p => ({
            ...p,
            sourceChannel: channel.name,
            targetCatName: target.catName,
            targetCatId: target.catId
          }));

          platformProducts.push(...taggedProducts);
          console.log(`    -> 获取 ${taggedProducts.length} 个商品`);
          totalCollected += taggedProducts.length;
        } else {
          console.log(`    -> 无数据或失败: ${result.error || '未知错误'}`);
        }
      } catch (e) {
        console.log(`    -> 错误: ${e.message}`);
      }
    }

    console.log(`  [${target.platform}] 本次采集: ${platformProducts.length} 个`);
    allProducts.push(...platformProducts);
  }

  console.log('\n===============================================');
  console.log(`采集完成! 总计: ${totalCollected} 个原始商品`);
  console.log('===============================================');

  // 去重处理（按 goodsId）
  const seen = new Set();
  const deduped = allProducts.filter(p => {
    if (p.goodsId && !seen.has(p.goodsId)) {
      seen.add(p.goodsId);
      return true;
    }
    return false;
  });

  console.log(`去重后: ${deduped.length} 个商品`);

  // 落盘到 dailytemp
  const fs = require('fs');
  const tempDir = './operations/selected/dailytemp/2026-05-03';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 保存原始数据
  const rawPath = `${tempDir}/raw_products_20260503.json`;
  fs.writeFileSync(rawPath, JSON.stringify(deduped, null, 2));
  console.log(`\n原始数据已保存: ${rawPath}`);

  // 保存汇总报告
  const report = {
    date: '2026-05-03',
    collectedAt: new Date().toISOString(),
    targetCategories: TARGET_CATEGORIES,
    totalCollected: totalCollected,
    totalAfterDedup: deduped.length,
    products: deduped
  };

  const reportPath = `${tempDir}/report_20260503.json`;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`汇总报告已保存: ${reportPath}`);

  return deduped;
}

// 执行
main()
  .then(products => {
    console.log('\n采集阶段完成!');
    console.log(`共获取 ${products.length} 个待筛选商品`);
    process.exit(0);
  })
  .catch(e => {
    console.error('\n采集失败:', e.message);
    process.exit(1);
  });