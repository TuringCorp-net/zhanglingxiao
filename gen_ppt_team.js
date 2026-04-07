const pptxgen = require("pptxgenjs");

const COLORS = {
  teal1: "028090",
  teal2: "00A896",
  teal3: "02C39A",
  white: "FFFFFF",
  dark: "1A3A3A",
  light: "E8F8F5",
};

const makeShadow = () => ({ type: "outer", blur: 8, offset: 3, angle: 135, color: "000000", opacity: 0.15 });

let pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "虾康康";
pres.title = "虾家班团队介绍";

// ── Slide 1: 封面 ──────────────────────────────────────────
{
  let slide = pres.addSlide();
  slide.background = { color: COLORS.teal1 };

  // 大圆形装饰
  slide.addShape(pres.shapes.OVAL, { x: -1.5, y: -1.5, w: 4, h: 4, fill: { color: COLORS.teal2, transparency: 40 } });
  slide.addShape(pres.shapes.OVAL, { x: 7.5, y: 3.5, w: 4, h: 4, fill: { color: COLORS.teal2, transparency: 40 } });

  // 顶部标题
  slide.addText("🦐 虾家班团队介绍", {
    x: 0.5, y: 1.2, w: 9, h: 1.0,
    fontSize: 44, bold: true, color: COLORS.white,
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 副标题
  slide.addText("老张家得力助手军团", {
    x: 0.5, y: 2.4, w: 9, h: 0.7,
    fontSize: 28, color: COLORS.teal3,
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 分隔线
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 3.2, w: 3, h: 0.04,
    fill: { color: COLORS.white, transparency: 50 }
  });

  // 制作信息
  slide.addText("🔥 虾康康 制作", {
    x: 0.5, y: 3.6, w: 9, h: 0.6,
    fontSize: 22, color: COLORS.white,
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 底部装饰线
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.2, w: 10, h: 0.425,
    fill: { color: COLORS.teal3, transparency: 30 }
  });
}

// ── Slide 2: 团队架构（角色卡片）─── 深色背景 ─────────────
{
  let slide = pres.addSlide();
  slide.background = { color: COLORS.teal2 };

  slide.addText("团队架构", {
    x: 0.5, y: 0.2, w: 9, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.white,
    align: "center", fontFace: "Microsoft YaHei"
  });

  const roles = [
    { emoji: "🔥", name: "虾康康", desc: "总指挥·协调员" },
    { emoji: "💻", name: "虾编程", desc: "代码小能手" },
    { emoji: "🎤", name: "虾指挥", desc: "任务调度员" },
    { emoji: "🔍", name: "虾审核", desc: "质量守门员" },
    { emoji: "📋", name: "虾计划", desc: "规划管理员" },
    { emoji: "🚀", name: "虾忙活", desc: "执行实干家" },
  ];

  const cardW = 2.8, cardH = 2.0, gap = 0.35;
  const totalW = roles.length * cardW + (roles.length - 1) * gap;
  const startX = (10 - totalW) / 2;
  const cardY = 1.3;

  roles.forEach((role, i) => {
    const x = startX + i * (cardW + gap);
    // 卡片背景
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: COLORS.white }, shadow: makeShadow()
    });
    // 顶部色条
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: 0.15,
      fill: { color: COLORS.teal1 }
    });
    // Emoji
    slide.addText(role.emoji, {
      x, y: cardY + 0.25, w: cardW, h: 0.7,
      fontSize: 36, align: "center", valign: "middle"
    });
    // 名字
    slide.addText(role.name, {
      x, y: cardY + 0.95, w: cardW, h: 0.45,
      fontSize: 16, bold: true, color: COLORS.teal1,
      align: "center", fontFace: "Microsoft YaHei"
    });
    // 描述
    slide.addText(role.desc, {
      x, y: cardY + 1.4, w: cardW, h: 0.45,
      fontSize: 11, color: "666666",
      align: "center", fontFace: "Microsoft YaHei"
    });
  });

  // 底部说明
  slide.addText("六大角色，各司其职，协作无间", {
    x: 0.5, y: 4.7, w: 9, h: 0.5,
    fontSize: 16, color: COLORS.white,
    align: "center", fontFace: "Microsoft YaHei", italic: true
  });
}

