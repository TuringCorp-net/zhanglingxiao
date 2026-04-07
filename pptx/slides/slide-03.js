// slide-03.js - Mission & Vision
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 3, title: "Mission & Vision" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Mission & Vision", {
    x: 0.35, y: 0.3, w: 9, h: 0.55,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  // Divider line
  slide.addShape(pres.shapes.LINE, {
    x: 0.35, y: 0.88, w: 2.2, h: 0,
    line: { color: theme.accent, width: 2 }
  });

  // Mission card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.1, w: 9.2, h: 1.7,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.1, w: 0.08, h: 1.7,
    fill: { color: theme.accent }
  });

  slide.addText("MISSION", {
    x: 0.6, y: 1.2, w: 8.8, h: 0.35,
    fontSize: 11, fontFace: "Arial",
    color: theme.accent, bold: true, charSpacing: 4, align: "left", margin: 0
  });
  slide.addText("To build a global ecosystem that bridges technology, content, and users worldwide — empowering individuals and businesses to connect, communicate, and thrive in the digital age.", {
    x: 0.6, y: 1.55, w: 8.8, h: 1.1,
    fontSize: 16, fontFace: "Arial",
    color: theme.primary, bold: false, align: "left", margin: 0
  });

  // Vision card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 3.0, w: 9.2, h: 1.7,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 5, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 3.0, w: 0.08, h: 1.7,
    fill: { color: theme.light }
  });

  slide.addText("VISION", {
    x: 0.6, y: 3.1, w: 8.8, h: 0.35,
    fontSize: 11, fontFace: "Arial",
    color: theme.light, bold: true, charSpacing: 4, align: "left", margin: 0
  });
  slide.addText("To become the most respected internet enterprise globally by continuously innovating and delivering value through superior technology, content, and user experiences across every connected device and platform.", {
    x: 0.6, y: 3.45, w: 8.8, h: 1.1,
    fontSize: 16, fontFace: "Arial",
    color: theme.primary, bold: false, align: "left", margin: 0
  });

  // Core values row
  const values = ["Innovation", "User-Centric", "Integrity", "Partnership", "Social Responsibility"];
  values.forEach((v, i) => {
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35 + i * 1.86, y: 4.9, w: 1.76, h: 0.42,
      fill: { color: theme.primary }
    });
    slide.addText(v, {
      x: 0.35 + i * 1.86, y: 4.9, w: 1.76, h: 0.42,
      fontSize: 11, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("3", {
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
  pres.writeFile({ fileName: "slide-03-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
