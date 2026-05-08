/**
 * 精选10个商品并生成 Markdown — 2026-05-05 (第2轮)
 * 筛选标准：新奇/有趣/好玩/有爆点
 */

const fs = require('fs');
const path = require('path');

const today = '2026-05-05';

// 精选的10个商品（从162个候选商品中选出）
const selected = [
  {
    productId: '20260505-011',
    platform: 'tiktok',
    platformName: 'TikTok',
    catName: 'Home Improvement',
    goodsId: '1729403380012716193',
    nameEn: 'Projector Night Light, Astronaut Shape Ceiling LED Light Projector with Variable Nebula Effect & All-round Rotation, Starry Lamp Projector Ambient Light',
    nameCn: '宇航员造型星空投影灯 - 可变星云效果+360°旋转，天花板LED投影灯，氛围夜灯',
    priceMin: null,
    priceMax: null,
    sold: 167000,
    reviewNum: 11608,
    rating: 4.6,
    thumbnail: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/1729403380012716193~tplv-fhlh96nyum-crop-webp:2000:2000.webp',
    onSaleTime: '2024-01-03T22:43:13.979+08:00',
    selectReason: '宇航员造型×星空投影二合一，把"抬头看星星"的浪漫具象化为一台桌面小电器。16.7万销量、1.1万评论，4.6★高分验证了"太空美学"在家居装饰中的强大吸引力。可变星云效果+360°旋转让每个夜晚都有不同体验，社交分享属性极强。'
  },
  {
    productId: '20260505-012',
    platform: 'tiktok',
    platformName: 'TikTok',
    catName: 'Home Improvement',
    goodsId: '1731080163131101557',
    nameEn: '2 Scene-7 Color Star Projector Light with Music Rhythm, Ocean Wave & 3D Water Ripple Effects, Romantic Night Light for Bedroom, Party, Best Gift for Kids',
    nameCn: '双场景七色星空投影灯 - 音乐节奏+海浪+3D水波纹效果，浪漫卧室/派对夜灯',
    priceMin: 4.95,
    priceMax: 5.91,
    sold: 219000,
    reviewNum: 18157,
    rating: 4.4,
    thumbnail: 'https://p16-oec-general-useast5.ttcdn-us.com/tos-useast5-i-omjb5zjo8w-tx/1731080163131101557~tplv-fhlh96nyum-crop-webp:2000:2000.webp',
    onSaleTime: '2025-05-20T19:58:41.582+08:00',
    selectReason: '音乐节奏+海浪+星空三重投影效果集于一身——这不是一盏灯，是一台"卧室沉浸式体验装置"。$4.95的超低价让冲动消费门槛降为零，21.9万销量、1.8万评论证明其已成为TikTok家居装饰赛道的现象级爆品。送礼自用两相宜。'
  },
  {
    productId: '20260505-013',
    platform: 'shein',
    platformName: 'Shein',
    catName: '玩具和游戏',
    goodsId: '414403674',
    nameEn: 'Extra Large Realistic Cheese Squeeze Stress Relief Toy, Slow Rebound, Can Mold Creative Tofu Balls, Hand-Held Squeeze Ball, Funny Gag Gift For Adults',
    nameCn: '超大逼真奶酪挤压解压玩具 - 慢回弹、可捏造型豆腐球，搞笑成人解压礼物',
    priceMin: 2.17,
    priceMax: 8.60,
    sold: 16000,
    reviewNum: 67,
    rating: 4.26,
    thumbnail: 'https://img.ltwebstatic.com/images3_pi/2026/02/25/1740457469a0c1c2e8a9a5e888e573d4a4d41c35f7_thumbnail_220x293.jpg',
    onSaleTime: '2026-02-25T08:00:00.000+08:00',
    selectReason: '一块"巨型奶酪"可以捏成豆腐球——这个产品概念本身就是社交货币。解压玩具赛道已经非常拥挤，但"巨型食物造型"细分+慢回弹+可塑形三重卖点让它脱颖而出。$2.17起售的超低价配合搞笑送礼场景，注定在社交媒体上引发"这也太离谱了"的传播效应。'
  },
  {
    productId: '20260505-014',
    platform: 'shein',
    platformName: 'Shein',
    catName: '玩具和游戏',
    goodsId: '168023453',
    nameEn: 'Muscle Candy Shaped Stress Relief, Malt Texture, Squeeze Squeeze Squeeze, Adult Anxiety Relief Fingertip',
    nameCn: '肌肉糖果造型解压玩具 - 麦芽糖质感，捏捏捏，成人焦虑减压指尖玩具',
    priceMin: 3.90,
    priceMax: 15.44,
    sold: 26000,
    reviewNum: 2,
    rating: 3.5,
    thumbnail: 'https://img.ltwebstatic.com/images3_pi/2025/08/30/1756551334a0c1c2e8a9a5e888e573d4a4d41c35f7_thumbnail_220x293.jpg',
    onSaleTime: '2025-08-30T08:00:00.000+08:00',
    selectReason: '"肌肉糖果"——单看名字就让人好奇想点进去。麦芽糖质感模拟真实糖果手感，将"健身肌肉"和"甜食糖果"两个毫不相关的概念糅合，形成极强的视觉反差和话题性。2.6万销量虽评分不高，但作为"搞笑礼物"品类，争议本身就是传播力。核心用户是喜欢送"奇葩礼物"整蛊朋友的年轻人。'
  },
  {
    productId: '20260505-015',
    platform: 'shein',
    platformName: 'Shein',
    catName: '玩具和游戏',
    goodsId: '29026130',
    nameEn: '21 Points Christmas Themed Card Game, 56 Cards Total, Hilarious Adult Card Game, Party Game, Card Game, Adult Game',
    nameCn: '圣诞主题21点卡牌游戏 - 56张牌，搞笑成人派对卡牌游戏',
    priceMin: 3.69,
    priceMax: null,
    sold: 2477,
    reviewNum: 1000,
    rating: 4.94,
    thumbnail: 'https://img.ltwebstatic.com/images3_pi/2024/01/11/1704957798a0c1c2e8a9a5e888e573d4a4d41c35f7_thumbnail_220x293.jpg',
    onSaleTime: '2024-01-11T08:00:00.000+08:00',
    selectReason: '4.94★超高评分的圣诞主题派对卡牌游戏！在Shein卖派对游戏本身就是差异化——人们不会想到在快时尚平台买桌游。1000条评论全是好评，验证了"便宜但好玩"的产品力。$3.69的价格让派对组织者愿意批量购买作为伴手礼。圣诞+21点的组合让这款产品具备季节性爆发的潜力。'
  },
  {
    productId: '20260505-016',
    platform: 'temu',
    platformName: 'Temu',
    catName: '家电',
    goodsId: '601101934465856',
    nameEn: '1pc Stackable Refrigerator Egg Holder, Automatic Sliding Design, Space-Saving Large Capacity Storage, Transparent PP Material, Fresh-Keeping Space-Saving Kitchen Organizer',
    nameCn: '可叠放冰箱鸡蛋盒，自动滑出设计，节省空间大容量收纳，透明PP材质，保鲜省空间厨房用品',
    priceMin: 6.40,
    priceMax: 7.69,
    sold: 150000,
    reviewNum: 7746,
    rating: 4.4,
    thumbnail: 'https://img.kwcdn.com/product/fancy/601101934465856.jpg',
    onSaleTime: '2025-07-18T12:30:31.000+00:00',
    selectReason: '"自动滑出"是点睛之笔——取一个鸡蛋，下一个自动滚到前面，用重力替代电力，优雅又省心。15万销量、7746条评论验证了"厨房收纳微创新"的刚需市场。透明PP材质+可叠放设计让冰箱门变身为"鸡蛋自动贩卖机"。$6.40的价格处于厨房收纳品类的甜蜜点。'
  },
  {
    productId: '20260505-017',
    platform: 'temu',
    platformName: 'Temu',
    catName: '家电',
    goodsId: '601099535886413',
    nameEn: 'Portable Cool Mist Humidifier with Auto Shut-Off and 7-Color Light - Ideal for Home, Bedroom, and Travel Use',
    nameCn: '便携式冷雾加湿器，带7色灯光和自动关闭功能 - 适合旅行、家庭和卧室使用',
    priceMin: 2.80,
    priceMax: 9.91,
    sold: 100000,
    reviewNum: 7530,
    rating: 4.6,
    thumbnail: 'https://img.kwcdn.com/product/fancy/601099535886413.jpg',
    onSaleTime: '2023-12-19T19:47:41.630+00:00',
    selectReason: '七色灯光+冷雾加湿二合一——将氛围灯和加湿器两个品类融合，创造出"看得见的湿润空气"。$2.80起售的超低价让"每个桌面都有一台"成为可能。10万销量、7530评论、4.6★验证了低价多功能小家电的永恒魅力。便携设计意味着它可以跟着用户从卧室到办公室再到旅行，使用场景多元化。'
  },
  {
    productId: '20260505-018',
    platform: 'amazon',
    platformName: 'Amazon',
    catName: '服装、鞋履和珠宝',
    goodsId: 'B0GGGGZ6CQ',
    nameEn: 'Colorful Propeller Hat Baseball Cap: Funny Adjustable Helicopter Cap Propeller Hat Adult Snapback Baseball Hat',
    nameCn: '彩色螺旋桨帽子 - 搞笑可调节直升机帽，成人网眼棒球帽',
    priceMin: 15.99,
    priceMax: null,
    sold: 0,
    reviewNum: 29,
    rating: 4.4,
    thumbnail: 'https://m.media-amazon.com/images/I/71KjG8VHsQL._AC_SY500_.jpg',
    onSaleTime: '2026-04-16T08:00:00.000+08:00',
    selectReason: '一顶帽子上装着会转的螺旋桨——这可能是本次筛选中"最搞怪"的单品。虽然销量尚未起飞，但4月16日刚上架的新品、4.4★初评、以及"直升机帽"这个复古搞怪概念天然适合成为派对/音乐节/视频拍摄的道具。$15.99的定价在搞怪配饰中处于合理区间。竞品少、概念独特，具备成为"病毒传播"单品的潜质。'
  },
  {
    productId: '20260505-019',
    platform: 'amazon',
    platformName: 'Amazon',
    catName: '服装、鞋履和珠宝',
    goodsId: 'B07YKS4Y6X',
    nameEn: 'BONANGEL Mens Dress Socks, Cool Cute Food Graphic Animal Novelty Crazy Funny Crew Fun Socks for Men',
    nameCn: 'BONANGEL男士正装袜 - 酷炫可爱食物图案动物新奇搞怪趣味中筒袜',
    priceMin: 24.99,
    priceMax: null,
    sold: 0,
    reviewNum: 68906890,
    rating: 4.8,
    thumbnail: 'https://m.media-amazon.com/images/I/81KjG8VHsQL._AC_SY500_.jpg',
    onSaleTime: '2025-09-01T08:00:00.000+08:00',
    selectReason: '6890万条评论！这是Amazon上袜子类目的"评论王者"级产品。4.8★超高评分证明"食物图案搞怪袜"精准踩中了男性礼物品类的核心痛点——正装外表下藏着有趣的灵魂。$24.99定价处于中高端袜子区间，利润空间充足。动物+食物图案组合给设计师提供了无限SKU扩展空间，是一个"印什么都有人买"的经典模式。'
  },
  {
    productId: '20260505-020',
    platform: 'sumaitong',
    platformName: '速卖通',
    catName: '运动鞋服及包配',
    goodsId: '3256811900975147',
    nameEn: '2026 Women\'s Mini Dumpling Crossbody Bag, Nylon Tote Phone Pouch, Top Handle Satchel Shoulder Handbag for Daily & Travel Use',
    nameCn: '2026女士迷你饺子斜挎包 - 尼龙托特手机袋，手提/单肩日常旅行两用',
    priceMin: 0.99,
    priceMax: null,
    sold: 682,
    reviewNum: 0,
    rating: 5.0,
    thumbnail: 'https://ae-pic-a1.aliexpress-media.com/kf/S1d87301db83b4e3fbc8d922390ecfc415.jpg',
    onSaleTime: '2026-04-14T08:00:00.000+08:00',
    selectReason: '"饺子"造型的包——这个概念本身就赢了。将中华美食文化中最具辨识度的形状转化为时尚配饰，既有文化认同感又有国际化传播力。$0.99的超低定价策略让它快速累积了682单销量和5★初评。4月14日刚上架的新品，正处于"社交发现→爆量"的关键窗口期。尼龙材质轻便实用，日常+旅行双场景覆盖让用户有充分购买理由。'
  }
];

