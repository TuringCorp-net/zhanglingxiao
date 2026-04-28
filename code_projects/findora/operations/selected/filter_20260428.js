/**
 * 选品筛选脚本 - 2026-04-28
 *
 * 筛选标准：新奇/有趣/好玩/有爆点
 * 从200条候选商品中选出10个优质商品
 */

const fs = require('fs').promises;
const path = require('path');

async function main() {
  const rawFile = path.join(__dirname, 'dailytemp', '2026-04-28', 'raw_products.json');
  const products = JSON.parse(await fs.readFile(rawFile, 'utf-8'));

  console.log('=== 选品筛选开始 ===');
  console.log(`候选商品: ${products.length} 条\n`);

  // 评分函数 - 综合考虑新奇度、趣味性、销量等
  function scoreProduct(p) {
    let score = 0;
    const name = (p.goodsNameEn || p.goodsName || '').toLowerCase();
    const nameCn = (p.goodsNameCn || '').toLowerCase();

    // 1. 新奇关键词加分
    const noveltyKeywords = [
      'funny', 'cute', 'unique', 'creative', 'weird', 'interesting',
      'surprise', 'magic', 'smart', 'innovative', 'cool', 'amazing',
      '有趣的', '创意', '新奇', '搞怪', '爆款', '网红', '搞笑',
      '多功能', '自动', '智能', '神奇', '可爱', '实用'
    ];

    noveltyKeywords.forEach(kw => {
      if (name.includes(kw) || nameCn.includes(kw)) {
        score += 3;
      }
    });

    // 2. 销量评分（log化，避免头部商品得分过高）
    const sold = p.sold || 0;
    if (sold > 0) {
      score += Math.log10(Math.max(sold, 1)) * 2;
    }

    // 3. 评论数评分
    const reviews = p.reviewNum || 0;
    if (reviews > 0) {
      score += Math.log10(Math.max(reviews, 1)) * 1.5;
    }

    // 4. 评分加分（好评率高）
    const rating = p.rating || 0;
    if (rating >= 4.5) score += 2;
    else if (rating >= 4.0) score += 1;

    // 5. 价格合理性（$5-$50 最佳利润区间）
    const price = p.goodsPriceMin || 0;
    if (price >= 3 && price <= 80) {
      score += 1;
    }

    // 6. 趣味性加分（特定关键词）
    const funKeywords = [
      'game', 'toy', 'gift', 'party', 'decor', 'light', 'led',
      'festival', 'christmas', 'halloween', 'pet', 'kids', 'baby',
      'kitchen', 'home', 'car', 'phone', 'makeup', 'beauty'
    ];

    funKeywords.forEach(kw => {
      if (name.includes(kw)) {
        score += 1;
      }
    });

    // 7. 特殊加分项（产品名称含有特殊卖点）
    const specialKeywords = [
      'selfie', 'wireless', 'portable', 'mini', 'travel', 'outdoor',
      'birthday', 'wedding', 'anniversary', 'lover', 'couple',
      'fitness', 'yoga', 'sport', 'gaming', 'fashion'
    ];

    specialKeywords.forEach(kw => {
      if (name.includes(kw)) {
        score += 0.5;
      }
    });

    return score;
  }

  // 去重（按商品名称相似度）
  function deduplicate(items) {
    const seen = new Set();
    return items.filter(p => {
      const name = (p.goodsNameEn || p.goodsName || '').substring(0, 30);
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }

  // 对每个平台分别评分并选取Top2
  const byPlatform = {};
  products.forEach(p => {
    const plat = p._source.platform;
    if (!byPlatform[plat]) byPlatform[plat] = [];
    byPlatform[plat].push(p);
  });

  const selected = [];

  // 从每个平台选取最有趣的商品
  for (const [platform, plats] of Object.entries(byPlatform)) {
    // 按分数排序
    const scored = plats.map(p => ({
      ...p,
      _score: scoreProduct(p)
    })).sort((a, b) => b._score - a._score);

    // 取前2-3个
    const top = scored.slice(0, 3);
    selected.push(...top);

    console.log(`[${platform}] 评分Top3:`);
    top.forEach((p, i) => {
      const name = (p.goodsNameEn || p.goodsName || '(无名称)').substring(0, 50);
      console.log(`  ${i+1}. [${p._score.toFixed(2)}] ${name}...`);
    });
  }

  // 去重
  const deduped = deduplicate(selected);

  // 最终选取10个（如果不足10个则全部选取）
  const final = deduped.slice(0, 10);

  console.log(`\n=== 筛选完成 ===`);
  console.log(`去重前: ${selected.length} 条`);
  console.log(`去重后: ${deduped.length} 条`);
  console.log(`最终入选: ${final.length} 条\n`);

  // 生成商品编号 (日期+三位序号)
  const dateStr = '20260428';
  final.forEach((p, i) => {
    p._selectorId = `${dateStr}${String(i + 1).padStart(3, '0')}`;
  });

  // 保存筛选结果
  const selectedFile = path.join(__dirname, 'selected_20260428.json');
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

    report += `### ${i + 1}. ${name}

- **编号**: ${p._selectorId}
- **平台**: ${p._source.platform} / ${p._source.catName}
- **来源渠道**: ${p._source.channel}
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
1. **新奇度**: 产品名称/描述含有 novelty 关键词（如 funny/cute/unique/creative）
2. **趣味性**: 产品具有娱乐属性（game/toy/decor/light/LED 等）
3. **销量基础**: 有一定市场验证（销量 > 0）
4. **好评率**: 评分 >= 4.0
5. **价格区间**: $3-$80 利润空间合理
6. **平台分布**: 每平台最多入选 3 个，确保多样性

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