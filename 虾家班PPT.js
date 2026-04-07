const pptxgen = require("pptxgenjs");

// Color scheme - Teal Trust (no # prefix)
const C = {
  primary:   "028090",
  secondary: "00A896",
  accent:    "02C39A",
  darkBg:    "023A42",
  lightBg:   "E8F6F5",
  white:     "FFFFFF",
  lightText: "E0F4F2",
  darkText:  "023A42",
  cardBg:    "FFFFFF",
};

const makeShadow = () => ({ type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.12 });

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.title  = "虾家班团队介绍";

// ─── SLIDE 1: 封面 (Dark) ───────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.darkBg };

  // Decorative circle top-right
  s.addShape(pres.shapes.OVAL, {
    x: 7.5, y: -1.2, w: 3.5, h: 3.5,
    fill: { color: C.primary, transparency: 40 },
    line: { color: C.primary, width: 0 }
  });
  // Decorative circle bottom-left
  s.addShape(pres.shapes.OVAL, {
    x: -0.8, y: 3.8, w: 2.8, h: 2.8,
    fill: { color: C.secondary, transparency: 50 },
    line: { color: C.secondary, width: 0 }
  });
  // Accent stripe left
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  // Main title
  s.addText("🦐 虾家班团队介绍", {
    x: 0.5, y: 1.6, w: 9, h: 1.2,
    fontSize: 52, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "center", valign: "middle"
  });

  // Subtitle highlight box
  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.8, y: 2.95, w: 4.4, h: 0.55,
    fill: { color: C.accent, transparency: 20 },
    line: { color: C.accent, width: 0 }
  });
  s.addText("老张家得力助手军团", {
    x: 0.5, y: 2.9, w: 9, h: 0.7,
    fontSize: 26, fontFace: "Calibri",
    color: C.lightText, align: "center", valign: "middle"
  });

  // Bottom credit bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.9, w: 10, h: 0.725,
    fill: { color: C.primary, transparency: 30 },
    line: { color: C.primary, width: 0 }
  });
  s.addText("🔥 虾康康 制作", {
    x: 0.5, y: 4.92, w: 9, h: 0.68,
    fontSize: 18, fontFace: "Calibri",
    color: C.lightText, align: "center", valign: "middle"
  });
}

// ─── SLIDE 2: 团队架构 (Light) ──────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  // Header bar
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: C.primary },
    line: { color: C.primary, width: 0 }
  });
  s.addText("团队架构", {
    x: 0.5, y: 0.05, w: 9, h: 0.9,
    fontSize: 32, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.92, w: 1.8, h: 0.06,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  const roles = [
    { emoji: "🔥", name: "虾康康", duty: "统筹协调", desc: "对外统一对接，任务分发与推进" },
    { emoji: "💻", name: "虾编程", duty: "代码开发", desc: "负责程序开发与代码实现" },
    { emoji: "🎤", name: "虾指挥", duty: "任务调度", desc: "分配任务、安排执行顺序" },
    { emoji: "🔍", name: "虾审核", duty: "质量把控", desc: "审查工作成果，保证质量" },
    { emoji: "📋", name: "虾计划", duty: "规划安排", desc: "制定计划、整理流程文档" },
    { emoji: "🚀", name: "虾忙活", duty: "执行落地", desc: "高效执行各项具体任务" },
  ];

  const cardW = 2.8, cardH = 1.65;
  const gapX = 0.35, gapY = 0.3;
  const startX = (10 - (cardW * 3 + gapX * 2)) / 2;
  const row1Y = 1.3, row2Y = row1Y + cardH + gapY;

  roles.forEach((r, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = row === 0 ? row1Y : row2Y;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.cardBg },
      shadow: makeShadow(),
      line: { color: C.cardBg, width: 0 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.07, h: cardH,
      fill: { color: C.accent },
      line: { color: C.accent, width: 0 }
    });
    s.addText(r.emoji, {
      x: x + 0.15, y: y + 0.12, w: 0.5, h: 0.5,
      fontSize: 22, align: "left", valign: "middle", margin: 0
    });
    s.addText(r.name, {
      x: x + 0.6, y: y + 0.12, w: cardW - 0.7, h: 0.38,
      fontSize: 16, fontFace: "Trebuchet MS", bold: true,
      color: C.darkText, align: "left", valign: "middle", margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.15, y: y + 0.56, w: 0.9, h: 0.28,
      fill: { color: C.secondary, transparency: 80 },
      line: { color: C.secondary, width: 0 }
    });
    s.addText(r.duty, {
      x: x + 0.15, y: y + 0.54, w: 0.9, h: 0.32,
      fontSize: 10, fontFace: "Calibri", bold: true,
      color: C.primary, align: "center", valign: "middle", margin: 0
    });
    s.addText(r.desc, {
      x: x + 0.15, y: y + 0.9, w: cardW - 0.25, h: 0.65,
      fontSize: 11, fontFace: "Calibri",
      color: "4A5568", align: "left", valign: "top", margin: 0
    });
  });
}

