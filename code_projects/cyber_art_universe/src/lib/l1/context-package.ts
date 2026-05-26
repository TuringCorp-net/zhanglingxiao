// L1: 写作上下文包组装
// 在会话开始时一次性构建 M0-M5 完整上下文，作为 system prompt 的 frozen prefix。
// 同作品同语言 = 完全固定 → DeepSeek 缓存 100% 命中。

import { Env } from '../../db/schema';
import { workContentPath, type Lang } from '../work_content';

// ============================================================
// 类型
// ============================================================

export interface ContextPackageOptions {
  /** 是否包含 M5 意图卡（默认 true）。超大规模作品可关闭 */
  includeM5?: boolean;
  /** 强制重建（忽略 R2 缓存），默认 false */
  forceRebuild?: boolean;
}

// ============================================================
// R2 缓存 key
// ============================================================

function cacheKey(workId: string, lang: Lang): string {
  return workContentPath(workId, lang, 'elf_context_package.md');
}

// ============================================================
// 主函数
// ============================================================

/**
 * 获取或构建写作上下文包（M0-M5）。
 * 优先从 R2 缓存读取；缓存不存在或 forceRebuild=true 时重新构建并写入缓存。
 */
export async function getOrBuildContextPackage(
  env: Env,
  workId: string,
  lang: Lang,
  opts: ContextPackageOptions = {},
): Promise<string> {
  const key = cacheKey(workId, lang);

  // 非强制重建时，尝试从 R2 缓存读取
  if (!opts.forceRebuild) {
    const cached = await env.WORKS_BUCKET.get(key);
    if (cached) return await cached.text();
  }

  // 构建
  const includeM5 = opts.includeM5 !== false; // 默认 true
  const pkg = await buildContextPackage(env, workId, lang, { includeM5 });

  // 写入 R2 缓存
  await env.WORKS_BUCKET.put(key, pkg);

  return pkg;
}

/**
 * 使缓存失效（当 M0-M5 内容变更时调用）
 */
export async function invalidateContextPackage(
  env: Env,
  workId: string,
  lang: Lang,
): Promise<void> {
  const key = cacheKey(workId, lang);
  await env.WORKS_BUCKET.delete(key);
}

// ============================================================
// 内部构建函数
// ============================================================

async function buildContextPackage(
  env: Env,
  workId: string,
  lang: Lang,
  opts: { includeM5: boolean },
): Promise<string> {
  // 并发拉取：M0-M2 单文件，M3-M4 多文件（R2 存储 clean Markdown，无需清洗）
  const [m0, m1, m2, m3, m4, m5] = await Promise.all([
    readR2(env, workId, lang, 'original_concept.md'),
    readR2(env, workId, lang, 'world_bible.md'),
    readR2(env, workId, lang, 'outline.md'),
    buildM3Characters(env, workId, lang),
    buildM4Foreshadowing(env, workId, lang),
    opts.includeM5 ? buildM5Intents(env, workId, lang) : Promise.resolve(''),
  ]);

  const sections: [string, string][] = [
    ['原始构想（M0）', m0],
    ['世界观设定圣经（M1）', m1],
    ['长篇框架大纲（M2）', m2],
    ['人物卡（M3）', m3],
    ['伏笔账本（M4）', m4],
    ['章节意图总览（M5）', m5],
  ];

  // 组装：清洗已在各拉取函数中完成（文件级），此处只拼接
  const parts: string[] = [];
  for (const [title, content] of sections) {
    if (!content) continue;
    parts.push(`## ${title}\n\n${content}`);
  }

  return parts.join('\n\n---\n\n') || '';
}

// ============================================================
// 各模块数据拉取
// ============================================================

async function readR2(env: Env, workId: string, lang: Lang, filename: string): Promise<string> {
  try {
    const obj = await env.WORKS_BUCKET.get(workContentPath(workId, lang, filename));
    if (!obj) return '';
    return await obj.text();
  } catch {
    return ''; // 单文件读取失败不拖垮整个上下文包构建
  }
}

