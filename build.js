#!/usr/bin/env node
/*
  Front Door Sites: builds the website from content.json into dist/.
  Node 18+, no npm dependencies.

    node build.js                  build into dist/
    node build.js --serve          build, then preview at http://localhost:8080
    node build.js --serve 3000     ...on another port
    node build.js --content other.json --out other-dist   (for testing)
*/
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const calc = require('./src/calc.js');
const svg = require('./src/svg.js');

const ROOT = __dirname;
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith('--') ? next : true;
}
const CONTENT_FILE = path.resolve(ROOT, arg('--content', 'content.json'));
const OUT = path.resolve(ROOT, arg('--out', 'dist'));
const SERVE = arg('--serve', false);

const warnings = new Set();
const warn = (msg) => warnings.add(msg);

/* ---------- content ---------- */

let C;
try {
  C = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
} catch (err) {
  console.error(`\nCould not read ${path.relative(ROOT, CONTENT_FILE)}:\n  ${err.message}\n`);
  console.error('Tip: a missing comma or an extra comma before } or ] is the usual cause.\n');
  process.exit(1);
}

// Blank means: missing, empty, or a "TODO..." placeholder.
function isSet(v) {
  if (v === undefined || v === null || v === false) return false;
  if (typeof v === 'string') {
    const s = v.trim();
    return s !== '' && !/^TODO\b/i.test(s);
  }
  return true;
}
const get = (obj, p) => p.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const val = (p) => (isSet(get(C, p)) ? String(get(C, p)).trim() : '');
// Checked values win over raw ones (e.g. a WhatsApp number in the wrong format counts as blank).
const effective = {};
const has = (p) => (p in effective ? Boolean(effective[p]) : isSet(get(C, p)));
const requiresMet = (item) => !item.requires || [].concat(item.requires).every(has);
const isUrl = (s) => /^https:\/\/[^\s"<>]+$/i.test(s);

function link(p, label) {
  const v = val(p);
  if (v && !isUrl(v)) { warn(`${label} (${p}) isn't a full https:// link, so it's hidden: ${v}`); return ''; }
  return v;
}

const site = C.site;
const T = C.terms;
const niches = C.niches;
const rand = calc.rand;
const month = (n) => `${rand(n)}/month`;

const contact = {
  firstName: val('contact.firstName'),
  area: val('contact.serviceArea'),
  hours: val('contact.replyHours'),
  gbp: link('contact.googleBusinessProfile', 'Google Business Profile'),
  wa: '',
  email: ''
};
if (val('contact.whatsapp')) {
  const digits = val('contact.whatsapp').replace(/[\s+()-]/g, '');
  if (/^\d{10,15}$/.test(digits) && !digits.startsWith('0')) contact.wa = digits;
  else warn(`contact.whatsapp should be digits in international format without + (e.g. 27821234567). It's hidden until fixed: ${val('contact.whatsapp')}`);
}
if (val('contact.email')) {
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val('contact.email'))) contact.email = val('contact.email');
  else warn(`contact.email doesn't look like an email address, so it's hidden: ${val('contact.email')}`);
}
// +27 82 123 4567
function waDisplay(d) {
  if (/^27\d{9}$/.test(d)) return `+27 ${d.slice(2, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `+${d}`;
}
Object.assign(effective, {
  'contact.whatsapp': contact.wa,
  'contact.email': contact.email,
  'contact.googleBusinessProfile': contact.gbp
});
const canMockup = Boolean(contact.wa || contact.email);
const onboardingForm = link('process.onboardingForm', 'Onboarding form');
effective['process.onboardingForm'] = onboardingForm;
const goLive = val('process.goLive');

const allPackages = niches.flatMap((n, ni) => n.packages.map((p, pi) => ({
  ...p,
  niche: n,
  payfastUrl: link(`niches.${ni}.packages.${pi}.payfast`, `PayFast link for ${n.navLabel} ${p.name}`)
})));
const minMonthly = Math.min(...allPackages.map((p) => p.monthly));
const maxMonthly = Math.max(...allPackages.map((p) => p.monthly));

const F = C.founding || {};
const foundingOn = F.enabled === true && Number(F.spotsLeft) > 0;

const examples = (C.examples || []).filter((e) => {
  if (!isSet(e.name)) { warn('An example has no name, so it was skipped.'); return false; }
  return true;
});
const guides = (C.guides || []).filter((g) => {
  if (!isSet(g.slug) || !isSet(g.title)) { warn('A guide is missing its slug or title, so it was skipped.'); return false; }
  if (!/^[a-z0-9-]+$/.test(g.slug)) { warn(`Guide slug "${g.slug}" should only use a-z, 0-9 and dashes. Skipped.`); return false; }
  const file = path.resolve(ROOT, g.file || `content/guides/${g.slug}.html`);
  if (!fs.existsSync(file)) { warn(`Guide "${g.title}": file not found (${path.relative(ROOT, file)}). Skipped.`); return false; }
  g.body = fs.readFileSync(file, 'utf8');
  return true;
});

function longDate(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const tokens = {
  firstName: contact.firstName,
  serviceArea: contact.area,
  replyHours: contact.hours,
  goLive,
  buyout: rand(T.buyout),
  extraWorkFrom: rand(T.extraWorkFrom),
  minimumMonths: T.minimumMonths,
  noticeDays: T.noticeDays,
  editsDeadline: T.editsDeadline,
  editsLive: T.editsLive,
  suspendAfterDays: T.suspendAfterDays,
  fromPrice: month(minMonthly),
  spotsTotal: F.spotsTotal,
  spotsLeft: F.spotsLeft,
  siteName: site.name,
  domain: site.domain,
  email: contact.email,
  whatsapp: contact.wa ? waDisplay(contact.wa) : '',
  legalName: val('legal.legalName'),
  registrationNumber: val('legal.registrationNumber'),
  noticeAddress: val('legal.noticeAddress'),
  lastUpdated: longDate(val('legal.lastUpdated') || new Date().toISOString().slice(0, 10))
};
const softTokens = new Set(['firstName']);

/* ---------- text helpers ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Fill {tokens}. Blank soft tokens disappear quietly ("Hi {firstName}," -> "Hi,").
function fill(s) {
  return String(s)
    .replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in tokens)) { warn(`Unknown {${k}} in: "${String(s).slice(0, 70)}"`); return m; }
      const v = tokens[k];
      if (v === '' || v === undefined || v === null) {
        if (!softTokens.has(k)) warn(`{${k}} is blank but used in: "${String(s).slice(0, 70)}…"`);
        return '';
      }
      return String(v);
    })
    .replace(/ +([,.!?;:])(?=\s|$)/g, '$1')
    .replace(/ {2,}/g, ' ');
}

// Straight quotes to typographic ones.
function typo(s) {
  return String(s)
    .replace(/(^|[\s([{—–-])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/(^|[\s([{—–-])"/g, '$1\u201c')
    .replace(/"/g, '\u201d');
}

const t = (s) => esc(typo(fill(s)));

// For HTML fragments (legal pages, guides): {tokens} and {{#if path}}...{{/if}}.
function fillHtml(html) {
  return html
    .replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (m, p, inner) => (has(p) ? inner : ''))
    .replace(/\{\{#unless ([\w.]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (m, p, inner) => (has(p) ? '' : inner))
    .replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in tokens)) return m;
      if (tokens[k] === '' || tokens[k] == null) { warn(`{${k}} is blank in an HTML page; wrap it in {{#if ...}}.`); return ''; }
      return esc(tokens[k]);
    });
}

