/**
 * JJY Tool - 电商选品数据抓取工具
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
 * 网站说明
 * ============================================
 * 特卖选品助手 - 青岛极鲸网络科技有限公司
 * 网站永久免费使用，无需登录即可使用全部功能
 *
 * ============================================
 * 功能（无需登录）
 * ============================================
 * - ✅ 关键词搜索
 * - ✅ 类目筛选
 * - ✅ 获取商品数据
 * - ✅ 翻页功能
 *
 * ============================================
 * 使用方法
 * ============================================
 * const tool = require('./jjy.js');
 * await tool.init();
 *
 * // 导航到指定平台和子站
 * await tool.navigateTo('temu', '热销新品');
 * // 或直接用URL:
 * // await tool.navigateTo('https://www.temaishuju.com/goods/hot-sale');
 *
 * // 搜索关键词
 * await tool.search('necklace');
 *
 * // 选择类目
 * await tool.selectCategory('美容和个人护理');
 *
 * // 获取商品列表
 * const products = await tool.getProducts();
 *
 * // 获取完整数据
 * const fullData = await tool.getFullProductData();
 *
 * await tool.close();
 */

const { chromium } = require('playwright');

class JJYTool {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://www.temaishuju.com/goods/hot-sale';
    this.waitTime = 8000;

    // 子站URL - 按平台分组
    this.subSites = {
      // temu
      'temu_热销商品': 'https://www.temaishuju.com/goods/hot-sale',
      'temu_热销新品': 'https://www.temaishuju.com/goods/hot-sale-new',
      'temu_新店热销': 'https://www.temaishuju.com/goods/new-mall-hot-sale',
      'temu_大卖新品': 'https://www.temaishuju.com/goods/big-sale-new',
      // shein
      'shein_热销商品': 'https://www.sheinshuju.com/goods/hot-sale',
      'shein_热销新品': 'https://www.sheinshuju.com/goods/hot-sale-new',
      'shein_新店热销': 'https://www.sheinshuju.com/goods/new-mall-hot-sale',
      'shein_大卖新品': 'https://www.sheinshuju.com/goods/big-sale-new',
      // amazon
      'amazon_热销商品': 'https://www.amazonshuju.com/goods/hot-sale',
      'amazon_热销新品': 'https://www.amazonshuju.com/goods/hot-sale-new',
      'amazon_新店热销': 'https://www.amazonshuju.com/goods/new-mall-hot-sale',
      'amazon_大卖新品': 'https://www.amazonshuju.com/goods/big-sale-new',
      // sumaitong
      'sumaitong_热销商品': 'https://www.sumaitongshuju.com/goods/hot-sale',
      'sumaitong_热销新品': 'https://www.sumaitongshuju.com/goods/hot-sale-new',
      'sumaitong_新店热销': 'https://www.sumaitongshuju.com/goods/new-mall-hot-sale',
      'sumaitong_大卖新品': 'https://www.sumaitongshuju.com/goods/big-sale-new',
      // tiktok
      'tiktok_热销商品': 'https://www.tiktokshuju.com/goods/hot-sale',
      'tiktok_热销新品': 'https://www.tiktokshuju.com/goods/hot-sale-new',
      'tiktok_新店热销': 'https://www.tiktokshuju.com/goods/new-mall-hot-sale',
      'tiktok_大卖新品': 'https://www.tiktokshuju.com/goods/big-sale-new',
    };

    // 平台简称映射
    this.platforms = ['temu', 'shein', 'amazon', 'sumaitong', 'tiktok'];

