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

/* ---------- prices: the website options, build bands and monthly plans ---------- */

const bandById = Object.fromEntries(bands.map((b) => [b.id, b]));
const hasPrice = (b) => b.from !== null && b.from !== undefined && b.from !== '' && Number(b.from) > 0;
const minFrom = (group) => Math.min(...bands.filter((b) => b.group === group && hasPrice(b)).map((b) => Number(b.from)));
const WEB = C.website;
const BG = C.bigger || {};
const camel = (id) => String(id).replace(/-(\w)/g, (m, c) => c.toUpperCase());

// A business website is bought one of three ways (Once-off, Build + Care, Build + Care Plus).
// An option with a monthly fee is a plan; the one without is once-off.
const options = (WEB.options || []).map((o, i) => {
  if (!(Number(o.build) > 0)) warn(`website.options: "${o.name}" needs a build price.`);
  return {
    ...o,
    build: Number(o.build),
    monthly: Number(o.monthly) > 0 ? Number(o.monthly) : 0,
    payfastUrl: link(`website.options.${i}.payfast`, `PayFast link for ${o.name}`),
    payfastYearlyUrl: link(`website.options.${i}.payfastYearly`, `Yearly PayFast link for ${o.name}`)
  };
});
const optionById = Object.fromEntries(options.map((o) => [o.id, o]));
const plans = options.filter((o) => o.monthly);
const onceOff = options.find((o) => !o.monthly);
if (!onceOff || !plans.length) warn('website.options needs one option without a monthly fee (once-off) and at least one with one.');
const cheapestPlan = plans.slice().sort((a, b) => a.build - b.build)[0];
const planName = (o) => o.plan || o.name;

const websitesFrom = Math.min(...options.map((o) => o.build), minFrom('websites'));
const toolsFrom = minFrom('tools');
// The business website and each band, for the "Typical build time" lists.
const timedJobs = [
  ...(isSet(WEB.buildTime) ? [{ name: WEB.name, group: 'websites', buildTime: WEB.buildTime, website: true }] : []),
  ...bands.filter((b) => isSet(b.buildTime))
];

// Plans are paid through PayFast once any plan link is filled in, and the once-off
// renewal once its link is. Until then, both are paid by EFT.
const plansPayfast = plans.some((o) => o.payfastUrl || o.payfastYearlyUrl);
const renewalPayfast = Boolean(onceOff && onceOff.payfastUrl);
Object.assign(effective, {
  'plans.payfastOn': plansPayfast ? 'on' : '',
  'plans.payByEft': plansPayfast ? '' : 'on',
  'renewal.payfastOn': renewalPayfast ? 'on' : '',
  'renewal.payByEft': renewalPayfast ? '' : 'on',
  'payfast.on': plansPayfast || renewalPayfast ? 'on' : ''
});
const careFrom = Math.min(...plans.map((o) => o.monthly));

const depositPct = Number(T.depositPercent) || 50;

// Yearly plans: pay for this many months and get 12. Blank, 0 or 12+ turns it off.
const yearlyMonths = Number(T.yearlyPaysMonths) || 0;
const yearlyOn = yearlyMonths > 0 && yearlyMonths < 12;
const yearly = (monthlyFee) => monthlyFee * yearlyMonths;
const yearlyFree = `${12 - yearlyMonths} month${12 - yearlyMonths === 1 ? '' : 's'}`;
effective['terms.yearlyPaysMonths'] = yearlyOn ? 'on' : '';

// Founding clients get their first month of a plan free. spotsLeft only switches the offer
// off at 0: it's never shown, so there's no countdown on the site.
const F = C.founding || {};
const foundingOn = F.enabled === true && Number(F.spotsLeft) > 0;

// One list of examples (examples.items): the Examples page, the home page strip, /websites,
// /business-tools and the industry pages all read from it.
const EXP = Array.isArray(C.examples) ? { items: C.examples } : (C.examples || {});
const examples = (EXP.items || []).filter((e) => {
  if (!isSet(e.title || e.name)) { warn('An example has no title, so it was skipped.'); return false; }
  return true;
}).map((e, i) => {
  // "kind": website | tool, "status": demo | client (older entries used kind for demo/client).
  const legacy = e.kind === 'demo' || e.kind === 'client';
  const title = e.title || e.name;
  return {
    ...e,
    id: isSet(e.id) ? e.id : `example-${i + 1}`,
    title,
    summary: e.summary || e.blurb || '',
    kind: e.kind === 'tool' ? 'tool' : 'website',
    status: (legacy ? e.kind : e.status) === 'client' ? 'client' : 'demo'
  };
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
  serviceArea: contact.area,
  replyHours: contact.hours,
  quoteTime: val('process.quoteTime'),
  paymentMethods: val('process.paymentMethods'),
  websitesFrom: rand(websitesFrom),
  toolsFrom: rand(toolsFrom),
  careFrom: month(careFrom),
  renewalFee: rand(T.renewalYearly),
  changeFee: rand(T.changeFee),
  minMonths: T.minimumTermMonths,
  graceDays: T.renewalGraceDays,
  deposit: `${depositPct}%`,
  balance: `${100 - depositPct}%`,
  quoteValidDays: T.quoteValidDays,
  noticeDays: T.noticeDays,
  editsDeadline: T.editsDeadline,
  editsLive: T.editsLive,
  suspendAfterDays: T.suspendAfterDays,
  yearlyPaysMonths: yearlyOn ? yearlyMonths : '',
  yearlyFree: yearlyOn ? yearlyFree : '',
  siteName: site.name,
  domain: site.domain,
  email: contact.email,
  whatsapp: contact.wa ? waDisplay(contact.wa) : '',
  legalName: val('legal.legalName'),
  registrationNumber: val('legal.registrationNumber'),
  noticeAddress: val('legal.noticeAddress'),
  lastUpdated: longDate(val('legal.lastUpdated') || new Date().toISOString().slice(0, 10))
};
for (const k of ['renewalYearly', 'changeFee', 'minimumTermMonths', 'renewalGraceDays']) {
  if (!(Number(T[k]) > 0)) warn(`terms.${k} should be a number above 0.`);
}

/* ---------- text helpers ---------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Fill {tokens}. A blank token is left out, with a warning.
function fill(s) {
  return String(s)
    .replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in tokens)) { warn(`Unknown {${k}} in: "${String(s).slice(0, 70)}"`); return m; }
      const v = tokens[k];
      if (v === '' || v === undefined || v === null) {
        warn(`{${k}} is blank but used in: "${String(s).slice(0, 70)}…"`);
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
// Like t(), with every rand amount in bold: "from R3 999" -> "from <strong>R3 999</strong>".
// A build and its monthly fee are one amount: <strong>R4 999 + R399/month</strong>.
const tMoney = (s) => t(s).replace(/R\d{1,3}(?: \d{3})*(?: \+ R\d{1,3}(?: \d{3})*\/month)?/g, '<strong>$&</strong>');

// Per option, e.g. {onceOffBuild}, {careMonthly}, {carePrice}, {carePlusChanges}, {careYearly}.
// {carePrice} is the build and the monthly fee together ("R4 999 + R399/month"), so a plan's
// price is never shown without its monthly fee. Filled after the other words, because an
// option's text can use them ({changeFee} per change).
for (const o of options) {
  const k = camel(o.id);
  tokens[`${k}Build`] = rand(o.build);
  tokens[`${k}Price`] = o.monthly ? `${rand(o.build)} +\u00a0${month(o.monthly)}` : rand(o.build);
  tokens[`${k}Changes`] = isSet(o.changes) ? fill(o.changes) : '';
  if (o.monthly) {
    tokens[`${k}Monthly`] = month(o.monthly);
    tokens[`${k}Yearly`] = yearlyOn ? rand(yearly(o.monthly)) : '';
  }
}

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
const waGeneral = () => waLink(C.contact.whatsappGreeting || 'Hi');

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
  return `<ul class="time-list">${timedJobs.filter((b) => !group || b.group === group).map((b) => `<li><span>${esc(b.name)}</span><span>${esc(typo(b.buildTime))}</span></li>`).join('')}</ul>`;
}

function faqAnswer(i, group) {
  const parts = shown(i.a);
  let html = parts.length ? `<p>${parts.map(t).join(' ')}</p>` : '';
  if (i.list) html += `<ul>${i.list.map((x) => `<li>${t(x)}</li>`).join('')}</ul>`;
  if (i.special === 'buildTimes' && timedJobs.some((b) => !group || b.group === group)) html += `<p>Typical build times, from when your deposit and content reach us:</p>${buildTimesList(group)}`;
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
${isSet(F.badge) ? `<p class="founding-badge">${t(F.badge).replace(/\*([^*]+)\*/g, '<strong>$1</strong>')}</p>` : ''}
<div class="founding-text"><h2 id="founding-h">${t(F.title)}</h2><p>${t(F.text)}</p></div>
${action}
</div></aside>`;
}

/* ---------- price cards ---------- */

// Bands are once-off "from" prices ("from R12 000 once-off"), or "Quoted".
function bandPrice(b) {
  return hasPrice(b)
    ? `<p class="plan-price"><span class="plan-from">from</span><span class="plan-amount">${rand(b.from)}</span>${isSet(BG.priceNote) ? `<span class="plan-per">${t(BG.priceNote)}</span>` : ''}</p>`
    : '<p class="plan-price"><span class="plan-amount plan-quoted">Quoted</span></p>';
}

const bandButton = (b, page) => quoteButton(page, 'btn btn-gold', hasPrice(b) ? 'Get a free quote' : 'Ask for a free plan');

function bandCard(b, page) {
  return `<article class="plan band" id="band-${esc(b.id)}">
<h3>${t(b.name)}</h3>
${bandPrice(b)}
<p class="plan-summary">${t(b.scope)}</p>
${isSet(b.buildTime) ? `<p class="band-time">${svg.icon('clock')}<span>Typical build: ${esc(typo(b.buildTime))}</span></p>` : ''}
${canEnquire ? `<div class="plan-actions">${bandButton(b, page)}</div>` : ''}
</article>`;
}

// One band across the full width, e.g. Bookings / online shop under the website options.
function bandWide(b, page) {
  return `<article class="plan band band-wide" id="band-${esc(b.id)}">
<div><h3>${t(b.name)}</h3><p class="plan-summary">${t(b.scope)}</p>
${isSet(b.buildTime) ? `<p class="band-time">${svg.icon('clock')}<span>Typical build: ${esc(typo(b.buildTime))}</span></p>` : ''}</div>
<div class="band-wide-side">${bandPrice(b)}${canEnquire ? bandButton(b, page) : ''}</div>
</article>`;
}

function bandsGrid(group, page) {
  return `<div class="plans plans-3">${bands.filter((b) => b.group === group).map((b) => bandCard(b, page)).join('')}</div>`;
}

// In a plan's rows, "free" ("5 free changes a month") gets the same green pill as "2 months free".
const freePill = (html) => html.replace(/\bfree\b/i, '<span class="plan-free">$&</span>');

// A row on an option card: blank shows a dash, "Yes" a tick.
function optionValue(v) {
  const s = isSet(v) ? fill(v).trim() : '';
  if (!s) return '<span class="none" aria-hidden="true">–</span><span class="visually-hidden">None</span>';
  if (/^yes$/i.test(s)) return `<span class="yes">${svg.icon('check')}<span>${esc(s)}</span></span>`;
  return freePill(esc(typo(s)));
}

// An option's price: the build and, on a plan, the monthly fee right beside it in the same
// type (under it on narrow cards), so the fee never looks optional. Then the minimum term (or "No monthly fee") and the founding note.
// The home page's cards and the full cards on /websites and /pricing both use it.
function optionPrice(o, yearlyLine = false) {
  const amount = `<p class="plan-price"><span class="plan-amount">${rand(o.build)}</span>${o.monthly ? `<span class="plan-monthly">+&nbsp;${month(o.monthly)}</span>` : ''}</p>`;
  const term = o.monthly ? (isSet(WEB.planTerm) ? `<p class="option-term">${t(WEB.planTerm)}</p>` : '') : `<p class="option-term">${t(WEB.noMonthly)}</p>`;
  const year = yearlyLine && yearlyOn && o.monthly ? `<p class="plan-yearly">or pay <strong>${rand(yearly(o.monthly))}</strong> once a year <span class="plan-save">${yearlyFree} free</span></p>` : '';
  const founding = foundingOn && o.monthly && isSet(F.cardNote) ? `<p class="option-note">${t(F.cardNote)}</p>` : '';
  return `<p class="option-label">${t(WEB.priceLabel)}</p>${amount}${term}${year}${founding}`;
}

function optionCard(o, page) {
  const featured = o.featured === true;
  const rows = (WEB.rows || []).map((r) => `<div><dt>${t(r.label)}</dt><dd>${optionValue(o[r.key])}</dd></div>`).join('');
  return `<article class="plan option${featured ? ' plan-featured' : ''}" id="option-${esc(o.id)}">
${featured && isSet(WEB.badge) ? `<p class="option-badge">${t(WEB.badge)}</p>` : ''}
<header class="option-head"><h3>${t(o.name)}</h3><p class="plan-summary">${t(o.summary)}</p></header>
<div class="option-price">${optionPrice(o, true)}</div>
<dl class="option-rows">${rows}</dl>
<div class="plan-actions">${quoteButton(page, featured ? 'btn btn-gold' : 'btn btn-ghost')}</div>
</article>`;
}

// The three ways to buy a website, side by side (stacked on phones).
function optionsGrid(page) {
  return `<div class="plans options">${options.map((o) => optionCard(o, page)).join('')}</div>`;
}

// On wide screens each card's rows line up with its neighbours' (CSS subgrid). The spans
// depend on how many rows there are, so this part of the CSS is written here.
function optionsCss() {
  const n = (WEB.rows || []).length;
  return `@media (min-width:1000px){@supports (grid-template-rows:subgrid){.options>.option{display:grid;grid-template-rows:subgrid;grid-row:span ${n + 3}}.option-rows{display:grid;grid-template-rows:subgrid;grid-row:span ${n}}}}`;
}

// "Websites from R7 500 once-off · or pay less upfront: R4 999 + R399/month", one part per line,
// with the amounts in bold.
function priceAnchor(s, cls = '') {
  return `<p class="price-anchor${cls}">${s.split(' · ').map((part) => `<span><span>${tMoney(part)}</span></span>`).join('<span class="sep" aria-hidden="true">·</span>')}</p>`;
}

// The steps of a project, each with its little door: closed, ajar, open, then open and done.
const stepItems = (items) => items.map((s, i) => `<li class="step"><div class="step-art">${svg.stepDoor(Math.min(i + 1, 4))}</div><p class="step-num">Step ${i + 1}</p><h3>${t(s.title)}</h3><p>${t(s.text)}</p></li>`).join('');

function stepsSection(id, heading, lead, items, sand = true) {
  return `<section class="section${sand ? ' section-sand' : ''}" aria-labelledby="${id}-h"><div class="wrap">${sectionHead(id, heading, lead)}<ol class="steps steps-${items.length}" data-steps>${stepItems(items)}</ol></div></section>`;
}

// The numbered plaque and label above a home page chapter's heading.
function kicker(n, label) {
  return `<p class="kicker"><span class="kicker-num" aria-hidden="true">${n}</span><span>${t(label)}</span></p>`;
}

