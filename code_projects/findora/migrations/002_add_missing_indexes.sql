-- Findora D1 Schema Migration 002
-- Fix: STR第三次审核标注的6个缺失索引
-- Date: 2026-04-06

-- 1. products表：(status, category) 复合索引
--    用于：F-040-01 商品列表按状态+类目过滤，商品管理按状态筛选
CREATE INDEX IF NOT EXISTS idx_products_status_category ON products(status, category);

-- 2. clicks表：(product_id, clicked_at) 复合索引
--    用于：F-017 商品维度的点击趋势分析（时间范围内某商品点击量）
CREATE INDEX IF NOT EXISTS idx_clicks_product_id_clicked_at ON clicks(product_id, clicked_at);

-- 3. clicks表：(user_id, clicked_at) 复合索引
--    用于：F-017 用户维度的回访率计算（7日回访UV）、F-013用户分群
CREATE INDEX IF NOT EXISTS idx_clicks_user_id_clicked_at ON clicks(user_id, clicked_at);

-- 4. clicks表：(anonymous_id, clicked_at) 复合索引
--    用于：F-017 匿名用户回访率统计
CREATE INDEX IF NOT EXISTS idx_clicks_anonymous_id_clicked_at ON clicks(anonymous_id, clicked_at);

-- 5. users表：(status) 单列索引
--    用于：F-013-08 订阅列表按状态筛选（active/unsubscribed/dormant）
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 6. lists表：(category) 单列索引
--    用于：F-040-03 榜单列表按类目过滤
CREATE INDEX IF NOT EXISTS idx_lists_category ON lists(category);