    // 子站类型
    this.pageTypes = ['热销商品', '热销新品', '新店热销', '大卖新品'];
  }

  /**
   * 初始化浏览器
   */
  async init() {
    if (this.browser) return;

    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();

    console.log('[JJY] 正在加载页面...');
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(this.waitTime);

    console.log('[JJY] 初始化完成');
  }

  /**
   * 导航到指定子站
   * @param {string} platform - 平台名称（temu/shein/amazon/sumaitong/tiktok）
   * @param {string} pageType - 子站类型（热销商品/热销新品/新店热销/大卖新品）
   * 或者直接传入完整URL
   */
  async navigateTo(platformOrUrl, pageType = null) {
    let url;

    // 如果第一个参数是完整URL，直接使用
    if (platformOrUrl.startsWith('http')) {
      url = platformOrUrl;
    } else if (pageType) {
      // 组合platform和pageType
      const key = `${platformOrUrl}_${pageType}`;
      url = this.subSites[key];
      if (!url) {
        console.log(`[JJY] 未找到: ${key}`);
        return null;
      }
    } else {
      // 只传了platform，默认为热销商品
      url = this.subSites[`${platformOrUrl}_热销商品`];
    }

    if (!url) {
      console.log(`[JJY] 无效的导航参数`);
      return null;
    }

    console.log(`[JJY] 导航到: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(this.waitTime);

    const result = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('.ant-table-tbody tr:not(.ant-table-measure-row)');
      return rows.length;
    });

    console.log(`[JJY] 当前页面: ${result}行商品`);
    return result;
  }

  /**
   * 搜索关键词
   * @param {string} keyword - 搜索关键词（英文效果更好）
   */
  async search(keyword) {
    console.log(`[JJY] 搜索: ${keyword}`);

    // 清空搜索框
    const searchInput = this.page.locator('input[placeholder*="英文关键词"]');
    await searchInput.clear();
    await searchInput.fill(keyword);

    // 点击搜索按钮
    await this.page.locator('button:has-text("搜索")').click();

    // 等待结果加载
    await this.page.waitForTimeout(5000);

    const result = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('.ant-table-tbody tr');
      return rows.length;
    });

    console.log(`[JJY] 搜索"${keyword}": ${result}行结果`);
    return result;
  }

  /**
   * 选择类目
   * @param {string} categoryName - 类目名称
   */
  async selectCategory(categoryName) {
    console.log(`[JJY] 选择类目: ${categoryName}`);

    // 点击类目选择器
    await this.page.locator('.ant-select').nth(0).click();
    await this.page.waitForTimeout(1500);

    // 选择类目
    await this.page.locator('.ant-select-dropdown').getByText(categoryName).click();
    await this.page.waitForTimeout(1000);

    console.log(`[JJY] 已选择类目: ${categoryName}`);
    return { success: true, category: categoryName };
  }

  /**
   * 清空所有筛选条件
   */
  async clearFilters() {
    console.log('[JJY] 清空筛选...');
    await this.page.locator('button:has-text("清 空")').click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * 获取当前页面的商品数据
   */
  async getProducts() {
    const products = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('.ant-table-tbody tr');
      const data = [];

      rows.forEach((row, i) => {
        const cells = Array.from(row.querySelectorAll('td')).map(cell =>
          cell.innerText?.trim()?.replace(/\n/g, ' ')
        );

        // 提取商品详情链接
        const detailLink = row.querySelector('a[href*="/goods/"]')?.href;
        // 提取图片
        const img = row.querySelector('img')?.src;

        // 提取商品名称（预览文本后跟商品名称）
        const text = row.innerText;
        const productNameMatch = text.match(/预览\n([^\n]+)/);
        const productName = productNameMatch ? productNameMatch[1].trim() : '';

        // 提取价格
        const priceMatch = text.match(/\$[\d.]+\s*-\s*\$[\d.]+|\$[\d.]+/g);
        const prices = priceMatch ? [...new Set(priceMatch)] : [];

        // 提取销量
        const salesMatch = text.match(/(\d+万|\d+千|\d+)\s*(\d+万|\d+千|\d+)/g);
        const sales = salesMatch || [];

        if (cells.length > 1) {
          data.push({
            index: i + 1,
            productName,
            cells,
            prices,
            sales,
            detailLink,
            img
          });
        }
      });

      return data;
    });

    console.log(`[JJY] 获取到 ${products.length} 个商品`);
    return products;
  }

  /**
   * 获取完整商品信息
   */
  async getFullProductData() {
    const products = await this.page.evaluate(() => {
      // 使用表格行获取完整数据
      const rows = document.querySelectorAll('.ant-table-tbody tr:not(.ant-table-measure-row)');
      const data = [];

      rows.forEach((row, i) => {
        // 使用innerText获取制表符分隔的数据
        const innerText = row.innerText || '';
        const lines = innerText.split('\n').filter(l => l.trim());

        // 提取链接
        const links = {};
        row.querySelectorAll('a[href]').forEach(a => {
          const href = a.href;
          if (href.includes('/goods/')) links.detail = href;
          if (href.includes('/image-search')) links.imageSearch = href;
        });

        // 提取图片
        const img = row.querySelector('img')?.src;

        // innerText格式:
        // 0: 预览
        // 1: 商品名称 (英文)
        // 2: 类目 (中文)
        // 3: $价格范围 (如 $1.8 - $3.19)
        // 4: 制表符分隔的数据 (4万\t7万\t4.6\t427\t2年前\t3年前\t查看商品 图搜同款)

        const productName = lines[1] || '';
        const category = lines[2] || '';

        // 提取价格
        const priceMatch = lines[3]?.match(/\$([\d.]+)\s*-\s*\$([\d.]+)/);
        const priceMin = priceMatch ? priceMatch[1] : null;
        const priceMax = priceMatch ? priceMatch[2] : null;

        // 解析第4行的制表符分隔数据
        const tabParts = (lines[4] || '').split('\t').filter(l => l.trim());
        // 格式: 销量, 销售额, 评分, 评论数, 上架时间, 开店时间, 查看商品, 图搜同款
        const totalSales = tabParts[0] || null;
        const revenue = tabParts[1] || null;
        const rating = tabParts[2] || null;
        const reviews = tabParts[3] || null;
        const shelfTime = tabParts[4] || null;
        const shopTime = tabParts[5] || null;

        data.push({
          index: i + 1,
          productName,
          category,
          priceMin,
          priceMax,
          totalSales,
          revenue,
          rating,
          reviews,
          shelfTime,
          shopTime,
          links,
          img
        });
      });

      return data;
    });

    console.log(`[JJY] 获取到 ${products.length} 个完整商品数据`);
    return products;
  }

  /**
   * 翻到下一页
   */
  async nextPage() {
    const nextBtn = this.page.locator('.ant-pagination-next, .ant-pagination-item-link').last();
    const isDisabled = await nextBtn.evaluate(el => el.classList.contains('ant-pagination-item-disabled'));

    if (isDisabled) {
      console.log('[JJY] 没有更多页面');
      return false;
    }

    await nextBtn.click();
    await this.page.waitForTimeout(5000);

    const rows = await this.page.evaluate(() => document.querySelectorAll('.ant-table-tbody tr').length);
    console.log(`[JJY] 下一页: ${rows}行`);
    return true;
  }

  /**
   * 截图保存
   */
  async screenshot(filename = '/tmp/jjy_debug.png') {
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`[JJY] 截图保存到 ${filename}`);
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('[JJY] 浏览器已关闭');
    }
  }
}

// 导出工具
module.exports = JJYTool;

// 直接运行时执行测试
if (require.main === module) {
  (async () => {
    const tool = new JJYTool();

    try {
      await tool.init();

      // 测试搜索
      console.log('\n=== 测试搜索 ===');
      await tool.search('necklace');

      // 获取商品
      const products = await tool.getProducts();
      console.log(`\n前2个商品:`);
      products.slice(0, 2).forEach((p, i) => {
        console.log(`${i + 1}. ${p.productName?.substring(0, 60)}...`);
        console.log(`   价格: ${p.prices?.join(', ')}`);
      });

      // 获取完整数据
      console.log('\n=== 获取完整数据 ===');
      const fullData = await tool.getFullProductData();
      if (fullData.length > 0) {
        const first = fullData[0];
        console.log(`第一个商品: ${first.productName?.substring(0, 50)}`);
        console.log(`  价格: $${first.priceMin} - $${first.priceMax}`);
        console.log(`  销量: ${first.totalSales}`);
        console.log(`  评分: ${first.rating}`);
      }

      await tool.screenshot('/tmp/jjy_test.png');
      console.log('\n测试完成!');

    } catch (e) {
      console.error('错误:', e.message);
    } finally {
      await tool.close();
    }
  })();
}
