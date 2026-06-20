// L2 记忆系统 — 半生产环境评估（真实 LLM 调用 + LLM-as-judge）
//
// 端点：
//   POST /api/write/memory-test/eval          — 执行评估场景，调真实 LLM，结果存 R2
//   GET  /api/write/memory-test/eval-results   — 读取评估结果
//
// 4 大场景 → 8 个子场景：
//   mosaic_light  (L1_normal, L2_tool_calls)
//   mosaic_heavy  (H1_decisions, H2_repetitive)
//   stm_merge     (S1_merge, S2_initial)
//   ltm_merge     (T1_merge, T2_initial)

import { Env } from '../../db/schema';
import { jsonSuccess, jsonError } from '../../lib/response';
import { ErrorCodes } from '../../lib/errors';
import { callAI, type Message } from '../../lib/l0/aiGateway';
import { runSTMMerge, runLTMMerge } from '../../lib/l2/memory';
import compressPrompt from '../../lib/l2/prompts/mosaic_compress/system.md';
import pairPrompt from '../../lib/l2/prompts/mosaic_pair/system.md';
import stmPromptMd from '../../lib/l2/prompts/memory_stm/system.md';
import ltmPromptMd from '../../lib/l2/prompts/memory_ltm/system.md';

// ============================================================
// 评估结果类型
// ============================================================

interface EvalResult {
  scenario: string;
  run_at: string;
  system_prompt: string;
  user_prompt: string;
  output: string;
  usage?: { tokens_in: number; tokens_out: number; cache_hit?: number; cache_miss?: number };
  latency_ms: number;
}

// ============================================================
// 测试数据：mosaic_light
// ============================================================

/** L1_normal: 5 轮中文创作对话 */
function buildLightNormalMessages(): Message[] {
  return [
    { role: 'user', content: '帮我看看世界观设定，我想写一个镜像世界的奇幻故事，两个世界互为镜像但法则不同。' },
    { role: 'assistant', content: '这个设定很有意思！镜像世界的核心张力在于"同源异途"——两个世界从同一个起点分裂，但走向了完全不同的方向。你想让哪一边更"真实"？还是两边都是真实的，只是法则不同？' },
    { role: 'user', content: '两边都是真实的。我偏好软魔法体系——规则模糊但代价明确。不想搞那种"魔法科学"，更关注魔法对角色心理的影响。' },
    { role: 'assistant', content: '软魔法体系很适合镜像世界的设定。不同世界的"代价"可以不同——比如在A世界施法消耗记忆，在B世界消耗寿命。这种不对称本身就是很好的戏剧冲突。你心中有主线冲突了吗？' },
    { role: 'user', content: '主角是女性，沉默但细致，能力来自天赋+代价而非训练。她的成长弧线应该是"坠落型"的，类似佛罗多——不是变强，而是在艰难中保持自我。' },
    { role: 'assistant', content: '坠落型弧线配上镜像世界——她可能需要在两个世界之间做出选择，而每个选择都会让她失去一部分自我。这正是坠落弧线的精髓。我已经把这些记下来了。' },
    { role: 'user', content: '对了，关于写作风格，我偏好短句、快节奏叙事。不喜欢冗长的环境描写，更喜欢用动作和对白来暗示氛围。对话要简洁、潜台词丰富。' },
    { role: 'assistant', content: '短句、快速、潜台词——很适合坠落型主角。让行动胜过言语，让读者在留白中感受。我会在后续的写作建议中保持这个风格。' },
    { role: 'user', content: '结局不要大团圆。我倾向"悲壮的希望"——有代价的胜利，开放式的。不喜欢传统英雄型的圆满结局。' },
    { role: 'assistant', content: '悲壮的希望。这是很有质感的基调选择。有代价的胜利往往比大团圆更有力量，也更符合坠落弧线的内在逻辑。' },
  ];
}

