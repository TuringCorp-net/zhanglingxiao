-- 008: works 表新增 user_token，实现作品归属权控制
-- Story Elf 通过 user_token 校验用户是否有权访问指定作品

ALTER TABLE works ADD COLUMN user_token TEXT NOT NULL DEFAULT '';

-- 为已有作品设置默认 user_token（从 author 字段推导）
-- 测试数据属于 admin token
UPDATE works SET user_token = 'admin-Tu' WHERE user_token = '';

-- 索引用以按用户过滤作品列表
CREATE INDEX IF NOT EXISTS idx_works_user_token ON works(user_token);
