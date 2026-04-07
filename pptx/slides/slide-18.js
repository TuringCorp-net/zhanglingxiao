// slide-18.js - AI Strategy
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 18, title: "AI Strategy" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("AI Strategy", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Tencent AI Lab, Hunyuan Foundation Model & AI-Driven Products", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // AI Labs grid
  const labs = [
    {
      name: "Tencent AI Lab",
      founded: "2016",
      focus: "Computer Vision, NLP, Reinforcement Learning, Robotics",
      products: "Tencent AI Lab Charlie (Go AI), AI-driven content curation for WeChat/QQ, automated journalism",
      location: "Shenzhen",
      color: theme.accent
    },
    {
      name: "Tencent AI Lab Healthcare",
      founded: "2017",
      focus: "Medical Imaging AI, Drug Discovery, Clinical Decision Support",
      products: "AI-assisted CT/MRI diagnosis, AI for Tencent Healthcare platform, Miying (觅影) medical AI system",
      location: "Shenzhen",
      color: theme.light
    },
    {
      name: "Tencent Cloud AI",
      founded: "2018",
      focus: "Enterprise AI, OCR, Speech Recognition, Translation",
      products: "Tencent Cloud AI services for enterprise customers, Face Recognition, NLU APIs available on cloud marketplace",
      location: "Cloud",
      color: theme.accent
    },
    {
      name: "Hunyuan (混元)",
      founded: "2023",
      focus: "Large Language Model, Multimodal AI, Industry Applications",
      products: "Hunyuan Foundation Model (1T+ parameters), integrated into WeChat, Tencent Cloud, WeCom, and enterprise products",
      location: "Shenzhen",
      color: theme.light
    }
  ];

  labs.forEach((l, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.35 + col * 4.75;
    const y = 1.1 + row * 1.85;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 1.72,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 0.06,
      fill: { color: l.color }
    });

    // Badge
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.15, y: y + 0.15, w: 1.1, h: 0.26,
      fill: { color: theme.primary }
    });
    slide.addText(l.location, {
      x: x + 0.15, y: y + 0.15, w: 1.1, h: 0.26,
      fontSize: 9, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });

    slide.addText(l.name, {
      x: x + 0.15, y: y + 0.5, w: 4.2, h: 0.3,
      fontSize: 15, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    slide.addText("Focus: " + l.focus, {
      x: x + 0.15, y: y + 0.82, w: 4.2, h: 0.3,
      fontSize: 9.5, fontFace: "Arial",
      color: l.color, bold: true, align: "left", margin: 0
    });

    slide.addText(l.products, {
      x: x + 0.15, y: y + 1.12, w: 4.2, h: 0.55,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Bottom bar - key AI products
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 4.88, w: 9.3, h: 0.38,
    fill: { color: theme.primary }
  });
  slide.addText("Key AI Products: Hunyuan LLM  |  AI Mini Programs  |  Smart Customer Service  |  Miying Medical AI  |  AI Content Moderation  |  Smart Finance", {
    x: 0.35, y: 4.88, w: 9.3, h: 0.38,
    fontSize: 9, fontFace: "Arial",
    color: "FFFFFF", bold: false, align: "center", valign: "middle"
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("18", {
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
  pres.writeFile({ fileName: "slide-18-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
