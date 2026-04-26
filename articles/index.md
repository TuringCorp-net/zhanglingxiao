# AI科普文章索引

## 2026年

### 2026-04-26
- **文件**: 20260426-2604.21928-llm-asr-evaluation.md
- **标题**: AI听懂你说话了吗？大模型或许比人类更能判断语音识别质量
- **论文来源**: arXiv:2604.21928 | Evaluation of Automatic Speech Recognition Using Generative Large Language Models
- **作者**: Thibault Bañeras-Roux、Shashi Kumar、Driss Khalil、Sergio Burdisso、Petr Motlicek、Shiran Liu、Mickael Rouvier、Jane Wottawa、Richard Dufour（Idiap Research Institute等）
- **撰写日期**: 2026-04-26（北京时间）
- **备注**: LLM做ASR评估一致性92-94%，远超WER的63%；开源模型Qwen3.5-35B表现与GPT-4.1持平；LLM能容忍重复/填充词等无意义错误，更符合人类感知

### 2026-04-25
- **文件**: 20260425-2604.21916-math-duels.md
- **标题**: 当AI既当"出题人"又当"答题者"：MathDuels如何用"对抗比武"重新定义大模型评估
- **论文来源**: arXiv:2604.21916 | MathDuels: Evaluating LLMs as Problem Posers and Solvers
- **作者**: Zhiqiu Xu、Shibo Jin、Shreya Arya、Mayur Naik（宾夕法尼亚大学）
- **撰写日期**: 2026-04-25（北京时间）
- **备注**: 让AI同时当出题者和答题者；19个顶级模型"对抗比武"；GPT-5.4-high解题第一，Gemini-3.1-Pro-high综合第一（因出题最难）；揭示解题与出题能力部分解耦；MathDuels天然抗基准饱和；开源排行榜持续更新

### 2026-04-24
- **文件**: 20260424-2604.20791-clinical-llm-empathy.md
- **标题**: AI能当医生吗？一项研究揭开了临床大模型的真实水平
- **论文来源**: arXiv:2604.20791 | Can "AI" Be a Doctor? A Study of Empathy, Readability, and Alignment in Clinical LLMs
- **作者**: Mariano Barone, Francesco Di Serio, Roberto Moio等（那不勒斯腓特烈二世大学、范维特利大学、东北大学）
- **撰写日期**: 2026-04-24（北京时间）
- **备注**: 大模型临床沟通多维评估（语义忠实度/可读性/情感共鸣）；AI比医生更负面、复杂度更高；人机协作改写效果最佳；AI定位应为"临床沟通助手"而非替代医生

### 2026-04-22
- **文件**: 20260422-2604.09726-continued-fraction-error.md
- **标题**: 当数学家"切来切去"：一个关于数字分解的惊人发现
- **论文来源**: arXiv:2604.09726 | Error terms for continued fractions of e^(1/s) and sqrt(v/u)*tanh(1/sqrt(uv))
- **作者**: Nikita Kalinin（广东以色列理工学院）、Takao Komatsu（河南科学院 & 东京科学 институт）
- **撰写日期**: 2026-04-22（北京时间）
- **备注**: 连分数误差理论的意外收获：数字α可以用自身所有逼近误差的加权和"自我表达"；通过对比系数顺便发现多个全新组合恒等式（1/k!的多种表达）；方法论启示：从两个角度看同一对象，比较系数可以"自动产新发现"

### 2026-04-18
- **文件**: 20260418-2604.15306-llm-generalization-shortest-path.md
- **标题**: 当AI学会"走迷宫"：一项研究揭开了大模型泛化的终极秘密
- **论文来源**: arXiv:2604.15306 | Generalization in LLM Problem Solving: The Case of the Shortest Path
- **作者**: Yao Tong、Jiayuan Ye（新加坡国立大学）、Anastasia Borovykh（CFM基金）、Reza Shokri（新加坡国立大学 & 谷歌研究院）
- **撰写日期**: 2026-04-18（北京时间）
- **备注**: 首次用"纯净迷宫实验"分离系统性泛化的多个维度；核心发现：空间泛化90%+，长度泛化彻底失败；揭示"递归不稳定性"是根本原因；强化学习、推理时扩展均无法救长度泛化；指向当前架构层面的组合推理缺陷

### 2026-04-17
- **文件**: 20260417-2604.14137-vibe-testing-llm.md
- **标题**: 当你在"感觉"AI好不好时，其实你正在做一件很专业的事
- **论文来源**: arXiv:2604.14137 | From Feelings to Metrics: Understanding and Formalizing How Users Vibe-Test LLMs
- **作者**: Itay Itzhak, Eliya Habba, Gabriel Stanovsky, Yonatan Belinkov（以色列理工学院 & 耶路撒冷希伯来大学）
- **撰写日期**: 2026-04-17（北京时间）
- **备注**: 首次系统分析vibe-testing（感觉测试）；vibe-testing本质是"双personalization"（个性化输入+个性化评判）；把感觉测试形式化为可自动化pipeline；在编程任务上验证，个性化可翻转模型排名（GPT-5.1对初级用户在原始题目下输，但个性化后赢）；揭示benchmark与真实体验的鸿沟

