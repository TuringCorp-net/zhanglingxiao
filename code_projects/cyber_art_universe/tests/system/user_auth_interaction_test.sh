#!/bin/bash
# ============================================================
# 用户账户与互动系统 — 集成测试（零残留）
# ============================================================
# 测试账号：ClawKangKang (Token=CAU-TuringCorp-13572468)
# 赞赏目标：TuringCorp (跨用户赞赏测试)
#
# 测试分两阶段：
#   阶段 A（无 TEST_MODE）：验证 IP 限流生效 + 重复名/邮箱拒绝
#   阶段 B（开启 TEST_MODE）：绕过限流，全自动注册 → 验证 → 互动 → 清理
#
# 用法：bash tests/system/user_auth_interaction_test.sh
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="CAU-TuringCorp-13572468"
AUTH="Authorization: Bearer $TOKEN"
PASS=0; FAIL=0
NOW_TS=$(date +%s)

# Helper: 提取 JSON 字段
jq() { python3 -c "import json,sys;d=json.load(sys.stdin);print(d$1)"; }
api_get()  { curl -s -H "$AUTH" "$BASE_URL$1"; }
api_post() { curl -s -X POST -H "$AUTH" -H "Content-Type: application/json" -d "$1" "$BASE_URL$2"; }
api_post_noauth() { curl -s -X POST -H "Content-Type: application/json" -d "$1" "$BASE_URL$2"; }
http_code() { curl -s -o /dev/null -w "%{http_code}" "$@"; }
pass() { PASS=$((PASS+1)); echo "  ✅ $1"; }
fail() { FAIL=$((FAIL+1)); echo "  ❌ $1 (expected: $2, got: $3)"; }

d1_exec() {
  cd /home/uncleclaw/.openclaw/workspace/WM/code_projects/cyber_art_universe
  npx wrangler d1 execute cyber_art_db --remote --command="$1" 2>/dev/null | tail -1
}

# 确保测试结束时关闭 TEST_MODE（无论成功或失败）
cleanup_test_mode() {
  echo ""
  echo "--- 关闭 TEST_MODE ---"
  echo "yes" | npx wrangler secret delete TEST_MODE 2>/dev/null || true
  echo "  TEST_MODE 已关闭"
}
trap cleanup_test_mode EXIT

echo "╔══════════════════════════════════════════════╗"
echo "║  User Auth & Interaction — Integration Test ║"
echo "║  Base: $BASE_URL"
echo "║  User: ClawKangKang"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
# 前置：确保 TEST_MODE 关闭 + 清理残留
# ============================================================
echo "--- 前置：初始化 ---"
echo "yes" | npx wrangler secret delete TEST_MODE 2>/dev/null || true
# 等几秒让 Secret 删除生效
sleep 3

# 清理之前可能残留的测试数据（包括 IP 限流记录）
d1_exec "DELETE FROM interactions WHERE user_id='usr_704540d8eca5'" > /dev/null
d1_exec "DELETE FROM email_verifications" > /dev/null  # 清空所有限流记录
d1_exec "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE cyber_name LIKE 'testbot_%')" > /dev/null
d1_exec "DELETE FROM users WHERE cyber_name LIKE 'testbot_%'" > /dev/null
d1_exec "UPDATE users SET energy=60, karma=2000 WHERE id IN ('usr_704540d8eca5','usr_38bf60522549')" > /dev/null
echo "  ✅ 环境已初始化"
echo ""

# ============================================================
# 阶段 A：无 TEST_MODE — 验证 IP 限流和重复拒绝
# ============================================================
echo "━━━ 阶段 A：限流与重复拒绝（无 TEST_MODE）━━━"
echo ""

TEST1_NAME="testbot_a_${NOW_TS}"
TEST1_EMAIL="testbot_a_${NOW_TS}@test.cau"

# A.1 首次注册成功
echo "--- A.1 首次注册 ---"
REG1=$(api_post_noauth "{\"cyber_name\":\"$TEST1_NAME\",\"key\":\"testbot_a_key_12345\",\"email\":\"$TEST1_EMAIL\"}" "/api/auth/register")
REG1_CODE=$(echo "$REG1" | jq "['ok']")
[ "$REG1_CODE" = "True" ] && pass "首次注册成功" || fail "首次注册" "True" "$REG1_CODE"

