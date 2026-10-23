// Genera el PDF del manual a partir de manual.html y las capturas de docs/manual/img.
// Uso:  node docs/manual/generar.cjs      (necesita `playwright`; las capturas se sacan antes con capturas.cjs)
const path = require('path');
const { chromium } = (() => { try { return require('playwright'); } catch { return require('/opt/node22/lib/node_modules/playwright'); } })();

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'manual.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  const salida = path.join(__dirname, '..', 'Manual-Turnero-Daniel-Gonzalez.pdf');
  await p.pdf({ path: salida, format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log('PDF generado:', salida);
  await b.close();
})();
