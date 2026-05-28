// L1: 内容 Diff
// JSON 文件：逐 slot 对比，精确到字段
// Markdown 文件：逐行对比
// 不引入重量级 diff 库，轻量实现满足需求
import { Env } from '../../db/schema';
import { getVersion } from './version';

// ============================================================
// 类型
// ============================================================

export interface DiffResult {
  key: string;
  versionA: { id: string; num: number; createdAt: string };
  versionB: { id: string; num: number; createdAt: string };
  changes: DiffChange[];
}

export interface DiffChange {
  type: 'added' | 'removed' | 'modified';
  path: string;           // 如 "slots.power_system" 或 "body" 或 "line:5"
  oldValue?: string;
  newValue?: string;
}

export interface SlotDiff {
  slotId: string;
  label: string;
  oldValue: string;
  newValue: string;
}

// ============================================================
// 公开 API
// ============================================================

/**
 * 对比两个历史版本。
 */
export async function diffVersions(
  env: Env,
  r2Key: string,
  versionIdA: string,
  versionIdB: string,
): Promise<DiffResult | null> {
  const [contentA, contentB] = await Promise.all([
    getVersion(env, r2Key, versionIdA),
    getVersion(env, r2Key, versionIdB),
  ]);

  if (contentA === null || contentB === null) return null;

  // 获取版本元信息
  const rows = await listVersionMetaByIds(env, [versionIdA, versionIdB]);
  const metaA = rows.find(r => r.id === versionIdA);
  const metaB = rows.find(r => r.id === versionIdB);
  if (!metaA || !metaB) return null;

  const changes = r2Key.endsWith('.json')
    ? diffJson(contentA, contentB)
    : diffLines(contentA, contentB);

  return {
    key: r2Key,
    versionA: { id: metaA.id, num: metaA.version_num, createdAt: metaA.created_at },
    versionB: { id: metaB.id, num: metaB.version_num, createdAt: metaB.created_at },
    changes,
  };
}

/**
 * 对比当前内容与某个历史版本。
 * @param currentContent 当前 R2 中的内容（由调用方读取后传入）
 */
export async function diffWithCurrent(
  env: Env,
  r2Key: string,
  currentContent: string,
  versionId: string,
): Promise<DiffResult | null> {
  const oldContent = await getVersion(env, r2Key, versionId);
  if (oldContent === null) return null;

  const rows = await listVersionMetaByIds(env, [versionId]);
  const meta = rows.find(r => r.id === versionId);
  if (!meta) return null;

  const changes = r2Key.endsWith('.json')
    ? diffJson(oldContent, currentContent)
    : diffLines(oldContent, currentContent);

  return {
    key: r2Key,
    versionA: { id: meta.id, num: meta.version_num, createdAt: meta.created_at },
    versionB: { id: 'current', num: 0, createdAt: '' },
    changes,
  };
}

/**
 * 纯函数：对比两个 slots 快照，返回结构化差异列表。
 * 供 L2 使用——追踪结构化字段变更。
 */
export function diffSlots(
  current: Record<string, string>,
  previous: Record<string, string>,
): SlotDiff[] {
  const allKeys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  const diffs: SlotDiff[] = [];

  for (const key of allKeys) {
    const oldVal = previous[key] || '';
    const newVal = current[key] || '';
    if (oldVal !== newVal) {
      diffs.push({
        slotId: key,
        label: key,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }

  return diffs;
}

// ============================================================
// 内部：JSON diff（slot 级别）
// ============================================================

function diffJson(oldRaw: string, newRaw: string): DiffChange[] {
  const changes: DiffChange[] = [];

  let oldSlots: Record<string, unknown> = {};
  let newSlots: Record<string, unknown> = {};

  try {
    const oldParsed = JSON.parse(oldRaw);
    if (oldParsed && typeof oldParsed === 'object') {
      oldSlots = oldParsed.slots || oldParsed;
    }
  } catch { /* treat as empty */ }

  try {
    const newParsed = JSON.parse(newRaw);
    if (newParsed && typeof newParsed === 'object') {
      newSlots = newParsed.slots || newParsed;
    }
  } catch { /* treat as empty */ }

  const allKeys = new Set([...Object.keys(oldSlots), ...Object.keys(newSlots)]);

  for (const key of allKeys) {
    const oldVal = oldSlots[key];
    const newVal = newSlots[key];
    const oldStr = typeof oldVal === 'string' ? oldVal : JSON.stringify(oldVal ?? '');
    const newStr = typeof newVal === 'string' ? newVal : JSON.stringify(newVal ?? '');

    if (oldVal === undefined && newVal !== undefined) {
      changes.push({ type: 'added', path: `slots.${key}`, newValue: newStr });
    } else if (oldVal !== undefined && newVal === undefined) {
      changes.push({ type: 'removed', path: `slots.${key}`, oldValue: oldStr });
    } else if (oldStr !== newStr) {
      changes.push({
        type: 'modified',
        path: `slots.${key}`,
        oldValue: oldStr,
        newValue: newStr,
      });
    }
  }

  return changes;
}

// ============================================================
// 内部：Markdown 逐行 diff
// ============================================================

function diffLines(oldText: string, newText: string): DiffChange[] {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const changes: DiffChange[] = [];

  const maxLen = Math.max(oldLines.length, newLines.length);

  for (let i = 0; i < maxLen; i++) {
    const oldLine = i < oldLines.length ? oldLines[i] : undefined;
    const newLine = i < newLines.length ? newLines[i] : undefined;

    if (oldLine === undefined && newLine !== undefined) {
      changes.push({ type: 'added', path: `line:${i + 1}`, newValue: newLine });
    } else if (oldLine !== undefined && newLine === undefined) {
      changes.push({ type: 'removed', path: `line:${i + 1}`, oldValue: oldLine });
    } else if (oldLine !== newLine) {
      changes.push({
        type: 'modified',
        path: `line:${i + 1}`,
        oldValue: oldLine,
        newValue: newLine,
      });
    }
  }

  return changes;
}

// ============================================================
// 内部辅助
// ============================================================

async function listVersionMetaByIds(
  env: Env,
  ids: string[],
): Promise<{ id: string; version_num: number; created_at: string }[]> {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  const result = await env.DB.prepare(
    `SELECT id, version_num, created_at FROM file_versions WHERE id IN (${placeholders})`
  ).bind(...ids).all<{ id: string; version_num: number; created_at: string }>();
  return result.results || [];
}
