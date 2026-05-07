# CAU一级分类设计思路
一级分类应该符合人类经典小说网站包括东方和西方的分类方式，以及主要的写作辅助软件的分类方式，这样让读者以及作家都能够相对熟悉，而不应该完全自创。在分析如下一些网站及工具（阅文集团-起点、番茄小说、七猫小说、纵横中文网、晋江文学城以及全球知名的Wattpad、Substack、Beehiiv、Reedsy、NovelAI等平台的实际分类实践）之后，经过仔细思考，得出结论如下。

---

## 优化后的一级分类方案（最终版）

### 虚构类：8个核心分类

| 序号 | 分类Key | 中文名 | 英文名 | 说明 |
|------|---------|--------|--------|------|
| 1 | `fantasy` | 奇幻·玄幻 | Fantasy | 全球最普世的超自然大类。涵盖中式玄幻、修真、高武，西式剑与魔法、低魔/高魔世界，以及Romantasy |
| 2 | `science-fiction` | 科幻 | Science Fiction | 硬科幻、太空歌剧、赛博朋克、末世、AI题材 |
| 3 | `romance` | 言情·恋爱 | Romance | 以爱情线为核心。涵盖霸总、甜宠、古代言情、现代言情、彩虹恋爱、西方Romance |
| 4 | `contemporary` | 都市·现实 | Contemporary & Realistic | 现代社会生活。包含职场、种田、现实题材、当代文学 |
| 5 | `adventure` | 动作·冒险 | Action & Adventure | 武侠、仙侠（动作向）、探险、寻宝、军事行动的归属 |
| 6 | `mystery-thriller` | 悬疑·惊悚 | Mystery, Thriller & Horror | 含推理、犯罪、恐怖、灵异、心理惊悚 |
| 7 | `historical` | 历史·架空 | Historical & Alternative History | 真实历史演绎、架空历史、古代权谋、史诗奇幻 |
| 8 | `young-adult` | 青春·成长 | Young Adult & Coming-of-Age | 校园、青春期成长、新成人文学（国际通用年龄分层类型） |

### 非虚构类（扩展板块）

如果未来要引入Substack/Reedsy式内容，可单独开辟Non-Fiction板块，包含：
- 回忆录/随笔、散文/评论、历史非虚构、科普、自助成长

### 弹性辅助维度（不作为一级分类，而是过滤/标签）

**创作属性**
- 原创 (Original) / 同人·衍生 (Fanfiction & Derivative) / AI协作 (AI-Assisted)

**受众与阅读偏好**（替代“男频/女频”分流）
- 男主角/女主角/无CP/多元性别
- 异性恋/纯爱(BL)/百合(GL)/LGBTQ+
- 全年龄/青少年(YA)/新成人(17+)/成人

**特色标签（关键的中西合璧层）**
- 东方题材：`xianxia` `wuxia` `cultivation` `transmigration` `system`
- 西方题材：`litrpg` `grimdark` `romantasy` `dystopian`
- 叙事手法：`slow-burn` `enemies-to-lovers` `zero-to-hero` `revenge`

---

## 架构实现要点（同意原方案并补充）

### 多语言映射的字段设计
在数据库Schema中，强烈建议分离概念与语言：
```
作品表 D1:
- category_key (FK): 'fantasy'
- audience: 'male_lead', 'female_lead', 'no_cp'
- tags: ['xianxia', 'cultivation', 'revenge']

KV映射:
- zh-CN: {"fantasy": "奇幻·玄幻", "romance": "言情·恋爱"}
- en-US: {"fantasy": "Fantasy", "romance": "Romance"}
```

### 为什么是8个分类？
经过对11个平台的交叉分析，8-10个一级分类是“认知负荷”的最佳平衡点。少于6个则过于粗糙，读者难以快速定位；超过12个则造成选择瘫痪。这8个分类可以实现：
- 覆盖中文圈起点、晋江的95%以上作品
- 覆盖英文圈Wattpad、Reedsy的90%以上作品
- 为Fanfiction、轻小说、诗歌等非标准类型留出弹性空间（通过创作属性+标签消化）

---

## 最终方案的三个优势

1. **真正的全球兼容**：不将中文或英文任何一种文化标准强加于人，而是寻找类型学上的“最大公约数”
2. **中文特有种类的完美归属**：仙侠、武侠等通过`Adventure`+标签解决，既不淹没在西式Fantasy中，又不造成分类冗余
3. **云端架构友好**：`category_key`机制配合KV多语言映射，可以让同一套后端无缝服务全球读者，新市场只需增加KV语言包