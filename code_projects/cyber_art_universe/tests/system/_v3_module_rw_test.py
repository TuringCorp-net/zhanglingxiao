#!/usr/bin/env python3
"""
V3 Module API — 读 → 改 → 写 → 验证 → 恢复（零残留）
仿照外部 Agent 调用 API 的流程：读内容 → 追加密标 → 写回 → 读回验证 → 恢复原文

用法: python3 _v3_module_rw_test.py <base_url> <token> <work_id>
"""
import json, subprocess, sys, os, tempfile, shutil

BASE = sys.argv[1]
AUTH = f"Bearer {sys.argv[2]}"
WORK_ID = sys.argv[3]
MARKER = f"[API test OK] (run {subprocess.run(['date','+%s'], capture_output=True, text=True).stdout.strip()})"

def api_get(path):
    r = subprocess.run(["curl", "-s", "-H", f"Authorization: {AUTH}", f"{BASE}{path}"],
                       capture_output=True, text=True)
    return json.loads(r.stdout)

def api_put(path, body_obj):
    body = json.dumps(body_obj, ensure_ascii=False)
    r = subprocess.run(["curl", "-s", "-H", f"Authorization: {AUTH}",
                        "-H", "Content-Type: application/json; charset=utf-8",
                        "-X", "PUT", "-d", body, f"{BASE}{path}"],
                       capture_output=True, text=True)
    return json.loads(r.stdout)

passed = 0
failed = 0
def check(ok, desc, detail=""):
    global passed, failed
    if ok: passed += 1; print(f"  PASS: {desc}")
    else: failed += 1; print(f"  FAIL: {desc}")
    if detail: print(f"       {detail}")

# 自动发现需要测试的模块 ID
def find_module_ids():
    ids = []
    # 单例模块
    for label, mid in [("M0", f"m0_{WORK_ID}"), ("M1", f"m1_{WORK_ID}"),
                        ("M2", f"m2_{WORK_ID}")]:
        ids.append((label, mid))
    # 卡片型模块取第一个
    for label, mtype in [("M3_card", "m3_card"), ("M4_card", "m4_card"), ("M5_intent", "m5_intent")]:
        r = api_get(f"/api/write/modules?work_id={WORK_ID}&type={mtype}")
        modules = r.get("data", {}).get("modules", [])
        if modules:
            ids.append((label, modules[0]["id"]))
    return ids

snapshot_dir = tempfile.mkdtemp()
modules = find_module_ids()

# ---- Step 4: 写入 + 验证 ----
print("--- Step 4: PUT free_content → GET verify (closed loop) ---")
for label, mid in modules:
    # ① 读取当前状态
    before = api_get(f"/api/write/module/{mid}?lang=zh")["data"]

    # ② 保存完整快照
    snapshot = {"slots": before.get("slots", {}), "free_content": before.get("free_content", "")}
    with open(f"{snapshot_dir}/{mid}.json", "w") as f:
        json.dump(snapshot, f, ensure_ascii=False)

    # ③ 追加密标并写回
    new_fc = (before.get("free_content", "") + "\n\n" + MARKER).strip()
    put_ok = api_put(f"/api/write/module/{mid}?lang=zh", {"free_content": new_fc})
    check(put_ok.get("ok") == True, f"{label} PUT ok",
          f"response: {json.dumps(put_ok)[:200]}")

    # ④ 读回验证
    after = api_get(f"/api/write/module/{mid}?lang=zh")["data"]
    after_fc = after.get("free_content", "")
    check(MARKER in after_fc, f"{label} marker persisted",
          f"marker not found in free_content (len={len(after_fc)})")
    slots_before = json.dumps(before.get("slots", {}), sort_keys=True)
    slots_after = json.dumps(after.get("slots", {}), sort_keys=True)
    check(slots_before == slots_after, f"{label} slots preserved",
          f"slots changed: before has {len(slots_before)} chars, after has {len(slots_after)} chars")

# ---- Step 5: 恢复 ----
print()
print("--- Step 5: Cleanup — restore original data ---")
for label, mid in modules:
    with open(f"{snapshot_dir}/{mid}.json") as f:
        snapshot = json.load(f)

    # ⑤ 写回原始数据
    restore_ok = api_put(f"/api/write/module/{mid}?lang=zh", snapshot)
    check(restore_ok.get("ok") == True, f"{label} cleanup PUT ok",
          f"response: {json.dumps(restore_ok)[:200]}")

    # ⑥ 验证恢复
    verify = api_get(f"/api/write/module/{mid}?lang=zh")["data"]
    verify_fc = verify.get("free_content", "")
    check(MARKER not in verify_fc, f"{label} marker removed",
          f"marker still present in free_content")
    verify_slots = json.dumps(verify.get("slots", {}), sort_keys=True)
    orig_slots = json.dumps(snapshot["slots"], sort_keys=True)
    check(verify_slots == orig_slots, f"{label} slots fully restored",
          f"slots differ after restore (verify={len(verify_slots)} chars, orig={len(orig_slots)} chars)")

shutil.rmtree(snapshot_dir, ignore_errors=True)
print(f"\n  Module RW: {passed} passed, {failed} failed")
sys.exit(1 if failed > 0 else 0)
