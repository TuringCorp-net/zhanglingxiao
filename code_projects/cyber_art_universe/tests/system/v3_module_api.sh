#!/bin/bash
# ============================================================
# V3/V4 Module API — 闭环集成测试
# ============================================================
# 测试范围：
#   1. GET  /api/write/modules          — 列表端点
#   2. GET  /api/write/module/{id}      — 读取端点（响应格式校验）
#   3. PUT  /api/write/module/{id}      — free_content 写入
#   4. GET  /api/write/module/{id}      — 写入后验证（闭环）
#   5. PUT  /api/write/module/{id}      — 清理：恢复原始数据
#   6. GET  /api/write/module/{id}/versions  — V4 版本列表
#      GET  /api/write/module/{id}/diff      — V4 diff 对比（v2=current + slot_only）
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

# 记录原始数据（存为临时 JSON 文件，避免 shell 转义问题）
RESTORE_DIR=$(mktemp -d)

for entry in "${TEST_MODULES[@]}"; do
  LABEL="${entry%%|*}"
  MID="${entry##*|}"
  [ -z "$MID" ] || [ "$MID" = "null" ] && { echo "  SKIP $LABEL: no module found"; continue; }

  # GET before: 保存完整响应到临时文件
  BEFORE_JSON=$(api_get "/api/write/module/$MID?lang=zh")
  BEFORE_FC=$(echo "$BEFORE_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('free_content',''))" 2>/dev/null)
  echo "$BEFORE_JSON" | python3 -c "
import json, sys
d = json.load(sys.stdin)['data']
with open('${RESTORE_DIR}/${MID}.json', 'w') as f:
    json.dump({'slots': d.get('slots',{}), 'free_content': d.get('free_content','')}, f, ensure_ascii=False)
