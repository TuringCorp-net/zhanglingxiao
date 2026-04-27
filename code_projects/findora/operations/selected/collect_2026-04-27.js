/**
 * ============================================
 * 选品采集脚本 - 2026-04-27
 * ============================================
 *
 * 使用 jjy_api.js 的 /api/v1/goods/search 接口采集数据
 * 目标：采集5个平台中最久未采集的类目
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 初始化API工具
const jjyApi = new JJYAPITool();

// 今天的日期目录
const todayDir = path.join(__dirname, 'dailytemp', '2026-04-27');

// 确保目录存在
if (!fs.existsSync(todayDir)) {
  fs.mkdirSync(todayDir, { recursive: true });
}

// 平台配置（按crawl_state中最久未采集的类目）
const platforms = [
  { name: 'temu', catId: 15945, catName: '健康和家居用品' },
  { name: 'shein', catId: 3634, catName: '珠宝和手表' },
  { name: 'amazon', catId: 7141123011, catName: '服装、鞋履和珠宝' },
  { name: 'sumaitong', catId: 34, catName: '汽车及零配件' },
  { name: 'tiktok', catId: 601739, catName: '手机和电子产品' }
];

// 子渠道关键词（用于多角度搜索）
const channelKeywords = {
  '热销': ['', 'hot', 'best seller', 'popular'],
  '新品': ['new', '2025', '2026'],
  '有趣': ['fun', 'creative', 'unique', 'quirky'],
  '礼品': ['gift', 'gift for', 'present']
};

async function main() {
  console.log('='.repeat(60));
  console.log('[选品采集] 开始执行 - 2026-04-27');
  console.log('='.repeat(60));

  // 初始化API
  console.log('[初始化] 连接JJY API...');
  await jjyApi.init();
  console.log('[初始化] 完成\n');

  const allResults = {};
  let totalCollected = 0;

  // 遍历每个平台
  for (const platform of platforms) {
    console.log(`\n>>> 正在采集: ${platform.name} - ${platform.catName}`);
    console.log(`    (catId: ${platform.catId})`);

    const platformResults = [];

    // 使用多个关键词进行搜索，增加多样性
    const keywords = [
      '',           // 无关键词-综合
      'fun',        // 有趣
      'unique',     // 独特
      'creative',   // 创意
      'gift',       // 礼品
      'new',        // 新品
      'best seller' // 热销
    ];

    // 每个平台搜索不同关键词（每个关键词取Top5，确保多样性）
    for (const keyword of keywords) {
      console.log(`    [关键词: "${keyword || '(综合)'}"] 搜索中...`);

      try {
        // 使用API搜索，限定类目和价格范围
        const result = await jjyApi.search({
          platform: platform.name,
          categoryId: platform.catId,
          keyword: keyword || undefined,
          size: 10,
          priceMin: 1,
          priceMax: 100
        });

        if (result.success && result.products.length > 0) {
          console.log(`        -> 获得 ${result.products.length} 个商品`);

          // 标记来源
          const tagged = result.products.map(item => ({
            ...item,
            _source: `${platform.name}:${keyword || '综合'}`,
            _platform: platform.name,
            _channel: keyword || '综合',
            _catName: platform.catName,
            _searchKeyword: keyword
          }));

          platformResults.push(...tagged);
        } else {
          console.log(`        -> 无数据或失败: ${result.error || '空结果'}`);
        }
      } catch (e) {
        console.log(`        -> 搜索失败: ${e.message}`);
      }

      // 避免请求过快
      await new Promise(r => setTimeout(r, 300));
    }

    // 去重（根据goodsId）
    const uniqueMap = new Map();
    for (const item of platformResults) {
      const key = item.goodsId || item.detailUrl || JSON.stringify(item);
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item);
      }
    }
    const uniqueProducts = Array.from(uniqueMap.values());

    allResults[platform.name] = {
      catName: platform.catName,
      catId: platform.catId,
      products: uniqueProducts
    };
    totalCollected += uniqueProducts.length;

    console.log(`    [合计] ${platform.name} 去重后共 ${uniqueProducts.length} 个商品`);

    // 平台间隔
    await new Promise(r => setTimeout(r, 500));
  }

  // 保存到今日目录
  const outputPath = path.join(todayDir, 'collected_data.json');
  fs.writeFileSync(outputPath, JSON.stringify(allResults, null, 2), 'utf8');

  console.log('\n' + '='.repeat(60));
  console.log(`[选品采集] 完成! 共采集 ${totalCollected} 个候选商品`);
  console.log(`[选品采集] 数据已保存至: ${outputPath}`);
  console.log('='.repeat(60));

  return allResults;
}

// 运行
main()
  .then(results => {
    // 打印汇总
    console.log('\n======== 各平台采集汇总 ========');
    for (const [platform, data] of Object.entries(results)) {
      console.log(`${platform}: ${data.products.length} 个商品 (${data.catName})`);
    }
  })
  .catch(console.error);