async function buildM3Characters(env: Env, workId: string, lang: Lang): Promise<string> {
  const entities = await env.DB.prepare(
    "SELECT id, name, type FROM entities WHERE work_id = ? AND type != 'foreshadowing'"
  ).bind(workId).all<{ id: string; name: string; type: string }>();

  if (!entities.results?.length) return '';

  // 并发拉取所有人物卡（R2 存储 clean Markdown，直接使用）
  const cards = (await Promise.all(
    entities.results.map(async e => {
      return readR2(env, workId, lang, `characters/${e.id}.md`);
    })
  )).filter(Boolean);

  return cards.join('\n\n');
}

async function buildM4Foreshadowing(env: Env, workId: string, lang: Lang): Promise<string> {
  // 策略总览 + 伏笔列表（并发）
  const [strategyRaw, fhEntities] = await Promise.all([
    readR2(env, workId, lang, 'foreshadowing.md'),
    env.DB.prepare(
      "SELECT id, name FROM entities WHERE work_id = ? AND type = 'foreshadowing'"
    ).bind(workId).all<{ id: string; name: string }>(),
  ]);

  const parts: string[] = [];
  if (strategyRaw) parts.push(strategyRaw);

  // 并发拉取所有伏笔卡（R2 存储 clean Markdown，直接使用）
  if (fhEntities.results?.length) {
    const cards = (await Promise.all(
      fhEntities.results.map(async e => {
        return readR2(env, workId, lang, `foreshadowing/${e.id}.md`);
      })
    )).filter(Boolean);
    parts.push(...cards);
  }

  return parts.join('\n\n');
}

async function buildM5Intents(env: Env, workId: string, lang: Lang): Promise<string> {
  // 从大纲获取章节列表
  const outlineMd = await readR2(env, workId, lang, 'outline.md');
  if (!outlineMd) return '';

  // 解析 section 引用（大纲中的章节列表从 DB sections 表获取）
  const sections = await env.DB.prepare(
    'SELECT id, title, section_summary, word_count, version FROM sections WHERE work_id = ? ORDER BY order_index ASC'
  ).bind(workId).all<{
    id: string; title: string; section_summary: string | null;
    word_count: number; version: number;
  }>();

  if (!sections.results?.length) return '';

  // 并发拉取所有意图卡 JSON
  const intentFutures = sections.results.map(async (s) => {
    let intentSummary = '';
    try {
      const intentObj = await env.WORKS_BUCKET.get(
        workContentPath(workId, lang, `intents/${s.id}.json`)
      );
      if (intentObj) {
        const intent = await intentObj.json() as Record<string, unknown>;
        const goal = intent.goal as Record<string, string> | undefined;
        const parts: string[] = [];
        if (intent.emotional_goal) parts.push(`情绪: ${intent.emotional_goal}`);
        if (intent.pov_character) parts.push(`视角: ${intent.pov_character}`);
        if (goal?.advance_conflict) parts.push(`推进: ${goal.advance_conflict}`);
        if (goal?.reveal_info) parts.push(`揭示: ${goal.reveal_info}`);
        if (intent.estimated_words) parts.push(`预估: ${intent.estimated_words}字`);
        if (parts.length > 0) intentSummary = ' | ' + parts.join(' | ');
      }
    } catch { /* 单条意图卡读取失败，跳过 */ }
    const statusIcon = s.word_count > 0 ? '✅' : (s.version > 0 ? '📝' : '🌱');
    const summary = s.section_summary || '（暂无摘要）';
    return `${statusIcon} **${s.title}** (v${s.version}, ${s.word_count || 0}字)${intentSummary}\n  ${summary}`;
  });

  const results = await Promise.all(intentFutures);
  return '以下为各章节的创作意图与状态：\n\n' + results.join('\n\n') + '\n';
}