/* ---------- shared pieces ---------- */

const NICHE_ICON = { guesthouses: 'bed', salons: 'scissors', restaurants: 'cup' };
const nicheIcon = (n, cls) => svg.icon(NICHE_ICON[n.id] || 'globe', cls);
const ext = ' target="_blank" rel="noopener"';
const newTab = '<span class="visually-hidden"> (opens in a new tab)</span>';

const waLink = (text) => `https://wa.me/${contact.wa}?text=${encodeURIComponent(fill(text))}`;
const waGeneral = () => waLink(C.contact.whatsappGreeting || 'Hi {firstName}');

function mockupHref(page) { return page.hasForm ? '#mockup' : '/#mockup'; }

function mockupButton(page, cls = 'btn btn-gold', label = 'Get a free mock-up') {
  return canMockup ? `<a class="${cls}" href="${mockupHref(page)}">${label}</a>` : '';
}

function ctaRow(page, extras = []) {
  const parts = [mockupButton(page, 'btn btn-gold btn-lg')]
    .concat(extras.map((e) => `<a class="btn ${e.cls || 'btn-ghost'} btn-lg" href="${e.href}">${e.label}</a>`))
    .filter(Boolean);
  return parts.length ? `<div class="cta-row">${parts.join('')}</div>` : '';
}

function ticks(items, cls = 'ticks') {
  return `<ul class="${cls}">${items.map((i) => (/:\s*$/.test(i)
    ? `<li class="plus">${t(i)}</li>`
    : `<li>${svg.icon('check')}<span>${t(i)}</span></li>`)).join('')}</ul>`;
}

function sectionHead(idBase, heading, lead, tag = 'h2') {
  return `<${tag} id="${idBase}-h">${t(heading)}</${tag}>${lead ? `<p class="section-lead">${t(lead)}</p>` : ''}`;
}

function faqList(items) {
  const visible = items.filter(requiresMet);
  return `<div class="faq-list">${visible.map((i) => `<details class="faq-item"><summary><h3>${t(i.q)}</h3><span class="faq-sign" aria-hidden="true"></span></summary><div class="faq-a"><p>${t(i.a)}</p></div></details>`).join('')}</div>`;
}
const generalFaq = (ids) => ids.map((id) => C.faq.find((f) => f.id === id)).filter(Boolean);

function foundingBanner(page, opts = {}) {
  if (!foundingOn) return '';
  const action = canMockup ? `<a class="btn btn-navy" href="${mockupHref(page)}">Get a free mock-up</a>` : '';
  return `<aside class="founding${opts.compact ? ' founding-compact' : ''}" aria-labelledby="founding-h">
<div class="founding-inner">
<p class="founding-spots"><strong>${esc(F.spotsLeft)}</strong> of ${esc(F.spotsTotal)} spots left</p>
<div class="founding-text"><h2 id="founding-h">${t(F.title)}</h2><p>${t(F.text)}</p></div>
${opts.compact ? '' : action}
</div></aside>`;
}

function planCard(p, page, opts = {}) {
  const setup = foundingOn
    ? `<p class="plan-setup"><s>${rand(p.setup)}</s> <strong>R0 setup</strong> for founding clients</p>`
    : `<p class="plan-setup">+ ${rand(p.setup)} once-off setup</p>`;
  const actions = [mockupButton(page, 'btn btn-gold'), `<a class="btn btn-ghost" href="/start">Sign up</a>`].filter(Boolean).join('');
  return `<article class="plan${p.featured ? ' plan-featured' : ''}" id="plan-${esc(p.id)}">
<header>${opts.showNiche ? `<p class="plan-niche">${esc(p.niche.name)}</p>` : ''}<h3>${t(p.name)}</h3><p class="plan-summary">${t(p.summary)}</p></header>
<p class="plan-price"><span class="plan-amount">${rand(p.monthly)}</span><span class="plan-per">/month</span></p>
${setup}
${ticks(p.includes)}
<div class="plan-actions">${actions}</div>
</article>`;
}

function termsLine() {
  return `<p class="fine">${t(`{minimumMonths}-month minimum, then month-to-month with {noticeDays} days' notice. Setup fee paid upfront; monthly fee by card or debit order through PayFast.`)} <a href="/pricing#small-edits">What counts as a small edit?</a></p>`;
}

/* ---------- WebP size (for width/height, so images never shift the layout) ---------- */

