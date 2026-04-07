// slide-13.js - Fintech Services
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 13, title: "Fintech Services" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Fintech Services", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Beyond Payments — A Complete Financial Ecosystem", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  const services = [
    {
      name: "WeBank",
      full: "WeBank Co., Ltd. (微众银行)",
      type: "Digital Bank",
      established: "2014",
      detail: "China's first internet bank — joint venture with Xiaomi and others. Fully online bank serving 300M+ customers. Focus on small businesses, micro-finance, and retail banking.",
      highlight: "300M+ customers",
      color: theme.accent
    },
    {
      name: "WeSure",
      full: "WeSure Insurance Brokerage",
      type: "Insurance Platform",
      established: "2016",
      detail: "Insurance distribution platform leveraging WeChat ecosystem. Offers health, life, auto, and travel insurance. AI-powered risk assessment and claims processing.",
      highlight: "AI Underwriting",
      color: theme.light
    },
    {
      name: "Tencent Insurance",
      full: "Tencent Insurance Platform",
      type: "Insurance",
      established: "2017",
      detail: "Comprehensive insurance services including medical, critical illness, pension, and enterprise insurance. Partners with 100+ insurers. WeChat Mini Program integration.",
      highlight: "100+ Partners",
      color: theme.accent
    },
    {
      name: "WeCash",
      full: "WeCash (微众税银)",
      type: "Fintech Credit",
      established: "2014",
      detail: "Credit assessment using WeChat payment data, social behavior, and transaction history. Provides credit lines to small businesses in China. Blue Book fintech award winner.",
      highlight: "Data-Driven Credit",
      color: theme.light
    }
  ];

  services.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.3 + col * 4.8;
    const y = 1.1 + row * 2.05;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.6, h: 1.92,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
    });

    // Left accent
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: 1.92,
      fill: { color: s.color }
    });

    // Type badge
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.2, y: y + 0.12, w: 1.4, h: 0.28,
      fill: { color: theme.primary }
    });
    slide.addText(s.type, {
      x: x + 0.2, y: y + 0.12, w: 1.4, h: 0.28,
      fontSize: 9, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });

    slide.addText(s.name, {
      x: x + 0.2, y: y + 0.5, w: 4.2, h: 0.35,
      fontSize: 18, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(s.full, {
      x: x + 0.2, y: y + 0.85, w: 4.2, h: 0.22,
      fontSize: 9.5, fontFace: "Microsoft YaHei",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(s.detail, {
      x: x + 0.2, y: y + 1.1, w: 4.2, h: 0.6,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Highlight
    slide.addText(s.highlight, {
      x: x + 0.2, y: y + 1.68, w: 1.5, h: 0.22,
      fontSize: 10, fontFace: "Arial",
      color: s.color, bold: true, align: "left", margin: 0
    });

    // Est year
    slide.addText("Est. " + s.established, {
      x: x + 3.4, y: y + 1.68, w: 1.0, h: 0.22,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "right", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("13", {
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
  pres.writeFile({ fileName: "slide-13-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
