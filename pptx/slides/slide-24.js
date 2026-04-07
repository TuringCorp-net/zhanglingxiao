// slide-24.js - Closing Page
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "closing", index: 24, title: "Tencent: Connecting People, Services, and Systems Worldwide" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.primary };

  // Left accent bar (closing anchoring)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: theme.accent }
  });

  // Geometric accents - top right
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 0, w: 2.5, h: 0.08,
    fill: { color: theme.accent }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 9.92, y: 0, w: 0.08, h: 2.5,
    fill: { color: theme.accent }
  });

  // Bottom geometric
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.525, w: 10, h: 0.1,
    fill: { color: theme.accent }
  });

  // Main closing statement
  slide.addText("Tencent", {
    x: 0.5, y: 1.2, w: 9, h: 0.9,
    fontSize: 60, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "left", margin: 0
  });

  slide.addText("Connecting People, Services,\nand Systems Worldwide", {
    x: 0.5, y: 2.1, w: 9, h: 1.2,
    fontSize: 30, fontFace: "Arial",
    color: theme.accent, bold: false, align: "left", margin: 0
  });

  // Divider
  slide.addShape(pres.shapes.LINE, {
    x: 0.5, y: 3.4, w: 3.0, h: 0,
    line: { color: theme.accent, width: 2 }
  });

  // Tagline
  slide.addText("Technology for Good. Innovation for All.", {
    x: 0.5, y: 3.55, w: 9, h: 0.45,
    fontSize: 16, fontFace: "Arial",
    color: theme.secondary, bold: false, italic: true, align: "left", margin: 0
  });

  // Key numbers recap
  const recap = [
    { v: "1.3B+", l: "WeChat Users" },
    { v: "$90B+", l: "Annual Revenue" },
    { v: "30+", l: "Countries" },
    { v: "100K+", l: "Employees" }
  ];

  recap.forEach((r, i) => {
    const x = 0.5 + i * 2.35;
    slide.addText(r.v, {
      x, y: 4.1, w: 2.2, h: 0.45,
      fontSize: 22, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "left", margin: 0
    });
    slide.addText(r.l, {
      x, y: 4.52, w: 2.2, h: 0.28,
      fontSize: 11, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Website
  slide.addText("www.tencent.com", {
    x: 0.5, y: 5.0, w: 4.0, h: 0.32,
    fontSize: 14, fontFace: "Arial",
    color: theme.accent, bold: true, align: "left", margin: 0
  });

  // Stock info
  slide.addText("SEHK: 00700  |  TCEHY", {
    x: 5.5, y: 5.0, w: 3.5, h: 0.32,
    fontSize: 12, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "right", margin: 0
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  const theme = { primary: "2b2d42", secondary: "8d99ae", accent: "ef233c", light: "d90429", bg: "edf2f4" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-24-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
