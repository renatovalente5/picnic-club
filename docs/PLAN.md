# Picnic Club — build plan

Written 2 Oct 2026. Client material and every decision behind this plan live in
`_cliente/BRIEFING.md` (Portuguese, never committed). This file is the technical summary.

## Decisions (Renato, 2 Oct 2026)

- New site from scratch; the old Framer site goes away when DNS moves.
- **Same structure and composition as https://www.aboutevents.com.pt/**, with Picnic Club's own
  colours (warm ivory, cream, sand, warm gold `#C6A76A`, very dark olive text), copy, photos and
  logo. Nothing is copied from About Events: no text, photo, font file or code.
- **English first**, for the site, the panel and the code. Portuguese is added at the end.
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
| Panel | private repo `picnic-club-panel`: Cloudflare Worker, email codes, GitHub App that commits `content/` and `media/` |
| Forms | the Worker receives enquiries (to hello@picnicclub.pt) and reviews (queued for Ana) |
| DNS | Cloudflare zone; site DNS-only to GitHub Pages; MX stays with Hostinger mail |

## Phases

1. **Public site (EN)**: design system, every page with real copy, responsive images, hero video,
   legal pages, SEO basics. Reviewed locally (desktop + phone screenshots) before anything else.
2. **Forms**: enquiry and review endpoints in the Worker; Turnstile; emails; moderation queue.
3. **Panel**: screens for Home, Experiences, Portfolio, Reviews, Press, Founder, Instagram strip,
   Journal, Settings, Publishing.
4. **Go live**: Cloudflare zone, GitHub Pages, Search Console, Bing, Business Profile, legal check.
5. **Portuguese** (done 5 Oct 2026): English at the root, Portuguese under `/pt/` with Portuguese
   addresses (`/pt/experiencias/piqueniques-de-luxo/`…), `hreflang` on every page and in the sitemap,
   a PT/EN switch (last link of the bar; top left of the phone menu). On the first page of a visit an
   English page sends to Portuguese whoever chose it with the switch, or has a device set to Portuguese;
   a `/pt/` address is always kept. The only thing stored on the device is that explicit choice.
   The build stops on a Portuguese page linking to English, a missing Portuguese text, or a photo
   without a Portuguese alt text.
