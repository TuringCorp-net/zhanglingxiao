/**
 * 选品采集脚本 — 2026-05-05 (第3轮)
 *
 * 按 crawl_state.js 规则，每平台选择"最久未采集"的类目：
 * - TEMU:     汽车用品 (19858)                    上次: 2026-04-29
 * - Shein:    办公和学校用品 (2297)                上次: 2026-04-29
 * - Amazon:   健康与家居 (3760901)                 上次: 2026-04-29
 * - 速卖通:   摩托车装备配件 (201355758)           上次: null (从未采集)
 * - TikTok:   Womenswear & Underwear (601152)     上次: 2026-04-27
 *
 * 每平台4子渠道 × Top10 = 每平台40个 = 共200个候选商品
 * 时间范围：最近30天（2026-04-05 ~ 2026-05-05）
 */

const JJYAPITool = require('../tools/jjy_api.js');
const fs = require('fs');
const path = require('path');

// 日期
const TODAY = '2026-05-05';
const DAYS_30_AGO = '2026-04-05';

// 本次采集目标（各平台最久未采集类目）
const TARGETS = [
  {
    platform: 'temu',
    platformName: 'Temu',
    catId: 19858,
    catName: '汽车用品',
    sort: 'sold'
  },
  {
    platform: 'shein',
    platformName: 'Shein',
    catId: 2297,
    catName: '办公和学校用品',
    sort: 'sold'
  },
  {
    platform: 'amazon',
    platformName: 'Amazon',
    catId: 3760901,
    catName: '健康与家居',
    sort: 'monthSold'
  },
  {
    platform: 'sumaitong',
    platformName: '速卖通',
    catId: 201355758,
    catName: '摩托车装备配件',
    sort: 'totalSold'
  },
  {
    platform: 'tiktok',
    platformName: 'TikTok',
    catId: 601152,
    catName: 'Womenswear & Underwear',
    sort: 'totalSold'
  }
];

// 4个子渠道的搜索策略
const SUB_CHANNELS = [
  { name: '热销商品', desc: '按销量排序，不限时间', params: { sort: null, onSaleTimeStart: null, onSaleTimeEnd: null } },
  { name: '热销新品', desc: '按销量排序，最近30天上架', params: { sort: null, onSaleTimeStart: DAYS_30_AGO, onSaleTimeEnd: TODAY } },
  { name: '高评分热销', desc: '按评论数排序，不限时间', params: { sort: 'reviewNum', onSaleTimeStart: null, onSaleTimeEnd: null } },
  { name: '最近新品', desc: '按上架时间排序，最近30天', params: { sort: 'createTime', onSaleTimeStart: DAYS_30_AGO, onSaleTimeEnd: TODAY } }
];

// ============================================
// 选品筛选逻辑
// ============================================

/**
 * 计算商品的"选品得分"（新奇/有趣/好玩/有爆点）
 * 得分越高越值得选中
 */