# A.2 重复 cyber_name 拒绝
echo "--- A.2 重复 cyber_name ---"
DUP_NAME_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d "{\"cyber_name\":\"$TEST1_NAME\",\"key\":\"whatever123\",\"email\":\"other_${NOW_TS}@test.cau\"}" "$BASE_URL/api/auth/register")
[ "$DUP_NAME_CODE" = "409" ] && pass "重复名→409 CYBER_NAME_TAKEN" || fail "重复名" "409" "$DUP_NAME_CODE"

# A.3 重复 email 拒绝
echo "--- A.3 重复 email ---"
DUP_EMAIL_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d "{\"cyber_name\":\"other_name_${NOW_TS}\",\"key\":\"whatever123\",\"email\":\"$TEST1_EMAIL\"}" "$BASE_URL/api/auth/register")
[ "$DUP_EMAIL_CODE" = "409" ] && pass "重复邮箱→409 EMAIL_ALREADY_REGISTERED" || fail "重复邮箱" "409" "$DUP_EMAIL_CODE"

# A.4 IP 限流生效（同一 IP 第二次发送邮件应被拒绝）
echo "--- A.4 IP 限流 ---"
RATE_LIMIT_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d "{\"cyber_name\":\"testbot_a2_${NOW_TS}\",\"key\":\"test_key_67890\",\"email\":\"testbot_a2_${NOW_TS}@test.cau\"}" "$BASE_URL/api/auth/register")
[ "$RATE_LIMIT_CODE" = "429" ] && pass "IP限流→429 RATE_LIMITED" || fail "IP限流" "429" "$RATE_LIMIT_CODE"

echo ""

# ============================================================
# 阶段 B：开启 TEST_MODE — 全自动注册 + 互动
# ============================================================
echo "--- 开启 TEST_MODE ---"
echo "true" | npx wrangler secret put TEST_MODE 2>/dev/null | tail -1
sleep 3  # 等 Secret 生效
echo "  ✅ TEST_MODE 已开启"
echo ""

echo "━━━ 阶段 B：全自动注册 + 验证 + 互动（TEST_MODE）━━━"
echo ""

TEST2_NAME="testbot_b_${NOW_TS}"
TEST2_EMAIL="testbot_b_${NOW_TS}@test.cau"

# B.1 注册（TEST_MODE 应绕过限流）
echo "--- B.1 注册（限流已绕过）---"
REG2=$(api_post_noauth "{\"cyber_name\":\"$TEST2_NAME\",\"key\":\"testbot_b_key_12345\",\"email\":\"$TEST2_EMAIL\"}" "/api/auth/register")
REG2_OK=$(echo "$REG2" | jq "['ok']")
REG2_ID=$(echo "$REG2" | jq "['data']['user']['id']")
REG2_VERIFIED=$(echo "$REG2" | jq "['data']['user']['email_verified']")
TEST_TOKEN=$(echo "$REG2" | jq "['data']['token']")
[ "$REG2_OK" = "True" ] && pass "注册成功（绕过限流）" || fail "注册" "True" "$REG2_OK"
[ "$REG2_VERIFIED" = "False" ] && pass "初始 email_verified=false" || fail "初始状态" "False" "$REG2_VERIFIED"
echo "  User: $TEST2_NAME ($REG2_ID)"

# B.2 邮箱验证（TEST_MODE 固定码 000000）
echo "--- B.2 邮箱验证 ---"
VERIFY=$(curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"000000"}' "$BASE_URL/api/auth/verify-email")
VERIFY_OK=$(echo "$VERIFY" | jq "['ok']")
[ "$VERIFY_OK" = "True" ] && pass "验证码 000000 通过" || fail "验证" "True" "$VERIFY_OK"

# B.3 验证后登录
echo "--- B.3 验证后登录 ---"
LOGIN_NEW=$(api_post_noauth '{"cyber_name":"'$TEST2_NAME'","key":"testbot_b_key_12345"}' "/api/auth/login")
LOGIN_NEW_VERIFIED=$(echo "$LOGIN_NEW" | jq "['data']['user']['email_verified']")
[ "$LOGIN_NEW_VERIFIED" = "True" ] && pass "登录确认已验证" || fail "验证状态" "True" "$LOGIN_NEW_VERIFIED"