// Industry ideas with their starting prices (industry pages and the home page).
// "band" is a band id or a website option id ("once-off": the business website's once-off price).
function ideaPrice(n, i) {
  if (!i.band) return isSet(i.note) ? t(i.note) : '';
  const o = optionById[i.band];
  if (o) return `From <strong>${rand(o.build)}</strong>${o.monthly ? ` + ${month(o.monthly)}` : ` ${t(BG.priceNote)}`} · ${esc(WEB.name)}`;
  const b = bandById[i.band];
  if (!b) { warn(`${n.id}: idea "${i.title}" uses unknown band "${i.band}"`); return ''; }
  return hasPrice(b) ? `From <strong>${rand(b.from)}</strong> ${t(BG.priceNote)} · ${esc(b.name)}` : `Quoted · ${esc(b.name)}`;
}

function ideasList(n, tag = 'h3') {
  return `<ul class="ideas">${n.ideas.map((i) => {
    const price = ideaPrice(n, i);
    return `<li class="idea">${kindTag(i.kind)}<${tag} class="idea-h">${t(i.title)}</${tag}><p>${t(i.text)}</p>${price ? `<p class="idea-price">${price}</p>` : ''}</li>`;
  }).join('')}</ul>`;
}

const nicheLower = (n) => n.name.toLowerCase().replace('b&bs', 'B&Bs');

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
  if (!fs.existsSync(file)) { warn(`Example "${e.title}": image not found at src/${rel}`); return ''; }
  if (!/\.webp$/i.test(rel)) { warn(`Example "${e.title}": use a .webp image for speed (src/${rel})`); return ''; }
  const size = webpSize(file);
  if (!size) { warn(`Example "${e.title}": couldn't read the WebP image size (src/${rel})`); return ''; }
  return `<img src="/${esc(rel)}" width="${size.w}" height="${size.h}" loading="lazy" decoding="async" alt="${esc(e.alt || `Screenshot of ${e.title}`)}">`;
}

// An example's "from" price. priceKey is "website" (the business website), "tools" (business
// tools in general), a band id or a website option id. A tool whose key matches nothing gets
// the general business tools price.
function examplePrice(e) {
  const k = e.priceKey;
  const site = () => `From <strong>${rand(cheapestPlan.build)}</strong> with ${esc(planName(cheapestPlan))}, or <strong>${rand(onceOff.build)}</strong> ${t(BG.priceNote)}`;
  const tools = () => `From <strong>${rand(toolsFrom)}</strong> ${t(BG.priceNote)} · ${esc(groups.tools.name)}`;
  if (k === 'website') return site();
  if (k === 'tools') return tools();
  const b = bandById[k];
  if (b) return hasPrice(b) ? `From <strong>${rand(b.from)}</strong> ${t(BG.priceNote)} · ${esc(b.name)}` : `Quoted · ${esc(b.name)}`;
  const o = optionById[k];
  if (o) return `From <strong>${rand(o.build)}</strong>${o.monthly ? ` + ${month(o.monthly)}` : ` ${t(BG.priceNote)}`} · ${esc(WEB.name)}`;
  if (isSet(k)) warn(`Example "${e.title}": priceKey "${k}" isn't "website", "tools", a band or a website option, so it shows the ${e.kind === 'tool' ? 'business tools' : 'website'} price.`);
  return e.kind === 'tool' ? tools() : site();
}

// Where a card leads: a demo to its section on /examples, client work to the client's site.
const exampleAnchor = (e) => (e.id === (EXP.website || {}).item ? 'website' : e.id);
function exampleHref(e) {
  if (e.status === 'client') return isSet(e.url) && isUrl(e.url) ? e.url : '';
  return `/examples#${exampleAnchor(e)}`;
}

function exampleCard(e) {
  const niche = niches.find((n) => n.id === e.niche);
  const isDemo = e.status !== 'client';
  const href = exampleHref(e);
  if (!isDemo && isSet(e.url) && !href) warn(`Example "${e.title}": a client's url must start with https://`);
  const img = exampleImage(e);
  const icon = e.icon ? svg.icon(e.icon, 'icon icon-xl') : niche ? nicheIcon(niche, 'icon icon-xl') : svg.icon(e.kind === 'tool' ? 'grid' : 'globe', 'icon icon-xl');
  const shot = img || `<div class="example-placeholder" aria-hidden="true">${icon}</div>`;
  const external = href && !href.startsWith('/');
  const name = href ? `<a class="stretched" href="${esc(href)}"${external ? ext : ''}>${t(e.title)}${external ? newTab : ''}</a>` : t(e.title);
  return `<article class="example" data-kind="${e.kind}">
<div class="example-shot"><div class="browser-bar" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(isSet(e.business) ? e.business : e.title)}</span></div>${shot}</div>
<div class="example-body">
<p class="tags">${kindTag(e.kind)}<span class="tag ${isDemo ? 'tag-demo' : 'tag-client'}">${isDemo ? 'Demo' : 'Client'}</span></p>
<h3>${name}</h3>
${isSet(e.summary) ? `<p>${t(e.summary)}</p>` : ''}
<p class="example-price">${examplePrice(e)}</p>
${isDemo ? '<p class="example-note">A made-up business, built to show what’s possible.</p>' : ''}
${href && isDemo ? `<span class="example-more" aria-hidden="true">Try it ${svg.icon('arrow')}</span>` : ''}
</div></article>`;
}

function examplesBlock(list, heading, sand = false, max = 3) {
  if (!list.length) return '';
  const cards = list.slice(0, max);
  return `<section class="section${sand ? ' section-sand' : ''}" aria-labelledby="ex-h"><div class="wrap">${sectionHead('ex', heading)}<div class="examples examples-n${cards.length}">${cards.map(exampleCard).join('')}</div><p class="more-link"><a href="/examples">See all examples ${svg.icon('arrow')}</a></p></div></section>`;
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
    `${svg.icon('check')}<span>A fixed quote before we start</span>`,
    `${svg.icon('check')}<span>You own it once it’s paid for</span>`
  ].map((x) => `<li>${x}</li>`).join('');
  return `<section class="section section-navy mockup" id="enquiry" aria-labelledby="enquiry-h">
<div class="wrap mockup-grid">
<div class="mockup-intro">
<h2 id="enquiry-h">${t(opts.heading || E.heading)}</h2>
<p class="lead">${t(opts.lead || E.lead)}</p>
<ul class="mockup-points">${intro}</ul>
${contact.hours ? `<p class="mockup-hours">${svg.icon('clock')}<span>We reply ${t(contact.hours)}</span></p>` : ''}
${tokens.quoteTime ? `<p class="mockup-hours">${svg.icon('calendar')}<span>${t(free[1] + ' usually within {quoteTime}')}</span></p>` : ''}
</div>
<form class="mockup-form" data-enquiry data-wa="${esc(contact.wa)}" data-email="${esc(contact.email)}" novalidate>
<fieldset class="field plan-toggle need-toggle"><legend>What do you need?</legend>${needs}</fieldset>
<div class="field"><label for="ef-business">Business name</label><input id="ef-business" name="business" type="text" autocomplete="organization" required></div>
<div class="field"><label for="ef-type">Type of business</label><input id="ef-type" name="type" type="text" value="${esc(opts.businessType || '')}" placeholder="e.g. plumber, farm stall, accountant" required></div>
<div class="field"><label for="ef-town">Town</label><input id="ef-town" name="town" type="text" autocomplete="address-level2" required></div>
<div class="field"><label for="ef-details">Tell us what you need</label><textarea id="ef-details" name="details" rows="4" maxlength="${max}" placeholder="${esc(typo(E.detailsPlaceholder))}" aria-describedby="ef-details-count" required></textarea><p class="char-count" id="ef-details-count">Up to ${max} characters</p></div>
<div class="field" data-hide-for="tool"><label for="ef-link">Link to your Google Maps, Facebook, Instagram or current website <span class="optional">(optional)</span></label><input id="ef-link" name="link" type="text" inputmode="url" autocomplete="url" placeholder="e.g. facebook.com/yourbusiness"></div>
<div class="field-row">
<div class="field"><label for="ef-budget">Rough budget <span class="optional">(optional)</span></label><select id="ef-budget" name="budget"><option value="">Choose one</option>${options(E.budgets)}</select></div>
<div class="field"><label for="ef-timing">When do you need it? <span class="optional">(optional)</span></label><select id="ef-timing" name="timing"><option value="">Choose one</option>${options(E.timings)}</select></div>
</div>
<div class="field"><label for="ef-name">Your name</label><input id="ef-name" name="name" type="text" autocomplete="name" required></div>
<fieldset class="field choices"><legend>How should we reply?</legend>
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

// The build prices a calculator compares: a website option (by its once-off price) or a band.
function calcBuilds(n) {
  return (n.calculator.builds || []).map((x) => {
    const o = optionById[x.id];
    const b = bandById[x.id];
    const price = o ? o.build : b && hasPrice(b) ? Number(b.from) : 0;
    if (!price) warn(`${n.id}: calculator build "${x.id}" isn't a website option or a band with a price.`);
    return { label: x.label || (o ? WEB.name : b ? b.name : x.id), price };
  }).filter((x) => x.price > 0);
}

// Two or more builds get a toggle. With one, the price sits on the calculator itself.
function buildToggle(list) {
  if (list.length < 2) return '';
  return `<fieldset class="plan-toggle"><legend>Your website</legend>${list.map((b, i) => `<label><input type="radio" name="build" value="${b.price}" data-band-name="${esc(b.label)}"${i === 0 ? ' checked' : ''}><span><b>${esc(b.label)}</b> from ${rand(b.price)}</span></label>`).join('')}</fieldset>`;
}

function calculatorSection(n) {
  const c = n.calculator;
  const d = c.defaults;
  const builds = calcBuilds(n);
  const first = builds[0];
  const care = optionById[c.carePlan] || plans[0];
  const careName = esc(planName(care));
  const bandLabel = `${esc(first.label)} (${rand(first.price)})`;
  const priceNote = `Uses the ${t(BG.priceNote)} starting price of a <span data-out="bandLabel">${bandLabel}</span> and the ${careName} fee of ${month(care.monthly)}, so your own quote may differ.`;
  const careLine = (r, one, many) => `On the ${careName} plan, <strong data-out="care">${plural(r.care, one, many)}</strong> a month <span data-out="careVerb">${r.care === 1 ? 'covers' : 'cover'}</span> the fee.`;
  let fields;
  let result;
  if (c.type === 'commission') {
    const r = calc.commission({ rate: d.rate, nights: d.nights, percent: d.percent, build: first.price, care: care.monthly });
    fields = `<div class="field"><label for="calc-rate">Your nightly rate</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-rate" name="rate" type="text" inputmode="decimal" autocomplete="off" value="${d.rate}"></div></div>
<div class="field"><label for="calc-nights">Nights booked through booking sites each month</label><input id="calc-nights" name="nights" type="text" inputmode="numeric" autocomplete="off" value="${d.nights}"></div>
<div class="field"><p class="label-row"><label for="calc-percent">Commission they charge:</label> <output for="calc-percent" data-out="percent">${d.percent}%</output></p><input id="calc-percent" name="percent" type="range" min="${d.percentMin}" max="${d.percentMax}" step="1" value="${d.percent}"><div class="range-ends" aria-hidden="true"><span>${d.percentMin}%</span><span>${d.percentMax}%</span></div></div>`;
    result = `<div data-ok>
<p class="calc-line">You pay about <strong data-out="paid">${rand(calc.about(r.paid))}</strong> a month (<span data-out="perYear">${rand(calc.about(r.perYear))}</span> a year) in commission.</p>
<p class="calc-line calc-main">About <strong data-out="payback">${plural(r.payback, 'direct night', 'direct nights')}</strong> <span data-out="paybackVerb">${r.payback === 1 ? 'pays' : 'pay'}</span> for the website ${t(BG.priceNote)}. ${careLine(r, 'direct night', 'direct nights')}</p>
<p class="calc-small">Each direct night saves about <span data-out="perNight">${rand(r.perNight)}</span> in commission. ${priceNote}</p>
</div>
<p data-err hidden>Enter your nightly rate and nights booked to see your numbers.</p>`;
  } else {
    const r = calc.payback({ price: d.price, build: first.price, care: care.monthly });
    fields = `<div class="field"><label for="calc-price">${t(c.inputLabel)}</label><div class="rand-input"><span aria-hidden="true">R</span><input id="calc-price" name="price" type="text" inputmode="decimal" autocomplete="off" value="${d.price}"></div></div>`;
    result = `<div data-ok>
<p class="calc-line calc-main">About <strong data-out="payback">${plural(r.payback, c.unit, c.units)}</strong> <span data-out="paybackVerb">${r.payback === 1 ? 'pays' : 'pay'}</span> for the website ${t(BG.priceNote)}. ${careLine(r, c.unit, c.units)}</p>
<p class="calc-small">Based on takings, not profit. ${priceNote}</p>
</div>
<p data-err hidden>Enter an amount to see your numbers.</p>`;
  }
  return `<section class="section section-sand" id="calculator" aria-labelledby="calc-h">
<div class="wrap calc-grid">
<div class="calc-intro">${sectionHead('calc', c.heading, c.intro)}</div>
<div class="calc card" role="group" aria-labelledby="calc-h" data-calc="${esc(c.type)}" data-build="${first.price}" data-build-name="${esc(first.label)}" data-care="${care.monthly}" data-unit="${esc(c.unit || '')}" data-units="${esc(c.units || '')}">
${buildToggle(builds)}
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
<div><h2>What we build</h2><ul><li><a href="/websites">Websites</a></li><li><a href="/business-tools">Business tools</a></li><li><a href="/pricing">Pricing</a></li><li><a href="/examples">Examples</a></li></ul>
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
      itemListElement: [
        // The website options: a build price, plus a monthly plan or (once-off) a yearly renewal.
        ...options.map((o) => {
          const build = { '@type': 'PriceSpecification', name: 'Build', minPrice: o.build, priceCurrency: 'ZAR' };
          const after = o.monthly
            ? { '@type': 'UnitPriceSpecification', name: `${planName(o)} plan`, price: o.monthly, priceCurrency: 'ZAR', unitCode: 'MON', unitText: 'month' }
            : { '@type': 'UnitPriceSpecification', name: 'Hosting and domain renewal, from the second year', price: Number(T.renewalYearly), priceCurrency: 'ZAR', unitCode: 'ANN', unitText: 'year' };
          const term = o.monthly ? ` ${T.minimumTermMonths}-month minimum term.` : '';
          return { '@type': 'Offer', name: `${WEB.name}: ${o.name}`, description: `${fill(o.summary)}${term}`, url: `${site.url}/pricing#option-${o.id}`, priceSpecification: [build, after] };
        }),
        ...bands.map((b) => {
          const offer = { '@type': 'Offer', name: `${groups[b.group].name}: ${b.name}`, description: fill(b.scope), url: `${site.url}/pricing#band-${b.id}` };
          if (hasPrice(b)) offer.priceSpecification = { '@type': 'PriceSpecification', name: 'Once-off build', minPrice: Number(b.from), priceCurrency: 'ZAR' };
          return offer;
        })
      ]
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

/* ---------- home: the front door, then a guided tour in five chapters ---------- */

