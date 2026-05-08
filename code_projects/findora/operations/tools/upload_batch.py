#!/usr/bin/env python3
"""运营总监 - 批量上架商品到 Findora API"""

import subprocess
import json
import os
import re

API_BASE = "https://findora.turingcorp.net"
ADMIN_KEY = "Findora-TuringCorp-13572468"
PASS_DIR = "/home/uncleclaw/.openclaw/workspace/WM/code_projects/findora/operations/pass/26-05-05"

def curl_api(method, path, data=None):
    """调用 Findora API"""
    url = f"{API_BASE}{path}"
    cmd = ["curl", "-s", "-w", "\n%{http_code}", "-X", method, url,
           "-H", f"X-Admin-Key: {ADMIN_KEY}",
           "-H", "Content-Type: application/json"]
    if data:
        cmd += ["-d", json.dumps(data, ensure_ascii=False)]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    output = result.stdout.strip()
    # 分离响应体和HTTP状态码
    lines = output.rsplit("\n", 1)
    if len(lines) == 2:
        body, code = lines
    else:
        body, code = output, "0"
    try:
        return int(code), json.loads(body)
    except:
        return int(code), body

def read_md_file(filepath):
    """读取 markdown 文件"""
    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()

def extract_summary(content):
    """从 md 文件中提取策划文案全文"""
    match = re.search(r'## 策划文案\n\n(.*?)(?=\n## 多维标签)', content, re.DOTALL)
    if match:
        return match.group(1).strip()
    return ""

def extract_tags(content):
    """从 md 文件中提取标签列表"""
    match = re.search(r'## 多维标签\n\n(.*?)(?=\n## 选品评分)', content, re.DOTALL)
    if match:
        tag_text = match.group(1).strip()
        # 提取反引号中的标签
        tags = re.findall(r'`([^`]+)`', tag_text)
        return tags
    return []

def extract_raw_json(content):
    """从 md 文件中提取原始 JSON 数据"""
    match = re.search(r'## 原始数据\n```json\n(.*?)\n```', content, re.DOTALL)
    if match:
        return json.loads(match.group(1))
    return {}

def extract_title_from_copy(content):
    """从策划文案中提取标题（### 开头的行）"""
    match = re.search(r'### (.*?)\n', content)
    if match:
        return match.group(1).strip()
    return ""

def extract_original_title(content):
    """从基本信息中提取英文名"""
    match = re.search(r'- \*\*英文名\*\*: (.*?)\n', content)
    if match:
        return match.group(1).strip()
    return ""

def upload_product(filepath, filename):
    """上架单个商品"""
    content = read_md_file(filepath)
    raw = extract_raw_json(content)
    summary = extract_summary(content)
    tags = extract_tags(content)
    title = extract_title_from_copy(content)
    original_title = raw.get("goodsName", extract_original_title(content))

    # 构建 source_url - 根据平台拼接完整链接
    platform = raw.get("_platform", "")
    goods_id = raw.get("goodsId", "")

    source_urls = {
        "amazon": f"https://www.amazon.com/dp/{goods_id}",
        "temu": f"https://www.temu.com/g-{goods_id}.html",
        "tiktok": f"https://www.tiktok.com/product/{goods_id}",
        "sumaitong": f"https://www.aliexpress.com/item/{goods_id}.html",
        "shein": f"https://www.shein.com/product/{goods_id}.html",
    }
    source_url = source_urls.get(platform, goods_id)

    # 类目映射
    cat_name = raw.get("_catName", "")
    category_map = {
        "乐器": "music",
        "运动鞋服及包配": "sports",
        "Phones & Electronics": "electronics",
        "美容和个人护理": "health",
        "工具和家居装修": "tools",
    }
    category = category_map.get(cat_name, "other")

    price_min = raw.get("goodsPriceMin") or 0
    price_max = raw.get("goodsPriceMax") or price_min

    thumbnail = raw.get("thumbnail", "")
    # 修复无协议的图片URL
    if thumbnail.startswith("//"):
        thumbnail = "https:" + thumbnail

    payload = {
        "source_platform": platform,
        "source_url": source_url,
        "original_title": original_title,
        "title": title,
        "summary": summary,
        "category": category,
        "tags": tags,
        "price_min": price_min,
        "price_max": price_max,
        "currency": "USD",
        "cover_image": thumbnail,
        "source_md": content,
        "source_filename": filename,
    }

    print(f"\n📦 上架: {title}")
    print(f"   平台: {platform} | 类目: {category} | 价格: ${price_min}-${price_max}")
    print(f"   标签: {len(tags)} 个")
    print(f"   文案长度: {len(summary)} 字符")

    code, resp = curl_api("POST", "/api/admin/products", payload)

    if code in (200, 201) and resp.get("ok"):
        product_id = resp.get("data", {}).get("id", "unknown")
        r2_key = resp.get("data", {}).get("r2_object_key", "unknown")
        print(f"   ✅ 成功! ID: {product_id} | R2: {r2_key}")
        return product_id, tags
    else:
        print(f"   ❌ 失败! HTTP {code}: {resp}")
        return None, None

def main():
    files = sorted([f for f in os.listdir(PASS_DIR) if f.endswith('.md')])
    print(f"📋 找到 {len(files)} 个待上架商品")

    results = []
    for f in files:
        filepath = os.path.join(PASS_DIR, f)
        product_id, tags = upload_product(filepath, f)
        if product_id:
            results.append({"id": product_id, "tags": tags, "filename": f})

    print(f"\n{'='*50}")
    print(f"📊 上架结果: {len(results)}/{len(files)} 成功")

    # 输出成功列表
    for r in results:
        print(f"   ✅ {r['filename']} → {r['id']}")

    # 保存结果供后续使用
    with open(os.path.join(os.path.dirname(__file__), "upload_result.json"), "w") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n💾 结果已保存到 upload_result.json")

    return results

if __name__ == "__main__":
    main()
