请检查以下章节内容是否与世界观设定一致。

{{{world_context}}}
{{{prev_context}}}
{{{intent_context}}}

【待检查正文】
{{{chapter_content}}}

请找出所有不一致的地方，按 JSON 格式输出（只输出 JSON）：
{
  "issues": [
    {
      "severity": "warning|error",
      "type": "character_inconsistency|world_rule_violation|plot_contradiction|foreshadowing_conflict",
      "description": "问题描述",
      "location": "位置指示（如'第3段'）",
      "suggestion": "修改建议"
    }
  ]
}
如果没有问题，返回 { "issues": [] }