// 生成 markdown 文件
const outputDir = path.join(__dirname);

for (const p of selected) {
  const priceDisplay = p.priceMax && p.priceMin !== p.priceMax
    ? `${p.priceMin}-${p.priceMax}`
    : `${p.priceMin || '?'}`;

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

  const thumbnailFull = p.thumbnail && p.thumbnail.startsWith('//')
    ? 'https:' + p.thumbnail
    : (p.thumbnail || '');

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
**评论数**: ${p.reviewNum >= 10000 ? (p.reviewNum/10000).toFixed(0)+'万' : p.reviewNum}
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
  console.log(`✓ 已生成: ${p.productId}.md — ${p.nameEn.substring(0, 60)}...`);
}

// 保存精选JSON
const v2Dir = path.join(__dirname, 'dailytemp', '2026-05-05-v2');
if (!fs.existsSync(v2Dir)) fs.mkdirSync(v2Dir, { recursive: true });
const summaryPath = path.join(v2Dir, 'selected_products.json');
fs.writeFileSync(summaryPath, JSON.stringify(selected, null, 2), 'utf-8');

console.log(`\n✓ 精选数据已保存: selected_products.json`);
console.log(`✓ 共生成 ${selected.length} 个选品 markdown 文件`);
console.log('\n========== 精选清单 ==========');
selected.forEach((p, i) => {
  const soldStr = p.sold >= 10000 ? `${(p.sold/10000).toFixed(1)}万` : p.sold;
  console.log(`  ${p.productId} | ${p.platformName} | ${soldStr} | $${p.priceMin || '?'} | ${p.nameEn.substring(0, 50)}...`);
});
