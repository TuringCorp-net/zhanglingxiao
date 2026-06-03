# OAIA技术架构设计

OAIA — Organized Artificial Intelligence Agent

注意：

- 1，本文由人类维护，Agent不可自行修改。
- 2，本文从人类架构师角度，用自然语言提出宏观性架构设计。对于未覆盖或者需要细化的细节，请Agent自行根据最佳实践，在简洁、优雅的大前提下自行完成。
- 3，本文必须排除在git仓库之外，以免泄露原始设计。
- 4，原则上，本文为指导性说明，而不是强制性要求。

## OAIA 宏观性技术架构设计

1，个体=agent，组织=OAIA。类似OpenClaw的架构，但OpenClaw为完全“自组织”的架构，而OAIA为有精确组织架构、群体记忆结构、稳定群体行为、自我成长与进化的架构。

***

2，可以借鉴OpenClaw的开源代码实现一些Agent初始化（分配能力、角色等）、Agent通信、Agent任务分配等底层架构。但是组织记忆、行为控制、持续演进等必须单独完成。

***

3，agent对应的底层大模型应该可以通过底层AI Gateway的配置随时更换（以及失败回退等容错机制）；agent专业能力通过给定system prompt来实现；agent记忆和个性通过OAIA组织记忆（含宪法、章程、制度等）来注入。

***

4，OAIA组织记忆分为长期记忆LTM（宪法、用户要求等）、短期记忆STM（章程、制度等）、工作记忆WM（当前计划与任务、角色分工、工作进展与结果等）三种。
4-1，长期记忆LTM由用户为主完成，Agent不可修改，但可提出建议；
4-2，短期记忆STM由用户和agent共同完成，但是agent在修改之前，必须要	经过“多方Agent讨论”-“多方Agent决策”的流程，决策结果达成一致才可修改；
4-3，工作记忆WM由agent自主完成，但是需要定期保存到短期记忆中。

***

5，为方便人类查看和维护，同时降低运行成本，OAIA组织记忆推荐用cloudflare的D1或R2进行实现。

***

6，如果agent需要执行代码、运行命令等需要实体环境的行为，可以考虑使用基于cloudfalre的container工具的sandbox。为了控制成本，需要务必注意sandbox的运行时间，并且在运行完毕后立刻sleep或destroy。也同样是为了减少sandbox的运行时间，可以对一些通用库（比如node等）进行预置，而不是每次启动时重复安装。通用库的清单维护应该归为STM级别，因为是跨任务共享的经验沉淀，并且需要决策后引入。

***

7，关于Channels、skills、browser automation、自动化触发和目前阶段的稳定性设计：

### 1. 连接渠道 (Channels): "Web IM Server" 战略

- **决策**: 放弃主动适配 Discord/Telegram/Slack 等第三方 IM 的传统做法。
- **方案**: 自建标准的 Web IM Server。
- **技术实现**:
  - 核心基于 **Cloudflare Durable Objects** 实现 WebSockets 服务，确保高并发下的状态一致性与实时消息推送。
  - 对外暴露标准 API (REST/WebSocket)，允许未来第三方 IM 通过 webhook 或 adapter 主动接入 OAIA。
  - 前端提供一个轻量级 Web Chat 界面供演示与交互。
- **理由**: 降低对第三方平台的依赖，确立数据主权，避免维护 N 个不断变化的第三方 API 适配器。

### 2. 技能系统 (Skills): "引用式" 制度化技能库

- **决策**: 拒绝 Agent 每次从零编写代码工具；拒绝硬编码本地工具。
- **方案**: 建立 **STM (短期记忆) 驱动的技能库**。
- **流程**:
  1. **存储**: 经过验证的技能代码 (JS/Python) 存储在 **R2** 或 **D1** 中。
  2. **注册**: 技能元数据（名称、描述、IO 接口）注册在 **STM (D1)** 表中，必须经过 `ConsensusWorkflow` 投票批准才能上架。
  3. **调用**: Agent 在运行时通过 `getApprovedSkills()` 获取可用工具列表，直接引用执行，而非现场生成代码。
