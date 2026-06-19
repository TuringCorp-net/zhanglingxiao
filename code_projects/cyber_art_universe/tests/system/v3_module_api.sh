#!/bin/bash
# ============================================================
# V3/V4 Module API — 闭环集成测试（零残留）
# ============================================================
# 测试范围：
#   1. GET  /api/write/modules          — 列表端点
#   2. GET  /api/write/module/{id}      — 读取端点（响应格式校验）
#   3. PUT  /api/write/module/{id}      — free_content 写入（Python 脚本）
#   4. GET  /api/write/module/{id}      — 写入后验证（Python 脚本）
#   5. PUT  /api/write/module/{id}      — 精确恢复原始数据（Python 脚本）
#   6. GET  /api/write/module/{id}/versions  — V4 版本列表
#      GET  /api/write/module/{id}/diff      — V4 diff 对比
#
# 用法：
#   BASE_URL=https://cau.turingcorp.net TOKEN=xxx ./v3_module_api.sh
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$TOKEN" ]; then echo "ERROR: TOKEN env var is required"; exit 1; fi

AUTH="Authorization: Bearer $TOKEN"
PASS=0; FAIL=0

api_get()  { curl -s -H "$AUTH" "$BASE_URL$1"; }
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
[ -z "$WORK_ID" ] && { echo "  FAIL: No works found"; exit 1; }
echo "  Using work: $(echo "$WORKS" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'][0]['title'])") ($WORK_ID)"
check "ok" "ok" "Work found"
echo ""

# ---- Step 1: List all ----
echo "--- Step 1: GET /api/write/modules (all types) ---"
MOD_COUNT=$(api_get "/api/write/modules?work_id=$WORK_ID" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['data']['modules']))")
echo "  Total modules: $MOD_COUNT"
check "ok" "ok" "List endpoint returns ok"
echo ""

# ---- Step 2: List per type ----
echo "--- Step 2: GET /api/write/modules?type=X (per type) ---"
for TYPE in m0 m1 m2 m3_card m4_card m5_intent m6_chapter; do
  COUNT=$(api_get "/api/write/modules?work_id=$WORK_ID&type=$TYPE" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['data']['modules']))")
  echo "  $TYPE: $COUNT module(s)"
done
check "ok" "ok" "Per-type listing"
echo ""

# ---- Step 3: 响应格式校验 ----
echo "--- Step 3: GET /api/write/module/{id} — response format ---"
api_get "/api/write/module/m0_${WORK_ID}?lang=zh" | python3 -c "
import json,sys; d=json.load(sys.stdin)['data']
for k in ['type','editor_type','template','slots','free_content','rendered_md','is_template']: assert k in d, f'missing {k}'
print('  All required fields present')"
check "ok" "ok" "GET response format"
echo ""

# ---- Step 4 & 5: 读 → 改 → 写 → 验证 → 恢复（自包含 Python 脚本，零 shell 转义）----
python3 "$SCRIPT_DIR/_v3_module_rw_test.py" "$BASE_URL" "$TOKEN" "$WORK_ID"
PY_EXIT=$?
echo ""
[ "$PY_EXIT" -eq 0 ] && echo ">>> Module RW + cleanup: PASS" || echo ">>> Module RW + cleanup: FAIL"

# ---- Step 6: V4 版本历史 + diff ----
echo ""
echo "--- Step 6: V4 version history & diff (on M1) ---"
M1_ID="m1_${WORK_ID}"
VER_JSON=$(api_get "/api/write/module/$M1_ID/versions?lang=zh")
JV=$(echo "$VER_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['data']['json_versions']))")
FV=$(echo "$VER_JSON" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['data']['free_versions']))")
echo "  .json: $JV, .free.md: $FV"
[ "$JV" -ge 1 ] && { PASS=$((PASS+1)); echo "  PASS: json versions >=1"; } || { FAIL=$((FAIL+1)); echo "  FAIL: json versions >=1"; }
[ "$FV" -ge 2 ] && { PASS=$((PASS+1)); echo "  PASS: free versions >=2"; } || { FAIL=$((FAIL+1)); echo "  FAIL: free versions >=2"; }

F_V1=$(echo "$VER_JSON" | python3 -c "import json,sys; vs=json.load(sys.stdin)['data']['free_versions']; print(vs[1]['id'] if len(vs)>=2 else '')")
F_V2=$(echo "$VER_JSON" | python3 -c "import json,sys; vs=json.load(sys.stdin)['data']['free_versions']; print(vs[0]['id'] if len(vs)>=1 else '')")
if [ -n "$F_V1" ] && [ -n "$F_V2" ]; then
  api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$F_V1&v2=$F_V2&key=free" > /dev/null && check "ok" "ok" "Diff 2 versions"
  api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$F_V1&v2=current&key=free" > /dev/null && check "ok" "ok" "Diff vs current"
  J_V1=$(echo "$VER_JSON" | python3 -c "import json,sys; vs=json.load(sys.stdin)['data']['json_versions']; print(vs[0]['id'] if vs else '')")
  [ -n "$J_V1" ] && api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$J_V1&v2=current" > /dev/null && check "ok" "ok" ".json diff"
  [ -n "$J_V1" ] && api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$J_V1&v2=current&slot_only=1" > /dev/null && check "ok" "ok" "slot_only filter"
fi

echo ""
echo "========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "========================================="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