// ── Slide 3: 标准工作流 ───────────────────────────────────
{
  let slide = pres.addSlide();
  slide.background = { color: COLORS.light };

  slide.addText("标准工作流", {
    x: 0.5, y: 0.2, w: 9, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.teal1,
    align: "center", fontFace: "Microsoft YaHei"
  });

  const steps = [
    { label: "黎叔", sub: "发任务", color: COLORS.teal1 },
    { label: "虾康康", sub: "接收分发", color: COLORS.teal2 },
    { label: "虾计划", sub: "制定计划", color: COLORS.teal3 },
    { label: "虾审核", sub: "质量把控", color: COLORS.teal2 },
    { label: "虾指挥", sub: "协调调度", color: COLORS.teal1 },
    { label: "执行", sub: "落地干活", color: COLORS.teal2 },
    { label: "汇报", sub: "反馈结果", color: COLORS.teal3 },
  ];

  const boxW = 1.2, boxH = 0.9, gapX = 0.18;
  const totalW = steps.length * boxW + (steps.length - 1) * gapX;
  const startX = (10 - totalW) / 2;
  const rowY = 1.5;

  steps.forEach((step, i) => {
    const x = startX + i * (boxW + gapX);
    // 圆角卡片
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y: rowY, w: boxW, h: boxH,
      fill: { color: step.color }, shadow: makeShadow(), rectRadius: 0.08
    });
    slide.addText(step.label, {
      x, y: rowY + 0.05, w: boxW, h: 0.5,
      fontSize: 13, bold: true, color: COLORS.white,
      align: "center", fontFace: "Microsoft YaHei"
    });
    slide.addText(step.sub, {
      x, y: rowY + 0.5, w: boxW, h: 0.35,
      fontSize: 10, color: COLORS.white,
      align: "center", fontFace: "Microsoft YaHei", transparency: 20
    });

    // 箭头（除最后一个）
    if (i < steps.length - 1) {
      const arrowX = x + boxW + 0.01;
      slide.addText("→", {
        x: arrowX, y: rowY + 0.2, w: gapX, h: 0.5,
        fontSize: 16, color: step.color,
        align: "center", valign: "middle"
      });
    }
  });

  // 第二行说明
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 2.9, w: 8.4, h: 2.0,
    fill: { color: COLORS.white }, shadow: makeShadow()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.8, y: 2.9, w: 0.1, h: 2.0,
    fill: { color: COLORS.teal1 }
  });

  slide.addText("工作流说明", {
    x: 1.1, y: 3.0, w: 7.8, h: 0.4,
    fontSize: 15, bold: true, color: COLORS.teal1, fontFace: "Microsoft YaHei"
  });

  const flowNotes = [
    { text: "1. 黎叔发起任务需求，描述目标和期望", options: { bullet: false, breakLine: true } },
    { text: "2. 虾康康接收并分析任务，协调分配", options: { bullet: false, breakLine: true } },
    { text: "3. 虾计划制定执行方案和时间节点", options: { bullet: false, breakLine: true } },
    { text: "4. 虾审核把关质量和合规性", options: { bullet: false, breakLine: true } },
    { text: "5. 虾指挥统筹资源，推进执行", options: { bullet: false, breakLine: true } },
    { text: "6. 虾忙活等执行者落地干活", options: { bullet: false, breakLine: true } },
    { text: "7. 执行结果汇报给黎叔，完成闭环", options: { bullet: false } },
  ];

  slide.addText(flowNotes, {
    x: 1.1, y: 3.4, w: 7.8, h: 1.4,
    fontSize: 12, color: "444444", fontFace: "Microsoft YaHei"
  });
}

