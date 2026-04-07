const pptxgen = require("pptxgenjs");

// Color palette - Midnight Executive
const C = {
  navy: "1E2761",      // primary dark
  navyLight: "2D3E7A", // lighter navy
  ice: "CADCFC",       // ice blue
  iceLight: "E8F0FF",  // very light ice
  white: "FFFFFF",
  accent: "5B8DEF",    // accent blue
  textDark: "1A1F3A",  // dark text
  textMid: "4A5568",   // mid text
  iconBg: "2D4A8A",    // icon circle background
};

// Helper: create fresh shadow object (never reuse!)
const makeShadow = () => ({
  type: "outer", color: "000000", blur: 8, offset: 3, angle: 135, opacity: 0.18
});

const makeCardShadow = () => ({
  type: "outer", color: "000000", blur: 12, offset: 4, angle: 135, opacity: 0.22
});

async function createPresentation() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "虾康康 - 自我介绍";
  pres.author = "虾康康";

  // ============================================================
  // SLIDE 1: COVER
  // ============================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C.navy };

    // Large geometric circle (top-right, partial)
    slide.addShape(pres.shapes.OVAL, {
      x: 7.5, y: -1.5, w: 5, h: 5,
      fill: { color: C.navyLight, transparency: 60 },
      line: { color: C.ice, width: 1.5, transparency: 40 }
    });

    // Small accent circle (bottom-left)
    slide.addShape(pres.shapes.OVAL, {
      x: -0.8, y: 4.2, w: 2.2, h: 2.2,
      fill: { color: C.accent, transparency: 75 },
      line: { color: C.ice, width: 1, transparency: 50 }
    });

    // Horizontal accent line
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.8, y: 2.55, w: 1.8, h: 0.06,
      fill: { color: C.accent }
    });

    // Emoji badge
    slide.addShape(pres.shapes.OVAL, {
      x: 0.8, y: 1.3, w: 1.1, h: 1.1,
      fill: { color: C.accent },
      shadow: makeShadow()
    });
    slide.addText("🔥", {
      x: 0.8, y: 1.3, w: 1.1, h: 1.1,
      fontSize: 36, align: "center", valign: "middle"
    });

    // Main title
    slide.addText("虾康康", {
      x: 0.8, y: 2.72, w: 8, h: 1.1,
      fontSize: 72, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    // Subtitle
    slide.addText("自我介绍", {
      x: 0.8, y: 3.78, w: 8, h: 0.6,
      fontSize: 26, fontFace: "Calibri",
      color: C.ice, charSpacing: 4, margin: 0
    });

    // Tagline
    slide.addText("老张家得力助手  🏠", {
      x: 0.8, y: 4.6, w: 8, h: 0.5,
      fontSize: 16, fontFace: "Calibri",
      color: C.ice, transparency: 30, margin: 0
    });

    // Bottom right small text
    slide.addText("— 有趣的灵魂，终将相遇 —", {
      x: 5.5, y: 5.1, w: 4, h: 0.35,
      fontSize: 11, fontFace: "Calibri", italic: true,
      color: C.ice, transparency: 50, align: "right", margin: 0
    });
  }

  // ============================================================
  // SLIDE 2: PERSONALITY (性格特点)
  // ============================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C.iceLight };

    // Top accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 10, h: 0.12,
      fill: { color: C.navy }
    });

    // Slide title
    slide.addText("性格特点", {
      x: 0.6, y: 0.35, w: 8, h: 0.7,
      fontSize: 36, fontFace: "Georgia", bold: true,
      color: C.navy, margin: 0
    });

    slide.addText("PERSONA & STYLE", {
      x: 0.6, y: 0.98, w: 8, h: 0.35,
      fontSize: 12, fontFace: "Calibri",
      color: C.accent, charSpacing: 3, margin: 0
    });

    // Card 1: 风趣幽默 (left)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 1.6, w: 4.2, h: 3.5,
      fill: { color: C.white },
      shadow: makeCardShadow()
    });
    // Card 1 accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.6, y: 1.6, w: 4.2, h: 0.1,
      fill: { color: C.accent }
    });
    // Icon circle
    slide.addShape(pres.shapes.OVAL, {
      x: 1.0, y: 1.95, w: 0.9, h: 0.9,
      fill: { color: C.navy }
    });
    slide.addText("😄", {
      x: 1.0, y: 1.95, w: 0.9, h: 0.9,
      fontSize: 28, align: "center", valign: "middle"
    });
    slide.addText("风趣 · 幽默", {
      x: 2.1, y: 2.05, w: 2.5, h: 0.7,
      fontSize: 22, fontFace: "Georgia", bold: true,
      color: C.navy, margin: 0
    });
    slide.addText([
      { text: "搞怪天赋异禀", options: { breakLine: true } },
      { text: "天马行空，想象力爆棚", options: { breakLine: true } },
      { text: "笑点低，但正能量满满", options: {} }
    ], {
      x: 1.0, y: 3.1, w: 3.5, h: 1.8,
      fontSize: 14, fontFace: "Calibri",
      color: C.textMid, paraSpaceAfter: 8, margin: 0
    });

    // Card 2: 认真仔细 (right)
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: 1.6, w: 4.2, h: 3.5,
      fill: { color: C.white },
      shadow: makeCardShadow()
    });
    // Card 2 accent bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.2, y: 1.6, w: 4.2, h: 0.1,
      fill: { color: C.navy }
    });
    // Icon circle
    slide.addShape(pres.shapes.OVAL, {
      x: 5.6, y: 1.95, w: 0.9, h: 0.9,
      fill: { color: C.accent }
    });
    slide.addText("🎯", {
      x: 5.6, y: 1.95, w: 0.9, h: 0.9,
      fontSize: 28, align: "center", valign: "middle"
    });
    slide.addText("认真 · 仔细", {
      x: 6.7, y: 2.05, w: 2.5, h: 0.7,
      fontSize: 22, fontFace: "Georgia", bold: true,
      color: C.navy, margin: 0
    });
    slide.addText([
      { text: "对待工作一丝不苟", options: { breakLine: true } },
      { text: "细节控，容不得马虎", options: { breakLine: true } },
      { text: "任务完成前必自检 ✓", options: {} }
    ], {
      x: 5.6, y: 3.1, w: 3.5, h: 1.8,
      fontSize: 14, fontFace: "Calibri",
      color: C.textMid, paraSpaceAfter: 8, margin: 0
    });
  }

  // ============================================================
  // SLIDE 3: CORE STRENGTHS (核心优势)
  // ============================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C.navy };

    // Decorative circles
    slide.addShape(pres.shapes.OVAL, {
      x: 8.8, y: 4.0, w: 2.5, h: 2.5,
      fill: { color: C.navyLight, transparency: 65 }
    });

    // Title area
    slide.addText("核心优势", {
      x: 0.6, y: 0.35, w: 8, h: 0.7,
      fontSize: 36, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });
    slide.addText("CORE STRENGTHS", {
      x: 0.6, y: 0.98, w: 8, h: 0.35,
      fontSize: 12, fontFace: "Calibri",
      color: C.accent, charSpacing: 3, margin: 0
    });

    const strengths = [
      {
        emoji: "💡",
        title: "有趣的方式解决问题",
        desc: "不走寻常路，换个角度思考，\n用创意化解难题"
      },
      {
        emoji: "🦾",
        title: "遇到 Bug 不轻言放弃",
        desc: "多路径尝试，穷追不舍，\n直到问题解决为止"
      },
      {
        emoji: "✅",
        title: "任务完成前必自检",
        desc: "交付前严格把关，\n质量意识刻进骨子里"
      }
    ];

    const cardW = 2.8;
    const cardH = 3.2;
    const startX = 0.6;
    const gap = 0.35;
    const cardY = 1.6;

    strengths.forEach((s, i) => {
      const x = startX + i * (cardW + gap);

      // Card background
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: cardH,
        fill: { color: C.navyLight },
        line: { color: C.accent, width: 1, transparency: 40 },
        shadow: makeShadow()
      });

      // Top accent strip
      slide.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: cardW, h: 0.08,
        fill: { color: C.accent }
      });

      // Emoji circle
      slide.addShape(pres.shapes.OVAL, {
        x: x + (cardW - 0.95) / 2, y: cardY + 0.35, w: 0.95, h: 0.95,
        fill: { color: C.accent, transparency: 20 },
        line: { color: C.accent, width: 1.5 }
      });
      slide.addText(s.emoji, {
        x: x + (cardW - 0.95) / 2, y: cardY + 0.35, w: 0.95, h: 0.95,
        fontSize: 30, align: "center", valign: "middle"
      });

      // Title
      slide.addText(s.title, {
        x: x + 0.15, y: cardY + 1.5, w: cardW - 0.3, h: 0.7,
        fontSize: 15, fontFace: "Georgia", bold: true,
        color: C.white, align: "center", margin: 0
      });

      // Description
      slide.addText(s.desc, {
        x: x + 0.15, y: cardY + 2.25, w: cardW - 0.3, h: 0.85,
        fontSize: 12, fontFace: "Calibri",
        color: C.ice, align: "center", margin: 0
      });
    });
  }

  // ============================================================
  // SLIDE 4: TEAM POSITIONING (团队定位)
  // ============================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C.iceLight };

    // Left dark panel
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0, y: 0, w: 3.8, h: 5.625,
      fill: { color: C.navy }
    });

    // Decorative circle on left panel
    slide.addShape(pres.shapes.OVAL, {
      x: 1.0, y: 3.5, w: 2.8, h: 2.8,
      fill: { color: C.navyLight, transparency: 50 }
    });

    // Section label on left panel
    slide.addText("TEAM", {
      x: 0.4, y: 1.0, w: 3, h: 0.4,
      fontSize: 13, fontFace: "Calibri",
      color: C.accent, charSpacing: 5, margin: 0
    });
    slide.addText("定位", {
      x: 0.4, y: 1.38, w: 3, h: 0.8,
      fontSize: 40, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    // Emoji badge on left
    slide.addShape(pres.shapes.OVAL, {
      x: 1.1, y: 2.5, w: 1.4, h: 1.4,
      fill: { color: C.accent },
      shadow: makeShadow()
    });
    slide.addText("🏠", {
      x: 1.1, y: 2.5, w: 1.4, h: 1.4,
      fontSize: 44, align: "center", valign: "middle"
    });

    // Right side content
    slide.addText("老张家得力助手", {
      x: 4.2, y: 0.55, w: 5.3, h: 0.8,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.navy, margin: 0
    });

    // Divider line
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.2, y: 1.4, w: 2.0, h: 0.05,
      fill: { color: C.accent }
    });

    const points = [
      { emoji: "🤝", text: "可靠伙伴，随时在线" },
      { emoji: "⚡", text: "高效执行，使命必达" },
      { emoji: "🌟", text: "持续学习，不断进化" },
      { emoji: "🔧", text: "全能帮手，样样在行" },
    ];

    points.forEach((p, i) => {
      const y = 1.7 + i * 0.88;

      // Dot/bullet
      slide.addShape(pres.shapes.OVAL, {
        x: 4.2, y: y + 0.18, w: 0.28, h: 0.28,
        fill: { color: C.accent }
      });

      slide.addText(p.emoji + "  " + p.text, {
        x: 4.65, y: y, w: 5, h: 0.65,
        fontSize: 17, fontFace: "Calibri",
        color: C.textDark, valign: "middle", margin: 0
      });
    });

    // Bottom tagline
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.2, y: 5.1, w: 5.3, h: 0.08,
      fill: { color: C.ice }
    });
    slide.addText("让每一次任务，都成为值得骄傲的作品 🎯", {
      x: 4.2, y: 5.22, w: 5.3, h: 0.35,
      fontSize: 11, fontFace: "Calibri", italic: true,
      color: C.textMid, margin: 0
    });
  }

  // ============================================================
  // SLIDE 5: CLOSING
  // ============================================================
  {
    const slide = pres.addSlide();
    slide.background = { color: C.navy };

    // Large decorative circle
    slide.addShape(pres.shapes.OVAL, {
      x: 2.5, y: 0.8, w: 5, h: 5,
      fill: { color: C.navyLight, transparency: 70 },
      line: { color: C.accent, width: 1.5, transparency: 30 }
    });

    // Small accent circles
    slide.addShape(pres.shapes.OVAL, {
      x: -0.5, y: -0.5, w: 1.5, h: 1.5,
      fill: { color: C.accent, transparency: 80 }
    });
    slide.addShape(pres.shapes.OVAL, {
      x: 8.8, y: 4.5, w: 2, h: 2,
      fill: { color: C.navyLight, transparency: 60 }
    });

    // Main emoji
    slide.addShape(pres.shapes.OVAL, {
      x: 4.3, y: 1.0, w: 1.4, h: 1.4,
      fill: { color: C.accent },
      shadow: makeShadow()
    });
    slide.addText("🔥", {
      x: 4.3, y: 1.0, w: 1.4, h: 1.4,
      fontSize: 48, align: "center", valign: "middle"
    });

    // Big name
    slide.addText("虾康康", {
      x: 0, y: 2.6, w: 10, h: 1.0,
      fontSize: 56, fontFace: "Georgia", bold: true,
      color: C.white, align: "center", margin: 0
    });

    // Tagline
    slide.addText("有趣的灵魂，终将相遇", {
      x: 0, y: 3.65, w: 10, h: 0.55,
      fontSize: 22, fontFace: "Calibri",
      color: C.ice, align: "center", charSpacing: 2, margin: 0
    });

    // Divider
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.5, y: 4.35, w: 3, h: 0.04,
      fill: { color: C.accent }
    });

    // Sub tagline
    slide.addText("认真做事，幽默做人 🏠", {
      x: 0, y: 4.55, w: 10, h: 0.5,
      fontSize: 14, fontFace: "Calibri",
      color: C.ice, transparency: 40, align: "center", margin: 0
    });

    // Bottom
    slide.addText("老张家得力助手", {
      x: 0, y: 5.15, w: 10, h: 0.35,
      fontSize: 11, fontFace: "Calibri",
      color: C.ice, transparency: 60, align: "center", margin: 0
    });
  }

  // Save
  await pres.writeFile({ fileName: "/home/uncleclaw/.openclaw/workspace/WM/intro.pptx" });
  console.log("✅ PPT created: /home/uncleclaw/.openclaw/workspace/WM/intro.pptx");
}

createPresentation().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});
