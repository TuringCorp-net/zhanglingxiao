/**
 * 综合筛选+选品脚本 — 2026-05-05 (第2轮)
 * 1. 从 raw_products.json 去重并展示所有候选商品
 * 2. 按"新奇/有趣/好玩/有爆点"标准人工精选10个
 * 3. 生成 markdown 文件
 * 4. 更新 crawl_state.js
 */

const fs = require('fs');
const path = require('path');

const rawPath = path.join(__dirname, 'dailytemp', '2026-05-05-v2', 'raw_products.json');
const raw = JSON.parse(fs.readFileSync(rawPath, 'utf-8'));

// === 第1步：收集所有商品并去重 ===
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
        nameEn: (p.goodsNameEn || '').substring(0, 150),
        nameCn: (p.goodsNameCn || '').substring(0, 100),
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

// 按销量排序
allProducts.sort((a, b) => b.sold - a.sold);

console.log(`\n========== 全部候选商品 (去重后: ${allProducts.length} 个) ==========\n`);

allProducts.forEach((p, i) => {
  const price = p.priceMin === p.priceMax || !p.priceMax
    ? `$${p.priceMin || '?'}`
    : `$${p.priceMin}-$${p.priceMax}`;
  const sold = p.sold >= 10000 ? `${(p.sold/10000).toFixed(1)}万` : p.sold;
  const ratingStr = p.rating ? `${p.rating}★` : '无评分';

  console.log(`[${i+1}] ${p.platformName} | ${p.catName} | ${p.subChannel}`);
  console.log(`    EN: ${p.nameEn}`);
  console.log(`    CN: ${p.nameCn}`);
  console.log(`    销量:${sold} | 价格:${price} | ${ratingStr} | 评论:${p.reviewNum}`);
  console.log(`    ID: ${p.goodsId}`);
  if (p.onSaleTime) console.log(`    上架: ${p.onSaleTime}`);
  console.log('');
});

// 保存去重数据
const dedupedPath = path.join(__dirname, 'dailytemp', '2026-05-05-v2', 'deduped_products.json');
fs.writeFileSync(dedupedPath, JSON.stringify(allProducts, null, 2), 'utf-8');
console.log(`\n去重数据已保存: ${dedupedPath}\n`);
console.log(`========== 候选商品列表结束 ==========\n`);