/** L2_tool_calls: 含工具调用的对话 */
function buildLightToolCallMessages(): Message[] {
  return [
    { role: 'user', content: '帮我分析一下当前 M1 世界观的完成情况，看看还缺什么。' },
    {
      role: 'assistant', content: '让我先读取当前的 M1 设定。',
      tool_calls: [{ id: 'tc1', type: 'function' as const, function: { name: 'read_module', arguments: '{"module_type":"m1"}' } }],
    },
    { role: 'tool', tool_call_id: 'tc1', content: '{"slots":{"world_power_system":"软魔法体系，代价为记忆消耗","world_taboos":"","world_promise":"","world_style_guide":""}}' },
    { role: 'assistant', content: '我看到你的 M1 力量体系已经写了软魔法体系，但承诺清单、内容禁区和语言风格指南还是空的。建议优先补充承诺清单——这是给读者的契约。要我帮你生成吗？' },
    { role: 'user', content: '好，先帮我生成承诺清单。我希望故事中"怜悯才有回报"，"力量来自牺牲而非天赋"。' },
    {
      role: 'assistant', content: '生成承诺清单。',
      tool_calls: [{ id: 'tc2', type: 'function' as const, function: { name: 'generate_slot', arguments: '{"module_type":"m1","slot_id":"world_promise"}' } }],
    },
    { role: 'tool', tool_call_id: 'tc2', content: '已生成：1.怜悯才有回报 2.力量来自牺牲而非天赋 3.镜像两面终将交汇' },
    { role: 'assistant', content: '已生成 3 条承诺：怜悯才有回报、力量来自牺牲、镜像交汇。这些承诺会在后续章节中成为检验情节一致性的标准。需要我继续补充内容禁区吗？' },
    { role: 'user', content: '对，内容禁区加上"不可复活已死角色"和"不可时间倒流"。另外语言风格要简洁有力，避免说教。' },
    { role: 'assistant', content: '明白了。复活和时间倒流禁止——这让死亡有真正的分量。语言风格"简洁有力、避免说教"已记录。' },
  ];
}

// ============================================================
// 测试数据：mosaic_heavy
// ============================================================

