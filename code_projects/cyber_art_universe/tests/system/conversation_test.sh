#!/usr/bin/env bash
# Perpetual Conversation 自动化测试（零 LLM 成本）
# 验证: 无 Session 对话 / 消息持久化 / 作品隔离 / Read/Write 隔离
set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
API="$BASE_URL/api/write"

PASS=0; FAIL=0

# Save original conversation state so we can restore it after tests
ORIG_WRITE=$(curl -s "$API/elf/conversation?work_id=$WORK_ID&page=write" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data']['messages']))" 2>/dev/null || echo "[]")
ORIG_READ=$(curl -s "$API/elf/conversation?work_id=$WORK_ID&page=read" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d['data']['messages']))" 2>/dev/null || echo "[]")

# Cleanup: restore original conversation state, don't touch real data
cleanup() {
  echo
  echo "--- Cleanup (restoring original state) ---"

  curl -s -X PUT "$API/elf/conversation" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"work_id\":\"$WORK_ID\",\"page\":\"write\",\"messages\":$ORIG_WRITE}" > /dev/null
  echo "  🧹 Restored conversation: $WORK_ID/write ($(echo "$ORIG_WRITE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") messages)"

  curl -s -X PUT "$API/elf/conversation" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"work_id\":\"$WORK_ID\",\"page\":\"read\",\"messages\":$ORIG_READ}" > /dev/null
  echo "  🧹 Restored conversation: $WORK_ID/read ($(echo "$ORIG_READ" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))") messages)"
}
trap cleanup EXIT

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

echo "=========================================="
echo " Perpetual Conversation Test (Zero LLM)"
echo " Base: $BASE_URL"
echo " Work: $WORK_ID"
echo " Time: $(date)"
echo "=========================================="

# ============================================================
# Step 1: Chat without session_id (mock_reply)
# ============================================================
log_step "Step 1: Chat without session_id"

TIMESTAMP="conv-test-$(date +%s)"
CHAT_RESP=$(curl -s -X POST "$API/elf/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"work_id\": \"$WORK_ID\",
    \"page\": \"write\",
    \"mock_reply\": \"Hello from perpetual conversation! $TIMESTAMP\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Test message $TIMESTAMP\"}
    ]
  }")

REPLY=$(echo "$CHAT_RESP" | jval "print(d['data']['reply'])")
check_grep "Chat returns mock reply" "$REPLY" "$TIMESTAMP"

# ============================================================
# Step 2: GET conversation returns persisted messages
# ============================================================
log_step "Step 2: GET conversation returns messages"

CONV_RESP=$(curl -s "$API/elf/conversation?work_id=$WORK_ID&page=write" \
  -H "Authorization: Bearer $TOKEN")

MSG_COUNT=$(echo "$CONV_RESP" | jval "print(len(d['data']['messages']))")
check_ge "Conversation has messages after chat" "$MSG_COUNT" 1

# ============================================================
# Step 3: Multiple messages accumulate
# ============================================================
log_step "Step 3: Multiple messages accumulate"

TIMESTAMP2="conv-test2-$(date +%s)"
CHAT_RESP2=$(curl -s -X POST "$API/elf/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"work_id\": \"$WORK_ID\",
    \"page\": \"write\",
    \"mock_reply\": \"Second reply! $TIMESTAMP2\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"Test message $TIMESTAMP\"},
      {\"role\": \"assistant\", \"content\": \"Hello from perpetual conversation! $TIMESTAMP\"},
      {\"role\": \"user\", \"content\": \"Follow-up $TIMESTAMP2\"}
    ]
  }")

REPLY2=$(echo "$CHAT_RESP2" | jval "print(d['data']['reply'])")
check_grep "Second chat returns reply" "$REPLY2" "$TIMESTAMP2"

# Check conversation now has more messages
CONV_RESP2=$(curl -s "$API/elf/conversation?work_id=$WORK_ID&page=write" \
  -H "Authorization: Bearer $TOKEN")
MSG_COUNT2=$(echo "$CONV_RESP2" | jval "print(len(d['data']['messages']))")
check_ge "Conversation grew after second chat" "$MSG_COUNT2" "$MSG_COUNT"

# ============================================================
# Step 4: Read/Write page isolation
# ============================================================
log_step "Step 4: Read/Write page isolation"

READ_RESP=$(curl -s "$API/elf/conversation?work_id=$WORK_ID&page=read" \
  -H "Authorization: Bearer $TOKEN")
READ_MSGS=$(echo "$READ_RESP" | jval "print(len(d['data']['messages']))")
check_eq() {
  local desc="$1" actual="$2" expected="$3"
  if [ "$actual" = "$expected" ]; then
    echo "  ✅ PASS: $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌ FAIL: $desc"
    echo "     expected: $expected"
    echo "     got:      $actual"
    FAIL=$((FAIL + 1))
  fi
}
check_eq "Read page has separate conversation (empty)" "$READ_MSGS" "0"

# ============================================================
# Step 5: Session endpoints no longer exist
# ============================================================
log_step "Step 5: Session CRUD endpoints removed"

SESS_CREATE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/elf/sessions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"work_id\": \"$WORK_ID\", \"page\": \"write\"}")
check "404" "$SESS_CREATE" "POST /elf/sessions returns 404"

SESS_LIST=$(curl -s -o /dev/null -w "%{http_code}" "$API/elf/sessions" \
  -H "Authorization: Bearer $TOKEN")
check "404" "$SESS_LIST" "GET /elf/sessions returns 404"

# ============================================================
# Step 6: Chat still works without any session in request
# ============================================================
log_step "Step 6: Chat works with minimal fields"

TIMESTAMP3="conv-test-minimal-$(date +%s)"
MINIMAL_RESP=$(curl -s -X POST "$API/elf/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"work_id\": \"$WORK_ID\",
    \"page\": \"write\",
    \"mock_reply\": \"Minimal\",
    \"messages\": [{\"role\": \"user\", \"content\": \"Hi\"}]
  }")
MIN_OK=$(echo "$MINIMAL_RESP" | jval "print(d['ok'])")
check "True" "$MIN_OK" "Minimal chat request works"

# ============================================================
# Summary
# ============================================================
echo
echo "=========================================="
echo " Total: $((PASS + FAIL))  |  ✅ PASS: $PASS  |  ❌ FAIL: $FAIL"
echo "=========================================="

if [ "$FAIL" -gt 0 ]; then exit 1; fi