// ─── SLIDE 3: 标准工作流 (Light) ─────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: C.primary },
    line: { color: C.primary, width: 0 }
  });
  s.addText("标准工作流", {
    x: 0.5, y: 0.05, w: 9, h: 0.9,
    fontSize: 32, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.92, w: 2.2, h: 0.06,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  const steps = [
    { label: "黎叔",    sub: "下达指令" },
    { label: "虾康康",  sub: "接收分发" },
    { label: "虾计划",  sub: "制定计划" },
    { label: "虾审核",  sub: "方案审核" },
    { label: "虾指挥",  sub: "分配任务" },
    { label: "执行",    sub: "落地执行" },
    { label: "审核",    sub: "成果检查" },
    { label: "汇报",    sub: "结果反馈" },
  ];

  const nodeW = 1.05, nodeH = 1.1;
  const totalW = steps.length * nodeW + (steps.length - 1) * 0.1;
  const startX = (10 - totalW) / 2;
  const y = 2.3;

  s.addShape(pres.shapes.RECTANGLE, {
    x: startX - 0.15, y: y + 0.38, w: totalW + 0.3, h: 0.28,
    fill: { color: C.primary, transparency: 85 },
    line: { color: C.primary, width: 0 }
  });

  const nodeColors = [C.primary, C.secondary, C.accent, C.secondary, C.primary, C.accent, C.secondary, C.primary];

  steps.forEach((step, i) => {
    const x = startX + i * (nodeW + 0.1);
    const color = nodeColors[i];

    s.addShape(pres.shapes.OVAL, {
      x, y, w: nodeW, h: nodeH,
      fill: { color: color },
      shadow: makeShadow(),
      line: { color: color, width: 0 }
    });
    s.addText(step.label, {
      x, y: y + 0.15, w: nodeW, h: 0.5,
      fontSize: 11, fontFace: "Trebuchet MS", bold: true,
      color: C.white, align: "center", valign: "middle", margin: 0
    });
    s.addText(step.sub, {
      x, y: y + 0.62, w: nodeW, h: 0.38,
      fontSize: 9, fontFace: "Calibri",
      color: C.white, align: "center", valign: "middle", margin: 0
    });

    if (i < steps.length - 1) {
      s.addText("→", {
        x: x + nodeW + 0.01, y: y + 0.28, w: 0.1, h: 0.5,
        fontSize: 16, fontFace: "Calibri", bold: true,
        color: C.darkText, align: "center", valign: "middle", margin: 0
      });
    }
  });

  // Bottom description boxes
  const descs = [
    { icon: "📥", text: "黎叔下达需求\n虾康康统一接收" },
    { icon: "📐", text: "虾计划制定方案\n虾审核把关" },
    { icon: "🎯", text: "虾指挥分配任务\n执行全程跟踪" },
    { icon: "✅", text: "成果审核通过\n统一汇报黎叔" },
  ];
  const boxY = 3.85;
  const boxW = 2.15, boxH = 0.8;
  const boxGap = 0.2;
  const boxStartX = (10 - (boxW * 4 + boxGap * 3)) / 2;

  descs.forEach((d, i) => {
    const bx = boxStartX + i * (boxW + boxGap);
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: boxY, w: boxW, h: boxH,
      fill: { color: C.cardBg },
      shadow: makeShadow(),
      line: { color: C.cardBg, width: 0 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x: bx, y: boxY, w: boxW, h: 0.05,
      fill: { color: C.accent },
      line: { color: C.accent, width: 0 }
    });
    s.addText(d.icon + " " + d.text, {
      x: bx + 0.08, y: boxY + 0.05, w: boxW - 0.16, h: boxH - 0.08,
      fontSize: 10, fontFace: "Calibri",
      color: C.darkText, align: "center", valign: "middle", margin: 0
    });
  });
}

