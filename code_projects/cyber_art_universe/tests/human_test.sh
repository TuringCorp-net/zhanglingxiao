#!/bin/bash
# CAU 端到端测试 — 人类阅读路径
# 用法: TEST_WORK_ID="<uuid>" bash tests/human_test.sh
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
    echo "FAIL (HTTP $code)"
    echo "       expected: $expect"
    echo "       response: $(echo "$body" | head -c 300)"
    FAIL=$((FAIL + 1))
  fi
}

echo "=== CAU 人类阅读路径测试 ==="
echo "Base: $BASE"
echo "Work: $WORK_ID"
echo ""

# 1. Catalog 搜索
check "Catalog 可搜到作品" \
  "$BASE/api/catalog?status=published" \
  "$WORK_ID"

# 2. 作品元数据
check "作品元数据完整" \
  "$BASE/api/content/$WORK_ID" \
  '"ok":true'

# 3. 大纲
check "章节大纲" \
  "$BASE/api/content/$WORK_ID/outline" \
  '"sections"'

# 4. 取第一个章节 ID 并验证正文
SECTION_ID=$(curl -s "$BASE/api/content/$WORK_ID/outline" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['data']['sections'][0]['id'])" 2>/dev/null || echo "")
if [ -n "$SECTION_ID" ] && [ "$SECTION_ID" != "null" ]; then
  check "章节正文" \
    "$BASE/api/content/$WORK_ID/sections/$SECTION_ID?mode=full" \
    '"body"'
else
  echo "[ ] 章节正文 ... SKIP (无章节)"
fi

# 5. 分类
check "L1 分类" \
  "$BASE/api/content/$WORK_ID" \
  '"category"'

echo ""
echo "=== 结果: $PASS 通过, $FAIL 失败 ==="
[ "$FAIL" -eq 0 ] && echo "全部通过！" || echo "存在失败项，请检查。"