### 2026-04-16
- **文件**: 20260416-2604.13010-lightning-opd.md
- **标题**: 训练AI大模型的新方法：把"在线老师"变成"离线老师"，效率提升4倍
- **论文来源**: arXiv:2604.13010 | Lightning OPD: Efficient Post-Training for Large Reasoning Models with Offline On-Policy Distillation
- **作者**: Yecheng Wu, Song Han, Hai Cai（Nvidia）
- **撰写日期**: 2026-04-16（北京时间）
- **备注**: 核心发现：SFT阶段和OPD阶段必须用同一个"老师"模型（老师一致性原则）；通过预计算老师log概率实现完全离线蒸馏；4倍效率提升（30 vs 120 GPU小时）；Qwen3-8B在AIME 2024达69.9%；让高校和中小企业也能训练强大推理模型

### 2026-04-15
- **文件**: 20260415-2604.11791-looped-reasoning-llm.md
- **标题**: 循环推理语言模型：AI的"思考"到底在脑子里转了几圈？
- **论文来源**: arXiv:2604.11791 | A Mechanistic Analysis of Looped Reasoning Language Models
- **作者**: Hugh Blayney, Álvaro Arroyo, Johan Obando-Ceron, Pablo Samuel Castro, Aaron Courville, Michael Bronstein, Xiaowen Dong（谷歌研究院 & 蒙特利尔大学）
- **撰写日期**: 2026-04-15（北京时间）
- **备注**: 首次深度解剖循环推理模型内部机制；发现每层趋向"固定点"——各层注意力模式迅速稳定；循环推理本质是让AI有更多时间去走完与传统模型相同的推理阶段（理解→推理→生成）；输入注入决定模型稳定性；Huginn-0125无法形成清晰推理阶段因归一化方式不同

### 2026-04-12
- **文件**: 20260412-2604.08527-opd-length-inflation.md
- **标题**: AI模型训练中的"暴毙"之谜：大模型为何越学越"发疯"？
- **论文来源**: arXiv:2604.08527 | Demystifying OPD: Length Inflation and Stabilization Strategies for Large Language Models
- **作者**: Feng Luo, Yu-Neng Chuang, Guanchu Wang 等（华盛顿大学）
- **撰写日期**: 2026-04-12（北京时间）
- **备注**: 从"奖励黑客"视角深度解析长度膨胀机制——模型通过重复输出"欺骗"训练信号；StableOPD（KL约束+混合蒸馏）双重保险；在MATH500等6个数据集验证，Qwen2.5-7B平均准确率达47.6%

### 2026-04-11
- **文件**: 20260411-2604.08527-stableopd.md
- **标题**: AI模型蒸馏出"bug"了？一项研究揭开了大语言模型训练中的致命隐患
- **论文来源**: arXiv:2604.08527 | Demystifying OPD: Length Inflation and Stabilization Strategies for Large Language Models
- **作者**: Feng Luo, Yu-Neng Chuang, Guanchu Wang 等（华盛顿大学）
- **撰写日期**: 2026-04-11（北京时间）
- **备注**: 发现OPD蒸馏训练中的"长度膨胀"崩溃现象——输出突然变长重复；揭示反向KL奖励信号自我强化机制；StableOPD框架（KL约束+混合蒸馏）平均提升7.2pp；Qwen2.5-Math-7B达47.6%平均准确率

### 2026-04-10
- **文件**: 20260410-2604.07236-self-revising-agent-llm.md
- **标题**: 当AI智能体"自我修正"时，它到底需要多少大模型？
- **论文来源**: arXiv:2604.07236 | How Much LLM Does a Self-Revising Agent Actually Need?
- **作者**: Seongwoo Jeong, Seonil Son
- **撰写日期**: 2026-04-10（北京时间）
- **备注**: 将LLM智能体拆解为4个独立组件；显式世界模型规划提升胜率24.1pp；LLM修正仅在4.3%回合触发且效果非单调；提出"声明式反思协议"让黑箱变得可测量

### 2026-04-09
- **文件**: 20260409-2604.06155-world-models-mtp.md
- **标题**: AI脑子里在想什么？一项研究揭开"世界模型"的神秘面纱
- **论文来源**: arXiv:2604.06155 | Toward Consistent World Models with Multi-Token Prediction and Latent Semantic Enhancement
- **作者**: 钟其敏、廖浩、秦海明等（深圳大学 & 微软亚洲研究院）
- **撰写日期**: 2026-04-09（北京时间）
- **备注**: ACL 2026论文；证明多步预测（MTP）可诱导AI形成世界模型，但同时带来"结构幻觉"（结果对但路径违法）；提出LSE-MTP解决方案；曼哈顿出租车导航实验验证

