/**
 * ThuntAI Tool - Temu选品数据抓取工具
 *
 * 数据来源：https://thunt.ai
 *
 * ============================================
 * 登录限制说明（重要）
 * ============================================
 * 未登录用户使用限制：
 * - ❌ 关键词搜索 → 返回0结果
 * - ❌ 类目筛选 → 返回0结果
 * - ❌ 时间筛选 → 返回0结果
 * - ✅ 默认热销商品列表 → 正常工作（10000个，显示20条）
 *
 * 登录后可正常使用所有筛选功能。
 *
 * ============================================
 * 可用子站（6个）
 * ============================================
 * 1. 热销商品：https://thunt.ai/cn/product-database
 * 2. 热销新品：https://thunt.ai/cn/product-database-hot-new
 * 3. 降价品：https://thunt.ai/cn/product-database-price-cut
 * 4. 断货品：https://thunt.ai/cn/product-database-sold-out
 * 5. 周爆品：https://thunt.ai/cn/product-database-week-surge
 * 6. 月爆品：https://thunt.ai/cn/product-database-month-surge
 *
 * ============================================
 * 使用方法
 * ============================================
 * const tool = require('./thunt_ai.js');
 * await tool.init();
 *
 * // 获取当前页面的商品列表
 * const products = await tool.getProducts();
 *
 * // 获取完整商品数据
 * const fullData = await tool.getFullProductData();
 *
 * // 切换子站（需传入完整URL）
 * await tool.navigateTo('https://thunt.ai/cn/product-database-week-surge');
 *
 * await tool.close();
 */

const { chromium } = require('playwright');

class ThuntAITool {
  constructor() {
    this.browser = null;
    this.page = null;
    this.baseUrl = 'https://thunt.ai/cn/product-database';
    this.waitTime = 10000;  // 等待数据加载的时间

    // 6个子站URL
    this.subSites = {
      '热销商品': 'https://thunt.ai/cn/product-database',
      '热销新品': 'https://thunt.ai/cn/product-database-hot-new',
      '降价品': 'https://thunt.ai/cn/product-database-price-cut',
      '断货品': 'https://thunt.ai/cn/product-database-sold-out',
      '周爆品': 'https://thunt.ai/cn/product-database-week-surge',
      '月爆品': 'https://thunt.ai/cn/product-database-month-surge'
    };
  }

