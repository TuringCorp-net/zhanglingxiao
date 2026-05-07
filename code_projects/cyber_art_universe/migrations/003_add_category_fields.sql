-- 迁移 003：works 表新增题材分类、创作属性、受众字段
-- 基于 L1_Category 方案（8 类全球兼容题材）

ALTER TABLE works ADD COLUMN category TEXT DEFAULT '';
ALTER TABLE works ADD COLUMN creation_attribution TEXT DEFAULT 'original';
ALTER TABLE works ADD COLUMN audience TEXT DEFAULT '[]';
