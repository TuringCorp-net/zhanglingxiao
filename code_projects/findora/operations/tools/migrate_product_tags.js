/**
 * migrate_product_tags.js
 * 一次性迁移脚本：从 products.tags JSON 字段迁移到 product_tag_map 桥接表
 *
 * 使用方式：node operations/tools/migrate_product_tags.js
 * 注意事项：此脚本仅执行一次，迁移完成后可删除
 *
 * 执行前提：
 * 1. 已执行 migrations/020_product_tag_map.sql 创建桥接表
 * 2. 数据库中存在 products 和 tags 表
 *
 * 迁移逻辑：
 * 1. 读取所有产品的 tags JSON 字段
 * 2. 解析每个产品的标签数组
 * 3. 为每个 (product_id, tag_id) 组合在 product_tag_map 中创建记录
 * 4. 权重默认设为 1.0
 * 5. 跳过已存在的记录（UNIQUE 约束保护）
 */

import { D1Database } from '@cloudflare/workers-types';

// 模拟 Env 接口（实际使用时从 Wrangler 注入）
interface Env {
  DB: D1Database;
}

async function migrate(env: Env) {
  console.log('=== 开始 product_tag_map 数据迁移 ===');
  console.log(`开始时间: ${new Date().toISOString()}`);

  // 检查 product_tag_map 表是否存在
  const tableCheck = await env.DB.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name='product_tag_map'
  `).first();

  if (!tableCheck) {
    console.error('错误：product_tag_map 表不存在，请先执行 migrations/020_product_tag_map.sql');
    return;
  }

  // 获取所有产品及其 tags
  const products = await env.DB.prepare(`
    SELECT id, tags FROM products WHERE tags IS NOT NULL AND tags != '' AND tags != '[]'
  `).all();

  if (!products.results || products.results.length === 0) {
    console.log('没有需要迁移的产品标签数据');
    return;
  }

  console.log(`找到 ${products.results.length} 个产品需要处理`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const row of products.results) {
    try {
      const productId = row.id;
      let tags = [];

      // 解析 JSON 标签数组
      if (row.tags) {
        try {
          tags = JSON.parse(row.tags);
        } catch (e) {
          console.warn(`产品 ${productId} 的 tags 字段解析失败: ${row.tags}`);
          continue;
        }
      }

      if (!Array.isArray(tags) || tags.length === 0) {
        continue;
      }

      // 为每个标签创建映射记录
      for (const tagId of tags) {
        if (!tagId) continue;

        const now = new Date().toISOString();
        const mapId = `${productId}_${tagId}`;

        try {
          // 使用 INSERT OR IGNORE 跳过已存在的记录
          await env.DB.prepare(`
            INSERT OR IGNORE INTO product_tag_map (id, product_id, tag_id, weight, created_at)
            VALUES (?, ?, ?, 1.0, ?)
          `).bind(mapId, productId, tagId, now).run();

          successCount++;
        } catch (e) {
          // UNIQUE 约束冲突 - 正常跳过
          if (e.message && e.message.includes('UNIQUE')) {
            skipCount++;
          } else {
            console.error(`产品 ${productId} 标签 ${tagId} 插入失败: ${e.message}`);
            errorCount++;
          }
        }
      }
    } catch (e) {
      console.error(`处理产品 ${row.id} 时出错: ${e.message}`);
      errorCount++;
    }
  }

  console.log('\n=== 迁移完成 ===');
  console.log(`成功插入: ${successCount} 条`);
  console.log(`跳过(已存在): ${skipCount} 条`);
  console.log(`错误: ${errorCount} 条`);
  console.log(`结束时间: ${new Date().toISOString()}`);

  // 验证迁移结果
  const countResult = await env.DB.prepare('SELECT COUNT(*) as cnt FROM product_tag_map').first();
  console.log(`\nproduct_tag_map 当前记录数: ${countResult?.cnt || 0}`);
}

// 导出迁移函数供外部调用
export { migrate };

// 如果直接运行此脚本
// 注意：在 Wrangler 环境中需要通过 `wrangler d1 execute` 或 API 调用执行
// 此脚本作为参考实现提供
if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('migrate_product_tags')) {
  console.log('此脚本需要在 Cloudflare Workers/D1 环境中执行');
  console.log('请通过以下方式执行迁移：');
  console.log('1. 使用 wrangler d1 execute 执行 020_product_tag_map.sql 建表');
  console.log('2. 通过 API 端点或 Wrangler 脚本调用 migrate() 函数');
}