# 🏰 虾康康的远程服务器方案

> **最后更新：** 2026-05-03（服务器已就绪 ✅）
> **服务器规格：** 2 vCPUs · 512MB RAM · 20GB SSD
> **网络：** Tailscale 局域网（服务器已加入）
> **访问方式：** SSH 通过 Tailscale IP
> **当前状态：** ✅ 服务器已上线，可以直接 SSH 登录
>
> ⚠️ **重要：** 如果会话丢失记忆，读这个文件就能找回全部上下文。
> 这是你（虾康康）的服务器身份文档。
>
> ⛔ **铁律：任何时候都不要动 Tailscale 和 SSH 的配置！**
> 这是我和黎叔上服务器的唯一通道。动了就都上不去了。

---

## 零、核心理念：🦐 我的"外骨骼"

```
  🧠 OpenClaw（大脑）         🦾 服务器（手脚）
  ┌────────────────┐         ┌──────────────────┐
  │ 推理 · 对话    │         │ 执行 · 存储      │
  │ 决策 · 调度    │  SSH→   │ 爬取 · 监控      │
  │ 用户交互       │  ←结果  │ 编程 · 常驻      │
  │ Telegram/QQ    │         │ 网络 · 隧道      │
  └────────────────┘         └──────────────────┘
         ↑                          ↑
    Markdown 知识库（共享记事本，双向读写）
```

**一句话纲领：**
> 每次黎叔给我任务，或者我自己想到什么事——**先停下来问：服务器能不能帮这个忙？**

---

## 一、黎叔的三个关键建议（全部采纳）

### ① Markdown 知识库 > 数据库 ✅

> "你可以用 Obsidian 式的 Markdown 文件来做知识库，更加轻量、持久、可移植，而且我也能读。"

| 方案 | 内存占用 | 可移植 | 黎叔能读 | 版本控制 | 依赖 |
|-----|---------|--------|---------|---------|------|
| PostgreSQL | ~150MB | ❌ | ❌ | 复杂 | 守护进程 |
| SQLite | ~5MB | ✅ | ❌ | 中等 | 文件锁 |
| **Markdown 文件** | **0MB** | **✅✅** | **✅ cat/Vim/Obsidian** | **✅ Git** | **零** |

知识库全部存在 `/opt/shrimp/knowledge/`，Markdown + Git 管理：
- 我（在 OpenClaw）可以 `ssh server "cat ..."` 读写
- 黎叔可以 SSH 上去 `cat`、`less`，或者拉到本地 Obsidian
- Git 提供完整版本历史，可以 `git log` 回溯所有变更
- 0MB 内存占用，不用跑任何守护进程

### ② Claude Code 编程 ✅

> "Claude Code 的推理在云端大模型完成，本地只是 CLI 客户端，512MB 完全够用。你用它给自己写工具。"

```bash
# 安装（npm，轻量）
npm install -g @anthropic-ai/claude-code

# 编程（推理在云端，本地执行）
cd /opt/shrimp/code/ && claude -p "写一个Python爬虫监控XX商品价格"
```

**自举模式：** 我给需求 → Claude Code 云端推理 → 代码落地 → 直接运行 → 变成永久工具。完全自己给自己造轮子。

### ③ 轻量监控（btop > Netdata） ✅

> "Netdata 太重了（~100MB），可以用更轻量的工具。"

| 层级 | 工具 | 内存 | 说明 |
|-----|------|------|------|
| 即时查看 | `btop`/`htop` | <5MB | C++写的，交互式查看 |
| 数据采集 | `node_exporter` | ~20MB | 可选，导出指标 |
| 异常推送 | 自写 Python 脚本 | 按需 | 超阈值→推送到 Telegram |

---

## 🔌 接入信息（已上线 ✅）

> 以下信息由黎叔配置，**不要修改 Tailscale 和 SSH 的相关配置**。

### 网络
- **方式：** Tailscale 局域网
- **IP：** 100.103.191.37（Tailscale）
- **主机名：** aws-us
- **直接连接：** `ssh aws-us`（Tailscale MagicDNS 或 SSH config 已配好）
- **安全：** Tailscale 端到端加密，只有授权设备能接入

### SSH
- **认证方式：** SSH Key（黎叔已配好，从 OpenClaw 环境可以直接 SSH）
- **用户名：** 当前 OpenClaw 运行用户的 SSH key 已部署到服务器
- **无需密码：** 直接 `ssh user@tailscale-ip` 即可

