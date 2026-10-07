// Shared building blocks: images, links, header, footer and the page shell.
import { html, raw, attrs } from './html.mjs';
import { LANGS, LOCALE, localize, place, t } from './i18n.mjs';

// The header: two links each side of the logo; the four experiences live in the panel under «Experiences».
// Links are written with their English path; navLinks() puts them in the page's language.
export const NAV_LEFT = [
  { label: 'nav.experiences', href: '/experiences/' },
  { label: 'nav.story', href: '/our-story/' },
];
export const NAV_RIGHT = [
  { label: 'nav.reviews', href: '/reviews/' },
  { label: 'nav.plan', href: '/plan-your-experience/', cta: true },
];
// The footer keeps the two experiences people ask for most by name.
const FOOTER_EXPLORE = [
  { label: 'nav.experiences', href: '/experiences/' },
  { label: 'nav.proposals', href: '/experiences/marriage-proposals/' },
  { label: 'nav.elopements', href: '/experiences/elopement-weddings/' },
  { label: 'nav.story', href: '/our-story/' },
  { label: 'nav.reviews', href: '/reviews/' },
  { label: 'nav.press', href: '/press/' },
];
export const LEGAL_LINKS = [
  { label: 'legal.notice', href: '/legal-notice/' },
  { label: 'legal.terms', href: '/terms/' },
  { label: 'legal.privacy', href: '/privacy/' },
  { label: 'legal.cookies', href: '/cookies/' },
];
export const COMPLAINTS_BOOK = 'https://www.livroreclamacoes.pt/inicio';

/** A photo's description in the page's language (content/photos.json, in Portuguese, and its
 *  translation). A film's poster has none of its own: the film's words go with it, or it is decoration. */
function altFor(ctx, name) {
  if (ctx.images[name].kind === 'poster') return '';
  const alt = ctx.alts[name];
  if (!alt) throw new Error(`Photo "${name}" has no description. Add its "alt" to content/photos.json.`);
  return alt;
}

/** <picture> with AVIF and WebP sources from the image manifest. */
export function picture(ctx, name, { sizes = '100vw', className = '', eager = false, alt } = {}) {
  const m = ctx.images[name];
  if (!m) throw new Error(`Unknown image "${name}". Add it to media/photos/ and content/photos.json.`);
  ctx.usedImages.add(name);
  const set = (ext) => m.widths.map((w) => `/assets/img/${name}-${m.hash}-${w}.${ext} ${w}w`).join(', ');
  const fallback = m.widths.find((w) => w >= 1080) ?? m.widths[m.widths.length - 1];
  const formats = m.formats || ['avif', 'webp'];
  return html`<picture${attrs({ class: className || false })}>${formats.map((ext) => html`<source type="image/${ext}" srcset="${set(ext)}" sizes="${sizes}">`)}<img src="/assets/img/${name}-${m.hash}-${fallback}.webp" width="${m.width}" height="${m.height}" alt="${alt ?? altFor(ctx, name)}" data-img="${name}"${attrs(eager ? { fetchpriority: 'high' } : { loading: 'lazy' })} decoding="async"></picture>`;
}

/** The card a link preview shows (scripts/images.py): the photo beside the logo, and words for it. */
export function shareImage(ctx, name) {
  const m = ctx.images[name];
  if (!m) throw new Error(`Unknown share image "${name}". Add it to media/photos/ and content/photos.json.`);
  ctx.usedImages.add(name);
  const alt = altFor(ctx, name);
  return { url: `${ctx.site.url}/assets/img/${m.share}`, alt: alt ? t(ctx, 'share.withLogo', { alt }) : t(ctx, 'share.logo') };
}

/** The card of the site's address (the home pages): the logo alone on ivory, no photo — when the
 *  site's link is shared on WhatsApp, only the logo (Renato, 6 Oct 2026). scripts/images.py makes it. */
export function logoShareImage(ctx) {
  const m = ctx.images['picnic-club-logo'];
  if (!m) throw new Error('No logo share card: run scripts/images.py.');
  ctx.usedImages.add('picnic-club-logo');
  return { url: `${ctx.site.url}/assets/img/${m.share}`, alt: t(ctx, 'share.logo') };
}

