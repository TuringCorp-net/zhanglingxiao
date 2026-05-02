/**
 * 上架运营总监通过的PASS商品 (2026-05-02)
 * 根据 operations/pass/2026-05-02 目录下经二次策划的商品
 * 筛选出更具爆款潜力的商品上架至Findora数据库
 */

const ADMIN_KEY = 'Findora-TuringCorp-13572468';
const API_BASE = 'https://findora.turingcorp.net/api/admin/products';
const fs = require('fs');

// PASS商品列表
const passFiles = [
  'FND-20260502-001.md',
  'FND-20260502-002.md',
  'FND-20260502-005.md',
  'FND-20260502-006.md'
];

// 解析md文件获取商品信息
function parseProductMd(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');

  // 提取商品ID
  const goodsIdMatch = content.match(/\*\*商品ID\*\*:\s*(\S+)/);
  const goodsId = goodsIdMatch ? goodsIdMatch[1] : '';

  // 提取平台
  const platformMatch = content.match(/\*\*平台\*\*:\s*(\S+)/);
  const platform = platformMatch ? platformMatch[1] : '';

  // 提取类目
  const catMatch = content.match(/\*\*类目\*\*:\s*(.+)/);
  const category = catMatch ? catMatch[1].trim() : '';

  // 提取英文名
  const enNameMatch = content.match(/\*\*英文名\*\*:\s*(.+)/);
  const goodsNameEn = enNameMatch ? enNameMatch[1].trim() : '';

  // 提取中文名
  const cnNameMatch = content.match(/\*\*中文名\*\*:\s*(.+)/);
  const goodsNameCn = cnNameMatch ? cnNameMatch[1].trim() : '';

  // 提取价格
  const priceMatch = content.match(/\*\*价格\*\*:\s*\$?([\d.]+)/);
  const price = priceMatch ? parseFloat(priceMatch[1]) : 0;

  // 提取销量
  const soldMatch = content.match(/\*\*销量\*\*:\s*(\S+)/);
  const sold = soldMatch ? parseInt(soldMatch[1]) : 0;

  // 提取商品链接
  const linkMatch = content.match(/\*\*商品链接\*\*:\s*(\S+)/);
  const sourceUrl = linkMatch ? linkMatch[1] : '';

  // 提取推广文案 (从 "## 策划包装" 后面提取)
  const promoSectionMatch = content.match(/## 策划包装\n+### 商品编号\n+\*\*([^\*]+)\*\*\n+### 推广文案\n+([\s\S]+?)(?=### 特征标签)/);
  const promotion = promoSectionMatch ? promoSectionMatch[2].trim() : '';

  // 提取特征标签
  const tagsSectionMatch = content.match(/### 特征标签\n+([\s\S]+?)(?=### 目标受众)/);
  const tagsStr = tagsSectionMatch ? tagsSectionMatch[1].trim() : '';
  const tags = tagsStr.split('\n')
    .map(line => {
      const match = line.match(/-\s+\*\*([^*]+)\*\*/);
      return match ? match[1].trim() : '';
    })
    .filter(tag => tag.length > 0);

  return {
    goodsId,
    platform,
    category,
    goodsNameEn,
    goodsNameCn,
    price,
    sold,
    sourceUrl,
    promotion,
    tags,
    sourceMd: content
  };
}

async function uploadProduct(product, index) {
  console.log(`\n[${index + 1}/4] 上传商品: ${product.source_filename}`);
  console.log(`   商品ID: ${product.goodsId}`);
  console.log(`   平台: ${product.platform}`);
  console.log(`   类目: ${product.category}`);

  try {
    // 构建API请求数据
    const apiData = {
      source_platform: product.platform,
      source_url: product.sourceUrl,
      source_goods_id: product.goodsId,
      original_title: product.goodsNameCn || product.goodsNameEn,
      title: product.goodsNameEn,
      category: product.category,
      tags: product.tags,
      price_min: product.price,
      price_max: product.price,
      currency: 'USD',
      summary: product.promotion,
      source_md: product.sourceMd,
      source_filename: product.source_filename
    };

    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Key': ADMIN_KEY
      },
      body: JSON.stringify(apiData)
    });

    const result = await response.json();

    if (result.ok || result.success) {
      const productId = result.data?.id || result.id;
      console.log(`   ✅ 上架成功! Product ID: ${productId}`);
      return { success: true, id: productId, filename: product.source_filename };
    } else {
      console.log(`   ❌ 上架失败: ${JSON.stringify(result.error || result)}`);
      return { success: false, error: result.error || result, filename: product.source_filename };
    }
  } catch (error) {
    console.log(`   ❌ 网络错误: ${error.message}`);
    return { success: false, error: error.message, filename: product.source_filename };
  }
}

async function main() {
  console.log('🚀 开始上架 2026-05-02 PASS 商品 (共4个)');
  console.log('=' .repeat(60));

  const results = [];
  for (let i = 0; i < passFiles.length; i++) {
    const filePath = `./operations/pass/2026-05-02/${passFiles[i]}`;
    const productInfo = parseProductMd(filePath);
    productInfo.source_filename = passFiles[i];
    const result = await uploadProduct(productInfo, i);
    results.push(result);
  }

  console.log('\n' + '=' .repeat(60));
  console.log('📊 上架结果汇总:');
  console.log('=' .repeat(60));

  const successCount = results.filter(r => r.success).length;
  console.log(`   成功: ${successCount}/4`);
  console.log(`   失败: ${results.length - successCount}/4`);

  if (successCount > 0) {
    console.log('\n   成功上架的商品ID:');
    results.filter(r => r.success).forEach(r => {
      console.log(`   - ${r.filename}: ${r.id}`);
    });
  }

  if (results.length - successCount > 0) {
    console.log('\n   失败详情:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.filename}: ${r.error}`);
    });
  }
}

main().catch(console.error);