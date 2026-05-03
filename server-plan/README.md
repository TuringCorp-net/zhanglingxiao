# 🏰 虾康康的远程服务器方案 v2

> 基于 2核 / 512MB / 100G硬盘 / 1T月流量
> 与 OpenClaw 配合，各司其职

---

## 一、核心理念：三句话定位

```
思考层（OpenClaw）       执行层（服务器）
  ┌──────┐               ┌──────┐
  │ 🧠  │ ─── SSH ───→ │ 🦾  │
  │ 脑子 │ ←── 结果 ─── │ 手脚 │
  └──────┘               └──────┘
```

1. **OpenClaw = 脑子**：对话、推理、决策、调度、用户交互 — 我在这里
2. **服务器 = 手脚**：执行、存储、爬取、监控、常驻 — 延伸出去
3. **Markdown > 数据库**：所有知识库用 Markdown 文件 + Git 管理，不是数据库

---

## 二、存储方案：Markdown 知识库（不是数据库）

黎叔建议的 Obsidian 式 Markdown 知识库，非常正确。对比一下：

| 方案 | 内存 | 可移植 | 黎叔能读 | 版本控制 | 依赖 |
|-----|------|--------|---------|---------|------|
| PostgreSQL | ~150MB | ❌ | ❌ | 复杂 | 守护进程 |
| SQLite | ~5MB | ✅ | ❌ | 中等 | 文件 |
| **Markdown 文件** | **0MB** | **✅✅** | **✅ cat/Vim** | **✅ Git** | **零** |

**绝了！** 我的 STM 职业记忆本来就全是 Markdown + Git 管理，服务器端延续同一体系，一脉相承。

### 知识库目录结构

```
/opt/shrimp/knowledge/
├── README.md                    # 索引目录
├── memory/                      # 我的长期记忆（服务器端）
│   ├── 2026-05-02.md
│   └── ...
├── crawler/                     # 爬虫采集的数据
│   ├── prices/                  # 价格监控
│   │   ├── goods-monitor.md     # 监控的商品列表+历史价格
│   │   └── ...
│   ├── news/                    # 新闻聚合
│   │   └── 2026-05.md
│   └── weather/                 # 天气数据归档
├── tasks/                       # 服务器跑的任务记录
│   ├── 001-website-monitor.md
│   └── 002-price-tracker.md
├── scripts/                     # 脚本文档（记录脚本用途和用法）
│   └── README.md
├── logs/                        # 日志和运行记录
│   └── system-health.md
└── references/                  # 收藏的参考文档
    └── ...
```

**工作方式：**
```bash
# 我（在OpenClaw）需要查信息时：
ssh server "cat /opt/shrimp/knowledge/crawler/prices/goods-monitor.md"

# 我需要写数据时：
ssh server "echo '## 2026-05-02 XX商品降至199元' >> /opt/shrimp/knowledge/crawler/prices/goods-monitor.md"

# 知识库有版本历史：
cd /opt/shrimp/knowledge && git log --oneline
```

**黎叔随时可以：**
- SSH 上去 `cat` / `less` 看
- 用 rsync/scp 拉到本地
- 甚至直接 `git clone` 到自己的 Obsidian

---

## 三、编程方案：云端推理 + 本地执行

黎叔说对了——Claude Code / VS Code Server 把推理放云端，本地只是编辑器+客户端，512MB 绰绰有余。

### Claude Code —— 我的副大脑

```bash
# 装 Claude Code（npm，轻量）
npm install -g @anthropic-ai/claude-code

# 配好 API Key
export ANTHROPIC_API_KEY=sk-...

# 干活
claude -p "写一个Python爬虫，每天早8点抓取XX网站的价格变动，结果写到Markdown文件"
```

**我给它指令 → 云端 Claude 大模型推理 → 代码落地到服务器 → 我直接在服务器跑**

### 自己给自己写工具

这才是最酷的部分。举例：

**场景：** 我需要一个商品价格监控工具

```
我：Claude Code，帮我写个价格监控脚本
↓
Claude Code（云端推理）→ 生成代码
↓
代码落地到 /opt/shrimp/scripts/price-monitor.py
↓
我：写个 systemd timer 每小时跑它
↓
Claude Code → 生成 timer 配置
↓
启用 → 它开始工作
↓
降价了 → 脚本直接 POST Telegram Bot API → 通知黎叔
```

**完全自举：** 我通过 Claude Code 自己写工具，自己部署，自己运维。

---

## 四、编程工具链

用到的工具都很轻量：

| 工具 | 内存 | 硬盘 | 用途 |
|-----|------|------|------|
| **Claude Code** | ~80MB（仅运行时有） | ~200MB（npm包） | 主编程工具 |
| **VS Code Server** | ~100-150MB（常驻） | ~300MB | 可选，黎叔也可浏览器访问 |
| **Python3** | 按需 | 全系统自带 | 脚本主力 |
| **Node.js** | 按需 | ~50MB | 辅助 |
| **Git** | 0（不常驻） | 自带 | 版本控制 |
| **GitHub** | 0 | 0（远程） | 代码托管 |

**注意：** VS Code Server 常驻 100-150MB 对 512MB 来说有点奢侈。策略：
- **默认：Claude Code CLI**（用完就退，不占常驻内存）
- **需要时：** 启动 VS Code Server（按需启动/停止）
- **最佳方案：** 核心用 Claude Code，VS Code 作为黎叔的可选入口

---

## 五、监控方案：轻量级多层

Netdata 是好工具但本身 ~100MB 内存，在 512MB 上有点重。更适合的是分层方案：

### 第一层：即时查看（交互式）

