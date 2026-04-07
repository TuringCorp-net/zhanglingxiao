// slide-11.js - TiMi Studios
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 11, title: "TiMi Studios" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("TiMi Studios", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Largest Game Developer in the World | A Tencent Subsidiary", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Sub-brand cards
  const brands = [
    {
      name: "TiMi Aurora",
      games: "Honor of Kings (王者荣耀), Story of Yanxi Palace, Agatat",
      loc: "Shanghai",
      emp: "10,000+ developers",
      color: theme.accent
    },
    {
      name: "TiMi Moonton",
      games: "Mobile Legends: Bang Bang (MLBB), Heroes of Neywee",
      loc: "Shanghai",
      emp: "2,000+ developers",
      color: theme.light
    },
    {
      name: "TiMi Fire (Lightstorm)",
      games: "Honor of Kings international, PUBG Mobile Global",
      loc: "Los Angeles / Shenzhen",
      emp: "3,000+ developers",
      color: theme.accent
    },
    {
      name: "TiMi J3",
      games: "Peacekeeper Elite, Game For Peace, Tencent's AAA titles",
      loc: "Shenzhen",
      emp: "5,000+ developers",
      color: theme.light
    }
  ];

  brands.forEach((b, i) => {
    const y = 1.1 + i * 0.95;

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 9.3, h: 0.85,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 0.08, h: 0.85,
      fill: { color: b.color }
    });

    slide.addText(b.name, {
      x: 0.55, y: y + 0.08, w: 2.8, h: 0.32,
      fontSize: 15, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(b.games, {
      x: 0.55, y: y + 0.42, w: 5.8, h: 0.38,
      fontSize: 10.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Location badge
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 6.5, y: y + 0.12, w: 1.5, h: 0.28,
      fill: { color: theme.primary }
    });
    slide.addText(b.loc, {
      x: 6.5, y: y + 0.12, w: 1.5, h: 0.28,
      fontSize: 9, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });

    slide.addText(b.emp, {
      x: 8.1, y: y + 0.12, w: 1.5, h: 0.28,
      fontSize: 9, fontFace: "Arial",
      color: theme.accent, bold: true, align: "right", margin: 0
    });
  });

  // Bottom stats bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 4.95, w: 9.3, h: 0.38,
    fill: { color: theme.primary }
  });

  const bottomStats = [
    { v: "20,000+", l: "Total Employees" },
    { v: "4", l: "Major Sub-brands" },
    { v: "$10B+", l: "Annual Revenue" },
    { v: "#1", l: "Global Dev Ranking" },
    { v: "2010", l: "Year Founded" }
  ];

  bottomStats.forEach((s, i) => {
    const x = 0.35 + i * 1.86;
    slide.addText(s.v, {
      x, y: 4.95, w: 1.1, h: 0.22,
      fontSize: 13, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(s.l, {
      x, y: 5.17, w: 1.1, h: 0.15,
      fontSize: 8, fontFace: "Arial",
      color: theme.accent, bold: false, align: "center", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("11", {
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
  pres.writeFile({ fileName: "slide-11-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