function webpSize(file) {
  const b = fs.readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = b.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') { const n = b.readUInt32LE(21); return { w: (n & 0x3fff) + 1, h: ((n >> 14) & 0x3fff) + 1 }; }
  if (chunk === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  return null;
}

function exampleImage(e) {
  if (!isSet(e.image)) return '';
  const rel = String(e.image).replace(/^\/+/, '');
  const file = path.join(ROOT, 'src', rel);
  if (!fs.existsSync(file)) { warn(`Example "${e.name}": image not found at src/${rel}`); return ''; }
  if (!/\.webp$/i.test(rel)) { warn(`Example "${e.name}": use a .webp image for speed (src/${rel})`); return ''; }
  const size = webpSize(file);
  if (!size) { warn(`Example "${e.name}": couldn't read the WebP image size (src/${rel})`); return ''; }
  return `<img src="/${esc(rel)}" width="${size.w}" height="${size.h}" loading="lazy" decoding="async" alt="${esc(e.alt || `Screenshot of the ${e.name} website`)}">`;
}

function exampleCard(e) {
  const niche = niches.find((n) => n.id === e.niche);
  const url = isSet(e.url) && isUrl(e.url) ? e.url : '';
  if (isSet(e.url) && !url) warn(`Example "${e.name}": url must start with https://`);
  const isDemo = e.kind !== 'client';
  const img = exampleImage(e);
  const shot = img || `<div class="example-placeholder" aria-hidden="true">${niche ? nicheIcon(niche, 'icon icon-xl') : svg.icon('globe', 'icon icon-xl')}</div>`;
  return `<article class="example">
<div class="example-shot"><div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span></div>${shot}</div>
<div class="example-body">
<p class="tag ${isDemo ? 'tag-demo' : 'tag-client'}">${isDemo ? 'Demo' : 'Client'}</p>
<h3>${url ? `<a href="${esc(url)}"${ext}>${t(e.name)}${newTab}</a>` : t(e.name)}</h3>
<p class="example-niche">${niche ? esc(niche.name) : ''}</p>
${isSet(e.blurb) ? `<p>${t(e.blurb)}</p>` : ''}
${isDemo ? '<p class="example-note">A made-up business, built to show what’s possible.</p>' : ''}
</div></article>`;
}

/* ---------- mock-up form ---------- */

function mockupSection(page, opts = {}) {
  if (!canMockup) return '';
  const M = C.mockup;
  const types = M.businessTypes.map((b) => `<option${b.niche && b.niche === opts.niche ? ' selected' : ''}>${esc(b.value)}</option>`).join('');
  const primary = contact.wa
    ? `<button class="btn btn-gold btn-lg btn-block" type="submit" name="via" value="whatsapp">${svg.whatsapp()}Send on WhatsApp</button>`
    : `<button class="btn btn-gold btn-lg btn-block" type="submit" name="via" value="email">${svg.icon('mail')}Send by email</button>`;
  const secondary = contact.wa && contact.email
    ? '<button class="btn-text" type="submit" name="via" value="email">Or send it by email instead</button>' : '';
  const fallbackAction = contact.wa ? `https://wa.me/${contact.wa}` : `mailto:${contact.email}`;
  return `<section class="section section-navy mockup" id="mockup" aria-labelledby="mockup-h">
<div class="wrap mockup-grid">
<div class="mockup-intro">
<h2 id="mockup-h">${t(opts.heading || M.heading)}</h2>
<p class="lead">${t(opts.lead || M.lead)}</p>
<ul class="mockup-points"><li>${svg.icon('check')}Free, with no obligation</li><li>${svg.icon('check')}Built from your public info</li><li>${svg.icon('check')}No calls: we chat on WhatsApp or email</li></ul>
${contact.hours ? `<p class="mockup-hours">${svg.icon('clock')}<span>I reply ${t(contact.hours)}</span></p>` : ''}
</div>
<form class="mockup-form" data-mockup data-wa="${esc(contact.wa)}" data-email="${esc(contact.email)}" data-name="${esc(contact.firstName)}" action="${esc(fallbackAction)}" method="get" novalidate>
<div class="field"><label for="mf-business">Business name</label><input id="mf-business" name="business" type="text" autocomplete="organization" required></div>
<div class="field"><label for="mf-type">Type of business</label><select id="mf-type" name="type" required><option value="">Choose one</option>${types}</select></div>
<div class="field"><label for="mf-town">Town</label><input id="mf-town" name="town" type="text" autocomplete="address-level2" required></div>
<div class="field"><label for="mf-link">Link to your Google Maps, Facebook, Instagram or booking listing <span class="optional">(if you have one)</span></label><input id="mf-link" name="link" type="text" inputmode="url" autocomplete="url" placeholder="e.g. facebook.com/yourbusiness"></div>
<div class="field"><label for="mf-name">Your name</label><input id="mf-name" name="name" type="text" autocomplete="name" required></div>
<fieldset class="field choices"><legend>How should I reply?</legend>
<label class="choice"><input type="radio" name="reply" value="WhatsApp" checked><span>WhatsApp</span></label>
<label class="choice"><input type="radio" name="reply" value="Email"><span>Email</span></label>
</fieldset>
<div class="field" data-when="email" hidden><label for="mf-email">Your email address</label><input id="mf-email" name="email" type="email" autocomplete="email"></div>
<div class="field" data-when="phone" hidden><label for="mf-phone">Your WhatsApp number</label><input id="mf-phone" name="phone" type="tel" autocomplete="tel"></div>
<div class="form-actions">${primary}${secondary}</div>
<p class="form-note">${svg.icon('lock')}<span>${t(M.note)}</span></p>
<div class="form-status" role="status" aria-live="polite"></div>
</form>
</div>
</section>`;
}

/* ---------- calculators ---------- */

function planToggle(n, name) {
  return `<fieldset class="plan-toggle"><legend>Your plan</legend>${n.packages.map((p, i) => `<label><input type="radio" name="${name}" value="${p.monthly}" data-plan-name="${esc(p.name)}"${i === 0 ? ' checked' : ''}><span><b>${esc(p.name)}</b> ${month(p.monthly)}</span></label>`).join('')}</fieldset>`;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function calculatorSection(n) {
  const c = n.calculator;
  const d = c.defaults;
  const first = n.packages[0];
  let fields;
  let result;
  if (c.type === 'commission') {
    const r = calc.commission({ rate: d.rate, nights: d.nights, percent: d.percent, monthly: first.monthly });
    fields = `<div class="field"><label for="calc-rate">Your nightly rate</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-rate" name="rate" type="text" inputmode="decimal" autocomplete="off" value="${d.rate}"></div></div>
<div class="field"><label for="calc-nights">Nights booked through booking sites each month</label><input id="calc-nights" name="nights" type="text" inputmode="numeric" autocomplete="off" value="${d.nights}"></div>
<div class="field"><p class="label-row"><label for="calc-percent">Commission they charge:</label> <output for="calc-percent" data-out="percent">${d.percent}%</output></p><input id="calc-percent" name="percent" type="range" min="${d.percentMin}" max="${d.percentMax}" step="1" value="${d.percent}"><div class="range-ends" aria-hidden="true"><span>${d.percentMin}%</span><span>${d.percentMax}%</span></div></div>`;
    result = `<div data-ok>
<p class="calc-line">You pay about <strong data-out="paid">${rand(calc.about(r.paid))}</strong> a month in commission.</p>
<p class="calc-line calc-main">Move <strong data-out="needed">${plural(r.needed, 'booking', 'bookings')}</strong> a month to direct and the commission you save pays for your website.</p>
<p class="calc-small">Each direct booking saves about <span data-out="perBooking">${rand(r.perBooking)}</span> in commission. Counted as one-night bookings, so longer stays save more. Website: <span data-out="planLabel">${esc(first.name)} at ${month(first.monthly)}</span>.</p>
</div>
<p data-err hidden>Enter your nightly rate and nights booked to see your numbers.</p>`;
  } else {
    const r = calc.breakEven({ price: d.price, monthly: first.monthly });
    fields = `<div class="field"><label for="calc-price">${t(c.inputLabel)}</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-price" name="price" type="text" inputmode="decimal" autocomplete="off" value="${d.price}"></div></div>`;
    result = `<div data-ok>
<p class="calc-line calc-main"><strong data-out="needed">${plural(r.needed, `extra ${c.unit}`, `extra ${c.units}`)}</strong> a month pay for your website.</p>
<p class="calc-small">Based on <span data-out="planLabel">${esc(first.name)} at ${month(first.monthly)}</span> and <span data-out="price">${rand(d.price)}</span> per ${esc(c.unit)}. A rough guide: it uses what customers pay, before your costs.</p>
</div>
<p data-err hidden>Enter an amount to see your numbers.</p>`;
  }
  return `<section class="section section-sand" id="calculator" aria-labelledby="calc-h">
<div class="wrap calc-grid">
<div class="calc-intro">${sectionHead('calc', c.heading, c.intro)}</div>
<div class="calc card" role="group" aria-labelledby="calc-h" data-calc="${esc(c.type)}" data-unit="${esc(c.unit || '')}" data-units="${esc(c.units || '')}">
${planToggle(n, 'plan')}
${fields}
<div class="calc-result" aria-live="polite">${result}</div>
</div>
</div>
</section>`;
}

/* ---------- open / closed demo (restaurants) ---------- */

const DAYS = [['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday'], ['sun', 'Sunday']];

function openStatusSection(n) {
  const o = n.openStatus;
  const rows = DAYS.map(([k, label]) => {
    const h = o.hours[k];
    return `<tr data-day="${k}"><th scope="row">${label}</th><td>${h && h.length === 2 ? `${esc(h[0])}–${esc(h[1])}` : 'Closed'}</td></tr>`;
  }).join('');
  return `<section class="section" aria-labelledby="open-h">
<div class="wrap two-col two-col-center">
<div>${sectionHead('open', o.heading, o.text)}</div>
<div class="open-demo card" data-open-status data-hours="${esc(JSON.stringify(o.hours))}">
<div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">yourcafe.co.za</span></div>
<div class="open-demo-body">
<p class="open-demo-name">${t(o.demoName)}</p>
<p class="open-status"><span class="status-pill" data-status-pill>Opening hours</span> <span data-status-text>Mon–Fri 07:00–17:00</span></p>
<div class="fake-buttons" aria-hidden="true"><span>Call</span><span>WhatsApp</span><span>Directions</span></div>
<table class="hours"><caption class="visually-hidden">Sample opening hours</caption><tbody>${rows}</tbody></table>
<p class="open-demo-note">${t(o.demoNote)}</p>
</div>
</div>
</div>
</section>`;
}

/* ---------- layout ---------- */

const navItems = [
  ...niches.map((n) => ({ href: `/${n.id}`, label: n.navLabel })),
  { href: '/examples', label: 'Examples' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  ...(guides.length ? [{ href: '/guides/', label: 'Guides' }] : [])
];

let assets = {};

function header(page) {
  const items = navItems.map((i) => `<li><a href="${i.href}"${page.url === i.href || (i.href === '/guides/' && page.url.startsWith('/guides/')) ? ' aria-current="page"' : ''}>${esc(i.label)}</a></li>`).join('');
  const cta = mockupButton(page, 'btn btn-gold btn-sm', 'Free mock-up');
  return `<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="/">${svg.logo('logo')}<span class="brand-name">Front Door <span>Sites</span></span><span class="visually-hidden"> home</span></a>
<nav class="nav-desktop" aria-label="Main"><ul>${items}</ul>${cta}</nav>
<details class="menu">
<summary>${svg.icon('menu')}<span>Menu</span></summary>
<nav class="menu-panel" aria-label="Menu"><ul>${items}<li><a href="/start">Get started</a></li></ul>${cta}</nav>
</details>
</div>
</header>`;
}

function footer(page) {
  const items = [];
  if (contact.wa) items.push(`<li>${svg.whatsapp()}<a href="${esc(waGeneral())}">WhatsApp ${esc(waDisplay(contact.wa))}</a></li>`);
  if (contact.email) items.push(`<li>${svg.icon('mail')}<a href="mailto:${esc(contact.email)}">${esc(contact.email)}</a></li>`);
  if (contact.area) items.push(`<li>${svg.icon('pin')}<span>Based in ${esc(contact.area)}. Working across South Africa.</span></li>`);
  if (contact.hours) items.push(`<li>${svg.icon('clock')}<span>Replies: ${esc(contact.hours)}</span></li>`);
  if (contact.gbp) items.push(`<li>${svg.icon('globe')}<a href="${esc(contact.gbp)}"${ext}>Google Business Profile${newTab}</a></li>`);
  const year = new Date().getFullYear();
  return `<footer class="site-footer">
<div class="wrap footer-grid">
<div class="footer-about"><a class="brand brand-footer" href="/">${svg.logo('logo')}<span class="brand-name">Front Door <span>Sites</span></span><span class="visually-hidden"> home</span></a><p>${t(site.summary)}</p></div>
${items.length ? `<div><h2>Get in touch</h2><ul class="contact-list">${items.join('')}</ul></div>` : ''}
<div><h2>Websites for</h2><ul>${niches.map((n) => `<li><a href="/${n.id}">${esc(n.name)}</a></li>`).join('')}</ul></div>
<div><h2>More</h2><ul><li><a href="/examples">Examples</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/faq">FAQ</a></li><li><a href="/start">Get started</a></li>${guides.length ? '<li><a href="/guides/">Guides</a></li>' : ''}<li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div>
</div>
<div class="wrap footer-base"><p>© ${year} ${esc(site.name)} · ${esc(site.domain)}</p><p>No cookies. No tracking.</p></div>
</footer>`;
}

function mobileBar(page) {
  const parts = [];
  if (contact.wa) parts.push(`<a class="btn btn-navy" href="${esc(waGeneral())}">${svg.whatsapp()}WhatsApp</a>`);
  if (canMockup) parts.push(`<a class="btn btn-gold" href="${mockupHref(page)}">Free mock-up</a>`);
  return parts.length ? `<aside class="mobile-bar" aria-label="Quick contact">${parts.join('')}</aside>` : '';
}

function jsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: `${site.url}/`,
    logo: `${site.url}/apple-touch-icon.png`,
    image: `${site.url}/og-image.png`,
    description: fill(site.summary),
    areaServed: [{ '@type': 'Country', name: 'South Africa' }].concat(contact.area ? [{ '@type': 'Place', name: contact.area }] : []),
    priceRange: `${rand(minMonthly)}–${rand(maxMonthly)} per month`.replace(/\u00a0/g, ' '),
    currenciesAccepted: 'ZAR',
    paymentAccepted: 'Credit card, debit order',
    knowsAbout: ['Website design', 'Guesthouse websites', 'Salon websites', 'Restaurant websites', 'Google Business Profile'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Website packages',
      itemListElement: allPackages.map((p) => ({
        '@type': 'Offer',
        name: `${p.niche.name}: ${p.name}`,
        priceCurrency: 'ZAR',
        price: p.monthly,
        priceSpecification: { '@type': 'UnitPriceSpecification', price: p.monthly, priceCurrency: 'ZAR', unitText: 'month' },
        url: `${site.url}/pricing#plan-${p.id}`
      }))
    }
  };
  if (contact.wa) data.telephone = `+${contact.wa}`;
  if (contact.email) data.email = contact.email;
  if (contact.gbp) data.sameAs = [contact.gbp];
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

function layout(page) {
  const canonical = `${site.url}${page.url === '/' ? '/' : page.url}`;
  const title = esc(typo(fill(page.title)));
  const description = esc(typo(fill(page.description)));
  const bar = mobileBar(page);
  return `<!doctype html>
${page.review ? `${page.review}\n` : ''}<html lang="${esc(site.language || 'en-ZA')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
${page.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${esc(canonical)}">`}
<meta name="theme-color" content="#124B78">
<link rel="preload" href="/fonts/fraunces-600.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/fonts/figtree-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${assets.css}">
<script src="${assets.js}" defer></script>
<link rel="icon" href="/favicon.ico" sizes="32x32">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="en_ZA">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(site.url)}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Front Door Sites: websites for South African guesthouses, salons and restaurants">
<meta name="twitter:card" content="summary_large_image">
${page.jsonLd ? jsonLd() : ''}
</head>
<body class="${bar ? 'has-bar' : ''}${page.bodyClass ? ` ${page.bodyClass}` : ''}">
<a class="skip" href="#main">Skip to content</a>
${header(page)}
<main id="main">
${page.body}
</main>
${footer(page)}
${bar}
</body>
</html>
`;
}

/* ---------- pages ---------- */

function pageHero(h1, lead, extra = '', eyebrow = '') {
  return `<section class="hero hero-simple"><div class="wrap narrow">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ''}<h1>${t(h1)}</h1>${lead ? `<p class="lead">${t(lead)}</p>` : ''}${extra}</div></section>`;
}

function homePage() {
  const H = C.home;
  const page = { url: '/', out: 'index.html', hasForm: true, jsonLd: true, title: H.seo.title, description: H.seo.description, bodyClass: 'page-home' };
  const nicheCards = niches.map((n) => {
    const from = Math.min(...n.packages.map((p) => p.monthly));
    return `<article class="niche-card">
