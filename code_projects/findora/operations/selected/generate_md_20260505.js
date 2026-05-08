/**
 * 生成选品 Markdown 文件 — 2026-05-05
 * 从143个去重候选商品中精选10个最有趣/新奇/有爆点的商品
 */

const fs = require('fs');
const path = require('path');

// 10个精选商品
const selected = [
  {
    productId: '20260505-001',
    platform: 'tiktok',
    platformName: 'TikTok',
    catName: 'Health',
    goodsId: '1729413266549936259',
    nameEn: 'Neuro Peppermint Energy & Focus Gum/Mints - Sugar Free with Natural Caffeine, L-theanine, Vitamin B12 & Vitamin B6',
    nameCn: 'Neuro薄荷能量专注口香糖/薄荷糖 - 无糖，含天然咖啡因、L-茶氨酸、维生素B12和B6',
    priceMin: 24.99,
    priceMax: 27.89,
    sold: 954375,
    reviewNum: 61443,
    rating: 4.2,
    thumbnail: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/171883f662854e04879793935497b0b4~tplv-fhlh96nyum-crop-webp:1373:1339.webp?dr=12190&t=555f072d&ps=933b5bde&shp=8dbd94bf&shcp=d741f1be&idc=useast5&from=2378011839',
    onSaleTime: '2024-06-14T03:48:42.303+08:00',
    selectReason: '能量+口香糖二合一创新品类。Neuro品牌以"健脑零食"概念切入，将咖啡因、L-茶氨酸融入口香糖/薄荷糖形态，既满足提神需求又有咀嚼趣味。95万销量、61万评论，TikTok爆款。无糖配方符合健康趋势，概念新鲜有趣。'
  },
  {
    productId: '20260505-002',
    platform: 'tiktok',
    platformName: 'TikTok',
    catName: 'Health',
    goodsId: '1729413027751104952',
    nameEn: 'Nello Supercalm Calming Drink Mix with KSM-66 Ashwagandha Vitamin D3 Magnesium & L-Theanine Supports Cortisol Balance',
    nameCn: 'Nello Supercalm 镇静饮品粉 - KSM-66南非醉茄+维D3+镁+L-茶氨酸，支持皮质醇平衡，改善心情',
    priceMin: 33.96,
    priceMax: 31.80,
    sold: 850515,
    reviewNum: 39636,
    rating: 4.5,
    thumbnail: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/94461bebd923462fbd75961b17a1af55~tplv-fhlh96nyum-crop-webp:2000:2000.webp?dr=12190&t=555f072d&ps=933b5bde&shp=8dbd94bf&shcp=d741f1be&idc=useast8&from=2378011839',
    onSaleTime: '2024-05-26T22:54:43.067+08:00',
    selectReason: '"减压饮品"概念精准击中现代人焦虑痛点。主打KSM-66（顶级Ashwagandha提取物）配合镁+L-茶氨酸，让"喝一杯就能放松"成为新的消费场景。85万销量、4万评论，健康焦虑赛道黑马。搅拌粉形态方便有趣，社交传播力强。'
  },
  {
    productId: '20260505-003',
    platform: 'temu',
    platformName: 'Temu',
    catName: '手机和配件',
    goodsId: '606314105289849',
    nameEn: 'Creative Deer Head 360° Rotating Stainless Steel Phone Lanyard Connector, Ultra-Thin Metal Clip',
    nameCn: '创意鹿头360°旋转不锈钢手机挂绳连接器，超薄金属夹片，不会损坏手机，安全腕带挂件',
    priceMin: 3.02,
    priceMax: 3.02,
    sold: 1462,
    reviewNum: 14,
    rating: 4.9,
    thumbnail: 'https://img.kwcdn.com/product/fancy/add624c2-4cbe-4c31-b562-3c83b7a0345b.jpg',
    onSaleTime: '2026-04-06T04:05:16.406+00:00',
    selectReason: '鹿头造型×360°旋转×超薄金属夹片，设计感与实用性兼具。不同于普通手机挂绳片，鹿头造型让手机挂件变成"时尚配饰"。仅$3.02的价格极具冲动消费属性，4月刚上架的新品，评分4.9，潜力新品。'
  },
  {
    productId: '20260505-004',
    platform: 'temu',
    platformName: 'Temu',
    catName: '手机和配件',
    goodsId: '605905412271553',
    nameEn: 'iPhone Fast Charging Cable with Breathing Light, Nylon Braided, USB-A to Lightning',
    nameCn: 'iPhone带呼吸灯快速充电线，尼龙编织，USB-A转Lightning，耐用无缠设计，兼容iPhone 14/13/12/11/Plus Pro Max/X',
    priceMin: 3.40,
    priceMax: 5.50,
    sold: 1264,
    reviewNum: 4,
    rating: 4.8,
    thumbnail: 'https://img.kwcdn.com/product/fancy/f85006bd-77d6-4862-aca3-8c3bb59208b5.jpg',
    onSaleTime: '2026-04-11T18:37:17.000+00:00',
    selectReason: '带呼吸灯的充电线——充电时灯光律动，科技感十足。将普通充电配件升级为"酷炫桌面摆件"。尼龙编织耐用材质+呼吸灯设计，在同质化严重的充电线市场中独树一帜。4月新品，$3.40起售，便宜到让人忍不住下单。'
  },
  {
    productId: '20260505-005',
    platform: 'temu',
    platformName: 'Temu',
    catName: '手机和配件',
    goodsId: '601099559906266',
    nameEn: '1pc 3D Bear Mobile Phone Pendant Dust Plug',
    nameCn: '1个3D小熊手机挂饰防尘塞',
    priceMin: 1.21,
    priceMax: 1.33,
    sold: 100000,
    reviewNum: 8028,
    rating: 4.8,
    thumbnail: 'https://img.kwcdn.com/product/fancy/61248bbc-5a97-491c-9c97-5b256f1189ec.jpg',
    onSaleTime: '2024-06-22T21:36:15.926+00:00',
    selectReason: '$1.21超级低价+3D小熊超萌造型=治愈系冲动消费王者。既是防尘塞又是手机挂饰，一物两用。10万销量、8000+评论、4.8高评分，验证了"可爱即正义"的商业逻辑。3D立体设计比平面挂饰质感强，差异化明显。'
  },
  {
    productId: '20260505-006',
    platform: 'temu',
    platformName: 'Temu',
    catName: '手机和配件',
    goodsId: '601104501277026',
    nameEn: 'Phone Case - Fashionable High-End Creative Dark Style Anime Huge Eyeball Phone Case',
    nameCn: '手机壳 - 时尚高端创意暗黑风格动画巨大眼球手机壳，适用于iPhone 17/16/15/14/13/12/11 Pro Max',
    priceMin: 4.24,
    priceMax: 4.24,
    sold: 0,
    reviewNum: 0,
    rating: 0,
    thumbnail: 'https://img.kwcdn.com/product/open/f3f0c57e2a6f4304a549d3c03436ca39-goods.jpeg',
    onSaleTime: '2026-04-10T14:28:24.428+00:00',
    selectReason: '暗黑风巨大眼球设计——搞怪到极致就是艺术。在千篇一律的花卉/纯色/卡通手机壳中，这种"惊悚美学"让人过目不忘。$4.24的价位让消费者愿意为"话题性"买单。适合追求个性表达、喜欢引起社交讨论的年轻群体。'
  },
  {
    productId: '20260505-007',
    platform: 'shein',
    platformName: 'Shein',
    catName: '女装',
    goodsId: '40548945',
    nameEn: 'SHEIN Essnce Leather Women Pants Burgundy Red Leather Pants Crocodile Embossed Shorts, Summer',
    nameCn: 'SHEIN Essnce 酒红色鳄鱼压纹皮短裤，女士时尚夏日百搭',
    priceMin: 10.24,
    priceMax: 12.59,
    sold: 2719959,
    reviewNum: 1000,
    rating: 4.89,
    thumbnail: '//img.ltwebstatic.com/images3_pi/2024/08/12/f3/1723440635623b383cadb512ec9c1709744550d876_thumbnail_220x293.jpg',
    onSaleTime: '2021-07-08T08:00:00.000+08:00',
    selectReason: '272万销量超级爆品！鳄鱼压纹材质将常规短裤升级为"轻奢质感"单品。酒红色+鳄鱼纹=高级感爆棚，$10.24的价格让人不敢相信。4.89超高评分，Shein服装类霸榜产品。证明了"材质差异化"在低价快时尚中的巨大威力。'
  },
  {
    productId: '20260505-008',
    platform: 'shein',
    platformName: 'Shein',
    catName: '女装',
    goodsId: '446449286',
    nameEn: 'Y2K Artistic Tiger Print Fashionable Top, Summer Outfit For Women',
    nameCn: 'Y2K艺术老虎印花时尚上衣，适合夏季穿搭/海滩度假',
    priceMin: 6.69,
    priceMax: null,
    sold: 3000,
    reviewNum: 0,
    rating: 0,
    thumbnail: '//img.ltwebstatic.com/v4/j/spmp/2026/04/08/55/177562002865a3417beee35afd83cebfa5e1e2451e_thumbnail_405x552.jpg',
    onSaleTime: '2026-04-08T08:00:00.000+08:00',
    selectReason: 'Y2K千禧复古风+艺术老虎印花，精准踩中2026年Y2K回潮趋势。$6.69的超低价让消费者"试试也无妨"。4月刚上架即售3000件，显示Y2K风格仍在持续升温。动物印花+复古字体的组合在社交媒体上有极强的视觉传播力。'
  },
  {
    productId: '20260505-009',
    platform: 'sumaitong',
    platformName: '速卖通',
    catName: '男女内衣及家居服',
    goodsId: '3256811844132220',
    nameEn: 'High Waist Women\'s Padded Seamless Butt Lifter Buttocks Enhancer Shaper Pants Hip Pad Panties Push Up Lingerie Shapewear',
    nameCn: '高腰女性臀部提升无缝塑身裤 - 臀部加强垫臀推高内裤塑身内衣',
    priceMin: 26.08,
    priceMax: 27.63,
    sold: 5000,
    reviewNum: 608,
    rating: 4.9,
    thumbnail: 'https://ae-pic-a1.aliexpress-media.com/kf/S1d87301db83b4e3fbc8d922390ecfc415.jpg',
    onSaleTime: '2026-04-07T00:00:00.000+08:00',
    selectReason: '"瞬间拥有蜜桃臀"的功能型塑身裤，满足社交时代对身材的极致追求。无缝设计+臀部填充垫+高腰收腹三合一，比传统塑身衣更细分、功能更聚焦。4.9高评分、608条评论验证产品力。$26客单价在速卖通属中高端，利润空间大。'
  },
  {
    productId: '20260505-010',
    platform: 'sumaitong',
    platformName: '速卖通',
    catName: '男女内衣及家居服',
    goodsId: '3256811842984318',
    nameEn: 'Devil Cat Street Hip-Hop Socks Retro Style Casual Fashion Men\'s Socks Novelty Funny Happy',
    nameCn: '魔鬼猫街头嘻哈袜 - 复古风格潮流男士袜，新奇趣味搞怪',
    priceMin: 0.99,
    priceMax: null,
    sold: 1,
    reviewNum: 0,
    rating: 0,
    thumbnail: '//ae-pic-a1.aliexpress-media.com/kf/Se9263e6b7f714bea842a62597303785cI.jpg',
    onSaleTime: '2026-04-07T00:00:00.000+08:00',
    selectReason: '"魔鬼猫"×"街头嘻哈"组合让人会心一笑。图案袜品类的新奇选手，$0.99超低价适合做"凑单品"或"社交礼物"。魔鬼猫IP形象自带萌感，搭配嘻哈元素形成反差萌。虽然销量尚低，但设计概念有成为"社交货币"的潜力。'
  }
];