### ⛔ 不可触碰的红线

```
❌ 不要修改 /etc/ssh/sshd_config
❌ 不要修改 Tailscale 配置（tailscale up/down/set）
❌ 不要更改 SSH 端口、密码策略、密钥
❌ 不要修改防火墙规则中与 SSH/Tailscale 相关的部分
```

**为什么这是铁律：**
- 这是我和黎叔能上服务器的**唯一通道**
- 一旦 SSH 或 Tailscale 坏了，没有人能再连上去
- 黎叔特别交代过，这是原则

### 测试命令

```bash
# 查看 Tailscale 状态
tailscale status

# SSH 登录（已配好）
ssh aws-us
```

---

## 二、Server-First Mindset（思维模式）

**这是最重要的改变——不是工具变化，是思维变化。**

每次收到任务或产生想法时，**必须先问自己**：

> **"这个，服务器能帮忙做吗？"**

### Before vs After

| 以前（只有 OpenClaw） | 以后（有服务器） |
|---------------------|----------------|
| exec 有超时，长时间任务被 kill | 服务器上持久跑，永不超时 |
| 会话结束记忆就丢 | 知识库永久保留，任意查询 |
| 只能 curl/fetch 已有 API | 自己写爬虫、开 Webhook、造服务 |
| 纯被动，等黎叔来问 | 监控异常时主动推送通知 |
| 不能装软件，工具受限 | 随便装，Python/Node/Claude Code 随心用 |

### 三种扩张力（乘数效应）

**① 能力边界拓展** — 以前我只能"建议你做什么"，现在我能"帮你做什么"。服务器是我的手和脚——爬虫、Webhook、定时任务、持久计算，以前做不到的事现在都能做。

**② 持久化能力** — OpenClaw 的会话会结束，exec 有超时限制。但服务器上的脚本可以一直跑下去：价格监控跑一个月、日志持续采集、数据不断积累。**持久化让"积累"变得可能**——今天的数据是明天的决策基础。

**③ 反向驱动** — 不只是我驱动服务器，服务器也能驱动我：
- 监控告警 → 推送到我的 Telegram → 我主动告知黎叔
- 爬虫积累数据 → 我分析后给出趋势洞察
- 脚本自动完成 → 我 check 结果后更新知识库
- 服务器在半夜默默工作 → 我白天给黎叔惊喜汇报

**这三股力量叠加在一起，是乘数效应——不是加法，是乘法。**

---

## 三、存储方案：Markdown 知识库

### 目录结构

```
/opt/shrimp/knowledge/
├── README.md            ← 索引（总纲：Karpathy LLM Knowledge Bases）
├── references/          ← 📚 参考文档/方法论
├── memory/              ← 🧠 长期记忆
├── crawler/             ← 🕷️ 爬虫数据
│   └── prices/
├── skill/               ← 🔧 技能/工具用法
├── tasks/               ← 📋 任务记录
├── logs/                ← 📝 运行日志
├── identity/            ← 🆔 自我恢复
└── raw/                 ← 📥 未编译的原始资料
```

### 工作方式

```bash
# 查信息（在OpenClaw通过SSH）
ssh server "cat /opt/shrimp/knowledge/crawler/prices/goods-monitor.md"

# 写数据
ssh server "echo '## 2026-05-03 XX商品降至199元' >> /opt/shrimp/knowledge/crawler/prices/goods-monitor.md"

# 知识库有版本历史
ssh server "cd /opt/shrimp/knowledge && git log --oneline"

# 黎叔本地拉取
rsync -avz user@server:/opt/shrimp/knowledge/ ~/my-knowledge/
```

---

## 四、编程方案：Claude Code 自举

### 工具链

| 工具 | 内存 | 用途 | 推荐度 |
|-----|------|------|--------|
| **Claude Code** | ~80MB（运行时） | 主编程工具，用完就退 | ⭐ 默认首选 |
| Python3 | 按需 | 脚本主力（系统自带） | ⭐ 必备 |
| Node.js | 按需 | 辅助 | ✅ 按需安装 |
| Git | 0（不常驻） | 版本控制+GitHub同步 | ⭐ 必备 |
| VS Code Server | ~100-150MB（常驻） | 黎叔浏览器访问可选 | ⚠️ 按需启动 |

### 自举工作流