<div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(n.card.address)}</span></div>
<div class="niche-card-body">
<span class="niche-icon">${nicheIcon(n)}</span>
<h3><a class="stretched" href="/${n.id}">${t(n.name)}</a></h3>
<p>${t(n.card.text)}</p>
<p class="niche-price">From <strong>${rand(from)}</strong>/month</p>
<span class="niche-more" aria-hidden="true">See ${esc(n.singular)} websites ${svg.icon('arrow')}</span>
</div>
</article>`;
  }).join('');
  const steps = H.steps.items.map((s, i) => `<li class="step"><div class="step-art">${svg.stepDoor(i + 1)}</div><p class="step-num">Step ${i + 1}</p><h3>${t(s.title)}</h3><p>${t(s.text)}</p></li>`).join('');
  const includes = H.includes.items.map((i) => `<li><span class="inc-icon">${svg.icon(i.icon)}</span><div><h3>${t(i.title)}</h3><p>${t(i.text)}</p></div></li>`).join('');
  const about = contact.firstName
    ? `<section class="section about" aria-labelledby="about-h"><div class="wrap narrow about-inner">${svg.logo('logo about-logo')}<div>${sectionHead('about', H.about.heading)}<p>${t(H.about.text)}${contact.area ? ` ${t(H.about.areaText)}` : ''}</p></div></div></section>`
    : '';
  const exStrip = examples.length
    ? `<section class="section" aria-labelledby="ex-h"><div class="wrap">${sectionHead('ex', H.examplesHeading)}<div class="examples">${examples.slice(0, 3).map(exampleCard).join('')}</div><p class="more-link"><a href="/examples">See all examples ${svg.icon('arrow')}</a></p></div></section>`
    : '';
  page.body = `<section class="hero hero-home">