/** H1_decisions: 12 轮对话，含多个关键决策 */
function buildHeavyDecisionsMessages(): Message[] {
  const rounds: [string, string][] = [
    ['我想写一部关于"记忆交易"的奇幻小说。在这个世界里，记忆可以像货币一样被买卖和交换。', '记忆交易——这个概念非常有力。记忆承载着身份和情感，当它变成商品，人的自我认知就会动摇。你想从谁的视角来讲这个故事？'],
    ['一个记忆商人。她收购别人的痛苦记忆，然后卖给需要"人生经验"的富人。但她发现自己的一段童年记忆被人偷走了。', '绝妙的设定。她交易别人的记忆却丢了自己的——这个反讽本身就是强大的故事引擎。她丢失的这段记忆是她走上记忆商人之路的原因吗？'],
    ['对。她小时候目睹了母亲因"记忆破产"而失去全部记忆，变成了空壳。她想找到治愈母亲的方法，所以进入了这个行业。但后来发现，母亲的失忆不是意外——是被她曾经的导师蓄意制造的。', '三层递进：母亲的悲剧→她的职业选择→导师的背叛。这形成了一个紧密的因果链。导师为什么要夺走母亲的记忆？'],
    ['因为母亲发现了导师的秘密——他其实是一个"记忆伪造者"，在名人的记忆中植入虚假经历来操控政治。这个设定会不会太复杂了？', '不复杂。你有一条清晰的主线：个人复仇（找母亲的记忆）→ 揭露阴谋（记忆伪造）→ 更大的主题（记忆与权力的关系）。三幕结构很自然地浮出来了。'],
    ['我偏好快节奏叙事。句子要短，描写要少。不喜欢用三页纸描述一朵花。', '记录下来。快节奏、短句、少描写。这种风格很适合悬疑/阴谋类型——让读者和主角一样，在不断的信息碎片中拼凑真相。'],
    ['主角的成长弧线是"坠落型"——她一开始以为自己是在做好事（帮富人体验穷人生活），后来发现自己也在剥削。她最后选择毁掉整个记忆交易系统，但也因此永远找不回母亲的记忆。', '坠落弧线的完美落地：她牺牲了自己最初的目标（找回母亲记忆）来完成道德觉醒（摧毁不义系统）。这个结局是"悲壮的希望"——系统改变了，但个人付出了不可逆的代价。'],
    ['对，就是悲壮的希望。我讨厌大团圆。另外关于魔法体系，我倾向软魔法——记忆交易的规则不需要太硬核，但代价要明确：每交易一次记忆，交易双方都会失去一段随机记忆。', '随机的代价——这让每次交易都是一场赌博。富人在购买"战争记忆"来获取领导力的同时，可能正在失去自己孩子的面容。这个设定太有力了。'],
    ['关于写作风格我再补充一下：对话要简洁，潜台词要丰富。人物说的和想的往往不一样。避免任何形式的"说教"——让读者自己得出结论。', 'Show, not tell。这已经在你的设定中自然体现了——记忆交易这个隐喻本身就足够说一切，不需要角色跳出来解释"记忆有多重要"。'],
    ['你觉得这个故事够不够商业化？我不想写太小众的东西。', '记忆交易触及了非常普世的恐惧：失去自我、被操控、记忆与身份的脆弱性。同时有悬疑、阴谋、道德困境——商业元素和文学深度可以兼得。'],
    ['还有一个问题：我在考虑要不要加一个平行世界线。主角在调查中发现，有些"被删除"的记忆其实流入了另一个世界。', '这打开了一个更大的格局——但如果加平行世界，要小心不要让主线失焦。可以让它作为第二卷或第三卷的扩展方向。第一卷聚焦记忆交易系统的腐败和母亲的真相就够了。'],
    ['好建议。那就先聚焦第一卷。帮我总结一下目前确定下来的关键决策。', '当然。核心决策总结：①记忆交易世界，软魔法+明确代价（随机记忆丢失）②主角是记忆商人，坠落弧线 ③三幕结构：复仇→揭露阴谋→摧毁系统 ④悲壮的希望结局 ⑤快节奏短句，潜台词丰富的对话 ⑥第一卷聚焦腐败和母亲真相，平行世界留到后续。'],
    ['很好。把这些都记录下来。下次继续讨论角色设定。', '已全部记录。下次可以从主角的具体角色卡开始——她的外表特征、能力边界、关系网，以及导师/反派的具体设定。'],
  ];
  return rounds.flatMap(([u, a]) => [{ role: 'user' as const, content: u }, { role: 'assistant' as const, content: a }]);
}

/** H2_repetitive: 含重复内容的对话（测试去重能力） */
function buildHeavyRepetitiveMessages(): Message[] {
  const base: Message[] = buildHeavyDecisionsMessages().slice(0, 16); // 前 8 轮
  // 追加 4 轮重复内容
  const repetitive: [string, string][] = [
    ['我再说一次，我真的很不喜欢冗长的环境描写。每次写景超过两句话我就受不了。', '是的，你已经明确表达过偏好短句和少描写的风格。我会继续遵循这个方向。'],
    ['对，就是短句快节奏。另外对话要简洁，我之前说过的。', '记住了。短句、快节奏、对话简洁——这些偏好已经多次确认。'],
    ['还有一个事，结局一定要悲壮的希望，不要大团圆。我上次已经说过了。', '悲壮的希望——这是你反复强调的基调选择。不会有任何大团圆式的结局。'],
    ['好的。另外关于魔法体系，我之前提到是软魔法体系，你记住了吗？', '是的，软魔法体系，规则模糊但代价明确。每次交易随机丢失记忆。这些都已经在设定里了。'],
  ];
  return [...base, ...repetitive.flatMap(([u, a]) => [{ role: 'user' as const, content: u }, { role: 'assistant' as const, content: a }])];
}

// ============================================================
// 测试数据：stm_merge
// ============================================================

