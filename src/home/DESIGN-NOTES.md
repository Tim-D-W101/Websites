# Front Door Sites homepage: premium upgrade notes (2026-10-30)

- **Reference:** the live Front Door Sites homepage itself (live-src/ snapshot). This is an upgrade, not a redesign, so no outside reference site was opened or borrowed from.
- **Layout source:** the live page's own section order: door hero, tour, Why, Difference, What you get, Demos, All day, Earn, Cost, How, Enquiry, About, FAQ. The only addition is a closing WhatsApp section.
- **Icon set:** the site's existing inline stroke SVG icons (24px grid, 2px stroke) and its WhatsApp glyph. No new icons.
- **Type:** Fraunces / Figtree when installed locally, otherwise system serif (ui-serif, New York, Iowan, Palatino, Georgia) and system sans. No web-font requests. h2 is larger with tighter tracking (-0.026em, 1.06 leading), and body text uses `text-wrap: pretty`.
- **Palette:** the brand's navy #0A2A44 / #124B78, gold #FEC458 (kept for real CTAs only), cream #FCF8F0, with a quieter sand #F6EEE0 and softer hairlines #E8DDC8. The eyebrow and kicker pills were removed so the gold is used for action and nothing else.
- **UI UX Pro Max output:** it suggested "Trust & Authority + Conversion" (transparent pricing, a low-friction form, 4.5:1 contrast, reduced motion). I followed the pattern guidance. I ignored its green palette and Fira fonts, because they would replace the brand.
- **3 moves (from scroll-craft taste/feel):**
  1. More space above headings than below. Sections now get 5rem of padding on mobile and 7.5rem on desktop.
  2. One next step per section: an outline button with a down arrow, centred at the end of the section. Gold is kept for quote and WhatsApp.
  3. The close resolves rather than trailing into the footer: a cream "Do I need to get on a call?" block (copy from the FAQ) with a single WhatsApp button.
- **Demo images:** replaced with small inline SVG drawings that follow each screenshot's alt text. No prices are drawn (grey bars are used instead), and each SVG keeps the original alt text as its aria-label.

## v2 revision (2026-10-30)

Owner feedback: "everything's a mess, everything is big, all the writing jumps at you, it's not neat." v1 is kept as `index.v1.html`. v2 is built the same way (`python3 build/build.py`).

- **Reference:** the live Front Door Sites site (`live-src/`, served locally with its fonts) was the bar to match for tidiness. No outside reference site was opened.
- **Fonts:** real Fraunces 600 (headings) and Figtree 400/700 (body), the only weights the live site uses. `build/fonts.py` pins them from the variable TTFs (Fraunces opsz 48, SOFT 0, WONK 0), subsets them to Latin as WOFF2, and embeds them as base64 `@font-face` with `font-display: swap`. Together they add about 47 KB to the file. The fallback faces are metric-matched to Georgia Bold and Arial/Arial Bold (`size-adjust`, ascent/descent overrides calculated from Capsize average widths). Measured CLS on load is about 0.
- **Type scale:** sizes are at or below the live site's. h1 is `clamp(2.2rem … 3.5rem)` (live: 4.4rem), h2 is `clamp(1.75rem … 2.5rem)` (the tour heading was 3.2rem), h3 is 1.15–1.3rem, and body text is 1–1.0625rem with 1.6 leading. Leads are capped at 60ch and paragraphs at 65ch. Plan prices, earnings figures and the clock are a step smaller. Headings use `text-wrap: balance`, and a script check found no one-word last lines at 390 or 1440.
- **Chapter labels:** the number tile stays, but the label is now sentence case instead of tracked caps. The wording is unchanged.
- **Spacing:** 8px grid. Sections have 4rem padding on mobile and 6rem on desktop, chapter heads have 2.5rem/3rem below them, and the next-step button sits 3rem below its section.
- **Buttons:** one system. Gold is the action, a 1.5px navy outline means "move on" (`btn-ghost` and `btn-next` are now identical), and navy is WhatsApp. All buttons share the same 48px height, 12px radius and 1rem bold type. The gold shine sweep and the hover/press jumps are removed.
- **Motion:** reveals use opacity plus 12px, 450ms ease-out, once only, with no sibling stagger. In the scroll scenes, the before/after cards cross-fade instead of flipping, the mock-up pieces and pricing cards rise 12px instead of flying in rotated, and the bouncy overshoot easings, the scaling of text (toasts, chat bubbles, journey cards, pricing deck) and the endlessly nudging scroll-hint arrow are gone. **The door intro and the inertia smooth scroll are unchanged.** Reduced motion still turns everything off.
- **Fixes:** on mobile the About card now stacks (logo above the text, so the paragraph gets the full width), and its "Common questions" button no longer touches the card.
- **Unchanged:** all copy, prices and section order (the visible text matches v1 word for word).
- **Screenshots:** `shots/v2/` contains `v2-*` and `live-*` for hero, middle (demos) and pricing at 1440 and 390. The live snapshot has no `/img/examples/` images, so its demo cards show alt text.
