/**
 * ============================================
 * 选品 Agent 每日采集状态文件
 * ============================================
 *
 * 工作流程：
 * 1. 定时触发 → 读取 state，按 lastCrawled 排序
 * 2. 每平台选1个"最久未采集"的类目 → 共5个
 * 3. 使用 jjy_api.js 工具执行采集：每平台+类目 × 4子渠道 × Top10 = 200个待筛选商品
 * 4. 落盘到 operations/selected/dailytemp/YYYY-MM-DD/
 * 5. Selector 按"新奇/有趣/好玩/有爆点"筛选
 * 6. 入选商品直接写入 operations/selected/ 目录（Curator 会来取）
 * 7. 更新 state 的 lastCrawled 时间
 *
 * 采集工具：operations/tools/jjy_api.js (JJYAPITool)
 *
 * 采集参数：
 * - 时间范围：最近30天
 * - 排序：按平台默认销量排序（降序）
 * - 每子渠道取：Top 10
 */

const crawlState = {
  // 最后更新时间
  lastUpdated: "2026-04-20T11:27:07.825Z",

  // 各平台类目状态
  platforms: {
    temu: {
      name: "Temu",
      sort: "sold",
      siteId: null,
      categories: [
        { catId: 1, catName: "CD和黑胶唱片", lastCrawled: null },
        { catId: 653, catName: "办公用品", lastCrawled: null },
        { catId: 1464, catName: "宠物用品", lastCrawled: null },
        { catId: 2542, catName: "电子", lastCrawled: null },
        { catId: 4673, catName: "工业和科学", lastCrawled: null },
        { catId: 9711, catName: "家居、厨房用品", lastCrawled: null },
        { catId: 13512, catName: "家居装修", lastCrawled: null },
        { catId: 15945, catName: "健康和家居用品", lastCrawled: null },
        { catId: 17719, catName: "乐器", lastCrawled: null },
        { catId: 2096, catName: "家电", lastCrawled: null },
        { catId: 18768, catName: "美容和个人护理", lastCrawled: null },
        { catId: 19858, catName: "汽车用品", lastCrawled: null },
        { catId: 23177, catName: "视频游戏", lastCrawled: null },
        { catId: 24252, catName: "手机和配件", lastCrawled: null },
        { catId: 24389, catName: "庭院、草坪和园艺", lastCrawled: null },
        { catId: 25439, catName: "玩具与游戏", lastCrawled: null },
        { catId: 26207, catName: "母婴用品", lastCrawled: "2026-04-20T11:26:17.698Z" },
        { catId: 27011, catName: "服装、鞋靴和珠宝饰品", lastCrawled: null },
        { catId: 31148, catName: "运动与户外用品", lastCrawled: null },
        { catId: 39278, catName: "收藏品和工艺品", lastCrawled: null },
        { catId: 39316, catName: "艺术品、工艺品和缝纫用品", lastCrawled: null },
        { catId: 42367, catName: "各色美食", lastCrawled: null },
        { catId: 44933, catName: "图书", lastCrawled: "2026-04-20T11:26:17.698Z" }
      ]
    },

    shein: {
      name: "Shein",
      sort: "sold",
      siteId: null,
      categories: [
        { catId: 2032, catName: "家居与生活", lastCrawled: null },
        { catId: 3631, catName: "服饰配饰", lastCrawled: null },
        { catId: 3637, catName: "箱包和行李箱", lastCrawled: null },
        { catId: 3650, catName: "家电", lastCrawled: null },
        { catId: 2026, catName: "男人", lastCrawled: null },
        { catId: 2031, catName: "孩子们", lastCrawled: null },
        { catId: 3634, catName: "珠宝和手表", lastCrawled: null },
        { catId: 1864, catName: "美容与健康", lastCrawled: null },
        { catId: 2400, catName: "宠物用品", lastCrawled: null },
        { catId: 4436, catName: "女装", lastCrawled: null },
        { catId: 4327, catName: "工具和家居装修", lastCrawled: null },
        { catId: 2297, catName: "办公和学校用品", lastCrawled: null },
        { catId: 2038, catName: "内衣和睡衣", lastCrawled: null },
        { catId: 3224, catName: "宝贝儿", lastCrawled: null },
        { catId: 4328, catName: "玩具和游戏", lastCrawled: null },
        { catId: 3636, catName: "鞋", lastCrawled: null },
        { catId: 4083, catName: "家用纺织品", lastCrawled: null },
        { catId: 3657, catName: "汽车类", lastCrawled: null },
        { catId: 3195, catName: "运动与户外", lastCrawled: null },
        { catId: 2274, catName: "手机及配件", lastCrawled: null },
        { catId: 2273, catName: "电子学", lastCrawled: null },
        { catId: 13087, catName: "书籍和杂志", lastCrawled: null },
        { catId: 13086, catName: "食品和饮料", lastCrawled: "2026-04-20T11:26:17.698Z" }
      ]
    },

    amazon: {
      name: "Amazon",
      sort: "monthSold",
      siteId: null,
      categories: [
        { catId: 2619525011, catName: "家电", lastCrawled: null },
        { catId: 2617941011, catName: "艺术、手工艺", lastCrawled: null },
        { catId: 15684181, catName: "汽车", lastCrawled: null },
        { catId: 165796011, catName: "婴儿产品", lastCrawled: null },
        { catId: 3760911, catName: "美容与护理", lastCrawled: null },
        { catId: 283155, catName: "图书", lastCrawled: null },
        { catId: 2335752011, catName: "手机", lastCrawled: null },
        { catId: 7141123011, catName: "服装、鞋履和珠宝", lastCrawled: null },
        { catId: 172282, catName: "电子产品", lastCrawled: null },
        { catId: 16310101, catName: "杂货店", lastCrawled: null },
        { catId: 3760901, catName: "健康与家居", lastCrawled: null },
        { catId: 1055398, catName: "家居用品", lastCrawled: null },
        { catId: 706813011, catName: "狩猎&渔具", lastCrawled: null },
        { catId: 16310091, catName: "工业类", lastCrawled: null },
        { catId: 11091801, catName: "乐器", lastCrawled: null },
        { catId: 1064954, catName: "办公产品", lastCrawled: null },
        { catId: 2972638011, catName: "庭院、草坪和园艺", lastCrawled: null },
        { catId: 2619533011, catName: "宠物用品", lastCrawled: null },
        { catId: 328182011, catName: "电动和手动工具", lastCrawled: null },
        { catId: 3375251, catName: "运动与户外", lastCrawled: null },
        { catId: 228013, catName: "工具", lastCrawled: null },
        { catId: 165793011, catName: "玩具", lastCrawled: null },
        { catId: 468642, catName: "视频游戏", lastCrawled: "2026-04-20T11:26:17.698Z" }
      ]
    },

    sumaitong: {
      name: "速卖通",
      sort: "totalSold",
      siteId: 1,
      categories: [
        { catId: 6, catName: "家用电器", lastCrawled: null },
        { catId: 7, catName: "电脑和办公", lastCrawled: null },
        { catId: 13, catName: "家装（硬装）", lastCrawled: null },
        { catId: 15, catName: "家居用品", lastCrawled: null },
        { catId: 18, catName: "运动及娱乐", lastCrawled: null },
        { catId: 21, catName: "办公、文化及教育用品", lastCrawled: null },
        { catId: 30, catName: "安全防护", lastCrawled: null },
        { catId: 34, catName: "汽车及零配件", lastCrawled: null },
        { catId: 36, catName: "珠宝饰品及配件", lastCrawled: null },
        { catId: 39, catName: "照明灯饰", lastCrawled: null },
        { catId: 44, catName: "消费电子", lastCrawled: null },
        { catId: 66, catName: "美容健康", lastCrawled: null },
        { catId: 320, catName: "婚礼及重要场合", lastCrawled: null },
        { catId: 322, catName: "鞋子", lastCrawled: null },
        { catId: 509, catName: "电话和通讯", lastCrawled: null },
        { catId: 1420, catName: "工具", lastCrawled: null },
        { catId: 1501, catName: "孕婴童", lastCrawled: null },
        { catId: 1503, catName: "家具和室内装饰品", lastCrawled: null },
        { catId: 1511, catName: "手表", lastCrawled: null },
        { catId: 1524, catName: "箱包", lastCrawled: null },
        { catId: 200000345, catName: "女装", lastCrawled: null },
        { catId: 200000343, catName: "男装", lastCrawled: null },
        { catId: 200000297, catName: "服饰配饰", lastCrawled: null },
        { catId: 200165144, catName: "接发与发套", lastCrawled: null },
        { catId: 200574005, catName: "男女内衣及家居服", lastCrawled: null },
        { catId: 200000532, catName: "新奇特及特殊用途服装", lastCrawled: null },
        { catId: 201768104, catName: "运动鞋服及包配", lastCrawled: null },
        { catId: 201355758, catName: "摩托车装备配件", lastCrawled: null },
        { catId: 502, catName: "电子元器件", lastCrawled: null },
        { catId: 26, catName: "玩具", lastCrawled: "2026-04-20T11:27:07.825Z" }
      ]
    },

    tiktok: {
      name: "TikTok",
      sort: "totalSold",
      siteId: 1,
      categories: [
        { catId: 604206, catName: "Toys & Hobbies", lastCrawled: null },
        { catId: 603014, catName: "Sports & Outdoor", lastCrawled: null },
        { catId: 604453, catName: "Furniture", lastCrawled: null },
        { catId: 951432, catName: "Collectibles", lastCrawled: null },
        { catId: 605248, catName: "Fashion Accessories", lastCrawled: null },
        { catId: 600024, catName: "Kitchenware", lastCrawled: null },
        { catId: 601450, catName: "Beauty & Personal Care", lastCrawled: null },
        { catId: 601739, catName: "Phones & Electronics", lastCrawled: null },
        { catId: 700645, catName: "Health", lastCrawled: null },
        { catId: 604968, catName: "Home Improvement", lastCrawled: null },
        { catId: 601152, catName: "Womenswear & Underwear", lastCrawled: null },
        { catId: 605196, catName: "Automotive & Motorcycle", lastCrawled: null },
        { catId: 700437, catName: "Food & Beverages", lastCrawled: null },
        { catId: 602284, catName: "Baby & Maternity", lastCrawled: null },
        { catId: 600001, catName: "Home Supplies", lastCrawled: null },
        { catId: 602118, catName: "Pet Supplies", lastCrawled: null },
        { catId: 824328, catName: "Menswear & Underwear", lastCrawled: null },
        { catId: 856720, catName: "Pre-Owned", lastCrawled: null },
        { catId: 601755, catName: "Computers & Office Equipment", lastCrawled: null },
        { catId: 601352, catName: "Shoes", lastCrawled: null },
        { catId: 600154, catName: "Textiles & Soft Furnishings", lastCrawled: null },
        { catId: 604579, catName: "Tools & Hardware", lastCrawled: null },
        { catId: 600942, catName: "Household Appliances", lastCrawled: null },
        { catId: 953224, catName: "Jewelry Accessories & Derivatives", lastCrawled: null },
        { catId: 824584, catName: "Luggage & Bags", lastCrawled: null },
        { catId: 801928, catName: "Books, Magazines & Audio", lastCrawled: null },
        { catId: 802184, catName: "Kids' Fashion", lastCrawled: null },
        { catId: 601303, catName: "Muslim Fashion", lastCrawled: "2026-04-20T11:26:17.698Z" }
      ]
    }
  }
};

module.exports = crawlState;
