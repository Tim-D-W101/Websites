# Front Door Sites website

The marketing site for **frontdoorsites.co.za**: websites and business tools for South African businesses, sold with a free mock-up or plan, a fixed quote and a 50% deposit. A website can be bought three ways: once-off, or for less upfront with the Care or Care Plus monthly plan.

It's a static site:

- every word, price, website option, band, question and contact detail lives in **`content.json`**;
- **`node build.js`** turns that into a finished website in **`dist/`**;
- it's hosted on **Cloudflare**, which serves the files in `dist/` as they are (set up in `wrangler.toml`).

It has no npm dependencies, no frameworks, no cookies and no trackers. You need Node 18 or newer.

```
content.json            ← edit this: prices, website options, terms, FAQ, industry ideas, examples, contact details
content/pages/          ← privacy.html and terms.html (drafts: review before launch)
content/guides/         ← guide articles (none yet)
src/styles.css          ← all styles
src/site.js             ← menu, calculators, enquiry form, examples filter, open/closed sign,
                          the home page's front door and tour, things rising into view
src/calc.js             ← calculator maths (shared by the build and the browser)
src/svg.js              ← logo, the front door, illustrations and icons
src/fonts/              ← Fraunces + Figtree, self-hosted (SIL Open Font Licence)
src/img/examples/       ← screenshots for the Examples page (.webp)
src/static/             ← favicon, share image, touch icon (copied as-is)
tools/make-images.mjs   ← optional: regenerates the share image and icons
build.js                ← the build
```

