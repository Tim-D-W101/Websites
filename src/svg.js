/* Inline SVG artwork used by build.js. All decorative (aria-hidden) unless noted.
   Colours match the logo: navy #124B78 / door #0D436F / sand #F0D1A2 / light #FEC458 -> #FFE58E. */
'use strict';

let uid = 0;
const id = (p) => `${p}${++uid}`;

const lightStops = '<stop offset="0" stop-color="#FEC458"/><stop offset=".5" stop-color="#FFE58E"/><stop offset="1" stop-color="#FEC458"/>';

// The logo mark: a browser window with a front door ajar.
function logo(cls = 'logo') {
  const g = id('lg');
  return `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true" focusable="false"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1">${lightStops}</linearGradient></defs><rect width="100" height="100" rx="22" fill="#F0D1A2"/><rect x="15" y="14" width="70" height="72" rx="9" fill="none" stroke="#124B78" stroke-width="5"/><path d="M15 28h70" stroke="#124B78" stroke-width="4.5"/><g fill="#316A97"><circle cx="24" cy="21" r="2.6"/><circle cx="31.5" cy="21" r="2.6"/><circle cx="39" cy="21" r="2.6"/></g><path d="M36 84V38h12v46" fill="url(#${g})" stroke="#124B78" stroke-width="3.5" stroke-linejoin="round"/><path d="M47 35.5l19 4.5v39.5L49.5 84H47z" fill="#0D436F" stroke="#0D436F" stroke-width="1.5" stroke-linejoin="round"/><circle cx="52" cy="60" r="2.4" fill="#417DAF"/></svg>`;
}

