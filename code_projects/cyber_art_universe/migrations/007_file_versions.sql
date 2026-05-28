-- V4: 文件版本历史
-- 每次 PUT module 自动生成版本快照，存储在 R2 .versions/ 子目录
CREATE TABLE IF NOT EXISTS file_versions (
  id           TEXT PRIMARY KEY,       -- UUID
  work_id      TEXT NOT NULL,          -- 作品 ID
  r2_key       TEXT NOT NULL,          -- 原始文件 R2 key（如 works/{id}/zh/world_bible.json）
  version_num  INTEGER NOT NULL,       -- 该文件的版本序号（从 1 开始递增）
  snapshot_key TEXT NOT NULL,          -- 快照 R2 key（如 works/{id}/zh/.versions/world_bible.json/{uuid}.json）
  size_bytes   INTEGER,               -- 快照内容字节数
  created_at   TEXT NOT NULL           -- ISO 8601 时间戳
);

CREATE INDEX IF NOT EXISTS idx_file_versions_key ON file_versions(r2_key);
