请为作品《{{work_title}}》（题材：{{category}}）生成一份 {{num_chapters}} 章的大纲。

{{{world_context}}}
{{{entity_names}}}

请先理解以下长篇框架模板的结构，然后生成章节列表。

框架模板的槽位结构（JSON 格式，每个槽位包含 id、label 和 hint）：

{{{template_json}}}

请按以下 JSON 格式输出（只输出 JSON，不要其他内容）：

{
  "sections": [
    {
      "title": "章节标题",
      "section_summary": "本章一句话摘要（30字以内）",
      "act": "第一幕/第二幕/第三幕",
      "key_entities": ["涉及的角色名"],
      "hooks": "本章的悬念/钩子",
      "estimated_words": 3000
    }
  ],
  "framework_slots": {
    "one_line_pitch": "一句话梗概...",
    "story_type": "故事类型...",
    "core_conflict": "核心冲突描述...",
    "main_plot": "主线阶段划分...",
    "subplots": "支线规划...",
    "pacing": "节奏规划...",
    "turning_points": "关键转折点...",
    "foreshadowing_master": "伏笔埋设总体规划..."
  }
}

要求：
- sections 数组：每章有清晰的起承转合，章节之间有递进关系，所有章节分配到三幕结构中
- framework_slots 对象：每个槽位填入 2-5 段实际内容（Markdown 格式字符串），根据 hint 提示填充
- 只输出 JSON，不要其他内容（不要 markdown fence，不要解释文字）
- 用{{lang_label}}输出