// Home hero: the browser-window front door, light spilling onto the stoep, an aloe in a pot,
// and a small app window (chart + table) for the business tools.
function hero() {
  const l = id('hl'), s = id('hs'), gl = id('hg');
  return `<svg class="hero-art" viewBox="0 0 600 470" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${l}" x1="0" y1="0" x2="0" y2="1">${lightStops}</linearGradient>
<linearGradient id="${s}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58E" stop-opacity=".95"/><stop offset="1" stop-color="#FEC458" stop-opacity="0"/></linearGradient>
<radialGradient id="${gl}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE58E" stop-opacity=".75"/><stop offset="1" stop-color="#FFE58E" stop-opacity="0"/></radialGradient>
</defs>
<circle cx="270" cy="220" r="205" fill="#F6E3C1"/>
<path d="M10 452h580" stroke="#E2C998" stroke-width="3" stroke-linecap="round"/>
<path d="M262 380h63l78 72H186z" fill="url(#${s})"/>
<rect x="60" y="36" width="400" height="340" rx="28" fill="#FFFBF3"/>
<ellipse cx="300" cy="250" rx="120" ry="150" fill="url(#${gl})"/>
<rect x="60" y="36" width="400" height="340" rx="28" fill="none" stroke="#124B78" stroke-width="10"/>
<path d="M60 92h400" stroke="#124B78" stroke-width="8"/>
<g fill="#316A97"><circle cx="98" cy="64" r="8"/><circle cx="123" cy="64" r="8"/><circle cx="148" cy="64" r="8"/></g>
<rect x="180" y="50" width="250" height="28" rx="14" fill="#F0D1A2"/>
<path d="M199 63v-3a5 5 0 0 1 10 0v3" fill="none" stroke="#0D436F" stroke-width="2.2"/><rect x="196" y="62" width="16" height="11" rx="2.5" fill="#0D436F"/>
<text x="222" y="70" class="art-url">yourbusiness.co.za</text>
<rect x="96" y="128" width="124" height="16" rx="8" fill="#124B78"/>
<rect x="96" y="158" width="104" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="96" y="176" width="116" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="96" y="194" width="86" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="96" y="222" width="104" height="34" rx="17" fill="#FEC458"/>
<text x="148" y="244" class="art-btn" text-anchor="middle">Book now</text>
<path d="M262 371V128h64v243" fill="url(#${l})" stroke="#124B78" stroke-width="7" stroke-linejoin="round"/>
<path d="M321 114l100 24v210l-87 25h-13z" fill="#0D436F" stroke="#0D436F" stroke-width="4" stroke-linejoin="round"/>
<circle cx="349" cy="246" r="11" fill="#417DAF"/>
<rect x="236" y="390" width="118" height="26" rx="6" fill="#D6AE78"/>
<text x="295" y="408" class="art-mat" text-anchor="middle">WELCOME</text>
<path d="M58 402l-8-62 14 40 2-58 12 58 12-46-4 64" fill="#5E8C61"/>
<path d="M66 402l-22-40 30 28M78 402l26-46-18 48" fill="none" stroke="#4C7A50" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M36 400h68l-7 52H43z" fill="#C46A3A"/><path d="M33 396h74v10H33z" fill="#A9552B"/>
<rect x="428" y="196" width="160" height="178" rx="16" fill="#FFFBF3" stroke="#124B78" stroke-width="7"/>
<path d="M428 226h160" stroke="#124B78" stroke-width="5"/>
<g fill="#316A97"><circle cx="446" cy="211" r="4.5"/><circle cx="460" cy="211" r="4.5"/><circle cx="474" cy="211" r="4.5"/></g>
<path d="M446 300h124" stroke="#E4CFA9" stroke-width="3" stroke-linecap="round"/>
<g fill="#124B78"><rect x="450" y="270" width="16" height="30" rx="3"/><rect x="474" y="252" width="16" height="48" rx="3"/><rect x="498" y="262" width="16" height="38" rx="3"/></g>
<rect x="522" y="238" width="16" height="62" rx="3" fill="#FEC458"/><rect x="546" y="244" width="16" height="56" rx="3" fill="#124B78"/>
<g fill="#E4CFA9"><rect x="446" y="316" width="70" height="8" rx="4"/><rect x="446" y="334" width="56" height="8" rx="4"/><rect x="446" y="352" width="64" height="8" rx="4"/></g>
<g fill="#1E6B3A"><circle cx="562" cy="320" r="5"/><circle cx="562" cy="338" r="5"/></g><circle cx="562" cy="356" r="5" fill="#FEC458"/>
</svg>`;
}

