// slide-10.js - Key Game Titles
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 10, title: "Key Game Titles" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Key Game Titles", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Blockbuster Portfolio Across All Genres", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  const games = [
    {
      title: "Honor of Kings",
      studio: "TiMi Studios",
      genre: "MOBA",
      region: "China & Southeast Asia",
      stat: "1B+ downloads",
      color: theme.accent
    },
    {
      title: "League of Legends",
      studio: "Riot Games",
      genre: "MOBA",
      region: "Global",
      stat: "180M+ MAU",
      color: theme.light
    },
    {
      title: "Valorant",
      studio: "Riot Games",
      genre: "Tactical Shooter",
      region: "Global",
      stat: "25M+ MAU",
      color: theme.accent
    },
    {
      title: "PUBG Mobile",
      studio: "Lightspeed & Quantum",
      genre: "Battle Royale",
      region: "Global (ex-China)",
      stat: "1B+ downloads",
      color: theme.light
    },
    {
      title: "Peacekeeper Elite",
      studio: "TiMi Studios",
      genre: "Battle Royale",
      region: "China",
      stat: "Top grossing CN",
      color: theme.accent
    },
    {
      title: "Genshin Impact",
      studio: "miHoYo (40% stake)",
      genre: "Open World RPG",
      region: "Global",
      stat: "$5B+ revenue",
      color: theme.light
    },
    {
      title: "Brawl Stars",
      studio: "Supercell",
      genre: "Mobile Arena",
      region: "Global",
      stat: "200M+ downloads",
      color: theme.accent
    },
    {
      title: "Clash of Clans",
      studio: "Supercell",
      genre: "Strategy",
      region: "Global",
      stat: "$10B+ lifetime revenue",
      color: theme.light
    }
  ];

  games.forEach((g, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 0.3 + col * 2.4;
    const y = 1.1 + row * 1.85;

    // Card
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.25, h: 1.72,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.08 }
    });

    // Top color bar
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 2.25, h: 0.06,
      fill: { color: g.color }
    });

    // Genre badge
    slide.addShape(pres.shapes.RECTANGLE, {
      x: x + 0.1, y: y + 0.15, w: 0.9, h: 0.25,
      fill: { color: theme.primary }
    });
    slide.addText(g.genre, {
      x: x + 0.1, y: y + 0.15, w: 0.9, h: 0.25,
      fontSize: 8, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", valign: "middle"
    });

    // Title
    slide.addText(g.title, {
      x: x + 0.1, y: y + 0.48, w: 2.05, h: 0.38,
      fontSize: 13, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    // Studio
    slide.addText(g.studio, {
      x: x + 0.1, y: y + 0.88, w: 2.05, h: 0.22,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Region
    slide.addText(g.region, {
      x: x + 0.1, y: y + 1.1, w: 2.05, h: 0.2,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });

    // Stat
    slide.addText(g.stat, {
      x: x + 0.1, y: y + 1.32, w: 2.05, h: 0.28,
      fontSize: 11, fontFace: "Arial",
      color: g.color, bold: true, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("10", {
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
  pres.writeFile({ fileName: "slide-10-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
