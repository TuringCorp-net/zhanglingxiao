#!/usr/bin/env bash
# Session 管理自动化测试（零 LLM 成本）
# 通过 mock_reply 模拟 AI 回复，验证 Session 创建/持久化/恢复/归档全流程

set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
API="$BASE_URL/api/write"

PASS=0
FAIL=0

check() {
  local desc="$1" condition="$2"
  if eval "$condition"; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    FAIL=$((FAIL + 1))
  fi
}

# 安全的 API JSON 取值（用 Python 脚本处理，避免 shell 引号问题）
# 用法: jval '<python_code>'  — 从 stdin 读取 JSON，执行 python_code，输出结果
jval() {
  python3 -c "import sys,json; d=json.load(sys.stdin); $1" 2>/dev/null
}

# GET 请求并 JSON 取值
gval() {
  curl -s "$1" -H "Authorization: Bearer $TOKEN" | jval "$2"
}

# POST 请求并 JSON 取值
pval() {
  curl -s -X POST "$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2" | jval "$3"
}

log_step() { echo; echo "--- $1 ---"; }

cleanup() {
  if [ -n "${SESS_A:-}" ]; then
    curl -s -X POST "$API/elf/sessions/$SESS_A/archive" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 || true
  fi
  if [ -n "${SESS_B:-}" ]; then
    curl -s -X POST "$API/elf/sessions/$SESS_B/archive" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "=========================================="
echo " Session Management Test"
echo " Base: $BASE_URL"
echo " Work: $WORK_ID"
echo " Time: $(date)"
echo "=========================================="

# ============================================================
# Step 1: 创建 Session
# ============================================================
log_step "Step 1: Session 创建"

SESS_A=$(pval "$API/elf/sessions" \
  "{\"work_id\":\"$WORK_ID\",\"page\":\"write\"}" \
  "print(d['data']['id'], end='')")

check "Session A 创建成功" '[ -n "$SESS_A" ]'

S1_STATUS=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['status'], end='')")
check "Session A 状态为 active" '[ "$S1_STATUS" = "active" ]'

S1_MSGCOUNT=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['message_count'], end='')")
check "新 Session message_count = 0" '[ "$S1_MSGCOUNT" = "0" ]'

S1_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check "新 Session messages 为空" '[ "$S1_MSGLEN" = "0" ]'

LIST_IDS=$(gval "$API/elf/sessions?work_id=$WORK_ID&status=active" \
  "print(','.join(s['id'] for s in d['data']))")
check "活跃列表包含 Session A" 'echo "$LIST_IDS" | grep -q "$SESS_A"'

# ============================================================
# Step 2: 首次 mock 对话
# ============================================================
log_step "Step 2: 首次 mock 对话"

T1_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_A\",\"messages\":[{\"role\":\"user\",\"content\":\"帮我看看世界观设定\"}],\"mock_reply\":\"好的，让我看看你的世界观。镜像对立的奇幻世界...\",\"context\":{\"module\":\"m1\"}}"

# 只发一次 POST，将响应保存到临时文件
T1_RESP=$(mktemp)
curl -s -X POST "$API/elf/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$T1_BODY" > "$T1_RESP"

T1_OK=$(jval "print(d['ok'], end='')" < "$T1_RESP")
check "Turn 1 HTTP 200" '[ "$T1_OK" = "True" ]'

T1_REPLY=$(jval "print(d['data']['reply'][:30])" < "$T1_RESP")
check "Turn 1 mock 回复正确" 'echo "$T1_REPLY" | grep -q "镜像对立"'
rm -f "$T1_RESP"

# 验证持久化（只发一次 GET）
SESS_AFTER_T1=$(mktemp)
curl -s "$API/elf/sessions/$SESS_A" -H "Authorization: Bearer $TOKEN" > "$SESS_AFTER_T1"

T1_MC=$(jval "print(d['data']['message_count'], end='')" < "$SESS_AFTER_T1")
check "Turn 1 后 message_count = 1" '[ "$T1_MC" = "1" ]'

T1_M0ROLE=$(jval "print(d['data']['messages'][0]['role'])" < "$SESS_AFTER_T1")
check "messages[0] 是 system" '[ "$T1_M0ROLE" = "system" ]'

T1_M0CONTENT=$(jval "print(d['data']['messages'][0]['content'][:50])" < "$SESS_AFTER_T1")
check "messages[0] 包含 Story Elf" 'echo "$T1_M0CONTENT" | grep -q "Story Elf"'

T1_LASTROLE=$(jval "print(d['data']['messages'][-1]['role'])" < "$SESS_AFTER_T1")
check "最后一条是 assistant" '[ "$T1_LASTROLE" = "assistant" ]'

SP_TURN1=$(jval "print(d['data']['messages'][0]['content'])" < "$SESS_AFTER_T1")
rm -f "$SESS_AFTER_T1"

# ============================================================
# Step 3: 第二轮 mock 对话（续接 Session）
# ============================================================
log_step "Step 3: 第二轮 mock"

T2_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_A\",\"messages\":[{\"role\":\"user\",\"content\":\"帮我看看世界观设定\"},{\"role\":\"assistant\",\"content\":\"好的，让我看看你的世界观。镜像对立的奇幻世界...\"},{\"role\":\"user\",\"content\":\"那大纲怎么样？\"}],\"mock_reply\":\"大纲方面，你的三幕结构已经比较清晰...\",\"context\":{\"module\":\"m2\"}}"