// "Open the door to *more customers*": words between stars are highlighted.
const tHl = (s) => t(s).replace(/\*([^*]+)\*/g, '<span class="hl">$1</span>');
// Plain text of an HTML fragment, for the screen-reader copy of the calculator's sums.
const strip = (html) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// The front door. Scrolling opens it (site.js): the things inside come out, then you go
// through the doorway into the tour. Without JavaScript, or with reduced motion, it stays ajar.
function doorHero(page) {
  const D = C.home.hero;
  const pops = (D.inside || []).slice(0, 6).map((p, i) => `<li class="pop pop-${i + 1}">${svg.icon(p.icon)}<span>${t(p.label)}</span></li>`).join('');
  const leaf = '<div class="door-hole"><div class="door-inside"></div><div class="door-hinge"><div class="door-leaf"><i class="dp dp-1"></i><i class="dp dp-2"></i><i class="dp dp-3"></i><i class="dp dp-4"></i><i class="door-slot"></i><i class="door-handle"></i></div></div></div>';
  return `<section class="door-hero" data-door aria-labelledby="hero-h">
<div class="door-stage">
<div class="wrap door-grid">
<div class="door-copy">
<p class="eyebrow">${t(D.eyebrow)}</p>
<h1 id="hero-h">${tHl(D.h1)}</h1>
<p class="lead">${t(D.lead)}</p>
${priceAnchor(D.priceAnchor)}
${ctaRow(page, [{ href: '#tour', label: `${t(D.tourButton)}${svg.icon('down')}` }])}
<ul class="hero-points">${D.points.map((p) => `<li>${svg.icon('check')}<span>${t(p)}</span></li>`).join('')}</ul>
</div>
<div class="door-visual">
<div class="door-scene">
<p class="door-bubble"><span class="visually-hidden">${t(D.bubble)}</span><span aria-hidden="true" data-type>${t(D.bubble)}</span></p>
<div class="door-zoom" aria-hidden="true">${svg.doorBack(D)}${leaf}${svg.doorFront()}<ul class="door-pops">${pops}</ul></div>
</div>
</div>
</div>
<p class="door-cue" aria-hidden="true"><span>${t(D.cue)}</span>${svg.icon('chevron')}</p>
<div class="door-flood" aria-hidden="true"></div>
</div>
</section>`;
}

// Fixed to the top once you're through the door: the chapter you're in, and a progress line.
function storyBar(chapters) {
  const items = chapters.map((c, i) => `<li><a href="#${c.id}" data-story-link><span class="sb-num" aria-hidden="true">${i + 1}</span><span>${t(c.short || c.kicker)}</span></a></li>`).join('');
  return `<nav class="storybar" aria-label="Tour of this page" data-storybar>
<div class="wrap storybar-inner">
<p class="storybar-now" aria-hidden="true"><span class="sb-num" data-sb-num>1</span><span class="sb-label" data-sb-label>${t(chapters[0].short || chapters[0].kicker)}</span><span class="sb-of">of ${chapters.length}</span></p>
<ol class="storybar-list">${items}</ol>
</div>
<span class="storybar-line" aria-hidden="true"></span>
</nav>`;
}

function tourSection(chapters) {
  const T = C.home.tour;
  const D = C.home.hero;
  const items = chapters.map((c, i) => `<li><a href="#${c.id}"><span class="tour-num" aria-hidden="true">${i + 1}</span><span class="tour-label">${t(c.kicker)}</span>${svg.icon('arrow')}</a></li>`).join('');
  return `<section class="section tour" id="tour" aria-labelledby="tour-h"><div class="wrap">
<div class="tour-head center"><p class="kicker kicker-plain">${t(T.kicker)}</p>${sectionHead('tour', T.heading, T.lead)}</div>
<div class="tour-extra"><ul class="hero-points">${D.points.map((p) => `<li>${svg.icon('check')}<span>${t(p)}</span></li>`).join('')}</ul></div>
<ol class="tour-list">${items}</ol>
</div></section>`;
}

// A scene: a part of the home page that plays as you scroll. site.js makes its track tall,
// sticks the stage to the screen and sets --p on the section from 0 to 1 as you scroll
// through. Without JavaScript, with reduced motion, or on a screen too small for the stage,
// it shows its finished state instead. after: anything under the stage; it scrolls as usual.
function scene(name, cls, attrs, stage, after = '') {
  return `<section class="section scene ${name}${cls ? ` ${cls}` : ''}" ${attrs} data-scene="${name}">
<div class="scene-track" data-track><div class="scene-stage" data-stage>${stage}</div></div>${after}
</section>`;
}

// 1. Why, part 1: a customer's search, step by step, on a phone that follows along (site.js).
function whySection(ch) {
  const W = C.home.why;
  const P = W.phone;
  const ph = (s) => esc(typo(s));
  const icon = svg.icon(P.icon || 'globe');
  const bar = (live) => `<p class="ps-bar">${svg.icon('search')}<span${live ? ' data-query' : ''}>${ph(P.query)}</span></p>`;
  const screens = `<div class="ps ps-search">${bar(true)}<p class="ps-tabs"><span>All</span><span>Maps</span><span>Images</span><span>News</span></p><div class="ps-skel"><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
<div class="ps ps-results">${bar(false)}<div class="ps-map"><i></i><i></i><i class="you"></i></div><ol class="ps-list">${P.results.map((r) => `<li${r.you ? ' class="is-you"' : ''}><b>${ph(r.name)}</b><span>${ph(r.meta)}</span>${r.tag ? `<em>${ph(r.tag)}</em>` : ''}</li>`).join('')}</ol></div>
<div class="ps ps-site"><p class="ps-site-top"><b>${ph(P.siteName)}</b><i></i></p><div class="ps-site-hero">${icon}<span>${ph(P.siteTagline)}</span></div><p class="ps-site-h">${ph(P.pricesHeading)}</p><ul class="ps-prices">${P.prices.map(([a, b]) => `<li><span>${ph(a)}</span><b>${ph(b)}</b></li>`).join('')}</ul><p class="ps-btn">${ph(P.button)}</p><p class="ps-gallery"><i></i><i></i><i></i></p><span class="ps-wa">${svg.whatsapp()}</span></div>
<div class="ps ps-chat"><p class="ps-chat-top"><span class="ps-avatar">${icon}</span><b>${ph(P.siteName)}</b></p><div class="ps-msgs">${P.messages.map((m, i) => `<p class="ps-msg ${i % 2 ? 'ps-in' : 'ps-out'}">${ph(m)}</p>`).join('')}<p class="ps-done">${svg.icon('check')}<span>${ph(P.notice)}</span></p></div></div>`;
  const steps = W.steps.map((s, i) => `<li class="journey-step"><div class="journey-card"><span class="journey-num" aria-hidden="true">${i + 1}</span><div><h3>${t(s.title)}</h3><p>${t(s.text)}</p></div></div></li>`).join('');
  return `<section class="section section-sand chapter" id="${ch.id}" aria-labelledby="why-h"><div class="wrap">
<div class="chapter-head">${kicker(ch.n, ch.kicker)}${sectionHead('why', W.heading, W.lead)}</div>
<div class="journey" data-journey>
<div class="journey-phone" aria-hidden="true"><div class="phone"><div class="phone-screen">${screens}</div></div></div>
<ol class="journey-steps">${steps}</ol>
</div>
<p class="punch">${t(W.punch)}</p>
</div></section>`;
}

// 1. Why, part 2: without and with a website. A dark, closed shop lights up as you scroll and
// the rows turn over one at a time (site.js). Without that, the shop is lit and each row shows
// both sides.
function lightsSection(page) {
  const L = C.home.lights;
  const rows = L.rows.map((r) => `<li class="flip-row"><span class="flip-a">${svg.icon('x')}<span><span class="visually-hidden">${t(L.without)}: </span>${t(r.without)}</span></span><span class="flip-b">${svg.icon('check')}<span><span class="visually-hidden">${t(L.with)}: </span>${t(r.with)}</span></span></li>`).join('');
  const wa = contact.wa ? [{ href: esc(waGeneral()), label: `${svg.whatsapp()}WhatsApp us`, cls: 'btn-light' }] : [];
  const stage = `<div class="wrap lights-grid">
<div class="lights-head">${sectionHead('lights', L.heading, L.lead)}<p class="scene-hint" aria-hidden="true">${t(L.hint)}${svg.icon('down')}</p></div>
<div class="shop">${svg.shop({ sign: fill(L.sign), closed: fill(L.closed), open: fill(L.open), address: fill(C.home.hero.address) })}</div>
<div class="lights-rows"><p class="flip-heads" aria-hidden="true"><span class="flip-a">${t(L.without)}</span><span class="flip-b">${t(L.with)}</span></p><ul class="flip-rows">${rows}</ul></div>
</div>`;
  const cta = ctaRow(page, wa);
  return scene('lights', 'section-night', 'aria-labelledby="lights-h"', stage, cta ? `<div class="wrap center scene-after">${cta}</div>` : '');
}

// 2. What you get, part 1: the two things we build. A website builds itself on screen (the
// salon from chapter 1), then a business tool beside it (site.js). Without that, both show
// finished. Each "mk-p" is a piece that flies into place.
function buildSection(ch) {
  const B = C.home.build;
  const P = C.home.why.phone;
  const Q = B.tool || {};
  const ph = (s) => esc(typo(s));
  const card = (group) => B.cards.find((c) => c.group === group) || warn(`home.build.cards needs a "${group}" card.`) && {};
  const web = card('websites');
  const tool = card('tools');
  const bar = (address) => `<p class="mk-bar"><span class="dots"><i></i><i></i><i></i></span><span class="mk-url mk-p">${svg.icon('lock')}<span>${esc(address || '')}</span></span></p>`;
  const site = `<div class="mock mock-site" aria-hidden="true">${bar(web.address)}<div class="mk-page">
<p class="mk-nav mk-p"><span class="mk-logo">${svg.icon(P.icon || 'globe')}</span><b>${ph(P.siteName)}</b><i class="mk-burger"></i></p>
<div class="mk-hero mk-p">${svg.icon(P.icon || 'globe')}<span>${ph(P.siteTagline)}</span></div>
<p class="mk-h mk-p">${ph(P.pricesHeading)}</p>
<ul class="mk-prices">${P.prices.map(([a, b]) => `<li class="mk-p"><span>${ph(a)}</span><b>${ph(b)}</b></li>`).join('')}</ul>
<p class="mk-gallery"><i class="mk-p"></i><i class="mk-p"></i><i class="mk-p"></i></p>
<p class="mk-btn mk-p">${ph(P.button)}</p>
<span class="mk-wa mk-p">${svg.whatsapp()}</span>
</div></div>`;
  let total = 0;
  const lines = (Q.lines || []).map(([label, amount]) => {
    total += Number(amount) || 0;
    return `<li class="mk-p"><span>${ph(label)}</span><b>${rand(Number(amount) || 0)}</b></li>`;
  }).join('');
  const app = `<div class="mock mock-tool" aria-hidden="true">${bar(tool.address)}<div class="mk-app">
<div class="mk-side mk-p"><span class="mk-logo">${svg.icon('form')}</span><i></i><i></i><i></i></div>
<div class="mk-main">
<p class="mk-title mk-p"><b>${ph(Q.title)}</b><span>${ph(Q.number)}</span></p>
<ul class="mk-lines">${lines}</ul>
<p class="mk-total mk-p"><span>${ph(Q.totalLabel)}</span><b data-total="${total}">${rand(total)}</b></p>
<p class="mk-send mk-p">${svg.whatsapp()}<span>${ph(Q.button)}</span></p>
</div>
<p class="mk-sent mk-p">${svg.icon('check')}<span>${ph(Q.sent)}</span></p>
</div></div>`;
  const caption = (c) => `<div class="build-caption">
<h3><span class="build-icon">${svg.icon(c.icon)}</span>${t(c.title)}</h3>
<p>${t(c.text)}</p>
${isSet(c.price) ? `<p class="niche-price">${tMoney(c.price)}</p>` : ''}
<p class="more-link"><a href="${groups[c.group].page}">${t(c.more)} ${svg.icon('arrow')}</a></p>
</div>`;
  const stage = `<div class="wrap build-grid">
<div class="chapter-head">${kicker(ch.n, ch.kicker)}${sectionHead('get', B.heading, B.lead)}</div>
<div class="build-items">
<article class="build-item build-site">${site}${caption(web)}</article>
<article class="build-item build-tool">${app}${caption(tool)}</article>
</div>
</div>`;
  return scene('build', 'chapter', `id="${ch.id}" aria-labelledby="get-h"`, stage);
}

// 2. What you get, between the two scenes: demos you can try (a row you swipe on phones) and
// the ideas for each kind of business.
function demosSection() {
  const I = C.home.industries;
  const shownEx = examples.slice(0, 3);
  const demos = shownEx.length
    ? `${sectionHead('ex', C.home.examplesHeading)}<div class="examples examples-n${shownEx.length} examples-swipe">${shownEx.map(exampleCard).join('')}</div><p class="more-link"><a href="/examples">See all examples ${svg.icon('arrow')}</a></p>`
    : '';
  const chips = niches.map((n) => `<li><a href="/${n.id}">${nicheIcon(n)}<span>${esc(n.name)}</span>${svg.icon('arrow')}</a></li>`).join('');
  const other = canEnquire ? `<p class="chooser-other">${svg.icon('chat')}<span><strong>${t(I.other.title)}?</strong> ${t(I.other.text)} <a href="#enquiry">${t(I.other.more)}</a></span></p>` : '';
  return `<section class="section demos" aria-labelledby="${demos ? 'ex-h' : 'ideas-h'}"><div class="wrap">
${demos}
<div class="ideas-strip"><${demos ? 'h3' : 'h2'} id="ideas-h">${t(I.heading)}</${demos ? 'h3' : 'h2'}><p>${t(I.lead)}</p><ul class="idea-chips">${chips}</ul>${other}</div>
</div></section>`;
}

// 2. What you get, part 2: what a website does for you, over one day. As you scroll, the clock
// runs from morning to night, the sky darkens and the shop closes, but the website keeps
// working (site.js). Without that, the moments show as a list.
function allDaySection() {
  const A = C.home.allDay;
  const mins = (s) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim());
    return m && Number(m[1]) < 24 && Number(m[2]) < 60 ? Number(m[1]) * 60 + Number(m[2]) : null;
  };
  const items = (A.items || []).filter((i) => {
    if (mins(i.time) !== null) return true;
    warn(`home.allDay: "${i.time}" isn't a time like 07:30, so "${i.title}" is left out.`);
    return false;
  });
  if (!items.length) return '';
  const closes = mins(A.closes);
  const moments = items.map((i) => `<li class="moment"><p class="moment-time"><span class="moment-icon">${svg.icon(i.icon)}</span><time>${esc(i.time)}</time></p><h3>${t(i.title)}</h3><p>${t(i.text)}</p></li>`).join('');
  const toasts = items.map((i) => `<li class="toast"><span class="toast-icon">${svg.icon(i.icon)}</span><span>${t(i.event)}</span></li>`).join('');
  const stage = `<div class="sky" aria-hidden="true"><i class="sky-dusk"></i><i class="sky-night"></i><i class="sky-stars"></i></div>
<div class="wrap allday-grid">
<div class="allday-head">${sectionHead('allday', A.heading, A.lead)}</div>
<div class="clock-card" aria-hidden="true">
<div class="clock"><div class="sky-wheel"><i class="sun"></i><i class="moon"></i></div>${svg.clockFace()}</div>
<p class="clock-time" data-day-clock>${esc(items[items.length - 1].time)}</p>
<p class="clock-signs"><span class="sign sign-shop"><span>${t(A.shop)}</span><b class="sign-open">${t(A.open)}</b><b class="sign-closed">${t(A.closed)}</b></span><span class="sign sign-web"><span>${t(A.website)}</span><b class="sign-open">${t(A.open)}</b></span></p>
<ul class="toasts">${toasts}</ul>
</div>
<ol class="moments">${moments}</ol>
</div>`;
  return scene('allday', '', `aria-labelledby="allday-h" data-times="${items.map((i) => mins(i.time)).join(' ')}"${closes === null ? '' : ` data-closes="${closes}"`}`, stage);
}

