// slide-22.js - Financial Performance
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 22, title: "Financial Performance" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Financial Performance", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("FY2023 Annual Results | Hong Kong Stock Exchange: SEHK 00700", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Key financial metrics
  const finMetrics = [
    { v: "$90B+", l: "Total Revenue", sub: "FY2023" },
    { v: "$25B+", l: "Net Profit", sub: "FY2023" },
    { v: "+10%", l: "YoY Revenue Growth", sub: "vs FY2022" },
    { v: "$500B+", l: "Market Cap", sub: "SEHK 00700" }
  ];

  finMetrics.forEach((m, i) => {
    const x = 0.3 + i * 2.4;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.08, w: 2.25, h: 1.35,
      fill: { color: i % 2 === 0 ? theme.primary : theme.accent }
    });
    slide.addText(m.v, {
      x, y: 1.15, w: 2.25, h: 0.65,
      fontSize: 28, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(m.l, {
      x, y: 1.82, w: 2.25, h: 0.28,
      fontSize: 11, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(m.sub, {
      x, y: 2.1, w: 2.25, h: 0.22,
      fontSize: 9, fontFace: "Arial",
      color: "FFFFFF", bold: false, align: "center", margin: 0
    });
  });

  // Revenue breakdown section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 2.6, w: 5.8, h: 2.55,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 2.6, w: 5.8, h: 0.05,
    fill: { color: theme.accent }
  });

  slide.addText("Revenue by Segment (FY2023)", {
    x: 0.45, y: 2.7, w: 5.5, h: 0.32,
    fontSize: 13, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  const segments = [
    { name: "Value-Added Services (VAS)", pct: "50%", val: "$45B+", color: theme.accent },
    { name: "  - Social (WeChat, QQ, etc.)", pct: "~15%", val: "$13.5B", color: theme.light },
    { name: "  - Gaming (incl. TiMi, Riot)", pct: "~35%", val: "$31.5B", color: theme.accent },
    { name: "Fintech & Business Services", pct: "35%", val: "$31.5B+", color: theme.primary },
    { name: "  - WeChat Pay, TenPay, WeBank", pct: "Part of above", val: "", color: theme.secondary },
    { name: "Online Advertising", pct: "20%", val: "$18B+", color: theme.light },
    { name: "Cloud & Other Services", pct: "10%", val: "$9B+", color: theme.accent }
  ];

  segments.forEach((s, i) => {
    const y = 3.05 + i * 0.3;
    slide.addText(s.name, {
      x: 0.45, y, w: 3.6, h: 0.28,
      fontSize: 10.5, fontFace: "Arial",
      color: s.color === theme.secondary ? theme.secondary : theme.primary,
      bold: s.name.startsWith("  ") ? false : true, align: "left", margin: 0
    });
    slide.addText(s.pct, {
      x: 4.1, y, w: 0.9, h: 0.28,
      fontSize: 10.5, fontFace: "Arial",
      color: s.color, bold: true, align: "center", margin: 0
    });
    if (s.val) {
      slide.addText(s.val, {
        x: 5.0, y, w: 1.0, h: 0.28,
        fontSize: 10.5, fontFace: "Arial",
        color: theme.secondary, bold: false, align: "right", margin: 0
      });
    }
  });

  // Right: Quarterly trend
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.3, y: 2.6, w: 3.4, h: 2.55,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 6.3, y: 2.6, w: 3.4, h: 0.05,
    fill: { color: theme.light }
  });

  slide.addText("Business Highlights", {
    x: 6.45, y: 2.7, w: 3.1, h: 0.32,
    fontSize: 13, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  const highlights = [
    "Gaming revenue recovery: +5% YoY in H2 2023",
    "Fintech growth sustained: +15% YoY",
    "Cloud margin improvement: positive contribution",
    "International revenue: 25% of total revenue",
    "R&D investment: $10B+ annually",
    "Operating cash flow: $30B+",
    "Dividend per share: HKD 3.80 (FY2023)",
    "Stock: SEHK 00700, ADR: TCEHY"
  ];

  highlights.forEach((h, i) => {
    slide.addText(h, {
      x: 6.45, y: 3.05 + i * 0.25, w: 3.1, h: 0.24,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, bullet: true, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("22", {
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
  pres.writeFile({ fileName: "slide-22-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
