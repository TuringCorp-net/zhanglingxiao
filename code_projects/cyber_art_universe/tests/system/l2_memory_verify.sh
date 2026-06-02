#!/bin/bash
# ============================================================
# L2 记忆系统验证 — 零 LLM 成本
# ============================================================
# 原理：
#   1. 通过 memory-test/setup 上传预制的测试记忆文件（L2 + L3）
#   2. 通过 debug:prompt 端点拦截 System Prompt，验证 Layer 5 内容
#   3. 通过 memory-test/teardown 清理测试数据
#
# 测试数据：
#   - L2: 2 天的短期记忆（2026-06-01, 2026-06-02）
#   - L3: 1 份长期画像
#   - 内容为预制文本，包含可验证的特征标记
#
# 用法：
#   BASE_URL=... TOKEN=... ./tests/system/l2_memory_verify.sh
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
TEST_TOKEN="memory-test-001"

AUTH="Authorization: Bearer $TOKEN"
PASS=0
FAIL=0

api_post() {
  curl -s -H "$AUTH" -H "Content-Type: application/json" -X POST -d "$2" "$BASE_URL$1"
}

echo "========================================="
echo " L2 Memory System Verification"
echo " Base: $BASE_URL"
echo " Test Token: $TEST_TOKEN"
echo " Time: $(date)"
echo "========================================="
echo ""