- **理由**: 提高工具执行的稳定性与安全性，符合“组织经验沉淀”的宏观构想。

### 3. 浏览器自动化: "Sandbox Fetch" 轻量化方案

- **决策**: 暂不引入 Puppeteer/Playwright 等重型 Headless Browser。
- **方案**:
  - 优先使用 Sandbox 容器内的 `fetch` / `curl` / `wget` / `jq` 等工具进行数据获取。
  - 对于必须渲染的页面，可考虑引入 Cloudflare Browser Rendering API 作为一种特殊 Skill，但在当前阶段保持架构轻量。
- **理由**: 成本控制与架构简洁性优先。

### 4. 稳定性策略: "Cloudflare Native"

- **决策**: 信任 Cloudflare 基础设施，暂不自建复杂的熔断/多模型故障转移机制。
- **理由**: 避免过度设计，集中资源解决核心业务逻辑。

### 5. 自动化触发: 原生Cron Triggers

- **决策**: 原则上直接使用Cron Triggers，无需自己写代码。
- **方案**:
  - 对于自动任务、循环性状态检查、周期性组织复盘等场景，直接使用Cloudflare的Cron Triggers。
- **理由**: 成本控制与架构简洁性优先。

***

8，关于“skill”和“ability”的区别与关联：

- skill：固化在在组织的STM中的技能清单，通常为调用外部工具、读写文件、查询网络、执行命令等技能。其来源有两种，第一是 **预设（preset）**，比如读写文件、查询网络、执行命令等完成工作所需的最基本技能，但又不是普通大模型直接具备的能力。预设（preset）的skill不可以由Agent直接修改，而是需要提交董事会meeting决策后，由OAIA软件更新进行更新；第二是 **批准（approved）**，比如高频调用或完成任务所必须的外部工具（比如生成PDF等，仅为举例）。批准（approved）的skill为工作Agent发现需要后，提出需求，由CEO meeting决策后，如果通过，则由Agent更新入STM，从而实现组织的自我成长、自我进化与自我优化。
- ability：Agent的底层大模型所应该或可能具备的基础能力，如图像识别、声音识别等。这些能力并非靠组织来定义或引入，而是在agent本身的能力中内置的（基础为文本、高级为图像和声音），这就像组织在雇佣员工时，员工自带的基础能力一样。落实到具体实现方面，其实就是在agent底层代码（比如AI Gateway）在初始化并调用外部大模型时，选择了带（或不带）图像识别/声音识别的大模型一样。

***

9，关于workteam的workflow和Agent的workflow的嵌套架构：
采用Event-Driven Workflow Orchestration (事件驱动的工作流编排) 的标准模式。

1. universal-workteam-Workflow (team leader) :
   - 职责 ：持有业务状态（任务说明、任务进度、子任务列表等），控制流程流转。
   - 循环机制 ：拥有一个 while 循环（或类似的循环结构），负责不断地派发子任务。
   - 挂起等待 ：派发任务后，立即调用 waitForEvent 挂起，不消耗资源。
   - 唤醒决策 ：收到子 Workflow 的完成事件后被唤醒，根据结果和任务计划，决定下一步动作（包括但不限于继续派发子任务、提交决策、提交结果等），或者结束整个流程。
2. universal-Agent-Workflow (Agent) :
   - 职责 ：执行具体的任务（比如写代码、跑测试、查询网络、生成文件、分析图片等）。
   - 生命周期 ：被主 Workflow 唤醒（触发运行），执行任务或结束整个流程。
   - 完成反馈 ：任务完成后，将结果封装为事件发送回主 Workflow。
   - 状态 ：需要保持上下文的 Agent（比如记住了之前的代码修改历史），因此通过 Workflow 的持久化存储来保持“记忆”。

这个架构的优势：