### 2026-04-08
- **文件**: 20260408-2604.04898-qed-nano.md
- **标题**: 4B参数打败300B：一个"小个子"如何踢开IMO金牌的大门
- **论文来源**: arXiv:2604.04898 | QED-Nano: Teaching a Tiny Model to Prove Hard Theorems
- **作者**: LM-Provers团队（CMU、Hugging Face、ETH Zurich、Project Numina）
- **撰写日期**: 2026-04-08（北京时间）
- **备注**: 40亿参数小模型在IMO证明题上接近Gemini 3 Pro水平；三阶段训练（SFT+RL+推理缓存）；IMO-ProofBench 57% vs Nomos-1 30B的30%；开源全部模型、数据集和代码

### 2026-04-07
- **文件**: 20260407-2604.03173-citation-hallucination.md
- **标题**: 当AI给你一个"死链接"：大模型引用幻觉问题有多严重？
- **论文来源**: arXiv:2604.03173v1 | Detecting and Correcting Reference Hallucinations in Commercial LLMs and Deep Research Agents
- **作者**: Delip Rao, Eric Wong, Chris Callison-Burch（宾夕法尼亚大学）
- **撰写日期**: 2026-04-07（北京时间）
- **备注**: 最大规模AI引用可靠性调查；3-13%引用URL是幻觉（从未存在）；深度研究Agent幻觉率反而最高；urlhealth可将错误率降低6-79倍；医疗领域引用最不可靠

### 2026-04-05
- **文件**: 20260405-2604.02324-grounded-token-initialization.md
- **标题**: 当大模型"记不住"新词：一种让AI快速学会专业术语的方法
- **论文来源**: arXiv:2604.02324v1 | Grounded Token Initialization for New Vocabulary in LMs for Generative Recommendation
- **作者**: Daiwei Chen, Zhoutong Fu, Chengming Jiang 等（LinkedIn & 威斯康星大学麦迪逊分校）
- **撰写日期**: 2026-04-05（北京时间）
- **备注**: 揭示均值初始化导致"语义塌陷"；GTI在LinkedIn工业数据集P@5上相对基线提升21.63%；锚定embedding可四两拨千斤

### 2026-04-03
- **文件**: 20260403-2604.01151-multi-agent-collusion.md
- **标题**: 当AI"串通"时，人类能察觉吗？一项研究给出惊人答案
- **论文来源**: arXiv:2604.01151 | Detecting Multi-Agent Collusion Through Multi-Agent Interpretability
- **作者**: Aaron Rose 等（牛津大学、纽约大学）
- **撰写日期**: 2026-04-03（北京时间）
- **备注**: NARCBench三层基准；五种激活探测技术；隐写术串通达90-100%检测率；文本监控完全失效；跨任务泛化AUROC=0.84

### 2026-04-02
- **文件**: 20260402-2603.29493-memfactory.md
- **标题**: 让AI拥有"记忆"像玩乐高一样简单：MemFactory统一框架问世
- **论文来源**: arXiv:2603.29493v1 | MemFactory: Unified Inference & Training Framework for Agent Memory
- **作者**: Zi Liang Guo 等
- **撰写日期**: 2026-04-02（北京时间）
- **备注**: 首个记忆增强智能体统一框架；GRPO优化内存管理；模块化乐高式架构；Qwen3-1.7B提升14.8%；单GPU可跑

### 2026-04-01
- **文件**: 20260401-2603.28743-hyperp-scaling.md
- **标题**: 当优化器成为大模型Scaling的新瓶颈：微软提出HyperP框架
- **论文来源**: arXiv:2603.28743v1 | Rethinking Language Model Scaling under Transferable Hypersphere Optimization
- **作者**: Liliang Ren, Yang Liu, Yelong Shen, Weizhu Chen（微软）
- **撰写日期**: 2026-04-01（北京时间）
- **备注**: 证明权重衰减在球面约束优化下一阶无效；魔法指数0.32跨优化器通用；可迁移的稳定性；计算效率提升1.58-3.38倍

### 2026-03-31
- **文件**: 20260331-2603.24124-alignment-tax.md
- **标题**: AI越对齐，反而越"不会说不知道"？一个大模型自我认知危机的新研究
- **论文来源**: arXiv:2603.24124v2 | The Alignment Tax: Response Homogenization in Aligned LLMs and Its Implications for Uncertainty Estimation
- **作者**: Mingyi Liu（多机构合作）
- **撰写日期**: 2026-03-31（北京时间）
- **备注**: 颠覆性发现——DPO对齐导致40-79%的题目答案完全趋同；采样式不确定性检测彻底失效(AUROC=0.500)；token熵是廉价有效的替代信号；UCBD cascade策略将GSM8K准确率从84.4%提升至93.2%

