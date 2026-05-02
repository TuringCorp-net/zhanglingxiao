/**
 * ============================================
 * 生成商品 markdown 文件 - 2026-05-02 第二次采集
 * ============================================
 *
 * 每个商品一个独特编号（筛选日期+三位数字）
 * 存放路径: 2026-05-02/YYYYMMDDXXX.md
 */

const fs = require('fs');
const path = require('path');

// 读取精选商品
const selected = JSON.parse(fs.readFileSync('./selected_20260502_v2.json', 'utf8'));

// 确保目录存在
const dateDir = './2026-05-02';
if (!fs.existsSync(dateDir)) {
  fs.mkdirSync(dateDir, { recursive: true });
}

// 生成每个商品的 markdown 文件
selected.forEach((p, i) => {
  const num = String(i + 1).padStart(3, '0');
  const productId = '20260502' + num;

  const priceMin = p.goodsPriceMin || 0;
  const priceMax = p.goodsPriceMax || p.goodsPriceMin || 0;
  const priceRange = priceMax > priceMin
    ? '$' + priceMin.toFixed(2) + ' - $' + priceMax.toFixed(2)
    : priceMin > 0 ? '$' + priceMin.toFixed(2) : 'N/A';

  // 构建商品链接（根据平台不同）
  let productUrl = '';
  switch (p.sourcePlatform) {
    case 'temu':
      productUrl = 'https://temu.com/goods.html?goods_id=' + p.goodsId;
      break;
    case 'shein':
      productUrl = 'https://www.shein.com/product-detail/' + p.goodsId + '.html';
      break;
    case 'amazon':
      productUrl = 'https://www.amazon.com/dp/' + p.goodsId;
      break;
    case 'sumaitong':
      productUrl = 'https://www.aliexpress.com/item/' + p.goodsId + '.html';
      break;
    case 'tiktok':
      productUrl = 'https://shop.tiktok.com/product/' + p.goodsId;
      break;
    default:
      productUrl = p.detailUrl || p.thumbnail || '';
  }

  // 标准化图片URL
  let imageUrl = p.thumbnail || '';
  if (imageUrl && imageUrl.startsWith('//')) {
    imageUrl = 'https:' + imageUrl;
  }

  // 构建商品内容
  const matchedKeywords = p._scoreData?.matchedKeywords || [];
  const matchedKw = matchedKeywords.length > 0
    ? matchedKeywords.join(', ')
    : '无特定热点关键词';

  const rating = p.rating || 'N/A';
  const reviewNum = p.reviewNum || 0;
  const sourceChannel = p.sourceChannel || 'N/A';

  let content = '---\n';
  content += 'productId: ' + productId + '\n';
  content += 'platform: ' + p.sourcePlatform + '\n';
  content += 'category: ' + p.sourceCatName + '\n';
  content += 'goodsId: ' + p.goodsId + '\n';
  content += '---\n\n';
  content += '# ' + (p.goodsNameEn || '未知商品') + '\n\n';
  content += '## 基本信息\n\n';
  content += '| 属性 | 值 |\n';
  content += '|------|-----|\n';
  content += '| 编号 | ' + productId + ' |\n';
  content += '| 平台 | ' + p.sourcePlatform + ' |\n';
  content += '| 类目 | ' + p.sourceCatName + ' |\n';
  content += '| 渠道 | ' + sourceChannel + ' |\n';
  content += '| 商品ID | ' + p.goodsId + ' |\n\n';
  content += '## 价格与销量\n\n';
  content += '| 指标 | 值 |\n';
  content += '|------|-----|\n';
  content += '| 价格 | ' + priceRange + ' |\n';
  content += '| 销量 | ' + p.sold + ' |\n';
  content += '| 评分 | ' + rating + ' |\n';
  content += '| 评论数 | ' + reviewNum + ' |\n\n';
  content += '## 入选理由\n\n';
  content += matchedKw + '\n\n';
  content += '## 商品图片\n\n';
  content += '![商品图片](' + imageUrl + ')\n\n';
  content += '## 商品链接\n\n';
  content += '[查看商品](' + productUrl + ')\n\n';
  content += '## 原始数据\n\n';
  content += '```json\n';
  content += JSON.stringify({
    goodsNameEn: p.goodsNameEn,
    goodsNameCn: p.goodsNameCn,
    thumbnail: p.thumbnail,
    sold: p.sold,
    goodsPriceMin: p.goodsPriceMin,
    goodsPriceMax: p.goodsPriceMax,
    reviewNum: p.reviewNum,
    rating: p.rating,
    goodsId: p.goodsId,
    sourcePlatform: p.sourcePlatform,
    sourceCatId: p.sourceCatId,
    sourceCatName: p.sourceCatName,
    sourceChannel: p.sourceChannel,
    matchedKeywords: matchedKeywords
  }, null, 2) + '\n';
  content += '```\n';

  const filename = productId + '.md';
  fs.writeFileSync(path.join(dateDir, filename), content);
  console.log('✓ ' + filename + ': ' + (p.goodsNameEn || '未知商品').substring(0, 50) + '...');
});

console.log('\n✓ 已生成 ' + selected.length + ' 个商品文档到 ' + dateDir + '/');