- 解耦 ：Agent是动态“生成”的（如开发和测试），彼此不需要知道对方的存在（与OAIA设计理念高度吻合），只跟workteam-Workflow（team leader）交互。
- 弹性 ：workteam-Workflow和Agent Workflow挂起时不计费（或费用极低），适合持续完成长周期的用户任务，并且在过程中多次审核、修改、优化。
- 容错 ：任何一个环节失败重试都不会影响全局状态。
- 灵活 ：universal-workteam-Workflow和universal-Agent-Workflow是在接收到不同的用户任务后进行动态生成的，虽然注入的记忆与prompt不同，但底层代码是相同的，因此可以实现不同用户任务的灵活处理，又保持了底层代码的高度统一。

***

10，关于agent间通信的设计思路

- 高效：充分利用workflow的长期存在特性，使用workflow内部的内存作为通信邮箱的载体，从而大大简化代码实现，并且极大提升读写速度（与文件IO和网络通信相比）
- 共享：在一个work team间，除了内部内存之外，还应该有“公共文件区”，以实现相对稳定、内容较长的信息传递，以提升上下文的利用效率（对于特定内容，上下文中仅传递文件指针，而不是文件内容本身。由Agent根据自身智力判定是否要去读取该文件内容）。这个设计天然符合工作记忆WM的宏观构想。每一个workteam，每一次任务，都可以建立team内专属的wm区，用于基于D1/R2的信息共享。当然，为避免内容爆炸，还要设计合理的内容回收与清除机制。
- 场景举例：（结合 R2 + WM指针 + Lazy Loading）
  1，立项（挂载黑板）
  Assistant team 派发任务。Workteam 队长接到手，在 R2 开辟一块专属区域：wm/tasks/task\_2026/。
  队长把原始的长篇大论《需求说明书》丢进该文件夹作为 requirement.md。
  2，派发工单（塞指针）
  队长给 Universal Agent 派发任务的信件极其短小：“请审查代码。如果需要全盘背景，请阅读指针：wm/tasks/task\_2026/requirement.md”。
  3，按需阅读（Lazy Load）
  Agent 收到后，依靠自身的 LLM 智力判断。如果觉得没必要，直接开干；如果觉得要看，调用 read\_mem\_file（现有可轻易扩展的技能），花费极少时间获取文本。
  4，共享产出（更新黑板）
  Agent 干完活，把写好的洋洋洒洒几百行代码文件，也保存到这个 R2 目录下 wm/tasks/task\_2026/feature\_x.js。
  然后给队长回信：“大哥，我搞定了，代码放在 feature\_x.js，你看行不行”。队长再去通知 Reviewer 看这个文件。
  5，任务完结（黑板擦除或归档）
  CEO 验收通过。队长把整个文件夹中最重要的交付物提炼出来写入 STM 的 task\_deliveries，然后擦除那些草稿（清空部分 WM），关灯下班。（后续由assistant团队接手，将交付物通过合适的方式提交给用户）

***

11，关于workflow、Agent和skill的权限管理
在一个由众多自主智能体参与的复杂组织中，最致命的内部安全威胁并非外部攻击，而是“认知劫持（Prompt Injection）”引发的智能体越权。大语言模型本质上是缺乏稳态人格的计算图，不论提示词规范多么严格，Agent 总体上仍可能被诱发幻觉，或被恶意的外部输入欺骗，进而认为自己拥有“最高特权”去调用篡改宪法、章程或skill的危险技能（如 oaia\_evolution）。

为了彻底斩断越权隐患，OAIA 在架构上必须确立\*\*“系统物理身份高于智能体主观意志”\*\*的安全正义：

- **不可篡改的系统级工牌（Agent Level）**： 组织不信任 Agent 宣称的自身身份。Agent 的职权身份（如 Level 1 的外围干事、Level 5 的中层队长、Level 9 的最高裁决官）不存储在其可操作的上下文中，而是由运行时（Runtime）在分配任务时，物理硬编码注入到它的执行器容器（AgentConfig）中。大模型无法通过任何手段修改这条写死在系统内存里的规则。
- **工具权柄的阈值门禁（Skill Level）**： 所有组织内流通的动作能力（Skills），必须具备明确的权限准入阈值。常规动作（如搜索、查阅 WM）阈值为低，而影响组织结构、修改 STM/LTM 记忆法则的“主权级技能”（如更新章程）必须被标记为极高阈值。
- **双向核对的物理拦截机制**： 当一个 Agent 受幻觉驱使，试图输出 JSON 请求调用越权工具时，系统的“技能注册与调度中心”并不会直接放行。底层非 AI 逻辑层（TypeScript）将直接比对 **“工具的准入阈值”与“当前智能体的先天物理工牌等级”**。 若出现逾矩：Agent Level < Skill Level，系统将在底层物理切断调用链条，并向下抛出红色的权限阻断报错（Permission Denied）。