// 3. What it could earn: two sliders, the sums and a 12-month chart. site.js redraws the
// chart with the same geometry (read from the data- attributes), and grows it as you scroll in.
function earnChart(r, build) {
  const n = 12, w = 360, top = 34, bottom = 150, gap = 6;
  const bw = (w - gap * (n + 1)) / n;
  const max = Math.max(build * 1.25, r.monthly * n);
  const y = (v) => bottom - (Math.min(v, max) / max) * (bottom - top);
  const bars = Array.from({ length: n }, (_, i) => {
    const v = r.monthly * (i + 1);
    const x = gap + i * (bw + gap);
    return `<rect class="bar${v >= build ? ' is-paid' : ''}" x="${x.toFixed(1)}" y="${y(v).toFixed(1)}" width="${bw.toFixed(1)}" height="${(bottom - y(v)).toFixed(1)}" rx="4"/>`;
  }).join('');
  const nums = Array.from({ length: n }, (_, i) => `<text x="${(gap + i * (bw + gap) + bw / 2).toFixed(1)}" y="${bottom + 17}" text-anchor="middle">${i + 1}</text>`).join('');
  const m = Math.min(r.months, n);
  const fx = gap + (m - 1) * (bw + gap) + bw / 2;
  return `<svg class="earn-chart" viewBox="0 0 ${w} ${bottom + 24}" aria-hidden="true" focusable="false" data-chart data-top="${top}" data-bottom="${bottom}" data-gap="${gap}">
<g class="bars">${bars}</g><g class="bar-nums">${nums}</g>
<line class="cost-line" x1="0" x2="${w}" y1="${y(build).toFixed(1)}" y2="${y(build).toFixed(1)}"/>
<g class="pay-flag${r.months > n ? ' is-off' : ''}" transform="translate(${fx.toFixed(1)} ${y(r.monthly * m).toFixed(1)})"><path class="flag-pole" d="M0-5v-24"/><path class="flag-cloth" d="M0-29h17l-4 5.5 4 5.5H0z"/></g>
</svg>`;
}

function earnSection(ch) {
  const E = C.home.earn;
  const d = E.defaults || {};
  const o = optionById[E.build] || onceOff;
  const care = optionById[E.carePlan] || plans[0];
  const min = Number(d.spendMin) || 50;
  const max = Number(d.spendMax) || 5000;
  const pos = calc.spendPos(Number(d.spend) || 400, min, max);
  const spend = calc.spendAt(pos, min, max);
  const cmax = Number(d.customersMax) || 30;
  const customers = Math.min(cmax, Math.max(1, Number(d.customers) || 4));
  const r = calc.earnings({ spend, customers, build: o.build, care: care.monthly });
  const what = o.monthly ? `${esc(o.name)} build` : `${esc(o.name.toLowerCase())} website`;
  const careName = esc(planName(care));
  const sums = `<p class="earn-big"><strong data-out="monthly">${rand(r.monthly)}</strong> <span>a month in new takings.</span></p>
<p class="earn-year">That’s <strong data-out="yearly">${rand(r.yearly)}</strong> a year.</p>
<ul class="earn-facts">
<li>${svg.icon('check')}<span>A ${what} (${rand(o.build)}) pays for itself after <strong data-out="payback">${plural(r.payback, 'customer', 'customers')}</strong>, in about <strong data-out="months">${plural(r.months, 'month', 'months')}</strong>.</span></li>
<li>${svg.icon('check')}<span>On ${careName}, <strong data-out="care">${plural(r.care, 'customer', 'customers')}</strong> a month <span data-out="careVerb">${r.care === 1 ? 'covers' : 'cover'}</span> the ${month(care.monthly)} fee.</span></li>
</ul>`;
  const stage = `<div class="wrap earn-grid">
<div class="chapter-head">${kicker(ch.n, ch.kicker)}${sectionHead('earn', E.heading, E.lead)}</div>
<div class="earn" data-earn data-build="${o.build}" data-care="${care.monthly}">
<div class="earn-inputs">
<div class="field"><p class="label-row"><label for="earn-spend">${t(E.spendLabel)}</label> <output for="earn-spend" data-out="spend">${rand(spend)}</output></p><input class="range" id="earn-spend" name="spend" type="range" min="0" max="100" step="1" value="${pos}" data-min="${min}" data-max="${max}" aria-valuetext="${esc(rand(spend))}"><div class="range-ends" aria-hidden="true"><span>${rand(min)}</span><span>${rand(max)}</span></div></div>
<div class="field"><p class="label-row"><label for="earn-customers">${t(E.customersLabel)}</label> <output for="earn-customers" data-out="customers">${customers}</output></p><input class="range" id="earn-customers" name="customers" type="range" min="1" max="${cmax}" step="1" value="${customers}"><div class="range-ends" aria-hidden="true"><span>1</span><span>${cmax}</span></div></div>
</div>
<div class="earn-result"><div class="earn-sums" aria-hidden="true" data-sums>${sums}</div><p class="visually-hidden" aria-live="polite" data-sums-sr>${esc(strip(sums))}</p></div>
<figure class="earn-figure"><p class="earn-legend" aria-hidden="true"><span><i class="lg-line"></i>Your website (${rand(o.build)})</span><span><i class="lg-bar"></i>Takings so far</span><span><i class="lg-paid"></i>Paid for itself</span></p>${earnChart(r, o.build)}<figcaption>Your takings over 12 months, against the cost of the website.</figcaption></figure>
<p class="calc-small">${t(E.note)} Uses the ${esc(o.name.toLowerCase())} price of ${rand(o.build)} and the ${careName} fee of ${month(care.monthly)}, so your own quote may differ.</p>
</div>
</div>`;
  return scene('earnings', 'section-navy earn-section chapter', `id="${ch.id}" aria-labelledby="earn-h"`, stage);
}

// 4. What it costs: the three ways to buy a website, and "which suits me?" (site.js; hidden
// without JavaScript). On phones the cards come in one at a time as you scroll; on wide screens
// they're dealt out side by side. Then bigger jobs, the founding offer and a link to all prices.
function miniOption(o) {
  const featured = o.featured === true;
  const rows = (WEB.rows || []).filter((r) => ['hosting', 'changes', 'term'].includes(r.key) && isSet(o[r.key]))
    .map((r) => `<li><span>${t(r.label)}</span><b>${freePill(t(o[r.key]))}</b></li>`).join('');
  const ch = C.home.costs.chooser || {};
  return `<article class="mini${featured ? ' mini-featured' : ''}" data-mini="${esc(o.id)}">
${featured && isSet(WEB.badge) ? `<p class="option-badge">${t(WEB.badge)}</p>` : ''}${isSet(ch.badge) ? `<p class="mini-fit" aria-hidden="true">${svg.icon('check')}${t(ch.badge)}</p>` : ''}
<h3>${t(o.name)}</h3>
${optionPrice(o)}
<p class="plan-summary">${t(o.summary)}</p>
<ul class="mini-rows">${rows}</ul>
<a class="mini-link" href="/pricing#option-${esc(o.id)}">What’s included<span class="visually-hidden"> in ${t(o.name)}</span> ${svg.icon('arrow')}</a>
</article>`;
}

function costSection(page, ch) {
  const K = C.home.costs;
  const q = K.chooser;
  const answers = q && q.answers ? q.answers.filter((a) => optionById[a.option] || warn(`home.costs.chooser: no website option "${a.option}"`) && false) : [];
  const fit = answers.length ? `<div class="fit" data-fit hidden>
<p class="fit-q" id="fit-q">${t(q.question)}</p>
<div class="fit-answers" role="group" aria-labelledby="fit-q">${answers.map((a) => `<button type="button" class="fit-btn" aria-pressed="false" data-option="${esc(a.option)}" data-text="${esc(typo(fill(a.text)))}">${t(a.label)}</button>`).join('')}</div>
<p class="fit-result" aria-live="polite" data-fit-result></p>
</div>` : '';
  const bandList = bands.map((b) => `<li><span>${esc(b.name)}</span> <span>${hasPrice(b) ? `from <strong>${rand(b.from)}</strong>` : 'Quoted'}</span></li>`).join('');
  const stage = `<div class="wrap cost-grid">
<div class="scene-head cost-head"><div class="chapter-head">${kicker(ch.n, ch.kicker)}${sectionHead('cost', K.heading, K.lead)}</div>${fit}</div>
<div class="minis" data-minis>${options.map(miniOption).join('')}</div>
<p class="deck-dots" aria-hidden="true">${options.map(() => '<i></i>').join('')}</p>
</div>`;
  const after = `<div class="wrap scene-after cost-after">
<p class="fine">${t(K.note)}</p>
<div class="bigger-line"><h3><a class="tap-area" href="/pricing#tools-prices">${t(BG.heading)}</a></h3><ul class="band-pills">${bandList}</ul><p class="pt-note">${t(BG.intro)} ${t(BG.lead)}</p></div>
${foundingBanner(page)}
<p class="more-link"><a href="/pricing">${t(K.more)} ${svg.icon('arrow')}</a></p>
</div>`;
  return scene('cost', 'chapter', `id="${ch.id}" aria-labelledby="cost-h"`, stage, after);
}

// 5. How it works. As you scroll, a big front door opens a little more with each step, with
// the step's number on it, then light pours out onto the enquiry form below (site.js).
// Without that, the four steps show side by side with their small doors.
function howSection(ch) {
  const S = C.home.steps;
  const lead = `${S.lead}${tokens.quoteTime && S.quoteTimeText ? ` ${S.quoteTimeText}` : ''}`;
  const plate = S.items.map((_, i) => `<b>${i + 1}</b>`).join('');
  const door = `<div class="bigdoor" aria-hidden="true">
<div class="bd-frame"><div class="bd-fan"></div><div class="bd-hole"><div class="bd-inside"><p class="bd-open">${t(S.open)}</p></div><div class="bd-hinge"><div class="bd-leaf"><i class="dp dp-1"></i><i class="dp dp-2"></i><i class="dp dp-3"></i><i class="dp dp-4"></i><span class="bd-plate">${plate}</span><i class="door-handle"></i></div></div></div></div>
<div class="bd-step"></div><div class="bd-spill"></div>
</div>`;
  const stage = `<div class="wrap how-grid">
<div class="chapter-head">${kicker(ch.n, ch.kicker)}${sectionHead('how', S.heading, lead)}</div>
${door}
<ol class="steps steps-${S.items.length} how-steps">${stepItems(S.items)}</ol>
<p class="how-rail" aria-hidden="true">${S.items.map(() => '<i></i>').join('')}</p>
</div>
<div class="how-flood" aria-hidden="true"></div>`;
  return scene('how', 'section-sand chapter', `id="${ch.id}" aria-labelledby="how-h"`, stage);
}

function homePage() {
  const H = C.home;
  const page = { url: '/', out: 'index.html', hasForm: true, jsonLd: true, title: H.seo.title, description: H.seo.description, bodyClass: 'page-home' };
  const chapters = ['why', 'get', 'earn', 'cost', 'how'].map((id, i) => {
    const c = (H.chapters || {})[id] || {};
    if (!isSet(c.kicker)) warn(`home.chapters.${id} needs a kicker (the chapter's name in the tour).`);
    return { id, n: i + 1, kicker: c.kicker || id, short: c.short };
  });
  const ch = Object.fromEntries(chapters.map((c) => [c.id, c]));
  const about = H.about
    ? `<section class="section about" aria-labelledby="about-h"><div class="wrap narrow about-inner">${svg.logo('logo about-logo')}<div>${sectionHead('about', H.about.heading)}<p>${t(H.about.text)}${contact.area ? ` ${t(H.about.areaText)}` : ''}</p></div></div></section>`
    : '';
  page.body = `${storyBar(chapters)}
${doorHero(page)}
${tourSection(chapters)}
${whySection(ch.why)}
${lightsSection(page)}
${buildSection(ch.get)}
${demosSection()}
${allDaySection()}
${earnSection(ch.earn)}
${costSection(page, ch.cost)}
${howSection(ch.how)}
${enquirySection(page, { heading: H.cta.heading, lead: H.cta.lead })}
${about}
<section class="section section-sand" aria-labelledby="faqt-h"><div class="wrap narrow">${sectionHead('faqt', H.faqTeaser.heading)}${faqList(generalFaq(H.faqTeaser.ids))}<p class="more-link"><a href="/faq">All questions and answers ${svg.icon('arrow')}</a></p></div></section>`;
  return page;
}

function websitesPage() {
  const W = C.websitesPage;
  const page = { url: '/websites', out: 'websites.html', hasForm: true, title: W.seo.title, description: W.seo.description, bodyClass: 'page-websites' };
  // Sections alternate white and sand, so the FAQ's colour depends on whether examples show.
  const webExamples = examples.filter((e) => e.kind === 'website');
  const bigger = bands.filter((b) => b.group === 'websites');
  page.body = `${splitHero('hero-niche', `${svg.icon('globe')}${t(W.hero.eyebrow)}`, W.hero.h1, W.hero.lead, {
    cta: ctaRow(page, [{ href: '#prices', label: 'See prices' }], 'Get a free mock-up'),
    extra: `<p class="hero-from">${tMoney(W.hero.from)}</p>`
  }, svg.phone('websites'))}
<section class="section" aria-labelledby="inc-h"><div class="wrap two-col">
<div>${sectionHead('inc', W.includesHeading)}${ticks(C.websiteIncludes)}</div>
<div class="card points-card"><h3>${t(W.mockupCard.heading)}</h3><p>${t(W.mockupCard.text)}</p>${canEnquire ? `<p>${quoteButton(page, 'btn btn-gold', 'Get a free mock-up')}</p>` : ''}</div>
</div></section>
<section class="section section-sand" id="prices" aria-labelledby="wb-h"><div class="wrap">${sectionHead('wb', WEB.heading, WEB.lead)}${foundingBanner(page, { compact: true })}${optionsGrid(page)}
${bigger.length ? `<div class="bigger-web"><h3>${t(W.biggerHeading)}</h3>${bigger.map((b) => bandWide(b, page)).join('')}<p class="fine">${t(BG.lead)}</p></div>` : ''}
<p class="fine"><a class="tap-area" href="/pricing">How quotes and payment work</a></p></div></section>
${stepsSection('wsteps', W.steps.heading, '', W.steps.items, false)}
${examplesBlock(webExamples, 'Website examples', true)}
${faqSection(page, 'Questions about websites', generalFaq(['cost', 'need-plan', 'plan-cheaper', 'cancel-plan', 'hosting', 'email', 'changes', 'own', 'time']), 'websites', !webExamples.length)}
${enquirySection(page, { need: 'website', heading: 'Get a free mock-up', lead: 'Tell us about your business and we’ll build a free sample of your website, with a fixed quote. No obligation, no calls.' })}`;
  return page;
}