# ============================================================
# Step 0: Setup — 上传测试记忆数据
# ============================================================
echo "--- Step 0: Setup test memory data ---"
SETUP=$(api_post "/api/write/memory-test/setup" "{\"test_token\": \"$TEST_TOKEN\"}")
SETUP_OK=$(echo "$SETUP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)

if [ "$SETUP_OK" = "True" ]; then
  PASS=$((PASS+1))
  echo "  ✅ PASS: Setup completed"
else
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: Setup failed: $(echo "$SETUP" | head -c 200)"
  exit 1
fi

echo ""

# ============================================================
# Step 1: 用测试 token 调用 debug:prompt
# ============================================================
echo "--- Step 1: Fetch debug prompt with test memory ---"

# 使用 admin token 认证，user_token 参数指定测试用户（extractUserToken → memory-t）
DEBUG_RESP=$(curl -s -X POST "$BASE_URL/api/write/elf/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"work_id\": \"$WORK_ID\",
    \"page\": \"write\",
    \"user_token\": \"$TEST_TOKEN\",
    \"messages\": [{\"role\": \"user\", \"content\": \"测试记忆注入\"}],
    \"debug\": \"prompt\"
  }")

DEBUG_OK=$(echo "$DEBUG_RESP" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)
if [ "$DEBUG_OK" != "True" ]; then
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: Debug request failed"
  echo "     Response: $(echo "$DEBUG_RESP" | head -c 300)"
  exit 1
fi

PASS=$((PASS+1))
echo "  ✅ PASS: Debug request succeeded"

# 提取 Layer 5 内容
LAYER5=$(echo "$DEBUG_RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)['data']
layers = d['system_prompt_layers']
print(layers['layer_5_memory'])
" 2>/dev/null)

echo "  Layer 5 size: ${#LAYER5} chars"
echo ""

# ============================================================
# Step 2: L2 短期记忆验证
# ============================================================
echo "--- Step 2: L2 STM Verification ---"

# 特征标记：L2 内容中应有这些唯一字符串
L2_MARKERS=(
  "偏好短句、快节奏叙事"
  "坠落型"
  "软魔法"
  "悲壮的希望"
  "镜像反派"
  "L3 使用 Markdown 格式"
)

for marker in "${L2_MARKERS[@]}"; do
  if echo "$LAYER5" | grep -qF "$marker"; then
    PASS=$((PASS+1))
    echo "  ✅ PASS: L2 包含 '$marker'"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ FAIL: L2 缺少 '$marker'"
  fi
done

# 结构验证：L2 应有日期分组
L2_STRUCTURE_MARKERS=(
  "### 2026-06-01"
  "### 2026-06-02"
)

for marker in "${L2_STRUCTURE_MARKERS[@]}"; do
  if echo "$LAYER5" | grep -qF "$marker"; then
    PASS=$((PASS+1))
    echo "  ✅ PASS: L2 结构包含 '$marker'"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ FAIL: L2 结构缺少 '$marker'"
  fi
done

# 链接验证：L2 应有指向 L1 的链接
if echo "$LAYER5" | grep -qF "[[l1-sess_"; then
  PASS=$((PASS+1))
  echo "  ✅ PASS: L2 包含 L1 链接 [[l1-sess_...]]"
else
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: L2 缺少 L1 链接"
fi

echo ""

# ============================================================
# Step 3: L3 长期画像验证
# ============================================================
echo "--- Step 3: L3 LTM Verification ---"

L3_MARKERS=(
  "用户画像"
  "快节奏叙事"
  "软魔法体系"
  "坠落型"
  "镜像反派"
  "专业口吻"
)

for marker in "${L3_MARKERS[@]}"; do
  if echo "$LAYER5" | grep -qF "$marker"; then
    PASS=$((PASS+1))
    echo "  ✅ PASS: L3 包含 '$marker'"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ FAIL: L3 缺少 '$marker'"
  fi
done

# 链接验证：L3 应有指向 L2 的链接
if echo "$LAYER5" | grep -qF "[[l2-2026-06"; then
  PASS=$((PASS+1))
  echo "  ✅ PASS: L3 包含 L2 链接 [[l2-2026-06-...]]"
else
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: L3 缺少 L2 链接"
fi

# 元信息验证
L3_META_MARKERS=(
  "最后更新"
  "来源 L2 文件"
)

for marker in "${L3_META_MARKERS[@]}"; do
  if echo "$LAYER5" | grep -qF "$marker"; then
    PASS=$((PASS+1))
    echo "  ✅ PASS: L3 元信息包含 '$marker'"
  else
    FAIL=$((FAIL+1))
    echo "  ❌ FAIL: L3 元信息缺少 '$marker'"
  fi
done

echo ""

# ============================================================
# Step 4: 无记忆用户验证（兜底）
# ============================================================
echo "--- Step 4: No-memory fallback ---"

EMPTY_RESP=$(curl -s -X POST "$BASE_URL/api/write/elf/chat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"work_id\": \"$WORK_ID\",
    \"page\": \"write\",
    \"user_token\": \"no-memory-user-xxx\",
    \"messages\": [{\"role\": \"user\", \"content\": \"测试\"}],
    \"debug\": \"prompt\"
  }")

EMPTY_L5=$(echo "$EMPTY_RESP" | python3 -c "
import json, sys
d = json.load(sys.stdin)['data']
print(d['system_prompt_layers']['layer_5_memory'])
" 2>/dev/null)

if echo "$EMPTY_L5" | grep -qF "暂无记忆数据"; then
  PASS=$((PASS+1))
  echo "  ✅ PASS: 无记忆用户显示兜底占位"
else
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: 无记忆用户缺少兜底占位"
  echo "     Layer 5: '$EMPTY_L5'"
fi

echo ""

# ============================================================
# Step 5: Teardown — 清理测试数据
# ============================================================
echo "--- Step 5: Teardown ---"
TEARDOWN=$(api_post "/api/write/memory-test/teardown" "{\"test_token\": \"$TEST_TOKEN\"}")
TEARDOWN_OK=$(echo "$TEARDOWN" | python3 -c "import json,sys; print(json.load(sys.stdin).get('ok',False))" 2>/dev/null)

if [ "$TEARDOWN_OK" = "True" ]; then
  PASS=$((PASS+1))
  echo "  ✅ PASS: Teardown completed"
else
  FAIL=$((FAIL+1))
  echo "  ❌ FAIL: Teardown failed"
fi

echo ""
echo "========================================="
echo " Results: $PASS passed, $FAIL failed"
echo "========================================="

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