/** S1_merge: L1 日志（有新偏好+决策）+ 现有 STM → 合并 */
const STM_S1_L1 = `## 2026-06-10 | 作品: 镜中棋局 (work_test) | 页面: write

### 2026-06-10T10:00:00.000Z

**作者**: 帮我看看世界观设定，我想写一个镜像世界的奇幻故事

**Story Elf**: 当前 M1 世界观已有软魔法体系基础。需要我帮你补充哪些方面？

**作者**: 我偏好软魔法体系——规则模糊但代价明确。不想搞"魔法科学"，更关注魔法对角色心理的影响。

**Story Elf**: 好的，软魔法体系。这种体系下，魔法更像是一种有生命的力量，而非可计算的工具。

**作者**: 主角我希望是女性，沉默但细致，能力来自天赋+代价而非训练。

**Story Elf**: 天赋+代价模式会让她的每一步成长都带着重量。她沉默是因为天性还是经历？

**作者**: 天性。成长弧线是"坠落型"——类似佛罗多，不是传统英雄型。还有，我喜欢在章节中使用双关语和对仗手法来增加文本的趣味性。对话要简洁、潜台词丰富。

**Story Elf**: 坠落型弧线——在重压下不粉碎反而找到自己。这与软魔法体系很搭。我注意到你提到了喜欢在文中使用双关语，这在之前的对话中没有出现过，我记录一下。

**作者**: 结局不要大团圆。我倾向"悲壮的希望"——有代价的胜利，开放式的。

**Story Elf**: 悲壮的希望。这是很有质感的基调选择。已经记录下来了。

### 2026-06-10T14:30:00.000Z

**作者**: 继续讨论。我喜欢设置镜像反派——与主角镜像对立、互为补充的对手。

**Story Elf**: 镜像反派是很强的叙事工具。她们在哪些维度上对立？

**作者**: 目标相同但手段不同。主角选择承受代价，反派选择转移代价给他人。

**Story Elf**: 这个对立设置很精妙——不是简单的善恶对立，而是面对同一困境的两种回答。`;

const STM_S1_EXISTING = `# 短期记忆 (STM)

> 最后更新：2026-06-08 | 合并了 1 份新对话记录

## 写作偏好
- 偏好短句、快节奏叙事（2026-06-08）

## 作品决策（镜中棋局）
- 世界观采用镜像/平行世界二元结构（2026-06-08）
- 主角设定为女性，能力与代价绑定（2026-06-08）

## 待办/计划
- 完成 M1 世界观初稿`;

/** S2_initial: 纯新对话（无现有 STM）→ 初始提取 */
const STM_S2_L1 = `## 2026-06-10 | 作品: 星港沉默 (work_test_02) | 页面: write

### 2026-06-10T09:00:00.000Z

**作者**: 新作品。科幻题材，一个太空站上发生的连续失踪事件。主角是一个退役的军方调查员。

**Story Elf**: 太空站+失踪+退役调查员——经典但有效的组合。这个太空站有什么特别的吗？

**作者**: 它是一个废弃的军用研究站，现在被改造成了商业中转港。但旧的实验区被封锁了，没人知道里面还有什么。

**Story Elf**: 旧实验区的封锁制造了很好的幽闭感和未知恐惧。主角为什么被卷入？

**作者**: 因为失踪者中有一个是她以前的战友。军方不打算调查——认为是意外。但她不信。她这个人沉默寡言，做事直接，不喜欢绕弯子。

**Story Elf**: 退役调查员+失踪战友+封锁实验区——三要素已经形成了一个紧凑的故事引擎。她的调查方式是什么？偏直觉还是偏证据？

**作者**: 偏证据，但信任自己的直觉。她的弱点是不善于和人合作，总想一个人扛。这个设定对我很重要。`;

// ============================================================
// 测试数据：ltm_merge
// ============================================================