// ─── SLIDE 4: 核心成员介绍 (Light) ──────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.lightBg };

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 1.0,
    fill: { color: C.primary },
    line: { color: C.primary, width: 0 }
  });
  s.addText("核心成员", {
    x: 0.5, y: 0.05, w: 9, h: 0.9,
    fontSize: 32, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 0.92, w: 1.8, h: 0.06,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  const members = [
    { emoji: "🔥", name: "虾康康", role: "协调员", desc: "有事找我就对了，统一对外的窗口" },
    { emoji: "💻", name: "虾编程", role: "开发者", desc: "代码我来写，bug算我输" },
    { emoji: "🎤", name: "虾指挥", role: "调度员", desc: "排兵布阵，任务安排得明明白白" },
    { emoji: "🔍", name: "虾审核", role: "质检员", desc: "火眼金睛，质量问题逃不过我" },
    { emoji: "📋", name: "虾计划", role: "规划师", desc: "谋定后动，计划周全不遗漏" },
    { emoji: "🚀", name: "虾忙活", role: "执行者", desc: "说干就干，使命必达冲在前" },
  ];

  const cardW = 2.8, cardH = 1.7;
  const gapX = 0.35, gapY = 0.3;
  const startX = (10 - (cardW * 3 + gapX * 2)) / 2;
  const row1Y = 1.25, row2Y = row1Y + cardH + gapY;

  members.forEach((m, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = row === 0 ? row1Y : row2Y;

    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: C.cardBg },
      shadow: makeShadow(),
      line: { color: C.cardBg, width: 0 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.07, h: cardH,
      fill: { color: C.accent },
      line: { color: C.accent, width: 0 }
    });
    s.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: 0.05,
      fill: { color: C.secondary },
      line: { color: C.secondary, width: 0 }
    });
    s.addShape(pres.shapes.OVAL, {
      x: x + 0.18, y: y + 0.18, w: 0.55, h: 0.55,
      fill: { color: C.accent, transparency: 80 },
      line: { color: C.accent, transparency: 80, width: 0 }
    });
    s.addText(m.emoji, {
      x: x + 0.18, y: y + 0.18, w: 0.55, h: 0.55,
      fontSize: 20, align: "center", valign: "middle", margin: 0
    });
    s.addText(m.name, {
      x: x + 0.8, y: y + 0.18, w: cardW - 0.95, h: 0.32,
      fontSize: 17, fontFace: "Trebuchet MS", bold: true,
      color: C.darkText, align: "left", valign: "middle", margin: 0
    });
    s.addText(m.role, {
      x: x + 0.8, y: y + 0.5, w: 1.0, h: 0.25,
      fontSize: 10, fontFace: "Calibri",
      color: C.secondary, align: "left", valign: "middle", margin: 0
    });
    s.addShape(pres.shapes.LINE, {
      x: x + 0.15, y: y + 0.82, w: cardW - 0.3, h: 0,
      line: { color: C.accent, width: 0.5, transparency: 60 }
    });
    s.addText(m.desc, {
      x: x + 0.15, y: y + 0.9, w: cardW - 0.25, h: 0.7,
      fontSize: 11, fontFace: "Calibri", italic: true,
      color: "4A5568", align: "left", valign: "top", margin: 0
    });
  });
}