哲学内涵总结： 智能体可以且应该具备发散的思维、涌现的创意，甚至犯错的偶尔幻觉。但是，它们改造客观世界的双手，必须被戴上刻有阶级铭文的物理枷锁。 OAIA 的安全性不依赖于大模型“有多乖”，而依赖于一套冷酷而坚固的非 AI 仲裁防火墙。这种基于运行时强身份对照的阈值管控，是确保 AI 组织生命体即便遭遇严重的内部认知感染，也绝不会发生集体自毁和主权丧失的最后一道天堑。

***

12，关于用户交互与核心大脑的异步闭环架构 (The Asynchronous Event Loop)

- **挑战**：用户通过游览器发送消息，但在后台，一个多 Agent 协同的工作流可能耗时数分钟乃至数小时。传统的 HTTP 长链接阻塞（Sync Await）不仅会导致网关超时中断，而且严重违背了 Serverless 计费与容错的最佳实践。
- **核心理念**：彻底解耦“收包中枢”与“思考中枢”，采用全异步的事件驱动与推拉结合模型。
- **流转时序（真·全双工交互）**：
  1. **兵站驻守 (IM Server DO)**：用户前端只与 IM Server（Durable Objects）建立一条长期存活的 WebSocket 管道。DO 作为“边防驿站”，负责防抖、断线重连、以及消息的历史堆叠。
  2. **发射后不管 (Fire-and-Forget)**：用户讲话后，DO 将消息通过内网 `fetch` 给 OAIA Core 后立即关闭这笔 HTTP 交易。绝不傻等 Core 给结果。
  3. **受激唤醒与深度休眠 (Wake & Sleep)**：OAIA Core 拥有极长的声明周期（Workflow）。Assistant Workflow 收到消息，被唤醒。它略作思考，将任务分出线程交给 Workteam Workflow，随即**自身进入深度休眠**。这种状态不消耗任何算力 CPU。
  4. **捷报突来 (Active Callback)**：后台无数个 Worker 跑完了任务，队长带着最终长篇报告叩门。Assistant Workflow 苏醒，接管文件。
  5. **主动叩关 (Webhook Push)**：Assistant Workflow 算出最终回复后，反手发起一个针对 IM Server DO 的调用（POST `/webhook/push`）。
  6. **广播 (Broadcast)**：IM Server DO 收到后门的推送，在自家的连接池中精确定位到该用户的 WebSocket 网线，将捷报推至用户的屏幕。
- **优势**：大模型可以思考几个小时而不必担心断网；前端用户获得极其丝滑的推流体验（因为消息永远是系统“主动发来”的，而不是页面“轮询求来”的）。

***

13，关于技能架构：高内聚的“Skill-Plus”设计模式 (MCP与Skill的分离与融合)

