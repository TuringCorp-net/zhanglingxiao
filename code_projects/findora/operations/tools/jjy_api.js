/**
 * JJY API Tool - 纯API版电商选品数据抓取工具
 *
 * ============================================
 * 数据来源（5个电商平台）
 * ============================================
 *
 * --- temu ---
 * 热销商品：https://www.temaishuju.com/goods/hot-sale
 * 热销新品：https://www.temaishuju.com/goods/hot-sale-new
 * 新店热销：https://www.temaishuju.com/goods/new-mall-hot-sale
 * 大卖新品：https://www.temaishuju.com/goods/big-sale-new
 *
 * --- shein ---
 * 热销商品：https://www.sheinshuju.com/goods/hot-sale
 * 热销新品：https://www.sheinshuju.com/goods/hot-sale-new
 * 新店热销：https://www.sheinshuju.com/goods/new-mall-hot-sale
 * 大卖新品：https://www.sheinshuju.com/goods/big-sale-new
 *
 * --- amazon ---
 * 热销商品：https://www.amazonshuju.com/goods/hot-sale
 * 热销新品：https://www.amazonshuju.com/goods/hot-sale-new
 * 新店热销：https://www.amazonshuju.com/goods/new-mall-hot-sale
 * 大卖新品：https://www.amazonshuju.com/goods/big-sale-new
 *
 * --- sumaitong ---
 * 热销商品：https://www.sumaitongshuju.com/goods/hot-sale
 * 热销新品：https://www.sumaitongshuju.com/goods/hot-sale-new
 * 新店热销：https://www.sumaitongshuju.com/goods/new-mall-hot-sale
 * 大卖新品：https://www.sumaitongshuju.com/goods/big-sale-new
 *
 * --- tiktok ---
 * 热销商品：https://www.tiktokshuju.com/goods/hot-sale
 * 热销新品：https://www.tiktokshuju.com/goods/hot-sale-new
 * 新店热销：https://www.tiktokshuju.com/goods/new-mall-hot-sale
 * 大卖新品：https://www.tiktokshuju.com/goods/big-sale-new
 *
 * ============================================
 * API搜索参数说明（4个核心筛选参数）
 * ============================================
 *
 * GET /api/v1/goods/search?keyword=xxx&catId=xxx&onSaleTimeStart=xxx&priceMin=xxx&priceMax=xxx
 *
 * | 参数 | 说明 | 示例 |
 * |------|------|------|
 * | keyword | 搜索关键词（英文效果更好） | keyword=necklace |
 * | catId | 品类ID（见下方品类映射表） | catId=18768 |
 * | onSaleTimeStart | 上架时间开始（YYYY-MM-DD） | onSaleTimeStart=2025-01-01 |
 * | onSaleTimeEnd | 上架时间结束（YYYY-MM-DD） | onSaleTimeEnd=2025-12-31 |
 * | priceMin | 价格最小值 | priceMin=10 |
 * | priceMax | 价格最大值 | priceMax=50 |
 *
 * ============================================
 * Temu平台品类映射表（catId: 中文名称）
 * ============================================
 * 1: CD和黑胶唱片
 * 653: 办公用品
 * 1464: 宠物用品
 * 2542: 电子
 * 4673: 工业和科学
 * 9711: 家居、厨房用品
 * 13512: 家居装修
 * 15945: 健康和家居用品
 * 17719: 乐器
 * 2096: 家电
 * 18768: 美容和个人护理
 * 19858: 汽车用品
 * 23177: 视频游戏
 * 24252: 手机和配件
 * 24389: 庭院、草坪和园艺
 * 25439: 玩具与游戏
 * 26207: 母婴用品
 * 27011: 服装、鞋靴和珠宝饰品
 * 31148: 运动与户外用品
 * 39278: 收藏品和工艺品
 * 39316: 艺术品、工艺品和缝纫用品
 * 42367: 各色美食
 * 44933: 图书
 *
 * ============================================
 * Shein平台品类映射表（catId: 中文名称）
 * ============================================
 * 2032: 家居与生活
 * 3631: 服饰配饰
 * 3637: 箱包和行李箱
 * 3650: 家电
 * 2026: 男人
 * 2031: 孩子们
 * 3634: 珠宝和手表
 * 1864: 美容与健康
 * 2400: 宠物用品
 * 4436: 女装
 * 4327: 工具和家居装修
 * 2297: 办公和学校用品
 * 2038: 内衣和睡衣
 * 3224: 宝贝儿
 * 4328: 玩具和游戏
 * 3636: 鞋
 * 4083: 家用纺织品
 * 3657: 汽车类
 * 3195: 运动与户外
 * 2274: 手机及配件
 * 2273: 电子学
 * 13087: 书籍和杂志
 * 13086: 食品和饮料
 *
 * ============================================
 * Amazon平台品类映射表（catId: 中文名称）
 * ============================================
 * 2619525011: 家电
 * 2617941011: 艺术、手工艺
 * 15684181: 汽车
 * 165796011: 婴儿产品
 * 3760911: 美容与护理
 * 283155: 图书
 * 2335752011: 手机
 * 7141123011: 服装、鞋履和珠宝
 * 172282: 电子产品
 * 16310101: 杂货店
 * 3760901: 健康与家居
 * 1055398: 家居用品
 * 706813011: 狩猎&渔具
 * 16310091: 工业类
 * 11091801: 乐器
 * 1064954: 办公产品
 * 2972638011: 庭院、草坪和园艺
 * 2619533011: 宠物用品
 * 328182011: 电动和手动工具
 * 3375251: 运动与户外
 * 228013: 工具
 * 165793011: 玩具
 * 468642: 视频游戏
 *
 * ============================================
 * Sumaitong平台品类映射表（catId: 中文名称）
 * ============================================
 * 6: 家用电器
 * 7: 电脑和办公
 * 13: 家装（硬装）
 * 15: 家居用品
 * 18: 运动及娱乐
 * 21: 办公、文化及教育用品
 * 30: 安全防护
 * 34: 汽车及零配件
 * 36: 珠宝饰品及配件
 * 39: 照明灯饰
 * 44: 消费电子
 * 66: 美容健康
 * 320: 婚礼及重要场合
 * 322: 鞋子
 * 509: 电话和通讯
 * 1420: 工具
 * 1501: 孕婴童
 * 1503: 家具和室内装饰品
 * 1511: 手表
 * 1524: 箱包
 * 200000345: 女装
 * 200000343: 男装
 * 200000297: 服饰配饰
 * 200165144: 接发与发套
 * 200574005: 男女内衣及家居服
 * 200000532: 新奇特及特殊用途服装
 * 201768104: 运动鞋服及包配
 * 201355758: 摩托车装备配件
 * 502: 电子元器件
 * 26: 玩具
 *
 * ============================================
 * TikTok平台品类映射表（catId: 英文名称）
 * ============================================
 * 604206: Toys & Hobbies
 * 603014: Sports & Outdoor
 * 604453: Furniture
 * 951432: Collectibles
 * 605248: Fashion Accessories
 * 600024: Kitchenware
 * 601450: Beauty & Personal Care
 * 601739: Phones & Electronics
 * 700645: Health
 * 604968: Home Improvement
 * 601152: Womenswear & Underwear
 * 605196: Automotive & Motorcycle
 * 700437: Food & Beverages
 * 602284: Baby & Maternity
 * 600001: Home Supplies
 * 602118: Pet Supplies
 * 824328: Menswear & Underwear
 * 856720: Pre-Owned
 * 601755: Computers & Office Equipment
 * 601352: Shoes
 * 600154: Textiles & Soft Furnishings
 * 604579: Tools & Hardware
 * 600942: Household Appliances
 * 953224: Jewelry Accessories & Derivatives
 * 824584: Luggage & Bags
 * 801928: Books, Magazines & Audio
 * 802184: Kids' Fashion
 * 601303: Muslim Fashion
 *
 * ============================================
 * 使用方法
 * ============================================
 * const jjyApi = require('./jjy_api.js');
 *
 * // 初始化（获取所有平台的品类列表）
 * await jjyApi.init();
 *
 * // ========== 示例1: 基础搜索 ==========
 * const result = await jjyApi.search({
 *   keyword: 'necklace',
 *   platform: 'temu'
 * });
 *
 * // ========== 示例2: 品类筛选 ==========
 * // Temu平台：美容和个人护理 (catId=18768)
 * const result = await jjyApi.search({
 *   keyword: 'cream',
 *   platform: 'temu',
 *   categoryId: 18768
 * });
 *
 * // ========== 示例3: 上架时间筛选 ==========
 * // 查找2025年以后上架的商品
 * const result = await jjyApi.search({
 *   keyword: 'bag',
 *   platform: 'temu',
 *   onSaleTimeStart: '2025-01-01'
 * });
 *
 * // ========== 示例4: 价格范围筛选 ==========
 * // 查找价格在10-50美元的商品
 * const result = await jjyApi.search({
 *   keyword: 'dress',
 *   platform: 'shein',
 *   priceMin: 10,
 *   priceMax: 50
 * });
 *
 * // ========== 示例5: 4参数组合筛选 ==========
 * const result = await jjyApi.search({
 *   keyword: 'necklace',
 *   platform: 'temu',
 *   categoryId: 18768,          // 美容和个人护理
 *   onSaleTimeStart: '2025-01-01',  // 2025年后上架
 *   priceMin: 5,
 *   priceMax: 30
 * });
 *
 * // ========== 示例6: 获取品类列表 ==========
 * const cats = await jjyApi.getCategories('temu');
 * console.log(cats); // [{catId: 1, catName: 'CD和黑胶唱片', ...}, ...]
 *
 * // ========== 示例7: 获取所有平台的热销商品 ==========
 * const hotProducts = await jjyApi.getHotProducts(10);
 * console.log(hotProducts.temu); // temu平台热销商品
 *
 * // 返回结果格式:
 * {
 *   success: true,
 *   platform: 'temu',
 *   keyword: 'necklace',
 *   categoryId: 18768,
 *   total: 200,
 *   page: 1,
 *   size: 20,
 *   products: [
 *     {
 *       goodsNameEn: '...',
 *       goodsNameCn: '...',
 *       thumbnail: '...',
 *       sold: 44000,
 *       goodsPriceMin: 1.8,
 *       goodsPriceMax: 3.19,
 *       reviewNum: 210,
 *       rating: 4.6,
 *       onSaleTime: '2025-01-15T...',
 *       goodsId: '...'
 *     },
 *     ...
 *   ]
 * }
 */

