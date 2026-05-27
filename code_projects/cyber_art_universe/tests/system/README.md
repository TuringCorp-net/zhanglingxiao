# System Tests

集成测试 —— 通过真实 API 调用验证系统行为。不 mock，不 stub，直接打生产/测试环境。

## 约定

- 每个脚本是**自包含**的（只依赖 `curl` + `python3`）
- 写入测试使用**唯一标记**（timestamp），避免残留污染
- 退出码 `0` = 全部通过，`1` = 有失败
- 幂等：可重复运行

## 运行

```bash
# 需要 ADMIN_TOKEN
TOKEN="admin-TuringCorp-13572468" ./tests/system/v3_module_api.sh

# 指定环境
BASE_URL="https://cau.turingcorp.net" TOKEN="xxx" ./tests/system/v3_module_api.sh
```

## 测试列表

| 文件 | 覆盖范围 | 说明 |
|------|---------|------|
| `v3_module_api.sh` | M0-M5 统一 Module API | GET list / GET module / PUT free_content / GET verify 闭环 |

## 新增测试

1. 在本目录创建 `xxx.sh`
2. 遵循约定（自包含、标记唯一、退出码）
3. 更新本 README 的测试列表
