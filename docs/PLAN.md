# Picnic Club — build plan

Written 2 Oct 2026. Client material and every decision behind this plan live in
`_cliente/BRIEFING.md` (Portuguese, never committed). This file is the technical summary.

## Decisions (Renato, 2 Oct 2026)

- New site from scratch; the old Framer site goes away when DNS moves.
- **Same structure and composition as https://www.aboutevents.com.pt/**, with Picnic Club's own
  colours (warm ivory, cream, sand, warm gold `#C6A76A`, very dark olive text), copy, photos and
  logo. Nothing is copied from About Events: no text, photo, font file or code.
- **English first**, for the site, the panel and the code. Portuguese is added at the end.
  *Changed 5 Oct 2026 (Renato): Ana writes in Portuguese, in her panel, and the English is translated
  by itself. The content's source is now Portuguese (see «Two languages» below); the code stays in
  English, the panel is in Portuguese.*
- **No prices on the site.** Visitors enquire and get a quote.
- **No newsletter, no discounts, no analytics, no cookies.** Google Business Profile (service area,
  no address), Google Search Console and Bing Webmaster Tools; sitemap `lastmod` from git;
  IndexNow after each deploy.
- **Reviews are written by clients on the site** and moderated by Ana in the panel. Example
  reviews are allowed while building, flagged `example: true`; a CI guard refuses to publish
  to the domain while any is visible (inventing reviews is banned: Omnibus / DL 109-G/2021).
- **Photos on the site: the 29 Ana sent on WhatsApp** (`_cliente/fotografias/`). The
  photographer's galleries are for social media, not for the site.
- A **beautiful, simple, organised panel**; Ana is fully autonomous.

## Architecture (same proven shape as LR Motors / Armazém dos Pneus)

| Piece | What |
|---|---|
| This repo | public site: `content/*.json` + `media/` → `scripts/build.mjs` (Node, no dependencies) → `_site/` → GitHub Pages |
| Images | `scripts/images.py` (Pillow): AVIF + WebP + JPEG at fixed widths, cached in `.cache/` |
| Video | `scripts/video.sh` (ffmpeg), run by hand; outputs committed under `media/video/` |
| Panel | private repo `picnic-club-painel`: Cloudflare Worker at `backoffice.picnicclub.pt`, email codes, GitHub App that commits `content/` and `media/photos/`, and the English translations (Workers AI) |
| Forms | the same Worker receives enquiries (emailed to hello@picnicclub.pt) and reviews (queued for Ana) |
| DNS | Cloudflare zone; site DNS-only to GitHub Pages; MX stays with Hostinger mail |

## Phases

1. **Public site (EN)**: design system, every page with real copy, responsive images, hero video,
   legal pages, SEO basics. Reviewed locally (desktop + phone screenshots) before anything else.
2. **Forms**: enquiry and review endpoints in the Worker; Turnstile; emails; moderation queue.
3. **Panel**: screens for Home, Experiences, Portfolio, Reviews, Press, Founder, Instagram strip,
   Journal, Settings, Publishing.
4. **Go live** (done 5 Oct 2026, ~20h): **https://picnicclub.pt** is this site (GitHub Pages with the
   custom domain, Let's Encrypt certificate for picnicclub.pt and www until 3 Jan 2027, HTTPS enforced;
   DNS in the Cloudflare zone: 4 A + 4 AAAA of GitHub Pages, www CNAME renatovalente5.github.io, DNS
   only). `publish.yml` runs `build.mjs --production`; the example reviews left; the old Framer
   addresses send on (OLD_ADDRESSES in `build.mjs`). Still to do, with Renato's accounts: Search
   Console, Bing, Business Profile.
5. **Portuguese** (done 5 Oct 2026): English at the root, Portuguese under `/pt/` with Portuguese
   addresses (`/pt/experiencias/piqueniques-de-luxo/`…), `hreflang` on every page and in the sitemap,
   a PT/EN switch (last link of the bar; top left of the phone menu). A first visit is always in
   English, whatever the device's language (Ana, 5 Oct 2026); on later visits an English page sends to
   Portuguese only whoever chose it with the switch. A `/pt/` address is always kept. The only thing
   stored on the device is that explicit choice.
   The build stops on a Portuguese page linking to English, a missing Portuguese text, or a photo
   without a Portuguese alt text.

## Two languages, one source (5 Oct 2026)

- `content/` is **Portuguese**: what Ana writes in the panel. Photos are described in
  `content/photos.json` (the alt text in Portuguese, the focus point).
- `content/i18n/en/<same path>` is the **English**: one entry per translated field,
  `{ "t": translation, "h": digest of the Portuguese it came from }`. Which fields are translated, how
  a translation is checked (numbers, the brand, markup, length) and how it is applied are in
  `src/lib/traduziveis.mjs`. A list item's translation is found by its digest, so reordering a list
  never pairs a text with another's translation.
- The panel's Worker translates what changed (Workers AI, Gemma 4, Mistral as a reserve) after each
  save and every 10 minutes, and commits `content/i18n/en/`. Until it does, the English page keeps the
  previous translation if it still fits, or shows the Portuguese.
- The addresses do not change: English at the root (`/experiences/luxury-picnics/`, the file's name),
  Portuguese under `/pt/` (`/pt/experiencias/piqueniques-de-luxo/`, the experience's `slug`).
- `src/lib/regras.mjs` holds the content rules: the build stops on a «bloqueia», the panel says so
  before saving, and its Worker refuses a save that brings a new one. Both shared files have
  byte-for-byte copies in the panel.
- The migration seeded the English from the English copy written so far, so nothing on the English
  pages changed except two things on purpose: the enquiry form sends the place as written in Portuguese
  («Lisboa») from both languages, and the NiT summary in English now translates the Portuguese one.
