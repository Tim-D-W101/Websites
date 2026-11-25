# Scroll experiences: three concept demos (branch `demos-2026-11-25`)

Based on 74f8dd8 (what is live on frontdoorsites.co.za). Adds three concept demo cards and nothing else: no price, offer, plan, headline or other copy changes.

Preview (noindex): https://fds-demos-preview.walzt60.workers.dev

## The demos

| Card | Opens (new tab) | Shows on |
|---|---|---|
| Spekboom House | https://preview.frontdoorsites.co.za/guesthouse-demo/ | Home, /examples, /guesthouses |
| Shisa Stack | https://preview.frontdoorsites.co.za/burger-demo/ | Home, /examples, /restaurants |
| Copperline Coffee Roasters | https://preview.frontdoorsites.co.za/scroll-demo/ | Home, /examples, /restaurants |

Each card has a poster thumbnail with alt text, the name, a one-line caption about what happens as you scroll, a "Concept demo" and "Fictional brand" label (read out as "Concept demo · Fictional brand") and a "Try the demo" link (`target="_blank" rel="noopener"`, with the site's hidden "(opens in a new tab)" hint). No price is shown.

## What changed

- **content.json**: three items in `examples.items` with the new `"status": "concept"` (first in the list), and `examples.scroll` (nav label, heading, lead, labels, button).
- **build.js**: `concept` is a third status. Concept items get their own card (`conceptCard`), a "Scroll experiences" section first on /examples (plus a link in the page's bar), and show on their `niche` page. They're kept off /websites and /business-tools. Industry pages now show up to 4 examples (was 3), so /restaurants keeps both Tin Kettle cards.
- **src/home/index.html**: a small "Scroll experiences" group under the three existing demo cards in "Demos you can try", with the same card markup the build makes, and its CSS (5 short rules).
- **src/styles.css**: 2 rules for the "Try the demo" link (sits at the bottom of the card, 44px tall, underline on hover).
- **src/img/examples/**: `spekboom-house.webp` (the lounge, 27 KB), `shisa-stack.webp` (the finished burger, 30 KB), `copperline.webp` (the milk pour, 12 KB). 960×600 like the other thumbnails, cropped from the desktop frames in `/workspace/mockups/v2/*-demo-2026-11-25/pack/` without the demo banner, header or headline.
- **README.md**: documents `"status": "concept"`.
- **wrangler.demos-preview.toml**: preview-only worker `fds-demos-preview` (a copy of `wrangler.preview.toml`).

## Side effect to know about

/guesthouses had no examples before, so it now gets an examples section, and its FAQ section turns from sand to white. That's the site's existing alternating-colour rule, not a new design change.

## Checks

- `node build.js` and `node build.js --preview`: no warnings.
- Built HTML diffed against the 74f8dd8 build: the only changes are the new cards and section, the /examples bar link, the stylesheet file name (new hash) and the /guesthouses FAQ colour above. `_headers` (CSP) and `sitemap.xml` are identical.
- Playwright (Chromium) on the preview at 390×844 and 1440×900: the home page first view matches live, apart from the door's typing bubble caught at a different moment. All three links open in a new tab and the demo URLs return 200. No console errors and no horizontal overflow on /, /examples, /guesthouses, /restaurants, /websites or /salons. Labels stay on one line per pill. Screenshots are in `/workspace/mockups/v2/fds-site-demos-qa/`.

Not deployed to production. Not pushed.
