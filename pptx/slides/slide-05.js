// slide-05.js - Key Executives
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 5, title: "Key Executives" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Key Executives", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Senior Leadership Team", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  const executives = [
    {
      name: "Pony Ma (Ma Huateng)",
      title: "Chairman & CEO",
      desc: "Co-founder of Tencent. Led the company from a small IM startup to a global tech powerhouse. Named one of TIME's 100 most influential people.",
      color: theme.accent
    },
    {
      name: "Martin Lau",
      title: "President",
      desc: "Joined Tencent in 2005 as CFO. Played pivotal role in IPO, M&A strategy, and global expansion. instrumental in investments in Riot Games, Supercell, and Epic Games.",
      color: theme.light
    },
    {
      name: "James Mitchell",
      title: "Chief Financial Officer",
      desc: "Joined in 2007. Oversaw Tencent's financial strategy through its most aggressive growth phase. Previously at Goldman Sachs Asia tech practice.",
      color: theme.primary
    }
  ];

  executives.forEach((exec, i) => {
    const y = 1.1 + i * 1.42;

    // Card
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.3, y, w: 9.4, h: 1.3,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
    });

    // Left accent
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.3, y, w: 0.08, h: 1.3,
      fill: { color: exec.color }
    });

    // Name
    slide.addText(exec.name, {
      x: 0.55, y: y + 0.1, w: 5.5, h: 0.35,
      fontSize: 18, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    // Title
    slide.addText(exec.title, {
      x: 0.55, y: y + 0.45, w: 5.5, h: 0.28,
      fontSize: 12, fontFace: "Arial",
      color: exec.color, bold: true, align: "left", margin: 0
    });

    // Description
    slide.addText(exec.desc, {
      x: 0.55, y: y + 0.75, w: 8.9, h: 0.5,
      fontSize: 11, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Role badge on right
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 8.5, y: y + 0.15, w: 1.0, h: 0.38,
      fill: { color: exec.color }
    });
    slide.addText(String(i + 1).padStart(2, "0"), {
      x: 8.5, y: y + 0.15, w: 1.0, h: 0.38,
      fontSize: 16, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("5", {
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
  pres.writeFile({ fileName: "slide-05-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