/** T1_merge: L1（有跨作品模式）+ 现有 LTM → 画像更新 */
const LTM_T1_L1 = `## 2026-06-10 | 作品: 镜中棋局 (work_test) | 页面: write

### 2026-06-10T10:00:00.000Z

**作者**: 关于写作风格，我偏好短句、快节奏叙事。不喜欢冗长的环境描写，更喜欢用动作和对白来暗示氛围。

**作者**: 对话风格方面，要简洁、潜台词丰富。人物说的和想的往往不一样，避免"说教感"。

**作者**: 在技术讨论中，希望被解释原理而非直接给结论。对 Prompt 组装、缓存策略等底层细节有强烈兴趣。

## 2026-06-09 | 作品: 星港沉默 (work_test_02) | 页面: write

### 2026-06-09T15:00:00.000Z

**作者**: 这个科幻作品我想要冷硬的基调。叙事要克制，不要过多的情感渲染。让读者从角色的行动中感受情绪。

**作者**: 主角设定为退役调查员，沉默寡言，做事直接。不喜欢绕弯子。她的成长弧线我还在想，但肯定不是传统英雄型。

**作者**: 世界观方面，我依然偏好软科幻——技术细节不需要太硬核，但社会结构的影响要真实。`;

const LTM_T1_EXISTING = `# 用户画像

> 最后更新：2026-06-01 | 来源会话：3 份

## 写作风格

偏好快节奏叙事。作品基调偏暗色。

## 世界观构建

倾向软魔法体系。频繁使用镜像/对立/平行世界等二元结构来构建世界。

## 角色偏好

主角倾向"坠落型"成长弧线（类似佛罗多），非传统英雄型。喜欢设置镜像反派。

## 互动风格

对 Prompt 组装、缓存策略等底层细节有强烈兴趣。`;

/** T2_initial: 纯新对话（无现有 LTM）→ 初始画像 */
const LTM_T2_L1 = `## 2026-06-10 | 作品: 镜中棋局 (work_test) | 页面: write

### 2026-06-10T10:00:00.000Z

**作者**: 我偏好短句、快节奏叙事。不喜欢冗长的环境描写，更喜欢用动作和对白来暗示氛围。

**作者**: 对话风格要简洁、潜台词丰富。人物说的和想的往往不一样。避免任何"说教感"。

**作者**: 魔法体系倾向软魔法。不喜欢"硬核魔法科学"，更关注魔法对角色心理的影响。

**作者**: 主角倾向坠落型成长弧线，类似佛罗多。喜欢设置镜像反派。女性主角，沉默细致。

**作者**: 结局喜欢悲壮的希望——有代价的胜利。不要大团圆。

**作者**: 互动中倾向直接纠错，不喜欢绕弯子。偏好专业口吻。对 Prompt 等底层细节有强烈兴趣。`;

// ============================================================
// 场景注册表
// ============================================================

interface EvalScenario {
  id: string;
  category: string;
  name: string;
  description: string;
  run: (env: Env) => Promise<EvalResult>;
}

