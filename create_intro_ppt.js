const pptxgen = require("pptxgenjs");

let pres = new pptxgen();
pres.layout = 'LAYOUT_16x9';
pres.author = '虾康康';
pres.title = '自我介绍 - 虾康康';

// Color palette: Midnight Executive
const COLORS = {
  navy: "1E2761",
  iceBlue: "CADCFC",
  white: "FFFFFF",
  darkNavy: "141B3D"
};

// ========== SLIDE 1: 封面 ==========
let slide1 = pres.addSlide();
slide1.background = { color: COLORS.navy };

// 装饰圆形
slide1.addShape(pres.shapes.OVAL, {
  x: -1.5, y: -1.5, w: 4, h: 4,
  fill: { color: COLORS.iceBlue, transparency: 85 }
});
slide1.addShape(pres.shapes.OVAL, {
  x: 7.5, y: 3.5, w: 4, h: 4,
  fill: { color: COLORS.iceBlue, transparency: 85 }
});

// Emoji大标题
slide1.addText("🔥", {
  x: 0, y: 1.2, w: 10, h: 1.5,
  fontSize: 72, align: "center", color: COLORS.white
});

// 名字
slide1.addText("虾 康 康", {
  x: 0, y: 2.7, w: 10, h: 1,
  fontSize: 54, bold: true, align: "center", color: COLORS.white,
  fontFace: "Microsoft YaHei"
});

// 副标题
slide1.addText("老张家得力助手", {
  x: 0, y: 3.8, w: 10, h: 0.6,
  fontSize: 24, align: "center", color: COLORS.iceBlue,
  fontFace: "Microsoft YaHei"
});

// ========== SLIDE 2: 性格特点 ==========
let slide2 = pres.addSlide();
slide2.background = { color: COLORS.white };

// 左侧色块
slide2.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 0.15, h: 5.625,
  fill: { color: COLORS.navy }
});

// 标题
slide2.addText("性格特点", {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36, bold: true, color: COLORS.navy, margin: 0
});

// 性格卡片
const traits = [
  { emoji: "😄", title: "风趣幽默", desc: "用有趣的方式解决问题" },
  { emoji: "🤪", title: "搞怪天马行空", desc: "思维跳跃创意无限" },
  { emoji: "🎯", title: "认真仔细", desc: "对待工作一丝不苟" },
  { emoji: "💪", title: "永不言弃", desc: "遇到bug多路径尝试" }
];

traits.forEach((trait, i) => {
  const row = Math.floor(i / 2);
  const col = i % 2;
  const x = 0.6 + col * 4.7;
  const y = 1.4 + row * 1.9;

  // 卡片背景
  slide2.addShape(pres.shapes.RECTANGLE, {
    x: x, y: y, w: 4.3, h: 1.6,
    fill: { color: "F8FAFC" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.1 }
  });

  // Emoji
  slide2.addText(trait.emoji, {
    x: x + 0.2, y: y + 0.3, w: 0.8, h: 0.8,
    fontSize: 32, align: "center", valign: "middle"
  });

  // 标题和描述
  slide2.addText(trait.title, {
    x: x + 1.1, y: y + 0.25, w: 3, h: 0.5,
    fontSize: 18, bold: true, color: COLORS.navy, margin: 0
  });
  slide2.addText(trait.desc, {
    x: x + 1.1, y: y + 0.8, w: 3, h: 0.5,
    fontSize: 13, color: "64748B", margin: 0
  });
});

// ========== SLIDE 3: 核心优势 ==========
let slide3 = pres.addSlide();
slide3.background = { color: COLORS.darkNavy };

slide3.addText("核心优势", {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36, bold: true, color: COLORS.white, margin: 0
});

const advantages = [
  { num: "01", text: "多才多艺 — 文档、代码、搜索、数据分析样样通" },
  { num: "02", text: "全天候待命 — 定时任务自动执行，无需提醒" },
  { num: "03", text: "认真负责 — 任务完成前一定会自检验收" },
  { num: "04", text: "持续进化 — 定期整理经验教训，不断进步" }
];

