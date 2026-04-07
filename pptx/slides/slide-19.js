// slide-19.js - Tech Investment
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 19, title: "Tech Investment" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Tech Investment", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("800+ Invested Companies | Global Tech Footprint", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Hero stat
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 2.6, h: 1.5,
    fill: { color: theme.primary }
  });
  slide.addText("800+", {
    x: 0.3, y: 1.2, w: 2.6, h: 0.7,
    fontSize: 44, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", margin: 0
  });
  slide.addText("Invested\nCompanies", {
    x: 0.3, y: 1.9, w: 2.6, h: 0.5,
    fontSize: 12, fontFace: "Arial",
    color: theme.accent, bold: false, align: "center", margin: 0
  });

  // Investment categories
  const categories = [
    { cat: "AI & Robotics", items: "OpenAI (seed), MiniMax, Zhidian Cloud, Youibot, CloudMinds", color: theme.accent },
    { cat: "Cloud & Infrastructure", items: "Snowflake (IPO), Scale Infrastructure, Cloudflare (minor)", color: theme.light },
    { cat: "Big Data & Analytics", items: " Palantir (minor), Sensetime, Yitu Tech, Mininglamp", color: theme.accent },
    { cat: "Security & Privacy", items: "SentinelOne, Carbon Black, Threatbook, DBAPP Security", color: theme.light }
  ];

  categories.forEach((c, i) => {
    const y = 1.1 + i * 0.58;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.1, y, w: 6.6, h: 0.52,
      fill: { color: i % 2 === 0 ? "FFFFFF" : "f8f9fa" }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 3.1, y, w: 0.05, h: 0.52,
      fill: { color: c.color }
    });
    slide.addText(c.cat, {
      x: 3.25, y: y + 0.05, w: 2.2, h: 0.22,
      fontSize: 11, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(c.items, {
      x: 3.25, y: y + 0.28, w: 6.3, h: 0.22,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // M&A / Investment highlights section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 3.45, w: 9.4, h: 0.38,
    fill: { color: theme.primary }
  });
  slide.addText("Strategic M&A & Minority Stakes", {
    x: 0.3, y: 3.45, w: 9.4, h: 0.38,
    fontSize: 13, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const investments = [
    { name: "Riot Games", stake: "100%", type: "Gaming", year: "2011", color: theme.accent },
    { name: "Supercell", stake: "70%", type: "Gaming", year: "2016", color: theme.light },
    { name: "Epic Games", stake: "40%", type: "Gaming/Tech", year: "2012", color: theme.accent },
    { name: "Tesla", stake: "5%", type: "EV/Tech", year: "2017", color: theme.light },
    { name: "Spotify", stake: "7%", type: "Music", year: "2017", color: theme.accent },
    { name: "Bilibili", stake: "12%", type: "Video/Streaming", year: "2018", color: theme.light },
    { name: "Kuaishou", stake: "3%", type: "Short Video", year: "2021", color: theme.accent },
    { name: "PDD Holdings", stake: "<1%", type: "E-commerce", year: "2020", color: theme.light }
  ];

  investments.forEach((inv, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.3 + col * 2.38;
    const y = 3.92 + row * 0.8;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.25, h: 0.7,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.05, h: 0.7,
      fill: { color: inv.color }
    });

    slide.addText(inv.name, {
      x: x + 0.12, y: y + 0.08, w: 1.7, h: 0.25,
      fontSize: 11, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(inv.stake + " | " + inv.type, {
      x: x + 0.12, y: y + 0.34, w: 1.7, h: 0.2,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(inv.year, {
      x: x + 0.12, y: y + 0.52, w: 1.7, h: 0.18,
      fontSize: 8, fontFace: "Arial",
      color: inv.color, bold: true, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("19", {
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
  pres.writeFile({ fileName: "slide-19-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