function toolsPage() {
  const P = C.toolsPage;
  const page = { url: '/business-tools', out: 'business-tools.html', hasForm: true, title: P.seo.title, description: P.seo.description, bodyClass: 'page-tools' };
  const toolExamples = examples.filter((e) => e.kind === 'tool');
  page.body = `${splitHero('hero-niche', `${svg.icon('grid')}${t(P.hero.eyebrow)}`, P.hero.h1, P.hero.lead, {
    cta: ctaRow(page, [{ href: '#prices', label: 'See prices' }], 'Get a free plan & quote'),
    extra: `<p class="hero-from">${tMoney(P.hero.from)}</p>`
  }, svg.app())}
<section class="section" aria-labelledby="tl-h"><div class="wrap">${sectionHead('tl', P.listHeading)}${iconGrid(P.list)}
<p class="big-callout">${t(P.callout)}</p></div></section>
${stepsSection('tsteps', P.steps.heading, '', P.steps.items)}
<section class="section" aria-labelledby="tp-h"><div class="wrap"><h2 id="tp-h" class="visually-hidden">Good to know</h2><ul class="point-cards">${P.points.map((p) => `<li class="card"><span class="inc-icon">${svg.icon(p.icon)}</span><h3>${t(p.title)}</h3><p>${t(p.text)}</p></li>`).join('')}</ul></div></section>
<section class="section section-sand" id="prices" aria-labelledby="tb-h"><div class="wrap">${sectionHead('tb', P.bandsHeading, P.bandsLead)}${foundingBanner(page, { compact: true })}${bandsGrid('tools', page)}<p class="fine">${t(BG.lead)} ${t(BG.toolsHosting)}</p><p class="fine"><a class="tap-area" href="/pricing">How quotes and payment work</a></p></div></section>
${examplesBlock(toolExamples, 'Tool examples', false, 4)}
${faqSection(page, 'Questions about business tools', generalFaq(['tool-what', 'plan', 'cost', 'other-costs', 'own', 'time']), 'tools', toolExamples.length > 0)}
${enquirySection(page, { need: 'tool', heading: 'Get a free plan & quote', lead: 'Tell us how things work now and what you’d like to fix. We’ll send a short plan and a fixed quote. No obligation, no calls.' })}`;
  return page;
}

function nichePage(n) {
  const page = { url: `/${n.id}`, out: `${n.id}.html`, hasForm: true, title: n.seo.title, description: n.seo.description, bodyClass: `page-${n.id}` };
  const A = n.argument;
  const nicheExamples = examples.filter((e) => e.niche === n.id);
  const ideas = ideasList(n);
  const ideasLead = `Ideas for ${nicheLower(n)}, with ${BG.priceNote} starting prices. ${BG.lead}`;
  page.body = `${splitHero('hero-niche', `${nicheIcon(n)}${t(n.hero.eyebrow)}`, n.hero.h1, n.hero.lead, {
    cta: ctaRow(page, [{ href: '#ideas', label: 'See ideas and prices' }]),
    extra: `<p class="hero-from">${tMoney(C.home.hero.priceAnchor)}</p>`
  }, svg.phone(n.id))}
<section class="section" aria-labelledby="why-h">
<div class="wrap two-col">
<div class="prose-block">${sectionHead('why', A.heading)}${A.paragraphs.map((p) => `<p>${t(p)}</p>`).join('')}</div>
<div class="card points-card"><h3>What your website can do</h3>${ticks(A.points)}</div>
</div>
</section>
${n.openStatus ? openStatusSection(n) : ''}
${calculatorSection(n)}
<section class="section" id="ideas" aria-labelledby="ideas-h"><div class="wrap">${sectionHead('ideas', 'What we can build for you', ideasLead)}${ideas}<p class="more-link"><a href="/pricing">See all prices ${svg.icon('arrow')}</a></p></div></section>
${examplesBlock(nicheExamples, `${n.name}: examples`, true)}
${faqSection(page, `Questions from ${n.singular} owners`, n.faq.concat(generalFaq(['cost', 'need-plan', 'own', 'time'])), undefined, !nicheExamples.length)}
${enquirySection(page, { businessType: n.businessType, heading: `Get a free quote for your ${n.singular}`, lead: C.enquiry.lead })}`;
  return page;
}

function pricingPage() {
  const P = C.pricing;
  const page = { url: '/pricing', out: 'pricing.html', title: P.seo.title, description: P.seo.description };
  const group = (key, title, lead, body) => `<section class="price-group" id="${key}-prices" aria-labelledby="${key}-prices-h">
<div class="price-group-head"><span class="niche-icon">${svg.icon(GROUP_ICON[key])}</span><h2 id="${key}-prices-h">${t(title)}</h2><a class="tap-area" href="${groups[key].page}">More about ${esc(groups[key].name.toLowerCase())} ${svg.icon('arrow')}</a></div>
<p class="section-lead">${lead}</p>
${body}
</section>`;
  const S = P.changes;
  const allowance = `<ul class="time-list">${options.map((o) => `<li><span>${esc(planName(o))}</span><span>${freePill(t(o.changes))}</span></li>`).join('')}</ul>`;
  page.body = `${pageHero(P.h1, P.lead)}
<div class="section section-tight"><div class="wrap">
${foundingBanner(page, { compact: true })}
${group('websites', WEB.name, t(WEB.lead), `${optionsGrid(page)}<div class="card includes-card"><h3>Every website includes</h3>${ticks(C.websiteIncludes, 'ticks ticks-2col')}</div>`)}
${group('tools', BG.heading, `${t(BG.intro)} ${t(BG.lead)} ${t(BG.toolsHosting)}`, `<div class="plans plans-4">${bands.map((b) => bandCard(b, page)).join('')}</div>`)}
</div></div>
<section class="section section-sand" aria-labelledby="terms-h"><div class="wrap two-col">
<div>${sectionHead('terms', P.termsHeading)}${ticks(P.terms)}<h2 class="h3 terms-sub">${t(P.planTermsHeading)}</h2>${ticks(P.planTerms)}<p><a class="tap-area" href="/terms">Read the full terms</a></p></div>
<div class="stack">
<div class="card"><h2 class="h3">${t(P.factorsHeading)}</h2>${ticks(P.factors)}</div>
<div class="card" id="changes"><h2 class="h3">${t(S.heading)}</h2><p>${t(S.lead)}</p>${ticks(S.examples)}<p>${t(S.notIncluded)}</p><p class="list-head">${t(S.allowanceHeading)}</p>${allowance}<p class="callout">${svg.icon('calendar')}<span>${t(S.timing)}</span></p></div>
</div>
</div></section>
<section class="section" aria-labelledby="next-h"><div class="wrap narrow center">${sectionHead('next', 'Want an exact price?', 'Tell us what you need, and we’ll send a fixed quote with a free mock-up or plan.')}${ctaRow(page, [{ href: '/start', label: 'How it works' }])}</div></section>`;
  return page;
}

function faqPage() {
  const Q = C.faqPage;
  const page = { url: '/faq', out: 'faq.html', title: Q.seo.title, description: Q.seo.description };
  const contactBtns = [
    contact.wa ? `<a class="btn btn-navy btn-lg" href="${esc(waGeneral())}">${svg.whatsapp()}Ask on WhatsApp</a>` : '',
    contact.email ? `<a class="btn btn-ghost btn-lg" href="mailto:${esc(contact.email)}">${svg.icon('mail')}Email us</a>` : ''
  ].filter(Boolean).join('');
  page.body = `${pageHero(Q.h1, Q.lead)}
<section class="section section-tight" aria-labelledby="general-h"><div class="wrap narrow">${sectionHead('general', 'The basics')}${faqList(C.faq)}</div></section>
${niches.map((n) => `<section class="section section-tight" aria-labelledby="faq-${n.id}-h"><div class="wrap narrow"><h2 id="faq-${n.id}-h" class="with-icon"><span class="niche-icon">${nicheIcon(n)}</span>${t(n.name)}</h2>${faqList(n.faq)}<p class="more-link"><a href="/${n.id}">Ideas for ${esc(nicheLower(n))} ${svg.icon('arrow')}</a></p></div></section>`).join('')}
${contactBtns || canEnquire ? `<section class="section section-sand" aria-labelledby="ask-h"><div class="wrap narrow center">${sectionHead('ask', 'Still have a question?', 'Ask us directly. No calls needed, and voice notes are welcome.')}<div class="cta-row cta-center">${contactBtns}${quoteButton(page, 'btn btn-gold btn-lg')}</div></div></section>` : ''}`;
  return page;
}

/* ---------- examples: a demo website and four working tools, each running live in a frame ---------- */

// The phone's status bar: signal, Wi-Fi and battery. site.js keeps the clock beside it live.
const statusIcons = '<svg class="ex-sb-icons" viewBox="0 0 64 14" aria-hidden="true" focusable="false"><g fill="currentColor"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6.5" width="3" height="7.5" rx="1"/><rect x="10" y="4" width="3" height="10" rx="1"/><rect x="15" y="1.5" width="3" height="12.5" rx="1"/><path d="M30 13.4a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4zm-4.7-5.2a6.7 6.7 0 0 1 9.4 0l-1.4 1.4a4.7 4.7 0 0 0-6.6 0zm-2.9-2.9a10.8 10.8 0 0 1 15.2 0l-1.4 1.4a8.8 8.8 0 0 0-12.4 0z"/><rect x="44.5" y="4" width="12" height="6" rx="1.4"/></g><rect x="42.6" y="2" width="16" height="10" rx="3" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/><path d="M60.6 5.6v2.8" stroke="currentColor" stroke-opacity=".5" stroke-width="1.6" stroke-linecap="round"/></svg>';
const statusBar = `<p class="ex-statusbar" aria-hidden="true"><span data-clock>09:41</span><i class="ex-island"></i>${statusIcons}</p>`;

// "Website · Demo", "Tool · Client"...
function exLabel(e) {
  return `<p class="ex-label"><span>${e.kind === 'tool' ? 'Tool' : 'Website'}</span><i aria-hidden="true">·</i><span>${e.status === 'client' ? 'Client' : 'Demo'}</span></p>`;
}

// A phone running a tool, live and interactive. The frame shrinks to fit; the tool inside
// lays itself out for the space it gets, as it would on a real phone.
function phoneFrame(e) {
  return `<div class="ex-phone"><div class="ex-phone-screen">${statusBar}<iframe src="${esc(e.url)}" title="${esc(typo(`${e.title}: working demo`))}" loading="lazy"></iframe><i class="ex-homebar" aria-hidden="true"></i></div></div>`;
}

// The demo website on a laptop and a phone: real pages, scaled down (site.js sets the scale).
function deviceShot(e) {
  const where = `${site.domain}${e.url.replace(/\/$/, '')}`;
  return `<div class="ex-shot" inert>
<div class="ex-laptop"><div class="ex-laptop-lid"><div class="browser-bar"><span class="dots"><i></i><i></i><i></i></span><span class="url">${esc(where)}</span></div><div class="ex-fit ex-fit-wide" data-fit="1280"><iframe src="${esc(e.url)}" width="1280" height="800" loading="lazy" tabindex="-1" title="${esc(typo(`${e.title} on a computer (preview)`))}"></iframe></div></div><div class="ex-laptop-base"></div></div>
<div class="ex-phone ex-phone-mini"><div class="ex-phone-screen">${statusBar}<div class="ex-fit ex-fit-tall" data-fit="390"><iframe src="${esc(e.url)}" width="390" height="780" loading="lazy" tabindex="-1" title="${esc(typo(`${e.title} on a phone (preview)`))}"></iframe></div></div></div>
</div>`;
}

// Buttons that fill in the enquiry form (site.js); without JavaScript they just go to it.
function prefillLink(cls, label, need, details, type) {
  if (!canEnquire) return '';
  return `<a class="${cls}" href="#enquiry" data-prefill-need="${esc(need)}"${type ? ` data-prefill-type="${esc(type)}"` : ''}${details ? ` data-prefill-details="${esc(typo(fill(details)))}"` : ''}>${t(label)}</a>`;
}