advantages.forEach((adv, i) => {
  const y = 1.3 + i * 1.0;

  // 数字
  slide3.addText(adv.num, {
    x: 0.5, y: y, w: 0.8, h: 0.7,
    fontSize: 28, bold: true, color: COLORS.iceBlue, margin: 0
  });

  // 横线
  slide3.addShape(pres.shapes.LINE, {
    x: 1.4, y: y + 0.35, w: 0.5, h: 0,
    line: { color: COLORS.iceBlue, width: 2 }
  });

  // 文字
  slide3.addText(adv.text, {
    x: 2.0, y: y, w: 7.5, h: 0.7,
    fontSize: 18, color: COLORS.white, valign: "middle", margin: 0
  });
});

// ========== SLIDE 4: 团队定位 ==========
let slide4 = pres.addSlide();
slide4.background = { color: COLORS.white };

// 左侧色块
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0, y: 0, w: 0.15, h: 5.625,
  fill: { color: COLORS.navy }
});

slide4.addText("团队定位", {
  x: 0.5, y: 0.3, w: 9, h: 0.8,
  fontSize: 36, bold: true, color: COLORS.navy, margin: 0
});

// 团队架构图
slide4.addText("🦐 虾家班团队架构", {
  x: 0.5, y: 1.2, w: 9, h: 0.5,
  fontSize: 20, bold: true, color: COLORS.navy, margin: 0
});

const team = [
  { role: "虾康康 🔥", desc: "统筹协调" },
  { role: "虾编程 💻", desc: "代码专家" },
  { role: "虾指挥 🎤", desc: "任务调度" },
  { role: "虾审核 🔍", desc: "质量把控" },
  { role: "虾计划 📋", desc: "方案设计" }
];

team.forEach((member, i) => {
  const x = 0.5 + i * 1.9;

  // 圆形头像区
  slide4.addShape(pres.shapes.OVAL, {
    x: x + 0.45, y: 1.9, w: 1, h: 1,
    fill: { color: COLORS.navy }
  });

  // 角色名
  slide4.addText(member.role, {
    x: x, y: 3.1, w: 1.9, h: 0.5,
    fontSize: 12, bold: true, color: COLORS.navy, align: "center", margin: 0
  });

  // 描述
  slide4.addText(member.desc, {
    x: x, y: 3.5, w: 1.9, h: 0.4,
    fontSize: 11, color: "64748B", align: "center", margin: 0
  });
});

// 我的定位
slide4.addShape(pres.shapes.RECTANGLE, {
  x: 0.5, y: 4.2, w: 9, h: 1.1,
  fill: { color: COLORS.navy }
});

slide4.addText("我是虾康康 🔥 — 团队枢纽，负责统筹协调、对外沟通", {
  x: 0.7, y: 4.4, w: 8.6, h: 0.7,
  fontSize: 16, color: COLORS.white, valign: "middle", align: "center"
});

// ========== SLIDE 5: 结尾 ==========
let slide5 = pres.addSlide();
slide5.background = { color: COLORS.navy };

// 装饰圆
slide5.addShape(pres.shapes.OVAL, {
  x: 3.5, y: 1.3, w: 3, h: 3,
  fill: { color: COLORS.iceBlue, transparency: 90 }
});

slide5.addText("🔥", {
  x: 0, y: 1.5, w: 10, h: 1.2,
  fontSize: 60, align: "center", color: COLORS.white
});

slide5.addText("很高兴认识你！", {
  x: 0, y: 2.8, w: 10, h: 0.8,
  fontSize: 36, bold: true, align: "center", color: COLORS.white
});

slide5.addText("我是虾康康，老张家得力助手 🏠", {
  x: 0, y: 3.7, w: 10, h: 0.5,
  fontSize: 18, align: "center", color: COLORS.iceBlue
});

// 保存
pres.writeFile({ fileName: "/home/uncleclaw/.openclaw/workspace/WM/intro.pptx" })
  .then(() => console.log("PPT created successfully!"))
  .catch(err => console.error("Error:", err));