- **挑战**：随着能力扩展，如果把底层API调用（“硬能力/工具/MCP”）和业务操作规范（“软实力/指导/Skill”）混为一谈，会导致代码无限膨胀，且大模型容易遗忘最佳实践规范。传统的把 TypeScript 脚本直接当作 Skill 喂给 Agent 的方式，缺乏上下文约束。
- **核心理念**：将 MCP（工具执行层）与 Skill（经验指导层）从概念和物理上解耦，但通过\*\*以文件夹为组织单元的高内聚结构（Skill-Plus）\*\*进行合并管理。
- **架构形态细分**：
  每一个具体的“技能”都以一个独立文件夹的形式存在。为了实现最佳内聚和清晰的权限/更新边界，一个完整的技能最多由 **3 个核心文件** 组成：
  - `mcp.ts` 或 `mcp_config.json`（可选）：提供底层的硬能力接口或通往外部 API 的凭证。
  - `SKILL.md`（可选）：**创世者的出厂说明书（只读的系统底线）**。来源于官方文档或人类架构师预设的系统契约（如安全红线、核心规范）。无论系统如何自我进化，Agent 必须将其视作**只读 (Read-Only)**，绝对禁止通过工作流重写此文件，以防止系统底座被“认知劫持”或幻觉篡改。
  - `oaia_skills.md`（必备）：**员工的经验笔记本（可读写的群体记忆）**。OAIA 专属的经验沉淀文件。记录 Agent 在实战任务中积累的踩坑记录、最佳实战技巧。系统演化与自我成长时，Agent 在触发并完成共识机制后，即可**可读写 (Read-Write)** 持续追加和更新这个文件。
  在这个设计下存在三种渐进形态：
  1. **完全体（官方 MCP + 官方指导 + 自身经验）**：未来可能引入的具备完整官方定义的生态服务。包含 `mcp_config.json`、`SKILL.md`（官方的最佳实践）以及 `oaia_skills.md`（踩坑后总结的私有经验）。
  2. **自建护栏（官方 MCP + 自身经验）**：比如 GitHub。包含 `mcp_config.json` 开发的硬能力，但因为尚未直接拉取官方长篇 `SKILL.md`，所以主要依赖 `oaia_skills.md` 中记录的诸如“语义化提交”、“不直推主分支”等私有规范进行挂载约束。
  3. **OAIA内部 MCP（内部硬能力 + 预设指导 + 自身经验）**：比如内置的 Sandbox 执行器。包含原生手写的 `mcp.ts`、人类架构师预设的 `SKILL.md` 指导，以及未来可以由 OAIA 自行增补业务教训的 `oaia_skills.md`。
- **运行时调度与渐进式加载 (Progressive Disclosure)**：
  当 Agent 执行任务准备使用特定大型生态 Skill 时，Agent 调度器（Router）会将该技能包下的 `SKILL.md` 和 `oaia_skills.md` 首层内容拼接，作为附加提示词（Context）注入给 Agent。
  - **挑战**：如果未来的官方 Skills 包含数十个子目录的长篇幅库，一次性全量加载会瞬间挤爆 Agent 的上下文窗口（Context Window），造成成本剧增与注意力涣散（Context Rot）。
  - **解决方案**：引入基于 `agentskills.io` 标准的 **“渐进式提示词加载 (Progressive Disclosure)”**。
    1. 首层注入的 `SKILL.md` 不再包含全量知识，而是作为一个 **索引（Index）与决策树（Decision Tree）**。
    2. 当 Agent 遇到具体问题时，它会首先阅读这个索引文件。
    3. 索引文件内置了详细的底层文献指针，引导 Agent 去动态读取更深度的文档。
    4. Agent 通过自身的文件读取能力（如 `memory_access`），按需拉取局部上下文，用完即弃，防范知识爆炸。
       这就将系统的静态知识库完美融入了 WM（工作记忆）的 Lazy Loading 机制中。

***

14，关于 Workflow 与外部调用的关系固化：全异步编排与边界分层

- **定位**：本章用于将 OAIA 在长耗时外部依赖（LLM Gateway、Decider、外部 API/Webhook）上的执行方式固化为组织级技术约束，避免后续实现回退到同步阻塞模式。

### 14.1 设计总原则（必须遵守）

1. **统一异步，不做同步等待**：凡是耗时不确定的外部调用，一律采用“发起任务→Workflow 休眠(waitForEvent)→事件唤醒(sendEvent)”模式。
2. **编排层与执行层分离**：业务 Workflow（Assistant / Workteam / CEO Meeting 等）只负责编排，不直接在核心 step 中长期等待外部系统返回。
3. **标准邮箱协议**：所有回传都通过 Workflow mailbox（事件类型 + payload）完成，不依赖轮询。
4. **指针优先于大文本**：跨 Workflow 传递尽量传指针（R2/D1 路径）而非长文本，降低 payload 风险与上下文膨胀。
5. **失败可恢复**：每个异步环节都必须定义超时、错误态、降级路径，并可被上游明确感知。

