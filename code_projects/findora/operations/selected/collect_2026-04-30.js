/**
 * ============================================
 * 选品采集脚本 - 2026-04-30
 * ============================================
 *
 * 本次采集类目（各平台最久未采集）：
 * 1. Temu - 庭院、草坪和园艺 (catId: 24389)
 * 2. Shein - 鞋 (catId: 3636)
 * 3. Amazon - 工业类 (catId: 16310091)
 * 4. 速卖通 - 孕婴童 (catId: 1501)
 * 5. TikTok - Computers & Office Equipment (catId: 601755)
 *
 * 采集参数：
 * - 4个子渠道 × Top 10 = 40个/类目
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 创建API实例
const jjyApi = new JJYAPITool();

// 本次采集的类目配置
const crawlTargets = [
  {
    platform: 'temu',
    catId: 24389,
    catName: '庭院、草坪和园艺',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'shein',
    catId: 3636,
    catName: '鞋',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'amazon',
    catId: 16310091,
    catName: '工业类',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'sumaitong',
    catId: 1501,
    catName: '孕婴童',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  },
  {
    platform: 'tiktok',
    catId: 601755,
    catName: 'Computers & Office Equipment',
    channels: ['热销商品', '热销新品', '新店热销', '大卖新品']
  }
];

// 排序字段配置
const sortConfig = {
  temu: 'sold',
  shein: 'sold',
  amazon: 'monthSold',
  sumaitong: 'totalSold',
  tiktok: 'totalSold'
};

async function main() {
  console.log('='.repeat(50));
  console.log('选品采集开始 - 2026-04-30');
  console.log('='.repeat(50));

  // 初始化
  await jjyApi.init();

  const allResults = [];

  // 遍历每个类目采集
  for (const target of crawlTargets) {
    console.log(`\n>>> 采集 ${target.platform} - ${target.catName} (catId: ${target.catId})`);

    const categoryResults = {
      platform: target.platform,
      catId: target.catId,
      catName: target.catName,
      channels: {}
    };

    // 采集每个子渠道
    for (const channel of target.channels) {
      console.log(`   [${channel}]`);

      try {
        const result = await jjyApi.search({
          platform: target.platform,
          categoryId: target.catId,
          sort: sortConfig[target.platform],
          page: 1,
          size: 10
        });

        if (result.success) {
          categoryResults.channels[channel] = {
            success: true,
            total: result.total,
            products: result.products
          };
          console.log(`      成功: ${result.total} 个商品`);
        } else {
          categoryResults.channels[channel] = {
            success: false,
            error: result.error,
            products: []
          };
          console.log(`      失败: ${result.error}`);
        }
      } catch (e) {
        categoryResults.channels[channel] = {
          success: false,
          error: e.message,
          products: []
        };
        console.log(`      异常: ${e.message}`);
      }

      // 延迟，避免请求过快
      await new Promise(r => setTimeout(r, 500));
    }

    allResults.push(categoryResults);
  }

  // 保存原始数据
  const outputDir = path.join(__dirname, 'dailytemp', '2026-04-30');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputFile = path.join(outputDir, 'raw_products.json');
  fs.writeFileSync(outputFile, JSON.stringify(allResults, null, 2), 'utf8');

  console.log('\n' + '='.repeat(50));
  console.log(`采集完成，共 ${allResults.length} 个类目`);
  console.log(`数据已保存至: ${outputFile}`);
  console.log('='.repeat(50));

  // 输出统计
  let totalProducts = 0;
  for (const r of allResults) {
    for (const [ch, data] of Object.entries(r.channels)) {
      if (data.success) {
        totalProducts += data.products.length;
      }
    }
  }
  console.log(`总计采集商品: ${totalProducts} 个`);

  return allResults;
}

main().catch(console.error);
