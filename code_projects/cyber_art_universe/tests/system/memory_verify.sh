#!/bin/bash
# ============================================================
# Memory 系统专项验证（平时不跑！）
# ============================================================
#
# ⚠️  重要警告 ⚠️
#
# 本测试会产生以下副作用：
#   1. 调用 POST /api/write/elf/chat 产生 LLM API 成本
#   2. 生成 L1 交互日志，永久写入生产环境 R2
#   3. 调用 /api/write/memory-test/setup + extract-l2 + extract-l3
#      会覆盖 memory-test-001 用户的记忆数据
#
# 仅在以下情况运行：
#   - Story Elf 记忆系统出现异常（如记忆丢失、提取结果错误等）
#   - 记忆提取/压缩 prompt 模板有改动，需要验证
#
# 运行方式：
#   TOKEN="admin-TuringCorp-13572468" bash tests/system/memory_verify.sh
#
# 原理：
#   1. setup: 上传预制的 L1/STM/LTM fixture 数据到 R2
#   2. extract-l2 / extract-l3: 手动触发记忆提取
#   3. 通过 debug:prompt 端点获取 memory-test-001 的 Layer 5
#   4. 人工（由 Claude 等 LLM）判断提取内容质量
#
# 注意：记忆提取经过 LLM 合并重写，每次输出不完全相同，
# 因此本测试不做精确字符串匹配，仅输出实际内容供人工审查。
# ============================================================

set -e

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"

AUTH="Authorization: Bearer $TOKEN"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

api_post() {
  curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d "$2" "$BASE_URL$1"
}

echo "========================================="
echo -e " ${YELLOW}⚠️  Memory System Verification (专项)${NC}"
echo " Base: $BASE_URL"
echo " Work: $WORK_ID"
echo " Time: $(date)"
echo "========================================="
echo ""
echo -e "${YELLOW}本测试会修改生产环境 R2 中的 memory-test-001 用户记忆数据。${NC}"
echo -e "${YELLOW}如果仅需查看当前记忆状态，请按 Ctrl+C 取消，改用 read-l2 / read-l3 端点。${NC}"
echo ""

# ============================================================
# Step 1: 上传测试 fixtures
# ============================================================
echo "--- Step 1: Setup fixtures ---"
resp=$(api_post "/api/write/memory-test/setup" '{"test_token":"memory-test-001"}')
if echo "$resp" | python3 -c "import json,sys; assert json.load(sys.stdin)['ok']" 2>/dev/null; then
  echo -e "  ${GREEN}✅ Setup OK${NC}"
else
  echo -e "  ${RED}❌ Setup failed:${NC} $resp"
  exit 1
fi

# ============================================================
# Step 2: 触发 L2 STM 提取
# ============================================================
echo "--- Step 2: Extract L2 (L1→STM) ---"
resp=$(api_post "/api/write/memory-test/extract-l2" '{"test_token":"memory-test-001"}')
echo "  $resp" | python3 -m json.tool 2>/dev/null || echo "  $resp"

# ============================================================
# Step 3: 触发 L3 LTM 提取
# ============================================================
echo "--- Step 3: Extract L3 (STM→LTM) ---"
resp=$(api_post "/api/write/memory-test/extract-l3" '{"user_token":"memory-test-001"}')
echo "  $resp" | python3 -m json.tool 2>/dev/null || echo "  $resp"

# ============================================================
# Step 4: 获取 memory-test-001 的 Layer 5 内容
# ============================================================
echo ""
echo "--- Step 4: Fetch memory-test-001 Layer 5 ---"
echo "========================================="
echo " 以下为 memory-test-001 的完整 Layer 5 记忆内容："
echo " 请人工审查提取质量（语义完整性、合并准确性等）。"
echo "========================================="
echo ""

api_post "/api/write/elf/chat" "$(python3 -c "
import json
print(json.dumps({
    'work_id': '${WORK_ID}',
    'page': 'write',
    'user_token': 'memory-test-001',
    'messages': [{'role': 'user', 'content': 'test'}],
    'debug': 'prompt'
}))
")" | python3 -c "
import json, sys
data = json.load(sys.stdin)
if not data.get('ok'):
    print('ERROR:', data)
    sys.exit(1)
l5 = data['data']['system_prompt_layers']['layer_5_memory']
print(l5)
print()
print('---')
print(f'Layer 5 长度: {len(l5)} 字符')
"

echo ""
echo "========================================="
echo -e " ${YELLOW}⚠️  请由 Claude 等 LLM 审查上述记忆内容的质量${NC}"
echo -e " ${YELLOW}  审查维度：语义完整性 / 合并准确性 / 链接结构${NC}"
echo "========================================="
