# AI科普文章索引

## 2026年

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
