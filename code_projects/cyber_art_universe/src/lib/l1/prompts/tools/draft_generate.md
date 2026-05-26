请为作品《{{work_title}}》（题材：{{category}}）写第 {{chapter_index}} 章：{{chapter_title}}。

{{{world_context}}}
{{{prev_context}}}
{{{intent_context}}}
{{{section_summary}}}

要求：
- 保持人物性格和行为一致
- 严格遵守世界观设定
- 写完整的章节正文，包含场景描写、对话、心理活动
- 章末设置合理的悬念或过渡

请严格按照以下 JSON 格式输出（只输出 JSON，不要其他内容）：

{
  "slots": {
    "content": "完整的章节正文（Markdown 格式）"
  }
}
