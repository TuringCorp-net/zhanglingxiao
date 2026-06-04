#!/usr/bin/env bash
# Session 管理自动化测试（零 LLM 成本）
# 通过 mock_reply 模拟 AI 回复，验证 Session 创建/持久化/恢复/归档全流程
set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
API="$BASE_URL/api/write"

PASS=0; FAIL=0

# check: 精确值比对（显示 expected vs got）
check() {
  local expected="$1" actual="$2" desc="$3"
  if [ "$expected" = "$actual" ]; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "     expected: $expected"
    echo "     got:      $actual"
    FAIL=$((FAIL + 1))
  fi
}
# check_grep: 内容包含检查
check_grep() {
  local desc="$1" haystack="$2" needle="$3"
  if echo "$haystack" | grep -q "$needle"; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "     needle:   $needle"
    echo "     haystack: $(echo "$haystack" | head -c 200)"
    FAIL=$((FAIL + 1))
  fi
}
# check_ge: 数值 >= 检查
check_ge() {
  local desc="$1" actual="$2" min="$3"
  if [ "$actual" -ge "$min" ] 2>/dev/null; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "     expected: >= $min"
    echo "     got:      $actual"
    FAIL=$((FAIL + 1))
  fi
}

jval() { python3 -c "import sys,json; d=json.load(sys.stdin); $1" 2>/dev/null; }
gval() { curl -s "$1" -H "Authorization: Bearer $TOKEN" | jval "$2"; }
pval() { curl -s -X POST "$1" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$2" | jval "$3"; }
log_step() { echo; echo "--- $1 ---"; }

cleanup() {
  [ -n "${SESS_A:-}" ] && curl -s -X POST "$API/elf/sessions/$SESS_A/archive" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 || true
  [ -n "${SESS_B:-}" ] && curl -s -X POST "$API/elf/sessions/$SESS_B/archive" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1 || true
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
check_grep "Session A 创建成功（有 ID）" "$SESS_A" "[a-f0-9]"

S1_STATUS=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['status'], end='')")
check "active" "$S1_STATUS" "Session A 状态为 active"

S1_MSGCOUNT=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['message_count'], end='')")
check "0" "$S1_MSGCOUNT" "新 Session message_count = 0"

S1_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check "0" "$S1_MSGLEN" "新 Session messages 为空"

LIST_IDS=$(gval "$API/elf/sessions?work_id=$WORK_ID&status=active" \
  "print(','.join(s['id'] for s in d['data']))")
check_grep "活跃列表包含 Session A" "$LIST_IDS" "$SESS_A"

# ============================================================
# Step 2: 首次 mock 对话
# ============================================================
log_step "Step 2: 首次 mock 对话"

T1_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_A\",\"messages\":[{\"role\":\"user\",\"content\":\"帮我看看世界观设定\"}],\"mock_reply\":\"好的，让我看看你的世界观。镜像对立的奇幻世界...\",\"context\":{\"module\":\"m1\"}}"

T1_RESP=$(mktemp)
curl -s -X POST "$API/elf/chat" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$T1_BODY" > "$T1_RESP"
T1_OK=$(jval "print(d['ok'], end='')" < "$T1_RESP")
T1_REPLY=$(jval "print(d['data']['reply'][:30])" < "$T1_RESP")
check "True" "$T1_OK" "Turn 1 HTTP 200"
check_grep "Turn 1 mock 回复正确" "$T1_REPLY" "镜像对立"
rm -f "$T1_RESP"

# 验证持久化
SESS_AFTER_T1=$(mktemp)
curl -s "$API/elf/sessions/$SESS_A" -H "Authorization: Bearer $TOKEN" > "$SESS_AFTER_T1"

T1_MC=$(jval "print(d['data']['message_count'], end='')" < "$SESS_AFTER_T1")
check "1" "$T1_MC" "Turn 1 后 message_count = 1"

T1_M0ROLE=$(jval "print(d['data']['messages'][0]['role'])" < "$SESS_AFTER_T1")
check "system" "$T1_M0ROLE" "messages[0] 是 system"

T1_M0CONTENT=$(jval "print(d['data']['messages'][0]['content'][:100])" < "$SESS_AFTER_T1")
check_grep "messages[0] 包含 Story Elf" "$T1_M0CONTENT" "Story Elf"

T1_LASTROLE=$(jval "print(d['data']['messages'][-1]['role'])" < "$SESS_AFTER_T1")
check "assistant" "$T1_LASTROLE" "最后一条是 assistant"

SP_TURN1=$(jval "print(d['data']['messages'][0]['content'])" < "$SESS_AFTER_T1")
rm -f "$SESS_AFTER_T1"

# ============================================================
# Step 3: 第二轮 mock 对话（续接 Session）
# ============================================================
log_step "Step 3: 第二轮 mock"

T2_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_A\",\"messages\":[{\"role\":\"user\",\"content\":\"帮我看看世界观设定\"},{\"role\":\"assistant\",\"content\":\"好的，让我看看你的世界观。镜像对立的奇幻世界...\"},{\"role\":\"user\",\"content\":\"那大纲怎么样？\"}],\"mock_reply\":\"大纲方面，你的三幕结构已经比较清晰...\",\"context\":{\"module\":\"m2\"}}"

T2_RESP=$(mktemp)
curl -s -X POST "$API/elf/chat" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$T2_BODY" > "$T2_RESP"
T2_OK=$(jval "print(d['ok'], end='')" < "$T2_RESP")
T2_REPLY=$(jval "print(d['data']['reply'][:30])" < "$T2_RESP")
check "True" "$T2_OK" "Turn 2 HTTP 200"
check_grep "Turn 2 mock 回复正确" "$T2_REPLY" "三幕结构"
rm -f "$T2_RESP"

