# Demo sites: premium upgrade notes (2026-10-30)

The demos on `/examples` (the Tin Kettle Kitchen website and the four tools) were brought up to the calm, neat
standard of the v2 homepage (see `src/home/DESIGN-NOTES.md`). It's an upgrade, not a rebrand: every demo keeps its
name, its self-hosted fonts, the spirit of its palette and all of its features.

## Rules every demo now follows

- **Clearly a demo.** The Front Door Sites ribbon, `noindex`, the "Demo:" notes and "Reset demo" stay. No made-up
  reviews, star ratings, customer counts, awards or certifications.
- **Modest type.** h1 at most 3.5rem on desktop and 2.2rem at 390px wide. No tracked all-caps labels or eyebrows.
  Headings `text-wrap: balance`, body text `text-wrap: pretty`, leads capped at about 60 characters.
- **One clear action per demo**, in the demo's accent colour and nowhere else. Everything else is an outline or a
  text link.
- **A sticky action.** The main action (or WhatsApp) stays in reach: a bar on phones, a sticky header, aside or bar
  on desktop.
- **Subtle motion only.** A fade with a 8–12px rise, about 350–450ms ease-out, once. No pulses, bounces or press
  jumps. `prefers-reduced-motion: reduce` shows everything at rest.
- **Fast on mobile.** No new fonts or images and nothing loaded from elsewhere. Tin Kettle preloads its two fonts.
- **Tested** with Playwright at 390 and 1440 with the real `_headers` security policy: no horizontal scroll, no
  console errors, no CSP violations.

## UI UX Pro Max output (design-system generator, run per industry)

| Demo | Query | What it suggested | What we used |
|---|---|---|---|
| Tin Kettle Kitchen | family cafe grill restaurant warm | Minimalism & Swiss style; warm brown on cream; Playfair Display SC / Karla; avoid poor food photos and hidden hours; reveal = fade + 12px rise, ~350ms | The style, motion and "hours always visible" guidance. Kept Caprasimo / Work Sans and the terracotta palette (already warm brown on cream). |
| Tin Kettle ordering | restaurant online ordering collection | Funnel: progressive disclosure, show only what's needed per step; avoid outdated hours | The funnel and hours guidance, with the café's own tokens. |
| Bright Cuts | barbershop grooming men (first try "barber salon booking appointment" matched a generic calendar profile) | Hero + features + CTA, with the CTA sticky in the hero and again at the bottom; Outfit / Work Sans; blue and orange | The sticky CTA pattern. Kept Syne / Manrope and the black and pink. |
| Coastline Painting | painting contractor quote estimate trades | Trust & Authority + Conversion: transparent pricing, low-friction form, accent only on the quote CTA; avoid excessive decoration | All of it, minus the suggested badges and certifications (it's a made-up business). Kept Barlow / Barlow Condensed, green and yellow. |
| Khumalo Plumbing | plumber home services (first try "plumbing field service staff job cards app" matched the calendar profile) | Trust & Authority; anti-pattern "hidden contact info" | Customer contact one tap away on a job. Kept IBM Plex Sans, navy and blue. |

Like the homepage, the suggested Google-hosted fonts and generic palettes were not used: they'd replace each demo's
identity and load files from another company, which the privacy policy rules out.

## Tin Kettle Kitchen (website)

- **Hierarchy:** "Book a table" is the one action (terracotta fill) in the header, the hero, a new closing section
  ("Coming in?") and the phone bar. "See the menu", "Order online", directions, WhatsApp and call are outlines or
  text links. The header "Order" button became a nav link, and every "Order this" became a quiet text link.
- **Sticky:** on desktop the header (with "Book a table") stays at the top, and the menu tabs sit just under it. On
  phones a bar holds WhatsApp and Book a table. It's left off the booking page, where the form is the action.
- **Type:** h1 2.2rem to 3.5rem (was 4.6rem), page heads up to 3rem, h2 up to 2.4rem. The tracked-caps eyebrows
  ("Fresh today", "About us", the hero's "Family café & grill · Seaview") are gone; the hero line now reads "Family
  café & grill in Seaview".
- **Calm:** two section surfaces (paper and cream) instead of five, hairline-bordered cards with one soft shadow,
  the "Why people come back" boxes (2px outline and offset shadow) are now three plain notes, and the status dot no
  longer pulses. The awning and the arched window in the hero stay as the one bold thing.
- **Honest reviews:** the made-up "4.8 stars from 212 reviews" and the three named reviews are gone (the FAQ promises
  "We never write or make up reviews"). In their place are dashed "Your review here" placeholders with a note
  explaining that a selection of the client's real Google reviews goes there.
- **Motion:** sections below the fold fade in with a 12px rise, once (`tin-kettle.js`). Sections already on screen
  never blink out, and reduced motion shows everything straight away.
- **Fixes:** the footer address was charcoal on charcoal (invisible), and the "Tin Kettle" label on the drawn map
  was hidden by a CSS fill that overrode the SVG's own.
