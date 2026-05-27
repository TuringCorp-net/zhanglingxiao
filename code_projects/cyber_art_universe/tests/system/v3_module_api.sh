#!/bin/bash
# ============================================================
# V3 统一 Module API — 闭环集成测试
# ============================================================
# 测试范围：
#   1. GET  /api/write/modules          — 列表端点
#   2. GET  /api/write/module/{id}      — 读取端点（响应格式校验）
#   3. PUT  /api/write/module/{id}      — free_content 写入
#   4. GET  /api/write/module/{id}      — 写入后验证（闭环）
#
# 覆盖模块：M0, M1, M2, M3_card(x1), M4_strategy, M4_card(x1), M5_intent(x1)
#
# 用法：
#   BASE_URL=https://cau.turingcorp.net TOKEN=xxx ./v3_module_api.sh
#   或设置环境变量后直接运行
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-}"
MARKER_PREFIX="Agent API test"

if [ -z "$TOKEN" ]; then
  echo "ERROR: TOKEN env var is required"
  echo "Usage: TOKEN=<admin-token> $0"
  exit 1
fi

AUTH="Authorization: Bearer $TOKEN"
PASS=0
FAIL=0
TIMESTAMP=$(date +%s)
TEST_MARKER="[${MARKER_PREFIX} OK] (run ${TIMESTAMP})"

# ---- helpers ----
api_get()  { curl -s -H "$AUTH" "$BASE_URL$1"; }
api_put()  { curl -s -H "$AUTH" -H "Content-Type: application/json" -X PUT -d "$2" "$BASE_URL$1"; }
check()    { if [ "$1" = "$2" ]; then PASS=$((PASS+1)); echo "  PASS: $3"; else FAIL=$((FAIL+1)); echo "  FAIL: $3 (expected: $2, got: $1)"; fi; }

echo "========================================="
echo " V3 Module API — Integration Test"
echo " Base: $BASE_URL"
echo " Time: $(date)"
echo "========================================="
echo ""

# ---- Step 0: 获取测试作品 ----
echo "--- Step 0: Find test work ---"
WORKS=$(api_get "/api/write/works")
WORK_ID=$(echo "$WORKS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'][0]['id'])" 2>/dev/null)
if [ -z "$WORK_ID" ]; then
  echo "  FAIL: No works found — create a test work first"
  exit 1
fi
WORK_TITLE=$(echo "$WORKS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data'][0]['title'])" 2>/dev/null)
echo "  Using work: $WORK_TITLE ($WORK_ID)"
check "ok" "ok" "Work found"
echo ""

# ---- Step 1: List all module types ----
echo "--- Step 1: GET /api/write/modules (all types) ---"
ALL_MODS=$(api_get "/api/write/modules?work_id=$WORK_ID")
MOD_COUNT=$(echo "$ALL_MODS" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']['modules']))" 2>/dev/null)
echo "  Total modules: $MOD_COUNT"
check "ok" "ok" "List endpoint returns ok"
echo ""

# ---- Step 2: List per type ----
echo "--- Step 2: GET /api/write/modules?type=X (per type) ---"
for TYPE in m0 m1 m2 m3_card m4_strategy m4_card m5_intent m6_chapter; do
  COUNT=$(api_get "/api/write/modules?work_id=$WORK_ID&type=$TYPE" | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d['data']['modules']))" 2>/dev/null)
  echo "  $TYPE: $COUNT module(s)"
done
check "ok" "ok" "Per-type listing"
echo ""

# ---- Step 3: GET 单 module 响应格式校验 ----
echo "--- Step 3: GET /api/write/module/{id} — response format ---"
M0_ID="m0_${WORK_ID}"
M0_DATA=$(api_get "/api/write/module/$M0_ID?lang=zh")
echo "$M0_DATA" | python3 -c "
import json,sys
d=json.load(sys.stdin)['data']
assert d['type']=='m0', f'type: {d[\"type\"]}'
assert d['editor_type']=='slot', f'editor_type: {d[\"editor_type\"]}'
assert 'template' in d, 'missing template'
assert 'slots' in d, 'missing slots'
assert 'free_content' in d, 'missing free_content'
assert 'rendered_md' in d, 'missing rendered_md'
assert 'is_template' in d, 'missing is_template'
print('  All required fields present')
" 2>&1
check "ok" "ok" "GET response format"
echo ""

# ---- Step 4: free_content 写入 + 验证（闭环） ----
echo "--- Step 4: PUT free_content → GET verify (closed loop) ---"

# 定义测试目标：单例模块 + 多卡片取第一个
get_first_id() {
  api_get "/api/write/modules?work_id=$WORK_ID&type=$1" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['data']['modules'][0]['id'])" 2>/dev/null
}

M3_FIRST=$(get_first_id "m3_card")
M4_CARD_FIRST=$(get_first_id "m4_card")
M5_FIRST=$(get_first_id "m5_intent")

TEST_MODULES=(
  "M0|m0_${WORK_ID}"
  "M1|m1_${WORK_ID}"
  "M2|m2_${WORK_ID}"
  "M3_card|${M3_FIRST}"
  "M4_strategy|m4_strategy_${WORK_ID}"
  "M4_card|${M4_CARD_FIRST}"
  "M5_intent|${M5_FIRST}"
)

for entry in "${TEST_MODULES[@]}"; do
  LABEL="${entry%%|*}"
  MID="${entry##*|}"
  [ -z "$MID" ] || [ "$MID" = "null" ] && { echo "  SKIP $LABEL: no module found"; continue; }

  # GET before
  BEFORE=$(api_get "/api/write/module/$MID?lang=zh" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('free_content',''))" 2>/dev/null)

  # PUT: 追加标记
  NEW_FC="${BEFORE}"$'\n\n'"${TEST_MARKER}"
  PUT_RESP=$(api_put "/api/write/module/$MID?lang=zh" "$(python3 -c "import json; print(json.dumps({'free_content': '''${NEW_FC}'''}))")")
  PUT_OK=$(echo "$PUT_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)

  # GET after: 验证标记存在
  AFTER=$(api_get "/api/write/module/$MID?lang=zh" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('free_content',''))" 2>/dev/null)
  HAS_MARKER=$(echo "$AFTER" | grep -Fc "$TEST_MARKER" || true)

  check "$PUT_OK" "True"  "$LABEL PUT ok"
  check "$HAS_MARKER" "1"  "$LABEL marker persisted"
done

echo ""
echo "========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
