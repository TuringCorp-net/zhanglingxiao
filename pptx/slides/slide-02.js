// slide-02.js - Company Snapshot
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 2, title: "Company Snapshot" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Company Snapshot", {
    x: 0.3, y: 0.25, w: 9, h: 0.55,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  // Subtitle
  slide.addText("Tencent Holdings Ltd.  |  SEHK: 00700", {
    x: 0.3, y: 0.8, w: 9, h: 0.3,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Stat cards - 2 rows x 3 cols
  const stats = [
    { value: "1998", label: "Founded", sub: "November, Shenzhen" },
    { value: "100K+", label: "Employees", sub: "Global workforce" },
    { value: "$500B+", label: "Market Cap", sub: "SEHK 00700" },
    { value: "1.3B+", label: "WeChat Users", sub: "Monthly Active" },
    { value: "$90B+", label: "Annual Revenue", sub: "FY2023" },
    { value: "30+", label: "Countries", sub: "Global presence" }
  ];

  const cardW = 2.9, cardH = 1.55;
  const startX = 0.3, startY = 1.25;
  const gapX = 0.2, gapY = 0.18;

  stats.forEach((stat, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);

    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: cardW, h: cardH,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
    });

    // Left accent strip
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.06, h: cardH,
      fill: { color: i < 3 ? theme.accent : theme.light }
    });

    // Value
    slide.addText(stat.value, {
      x: x + 0.15, y: y + 0.12, w: cardW - 0.2, h: 0.6,
      fontSize: 36, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    // Label
    slide.addText(stat.label, {
      x: x + 0.15, y: y + 0.72, w: cardW - 0.2, h: 0.32,
      fontSize: 14, fontFace: "Arial",
      color: theme.accent, bold: true, align: "left", margin: 0
    });

    // Sub label
    slide.addText(stat.sub, {
      x: x + 0.15, y: y + 1.02, w: cardW - 0.2, h: 0.28,
      fontSize: 11, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Bottom tagline
  slide.addText("One of the world's largest internet conglomerates — a leader in social platforms, gaming, fintech, and cloud services.", {
    x: 0.3, y: 4.9, w: 8.5, h: 0.4,
    fontSize: 11, fontFace: "Arial",
    color: theme.secondary, bold: false, italic: true, align: "left", margin: 0
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("2", {
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
  pres.writeFile({ fileName: "slide-02-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