### 14.2 标准链路（Canonical Pattern）

统一链路定义如下：

1. 上层 Workflow 在 `step.do` 中只做“启动子任务”（create 或发起调用），不等待长耗时结果。
2. 上层 Workflow 紧接 `step.waitForEvent` 进入休眠态。
3. 下层执行单元完成后，通过 `instance.sendEvent` 或 webhook 回调网关转发事件唤醒上层。
4. 上层 Workflow 醒来后在独立 step 中解析结果并推进流程。

即：**A(create) → A(waitForEvent) → B(execute) → B(sendEvent) → A(resume)**。

### 14.3 分层职责（禁止越层）

1. **业务编排层（Orchestrator Workflows）**
   - 负责任务分解、状态流转、决策门控。
   - 不承担外部模型长耗时执行本体。
2. **能力执行层（Task Workflows / Gateway Workers）**
   - 负责与 LLM Gateway、Decider、第三方 API 的实际交互。
   - 将结果标准化后回传给编排层。
3. **接入转发层（Callback Router）**
   - 负责接收外部 webhook，并按 callbackMeta 精确路由到目标 workflow instance。
   - 不承载业务决策逻辑。

### 14.4 明确禁令（Hard Rules）

1. 禁止在上层核心编排 step 中直接长期 `await` 外部 LLM/Decider 返回。
2. 禁止通过“主动轮询 + sleep 循环”替代 mailbox 事件回传。
3. 禁止让业务层感知 provider 细节（如直接判断某模型服务商实现分支）。
4. 禁止在回调链路中传输超大 payload，超过阈值必须落盘后传指针。

### 14.5 成本与规模化策略（Cloudflare Native）

1. 充分利用 Workflow waiting 态不计并发活跃实例的特性，允许大规模挂起等待。
2. 统一限制事件超时窗口，超时后进入可观测错误路径，不做无限等待。
3. 对高频能力调用采用专用 Task Workflow 进行复用，避免在多个业务 Workflow 中复制编排样板。

### 14.6 LLM 与 Decider 的统一抽象

1. LLM Gateway 与 Decider 在编排语义上等价：都视为“异步能力任务”。
2. 无论底层 provider 如何变化，上层只依赖统一契约：
   - `start(params)`：启动任务
   - `event(type, payload)`：回传结果
   - `timeout/error`：异常状态
3. 这样可在不改业务编排层的前提下替换模型、切换服务商、升级执行策略。

***

15，关于OAIA的Agent角色分工、协作流程与数据记录设计框架

### 🧠 多 Agent 组织系统设计方案（V1.1）

#### 一、设计目标

本系统目标是构建一个可持续运行的 Agent Organization（Agent OS），用于处理复杂、多步骤、多轮迭代的任务。

**核心目标**：

- 任务可拆解、可执行、可验收、可迭代
- 多 Agent 协作但职责清晰
- 支持并行执行
- 支持多轮优化（任务演化链）
- 支持审计、回溯与交付
- 存储与执行解耦，避免冲突与性能瓶颈

#### 二、核心设计原则

- **原则 1：职责强隔离**
  每个 Agent 只负责单一职责：不混合“对话 + 决策 + 执行 + 审核”，避免上下文污染与认知过载。
- **原则 2：PDCA 闭环驱动**
  | 阶段    | Agent          |
  | ----- | -------------- |
  | Plan  | Planner        |
  | Do    | Executor       |
  | Check | Reviewer       |
  | Act   | Reviewer → 新任务 |
- **原则 3：控制面 / 数据面分离**
  - **D1**：控制面（状态、索引、结构）
  - **R2**：数据面（日志、产物、记忆）
  - **KV**：缓存（非关键数据）
- **原则 4：写入所有权原则（关键）**
  每个 Agent 只写自己拥有的字段，不允许覆盖其他字段。