export function arrowLink(ctx, link, className = 'link-arrow') {
  if (!link) return '';
  return html`<a class="${className}" href="${localize(ctx, link.href)}">${link.label}<span aria-hidden="true">&nbsp;→</span></a>`;
}

/** The address of an experience's page, in the page's language. */
export function experienceHref(ctx, e) {
  return localize(ctx, `/experiences/${e.id}/`);
}

export function paragraphs(list, className = '') {
  return (Array.isArray(list) ? list : [list]).map((p) => html`<p${attrs({ class: className || false })}>${p}</p>`);
}

export function whatsappHref(site, text = site.whatsappMessage) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

function navLinks(ctx, items, current) {
  return items.map((item) => {
    const href = localize(ctx, item.href);
    return html`<a${attrs({ href, class: item.cta ? 'nav__cta' : false, 'aria-current': current === href ? 'page' : false })}>${t(ctx, item.label)}</a>`;
  });
}

/** The four languages in the menu, the page's own marked: each link goes to the same page in that
 *  language, and site.js remembers the choice (data-lang). The codes are what shows; a screen reader
 *  hears each language's name in that language. */
function languages(ctx, page) {
  return html`<ul class="langs" aria-label="${t(ctx, 'lang.label')}">${LANGS.map((l) => (l === ctx.lang
    ? html`<li><span class="langs__current" aria-current="true"><span aria-hidden="true">${l.toUpperCase()}</span><span class="visually-hidden" lang="${LOCALE[l].html}">${LOCALE[l].name}</span></span></li>`
    : html`<li><a href="${page.alternates[l]}" hreflang="${LOCALE[l].hreflang}" lang="${LOCALE[l].html}" data-lang="${l}"><span aria-hidden="true">${l.toUpperCase()}</span><span class="visually-hidden">${LOCALE[l].name}</span></a></li>`))}</ul>`;
}

/** The bar has room for one language, not four (the four overlapped the logo on a 1280px laptop):
 *  the page's own, which opens the list of names. A <details>, so it opens without the script too;
 *  site.js closes it on Escape, on a click elsewhere and when the focus leaves it. */
function languageDrop(ctx, page) {
  return html`<details class="lang-drop">
      <summary class="lang-drop__button"><span aria-hidden="true">${ctx.lang.toUpperCase()}</span><span class="visually-hidden">${t(ctx, 'lang.current', { name: LOCALE[ctx.lang].name })}</span><span class="nav__chevron" aria-hidden="true"></span></summary>
      <ul class="lang-drop__list">${LANGS.map((l) => (l === ctx.lang
        ? html`<li><span class="lang-drop__current" aria-current="true">${LOCALE[l].name}</span></li>`
        : html`<li><a href="${page.alternates[l]}" hreflang="${LOCALE[l].hreflang}" lang="${LOCALE[l].html}" data-lang="${l}">${LOCALE[l].name}</a></li>`))}</ul>
    </details>`;
}

/**
 * «Experiences» in the header opens a panel with the four experiences, each with its photograph
 * and its line, and the way to all of them. It opens on hover and on keyboard focus (CSS only),
 * closes with Escape (site.js); the link itself still leads to the experiences page. On any
 * experience page «Experiences» is the one marked as current, not that experience's card. The
 * photographs are lazy, inside a navigation a phone never shows, so a phone never loads them.
 */
function experiencesDrop(ctx, current) {
  const list = ctx.content.experiences;
  const index = localize(ctx, '/experiences/');
  return html`<div class="nav__drop">
    <a class="nav__drop-link" href="${index}"${attrs({ 'aria-current': current === index ? 'page' : current.startsWith(index) ? 'true' : false })}>${t(ctx, 'nav.experiences')}<span class="nav__chevron" aria-hidden="true"></span></a>
    <div class="nav__panel">
      <div class="nav__panel-inner">
        <ul class="nav__cards">${list.map((e) => {
          const href = experienceHref(ctx, e);
          return html`<li><a class="nav__card" href="${href}"${attrs({ 'aria-current': current === href ? 'page' : false })}>
            <span class="nav__card-media">${picture(ctx, e.hero, { sizes: '300px', alt: '' })}</span>
            <span class="nav__card-name">${e.menu || e.name}</span>
            <span class="nav__card-line">${e.statement}</span>
          </a></li>`;
        })}</ul>
        <a class="link-arrow nav__all" href="${index}">${t(ctx, 'nav.allExperiences')}<span aria-hidden="true">&nbsp;→</span></a>
      </div>
    </div>
  </div>`;
}

