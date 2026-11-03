# Homepage scroll polish: preview (branch `premium-scroll-preview`)

Owner feedback: "it lacks the premium feel, when one scrolls through it isn't nice and smooth". This is an upgrade of `src/home/index.html` only. Copy, prices, numbers and section order are unchanged. The only new words are a "WhatsApp us" button in the tour bar.

## What changed

**Smooth scrolling**
- The wheel smoother (Lenis-style lerp, 0.1 per frame) stays. It still eases each wheel turn to a soft stop, works on mouse wheels only, and leaves touch, keyboard, the scrollbar and find-in-page native.
- In-page links (tour bar, tour cards, next-step buttons, "Free quote") now glide on a timed ease-in-out curve (0.5–1.4s, depending on distance) instead of the lerp, which used to lurch on long jumps. They land 12px below the tour bar. A wheel turn mid-glide takes over smoothly.
- Fully off under `prefers-reduced-motion`, including when the setting changes while the page is open.

**Scene progress follows the scroll softly**
- The door and every scroll scene now run on a damped playhead (0.2 per frame, frame-rate independent). Wheel notches, flicks and native touch scrolling play as one smooth movement instead of jumping between steps. It's still one rAF loop: parts report when they're still settling, and the loop stops once nothing moves.

**Door intro: calmer and shorter**
- Pinned length went from 150svh to 140svh.
- Every stage of the door now eases in and out. The light spreads over the last ~40% of the intro instead of the last quarter, so the flood no longer arrives abruptly. Pop-outs ease, and the tour heading scales 1.08 → 1 instead of 1.18 → 1.
- Fix: on wide screens, the door's stage was covering the top ~220px of the "Why" chapter, so its heading never showed (the same in the previous build). The tour now fills the end of the door's scroll, so "Why" always starts below the door.

**Shorter pinned scenes** (less endless; every scene still plays in full)
| Scene | Desktop | Phone |
|---|---|---|
| Lights on | 120 → 90svh | 140 → 110svh |
| Builds itself | 130 → 95svh | 150 → 115svh |
| All day | 130 → 95svh | 150 → 115svh |
| Earnings | 50 → 40svh | (not pinned) |
| Costs | 40svh (same) | 110 → 90svh |
| How it works | 100 → 75svh | 120 → 95svh |
| Why: journey steps | 50vh → 42vh each | 40 → 34svh each |

Page height: 20,450 → 18,860px at 1440×900, and 22,975 → 21,456px at 390×844.

**Reveals and parallax**
- One reveal for the whole page: opacity plus 14px rise, 0.7s, `cubic-bezier(.23,1,.32,1)`. They now start just before content reaches the screen (IntersectionObserver `rootMargin` +10%, previously −8%), so nothing is blank on arrival. A Playwright wheel-scroll through the whole page found unrevealed content in view in 0 of 64 samples.
- Subtle transform-only parallax on three decorative pieces, never on text: the About logo (18px total drift) and two new CSS-gradient glows, behind the enquiry form (60px) and behind the closing WhatsApp section (40px). No new image files.

**Spacing rhythm**
- One fluid section spacing, `clamp(4rem … 6rem)`, used for section padding and for the space after each pinned scene. One heading/next-button gap, `clamp(2.5rem … 3rem)`, replaces the separate 2.5rem and 3rem values.

**Path to WhatsApp**
- The tour bar (desktop) ends with a "WhatsApp us" button using the existing wa.me link (27732426068 and the greeting from content.json). It's an outline button and turns gold once you reach step 5, "How it works". Phones keep the bottom WhatsApp / Free quote bar.
- How it works' next step, "Tell us what you need", is now the gold action button and leads to the enquiry form, which sends to WhatsApp. The closing "Do I need to get on a call?" WhatsApp button now has a soft glow behind it.

**Performance / accessibility**
- Only transform and opacity are animated. All listeners are passive except the wheel smoother. `will-change` is still only set on the door while it's moving. Reduced motion means native scroll, no reveals, no parallax and no scenes.
- Images: the homepage has no `<img>`. All `<img>` on the other pages already have width/height, `loading="lazy"` and `decoding="async"`, so nothing needed changing.

## Checked
- `node build.js` builds cleanly.
- Headless Chromium at 1440 and 390: no console errors; anchor jumps land below the tour bar; the tour bar's active step and CTA state are correct; the Why heading is visible; reduced motion gives native, instant wheel scrolling.
- Visible text diffed against the previous build: the only addition is "WhatsApp us".

Not pushed and not deployed.
