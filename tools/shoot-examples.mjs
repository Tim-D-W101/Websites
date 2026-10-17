/*
  Takes a screenshot of every demo in examples.items (content.json) and saves it as WebP in
  src/img/examples/<id>.webp, for the example cards on the home page, /websites,
  /business-tools and the industry pages. Run it after changing a demo's look:

    node build.js
    node tools/shoot-examples.mjs

  Needs Playwright (see "Share image and icons" in README.md). Uses the built site in dist/.
  The WebP files are made by the browser itself, so nothing else needs installing.
*/
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

if (!existsSync(path.join(DIST, 'index.html'))) {
  console.error('Run node build.js first: this takes its screenshots from dist/.');
  process.exit(1);
}
const C = JSON.parse(readFileSync(path.join(ROOT, 'content.json'), 'utf8'));
const items = ((C.examples && C.examples.items) || []).filter((e) => e.status !== 'client' && String(e.url || '').startsWith('/'));

// A small server for dist/: /menu serves menu.html, /folder/ serves folder/index.html.
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const tries = p.endsWith('/') ? [`${p}index.html`] : [p, `${p}.html`];
  const file = tries.map((t) => path.join(DIST, t)).find((f) => !f.includes('..') && existsSync(f) && statSync(f).isFile());
  if (!file) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const base = `http://localhost:${server.address().port}`;

// Some demos look best a step in: the staff app past its login screen.
const BEFORE = {
  'staff-app': async (page) => { await page.click('#skip'); }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
for (const e of items) {
  await page.goto(base + e.url, { waitUntil: 'networkidle' });
  if (BEFORE[e.id]) await BEFORE[e.id](page);
  await page.waitForTimeout(400);
  const png = await page.screenshot({ type: 'png' });
  // Encode as WebP in the browser, at card size (960 x 600).
  const webp = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = 960;
    c.height = 600;
    c.getContext('2d').drawImage(img, 0, 0, 960, 600);
    return c.toDataURL('image/webp', 0.8).split(',')[1];
  }, png.toString('base64'));
  const out = path.join(ROOT, 'src/img/examples', `${e.id}.webp`);
  writeFileSync(out, Buffer.from(webp, 'base64'));
  console.log(`${path.relative(ROOT, out)}  ${Math.round(Buffer.from(webp, 'base64').length / 1024)} KB`);
}
await browser.close();
server.close();
console.log('\nAdd "image": "img/examples/<id>.webp" and an "alt" to each item in content.json if they aren\'t there yet.');