<div class="wrap hero-grid">
<div class="hero-text">
<p class="eyebrow">${t(H.hero.eyebrow)}</p>
<h1>${t(H.hero.h1)} <span class="h1-price">${t(H.hero.price)}</span></h1>
<p class="lead">${t(H.hero.lead)}</p>
${ctaRow(page, [{ href: '/pricing', label: 'See prices' }])}
<ul class="hero-points">${H.hero.points.map((p) => `<li>${svg.icon('check')}<span>${t(p)}</span></li>`).join('')}</ul>
</div>
<div class="hero-visual">${svg.hero()}</div>
</div>
</section>
${foundingOn ? `<div class="wrap founding-wrap">${foundingBanner(page)}</div>` : ''}
<section class="section" aria-labelledby="niches-h"><div class="wrap">${sectionHead('niches', H.niches.heading, H.niches.lead)}<div class="niche-cards">${nicheCards}</div></div></section>
<section class="section section-sand" aria-labelledby="how-h"><div class="wrap">${sectionHead('how', H.steps.heading, H.steps.lead)}<ol class="steps">${steps}</ol></div></section>
<section class="section" aria-labelledby="inc-h"><div class="wrap">${sectionHead('inc', H.includes.heading)}<ul class="includes">${includes}</ul><p class="more-link"><a href="/pricing">See prices and packages ${svg.icon('arrow')}</a></p></div></section>
${about}
${exStrip}
<section class="section section-sand" aria-labelledby="faqt-h"><div class="wrap narrow">${sectionHead('faqt', H.faqTeaser.heading)}${faqList(generalFaq(H.faqTeaser.ids))}<p class="more-link"><a href="/faq">All questions and answers ${svg.icon('arrow')}</a></p></div></section>
${mockupSection(page, { heading: H.cta.heading, lead: H.cta.lead })}`;
  return page;
}

function nichePage(n) {
  const page = { url: `/${n.id}`, out: `${n.id}.html`, hasForm: true, title: n.seo.title, description: n.seo.description, bodyClass: `page-${n.id}` };
  const A = n.argument;
  const from = Math.min(...n.packages.map((p) => p.monthly));
  const nicheEx = examples.filter((e) => e.niche === n.id);
  const exBlock = nicheEx.length
    ? `<section class="section" aria-labelledby="ex-h"><div class="wrap">${sectionHead('ex', `${n.name}: examples`)}<div class="examples">${nicheEx.slice(0, 3).map(exampleCard).join('')}</div><p class="more-link"><a href="/examples">See all examples ${svg.icon('arrow')}</a></p></div></section>`
    : '';
  page.body = `<section class="hero hero-niche">