function examplesPage() {
  const E = EXP;
  const H = E.hero;
  const W = E.website;
  const T = E.tools;
  const G = E.together;
  const page = { url: '/examples', out: 'examples.html', hasForm: true, jsonLd: true, title: E.seo.title, description: E.seo.description, bodyClass: 'page-examples' };
  const demos = examples.filter((e) => e.status === 'demo');
  const siteDemo = demos.find((e) => e.id === W.item) || demos.find((e) => e.kind === 'website');
  const tools = demos.filter((e) => e.kind === 'tool');
  const clients = examples.filter((e) => e.status === 'client');
  if (!siteDemo) warn(`examples.website.item: no demo website "${W.item}" in examples.items.`);

  const links = [
    ...(siteDemo ? [{ href: '#website', label: W.nav }] : []),
    ...tools.map((e) => ({ href: `#${e.id}`, label: e.nav || e.title })),
    ...(clients.length ? [{ href: '#clients', label: 'Client work' }] : []),
    ...(canEnquire ? [{ href: '#enquiry', label: E.yourTurn.heading }] : [])
  ];
  const nav = `<nav class="ex-nav" aria-label="${esc(E.navLabel)}" data-exnav><div class="wrap"><ul class="ex-nav-list">${links.map((l) => `<li><a href="${l.href}">${t(l.label)}</a></li>`).join('')}</ul></div></nav>`;

  const hero = `<section class="hero ex-hero" aria-labelledby="ex-hero-h"><div class="wrap narrow center">
<p class="eyebrow">${t(H.eyebrow)}</p>
<h1 id="ex-hero-h">${tHl(H.h1)}</h1>
<p class="lead">${t(H.lead)}</p>
<div class="cta-row cta-center">${siteDemo ? `<a class="btn btn-gold btn-lg" href="#website">${t(H.websiteButton)}</a>` : ''}${tools.length ? `<a class="btn btn-ghost btn-lg" href="#tools">${t(H.toolButton)}${svg.icon('down')}</a>` : ''}</div>
<p class="ex-hero-note">${svg.icon('lock')}<span>${t(H.note)}</span></p>
</div></section>`;

  const website = siteDemo ? `<section class="section ex-website" id="website" aria-labelledby="website-h"><div class="wrap ex-website-grid">
<div class="ex-website-shot">${deviceShot(siteDemo)}</div>
<div class="ex-website-text">
${exLabel(siteDemo)}
<h2 id="website-h">${t(W.heading)}</h2>
<p class="section-lead">${t(W.lead)}</p>
${ticks(W.points)}
<p class="ex-price">${examplePrice(siteDemo)}</p>
<div class="cta-row"><a class="btn btn-gold btn-lg" href="${esc(siteDemo.url)}"${ext}>${t(W.openButton)}${newTab}</a>${prefillLink('btn btn-ghost btn-lg', W.wantButton, 'website', W.details, W.businessType)}</div>
</div>
</div></section>` : '';

  const toolSections = tools.map((e, i) => `<article class="ex-tool${i % 2 ? ' ex-tool-flip' : ''}" id="${esc(e.id)}" aria-labelledby="${esc(e.id)}-h">
<div class="ex-tool-device">${phoneFrame(e)}${isSet(e.tryThis) ? `<p class="ex-try"><strong>${t(T.tryLabel)}</strong> ${t(e.tryThis)}</p>` : ''}</div>
<div class="ex-tool-text">
${exLabel(e)}
<h3 id="${esc(e.id)}-h">${t(e.nav || e.title)}: ${t(e.business || e.title)}</h3>
${isSet(e.type) ? `<p class="ex-type">${t(e.type)}</p>` : ''}
${isSet(e.problem) ? `<p class="ex-problem"><span class="visually-hidden">The problem, in the owner’s words: </span>${t(`“${e.problem}”`)}</p>` : ''}
${e.fixes ? `<p class="ex-fix-h">${t(T.fixHeading)}</p>${ticks(e.fixes)}` : ''}
<p class="ex-price">${examplePrice(e)}</p>
<div class="cta-row"><a class="btn btn-navy" href="${esc(e.url)}"${ext}>${t(T.fullScreen)}${newTab}</a>${prefillLink('btn btn-ghost', T.want, 'tool', e.want || `I'd like a tool like the ${e.title} demo.`)}</div>
</div>
</article>`).join('');
  const toolsSection = tools.length ? `<section class="section section-sand ex-tools" id="tools" aria-labelledby="tools-h"><div class="wrap">
<div class="ex-tools-head">${sectionHead('tools', T.heading, T.lead)}</div>
<div class="ex-tool-list">${toolSections}</div>
</div></section>` : '';

  const flow = `<section class="section ex-together" id="together" aria-labelledby="together-h"><div class="wrap">
<div class="center">${sectionHead('together', G.heading, G.lead)}</div>
<ol class="ex-flow">${G.steps.map((s, i) => `<li class="ex-flow-step"><span class="ex-flow-icon">${s.icon === 'chat' ? svg.whatsapp() : svg.icon(s.icon)}</span><p class="ex-flow-num">Step ${i + 1}</p><h3>${t(s.title)}</h3><p>${t(s.text)}</p></li>`).join('')}</ol>
<p class="ex-flow-line">${t(G.line)}</p>
<p class="ex-flow-data">${svg.icon('lock')}<span>${t(G.data)}</span></p>
</div></section>`;

  // Real client work, only once there is some: no empty section, no apology.
  const clientSection = clients.length ? `<section class="section section-sand" id="clients" aria-labelledby="clients-h"><div class="wrap">${sectionHead('clients', E.clients.heading, E.clients.lead)}<div class="examples examples-n${Math.min(clients.length, 3)}">${clients.map(exampleCard).join('')}</div></div></section>` : '';

  page.body = `${hero}
${nav}
${website}
${toolsSection}
${flow}
${clientSection}
${enquirySection(page, { heading: E.yourTurn.heading, lead: E.yourTurn.lead })}`;
  return page;
}

function startPage() {
  const S = C.startPage;
  const page = { url: '/start', out: 'start.html', title: S.seo.title, description: S.seo.description };
  const ask = [
    contact.wa ? `<a class="btn btn-navy" href="${esc(waLink('Hi, please send me the payment link for my plan or renewal.'))}">${svg.whatsapp()}WhatsApp us</a>` : '',
    contact.email ? `<a class="btn btn-ghost" href="mailto:${esc(contact.email)}?subject=${encodeURIComponent('Payment link')}">${svg.icon('mail')}Email us</a>` : ''
  ].filter(Boolean).join('');
  // PayFast buttons: one per plan (monthly, and yearly if that's on) and one for the once-off renewal.
  const payOptions = options.flatMap((o) => (o.monthly
    ? [
      { url: o.payfastUrl, label: `${o.payLabel || planName(o)}${yearlyOn ? ', monthly' : ''}`, price: month(o.monthly) },
      ...(yearlyOn ? [{ url: o.payfastYearlyUrl, label: `${o.payLabel || planName(o)}, yearly`, price: `${rand(yearly(o.monthly))}/year` }] : [])
    ]
    : [{ url: o.payfastUrl, label: o.payLabel || o.name, price: `${rand(T.renewalYearly)}/year` }]));
  const withLinks = payOptions.filter((o) => o.url);
  const afterStep = S.steps.find((s) => s.id === 'after') || {};
  const payBlock = withLinks.length
    ? `<div class="pay-buttons">${withLinks.map((o) => `<a class="btn btn-navy" href="${esc(o.url)}">${svg.icon('card')}<span>${esc(o.label)}<small>${o.price}</small></span></a>`).join('')}</div>${withLinks.length < payOptions.length && ask ? `<p>Can’t see the option you want? Message us and we’ll send you the link.</p><div class="cta-row">${ask}</div>` : ''}`
    : `<p>${shown(afterStep.noLinksText).map(t).join(' ')}</p>`;
  const afterList = `<ul class="time-list">${options.map((o) => `<li><span>${esc(o.name)}</span><span>${o.monthly ? month(o.monthly) : t(o.hosting)}${yearlyOn && o.monthly ? ` <small>or ${rand(yearly(o.monthly))}/year</small>` : ''}</span></li>`).join('')}</ul><p><a class="tap-area" href="/pricing#websites-prices">Compare the options ${svg.icon('arrow')}</a></p>`;
  const items = S.steps.map((s, i) => {
    let extra = shown(s.extra).map((x) => `<p class="callout">${svg.icon('clock')}<span>${t(x)}</span></p>`).join('');
    if (s.id === 'tell' && canEnquire) extra += `<p>${quoteButton(page, 'btn btn-gold', 'Tell us what you need')}</p>`;
    if (s.id === 'after') extra += `${afterList}${payBlock}`;
    return `<li class="start-step" id="step-${esc(s.id)}"><div class="start-num" aria-hidden="true">${i + 1}</div><div class="start-body"><h2>${t(s.title)}</h2><p>${t(s.text)}</p>${extra}</div></li>`;
  }).join('');
  // The website row shows the once-off price and the lowest build price with a plan.
  const jobPrice = (j) => {
    if (j.website) return `${rand(onceOff.build)} ${t(BG.priceNote)}${cheapestPlan ? `<small>or ${rand(cheapestPlan.build)} with ${esc(planName(cheapestPlan))}</small>` : ''}`;
    return hasPrice(j) ? `${rand(j.from)} ${t(BG.priceNote)}` : 'Quoted';
  };
  const times = timedJobs.length
    ? `<section class="section section-sand" aria-labelledby="times-h"><div class="wrap narrow">${sectionHead('times', S.timesHeading, S.timesNote)}<div class="table-wrap"><table class="times-table"><thead><tr><th scope="col">Job</th><th scope="col">Starts from</th><th scope="col">Typical build time</th></tr></thead><tbody>${timedJobs.map((j) => `<tr><th scope="row">${esc(j.name)} <small>${esc(groups[j.group].name)}</small></th><td>${jobPrice(j)}</td><td>${esc(typo(j.buildTime))}</td></tr>`).join('')}</tbody></table></div></div></section>`
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
${canEnquire ? `<section class="section section-sand"><div class="wrap narrow center">${sectionHead('next', 'Want this done for you?', 'Tell us what you need and get a free mock-up or plan, with a fixed quote. No obligation, no calls.')}${ctaRow(page)}</div></section>` : ''}`;
    return page;
  });
  return [index, ...articles];
}

/* =====================================================================
   Demos: the Tin Kettle Kitchen website and the four tools on /examples.
   Sources are in src/examples/. They're made-up businesses with their own look; the only
   Front Door Sites branding is the demo ribbon. Never indexed, never in the sitemap.
   ===================================================================== */

const EX_DIR = path.join(ROOT, 'src/examples');
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (err) {
    console.error(`\nCould not read ${path.relative(ROOT, file)}:\n  ${err.message}\n`);
    process.exit(1);
  }
}
const TK = readJson(path.join(EX_DIR, 'tin-kettle/content.json'));
const TK_URL = '/examples/tin-kettle/';
const TK_ORDER = '/examples/tools/ordering/';

// The thin bar at the top of every demo page. Its style is inlined into each tool, and
// added to the Tin Kettle stylesheet.
const RIBBON_CSS = '.fds-ribbon{position:relative;margin:0;padding:.42rem .8rem;background:#0A2A44;color:#EEF3F7;font:500 12.5px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;letter-spacing:.01em;text-align:center}.fds-ribbon p{margin:0}.fds-ribbon a{color:#FEC458;font-weight:700;text-decoration:underline;text-underline-offset:.18em}.fds-ribbon a:hover{color:#FFE58E}.fds-ribbon a:focus-visible{outline:2px solid #FEC458;outline-offset:2px;border-radius:3px}.fds-ribbon .fds-sep{margin:0 .45em;opacity:.55}.fds-ribbon .fds-mark{display:inline-block;width:15px;height:15px;margin-right:.4em;vertical-align:-3px}@media print{.fds-ribbon{display:none}}';
function demoRibbon(what, business) {
  return `<aside class="fds-ribbon" aria-label="About this demo"><p>${svg.logo('fds-mark')}Demo ${what} by ${esc(site.name)}<span class="fds-sep" aria-hidden="true">·</span>${esc(business)} isn’t a real business<span class="fds-sep" aria-hidden="true">·</span><a href="/examples" target="_top">See more examples</a></p></aside>`;
}
// So a demo link sent on WhatsApp shows a proper preview.
function demoShareTags(title, description, url) {
  return `<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(site.url + url)}">
<meta property="og:image" content="${esc(site.url)}/og-image.png">
<meta name="twitter:card" content="summary_large_image">`;
}

/* ---------- Tin Kettle Kitchen ---------- */

const TK_ICONS = {
  kettle: '<path d="M8 11.2c-.1-3.7 1.7-6.2 4-6.2s4.1 2.5 4 6.2"/><path d="M6.6 19.5c-.7-3.5 0-6.3 1.9-8.3h7c1.9 2 2.6 4.8 1.9 8.3z"/><path d="M7.4 14.4 3.6 12l.9 3.2 2.3 1.6"/><path d="M10 11.2a2 2 0 0 1 4 0M12 9.2V8"/><path d="M5.5 19.5h13"/>',
  plate: '<circle cx="12" cy="12.5" r="6.4"/><circle cx="12" cy="12.5" r="3.4"/><path d="M2.8 4.5v4.3a1.4 1.4 0 0 0 1.4 1.4v9.3M4.2 4.5v4.3M21.2 4.5c-1.3.9-1.8 2.6-1.8 4.6 0 1.6.5 2.3 1.8 2.3v8.1"/>',
  cup: '<path d="M4.5 9.5h12v4.2a5.3 5.3 0 0 1-5.3 5.3H9.8a5.3 5.3 0 0 1-5.3-5.3z"/><path d="M16.5 10.8h1.4a2.4 2.4 0 0 1 0 4.8h-1.6"/><path d="M8.2 3.2c-.9 1.1.9 2.2 0 3.3M12.2 3.2c-.9 1.1.9 2.2 0 3.3"/><path d="M3.5 21h15"/>',
  fish: '<path d="M21.2 12c-2.1 3.4-5 5.3-8.4 5.3-3.1 0-5.6-1.9-7.6-5.3 2-3.4 4.5-5.3 7.6-5.3 3.4 0 6.3 1.9 8.4 5.3z"/><path d="M5.2 12 2.4 8.6v6.8z"/><path d="M16.8 11.2h.01"/><path d="M10.6 9.4c.9.8 1.4 1.7 1.4 2.6s-.5 1.8-1.4 2.6"/>',
  flame: '<path d="M12 21.2c-3.8 0-6.6-2.7-6.6-6.3 0-3.4 2.4-5.4 3.7-7.6.4 1.9 1.3 3 2.4 3.4-.2-3.3 1.3-6.2 3.9-7.9-.2 2.9 1 4.7 2.3 6.4 1 1.4 1.9 3.1 1.9 5.2 0 3.8-3.1 6.8-7.6 6.8z"/><path d="M12 21.2c-1.6 0-2.7-1.1-2.7-2.6 0-1.6 1.2-2.5 2.2-3.8.9 1.4 3.2 2 3.2 3.9 0 1.4-1.2 2.5-2.7 2.5z"/>',
  star: '<path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.5 1.1 6.3L12 17.3l-5.6 3 1.1-6.3-4.6-4.5 6.3-.9z"/>',
  pin: '<path d="M12 21.5s-6.6-5.8-6.6-11.2a6.6 6.6 0 0 1 13.2 0c0 5.4-6.6 11.2-6.6 11.2z"/><circle cx="12" cy="10.2" r="2.5"/>',
  phone: '<path d="M8.6 3.5H6.2A2.2 2.2 0 0 0 4 5.8c.4 8 6.2 13.8 14.2 14.2a2.2 2.2 0 0 0 2.3-2.2v-2.4a1 1 0 0 0-.7-1l-3-1a1 1 0 0 0-1.1.3l-1.3 1.6a12 12 0 0 1-5.5-5.5l1.6-1.3a1 1 0 0 0 .3-1.1l-1-3a1 1 0 0 0-1-.7z"/>',
  chat: '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.4a8.4 8.4 0 1 1 15.4-4.5z"/><path d="M8.6 11.8h.01M12 11.8h.01M15.4 11.8h.01"/>',
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.1 1.9"/>',
  arrow: '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
  bag: '<path d="M5.4 8.5h13.2l-1 11a1.6 1.6 0 0 1-1.6 1.5H8a1.6 1.6 0 0 1-1.6-1.5z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
  calendar: '<rect x="3.8" y="5.2" width="16.4" height="15.3" rx="2.6"/><path d="M3.8 9.8h16.4M8.3 3.2v3.6M15.7 3.2v3.6"/>',
  parking: '<rect x="3.8" y="3.8" width="16.4" height="16.4" rx="3.4"/><path d="M10 16.5v-9h3a2.8 2.8 0 0 1 0 5.6h-3"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.2M12 7.9h.01"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V8a3.8 3.8 0 0 1 7.6 0v2.5"/>'
};
const tkIcon = (name, cls = 'tk-i') => `<svg class="${cls}${name === 'star' ? ' tk-i-fill' : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${TK_ICONS[name] || TK_ICONS.kettle}</svg>`;
const tkT = (s) => esc(typo(s));
const tkItems = Object.fromEntries(TK.menu.flatMap((c) => c.items.map((i) => [i.id, { ...i, cat: c }])));

// A real photo when one is set, or a designed placeholder until then.
function tkPhoto(slot, cls = '', tone = '') {
  if (isSet(slot.photo)) {
    const rel = String(slot.photo).replace(/^\/+/, '');
    const file = path.join(ROOT, 'src', rel);
    const size = fs.existsSync(file) && /\.webp$/i.test(rel) ? webpSize(file) : null;
    if (size) return `<div class="tk-photo ${cls}"><img src="/${esc(rel)}" width="${size.w}" height="${size.h}" loading="lazy" decoding="async" alt="${esc(slot.alt || '')}"></div>`;
    warn(`Tin Kettle photo ${rel}: use a .webp file in src/${path.dirname(rel)}/. Showing the placeholder.`);
  }
  return `<div class="tk-photo tk-ph${tone ? ` tk-ph-${tone}` : ''} ${cls}" aria-hidden="true">${tkIcon(slot.icon || 'kettle')}<span class="tk-ph-cap">Your photo here</span></div>`;
}

function tkStars(n, label) {
  const stars = Array.from({ length: 5 }, (_, i) => tkIcon('star', `tk-i${i < Math.round(n) ? '' : ' is-half'}`)).join('');
  return `<span class="tk-stars" role="img" aria-label="${esc(label || `${n} out of 5 stars`)}">${stars}</span>`;
}

function tkHoursTable(caption) {
  return `<table class="tk-hours"><caption class="tk-sr">${esc(caption)}</caption><tbody>${DAYS.map(([k, label]) => {
    const h = TK.hours[k];
    return `<tr data-day="${k}"><th scope="row">${label}</th><td>${h ? `${esc(h[0])}–${esc(h[1])}` : 'Closed'}</td></tr>`;
  }).join('')}</tbody></table>`;
}