// Home page front door, drawn in two layers with the same viewBox (0 0 560 600). The 3D door
// leaf sits between them (build.js), over the doorway at x 211–349, y 203.5–516.
// Back layer: the browser window, the page on the wall, lantern, plant, step, mat and light spill.
function doorBack(o) {
  const fan = id('df'), spill = id('dp'), lamp = id('dl'), aura = id('da');
  const btn = String(o.bookButton || 'Book now');
  const btnW = Math.max(96, Math.round(btn.length * 8.2 + 32));
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<svg class="door-art door-back" viewBox="0 0 560 600" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${fan}" x1="0" y1="1" x2="0" y2="0">${lightStops}</linearGradient>
<linearGradient id="${spill}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58E" stop-opacity=".95"/><stop offset="1" stop-color="#FEC458" stop-opacity="0"/></linearGradient>
<radialGradient id="${lamp}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE58E" stop-opacity=".9"/><stop offset="1" stop-color="#FFE58E" stop-opacity="0"/></radialGradient>
<radialGradient id="${aura}" cx=".5" cy=".55" r=".5"><stop offset="0" stop-color="#FFE58E" stop-opacity=".75"/><stop offset=".6" stop-color="#FFE58E" stop-opacity=".25"/><stop offset="1" stop-color="#FFE58E" stop-opacity="0"/></radialGradient>
</defs>
<rect x="20" y="20" width="520" height="560" rx="36" fill="#FFFBF3"/>
<ellipse class="door-aura" cx="280" cy="372" rx="215" ry="235" fill="url(#${aura})"/>
<rect x="62" y="132" width="110" height="15" rx="7.5" fill="#124B78"/>
<rect x="62" y="160" width="96" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="62" y="178" width="78" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="62" y="202" width="${btnW}" height="32" rx="16" fill="#FEC458"/>
<text x="${62 + btnW / 2}" y="223" class="art-btn" text-anchor="middle">${esc(btn)}</text>
<rect x="396" y="130" width="108" height="30" rx="15" fill="#E3F1E6"/>
<circle cx="414" cy="145" r="5.5" fill="#1E6B3A"/>
<text x="426" y="150" class="art-small art-open">${esc(o.openSign || 'Open now')}</text>
<circle class="door-lamp" cx="410" cy="298" r="58" fill="url(#${lamp})"/>
<path d="M384 262h26v9" fill="none" stroke="#124B78" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M398 277h24l-4 44h-16z" fill="#FFE58E" stroke="#124B78" stroke-width="5" stroke-linejoin="round"/>
<path d="M410 286v26" stroke="#FEC458" stroke-width="4" stroke-linecap="round"/>
<path d="M394 274h32M401 325h18" stroke="#124B78" stroke-width="6" stroke-linecap="round"/>
<path class="door-fan" d="M211 200a69 69 0 0 1 138 0z" fill="url(#${fan})"/>
<rect x="188" y="516" width="184" height="15" rx="4" fill="#E2C998"/>
<rect x="230" y="541" width="100" height="22" rx="5" fill="#D6AE78"/>
<text x="280" y="556" class="art-mat" text-anchor="middle">${esc(o.mat || 'WELCOME')}</text>
<path class="door-spill" d="M213 517h134l58 58H155z" fill="url(#${spill})"/>
<g transform="translate(40 123)">
<path d="M58 402l-8-62 14 40 2-58 12 58 12-46-4 64" fill="#5E8C61"/>
<path d="M66 402l-22-40 30 28M78 402l26-46-18 48" fill="none" stroke="#4C7A50" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M36 400h68l-7 52H43z" fill="#C46A3A"/><path d="M33 396h74v10H33z" fill="#A9552B"/>
</g>
<rect x="20" y="20" width="520" height="560" rx="36" fill="none" stroke="#124B78" stroke-width="10"/>
<path d="M20 90h520" stroke="#124B78" stroke-width="8"/>
<g fill="#316A97"><circle cx="62" cy="55" r="9"/><circle cx="90" cy="55" r="9"/><circle cx="118" cy="55" r="9"/></g>
<rect x="148" y="37" width="352" height="36" rx="18" fill="#F0D1A2"/>
<path d="M170 54v-4a6 6 0 0 1 12 0v4" fill="none" stroke="#0D436F" stroke-width="2.6"/><rect x="166" y="53" width="20" height="13" rx="3" fill="#0D436F"/>
<text x="196" y="61" class="art-url">${esc(o.address || 'yourbusiness.co.za')}</text>
</svg>`;
}

// Front layer: the door frame, the transom and the fanlight bars, drawn over the door leaf.
function doorFront() {
  return `<svg class="door-art door-front" viewBox="0 0 560 600" aria-hidden="true" focusable="false">
<path d="M206 521V200a74 74 0 0 1 148 0v321" fill="none" stroke="#124B78" stroke-width="10" stroke-linejoin="round"/>
<path d="M206 200h148" stroke="#124B78" stroke-width="7"/>
<path d="M280 200l-48.8-48.8M280 200v-69M280 200l48.8-48.8" stroke="#124B78" stroke-width="4"/>
<path d="M266 200a14 14 0 0 1 28 0z" fill="#124B78"/>
</svg>`;
}

// "How it works" doors: 1 closed, 2 ajar, 3 wide open with light, 4 open and done (tick).
function stepDoor(n) {
  const l = id('sd');
  const frame = `<path d="M18 56V9h28v47" fill="url(#${l})" stroke="#124B78" stroke-width="3.5" stroke-linejoin="round"/>`;
  const floor = '<path d="M6 56.5h52" stroke="#124B78" stroke-width="3" stroke-linecap="round"/>';
  let door = '';
  if (n === 1) door = '<rect x="19.75" y="10.75" width="24.5" height="45.25" fill="#0D436F"/><circle cx="39" cy="34" r="2" fill="#417DAF"/>';
  if (n === 2) door = '<path d="M28 7.5l16 4v40.5L29.5 56H28z" fill="#0D436F" stroke="#0D436F" stroke-width="1.5" stroke-linejoin="round"/><circle cx="32" cy="33" r="2" fill="#417DAF"/>';
  if (n >= 3) door = '<path d="M46 9l11 6v36l-11 5z" fill="#0D436F"/><path d="M20 57h24l12 6H8z" fill="#FFE58E"/>';
  if (n === 4) door += '<circle cx="50" cy="12" r="9" fill="#1E6B3A"/><path d="M45.5 12l3 3 6-6" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
  return `<svg class="step-door" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><defs><linearGradient id="${l}" x1="0" y1="0" x2="0" y2="1">${n === 1 ? '<stop offset="0" stop-color="#0D436F"/><stop offset="1" stop-color="#0D436F"/>' : lightStops}</linearGradient></defs>${frame}${door}${floor}</svg>`;
}

// "Lights on" (home page): a shopfront at night. The lit parts are separate layers that
// site.js and the styles switch on one at a time: the window (shop-l1), the open sign and lamp
// (shop-l2), the name board (shop-l3), the awning (shop-l4), the web address (shop-l5), then
// the door opens (shop-l6). Without that, everything shows lit.
function shop(o) {
  const glass = id('sg'), lamp = id('sl'), spill = id('ss'), room = id('sr');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const name = String(o.sign || '');
  const nameSize = Math.min(26, Math.floor(390 / Math.max(1, name.length)));
  // Twelve stripes, wider at the top, each with a rounded flap below.
  const awning = (a, b) => Array.from({ length: 12 }, (_, i) => {
    const tl = 44 + i * 32.667, bl = 58 + i * 30.333, w = 30.333, c = i % 2 ? b : a;
    return `<path d="M${tl.toFixed(1)} 154H${(tl + 32.667).toFixed(1)}L${(bl + w).toFixed(1)} 186H${bl.toFixed(1)}z" fill="${c}"/><path d="M${bl.toFixed(1)} 185.5h${w.toFixed(1)}v5a${(w / 2).toFixed(2)} ${(w / 2).toFixed(2)} 0 0 1-${w.toFixed(1)} 0z" fill="${c}"/>`;
  }).join('');
  const frames = [72, 140, 208];
  return `<svg class="shop-art" viewBox="0 0 480 380" aria-hidden="true" focusable="false">
<defs>
<linearGradient id="${glass}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF6D6"/><stop offset=".55" stop-color="#FFE58E"/><stop offset="1" stop-color="#FEC458"/></linearGradient>
<radialGradient id="${lamp}" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE58E" stop-opacity=".95"/><stop offset="1" stop-color="#FFE58E" stop-opacity="0"/></radialGradient>
<linearGradient id="${spill}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58E" stop-opacity=".85"/><stop offset="1" stop-color="#FEC458" stop-opacity="0"/></linearGradient>
<radialGradient id="${room}" cx=".5" cy=".9" r=".9"><stop offset="0" stop-color="#FFFDF4"/><stop offset=".45" stop-color="#FFE58E"/><stop offset="1" stop-color="#FEC458"/></radialGradient>
</defs>
<circle cx="440" cy="26" r="13" fill="#F6E7B8"/><circle cx="447" cy="21" r="11" fill="#0A2A44"/>
<g fill="#F6E7B8"><circle cx="36" cy="22" r="1.6"/><circle cx="92" cy="30" r="1.2"/><circle cx="352" cy="14" r="1.4"/><circle cx="470" cy="70" r="1.2"/><circle cx="14" cy="88" r="1.1"/><circle cx="214" cy="18" r="1"/></g>
<rect x="40" y="52" width="400" height="290" rx="6" fill="#163650"/>
<rect x="28" y="42" width="424" height="18" rx="5" fill="#0F2B44"/>
<rect x="120" y="70" width="240" height="50" rx="12" fill="#1D3E5B"/>
<text class="shop-name shop-name-off" x="240" y="104" font-size="${nameSize}" text-anchor="middle">${esc(name)}</text>
<g class="shop-l3"><rect x="120" y="70" width="240" height="50" rx="12" fill="#124B78" stroke="#FEC458" stroke-width="3"/><text class="shop-name" x="240" y="104" font-size="${nameSize}" text-anchor="middle">${esc(name)}</text></g>
<g class="shop-l5"><rect x="160" y="127" width="160" height="21" rx="10.5" fill="#FFF3D6"/><text class="shop-url" x="240" y="141.5" text-anchor="middle">${esc(o.address)}</text></g>
<g class="shop-awning-off">${awning('#22435F', '#1A3851')}</g>
<g class="shop-l4">${awning('#FFF3D6', '#FEC458')}</g>
<rect x="60" y="222" width="212" height="108" rx="6" fill="#0D263C"/>
<path d="M76 232h34l-50 70z" fill="#1B4565" opacity=".55"/>
<g class="shop-l1">
<rect x="60" y="222" width="212" height="108" rx="6" fill="url(#${glass})"/>
<g fill="#FFFBF3" stroke="#124B78" stroke-width="3">${frames.map((x) => `<rect x="${x}" y="236" width="52" height="40" rx="4"/>`).join('')}</g>
<g fill="#F0D1A2"><path d="M78 270l12-14 9 9 7-6 12 11z"/><circle cx="166" cy="252" r="7"/><path d="M146 270l20-12 20 12z"/><path d="M214 270l10-16 8 8 6-4 16 12z"/></g>
<g fill="#124B78">${frames.map((x) => `<rect x="${x + 4}" y="288" width="44" height="15" rx="7.5"/>`).join('')}</g>
<g class="shop-tag" fill="#FFE58E" text-anchor="middle">${['R350', 'R650', 'R280'].map((s, i) => `<text x="${frames[i] + 26}" y="299.5">${s}</text>`).join('')}</g>
</g>
<rect x="60" y="222" width="212" height="108" rx="6" fill="none" stroke="#0F2B44" stroke-width="6"/>
<path d="M292 212h-6v8" fill="none" stroke="#0F2B44" stroke-width="4" stroke-linecap="round"/>
<g class="shop-l2"><circle cx="286" cy="234" r="40" fill="url(#${lamp})"/></g>
<path d="M279 222h14l-3 24h-8z" fill="#2C4762" stroke="#0F2B44" stroke-width="3" stroke-linejoin="round"/>
<path class="shop-l2" d="M282 226h8l-2 16h-4z" fill="#FFE58E"/>
<rect x="312" y="214" width="100" height="128" fill="#0B2034"/>
<rect class="shop-l6" x="312" y="214" width="100" height="128" fill="url(#${room})"/>
<g class="shop-door"><rect x="314" y="216" width="96" height="126" fill="#0D436F"/><rect x="326" y="230" width="72" height="44" rx="3" fill="#0B2A44"/><rect class="shop-l2" x="326" y="230" width="72" height="44" rx="3" fill="#FFE58E" opacity=".45"/><rect x="326" y="286" width="72" height="42" rx="3" fill="none" stroke="#124B78" stroke-width="3"/><circle cx="400" cy="282" r="4.5" fill="#FEC458"/>
<g class="shop-sign"><path d="M350 238l12-10 12 10" fill="none" stroke="#E2C998" stroke-width="2"/><rect x="334" y="238" width="56" height="22" rx="5" fill="#2C4762"/><text class="shop-sign-text" x="362" y="253.5" text-anchor="middle" fill="#9FB2C2">${esc(o.closed)}</text><g class="shop-l2"><rect x="334" y="238" width="56" height="22" rx="5" fill="#1E6B3A"/><text class="shop-sign-text" x="362" y="253.5" text-anchor="middle" fill="#FFFFFF">${esc(o.open)}</text></g></g></g>
<path d="M308 342V210h108v132" fill="none" stroke="#0F2B44" stroke-width="8" stroke-linejoin="round"/>
<rect x="0" y="342" width="480" height="38" fill="#0D2235"/>
<path d="M0 342h480" stroke="#1B4060" stroke-width="3"/>
<path class="shop-l1" d="M60 342h212l40 38H20z" fill="url(#${spill})" opacity=".55"/>
<path class="shop-l6" d="M312 342h100l52 38H262z" fill="url(#${spill})"/>
<g transform="translate(397.5 61.8) scale(.62)"><path d="M58 402l-8-62 14 40 2-58 12 58 12-46-4 64" fill="#3F6F48"/><path d="M66 402l-22-40 30 28M78 402l26-46-18 48" fill="none" stroke="#335E3B" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><path d="M36 400h68l-7 52H43z" fill="#8E4A28"/><path d="M33 396h74v10H33z" fill="#77401F"/></g>
</svg>`;
}

// "Open all night" (home page): a clock face. The hands are separate, so the styles can turn them.
function clockFace() {
  const ticks = Array.from({ length: 12 }, (_, i) => `<path d="M100 ${i % 3 ? 16 : 13}v${i % 3 ? 9 : 15}" transform="rotate(${i * 30} 100 100)"/>`).join('');
  return `<svg class="clock-art" viewBox="0 0 200 200" aria-hidden="true" focusable="false">
<circle cx="100" cy="100" r="94" fill="#FFFBF3" stroke="#124B78" stroke-width="8"/>
<g stroke="#124B78" stroke-width="4" stroke-linecap="round">${ticks}</g>
<g class="clock-hand clock-hour"><path d="M100 104V58" stroke="#0A2A44" stroke-width="9" stroke-linecap="round"/></g>
<g class="clock-hand clock-min"><path d="M100 108V30" stroke="#124B78" stroke-width="6" stroke-linecap="round"/></g>
<circle cx="100" cy="100" r="9" fill="#FEC458" stroke="#0A2A44" stroke-width="3"/>
</svg>`;
}

// Line icons (24x24, stroke). Feather-style shapes.
const ICONS = {
  bed: '<path d="M3 19V6M3 11h18v8M3 15h18M21 19v-2"/><rect x="5.5" y="8" width="6" height="3" rx="1"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  cup: '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>',
  phone: '<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M11 18h2"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  pencil: '<path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
  chat: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5z"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  card: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="m9 14 2 2 4-4"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.7z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/>',
  chart: '<path d="M3 3v18h18"/><path d="M8 17v-5M13 17V8M18 17v-9"/>',
  form: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  search: '<circle cx="11" cy="11" r="7.5"/><path d="m20.5 20.5-4.2-4.2"/>',
  chevron: '<path d="m6 9 6 6 6-6"/>',
  down: '<path d="M12 5v14M19 12l-7 7-7-7"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
  rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>'
};

function icon(name, cls = 'icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;
}

// WhatsApp glyph (Simple Icons, CC0).
function whatsapp(cls = 'icon') {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>`;
}

