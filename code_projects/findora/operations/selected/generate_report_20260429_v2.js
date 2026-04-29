/**
 * 选品报告生成脚本 - 2026-04-29 第二轮
 *
 * 从已筛选的6个商品中生成最终选品报告
 * 同时补充更多有潜力的商品，目标是10个
 */

const fs = require('fs');
const path = require('path');

// 读取已筛选数据
const filterData = JSON.parse(fs.readFileSync(
  __dirname + '/dailytemp/2026-04-29/filter_20260429_v2.json',
  'utf-8'
));

// 读取原始采集数据
const crawlData = JSON.parse(fs.readFileSync(
  __dirname + '/dailytemp/2026-04-29/crawl_20260429_v2.json',
  'utf-8'
));

// 已选中的商品
const selected = filterData.selectedProducts;

// 从未筛选的产品中补充（排除已有）
const existingIds = new Set(selected.map(p => p.goodsId));
const remainingProducts = crawlData.data.filter(p =>
  !existingIds.has(p.goodsId) && p.sold > 5000
);

// 评分函数（简化版）
function quickScore(p) {
  let s = 0;
  const name = (p.goodsNameEn || '').toLowerCase();
  const sold = p.sold || 0;

  // 销量基础分
  if (sold >= 10000) s += 5;
  if (sold >= 30000) s += 5;
  if (sold >= 50000) s += 5;

  // 有意义的名称长度
  if (name.length >= 30) s += 2;

  // 评论和评分
  if ((p.reviewNum || 0) >= 200) s += 2;
  if ((p.rating || 0) >= 4.5) s += 2;

  // 价格适中
  const avgPrice = ((p.goodsPriceMin || 0) + (p.goodsPriceMax || 0)) / 2;
  if (avgPrice >= 3 && avgPrice <= 40) s += 1;

  return s;
}

// 补充商品（每个平台最多补充2个）
const platform补充 = {};
const additional = [];

for (const p of remainingProducts) {
  const platform = p.sourcePlatform;
  if (!platform补充[platform]) platform补充[platform] = 0;
  if (platform补充[platform] >= 2) continue;
  if (additional.length >= 4) break;

  const score = quickScore(p);
  if (score >= 8) {
    additional.push({ ...p, score });
    platform补充[platform]++;
  }
}

// 合并
const allSelected = [
  ...selected.map(p => ({ ...p, score: p.score || 0 })),
  ...additional
];

console.log(`\n最终入选商品: ${allSelected.length} 个\n`);

// 生成最终选品报告
const today = '2026-04-29';
const reportId = `${today.replace(/-/g, '')}030`;  // 20260429030

const report = {
  reportId,
  date: today,
  timestamp: new Date().toISOString(),
  summary: {
    totalScanned: crawlData.data.length,
    finalSelected: allSelected.length
  },
  products: allSelected.map((p, i) => ({
    id: `${reportId}-${String(i + 1).padStart(3, '0')}`,
    platform: p.sourcePlatform,
    category: p.sourceCatName,
    channel: p.sourceChannel,
    goodsId: p.goodsId,
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    thumbnail: p.thumbnail,
    price: {
      min: p.goodsPriceMin,
      max: p.goodsPriceMax
    },
    sold: p.sold,
    reviewNum: p.reviewNum,
    rating: p.rating,
    score: p.score,
    sourceUrl: getSourceUrl(p)
  }))
};

function getSourceUrl(p) {
  const domains = {
    temu: 'www.temaishuju.com',
    shein: 'www.sheinshuju.com',
    amazon: 'www.amazonshuju.com',
    sumaitong: 'www.sumaitongshuju.com',
    tiktok: 'www.tiktokshuju.com'
  };
  const channelMap = {
    '热销商品': 'hot-sale',
    '热销新品': 'hot-sale-new',
    '新店热销': 'new-mall-hot-sale',
    '大卖新品': 'big-sale-new'
  };
  const domain = domains[p.sourcePlatform] || domains.temu;
  const channel = channelMap[p.sourceChannel] || 'hot-sale';
  return `https://${domain}/goods/${channel}`;
}

// 保存JSON格式
const jsonPath = __dirname + '/selected_20260429_v2.json';
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
console.log(`JSON 报告: ${jsonPath}`);

// 生成 markdown 报告
const mdPath = __dirname + '/20260429_selector_report_v2.md';
const mdContent = `# 选品报告 - ${today} 第二轮

**报告ID**: ${reportId}
**生成时间**: ${report.timestamp}
**扫描商品**: ${report.summary.totalScanned}
**入选商品**: ${report.summary.finalSelected}

---

## 入选商品

${report.products.map((p, i) => `### ${i + 1}. [${p.platform.toUpperCase()}] ${p.category}

| 字段 | 内容 |
|------|------|
| 商品ID | ${p.goodsId} |
| 英文名称 | ${p.goodsNameEn} |
| 中文名称 | ${p.goodsNameCn} |
| 来源渠道 | ${p.channel} |
| 价格区间 | $${p.price.min} ~ $${p.price.max || p.price.min} |
| 销量 | ${p.sold} |
| 评论数 | ${p.reviewNum} |
| 评分 | ${p.rating} |
| 选品评分 | ${p.score} |
| 来源链接 | ${p.sourceUrl} |
| 缩略图 | ![](${p.thumbnail}) |

`).join('\n---\n\n')}

---

## 筛选逻辑

1. **新奇/有趣/好玩/有爆点** - 产品名称/描述中有独特卖点或创意元素
2. **销量表现** - 基数量级（≥5000）表明市场接受度
3. **评论数和评分** - 真实购买反馈验证质量
4. **价格区间** - 适中价格（$3-$50）易于销售
5. **平台多样性** - 尽量覆盖多个平台

---

## 采集信息

本次采集目标类目（按最后采集时间排序）：
- Temu: 视频游戏 (catId=23177)
- Shein: 宝贝儿 (catId=3224)
- Amazon: 狩猎&渔具 (catId=706813011)
- 速卖通: 电话和通讯 (catId=509)
- TikTok: Pre-Owned (catId=856720)

**下一步**: 由 Curator 进行二次包装与推广文案撰写
`;

fs.writeFileSync(mdPath, mdContent, 'utf-8');
console.log(`Markdown 报告: ${mdPath}`);

// 打印最终结果
console.log('\n' + '='.repeat(60));
console.log('最终入选商品');
console.log('='.repeat(60));
report.products.forEach((p, i) => {
  console.log(`\n[${i + 1}] ${p.platform.toUpperCase()}/${p.category}`);
  console.log(`    ${p.goodsNameEn?.substring(0, 60)}...`);
  console.log(`    价格: $${p.price.min} | 销量: ${p.sold} | 评分: ${p.score}`);
});

module.exports = report;