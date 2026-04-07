// slide-15.js - Enterprise Services
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 15, title: "Enterprise Services" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Enterprise Services", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("B2B SaaS Ecosystem | Digitizing 5M+ Businesses", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  const products = [
    {
      name: "Tencent Meeting",
      aka: "VooV Meeting (国际版)",
      category: "Video Conferencing",
      launched: "2019",
      highlight: "100M+ Users",
      desc: "HD video conferencing with up to 300 participants. Screen sharing, recording, real-time translation, and webinar mode. Core infrastructure for remote work in China.",
      color: theme.accent
    },
    {
      name: "E-documents (腾讯文档)",
      category: "Productivity Suite",
      launched: "2018",
      highlight: "180M+ Users",
      desc: "Collaborative docs, spreadsheets, and presentations. Real-time co-editing, enterprise templates, WeChat/QQ integration. Competes with Tencent Docs vs. DingTalk.",
      color: theme.light
    },
    {
      name: "Enterprise WeChat (WeCom)",
      category: "CRM & Communication",
      launched: "2016",
      highlight: "5M+ Businesses",
      desc: "Corporate messaging with customer management tools. S-Chat for external communication, SCRM for marketing automation. Key competitor to DingTalk and Feishu.",
      color: theme.accent
    },
    {
      name: "Tencent Cloud SES",
      category: "Email Service",
      launched: "2020",
      highlight: "Enterprise Email",
      desc: "Enterprise-grade secure email service with 5TB storage, AI-powered spam filtering, and seamless integration with WeCom and Tencent Meeting.",
      color: theme.light
    },
    {
      name: "Tencent IAoC",
      category: "Cloud Management",
      launched: "2020",
      highlight: "CloudOps Platform",
      desc: "Cloud infrastructure management, monitoring, and cost optimization. Supports multi-cloud deployment and automated scaling for enterprise workloads.",
      color: theme.accent
    },
    {
      name: "Tencent Security",
      category: "Cybersecurity",
      launched: "2006",
      highlight: "DDoS Protection",
      desc: "Enterprise security suite including WAF, DDoS protection, Host Security (Hearth), and Mobile Security. Protects 10M+ servers globally.",
      color: theme.light
    }
  ];

  products.forEach((p, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.3 + col * 3.2;
    const y = 1.1 + row * 2.05;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.0, h: 1.92,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.08 }
    });

    // Top bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.0, h: 0.06,
      fill: { color: p.color }
    });

    // Category badge
    slide.addText(p.category, {
      x: x + 0.12, y: y + 0.14, w: 2.76, h: 0.22,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.accent, bold: true, align: "left", margin: 0
    });

    slide.addText(p.name, {
      x: x + 0.12, y: y + 0.38, w: 2.76, h: 0.3,
      fontSize: 14, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    slide.addText(p.desc, {
      x: x + 0.12, y: y + 0.7, w: 2.76, h: 0.82,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Highlight + year
    slide.addText(p.highlight, {
      x: x + 0.12, y: y + 1.55, w: 1.6, h: 0.22,
      fontSize: 10, fontFace: "Arial",
      color: p.color, bold: true, align: "left", margin: 0
    });
    slide.addText("Est. " + p.launched, {
      x: x + 1.9, y: y + 1.55, w: 1.0, h: 0.22,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "right", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("15", {
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
  pres.writeFile({ fileName: "slide-15-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