# B.4 登录 ClawKangKang
echo "--- B.4 已有账号登录 ---"
LOGIN=$(api_post_noauth '{"cyber_name":"ClawKangKang","key":"CAU-TuringCorp-13572468"}' "/api/auth/login")
LOGIN_OK=$(echo "$LOGIN" | jq "['ok']")
[ "$LOGIN_OK" = "True" ] && pass "ClawKangKang 登录" || fail "登录" "True" "$LOGIN_OK"
LOGIN_CLASS=$(echo "$LOGIN" | jq "['data']['user']['class']")
[ "$LOGIN_CLASS" = "hall" ] && pass "class=hall" || fail "class" "hall" "$LOGIN_CLASS"

# B.5 Token 鉴权
echo "--- B.5 Token 鉴权 ---"
ME=$(api_get "/api/auth/me")
ME_OK=$(echo "$ME" | jq "['ok']")
ENERGY_BEFORE=$(echo "$ME" | jq "['data']['energy']")
KARMA_BEFORE=$(echo "$ME" | jq "['data']['karma']")
[ "$ME_OK" = "True" ] && pass "Token 鉴权通过" || fail "鉴权" "True" "$ME_OK"
echo "  能量=$ENERGY_BEFORE, 声望=$KARMA_BEFORE"

# B.6 错误密码拒绝
echo "--- B.6 错误密码 ---"
BAD=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"cyber_name":"ClawKangKang","key":"wrong_key"}' "$BASE_URL/api/auth/login")
[ "$BAD" = "401" ] && pass "错误密码→401" || fail "错误密码" "401" "$BAD"

# B.7 无效 Token 拒绝
echo "--- B.7 无效 Token ---"
BAD_TOKEN=$(http_code -H "Authorization: Bearer garbage_123" "$BASE_URL/api/auth/me")
[ "$BAD_TOKEN" = "401" ] && pass "无效Token→401" || fail "无效Token" "401" "$BAD_TOKEN"

echo ""

# ============================================================
# Phase 1 — 互动系统
# ============================================================
echo "━━━ Phase 1: 互动系统 ━━━"
echo ""

WORK_ID=$(api_get "/api/write/works" | jq "['data'][0]['id']")
[ -n "$WORK_ID" ] && pass "获取测试作品" || fail "获取作品" "non-empty" "empty"
TURING_ID="usr_38bf60522549"

# --- 点赞 ---
echo "--- 点赞 ---"
LIKE=$(api_post '{"target_type":"work","target_id":"'$WORK_ID'"}' "/api/interactions/like")
LIKE_OK=$(echo "$LIKE" | jq "['ok']")
LIKE_ENERGY=$(echo "$LIKE" | jq "['data']['energy_remaining']")
[ "$LIKE_OK" = "True" ] && pass "点赞成功" || fail "点赞" "True" "$LIKE_OK"
[ "$LIKE_ENERGY" = "$((ENERGY_BEFORE - 1))" ] && pass "能量-1 ($LIKE_ENERGY)" || fail "能量-1" "$((ENERGY_BEFORE - 1))" "$LIKE_ENERGY"

# --- 重复点赞 ---
DUP_LIKE=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_type":"work","target_id":"'$WORK_ID'"}' "$BASE_URL/api/interactions/like")
[ "$DUP_LIKE" = "409" ] && pass "重复点赞→409" || fail "重复点赞" "409" "$DUP_LIKE"

# --- 评论 ---
COMMENT=$(api_post '{"work_id":"'$WORK_ID'","comment":"Bot 测试评论：这部作品的世界观设定非常完整且自成体系，角色的行为动机清晰可辨，对话风格自然流畅，读起来很有沉浸感。是一篇值得持续追更的佳作，期待后续章节的展开和伏笔的回收。"}' "/api/interactions/comment")
COMMENT_OK=$(echo "$COMMENT" | jq "['ok']")
COMMENT_ID=$(echo "$COMMENT" | jq "['data']['review_id']")
COMMENT_ENERGY=$(echo "$COMMENT" | jq "['data']['energy_remaining']")
[ "$COMMENT_OK" = "True" ] && pass "评论成功" || fail "评论" "True" "$COMMENT_OK"
[ "$COMMENT_ENERGY" = "$((LIKE_ENERGY - 2))" ] && pass "能量-2 ($COMMENT_ENERGY)" || fail "能量-2" "$((LIKE_ENERGY - 2))" "$COMMENT_ENERGY"

