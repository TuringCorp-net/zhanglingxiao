// compile.js - Compile all slides into final PPTX
const pptxgen = require("pptxgenjs");
const pres = new pptxgen();

pres.layout = "LAYOUT_16x9";
pres.title = "Tencent Holdings Ltd. — Company Introduction";
pres.author = "Tencent IR";
pres.subject = "Comprehensive Company Introduction";
pres.company = "Tencent Holdings Ltd.";

const theme = {
  primary: "2b2d42",   // Deep navy - titles
  secondary: "8d99ae", // Slate gray - body text
  accent: "ef233c",    // Bright red - accent
  light: "d90429",     // Deep red - highlights
  bg: "edf2f4"          // Off-white - background
};

// Load and create all 24 slides
for (let i = 1; i <= 24; i++) {
  const num = String(i).padStart(2, "0");
  try {
    const slideModule = require(`./slide-${num}.js`);
    slideModule.createSlide(pres, theme);
    console.log(`Slide ${num}: ${slideModule.slideConfig?.title || "OK"}`);
  } catch (err) {
    console.error(`Error loading slide-${num}.js:`, err.message);
  }
}

// Write final output
pres.writeFile({ fileName: "./output/tencent-intro.pptx" })
  .then(() => {
    console.log("\nPPTX created: ./output/tencent-intro.pptx");
  })
  .catch(err => {
    console.error("Error writing PPTX:", err);
  });
