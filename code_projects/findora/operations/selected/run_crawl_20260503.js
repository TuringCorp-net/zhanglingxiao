/**
 * 采集执行器 - 保存采集结果
 */
const fs = require('fs');
const path = require('path');

const crawlModule = require('./crawl_20260503_final.js');

async function main() {
  const OUTPUT_DIR = path.join(__dirname, 'dailytemp', '2026-05-03');
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  // 执行采集
  const result = await crawlModule.crawl();

  // 保存原始数据
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'raw_products.json'),
    JSON.stringify(result, null, 2),
    'utf-8'
  );

  console.log(`原始数据已保存: ${result.products.length} 个商品`);
}

main().catch(console.error);