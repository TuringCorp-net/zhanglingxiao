#!/usr/bin/env python3
"""
运营总监 (Operator) — 商品上架脚本 v3
读取 pass/{date}/ 中已通过审核的商品 MD 文件，通过 Findora API 上架到数据库。
同时维护标签体系。
"""

import os, json, re, sys
import requests

BASE_URL = "https://findora.turingcorp.net"
ADMIN_KEY = "Findora-TuringCorp-13572468"
SESSION = requests.Session()
SESSION.headers.update({
    "X-Admin-Key": ADMIN_KEY,
    "Content-Type": "application/json",
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (compatible; FindoraOperator/1.0)",
})

PLATFORM_MAP = {"Temu":"temu","速卖通":"aliexpress","Amazon":"amazon","Shein":"shein","TikTok":"tiktok"}
CATEGORY_MAP = {"汽车用品":"automotive","摩托车装备配件":"motorcycle","健康与家居":"home-garden","办公和学校用品":"stationery","Womenswear & Underwear":"womenswear"}

DIMENSION_TO_LAYER = {
    "场景定位":"audience","功能亮点":"function","使用体验":"function","便捷充电":"function",
    "人群痛点":"audience","省钱场景":"audience","趣味痛点":"emotion","材质耐用":"feature",
    "出行场景":"audience","形态特点":"feature","价格锚点":"price","社交证明":"audience",
    "行动号召":"emotion","核心概念":"emotion","使用场景":"audience","功能定位":"function",
    "人体工学":"feature","价值主张":"emotion","设计亮点":"feature","人群共鸣":"audience",
    "便捷体验":"function","价格震撼":"price","趣味功能":"emotion","设计特点":"feature",
    "人群场景":"audience","多场景覆盖":"audience","安心卖点":"emotion","类比联想":"emotion",
    "持有场景":"audience","产品细节":"feature","痛点共鸣":"emotion","人群定位":"audience",
    "功能卖点":"function","适配性":"feature","品牌信任":"audience","设计哲学":"style",
    "具体问题":"function","安全感":"emotion","场景延伸":"audience","情感核心":"emotion",
    "舒适+功能":"function","技术卖点":"feature","价格亮点":"price","功能+趣味":"emotion",
    "趣味情绪":"emotion","送礼场景":"audience","社交价值":"emotion","情感共鸣":"emotion",
    "渠道来源":"audience","性能卖点":"function","智能便捷":"function","功能细节":"feature",
    "痛点击破":"emotion","参数亮点":"feature","安全场景":"audience","充电方式":"function",
    "精准卖点":"function","痛点定位":"emotion","使用频率":"function","技术亮点":"feature",
    "安全认证":"audience","洞察共鸣":"emotion","健康场景":"audience","操作简单":"function",
    "平台背书":"audience","时间信任":"audience","时尚态度":"style","舒适+版型":"feature",
    "风格定位":"style","搭配建议":"audience","场景弹性":"audience","使用时机":"audience",
    "季节场景":"audience","复购信号":"emotion","差异化亮点":"feature",
}

PASS_FILES = [
    "2026-05-05-001.md",
    "2026-05-05-004.md",
    "2026-05-05-006.md",
    "2026-05-05-007.md",
    "2026-05-05-008.md",
]

def api(method, path, data=None):
    """调用 Findora API"""
    url = f"{BASE_URL}{path}"
    try:
        if method == "GET":
            r = SESSION.get(url, timeout=30)
        elif method == "POST":
            r = SESSION.post(url, json=data, timeout=30)
        elif method == "PATCH":
            r = SESSION.patch(url, json=data, timeout=30)
        elif method == "PUT":
            r = SESSION.put(url, json=data, timeout=30)
        else:
            r = SESSION.request(method, url, json=data, timeout=30)
        return r.json()
    except Exception as e:
        return {"ok": False, "error": {"message": str(e)}}


def read_md(filename):
    with open(f"operations/pass/26-05-05/{filename}", "r", encoding="utf-8") as f:
        return f.read()


def extract_field(md, name):
    m = re.search(rf"\|\s*\*\*{re.escape(name)}\*\*\s*\|\s*(.+?)\s*\|", md)
    return m.group(1).strip() if m else ""


def extract_summary(md):
    m = re.search(r"### 宣传短文\n\n(.*?)(?=\n---\n\n### 特征标签)", md, re.DOTALL)
    return m.group(1).strip() if m else ""


def extract_tags(md):
    tags = []
    for m in re.finditer(r"\|\s*(#[\w]+)\s*\|\s*(.+?)\s*\|", md):
        tag, dim = m.group(1), m.group(2)
        if tag not in ("#标签",):
            tags.append((tag, dim))
    return tags


def parse_price(s):
    nums = re.findall(r"[\d.]+", s)
    if not nums: return None, None
    ns = [float(x) for x in nums]
    return min(ns), max(ns)