// A drawn map of the (made-up) corner: no Google Maps embed, nothing loaded from elsewhere.
function tkMap() {
  return `<svg class="tk-map" viewBox="0 0 360 230" role="img" aria-labelledby="tk-map-t"><title id="tk-map-t">Map: ${esc(TK.name)} is on the ${esc(TK.address.toLowerCase())}, near the beach, with parking on Third Street</title>
<rect width="360" height="230" fill="#EFE3CB"/>
<g fill="#E4D3B5"><rect x="12" y="12" width="118" height="70" rx="10"/><rect x="166" y="12" width="84" height="70" rx="10"/><rect x="12" y="132" width="52" height="86" rx="10"/><rect x="166" y="132" width="84" height="86" rx="10"/></g>
<rect x="76" y="132" width="54" height="86" rx="10" fill="#D6DBB6"/>
<g fill="#B6BD86"><circle cx="92" cy="152" r="6"/><circle cx="112" cy="166" r="7"/><circle cx="94" cy="190" r="6.5"/><circle cx="116" cy="200" r="5.5"/></g>
<path d="M276 0c-8 22 6 40-2 62s8 40 0 62 8 42-2 64 4 28 0 42h88V0z" fill="#F3DCAE"/>
<path d="M300 0c-8 22 6 40-2 62s8 40 0 62 8 42-2 64 4 28 0 42h64V0z" fill="#B9D4CC"/>
<g fill="none" stroke="#7EA79D" stroke-width="2" stroke-linecap="round"><path d="M318 34q5-4 10 0t10 0"/><path d="M326 92q5-4 10 0t10 0"/><path d="M316 150q5-4 10 0t10 0"/><path d="M328 200q5-4 10 0t10 0"/></g>
<path d="M0 107h290" stroke="#FFFBF4" stroke-width="24"/>
<path d="M148 0v230" stroke="#FFFBF4" stroke-width="20"/>
<path d="M0 107h290M148 0v230" stroke="#D8C7A8" stroke-width="1.2" stroke-dasharray="6 7"/>
<path d="M262 0v230" stroke="#FFFBF4" stroke-width="10"/>
<text class="tk-map-t" x="16" y="110.5">Harbour Road</text>
<text class="tk-map-t" transform="translate(151.5 222) rotate(-90)">Third Street</text>
<text class="tk-map-sea" transform="translate(337 70) rotate(90)">BEACH</text>
<g transform="translate(152 150)"><rect width="22" height="22" rx="5" fill="#515830"/><path d="M8.5 17V6h4a3.3 3.3 0 0 1 0 6.6h-4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></g>
<g transform="translate(168 66)"><path d="M14 38S0 25.5 0 13.5a14 14 0 0 1 28 0C28 25.5 14 38 14 38z" fill="#C2603C" stroke="#7E3418" stroke-width="2"/><circle cx="14" cy="13.5" r="5.5" fill="#FFFBF4"/></g>
<g transform="translate(200 62)"><rect width="78" height="24" rx="12" fill="#2B2724"/><text class="tk-map-you" x="39" y="16.5" text-anchor="middle" fill="#FFFBF4">Tin Kettle</text></g>
<g transform="translate(26 182)" fill="none" stroke="#5B524B" stroke-width="1.6"><circle r="13" fill="#FFFBF4"/><path d="M0-8l4 9H-4z" fill="#2B2724" stroke="none"/></g><text class="tk-map-t" x="26" y="208" text-anchor="middle">N</text>
</svg>`;
}

const TK_NAV = [
  { key: 'home', href: TK_URL, label: 'Home' },
  { key: 'menu', href: `${TK_URL}menu`, label: 'Menu' },
  { key: 'book', href: `${TK_URL}book`, label: 'Book a table' },
  { key: 'find', href: `${TK_URL}find-us`, label: 'Find us' }
];

function tkLogo(cls = '') {
  return `<a class="tk-logo ${cls}" href="${TK_URL}"><span class="tk-logo-mark">${tkIcon('kettle')}</span><span class="tk-logo-name"><b>${esc(TK.short)}</b><small>Kitchen</small></span><span class="tk-sr"> home</span></a>`;
}

function tkHeader(p) {
  const items = (list) => list.map((n) => `<li><a href="${n.href}"${p.key === n.key ? ' aria-current="page"' : ''}>${esc(n.label)}</a></li>`).join('');
  const order = `<a class="tk-btn tk-btn-main tk-btn-sm" href="${TK_ORDER}">${tkIcon('bag')}Order</a>`;
  return `<header class="tk-header"><div class="tk-wrap tk-header-in">
${tkLogo()}
<nav class="tk-nav" aria-label="Main"><ul>${items(TK_NAV.filter((n) => n.key !== 'home'))}</ul>${order}</nav>
<details class="tk-menu"><summary>${tkIcon('menu')}<span>Menu</span></summary><nav class="tk-menu-panel" aria-label="Menu"><ul>${items(TK_NAV)}</ul>${order}</nav></details>
</div></header>`;
}

function tkFooter() {
  const F = TK.find;
  const hoursList = DAYS.map(([k, label]) => `<li><span>${label.slice(0, 3)}</span><span>${TK.hours[k] ? `${TK.hours[k][0]}–${TK.hours[k][1]}` : 'Closed'}</span></li>`).join('');
  return `<footer class="tk-footer"><div class="tk-wrap">
<div class="tk-footer-grid">
<div>${tkLogo()}<p class="tk-footer-about">${tkT(TK.promise)}</p><p class="tk-address">${tkIcon('pin')}<span>${tkT(TK.address)}<br>${tkT(TK.town)}</span></p></div>
<div><h2>Hours</h2><ul class="tk-footer-hours">${hoursList}</ul></div>
<div><h2>Visit</h2><ul>${TK_NAV.map((n) => `<li><a href="${n.href}">${esc(n.label)}</a></li>`).join('')}<li><a href="${TK_ORDER}">Order for collection</a></li></ul><p class="tk-parking">${tkIcon('parking')}<span>${tkT(F.parking)}</span></p></div>
</div>
<div class="tk-footer-base"><p>A demo website by <a href="/examples">${esc(site.name)}</a>. ${esc(TK.name)} isn’t a real business, and nothing here is sent or stored.</p></div>
</div></footer>`;
}

function tkBar() {
  const F = TK.find;
  return `<nav class="tk-bar" aria-label="Quick actions">
<button class="tk-btn tk-btn-line" type="button" data-tk-toast="${esc(typo(F.callToast))}">${tkIcon('phone')}Call</button>
<button class="tk-btn tk-btn-olive" type="button" data-tk-toast="${esc(typo(F.whatsappToast))}">${tkIcon('chat')}WhatsApp</button>
<a class="tk-btn tk-btn-main" href="${TK_ORDER}">${tkIcon('bag')}Order</a>
</nav>`;
}

function tkLayout(p, assets) {
  const data = JSON.stringify({ short: TK.short, hours: TK.hours }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en-ZA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(typo(p.title))}</title>
<meta name="description" content="${esc(typo(p.description))}">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#C2603C">
<link rel="stylesheet" href="${assets.css}">
<script src="${assets.js}" defer></script>
<link rel="icon" href="${TK_URL}favicon.svg" type="image/svg+xml">
${demoShareTags(typo(p.title), typo(p.description), p.url)}
<script type="application/json" id="tk-data">${data}</script>
</head>
<body class="tk-has-bar">
<a class="tk-skip" href="#main">Skip to content</a>
${demoRibbon('website', TK.name)}
${tkHeader(p)}
<main id="main">
${p.body}
</main>
${tkFooter()}
${tkBar()}
<div class="tk-toasts" role="status" aria-live="polite" data-tk-toasts></div>
</body>
</html>
`;
}

function tkHome() {
  const S = TK.specials;
  const Y = TK.why;
  const A = TK.about;
  const R = TK.reviews;
  const F = TK.find;
  const specials = S.items.map((s, i) => {
    const it = tkItems[s.item];
    if (!it) { warn(`Tin Kettle special: no menu item "${s.item}"`); return ''; }
    return `<li class="tk-special">${tkPhoto(s, '', ['', 'sun', 'olive'][i % 3])}<div class="tk-special-body"><div class="tk-special-top"><h3>${tkT(it.name)}</h3><span class="tk-price">${rand(it.price)}</span></div><p>${tkT(s.note)}</p><a class="tk-btn tk-btn-line tk-btn-sm" href="${TK_ORDER}?add=${esc(it.id)}">Order this<span class="tk-sr">: ${tkT(it.name)}</span></a></div></li>`;
  }).join('');
  const reviews = R.items.map((r) => `<li><figure class="tk-review">${tkStars(r.stars, `${r.stars} out of 5 stars`)}<blockquote><p>${tkT(r.text)}</p></blockquote><figcaption><span class="tk-avatar" aria-hidden="true">${esc(r.name[0])}</span>${esc(r.name)}<span class="tk-review-src">Demo review</span></figcaption></figure></li>`).join('');
  const tip = `<span class="tk-tip"><button class="tk-tip-btn" type="button" aria-describedby="tk-rating-tip" aria-expanded="false">${tkIcon('info')}<span class="tk-sr">About these figures</span></button><span class="tk-tip-text" id="tk-rating-tip" role="tooltip">${tkT(TK.rating.tip)}</span></span>`;
  return `<div class="tk-awning" aria-hidden="true"></div>
<section class="tk-hero" aria-labelledby="tk-hero-h"><div class="tk-wrap tk-hero-grid">
<div>
<p class="tk-kind">${tkT(TK.kind)} · ${tkT(TK.town.split(',')[0])}</p>
<hgroup>
<h1 id="tk-hero-h">${tkT(TK.name)}</h1>
<p class="tk-status" data-tk-status><span class="tk-status-dot" aria-hidden="true"></span><span data-tk-status-text>Open every day. Our hours are below.</span></p>
</hgroup>
<p class="tk-promise">${tkT(TK.promise)}</p>
<div class="tk-btns"><a class="tk-btn tk-btn-main" href="${TK_URL}menu">See the menu</a><a class="tk-btn tk-btn-line" href="${TK_ORDER}">${tkIcon('bag')}Order for collection</a></div>
<p class="tk-rating">${tkStars(TK.rating.stars, TK.rating.text)}<span>${tkT(TK.rating.text)}</span>${tip}</p>
</div>
${tkPhoto(TK.hero, 'tk-hero-photo')}
</div></section>
<section class="tk-section tk-section-olive" aria-labelledby="tk-specials-h"><div class="tk-wrap">
<p class="tk-eyebrow">Fresh today</p>
<h2 id="tk-specials-h">${tkT(S.heading)}</h2>
<ul class="tk-specials">${specials}</ul>
<p class="tk-more"><a href="${TK_URL}menu">See the full menu ${tkIcon('arrow')}</a></p>
</div></section>
<section class="tk-section tk-section-paper" aria-labelledby="tk-why-h"><div class="tk-wrap">
<h2 id="tk-why-h">${tkT(Y.heading)}</h2>
<ul class="tk-why">${Y.items.map((w) => `<li><span class="tk-why-icon">${tkIcon(w.icon)}</span><h3>${tkT(w.title)}</h3><p>${tkT(w.text)}</p></li>`).join('')}</ul>
</div></section>
<section class="tk-section" aria-labelledby="tk-about-h"><div class="tk-wrap tk-about">
${tkPhoto(A, '', 'olive')}
<div><p class="tk-eyebrow">About us</p><h2 id="tk-about-h">${tkT(A.heading)}</h2>${A.text.map((x) => `<p>${tkT(x)}</p>`).join('')}<p class="tk-more"><a href="${TK_URL}book">Book a table ${tkIcon('arrow')}</a></p></div>
</div></section>
<section class="tk-section tk-section-sand" aria-labelledby="tk-reviews-h"><div class="tk-wrap">
<h2 id="tk-reviews-h">${tkT(R.heading)}</h2>
<p class="tk-reviews-sum">${tkStars(TK.rating.stars, TK.rating.text)}<span>${tkT(TK.rating.text)}</span></p>
<ul class="tk-reviews">${reviews}</ul>
</div></section>
<section class="tk-section tk-section-paper" aria-labelledby="tk-find-h"><div class="tk-wrap">
<h2 id="tk-find-h">${tkT(F.heading)}</h2>
<p class="tk-lead">${tkT(F.lead)}</p>
<div class="tk-find">
<div class="tk-card"><h3>${tkIcon('clock')}Opening hours</h3>${tkHoursTable(`${TK.name} opening hours`)}<p class="tk-hours-note">${tkT(TK.grill.note)}</p></div>
<div class="tk-card">${tkMap()}<p class="tk-address">${tkIcon('pin')}<span>${tkT(TK.address)}, ${tkT(TK.town)}</span></p><p class="tk-parking">${tkIcon('parking')}<span>${tkT(F.parking)}</span></p><div class="tk-btns"><button class="tk-btn tk-btn-main" type="button" data-tk-toast="${esc(typo(F.directionsToast))}">${tkIcon('pin')}Get directions</button><a class="tk-btn tk-btn-line" href="${TK_URL}find-us">More about finding us</a></div></div>
</div>
</div></section>`;
}

function tkMenu() {
  const M = TK.menu;
  const tags = (it) => (it.tags || []).map((g) => `<abbr class="tk-tag" title="${esc(TK.tags[g] || g)}">${esc(g)}</abbr>`).join('');
  const extras = `<p class="tk-extras"><strong>Extras:</strong> ${TK.extras.map((x) => `${esc(x.name)} ${rand(x.price)}`).join(' · ')}</p>`;
  const tabs = M.map((c) => `<button class="tk-tab" type="button" role="tab" id="tab-${esc(c.id)}" aria-controls="${esc(c.id)}" data-tk-tab="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  const panels = M.map((c) => `<section class="tk-cat" id="${esc(c.id)}" aria-labelledby="tab-${esc(c.id)} ${esc(c.id)}-h" data-tk-panel>
<div class="tk-cat-head"><h2 id="${esc(c.id)}-h">${esc(c.name)}</h2>${c.grill ? `<span class="tk-tag">${tkT(TK.grill.label)}</span>` : ''}</div>
${c.grill ? `<p class="tk-cat-note">${tkIcon('flame')}<span>${tkT(TK.grill.note)}</span></p>` : ''}
<ul class="tk-dishes">${c.items.map((it) => `<li class="tk-dish">
<h3 class="tk-dish-name"><span>${tkT(it.name)}</span><span class="tk-leader" aria-hidden="true"></span></h3>
<span class="tk-price">${rand(it.price)}</span>
${it.text ? `<p class="tk-dish-text">${tkT(it.text)}</p>` : ''}
<div class="tk-dish-foot"><span class="tk-tags">${tags(it)}</span><a class="tk-btn tk-btn-line tk-btn-sm" href="${TK_ORDER}?add=${esc(it.id)}">Order this<span class="tk-sr">: ${tkT(it.name)}</span></a></div>
</li>`).join('')}</ul>
${c.extras ? extras : ''}
</section>`).join('');
  return `<section class="tk-pagehead" aria-labelledby="tk-menu-h"><div class="tk-wrap"><p class="tk-eyebrow">Menu</p><h1 id="tk-menu-h">What we’re cooking</h1><p class="tk-lead">${tkT(TK.menuIntro)}</p></div></section>
<section class="tk-section tk-section-tight"><div class="tk-wrap" data-tk-tabs>
<div class="tk-tabs" role="tablist" aria-label="Menu sections" data-tk-tablist hidden>${tabs}</div>
${panels}
<ul class="tk-legend">${Object.entries(TK.tags).map(([k, v]) => `<li><span class="tk-tag">${esc(k)}</span> ${esc(v)}</li>`).join('')}</ul>
<div class="tk-menu-cta"><h2>Hungry now?</h2><p>Order for collection and skip the queue. Pay when you pick it up.</p><a class="tk-btn tk-btn-main" href="${TK_ORDER}">${tkIcon('bag')}Start an order</a></div>
</div></section>`;
}

function tkBook() {
  const B = TK.book;
  const people = Array.from({ length: Number(B.maxPeople) || 12 }, (_, i) => `<option value="${i + 1}"${i === 1 ? ' selected' : ''}>${i + 1}</option>`).join('');
  return `<section class="tk-pagehead" aria-labelledby="tk-book-h"><div class="tk-wrap"><p class="tk-eyebrow">Tables</p><h1 id="tk-book-h">${tkT(B.heading)}</h1><p class="tk-lead">${tkT(B.lead)}</p></div></section>
<section class="tk-section tk-section-tight"><div class="tk-wrap tk-book">
<form class="tk-form" data-tk-book novalidate>
<p class="tk-nothing">${tkIcon('lock')}<span>Demo: nothing you type here is sent or stored.</span></p>
<div class="tk-row">
<div class="tk-field"><label for="bk-date">Date</label><input id="bk-date" name="date" type="date" required></div>
<div class="tk-field"><label for="bk-time">Time</label><select id="bk-time" name="time" required><option value="">Choose a date first</option></select></div>
</div>
<div class="tk-row">
<div class="tk-field"><label for="bk-people">Number of people</label><select id="bk-people" name="people" required>${people}</select></div>
<div class="tk-field"><label for="bk-name">Your name</label><input id="bk-name" name="name" type="text" autocomplete="given-name" maxlength="60" required></div>
</div>
<div class="tk-field"><label for="bk-note">A note for us <span class="tk-opt">(optional)</span></label><textarea id="bk-note" name="note" rows="3" maxlength="300" placeholder="e.g. A high chair, please"></textarea></div>
<button class="tk-btn tk-btn-main" type="submit">${tkIcon('calendar')}Request a table</button>
</form>
<aside class="tk-book-side" aria-label="Opening hours">
<div class="tk-card"><h2>${tkIcon('clock')}When we’re open</h2>${tkHoursTable(`${TK.name} opening hours`)}<p class="tk-hours-note">Tables can be booked up to an hour before closing.</p></div>
<div class="tk-card"><h2>${tkIcon('bag')}Just want food?</h2><p>Order for collection instead, and we’ll have it ready.</p><a class="tk-btn tk-btn-line" href="${TK_ORDER}">Order for collection</a></div>
</aside>
</div></section>
<div class="tk-sheet" role="dialog" aria-modal="true" aria-labelledby="tk-sheet-h" data-tk-sheet hidden>
<div class="tk-sheet-back" data-tk-close></div>
<div class="tk-sheet-box">
<button class="tk-sheet-close" type="button" data-tk-close>${tkIcon('close')}<span class="tk-sr">Close</span></button>
<h2 id="tk-sheet-h" tabindex="-1">${tkT(B.panelHeading)}</h2>
<div class="tk-chat"><p class="tk-chat-top"><span class="tk-chat-av" data-tk-initial>S</span><span><span data-tk-from>New customer</span><small>WhatsApp · from your website</small></span></p><p class="tk-bubble"><span data-tk-message></span><span class="tk-bubble-time" data-tk-stamp></span></p></div>
<p class="tk-sheet-note">${tkIcon('phone')}<span>${tkT(B.panelNote)}</span></p>
<button class="tk-btn tk-btn-main" type="button" data-tk-close>Close and start again</button>
</div>
</div>`;
}

function tkFind() {
  const F = TK.find;
  return `<section class="tk-pagehead" aria-labelledby="tk-findus-h"><div class="tk-wrap"><p class="tk-eyebrow">Find us</p><h1 id="tk-findus-h">${tkT(TK.address)}</h1><p class="tk-lead">${tkT(F.lead)}</p></div></section>
<section class="tk-section tk-section-tight"><div class="tk-wrap tk-find">
<div class="tk-card">${tkMap()}<p class="tk-address">${tkIcon('pin')}<span>${tkT(TK.address)}, ${tkT(TK.town)}</span></p><p class="tk-parking">${tkIcon('parking')}<span>${tkT(F.parking)}</span></p>
<div class="tk-btns"><button class="tk-btn tk-btn-main" type="button" data-tk-toast="${esc(typo(F.directionsToast))}">${tkIcon('pin')}Get directions</button><button class="tk-btn tk-btn-olive" type="button" data-tk-toast="${esc(typo(F.whatsappToast))}">${tkIcon('chat')}WhatsApp us</button><button class="tk-btn tk-btn-line" type="button" data-tk-toast="${esc(typo(F.callToast))}">${tkIcon('phone')}Call us</button></div></div>
<div class="tk-card"><h2>${tkIcon('clock')}Opening hours</h2>${tkHoursTable(`${TK.name} opening hours`)}<p class="tk-hours-note">${tkT(TK.grill.note)}</p><p class="tk-status" data-tk-status><span class="tk-status-dot" aria-hidden="true"></span><span data-tk-status-text>Open every day.</span></p></div>
</div></section>`;
}

function tkNotFound() {
  const N = TK.notFound;
  return `<section class="tk-404" aria-labelledby="tk-404-h"><div class="tk-wrap"><div class="tk-404-mark">${tkIcon('kettle')}</div><h1 id="tk-404-h">${tkT(N.heading)}</h1><p class="tk-lead">${tkT(N.lead)}</p><div class="tk-btns"><a class="tk-btn tk-btn-main" href="${TK_URL}">Home</a><a class="tk-btn tk-btn-line" href="${TK_URL}menu">Menu</a><a class="tk-btn tk-btn-line" href="${TK_URL}book">Book a table</a><a class="tk-btn tk-btn-line" href="${TK_URL}find-us">Find us</a></div></div></section>`;
}

function tinKettlePages() {
  const desc = TK.seo.description;
  return [
    { key: 'home', url: TK_URL, out: 'examples/tin-kettle/index.html', title: TK.seo.title, description: desc, body: tkHome() },
    { key: 'menu', url: `${TK_URL}menu`, out: 'examples/tin-kettle/menu.html', title: `Menu | ${TK.name} (demo)`, description: desc, body: tkMenu() },
    { key: 'book', url: `${TK_URL}book`, out: 'examples/tin-kettle/book.html', title: `Book a table | ${TK.name} (demo)`, description: desc, body: tkBook() },
    { key: 'find', url: `${TK_URL}find-us`, out: 'examples/tin-kettle/find-us.html', title: `Find us | ${TK.name} (demo)`, description: desc, body: tkFind() },
    { key: '404', url: `${TK_URL}404`, out: 'examples/tin-kettle/404.html', title: `Page not found | ${TK.name} (demo)`, description: desc, body: tkNotFound() }
  ];
}

function tkFavicon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#C2603C"/><g transform="translate(12 11) scale(1.7)" fill="none" stroke="#FFFBF4" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${TK_ICONS.kettle}</g></svg>\n`;
}

