/**
 * Story Forger + Story Elf 前端设计规格
 *
 * 本文件为设计参考文档，不参与运行时编译。
 * 仅包含类型定义和规格说明，供前端代码实现参考。
 *
 * 最后更新: 2026-06-12
 * 版本: v2.7 — Story Elf 嵌入左栏重构
 */

// ============================================================
// 一、写作桌整体布局 (write.html)
// ============================================================

/**
 * 页面结构（自上而下）:
 *
 *   ┌─ #global-nav ─────────────────────────────┐
 *   │  (app.js renderNav 动态注入)               │
 *   ├─ .pipeline-bar ───────────────────────────┤
 *   │  [选择作品]  M0 → M1 → M2 → M3 → M4 → M5 → M6  │
 *   ├─ #split-view (CSS Grid) ──────────────────┤
 *   │  ┌──────────┬──┬──────────┬──┬──────────┐ │
 *   │  │ 左栏     │▎│ 中栏     │▎│ 右栏     │ │
 *   │  │ 卡片/    │▎│ 自由编辑 │▎│ 模板     │ │
 *   │  │ Elf对话  │▎│          │▎│ 槽位编辑 │ │
 *   │  └──────────┴──┴──────────┴──┴──────────┘ │
 *   └────────────────────────────────────────────┘
 *
 * Grid 列定义:
 *   - 两栏模式 (M0/M6): leftPct% 8px (100-leftPct)% 0px 0%
 *   - 三栏模式 (M1-M5): leftPct% 8px midPct% 8px right%
 *
 * 高度: calc(100vh - 95px) — 减去 nav + pipeline 高度
 * 默认比例: left=33%, mid=34%, right=33%
 * 持久化键: sf_desk_v3 (localStorage)
 */

// ============================================================
// 二、左栏垂直分割 (v2.7 新增)
// ============================================================

/**
 * 左栏 (#split-left) 垂直分为上下两个区域:
 *
 * M0 / M1 / M2 (Elf 撑满全高):
 *   ┌─ #split-left ──────────┐
 *   │  消息区 (flex: 1)      │
 *   │                        │
 *   │  ┌─ 输入栏 (固定底部) ┐│
 *   │  │ [🧝] [textarea]   ││
 *   │  └────────────────────┘│
 *   └────────────────────────┘
 *
 * M3 / M4 / M5 / M6 (上下分割，默认 40:60):
 *   ┌─ #split-left ──────────┐
 *   │  卡片列表区 (40%)      │  ← 角色卡/伏笔卡/章节列表
 *   │  overflow-y: auto      │
 *   ├─ 水平分隔线 (8px) ────│  ← left-hdivider，可拖动
 *   │  消息区 (flex: 1)      │
 *   │  overflow-y: auto      │
 *   │  ┌─ 输入栏 (固定底部) ┐│
 *   │  │ [🧝] [textarea]   ││  ← 80-150px 动态高度
 *   │  └────────────────────┘│
 *   └────────────────────────┘
 *
 * 默认比例: upperPct=40, lowerPct=60
 * 限制: upperPct 在 [15, 85] 之间
 * 持久化: 加入 sf_desk_v3 的 leftPanelUpperPct 字段
 */

// ============================================================
// 三、Story Elf 嵌入模式 (v2.7 重设计)
// ============================================================

/**
 * Elf 组件支持两种运行模式:
 *
 * 1. 浮动模式 (默认) — read.html, work.html, index.html
 *    - #story-elf 挂载到 document.body
 *    - position: fixed, 可拖拽
 *    - 对话框 relative 于头像定位
 *
 * 2. 嵌入模式 — write.html (StoryForger.mount(container))
 *    - #story-elf 挂载到 #split-left
 *    - position: static, flex 列布局
 *    - 头像 50×50px，输入栏左下角
 *
 * 模式切换 API:
 *   StoryElf.mount(containerEl)   → 切换到嵌入模式
 *   StoryElf.mount(null)          → 恢复到浮动模式 (挂在 body)
 */

/**
 * 嵌入模式 DOM 结构:
 *
 *   <div id="story-elf" class="elf-embedded">
 *     <!-- 消息区 -->
 *     <div class="elf-chat-messages" id="elf-chat-messages">
 *       <!-- 最多渲染 50 条消息 (_messages 数组不限) -->
 *       <div class="elf-chat-msg user|ai|step">...</div>
 *       <div class="elf-working-block">...</div>
 *     </div>
 *     <!-- 输入栏 (固定底部) -->
 *     <div class="elf-chat-input-row">
 *       <div class="elf-avatar" style="width:50px;height:50px">
 *         <img src="/assets/story-elf.png" style="transform:scaleX(-1)">
 *       </div>
 *       <textarea id="elf-chat-input" ...></textarea>
 *       <button id="elf-send-btn">发送</button>
 *     </div>
 *   </div>
 */

/**
 * 输入框行为 (模仿 Claude Code):
 *   - 初始高度: min-height = 3 行 (~60px)
 *   - 输入自动撑高: 监听 input 事件，height=auto → scrollHeight
 *   - 最大高度: max-height = 6 行 (~120px)，超出后内部滚动
 *   - 按 Enter 发送 (Shift+Enter 换行)
 *   - resize: none
 */