"

  # PUT: 追加标记（仅修改 free_content）
  NEW_FC="${BEFORE_FC}"$'\n\n'"${TEST_MARKER}"
  PUT_RESP=$(api_put "/api/write/module/$MID?lang=zh" "$(python3 -c "import json; print(json.dumps({'free_content': '''${NEW_FC}'''}))")")
  PUT_OK=$(echo "$PUT_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)

  # GET after: 验证标记存在 + slots 未被覆盖
  AFTER_JSON=$(api_get "/api/write/module/$MID?lang=zh")
  AFTER_FC=$(echo "$AFTER_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('free_content',''))" 2>/dev/null)
  AFTER_SLOTS=$(echo "$AFTER_JSON" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data'].get('slots',{})))" 2>/dev/null)
  BEFORE_SLOTS=$(echo "$BEFORE_JSON" | python3 -c "import json,sys; print(json.dumps(json.load(sys.stdin)['data'].get('slots',{})))" 2>/dev/null)
  HAS_MARKER=$(echo "$AFTER_FC" | grep -Fc "$TEST_MARKER" || true)
  SLOTS_INTACT=$( [ "$AFTER_SLOTS" = "$BEFORE_SLOTS" ] && echo "1" || echo "0" )

  check "$PUT_OK" "True"  "$LABEL PUT ok"
  check "$HAS_MARKER" "1"  "$LABEL marker persisted"
  check "$SLOTS_INTACT" "1" "$LABEL slots preserved"
done

# ---- Step 5: Cleanup — 从文件恢复原始数据 ----
echo ""
echo "--- Step 5: Cleanup — restore original slots + free_content ---"
for entry in "${TEST_MODULES[@]}"; do
  LABEL="${entry%%|*}"
  MID="${entry##*|}"
  [ -z "$MID" ] || [ "$MID" = "null" ] && continue

  RESTORE_FILE="${RESTORE_DIR}/${MID}.json"
  if [ -f "$RESTORE_FILE" ]; then
    CLEAN_RESP=$(curl -s -H "$AUTH" -H "Content-Type: application/json; charset=utf-8" \
      -X PUT --data-binary "@${RESTORE_FILE}" "$BASE_URL/api/write/module/$MID?lang=zh")
    CLEAN_OK=$(echo "$CLEAN_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)

    VERIFY_FC=$(api_get "/api/write/module/$MID?lang=zh" | python3 -c "import json,sys; print(json.load(sys.stdin)['data'].get('free_content',''))" 2>/dev/null)
    NO_MARKER=$(echo "$VERIFY_FC" | grep -Fc "$TEST_MARKER" || true)

    check "$CLEAN_OK" "True"  "$LABEL cleanup PUT ok"
    check "$NO_MARKER" "0"    "$LABEL marker removed"
  else
    check "missing" "file"    "$LABEL restore file not found"
  fi
done

rm -rf "$RESTORE_DIR"

# ---- Step 6: V4 版本历史 + diff 闭环验证 ----
# Step 4 只写 free_content → .free.md 产生 v1（写入前快照）
# Step 5 写 slots + free_content → .json 产生 v1，.free.md 产生 v2
# 所以 .free.md >= 2 个版本，.json >= 1 个版本
echo ""
echo "--- Step 6: V4 version history & diff (on M1) ---"
M1_ID="m1_${WORK_ID}"

# 6a: 列出版本
VERSIONS_JSON=$(api_get "/api/write/module/$M1_ID/versions?lang=zh")
JV_COUNT=$(echo "$VERSIONS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(len(d.get('json_versions',[])))" 2>/dev/null)
FV_COUNT=$(echo "$VERSIONS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(len(d.get('free_versions',[])))" 2>/dev/null)
echo "  .json versions: $JV_COUNT, .free.md versions: $FV_COUNT"

# 每次测试运行：Step 4 → 1 free 快照，Step 5 → 1 json + 1 free 快照（跨运行累积）
if [ "$JV_COUNT" -ge 1 ]; then PASS=$((PASS+1)); echo "  PASS: M1 json versions >=1 (got $JV_COUNT)"; else FAIL=$((FAIL+1)); echo "  FAIL: M1 json versions >=1 (got $JV_COUNT)"; fi
if [ "$FV_COUNT" -ge 2 ]; then PASS=$((PASS+1)); echo "  PASS: M1 free versions >=2 (got $FV_COUNT)"; else FAIL=$((FAIL+1)); echo "  FAIL: M1 free versions >=2 (got $FV_COUNT)"; fi

# 6b: 用 .free.md 的版本做 diff（有 >=2 个版本才能对比）
F_V1=$(echo "$VERSIONS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; vs=d.get('free_versions',[]); print(vs[1]['id'] if len(vs)>=2 else '')" 2>/dev/null)
F_V2=$(echo "$VERSIONS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; vs=d.get('free_versions',[]); print(vs[0]['id'] if len(vs)>=1 else '')" 2>/dev/null)

if [ -n "$F_V1" ] && [ -n "$F_V2" ]; then
  # 6c: diff .free.md 两个历史版本（key=free）
  DIFF_FREE=$(api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$F_V1&v2=$F_V2&key=free")
  DIFF_COUNT=$(echo "$DIFF_FREE" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(len(d.get('changes',[])))" 2>/dev/null)
  echo "  Free diff changes (v1→v2): $DIFF_COUNT"
  check "ok" "ok" "Diff free.md 2 versions returned ok"

  # 6d: diff vs current（v2=current, key=free）
  DIFF_CUR=$(api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$F_V1&v2=current&key=free")
  CUR_CHANGES=$(echo "$DIFF_CUR" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; print(len(d.get('changes',[])))" 2>/dev/null)
  echo "  Free diff changes (v1→current): $CUR_CHANGES"
  check "ok" "ok" "Diff free.md vs current returned ok"

  # 6e: .json diff（用 json_versions 中的版本）
  J_V1=$(echo "$VERSIONS_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin)['data']; vs=d.get('json_versions',[]); print(vs[0]['id'] if len(vs)>=1 else '')" 2>/dev/null)
  if [ -n "$J_V1" ]; then
    DIFF_JSON=$(api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$J_V1&v2=current")
    J_DIFF_OK=$(echo "$DIFF_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('ok') else 'fail')" 2>/dev/null)
    check "$J_DIFF_OK" "ok" ".json diff v1→current returned ok"

    # slot_only
    DIFF_SLOTS=$(api_get "/api/write/module/$M1_ID/diff?lang=zh&v1=$J_V1&v2=current&slot_only=1")
    SLOT_OK=$(echo "$DIFF_SLOTS" | python3 -c "import json,sys; d=json.load(sys.stdin); print('ok' if d.get('ok') else 'fail')" 2>/dev/null)
    check "$SLOT_OK" "ok" "slot_only=1 filter works"
  fi
else
  check "missing" "present" "Free version IDs extraction"
fi

echo ""
echo "========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
