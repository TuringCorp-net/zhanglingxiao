// slide-06.js - WeChat Ecosystem
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 6, title: "WeChat Ecosystem" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("WeChat Ecosystem", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("The Super App Connecting 1.3 Billion Lives", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Hero stat
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 3.2, h: 1.5,
    fill: { color: theme.primary }
  });
  slide.addText("1.3B+", {
    x: 0.3, y: 1.2, w: 3.2, h: 0.75,
    fontSize: 48, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", margin: 0
  });
  slide.addText("Monthly Active Users", {
    x: 0.3, y: 1.92, w: 3.2, h: 0.35,
    fontSize: 13, fontFace: "Arial",
    color: theme.accent, bold: true, align: "center", margin: 0
  });
  slide.addText("World's #1 Super App", {
    x: 0.3, y: 2.28, w: 3.2, h: 0.28,
    fontSize: 11, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "center", margin: 0
  });

  // Ecosystem pillars
  const pillars = [
    { title: "Messaging", icon: "💬", desc: "Text, Voice, Video calls\nGroups & Channels\nMoments feed" },
    { title: "Social", icon: "🌐", desc: "Official Accounts\nMini Programs discovery\nWeChat Search" },
    { title: "Payments", icon: "💳", desc: "WeChat Pay\nRed packets\nQR payments" },
    { title: "Mini Programs", icon: "⚡", desc: "7M+ apps inside WeChat\n400M+ DAU\nNative experience" },
    { title: "Services", icon: "🏢", desc: "Government services\nHealthcare booking\nFinancial services" },
    { title: "Content", icon: "📰", desc: "WeChat Video\nLive streaming\nNews & Articles" }
  ];

  const cardW = 2.9, cardH = 1.55;
  const startX = 3.65, startY = 1.1;
  const gapX = 0.15, gapY = 0.12;

  pillars.forEach((p, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.08 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: 0.04,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });

    slide.addText(p.title, {
      x: x + 0.12, y: y + 0.12, w: cardW - 0.2, h: 0.32,
      fontSize: 13, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(p.desc, {
      x: x + 0.12, y: y + 0.45, w: cardW - 0.2, h: 1.0,
      fontSize: 10, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Bottom note
  slide.addText("Launched 2011 | Available in 20+ languages | Active in 200+ countries", {
    x: 0.3, y: 4.85, w: 9, h: 0.28,
    fontSize: 11, fontFace: "Arial",
    color: theme.secondary, bold: false, italic: true, align: "left", margin: 0
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("6", {
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
  pres.writeFile({ fileName: "slide-06-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