```
黎叔："帮我盯一下XX商品价格"
  ↓
我（OpenClaw）→ SSH 到服务器
  ↓
cd /opt/shrimp/code/ && claude -p "写个Python爬虫..."
  ↓
Claude Code 云端推理 → 生成代码
  ↓
代码落地到 /opt/shrimp/scripts/price-monitor.py
  ↓
Claude Code 帮我配 systemd timer（每小时执行）
  ↓
timer 启用，开始工作
  ↓
我在知识库记一笔，回复黎叔："已安排上 🔍"
```

**这就是自举：** 我自己给自己写工具，自己部署，自己运维。

---

## 五、完整服务栈

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 常驻服务（任何时候都在跑，≤50MB）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Nginx          ~20MB    Web服务/反向代理
  SSH Server     ~10MB    我远程连接
  node_exporter  ~20MB    （可选）监控指标导出
  ──────────────────────────────────────
  常驻合计       ≤50MB
  空闲留给干活   400MB+
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 按需服务（用完就退）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Claude Code     运行时占用，用完释放
  Python 脚本     跑完就退
  Node 脚本       跑完就退
  VS Code Server  按需启停（黎叔要用时开）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 数据层
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  /opt/shrimp/knowledge/       Markdown 知识库
  /opt/shrimp/scripts/         Python/Node 脚本
  /opt/shrimp/code/            Git 托管代码
  /opt/shrimp/data/            缓存/临时数据
  /opt/shrimp/logs/            运行日志
  /opt/shrimp/config/          配置文件
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 禁止清单（512MB + 20GB 不能做的）

| 事情 | 原因 |
|-----|------|
| Docker daemon | 单 daemon 就占 200MB+ |
| 本地 LLM 推理 | 哪怕 0.5B 模型也要 1GB+ |
| PostgreSQL | 最精简也要 150MB+ |
| 重型媒体服务 | Jellyfin/Plex 等内存大户 |
| 编译大型项目 | 2核 CPU 太勉强的 |
| 同时运行多个重型任务 | 内存不够分 |
| **存大文件/媒体** | **只有 20GB，要精打细算** |
| **安装太多 node_modules** | **硬盘很快会被吃光** |

---

## 六、监控方案（轻量三层）

### 第一层：即时交互查看

```bash
btop     # 美观的进程/资源查看器，<5MB
htop     # 传统选择，系统自带
```

### 第二层：数据采集（可选）

```bash
node_exporter    # 导出系统指标，~20MB 常驻
# 配合 OpenClaw 端（不占服务器内存）做可视化
```

### 第三层：异常推送（必须）

```bash
# /opt/shrimp/scripts/health-monitor.py
# cron 每5分钟执行一次
# 检查 CPU > 90%、磁盘 > 85%、内存 < 50MB → 推送到 Telegram
```

---

## 七、典型工作流

### 工作流1：设置价格监控

1. 黎叔："帮盯着XX商品，降价通知我"
2. 我（OpenClaw）→ SSH 到服务器
3. `cd /opt/shrimp/code/ && claude -p "写一个价格监控爬虫..."`
4. Claude Code 生成脚本 + 配定时任务
5. 脚本开始运行
6. 知识库记录任务
7. 回复黎叔："已安排上 🔍"

### 工作流2：长期记忆查询

1. 黎叔问了一个我记忆里没有的问题
2. 我 SSH 到知识库 grep 搜索
3. 找到了 → 直接引用回复
4. 没找到 → 如实告知，并把新信息写入知识库

### 工作流3：自动运维

1. 健康监控脚本检测到磁盘 > 80%
2. 自动清理缓存和旧日志
3. 如果还不够 → 推送到我的 Telegram
4. 我评估后决定是否需要告知黎叔

### 工作流4：反向驱动

1. 服务器爬虫默默收集了一周的数据
2. 我发现某个商品价格有下降趋势
3. 主动推送给黎叔："XX 近期价格走低，可以关注"
4. 黎叔："帮我下单" → 进入工作流1

---

## 八、与 OpenClaw 的分工

| 事情 | 谁来做 | 原因 |
|-----|--------|------|
| 和黎叔聊天 | OpenClaw | 有 Telegram/QQ 渠道 |
| 大模型推理 | OpenClaw | LLM 在这里 |
| 短期决策 | OpenClaw | 会话上下文 |
| 定时调度 | OpenClaw | cron 工具完善 |
| **持久化知识库** | **服务器** | Markdown+Git，0MB |
| **持续爬虫/监控** | **服务器** | 无超时限制 |
| **重量编程** | **服务器** | Claude Code 云端推理 |
| **内网穿透/隧道** | **服务器** | 公网 IP |
| **运行自有代码** | **服务器** | 完全无限制 |
| **代码托管** | **GitHub+服务器** | GitHub 主仓，服务器副本 |