  /**
   * 导航到指定子站
   * @param {string} urlOrName - 子站URL或名称（如"周爆品"或完整URL）
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async navigateTo(urlOrName) {
    let url = urlOrName;

    // 如果传入的是名称，转换为URL
    if (this.subSites[urlOrName]) {
      url = this.subSites[urlOrName];
    }

    console.log(`[ThuntAI] 导航到: ${url}`);
    await this.page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(this.waitTime);
    await this.closePopup();

    const result = await this.page.evaluate(() => {
      const pageText = document.body.innerText;
      const match = pageText.match(/共找到\s*(\d+)\s*个商品/);
      return { total: match ? match[1] : '未匹配' };
    });

    console.log(`[ThuntAI] 当前页面: ${result.total}个商品`);
    return { success: true, total: result.total };
  }

  /**
   * 初始化浏览器
   */
  async init() {
    if (this.browser) return;

    this.browser = await chromium.launch({ headless: true });
    this.page = await this.browser.newPage();

    console.log('[ThuntAI] 正在加载页面...');
    await this.page.goto(this.baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await this.page.waitForTimeout(this.waitTime);

    // 关闭可能弹出的登录提示
    await this.closePopup();

    console.log('[ThuntAI] 初始化完成');
  }

  /**
   * 关闭登录弹窗
   */
  async closePopup() {
    try {
      // 通过DOM移除
      await this.page.evaluate(() => {
        const dialog = document.querySelector('.login-tips-wrap, .el-dialog, [role="dialog"]');
        if (dialog) dialog.remove();
      });

      // 按ESC关闭
      await this.page.keyboard.press('Escape').catch(() => {});

      // 等待一下让弹窗消失
      await this.page.waitForTimeout(500);
    } catch (e) {
      // 忽略错误
    }
  }

  /**
   * 选择类目
   * 注意：未登录用户选择类目后返回0结果
   * @param {string} categoryName - 类目名称（如"服装"、"美容和个人护理"）
   * @returns {Promise<{success: boolean, rows: number, message: string}>}
   */
  async selectCategory(categoryName) {
    await this.closePopup();

    console.log(`[ThuntAI] 选择类目: ${categoryName}`);

    // 点击类目选择器（第2个el-select）
    const categorySelect = this.page.locator('.el-select').nth(1);
    await categorySelect.click({ force: true });
    await this.page.waitForTimeout(1500);

    // 在树形下拉菜单中选择类目
    const item = this.page.locator('.el-tree-select__popper .el-select-dropdown__item', { hasText: categoryName });
    await item.first().click({ force: true });
    await this.page.waitForTimeout(2000);

    console.log(`[ThuntAI] 类目"${categoryName}"已选中`);
    return { success: true, message: `已选择类目: ${categoryName}` };
  }

  /**
   * 选择上架时间范围
   * 注意：未登录用户选择时间后返回0结果
   * @param {string} timeRange - 时间范围："不限"、"一月内"、"半年内"、"1年内"
   * @returns {Promise<{success: boolean, message: string}>}
   */
  async selectTimeRange(timeRange) {
    await this.closePopup();

    console.log(`[ThuntAI] 选择时间: ${timeRange}`);

    // 点击时间选择器（第9个el-select，index=8）
    const timeSelect = this.page.locator('.el-select').nth(8);
    await timeSelect.click({ force: true });
    await this.page.waitForTimeout(1500);

    // 选择时间选项
    const option = this.page.locator('.el-select-dropdown:visible .el-select-dropdown__item', { hasText: timeRange });
    await option.click({ force: true });
    await this.page.waitForTimeout(2000);

    console.log(`[ThuntAI] 时间"${timeRange}"已选中`);
    return { success: true, message: `已选择时间: ${timeRange}` };
  }

  /**
   * 点击搜索按钮应用筛选
   * @returns {Promise<{success: boolean, total: number, rows: number}>}
   */
  async applyFilters() {
    await this.closePopup();

    console.log('[ThuntAI] 点击搜索应用筛选...');
    await this.page.locator('button.search-button').click();
    await this.page.waitForTimeout(10000);

    const result = await this.page.evaluate(() => {
      const pageText = document.body.innerText;
      const matchResult = pageText.match(/共找到\s*(\d+)\s*个商品/);
      const totalCount = matchResult ? parseInt(matchResult[1]) : 0;
      const rows = document.querySelectorAll('.el-table__body tr.el-table__row').length;

      return { totalCount, rows };
    });

    console.log(`[ThuntAI] 筛选结果: 共${result.totalCount}个商品, ${result.rows}行`);

    if (result.totalCount === 0) {
      return { success: false, total: 0, rows: 0, message: '筛选无结果（可能需要登录）' };
    }

    return { success: true, total: result.totalCount, rows: result.rows };
  }

  /**
   * 重置所有筛选条件
   */
  async resetFilters() {
    await this.closePopup();

    console.log('[ThuntAI] 重置筛选...');
    await this.page.locator('button:has-text("重置")').click();
    await this.page.waitForTimeout(3000);

    const result = await this.page.evaluate(() => {
      const pageText = document.body.innerText;
      const matchResult = pageText.match(/共找到\s*(\d+)\s*个商品/);
      return matchResult ? parseInt(matchResult[1]) : 0;
    });

    console.log(`[ThuntAI] 重置后: ${result}个商品`);
    return result;
  }

  /**
   * 获取当前页面的所有商品数据
   * @returns {Promise<Array>} - 商品数据列表
   */
  async getProducts() {
    await this.closePopup();

    const products = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('.el-table__body tr.el-table__row');
      const data = [];

      rows.forEach((row, i) => {
        const cells = Array.from(row.querySelectorAll('td')).map(cell =>
          cell.innerText?.trim()?.replace(/\n/g, ' ')
        );

        // 提取商品详情链接
        const detailLink = row.querySelector('a[href*="product-detail"]')?.href;
        // 提取temu链接
        const temuLink = row.querySelector('a[href*="temu"]')?.href;

        // 提取商品名称（第一个有内容的cell）
        const productName = cells[0]?.split('全托管')[0]?.split('半托管')[0]?.trim() || cells[0];

        // 提取价格
        const priceMatch = row.innerText?.match(/\$[\d.]+|€[\d.]+/g);
        const prices = priceMatch ? [...new Set(priceMatch)] : [];

        // 提取销量数据
        const salesMatch = row.innerText?.match(/[\d.]+万\+|[\d.]+千\+/g);
        const sales = salesMatch || [];

        // 提取评分
        const ratingMatch = row.innerText?.match(/[\d]\.[\d]/g);
        const ratings = ratingMatch ? [...new Set(ratingMatch)] : [];

        // 提取商品标签
        const tags = [];
        if (cells[0]?.includes('全托管')) tags.push('全托管');
        if (cells[0]?.includes('半托管')) tags.push('半托管');
        if (cells[0]?.includes('明星卖家')) tags.push('明星卖家');
        if (cells[0]?.includes('即将售罄')) tags.push('即将售罄');

        // 提取类目（cell[2]）
        const category = cells[2] || '';

        // 提取店铺（cell[3]）
        const store = cells[3]?.split('|')[0]?.trim() || '';

        if (cells.length > 1) {
          data.push({
            index: i + 1,
            productName,
            tags,
            category,
            store,
            cells,
            prices,
            sales,
            ratings,
            detailLink,
            temuLink
          });
        }
      });

      return data;
    });

