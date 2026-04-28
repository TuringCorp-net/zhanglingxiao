/**
 * 选品筛选脚本 V2 - 2026-04-28
 *
 * 筛选标准：新奇/有趣/好玩/有爆点
 * 从200条候选商品中选出10个优质商品（每平台2个）
 */

const fs = require('fs').promises;
const path = require('path');

async function main() {
  const rawFile = path.join(__dirname, 'dailytemp', '2026-04-28', 'raw_products.json');
  const products = JSON.parse(await fs.readFile(rawFile, 'utf-8'));

  console.log('=== 选品筛选开始 ===');
  console.log(`候选商品: ${products.length} 条\n`);

  // 关键词列表（用于识别有趣商品）
  const INTERESTING_KEYWORDS = [
    'funny', 'cute', 'unique', 'creative', 'weird', 'interesting', 'surprise', 'magic', 'smart', 'innovative',
    'cool', 'amazing', 'crazy', 'love', 'fantastic', 'awesome', 'cute', 'gorgeous', 'trendy', 'fashion',
    'game', 'toy', 'gift', 'party', 'decor', 'light', 'led', 'neon', 'glow', 'rgb',
    'festival', 'christmas', 'halloween', 'easter', 'valentine', 'wedding', 'birthday', 'anniversary',
    'pet', 'kids', 'baby', 'children', 'children',
    'kitchen', 'home', 'house', 'office', 'car', 'vehicle', 'auto',
    'phone', 'smartphone', 'tablet', 'laptop', 'camera', 'watch',
    'makeup', 'beauty', 'cosmetics', 'skin', 'hair', 'nail',
    'fitness', 'yoga', 'sport', 'outdoor', 'camping', 'hiking', 'travel',
    'gaming', 'gamer', 'console', 'controller', 'vr', 'ar',
    'novelty', 'quirky', 'quirk', 'special', 'disguise', 'costume',
    'portable', 'mini', 'compact', 'tiny', 'small', 'foldable',
    'wireless', 'bluetooth', 'remote', 'automatic', 'electric', 'battery',
    'selfie', 'photo', 'video', 'stream', 'podcast', 'youtube', 'tiktok',
    'couple', 'lover', 'romantic', 'friendship', 'family',
    'festival', 'carnival', 'concert', 'disco', 'party', 'bar', 'club'
  ];

  // 产品名称相似度（用于去重）
  function similarity(a, b) {
    const a1 = (a.goodsNameEn || a.goodsName || '').toLowerCase().substring(0, 40);
    const b1 = (b.goodsNameEn || b.goodsName || '').toLowerCase().substring(0, 40);

    // 检查是否有共同的有意义词
    const aWords = a1.split(/\s+/).filter(w => w.length > 3);
    const bWords = b1.split(/\s+/).filter(w => w.length > 3);

    let common = 0;
    aWords.forEach(w => {
      if (bWords.some(bw => bw.includes(w) || w.includes(bw))) common++;
    });

    return common / Math.max(aWords.length, bWords.length);
  }

  // 评分函数
  function scoreProduct(p) {
    let score = 0;
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    const nameCn = (p.goodsNameCn || '').toLowerCase();

    // 1. 有趣关键词匹配
    let keywordMatch = 0;
    INTERESTING_KEYWORDS.forEach(kw => {
      if (name.includes(kw) || nameCn.includes(kw)) keywordMatch++;
    });
    score += keywordMatch * 4;

    // 2. 销量评分（对数处理）
    const sold = p.sold || 0;
    if (sold > 100) {
      score += Math.log10(Math.max(sold, 1)) * 1.5;
    }

    // 3. 评论数评分
    const reviews = p.reviewNum || 0;
    if (reviews > 10) {
      score += Math.log10(Math.max(reviews, 1)) * 1;
    }

    // 4. 评分加分
    const rating = p.rating || 0;
    if (rating >= 4.5) score += 3;
    else if (rating >= 4.0) score += 1.5;

    // 5. 价格区间加分（$5-$50 最佳）
    const price = p.goodsPriceMin || 0;
    if (price >= 5 && price <= 50) score += 2;
    else if (price >= 3 && price <= 100) score += 1;

    // 6. 特殊属性加分
    const hasSpecial = [
      'selfie', 'wireless', 'portable', 'mini', 'travel', 'outdoor',
      'bluetooth', 'led', 'rgb', 'festival', 'party', 'gift',
      'game', 'toy', 'kids', 'pet', 'fitness', 'sport'
    ].some(kw => name.includes(kw));
    if (hasSpecial) score += 3;

    return score;
  }

  // 按平台分组
  const byPlatform = {};
  products.forEach(p => {
    const plat = p._source.platform;
    if (!byPlatform[plat]) byPlatform[plat] = [];
    byPlatform[plat].push(p);
  });

  // 从每个平台选取评分最高的商品
  const selected = [];

  for (const [platform, plats] of Object.entries(byPlatform)) {
    // 按分数排序
    const scored = plats.map(p => ({
      ...p,
      _score: scoreProduct(p)
    })).sort((a, b) => b._score - a._score);

    console.log(`[${platform}] 评分Top5:`);
    scored.slice(0, 5).forEach((p, i) => {
      const name = (p.goodsNameEn || p.goodsName || '(无名称)').substring(0, 50);
      console.log(`  ${i+1}. [${p._score.toFixed(2)}] ${name}...`);
    });

    // 从每个平台选2个（要避免相似）
    let picked = [];
    for (const item of scored) {
      if (picked.length >= 2) break;

      // 检查是否与已选商品相似
      const tooSimilar = picked.some(p => similarity(p, item) > 0.6);
      if (!tooSimilar) {
        picked.push(item);
      }
    }
    selected.push(...picked);
  }

  // 最终选取10个
  const final = selected.slice(0, 10);

  console.log(`\n=== 筛选完成 ===`);
  console.log(`入选商品: ${final.length} 条\n`);

  // 生成商品编号 (日期+三位序号)
  const dateStr = '20260428';
  final.forEach((p, i) => {
    p._selectorId = `${dateStr}${String(i + 1).padStart(3, '0')}`;
  });

  // 保存筛选结果
  const selectedFile = path.join(__dirname, 'selected_20260428_v2.json');
  await fs.writeFile(selectedFile, JSON.stringify(final, null, 2), 'utf-8');
  console.log(`筛选结果已保存: ${selectedFile}`);

  // 生成 Markdown 报告
  let report = `# 选品报告 - 2026-04-28

> 选品时间: 2026-04-28
> 候选商品: 200 条
> 入选商品: ${final.length} 条

## 入选商品清单

`;

  final.forEach((p, i) => {
    const name = p.goodsNameEn || p.goodsName || '(无名称)';
    const nameCn = p.goodsNameCn || '';
    const price = p.goodsPriceMin ? `$${p.goodsPriceMin}` : 'N/A';
    const priceMax = p.goodsPriceMax ? `-$${p.goodsPriceMax}` : '';
    const sold = p.sold ? `${p.sold.toLocaleString()}` : 'N/A';
    const reviews = p.reviewNum ? `${p.reviewNum.toLocaleString()}` : 'N/A';
    const rating = p.rating || 'N/A';
    const goodsId = p.goodsId || '';
    const thumbnail = p.thumbnail || '';
    const channel = p._source?.channel || 'N/A';

    report += `### ${i + 1}. ${name}

- **编号**: ${p._selectorId}
- **平台**: ${p._source.platform} / ${p._source.catName}
- **来源渠道**: ${channel}
- **名称(英)**: ${name}
${nameCn ? `- **名称(中)**: ${nameCn}` : ''}
- **价格**: ${price}${priceMax}
- **销量**: ${sold}
- **评论数**: ${reviews}
- **评分**: ${rating}
- **商品ID**: ${goodsId}
${thumbnail ? `- **图片**: ${thumbnail}` : ''}

---

`;
  });

  report += `## 筛选标准说明

本次筛选基于以下标准：
1. **有趣关键词**: 匹配 novelty/fun/creative/game/toy 等词
2. **销量基础**: 有一定市场验证（销量 > 100）
3. **好评率**: 评分 >= 4.0
4. **价格区间**: $3-$100 利润空间合理
5. **特殊属性**: 便携/迷你/LED/RGB/无线/户外 等
6. **去重**: 相似商品去重，保留多样性

---

*由 Selector Agent 自动生成*
`;

  const reportFile = path.join(__dirname, '20260428_selector_report.md');
  await fs.writeFile(reportFile, report, 'utf-8');
  console.log(`选品报告已保存: ${reportFile}`);

  return final;
}

main()
  .then(final => {
    console.log('\n筛选脚本执行完成');
    process.exit(0);
  })
  .catch(e => {
    console.error('筛选脚本异常:', e);
    process.exit(1);
  });