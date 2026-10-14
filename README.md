# Front Door Sites website

The marketing site for **frontdoorsites.co.za**. It's a static site:

- every word, price, package, question and contact detail lives in **`content.json`**;
- **`node build.js`** turns that into a finished website in **`dist/`**;
- it's hosted on **Cloudflare Pages**.

It has no npm dependencies, no frameworks, no cookies and no trackers. You need Node 18 or newer.

```
content.json            ← edit this: prices, packages, FAQ, examples, contact details
content/pages/          ← privacy.html and terms.html (drafts: review before launch)
content/guides/         ← guide articles (none yet)
src/styles.css          ← all styles
src/site.js             ← menu, calculators, mock-up form, open/closed sign
src/calc.js             ← calculator maths (shared by the build and the browser)
src/svg.js              ← logo, illustrations and icons
src/fonts/              ← Fraunces + Figtree, self-hosted (SIL Open Font Licence)
src/img/examples/       ← screenshots for the Examples page (.webp)
src/static/             ← favicon, share image, touch icon (copied as-is)
tools/make-images.mjs   ← optional: regenerates the share image and icons
build.js                ← the build
```

## Build and preview

```bash
node build.js            # builds into dist/
node build.js --serve    # builds, then previews at http://localhost:8080
```

The build prints how many pages it made, then lists anything **still to fill in**. Those items are hidden on the site until you fill them in.

If it prints **warnings**, something needs fixing. For example: a WhatsApp number in the wrong format, a link that doesn't start with `https://`, a missing image, a `{word}` it doesn't recognise, or a broken internal link. The build checks every internal link and `#anchor` on every page.

## Fill in your details

Open `content.json`. Anything that's empty or starts with `TODO` counts as blank. Its button, link or section is hidden, so the site never shows a broken or empty link.

| Field | What it does |
|---|---|
| `contact.firstName` | The "Hi, I'm …" line on the home page, and the greeting in WhatsApp messages |
| `contact.whatsapp` | International format, digits only, no `+` (e.g. `27821234567`). Turns on the WhatsApp buttons, the sticky phone bar and the mock-up form |
| `contact.email` | Footer, FAQ page, and the "send by email instead" option on the form |
| `contact.serviceArea` | "Based in …" in the footer and the About line (also used for local SEO) |
| `contact.replyHours` | Shown in the footer and next to the mock-up form |
| `contact.googleBusinessProfile` | Optional footer link |
| `process.goLive` | e.g. `7 days`. Shown on the Start page and in "How fast will it be live?" |
| `process.onboardingForm` | Your Tally or Google Form link (Start page, step 3) |
| `niches[].packages[].payfast` | One PayFast link per package (Start page, step 2) |
| `legal.*` | Your legal name, registration number and an address for legal notices (Terms and Privacy pages only) |

If neither WhatsApp nor email is filled in, the mock-up form and every "Free mock-up" button stay hidden, because there would be nowhere to send them.

### Words that fill themselves in

You can use these in any text in `content.json`, and in the privacy, terms and guide pages:

`{fromPrice}` (lowest monthly price, e.g. R399/month) · `{buyout}` · `{extraWorkFrom}` · `{minimumMonths}` · `{noticeDays}` · `{editsDeadline}` · `{editsLive}` · `{suspendAfterDays}` · `{firstName}` · `{serviceArea}` · `{replyHours}` · `{goLive}` · `{spotsTotal}` · `{spotsLeft}` · `{email}` · `{whatsapp}` · `{domain}` · `{legalName}` · `{registrationNumber}` · `{noticeAddress}` · `{lastUpdated}`

A FAQ item that needs a blank detail can be hidden until it's filled in: add `"requires": ["process.goLive"]`. In the HTML pages, wrap the text in `{{#if contact.email}} … {{/if}}`.

## Change a price

Prices are plain numbers in rand. Find the package in `content.json` under `niches` and change `setup` or `monthly`:

```json
{ "id": "beauty-starter", "name": "Starter", "setup": 1000, "monthly": 399, ... }
```

Then run `node build.js`. Every page updates: the pricing cards, the calculators, "From R399/month" in the headings and descriptions, the Start page and the search-engine data. Remember to update the matching PayFast link too.

Other money amounts are under `terms`: the buyout price (`buyout`), the starting price for extra work (`extraWorkFrom`), the minimum term and the notice period.

## Turn the founding-client offer on or off

```json
"founding": { "enabled": true, "spotsTotal": 5, "spotsLeft": 5, ... }
```

- Each time someone signs up as a founding client, lower `spotsLeft` and rebuild.
- When `spotsLeft` reaches `0`, or `enabled` is `false`, the banner disappears everywhere and the plan cards show the normal setup fee again.
- The wording is in `founding.title`, `founding.text` and `founding.startNote`.

## Add an example