def tag_slug(name):
    name = name.lstrip("#")
    slug = re.sub(r"([A-Z])", r"-\1", name).lower().strip("-")
    slug = re.sub(r"[^a-z0-9-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return f"tag-{slug}"


def main():
    pass_dir = "operations/pass/26-05-05"

    # 加载现有标签
    print("📡 加载现有标签...")
    resp = api("GET", "/api/admin/tags")
    existing = {}
    if resp.get("ok"):
        for t in resp.get("data", []):
            existing[t["slug"]] = t
        print(f"  已加载 {len(existing)} 个标签")
    else:
        print(f"  ⚠️ 无法加载标签: {resp}")

    results = []

    for filename in PASS_FILES:
        md = read_md(filename)
        summary = extract_summary(md)
        title_en = extract_field(md, "商品名称(英)")
        platform_raw = extract_field(md, "平台")
        source_url = extract_field(md, "商品链接")
        price_str = extract_field(md, "价格")
        cover = extract_field(md, "缩略图")
        cat_raw = extract_field(md, "类目")

        title = title_en.split("|")[0].strip()[:150]
        platform = PLATFORM_MAP.get(platform_raw, platform_raw.lower())
        category = CATEGORY_MAP.get(cat_raw, cat_raw.lower().replace(" ","-"))
        pmin, pmax = parse_price(price_str)
        tags_raw = extract_tags(md)

        print(f"\n{'='*60}")
        print(f"🚀 {filename}")
        print(f"   标题: {title[:70]}...")
        print(f"   平台: {platform} | 类目: {category} | 价格: ${pmin}~${pmax}")
        print(f"   摘要: {len(summary)} 字符 | 标签: {len(tags_raw)} 个")

        # Step 1: 创建商品（含完整 MD 上传到 R2）
        body = {
            "source_platform": platform,
            "source_url": source_url,
            "original_title": title_en,
            "title": title,
            "category": category,
            "price_min": pmin,
            "price_max": pmax,
            "currency": "USD",
            "cover_image": cover,
            "summary": summary,
            "source_md": md,
            "source_filename": filename,
        }

        print("  📤 创建商品...")
        r = api("POST", "/api/admin/products", body)

        if not r.get("ok"):
            err = r.get("error", {})
            print(f"  ❌ 失败: {err.get('message', str(r))[:200]}")
            results.append({"filename": filename, "status": "failed", "error": r})
            continue

        pid = r["data"]["id"]
        r2 = r["data"].get("r2_object_key", "")
        print(f"  ✅ 创建成功! UUID: {pid}")
        if r2: print(f"  📁 R2: {r2}")

        # Step 2: 确保标签存在并关联
        tag_slugs = []
        new_tags_created = 0
        for tag_name, dim in tags_raw:
            slug = tag_slug(tag_name)
            layer = DIMENSION_TO_LAYER.get(dim, "function")

            if slug not in existing:
                print(f"  🏷️ 创建标签: {tag_name} → {slug} ({layer})")
                tr = api("POST", "/api/admin/tags", {
                    "name": tag_name, "slug": slug,
                    "layer": layer, "dimension_level": 2,
                })
                if tr.get("ok"):
                    existing[slug] = tr["data"]
                    new_tags_created += 1
                else:
                    code = tr.get("error", {}).get("code", "")
                    if code == "TAG_ALREADY_EXISTS":
                        existing[slug] = {"id": slug, "slug": slug}

            if slug in existing:
                tag_slugs.append(slug)

        # 更新商品标签
        if tag_slugs:
            pr = api("PATCH", f"/api/admin/products/{pid}/tags", {"tags": tag_slugs})
            if pr.get("ok"):
                print(f"  ✅ 关联 {len(tag_slugs)} 个标签 (新建 {new_tags_created} 个)")
            else:
                print(f"  ⚠️ 标签关联失败: {pr.get('error',{}).get('message','?')[:100]}")

        results.append({
            "filename": filename, "product_id": pid, "r2_key": r2,
            "tags": len(tag_slugs), "new_tags": new_tags_created, "status": "ok",
        })

    # 汇总
    print(f"\n{'='*60}")
    print(f"📊 上架汇总:")
    ok = [r for r in results if r.get("status")=="ok"]
    fail = [r for r in results if r.get("status")!="ok"]
    print(f"  ✅ 成功: {len(ok)}  |  ❌ 失败: {len(fail)}")
    for r in results:
        icon = "✅" if r.get("status")=="ok" else "❌"
        detail = r.get("product_id","") if r.get("status")=="ok" else str(r.get("error",{}))[:80]
        tags_info = f" [标签:{r.get('tags',0)}]" if r.get("status")=="ok" else ""
        print(f"  {icon} {r['filename']} → {detail}{tags_info}")

    with open("operations/tools/operator_upload_results.json","w",encoding="utf-8") as f:
        json.dump(results, ensure_ascii=False, indent=2, fp=f)
    print(f"\n💾 结果已保存")

if __name__ == "__main__":
    os.chdir("/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora")
    main()