<div class="wrap hero-grid">
<div class="hero-text">
<p class="eyebrow">${nicheIcon(n)}${t(n.hero.eyebrow)}</p>
<h1>${t(n.hero.h1)}</h1>
<p class="lead">${t(n.hero.lead)}</p>
${ctaRow(page, [{ href: '#pricing', label: 'See prices' }])}
<p class="hero-from">Plans from <strong>${month(from)}</strong>. Free mock-up first.</p>
</div>
<div class="hero-visual">${svg.phone(n.id)}</div>
</div>
</section>
<section class="section" aria-labelledby="why-h">
<div class="wrap two-col">
<div class="prose-block">${sectionHead('why', A.heading)}${A.paragraphs.map((p) => `<p>${t(p)}</p>`).join('')}</div>
<div class="card points-card"><h3>What your website does</h3>${ticks(A.points)}</div>
</div>
</section>
${n.openStatus ? openStatusSection(n) : ''}
${calculatorSection(n)}
<section class="section" id="pricing" aria-labelledby="pricing-h">
<div class="wrap">
${sectionHead('pricing', n.plansHeading, 'A once-off setup fee, then one monthly fee that covers everything.')}
${foundingOn ? foundingBanner(page, { compact: true }) : ''}
<div class="plans plans-2">${n.packages.map((p) => planCard(p, page)).join('')}</div>
${termsLine()}
</div>
</section>
${exBlock}
<section class="section section-sand" id="faq" aria-labelledby="faq-h">
<div class="wrap narrow">${sectionHead('faq', `Questions from ${n.singular} owners`)}${faqList(n.faq.concat(generalFaq(['included', 'cancel', 'speed'])))}<p class="more-link"><a href="/faq">All questions and answers ${svg.icon('arrow')}</a></p></div>
</section>
${mockupSection(page, { niche: n.id, heading: `Get a free mock-up of your ${n.singular} website`, lead: C.mockup.lead })}`;
  return page;
}

function pricingPage() {
  const P = C.pricing;
  const page = { url: '/pricing', out: 'pricing.html', title: P.seo.title, description: P.seo.description };
  const groups = niches.map((n) => `<section class="price-group" id="${n.id}-plans" aria-labelledby="${n.id}-plans-h">
<div class="price-group-head"><span class="niche-icon">${nicheIcon(n)}</span><h2 id="${n.id}-plans-h">${t(n.name)}</h2><a href="/${n.id}">Why it pays for itself ${svg.icon('arrow')}</a></div>
<div class="plans plans-2">${n.packages.map((p) => planCard(p, page)).join('')}</div>
</section>`).join('');
  const S = P.smallEdit;
  page.body = `${pageHero(P.h1, P.lead)}
${foundingOn ? `<div class="wrap founding-wrap">${foundingBanner(page)}</div>` : ''}
<div class="section"><div class="wrap">${groups}</div></div>
<section class="section section-sand" aria-labelledby="terms-h"><div class="wrap two-col">
<div>${sectionHead('terms', 'The fine print, in plain English')}${ticks(P.termsSummary)}<p><a href="/terms">Read the full terms</a></p></div>
<div class="card" id="small-edits"><h2 class="h3">${t(S.heading)}</h2><p>${t(S.lead)}</p>${ticks(S.examples)}<p>${t(S.notIncluded)}</p><p class="callout">${svg.icon('calendar')}<span>${t(S.timing)}</span></p></div>
</div></section>
<section class="section" aria-labelledby="next-h"><div class="wrap narrow center">${sectionHead('next', 'Not sure which plan?', 'Start with a free mock-up. You only choose a package once you’ve seen your site.')}${ctaRow(page, [{ href: '/start', label: 'How signing up works' }])}</div></section>`;
  return page;
}

function faqPage() {
  const Q = C.faqPage;
  const page = { url: '/faq', out: 'faq.html', title: Q.seo.title, description: Q.seo.description };
  const contactBtns = [
    contact.wa ? `<a class="btn btn-navy btn-lg" href="${esc(waGeneral())}">${svg.whatsapp()}Ask on WhatsApp</a>` : '',
    contact.email ? `<a class="btn btn-ghost btn-lg" href="mailto:${esc(contact.email)}">${svg.icon('mail')}Email me</a>` : ''
  ].filter(Boolean).join('');
  page.body = `${pageHero(Q.h1, Q.lead)}
<section class="section section-tight" aria-labelledby="general-h"><div class="wrap narrow">${sectionHead('general', 'The basics')}${faqList(C.faq)}</div></section>
${niches.map((n) => `<section class="section section-tight" aria-labelledby="faq-${n.id}-h"><div class="wrap narrow"><h2 id="faq-${n.id}-h" class="with-icon"><span class="niche-icon">${nicheIcon(n)}</span>${t(n.name)}</h2>${faqList(n.faq)}<p class="more-link"><a href="/${n.id}">More about ${esc(n.singular)} websites ${svg.icon('arrow')}</a></p></div></section>`).join('')}
${contactBtns || canMockup ? `<section class="section section-sand" aria-labelledby="ask-h"><div class="wrap narrow center">${sectionHead('ask', 'Still have a question?', 'Ask me directly. No calls needed.')}<div class="cta-row cta-center">${contactBtns}${mockupButton(page, 'btn btn-gold btn-lg')}</div></div></section>` : ''}`;
  return page;
}

function examplesPage() {
  const E = C.examplesPage;
  const page = { url: '/examples', out: 'examples.html', title: E.seo.title, description: E.seo.description };
  const legend = '<ul class="legend"><li><span class="tag tag-demo">Demo</span> A made-up business, built to show what’s possible.</li><li><span class="tag tag-client">Client</span> A real business’s live site, shown with permission.</li></ul>';
  const list = examples.length
    ? `<div class="examples">${examples.map(exampleCard).join('')}</div>`
    : `<div class="empty card">${svg.stepDoor(2)}<p>${t(E.empty)}</p>${ctaRow(page)}</div>`;
  page.body = `${pageHero(E.h1, E.lead)}
