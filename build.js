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
const bands = C.bands;
const groups = C.groups;
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
const canEnquire = Boolean(contact.wa || contact.email);

/* ---------- prices: build bands and care plans ---------- */

const bandById = Object.fromEntries(bands.map((b) => [b.id, b]));
const hasPrice = (b) => b.from !== null && b.from !== undefined && b.from !== '' && Number(b.from) > 0;
const minFrom = (group) => Math.min(...bands.filter((b) => b.group === group && hasPrice(b)).map((b) => Number(b.from)));
const websitesFrom = minFrom('websites');
const toolsFrom = minFrom('tools');
const timedBands = bands.filter((b) => isSet(b.buildTime));

const carePlans = (C.carePlans || []).map((p, i) => ({
  ...p,
  payfastUrl: link(`carePlans.${i}.payfast`, `PayFast link for the ${p.name} plan`),
  payfastYearlyUrl: link(`carePlans.${i}.payfastYearly`, `Yearly PayFast link for the ${p.name} plan`)
}));
const careById = Object.fromEntries(carePlans.map((p) => [p.id, p]));
// Care plans are paid through PayFast once any link is filled in. Until then, by EFT.
const payfastOn = carePlans.some((p) => p.payfastUrl || p.payfastYearlyUrl);
effective['care.payfastOn'] = payfastOn ? 'on' : '';
effective['care.payByEft'] = payfastOn ? '' : 'on';
const careFrom = Math.min(...carePlans.map((p) => p.monthly));

const depositPct = Number(T.depositPercent) || 50;

// Yearly care plans: pay for this many months and get 12. Blank, 0 or 12+ turns it off.
const yearlyMonths = Number(T.yearlyPaysMonths) || 0;
const yearlyOn = yearlyMonths > 0 && yearlyMonths < 12;
const yearly = (monthlyFee) => monthlyFee * yearlyMonths;
const yearlyFree = `${12 - yearlyMonths} month${12 - yearlyMonths === 1 ? '' : 's'}`;
effective['terms.yearlyPaysMonths'] = yearlyOn ? 'on' : '';

const F = C.founding || {};
const foundingOn = F.enabled === true && Number(F.spotsLeft) > 0;
// Founding clients get this much off the build price (not the care plans).
const foundingPct = Number(F.discountPercent) || 50;

