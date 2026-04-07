// slide-16.js - Digital Content
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 16, title: "Digital Content" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Digital Content", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Music, Literature, News & Live Streaming Ecosystem", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // QQ Music hero
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.1, w: 3.6, h: 2.5,
    fill: { color: theme.primary }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.1, w: 3.6, h: 0.06,
    fill: { color: theme.accent }
  });

  slide.addText("QQ Music", {
    x: 0.5, y: 1.25, w: 3.3, h: 0.45,
    fontSize: 22, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "left", margin: 0
  });
  slide.addText("音乐平台", {
    x: 0.5, y: 1.68, w: 3.3, h: 0.25,
    fontSize: 12, fontFace: "Microsoft YaHei",
    color: theme.accent, bold: false, align: "left", margin: 0
  });

  const musicStats = [
    { v: "200M+", l: "Paying Subscribers" },
    { v: "#1", l: "Music Platform CN" },
    { v: "50M+", l: "Songs in Library" },
    { v: "1B+", l: "Playlist Creates/mo" }
  ];
  musicStats.forEach((s, i) => {
    slide.addText(s.v, {
      x: 0.5, y: 2.0 + i * 0.38, w: 1.6, h: 0.32,
      fontSize: 16, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "left", margin: 0
    });
    slide.addText(s.l, {
      x: 2.1, y: 2.0 + i * 0.38, w: 1.7, h: 0.32,
      fontSize: 10, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", valign: "middle", margin: 0
    });
  });

  // Other content platforms - right side
  const contentPlatforms = [
    {
      name: "China Literature (阅文集团)",
      type: "Digital Publishing",
      detail: "China's largest online literature platform. 480M+ users, 10M+ works. Owned brands: QQ Reading, 起点中文网, 微信读书. IP licensing for TV, film, and gaming.",
      stat: "480M+ users",
      color: theme.accent
    },
    {
      name: "Tencent News (腾讯新闻)",
      type: "News & Information",
      detail: "One of China's top news aggregators. AI-powered content curation, 2,000+ professional journalists. Competes with Toutiao and Baidu News.",
      stat: "Top 3 CN News",
      color: theme.light
    },
    {
      name: "Live Streaming",
      type: "Interactive Streaming",
      detail: "Tencent Video Live, Kuaishou (stake), Bilibili (stake). Music streaming, gaming, e-commerce, and social live streaming across multiple platforms.",
      stat: "Multi-platform",
      color: theme.accent
    },
    {
      name: "Tencent Video",
      type: "Video Streaming",
      detail: "200M+ MAU. Original content including drama series, movies, and variety shows. Competes with iQIYI and Youku. VIP subscription model with 100M+ subscribers.",
      stat: "200M+ MAU",
      color: theme.light
    },
    {
      name: "WeMusic (腾讯音乐)",
      type: "Music Group",
      detail: "NYSE: TME. QQ Music, Kugou, Kuwo. Dominates China's music streaming with 80%+ market share. Acquired Lazy, a global music rights company.",
      stat: "NYSE: TME",
      color: theme.accent
    }
  ];

  contentPlatforms.forEach((p, i) => {
    const y = 1.1 + i * 0.6;
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.15, y, w: 5.5, h: 0.52,
      fill: { color: i % 2 === 0 ? "FFFFFF" : "f8f9fa" }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x: 4.15, y, w: 0.05, h: 0.52,
      fill: { color: p.color }
    });

    slide.addText(p.name, {
      x: 4.3, y: y + 0.06, w: 3.2, h: 0.22,
      fontSize: 12, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(p.detail, {
      x: 4.3, y: y + 0.28, w: 4.5, h: 0.22,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(p.stat, {
      x: 8.9, y: y + 0.06, w: 0.7, h: 0.22,
      fontSize: 9, fontFace: "Arial",
      color: p.color, bold: true, align: "right", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("16", {
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
  pres.writeFile({ fileName: "slide-16-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