// Niche page hero: a phone showing a generic site for that kind of business (no real business).
const PHONE = {
  guesthouses: { name: 'Your Guesthouse', cta: 'Book direct', icon: 'bed' },
  salons: { name: 'Your Salon', cta: 'Book now', icon: 'scissors' },
  restaurants: { name: 'Your Cafe', cta: 'View menu', icon: 'cup' },
  websites: { name: 'Your Business', cta: 'Get a quote', icon: 'globe' }
};

function phone(niche) {
  const p = PHONE[niche];
  const sky = id('ps');
  let rows = '';
  if (niche === 'guesthouses') {
    rows = `<rect x="34" y="318" width="90" height="62" rx="10" fill="#F0D1A2"/><rect x="136" y="318" width="90" height="62" rx="10" fill="#F0D1A2"/>
<g fill="none" stroke="#124B78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(64 334) scale(1.25)">${ICONS.bed}</g><g transform="translate(166 334) scale(1.25)">${ICONS.bed}</g></g>
<rect x="34" y="390" width="70" height="8" rx="4" fill="#E4CFA9"/><rect x="136" y="390" width="70" height="8" rx="4" fill="#E4CFA9"/>`;
  } else if (niche === 'salons' || niche === 'websites') {
    rows = [0, 1, 2].map((i) => {
      const y = 322 + i * 30;
      return `<rect x="34" y="${y}" width="${[96, 80, 104][i]}" height="10" rx="5" fill="#124B78"/><path d="M${142 + [0, -16, 8][i]} ${y + 5}h40" stroke="#E4CFA9" stroke-width="3" stroke-dasharray="2 5" stroke-linecap="round"/><rect x="194" y="${y}" width="32" height="10" rx="5" fill="#124B78"/>`;
    }).join('') + '<g fill="#FEC458"><circle cx="40" cy="412" r="6"/><circle cx="56" cy="412" r="6"/><circle cx="72" cy="412" r="6"/><circle cx="88" cy="412" r="6"/><circle cx="104" cy="412" r="6"/></g>';
  } else {
    rows = `<rect x="34" y="318" width="96" height="26" rx="13" fill="#E3F1E6"/><circle cx="50" cy="331" r="5" fill="#1E6B3A"/><text x="61" y="336" class="art-small art-open">Open now</text>
<rect x="34" y="356" width="120" height="9" rx="4.5" fill="#E4CFA9"/><rect x="34" y="374" width="94" height="9" rx="4.5" fill="#E4CFA9"/>
<g fill="none" stroke="#124B78" stroke-width="2.5"><rect x="34" y="394" width="50" height="26" rx="13"/><rect x="92" y="394" width="50" height="26" rx="13"/></g>
<text x="59" y="411" class="art-small art-pill" text-anchor="middle">Call</text><text x="117" y="411" class="art-small art-pill" text-anchor="middle">Map</text>`;
  }
  return `<svg class="phone-art" viewBox="0 0 260 480" aria-hidden="true" focusable="false">
<defs><linearGradient id="${sky}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58E"/><stop offset="1" stop-color="#F0D1A2"/></linearGradient></defs>
<rect x="4" y="4" width="252" height="472" rx="38" fill="#0A2A44"/>
<rect x="16" y="16" width="228" height="448" rx="28" fill="#FFFBF3"/>
<rect x="100" y="24" width="60" height="12" rx="6" fill="#0A2A44"/>
<circle cx="42" cy="66" r="10" fill="#124B78"/>
<text x="60" y="71" class="art-name">${p.name}</text>
<path d="M210 60h16M210 66h16M210 72h16" stroke="#124B78" stroke-width="3" stroke-linecap="round"/>
<rect x="28" y="92" width="204" height="120" rx="16" fill="url(#${sky})"/>
<g transform="translate(106 128) scale(2)" fill="none" stroke="#124B78" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon]}</g>
<rect x="34" y="228" width="150" height="14" rx="7" fill="#124B78"/>
<rect x="34" y="250" width="112" height="9" rx="4.5" fill="#E4CFA9"/>
<rect x="34" y="270" width="${p.cta.length * 9 + 36}" height="32" rx="16" fill="#FEC458"/>
<text x="${34 + (p.cta.length * 9 + 36) / 2}" y="291" class="art-btn" text-anchor="middle">${p.cta}</text>
${rows}
<circle cx="212" cy="434" r="18" fill="#1E8E4E"/>
<g transform="translate(201 423) scale(.92)" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/></g>
</svg>`;
}

