/**
 * 选品采集脚本 - 2026-04-27
 *
 * 目标：从5个平台各采集最久未采集的类目
 * Temu: 图书 (44933)
 * Shein: 食品和饮料 (13086)
 * Amazon: 视频游戏 (468642)
 * Sumaitong: 消费电子 (44)
 * TikTok: Womenswear & Underwear (601152)
 */

const JJYAPITool = require('/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/tools/jjy_api.js');

// 采集目标配置
const CRAWL_TARGETS = [
  { platform: 'temu', catId: 44933, catName: '图书', sort: 'sold' },
  { platform: 'shein', catId: 13086, catName: '食品和饮料', sort: 'sold' },
  { platform: 'amazon', catId: 468642, catName: '视频游戏', sort: 'monthSold' },
  { platform: 'sumaitong', catId: 44, catName: '消费电子', sort: 'totalSold', siteId: 1 },
  { platform: 'tiktok', catId: 601152, catName: "Womenswear & Underwear", sort: 'totalSold', siteId: 1 }
];

async function main() {
  console.log('========== 选品采集开始 ==========');
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('');

  const jjyApi = new JJYAPITool();
  const allProducts = [];
  const errors = [];

  // 遍历每个平台进行采集
  for (const target of CRAWL_TARGETS) {
    console.log(`\n>>> 正在采集 ${target.platform} - ${target.catName} (${target.catId})`);
    console.log('    排序方式: ' + target.sort);

    // 4个子渠道
    const channels = ['热销商品', '热销新品', '新店热销', '大卖新品'];

    for (const channel of channels) {
      try {
        console.log(`    - ${channel}...`);
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort,
          size: 10,
          siteId: target.siteId || undefined
        });

        if (result.success && result.products.length > 0) {
          console.log(`      获取到 ${result.products.length} 个商品`);

          // 添加来源信息
          result.products.forEach(p => {
            p.source = `${target.platform}-${channel}`;
            p.catName = target.catName;
            p.catId = target.catId;
            allProducts.push(p);
          });
        } else {
          const errMsg = result.error || '无数据';
          console.log(`      ⚠ ${errMsg}`);
          errors.push({ platform: target.platform, channel, error: errMsg });
        }
      } catch (e) {
        console.log(`      ✗ 错误: ${e.message}`);
        errors.push({ platform: target.platform, channel, error: e.message });
      }
    }
  }

  console.log('\n========== 采集完成 ==========');
  console.log(`总计获取: ${allProducts.length} 个商品`);
  console.log(`失败数: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n失败详情:');
    errors.forEach(e => console.log(`  - ${e.platform}/${e.channel}: ${e.error}`));
  }

  // 保存原始数据
  const fs = require('fs');
  const today = '2026-04-27';
  const tempDir = `./operations/selected/dailytemp/${today}`;

  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  fs.writeFileSync(`${tempDir}/raw_products.json`, JSON.stringify({
    timestamp: new Date().toISOString(),
    total: allProducts.length,
    targets: CRAWL_TARGETS,
    products: allProducts
  }, null, 2));

  console.log(`\n原始数据已保存至: ${tempDir}/raw_products.json`);

  // 输出商品列表概览
  console.log('\n========== 商品概览 ==========');
  allProducts.slice(0, 20).forEach((p, i) => {
    console.log(`${i + 1}. [${p.platform}] ${p.goodsNameEn?.substring(0, 50)}...`);
    console.log(`   销量: ${p.sold} | 价格: ${p.goodsPriceMin || '-'} | 评分: ${p.rating || '-'}`);
  });

  return { allProducts, errors };
}

main().then(result => {
  console.log('\n脚本执行完成');
  process.exit(0);
}).catch(e => {
  console.error('执行失败:', e);
  process.exit(1);
});