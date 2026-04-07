// slide-09.js - Gaming Overview
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 9, title: "Gaming Overview" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Gaming Empire", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("World's Largest Gaming Company by Revenue", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Left: hero stat
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 3.0, h: 2.0,
    fill: { color: theme.primary }
  });
  slide.addText("$35B+", {
    x: 0.3, y: 1.2, w: 3.0, h: 0.9,
    fontSize: 44, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", margin: 0
  });
  slide.addText("Annual Gaming Revenue", {
    x: 0.3, y: 2.1, w: 3.0, h: 0.35,
    fontSize: 12, fontFace: "Arial",
    color: theme.accent, bold: true, align: "center", margin: 0
  });
  slide.addText("FY2023", {
    x: 0.3, y: 2.45, w: 3.0, h: 0.28,
    fontSize: 11, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "center", margin: 0
  });

  // Sub-stats under hero
  const subStats = [
    { v: "#1", l: "Global Ranking" },
    { v: "5", l: "Major Studios" },
    { v: "10+", l: "AAA Titles" }
  ];
  subStats.forEach((s, i) => {
    const x = 0.3 + i * 1.0;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 3.22, w: 0.94, h: 0.8,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });
    slide.addText(s.v, {
      x, y: 3.25, w: 0.94, h: 0.42,
      fontSize: 20, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(s.l, {
      x, y: 3.68, w: 0.94, h: 0.28,
      fontSize: 9, fontFace: "Arial",
      color: "FFFFFF", bold: false, align: "center", margin: 0
    });
  });

  // Right: Studios
  const studios = [
    { name: "TiMi Studios", detail: "Honor of Kings, PUBG Mobile, Drift Racing", stake: "100%" },
    { name: "Riot Games", detail: "League of Legends, Valorant, Teamfight Tactics", stake: "100%" },
    { name: "Supercell", detail: "Clash of Clans, Brawl Stars, Clash Royale", stake: "70%" },
    { name: "Lightspeed & Quantum", detail: "PUBG Mobile (Dev), Gaming Innovation", stake: "100%" },
    { name: "Funcom", detail: "Conan Exiles, Metal: Hellsinger, Dune Awakening", stake: "100%" },
    { name: "Other Investments", detail: "Epic Games (40%), Ubisoft (minority), and more", stake: "Various" }
  ];

  studios.forEach((s, i) => {
    const y = 1.1 + i * 0.6;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.5, y, w: 6.2, h: 0.52,
      fill: { color: i % 2 === 0 ? "FFFFFF" : "f8f9fa" }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.5, y, w: 0.05, h: 0.52,
      fill: { color: i < 2 ? theme.accent : theme.light }
    });

    slide.addText(s.name, {
      x: 3.65, y: y + 0.06, w: 2.8, h: 0.25,
      fontSize: 12, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(s.detail, {
      x: 3.65, y: y + 0.28, w: 4.8, h: 0.22,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(s.stake, {
      x: 8.7, y: y + 0.06, w: 0.9, h: 0.25,
      fontSize: 11, fontFace: "Arial",
      color: theme.accent, bold: true, align: "right", margin: 0
    });
    slide.addText("stake", {
      x: 8.7, y: y + 0.28, w: 0.9, h: 0.2,
      fontSize: 8, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "right", margin: 0
    });
  });

  // Bottom note
  slide.addText("Tencent controls ~50% of global gaming market through wholly-owned studios and strategic investments.", {
    x: 0.3, y: 4.88, w: 9.4, h: 0.28,
    fontSize: 10, fontFace: "Arial",
    color: theme.secondary, bold: false, italic: true, align: "left", margin: 0
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("9", {
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
  pres.writeFile({ fileName: "slide-09-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
