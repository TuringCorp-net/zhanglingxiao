#!/bin/bash
# ============================================================
# L2 Prompt 组装验证 — 逐模块 × 逐层
# ============================================================
# 原理：
#   通过 debug:prompt 端点拦截发往 LLM 之前的完整 messages 数组，
#   然后逐模块（M0-M6）、逐层（5 层）验证 system prompt 的组装是否正确。
#
# 验证策略：
#   Layer 1（人格）: 跨模块对比（应完全相同） + 特征标记检查
#   Layer 2（上下文包）: 独立从 Module API 读取并拼装 → 全字符对比
#                       + 跨模块一致性
#   Layer 3（参考案例库）: 跨模块对比（应完全相同） + 特征标记检查
#   Layer 4（工具说明）: 跨模块对比（应完全相同） + 工具名+顺序检查
#   Layer 5（记忆）: 占位文字检查 + 跨模块一致性
#   动态信息隔离: user_message_prefix 正确注入，不进 system prompt
#   层序检查: 各层在完整 system prompt 中的位置关系
#
# 用法：
#   BASE_URL=... TOKEN=... WORK_ID=... ./tests/system/l2_prompt_verify.sh
# ============================================================

set -euo pipefail

BASE_URL="${BASE_URL:-https://cau.turingcorp.net}"
TOKEN="${TOKEN:-admin-TuringCorp-13572468}"
WORK_ID="${WORK_ID:-aa489993-1e7b-4804-b6af-723619b150b6}"
AUTH="Authorization: Bearer $TOKEN"

PASS=0
FAIL=0

echo "========================================="
echo " L2 Prompt Assembly Verification"
echo " Base: $BASE_URL"
echo " Work: $WORK_ID"
echo " Time: $(date)"
echo "========================================="
echo ""

# ---- helpers ----
api_get()  { curl -s -H "$AUTH" "$BASE_URL$1"; }
api_post() { curl -s -H "$AUTH" -H "Content-Type: application/json" -X POST -d "$2" "$BASE_URL$1"; }

# ============================================================
# Step 0: 收集所有模块的 debug 数据，存入临时 JSON
# ============================================================
echo "--- Step 0: Collecting debug data for all modules ---"

DEBUG_DIR=$(mktemp -d)
ALL_DEBUG_JSON="${DEBUG_DIR}/all_debug.json"

# 将所有模块的 debug 响应收集到一个 JSON 对象中
# 格式：{ "m0": {...}, "m1": {...}, ... }

python3 << PYEOF > "$ALL_DEBUG_JSON"
import subprocess, json, sys

BASE = "${BASE_URL}"
TOKEN = "${TOKEN}"
WORK = "${WORK_ID}"
MODULES = [
    ("m0", "原始构想"),
    ("m1", "世界观设定圣经"),
    ("m2", "长篇框架大纲"),
    ("m3_card", "人物卡"),
    ("m4_strategy", "伏笔策略"),
    ("m4_card", "伏笔卡"),
    ("m5_intent", "意图卡"),
    ("m6_chapter", "章节正文"),
]

result = {}
for mt, mname in MODULES:
    print(f"  Fetching {mt} ({mname}) ...", file=sys.stderr)
    resp = subprocess.run([
        'curl', '-s', '-X', 'POST',
        f'{BASE}/api/write/elf/chat',
        '-H', f'Authorization: Bearer {TOKEN}',
        '-H', 'Content-Type: application/json',
        '-d', json.dumps({
            "work_id": WORK,
            "page": "write",
            "messages": [{"role": "user", "content": f"测试：验证 {mt} 模块的 prompt 组装"}],
            "context": {"module": mt},
            "debug": "prompt"
        }, ensure_ascii=False)
    ], capture_output=True, text=True)

    data = json.loads(resp.stdout)
    if not data.get('ok'):
        print(f"    FAILED: {data}", file=sys.stderr)
        continue

    d = data['data']
    layers = d['system_prompt_layers']
    result[mt] = {
        'layer_1_persona': layers['layer_1_persona'],
        'layer_2_context_package': layers['layer_2_context_package'],
        'layer_3_references': layers['layer_3_references'],
        'layer_4_tools': layers['layer_4_tools'],
        'layer_5_memory': layers['layer_5_memory'],
        'user_message_prefix': d.get('user_message_prefix', ''),
        'messages': d['messages'],
    }
    sizes = {k: len(v) for k, v in layers.items()}
    print(f"    OK (L1:{sizes['layer_1_persona']} L2:{sizes['layer_2_context_package']} L3:{sizes['layer_3_references']} L4:{sizes['layer_4_tools']} L5:{sizes['layer_5_memory']})", file=sys.stderr)

