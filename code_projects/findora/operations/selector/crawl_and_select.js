/**
 * 选品采集脚本
 * 按 crawl_state.js 规则执行每日采集任务
 */

const path = require('path');
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const JJYAPITool = require(path.join(PROJECT_ROOT, 'operations/tools/jjy_api.js'));

// 各平台的子渠道URL配置
const subChannels = {
  '热销商品': 'hot-sale',
  '热销新品': 'hot-sale-new',
  '新店热销': 'new-mall-hot-sale',
  '大卖新品': 'big-sale-new'
};

class SelectorCrawler {
  constructor() {
    this.jjyApi = new JJYAPITool();
    this.crawlState = require(path.join(PROJECT_ROOT, 'operations/selected/crawl_state.js'));
    this.allProducts = [];
    this.failedSearches = [];
  }

  /**
   * 获取距离1970年1月1日最久的时间（用于找最久未采集的类目）
   */
  getEarliestDate(a, b) {
    if (!a) return b;
    if (!b) return a;
    return new Date(a) < new Date(b) ? a : b;
  }

  /**
   * 按"最久未采集"规则选择类目
   */
  selectCategoriesToCrawl() {
    const selected = {};

    for (const [platformKey, platform] of Object.entries(this.crawlState.platforms)) {
      const categories = platform.categories;

      // 找出最久未采集的类目
      let earliestCat = null;
      let earliestTime = null;

      for (const cat of categories) {
        if (!earliestCat || !cat.lastCrawled) {
          // 有未采集的类目优先
          earliestCat = cat;
          earliestTime = cat.lastCrawled;
        } else if (!earliestTime || new Date(cat.lastCrawled) < new Date(earliestTime)) {
          earliestCat = cat;
          earliestTime = cat.lastCrawled;
        }
      }

      selected[platformKey] = {
        ...earliestCat,
        platformName: platform.name
      };
    }

    return selected;
  }

  /**
   * 执行单个平台+类目的采集
   */
  async crawlCategory(platformKey, cat) {
    console.log(`\n=== 采集 ${cat.platformName} - ${cat.catName} ===`);

    const searches = [];
    for (const [channelName, channelPath] of Object.entries(subChannels)) {
      searches.push({
        platform: platformKey,
        categoryId: cat.catId,
        size: 10,
        page: 1
      });
    }

    const results = await this.jjyApi.searchAll(searches);

    let successCount = 0;
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const channelName = Object.keys(subChannels)[i];

      if (result.success && result.products.length > 0) {
        console.log(`  ✓ ${channelName}: ${result.products.length} 个商品`);
        result.products.forEach(p => {
          p.source = platformKey;
          p.channel = channelName;
          p.catName = cat.catName;
          this.allProducts.push(p);
        });
        successCount++;
      } else {
        console.log(`  ✗ ${channelName}: ${result.error || '无数据'}`);
        this.failedSearches.push({
          platform: platformKey,
          category: cat.catName,
          channel: channelName,
          error: result.error
        });
      }
    }

    return successCount;
  }

  /**
   * 主采集流程
   */
  async run() {
    console.log('========================================');
    console.log('选品采集脚本启动 - ' + new Date().toISOString());
    console.log('========================================');

    // 初始化 API
    console.log('\n初始化 JJY API...');
    try {
      await this.jjyApi.init();
    } catch (e) {
      console.log(`API初始化完成(部分平台可能失败): ${e.message}`);
    }

    // 选择要采集的类目
    const selectedCats = this.selectCategoriesToCrawl();
    console.log('\n本次采集计划:');
    for (const [key, cat] of Object.entries(selectedCats)) {
      const lastCrawledStr = cat.lastCrawled ? new Date(cat.lastCrawled).toLocaleString() : '从未采集';
      console.log(`  - ${cat.platformName} / ${cat.catName} (上次: ${lastCrawledStr})`);
    }

    // 执行采集
    console.log('\n开始采集...');
    for (const [platformKey, cat] of Object.entries(selectedCats)) {
      await this.crawlCategory(platformKey, cat);
      await new Promise(r => setTimeout(r, 1000)); // 间隔1秒避免过快
    }

    // 汇总结果
    console.log('\n========================================');
    console.log(`采集完成! 共获取 ${this.allProducts.length} 个商品`);
    if (this.failedSearches.length > 0) {
      console.log(`失败搜索: ${this.failedSearches.length} 个`);
    }
    console.log('========================================');

    return {
      products: this.allProducts,
      failed: this.failedSearches,
      selectedCategories: selectedCats
    };
  }

  /**
   * 导出结果为 JSON
   */
  exportJSON() {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      totalProducts: this.allProducts.length,
      failedSearches: this.failedSearches,
      products: this.allProducts
    }, null, 2);
  }
}

// 直接运行
if (require.main === module) {
  (async () => {
    const crawler = new SelectorCrawler();

    try {
      const result = await crawler.run();

      // 保存到临时目录
      const fs = require('fs');
      const path = require('path');
      const date = new Date().toISOString().split('T')[0];
      const tempDir = path.join(__dirname, 'operations/selected/dailytemp', date);

      fs.mkdirSync(tempDir, { recursive: true });

      const jsonFile = path.join(tempDir, 'raw_products.json');
      fs.writeFileSync(jsonFile, crawler.exportJSON());

      console.log(`\n原始数据已保存至: ${jsonFile}`);

      // 输出汇总
      console.log('\n采集汇总:');
      console.log(`- 总商品数: ${result.products.length}`);
      console.log(`- 失败搜索: ${result.failed.length}`);

      // 按平台统计
      const byPlatform = {};
      for (const p of result.products) {
        byPlatform[p.source] = (byPlatform[p.source] || 0) + 1;
      }
      console.log('\n各平台商品数:');
      for (const [platform, count] of Object.entries(byPlatform)) {
        console.log(`  ${platform}: ${count}`);
      }

    } catch (e) {
      console.error('采集失败:', e);
    }
  })();
}

module.exports = SelectorCrawler;