Pages: Home, `/websites`, `/business-tools`, `/guesthouses`, `/salons`, `/restaurants`, `/examples`, `/pricing`, `/faq`, `/start` (how it works), `/privacy`, `/terms`, a 404 page, `sitemap.xml` and `robots.txt`.

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
| `contact.whatsapp` | International format, digits only, no `+` (e.g. `27821234567`). Turns on the WhatsApp buttons, the sticky phone bar and the enquiry form |
| `contact.email` | Footer, FAQ page, Terms and Privacy, and the "send by email instead" option on the form. Set up the address before you launch (see [Set up hello@frontdoorsites.co.za](#set-up-hellofrontdoorsitescoza)) |
| `contact.serviceArea` | "Based in …" in the footer, the About line and page descriptions (local SEO) |
| `contact.replyHours` | Shown in the footer and next to the enquiry form |
| `contact.googleBusinessProfile` | Optional footer link |
| `process.quoteTime` | How soon a mock-up or plan reaches the client, e.g. `3 working days` |
| `process.paymentMethods` | How deposits and balances are paid. Shown as "You pay by …" |
| `website.buildTime`, `bands[].buildTime` | Typical build time for the business website and each band. Shown on the band cards, the FAQ and the Start page table. Leave one blank to hide that row |
| `website.options[].payfast` | Optional PayFast links: the yearly renewal (on Once-off) and the monthly fee (on Build + Care and Build + Care Plus). Leave them blank to take these payments by EFT (see [How clients pay](#how-clients-pay-plans-and-the-renewal)) |
| `legal.*` | Your legal name, registration number and an address for legal notices (Terms and Privacy pages only) |

If neither WhatsApp nor email is filled in, the enquiry form and every "Free quote" button stay hidden, because there would be nowhere to send them.

### Words that fill themselves in

You can use these in any text in `content.json`, and in the privacy, terms and guide pages:

- **Prices:** `{onceOffBuild}` (R7 500) · `{careBuild}` (R4 999) · `{careMonthly}` (R399/month) · `{carePlusBuild}` (R3 999) · `{carePlusMonthly}` (R699/month) · `{websitesFrom}` (the lowest website build price, R3 999) · `{toolsFrom}` (R5 000) · `{careFrom}` (the cheapest monthly fee, R399/month)
- **Terms:** `{renewalFee}` (R249) · `{changeFee}` (R250) · `{minMonths}` (6) · `{graceDays}` (30) · `{deposit}` (50%) · `{balance}` (50%) · `{quoteValidDays}` · `{noticeDays}` · `{editsDeadline}` · `{editsLive}` · `{suspendAfterDays}`
- **Changes per option:** `{onceOffChanges}` (R250 per change) · `{careChanges}` (3 small changes a month) · `{carePlusChanges}` (10 small changes a month)
- **Yearly payment** (only while it's switched on): `{yearlyPaysMonths}` · `{yearlyFree}` · `{careYearly}` · `{carePlusYearly}`
- **Everything else:** `{quoteTime}` · `{paymentMethods}` · `{spotsTotal}` · `{spotsLeft}` · `{firstName}` · `{serviceArea}` · `{replyHours}` · `{email}` · `{whatsapp}` · `{domain}` · `{legalName}` · `{registrationNumber}` · `{noticeAddress}` · `{lastUpdated}`

The option words come from each option's `id`: `once-off` gives `{onceOffBuild}`, `care-plus` gives `{carePlusBuild}`, and so on.

A FAQ item, or one part of an answer, that needs a blank detail can be hidden until it's filled in: add `"requires": ["process.quoteTime"]`. In the HTML pages, wrap the text in `{{#if contact.email}} … {{/if}}`.

## Change the website prices

A business website can be bought three ways. They live in `website.options`, and show as three cards side by side on `/pricing` and `/websites` (stacked on phones):

```json
{ "id": "care", "name": "Build + Care", "plan": "Care", "featured": true,
  "summary": "Pay less upfront. I keep your site online and make up to 3 small changes for you each month.",
  "build": 4999, "monthly": 399,
  "term": "{minMonths} months", "hosting": "Included", "changes": "3 small changes a month",
  "replies": "Standard (email or WhatsApp)", "report": "", "backups": "Yes",
  "payLabel": "Start Care", "payfast": "" }
```

- **Option prices:** change `build` (the "from" price for the build) and `monthly` (the monthly fee; `null` for once-off). Run `node build.js` and everything updates: the option cards, the price line in the hero ("Websites from R3 999 with Care Plus, or R7 500 once-off"), the home page's "What it costs" and "What it could earn you" chapters, the industry ideas, the calculators, the Start page, the FAQ, the Terms, page descriptions and the search-engine data.
- **The card rows** (Minimum term, Hosting & domain, Changes, Replies, Monthly report, Backups & security) are listed in `website.rows`. Each row shows the option's field with the same `key`. Leave a field blank to show a dash, or write `Yes` to show a tick.
- `"featured": true` gives an option the darker border and the "Most popular" badge (`website.badge`).
- `website.buildTime` is the typical build time for the business website.

### The renewal fee, the change fee and the minimum term

These live in `terms`, and every page that mentions them updates when you rebuild:

| Field | What it does |
|---|---|
| `terms.renewalYearly` | The yearly hosting and domain renewal for once-off websites, from the second year, and for plans after they're cancelled (249 shows as R249) |
| `terms.renewalGraceDays` | How long an unpaid renewal has before the site goes offline (30) |
| `terms.changeFee` | The price of one change on a once-off website (250) |
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

- The offer: the first month of Care or Care Plus free. The wording is in `founding.title`, `founding.text`, `founding.cardNote` (the note on the Care and Care Plus cards) and `founding.startNote`.
- Each time someone signs up as a founding client, lower `spotsLeft` and rebuild.
- When `spotsLeft` reaches `0`, or `enabled` is `false`, the banner and the notes on the option cards disappear everywhere.

## The home page: the front door and the tour

The home page tells the story as you scroll. Everything it says is in `home` in `content.json`.

1. **The front door** (`home.hero`). When the page opens, the heading rises in, the door creaks open a little and a speech bubble types out `bubble`. As you scroll, the door moves to the middle, swings open, the things in `inside` (up to 6, each an `icon` and a `label`) come out of it, and you go through the doorway into the light. Put `*stars*` around words in `h1` to highlight them. `address`, `mat`, `openSign` and `bookButton` are the words drawn on the door picture.
2. **The tour** (`home.tour`): "Come in", with a link to each chapter. Once you're through the door, a bar at the top shows which chapter you're in and how far through you are.
3. **The chapters.** Each has a `kicker` (its name in the tour) and a `short` name (in the bar at the top):

| Chapter | In `content.json` | What it shows |
|---|---|---|
| 1. Why you need a website | `home.why` | A customer's search, step by step (`steps`), on a phone that changes as you read. The phone's made-up example (a salon) is in `phone` |
| 2. How it helps you | `home.helps` | Six cards (`items`, each with an `icon`) |
| 3. What I can build | `home.services`, `home.canBuild`, `home.industries` | Websites and business tools, then tabs of ideas for each kind of business. The industry tabs use each industry page's `ideas` |
| 4. What it could earn you | `home.earn` | Two sliders, the sums and a 12-month chart. `build` is the website option whose price it uses, `carePlan` the plan whose fee it uses, and `defaults` the starting figures |
| 5. What it costs | `home.costs` | The three ways to pay, and the question in `chooser`: each answer points to a website option and explains why it suits |
| 6. How it works | `home.steps` | The four steps; each lights up as you reach it |
| 7. Why it's worth it | `home.compare` | Cards that flip from "without a website" to "with a website" (`rows`) |

After the chapters come the founding-client offer, "Who you'll be dealing with", common questions and the enquiry form.

The icons you can use are listed in `ICONS` in `src/svg.js` (for example `globe`, `calendar`, `form`, `cart`, `clipboard`, `chart`, `clock`, `pin`, `eye`, `chat`, `phone`, `key`).

Everything still works without movement: if someone has asked their phone or computer for reduced motion, the door stays ajar with its labels around it and nothing slides or flips. Without JavaScript, every chapter shows in full: the ideas for each industry one after another, and "without" and "with" side by side.

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

## Add an example

1. Take a screenshot at about 1280×800. Save it as **WebP** in `src/img/examples/`, e.g. `src/img/examples/ibis-house.webp`. [squoosh.app](https://squoosh.app) converts a PNG to WebP in your browser; aim for under 150 KB.
2. Add it to `examples` in `content.json`:

```json
"examples": [
  {
    "name": "Ibis House",
    "kind": "website",
    "status": "demo",
    "niche": "guesthouses",
    "url": "https://ibis-house.example.co.za",
    "image": "img/examples/ibis-house.webp",
    "alt": "The Ibis House home page, with rooms and a Book direct button",
    "blurb": "A four-room guesthouse with live availability."
  }
]
```

- `kind` is `website` or `tool`. Website examples appear on `/websites`, tool examples on `/business-tools`.
- `status` is `demo` for a made-up business or `client` for a real one. Demos are always labelled "Demo" with a note that the business is made up.
- `niche` (optional) is `guesthouses`, `salons` or `restaurants`, and also shows the example on that industry page.
- Once there are examples of both kinds, the Examples page shows an All / Websites / Tools filter.
- **Only add a real business with its owner's permission.**

The build reads the image size, so pictures never make the page jump.

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

`wrangler.toml` tells Cloudflare to serve `dist/` as plain files, with clean addresses (`/websites` serves `websites.html`) and `404.html` for unknown pages. The build also writes `dist/_headers`. Cloudflare reads it to set security headers (including a strict Content-Security-Policy) and long caching for fonts and assets. If you ever embed something from another website, like a map or a booking widget, add its domain to the Content-Security-Policy in `build.js`, or it will be blocked.

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

Headings use **Fraunces**; body text uses **Figtree**. Both are self-hosted from `src/fonts/` (no Google Fonts requests) under the SIL Open Font Licence, and the licence files are included.