T2_RESP=$(mktemp)
curl -s -X POST "$API/elf/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "$T2_BODY" > "$T2_RESP"

T2_OK=$(jval "print(d['ok'], end='')" < "$T2_RESP")
check "Turn 2 HTTP 200" '[ "$T2_OK" = "True" ]'

T2_REPLY=$(jval "print(d['data']['reply'][:30])" < "$T2_RESP")
check "Turn 2 mock 回复正确" 'echo "$T2_REPLY" | grep -q "三幕结构"'
rm -f "$T2_RESP"

SESS_AFTER_T2=$(mktemp)
curl -s "$API/elf/sessions/$SESS_A" -H "Authorization: Bearer $TOKEN" > "$SESS_AFTER_T2"

T2_MC=$(jval "print(d['data']['message_count'], end='')" < "$SESS_AFTER_T2")
check "Turn 2 后 message_count = 2" '[ "$T2_MC" = "2" ]'

T2_MSGLEN=$(jval "print(len(d['data']['messages']), end='')" < "$SESS_AFTER_T2")
check "Turn 2 后消息数 > 3" '[ "$T2_MSGLEN" -gt 3 ]'

SP_TURN2=$(jval "print(d['data']['messages'][0]['content'])" < "$SESS_AFTER_T2")
check "System Prompt 跨轮次不变" '[ "$SP_TURN1" = "$SP_TURN2" ]'

PREFIX_CHECK=$(jval "msgs=[m for m in d['data']['messages'] if m['role']=='user']; print(any('[当前模块: m2]' in m.get('content','') for m in msgs))" < "$SESS_AFTER_T2")
check "Turn 2 user msg 含 [当前模块: m2]" '[ "$PREFIX_CHECK" = "True" ]'

T1_USER_OK=$(jval "print(any('世界观设定' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "messages 包含 Turn 1 用户消息" '[ "$T1_USER_OK" = "True" ]'

T1_AI_OK=$(jval "print(any('镜像对立' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "messages 包含 Turn 1 AI 回复" '[ "$T1_AI_OK" = "True" ]'

T2_USER_OK=$(jval "print(any('大纲怎么样' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "messages 包含 Turn 2 用户消息" '[ "$T2_USER_OK" = "True" ]'

T2_AI_OK=$(jval "print(any('三幕结构' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "messages 包含 Turn 2 AI 回复" '[ "$T2_AI_OK" = "True" ]'
rm -f "$SESS_AFTER_T2"

# ============================================================
# Step 4: Session 恢复
# ============================================================
log_step "Step 4: Session 恢复"

R_M0ROLE=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['messages'][0]['role'])")
check "恢复后 messages[0] 是 system" '[ "$R_M0ROLE" = "system" ]'

R_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check "恢复后消息数 >= 4" '[ "$R_MSGLEN" -ge 4 ]'

# ============================================================
# Step 5: 归档
# ============================================================
log_step "Step 5: 归档"

ARCH_STATUS=$(pval "$API/elf/sessions/$SESS_A/archive" "{}" "print(d['data']['status'], end='')")
check "归档后 status = archived" '[ "$ARCH_STATUS" = "archived" ]'

ARCH_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check "归档后消息仍可访问" '[ "$ARCH_MSGLEN" -ge 4 ]'

ACTIVE_IDS=$(gval "$API/elf/sessions?work_id=$WORK_ID&status=active" \
  "print(','.join(s['id'] for s in d['data']))")
check "归档后不在活跃列表" '! echo "$ACTIVE_IDS" | grep -q "$SESS_A"'

# ============================================================
# Step 6: 跨 Session System Prompt 一致性
# ============================================================
log_step "Step 6: 跨 Session System Prompt 一致性"

SESS_B=$(pval "$API/elf/sessions" \
  "{\"work_id\":\"$WORK_ID\",\"page\":\"write\"}" \
  "print(d['data']['id'], end='')")
check "Session B 创建成功" '[ -n "$SESS_B" ]'

T3_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_B\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"mock_reply\":\"你好！有什么可以帮你的？\"}"
pval "$API/elf/chat" "$T3_BODY" "print('ok')" > /dev/null

SP_B=$(gval "$API/elf/sessions/$SESS_B" "print(d['data']['messages'][0]['content'])")
check "Session A 和 B 的 System Prompt 完全一致" '[ "$SP_TURN1" = "$SP_B" ]'

pval "$API/elf/sessions/$SESS_B/archive" "{}" "print('ok')" > /dev/null

# ============================================================
# Step 7: 边界情况
# ============================================================
log_step "Step 7: 边界情况"

MISSING=$(curl -s -o /dev/null -w "%{http_code}" "$API/elf/sessions/nonexistent-id" -H "Authorization: Bearer $TOKEN")
check "不存在 Session 返回 404" '[ "$MISSING" = "404" ]'

DOUBLE_ARCHIVE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/elf/sessions/$SESS_A/archive" -H "Authorization: Bearer $TOKEN")
check "重复归档幂等" '[ "$DOUBLE_ARCHIVE" = "409" ] || [ "$DOUBLE_ARCHIVE" = "200" ]'

NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/elf/sessions" -H "Content-Type: application/json" -d "{\"work_id\":\"$WORK_ID\"}")
check "无认证返回 401" '[ "$NOAUTH" = "401" ]'

# ============================================================
echo
echo "=========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then exit 1; fi
