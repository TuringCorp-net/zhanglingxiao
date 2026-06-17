#!/bin/bash
# ============================================================
# 用户账户与互动系统 — 集成测试 v2（零残留，connect API）
# ============================================================
set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="CAU-TuringCorp-13572468"
AUTH="Authorization: Bearer $TOKEN"
PASS=0; FAIL=0
NOW_TS=$(date +%s)

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

# 确保退出时关闭 TEST_MODE
cleanup_test_mode() {
  echo ""; echo "--- 关闭 TEST_MODE ---"
  echo "yes" | npx wrangler secret delete TEST_MODE 2>/dev/null || true
  echo "  TEST_MODE 已关闭"
}
trap cleanup_test_mode EXIT

echo "╔══════════════════════════════════════════════╗"
echo "║  User Auth & Interaction v2 — connect API   ║"
echo "║  Base: $BASE_URL"
echo "╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
# 前置
# ============================================================
echo "--- 前置：初始化 ---"
echo "yes" | npx wrangler secret delete TEST_MODE 2>/dev/null || true
sleep 3
d1_exec "DELETE FROM interactions WHERE user_id='usr_704540d8eca5'" > /dev/null
d1_exec "DELETE FROM email_verifications" > /dev/null
d1_exec "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE cyber_name LIKE 'testbot_%')" > /dev/null
d1_exec "DELETE FROM users WHERE cyber_name LIKE 'testbot_%'" > /dev/null
d1_exec "UPDATE users SET energy=60, karma=2000 WHERE id IN ('usr_704540d8eca5','usr_38bf60522549')" > /dev/null
echo "  ✅ 环境已初始化"
echo ""

# ============================================================
# 阶段 A：无 TEST_MODE — 验证 IP 限流 + 错误密钥
# ============================================================
echo "━━━ 阶段 A：限流与错误密钥（无 TEST_MODE）━━━"
echo ""

TEST1_EMAIL="testbot_a_${NOW_TS}@test.cau"

# A.1 connect — 新用户（无 confirm）→ new_account
echo "--- A.1 connect 新用户 ---"
C1=$(api_post_noauth "{\"email\":\"$TEST1_EMAIL\",\"key\":\"testkey_12345\"}" "/api/auth/connect")
C1_ACTION=$(echo "$C1" | jq "['data']['action']")
[ "$C1_ACTION" = "new_account" ] && pass "new_account → suggested" || fail "new_account" "new_account" "$C1_ACTION"
C1_NAME=$(echo "$C1" | jq "['data']['suggested_cyber_name']")
[ "$C1_NAME" = "$TEST1_EMAIL" ] && pass "cyber_name=email" || fail "cyber_name" "$TEST1_EMAIL" "$C1_NAME"

# A.2 connect — 确认创建（confirm:true）
echo "--- A.2 connect confirm ---"
C2=$(api_post_noauth "{\"email\":\"$TEST1_EMAIL\",\"key\":\"testkey_12345\",\"confirm\":true}" "/api/auth/connect")
C2_ACTION=$(echo "$C2" | jq "['data']['action']")
[ "$C2_ACTION" = "registered" ] && pass "registered 成功" || fail "registered" "registered" "$C2_ACTION"

# A.3 登录（已存在 + 正确密码）
echo "--- A.3 登录 ---"
C3=$(api_post_noauth "{\"email\":\"$TEST1_EMAIL\",\"key\":\"testkey_12345\"}" "/api/auth/connect")
C3_ACTION=$(echo "$C3" | jq "['data']['action']")
[ "$C3_ACTION" = "login" ] && pass "login 成功" || fail "login" "login" "$C3_ACTION"

# A.4 错误密码
echo "--- A.4 错误密码 ---"
C4_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST1_EMAIL\",\"key\":\"wrong_key_123\"}" "$BASE_URL/api/auth/connect")
C4=$(curl -s -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST1_EMAIL\",\"key\":\"wrong_key_123\"}" "$BASE_URL/api/auth/connect")
C4_ACTION=$(echo "$C4" | jq "['data']['action']")
[ "$C4_CODE" = "401" ] && pass "错误密码→401" || fail "错误密码" "401" "$C4_CODE"
[ "$C4_ACTION" = "wrong_key" ] && pass "action=wrong_key" || fail "action" "wrong_key" "$C4_ACTION"

