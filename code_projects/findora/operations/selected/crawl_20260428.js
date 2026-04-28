/**
 * 选品采集脚本 - 2026-04-28
 *
 * 目标：从5个平台各选1个"最久未采集"的类目
 * 每类目采集4个子渠道 × Top10 = 40条/平台
 *
 * 今日采集目标：
 * - temu: 家电 (catId=2096)
 * - shein: 工具和家居装修 (catId=4327)
 * - amazon: 健康与家居 (catId=3760901)
 * - sumaitong: 美容健康 (catId=66)
 * - tiktok: Automotive & Motorcycle (catId=605196)
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs').promises;
const path = require('path');

// 采集目标
const CRAWL_TARGETS = [
  { platform: 'temu', catId: 2096, catName: '家电', sort: 'sold' },
  { platform: 'shein', catId: 4327, catName: '工具和家居装修', sort: 'sold' },
  { platform: 'amazon', catId: 3760901, catName: '健康与家居', sort: 'monthSold' },
  { platform: 'sumaitong', catId: 66, catName: '美容健康', sort: 'totalSold', siteId: 1 },
  { platform: 'tiktok', catId: 605196, catName: 'Automotive & Motorcycle', sort: 'totalSold', siteId: 1 }
];

// 4个子渠道
const SUB_CHANNELS = ['热销商品', '热销新品', '新店热销', '大卖新品'];

async function main() {
  const jjyApi = new JJYAPITool();
  const today = '2026-04-28';
  const tempDir = path.join(__dirname, 'dailytemp', today);

  // 确保目录存在
  await fs.mkdir(tempDir, { recursive: true });

  console.log('=== 选品采集开始 ===');
  console.log(`日期: ${today}`);
  console.log(`平台数: ${CRAWL_TARGETS.length}`);
  console.log(`预计采集: ${CRAWL_TARGETS.length} × 4子渠道 × 10条 = ${CRAWL_TARGETS.length * 4 * 10} 条\n`);

  const allProducts = [];
  const errors = [];

  // 采集每个平台
  for (const target of CRAWL_TARGETS) {
    console.log(`\n>>> 采集 ${target.platform} - ${target.catName} (catId=${target.catId})`);

    for (const channel of SUB_CHANNELS) {
      try {
        console.log(`   [${channel}]...`);

        // 搜索该类目的商品（按销量排序）
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          sort: target.sort || 'sold',
          order: 'descend',
          size: 10,
          ...(target.siteId && { siteId: target.siteId })
        });

        if (result.success && result.products && result.products.length > 0) {
          console.log(`      ✓ 获取 ${result.products.length} 条商品`);

          // 添加元数据
          result.products.forEach(p => {
            p._source = {
              platform: target.platform,
              catId: target.catId,
              catName: target.catName,
              channel: channel
            };
          });

          allProducts.push(...result.products);
        } else {
          console.log(`      ✗ 无数据 (${result.error || '未知错误'})`);
          errors.push({
            platform: target.platform,
            catId: target.catId,
            channel: channel,
            error: result.error
          });
        }

        // 防止请求过快
        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`      ✗ 请求失败: ${e.message}`);
        errors.push({
          platform: target.platform,
          catId: target.catId,
          channel: channel,
          error: e.message
        });
      }
    }
  }

  console.log(`\n=== 采集完成 ===`);
  console.log(`成功: ${allProducts.length} 条`);
  console.log(`失败: ${errors.length} 条`);

  // 保存原始数据
  const rawFile = path.join(tempDir, 'raw_products.json');
  await fs.writeFile(rawFile, JSON.stringify(allProducts, null, 2), 'utf-8');
  console.log(`\n原始数据已保存: ${rawFile}`);

  // 保存错误日志
  if (errors.length > 0) {
    const errorFile = path.join(tempDir, 'errors.json');
    await fs.writeFile(errorFile, JSON.stringify(errors, null, 2), 'utf-8');
    console.log(`错误日志已保存: ${errorFile}`);
  }

  return { allProducts, errors };
}

main()
  .then(({ allProducts, errors }) => {
    console.log('\n采集脚本执行完成');
    process.exit(0);
  })
  .catch(e => {
    console.error('采集脚本异常:', e);
    process.exit(1);
  });