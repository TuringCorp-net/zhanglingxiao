// slide-04.js - Founding Story
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 4, title: "Founding Story" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Title
  slide.addText("Founding Story", {
    x: 0.3, y: 0.25, w: 9, h: 0.55,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("From a Small IM Startup to a Global Tech Giant", {
    x: 0.3, y: 0.78, w: 9, h: 0.3,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Founders section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.2, w: 4.2, h: 1.35,
    fill: { color: theme.primary }
  });
  slide.addText("CO-FOUNDERS", {
    x: 0.5, y: 1.28, w: 3.8, h: 0.28,
    fontSize: 10, fontFace: "Arial",
    color: theme.accent, bold: true, charSpacing: 3, align: "left", margin: 0
  });
  slide.addText([
    { text: "Pony Ma (Ma Huateng)", options: { bold: true, breakLine: true } },
    { text: "Chairman & CEO — Visionary leader", options: { breakLine: true } },
    { text: "Zhang Zhidong", options: { bold: true, breakLine: true } },
    { text: "Chief Technology Officer", options: { breakLine: true } },
    { text: "Xu Qingtai", options: { bold: true, breakLine: true } },
    { text: "Chief Operating Officer", options: {} }
  ], {
    x: 0.5, y: 1.6, w: 3.8, h: 0.9,
    fontSize: 11, fontFace: "Arial",
    color: "FFFFFF", bold: false, align: "left", margin: 0
  });

  // Timeline
  const milestones = [
    { year: "1998", event: "Founded in Shenzhen as an instant messaging startup" },
    { year: "1999", event: "QQ launched — became China's dominant IM platform" },
    { year: "2004", event: "IPO on Hong Kong Stock Exchange (SEHK 00700)" },
    { year: "2010", event: "WeChat launched — redefined mobile social networking" },
    { year: "2011", event: "开放平台战略 — QQ空间 & 游戏开放平台" },
    { year: "2014", event: "WeChat Pay launched — fintech expansion accelerated" },
    { year: "2018", event: "Strategic restructuring — 6 core business groups" },
    { year: "2021", event: "Sustainability & ESG commitment — carbon neutrality" }
  ];

  const tlX = 4.7, tlY = 1.2, tlH = 4.05;
  // Vertical timeline line
  slide.addShape(pres.shapes.LINE, {
    x: tlX, y: tlY, w: 0, h: tlH,
    line: { color: theme.accent, width: 2 }
  });

  milestones.forEach((m, i) => {
    const yPos = tlY + i * (tlH / milestones.length);

    // Dot
    slide.addShape(pres.shapes.OVAL, {
      x: tlX - 0.1, y: yPos - 0.1, w: 0.2, h: 0.2,
      fill: { color: theme.accent }
    });

    // Year
    slide.addText(m.year, {
      x: tlX + 0.2, y: yPos - 0.15, w: 0.65, h: 0.28,
      fontSize: 13, fontFace: "Arial",
      color: theme.accent, bold: true, align: "left", margin: 0
    });

    // Event text
    slide.addText(m.event, {
      x: tlX + 0.9, y: yPos - 0.18, w: 4.0, h: 0.35,
      fontSize: 11, fontFace: "Arial",
      color: theme.primary, bold: false, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("4", {
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
  pres.writeFile({ fileName: "slide-04-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