function scoreProduct(product, platform, catName) {
  let score = 0;
  const reasons = [];

  // 1. 销量信号（高销量 = 有爆点）
  const sold = product.sold || 0;
  if (sold >= 10000) { score += 30; reasons.push(`销量破万(${sold})`); }
  else if (sold >= 5000) { score += 20; reasons.push(`热销(${sold})`); }
  else if (sold >= 1000) { score += 10; reasons.push(`销量不错(${sold})`); }
  else if (sold > 0) { score += 3; }
  else { score -= 5; } // 零销量扣分

  // 2. 评论+评分信号（高评论数+高评分 = 已验证的好商品）
  const reviewNum = product.reviewNum || 0;
  const rating = parseFloat(product.rating) || 0;
  if (reviewNum >= 500 && rating >= 4.5) { score += 25; reasons.push(`口碑爆款(评论${reviewNum}, 评分${rating})`); }
  else if (reviewNum >= 200 && rating >= 4.0) { score += 15; reasons.push(`高评价(评论${reviewNum}, 评分${rating})`); }
  else if (reviewNum >= 50) { score += 8; reasons.push(`有评论积累(${reviewNum})`); }

  // 3. 新奇/有趣信号（商品名称中包含特定关键词）
  const nameEn = (product.goodsNameEn || '').toLowerCase();
  const nameCn = (product.goodsNameCn || '').toLowerCase();
  const fullName = nameEn + ' ' + nameCn;

  const noveltyKeywords = [
    // 英文
    'mini', 'portable', 'led', 'smart', 'wireless', 'bluetooth', 'usb', '3d', 'creative',
    'magic', 'unique', 'novel', 'cool', 'funny', 'cute', 'cartoon', 'animal', 'shape',
    'multifunction', 'foldable', 'magnetic', 'solar', 'waterproof', 'glowing', 'gadget',
    // 中文
    '迷你', '便携', '创意', '新奇', '趣味', '可爱', '卡通', '多功能', '折叠', '磁吸',
    '太阳能', '防水', '发光', '智能', '无线', '蓝牙', 'USB', '3D', '网红'
  ];

  let noveltyCount = 0;
  for (const kw of noveltyKeywords) {
    if (fullName.includes(kw)) { noveltyCount++; }
  }
  if (noveltyCount >= 5) { score += 30; reasons.push(`新奇关键词密集(${noveltyCount}个)`); }
  else if (noveltyCount >= 3) { score += 20; reasons.push(`颇具新意(${noveltyCount}个关键词)`); }
  else if (noveltyCount >= 1) { score += 10; reasons.push(`有新意元素`); }

  // 4. 价格信号（价格适中更易传播）
  const price = product.goodsPriceMin || product.goodsPriceMax || 0;
  if (price >= 5 && price <= 50) { score += 10; reasons.push(`价格适中($${price})`); }
  else if (price < 5) { score += 5; reasons.push(`低价引流($${price})`); }
  else if (price > 50 && price <= 100) { score += 3; reasons.push(`中高价($${price})`); }

  // 5. 平台+类目的特殊加分
  // 汽车用品 - 新奇车载小工具往往有趣
  if (catName === '汽车用品') { score += 5; }
  // 摩托车装备 - 特殊品类，差异化强
  if (catName === '摩托车装备配件') { score += 8; }
  // 办公和学校用品 - 创意文具/办公小物
  if (catName === '办公和学校用品') { score += 5; }
  // 健康与家居 - 健康类产品天然有吸引力
  if (catName === '健康与家居') { score += 5; }
  // Womenswear & Underwear - 服装品类
  if (catName === 'Womenswear & Underwear') { score += 2; }

  // 6. 上架时间加分（越新越好）
  const onSaleTime = product.onSaleTime;
  if (onSaleTime) {
    const daysOnSale = Math.floor((new Date(TODAY) - new Date(onSaleTime)) / (1000 * 60 * 60 * 24));
    if (daysOnSale <= 7) { score += 15; reasons.push(`新品上架≤7天`); }
    else if (daysOnSale <= 30) { score += 8; reasons.push(`近30天上架`); }
  }

  return { score, reasons };
}

/**
 * 从所有候选商品中筛选 Top N
 */
function selectTopProducts(allProducts, topN = 10) {
  // 去重（按 goodsId）
  const seen = new Set();
  const uniqueProducts = [];

  for (const item of allProducts) {
    const id = item.product.goodsId || item.product.goodsNameEn;
    if (!seen.has(id)) {
      seen.add(id);
      uniqueProducts.push(item);
    }
  }

  // 按得分排序
  uniqueProducts.sort((a, b) => b.score - a.score);

  // 确保多样性 - 尽量覆盖不同平台
  const selected = [];
  const platformCount = {};
  const MAX_PER_PLATFORM = 3;

  for (const item of uniqueProducts) {
    const pf = item.platform;
    const count = platformCount[pf] || 0;
    if (count < MAX_PER_PLATFORM) {
      selected.push(item);
      platformCount[pf] = count + 1;
    }
    if (selected.length >= topN) break;
  }

  // 如果还不够 topN，放开平台限制补足
  if (selected.length < topN) {
    for (const item of uniqueProducts) {
      if (!selected.includes(item)) {
        selected.push(item);
        if (selected.length >= topN) break;
      }
    }
  }

  return selected;
}

// ============================================
// 主函数
// ============================================

