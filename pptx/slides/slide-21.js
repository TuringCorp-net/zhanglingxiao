// slide-21.js - Key International Investments
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 21, title: "Key International Investments" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Key International Investments", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Strategic Stakes in Global Technology & Entertainment Leaders", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Full acquisitions
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.08, w: 9.3, h: 0.32,
    fill: { color: theme.accent }
  });
  slide.addText("WHOLLY-OWNED SUBSIDIARIES", {
    x: 0.35, y: 1.08, w: 9.3, h: 0.32,
    fontSize: 11, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const acquisitions = [
    {
      name: "Riot Games",
      HQ: "Los Angeles, USA",
      desc: "World's leading game developer. League of Legends, Valorant, Teamfight Tactics. 4,500+ employees globally. Pioneer of esports with League of Legends World Championship ($15M+ prize pool).",
      revenue: "$1.8B+ revenue",
      color: theme.accent
    },
    {
      name: "Supercell",
      HQ: "Helsinki, Finland",
      desc: "Mobile gaming pioneer. Clash of Clans, Brawl Stars, Clash Royale. Operates with autonomous studio culture. Tencent acquired 70% in 2016 for $8.6B. Fully consolidated.",
      revenue: "$2.2B+ revenue",
      color: theme.light
    },
    {
      name: "Miniclip",
      HQ: "London, UK",
      desc: "One of the world's largest web and mobile game developers. 8 Ball Pool, Subway Surfers (partner). 25M+ daily active users across 196 countries.",
      revenue: "Top 10 mobile dev",
      color: theme.accent
    },
    {
      name: "Funcom",
      HQ: "Oslo, Norway",
      desc: "AAA game developer specializing in open-world games. Conan Exiles, Dune: Awakening, Metal: Hellsinger. Wholly owned since 2022.",
      revenue: "$100M+ revenue",
      color: theme.light
    }
  ];

  acquisitions.forEach((a, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 0.35 + col * 4.75;
    const y = 1.5 + row * 1.35;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 4.55, h: 1.22,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 0.08, h: 1.22,
      fill: { color: a.color }
    });

    slide.addText(a.name, {
      x: x + 0.18, y: y + 0.08, w: 2.8, h: 0.28,
      fontSize: 14, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });
    slide.addText(a.HQ, {
      x: x + 0.18, y: y + 0.36, w: 2.8, h: 0.2,
      fontSize: 9, fontFace: "Arial",
      color: a.color, bold: true, align: "left", margin: 0
    });
    slide.addText(a.desc, {
      x: x + 0.18, y: y + 0.56, w: 4.2, h: 0.6,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
    slide.addText(a.revenue, {
      x: x + 0.18, y: y + 0.97, w: 2.0, h: 0.2,
      fontSize: 9, fontFace: "Arial",
      color: a.color, bold: true, align: "left", margin: 0
    });
  });

  // Minority stakes section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 4.22, w: 9.3, h: 0.32,
    fill: { color: theme.primary }
  });
  slide.addText("KEY MINORITY & STRATEGIC STAKES", {
    x: 0.35, y: 4.22, w: 9.3, h: 0.32,
    fontSize: 11, fontFace: "Arial",
    color: "FFFFFF", bold: true, align: "center", valign: "middle"
  });

  const stakes = [
    { name: "Epic Games", stake: "40%", country: "USA", note: "Fortnite, Unreal Engine" },
    { name: "Tesla", stake: "~5%", country: "USA", note: "EV & clean tech" },
    { name: "Spotify", stake: "~7%", country: "Sweden", note: "Music streaming" },
    { name: "Sea Limited", stake: "25%+", country: "SG/SEA", note: "Shopee, Garena" },
    { name: "Bilibili", stake: "12%", country: "China", note: "Anime/streaming" },
    { name: "Ubisoft", stake: "<10%", country: "France", note: "Gaming publisher" }
  ];

  stakes.forEach((s, i) => {
    const x = 0.35 + i * 1.55;
    const y = 4.62;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 1.45, h: 0.65,
      fill: { color: "FFFFFF" },
      line: { color: theme.secondary, width: 0.5 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 1.45, h: 0.04,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });

    slide.addText(s.name, {
      x, y: y + 0.1, w: 1.45, h: 0.22,
      fontSize: 10, fontFace: "Arial",
      color: theme.primary, bold: true, align: "center", margin: 0
    });
    slide.addText(s.stake, {
      x, y: y + 0.32, w: 1.45, h: 0.18,
      fontSize: 11, fontFace: "Arial",
      color: theme.accent, bold: true, align: "center", margin: 0
    });
    slide.addText(s.country, {
      x, y: y + 0.5, w: 1.45, h: 0.14,
      fontSize: 8, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "center", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("21", {
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
  pres.writeFile({ fileName: "slide-21-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