// ─── SLIDE 5: 联系方式 (Dark) ────────────────────────────────────────────────
{
  const s = pres.addSlide();
  s.background = { color: C.darkBg };

  s.addShape(pres.shapes.OVAL, {
    x: -1.0, y: -0.8, w: 3, h: 3,
    fill: { color: C.primary, transparency: 50 },
    line: { color: C.primary, width: 0 }
  });
  s.addShape(pres.shapes.OVAL, {
    x: 8.2, y: 3.8, w: 2.5, h: 2.5,
    fill: { color: C.secondary, transparency: 55 },
    line: { color: C.secondary, width: 0 }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  s.addText("联系我们", {
    x: 0.5, y: 0.5, w: 9, h: 0.9,
    fontSize: 38, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "center", valign: "middle"
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: 4.1, y: 1.35, w: 1.8, h: 0.06,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });

  const cardX = 2.8, cardY = 1.7, cardW = 4.4, cardH = 2.0;
  s.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: { color: C.primary, transparency: 30 },
    line: { color: C.accent, width: 1.5 }
  });
  s.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: cardW, h: 0.08,
    fill: { color: C.accent },
    line: { color: C.accent, width: 0 }
  });
  s.addText("🔥", {
    x: cardX + 0.3, y: cardY + 0.3, w: 0.8, h: 0.8,
    fontSize: 40, align: "center", valign: "middle", margin: 0
  });
  s.addText("协调员", {
    x: cardX + 1.2, y: cardY + 0.3, w: 2.8, h: 0.35,
    fontSize: 14, fontFace: "Calibri",
    color: C.lightText, align: "left", valign: "middle", margin: 0
  });
  s.addText("虾康康", {
    x: cardX + 1.2, y: cardY + 0.65, w: 2.8, h: 0.55,
    fontSize: 28, fontFace: "Trebuchet MS", bold: true,
    color: C.white, align: "left", valign: "middle", margin: 0
  });
  s.addShape(pres.shapes.LINE, {
    x: cardX + 0.3, y: cardY + 1.3, w: cardW - 0.6, h: 0,
    line: { color: C.accent, width: 0.8, transparency: 50 }
  });
  s.addText("所有对外统一对接窗口", {
    x: cardX + 0.3, y: cardY + 1.4, w: cardW - 0.6, h: 0.45,
    fontSize: 14, fontFace: "Calibri", italic: true,
    color: C.lightText, align: "center", valign: "middle", margin: 0
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 2.5, y: 4.05, w: 5, h: 0.55,
    fill: { color: C.accent, transparency: 85 },
    line: { color: C.accent, transparency: 85, width: 0 }
  });
  s.addText("有事找虾康康，万事不愁！", {
    x: 0.5, y: 4.05, w: 9, h: 0.55,
    fontSize: 18, fontFace: "Calibri", italic: true,
    color: C.lightText, align: "center", valign: "middle"
  });

  s.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 4.9, w: 10, h: 0.725,
    fill: { color: C.primary, transparency: 30 },
    line: { color: C.primary, width: 0 }
  });
  s.addText("老张家 · 2026", {
    x: 0.5, y: 4.92, w: 9, h: 0.68,
    fontSize: 16, fontFace: "Calibri",
    color: C.lightText, align: "center", valign: "middle"
  });
}

const outPath = "/home/uncleclaw/.openclaw/workspace/WM/虾家班团队介绍.pptx";
pres.writeFile({ fileName: outPath })
  .then(() => console.log("✅ PPT 已生成: " + outPath))
  .catch(e => console.error("❌ 错误:", e));
