/**
 * 生成精选商品markdown文档 - 2026-05-02
 */

const data = require('./operations/selected/selected_20260502.json');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = './operations/selected';

data.products.forEach((item, i) => {
  const p = item.product;
  const id = item.id;

  const md = `# ${id} - ${(p.goodsNameEn || p.goodsNameCn || '').substring(0, 60)}

## 基本信息

- **商品ID**: ${p.goodsId || p.id || 'N/A'}
- **平台**: ${p._source}
- **类目**: ${p._catName}
- **渠道**: ${p._channel}

## 商品信息

- **英文名**: ${p.goodsNameEn || 'N/A'}
- **中文名**: ${p.goodsNameCn || 'N/A'}

## 价格与销量

- **价格**: $${p.goodsPriceMin || '?'} - $${p.goodsPriceMax || '?'}
- **销量**: ${p.sold || 0}
- **销售额**: $${p.sales || 'N/A'}

## 评分与评价

- **评分**: ${p.rating || 'N/A'}
- **评论数**: ${p.reviewNum || 0}

## 图片

![${(p.goodsNameEn || p.goodsNameCn || '').substring(0, 30)}](${p.thumbnail})

## 选品亮点

${item.selectionReasons.join(', ')}

## 选品评分

- **综合评分**: ${item.score} / 100

## 采集信息

- **上架时间**: ${p.onSaleTime || 'N/A'}
- **开店时间**: ${p.mallOpenTime || 'N/A'}
- **商品链接**: ${p.detailUrl || 'N/A'}
`;

  const file = path.join(OUTPUT_DIR, id + '.md');
  fs.writeFileSync(file, md);
  console.log('已生成: ' + file);
});

console.log('\n10个商品文档全部生成完成!');