/* ---------- the four tools: one self-contained HTML file each ---------- */

// Each tool's source has <!-- demo:head --> and <!-- demo:ribbon --> where the share tags
// and the ribbon go. The ordering tool also gets Tin Kettle's menu at <!-- demo:tin-kettle -->,
// so the menu, prices and hours live in one place.
function demoTools() {
  const dir = path.join(EX_DIR, 'tools');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => {
    const slug = d.name;
    const file = path.join(dir, slug, 'index.html');
    if (!fs.existsSync(file)) { warn(`src/examples/tools/${slug}/ has no index.html, so it was skipped.`); return null; }
    const url = `/examples/tools/${slug}/`;
    const item = examples.find((e) => e.url === url);
    if (!item) warn(`The tool at ${url} isn't in examples.items in content.json.`);
    const business = item ? item.business || item.title : slug;
    let html = fs.readFileSync(file, 'utf8');
    const title = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || business;
    const description = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';
    const tkData = JSON.stringify({ name: TK.name, short: TK.short, site: TK_URL, menu: `${TK_URL}menu`, hours: TK.hours, grill: TK.grill, menuCats: TK.menu, extras: TK.extras, tags: TK.tags }).replace(/</g, '\\u003c');
    html = html
      .replace('<!-- demo:head -->', `${demoShareTags(title.replace(/&amp;/g, '&'), description.replace(/&amp;/g, '&'), url)}\n<style>${RIBBON_CSS}</style>`)
      .replace('<!-- demo:ribbon -->', demoRibbon('tool', business))
      .replace('<!-- demo:tin-kettle -->', `<script type="application/json" id="tk-data">${tkData}</script>`);
    // Lighter to load: comments and indentation out of the inline style and script.
    html = html
      .replace(/<style>([\s\S]*?)<\/style>/g, (m, css) => `<style>${minifyCss(css)}</style>`)
      .replace(/<script>([\s\S]*?)<\/script>/g, (m, js) => `<script>${js.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//')).join('\n')}</script>`);
    if (!/<meta name="robots" content="noindex">/.test(html)) warn(`${url}: add <meta name="robots" content="noindex"> to the tool's <head>.`);
    if (/<script[^>]+src=|<link[^>]+rel="stylesheet"/i.test(html)) warn(`${url}: tools load no outside scripts or stylesheets; inline them.`);
    if (/\b(fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/.test(html)) warn(`${url}: tools never send anything (found a network call).`);
    if (/\son[a-z]+="/i.test(html) || /\sstyle="/i.test(html)) warn(`${url}: no inline event handlers or style="" attributes (the security policy blocks them).`);
    // Hashes of the inline <script> and <style> blocks, for the page's security policy.
    const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;
    const scripts = [...html.matchAll(/<script(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/g)].map((m) => sha(m[1]));
    const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => sha(m[1]));
    return { slug, url, out: `examples/tools/${slug}/index.html`, html, scripts, styles };
  }).filter(Boolean);
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

  const css = `${minifyCss(fs.readFileSync(path.join(ROOT, 'src/styles.css'), 'utf8'))}\n${optionsCss()}`;
  const js = `${fs.readFileSync(path.join(ROOT, 'src/calc.js'), 'utf8')}\n${fs.readFileSync(path.join(ROOT, 'src/site.js'), 'utf8')}`;
  assets = { css: `/assets/styles.${hash(css)}.css`, js: `/assets/site.${hash(js)}.js` };
  write(assets.css, css);
  write(assets.js, js);
  copyDir(path.join(ROOT, 'src/fonts'), path.join(OUT, 'fonts'), (f) => f.endsWith('.woff2'));
  copyDir(path.join(EX_DIR, 'fonts'), path.join(OUT, 'fonts'), (f) => f.endsWith('.woff2'));
  copyDir(path.join(ROOT, 'src/img'), path.join(OUT, 'img'));
  copyDir(path.join(ROOT, 'src/static'), OUT);

  // The demo website (its own stylesheet and script) and the four tools.
  const tkCss = `${minifyCss(fs.readFileSync(path.join(EX_DIR, 'tin-kettle/tin-kettle.css'), 'utf8'))}\n${RIBBON_CSS}`;
  const tkJs = fs.readFileSync(path.join(EX_DIR, 'tin-kettle/tin-kettle.js'), 'utf8');
  const tkAssets = { css: `/assets/tin-kettle.${hash(tkCss)}.css`, js: `/assets/tin-kettle.${hash(tkJs)}.js` };
  write(tkAssets.css, tkCss);
  write(tkAssets.js, tkJs);
  write('examples/tin-kettle/favicon.svg', tkFavicon());
  const demoPages = tinKettlePages();
  for (const p of demoPages) write(p.out, tkLayout(p, tkAssets));
  const tools = demoTools();
  for (const tool of tools) {
    write(tool.out, tool.html);
    const kb = Buffer.byteLength(tool.html) / 1024;
    if (kb > 120) warn(`${tool.url} is ${Math.round(kb)} KB; keep each tool under 120 KB.`);
  }

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
${demoHeaders(tools)}`);

  checkOutput();

  const n = pages.length;
  const where = OUT.startsWith(ROOT + path.sep) ? path.relative(ROOT, OUT) : OUT;
  console.log(`Built ${n} pages, the ${TK.name} demo (${demoPages.length} pages) and ${tools.length} demo tools into ${where}/ in ${Date.now() - started} ms.`);
  const todo = placeholderReport();
  if (todo.length) console.log(`Still to fill in (hidden on the site until then): ${todo.join(', ')}`);
  if (warnings.size) {
    console.log(`\n${warnings.size} warning${warnings.size === 1 ? '' : 's'}:`);
    for (const w of warnings) console.log(`  - ${w}`);
    process.exitCode = 1;
  }
}

// The demos may be shown in a frame on /examples (same site only), are never indexed, and can't
// send anything anywhere. Each tool's inline script and style are allowed by their hashes.
// These rules come after "/*", so they replace its frame and security policy for these paths.
function demoHeaders(tools) {
  const base = "img-src 'self' data:; font-src 'self'; connect-src 'none'; form-action 'none'; frame-ancestors 'self'; base-uri 'none'; object-src 'none'";
  const rule = (pathPattern, csp) => `
${pathPattern}
  ! X-Frame-Options
  ! Content-Security-Policy
  X-Frame-Options: SAMEORIGIN
  X-Robots-Tag: noindex
  Content-Security-Policy: ${csp}
`;
  return [
    rule(`${TK_URL}*`, `default-src 'self'; script-src 'self'; style-src 'self'; ${base}`),
    ...tools.map((tool) => rule(`${tool.url}*`, `default-src 'self'; script-src ${tool.scripts.join(' ') || "'none'"}; style-src ${tool.styles.join(' ') || "'none'"}; ${base}`))
  ].join('');
}

function placeholderReport() {
  const out = [];
  (function scan(o, p) {
    if (typeof o === 'string') { if (/^\s*TODO\b/i.test(o)) out.push(p); return; }
    if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!k.startsWith('_')) scan(o[k], p ? `${p}.${k}` : k);
  })(C, '');
  return out
    .filter((p) => yearlyOn || !p.endsWith('.payfastYearly'))
    .map((p) => p.replace(/^website\.options\.(\d+)\.(payfast|payfastYearly)$/, (m, i, k) => `${k === 'payfastYearly' ? 'yearly ' : ''}payfast (${options[i].monthly ? `${planName(options[i])}, monthly` : 'the yearly renewal'}, optional)`));
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
      if (/^data:/i.test(v)) continue;
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

// Like Cloudflare: an unknown address gets the nearest 404.html (e.g. the demo cafe's own).
function nearest404(urlPath) {
  let dir = path.posix.dirname(urlPath.endsWith('/') ? `${urlPath}x` : urlPath);
  for (;;) {
    const file = path.join(OUT, dir, '404.html');
    if (!dir.includes('..') && fs.existsSync(file)) return file;
    if (dir === '/' || dir === '.') return path.join(OUT, '404.html');
    dir = path.posix.dirname(dir);
  }
}

function serve(port) {
  http.createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    const target = resolveLocal(urlPath);
    const file = target ? path.join(OUT, target) : nearest404(urlPath);
    res.writeHead(target ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  }).listen(port, () => console.log(`\nPreview: http://localhost:${port}  (Ctrl+C to stop)`));
}

build();
if (SERVE) serve(SERVE === true ? 8080 : Number(SERVE));
