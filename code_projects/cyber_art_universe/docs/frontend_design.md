# Cyber Art Universe — 前端设计文档

## 一、设计哲学

三个关键词：**简约、沉浸、赛博**

- **简约**：无框架，纯 HTML+CSS+Vanilla JS，极轻渲染壳
- **沉浸**：阅读页为第一优先级，排版干净，零干扰
- **赛博**：深色主题为主，紫/青霓虹点缀，呼应 "Cyber Art Universe" 定位

## 二、技术选型

| 项 | 选择 | 理由 |
|---|------|------|
| 框架 | 无 | 纯静态 HTML，Cloudflare Assets 托管 |
| CSS | CSS Variables + 自定义样式 | 极轻，无依赖 |
| Markdown | `marked` (CDN) | 轻量，支持 GFM |
| 字体 | 系统字体栈 | 零加载 |
| JS | Vanilla | API 调用 + DOM 操作 |

## 三、配色系统

```css
--bg:            #0a0a0f    背景
--bg-card:       #12121a    卡片
--bg-hover:      #1a1a26    hover
--text:          #e0e0e8    正文
--text-dim:      #888899    次要文字
--text-muted:    #555566    极次要文字
--accent:        #7c3aed    主色（紫）
--accent-light:  #a78bfa    亮紫
--cyan:          #06b6d4    辅助色（青）
--border:        #1e1e30    分割线
```

## 四、页面结构

| 页面 | 文件 | 说明 |
|------|------|------|
| 首页 | `index.html` | Hero + 分类导航 + 热门作品 |
| 浏览 | `browse.html` | 类型/标签筛选 + 分页列表 |
| 作品 | `work.html?id={id}` | 信息 + 章节目录 + 角色 |
| 阅读 | `read.html?work={id}&section={id}` | Markdown 渲染 + 导航 + 字号调节 |
| 关于 | `about.html` | 项目介绍 + Agent 入口 |

## 五、数据流

```
HTML 页面
    │ JS: fetch(API)
    ▼
CAU API (/api/catalog, /api/content/{id}, /api/content/{id}/sections/{sid})
    │ JSON: { ok: true, data: {...} }
    ▼
JS: marked.parse(markdown_body) → DOM innerHTML
```

## 六、文件清单

| 文件 | 估计行数 | 说明 |
|------|---------|------|
| `pages/assets/style.css` | ~350 | 全局样式 |
| `pages/assets/app.js` | ~200 | 共享脚本 |
| `pages/index.html` | ~60 | 首页 |
| `pages/browse.html` | ~50 | 浏览页 |
| `pages/work.html` | ~60 | 作品详情 |
| `pages/read.html` | ~60 | 阅读器 |
| `pages/about.html` | ~40 | 关于页 |

总计 ~820 行