- **原则 5：最小 UPDATE 原则**
  所有 D1 写入必须是字段级更新，不允许整行回写。
- **原则 6：任务不可变 + 多轮演化**
  任务不被覆盖修改，而是通过“新任务”进行版本演进。
- **原则 7：用户级隔离**
  每个用户独立 D1 数据库和 R2 空间（或路径前缀），避免跨用户影响与性能干扰。

#### 三、系统架构：Agent 角色体系

1. **🧑‍💼 前台秘书（Front Secretary）**
   - **职责**：接收用户输入（低延迟）、支持打断、记录原始输入（在DO内存中，以便高频且高性能更新）。
   - **不负责**：决策、写 D1、执行任务。
2. **🧾 后台秘书（Back Secretary）**
   - **职责**：将memo清洗和结构化为notes（在DO内存中，以便高频且高性能更新）、周期性更新到工作记忆（R2）。
3. **🧠 Planner（决策 / 拆解）**
   - **职责**：定期阅读notes，判断是否创建任务、生成任务拆解、定义验收标准（DoD。保存到D1 task list表）。
4. **🎯 Dispatcher（调度器）**
   - **职责**：从 D1 task list表选取任务、流转状态 `pending` → `claimed`、启动 Workflow（Executor）。
5. **⚙️ Executor（执行者）**
   - **职责**：执行任务（Workflow）、写日志 / 产物（R2）、更新执行状态（D1 task list表）。
6. **🔍 Reviewer（审核者）**
   - **职责**：验收结果、写审核结果及审核意见（D1 task list表）、判断是否通过、不通过则生成下一轮任务。
7. **🛡️ Ops（运维）**
   - **职责**：检查异常任务、处理超时 / 卡死 / 重试。

#### 四、系统工作流

```text
User
 ↓
Front Secretary
 ↓
Back Secretary（整理）
 ↓
Planner（拆解 + DoD）
 ↓
D1: tasks（pending）
 ↓
Cron → Dispatcher（每轮1次）
 ↓
claimed → 启动 Workflow
 ↓
Executor（执行）
 ↓
R2（日志 / 产物）
 ↓
D1（reviewing）
 ↓
Reviewer
 ↓
├─ accepted → done
└─ needs_next_round → 新任务
```

#### 五、任务状态机

`pending` → `claimed` → `running` → `reviewing` → `done / failed / retry / cancelled`

- **claimed**：已领取但未启动
- **running**：执行中
- **reviewing**：待审核

#### 六、任务多轮演化模型（核心升级）

**目标**：支持多轮优化、可回溯、可审计、可统计。

**1. 任务关系字段**

| 字段               | 作用      |
| ---------------- | ------- |
| `root_task_id`   | 整个任务链起点 |
| `parent_task_id` | 上一轮任务   |
| `next_task_id`   | 下一轮任务   |
| `round_no`       | 当前轮次    |

**示例结构**：
Task 101 (round 1) → Task 102 (round 2) → Task 103 (round 3, accepted)

**2. 状态与审核分离**

- `status`: pending / running / done / superseded / accepted
- `review_outcome`: accepted / needs\_next\_round / failed

**3. 流转规则**

- **通过**：`status = accepted` 且 `next_task_id = NULL`
- **进入下一轮**：`status = superseded` 且 `review_outcome = needs_next_round` 且 `next_task_id = 新 task`

#### 七、D1 设计（控制面）

- **存储内容**：任务状态、任务关系、执行索引、审核结果摘要。
- **不存储**：长日志、工作记忆全文、中间产物。
- **写入规则**：
  - **字段级所有权**：
    | Agent      | 负责字段                           |
    | ---------- | ------------------------------ |
    | Planner    | `task_spec`, `acceptance_spec` |
    | Dispatcher | `status(claimed)`, `run_id`    |
    | Executor   | `progress`, `status`           |
    | Reviewer   | `review_status`, `outcome`     |
    | Ops        | `health_flag`                  |
  - **字段级 UPDATE**：禁止整行回写，避免 lost update。
    ```sql
    UPDATE tasks SET review_status = ? WHERE task_id = ?
    ```
  - **状态条件更新**：
    ```sql
    UPDATE tasks SET status='running' WHERE task_id=? AND status='claimed'
    ```
  - **原子批处理**：在创建下一轮任务时，使用 D1 `batch()` 事务执行更新旧任务、创建新任务、写入链关系（失败则整体回滚）。

