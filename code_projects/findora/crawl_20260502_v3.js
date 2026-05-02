/**
 * 选品采集脚本 - 2026-05-02 下午场
 * 根据 crawl_state 选择最久未采集的类目进行采集
 *
 * 本次采集目标（5个平台各1个类目）：
 * - Temu: 图书 (catId: 44933)
 * - Shein: 书籍和杂志 (catId: 13087)
 * - Amazon: 工具 (catId: 228013)
 * - Sumaitong: 服饰配饰 (catId: 200000297)
 * - TikTok: Luggage & Bags (catId: 824584)
 */

const JJYAPITool = require('./operations/tools/jjy_api.js');

// 目标类目配置
const targetCategories = [
  { platform: 'temu', catId: 44933, catName: '图书', channels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
  { platform: 'shein', catId: 13087, catName: '书籍和杂志', channels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
  { platform: 'amazon', catId: 228013, catName: '工具', channels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
  { platform: 'sumaitong', catId: 200000297, catName: '服饰配饰', channels: ['热销商品', '热销新品', '新店热销', '大卖新品'] },
  { platform: 'tiktok', catId: 824584, catName: 'Luggage & Bags', channels: ['热销商品', '热销新品', '新店热销', '大卖新品'] }
];

async function crawl() {
  const jjyApi = new JJYAPITool();
  const allProducts = [];

  console.log('========================================');
  console.log('选品采集开始 - 2026-05-02 下午场');
  console.log('========================================\n');

  for (const target of targetCategories) {
    console.log(`\n[${target.platform.toUpperCase()}] ${target.catName} (catId: ${target.catId})`);
    console.log('-'.repeat(50));

    for (const channel of target.channels) {
      const pagePath = jjyApi.pagePaths[channel];
      const url = `https://${jjyApi.platforms[target.platform]}${pagePath}?catId=${target.catId}`;

      try {
        console.log(`  ${channel}: 采集中...`);

        // 通过关键词搜索方式获取该类目的热销商品
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          size: 10,
          sort: target.platform === 'temu' ? 'sold' : target.platform === 'shein' ? 'sold' : target.platform === 'amazon' ? 'monthSold' : 'totalSold'
        });

        if (result.success && result.products.length > 0) {
          console.log(`    ✓ 成功获取 ${result.products.length} 个商品`);

          result.products.forEach(p => {
            allProducts.push({
              ...p,
              platform: target.platform,
              category: target.catName,
              channel: channel,
              crawlTime: new Date().toISOString()
            });
          });
        } else {
          console.log(`    ✗ 无数据或失败: ${result.error || '未知错误'}`);
        }
      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
      }
    }
  }

  console.log('\n========================================');
  console.log(`采集完成! 共获取 ${allProducts.length} 个商品`);
  console.log('========================================\n');

  // 统计各平台商品数量
  const platformCount = {};
  allProducts.forEach(p => {
    platformCount[p.platform] = (platformCount[p.platform] || 0) + 1;
  });
  console.log('各平台商品数量:');
  Object.entries(platformCount).forEach(([platform, count]) => {
    console.log(`  ${platform}: ${count}`);
  });

  // 保存原始数据
  const fs = require('fs');
  const outputPath = './operations/selected/dailytemp/2026-05-02/raw_products.json';
  fs.writeFileSync(outputPath, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`\n原始数据已保存至: ${outputPath}`);

  return allProducts;
}

crawl().catch(console.error);