// Business tools page: an app window with a menu, stat tiles and a jobs table.
function app() {
  const rows = [['Paid', '#E3F1E6', '#1E6B3A'], ['Due', '#FFEDB8', '#0A2A44'], ['Paid', '#E3F1E6', '#1E6B3A'], ['Booked', '#F8EBD3', '#124B78']].map(([label, bg, fg], i) => {
    const y = 236 + i * 26;
    return `<rect x="138" y="${y}" width="${[96, 80, 104, 88][i]}" height="9" rx="4.5" fill="#E4CFA9"/><rect x="262" y="${y}" width="44" height="9" rx="4.5" fill="#E4CFA9"/><rect x="342" y="${y - 6}" width="62" height="20" rx="10" fill="${bg}"/><text x="373" y="${y + 8}" class="art-small" text-anchor="middle" fill="${fg}">${label}</text>`;
  }).join('');
  return `<svg class="app-art" viewBox="0 0 440 360" aria-hidden="true" focusable="false">
<rect x="8" y="8" width="424" height="336" rx="24" fill="#FFFBF3" stroke="#124B78" stroke-width="9"/>
<path d="M8 54h424" stroke="#124B78" stroke-width="7"/>
<g fill="#316A97"><circle cx="38" cy="31" r="6.5"/><circle cx="58" cy="31" r="6.5"/><circle cx="78" cy="31" r="6.5"/></g>
<rect x="104" y="19" width="190" height="24" rx="12" fill="#F0D1A2"/><text x="120" y="36" class="art-small" fill="#0D436F">app.yourbusiness.co.za</text>
<path d="M112 58v282" stroke="#F0D1A2" stroke-width="2"/>
<rect x="26" y="76" width="70" height="16" rx="8" fill="#124B78"/>
<g fill="#E4CFA9"><rect x="26" y="106" width="58" height="12" rx="6"/><rect x="26" y="132" width="64" height="12" rx="6"/><rect x="26" y="158" width="52" height="12" rx="6"/><rect x="26" y="184" width="60" height="12" rx="6"/></g>
<rect x="138" y="76" width="120" height="16" rx="8" fill="#124B78"/>
<rect x="330" y="70" width="84" height="28" rx="14" fill="#FEC458"/><text x="372" y="89" class="art-small" text-anchor="middle" fill="#0A2A44">+ New quote</text>
<g fill="#FFFFFF" stroke="#E4CFA9" stroke-width="2"><rect x="138" y="112" width="84" height="64" rx="12"/><rect x="234" y="112" width="84" height="64" rx="12"/><rect x="330" y="112" width="84" height="64" rx="12"/></g>
<g fill="#124B78"><rect x="152" y="128" width="40" height="14" rx="4"/><rect x="248" y="128" width="30" height="14" rx="4"/></g><rect x="344" y="128" width="46" height="14" rx="4" fill="#1E6B3A"/>
<g fill="#E4CFA9"><rect x="152" y="152" width="56" height="8" rx="4"/><rect x="248" y="152" width="56" height="8" rx="4"/><rect x="344" y="152" width="56" height="8" rx="4"/></g>
<rect x="132" y="196" width="282" height="24" rx="8" fill="#F8EBD3"/>
<g fill="#124B78"><rect x="142" y="204" width="44" height="8" rx="4"/><rect x="262" y="204" width="36" height="8" rx="4"/><rect x="348" y="204" width="40" height="8" rx="4"/></g>
${rows}
</svg>`;
}

module.exports = { logo, hero, doorBack, doorFront, stepDoor, shop, clockFace, icon, whatsapp, phone, app };