1. Take a screenshot of the site at about 1280×800. Save it as **WebP** in `src/img/examples/`, e.g. `src/img/examples/ibis-house.webp`. [squoosh.app](https://squoosh.app) converts a PNG to WebP in your browser; aim for under 150 KB.
2. Add it to `examples` in `content.json`:

```json
"examples": [
  {
    "name": "Ibis House",
    "niche": "guesthouses",
    "kind": "demo",
    "url": "https://ibis-house.example.co.za",
    "image": "img/examples/ibis-house.webp",
    "alt": "The Ibis House home page, with rooms and a Book direct button",
    "blurb": "A four-room guesthouse with live availability."
  }
]
```

- `niche` is `guesthouses`, `salons` or `restaurants`. It decides which niche page shows the example.
- `kind` is `demo` for a made-up business or `client` for a real one. Demos are always labelled "Demo" with a note that the business is made up.
- **Only add a real business with its owner's permission.**

The examples strip on the home page and the niche pages appears by itself once there's at least one example. The build reads the image size, so pictures never make the page jump.

## Add a guide

Guides are hidden until the first one exists. Then a "Guides" link appears in the menu and footer, along with `/guides/` and a page for each guide.

1. Copy `content/guides/_example-guide.html` to `content/guides/your-slug.html` and write the article in plain HTML (`<h2>`, `<p>`, `<ul>`, `<a>`). Files starting with `_` are never published.
2. Add it to `guides` in `content.json`:

```json
"guides": [
  {
    "slug": "direct-bookings",
    "title": "How to get more direct bookings for your guesthouse",
    "description": "Five simple ways to move guests from booking sites to your own website.",
    "date": "2026-11-01",
    "file": "content/guides/direct-bookings.html"
  }
]
```

The page title, intro, date and a "free mock-up" box are added for you. Guides are included in `sitemap.xml`.

## Privacy and terms

`content/pages/privacy.html` and `content/pages/terms.html` are **plain-English drafts, not legal advice**. Each starts with a "review before launch" comment that lists what to check, including the Consumer Protection Act early-cancellation rule and the ECTA details for businesses that sell online. Read both and change anything that doesn't match how you work. Ideally, have an attorney look them over before you launch. Change `legal.lastUpdated` whenever you edit them.

## Deploy to Cloudflare Pages

First time only:

```bash
npx wrangler login                                   # opens your browser to sign in to Cloudflare
npx wrangler pages project create frontdoorsites --production-branch main
```

Every time you publish:

```bash
node build.js
npx wrangler pages deploy dist --branch main
```

`--branch main` publishes to your live site. Without it, Wrangler uses your current git branch name, and any branch other than `main` gets a preview link instead (handy for checking changes first). The project name comes from `wrangler.toml`.

The build also writes `dist/_headers`. Cloudflare reads it to set security headers (including a strict Content-Security-Policy) and long caching for fonts and assets. If you ever embed something from another website, like a map or a booking widget, add its domain to the Content-Security-Policy in `build.js`, or it will be blocked.

## Connect frontdoorsites.co.za

Pointing the root domain (frontdoorsites.co.za without www) at Cloudflare Pages requires the domain's DNS to be on Cloudflare.

1. **Add the domain to Cloudflare.** In the Cloudflare dashboard, choose **Add a domain**, enter `frontdoorsites.co.za` and pick the Free plan. Cloudflare gives you two nameservers.
2. **Change the nameservers** at the company where you registered the .co.za domain, to the two Cloudflare nameservers. Moving existing DNS records (like email MX records) is covered in step 5. It usually takes a few hours, and at most 24–48 hours. Cloudflare emails you when it's active.
3. **Attach the domain to the site.** Go to **Workers & Pages → frontdoorsites → Custom domains → Set up a custom domain**, enter `frontdoorsites.co.za` and confirm. Cloudflare creates the DNS record and the HTTPS certificate for you.
4. **Add www too.** Repeat step 3 with `www.frontdoorsites.co.za`. Then, under the domain's **Rules → Redirect Rules**, use the "Redirect from WWW to root" template, so everyone ends up on `https://frontdoorsites.co.za`.
5. **Keep your email working.** If your email uses this domain, check that its MX records (and any SPF/DKIM TXT records) were copied into Cloudflare's DNS before switching nameservers.

The `frontdoorsites.pages.dev` address keeps working too. Every page's canonical tag points to frontdoorsites.co.za, so search engines treat that as the real one.

After launch, add the site to [Google Search Console](https://search.google.com/search-console) and submit `https://frontdoorsites.co.za/sitemap.xml`.

## Share image and icons (optional)

`src/static/og-image.png` is the 1200×630 picture shown when someone shares a link on WhatsApp or Facebook. It's generated from the SVG artwork in `src/svg.js`, as are the favicon and touch icon. To regenerate them after changing the logo:

```bash
npm install --no-save playwright   # once; doesn't change package.json
npx playwright install chromium    # once
node tools/make-images.mjs
```

## Fonts

Headings use **Fraunces**; body text uses **Figtree**. Both are self-hosted from `src/fonts/` (no Google Fonts requests) under the SIL Open Font Licence, and the licence files are included.
