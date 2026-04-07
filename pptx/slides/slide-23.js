// slide-23.js - ESG & Sustainability
const pptxgen = require("pptxgenjs");
const slideConfig = { type: "content", index: 23, title: "ESG & Sustainability" };

function createSlide(pres, theme) {
  const slide = pres.addSlide();
  slide.background = { color: theme.bg };

  // Left accent
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0, y: 0, w: 0.08, h: 5.625,
    fill: { color: theme.accent }
  });

  // Title
  slide.addText("ESG & Sustainability", {
    x: 0.35, y: 0.22, w: 9, h: 0.52,
    fontSize: 32, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });
  slide.addText("Committed to Carbon Neutrality by 2030 | ESG Leadership", {
    x: 0.35, y: 0.72, w: 9, h: 0.28,
    fontSize: 13, fontFace: "Arial",
    color: theme.secondary, bold: false, align: "left", margin: 0
  });

  // Environment section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.08, w: 4.5, h: 2.4,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 1.08, w: 4.5, h: 0.06,
    fill: { color: theme.accent }
  });

  slide.addText("Environment (E)", {
    x: 0.5, y: 1.2, w: 4.2, h: 0.32,
    fontSize: 15, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  const envItems = [
    "Carbon Neutrality Target: 2030 for Scope 1 & 2",
    "100% Renewable Energy: 45% achieved (2023)",
    "Green Data Centers: T-block technology, PUE < 1.2",
    "Energy Efficiency: AI-optimized cooling systems",
    "CDP Climate Response: Score B+ (2023)",
    "TCFD Framework: Full adoption since 2021",
    "Green Building: LEED-certified offices in BJ/SZ/SH"
  ];

  envItems.forEach((item, i) => {
    slide.addText(item, {
      x: 0.5, y: 1.58 + i * 0.27, w: 4.2, h: 0.25,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, bullet: true, align: "left", margin: 0
    });
  });

  // Social section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.05, y: 1.08, w: 4.6, h: 2.4,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 5.05, y: 1.08, w: 4.6, h: 0.06,
    fill: { color: theme.light }
  });

  slide.addText("Social (S)", {
    x: 5.2, y: 1.2, w: 4.3, h: 0.32,
    fontSize: 15, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  const socialItems = [
    "Digital Inclusion: Free Wi-Fi in 30K+ rural areas CN",
    "Education: Tencent Foundation donations $500M+",
    "Rural Revitalization: 100M+ RMB invested annually",
    "Disability Inclusion: Accessibility in WeChat/QQ",
    "Online Safety: AI content moderation, anti-fraud",
    "Employee: 100K+ global staff, DEI initiatives",
    "Tencent Charity Fund: $3B+ raised for public welfare"
  ];

  socialItems.forEach((item, i) => {
    slide.addText(item, {
      x: 5.2, y: 1.58 + i * 0.27, w: 4.3, h: 0.25,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, bullet: true, align: "left", margin: 0
    });
  });

  // Governance section
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 3.58, w: 9.3, h: 1.45,
    fill: { color: "FFFFFF" },
    shadow: { type: "outer", color: "000000", blur: 4, offset: 2, angle: 135, opacity: 0.08 }
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: 0.35, y: 3.58, w: 9.3, h: 0.06,
    fill: { color: theme.primary }
  });

  slide.addText("Governance (G) & ESG Ratings", {
    x: 0.5, y: 3.7, w: 9.0, h: 0.32,
    fontSize: 15, fontFace: "Arial",
    color: theme.primary, bold: true, align: "left", margin: 0
  });

  const govItems = [
    "MSCI ESG Rating: A (2023) | DJSI: Included 3 consecutive years",
    "Board Diversity: 40%+ independent directors, 30%+ female board members",
    "Data Privacy: GDPR-compliant EU operations, CCPA-compliant US operations",
    "Anti-Corruption: Zero-tolerance policy, ISO 37001 certified",
    "Supply Chain: Responsible Gaming, supplier code of conduct",
    "Investor Relations: Transparent reporting, quarterly earnings calls"
  ];

  govItems.forEach((item, i) => {
    const col = i % 2;
    const x = 0.5 + col * 4.65;
    slide.addText(item, {
      x, y: 4.05 + Math.floor(i / 2) * 0.3, w: 4.55, h: 0.28,
      fontSize: 9.5, fontFace: "Arial",
      color: theme.secondary, bold: false, bullet: true, align: "left", margin: 0
    });
  });

  // Page number badge
  slide.addShape(pres.shapes.OVAL, {
    x: 9.3, y: 5.1, w: 0.4, h: 0.4,
    fill: { color: theme.accent }
  });
  slide.addText("23", {
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
  pres.writeFile({ fileName: "slide-23-preview.pptx" });
}
module.exports = { createSlide, slideConfig };