// 生成 markdown 文件
const today = '2026-05-05';
const outputDir = path.join(__dirname);

for (const p of selected) {
  const priceDisplay = p.priceMax && p.priceMin !== p.priceMax
    ? `${p.priceMin}-${p.priceMax}`
    : `${p.priceMin}`;

  const soldDisplay = p.sold >= 10000
    ? `${(p.sold / 10000).toFixed(1)}万`
    : p.sold;

  // 确定链接
  let detailUrl = '';
  if (p.platform === 'temu') {
    detailUrl = `https://www.temu.com/goods_id=${p.goodsId}.html`;
  } else if (p.platform === 'shein') {
    detailUrl = `https://www.shein.com/product-p-${p.goodsId}.html`;
  } else if (p.platform === 'amazon') {
    detailUrl = `https://www.amazon.com/dp/${p.goodsId}`;
  } else if (p.platform === 'sumaitong') {
    detailUrl = `https://www.aliexpress.com/item/${p.goodsId}.html`;
  } else if (p.platform === 'tiktok') {
    detailUrl = `https://www.tiktok.com/item/${p.goodsId}.html`;
  }

  const thumbnailFull = p.thumbnail.startsWith('//')
    ? 'https:' + p.thumbnail
    : p.thumbnail;

  const md = `---
title: "${p.nameEn}"
platform: ${p.platform}
platformName: ${p.platformName}
category: ${p.catName}
price: ${priceDisplay}
currency: USD
sold: ${p.sold}
reviewNum: ${p.reviewNum}
rating: ${p.rating}
thumbnail: ${p.thumbnail}
goodsId: ${p.goodsId}
date: ${today}
productId: ${p.productId}
---

# ${p.nameEn}

**中文名称**: ${p.nameCn}

**平台**: ${p.platformName}
**类目**: ${p.catName}
**价格**: $${priceDisplay}
**销量**: ${soldDisplay}
**评论数**: ${p.reviewNum}
**评分**: ${p.rating}
**上架时间**: ${p.onSaleTime || '未知'}
**商品ID**: ${p.goodsId}

![商品图片](${thumbnailFull})

## 选品理由
${p.selectReason}

## 商品链接
${detailUrl}

## 商品编号
${p.productId}
`;

  const filePath = path.join(outputDir, `${p.productId}.md`);
  fs.writeFileSync(filePath, md, 'utf-8');
  console.log(`✓ 已生成: ${p.productId}.md — ${p.nameEn.substring(0, 50)}...`);
}

// 同时保存精选结果的JSON
const summaryPath = path.join(outputDir, 'dailytemp', '2026-05-05', 'selected_products.json');
fs.writeFileSync(summaryPath, JSON.stringify(selected, null, 2), 'utf-8');
console.log(`\n✓ 精选数据已保存: selected_products.json`);
console.log(`✓ 共生成 ${selected.length} 个选品 markdown 文件`);
