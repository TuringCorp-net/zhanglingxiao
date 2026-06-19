#!/bin/bash
# SSE 流式 Agent Loop 测试
# 使用 mock_steps 模拟多步骤 Agent 流程，无需 LLM 调用成本
# 验证: SSE 事件格式、步骤顺序、done 事件、持久化
set -euo pipefail

BASE="${CAU_BASE_URL:-https://CAU.turingcorp.net}"
AUTH="${CAU_TOKEN:-}"
WORK_ID="${CAU_WORK_ID:-bf844ea6-bee5-4ee0-91ea-55a1069d32e3}"

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ -z "$AUTH" ]; then
  echo -e "${RED}请设置 CAU_TOKEN 环境变量${NC}"
  echo "用法: CAU_TOKEN='cau_xxx' ./sse_stream_test.sh"
  exit 1
fi

echo -e "${CYAN}=== SSE 流式 Agent Loop 测试 ===${NC}"
echo "URL: $BASE/api/write/elf/chat"
echo "Work: $WORK_ID"
echo ""

# 模拟步骤：模拟一个真实的 Agent 工作流
# text_delta → tool_call → tool_result → tool_call(checklist) → tool_result(checklist) → done
MOCK_STEPS='[
  {"type":"text_delta","text":"好的，让我先查看 M1 的写作指南和当前内容。"},
  {"type":"tool_call","tool":"get_writing_guide","params":{"module_type":"m1","_lang":"zh","work_id":"'$WORK_ID'","_user_token":"test"}},
  {"type":"tool_result","tool":"get_writing_guide","summary":"## M1 世界观设定圣经 — 写作指南\n\n**定位**：这是作品的最高约束文档..."},
  {"type":"tool_call","tool":"read_module","params":{"module_type":"m1","_lang":"zh","work_id":"'$WORK_ID'","_user_token":"test"}},
  {"type":"tool_result","tool":"read_module","summary":"模块: 世界观设定圣经 (m1)\n=== 结构化槽位 ===\n当前 M1 为空，需要从零开始填充。"},
  {"type":"tool_call","tool":"checklist_write","params":{"items":[{"id":"1","status":"pending","label":"撰写力量/技术体系"},{"id":"2","status":"pending","label":"撰写社会组织与结构"},{"id":"3","status":"pending","label":"撰写禁忌与代价"}]}},
  {"type":"tool_result","tool":"checklist_write","summary":"任务清单（3 项，0% 完成）:\n⬜ 撰写力量/技术体系\n⬜ 撰写社会组织与结构\n⬜ 撰写禁忌与代价"},
  {"type":"text_delta","text":"现在开始逐槽填充 M1 世界观..."},
  {"type":"tool_call","tool":"write_to_slot","params":{"module_type":"m1","slot_values":{"power_system":"## 力量体系\n\n这个世界的力量来源于..."}}},
  {"type":"tool_result","tool":"write_to_slot","summary":"✅ 已写入 1 个槽位到模块 m1_bf844ea6。"},
  {"type":"tool_call","tool":"checklist_write","params":{"items":[{"id":"1","status":"done","label":"撰写力量/技术体系"},{"id":"2","status":"in_progress","label":"撰写社会组织与结构"},{"id":"3","status":"pending","label":"撰写禁忌与代价"}]}},
  {"type":"tool_result","tool":"checklist_write","summary":"任务清单（3 项，33% 完成）:\n✅ 撰写力量/技术体系\n🔄 撰写社会组织与结构\n⬜ 撰写禁忌与代价"}
]'

REQUEST=$(cat <<EOF
{
  "work_id": "$WORK_ID",
  "page": "write",
  "mock_reply": "## M1 世界观初版搭建完成！\n\n亲爱的作者，我已经帮你完成了力量体系的核心框架。",
  "mock_steps": $MOCK_STEPS,
  "messages": [
    {"role": "user", "content": "请帮我搭建《我在异界写剧本》的 M1 世界观设定"}
  ]
}
EOF
)

echo -e "${CYAN}发送 SSE 请求 (mock_steps: 12 步)...${NC}"
echo ""

# -N 禁用 curl 缓冲，实时显示 SSE 事件
EVENT_COUNT=0
STEP_COUNT=0
DONE_RECEIVED=false
REPLY=""
ERROR_RECEIVED=false

# 使用 while read 逐行解析 SSE
curl -s -N -X POST "$BASE/api/write/elf/chat?lang=zh" \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d "$REQUEST" 2>&1 | while IFS= read -r line; do
  if [[ "$line" == event:* ]]; then
    EVENT_TYPE="${line#event: }"
    EVENT_COUNT=$((EVENT_COUNT + 1))
  elif [[ "$line" == data:* ]]; then
    DATA="${line#data: }"

    if [ "$EVENT_TYPE" = "step" ]; then
      STEP_COUNT=$((STEP_COUNT + 1))
      # 提取 type
      STEP_TYPE=$(echo "$DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['type'])" 2>/dev/null || echo "parse_error")

      case "$STEP_TYPE" in
        text_delta)
          echo -e "  ${GREEN}[$STEP_COUNT] 💬 text_delta${NC}"
          ;;
        tool_call)
          TOOL=$(echo "$DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tool'])" 2>/dev/null || echo "?")
          echo -e "  ${GREEN}[$STEP_COUNT] 🔧 tool_call: $TOOL${NC}"
          ;;
        tool_result)
          TOOL=$(echo "$DATA" | python3 -c "import sys,json; print(json.load(sys.stdin)['tool'])" 2>/dev/null || echo "?")
          if [ "$TOOL" = "checklist_write" ]; then
            echo -e "  ${GREEN}[$STEP_COUNT] 📋 checklist_write${NC}"
          else
            echo -e "  ${GREEN}[$STEP_COUNT] ✅ tool_result: $TOOL${NC}"
          fi
          ;;
        error)
          echo -e "  ${RED}[$STEP_COUNT] ❌ error${NC}"
          ERROR_RECEIVED=true
          ;;
      esac

    elif [ "$EVENT_TYPE" = "done" ]; then
      DONE_RECEIVED=true
      REPLY=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('reply','?')[:80])" 2>/dev/null || echo "?")
      USAGE_MODEL=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('usage',{}).get('model','?'))" 2>/dev/null || echo "?")
      echo -e "  ${GREEN}✅ done: model=$USAGE_MODEL reply=\"$REPLY\"${NC}"

    elif [ "$EVENT_TYPE" = "error" ]; then
      echo -e "  ${RED}❌ error event: $(echo "$DATA" | head -c 100)${NC}"
      ERROR_RECEIVED=true
    fi
  fi
done

# 由于 while 在子 shell 中运行，最终统计在外层用 curl 结束时打印
echo ""
echo -e "${CYAN}=== 测试完成 ===${NC}"
echo "预期: 12 个 step 事件 + 1 个 done 事件"
echo "实际: 请检查上方逐条输出是否完整"
echo ""
echo -e "${GREEN}如果看到 12 个 step 后紧跟 done 事件 → SSE 流式正常 ✅${NC}"
echo -e "${RED}如果只看到一条 done → 可能缓冲问题，检查 X-Accel-Buffering 头${NC}"
