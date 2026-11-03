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

## Round 2 (owner approved): shorter on phones, and a free mock-up start page

### (a) Phones: no pinned scenes
On screens 767px and narrower:
- **Scenes are static.** Lights on, builds itself, all day, earnings, costs and how it works no longer pin or play on scroll. Each one shows its finished state, the same layout that reduced motion already used, and its parts rise in once with the page's usual reveal (opacity plus 14px, 0.7s). The earnings chart no longer counts up as it scrolls in. It just shows the result.
- **The Why journey is static too.** The four step cards are stacked under a smaller phone (22rem tall) that shows the finished website screen. No sticky phone and no 34svh step spacing.
- **The door intro stays, but it's brief.** Its pin went from 40svh to 25svh (hero 140svh → 125svh). The door still opens, the light still spreads and the tour still comes up out of it, over about 210px of scrolling.
- **Tighter phone layouts:** section spacing 3rem (was 4rem), heading gap 2rem, and slimmer cards. The "How it works" steps put the door icon beside the text instead of above it. Nothing was removed: all copy, prices and cards are still there.
- **Fix:** non-pinned scenes were getting the section's bottom padding plus the scene's own, which left a double gap. They now get one.
- **Fix (in the previous build too):** the glow behind the shop drawing reached 48px past the right edge, so phones laid the homepage out 438px wide and zoomed it out to about 89%. It also pushed the bottom WhatsApp / Free quote bar partly below the screen. The section now clips it. At 375 and 390 the page is exactly screen-wide again.
- Desktop and tablets (768px and up) are unchanged: every scene still pins and plays.

Homepage height (Playwright, Chromium, scrollHeight):

| Width | Before | After |
|---|---|---|
| 375×812 | 21,209px | 18,104px (−3,105, −15%) |
| 390×844 | 21,456px | 17,917px (−3,539, −16%) |
| 1440×900 | 19,080px | 19,080px (unchanged) |

### (b) `/start`: get your free mock-up
- The existing `/start` page now opens with "Get your free mock-up" and three steps: tell us about your business, we make a free mock-up, you decide. Then comes one big gold "Get my free mock-up" WhatsApp button. It uses the existing link (27732426068 with the greeting from `content.json`), and under it sit the number, the reply time and the email address.
- Every line reuses wording already on the site (the websites page, the FAQ's "What's the free mock-up?" answer, the how-it-works steps and the pricing terms). No new facts, prices, numbers, reviews or places.
- The full step-by-step, "From first message to go-live", stays below it unchanged. Its first step's button is now "WhatsApp us" instead of a link back to the homepage form, and its text no longer mentions a form.
- The page title and description are now about the free mock-up (`content.json` → `startPage`).

**Where "Free quote" now goes**
- Homepage: the header button (desktop and menu), the hero's "Get a free quote" and the phone bar's "Free quote" all go to `/start`.
- Every page: the header's "Free quote" goes to `/start`. In the phone bar, "Free quote" goes to `/start` on pages without their own form and still jumps to the form on pages that have one. On `/start` itself the phone bar shows only WhatsApp.
- Left as they were: WhatsApp buttons (straight to WhatsApp), and the homepage's two "Tell us what you need" links, which lead to the enquiry form right below them.

### Checked
- `node build.js` builds cleanly with no warnings.
- Playwright (Chromium) at 375×812, 390×844 and 1440×900, with mobile emulation on the phone sizes: no console errors on `/` or `/start`, and no horizontal overflow at 375 or 390 on `/`, `/start`, `/websites`, `/pricing`, `/faq` or `/examples`.
- Phones: 0 live scenes, journey static, door live. 1440: 6 live scenes, journey and door live. A step-by-step scroll found no unrevealed content in view, apart from the demo cards waiting off-screen to the right in their swipe row, which reveal when swiped in (the same as before).
- Clicking "Free quote" (phone bar at 375/390, header at 1440) lands on `/start`. Its button opens `https://wa.me/27732426068?text=Hi%2C%20I%20have%20a%20question%20about%20a%20website%20or%20business%20tool.`
- Still only transform and opacity animate. Reduced motion is unchanged: native scroll, no reveals, no scenes (390 with reduced motion: 18,413px). The pages keep the CSP (`script-src 'self'`), with no inline script or style attributes.
- Not checked: a real phone (only headless Chromium with mobile emulation).

Not pushed and not deployed.