const https = require('https');

class JJYAPITool {
  constructor() {
    // 平台域名映射
    // 注意：API域名可能是不同的子域名，需要通过Playwright抓取才能确认
    this.platforms = {
      'temu': 'www.temaishuju.com',
      'shein': 'api.sheinshuju.com',  // API在api子域名
      'amazon': 'api.amazonshuju.com',
      'sumaitong': 'api.sumaitongshuju.com',
      'tiktok': 'api.tiktokshuju.com'
    };

    // 子站路径
    this.pagePaths = {
      '热销商品': '/goods/hot-sale',
      '热销新品': '/goods/hot-sale-new',
      '新店热销': '/goods/new-mall-hot-sale',
      '大卖新品': '/goods/big-sale-new'
    };

    this.currentPlatform = 'temu';
    this.categories = {};  // 缓存类目列表
  }

  /**
   * API请求封装
   */
  apiGet(platform, path) {
    return new Promise((resolve, reject) => {
      const hostname = this.platforms[platform] || this.platforms['temu'];

      const options = {
        hostname,
        path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Referer': `https://${hostname}/`,
          'Origin': `https://${hostname}`
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // 检查是否返回了HTML（可能是Cloudflare或反爬）
          if (data.trim().startsWith('<!') || data.trim().startsWith('<!doctype')) {
            reject(new Error('网站返回了HTML而非JSON（可能触发了反爬）'));
            return;
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON解析失败: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.end();
    });
  }

  /**
   * 初始化 - 获取所有平台的类目列表
   */
  async init() {
    console.log('[JJY API] 初始化...');

    for (const [name, hostname] of Object.entries(this.platforms)) {
      try {
        const data = await this.apiGet(name, '/api/v1/category/list?parentCatId=0');
        if (data.code === 0) {
          this.categories[name] = data.data;
          console.log(`[JJY API] ${name}: ${data.data.length} 个类目`);
        }
      } catch (e) {
        console.log(`[JJY API] ${name}: 获取类目失败 - ${e.message}`);
      }
    }

    console.log('[JJY API] 初始化完成');
  }

  /**
   * 获取类目列表
   * @param {string} platform - 平台名称
   * @returns {Array} - 类目列表
   */
  async getCategories(platform = 'temu') {
    if (this.categories[platform]) {
      return this.categories[platform];
    }

    try {
      const data = await this.apiGet(platform, '/api/v1/category/list?parentCatId=0');
      if (data.code === 0) {
        this.categories[platform] = data.data;
        return data.data;
      }
    } catch (e) {
      console.error(`[JJY API] 获取类目失败: ${e.message}`);
    }
    return [];
  }

  /**
   * 根据品类名称查找品类ID
   * @param {string} platform - 平台名称
   * @param {string} categoryName - 品类名称（中文或英文）
   * @returns {number|null} - 品类ID
   */
  findCategoryId(platform, categoryName) {
    const cats = this.categories[platform] || [];
    const name = categoryName.toLowerCase();

    for (const cat of cats) {
      const catName = (cat.catName || cat.catNameCn || '').toLowerCase();
      const catNameCn = (cat.catNameCn || '').toLowerCase();

      if (catName === name || catNameCn === name || catName.includes(name) || catNameCn.includes(name)) {
        return cat.catId;
      }
    }
    return null;
  }

  /**
   * 搜索商品
   * @param {Object} params - 搜索参数
   * @param {string} params.keyword - 搜索关键词
   * @param {string} params.platform - 平台（temu/shein/amazon/sumaitong/tiktok）
   * @param {number} params.categoryId - 类目ID
   * @param {string} params.onSaleTimeStart - 上架时间开始 (YYYY-MM-DD)
   * @param {string} params.onSaleTimeEnd - 上架时间结束 (YYYY-MM-DD)
   * @param {number} params.priceMin - 价格最小值
   * @param {number} params.priceMax - 价格最大值
   * @param {string} params.sort - 排序字段（reviewNum/sold/goodsPrice/createTime）
   * @param {string} params.order - 排序方向（ascend/descend）
   * @param {number} params.page - 页码
   * @param {number} params.size - 每页数量
   * @returns {Object} - 搜索结果
   */
  async search(params = {}) {
    const {
      keyword = '',
      platform = 'temu',
      categoryId = null,
      onSaleTimeStart = null,
      onSaleTimeEnd = null,
      priceMin = null,
      priceMax = null,
      sort = null,
      order = 'descend',
      page = 1,
      size = 20
    } = params;

    // 构建查询参数
    const queryParts = [];
    if (keyword) queryParts.push(`keyword=${encodeURIComponent(keyword)}`);
    if (categoryId) queryParts.push(`catId=${categoryId}`);
    if (onSaleTimeStart) queryParts.push(`onSaleTimeStart=${onSaleTimeStart}`);
    if (onSaleTimeEnd) queryParts.push(`onSaleTimeEnd=${onSaleTimeEnd}`);
    if (priceMin !== null && priceMin !== undefined) queryParts.push(`priceMin=${priceMin}`);
    if (priceMax !== null && priceMax !== undefined) queryParts.push(`priceMax=${priceMax}`);
    if (sort && keyword) {
      queryParts.push(`sort=${sort}`);
      if (order) queryParts.push(`order=${order}`);
    }
    queryParts.push(`page=${page}`);
    queryParts.push(`size=${size}`);

    const query = queryParts.join('&');
    const path = `/api/v1/goods/search?${query}`;

    console.log(`[JJY API] 搜索: ${platform} - ${keyword || '(无关键词)'}`);
    if (categoryId) console.log(`[JJY API]   类目: ${categoryId}`);
    if (onSaleTimeStart || onSaleTimeEnd) console.log(`[JJY API]   上架时间: ${onSaleTimeStart || '*'} ~ ${onSaleTimeEnd || '*'}`);
    if (priceMin || priceMax) console.log(`[JJY API]   价格: ${priceMin || '0'} ~ ${priceMax || '*'}`);

    try {
      const data = await this.apiGet(platform, path);

      if (data.code === 0 && data.data) {
        const list = data.data.list || data.data.items || [];
        const total = data.data.total || data.data.length || list.length;

        return {
          success: true,
          platform,
          keyword,
          categoryId,
          total,
          page,
          size,
          products: list.map(item => this.parseProduct(item, platform))
        };
      } else {
        return {
          success: false,
          platform,
          error: `API返回错误: code=${data.code}, msg=${data.msg || ''}`,
          products: []
        };
      }
    } catch (e) {
      return {
        success: false,
        platform,
        error: e.message,
        products: []
      };
    }
  }

  /**
   * 解析商品数据 - 兼容不同平台的字段名
   */
  parseProduct(item, platform = 'temu') {
    // 不同平台的字段映射
    const fieldMap = {
      temu: {
        nameEn: 'goodsNameEn',
        nameCn: 'goodsNameCn',
        sold: 'sold',
        priceMin: 'goodsPriceMin',
        priceMax: 'goodsPriceMax',
        reviewNum: 'reviewNum',
        rating: 'rating'
      },
      shein: {
        nameEn: 'goodsName',
        nameCn: 'catItems',
        sold: 'totalSold',
        priceMin: 'minPrice',
        priceMax: 'maxPrice',
        reviewNum: 'reviewNum',
        rating: 'goodsScore'
      },
      amazon: {
        nameEn: 'goodsNameEn',
        nameCn: 'goodsNameCn',
        sold: 'totalSold',
        priceMin: 'goodsPriceMin',
        priceMax: 'goodsPriceMax',
        reviewNum: 'reviewNum',
        rating: 'rating'
      },
      sumaitong: {
        nameEn: 'goodsNameEn',
        nameCn: 'goodsNameCn',
        sold: 'totalSold',
        priceMin: 'goodsPriceMin',
        priceMax: 'goodsPriceMax',
        reviewNum: 'reviewNum',
        rating: 'rating'
      },
      tiktok: {
        nameEn: 'goodsNameEn',
        nameCn: 'goodsNameCn',
        sold: 'totalSold',
        priceMin: 'goodsPriceMin',
        priceMax: 'goodsPriceMax',
        reviewNum: 'reviewNum',
        rating: 'rating'
      }
    };

    const map = fieldMap[platform] || fieldMap.temu;

    // 获取商品名称
    let goodsNameEn = item[map.nameEn] || '';
    const goodsNameCn = Array.isArray(item[map.nameCn])
      ? item[map.nameCn].map(c => c.catNameCn || c.catName).join(', ')
      : (item[map.nameCn] || '');

    // 获取价格
    const goodsPriceMin = item[map.priceMin] || item.priceMin || item.minPrice || null;
    const goodsPriceMax = item[map.priceMax] || item.priceMax || item.maxPrice || null;

    // 获取销量
    let sold = item[map.sold] || item.totalSold || item.sold || 0;
    // 处理万单位
    if (typeof sold === 'string' && sold.includes('万')) {
      sold = parseFloat(sold) * 10000;
    }

    return {
      goodsNameEn: goodsNameEn.substring(0, 200),
      goodsNameCn: goodsNameCn.substring(0, 100),
      thumbnail: item.thumbnail || '',
      sold: sold,
      goodsPriceMin: goodsPriceMin,
      goodsPriceMax: goodsPriceMax,
      reviewNum: item[map.reviewNum] || item.reviewNum || 0,
      rating: item[map.rating] || item.rating || item.goodsScore || null,
      mallOpenTime: item.mallOpenTime || null,
      onSaleTime: item.onSaleTime || null,
      goodsId: item.goodsId || item.id || null,
      detailUrl: item.detailUrl || item.goodsId || null,
      platform
    };
  }

  /**
   * 批量搜索（多个平台或多个关键词）
   * @param {Array} searches - 搜索参数数组
   * @returns {Array} - 所有搜索结果
   */
  async searchAll(searches) {
    const results = [];
    for (const params of searches) {
      const result = await this.search(params);
      results.push(result);
    }
    return results;
  }

  /**
   * 获取所有平台的默认热销商品
   * @param {number} size - 每个平台的商品数量
   * @returns {Object} - 各平台的热销商品
   */
  async getHotProducts(size = 10) {
    const results = {};

    for (const platform of Object.keys(this.platforms)) {
      const result = await this.search({ platform, size, sort: 'sold' });
      results[platform] = {
        success: result.success,
        products: result.products
      };
    }

    return results;
  }

  /**
   * 获取所有类目
   */
  async getAllCategories() {
    const results = {};
    for (const platform of Object.keys(this.platforms)) {
      results[platform] = await this.getCategories(platform);
    }
    return results;
  }
}

// 导出工具
module.exports = JJYAPITool;

// 直接运行时执行测试
if (require.main === module) {
  (async () => {
    const jjyApi = new JJYAPITool();

    try {
      // 初始化
      await jjyApi.init();

      // 测试1: 基本搜索
      console.log('\n=== 测试搜索 ===');
      const result = await jjyApi.search({ keyword: 'necklace', platform: 'temu', size: 5 });
      console.log(`找到 ${result.total} 个商品`);
      result.products.forEach((p, i) => {
        console.log(`${i + 1}. ${p.goodsNameEn?.substring(0, 50)}...`);
        console.log(`   销量: ${p.sold}`);
      });

      // 测试2: 带排序
      console.log('\n=== 测试排序(销量) ===');
      const result2 = await jjyApi.search({ keyword: 'dress', platform: 'shein', size: 3, sort: 'sold' });
      console.log(`找到 ${result2.total} 个商品`);
      result2.products.forEach((p, i) => {
        console.log(`${i + 1}. 销量:${p.sold} - ${p.goodsNameEn?.substring(0, 40)}`);
      });

      // 测试3: 4参数组合
      console.log('\n=== 测试4参数组合 ===');
      const result3 = await jjyApi.search({
        keyword: 'necklace',
        platform: 'temu',
        categoryId: 18768,
        onSaleTimeStart: '2025-01-01',
        priceMin: 5,
        priceMax: 30,
        size: 3
      });
      console.log(`找到 ${result3.total} 个商品`);
      result3.products.forEach((p, i) => {
        console.log(`${i + 1}. ${p.goodsNameEn?.substring(0, 40)}`);
        console.log(`   价格: ${p.goodsPriceMin}-${p.goodsPriceMax} 销量: ${p.sold}`);
      });

      // 测试4: findCategoryId
      console.log('\n=== 测试品类名称查找 ===');
      const catId = jjyApi.findCategoryId('temu', '美容');
      console.log(`'美容' 对应的品类ID: ${catId}`);

      console.log('\n测试完成!');

    } catch (e) {
      console.error('错误:', e.message);
    }
  })();
}
