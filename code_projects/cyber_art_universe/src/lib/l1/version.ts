// L1: 版本历史
// 每次 PUT module 自动生成版本快照（写入前的内容），存储在 R2 .versions/ 子目录
// 版本元信息存储在 D1 file_versions 表
import { Env } from '../../db/schema';

// ============================================================
// 类型
// ============================================================

export interface VersionMeta {
  id: string;
  work_id: string;
  r2_key: string;
  version_num: number;
  snapshot_key: string;
  size_bytes: number | null;
  created_at: string;
}

/** 默认每个文件最多保留的版本数（免费用户） */
const DEFAULT_MAX_VERSIONS = 10;

// ============================================================
// 内部辅助
// ============================================================

function generateId(): string {
  return crypto.randomUUID();
}

function versionSnapshotKey(r2Key: string, versionId: string): string {
  // r2Key 如 "works/w1/zh/world_bible.json"
  // → "works/w1/zh/.versions/world_bible.json/vid.json"
  const lastSlash = r2Key.lastIndexOf('/');
  const dir = r2Key.slice(0, lastSlash);
  const filename = r2Key.slice(lastSlash + 1);
  return `${dir}/.versions/${filename}/${versionId}.json`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 保存内容到 R2 并自动创建版本快照（写入前的内容）。
 * 流程：读取旧对象 stream → 写入新内容 → 旧 stream 管道到快照 key
 * 首次写入（之前无内容）时不产生快照。
 */
export async function saveWithVersion(
  env: Env,
  workId: string,
  r2Key: string,
  content: string,
  maxVersions?: number,
): Promise<VersionMeta | null> {
  if (!r2Key || content === undefined || content === null) return null;

  // 1. 读取当前 R2 内容（此路径为 API-to-API 调用，无可用的前端缓存）
  let previousContent: string | null = null;
  try {
    const obj = await env.WORKS_BUCKET.get(r2Key);
    if (obj) previousContent = await obj.text();
  } catch { /* 文件不存在 */ }

  // 2. 写入新内容到 R2
  const isJson = r2Key.endsWith('.json');
  const contentType = isJson ? 'application/json' : 'text/markdown; charset=utf-8';
  await env.WORKS_BUCKET.put(r2Key, content, {
    httpMetadata: { contentType },
  });

  // 3. 首次写入（之前无内容）→ 无历史可快照
  if (previousContent === null) return null;

  // 4. 快照旧内容
  return await createSnapshot(env, workId, r2Key, previousContent, maxVersions);
}

/**
 * 将已知文本内容存档为版本快照（零 R2 读取）。
 * 供 updateModule 使用：前端缓存已提供修改前的内容。
 */
export async function createSnapshot(
  env: Env,
  workId: string,
  r2Key: string,
  previousContent: string,
  maxVersions?: number,
): Promise<VersionMeta> {
  const row = await env.DB.prepare(
    'SELECT MAX(version_num) as max_num FROM file_versions WHERE r2_key = ?'
  ).bind(r2Key).first<{ max_num: number | null }>();
  const nextNum = (row?.max_num ?? 0) + 1;

  const versionId = generateId();
  const snapKey = versionSnapshotKey(r2Key, versionId);
  const isJson = r2Key.endsWith('.json');
  const contentType = isJson ? 'application/json' : 'text/markdown; charset=utf-8';
  await env.WORKS_BUCKET.put(snapKey, previousContent, {
    httpMetadata: { contentType },
  });

  const sizeBytes = new TextEncoder().encode(previousContent).length;
  const createdAt = nowISO();

  await env.DB.prepare(
    'INSERT INTO file_versions (id, work_id, r2_key, version_num, snapshot_key, size_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(versionId, workId, r2Key, nextNum, snapKey, sizeBytes, createdAt).run();

  await pruneVersions(env, r2Key, maxVersions ?? DEFAULT_MAX_VERSIONS);

  return {
    id: versionId,
    work_id: workId,
    r2_key: r2Key,
    version_num: nextNum,
    snapshot_key: snapKey,
    size_bytes: sizeBytes,
    created_at: createdAt,
  };
}

/**
 * 读取某个历史版本的完整内容。
 */
export async function getVersion(
  env: Env,
  r2Key: string,
  versionId: string,
): Promise<string | null> {
  const row = await env.DB.prepare(
    'SELECT snapshot_key FROM file_versions WHERE id = ? AND r2_key = ?'
  ).bind(versionId, r2Key).first<{ snapshot_key: string }>();
  if (!row) return null;

  const obj = await env.WORKS_BUCKET.get(row.snapshot_key);
  if (!obj) return null;
  return obj.text();
}

/**
 * 列出某个文件的所有历史版本（按版本号倒序）。
 */
export async function listVersions(
  env: Env,
  r2Key: string,
): Promise<VersionMeta[]> {
  const result = await env.DB.prepare(
    'SELECT id, work_id, r2_key, version_num, snapshot_key, size_bytes, created_at FROM file_versions WHERE r2_key = ? ORDER BY version_num DESC'
  ).bind(r2Key).all<VersionMeta>();

  return result.results || [];
}

/**
 * 回滚到指定版本：将快照内容写回当前文件，同时创建一个新版本记录此次回滚。
 */
export async function rollbackToVersion(
  env: Env,
  workId: string,
  r2Key: string,
  versionId: string,
  maxVersions?: number,
): Promise<VersionMeta | null> {
  const content = await getVersion(env, r2Key, versionId);
  if (content === null) return null;
  return saveWithVersion(env, workId, r2Key, content, maxVersions);
}

// ============================================================
// 清理
// ============================================================

async function pruneVersions(env: Env, r2Key: string, maxVersions: number): Promise<void> {
  const result = await env.DB.prepare(
    'SELECT id, snapshot_key FROM file_versions WHERE r2_key = ? ORDER BY version_num DESC'
  ).bind(r2Key).all<{ id: string; snapshot_key: string }>();

  const rows = result.results || [];
  if (rows.length <= maxVersions) return;

  // 删除超出上限的最旧版本
  const toDelete = rows.slice(maxVersions);
  for (const row of toDelete) {
    // 删除 R2 快照
    await env.WORKS_BUCKET.delete(row.snapshot_key);
    // 删除 D1 记录
    await env.DB.prepare(
      'DELETE FROM file_versions WHERE id = ?'
    ).bind(row.id).run();
  }
}