export function header(ctx, page) {
  const current = page.path;
  return html`<header class="site-header" id="top">
  <div class="site-header__inner">
    <nav class="nav nav--left" aria-label="${t(ctx, 'nav.left')}">${experiencesDrop(ctx, current)}${navLinks(ctx, NAV_LEFT.slice(1), current)}</nav>
    <a class="brand" href="${localize(ctx, '/')}" aria-label="${t(ctx, 'brand.home')}">
      <img class="brand__gold" src="/assets/brand/wordmark-gold.png" width="900" height="193" alt="">
      <img class="brand__white" src="/assets/brand/wordmark-white.png" width="900" height="193" alt="">
    </a>
    <nav class="nav nav--right" aria-label="${t(ctx, 'nav.right')}">${navLinks(ctx, NAV_RIGHT, current)}${languageDrop(ctx, page)}</nav>
    <button class="menu-button" type="button" aria-haspopup="dialog" aria-controls="menu">
      <span class="menu-button__lines" aria-hidden="true"></span><span class="visually-hidden">${t(ctx, 'menu.open')}</span>
    </button>
  </div>
</header>
<dialog class="menu" id="menu" aria-label="${t(ctx, 'menu.open')}" tabindex="-1">
  <div class="menu__top">
    <a class="brand" href="${localize(ctx, '/')}" aria-label="${t(ctx, 'brand.home')}"><img src="/assets/brand/wordmark-gold.png" width="900" height="193" alt=""></a>
    <button class="menu__close" type="button" data-close><span aria-hidden="true">×</span><span class="visually-hidden">${t(ctx, 'menu.close')}</span></button>
  </div>
  <nav class="menu__nav" aria-label="${t(ctx, 'nav.main')}">
    ${navLinks(ctx, NAV_LEFT.slice(0, 1), current)}
    <ul class="menu__sub">${ctx.content.experiences.map((e) => {
      const href = experienceHref(ctx, e);
      return html`<li><a href="${href}"${attrs({ 'aria-current': current === href ? 'page' : false })}>${e.menu || e.name}</a></li>`;
    })}</ul>
    ${navLinks(ctx, [...NAV_LEFT.slice(1), ...NAV_RIGHT.filter((i) => !i.cta)], current)}
  </nav>
  <a class="button button--dark" href="${localize(ctx, '/plan-your-experience/')}">${t(ctx, 'nav.plan')}</a>
  <p class="menu__contact"><a href="${whatsappHref(ctx.site)}">WhatsApp</a> · <a href="${ctx.site.instagram.url}">Instagram</a> · <a href="mailto:${ctx.site.email}">${ctx.site.email}</a></p>
  ${languages(ctx, page)}
</dialog>`;
}

/** The places on one line that only breaks between names, never inside «Alcácer do Sal» or before a dot. */
export function areasLine(ctx) {
  return ctx.site.areas.map((a) => place(ctx, a).replace(/ /g, '\u00a0')).join('\u00a0· ');
}

// Icons: Tabler Icons 3.48.0, outline (MIT, © 2020-2026 Paweł Kuna, https://tabler.io/icons),
// drawn here with a thinner stroke. Inline, so the footer loads nothing from anyone else.
const ICONS = {
  mail: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-10', 'M3 7l9 6l9 -6'],
  phone: ['M5 4h4l2 5l-2.5 1.5a11 11 0 0 0 5 5l1.5 -2.5l5 2v4a2 2 0 0 1 -2 2a16 16 0 0 1 -15 -15a2 2 0 0 1 2 -2'],
  whatsapp: ['M3 21l1.65 -3.8a9 9 0 1 1 3.4 2.9l-5.05 .9', 'M9 10a.5 .5 0 0 0 1 0v-1a.5 .5 0 0 0 -1 0v1a5 5 0 0 0 5 5h1a.5 .5 0 0 0 0 -1h-1a.5 .5 0 0 0 0 1'],
  instagram: ['M4 8a4 4 0 0 1 4 -4h8a4 4 0 0 1 4 4v8a4 4 0 0 1 -4 4h-8a4 4 0 0 1 -4 -4l0 -8', 'M9 12a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M16.5 7.5v.01'],
  facebook: ['M7 10v4h3v7h4v-7h3l1 -4h-4v-2a1 1 0 0 1 1 -1h3v-4h-3a5 5 0 0 0 -5 5v2h-3'],
};

