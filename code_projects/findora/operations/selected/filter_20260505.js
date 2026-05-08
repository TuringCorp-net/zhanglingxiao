/**
 * 筛选脚本 — 从原始数据中提取商品摘要，帮助选品侦察员做决策
 * 2026-05-05
 */

const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'dailytemp', '2026-05-05', 'raw_products.json');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

// 收集所有商品并去重（同一 goodsId 只保留一次）
const seen = new Set();
const allProducts = [];

for (const [platformKey, platformData] of Object.entries(raw)) {
  for (const ch of platformData.subChannels) {
    if (!ch.products) continue;
    for (const p of ch.products) {
      const id = p.goodsId || p.goodsNameEn?.substring(0, 50);
      if (seen.has(id)) continue;
      seen.add(id);

      allProducts.push({
        platform: platformKey,
        platformName: platformData.platform,
        catName: platformData.catName,
        subChannel: ch.subChannel,
        goodsId: p.goodsId,
        nameEn: (p.goodsNameEn || '').substring(0, 120),
        nameCn: (p.goodsNameCn || '').substring(0, 80),
        sold: p.sold || 0,
        sales: p.sales || 0,
        priceMin: p.goodsPriceMin,
        priceMax: p.goodsPriceMax,
        reviewNum: p.reviewNum || 0,
        rating: p.rating || 0,
        thumbnail: p.thumbnail || '',
        onSaleTime: p.onSaleTime || ''
      });
    }
  }
}

// 按销量排序打印
allProducts.sort((a, b) => b.sold - a.sold);

console.log(`\n========== 全部候选商品 (去重后: ${allProducts.length} 个) ==========\n`);

allProducts.forEach((p, i) => {
  const price = p.priceMin === p.priceMax
    ? `$${p.priceMin}`
    : `$${p.priceMin}-$${p.priceMax}`;
  const sold = p.sold >= 10000 ? `${(p.sold/10000).toFixed(1)}万` : p.sold;

  console.log(`[${i+1}] ${p.platformName} | ${p.catName} | ${p.subChannel}`);
  console.log(`    名称: ${p.nameEn}`);
  console.log(`    中文: ${p.nameCn}`);
  console.log(`    销量: ${sold} | 价格: ${price} | 评分: ${p.rating} | 评论: ${p.reviewNum}`);
  console.log(`    ID: ${p.goodsId} | 图片: ${p.thumbnail}`);
  console.log('');
});

// 保存去重后的结构化数据用于后续处理
const dedupedPath = path.join(__dirname, 'dailytemp', '2026-05-05', 'deduped_products.json');
fs.writeFileSync(dedupedPath, JSON.stringify(allProducts, null, 2), 'utf-8');
console.log(`\n去重数据已保存: ${dedupedPath}`);
