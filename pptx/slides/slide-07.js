// slide-07.js - Mini Programs Platform
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 7, title: "Mini Programs Platform" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("Mini Programs Platform", {
    x: 0.35, y: 0.25, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("微信小程序  |  An App Ecosystem Within WeChat", {
    x: 0.35, y: 0.75, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Key stats bar
  const statsBar = [
    { val: "7M+", label: "Mini Programs" },
    { val: "400M+", label: "Daily Active Users" },
    { val: "1T+", label: "Annual Transactions" },
    { val: "400K+", label: "Developers" }
  ];

  statsBar.forEach((s, i) => {
    const x = 0.35 + i * 2.35;
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: 1.15, w: 2.2, h: 1.05,
      fill: { color: i % 2 === 0 ? theme.primary : theme.accent }
    });
    slide.addText(s.val, {
      x, y: 1.18, w: 2.2, h: 0.55,
      fontSize: 26, fontFace: "Arial",
      color: "FFFFFF", bold: true, align: "center", margin: 0
    });
    slide.addText(s.label, {
      x, y: 1.73, w: 2.2, h: 0.35,
      fontSize: 10, fontFace: "Arial",
      color: "FFFFFF", bold: false, align: "center", margin: 0
    });
  });

  // Categories
  const categories = [
    { cat: "Retail & E-commerce", examples: "JD.com, Pinduoduo, Nike, Starbucks", users: "600M+ users" },
    { cat: "Food & Delivery", examples: "Meituan, Ele.me, Luckin Coffee", users: "500M+ users" },
    { cat: "Transportation", examples: "Didi, Metro apps, Parking, Toll", users: "400M+ users" },
    { cat: "Healthcare", examples: "Appointments, Insurance, Pharmacy", users: "300M+ users" },
    { cat: "Finance & Banking", examples: "WeBank, Insurance, Stock trading", users: "200M+ users" },
    { cat: "Government Services", examples: "Health codes, ID, Permits, Tax", users: "1B+ uses" }
  ];

  const catStartY = 2.42;
  categories.forEach((c, i) => {
    const y = catStartY + i * 0.42;
    const bgColor = i % 2 === 0 ? "FFFFFF" : "f8f9fa";

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 9.3, h: 0.38,
      fill: { color: bgColor }
    });

    slide.addShape(pres.shapes.RECTANGLE, {
      x: 0.35, y, w: 0.05, h: 0.38,
      fill: { color: i % 2 === 0 ? theme.accent : theme.light }
    });

    slide.addText(c.cat, {
      x: 0.5, y, w: 2.8, h: 0.38,
      fontSize: 12, fontFace: "Arial",
      color: theme.primary, bold: true, align: "left", valign: "middle", margin: 0
    });
    slide.addText(c.examples, {
      x: 3.3, y, w: 4.5, h: 0.38,
      fontSize: 10, fontFace: "Arial",
      color: theme.secondary, bold: false, align: "left", valign: "middle", margin: 0
    });
    slide.addText(c.users, {
      x: 7.9, y, w: 1.6, h: 0.38,
      fontSize: 10, fontFace: "Arial",
      color: theme.accent, bold: true, align: "right", valign: "middle", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("7", {
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
  pres.writeFile({ fileName: "slide-07-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