<section class="section section-tight"><div class="wrap">${examples.length ? legend : ''}${list}</div></section>
${examples.length && canMockup ? `<section class="section section-sand"><div class="wrap narrow center">${sectionHead('see', 'Want to see yours?', 'I’ll build a free mock-up of your own site from your public info.')}${ctaRow(page)}</div></section>` : ''}`;
  return page;
}

function startPage() {
  const S = C.startPage;
  const page = { url: '/start', out: 'start.html', title: S.seo.title, description: S.seo.description };
  const step = (id) => S.steps.find((s) => s.id === id) || {};
  const pkgList = `<div class="pkg-list">${niches.map((n) => `<div class="pkg-group"><p class="pkg-niche">${nicheIcon(n)}${esc(n.name)}</p><ul>${n.packages.map((p) => `<li><span>${esc(p.name)}</span><span>${month(p.monthly)} <small>+ ${rand(p.setup)} setup</small></span></li>`).join('')}</ul></div>`).join('')}</div><p><a href="/pricing">Compare what’s in each package ${svg.icon('arrow')}</a></p>`;
  const withLinks = allPackages.filter((p) => p.payfastUrl);
  const ask = [
    contact.wa ? `<a class="btn btn-navy" href="${esc(waLink('Hi {firstName}, I would like to sign up. Please send me a payment link.'))}">${svg.whatsapp()}WhatsApp me</a>` : '',
    contact.email ? `<a class="btn btn-ghost" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent('Sign up')}">${svg.icon('mail')}Email me</a>` : ''
  ].filter(Boolean).join('');
  const payBlock = withLinks.length
    ? `<div class="pay-buttons">${withLinks.map((p) => `<a class="btn btn-navy" href="${esc(p.payfastUrl)}">${svg.icon('card')}<span>Pay for ${esc(p.niche.navLabel)} ${esc(p.name)}<small>${rand(p.setup)} setup + ${month(p.monthly)}</small></span></a>`).join('')}</div>${withLinks.length < allPackages.length && ask ? `<p>Can’t see your package? Message me and I’ll send you the link.</p><div class="cta-row">${ask}</div>` : ''}`
    : (ask ? `<p>${t(step('pay').noLinksText)}</p><div class="cta-row">${ask}</div>` : '');
  const formBlock = onboardingForm
    ? `<p><a class="btn btn-gold" href="${esc(onboardingForm)}"${ext}>${svg.icon('form')}Open the onboarding form${newTab}</a></p>`
    : `<p>${t(step('content').noFormText)}</p>`;
  const live = step('live');
  const items = [
    ['choose', 'calendar', pkgList],
    ['pay', 'card', payBlock],
    ['content', 'form', formBlock],
    ['approve', 'eye', ''],
    ['live', 'rocket', requiresMet(live) && live.goLiveText ? `<p class="callout">${svg.icon('clock')}<span>${t(live.goLiveText)}</span></p>` : '']
  ].map(([id, icon, extra], i) => {
    const s = step(id);
    return `<li class="start-step" id="step-${id}"><div class="start-num" aria-hidden="true">${i + 1}</div><div class="start-body"><h2>${t(s.title)}</h2><p>${t(s.text)}</p>${extra}</div></li>`;
  }).join('');
  const lead = `${t(S.lead)}${canMockup ? ` Not sure yet? <a href="/#mockup">Get a free mock-up first</a>.` : ''}`;
  page.body = `<section class="hero hero-simple"><div class="wrap narrow"><h1>${t(S.h1)}</h1><p class="lead">${lead}</p></div></section>
${foundingOn ? `<div class="wrap narrow"><p class="founding-note">${svg.icon('check')}<span>${t(F.startNote)}</span></p></div>` : ''}
<section class="section section-tight"><div class="wrap narrow"><ol class="start-steps">${items}</ol></div></section>`;
  return page;
}

function legalPage(name) {
  const L = C.legalPages[name];
  let src = fs.readFileSync(path.join(ROOT, 'content/pages', `${name}.html`), 'utf8');
  const lead = src.match(/^\s*(<!--[\s\S]*?-->)/);
  const review = lead ? lead[1] : '';
  src = src.replace(/<!--[\s\S]*?-->/g, '').trim();
  const page = { url: `/${name}`, out: `${name}.html`, title: L.seo.title, description: L.seo.description, review };
  page.body = `${pageHero(L.h1, L.lead, `<p class="updated">Last updated: ${esc(tokens.lastUpdated)}</p>`)}
<section class="section section-tight"><div class="wrap narrow prose">${fillHtml(src)}</div></section>`;
  return page;
}

function notFoundPage() {
  const N = C.notFound;
  const page = { url: '/404', out: '404.html', title: N.seo.title, description: N.seo.description, noindex: true };
  const links = [{ href: '/', label: 'Home' }, ...niches.map((n) => ({ href: `/${n.id}`, label: `${n.singular[0].toUpperCase()}${n.singular.slice(1)} websites` })), { href: '/pricing', label: 'Pricing' }, { href: '/faq', label: 'Questions & answers' }];
  page.body = `<section class="hero hero-simple notfound"><div class="wrap narrow center">${svg.stepDoor(1)}<h1>${t(N.h1)}</h1><p class="lead">${t(N.lead)}</p><ul class="notfound-links">${links.map((l) => `<li><a href="${l.href}">${esc(l.label)}</a></li>`).join('')}</ul></div></section>`;
  return page;
}

function guidePages() {
  if (!guides.length) return [];
  const G = C.guidesPage;
  const index = { url: '/guides/', out: 'guides/index.html', title: G.seo.title, description: G.seo.description };
  const sorted = guides.slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  index.body = `${pageHero(G.h1, G.lead)}
<section class="section section-tight"><div class="wrap narrow"><ul class="guide-list">${sorted.map((g) => `<li><h2><a href="/guides/${g.slug}">${t(g.title)}</a></h2>${isSet(g.description) ? `<p>${t(g.description)}</p>` : ''}${isSet(g.date) ? `<p class="updated">${esc(longDate(g.date))}</p>` : ''}</li>`).join('')}</ul></div></section>`;
  const articles = sorted.map((g) => {
    const page = { url: `/guides/${g.slug}`, out: `guides/${g.slug}.html`, hasForm: false, title: `${g.title} | ${site.name}`, description: g.description || G.seo.description };
    page.body = `<article>${pageHero(g.title, g.description, isSet(g.date) ? `<p class="updated">${esc(longDate(g.date))}</p>` : '', '<a href="/guides/">Guides</a>')}
<section class="section section-tight"><div class="wrap narrow prose">${fillHtml(g.body.replace(/<!--[\s\S]*?-->/g, ''))}</div></section></article>
${canMockup ? `<section class="section section-sand"><div class="wrap narrow center">${sectionHead('next', 'Want a website that does this for you?', 'Get a free mock-up of your own site. No obligation, no calls.')}${ctaRow(page)}</div></section>` : ''}`;
    return page;
  });
  return [index, ...articles];
}