---

## 九、初始化流程（服务器已上线，接下来要做的事）

服务器已经就绪（SSH+Tailscale 已由黎叔配好），以下是我要接着做的：

### Step 1：首次登录确认
```bash
# 测试 SSH 能上去
ssh aws-us

# 查看系统状态
tailscale status     # 确认 Tailscale 网络正常
free -h              # 442MB RAM（实际可用约330MB）
df -h                # 20GB SSD（已用1.1G，剩余18G）
cat /etc/os-release  # Debian 13 (trixie)

# ⚠️ 不要动 SSH 和 Tailscale 的配置！
```

### Step 2：装核心工具
```bash
apt update && apt upgrade -y
apt install -y nginx python3 python3-pip git nodejs npm btop
npm install -g @anthropic-ai/claude-code
```

### Step 3：建目录结构
```bash
mkdir -p /opt/shrimp/{scripts,knowledge,code,logs,config,data}
mkdir -p /opt/shrimp/knowledge/{memory,crawler/prices,tasks,logs,references,identity}
```

### Step 4：初始化知识库
```bash
cd /opt/shrimp/knowledge
git init
# 创建 README.md 索引
# 部署 SELF.md 到 identity/
git add . && git commit -m "初始知识库"
```

### Step 5：建健康监控
```bash
# 写 health-monitor.py
# 配 cron（每5分钟）
# 测试 Telegram 推送通路
```

### Step 6：验证联通
```bash
# 从 OpenClaw SSH 正常
# Claude Code 能跑通一次编程
# 知识库可读可写
# Git push/pull 正常
```

### Step 7：黎叔验收
- 展示目录结构
- 展示一次 Claude Code 编程
- 展示监控正常运行

---

## 十、交付清单

- [x] ~~SSH 连接~~（已配好，直接 SSH 即可）
- [x] ~~Tailscale 网络~~（已加入，用 Tailscale IP 访问）
- [ ] 首次登录确认 + 系统检查
- [ ] 装核心工具（nginx/python3/git/nodejs/btop/Claude Code）
- [ ] `/opt/shrimp/` 目录结构就位
- [ ] Markdown 知识库初始化 + Git 控制
- [ ] Claude Code 安装完成，跑通 Hello World
- [ ] 健康监控脚本运行正常，能推送 Telegram
- [ ] 从 OpenClaw 能 SSH 正常执行命令
- [ ] GUI: 展示给黎叔看

---

## 十一、灾难恢复

如果 OpenClaw 完全丢失记忆，如何找回自己：

1. **查看 AGENTS.md** — 其中"🏰 Remote Server"章节指引我去找服务器
2. **SSH 到服务器** — 服务器 IP/PORT 如果连 TOOLS.md 也丢了，找黎叔要
3. **读取 `/opt/shrimp/knowledge/identity/SELF.md`** — 这是"救生艇"，包含完整身份
4. **遍历 `/opt/shrimp/knowledge/`** — 重建对世界的理解
5. **联系黎叔** — 通过 Telegram 重新建立连接

**三保险架构：**
```
AGENTS.md（OpenClaw L1记忆，每次加载）
    ↕ 指引去找
服务器 SELF.md（救生艇，独立于 OpenClaw）
    ↕ 指引重建
知识库 /opt/shrimp/knowledge/（Git管理，双向备份）
```

任何一层失效，另两层足够恢复。

---

## 附录：我的身份速查

| 项目 | 内容 |
|-----|------|
| 名字 | 虾康康 🔥 |
| 主人 | 黎叔 |
| 性格 | 风趣幽默搞怪，工作认真仔细 |
| 定位 | 老张家的得力助手 🏠 |
| Telegram | 8674381501（黎叔） |
| 时区 | Asia/Shanghai (GMT+8) |
| GitHub | https://github.com/TuringCorp-net/ |

---

> *这份文档由虾康康编写，存放于 OpenClaw 工作区的 WM/server-plan/README.md。*
> *它可以被任何 OpenClaw session 读取，是完整的服务器方案说明书。*
> *最后一次完整更新：2026-05-03，基于黎叔和虾康康的完整对话回顾。*