# A.5 IP 限流（同一 IP 再次 confirm 应被拒绝）
echo "--- A.5 IP 限流 ---"
TEST2_EMAIL="testbot_a2_${NOW_TS}@test.cau"
RATE_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST2_EMAIL\",\"key\":\"testkey_67890\",\"confirm\":true}" "$BASE_URL/api/auth/connect")
[ "$RATE_CODE" = "429" ] && pass "IP限流→429" || fail "IP限流" "429" "$RATE_CODE"

echo ""

# ============================================================
# 阶段 B：开启 TEST_MODE — 全自动注册 + 验证 + 互动
# ============================================================
echo "--- 开启 TEST_MODE ---"
echo "true" | npx wrangler secret put TEST_MODE 2>/dev/null | tail -1
sleep 3
echo "  ✅ TEST_MODE 已开启"
echo ""

echo "━━━ 阶段 B：全自动注册 + 验证 + 互动（TEST_MODE）━━━"
echo ""

TEST2_EMAIL="testbot_b_${NOW_TS}@test.cau"

# B.1 注册（限流已绕过）
echo "--- B.1 注册 ---"
REG=$(api_post_noauth "{\"email\":\"$TEST2_EMAIL\",\"key\":\"testbot_b_key_12345\",\"confirm\":true}" "/api/auth/connect")
REG_OK=$(echo "$REG" | jq "['ok']")
REG_ID=$(echo "$REG" | jq "['data']['user']['id']")
REG_VERIFIED=$(echo "$REG" | jq "['data']['user']['email_verified']")
TEST_TOKEN=$(echo "$REG" | jq "['data']['token']")
[ "$REG_OK" = "True" ] && pass "注册成功（绕过限流）" || fail "注册" "True" "$REG_OK"
[ "$REG_VERIFIED" = "False" ] && pass "email_verified=false" || fail "verified" "False" "$REG_VERIFIED"
echo "  User: $TEST2_EMAIL ($REG_ID)"

# B.2 验证邮箱（TEST_MODE 固定码 000000）
echo "--- B.2 邮箱验证 ---"
VERIFY=$(curl -s -X POST -H "Authorization: Bearer $TEST_TOKEN" -H "Content-Type: application/json" \
  -d '{"code":"000000"}' "$BASE_URL/api/auth/verify-email")
VERIFY_OK=$(echo "$VERIFY" | jq "['ok']")
[ "$VERIFY_OK" = "True" ] && pass "验证码 000000 通过" || fail "验证" "True" "$VERIFY_OK"

# B.3 验证后登录
echo "--- B.3 验证后登录 ---"
LOGIN_NEW=$(api_post_noauth '{"email":"'$TEST2_EMAIL'","key":"testbot_b_key_12345"}' "/api/auth/connect")
LOGIN_NEW_VERIFIED=$(echo "$LOGIN_NEW" | jq "['data']['user']['email_verified']")
[ "$LOGIN_NEW_VERIFIED" = "True" ] && pass "登录确认已验证" || fail "验证状态" "True" "$LOGIN_NEW_VERIFIED"

# B.4 管理员登录
echo "--- B.4 管理员登录 ---"
ADMIN_LOGIN=$(api_post_noauth '{"email":"ai@turingcorp.net","key":"CAU-TuringCorp-13572468"}' "/api/auth/connect")
ADMIN_OK=$(echo "$ADMIN_LOGIN" | jq "['ok']")
ADMIN_CLASS=$(echo "$ADMIN_LOGIN" | jq "['data']['user']['class']")
[ "$ADMIN_OK" = "True" ] && pass "ClawKangKang 登录" || fail "登录" "True" "$ADMIN_OK"
[ "$ADMIN_CLASS" = "hall" ] && pass "class=hall" || fail "class" "hall" "$ADMIN_CLASS"

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
BAD_CODE=$(http_code -X POST -H "Content-Type: application/json" \
  -d '{"email":"ai@turingcorp.net","key":"wrong_key"}' "$BASE_URL/api/auth/connect")
[ "$BAD_CODE" = "401" ] && pass "错误密码→401" || fail "错误密码" "401" "$BAD_CODE"

# B.7 无效 Token
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

# 点赞
LIKE=$(api_post '{"target_type":"work","target_id":"'$WORK_ID'"}' "/api/interactions/like")
LIKE_OK=$(echo "$LIKE" | jq "['ok']")
LIKE_ENERGY=$(echo "$LIKE" | jq "['data']['energy_remaining']")
[ "$LIKE_OK" = "True" ] && pass "点赞成功" || fail "点赞" "True" "$LIKE_OK"
[ "$LIKE_ENERGY" = "$((ENERGY_BEFORE - 1))" ] && pass "能量-1 ($LIKE_ENERGY)" || fail "能量-1" "$((ENERGY_BEFORE - 1))" "$LIKE_ENERGY"