export function icon(name) {
  return raw(`<svg class="icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name].map((d) => `<path d="${d}"/>`).join('')}</svg>`);
}

export function phone(ctx) {
  const { site } = ctx;
  const tel = site.phone.replace(/\s+/g, '');
  return html`<a href="tel:${tel}">${site.phone}</a> <span class="call-note">${t(ctx, 'call.note')}</span>`;
}

export function footer(ctx) {
  const { site } = ctx;
  return html`<footer class="site-footer">
  <div class="wrap site-footer__grid">
    <div class="site-footer__brand">
      <img class="site-footer__logo" src="/assets/brand/wordmark-gold.png" width="900" height="193" alt="Picnic Club">
      <p>${t(ctx, 'footer.tagline')}</p>
      <p class="site-footer__areas">${areasLine(ctx)}</p>
    </div>
    <nav class="site-footer__col" aria-label="${t(ctx, 'footer.explore')}">
      <h2 class="site-footer__title">${t(ctx, 'footer.explore')}</h2>
      <ul>${FOOTER_EXPLORE.map((i) => html`<li><a href="${localize(ctx, i.href)}">${t(ctx, i.label)}</a></li>`)}</ul>
    </nav>
    <div class="site-footer__col">
      <h2 class="site-footer__title">${t(ctx, 'footer.contact')}</h2>
      <ul class="site-footer__contact">
        <li><a href="mailto:${site.email}">${icon('mail')}<span>${site.email}</span></a></li>
        <li><a href="tel:${site.phone.replace(/\s+/g, '')}">${icon('phone')}<span>${site.phone}</span></a><span class="call-note">${t(ctx, 'call.note')}</span></li>
        <li><a href="${whatsappHref(site)}">${icon('whatsapp')}<span>WhatsApp</span></a></li>
        <li><a href="${site.instagram.url}">${icon('instagram')}<span>Instagram</span></a></li>
        <li><a href="${site.facebook}">${icon('facebook')}<span>Facebook</span></a></li>
      </ul>
    </div>
    <nav class="site-footer__col" aria-label="${t(ctx, 'footer.legal')}">
      <h2 class="site-footer__title">${t(ctx, 'footer.legal')}</h2>
      <ul>${LEGAL_LINKS.map((i) => html`<li><a href="${localize(ctx, i.href)}">${t(ctx, i.label)}</a></li>`)}
        <li><a href="${COMPLAINTS_BOOK}">${t(ctx, 'legal.complaints')}</a></li>
      </ul>
    </nav>
  </div>
  <div class="wrap site-footer__legal">
    <p>© ${ctx.year} PICNIC CLUB®</p>
  </div>
</footer>`;
}