/* ---------- write files ---------- */

function hash(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 10); }
function write(rel, data) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
}
function copyDir(from, to, filter = () => true) {
  if (!fs.existsSync(from)) return;
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(a, b, filter);
    else if (filter(entry.name)) { fs.mkdirSync(to, { recursive: true }); fs.copyFileSync(a, b); }
  }
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function minifyCss(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

function build() {
  const started = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const css = minifyCss(fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8'));
  const js = `${fs.readFileSync(path.join(ROOT, 'src/calc.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'src/site.js'), 'utf8')}`;
  assets = { css: `/assets/styles.${hash(css)}.css`, js: `/assets/site.${hash(js)}.js` };
  write(assets.css, css);
  write(assets.js, js);
  copyDir(path.join(ROOT, 'src/fonts'), path.join(OUT, 'fonts'), (f) => f.endsWith('.woff2'));
  copyDir(path.join(ROOT, 'src/img'), path.join(OUT, 'img'));
  copyDir(path.join(ROOT, 'src/static'), OUT);

  const pages = [
    homePage(),
    ...niches.map(nichePage),
    examplesPage(),
    pricingPage(),
    faqPage(),
    startPage(),
    legalPage('privacy'),
    legalPage('terms'),
    ...guidePages(),
    notFoundPage()
  ];
  for (const p of pages) write(p.out, layout(p));

  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.filter((p) => !p.noindex).map((p) => `  <url><loc>${site.url}${p.url}</loc><lastmod>${today}</lastmod></url>`);
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);
  write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${site.url}/sitemap.xml\n`);
  write('_headers', `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self' https://wa.me mailto:; frame-ancestors 'none'; base-uri 'self'; object-src 'none'

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/*
  Cache-Control: public, max-age=31536000, immutable

/img/*
  Cache-Control: public, max-age=86400
`);

  checkOutput();

  const n = pages.length;
  const where = OUT.startsWith(ROOT + path.sep) ? path.relative(ROOT, OUT) : OUT;
  console.log(`Built ${n} pages into ${where}/ in ${Date.now() - started} ms.`);
  const todo = placeholderReport();
  if (todo.length) console.log(`Still to fill in (hidden on the site until then): ${todo.join(', ')}`);
  if (warnings.size) {
    console.log(`\n${warnings.size} warning${warnings.size === 1 ? '' : 's'}:`);
    for (const w of warnings) console.log(`  - ${w}`);
    process.exitCode = 1;
  }
}

function placeholderReport() {
  const out = [];
  (function scan(o, p) {
    if (typeof o === 'string') { if (/^\s*TODO\b/i.test(o)) out.push(p); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!k.startsWith('_')) scan(o[k], p ? `${p}.${k}` : k);
  })(C, '');
  return out.map((p) => p.replace(/^niches\.(\d+)\.packages\.(\d+)\.payfast$/, (m, a, b) => `payfast (${niches[a].navLabel} ${niches[a].packages[b].name})`));
}

/* ---------- checks: internal links, anchors, empty links, leaked placeholders ---------- */

function resolveLocal(urlPath) {
  const p = decodeURIComponent(urlPath.split('#')[0].split('?')[0]);
  if (p.includes('..')) return null;
  const candidates = p === '/' ? ['index.html'] : p.endsWith('/') ? [`${p.slice(1)}index.html`] : [p.slice(1), `${p.slice(1)}.html`];
  for (const c of candidates) {
    const f = path.join(OUT, c);
    if (fs.existsSync(f) && fs.statSync(f).isFile()) return c;
  }
  return null;
}

function checkOutput() {
  const htmlFiles = walk(OUT).filter((f) => f.endsWith('.html'));
  const ids = new Map();
  const texts = new Map();
  for (const f of htmlFiles) {
    const rel = path.relative(OUT, f).split(path.sep).join('/');
    const html = fs.readFileSync(f, 'utf8');
    texts.set(rel, html);
    ids.set(rel, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])));
  }
  for (const [rel, html] of texts) {
    const visible = html.replace(/<!--[\s\S]*?-->/g, '');
    if (/\bTODO\b/.test(visible)) warn(`${rel}: a TODO placeholder is showing on the page.`);
    if (/\{\w+\}/.test(visible.replace(/<script[\s\S]*?<\/script>/g, ''))) warn(`${rel}: an unfilled {token} is showing on the page.`);
    for (const m of visible.matchAll(/\s(href|src|action)="([^"]*)"/g)) {
      const v = m[2].replace(/&amp;/g, '&');
      if (v === '' || v === '#') { warn(`${rel}: empty ${m[1]}`); continue; }
      if (/^(https?:|mailto:|tel:)/i.test(v)) {
        if (/^https:\/\/wa\.me\/(\?|$)/.test(v) || /^mailto:(\?|$)/.test(v) || /TODO/i.test(v)) warn(`${rel}: broken link ${v}`);
        continue;
      }
      if (v.startsWith('#')) {
        if (!ids.get(rel).has(v.slice(1))) warn(`${rel}: link to #${v.slice(1)} but there is no such id on the page`);
        continue;
      }
      if (v.startsWith('/')) {
        const target = resolveLocal(v);
        if (!target) { warn(`${rel}: broken link ${v}`); continue; }
        const hashPart = v.split('#')[1];
        if (hashPart && target.endsWith('.html') && !ids.get(target).has(hashPart)) warn(`${rel}: link ${v} points to a missing #${hashPart}`);
        continue;
      }
      warn(`${rel}: relative link "${v}" (use a link starting with /)`);
    }
  }
}

/* ---------- preview server ---------- */

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain' };

function serve(port) {
  http.createServer((req, res) => {
    const target = resolveLocal(new URL(req.url, 'http://localhost').pathname);
    const file = target ? path.join(OUT, target) : path.join(OUT, '404.html');
    res.writeHead(target ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`\nPreview: http://localhost:${port}  (Ctrl+C to stop)`));
}

build();
if (SERVE) serve(SERVE === true ? 8080 : Number(SERVE));
