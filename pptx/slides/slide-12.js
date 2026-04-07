// slide-12.js - Fintech Overview
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 12, title: "Fintech Overview" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Fintech & Payments", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("WeChat Pay & TenPay — Powering Digital Finance for 1B+ Users", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Left stat block
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 3.1, h: 3.85,
    fill: { color: theme.primary }
  });

  const fintechStats = [
    { v: "1B+", l: "Daily Transactions\n(peak)" },
    { v: "400M+", l: "Active WeChat Pay\nUsers" },
    { v: "25+", l: "Countries with\nWeChat Pay" },
    { v: "#1", l: "Mobile Payment\nPlatform CN" },
    { v: "RMB", l: "Digital Yuan\nPilot Partner" }
  ];

  fintechStats.forEach((s, i) => {
    const y = 1.2 + i * 0.76;
    slide.addText(s.v, {
      x: 0.45, y, w: 2.8, h: 0.42,
      fontSize: 28, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "left", margin: 0
    });
    slide.addText(s.l, {
      x: 0.45, y: y + 0.4, w: 2.8, h: 0.34,
      fontSize: 10, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Right content blocks
  const fintechBlocks = [
    {
      title: "WeChat Pay (微信支付)",
      points: [
        "QR code payments, in-app purchases, red packets",
        "Integrated into WeChat ecosystem (Messages, Mini Programs, Official Accounts)",
        "Cross-border payments in 25+ countries (Hong Kong, Japan, Korea, Thailand, etc.)",
        "Supports 18 currencies, Alipay interoperability"
      ],
      color: theme.accent
    },
    {
      title: "TenPay (财付通)",
      points: [
        "Core payment infrastructure for QQ, QQ Games, and third-party platforms",
        "Online banking, mobile top-ups, insurance payments",
        "Tencent's first payment platform — launched 2005",
        "Processed 1B+ daily transactions at peak"
      ],
      color: theme.light
    },
    {
      title: "Digital Currency Initiatives",
      points: [
        "Partner in China's Digital Currency (e-CNY) pilot program",
        "Integration with WeChat Pay for retail and B2B trials",
        "Exploring blockchain-based settlement systems"
      ],
      color: theme.accent
    }
  ];

  fintechBlocks.forEach((b, i) => {
    const y = 1.1 + i * 1.3;

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.6, y, w: 6.1, h: 1.2,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.6, y, w: 6.1, h: 0.05,
      fill: { color: b.color }
    });

    slide.addText(b.title, {
      x: 3.75, y: y + 0.1, w: 5.8, h: 0.3,
      fontSize: 13, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    const bulletText = b.points.map((p, idx) => ({
      text: p,
      options: { bullet: true, breakLine: idx < b.points.length - 1 }
    }));

    slide.addText(bulletText, {
      x: 3.75, y: y + 0.42, w: 5.8, h: 0.75,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("12", {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fontSize: 11, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  const theme = { primary: "2b2d42", secondary: "8d99ae", accent: "ef233c", light: "d90429", bg: "edf2f4" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-12-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
