// slide-01.js - Cover Page
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "cover", index: 1, title: "Tencent Holdings Ltd." };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.primary };

  // Left accent bar (cover anchoring)
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.12, h: 5.625,
    fill: { color: theme.accent }
  });

  // Subtle geometric accent - top right
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 7.5, y: 0, w: 2.5, h: 0.08,
    fill: { color: theme.accent }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 9.92, y: 0, w: 0.08, h: 2.5,
    fill: { color: theme.accent }
  });

  // Main title
  slide.addText("Tencent Holdings Ltd.", {
    x: 0.5, y: 1.6, w: 9, h: 1.0,
    fontSize: 54, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "left"
  });

  // Accent underline
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.5, y: 2.65, w: 2.5, h: 0.06,
    fill: { color: theme.accent }
  });

  // Tagline
  slide.addText("Connecting Everything", {
    x: 0.5, y: 2.85, w: 9, h: 0.6,
    fontSize: 28, fontFace: "Arial",
    color: theme.accent, bold: false, italic: true, align: "left"
  });

  // Sub-info
  slide.addText([
    { text: "Founded 1998  |  Shenzhen, China", options: { breakLine: true } },
    { text: "SEHK: 00700  |  Global Tech Ecosystem", options: {} }
  ], {
    x: 0.5, y: 3.65, w: 9, h: 0.8,
    fontSize: 14, fontFace: "Arial",
    color: theme.secondary, align: "left"
  });

  // Bottom accent line
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 5.525, w: 10, h: 0.1,
    fill: { color: theme.accent }
  });

  return slide;
}

if (require.main === module) {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  const theme = { primary: "2b2d42", secondary: "8d99ae", accent: "ef233c", light: "d90429", bg: "edf2f4" };
  createSlide(pres, theme);
  pres.writeFile({ fileName: "slide-01-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