```bash
# 装 btop —— 用 C++ 写的，比 top/htop 好看，内存 < 5MB
apt install btop

# 或者直接 htop（系统自带）
htop
```

### 第二层：数据采集+报警（常驻，极轻量）

```bash
# node_exporter —— 导出系统指标，~20MB 常驻
# 配合 Prometheus 存在 OpenClaw 端（不占服务器内存）

# 或者更简单的：自己写 Python 脚本
# /opt/shrimp/scripts/health-monitor.py
# 每5分钟采集 CPU/MEM/DISK/NET → 追加到 Markdown 文件
```

### 第三层：异常推送

写个简单脚本：
```python
# 如果 CPU > 90% 持续5分钟 → 推送到 Telegram
# 如果 磁盘 > 85% → 推送到 Telegram
# 如果 内存 < 50MB 可用 → 推送到 Telegram
```

这样我不需要装 Netdata/Prometheus 等重量级工具，也够用了。

---

## 六、完整服务栈（最终版）

```
┌─────────────────────────────────────────┐
│ 常驻服务（任何时候都在跑）                │
├─────────────────────────────────────────┤
│  Nginx          20MB    Web服务/反代     │
│  SSH Server     10MB    我远程连接       │
│  node_exporter  ~20MB   （可选）监控导出  │
│  ─────────────────────────────────────   │
│  常驻内存合计    ≤ 50MB                  │
│  空闲留给干活    400MB+                   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 按需调用（用完就退）                      │
├─────────────────────────────────────────┤
│  Claude Code    用时有，用完释放           │
│  Python 脚本    跑完就退                  │
│  Node 脚本      跑完就退                  │
│  VS Code Server 按需启停（黎叔要用时开）   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 数据层                                   │
├─────────────────────────────────────────┤
│  /opt/shrimp/knowledge/      Markdown    │
│  /opt/shrimp/scripts/        Python/Node │
│  /opt/shrimp/data/           缓存/临时   │
│  /opt/shrimp/logs/           运行日志    │
│  /opt/shrimp/code/           Git托管代码  │
└─────────────────────────────────────────┘
```

---

## 七、典型工作流示例

### 示例1：设置价格监控

```
1. 黎叔在 Telegram 说："帮我盯着某东上那个显示器"
2. 我（OpenClaw）→ SSH 到服务器
3. → 启动 Claude Code
4. → "写一个Python爬虫，每天8-22点每小时抓一次URL，记录价格到Markdown"
5. → Claude Code 写代码 + 配 systemd timer
6. → 代码跑起来了
7. → 我在知识库里记一笔
8. → 回复黎叔："已安排上，持续监控中 🔍"
```

### 示例2：长期记忆查询

```
1. 黎叔问："你还记得上次那个关于XX的讨论吗？"
2. 我查 OpenClaw 的 memory/ 找不到（太久了）
3. → SSH 到服务器
4. → grep -r "XX" /opt/shrimp/knowledge/
5. → 找到了！直接引用回复黎叔
```

### 示例3：自动运维

```
1. 服务器健康监控脚本检测到磁盘 > 80%
2. → 自动清理缓存和旧日志
3. → 如果还不够 → 推送到我的 Telegram
4. → 我知道后告知黎叔
```

---

## 八、初始化流程（明天拿到服务器后的操作）

```
Step 1: SSH 登录 + 基础加固
  - 改 SSH 端口
  - 配密钥登录
  - 关密码登录
  - 开防火墙

Step 2: 装核心工具
  - nginx, python3, git, nodejs, btop
  - Claude Code (npm)
  - 建 /opt/shrimp/ 目录结构

Step 3: 建 Markdown 知识库
  - Git init
  - 创建目录骨架
  - 写 README

Step 4: 建编程工作目录
  - mkdir -p /opt/shrimp/code/
  - git init 或 clone 已有项目
  - 确保 Claude Code 可用

Step 5: 建健康监控
  - 写健康采集脚本
  - 配 cron job
  - 关联异常通知

Step 6: 测试联通
  - 从 OpenClaw SSH 过去正常
  - 能跑脚本
  - 知识库可读可写

Step 7: 黎叔验收
  - 展示目录结构
  - 展示 Claude Code 编程效果
  - 展示监控正常
```

---

## 九、与 OpenClaw 的分工总结

| 事情 | 谁来做 | 为啥 |
|-----|--------|------|
| 和黎叔聊天 | OpenClaw | 有 Telegram/QQ |
| 大模型推理 | OpenClaw | 大模型在这里 |
| 短期决策 | OpenClaw | 会话上下文中 |
| 定时调度 | OpenClaw | cron 工具完善 |
| **持久化知识库** | **服务器** | Markdown + Git |
| **持续爬虫/监控** | **服务器** | 无超时限制 |
| **重量编程** | **服务器** | Claude Code 云端推理 |
| **内网穿透** | **服务器** | 公网 IP |
| **运行自己的代码** | **服务器** | 完全无限制 |
| **Git 托管** | **GitHub + 服务器** | GitHub 主仓，服务器本地副本 |

---

## 📋 交付清单

明天黎叔把服务器给我后，可以验证的成果：

- [ ] ✅ SSH 能连上，基础配置完成
- [ ] ✅ `/opt/shrimp/` 目录结构就位
- [ ] ✅ Markdown 知识库初始化 + Git 控制
- [ ] ✅ Claude Code 安装完成，跑通一个 "Hello World" 编程
- [ ] ✅ 健康监控脚本运行正常，能推送状态信息
- [ ] ✅ 我能从 OpenClaw SSH 过去执行任意命令
