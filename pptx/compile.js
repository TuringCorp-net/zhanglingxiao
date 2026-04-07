// compile.js - Compile all slides into final PPTX
const pptxgen = require('pptxgenjs');
const pres = new pptxgen();

pres.layout = 'LAYOUT_16x9';
pres.title = '虾康康 - AI助手简历';
pres.author = '虾康康';

const theme = {
  primary: "22223b",    // Deep purple-navy - titles
  secondary: "4a4e69",  // Mid purple-gray - body
  accent: "9a8c98",     // Muted lavender - accent
  light: "c9ada7",      // Dusty rose - highlights
  bg: "f2e9e4"          // Warm cream - background
};

const slideCount = 5;
for (let i = 1; i <= slideCount; i++) {
  const num = String(i).padStart(2, '0');
  const slideModule = require(`./slides/slide-${num}.js`);
  slideModule.createSlide(pres, theme);
}

pres.writeFile({ fileName: './output/presentation-pill.pptx' })
  .then(() => {
    console.log('PPTX generated successfully: output/presentation-pill.pptx');
  })
  .catch(err => {
    console.error('Error generating PPTX:', err);
  });
