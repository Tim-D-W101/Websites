/*
  Regenerates the share image and icons in src/static/ from the SVG artwork:
    og-image.png (1200x630), apple-touch-icon.png (180x180), favicon.ico (16/32/48)

  Only needed if you change the logo or the share image. Not part of the normal build.
  Needs Playwright:  npx playwright install chromium   (once), then:
    node tools/make-images.mjs
*/
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = require(path.join(ROOT, 'src/svg.js'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

// Embedded as data URLs: a page opened with setContent can't read local files.
const font = (f) => `data:font/woff2;base64,${readFileSync(path.join(ROOT, 'src/fonts', f)).toString('base64')}`;
const fontCss = `
@font-face { font-family: Fraunces; src: url(${font('fraunces-600.woff2')}); font-weight: 600; }
@font-face { font-family: Figtree; src: url(${font('figtree-400.woff2')}); font-weight: 400; }
@font-face { font-family: Figtree; src: url(${font('figtree-700.woff2')}); font-weight: 700; }
:root { --head: Fraunces, serif; --body: Figtree, sans-serif; }
* { margin: 0; box-sizing: border-box; }
.art-url { font: 700 15px var(--body); fill: #0D436F; }
.art-btn { font: 700 14px var(--body); fill: #0A2A44; }
.art-mat { font: 700 11px var(--body); letter-spacing: 3px; fill: #5C3F17; }
`;

const og = `<!doctype html><html><head><style>${fontCss}
body { width: 1200px; height: 630px; overflow: hidden; background: #FCF8F0; font-family: var(--body); color: #1D2B36; position: relative; }
.glow { position: absolute; right: -120px; top: -60px; width: 760px; height: 760px; border-radius: 50%; background: radial-gradient(closest-side, #F8EBD3, rgba(248,235,211,0)); }
.text { position: absolute; left: 72px; top: 64px; width: 640px; }
.brand { display: flex; align-items: center; gap: 18px; font: 600 40px var(--head); color: #0A2A44; }
.brand svg { width: 76px; height: 76px; }
.brand span { color: #316A97; }
h1 { margin-top: 56px; font: 600 60px/1.08 var(--head); color: #0A2A44; letter-spacing: -0.5px; }
h1 em { font-style: normal; background: linear-gradient(transparent 60%, #FEC458 60%, #FEC458 90%, transparent 90%); }
p { margin-top: 30px; font-size: 28px; font-weight: 700; color: #124B78; }
.url { position: absolute; left: 72px; bottom: 56px; font-size: 26px; font-weight: 700; color: #0A2A44; background: #F0D1A2; padding: 8px 22px; border-radius: 999px; }
.art { position: absolute; right: 40px; bottom: 20px; width: 470px; }
</style></head><body>
<div class="glow"></div>
<div class="text">
  <div class="brand">${svg.logo('l')}<div>Front Door <span>Sites</span></div></div>
  <h1>Websites for South African guesthouses, salons <em>&amp; restaurants</em></h1>
  <p>Free mock-up · No calls · Built for phones</p>
</div>
<div class="url">frontdoorsites.co.za</div>
<div class="art">${svg.hero()}</div>
</body></html>`;

const icon = (size, square) => `<!doctype html><html><head><style>* { margin: 0 } body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; } svg { width: ${size}px; height: ${size}px; display: block; }</style></head><body>${square ? svg.logo('l').replace('rx="22" fill="#F0D1A2"', 'fill="#F0D1A2"') : svg.logo('l')}</body></html>`;

// ICO file holding PNG images (supported by every current browser).
function ico(pngs) {
  const header = Buffer.alloc(6 + 16 * pngs.length);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    header.writeUInt8(size >= 256 ? 0 : size, e);
    header.writeUInt8(size >= 256 ? 0 : size, e + 1);
    header.writeUInt8(0, e + 2);
    header.writeUInt8(0, e + 3);
    header.writeUInt16LE(1, e + 4);
    header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(data.length, e + 8);
    header.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function shot(html, width, height, omitBackground = false) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const buf = await page.screenshot({ type: 'png', omitBackground });
  await page.close();
  return buf;
}

const out = (f) => path.join(ROOT, 'src/static', f);
writeFileSync(out('og-image.png'), await shot(og, 1200, 630));
writeFileSync(out('apple-touch-icon.png'), await shot(icon(180, true), 180, 180));
const sizes = [16, 32, 48];
const pngs = [];
for (const size of sizes) pngs.push({ size, data: await shot(icon(size, false), size, size, true) });
writeFileSync(out('favicon.ico'), ico(pngs));
await browser.close();

for (const f of ['og-image.png', 'apple-touch-icon.png', 'favicon.ico']) console.log(`wrote src/static/${f} (${readFileSync(out(f)).length} bytes)`);
