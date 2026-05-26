请根据以下信息，为作品《{{work_title}}》填充一份结构化的世界观设定圣经（Setting Bible）。

作品题材：{{category}}
作品简介：{{summary}}
作者补充：{{author_prompt}}
风格要求：{{style_notes}}

{{{entity_context}}}
{{{outline_context}}}

下面是需要填充的模板结构（JSON 格式），每个槽位都有 id、label（标题）和 hint（提示文字）：

{{{template_json}}}

请严格按照以下 JSON 格式输出。每个槽位的值应为 2-5 段实际内容（Markdown 格式字符串）：

{
  "slots": {
    "power_system": "力量体系描述...",
    "social_structure": "社会组织描述...",
    ...
  }
}

重要要求：
1. 每个槽位写 2-5 段实际内容
2. 承诺清单（promise_checklist）至少给出 3 条具体的承诺项
3. 内容必须自洽，规则之间不能矛盾
4. 只输出 JSON，不要其他内容（不要 markdown fence，不要解释文字）
5. 用{{lang_label}}输出