async function main() {
  const jjyApi = new JJYAPITool();

  // 初始化
  console.log('[采集] 初始化 JJY API...');
  await jjyApi.init();
  console.log('[采集] 初始化完成\n');

  const allCandidates = []; // { platform, catName, subChannel, product, scoreData }

  // 逐个平台采集
  for (const target of TARGETS) {
    console.log(`\n========== ${target.platformName} | ${target.catName} (catId=${target.catId}) ==========`);

    for (const ch of SUB_CHANNELS) {
      console.log(`  [${ch.name}] ${ch.desc}`);

      const searchParams = {
        platform: target.platform,
        categoryId: target.catId,
        size: 10,
        page: 1,
        order: 'descend'
      };

      if (ch.params.sort) {
        searchParams.sort = ch.params.sort;
      } else {
        searchParams.sort = target.sort;
      }

      if (ch.params.onSaleTimeStart) {
        searchParams.onSaleTimeStart = ch.params.onSaleTimeStart;
      }
      if (ch.params.onSaleTimeEnd) {
        searchParams.onSaleTimeEnd = ch.params.onSaleTimeEnd;
      }

      try {
        const result = await jjyApi.search(searchParams);

        if (result.success && result.products.length > 0) {
          console.log(`    ✓ 获取到 ${result.products.length} 个商品 (总计 ${result.total})`);

          for (const product of result.products) {
            const scoreData = scoreProduct(product, target.platform, target.catName);
            allCandidates.push({
              platform: target.platform,
              platformName: target.platformName,
              catId: target.catId,
              catName: target.catName,
              subChannel: ch.name,
              product,
              score: scoreData.score,
              reasons: scoreData.reasons
            });
          }
        } else if (result.success) {
          console.log(`    △ 返回0个商品 (总计 ${result.total})`);
        } else {
          console.log(`    ✗ 失败: ${result.error}`);
        }

        await new Promise(r => setTimeout(r, 500));

      } catch (e) {
        console.log(`    ✗ 异常: ${e.message}`);
      }
    }
  }

  console.log(`\n========== 采集完成: 共 ${allCandidates.length} 个候选商品 ==========`);

  // 保存原始数据
  const outputDir = path.join(__dirname, 'dailytemp', '2026-05-05-v3');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(outputDir, 'candidates.json'),
    JSON.stringify(allCandidates, null, 2),
    'utf-8'
  );

  // 筛选 Top 10
  const top10 = selectTopProducts(allCandidates, 10);

  console.log(`\n========== 精选 Top ${top10.length} 商品 ==========`);
  top10.forEach((item, i) => {
    console.log(`\n${i + 1}. [${item.platformName}] ${item.catName} | 得分: ${item.score}`);
    console.log(`   商品: ${(item.product.goodsNameEn || '').substring(0, 80)}`);
    console.log(`   理由: ${item.reasons.join('; ')}`);
    console.log(`   销量: ${item.product.sold} | 价格: $${item.product.goodsPriceMin || '?'}~$${item.product.goodsPriceMax || '?'}`);
    console.log(`   子渠道: ${item.subChannel}`);
  });

  // 输出 JSON 供后续使用
  console.log('\n[JSON_OUTPUT]');
  console.log(JSON.stringify({
    totalCandidates: allCandidates.length,
    selectedCount: top10.length,
    top10: top10.map((item, i) => ({
      rank: i + 1,
      platform: item.platformName,
      catName: item.catName,
      score: item.score,
      nameEn: (item.product.goodsNameEn || '').substring(0, 100),
      nameCn: (item.product.goodsNameCn || '').substring(0, 100),
      sold: item.product.sold,
      priceMin: item.product.goodsPriceMin,
      priceMax: item.product.goodsPriceMax,
      reviewNum: item.product.reviewNum,
      rating: item.product.rating,
      goodsId: item.product.goodsId,
      thumbnail: item.product.thumbnail,
      onSaleTime: item.product.onSaleTime,
      reasons: item.reasons,
      subChannel: item.subChannel
    }))
  }));
}

main().catch(e => {
  console.error('[采集] 致命错误:', e.message);
  console.log('\n[JSON_OUTPUT]');
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