SESS_AFTER_T2=$(mktemp)
curl -s "$API/elf/sessions/$SESS_A" -H "Authorization: Bearer $TOKEN" > "$SESS_AFTER_T2"

T2_MC=$(jval "print(d['data']['message_count'], end='')" < "$SESS_AFTER_T2")
check "2" "$T2_MC" "Turn 2 后 message_count = 2"

T2_MSGLEN=$(jval "print(len(d['data']['messages']), end='')" < "$SESS_AFTER_T2")
check_ge "Turn 2 后消息数 > 3" "$T2_MSGLEN" 4

SP_TURN2=$(jval "print(d['data']['messages'][0]['content'])" < "$SESS_AFTER_T2")
check "$SP_TURN1" "$SP_TURN2" "System Prompt 跨轮次不变（ImmutablePrefix）"

PREFIX_CHECK=$(jval "msgs=[m for m in d['data']['messages'] if m['role']=='user']; print(any('[当前模块: m2]' in m.get('content','') for m in msgs))" < "$SESS_AFTER_T2")
check "True" "$PREFIX_CHECK" "Turn 2 user msg 含 [当前模块: m2]"

T1_USER=$(jval "print(any('世界观设定' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "True" "$T1_USER" "messages 包含 Turn 1 用户消息"

T1_AI=$(jval "print(any('镜像对立' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "True" "$T1_AI" "messages 包含 Turn 1 AI 回复"

T2_USER=$(jval "print(any('大纲怎么样' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "True" "$T2_USER" "messages 包含 Turn 2 用户消息"

T2_AI=$(jval "print(any('三幕结构' in m.get('content','') for m in d['data']['messages']))" < "$SESS_AFTER_T2")
check "True" "$T2_AI" "messages 包含 Turn 2 AI 回复"
rm -f "$SESS_AFTER_T2"

# ============================================================
# Step 4: Session 恢复
# ============================================================
log_step "Step 4: Session 恢复"

R_M0ROLE=$(gval "$API/elf/sessions/$SESS_A" "print(d['data']['messages'][0]['role'])")
check "system" "$R_M0ROLE" "恢复后 messages[0] 是 system"

R_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check_ge "恢复后消息数 >= 4" "$R_MSGLEN" 4

# ============================================================
# Step 5: 归档
# ============================================================
log_step "Step 5: 归档"

ARCH_STATUS=$(pval "$API/elf/sessions/$SESS_A/archive" "{}" "print(d['data']['status'], end='')")
check "archived" "$ARCH_STATUS" "归档后 status = archived"

ARCH_MSGLEN=$(gval "$API/elf/sessions/$SESS_A" "print(len(d['data']['messages']), end='')")
check_ge "归档后消息仍可访问" "$ARCH_MSGLEN" 4

ACTIVE_IDS=$(gval "$API/elf/sessions?work_id=$WORK_ID&status=active" \
  "print(','.join(s['id'] for s in d['data']))")
# 归档后 SESS_A 不应出现在活跃列表中
if echo "$ACTIVE_IDS" | grep -q "$SESS_A"; then
  ACTIVE_HAS_A="1"
else
  ACTIVE_HAS_A="0"
fi
check "0" "$ACTIVE_HAS_A" "归档后不在活跃列表"

# ============================================================
# Step 6: 跨 Session System Prompt 一致性
# ============================================================
log_step "Step 6: 跨 Session System Prompt 一致性"

SESS_B=$(pval "$API/elf/sessions" \
  "{\"work_id\":\"$WORK_ID\",\"page\":\"write\"}" \
  "print(d['data']['id'], end='')")
check_grep "Session B 创建成功" "$SESS_B" "[a-f0-9]"

T3_BODY="{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"session_id\":\"$SESS_B\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}],\"mock_reply\":\"你好！有什么可以帮你的？\"}"
pval "$API/elf/chat" "$T3_BODY" "print('ok')" > /dev/null

SP_B=$(gval "$API/elf/sessions/$SESS_B" "print(d['data']['messages'][0]['content'])")
check "$SP_TURN1" "$SP_B" "Session A 和 B 的 System Prompt 完全一致"

pval "$API/elf/sessions/$SESS_B/archive" "{}" "print('ok')" > /dev/null

# ============================================================
# Step 7: 边界情况
# ============================================================
log_step "Step 7: 边界情况"

MISSING=$(curl -s -o /dev/null -w "%{http_code}" "$API/elf/sessions/nonexistent-id" -H "Authorization: Bearer $TOKEN")
check "404" "$MISSING" "不存在 Session 返回 404"

DOUBLE_ARCHIVE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/elf/sessions/$SESS_A/archive" -H "Authorization: Bearer $TOKEN")
# 200 或 409 均可（已归档后再次归档）
if [ "$DOUBLE_ARCHIVE" = "200" ] || [ "$DOUBLE_ARCHIVE" = "409" ]; then
  DBL_OK="200 or 409"
else
  DBL_OK="$DOUBLE_ARCHIVE"
fi
check "200 or 409" "$DBL_OK" "重复归档幂等（200 或 409）"

NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/elf/sessions" -H "Content-Type: application/json" -d "{\"work_id\":\"$WORK_ID\"}")
check "401" "$NOAUTH" "无认证返回 401"

# ============================================================
echo
echo "=========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "=========================================="
[ "$FAIL" -gt 0 ] && exit 1 || exit 0
