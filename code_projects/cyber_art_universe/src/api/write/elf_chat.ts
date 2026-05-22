// Story Elf — AI 对话 API
// Read 侧（伴读精灵）和 Write 侧（写作精灵）共享此端点。
// 基于用户消息 + 上下文（当前作品/章节/模块），返回 AI 回复。
import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI, type Message } from '../../lib/ai';
import { workContentPath, readSectionMarkdown, extractLang, type Lang, LANG_LABELS } from '../../lib/work_content';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ElfChatRequest {
  work_id: string;
  section_id?: string;
  page: 'read' | 'write';
  messages: ChatMessage[];
  context?: {
    module?: string;
    section_title?: string;
    panel?: string;
  };
}

// POST /api/write/elf/chat?lang=zh|en
export async function handleElfChat(env: Env, request: Request): Promise<Response> {
  const body = await request.json() as ElfChatRequest;
  if (!body.work_id || !body.messages?.length || !body.page) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.MISSING_REQUIRED_FIELD, 'work_id, messages, and page are required')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const work = await env.DB.prepare('SELECT id, title, category, summary FROM works WHERE id = ?').bind(body.work_id).first<Record<string, unknown>>();
  if (!work) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.WORK_NOT_FOUND, 'Work not found')), {
      status: 404, headers: { 'Content-Type': 'application/json' },
    });
  }

  const lang = extractLang(request);
  const langLabel = LANG_LABELS[lang];

  // 收集上下文
  let contextBlock = '';

  // 世界观概要
  const wb = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'world_bible.md'));
  if (wb) {
    contextBlock += `\n【世界观设定】\n${(await wb.text()).substring(0, 1500)}\n`;
  }

  // 人物列表
  const entities = await env.DB.prepare('SELECT name, type, description FROM entities WHERE work_id = ? LIMIT 20').bind(body.work_id).all<Record<string, unknown>>();
  if (entities.results?.length) {
    contextBlock += `\n【角色列表】\n${entities.results.map(e => `- ${e.name}（${e.type}）：${String(e.description || '').substring(0, 80)}`).join('\n')}\n`;
  }

  // 大纲
  const outline = await env.WORKS_BUCKET.get(workContentPath(body.work_id, lang, 'outline.md'));
  if (outline) {
    contextBlock += `\n【剧情大纲】\n${(await outline.text()).substring(0, 1000)}\n`;
  }

  // 当前章节正文（如果有）
  if (body.section_id) {
    const content = await readSectionMarkdown(env, body.work_id, body.section_id, lang);
    if (content?.body) {
      contextBlock += `\n【当前章节正文】\n${content.body.substring(0, 3000)}\n`;
    }
  }

  // 构建角色提示
  const roles: Record<string, string> = {
    read: `你是 Story Elf（故事精灵），一位陪伴读者阅读小说的 AI 伴侣。你灵动、温暖、有见地。
- 帮助读者理解情节、分析角色动机、发现伏笔线索
- 在合适的时机分享有趣的背景知识或解读
- 回答读者关于作品的任何问题
- 语气：亲切、热情，像一位和你一起读书的朋友。不要剧透未读内容。`,
    write: `你是 Story Elf（故事精灵），一位辅助作者创作的 AI 伴侣。你灵动、有魔法、机智。
- 帮助作者构思情节、发展角色、设计伏笔
- 在作者卡住时提供灵感建议
- 回答关于世界观一致性和结构的问题
- 语气：鼓励、建设性，尊重作者的最终决定权。你是帮手，不是替代者。`,
  };

  const systemPrompt = `${roles[body.page] || roles.read}

## 当前作品信息
- 作品：《${work.title}》
- 分类：${work.category || '未指定'}
- 简介：${work.summary || '暂无'}
${body.context?.module ? `- 当前模块：${body.context.module}` : ''}
${body.context?.section_title ? `- 当前章节：${body.context.section_title}` : ''}
${body.context?.panel ? `- 当前面板：${body.context.panel}` : ''}

${contextBlock}

请用${langLabel}回复。保持简洁（一般不超过 200 字）。`;

  // 构建消息 —— 三角色分离：
  //   system  → 角色指令 + 作品上下文（固定前缀，可被 DeepSeek 硬盘缓存命中）
  //   user    → 用户的提问
  //   assistant → Story Elf 的历史回复（多轮对话时前端传入）
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    ...body.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  try {
    const result = await callAI(env, messages);
    return new Response(JSON.stringify(jsonSuccess({
      work_id: body.work_id,
      lang,
      reply: result.content.trim(),
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[elf_chat] AI call failed:', (err as Error).message);
    return new Response(JSON.stringify(jsonError(ErrorCodes.AI_SERVICE_UNAVAILABLE, 'AI service unavailable')), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}
