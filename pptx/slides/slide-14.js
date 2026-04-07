// slide-14.js - Tencent Cloud
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 14, title: "Tencent Cloud" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Tencent Cloud", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("3rd Largest Global Cloud Provider | IaaS, PaaS & SaaS", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Hero stat
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.1, w: 2.8, h: 1.6,
    fill: { color: theme.primary }
  });
  slide.addText("#3", {
    x: 0.35, y: 1.18, w: 2.8, h: 0.7,
    fontSize: 48, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", margin: 0
  });
  slide.addText("Global Cloud\nRanking", {
    x: 0.35, y: 1.9, w: 2.8, h: 0.55,
    fontSize: 12, fontFace: "Arial",
    color: theme.accent, bold: false, align: "center", margin: 0
  });
  slide.addText("IDC, Synergy 2023", {
    x: 0.35, y: 2.48, w: 2.8, h: 0.2,
    fontSize: 8, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "center", margin: 0
  });

  // Coverage stats
  const covStats = [
    { v: "60+", l: "Availability Zones" },
    { v: "27", l: "Geographic Regions" },
    { v: "70+", l: "Countries Served" },
    { v: "240+", l: "VPN Nodes" }
  ];
  covStats.forEach((s, i) => {
    const x = 3.35 + i * 1.65;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.1, w: 1.55, h: 1.6,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });
    slide.addText(s.v, {
      x, y: 1.22, w: 1.55, h: 0.65,
      fontSize: 26, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(s.l, {
      x, y: 1.9, w: 1.55, h: 0.55,
      fontSize: 10, fontFace: "Arial",
      color: "FFFFFF", bold: false, align: "center", margin: 0
    });
  });

  // Service layers
  const layers = [
    {
      tier: "SaaS",
      color: theme.accent,
      products: "Tencent Meeting (VooV), E-documents, Tencent SES, Enterprise WeChat, QQ Mail, WeChat Work"
    },
    {
      tier: "PaaS",
      color: theme.light,
      products: "Tencent Cloud Database (TDSQL), Cloud Filestore, CDN, Video Services, AI Platform, IoT"
    },
    {
      tier: "IaaS",
      color: theme.primary,
      products: "Cloud Compute (CVM), Cloud Object Storage (COS), Virtual Private Cloud, Cloud Load Balancer, Cloud Block Storage"
    }
  ];

  layers.forEach((l, i) => {
    const y = 2.9 + i * 0.65;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 9.3, h: 0.58,
      fill: { color: i % 2 === 0 ? "FFFFFF" : "f8f9fa" }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 0.9, h: 0.58,
      fill: { color: l.color }
    });
    slide.addText(l.tier, {
      x: 0.35, y, w: 0.9, h: 0.58,
      fontSize: 14, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
    slide.addText(l.products, {
      x: 1.4, y, w: 8.1, h: 0.58,
      fontSize: 10.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", valign: "middle", margin: 0
    });
  });

  // Key differentiator note
  slide.addText("Differentiated by deep integration with WeChat ecosystem and gaming infrastructure — serving 500K+ enterprise customers globally.", {
    x: 0.35, y: 4.88, w: 8.8, h: 0.28,
    fontSize: 10, fontFace: "Arial",
    color: theme.secondary, bold: false, italic: true, align: "left", margin: 0
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("14", {
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
  pres.writeFile({ fileName: "slide-14-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