function jsonLd(data) {
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

/** Structured data for search engines: one block per page, its items in a @graph. */
export function schemaGraph(...items) {
  return { '@context': 'https://schema.org', '@graph': items };
}

/* The business is one thing on every page (the same @id), whatever page or language describes it.
   Clients never go to an address (each experience happens where they choose, in areaServed), so
   the only address given to search engines is the country; the registered one is in the legal
   notice. */
export function organisation(ctx) {
  const { site } = ctx;
  return {
    '@type': 'LocalBusiness',
    '@id': `${site.url}/#business`,
    name: 'Picnic Club',
    slogan: site.tagline,
    url: site.url + localize(ctx, '/'),
    logo: `${site.url}/assets/brand/logo-gold.png`,
    image: shareImage(ctx, 'proposal-sunset-sails').url,
    email: site.email,
    telephone: site.phone.replace(/\s+/g, ''),
    address: { '@type': 'PostalAddress', addressCountry: 'PT' },
    areaServed: site.areas.map((name) => ({ '@type': 'Place', name: `${place(ctx, name)}, Portugal` })),
    sameAs: [site.instagram.url, site.facebook],
  };
}

/** The site itself, on the home pages: it gives Google the site's name («Picnic Club») to show in
 *  results instead of the bare domain. */
export function website(ctx) {
  const { site } = ctx;
  return {
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    name: 'Picnic Club',
    url: `${site.url}/`,
    inLanguage: LANGS.map((l) => LOCALE[l].hreflang),
    publisher: { '@id': `${site.url}/#business` },
  };
}

/**
 * On the first page of a visit, an English page sends to its twin in Portuguese, Spanish or French
 * only whoever chose that language with the language switch before. A first visit is always in
 * English, whatever language the device is set to (Ana's decision, 5 Oct 2026: the clients see English
 * first and switch if they want). It runs before anything is drawn. An address in another language is
 * always left alone, a page reached from another page of the site too (so «Back» never gets stuck),
 * and nothing is written on the device here: site.js keeps the choice only when someone uses the switch.
 */
function languageRedirect(alternates) {
  // The twin's address is worked out from this one (whatever folder the site is served from:
  // the preview's /picnic-club, nothing on the domain), never from the site's configured URL.
  // hasOwnProperty, never «in»: a stored «constructor» would be found on the prototype.
  const twins = Object.fromEntries(LANGS.filter((l) => l !== 'en').map((l) => [l, alternates[l]]));
  return raw(`<script>(function(){var p;try{p=localStorage.getItem('picnic-lang')}catch(e){}var w=${JSON.stringify(twins)};if(!p||!Object.prototype.hasOwnProperty.call(w,p))return;var r=document.referrer,o=location.origin;if(r&&r.slice(0,o.length)===o)return;var en=${JSON.stringify(alternates.en)},h=location.pathname;if(h.slice(-en.length)!==en)return;location.replace(h.slice(0,h.length-en.length)+w[p]+location.search+location.hash)})()</script>`);
}

/** The page shell. `page` = { path, alternates, title, description, image, body, hero, schema }. */
export function layout(ctx, page) {
  const { site } = ctx;
  const url = site.url + page.path;
  const hasHero = Boolean(page.hero);
  return html`<!doctype html>
<html lang="${LOCALE[ctx.lang].html}"${attrs({ 'data-hero': hasHero ? 'on' : false })}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${ctx.lang === 'en' && !page.noIndex ? languageRedirect(page.alternates) : ''}
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${url}">
${page.noIndex ? '' : html`${LANGS.map((l) => html`<link rel="alternate" hreflang="${LOCALE[l].hreflang}" href="${site.url + page.alternates[l]}">
`)}<link rel="alternate" hreflang="x-default" href="${site.url + page.alternates.en}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="Picnic Club">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${url}">
<meta property="og:locale" content="${LOCALE[ctx.lang].og}">
${LANGS.filter((l) => l !== ctx.lang).map((l) => html`<meta property="og:locale:alternate" content="${LOCALE[l].og}">
`)}
<meta property="og:image" content="${page.image.url}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${page.image.alt}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image:alt" content="${page.image.alt}">
<meta name="theme-color" content="#FAF6EF">
${ctx.preview ? raw('<meta name="robots" content="noindex">') : ''}
<link rel="icon" href="/assets/brand/favicon-16.png" sizes="16x16" type="image/png">
<link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/brand/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/gilda-display-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/jost.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.assets.css}">
${hasHero ? raw(`<script>document.documentElement.dataset.scrolled = scrollY > 80 ? 'yes' : 'no'</script>`) : ''}
<script src="${ctx.assets.js}" defer></script>
${page.schema ? jsonLd(page.schema) : ''}
</head>
<body${attrs({ class: page.bodyClass || false })}>
<a class="skip-link" href="#content">${t(ctx, 'skip')}</a>
${header(ctx, page)}
<main id="content"${attrs({ class: hasHero ? 'has-hero' : false })}>
${page.body}
</main>
${footer(ctx)}
</body>
</html>
`;
}
