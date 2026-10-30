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

## Bright Cuts (bookings)

- **One action:** a black booking bar with a running summary ("Skin fade R210 · 45 min with Sipho", then the time)
  and the only blush-pink button: Continue, then Confirm booking on the last step. It's fixed to the bottom on
  phones and docked under the step on desktop, and hidden on the booked screen, where "Add to calendar" takes over.
  Tapping a choice now selects it and Continue moves on (it used to jump straight to the next step).
- **Calm:** the headline is one colour (the pink "skip the wait." accent is gone) and 3rem at most. "STEP 1 OF 4 ·
  SERVICE" became a four-part track (Service, Who, When, Details). Services and people are one grouped list with
  radio marks instead of heavy black-bordered cards, and the 14 days are a 2×7 grid on desktop.
- **Tokens:** black #141210, ink #26221F, paper #F7F2EC, blush #F2C4BE (the action, only ever on black: 11.9:1).
  Syne 700 for headings, Manrope for body.

## Tin Kettle ordering

- **One action:** terracotta-dark is only the next step (View order, Add to order, Place order). The 11 filled
  "Add" pills are outline pills now. Each primary button shows its total on the right.
- **Sticky:** on phones a "View order" bar appears once something is added. On desktop the phone-width card became
  two columns: the menu, and a sticky "Your order" card that also repeats the open/collection time.
- **Calm:** the café's refreshed tokens, hairlines instead of dashed lines, a quiet "Not available now" line on grill
  dishes (the repeated "Fri–Sat evenings only" tag went), no inset shadows or press jumps.

## Coastline Painting (quotes)

- **One action:** yellow is only "Get a firm quote" (and "Request my firm quote" on the next screen). "Download
  estimate" is an outline. On phones the sticky estimate bar ("Your estimate", the range, Get a firm quote) hides
  once the estimate panel is on screen; on desktop the panel stays sticky beside the form.
- **Calm:** sentence case throughout. Barlow Condensed is only the h1 and the estimate figure, the bold thing, white
  on deep green. The hazard stripe, the yellow header rule, the "Free estimates" pill and the 2px green borders went.
  Selected options get a green outline, a pale tint and a small tick instead of a dark fill.

## Khumalo Plumbing (staff app)

- **One action:** "Mark as …" (scheduled, on site, done) is the only blue button, pinned to the bottom of a job.
  Blue is otherwise only the focus ring and the "On site" tint; navigation and filters use navy.
- **Contact one tap away:** a job opens with the customer, a made-up street address in the made-up suburb, and Call,
  WhatsApp and Directions buttons that show a "Demo:" note. No phone numbers are invented.
- **Calm:** a centred sign-in card with one "Demo: use demo / demo" note, hairline cards, sentence-case labels,
  softer status tints, each with its own symbol so colour isn't the only cue, and a connected status track. Empty
  searches, notes and parts get proper empty states.
