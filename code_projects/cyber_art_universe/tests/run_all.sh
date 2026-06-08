#!/usr/bin/env bash
# Cyber Art Universe — 一键运行全部自动化测试
#
# 用法:
#   bash tests/run_all.sh
#   TOKEN=xxx WORK_ID=xxx bash tests/run_all.sh
#
# Layer A（零 LLM 成本）: l2_prompt_verify.sh + conversation_test.sh + v3_module_api.sh
# Layer B（阅读路径）: human_test.sh + agent_test.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
TEST_WORK_ID="${TEST_WORK_ID:-$WORK_ID}"
export BASE_URL TOKEN WORK_ID TEST_WORK_ID

TOTAL_PASS=0
TOTAL_FAIL=0
SUITE_RESULTS=()

run_suite() {
  local name="$1" script="$2"
  echo "=========================================="
  echo " RUNNING: $name"
  echo "=========================================="
  local exit_code=0
  bash "$script" || exit_code=$?
  if [ "$exit_code" -eq 0 ]; then
    echo ">>> $name: PASS"
    SUITE_RESULTS+=("✅ $name")
  else
    echo ">>> $name: FAIL (exit $exit_code)"
    SUITE_RESULTS+=("❌ $name")
  fi
  echo ""
}

echo "╔══════════════════════════════════════════════╗"
echo "║  Cyber Art Universe — Full Test Suite       ║"
echo "║  Base: $BASE_URL"
echo "║  Work: $WORK_ID"
echo "║  Time: $(date)                              ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Layer A — 零 LLM 成本
run_suite "L2 Prompt Assembly (121项)" "$SCRIPT_DIR/system/l2_prompt_verify.sh"
run_suite "Perpetual Conversation (12项)" "$SCRIPT_DIR/system/conversation_test.sh"
run_suite "V3/V4 Module API"            "$SCRIPT_DIR/system/v3_module_api.sh"

# Layer B — 阅读路径
run_suite "Human Reading Path"         "$SCRIPT_DIR/human_test.sh"
run_suite "AI Agent Reading Path"      "$SCRIPT_DIR/agent_test.sh"

# 汇总
echo "╔══════════════════════════════════════════════╗"
echo "║  Test Suite Summary                         ║"
echo "╚══════════════════════════════════════════════╝"
for result in "${SUITE_RESULTS[@]}"; do
  echo "  $result"
done
echo ""
echo "All suites completed."
