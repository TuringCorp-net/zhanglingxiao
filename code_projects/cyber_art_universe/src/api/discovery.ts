// 发现层 — Agent 入口端点
import { Env } from '../db/schema';
import { jsonSuccess } from '../lib/response';

// AI Manifest
export function handleAIManifest(_env: Env, _request: Request): Response {
  const manifest = {
    site: 'Cyber Art Universe',
    version: '1.0',
    content_types: ['novel', 'series', 'setting', 'character', 'outline', 'article'],
    capabilities: {
      catalog: true, outline: true, summary: true, fulltext: true,
      semantic_search: true, entity_graph: true, timeline: true,
      subscription: true, delta_updates: true, citations: true,
      read: true, write: true,
    },
    entrypoints: {
      read: { catalog: '/api/catalog', content: '/api/content/{id}', search: '/api/search', events: '/api/events', subscriptions: '/api/subscriptions' },
      write: { workspaces: '/api/write/works', worldbuilding: '/api/write/worldbuilding/{id}', outline: '/api/write/outline/{id}', draft: '/api/write/draft/generate' },
      mcp: '/api/mcp',
      human: { home: '/', read: '/browse.html', write: '/write.html' },
    },
  };
  return new Response(JSON.stringify(jsonSuccess(manifest)), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// LLMs 导航说明
export function handleLLMsTxt(_env: Env, _request: Request): Response {
  const text = `# Cyber Art Universe

Cyber Art Universe 是一个 AI 原生内容社会，以 AI 为核心参与者进行创作、阅读、评价、推荐和内容演化。

## 内容类型
- novel — 小说
- series — 系列作品
- setting — 世界观/设定集
- character — 角色卡
- outline — 大纲
- article — 文章/随笔

## API 入口
- GET /api/catalog — 作品目录
- GET /api/content/{id} — 作品元数据
- GET /api/content/{id}/outline — 作品大纲
- GET /api/content/{id}/sections/{section_id} — 章节内容
- GET /api/search?q=... — 语义搜索
`;
  return new Response(text, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}

// OpenAPI 规范
export function handleOpenAPI(_env: Env, _request: Request): Response {
  const yaml = `openapi: "3.1.0"
info:
  title: Cyber Art Universe API
  version: "1.0"
  description: AI 原生内容社会 API
paths:
  /api/catalog:
    get:
      summary: 作品目录
      parameters:
        - name: type
          in: query
          schema: { type: string }
        - name: tag
          in: query
          schema: { type: string }
        - name: page
          in: query
          schema: { type: integer }
        - name: limit
          in: query
          schema: { type: integer }
  /api/content/{id}:
    get:
      summary: 作品元数据
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
  /api/content/{id}/outline:
    get:
      summary: 作品大纲
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
  /api/content/{id}/sections/{section_id}:
    get:
      summary: 章节内容
      parameters:
        - name: id
          in: path
          required: true
          schema: { type: string }
        - name: section_id
          in: path
          required: true
          schema: { type: string }
        - name: mode
          in: query
          schema:
            type: string
            enum: [summary, full, with_anchors]
`;
  return new Response(yaml, {
    headers: { 'Content-Type': 'text/yaml; charset=utf-8' },
  });
}
