# Front Door Sites website

The marketing site for **frontdoorsites.co.za**: websites and business tools for South African businesses, sold with a free mock-up or plan, a fixed quote and a 50% deposit. A website can be bought three ways: once-off, or for less upfront with the Care or Care Plus monthly plan.

It's a static site:

- every word, price, website option, band, question and contact detail lives in **`content.json`**, except on the home page, which is one finished file, **`src/home/index.html`** (see [The home page](#the-home-page));
- **`node build.js`** turns that into a finished website in **`dist/`**;
- it's hosted on **Cloudflare**, which serves the files in `dist/` as they are (set up in `wrangler.toml`).

It has no npm dependencies, no frameworks, no cookies and no trackers. You need Node 18 or newer.

```
content.json            ← edit this: prices, website options, terms, FAQ, industry ideas, examples, contact details
content/pages/          ← privacy.html and terms.html (drafts: review before launch)
content/guides/         ← guide articles (none yet)
src/styles.css          ← all styles
src/home/index.html     ← the home page, used as it is (its own styles, fonts and script inside)
src/site.js             ← menu, calculators, enquiry form, open/closed sign, the Examples page,
                          things rising into view
src/calc.js             ← calculator maths (shared by the build and the browser)
src/svg.js              ← logo, the front door, illustrations and icons
src/fonts/              ← Fraunces + Figtree, self-hosted (SIL Open Font Licence)
src/img/examples/       ← screenshots for the example cards (.webp)
src/examples/           ← the demos on /examples (see "The Examples page and the demos")
src/static/             ← favicon, share image, touch icon (copied as-is)
tools/make-images.mjs   ← optional: regenerates the share image and icons
tools/shoot-examples.mjs ← optional: retakes the example card screenshots
build.js                ← the build
```

Pages: Home, `/websites`, `/business-tools`, `/guesthouses`, `/salons`, `/restaurants`, `/examples`, `/pricing`, `/faq`, `/start` (how it works), `/privacy`, `/terms`, a 404 page, `sitemap.xml` and `robots.txt`. Plus the demos linked from `/examples`: a made-up café's website and four working tools (never indexed, and not in the sitemap).

## Build and preview

```bash
node build.js            # builds into dist/
node build.js --serve    # builds, then previews at http://localhost:8080
```

The build prints how many pages it made, then lists anything **still to fill in**. Those items are hidden on the site until you fill them in.

If it prints **warnings**, something needs fixing. For example: a WhatsApp number in the wrong format, a link that doesn't start with `https://`, a missing image, a `{word}` it doesn't recognise, or a broken internal link. The build checks every internal link and `#anchor` on every page.

## Fill in your details

Open `content.json`. Anything that's empty or starts with `TODO` counts as blank. Its button, link or section is hidden, so the site never shows a broken or empty link.

The site speaks as the business ("we", "us", "our") and shows no personal names. Keep new text that way. Words in the visitor's own voice stay as they are, like "Get my free mock-up" or the questions in the FAQ ("Can I change my prices?"). The only name on the site is `legal.legalName`, in the "Who we are" line of the Terms and Privacy pages.

| Field | What it does |
|---|---|
| `contact.whatsapp` | International format, digits only, no `+` (e.g. `27821234567`). Turns on the WhatsApp buttons, the sticky phone bar and the enquiry form |
| `contact.email` | Footer, FAQ page, Terms and Privacy, and the "send by email instead" option on the form. Set up the address before you launch (see [Set up hello@frontdoorsites.co.za](#set-up-hellofrontdoorsitescoza)) |
| `contact.serviceArea` | "Based in …" in the footer, the About line and page descriptions (local SEO) |
| `contact.replyHours` | Shown in the footer and next to the enquiry form |
| `contact.googleBusinessProfile` | Optional footer link |
| `process.quoteTime` | How soon a mock-up or plan reaches the client, e.g. `3 working days` |
| `process.paymentMethods` | How deposits and balances are paid. Shown as "You pay by …" |
| `website.buildTime`, `bands[].buildTime` | Typical build time for the business website and each band. Shown on the band cards, the FAQ and the Start page table. Leave one blank to hide that row |
| `website.options[].payfast` | Optional PayFast links: the yearly renewal (on Once-off) and the monthly fee (on Build + Care and Build + Care Plus). Leave them blank to take these payments by EFT (see [How clients pay](#how-clients-pay-plans-and-the-renewal)) |
| `legal.*` | Your legal name, registration number and an address for legal notices (Terms and Privacy pages only). ECTA section 43 asks a business that sells online to show its full name and legal status, so the legal name stays in the "Who we are" line there |

If neither WhatsApp nor email is filled in, the enquiry form and every "Free quote" button stay hidden, because there would be nowhere to send them.

### Words that fill themselves in

You can use these in any text in `content.json`, and in the privacy, terms and guide pages:

- **Prices:** `{onceOffBuild}` (R7 500) · `{careBuild}` (R4 999) · `{careMonthly}` (R399/month) · `{carePlusBuild}` (R3 999) · `{carePlusMonthly}` (R699/month) · `{websitesFrom}` (the lowest website build price, R3 999) · `{toolsFrom}` (R5 000) · `{careFrom}` (the cheapest monthly fee, R399/month)
- **Build and monthly fee together:** `{carePrice}` (R4 999 + R399/month) · `{carePlusPrice}` (R3 999 + R699/month) · `{onceOffPrice}` (R7 500, no monthly fee). Use these when a text mentions a plan's price, so its monthly fee is never left out. In a line where amounts show in bold (like the hero's price line), the build and the monthly fee are bold together
- **Terms:** `{renewalFee}` (R249) · `{changeFee}` (R199) · `{minMonths}` (6) · `{graceDays}` (30) · `{deposit}` (50%) · `{balance}` (50%) · `{quoteValidDays}` · `{noticeDays}` · `{editsDeadline}` · `{editsLive}` · `{suspendAfterDays}`
- **Changes per option:** `{onceOffChanges}` (R199 per change) · `{careChanges}` (5 free changes a month) · `{carePlusChanges}` (10 free changes a month)
- **Yearly payment** (only while it's switched on): `{yearlyPaysMonths}` · `{yearlyFree}` · `{careYearly}` · `{carePlusYearly}`
- **Everything else:** `{quoteTime}` · `{paymentMethods}` · `{serviceArea}` · `{replyHours}` · `{email}` · `{whatsapp}` · `{domain}` · `{legalName}` · `{registrationNumber}` · `{noticeAddress}` · `{lastUpdated}`

The option words come from each option's `id`: `once-off` gives `{onceOffBuild}`, `care-plus` gives `{carePlusBuild}` and `{carePlusPrice}`, and so on.

A FAQ item, or one part of an answer, that needs a blank detail can be hidden until it's filled in: add `"requires": ["process.quoteTime"]`. In the HTML pages, wrap the text in `{{#if contact.email}} … {{/if}}`.

## Change the website prices

A business website can be bought three ways. They live in `website.options`, and show as three cards side by side on `/pricing` and `/websites` (stacked on phones):

```json
{ "id": "care", "name": "Build + Care", "plan": "Care", "featured": true,
  "summary": "Pay less upfront. We keep your site online and make up to 5 free changes for you each month.",
  "build": 4999, "monthly": 399,
  "term": "{minMonths} months", "hosting": "Included", "changes": "5 free changes a month",
  "replies": "Standard (email or WhatsApp)", "report": "", "backups": "Yes",
  "payLabel": "Start Care", "payfast": "" }
```

- **Option prices:** change `build` (the "from" price for the build) and `monthly` (the monthly fee; `null` for once-off). Run `node build.js` and everything updates: the option cards, the industry ideas, the calculators, the Start page, the FAQ, the Terms, page descriptions and the search-engine data. The home page is the exception: its prices are written into `src/home/index.html`, so change them there too. The build warns if the home page doesn't show a build price or monthly fee from `content.json`.
- **The card rows** (Minimum term, Hosting & domain, Changes, Replies, Monthly report, Backups & security) are listed in `website.rows`. Each row shows the option's field with the same `key`. Leave a field blank to show a dash, or write `Yes` to show a tick. The word "free" in a row ("5 free changes a month") gets a green highlight, on the cards and in the "Changes on each option" list.
- **The price on each card** shows the build and, for Care and Care Plus, the monthly fee together ("R4 999 + R399/month"), so the monthly fee never looks optional. The full cards on `/websites` and `/pricing` share the same price block. Under it: `website.planTerm` on the plans ("6-month minimum") and `website.noMonthly` on once-off. `website.priceLabel` is the small label above the price ("From").
- `"featured": true` gives an option the darker border and the "Most popular" badge (`website.badge`).
- `website.buildTime` is the typical build time for the business website.

### The renewal fee, the change fee and the minimum term

These live in `terms`, and every page that mentions them updates when you rebuild:

| Field | What it does |
|---|---|
| `terms.renewalYearly` | The yearly hosting and domain renewal for once-off websites, from the second year, and for plans after they're cancelled (249 shows as R249) |
| `terms.renewalGraceDays` | How long an unpaid renewal has before the site goes offline (30) |
| `terms.changeFee` | The price of one change on a once-off website (199) |
| `terms.minimumTermMonths` | The minimum term for Care and Care Plus (6) |
| `terms.depositPercent` | The deposit (50) |
| `terms.quoteValidDays` | How long quotes are valid |
| `terms.suspendAfterDays` | How long an unpaid monthly plan fee has before the site shows "temporarily unavailable" |
| `terms.noticeDays` | How much notice you give before changing the terms |

### Bigger jobs and business tools

Bookings / online shop and the three tool sizes live in `bands`. They're once-off "from" prices:

```json
{ "id": "small-tool", "group": "tools", "name": "Small tool", "from": 5000,
  "scope": "One job done well: a quote builder, calculator, smart form or simple tracker.",
  "buildTime": "2 weeks" }
```

Change `from` and run `node build.js`. Set `"from": null` to show a band as **Quoted** (like Bigger platform). `group` is `websites` (shown under the options on `/websites`) or `tools`. The "once-off" label and the lines "Take Care or Care Plus and the build costs less. Your quote shows both." and "Hosting and upkeep for business tools is quoted with the tool." are in `bigger`.

## How clients pay plans and the renewal

While every `payfast` link in `website.options` is blank, the monthly plan fees and the yearly renewal are paid by EFT: the Start page says you send an invoice, and the FAQ and Terms say EFT. Fill in a PayFast link and the site switches over by itself: the Start page shows a button for each link (labelled with the option's `payLabel`), and the Terms, FAQ and Privacy pages switch to PayFast wording. The renewal link (on Once-off) and the plan links (on Care and Care Plus) switch separately.

**Yearly payment** is switched off (`terms.yearlyPaysMonths` is `0`). Set it to, say, `10` to let clients pay for 12 months of a plan at the price of 10: it then shows on the option cards, the FAQ, the Start page and the Terms, and each plan can take a `payfastYearly` link.

## Turn the founding-client offer on or off

```json
"founding": { "enabled": true, "spotsTotal": 3, "spotsLeft": 3, ... }
```

- The offer: the first month of Care or Care Plus free. The wording is in `founding.badge` (the gold "**1st** month free" badge on the banner; put `*stars*` around the big part), `founding.title`, `founding.text`, `founding.cardNote` (the note on the Care and Care Plus cards) and `founding.startNote`.
- `spotsTotal` and `spotsLeft` are for you only. The site never shows how many places are left, so there's no countdown. Each time someone signs up as a founding client, lower `spotsLeft` and rebuild.
- When `spotsLeft` reaches `0`, or `enabled` is `false`, the banner and the notes on the option cards disappear everywhere except the home page. Take the banner out of `src/home/index.html` by hand (the build warns until you do).

## The home page

The home page is the approved design (v2), kept as one finished file: **`src/home/index.html`**. Its markup, styles and script are used exactly as they are, and its fonts (Fraunces and Figtree) are embedded in its styles, so it doesn't use `src/styles.css`, `src/site.js` or `src/fonts/`. `src/home/DESIGN-NOTES.md` explains what changed from the version before.

The page tells the story as you scroll: the front door opens and you go through it into the tour, then the five chapters (Why you need a website, What you get, What it could earn you, What it costs, How it works), the enquiry form, About, common questions and "Do I need to get on a call?". With reduced motion, or without JavaScript, every chapter shows in full.

To change the home page, edit `src/home/index.html` and run `node build.js`. The build:

- replaces its `<head>` with the site's usual one: the title and description from `home.seo` in `content.json`, the canonical link, icons, share tags and search-engine data. The rest of `home` in `content.json` isn't used any more;
- changes its links to `https://frontdoorsites.co.za/…` into links starting with `/`, so they work on preview builds too, and checks every one of them like the other pages;
- keeps the year in the footer up to date;
- warns if a website price from `content.json` is missing from the page, or if the founding-client offer is off but still on the page. Its prices, demos, FAQ and the offer are written into the page, so `content.json` doesn't change them;
- allows its inline style and script in the security policy by their hashes (see [Security headers](#security-headers)), so edit them freely and rebuild.

Keep it self-contained: no `style="…"` attributes, no `onclick="…"` and no outside scripts or stylesheets (the build warns about these, because the security policy blocks them).

## Edit the industry pages

`/guesthouses`, `/salons` and `/restaurants` come from `niches` in `content.json`. For each one you can change:

- `hero`, `argument` and `faq`: the page's words.
- `ideas`: the "What I can build for you" cards. Each has a `kind` (`website` or `tool`), a `title`, a `text`, and either a `band` (a band id, or `once-off` for the business website: "From R7 500 once-off · Business website") or a `note` (any short text, for example "Added to any website build").
- `calculator`: the build prices it uses (`builds`: a website option or band id, with a `label`; two or more show as a toggle), the plan whose monthly fee it uses (`carePlan`) and the example figures (`defaults`).
- `businessType`: what the enquiry form's "Type of business" is prefilled with on that page.

To add an idea:

```json
{ "kind": "tool", "band": "small-tool", "title": "Supplier order sheet",
  "text": "One list of what to order from each supplier, so nothing runs out on a Friday night." }
```

## The Examples page and the demos

`/examples` is the page that shows what you build. Everything on it works in the browser, nothing anyone types is sent or stored, and every business on it is made up:

| Demo | Address | What it shows |
|---|---|---|
| Tin Kettle Kitchen (website) | `/examples/tin-kettle/` | A family café and grill: home, menu, book a table, find us and its own 404 page |
| Bright Cuts (bookings) | `/examples/tools/bookings/` | A barber and salon's booking tool: service, barber, a free time, then a reference and a calendar file |
| Tin Kettle ordering | `/examples/tools/ordering/` | The café's own online ordering for collection, linked from its menu |
| Coastline Painting (quotes) | `/examples/tools/quotes/` | A painter's instant estimate, a firm-quote request and a printable estimate |
| Khumalo Plumbing (staff app) | `/examples/tools/staff-app/` | A staff-only app: job cards, stock and a weekly report (log in with `demo` / `demo`) |

On `/examples` the website shows on a laptop and a phone, and each tool runs live inside a phone. The page's words are in `examples` in `content.json` (`hero`, `website`, `tools`, `together`, `clients` and `yourTurn`).

### Where the demos live

```
src/examples/tin-kettle/content.json   ← the café's words, hours, grill times, menu and prices
src/examples/tin-kettle/tin-kettle.css ← its own look (not the Front Door Sites styles)
src/examples/tin-kettle/tin-kettle.js  ← open/closed line, menu tabs, the table request
src/examples/tools/<slug>/index.html   ← each tool: one file, its CSS and JavaScript inside it
src/examples/fonts/                    ← the demos' fonts (Google Fonts, self-hosted, with their licences)
```

The café's pages are made by the Tin Kettle part of `build.js`. Each tool is copied to `dist/examples/tools/<slug>/` with three things added: the demo ribbon at the top, the tags that give it a preview when the link is shared, and (for the ordering tool) the café's menu and hours from `src/examples/tin-kettle/content.json`, so prices live in one place. The build also works out each tool's security policy, so its own script and styles are allowed and nothing else is.

Every demo page carries a thin ribbon ("Demo website by Front Door Sites · … isn't a real business · See more examples") and a `noindex` tag, and has its own security headers so `/examples` can show it in a frame.

### The list of examples

`examples.items` in `content.json` is the one list of examples. `/websites` shows the websites, `/business-tools` the tools, and each industry page the items with its `niche`. On `/examples` the demo tools each get a section, and client work gets a section of its own. The home page's three demos are drawn into `src/home/index.html`.

```json
{
  "id": "bookings",
  "kind": "tool",
  "status": "demo",
  "title": "Bright Cuts bookings",
  "business": "Bright Cuts",
  "summary": "A barber and salon's own booking tool: pick a service, a barber and a time that's really free.",
  "url": "/examples/tools/bookings/",
  "priceKey": "business-system",
  "image": "img/examples/bookings.webp",
  "alt": "The Bright Cuts booking demo: a list of services with prices"
}
```

- `kind` is `website` or `tool`, and `status` is `demo` or `client`.
- `priceKey` sets the "from" price shown with it: `website` (the business website: from R3 999 with Care Plus, or R7 500 once-off), `tools` (business tools in general), a band id like `small-tool` or `business-system`, or a website option id like `once-off`. A tool whose key matches nothing shows the general business tools price.
- `niche` (optional: `guesthouses`, `salons` or `restaurants`) also shows it on that industry page.
- Demo tools also have the words for their section on `/examples`: `nav` (its name in the bar at the top), `type`, `problem` (the owner's problem, in their words), `fixes`, `tryThis` and `want` (what the enquiry form is filled in with when someone taps "Get one like this").

### Add real client work

The "Real client work" section stays hidden until there's at least one item with `"status": "client"`. **Only add a real business with its owner's permission.**

1. Take a screenshot at about 1280×800 and save it as **WebP** in `src/img/examples/`, e.g. `src/img/examples/ibis-house.webp`. [squoosh.app](https://squoosh.app) converts a PNG to WebP in your browser; aim for under 150 KB.
2. Add it to `examples.items`:

```json
{
  "id": "ibis-house",
  "kind": "website",
  "status": "client",
  "title": "Ibis House",
  "business": "Ibis House",
  "summary": "A four-room guesthouse with live availability.",
  "url": "https://ibishouse.co.za",
  "priceKey": "website",
  "niche": "guesthouses",
  "image": "img/examples/ibis-house.webp",
  "alt": "The Ibis House home page, with rooms and a Book direct button"
}
```

It shows on `/examples` labelled **Website · Client** (or **Tool · Client**), with the screenshot, the summary and a link to the site, and on the pages for its kind and niche. A client's `url` must start with `https://`. The build reads the image size, so pictures never make the page jump.

### Swap the café's placeholder photos for real ones

Until it has photos, the café shows designed placeholders ("Your photo here"). To use real photos:

1. Resize each photo to at most 1 600 px wide and save it as WebP (squoosh.app does both), e.g. `src/img/examples/tin-kettle/hero.webp`.
2. In `src/examples/tin-kettle/content.json`, set `photo` on the slot to the file and write a description in `alt`:

```json
"hero": { "photo": "img/examples/tin-kettle/hero.webp", "icon": "kettle", "alt": "The Tin Kettle counter with fresh breakfast rolls" }
```

The slots are `hero`, `about` and each of `specials.items`. Photos load lazily, with their size set so the page doesn't jump.

### Send one demo to a prospect

Each demo has its own address, so you can send just the one that fits. For a salon owner:

```
https://frontdoorsites.co.za/examples/tools/bookings/
```

For a restaurant, send the café (`/examples/tin-kettle/`) or its ordering (`/examples/tools/ordering/`); for a tradesperson, the quote calculator (`/examples/tools/quotes/`); for a business with staff, the staff app (`/examples/tools/staff-app/`, log in with `demo` / `demo`). The link shows a proper preview on WhatsApp, the ribbon says it's a demo by Front Door Sites, and "See more examples" takes them to the rest. Each visitor's demo starts fresh, and "Reset demo" at the bottom of each tool starts it over.

### Retake the example card screenshots

The cards on `/websites`, `/business-tools` and the industry pages use screenshots of the demos. After changing a demo's look:

```bash
node build.js
node tools/shoot-examples.mjs   # needs Playwright, see "Share image and icons"
```

## Add a guide

Guides are hidden until the first one exists. Then a "Guides" link appears in the menu and footer, along with `/guides/` and a page for each guide.

1. Copy `content/guides/_example-guide.html` to `content/guides/your-slug.html` and write the article in plain HTML (`<h2>`, `<p>`, `<ul>`, `<a>`). Files starting with `_` are never published.
2. Add it to `guides` in `content.json`:

```json
"guides": [
  {
    "slug": "replace-the-spreadsheet",
    "title": "When should a spreadsheet become a business tool?",
    "description": "Five signs your spreadsheet is costing you time, and what to do instead.",
    "date": "2026-11-01",
    "file": "content/guides/replace-the-spreadsheet.html"
  }
]
```

## Privacy and terms

`content/pages/privacy.html` and `content/pages/terms.html` are **plain-English drafts, not legal advice**. Each starts with a "review before launch" comment that lists what to check, including stopping a project part-way, reusing general building blocks, the 6-month minimum on Care and Care Plus, the yearly renewal, the Consumer Protection Act and the ECTA details for businesses that sell online. Read both and change anything that doesn't match how you work. Ideally, have an attorney look them over before you launch. Change `legal.lastUpdated` whenever you edit them.

## Deploy to Cloudflare

### The easy way: connect GitHub (recommended)

Done once, in the browser. After that, every change merged into `main` goes live by itself in about a minute.

1. Sign up or log in at [dash.cloudflare.com](https://dash.cloudflare.com). The free plan is enough.
2. Go to **Workers & Pages → Create**, and choose to import a repository from GitHub.
3. Choose **Connect GitHub**. When GitHub asks, give Cloudflare access to **only the Websites repository**.
4. Pick the **Websites** repository. Then fill in:

   | Setting | Value |
   |---|---|
   | Project name | `frontdoorsites` (must match `name` in `wrangler.toml`) |
   | Build command | `node build.js` |
   | Deploy command | `npx wrangler deploy` |
   | Production branch | `main` |

5. Choose **Deploy**. When it finishes, the site is live at `https://frontdoorsites.<your-account>.workers.dev`. The exact link is on the project's page.

If you use a different project name, change `name` in `wrangler.toml` to the same name, or the deploy step fails.

Other branches, like a branch for a pull request, are built as preview versions and don't go live, so you can check changes before you merge them.

### The other way: upload from your computer

Use this if you'd rather not connect GitHub. You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npx wrangler login     # first time only: opens your browser to sign in to Cloudflare
node build.js
npx wrangler deploy    # publishes dist/ to your live site
```

The project name and settings come from `wrangler.toml`.

### Security headers

`wrangler.toml` tells Cloudflare to serve `dist/` as plain files, with clean addresses (`/websites` serves `websites.html`) and `404.html` for unknown pages (the demo café has its own, in `/examples/tin-kettle/`). The build also writes `dist/_headers`. Cloudflare reads it to set security headers (including a strict Content-Security-Policy) and long caching for fonts and assets. If you ever embed something from another website, like a map or a booking widget, add its domain to the Content-Security-Policy in `build.js`, or it will be blocked.

The home page gets its own policy: its inline style and script are allowed by their hashes, and its embedded fonts by `data:`. The hashes are worked out on every build.

The demos get their own rules at the end of `_headers` (written by `demoHeaders()` in `build.js`): they may be shown in a frame on this site only, they're marked `noindex`, they can't send anything anywhere, and each tool's own inline script and styles are allowed by their hashes. Those hashes are worked out on every build, so edit a tool freely and rebuild.

## Connect frontdoorsites.co.za

Pointing the root domain (frontdoorsites.co.za without www) at your Cloudflare site requires the domain's DNS to be on Cloudflare.

1. **Buy the domain.** Cloudflare can't sell .co.za domains, so register `frontdoorsites.co.za` with any South African registrar (for example xneelo, Afrihost or Domains.co.za). You only need the domain itself, not their hosting or email.
2. **Add the domain to Cloudflare.** In the Cloudflare dashboard, choose **Add a domain**, enter `frontdoorsites.co.za` and pick the Free plan. Cloudflare gives you two nameservers.
3. **Change the nameservers** at the company where you registered the .co.za domain, to the two Cloudflare nameservers. Moving existing DNS records (like email MX records) is covered in step 6. It usually takes a few hours, and at most 24–48 hours. Cloudflare emails you when it's active.
4. **Attach the domain to the site.** Go to **Workers & Pages → frontdoorsites → Settings → Domains & Routes → Add → Custom domain**, enter `frontdoorsites.co.za` and confirm. Cloudflare creates the DNS record and the HTTPS certificate for you.
5. **Add www too.** Repeat step 4 with `www.frontdoorsites.co.za`. Then, under the domain's **Rules → Redirect Rules**, use the "Redirect from WWW to root" template, so everyone ends up on `https://frontdoorsites.co.za`.
6. **Keep your email working.** If your email uses this domain, check that its MX records (and any SPF/DKIM TXT records) were copied into Cloudflare's DNS before switching nameservers.

The `workers.dev` address keeps working too. Every page's canonical tag points to frontdoorsites.co.za, so search engines treat that as the real one.

After launch, add the site to [Google Search Console](https://search.google.com/search-console) and submit `https://frontdoorsites.co.za/sitemap.xml`.

## Set up hello@frontdoorsites.co.za

The site shows `hello@frontdoorsites.co.za`, so set it up before launch. Cloudflare Email Routing forwards it to the inbox you already use, for free. It needs the domain on Cloudflare first (steps 1–3 of Connect frontdoorsites.co.za).

1. In the Cloudflare dashboard, open `frontdoorsites.co.za`, then **Email → Email Routing**, and choose **Get started**.
2. Create the custom address `hello`, set the action to **Send to an email**, and enter the inbox you want it forwarded to.
3. Cloudflare emails that inbox a link. Click it to confirm the address.
4. Let Cloudflare **add the DNS records** it asks for (MX and TXT). If the domain already gets email somewhere else, don't do this: those records would replace your current email setup.
5. Send a test email to `hello@frontdoorsites.co.za` and check it arrives.

Email Routing only receives email. When you reply, the reply comes from your own address. To reply as hello@, you need a mail service that can send, such as Zoho Mail, Google Workspace, or Gmail's "Send mail as" with an SMTP provider.

To use a different address, change `contact.email` in `content.json`. Leave it blank to hide email everywhere and use WhatsApp only.

## Share image and icons (optional)

`src/static/og-image.png` is the 1200×630 picture shown when someone shares a link on WhatsApp or Facebook. It's generated from the SVG artwork in `src/svg.js`, as are the favicon and touch icon. To regenerate them after changing the logo:

```bash
npm install --no-save playwright   # once; doesn't change package.json
npx playwright install chromium    # once
node tools/make-images.mjs
```

## Fonts

Headings use **Fraunces**; body text uses **Figtree**. Both are self-hosted from `src/fonts/` (no Google Fonts requests) under the SIL Open Font Licence, and the licence files are included. The home page carries its own copies inside `src/home/index.html`.

The demos each have their own fonts, all from Google Fonts and self-hosted the same way, so no demo loads anything from another company (as the privacy policy says): Caprasimo and Work Sans (Tin Kettle), Syne and Manrope (Bright Cuts), Barlow Condensed and Barlow (Coastline Painting) and IBM Plex Sans (Khumalo Plumbing). They're in `src/examples/fonts/`, cut down to the Latin letters, with their licences.
