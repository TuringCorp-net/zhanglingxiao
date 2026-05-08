/**
 * 更新 crawl_state.js 的 lastCrawled 时间 — 2026-05-05 (第2轮)
 * 本轮采集的5个类目：
 * - Temu: 家电 (2096)
 * - Shein: 玩具和游戏 (4328)
 * - Amazon: 服装、鞋履和珠宝 (7141123011)
 * - 速卖通: 运动鞋服及包配 (201768104)
 * - TikTok: Home Improvement (604968)
 */

const fs = require('fs');
const path = require('path');

const statePath = path.join(__dirname, 'crawl_state.js');

// 读取当前 crawl_state.js
let content = fs.readFileSync(statePath, 'utf-8');

const now = new Date().toISOString();

// 更新 lastUpdated
content = content.replace(
  /"lastUpdated":\s*"[^"]*"/,
  `"lastUpdated": "${now}"`
);

// 更新 Temu 家电 (2096)
content = content.replace(
  /("catId":\s*2096,[\s\S]*?"lastCrawled":\s*)"[^"]*"/,
  `$1"${now}"`
);

// 更新 Shein 玩具和游戏 (4328)
content = content.replace(
  /("catId":\s*4328,[\s\S]*?"lastCrawled":\s*)"[^"]*"/,
  `$1"${now}"`
);

// 更新 Amazon 服装、鞋履和珠宝 (7141123011)
content = content.replace(
  /("catId":\s*7141123011,[\s\S]*?"lastCrawled":\s*)"[^"]*"/,
  `$1"${now}"`
);

// 更新 速卖通 运动鞋服及包配 (201768104)
content = content.replace(
  /("catId":\s*201768104,[\s\S]*?"lastCrawled":\s*)"[^"]*"/,
  `$1"${now}"`
);

// 更新 TikTok Home Improvement (604968)
content = content.replace(
  /("catId":\s*604968,[\s\S]*?"lastCrawled":\s*)"[^"]*"/,
  `$1"${now}"`
);

// 写回文件
fs.writeFileSync(statePath, content, 'utf-8');

console.log(`[更新] crawl_state.js 已更新`);
console.log(`[更新] 时间戳: ${now}`);
console.log(`[更新] 更新的类目:`);
console.log(`  - Temu: 家电 (2096)`);
console.log(`  - Shein: 玩具和游戏 (4328)`);
console.log(`  - Amazon: 服装、鞋履和珠宝 (7141123011)`);
console.log(`  - 速卖通: 运动鞋服及包配 (201768104)`);
console.log(`  - TikTok: Home Improvement (604968)`);