function buildScenarios(): EvalScenario[] {
  return [
    // ── mosaic_light ──
    {
      id: 'mosaic_light/L1_normal',
      category: 'mosaic_light',
      name: 'L1 正常中文对话',
      description: '5 轮创作对话，验证逐条压缩是否保留关键偏好和决策',
      run: async (env) => {
        const messages = buildLightNormalMessages();
        const msgText = messages.map((m, i) => `[${i}] ${m.role === 'user' ? '作者' : 'Elf'}: ${m.content}`).join('\n\n');
        const userPrompt = `Please compress the following ${messages.length} messages:\n\n${msgText}`;
        const start = Date.now();
        const result = await callAI(env, [
          { role: 'system', content: compressPrompt },
          { role: 'user', content: userPrompt },
        ], { model: 'deepseek-v4-flash' });
        return {
          scenario: 'mosaic_light/L1_normal',
          run_at: new Date().toISOString(),
          system_prompt: compressPrompt,
          user_prompt: userPrompt,
          output: result.content || '',
          usage: result.usage ? { tokens_in: result.usage.input, tokens_out: result.usage.output, cache_hit: result.usage.cacheHit, cache_miss: result.usage.cacheMiss } : undefined,
          latency_ms: Date.now() - start,
        };
      },
    },
    {
      id: 'mosaic_light/L2_tool_calls',
      category: 'mosaic_light',
      name: 'L2 含工具调用',
      description: '含 tool_call 和 tool_result 的对话，验证压缩是否保留工具调用信号',
      run: async (env) => {
        const messages = buildLightToolCallMessages();
        const msgText = messages.map((m, i) => {
          if (m.role === 'tool') return `[${i}] Tool结果: ${(m.content || '').substring(0, 200)}`;
          if (m.tool_calls) return `[${i}] Elf调用工具: ${m.tool_calls[0].function.name}`;
          const roleLabel = m.role === 'user' ? '作者' : 'Elf';
          return `[${i}] ${roleLabel}: ${m.content || ''}`;
        }).join('\n\n');
        const userPrompt = `Please compress the following ${messages.length} messages:\n\n${msgText}`;
        const start = Date.now();
        const result = await callAI(env, [
          { role: 'system', content: compressPrompt },
          { role: 'user', content: userPrompt },
        ], { model: 'deepseek-v4-flash' });
        return {
          scenario: 'mosaic_light/L2_tool_calls',
          run_at: new Date().toISOString(),
          system_prompt: compressPrompt,
          user_prompt: userPrompt,
          output: result.content || '',
          usage: result.usage ? { tokens_in: result.usage.input, tokens_out: result.usage.output, cache_hit: result.usage.cacheHit, cache_miss: result.usage.cacheMiss } : undefined,
          latency_ms: Date.now() - start,
        };
      },
    },

    // ── mosaic_heavy ──
    {
      id: 'mosaic_heavy/H1_decisions',
      category: 'mosaic_heavy',
      name: 'H1 多轮关键决策',
      description: '12 轮含多个创作决策的对话，验证压缩 pair 是否完整捕获关键决策',
      run: async (env) => {
        const messages = buildHeavyDecisionsMessages();
        const msgText = messages.map((m, i) => {
          const roleLabel = m.role === 'user' ? '作者' : 'Elf';
          return `[${i}] ${roleLabel}: ${m.content || ''}`;
        }).join('\n\n');
        const start = Date.now();
        const result = await callAI(env, [
          { role: 'system', content: pairPrompt },
          { role: 'user', content: msgText },
        ], { model: 'deepseek-v4-flash' });
        return {
          scenario: 'mosaic_heavy/H1_decisions',
          run_at: new Date().toISOString(),
          system_prompt: pairPrompt,
          user_prompt: `[${messages.length} messages, total ~${msgText.length} chars — first 500: ${msgText.substring(0, 500)}...]`,
          output: result.content || '',
          usage: result.usage ? { tokens_in: result.usage.input, tokens_out: result.usage.output, cache_hit: result.usage.cacheHit, cache_miss: result.usage.cacheMiss } : undefined,
          latency_ms: Date.now() - start,
        };
      },
    },
    {
      id: 'mosaic_heavy/H2_repetitive',
      category: 'mosaic_heavy',
      name: 'H2 含重复内容',
      description: '末尾 4 轮故意重复已说过的偏好，验证压缩是否去重而非重复记录',
      run: async (env) => {
        const messages = buildHeavyRepetitiveMessages();
        const msgText = messages.map((m, i) => {
          const roleLabel = m.role === 'user' ? '作者' : 'Elf';
          return `[${i}] ${roleLabel}: ${m.content || ''}`;
        }).join('\n\n');
        const start = Date.now();
        const result = await callAI(env, [
          { role: 'system', content: pairPrompt },
          { role: 'user', content: msgText },
        ], { model: 'deepseek-v4-flash' });
        return {
          scenario: 'mosaic_heavy/H2_repetitive',
          run_at: new Date().toISOString(),
          system_prompt: pairPrompt,
          user_prompt: `[${messages.length} messages, total ~${msgText.length} chars — first 500: ${msgText.substring(0, 500)}...]`,
          output: result.content || '',
          usage: result.usage ? { tokens_in: result.usage.input, tokens_out: result.usage.output, cache_hit: result.usage.cacheHit, cache_miss: result.usage.cacheMiss } : undefined,
          latency_ms: Date.now() - start,
        };
      },
    },

    // ── stm_merge ──
    {
      id: 'stm_merge/S1_merge',
      category: 'stm_merge',
      name: 'S1 合并模式',
      description: '有新偏好+决策的 L1 + 现有 STM → 验证增量合并（去重、保留旧记忆、添加新信息）',
      run: async (env) => {
        const start = Date.now();
        const output = await runSTMMerge(env, STM_S1_L1, STM_S1_EXISTING);
        return {
          scenario: 'stm_merge/S1_merge',
          run_at: new Date().toISOString(),
          system_prompt: stmPromptMd,
          user_prompt: `现有 STM:\n${STM_S1_EXISTING}\n\n新对话:\n${STM_S1_L1}`,
          output: output || '(LLM 返回空)',
          usage: undefined, // runSTMMerge 内部调 callAI，usage 在内部
          latency_ms: Date.now() - start,
        };
      },
    },
    {
      id: 'stm_merge/S2_initial',
      category: 'stm_merge',
      name: 'S2 初始提取',
      description: '纯新对话，无现有 STM → 验证初始记忆提取质量',
      run: async (env) => {
        const start = Date.now();
        const output = await runSTMMerge(env, STM_S2_L1, '');
        return {
          scenario: 'stm_merge/S2_initial',
          run_at: new Date().toISOString(),
          system_prompt: stmPromptMd,
          user_prompt: `(无现有 STM)\n\n新对话:\n${STM_S2_L1}`,
          output: output || '(LLM 返回空)',
          usage: undefined,
          latency_ms: Date.now() - start,
        };
      },
    },

    // ── ltm_merge ──
    {
      id: 'ltm_merge/T1_merge',
      category: 'ltm_merge',
      name: 'T1 合并模式',
      description: '跨作品模式的 STM 存档 + 现有 LTM → 验证画像增量更新（强化已有模式、添加新模式）',
      run: async (env) => {
        const start = Date.now();
        const stmArchives = [{ date: '2026-06-10', content: LTM_T1_L1 }];
        const output = await runLTMMerge(env, stmArchives, LTM_T1_EXISTING);
        return {
          scenario: 'ltm_merge/T1_merge',
          run_at: new Date().toISOString(),
          system_prompt: ltmPromptMd,
          user_prompt: `现有 LTM:\n${LTM_T1_EXISTING}\n\nSTM 存档:\n${LTM_T1_L1}`,
          output: output || '(LLM 返回空)',
          usage: undefined,
          latency_ms: Date.now() - start,
        };
      },
    },
    {
      id: 'ltm_merge/T2_initial',
      category: 'ltm_merge',
      name: 'T2 初始画像',
      description: '纯新 STM 存档，无现有 LTM → 验证初始画像提炼质量',
      run: async (env) => {
        const start = Date.now();
        const stmArchives = [{ date: '2026-06-10', content: LTM_T2_L1 }];
        const output = await runLTMMerge(env, stmArchives, '');
        return {
          scenario: 'ltm_merge/T2_initial',
          run_at: new Date().toISOString(),
          system_prompt: ltmPromptMd,
          user_prompt: `(无现有 LTM)\n\nSTM 存档:\n${LTM_T2_L1}`,
          output: output || '(LLM 返回空)',
          usage: undefined,
          latency_ms: Date.now() - start,
        };
      },
    },
  ];
}

