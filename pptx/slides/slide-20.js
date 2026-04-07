// slide-20.js - Global Presence
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 20, title: "Global Presence" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Top accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 10, h: 0.06,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Global Presence", {
    x: 0.3, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Operations in 30+ Countries | 5 Major International Offices", {
    x: 0.3, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Key stat bar
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.3, y: 1.1, w: 9.4, h: 0.55,
    fill: { color: theme.primary }
  });
  const topStats = [
    { v: "30+", l: "Countries" },
    { v: "100+", l: "Overseas Employees" },
    { v: "5", l: "Major Intl. Offices" },
    { v: "800+", l: "Invested Companies" },
    { v: "$20B+", l: "Overseas Investment" }
  ];
  topStats.forEach((s, i) => {
    const x = 0.3 + i * 1.88;
    slide.addText(s.v, {
      x, y: 1.12, w: 1.0, h: 0.28,
      fontSize: 18, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(s.l, {
      x, y: 1.4, w: 1.0, h: 0.2,
      fontSize: 8.5, fontFace: "Arial",
      color: theme.accent, bold: false, align: "center", margin: 0
    });
  });

  // Regional breakdown
  const regions = [
    {
      region: "United States",
      color: theme.accent,
      details: [
        "Riot Games HQ (Los Angeles)",
        "Lightspeed & Quantum (LA)",
        "Epic Games (40% stake)",
        "Tesla investment (5%)",
        "Spotify stake (7%)",
        "Office: Silicon Valley, Seattle"
      ]
    },
    {
      region: "Europe",
      color: theme.light,
      details: [
        "Supercell HQ (Helsinki, 70%)",
        "Miniclip (UK, 100%)",
        "Funcom (Norway, 100%)",
        " Ubisoft (minority stake)",
        "Flagship European offices: London, Berlin, Paris",
        "Research labs in UK & Netherlands"
      ]
    },
    {
      region: "Southeast Asia",
      color: theme.accent,
      details: [
        "Sea Limited (Garena, 25%+)",
        "VNG Corporation (Vietnam)",
        "Appota (Indonesia)",
        "Regional HQ: Singapore",
        "Mobile Legends (Moonton)",
        "Gaming publishing in TH/PH/VN"
      ]
    },
    {
      region: "India & South Asia",
      color: theme.light,
      details: [
        "Flipkart investment (minority)",
        "PolicyBazaar (minority)",
        "Upstox (fintech)",
        "Dream11 (fantasy sports)",
        "Gaana (music streaming)",
        "Hindustan Times (media, minority)"
      ]
    },
    {
      region: "Korea & Japan",
      color: theme.accent,
      details: [
        "SM Entertainment (5%)",
        "YG Entertainment (minority)",
        "Nexon investment (gaming)",
        "Cygames relationship",
        "Kakao investment (messaging)",
        "Publishing: Honor of Kings JP/KR"
      ]
    },
    {
      region: "Latin America",
      color: theme.light,
      details: [
        "Stone (Brazil, fintech, minority)",
        "Rappi (Colombia, delivery)",
        "Kavak (Mexico, used cars)",
        "Musical.ly investment history",
        "Game publishing expansion",
        "WeChat Pay cross-border"
      ]
    }
  ];

  regions.forEach((r, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = 0.3 + col * 3.2;
    const y = 1.78 + row * 1.55;

    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.0, h: 1.42,
      fill: { color: "FFFFFF" },
      shadow: { type: "outer", color: "000000", blur: 3, offset: 1, angle: 135, opacity: 0.07 }
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y, w: 3.0, h: 0.06,
      fill: { color: r.color }
    });

    slide.addText(r.region, {
      x: x + 0.12, y: y + 0.12, w: 2.76, h: 0.28,
      fontSize: 13, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", margin: 0
    });

    slide.addText(r.details.join(" | "), {
      x: x + 0.12, y: y + 0.42, w: 2.76, h: 0.9,
      fontSize: 9, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("20", {
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
  pres.writeFile({ fileName: "slide-20-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
