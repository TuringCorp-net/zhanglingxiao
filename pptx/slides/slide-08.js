// slide-08.js - QQ & Other Social
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 8, title: "QQ & Other Social" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("QQ & Other Social Platforms", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Diversified Social Ecosystem Beyond WeChat", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // QQ section - large card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 4.5, h: 3.95,
    fill: { color: theme.primary }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 4.5, h: 0.06,
    fill: { color: theme.accent }
  });

  slide.addText("QQ", {
    x: 0.5, y: 1.25, w: 4.1, h: 0.55,
    fontSize: 40, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "left", margin: 0
  });
  slide.addText("Instant Messaging Pioneer", {
    x: 0.5, y: 1.78, w: 4.1, h: 0.3,
    fontSize: 13, fontFace: "Arial",
    color: theme.accent, bold: false, italic: true, align: "left", margin: 0
  });

  const qqStats = [
    { v: "500M+", l: "Registered Users" },
    { v: "600M+", l: "Monthly Active Users" },
    { v: "1999", l: "Year Launched" },
    { v: "AI-powered", l: "Content Feed" }
  ];
  qqStats.forEach((s, i) => {
    slide.addText(s.v, {
      x: 0.5, y: 2.2 + i * 0.6, w: 2.2, h: 0.4,
      fontSize: 20, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "left", margin: 0
    });
    slide.addText(s.l, {
      x: 2.7, y: 2.2 + i * 0.6, w: 2.0, h: 0.4,
      fontSize: 11, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", valign: "middle", margin: 0
    });
  });

  // Features row
  const qqFeatures = ["QQ Pay", "QQ Mail", "QQ Music", "QQ Video", "QQ Space"];
  qqFeatures.forEach((f, i) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.5 + i * 0.82, y: 4.55, w: 0.76, h: 0.35,
      fill: { color: theme.accent }
    });
    slide.addText(f, {
      x: 0.5 + i * 0.82, y: 4.55, w: 0.76, h: 0.35,
      fontSize: 8, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  });

  // Right column - other platforms
  const otherPlatforms = [
    {
      name: "QQ International",
      desc: "Available in English, Korean, Japanese and more. Strong presence in Southeast Asia, India and Brazil.",
      stat: "80+ countries"
    },
    {
      name: "TIM (Tencent Interaction Messenger)",
      desc: "Enterprise-focused IM built for办公场景. Supports文档协作, cloud storage, and calendar integration.",
      stat: "B2B Focus"
    },
    {
      name: "WeChat Work (WeCom)",
      desc: "Enterprise communication & collaboration platform. Serves 5M+ businesses with CRM and marketing tools.",
      stat: "5M+ businesses"
    },
    {
      name: "QQ Speed (KartRider)",
      desc: "Casual gaming platform within QQ ecosystem. Racing games, casual social games with 100M+ users.",
      stat: "100M+ gamers"
    }
  ];

  otherPlatforms.forEach((p, i) => {
    const y = 1.1 + i * 0.96;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.0, y, w: 4.7, h: 0.88,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.0, y, w: 0.06, h: 0.88,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });

    slide.addText(p.name, {
      x: 5.2, y: y + 0.08, w: 3.2, h: 0.3,
      fontSize: 13, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(p.desc, {
      x: 5.2, y: y + 0.38, w: 3.5, h: 0.45,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(p.stat, {
      x: 8.5, y: y + 0.08, w: 1.1, h: 0.3,
      fontSize: 10, fontFace: "Arial",
      color: theme.accent, bold: true, align: "right", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("8", {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fontSize: 12, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  const theme = { primary: "2b2d42", secondary: "8d99ae", accent: "ef233c", light: "d90429", bg: "edf2f4" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-08-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