/**
 * 消息渲染上限:
 *   - DOM 渲染: _messages.slice(-50) — 最后 50 条
 *   - _messages 数组不限，完整传给 API 做对话上下文
 *   - 新消息到达自动 scrollTop = scrollHeight
 */

/**
 * 删除的功能 (v2.7 移除):
 *   - 拖拽移动: 移除 onDragStart/Move/Up、drag 对象、位置持久化
 *   - Hint 对话泡: 移除 #elf-hint-bubble DOM、打字机引擎 _hintState
 *   - 操作按钮: 移除 setActions()、#elf-actions DOM
 *   - 默认 sendChat: write 页面会覆盖，保留为 fallback 供其他页面使用
 */

// ============================================================
// 四、Pipeline M0-M6 模块规格
// ============================================================

/**
 * Pipeline 步骤:
 *
 *   M0 → M1 → M2 → M3 → M4 → M5 → M6
 *
 *   ID   | 模块               | 面板 | 左栏内容        | 中栏          | 右栏
 *   ─────┼────────────────────┼──────┼─────────────────┼───────────────┼─────
 *   M0   | original_concept   | 两栏 | Elf 对话(撑满)  | textarea      | 隐藏
 *   M1   | worldbuilding      | 三栏 | Elf 对话(撑满)  | 自由编辑区    | 槽位编辑器
 *   M2   | outline            | 三栏 | Elf 对话(撑满)  | 自由编辑区    | 槽位编辑器
 *   M3   | characters         | 三栏 | 角色卡 + Elf    | 自由编辑区    | 槽位编辑器
 *   M4   | foreshadowing      | 三栏 | 伏笔卡 + Elf    | 自由编辑区    | 槽位编辑器
 *   M5   | chapters           | 三栏 | 章节卡 + Elf    | 自由编辑区    | 意图卡表单
 *   M6   | writing            | 两栏 | 章节卡 + Elf    | textarea      | 隐藏
 */

// ============================================================
// 五、槽位编辑器引擎
// ============================================================

/**
 * 槽位编辑器 (M1-M4) 消费 API 返回的 TemplateJson:
 *
 *   TemplateJson {
 *     title?: string
 *     intro?: string
 *     sections: SectionJson[]     // { heading, level, slots[] }
 *     outro?: string
 *     free_content?: string
 *     groups?: GroupJson[]         // 多 group 模式 (M3/M4)
 *   }
 *
 *   SlotJson {
 *     id: string                   // 槽位 ID (持久化键)
 *     level: 1 | 2                // 可见性级别 (L1=基础, L2=进阶)
 *     label: { zh: string, en: string }
 *     hint?: { zh: string, en: string }
 *     content: string             // 当前 Markdown 内容
 *   }
 *
 * 交互模式 (click-to-edit):
 *   渲染态 → div.slot-preview (marked.parse 渲染 Markdown)
 *   编辑态 → textarea.slot-textarea (点击预览切换)
 *   失焦 → 重新渲染预览，触发 auto-save
 *
 * 分级系统:
 *   - L1: 始终可见
 *   - L2: 需要用户切换 pipeline-bar 中的 L1/L2 按钮
 *   - 过滤在后端 buildTemplateJson 中完成
 */

// ============================================================
// 六、自动保存
// ============================================================

/**
 * 触发条件:
 *   - 输入后 5 秒 (debounce)
 *   - 切换模块/卡片时 (immediate flush)
 *   - 失焦时 (immediate async flush)
 *
 * 指纹去重: fingerprint(payload) 比对 _lastSaved，相同则不发送
 * 缓存策略: saveModule 成功后更新 _moduleCache，失败则清除
 */

// ============================================================
// 七、CSS 变量参考
// ============================================================

/**
 * 项目使用的 CSS 自定义属性 (定义于 style.css :root):
 *
 *   --bg:           #0d1117    主背景 (暗色)
 *   --bg-card:      #161b22    卡片背景
 *   --bg-hover:     #1c2333    hover 背景
 *   --border:       #30363d    边框色
 *   --text:         #e6edf3    主文本色
 *   --text-dim:     #c9d1d9    次文本色
 *   --text-muted:   #8b949e    弱文本色
 *   --accent:       #7c3aed    主强调色 (紫)
 *   --accent-light: #a78bfa    浅强调色
 *   --accent-rgb:   124,58,237 强调色 RGB
 *   --cyan:         #06b6d4    青色 (Elf 主题色)
 *   --cyan-rgb:     6,182,212  青色 RGB
 *   --error:        #ef4444    错误色
 *   --mono:         ui-monospace 等宽字体
 *   --radius:       6px        圆角
 *   --ui-knob:      #555       UI 滑块色
 */

// ============================================================
// 八、localStorage 键
// ============================================================

/**
 *   sf_desk_v3         写作桌状态 (leftPct, midPct, chapterFilter, leftPanelUpperPct)
 *   sf_elf_pos         浮动模式 Elf 位置 (write 嵌入模式不需要)
 *   sf_user_token      用户认证令牌
 *   sf_lang            语言偏好 (zh/en)
 */
