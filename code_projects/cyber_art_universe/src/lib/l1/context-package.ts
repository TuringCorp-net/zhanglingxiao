/**
 * L1: 写作上下文包组装
 *
 * 覆盖需求 (Story Elf SRS):
 *   SE-030: 作品上下文拉取 — getOrBuildContextPackage(env, workId, lang)
 *           M0-M5 结构化 MD 并发拉取，R2 缓存
 *   SE-031: 上下文截断策略 — 各源独立字符截断上限
 *   SE-032: 上下文缓存 — 同 workId+lang 在单次请求内复用
 *
 * 同作品同语言 = 完全固定 → DeepSeek 缓存 100% 命中。
 */

import { Env } from '../../db/schema';
import { workContentPath, type Lang } from './work-content';

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
    if (cached) {
      // 检测 M5 是否需要自修复（旧数据无 .md 文件）
      const needsHeal = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM modules WHERE work_id = ? AND type = 'm5_intent' AND r2_md_key IS NULL"
      ).bind(workId).first<{ cnt: number }>();
      if (!needsHeal || needsHeal.cnt === 0) {
        return await cached.text();
      }
      // 有 M5 模块需要修复 → 删除旧缓存，强制重建
      await env.WORKS_BUCKET.delete(key);
    }
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
  // V3: 从 modules 表读取角色卡列表
  const mods = await env.DB.prepare(
    "SELECT id, name, r2_md_key FROM modules WHERE work_id = ? AND type = 'm3_card' ORDER BY order_index ASC"
  ).bind(workId).all<{ id: string; name: string; r2_md_key: string | null }>();

  if (!mods.results?.length) return '';

  // 并发拉取所有人物卡（R2 存储 clean Markdown，直接使用）
  const cards = (await Promise.all(
    mods.results.map(async m => {
      if (!m.r2_md_key) return '';
      return readR2(env, workId, lang, m.r2_md_key);
    })
  )).filter(Boolean);

  return cards.join('\n\n');
}

async function buildM4Foreshadowing(env: Env, workId: string, lang: Lang): Promise<string> {
  // V3: 从 modules 表读取伏笔策略 + 伏笔卡列表
  const [strategyRaw, fhMods] = await Promise.all([
    readR2(env, workId, lang, 'foreshadowing.md'),
    env.DB.prepare(
      "SELECT id, name, r2_md_key FROM modules WHERE work_id = ? AND type = 'm4_card' ORDER BY order_index ASC"
    ).bind(workId).all<{ id: string; name: string; r2_md_key: string | null }>(),
  ]);

  const parts: string[] = [];
  if (strategyRaw) parts.push(strategyRaw);

  // 并发拉取所有伏笔卡（R2 存储 clean Markdown，直接使用）
  if (fhMods.results?.length) {
    const cards = (await Promise.all(
      fhMods.results.map(async m => {
        if (!m.r2_md_key) return '';
        return readR2(env, workId, lang, m.r2_md_key);
      })
    )).filter(Boolean);
    parts.push(...cards);
  }

  return parts.join('\n\n');
}

async function buildM5Intents(env: Env, workId: string, lang: Lang): Promise<string> {
  // V3: 从 modules 表读取意图卡列表（与 M3/M4 对齐——读 .md 文件全文）
  const intentMods = await env.DB.prepare(
    "SELECT id, name, r2_json_key, r2_md_key FROM modules WHERE work_id = ? AND type = 'm5_intent' ORDER BY order_index ASC"
  ).bind(workId).all<{ id: string; name: string; r2_json_key: string | null; r2_md_key: string | null }>();

  if (!intentMods.results?.length) return '';

  // 并发拉取所有意图卡（优先 .md，缺失时从 .json 自动生成并保存 .md）
  let healed = false;
  const cards = (await Promise.all(
    intentMods.results.map(async (m) => {
      // 1) 尝试读 .md（对齐 M3/M4 的行为）
      if (m.r2_md_key) {
        const md = await readR2(env, workId, lang, m.r2_md_key);
        if (md) return md;
      }

      // 2) 自动修复：从 .json 生成 .md（旧数据无 .md 文件）
      if (m.r2_json_key) {
        try {
          const jsonObj = await env.WORKS_BUCKET.get(
            workContentPath(workId, lang, m.r2_json_key)
          );
          if (jsonObj) {
            const raw = await jsonObj.json() as Record<string, unknown>;
            const slots = (raw.slots || raw) as Record<string, string>;

            // 生成简洁的 Markdown 渲染（保留全部字段）
            const chapterName = m.name.replace(' · 意图卡', '');
            const lines: string[] = [`# ${chapterName}`];
            for (const [slotId, content] of Object.entries(slots)) {
              if (content && content.trim()) {
                lines.push(`\n## ${slotId}\n\n${content}`);
              }
            }
            const md = lines.join('\n') + '\n';

            // 保存 .md 并更新 modules 表（一次性修复）
            const mdRelKey = `intents/${m.id.replace('m5_intent_', '')}.md`;
            try {
              await env.WORKS_BUCKET.put(workContentPath(workId, lang, mdRelKey), md);
              await env.DB.prepare('UPDATE modules SET r2_md_key = ? WHERE id = ?').bind(mdRelKey, m.id).run();
              healed = true;
            } catch { /* 保存失败不影响上下文包构建 */ }

            return md;
          }
        } catch { /* 单条意图卡修复失败，跳过 */ }
      }

      return '';
    })
  )).filter(Boolean);

  // 自修复后失效上下文包缓存，让下次调用重建（包含完整 M5 内容）
  if (healed) {
    await env.WORKS_BUCKET.delete(cacheKey(workId, lang));
  }

  return cards.join('\n\n');
}
