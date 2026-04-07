// slide-17.js - Video & Entertainment
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 17, title: "Video & Entertainment" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Video & Entertainment", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Streaming, Original Content & User-Generated Entertainment", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Tencent Video hero card
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 4.5, h: 2.6,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 4.5, h: 0.06,
    fill: { color: theme.accent }
  });

  slide.addText("Tencent Video", {
    x: 0.5, y: 1.25, w: 4.1, h: 0.4,
    fontSize: 24, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("腾讯视频", {
    x: 0.5, y: 1.65, w: 4.1, h: 0.25,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  const tvStats = [
    { v: "200M+", l: "Monthly Active Users" },
    { v: "100M+", l: "VIP Subscribers" },
    { v: "#2", l: "Video Platform CN (after iQIYI)" },
    { v: "1,000+", l: "Original Productions" }
  ];
  tvStats.forEach((s, i) => {
    slide.addText(s.v, {
      x: 0.5, y: 2.0 + i * 0.42, w: 1.8, h: 0.32,
      fontSize: 18, fontFace: "Arial",
      color: theme.accent, bold: true, align: "left", margin: 0
    });
    slide.addText(s.l, {
      x: 2.3, y: 2.0 + i * 0.42, w: 2.4, h: 0.32,
      fontSize: 11, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", valign: "middle", margin: 0
    });
  });

  // Right: content types
  const contentTypes = [
    {
      title: "Original Drama Series",
      items: "The Longest Day in Chang'an, The Story of Minglan, You Are My Glory, The New Boyfriend, Hidden in the Lush Green",
      note: "Top IP holder in Chinese streaming",
      color: theme.accent
    },
    {
      title: "Movies & Film",
      items: "Co-productions with Hollywood and global studios. Distribution for Chinese market. The Wandering Earth 2, The Battle at Lake Changjin series.",
      note: "Top 3 CN Box Office",
      color: theme.light
    },
    {
      title: "Variety & Reality Shows",
      items: "Keep Running (奔跑吧), Happy Camp (快乐大本营), Singer (歌手), TME Live concerts",
      note: "10+ top-rated shows",
      color: theme.accent
    },
    {
      title: "Sports Content",
      items: "NBA China (exclusive digital partner), NFL, Premier League clips, CN football leagues, eSports tournaments",
      note: "NBA: 800M+ viewers/season",
      color: theme.light
    },
    {
      title: "User-Generated Content",
      items: "Tencent Video 'Create' platform, WeGame, PengYou (社交游戏), Short video integration",
      note: "10M+ creators",
      color: theme.accent
    }
  ];

  contentTypes.forEach((c, i) => {
    const y = 1.1 + i * 0.52;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.0, y, w: 4.7, h: 0.46,
      fill: { color: i % 2 === 0 ? "FFFFFF" : "f8f9fa" }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 5.0, y, w: 0.05, h: 0.46,
      fill: { color: c.color }
    });
    slide.addText(c.title, {
      x: 5.15, y: y + 0.04, w: 2.3, h: 0.2,
      fontSize: 10.5, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(c.note, {
      x: 8.0, y: y + 0.04, w: 1.6, h: 0.2,
      fontSize: 8.5, fontFace: "Arial",
      color: c.color, bold: true, align: "right", margin: 0
    });
    slide.addText(c.items.substring(0, 72) + "...", {
      x: 5.15, y: y + 0.25, w: 4.45, h: 0.18,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Bottom row - streaming wars context
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 4.88, w: 9.4, h: 0.38,
    fill: { color: theme.primary }
  });
  slide.addText("Streaming Wars CN: iQIYI #1 (38%) | Tencent Video #2 (28%) | Youku #3 (22%) | Bilibili #4 (12%) — Sources: iResearch 2023", {
    x: 0.3, y: 4.88, w: 9.4, h: 0.38,
    fontSize: 9, fontFace: "Arial",
    color: "FFFFFF", bold: false, align: "center", valign: "middle"
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("17", {
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
  pres.writeFile({ fileName: "slide-17-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