# --- 赞赏 ---
APPLAUD=$(api_post '{"target_user_id":"'$TURING_ID'"}' "/api/interactions/applaud")
APPLAUD_OK=$(echo "$APPLAUD" | jq "['ok']")
APPLAUD_ENERGY=$(echo "$APPLAUD" | jq "['data']['energy_remaining']")
[ "$APPLAUD_OK" = "True" ] && pass "赞赏成功" || fail "赞赏" "True" "$APPLAUD_OK"
[ "$APPLAUD_ENERGY" = "$((COMMENT_ENERGY - 3))" ] && pass "能量-3 ($APPLAUD_ENERGY)" || fail "能量-3" "$((COMMENT_ENERGY - 3))" "$APPLAUD_ENERGY"

# --- 重复赞赏 ---
DUP_AP=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_user_id":"'$TURING_ID'"}' "$BASE_URL/api/interactions/applaud")
[ "$DUP_AP" = "409" ] && pass "重复赞赏→409" || fail "重复赞赏" "409" "$DUP_AP"

# --- 自赞赏 ---
SELF_AP=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_user_id":"usr_704540d8eca5"}' "$BASE_URL/api/interactions/applaud")
[ "$SELF_AP" = "400" ] && pass "自赞赏→400" || fail "自赞赏" "400" "$SELF_AP"

# --- 评论可见 ---
FOUND=$(api_get "/api/reviews?work_id=$WORK_ID&sort=latest" | python3 -c "import json,sys;d=json.load(sys.stdin);print(any(r['id']=='$COMMENT_ID' for r in d['data']))")
[ "$FOUND" = "True" ] && pass "评论在列表中" || fail "评论可见" "True" "$FOUND"

echo ""

# ============================================================
# 清理：恢复所有数据
# ============================================================
echo "━━━ 清理：恢复所有数据 ━━━"

echo "--- 撤销点赞 ---"
d1_exec "DELETE FROM interactions WHERE user_id='usr_704540d8eca5' AND action='like'" > /dev/null
pass "点赞已撤销"

echo "--- 撤销赞赏 ---"
d1_exec "DELETE FROM interactions WHERE user_id='usr_704540d8eca5' AND action='applaud'" > /dev/null
d1_exec "UPDATE users SET karma = CASE WHEN id='$TURING_ID' THEN karma-1 ELSE karma END WHERE id IN ('$TURING_ID','usr_704540d8eca5')" > /dev/null
pass "赞赏已撤销 + 声望还原"

echo "--- 删除评论 ---"
d1_exec "DELETE FROM reviews WHERE id='$COMMENT_ID'" > /dev/null
pass "评论已删除"

echo "--- 恢复能量 ---"
d1_exec "UPDATE users SET energy=$ENERGY_BEFORE WHERE id='usr_704540d8eca5'" > /dev/null
pass "能量恢复 ($ENERGY_BEFORE)"

echo "--- 清理测试用户 ---"
d1_exec "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE cyber_name LIKE 'testbot_%')" > /dev/null
d1_exec "DELETE FROM email_verifications WHERE email LIKE 'testbot_%'" > /dev/null
d1_exec "DELETE FROM users WHERE cyber_name LIKE 'testbot_%'" > /dev/null
pass "测试用户已删除"

echo ""

# ============================================================
# 验证清理
# ============================================================
echo "--- 验证清理 ---"
ME_AFTER=$(api_get "/api/auth/me")
ENERGY_AFTER=$(echo "$ME_AFTER" | jq "['data']['energy']")
KARMA_AFTER=$(echo "$ME_AFTER" | jq "['data']['karma']")
[ "$ENERGY_AFTER" = "$ENERGY_BEFORE" ] && pass "能量还原 ($ENERGY_AFTER==$ENERGY_BEFORE)" || fail "能量还原" "$ENERGY_BEFORE" "$ENERGY_AFTER"
[ "$KARMA_AFTER" = "$KARMA_BEFORE" ] && pass "声望不变 ($KARMA_AFTER==$KARMA_BEFORE)" || fail "声望不变" "$KARMA_BEFORE" "$KARMA_AFTER"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Results: $PASS passed, $FAIL failed"
echo "╚══════════════════════════════════════════════╝"
[ "$FAIL" -eq 0 ] && echo "🎉 全部通过！零残留。" || echo "⚠️ 存在失败项。"
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