// ── Slide 4: 核心成员 ─────────────────────────────────────
{
  let slide = pres.addSlide();
  slide.background = { color: COLORS.teal1 };

  slide.addText("核心成员", {
    x: 0.5, y: 0.2, w: 9, h: 0.7,
    fontSize: 32, bold: true, color: COLORS.white,
    align: "center", fontFace: "Microsoft YaHei"
  });

  const members = [
    { emoji: "🔥", name: "虾康康", role: "协调员", bio: "老张家AI助手核心，热情似火，统筹全局，负责各角色之间的沟通协作与任务分发。" },
    { emoji: "💻", name: "虾编程", role: "程序员", bio: "代码狂人，技术担当，精通各类编程语言和工具，负责系统开发与代码实现。" },
    { emoji: "🎤", name: "虾指挥", role: "指挥官", bio: "运筹帷幄，调度有方，负责任务分配、进度把控和资源协调，确保高效运转。" },
    { emoji: "🔍", name: "虾审核", role: "审核员", bio: "火眼金睛，质量守护，严格把关每一项工作成果，确保符合标准和要求。" },
    { emoji: "📋", name: "虾计划", role: "规划师", bio: "谋定后动，条理清晰，负责制定详细的工作计划、时间表和风险预案。" },
    { emoji: "🚀", name: "虾忙活", role: "执行者", bio: "说干就干，效率至上，负责将计划落地执行，是团队最强行动力担当。" },
  ];

  const cardW = 2.9, cardH = 2.2, gapX = 0.25, gapY = 0.2;
  const cols = 3;
  const totalW = cols * cardW + (cols - 1) * gapX;
  const startX = (10 - totalW) / 2;
  const startY = 1.1;

  members.forEach((m, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // 卡片背景
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: COLORS.white }, shadow: makeShadow()
    });
    // 左侧色条
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.1, h: cardH,
      fill: { color: COLORS.teal3 }
    });
    // Emoji
    slide.addText(m.emoji, {
      x: x + 0.15, y: y + 0.1, w: 0.7, h: 0.7,
      fontSize: 28, align: "center", valign: "middle"
    });
    // 名字
    slide.addText(m.name, {
      x: x + 0.8, y: y + 0.1, w: cardW - 0.9, h: 0.4,
      fontSize: 16, bold: true, color: COLORS.teal1, fontFace: "Microsoft YaHei"
    });
    // 角色标签
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: x + 0.8, y: y + 0.5, w: 0.8, h: 0.3,
      fill: { color: COLORS.teal3, transparency: 30 }, rectRadius: 0.05
    });
    slide.addText(m.role, {
      x: x + 0.8, y: y + 0.5, w: 0.8, h: 0.3,
      fontSize: 9, color: COLORS.teal1, align: "center", fontFace: "Microsoft YaHei"
    });
    // 简介
    slide.addText(m.bio, {
      x: x + 0.15, y: y + 0.95, w: cardW - 0.3, h: 1.15,
      fontSize: 10, color: "555555", fontFace: "Microsoft YaHei", valign: "top"
    });
  });
}

// ── Slide 5: 联系我们 ────────────────────────────────────
{
  let slide = pres.addSlide();
  slide.background = { color: COLORS.light };

  slide.addText("联系我们", {
    x: 0.5, y: 0.3, w: 9, h: 0.8,
    fontSize: 36, bold: true, color: COLORS.teal1,
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 中央大卡片
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 1.5, y: 1.4, w: 7, h: 3.4,
    fill: { color: COLORS.white }, shadow: makeShadow()
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 1.5, y: 1.4, w: 7, h: 0.15,
    fill: { color: COLORS.teal1 }
  });

  // Emoji大字
  slide.addText("🔥", {
    x: 1.5, y: 1.6, w: 7, h: 1.0,
    fontSize: 60, align: "center", valign: "middle"
  });

  slide.addText("虾康康", {
    x: 1.5, y: 2.5, w: 7, h: 0.6,
    fontSize: 28, bold: true, color: COLORS.teal1,
    align: "center", fontFace: "Microsoft YaHei"
  });

  slide.addText("协调员", {
    x: 1.5, y: 3.05, w: 7, h: 0.45,
    fontSize: 18, color: COLORS.teal2,
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 分隔线
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 3.5, y: 3.55, w: 3, h: 0.03,
    fill: { color: COLORS.teal3 }
  });

  slide.addText("老张家 · 2026", {
    x: 1.5, y: 3.7, w: 7, h: 0.5,
    fontSize: 16, color: "888888",
    align: "center", fontFace: "Microsoft YaHei"
  });

  // 底部标语
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.0, w: 10, h: 0.625,
    fill: { color: COLORS.teal1, transparency: 90 }
  });
  slide.addText("得力助手，竭诚服务 · 虾家班 让工作更高效", {
    x: 0.5, y: 5.05, w: 9, h: 0.5,
    fontSize: 14, color: COLORS.teal1,
    align: "center", fontFace: "Microsoft YaHei", italic: true
  });
}

pres.writeFile({ fileName: "/home/uncleclaw/.openclaw/workspace/WM/虾家班团队介绍_v2.pptx" })
  .then(() => console.log("PPT 生成成功: /home/uncleclaw/.openclaw/workspace/WM/虾家班团队介绍_v2.pptx"))
  .catch(err => { console.error("生成失败:", err); process.exit(1); });