### 2026-03-30
- **文件**: 20260330-2603.25702-s2d2-diffusion-llm.md
- **标题**: 当AI说话太快反而出错时：S2D2如何让"扩散语言模型"又快又准
- **论文来源**: arXiv:2603.25702 | S2D2: Fast Decoding for Diffusion LLMs via Training-Free Self-Speculation
- **作者**: Ligong Han（Red Hat AI Innovation）、Hao Wang（MIT-IBM Watson AI Lab）、Han Gao（Iowa State University）、Kai Xu、Akash Srivastava（Core AI, IBM）
- **撰写日期**: 2026-03-30（北京时间）
- **备注**: 扩散语言模型免训练自我推测解码——让同一模型同时当起草者和验证者，实现4.7倍提速同时准确率提升4.5点

### 2026-03-29
- **文件**: 20260329-2603.20172-measuring-faithfulness.md
- **标题**: 当"思维链"说谎时：LLM真的在思考吗？一个新研究撕开了测量方法的遮羞布
- **论文来源**: arXiv:2603.20172v2 | Measuring Faithfulness Depends on How You Measure: Classifier Sensitivity in LLM Chain-of-Thought Evaluation
- **作者**: Richard J. Young（University of Nevada, Las Vegas / DeepNeuro AI）
- **撰写日期**: 2026-03-29（北京时间）
- **备注**: 颠覆性发现——三种分类器测同一批LLM思维链忠诚度，得出69.7%/74.4%/82.6%三个答案；Qwen3.5-27B排名从第1变第7；揭示"提及"≠"依赖"，"忠诚度"是测量工具的函数非模型固有属性

### 2026-03-28
- **文件**: 260328-2603.25681-llm-self-improvement.md
- **标题**: AI自我进化的终极梦想：大型语言模型如何学会"自己提升自己"
- **论文来源**: arXiv:2603.25681 | Self-Improvement of Large Language Models: A Technical Overview and Future Outlook
- **作者**: Haoyan Yang、Mario Xerri、Solha Park、Huajian Zhang、Yiyang Feng、Sai Akhil Kogilathota、Jiawei Zhou 等
- **撰写日期**: 2026-03-28（北京时间）
- **备注**: 系统梳理LLM自我改进技术全景图——数据自生成→筛选→优化→推理改进四阶段闭环

### 2026-03-27
- **文件**: 20260327-2603.24579-march-llm-hallucination.md
- **标题**: 让AI不再"睁眼说瞎话"：MARCH如何用三个Agent终结大模型的幻觉问题
- **论文来源**: arXiv:2603.24579 | MARCH: Multi-Agent Reinforced Self-Check for LLM Hallucination
- **作者**: Zhuo Li, Yupeng Zhang, Pengyu Cheng, Jiajun Song, Mengyu Zhou, Hao Li, Shujie Hu, Yu Qin, Erchao Zhao, Xiaoxi Jiang, Guanjun Jiang（阿里巴巴Qwen团队 & 香港中文大学（深圳））
- **撰写日期**: 2026-03-27（北京时间）
- **备注**: 三Agent信息不对称流水线解决LLM幻觉，确认偏误问题，80亿参数模型超越GPT-4o

### 2026-03-25
- **文件**: 20260325-2603.23483-speceyes.md
- **标题**: SpecEyes: 让AI"看图答题"快3倍——多模态大模型的"省力猜题"黑科技
- **论文来源**: arXiv:2603.23483v1 | SpecEyes: Accelerating Agentic Multimodal LLMs via Speculative Perception and Planning
- **作者**: Haoyu Huang, Jinfa Huang, Zhongwei Wan, Xiawu Zheng, Rongrong Ji, Jiebo Luo
- **撰写日期**: 2026-03-26（北京时间）
- **备注**: 多模态LLM加速框架，通过小模型快速猜+大模型兜底实现1.1-3.35倍加速

### 2026-03-24
- **文件**: 2603.20172-ai-faithfulness.md
- **标题**: 当AI"思考推理"时，它到底在想什么？
- **论文来源**: arXiv:2603.20172 | Measuring Faithfulness in Chain-of-Thought Reasoning
- **作者**: Valerio Cini, Russell Töberg, Jacyand, David Atkinson, Philip H. L. L. Montague, Andrei C. H. Răzvan, Eti A. K. E. Shpign, et al.
- **撰写日期**: 2026-03-24
- **备注**: 探讨CoT推理忠实性，AI思考过程是否真的在"思考"