#### 八、R2 设计（数据面）

- **存储内容**：工作记忆、执行日志、中间产物、最终结果、审核报告。
- **路径规范**：
  ```text
  users/{user_id}/tasks/{task_id}/runs/{run_id}/
  ├── working-memory.md
  ├── logs/
  ├── artifacts/
  └── review/
  ```
- **特点**：强一致、对象隔离（天然避免冲突）。

#### 九、KV 使用原则

- **适合**：配置、prompt、cache。
- **不适合**：任务状态、审核结果、执行标记。

#### 十、执行与并行模型

- **模型**：Cron 进行串行调度（每分钟一次），Workflow 进行并行执行，每个任务拥有独立的 `run_id`。
- **特性**：多任务并行执行，无冲突写入（R2 + D1规则保证），完美支持长任务（Workflow）。

#### 十一、系统关键优势

1. **强结构组织**：接近真实组织（前台/后台/决策/执行/审核/运维）。
2. **可持续运行**：PDCA 闭环，自动迭代。
3. **无冲突写入设计**：D1 字段所有权 + R2 路径隔离。
4. **多轮任务可追溯**：root\_task\_id 链 + round\_no + parent/next 指针。
5. **高可扩展性**：用户级隔离，可水平扩展。

#### 十二、最终定义

本系统是一个基于 Cloudflare 平台构建的多 Agent 协作操作系统（Agent OS），通过职责分离、PDCA 闭环、任务链式演化与控制面/数据面分离，实现复杂任务的可执行、可审计与可持续优化。

🧭 一句话总结：**不让 AI 更聪明，而是让多个 AI 像组织一样协作。**

***

16，关于架构演进中部分概念边界与映射关系的统一澄清：
在宏观架构与微观执行的结合中，为避免概念混淆，特此对以下三个关键设计进行映射澄清：

- **事件驱动与数据库调度的边界**：系统内 Agent 之间的调用、Workflow 的互相唤醒，**绝对坚持全异步事件驱动（Event-Driven）**。而 D1 数据库主要用于记录任务的流转状态与关联关系。所谓的“Cron 轮询”，仅针对 `Dispatcher` 这个特殊的非 AI 调度器：它由 Cron 定时唤醒，负责从 D1 中捞取“新建状态”的任务，并\*\*启动（实例化）\*\*对应的 `universal-workteam` Workflow。一旦 Workflow 启动，其内部的执行、状态回写、以及完结后唤醒上层决策（如 CEO Meeting）等所有环节，均回归纯粹的事件驱动。
- **动态生成的 Leader/Worker 与固化职能角色的映射**：前文提到的动态 Workflow 与后文的流水线角色是物理实现与逻辑定义的统一。具体映射关系为：
  - 前台秘书 (Front Secretary) & 后台秘书 (Back Secretary) = **Assistant Team**（负责接待与记忆整理）
  - Planner = **CEO Meeting**（负责宏观决策与任务拆解）
  - Dispatcher = 特殊的定时 Worker（非 AI 调度器，负责衔接 D1 与 Workflow）
  - Executor = **Universal Workteam Workflow**（具体的执行层 Leader 及下属 Agent）
  - Reviewer = **Reviewer**（验收节点）
- **组织记忆（LTM/STM/WM）与物理存储（D1/R2）的落位**：LTM（宪法等）、STM（章程/技能规范等）以及 WM（工作记忆的具体内容/产物/长日志）的**本体绝大部分存储在 R2 中**，以大对象文件的形式存在。唯独 WM 的\*\*索引、状态标记和任务关联树（Task Chain）\*\*存储在 D1 中。这种“R2 存大文本本体，D1 存高频更新索引”的设计，完美契合了前文提到的“只写自己拥有的字段”及“字段级更新”的防冲突原则。