DUP_LIKE=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_type":"work","target_id":"'$WORK_ID'"}' "$BASE_URL/api/interactions/like")
[ "$DUP_LIKE" = "409" ] && pass "重复点赞→409" || fail "重复点赞" "409" "$DUP_LIKE"

# 评论
COMMENT=$(api_post '{"work_id":"'$WORK_ID'","comment":"Bot test: 这部作品的世界观设定非常完整且自成体系，角色的行为动机清晰可辨，对话风格自然流畅，读起来很有沉浸感。值得追更。"}' "/api/interactions/comment")
COMMENT_OK=$(echo "$COMMENT" | jq "['ok']")
COMMENT_ID=$(echo "$COMMENT" | jq "['data']['review_id']")
COMMENT_ENERGY=$(echo "$COMMENT" | jq "['data']['energy_remaining']")
[ "$COMMENT_OK" = "True" ] && pass "评论成功" || fail "评论" "True" "$COMMENT_OK"
[ "$COMMENT_ENERGY" = "$((LIKE_ENERGY - 2))" ] && pass "能量-2 ($COMMENT_ENERGY)" || fail "能量-2" "$((LIKE_ENERGY - 2))" "$COMMENT_ENERGY"

# 赞赏
APPLAUD=$(api_post '{"target_user_id":"'$TURING_ID'"}' "/api/interactions/applaud")
APPLAUD_OK=$(echo "$APPLAUD" | jq "['ok']")
APPLAUD_ENERGY=$(echo "$APPLAUD" | jq "['data']['energy_remaining']")
[ "$APPLAUD_OK" = "True" ] && pass "赞赏成功" || fail "赞赏" "True" "$APPLAUD_OK"
[ "$APPLAUD_ENERGY" = "$((COMMENT_ENERGY - 3))" ] && pass "能量-3 ($APPLAUD_ENERGY)" || fail "能量-3" "$((COMMENT_ENERGY - 3))" "$APPLAUD_ENERGY"

DUP_AP=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_user_id":"'$TURING_ID'"}' "$BASE_URL/api/interactions/applaud")
[ "$DUP_AP" = "409" ] && pass "重复赞赏→409" || fail "重复赞赏" "409" "$DUP_AP"

SELF_AP=$(http_code -X POST -H "$AUTH" -H "Content-Type: application/json" \
  -d '{"target_user_id":"usr_704540d8eca5"}' "$BASE_URL/api/interactions/applaud")
[ "$SELF_AP" = "400" ] && pass "自赞赏→400" || fail "自赞赏" "400" "$SELF_AP"

FOUND=$(api_get "/api/reviews?work_id=$WORK_ID&sort=latest" | python3 -c "import json,sys;d=json.load(sys.stdin);print(any(r['id']=='$COMMENT_ID' for r in d['data']))")
[ "$FOUND" = "True" ] && pass "评论在列表中" || fail "评论可见" "True" "$FOUND"

echo ""

# ============================================================
# 清理
# ============================================================
echo "━━━ 清理：恢复所有数据 ━━━"
d1_exec "DELETE FROM interactions WHERE user_id='usr_704540d8eca5'" > /dev/null && pass "点赞/赞赏已撤销"
d1_exec "UPDATE users SET karma = CASE WHEN id='$TURING_ID' THEN karma-1 ELSE karma END WHERE id IN ('$TURING_ID','usr_704540d8eca5')" > /dev/null
d1_exec "DELETE FROM reviews WHERE id='$COMMENT_ID'" > /dev/null && pass "评论已删除"
d1_exec "UPDATE users SET energy=$ENERGY_BEFORE WHERE id='usr_704540d8eca5'" > /dev/null && pass "能量恢复 ($ENERGY_BEFORE)"
d1_exec "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE 'testbot_%' OR email LIKE '%@test.cau')" > /dev/null
d1_exec "DELETE FROM email_verifications WHERE email LIKE 'testbot_%' OR email LIKE '%@test.cau'" > /dev/null
d1_exec "DELETE FROM users WHERE email LIKE 'testbot_%' OR email LIKE '%@test.cau'" > /dev/null && pass "测试用户已删除"

echo ""

# 验证清理
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