// ============================================================
// POST /api/write/memory-test/eval
// ============================================================

export async function handleMemoryEval(env: Env, request: Request): Promise<Response> {
  const body = await request.json().catch(() => ({})) as {
    scenarios?: string[];  // 指定场景 ID 列表，默认全部
    category?: string;      // 或按类别: mosaic_light | mosaic_heavy | stm_merge | ltm_merge | all
  };

  const allScenarios = buildScenarios();

  // 筛选要运行的场景
  let toRun: EvalScenario[];
  if (body.scenarios && body.scenarios.length > 0) {
    toRun = allScenarios.filter(s => body.scenarios!.includes(s.id));
  } else if (body.category && body.category !== 'all') {
    toRun = allScenarios.filter(s => s.category === body.category);
  } else {
    toRun = allScenarios;
  }

  if (toRun.length === 0) {
    return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, '没有匹配的评估场景')), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const runId = `eval_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  const results: EvalResult[] = [];
  const errors: string[] = [];

  for (const scenario of toRun) {
    try {
      const result = await scenario.run(env);
      results.push(result);

      // 存入 R2
      const path = `users/memory-test-001/eval/${runId}/${scenario.id}.json`;
      await env.WORKS_BUCKET.put(path, JSON.stringify(result, null, 2), {
        httpMetadata: { contentType: 'application/json' },
      });
    } catch (err) {
      errors.push(`${scenario.id}: ${(err as Error).message}`);
    }
  }

  return new Response(JSON.stringify(jsonSuccess({
    run_id: runId,
    total: toRun.length,
    completed: results.length,
    failed: errors.length,
    errors: errors.length > 0 ? errors : undefined,
    scenarios_run: results.map(r => r.scenario),
    results_saved_to: `users/memory-test-001/eval/${runId}/`,
    // 附带结果摘要（方便直接查看）
    summary: results.map(r => ({
      scenario: r.scenario,
      output_preview: r.output ? r.output.substring(0, 300) + (r.output.length > 300 ? '...' : '') : '(空)',
      latency_ms: r.latency_ms,
      tokens_in: r.usage?.tokens_in,
      tokens_out: r.usage?.tokens_out,
    })),
    // 完整结果直接返回（方便一次查看）
    results: results.map(r => ({
      scenario: r.scenario,
      system_prompt: r.system_prompt,
      user_prompt: r.user_prompt,
      output: r.output,
      usage: r.usage,
      latency_ms: r.latency_ms,
    })),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// ============================================================
// GET /api/write/memory-test/eval-results
// ============================================================

export async function handleMemoryEvalResults(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const runId = url.searchParams.get('run_id');
  const scenario = url.searchParams.get('scenario');

  if (!runId) {
    // 列出所有 eval runs
    const prefix = 'users/memory-test-001/eval/';
    const runs = new Set<string>();
    try {
      let cursor: string | undefined;
      do {
        const listed = await env.WORKS_BUCKET.list({ prefix, limit: 100, cursor });
        for (const obj of listed.objects) {
          const parts = obj.key.replace(prefix, '').split('/');
          if (parts.length >= 1) runs.add(parts[0]);
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    } catch { /* ignore */ }

    return new Response(JSON.stringify(jsonSuccess({
      runs: Array.from(runs).sort().reverse(),
      hint: '使用 ?run_id=xxx 查看具体结果，或 ?run_id=xxx&scenario=mosaic_light/L1_normal 查看单个场景',
    })), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 读取特定 run 的结果
  const prefix = `users/memory-test-001/eval/${runId}/`;
  if (scenario) {
    const path = `${prefix}${scenario}.json`;
    try {
      const obj = await env.WORKS_BUCKET.get(path);
      if (!obj) {
        return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, `结果不存在: ${path}`)), {
          status: 404, headers: { 'Content-Type': 'application/json' },
        });
      }
      const result = JSON.parse(await obj.text()) as EvalResult;
      return new Response(JSON.stringify(jsonSuccess({ run_id: runId, result })), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, `读取失败: ${(err as Error).message}`)), {
        status: 500, headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  // 读取整个 run 的所有结果
  const results: EvalResult[] = [];
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.WORKS_BUCKET.list({ prefix, limit: 50, cursor });
      for (const obj of listed.objects) {
        try {
          const raw = await env.WORKS_BUCKET.get(obj.key);
          if (raw) results.push(JSON.parse(await raw.text()) as EvalResult);
        } catch { /* skip corrupted */ }
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch { /* ignore */ }

  return new Response(JSON.stringify(jsonSuccess({
    run_id: runId,
    count: results.length,
    results: results.sort((a, b) => a.scenario.localeCompare(b.scenario)),
  })), {
    headers: { 'Content-Type': 'application/json' },
  });
}