    console.log(`[ThuntAI] 获取到 ${products.length} 个商品`);
    return products;
  }

  /**
   * 获取完整商品信息（结构化数据）
   * @returns {Promise<Array>} - 完整商品信息列表
   */
  async getFullProductData() {
    await this.closePopup();

    const products = await this.page.evaluate(() => {
      const rows = document.querySelectorAll('.el-table__body tr.el-table__row');
      const products = [];

      rows.forEach((row, i) => {
        const cells = row.querySelectorAll('td');
        if (cells.length < 8) return;

        const cellTexts = Array.from(cells).map(c => c.innerText?.trim()?.replace(/\n/g, ' '));

        // 提取链接
        const links = {};
        row.querySelectorAll('a[href]').forEach(a => {
          const href = a.href;
          if (href.includes('product-detail')) links.detail = href;
          if (href.includes('temu')) links.temu = href;
          if (href.includes('store')) links.store = href;
          if (href.includes('supplier')) links.supplier = href;
        });

        // 解析商品名称（第一个cell，提取标签）
        const rawText = cellTexts[0] || '';
        const tags = [];
        if (rawText.includes('全托管')) tags.push('全托管');
        if (rawText.includes('半托管')) tags.push('半托管');
        if (rawText.includes('明星卖家')) tags.push('明星卖家');
        if (rawText.includes('即将售罄')) tags.push('即将售罄');

        // 提取纯商品名称
        let productName = rawText
          .replace(/全托管/g, '')
          .replace(/半托管/g, '')
          .replace(/明星卖家/g, '')
          .replace(/即将售罄/g, '')
          .trim()
          .split(/\s{2,}/)[0] || rawText;

        // 解析价格 - 格式 $5.75 €3.44
        const priceMatch = (cellTexts[2] || '').match(/\$?([\d.]+)\s*€?\$?([\d.]+)?/);
        const priceUSD = priceMatch ? priceMatch[1] : null;
        const priceEUR = priceMatch ? priceMatch[2] : null;

        // 解析日销趋势 - 格式 1293.0 -59%
        const dailySalesMatch = (cellTexts[3] || '').match(/([\d.]+)\s*(-?\d+%)?/);
        const dailySales = dailySalesMatch ? dailySalesMatch[1] : null;
        const salesChange = dailySalesMatch ? dailySalesMatch[2] : null;

        // 提取销量（多个cell聚合）
        const salesText = cellTexts.slice(4, 7).join(' ');

        // 提取类目和店铺（从cellTexts分析）
        const category = cellTexts[1]?.match(/^[^\d]+$/)?.[0]?.trim() || '';
        const store = cellTexts[1]?.replace(category, '').trim() || cellTexts[1] || '';

        products.push({
          index: i + 1,
          productName,
          tags,
          category,
          store,
          priceUSD,
          priceEUR,
          dailySales,
          salesChange,
          salesText,
          rawCells: cellTexts,
          links
        });
      });

      return products;
    });

    console.log(`[ThuntAI] 获取到 ${products.length} 个完整商品数据`);
    return products;
  }

  /**
   * 加载更多数据（分页）
   * @returns {Promise<boolean>} - 是否有更多数据
   */
  async loadMore() {
    await this.closePopup();

    // 查找加载更多按钮
    const loadMoreBtn = this.page.locator('button:has-text("加载更多"), .el-button:has-text("加载更多")');
    if (await loadMoreBtn.isVisible()) {
      await loadMoreBtn.click();
      await this.page.waitForTimeout(3000);
      console.log('[ThuntAI] 点击了加载更多');
      return true;
    }

    // 查找分页按钮
    const nextPageBtn = this.page.locator('.el-pager .el-icon:not(.is-disabled)').last();
    if (await nextPageBtn.isVisible()) {
      await nextPageBtn.click();
      await this.page.waitForTimeout(3000);
      console.log('[ThuntAI] 点击了下一页');
      return true;
    }

    console.log('[ThuntAI] 没有更多数据可以加载');
    return false;
  }

  /**
   * 截图保存当前页面（用于调试）
   * @param {string} filename - 文件名
   */
  async screenshot(filename = '/tmp/thunt_ai_debug.png') {
    await this.page.screenshot({ path: filename, fullPage: true });
    console.log(`[ThuntAI] 截图保存到 ${filename}`);
  }

  /**
   * 关闭浏览器
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      console.log('[ThuntAI] 浏览器已关闭');
    }
  }
}

// 导出工具
module.exports = ThuntAITool;

// 如果直接运行，执行测试
if (require.main === module) {
  (async () => {
    const tool = new ThuntAITool();

    try {
      // 初始化
      await tool.init();

      // 获取默认商品列表
      console.log('\n=== 获取默认商品列表 ===');
      const products = await tool.getProducts();
      console.log(`\n前3个商品:`);
      products.slice(0, 3).forEach((p, i) => {
        console.log(`${i + 1}. ${p.productName?.substring(0, 80)}...`);
        console.log(`   价格: ${p.prices?.join(', ')}`);
        console.log(`   链接: ${p.detailLink || 'N/A'}`);
      });

      // 获取完整数据
      console.log('\n=== 获取完整商品数据 ===');
      const fullData = await tool.getFullProductData();
      if (fullData.length > 0) {
        const first = fullData[0];
        console.log(`第一个商品: ${first.productName?.substring(0, 50)}...`);
        console.log(`  价格: $${first.priceUSD} €${first.priceEUR}`);
        console.log(`  日销: ${first.dailySales} (${first.salesChange})`);
      }

      // 测试截图
      await tool.screenshot('/tmp/thunt_ai_test.png');
      console.log('\n测试完成!');

    } catch (e) {
      console.error('错误:', e.message);
    } finally {
      await tool.close();
    }
  })();
}