const examples = (C.examples || []).filter((e) => {
  if (!isSet(e.name)) { warn('An example has no name, so it was skipped.'); return false; }
  return true;
}).map((e) => {
  // "kind": website | tool, "status": demo | client (older entries used kind for demo/client).
  const legacy = e.kind === 'demo' || e.kind === 'client';
  return { ...e, kind: e.kind === 'tool' ? 'tool' : 'website', status: (legacy ? e.kind : e.status) === 'client' ? 'client' : 'demo' };
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
  quoteTime: val('process.quoteTime'),
  paymentMethods: val('process.paymentMethods'),
  websitesFrom: rand(websitesFrom),
  toolsFrom: rand(toolsFrom),
  careFrom: month(careFrom),
  deposit: `${depositPct}%`,
  balance: `${100 - depositPct}%`,
  quoteValidDays: T.quoteValidDays,
  noticeDays: T.noticeDays,
  extraWorkFrom: rand(T.extraWorkFrom),
  editsDeadline: T.editsDeadline,
  editsLive: T.editsLive,
  suspendAfterDays: T.suspendAfterDays,
  yearlyPaysMonths: yearlyOn ? yearlyMonths : '',
  yearlyFree: yearlyOn ? yearlyFree : '',
  careYearly: yearlyOn && careById.care ? rand(yearly(careById.care.monthly)) : '',
  spotsTotal: F.spotsTotal,
  foundingDiscount: `${foundingPct}%`,
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

// Text that may be a string, or { "text": ..., "requires": [...] } hidden until a detail is filled in.
const shown = (items) => [].concat(items || []).filter((i) => typeof i === 'string' || requiresMet(i)).map((i) => (typeof i === 'string' ? i : i.text));

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
const GROUP_ICON = { websites: 'globe', tools: 'grid' };
const ext = ' target="_blank" rel="noopener"';
const newTab = '<span class="visually-hidden"> (opens in a new tab)</span>';
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const kindTag = (kind) => `<span class="tag tag-${kind === 'tool' ? 'tool' : 'website'}">${kind === 'tool' ? 'Tool' : 'Website'}</span>`;

const waLink = (text) => `https://wa.me/${contact.wa}?text=${encodeURIComponent(fill(text))}`;
const waGeneral = () => waLink(C.contact.whatsappGreeting || 'Hi {firstName}');

function enquiryHref(page) { return page.hasForm ? '#enquiry' : '/#enquiry'; }

function quoteButton(page, cls = 'btn btn-gold', label = 'Get a free quote') {
  return canEnquire ? `<a class="${cls}" href="${enquiryHref(page)}">${esc(label)}</a>` : '';
}

function ctaRow(page, extras = [], label = 'Get a free quote') {
  const parts = [quoteButton(page, 'btn btn-gold btn-lg', label)]
    .concat(extras.map((e) => `<a class="btn ${e.cls || 'btn-ghost'} btn-lg" href="${e.href}">${e.label}</a>`))
    .filter(Boolean);
  return parts.length ? `<div class="cta-row">${parts.join('')}</div>` : '';
}

function ticks(items, cls = 'ticks') {
  return `<ul class="${cls}">${shown(items).map((i) => (/:\s*$/.test(i)
    ? `<li class="plus">${t(i)}</li>`
    : `<li>${svg.icon('check')}<span>${t(i)}</span></li>`)).join('')}</ul>`;
}

function sectionHead(idBase, heading, lead, tag = 'h2') {
  return `<${tag} id="${idBase}-h">${t(heading)}</${tag}>${lead ? `<p class="section-lead">${t(lead)}</p>` : ''}`;
}

function buildTimesList(group) {
  return `<ul class="time-list">${timedBands.filter((b) => !group || b.group === group).map((b) => `<li><span>${esc(b.name)}</span><span>${esc(typo(b.buildTime))}</span></li>`).join('')}</ul>`;
}

function faqAnswer(i, group) {
  const parts = shown(i.a);
  let html = parts.length ? `<p>${parts.map(t).join(' ')}</p>` : '';
  if (i.list) html += `<ul>${i.list.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`;
  if (i.special === 'buildTimes' && timedBands.some((b) => !group || b.group === group)) html += `<p>Typical build times, from when your deposit and content reach me:</p>${buildTimesList(group)}`;
  return html;
}

// group: show only that group's build times in "How long does it take?" (websites or tools pages).
function faqList(items, group) {
  const visible = items.filter(requiresMet);
  return `<div class="faq-list">${visible.map((i) => `<details class="faq-item"><summary><h3>${t(i.q)}</h3><span class="faq-sign" aria-hidden="true"></span></summary><div class="faq-a">${faqAnswer(i, group)}</div></details>`).join('')}</div>`;
}
const generalFaq = (ids) => ids.map((id) => C.faq.find((f) => f.id === id)).filter(Boolean);

function faqSection(page, heading, items, group, sand = true) {
  return `<section class="section${sand ? ' section-sand' : ''}" id="faq" aria-labelledby="faq-h">
<div class="wrap narrow">${sectionHead('faq', heading)}${faqList(items, group)}<p class="more-link"><a href="/faq">All questions and answers ${svg.icon('arrow')}</a></p></div>
</section>`;
}

function foundingBanner(page, opts = {}) {
  if (!foundingOn) return '';
  const action = !opts.compact && canEnquire ? `<a class="btn btn-navy" href="${enquiryHref(page)}">Get a free quote</a>` : '';
  return `<aside class="founding${opts.compact ? ' founding-compact' : ''}" aria-labelledby="founding-h">
<div class="founding-inner">
<p class="founding-spots"><strong>${esc(F.spotsLeft)}</strong> of ${esc(F.spotsTotal)} spots left</p>
<div class="founding-text"><h2 id="founding-h">${t(F.title)}</h2><p>${t(F.text)}</p></div>
${action}
</div></aside>`;
}

/* ---------- price cards ---------- */

function bandPrice(b) {
  return hasPrice(b)
    ? `<p class="plan-price"><span class="plan-from">from</span><span class="plan-amount">${rand(b.from)}</span></p>`
    : '<p class="plan-price"><span class="plan-amount plan-quoted">Quoted</span></p>';
}

function bandCard(b, page) {
  return `<article class="plan band" id="band-${esc(b.id)}">
<h3>${t(b.name)}</h3>
${bandPrice(b)}
${foundingOn ? `<p class="plan-setup"><strong>${foundingPct}% off</strong> for founding clients</p>` : ''}
<p class="plan-summary">${t(b.scope)}</p>
${isSet(b.buildTime) ? `<p class="band-time">${svg.icon('clock')}<span>Typical build: ${esc(typo(b.buildTime))}</span></p>` : ''}
${canEnquire ? `<div class="plan-actions">${quoteButton(page, 'btn btn-gold', hasPrice(b) ? 'Get a free quote' : 'Ask for a free plan')}</div>` : ''}
</article>`;
}

function bandsGrid(group, page) {
  return `<div class="plans plans-3">${bands.filter((b) => b.group === group).map((b) => bandCard(b, page)).join('')}</div>`;
}

function careCard(p, opts = {}) {
  const featured = opts.highlight ? opts.highlight === p.id : p.featured;
  return `<article class="plan care${featured ? ' plan-featured' : ''}" id="care-${esc(p.id)}">
<header><h3>${t(p.name)}</h3><p class="plan-summary">${t(p.summary)}</p></header>
<p class="plan-price"><span class="plan-amount">${rand(p.monthly)}</span><span class="plan-per">/month</span></p>
${yearlyOn ? `<p class="plan-yearly">or pay <strong>${rand(yearly(p.monthly))}</strong> once a year <span class="plan-save">${yearlyFree} free</span></p>` : ''}
${ticks(p.includes)}
<div class="plan-actions"><a class="btn btn-ghost" href="/start#step-care">How to sign up</a></div>
</article>`;
}

function careSection(page, opts = {}) {
  const CA = C.care;
  return `<section class="section${opts.sand ? ' section-sand' : ''}" id="care" aria-labelledby="care-h">
<div class="wrap">
${sectionHead('care', CA.heading, opts.lead || CA.lead)}
<div class="plans plans-3">${carePlans.map((p) => careCard(p, opts)).join('')}</div>
<p class="fine">${t(CA.noPlan)}</p>
</div>
</section>`;
}

function stepsSection(id, heading, lead, items, sand = true) {
  const list = items.map((s, i) => `<li class="step"><div class="step-art">${svg.stepDoor(Math.min(i + 1, 4))}</div><p class="step-num">Step ${i + 1}</p><h3>${t(s.title)}</h3><p>${t(s.text)}</p></li>`).join('');
  return `<section class="section${sand ? ' section-sand' : ''}" aria-labelledby="${id}-h"><div class="wrap">${sectionHead(id, heading, lead)}<ol class="steps steps-${items.length}">${list}</ol></div></section>`;
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
  return `<img src="/${esc(rel)}" width="${size.w}" height="${size.h}" loading="lazy" decoding="async" alt="${esc(e.alt || `Screenshot of ${e.name}`)}">`;
}

function exampleCard(e) {
  const niche = niches.find((n) => n.id === e.niche);
  const url = isSet(e.url) && isUrl(e.url) ? e.url : '';
  if (isSet(e.url) && !url) warn(`Example "${e.name}": url must start with https://`);
  const isDemo = e.status !== 'client';
  const img = exampleImage(e);
  const shot = img || `<div class="example-placeholder" aria-hidden="true">${niche ? nicheIcon(niche, 'icon icon-xl') : svg.icon(e.kind === 'tool' ? 'grid' : 'globe', 'icon icon-xl')}</div>`;
  return `<article class="example" data-kind="${e.kind}">
<div class="example-shot"><div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span></div>${shot}</div>
<div class="example-body">
<p class="tags">${kindTag(e.kind)}<span class="tag ${isDemo ? 'tag-demo' : 'tag-client'}">${isDemo ? 'Demo' : 'Client'}</span></p>
<h3>${url ? `<a href="${esc(url)}"${ext}>${t(e.name)}${newTab}</a>` : t(e.name)}</h3>
${niche ? `<p class="example-niche">${esc(niche.name)}</p>` : ''}
${isSet(e.blurb) ? `<p>${t(e.blurb)}</p>` : ''}
${isDemo ? '<p class="example-note">A made-up business, built to show what’s possible.</p>' : ''}
</div></article>`;
}

function examplesBlock(list, heading, sand = false) {
  if (!list.length) return '';
  return `<section class="section${sand ? ' section-sand' : ''}" aria-labelledby="ex-h"><div class="wrap">${sectionHead('ex', heading)}<div class="examples">${list.slice(0, 3).map(exampleCard).join('')}</div><p class="more-link"><a href="/examples">See all examples ${svg.icon('arrow')}</a></p></div></section>`;
}

/* ---------- enquiry form ---------- */

function enquirySection(page, opts = {}) {
  if (!canEnquire) return '';
  const E = C.enquiry;
  const pre = opts.need ? E.needs.find((n) => n.key === opts.need) : null;
  const needs = E.needs.map((n) => `<label><input type="radio" name="need" value="${esc(n.value)}" data-key="${esc(n.key)}" data-button="${esc(typo(n.button))}" data-intro="${esc(typo(fill(n.intro)))}"${pre && pre.key === n.key ? ' checked' : ''}><span>${esc(n.value)}</span></label>`).join('');
  const label = pre ? pre.button : 'Get my free quote';
  const viaWa = Boolean(contact.wa);
  const primary = `<button class="btn btn-gold btn-lg btn-block" type="submit" name="via" value="${viaWa ? 'whatsapp' : 'email'}">${viaWa ? svg.whatsapp() : svg.icon('mail')}<span data-submit-label>${esc(typo(label))}</span></button>`;
  const secondary = contact.wa && contact.email ? '<button class="btn-text" type="submit" name="via" value="email">Or send it by email instead</button>' : '';
  const options = (list) => list.map((o) => `<option>${esc(o)}</option>`).join('');
  const max = Number(E.detailsMax) || 600;
  // On the websites and tools pages, talk only about that page's free first step.
  const free = { website: ['A free mock-up of your website', 'Mock-ups'], tool: ['A free written plan', 'Plans'] }[opts.need] || ['A free mock-up (websites) or plan (tools)', 'Mock-ups and plans'];
  const intro = [
    `${svg.icon('check')}<span>${free[0]}</span>`,
    `${svg.icon('check')}<span>A fixed quote before I start</span>`,
    `${svg.icon('check')}<span>You own it once it’s paid for</span>`
  ].map((x) => `<li>${x}</li>`).join('');
  return `<section class="section section-navy mockup" id="enquiry" aria-labelledby="enquiry-h">
<div class="wrap mockup-grid">
<div class="mockup-intro">
<h2 id="enquiry-h">${t(opts.heading || E.heading)}</h2>
<p class="lead">${t(opts.lead || E.lead)}</p>
<ul class="mockup-points">${intro}</ul>
${contact.hours ? `<p class="mockup-hours">${svg.icon('clock')}<span>I reply ${t(contact.hours)}</span></p>` : ''}
${tokens.quoteTime ? `<p class="mockup-hours">${svg.icon('calendar')}<span>${t(free[1] + ' usually within {quoteTime}')}</span></p>` : ''}
</div>
<form class="mockup-form" data-enquiry data-wa="${esc(contact.wa)}" data-email="${esc(contact.email)}" data-name="${esc(contact.firstName)}" novalidate>
<fieldset class="field plan-toggle need-toggle"><legend>What do you need?</legend>${needs}</fieldset>
<div class="field"><label for="ef-business">Business name</label><input id="ef-business" name="business" type="text" autocomplete="organization" required></div>
<div class="field"><label for="ef-type">Type of business</label><input id="ef-type" name="type" type="text" value="${esc(opts.businessType || '')}" placeholder="e.g. plumber, farm stall, accountant" required></div>
<div class="field"><label for="ef-town">Town</label><input id="ef-town" name="town" type="text" autocomplete="address-level2" required></div>
<div class="field"><label for="ef-details">Tell me what you need</label><textarea id="ef-details" name="details" rows="4" maxlength="${max}" placeholder="${esc(typo(E.detailsPlaceholder))}" aria-describedby="ef-details-count" required></textarea><p class="char-count" id="ef-details-count">Up to ${max} characters</p></div>
<div class="field" data-hide-for="tool"><label for="ef-link">Link to your Google Maps, Facebook, Instagram or current website <span class="optional">(optional)</span></label><input id="ef-link" name="link" type="text" inputmode="url" autocomplete="url" placeholder="e.g. facebook.com/yourbusiness"></div>
<div class="field-row">
<div class="field"><label for="ef-budget">Rough budget <span class="optional">(optional)</span></label><select id="ef-budget" name="budget"><option value="">Choose one</option>${options(E.budgets)}</select></div>
<div class="field"><label for="ef-timing">When do you need it? <span class="optional">(optional)</span></label><select id="ef-timing" name="timing"><option value="">Choose one</option>${options(E.timings)}</select></div>
</div>
<div class="field"><label for="ef-name">Your name</label><input id="ef-name" name="name" type="text" autocomplete="name" required></div>
<fieldset class="field choices"><legend>How should I reply?</legend>
<label class="choice"><input type="radio" name="reply" value="WhatsApp" checked><span>WhatsApp</span></label>
<label class="choice"><input type="radio" name="reply" value="Email"><span>Email</span></label>
</fieldset>
<div class="field" data-when="email" hidden><label for="ef-email">Your email address</label><input id="ef-email" name="email" type="email" autocomplete="email"></div>
<div class="field" data-when="phone" hidden><label for="ef-phone">Your WhatsApp number</label><input id="ef-phone" name="phone" type="tel" autocomplete="tel"></div>
<div class="form-actions">${primary}<p class="form-hint">${viaWa ? 'Opens WhatsApp with your message ready to send.' : 'Opens your email app with your message ready to send.'}</p>${secondary}</div>
<p class="form-note">${svg.icon('chat')}<span>${t(E.noCalls)}</span></p>
<p class="form-note">${svg.icon('lock')}<span>${t(E.note)}</span></p>
<div class="form-status" role="status" aria-live="polite"></div>
</form>
</div>
</section>`;
}

/* ---------- calculators ---------- */

function buildToggle(c) {
  const list = c.bands.map((id) => bandById[id]).filter((b) => b && hasPrice(b));
  return `<fieldset class="plan-toggle"><legend>Your website</legend>${list.map((b, i) => `<label><input type="radio" name="build" value="${Number(b.from)}" data-band-name="${esc(b.name)}"${i === 0 ? ' checked' : ''}><span><b>${esc(b.name)}</b> from ${rand(b.from)}</span></label>`).join('')}</fieldset>`;
}

function calculatorSection(n) {
  const c = n.calculator;
  const d = c.defaults;
  const first = bandById[c.bands[0]];
  const care = careById[c.carePlan] || carePlans[0];
  const bandLabel = `${esc(first.name)} (${rand(first.from)})`;
  const careNote = `the ${esc(care.name)} plan at ${month(care.monthly)}`;
  let fields;
  let result;
  if (c.type === 'commission') {
    const r = calc.commission({ rate: d.rate, nights: d.nights, percent: d.percent, build: first.from, care: care.monthly });
    fields = `<div class="field"><label for="calc-rate">Your nightly rate</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-rate" name="rate" type="text" inputmode="decimal" autocomplete="off" value="${d.rate}"></div></div>
<div class="field"><label for="calc-nights">Nights booked through booking sites each month</label><input id="calc-nights" name="nights" type="text" inputmode="numeric" autocomplete="off" value="${d.nights}"></div>
<div class="field"><p class="label-row"><label for="calc-percent">Commission they charge:</label> <output for="calc-percent" data-out="percent">${d.percent}%</output></p><input id="calc-percent" name="percent" type="range" min="${d.percentMin}" max="${d.percentMax}" step="1" value="${d.percent}"><div class="range-ends" aria-hidden="true"><span>${d.percentMin}%</span><span>${d.percentMax}%</span></div></div>`;
    result = `<div data-ok>
<p class="calc-line">You pay about <strong data-out="paid">${rand(calc.about(r.paid))}</strong> a month (<span data-out="perYear">${rand(calc.about(r.perYear))}</span> a year) in commission.</p>
<p class="calc-line calc-main">About <strong data-out="payback">${plural(r.payback, 'direct night', 'direct nights')}</strong> <span data-out="paybackVerb">${r.payback === 1 ? 'pays' : 'pay'}</span> back the website, and <strong data-out="care">${r.care}</strong> a month <span data-out="careVerb">${r.care === 1 ? 'covers' : 'cover'}</span> the ${esc(care.name)} plan after that.</p>
<p class="calc-small">Each direct night saves about <span data-out="perNight">${rand(r.perNight)}</span> in commission. Uses the starting price of a <span data-out="bandLabel">${bandLabel}</span> and ${careNote}, so your own quote may differ.</p>
</div>
<p data-err hidden>Enter your nightly rate and nights booked to see your numbers.</p>`;
  } else {
    const r = calc.payback({ price: d.price, build: first.from, care: care.monthly });
    fields = `<div class="field"><label for="calc-price">${t(c.inputLabel)}</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-price" name="price" type="text" inputmode="decimal" autocomplete="off" value="${d.price}"></div></div>`;
    result = `<div data-ok>
<p class="calc-line calc-main">About <strong data-out="payback">${plural(r.payback, c.unit, c.units)}</strong> <span data-out="paybackVerb">${r.payback === 1 ? 'pays' : 'pay'}</span> back the website, and <strong data-out="care">${r.care}</strong> a month <span data-out="careVerb">${r.care === 1 ? 'covers' : 'cover'}</span> the ${esc(care.name)} plan after that.</p>
<p class="calc-small">Based on takings, not profit. Uses the starting price of a <span data-out="bandLabel">${bandLabel}</span> and ${careNote}, so your own quote may differ.</p>
</div>
<p data-err hidden>Enter an amount to see your numbers.</p>`;
  }
  return `<section class="section section-sand" id="calculator" aria-labelledby="calc-h">
<div class="wrap calc-grid">
<div class="calc-intro">${sectionHead('calc', c.heading, c.intro)}</div>
<div class="calc card" role="group" aria-labelledby="calc-h" data-calc="${esc(c.type)}" data-care="${care.monthly}" data-unit="${esc(c.unit || '')}" data-units="${esc(c.units || '')}">
${buildToggle(c)}
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
  { href: '/websites', label: 'Websites' },
  { href: '/business-tools', label: 'Business tools' },
  { href: '/examples', label: 'Examples' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  ...(guides.length ? [{ href: '/guides/', label: 'Guides' }] : [])
];

let assets = {};

function header(page) {
  const current = (href) => page.url === href || (href === '/guides/' && page.url.startsWith('/guides/'));
  const items = navItems.map((i) => `<li><a href="${i.href}"${current(i.href) ? ' aria-current="page"' : ''}>${esc(i.label)}</a></li>`).join('');
  const cta = quoteButton(page, 'btn btn-gold btn-sm', 'Free quote');
  return `<header class="site-header">
<div class="wrap header-inner">
<a class="brand" href="/">${svg.logo('logo')}<span class="brand-name">Front Door <span>Sites</span></span><span class="visually-hidden"> home</span></a>
<nav class="nav-desktop" aria-label="Main"><ul>${items}</ul>${cta}</nav>
<details class="menu">
<summary>${svg.icon('menu')}<span>Menu</span></summary>
<nav class="menu-panel" aria-label="Menu"><ul>${items}<li><a href="/start"${current('/start') ? ' aria-current="page"' : ''}>How it works</a></li></ul>${cta}</nav>
</details>
</div>
</header>`;
}

function footer() {
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
<div><h2>What I build</h2><ul><li><a href="/websites">Websites</a></li><li><a href="/business-tools">Business tools</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/examples">Examples</a></li></ul>
<h2 class="footer-sub">Industries</h2><ul>${niches.map((n) => `<li><a href="/${n.id}">${esc(n.name)}</a></li>`).join('')}</ul></div>
<div><h2>More</h2><ul><li><a href="/start">How it works</a></li><li><a href="/faq">FAQ</a></li>${guides.length ? '<li><a href="/guides/">Guides</a></li>' : ''}<li><a href="/privacy">Privacy</a></li><li><a href="/terms">Terms</a></li></ul></div>
</div>
<div class="wrap footer-base"><p>© ${year} ${esc(site.name)} · ${esc(site.domain)}</p><p>No cookies. No tracking.</p></div>
</footer>`;
}

function mobileBar(page) {
  const parts = [];
  if (contact.wa) parts.push(`<a class="btn btn-navy" href="${esc(waGeneral())}">${svg.whatsapp()}WhatsApp</a>`);
  if (canEnquire) parts.push(`<a class="btn btn-gold" href="${enquiryHref(page)}">Free quote</a>`);
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
    priceRange: `From ${rand(websitesFrom)}`.replace(/\u00a0/g, ' '),
    currenciesAccepted: 'ZAR',
    knowsAbout: ['Website design', 'Business software', 'Web apps', 'Booking systems', 'Guesthouse websites', 'Salon websites', 'Restaurant websites', 'Google Business Profile'],
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Websites and business tools',
      itemListElement: bands.map((b) => {
        const offer = { '@type': 'Offer', name: `${groups[b.group].name}: ${b.name}`, description: fill(b.scope), url: `${site.url}/pricing#band-${b.id}` };
        if (hasPrice(b)) offer.priceSpecification = { '@type': 'PriceSpecification', minPrice: Number(b.from), priceCurrency: 'ZAR' };
        return offer;
      })
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
<meta property="og:image:alt" content="Front Door Sites: websites and business tools for South African businesses">
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

function splitHero(cls, eyebrow, h1, lead, after, visual) {
  return `<section class="hero ${cls}">
<div class="wrap hero-grid">
<div class="hero-text">
<p class="eyebrow">${eyebrow}</p>
<h1>${t(h1)}</h1>
${after.anchor || ''}
<p class="lead">${t(lead)}</p>
${after.cta || ''}
${after.extra || ''}
</div>
<div class="hero-visual">${visual}</div>
</div>
</section>`;
}

function iconGrid(items, cls = 'includes') {
  return `<ul class="${cls}">${items.map((i) => `<li><span class="inc-icon">${svg.icon(i.icon)}</span><div><h3>${t(i.title)}</h3><p>${t(i.text)}</p></div></li>`).join('')}</ul>`;
}

function priceTeaser() {
  const col = (title, href, rows) => `<div class="pt-col"><h3><a href="${href}">${esc(title)}</a></h3><ul>${rows}</ul></div>`;
  const bandRows = (group) => bands.filter((b) => b.group === group).map((b) => `<li><span>${esc(b.name)}</span><span>${hasPrice(b) ? `from <strong>${rand(b.from)}</strong>` : 'Quoted'}</span></li>`).join('');
  const careRows = carePlans.map((p) => `<li><span>${esc(p.name)}</span><span><strong>${rand(p.monthly)}</strong>/month</span></li>`).join('');
  return `<div class="price-teaser">${col(groups.websites.name, '/websites', bandRows('websites'))}${col(groups.tools.name, '/business-tools', bandRows('tools'))}${col(C.care.heading, '/pricing#care', careRows)}</div>`;
}

function homePage() {
  const H = C.home;
  const page = { url: '/', out: 'index.html', hasForm: true, jsonLd: true, title: H.seo.title, description: H.seo.description, bodyClass: 'page-home' };
  const S = H.services;
  const serviceCards = S.cards.map((c) => {
    const from = c.group === 'tools' ? toolsFrom : websitesFrom;
    return `<article class="niche-card service-card">
<div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(c.address)}</span></div>
<div class="niche-card-body">
<span class="niche-icon">${svg.icon(c.icon)}</span>
<h3><a class="stretched" href="${groups[c.group].page}">${t(c.title)}</a></h3>
<p>${t(c.text)}</p>
<p class="niche-price">From <strong>${rand(from)}</strong></p>
<span class="niche-more" aria-hidden="true">${t(c.more)} ${svg.icon('arrow')}</span>
</div>
</article>`;
  }).join('');
  const canBuild = `<ul class="can-build">${H.canBuild.items.map((i) => `<li><span class="inc-icon">${svg.icon(i.icon)}</span><span class="cb-text">${t(i.text)}</span>${kindTag(i.kind)}</li>`).join('')}</ul>`;
  const I = H.industries;
  const industryCards = niches.map((n) => `<article class="niche-card">
<div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(n.card.address)}</span></div>
<div class="niche-card-body">
<span class="niche-icon">${nicheIcon(n)}</span>
<h3><a class="stretched" href="/${n.id}">${t(n.name)}</a></h3>
<p>${t(n.card.text)}</p>
<span class="niche-more" aria-hidden="true">See ideas ${svg.icon('arrow')}</span>
</div>
</article>`).join('') + (canEnquire ? `<article class="niche-card niche-card-other">
<div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">yourbusiness.co.za</span></div>
<div class="niche-card-body">
<span class="niche-icon">${svg.icon('chat')}</span>
<h3><a class="stretched" href="#enquiry">${t(I.other.title)}</a></h3>
<p>${t(I.other.text)}</p>
<span class="niche-more" aria-hidden="true">${t(I.other.more)} ${svg.icon('arrow')}</span>
</div>
</article>` : '');
  const about = contact.firstName
    ? `<section class="section about" aria-labelledby="about-h"><div class="wrap narrow about-inner">${svg.logo('logo about-logo')}<div>${sectionHead('about', H.about.heading)}<p>${t(H.about.text)}${contact.area ? ` ${t(H.about.areaText)}` : ''}</p></div></div></section>`
    : '';
  const st = H.steps;
  page.body = `${splitHero('hero-home', t(H.hero.eyebrow), H.hero.h1, H.hero.lead, {
    anchor: `<p class="price-anchor">${H.hero.priceAnchor.split(' · ').map((part) => `<span>${t(part)}</span>`).join('<span class="sep" aria-hidden="true">·</span>')}</p>`,
    cta: ctaRow(page, [{ href: '/pricing', label: 'See prices' }]),
    extra: `<ul class="hero-points">${H.hero.points.map((p) => `<li>${svg.icon('check')}<span>${t(p)}</span></li>`).join('')}</ul>`
  }, svg.hero())}
<section class="section section-tight-top" aria-labelledby="services-h"><div class="wrap">${sectionHead('services', S.heading, S.lead)}<div class="niche-cards service-cards">${serviceCards}</div></div></section>
<section class="section" aria-labelledby="build-h"><div class="wrap">${sectionHead('build', H.canBuild.heading, H.canBuild.lead)}${canBuild}</div></section>
${stepsSection('how', st.heading, `${st.lead}${tokens.quoteTime && st.quoteTimeText ? ` ${st.quoteTimeText}` : ''}`, st.items)}
<section class="section" aria-labelledby="prices-h"><div class="wrap">${sectionHead('prices', H.pricingTeaser.heading, H.pricingTeaser.lead)}${priceTeaser()}<p class="more-link"><a href="/pricing">See full pricing and what’s included ${svg.icon('arrow')}</a></p></div></section>
<section class="section section-sand" aria-labelledby="ind-h"><div class="wrap">${sectionHead('ind', I.heading, I.lead)}<div class="niche-cards industry-cards">${industryCards}</div></div></section>
${foundingOn ? `<div class="section section-tight-top"><div class="wrap">${foundingBanner(page)}</div></div>` : ''}
${examplesBlock(examples, H.examplesHeading)}
${about}
<section class="section section-sand" aria-labelledby="faqt-h"><div class="wrap narrow">${sectionHead('faqt', H.faqTeaser.heading)}${faqList(generalFaq(H.faqTeaser.ids))}<p class="more-link"><a href="/faq">All questions and answers ${svg.icon('arrow')}</a></p></div></section>
${enquirySection(page, { heading: H.cta.heading, lead: H.cta.lead })}`;
  return page;
}

function websitesPage() {
  const W = C.websitesPage;
  const page = { url: '/websites', out: 'websites.html', hasForm: true, title: W.seo.title, description: W.seo.description, bodyClass: 'page-websites' };
  // Sections alternate white and sand, so the FAQ's colour depends on whether examples show.
  const webExamples = examples.filter((e) => e.kind === 'website');
  page.body = `${splitHero('hero-niche', `${svg.icon('globe')}${t(W.hero.eyebrow)}`, W.hero.h1, W.hero.lead, {
    cta: ctaRow(page, [{ href: '#prices', label: 'See prices' }], 'Get a free mock-up'),
    extra: `<p class="hero-from">Websites from <strong>${rand(websitesFrom)}</strong>. Free mock-up first.</p>`
  }, svg.phone('websites'))}
<section class="section" aria-labelledby="inc-h"><div class="wrap two-col">
<div>${sectionHead('inc', W.includesHeading)}${ticks(C.websiteIncludes)}</div>
<div class="card points-card"><h3>${t(W.mockupCard.heading)}</h3><p>${t(W.mockupCard.text)}</p>${canEnquire ? `<p>${quoteButton(page, 'btn btn-gold', 'Get a free mock-up')}</p>` : ''}</div>
</div></section>
<section class="section section-sand" id="prices" aria-labelledby="wb-h"><div class="wrap">${sectionHead('wb', W.bandsHeading, W.bandsLead)}${foundingBanner(page, { compact: true })}${bandsGrid('websites', page)}<p class="fine"><a href="/pricing">How quotes and payment work</a></p></div></section>
${stepsSection('wsteps', W.steps.heading, '', W.steps.items, false)}
${careSection(page, { lead: W.careLead, sand: true })}
${examplesBlock(webExamples, 'Website examples')}
${faqSection(page, 'Questions about websites', generalFaq(['cost', 'time', 'own', 'need-care', 'small-edit', 'phones']), 'websites', webExamples.length > 0)}
${enquirySection(page, { need: 'website', heading: 'Get a free mock-up', lead: 'Tell me about your business and I’ll build a free sample of your website, with a fixed quote. No obligation, no calls.' })}`;
  return page;
}

function toolsPage() {
  const P = C.toolsPage;
  const page = { url: '/business-tools', out: 'business-tools.html', hasForm: true, title: P.seo.title, description: P.seo.description, bodyClass: 'page-tools' };
  const toolExamples = examples.filter((e) => e.kind === 'tool');
  page.body = `${splitHero('hero-niche', `${svg.icon('grid')}${t(P.hero.eyebrow)}`, P.hero.h1, P.hero.lead, {
    cta: ctaRow(page, [{ href: '#prices', label: 'See prices' }], 'Get a free plan & quote'),
    extra: `<p class="hero-from">Business tools from <strong>${rand(toolsFrom)}</strong>. Free plan first.</p>`
  }, svg.app())}
<section class="section" aria-labelledby="tl-h"><div class="wrap">${sectionHead('tl', P.listHeading)}${iconGrid(P.list)}
<p class="big-callout">${t(P.callout)}</p></div></section>
${stepsSection('tsteps', P.steps.heading, '', P.steps.items)}
<section class="section" aria-labelledby="tp-h"><div class="wrap"><h2 id="tp-h" class="visually-hidden">Good to know</h2><ul class="point-cards">${P.points.map((p) => `<li class="card"><span class="inc-icon">${svg.icon(p.icon)}</span><h3>${t(p.title)}</h3><p>${t(p.text)}</p></li>`).join('')}</ul></div></section>
<section class="section section-sand" id="prices" aria-labelledby="tb-h"><div class="wrap">${sectionHead('tb', P.bandsHeading, P.bandsLead)}${foundingBanner(page, { compact: true })}${bandsGrid('tools', page)}<p class="fine"><a href="/pricing">How quotes and payment work</a></p></div></section>
${careSection(page, { lead: P.careLead, highlight: 'care-plus' })}
${examplesBlock(toolExamples, 'Tool examples', true)}
${faqSection(page, 'Questions about business tools', generalFaq(['tool-what', 'plan', 'cost', 'other-costs', 'own', 'time']), 'tools', !toolExamples.length)}
${enquirySection(page, { need: 'tool', heading: 'Get a free plan & quote', lead: 'Tell me how things work now and what you’d like to fix. I’ll send a short plan and a fixed quote. No obligation, no calls.' })}`;
  return page;
}

function nichePage(n) {
  const page = { url: `/${n.id}`, out: `${n.id}.html`, hasForm: true, title: n.seo.title, description: n.seo.description, bodyClass: `page-${n.id}` };
  const A = n.argument;
  const nicheExamples = examples.filter((e) => e.niche === n.id);
  const ideas = `<ul class="ideas">${n.ideas.map((i) => {
    const b = i.band ? bandById[i.band] : null;
    if (i.band && !b) warn(`${n.id}: idea "${i.title}" uses unknown band "${i.band}"`);
    const price = b ? (hasPrice(b) ? `From <strong>${rand(b.from)}</strong> · ${esc(b.name)}` : `Quoted · ${esc(b.name)}`) : (isSet(i.note) ? t(i.note) : '');
    return `<li class="idea">${kindTag(i.kind)}<h3>${t(i.title)}</h3><p>${t(i.text)}</p>${price ? `<p class="idea-price">${price}</p>` : ''}</li>`;
  }).join('')}</ul>`;
  page.body = `${splitHero('hero-niche', `${nicheIcon(n)}${t(n.hero.eyebrow)}`, n.hero.h1, n.hero.lead, {
    cta: ctaRow(page, [{ href: '#ideas', label: 'See ideas and prices' }]),
    extra: `<p class="hero-from">Websites from <strong>${rand(websitesFrom)}</strong> · Business tools from <strong>${rand(toolsFrom)}</strong></p>`
  }, svg.phone(n.id))}
<section class="section" aria-labelledby="why-h">
<div class="wrap two-col">
<div class="prose-block">${sectionHead('why', A.heading)}${A.paragraphs.map((p) => `<p>${t(p)}</p>`).join('')}</div>
<div class="card points-card"><h3>What your website can do</h3>${ticks(A.points)}</div>
</div>
</section>
${n.openStatus ? openStatusSection(n) : ''}
${calculatorSection(n)}
<section class="section" id="ideas" aria-labelledby="ideas-h"><div class="wrap">${sectionHead('ideas', 'What I can build for you', `Ideas for ${n.name.toLowerCase().replace('b&bs', 'B&Bs')}, with starting prices.`)}${ideas}<p class="more-link"><a href="/pricing">See all prices ${svg.icon('arrow')}</a></p></div></section>
${examplesBlock(nicheExamples, `${n.name}: examples`, true)}
${faqSection(page, `Questions from ${n.singular} owners`, n.faq.concat(generalFaq(['cost', 'own', 'time'])), undefined, !nicheExamples.length)}
${enquirySection(page, { businessType: n.businessType, heading: `Get a free quote for your ${n.singular}`, lead: C.enquiry.lead })}`;
  return page;
}

function pricingPage() {
  const P = C.pricing;
  const page = { url: '/pricing', out: 'pricing.html', title: P.seo.title, description: P.seo.description };
  const group = (key, extra = '') => `<section class="price-group" id="${key}-prices" aria-labelledby="${key}-prices-h">
<div class="price-group-head"><span class="niche-icon">${svg.icon(GROUP_ICON[key])}</span><h2 id="${key}-prices-h">${esc(groups[key].name)}</h2><a href="${groups[key].page}">More about ${esc(groups[key].name.toLowerCase())} ${svg.icon('arrow')}</a></div>
${bandsGrid(key, page)}${extra}
</section>`;
  const S = P.smallEdit;
  page.body = `${pageHero(P.h1, P.lead)}
<div class="section section-tight"><div class="wrap">
${foundingBanner(page, { compact: true })}
${group('websites', `<div class="card includes-card"><h3>Every website includes</h3>${ticks(C.websiteIncludes, 'ticks ticks-2col')}</div>`)}
${group('tools')}
</div></div>
${careSection(page, { sand: true })}
<section class="section" aria-labelledby="terms-h"><div class="wrap two-col">
<div>${sectionHead('terms', 'How quotes and payment work')}${ticks(P.terms)}<p><a href="/terms">Read the full terms</a></p></div>
<div class="stack">
<div class="card"><h2 class="h3">${t(P.factorsHeading)}</h2>${ticks(P.factors)}</div>
<div class="card" id="small-edits"><h2 class="h3">${t(S.heading)}</h2><p>${t(S.lead)}</p>${ticks(S.examples)}<p>${t(S.notIncluded)}</p><p class="callout">${svg.icon('calendar')}<span>${t(S.timing)}</span></p></div>
</div>
</div></section>
<section class="section section-sand" aria-labelledby="next-h"><div class="wrap narrow center">${sectionHead('next', 'Want an exact price?', 'Tell me what you need, and I’ll send a fixed quote with a free mock-up or plan.')}${ctaRow(page, [{ href: '/start', label: 'How it works' }])}</div></section>`;
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
${niches.map((n) => `<section class="section section-tight" aria-labelledby="faq-${n.id}-h"><div class="wrap narrow"><h2 id="faq-${n.id}-h" class="with-icon"><span class="niche-icon">${nicheIcon(n)}</span>${t(n.name)}</h2>${faqList(n.faq)}<p class="more-link"><a href="/${n.id}">Ideas for ${esc(n.name.toLowerCase().replace('b&bs', 'B&Bs'))} ${svg.icon('arrow')}</a></p></div></section>`).join('')}
${contactBtns || canEnquire ? `<section class="section section-sand" aria-labelledby="ask-h"><div class="wrap narrow center">${sectionHead('ask', 'Still have a question?', 'Ask me directly. No calls needed, and voice notes are welcome.')}<div class="cta-row cta-center">${contactBtns}${quoteButton(page, 'btn btn-gold btn-lg')}</div></div></section>` : ''}`;
  return page;
}

function examplesPage() {
  const E = C.examplesPage;
  const page = { url: '/examples', out: 'examples.html', title: E.seo.title, description: E.seo.description };
  const both = examples.some((e) => e.kind === 'website') && examples.some((e) => e.kind === 'tool');
  const legend = '<ul class="legend"><li><span class="tag tag-demo">Demo</span> A made-up business, built to show what’s possible.</li><li><span class="tag tag-client">Client</span> A real business’s work, shown with permission.</li></ul>';
  const filter = both ? '<div class="filter" role="group" aria-label="Show" data-filter hidden><button type="button" aria-pressed="true" data-show="all">All</button><button type="button" aria-pressed="false" data-show="website">Websites</button><button type="button" aria-pressed="false" data-show="tool">Tools</button></div>' : '';
  const list = examples.length
    ? `<div class="examples" data-examples>${examples.map(exampleCard).join('')}</div>`
    : `<div class="empty card">${svg.stepDoor(2)}<p>${t(E.empty)}</p>${ctaRow(page)}</div>`;
  page.body = `${pageHero(E.h1, E.lead)}
<section class="section section-tight"><div class="wrap">${examples.length ? legend : ''}${filter}${list}</div></section>
${examples.length && canEnquire ? `<section class="section section-sand"><div class="wrap narrow center">${sectionHead('see', 'Want to see yours?', 'Get a free mock-up of your website, or a free plan for your tool.')}${ctaRow(page)}</div></section>` : ''}`;
  return page;
}

function startPage() {
  const S = C.startPage;
  const page = { url: '/start', out: 'start.html', title: S.seo.title, description: S.seo.description };
  const ask = [
    contact.wa ? `<a class="btn btn-navy" href="${esc(waLink(`Hi {firstName}, I would like to start a care plan. Please send me ${payfastOn ? 'a payment link' : 'an invoice'}.`))}">${svg.whatsapp()}WhatsApp me</a>` : '',
    contact.email ? `<a class="btn btn-ghost" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent('Care plan')}">${svg.icon('mail')}Email me</a>` : ''
  ].filter(Boolean).join('');
  const payOptions = carePlans.flatMap((p) => [
    { url: p.payfastUrl, label: `${p.name} plan${yearlyOn ? ', monthly' : ''}`, price: month(p.monthly) },
    ...(yearlyOn ? [{ url: p.payfastYearlyUrl, label: `${p.name} plan, yearly`, price: `${rand(yearly(p.monthly))}/year` }] : [])
  ]);
  const withLinks = payOptions.filter((o) => o.url);
  const careStep = S.steps.find((s) => s.id === 'care') || {};
  const careBlock = withLinks.length
    ? `<div class="pay-buttons">${withLinks.map((o) => `<a class="btn btn-navy" href="${esc(o.url)}">${svg.icon('card')}<span>Start the ${esc(o.label)}<small>${o.price}</small></span></a>`).join('')}</div>${withLinks.length < payOptions.length && ask ? `<p>Can’t see the option you want? Message me and I’ll send you the link.</p><div class="cta-row">${ask}</div>` : ''}`
    : (ask ? `<p>${shown(careStep.noLinksText).map(t).join(' ')}</p><div class="cta-row">${ask}</div>` : '');
  const careList = `<ul class="time-list">${carePlans.map((p) => `<li><span>${esc(p.name)}</span><span>${month(p.monthly)}${yearlyOn ? ` <small>or ${rand(yearly(p.monthly))}/year</small>` : ''}</span></li>`).join('')}</ul><p><a href="/pricing#care">What each plan includes ${svg.icon('arrow')}</a></p>`;
  const items = S.steps.map((s, i) => {
    let extra = shown(s.extra).map((x) => `<p class="callout">${svg.icon('clock')}<span>${t(x)}</span></p>`).join('');
    if (s.id === 'tell' && canEnquire) extra += `<p>${quoteButton(page, 'btn btn-gold', 'Tell me what you need')}</p>`;
    if (s.id === 'care') extra += `${careList}${careBlock}`;
    return `<li class="start-step" id="step-${esc(s.id)}"><div class="start-num" aria-hidden="true">${i + 1}</div><div class="start-body"><h2>${t(s.title)}</h2><p>${t(s.text)}</p>${extra}</div></li>`;
  }).join('');
  const times = timedBands.length
    ? `<section class="section section-sand" aria-labelledby="times-h"><div class="wrap narrow">${sectionHead('times', S.timesHeading, S.timesNote)}<div class="table-wrap"><table class="times-table"><thead><tr><th scope="col">Job</th><th scope="col">Starts from</th><th scope="col">Typical build time</th></tr></thead><tbody>${timedBands.map((b) => `<tr><th scope="row">${esc(b.name)} <small>${esc(groups[b.group].name)}</small></th><td>${hasPrice(b) ? rand(b.from) : 'Quoted'}</td><td>${esc(typo(b.buildTime))}</td></tr>`).join('')}</tbody></table></div></div></section>`
    : '';
  page.body = `<section class="hero hero-simple"><div class="wrap narrow"><h1>${t(S.h1)}</h1><p class="lead">${t(S.lead)}</p></div></section>
${foundingOn ? `<div class="wrap narrow"><p class="founding-note">${svg.icon('check')}<span>${t(F.startNote)}</span></p></div>` : ''}
<section class="section section-tight"><div class="wrap narrow"><ol class="start-steps">${items}</ol></div></section>
${times}`;
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
  const links = [{ href: '/', label: 'Home' }, { href: '/websites', label: 'Websites' }, { href: '/business-tools', label: 'Business tools' }, { href: '/pricing', label: 'Pricing' }, { href: '/faq', label: 'Questions & answers' }];
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
${canEnquire ? `<section class="section section-sand"><div class="wrap narrow center">${sectionHead('next', 'Want this done for you?', 'Tell me what you need and get a free mock-up or plan, with a fixed quote. No obligation, no calls.')}${ctaRow(page)}</div></section>` : ''}`;
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
    websitesPage(),
    toolsPage(),
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
  return out
    .filter((p) => yearlyOn || !p.endsWith('.payfastYearly'))
    .map((p) => p.replace(/^carePlans\.(\d+)\.(payfast|payfastYearly)$/, (m, i, k) => `${k === 'payfastYearly' ? 'yearly ' : ''}payfast (${carePlans[i].name} plan, optional)`));
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