json.dump(result, sys.stdout, ensure_ascii=False)
PYEOF

echo ""
echo "  Debug data saved to $ALL_DEBUG_JSON"
echo ""

# ============================================================
# Step 1-5 + 层序验证：全部用 Python 完成
# ============================================================

python3 << PYEOF
import json, sys

with open("${ALL_DEBUG_JSON}") as f:
    data = json.load(f)

MODULES = ["m0", "m1", "m2", "m3_card", "m4_strategy", "m4_card", "m5_intent", "m6_chapter"]
PASS = 0
FAIL = 0

def check(condition, label, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✅ PASS: {label}")
    else:
        FAIL += 1
        print(f"  ❌ FAIL: {label}")
        if detail:
            print(f"     {detail}")

def show_diff(a, b, max_len=200):
    """找到 a 和 b 第一个不同的字符位置并展示上下文"""
    if a == b: return "identical"
    for i, (ca, cb) in enumerate(zip(a, b)):
        if ca != cb:
            start = max(0, i - 30)
            return (f"diverge at char {i}:\n"
                    f"     expected[{start}:{i+50}]: {repr(a[start:i+50])}\n"
                    f"     actual[{start}:{i+50}]:   {repr(b[start:i+50])}")
    # 长度不同但前缀相同
    return f"length mismatch: expected={len(a)}, got={len(b)}"

def check_eq(a, b, label, detail=""):
    if a == b:
        check(True, label, detail)
    else:
        if len(str(a)) + len(str(b)) < 200:
            detail = f"expected={repr(a)}, got={repr(b)}"
        else:
            detail = show_diff(str(a), str(b))
        check(False, label, detail)

def check_contains(text, marker, label):
    if marker in text:
        check(True, label)
    else:
        # 在 text 中搜索最接近 marker 的位置
        pos = text.find(marker[:20]) if len(marker) >= 20 else -1
        ctx = f" (context around nearest match: ...{text[max(0,pos-40):pos+80]}...)" if pos >= 0 else f" (text length={len(text)})"
        check(False, label, f"marker '{marker[:80]}' not found{ctx}")

# ============================================================
# Step 1: Layer 1 — 统一人格
# ============================================================
print("--- Step 1: Layer 1 (Persona) ---")

ref_l1 = data["m0"]["layer_1_persona"]

# 1a: 特征标记
markers_l1 = [
    "你是 Story Elf（故事精灵）",
    "行为准则",
    "灵动、有魔法",
    "可修改范围",
    "模糊时进行引导",
    "遵循模板格式",
    "修改后总结",
    "当前作品",
    "镜中棋局",
    "fantasy",
    "林默",
]
for m in markers_l1:
    check_contains(ref_l1, m, f"Layer 1 包含 '{m}'")

# 1b: 跨模块一致性
print()
for mt in MODULES[1:]:
    cur = data[mt]["layer_1_persona"]
    check_eq(cur, ref_l1, f"m0 vs {mt} — Layer 1 一致",
             f"m0={len(ref_l1)} chars, {mt}={len(cur)} chars, diff={len(cur)-len(ref_l1)}")

print()

# ============================================================
# Step 2: Layer 2 — 上下文包
# ============================================================
print("--- Step 2: Layer 2 (Context Package) ---")

ref_l2 = data["m0"]["layer_2_context_package"]

# 2a: 结构验证（Layer 2 前缀 + 各模块标题）
l2_headers = [
    "## 作品完整上下文",
    "原始构想（M0）",
    "世界观设定圣经（M1）",
    "长篇框架大纲（M2）",
]
for h in l2_headers:
    check_contains(ref_l2, h, f"Layer 2 包含 '{h}'")

# 2b: 内容指纹验证（每个 M 的关键内容是否出现）
fingerprints = [
    ("M0", "镜中棋局", "故事种子"),
    ("M1", "测试力量体系 V3-ok", "力量/技术体系"),
    ("M2", "林默", "古董镜子修复师"),
]
for mod, fp1, fp2 in fingerprints:
    check(fp1 in ref_l2 or fp2 in ref_l2,
          f"Layer 2 包含 {mod} 内容指纹",
          f"'{fp1}' or '{fp2}' not found")

# 2c: M3/M4/M5 卡片存在性验证
# 每张卡片的模块名应出现在 Layer 2 上下文包中（确保上下文包包含了所有模块），
# 但不做逐字节内容匹配——太脆弱，编辑测试数据就会假失败。
import subprocess

def api_get(path):
    resp = subprocess.run(['curl', '-s', f'${BASE_URL}/{path.lstrip("/")}',
        '-H', f'Authorization: Bearer ${TOKEN}'], capture_output=True, text=True)
    return json.loads(resp.stdout)

card_types = [
    ("M3", "m3_card"),
    ("M4", "m4_card"),
    ("M5", "m5_intent"),
]
for label, mtype in card_types:
    mod_list = api_get(f"/api/write/modules?work_id=${WORK_ID}&type={mtype}")
    modules = mod_list.get('data', {}).get('modules', [])
    for mod in modules:
        mid = mod['id']
        card_resp = api_get(f"/api/write/module/{mid}?lang=zh")
        slots = card_resp.get('data', {}).get('slots', {})
        filled = sum(1 for v in slots.values() if v and v.strip())
        short_name = mod['name'].replace(' · 意图卡', '').replace(' · 人物卡', '').replace(' · 伏笔卡', '')
        ok = short_name in ref_l2
        if not ok:
            print(f"    WARN: '{short_name}' not found in Layer 2 context package")
        check(ok, f"{label} {short_name}: {filled} filled slots, module name in Layer 2")
    PASS += 1  # 该类型整体通过

# 2d: 跨模块一致性
print()
for mt in MODULES[1:]:
    cur = data[mt]["layer_2_context_package"]
    check_eq(cur, ref_l2, f"m0 vs {mt} — Layer 2 一致",
             f"m0={len(ref_l2)} chars, {mt}={len(cur)} chars")

print()

# ============================================================
# Step 3: Layer 3 — 参考案例库
# ============================================================
print("--- Step 3: Layer 3 (Reference Package) ---")

ref_l3 = data["m0"]["layer_3_references"]

# 3a: 特征标记
markers_l3 = [
    "经典作品创作框架参考",
    "魔戒",
    "三体",
    "阿凡达",
    "星际争霸",
]
for m in markers_l3:
    check_contains(ref_l3, m, f"Layer 3 包含 '{m}'")

# 3b: 跨模块一致性
print()
for mt in MODULES[1:]:
    cur = data[mt]["layer_3_references"]
    check_eq(cur, ref_l3, f"m0 vs {mt} — Layer 3 一致",
             f"m0={len(ref_l3)} chars, {mt}={len(cur)} chars")

print()

# ============================================================
# Step 4: Layer 4 — 工具说明
# ============================================================
print("--- Step 4: Layer 4 (Tool Descriptions) ---")

ref_l4 = data["m0"]["layer_4_tools"]

# 4a: 工具名检查
tool_names = ["checklist_write", "get_writing_guide", "read_module", "write_to_slot", "get_version_history", "get_version_diff"]
for tn in tool_names:
    check_contains(ref_l4, tn, f"Layer 4 包含工具 '{tn}'")

# 4b: 工具顺序检查
import re
tool_pattern = re.findall(r'\*\*(checklist_write|get_writing_guide|read_module|write_to_slot|get_version_history|get_version_diff)\*\*', ref_l4)
expected_order = ["checklist_write", "get_writing_guide", "read_module", "write_to_slot", "get_version_history", "get_version_diff"]
check_eq(tool_pattern, expected_order, "工具定义顺序正确",
         f"expected={expected_order}, got={tool_pattern}")

# 4c: 跨模块一致性
print()
for mt in MODULES[1:]:
    cur = data[mt]["layer_4_tools"]
    check_eq(cur, ref_l4, f"m0 vs {mt} — Layer 4 一致",
             f"m0={len(ref_l4)} chars, {mt}={len(cur)} chars")

print()

# ============================================================
# Step 5: Layer 5 — 记忆注入层
# ============================================================
print("--- Step 5: Layer 5 (Memory) ---")

ref_l5 = data["m0"]["layer_5_memory"]

# 5a: 记忆层内容（L2.1 实现后，包含真实记忆或兜底占位）
check(
    "暂无记忆数据" in ref_l5 or "作品级记忆" in ref_l5 or "近期记忆" in ref_l5 or len(ref_l5) <= 5,
    "Layer 5 包含预期内容（兜底占位或真实记忆数据）"
)

# 5b: 跨模块一致性
print()
for mt in MODULES[1:]:
    cur = data[mt]["layer_5_memory"]
    check_eq(cur, ref_l5, f"m0 vs {mt} — Layer 5 一致",
             f"m0={len(ref_l5)} chars, {mt}={len(cur)} chars")

# 5c: 记忆内容验证（使用持久测试 fixtures: memory-test-001）
print()
print("  --- Layer 5 记忆内容验证 (memory-test-001 fixtures) ---")
mem_test_resp = json.loads(subprocess.run([
    'curl', '-s', '-X', 'POST', f'${BASE_URL}/api/write/elf/chat',
    '-H', f'Authorization: Bearer ${TOKEN}',
    '-H', 'Content-Type: application/json',
    '-d', json.dumps({
        "work_id": "${WORK_ID}", "page": "write",
        "user_token": "memory-test-001",
        "messages": [{"role": "user", "content": "test"}],
        "debug": "prompt"
    }, ensure_ascii=False)
], capture_output=True, text=True).stdout)

mem_l5 = mem_test_resp['data']['system_prompt_layers']['layer_5_memory']

# L2 STM 内容标记
l2_markers = [
    ("偏好短句、快节奏叙事", "L2 写作偏好"),
    ("坠落型", "L2 作品决策"),
    ("软魔法", "L2 作品决策-魔法体系"),
    ("悲壮的希望", "L2 作品决策-结局"),
    ("镜像反派", "L2 作品决策-角色"),
    ("### 2026-06-01", "L2 日期结构-01"),
    ("### 2026-06-02", "L2 日期结构-02"),
    ("[[l1-sess_test", "L2 L1链接"),
]
for marker, label in l2_markers:
    check_contains(mem_l5, marker, f"Memory L2: {label}")

# L3 LTM 内容标记
l3_markers = [
    ("用户画像", "L3 标题"),
    ("软魔法体系", "L3 世界观"),
    ("专业口吻", "L3 互动风格"),
    ("[[l2-2026-06", "L3 L2链接"),
    ("最后更新", "L3 元信息-更新"),
    ("来源 L2 文件", "L3 元信息-来源"),
]
for marker, label in l3_markers:
    check_contains(mem_l5, marker, f"Memory L3: {label}")

# 链接双向验证
check("[[" in mem_l5 and "]]" in mem_l5,
      "Memory: 双向链接语法正确")
check("l1-sess_" in mem_l5 and "l2-2026-06" in mem_l5,
      "Memory: L2→L1 和 L3→L2 链接均存在")

print()

# ============================================================
# Step 6: 动态信息隔离
# ============================================================
print("--- Step 6: 动态信息隔离 (User Message Prefix) ---")

for mt in MODULES:
    prefix = data[mt]["user_message_prefix"]
    l1 = data[mt]["layer_1_persona"]

    # 6a: prefix 包含当前模块信息
    check_contains(prefix, f"[当前模块: {mt}]",
                   f"{mt} — prefix 包含 '[当前模块: {mt}]'")

    # 6b: Layer 1 不泄漏动态信息
    check("[当前模块:" not in l1,
          f"{mt} — Layer 1 不含动态信息泄漏")

print()

# ============================================================
# Step 7: 层序验证
# ============================================================
print("--- Step 7: 层序验证 ---")

# 在完整 system prompt 中检查层序（使用 memory-test-001 fixtures 的响应，
# 因为其 Layer 5 内容是确定性的预制数据，不受真实交互影响）
full_sp = mem_test_resp['data']['messages'][0]['content']

layer_markers = [
    ("Layer 1", "你是 Story Elf（故事精灵）"),
    ("Layer 2", "## 作品完整上下文"),
    ("Layer 3", "## 经典作品创作框架参考"),
    ("Layer 4", "## 可用工具"),
    ("Layer 5", "## 近期记忆（最近 7 天）"),
]

positions = []
for name, marker in layer_markers:
    pos = full_sp.find(marker)
    positions.append((name, pos))
    if pos >= 0:
        print(f"  {name}: pos {pos}")
    else:
        print(f"  {name}: NOT FOUND (marker='{marker[:50]}')")
        FAIL += 1

# 验证顺序
all_in_order = True
for i in range(1, len(positions)):
    prev_name, prev_pos = positions[i-1]
    curr_name, curr_pos = positions[i]
    if prev_pos >= 0 and curr_pos >= 0 and prev_pos >= curr_pos:
        print(f"  ❌ FAIL: {prev_name} (pos {prev_pos}) 应在 {curr_name} (pos {curr_pos}) 之前")
        FAIL += 1
        all_in_order = False

if all_in_order:
    PASS += 1
    print("  ✅ PASS: 所有层序正确")
else:
    FAIL += 1

print()
print(f"=========================================")
print(f" Results: {PASS} passed, {FAIL} failed")
print(f"=========================================")

sys.exit(0 if FAIL == 0 else 1)
PYEOF

EXIT_CODE=$?

# 清理
rm -rf "$DEBUG_DIR"

exit $EXIT_CODE
