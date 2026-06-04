#!/bin/bash
# CAU 端到端测试 — AI Agent 阅读路径
# 用法: TEST_WORK_ID="<uuid>" bash tests/agent_test.sh
set -euo pipefail

BASE="${CAU_BASE_URL:-https://cau.turingcorp.net}"
WORK_ID="${TEST_WORK_ID:-}"
PASS=0
FAIL=0

check() {
  local label="$1" url="$2" expect="$3"
  echo -n "[ ] $label ... "
  local resp
  resp=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null)
  local code
  code=$(echo "$resp" | tail -1)
  local body
  body=$(echo "$resp" | sed '$d')

  if echo "$body" | grep -q "$expect"; then
    echo "PASS (HTTP $code)"
    PASS=$((PASS + 1))
  else
    echo "FAIL (HTTP $code, expected '$expect' not found)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== CAU AI Agent 阅读路径测试 ==="
echo "Base: $BASE"
echo "Work: $WORK_ID"
echo ""

# 1. llms.txt 可发现
check "llms.txt 可访问" \
  "$BASE/llms.txt" \
  "Cyber Art Universe"

# 2. AI Manifest
check "ai-manifest.json 可访问" \
  "$BASE/.well-known/ai-manifest.json" \
  '"site"'

# 3. Catalog API
check "Catalog API 可搜到作品" \
  "$BASE/api/catalog?status=published" \
  "$WORK_ID"

# 4. 作品元数据（JSON 结构化）
check "作品 metadata (JSON)" \
  "$BASE/api/content/$WORK_ID" \
  '"category"'

# 5. 大纲可解析
check "大纲数据结构" \
  "$BASE/api/content/$WORK_ID/outline" \
  '"order_index"'

# 6. 取第一个章节 ID
SECTION_ID=$(curl -s "$BASE/api/content/$WORK_ID/outline" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['sections'][0]['id'])" 2>/dev/null || echo "")
if [ -n "$SECTION_ID" ] && [ "$SECTION_ID" != "null" ]; then
  check "章节正文 (markdown)" \
    "$BASE/api/content/$WORK_ID/sections/$SECTION_ID?mode=full" \
    '"body"'

  # 验证正文不是空的
  BODY_LEN=$(curl -s "$BASE/api/content/$WORK_ID/sections/$SECTION_ID?mode=full" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data'].get('body','')))" 2>/dev/null || echo "0")
  if [ "$BODY_LEN" -gt 0 ]; then
    echo "  -> 正文字节数: $BODY_LEN"
  else
    echo "  -> 警告: 正文为空"
  fi
else
  echo "[ ] 章节正文 ... SKIP (无章节)"
fi

echo ""
echo "=== 结果: $PASS 通过, $FAIL 失败 ==="
[ "$FAIL" -eq 0 ] && echo "全部通过！" || echo "存在失败项，请检查。"
