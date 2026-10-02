// Shared building blocks: images, links, header, footer and the page shell.
import { html, raw, attrs } from './html.mjs';

export const NAV_LEFT = [
  { label: 'Experiences', href: '/experiences/' },
  { label: 'Proposals', href: '/experiences/marriage-proposals/' },
  { label: 'Elopements', href: '/experiences/elopement-weddings/' },
];
export const NAV_RIGHT = [
  { label: 'Our story', href: '/our-story/' },
  { label: 'Reviews', href: '/reviews/' },
  { label: 'Plan your experience', href: '/plan-your-experience/', cta: true },
];
export const LEGAL_LINKS = [
  { label: 'Legal notice', href: '/legal-notice/' },
  { label: 'Terms & cancellations', href: '/terms/' },
  { label: 'Privacy', href: '/privacy/' },
  { label: 'Cookies', href: '/cookies/' },
];
export const COMPLAINTS_BOOK = 'https://www.livroreclamacoes.pt/inicio';

/** <picture> with AVIF and WebP sources from the image manifest. */
export function picture(ctx, name, { sizes = '100vw', className = '', eager = false, alt } = {}) {
  const m = ctx.images[name];
  if (!m) throw new Error(`Unknown image "${name}". Add it to media/photos.json.`);
  ctx.usedImages.add(name);
  const set = (ext) => m.widths.map((w) => `/assets/img/${name}-${m.hash}-${w}.${ext} ${w}w`).join(', ');
  const fallback = m.widths.find((w) => w >= 1080) ?? m.widths[m.widths.length - 1];
  const formats = m.formats || ['avif', 'webp'];
  return html`<picture${attrs({ class: className || false })}>${formats.map((ext) => html`<source type="image/${ext}" srcset="${set(ext)}" sizes="${sizes}">`)}<img src="/assets/img/${name}-${m.hash}-${fallback}.webp" width="${m.width}" height="${m.height}" alt="${alt ?? m.alt}" data-img="${name}"${attrs(eager ? { fetchpriority: 'high' } : { loading: 'lazy' })} decoding="async"></picture>`;
}

export function shareImage(ctx, name) {
  const m = ctx.images[name];
  if (!m) throw new Error(`Unknown share image "${name}". Add it to media/photos.json.`);
  ctx.usedImages.add(name);
  return `${ctx.site.url}/assets/img/${m.share}`;
}

export function arrowLink(link, className = 'link-arrow') {
  if (!link) return '';
  return html`<a class="${className}" href="${link.href}">${link.label}<span aria-hidden="true">&nbsp;→</span></a>`;
}

export function paragraphs(list, className = '') {
  return (Array.isArray(list) ? list : [list]).map((p) => html`<p${attrs({ class: className || false })}>${p}</p>`);
}

export function whatsappHref(site, text = site.whatsappMessage) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

function navLinks(items, current) {
  return items.map(
    (item) =>
      html`<a${attrs({ href: item.href, class: item.cta ? 'nav__cta' : false, 'aria-current': current === item.href ? 'page' : false })}>${item.label}</a>`
  );
}

export function header(ctx, page) {
  const current = page.path;
  return html`<header class="site-header" id="top">
  <div class="site-header__inner">
    ${current === '/plan-your-experience/' ? '' : html`<a class="header-cta" href="/plan-your-experience/">Enquire</a>`}
    <nav class="nav nav--left" aria-label="Experiences">${navLinks(NAV_LEFT, current)}</nav>
    <a class="brand" href="/" aria-label="Picnic Club, home">
      <img class="brand__gold" src="/assets/brand/wordmark-gold.png" width="900" height="193" alt="">
      <img class="brand__white" src="/assets/brand/wordmark-white.png" width="900" height="193" alt="">
    </a>
    <nav class="nav nav--right" aria-label="About and contact">${navLinks(NAV_RIGHT, current)}</nav>
    <button class="menu-button" type="button" aria-haspopup="dialog" aria-controls="menu">
      <span class="menu-button__lines" aria-hidden="true"></span><span class="visually-hidden">Menu</span>
    </button>
  </div>
</header>
<dialog class="menu" id="menu" aria-label="Menu">
  <div class="menu__top">
    <a class="brand" href="/" aria-label="Picnic Club, home"><img src="/assets/brand/wordmark-gold.png" width="900" height="193" alt=""></a>
    <button class="menu__close" type="button" data-close><span aria-hidden="true">×</span><span class="visually-hidden">Close menu</span></button>
  </div>
  <nav class="menu__nav" aria-label="Main">${navLinks([...NAV_LEFT, ...NAV_RIGHT.filter((i) => !i.cta)], current)}</nav>
  <a class="button button--dark" href="/plan-your-experience/">Plan your experience</a>
  <p class="menu__contact"><a href="${whatsappHref(ctx.site)}">WhatsApp</a> · <a href="${ctx.site.instagram.url}">Instagram</a> · <a href="mailto:${ctx.site.email}">${ctx.site.email}</a></p>
</dialog>`;
}

export function phone(site) {
  const tel = site.phone.replace(/\s+/g, '');
  return html`<a href="tel:${tel}">${site.phone}</a> <span class="call-note">Call to a Portuguese mobile network</span>`;
}

export function footer(ctx) {
  const { site } = ctx;
  return html`<footer class="site-footer">
  <div class="wrap site-footer__grid">
    <div class="site-footer__brand">
      <img class="site-footer__logo" src="/assets/brand/logo-gold.png" width="1200" height="848" alt="Picnic Club">
      <p>Slow luxury experiences, beautifully curated in Portugal.</p>
      <p class="site-footer__areas">${site.areas.join(' · ')}</p>
    </div>
    <nav class="site-footer__col" aria-label="Explore">
      <h2 class="site-footer__title">Explore</h2>
      <ul>${[...NAV_LEFT, ...NAV_RIGHT, { label: 'Press', href: '/press/' }].map((i) => html`<li><a href="${i.href}">${i.label}</a></li>`)}</ul>
    </nav>
    <div class="site-footer__col">
      <h2 class="site-footer__title">Contact</h2>
      <ul>
        <li><a href="mailto:${site.email}">${site.email}</a></li>
        <li>${phone(site)}</li>
        <li><a href="${whatsappHref(site)}">WhatsApp</a></li>
        <li><a href="${site.instagram.url}">Instagram ${site.instagram.handle}</a></li>
        <li><a href="${site.facebook}">Facebook</a></li>
      </ul>
    </div>
    <nav class="site-footer__col" aria-label="Legal">
      <h2 class="site-footer__title">Legal</h2>
      <ul>${LEGAL_LINKS.map((i) => html`<li><a href="${i.href}">${i.label}</a></li>`)}
        <li><a href="${COMPLAINTS_BOOK}">Livro de Reclamações (complaints book)</a></li>
      </ul>
    </nav>
  </div>
  <div class="wrap site-footer__legal">
    <p>© ${ctx.year} PICNIC CLUB® · <a href="/legal-notice/">Legal notice</a></p>
  </div>
</footer>`;
}

function jsonLd(data) {
  return raw(`<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`);
}

export function organisation(ctx) {
  const { site } = ctx;
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Picnic Club',
    slogan: site.tagline,
    url: site.url + '/',
    logo: `${site.url}/assets/brand/logo-gold.png`,
    image: shareImage(ctx, 'proposal-sunset-sails'),
    email: site.email,
    telephone: site.phone.replace(/\s+/g, ''),
    areaServed: site.areas.map((name) => ({ '@type': 'Place', name: `${name}, Portugal` })),
    sameAs: [site.instagram.url, site.facebook],
  };
}

/** The page shell. `page` = { path, title, description, image, body, hero, schema }. */
export function layout(ctx, page) {
  const { site } = ctx;
  const url = site.url + page.path;
  const hasHero = Boolean(page.hero);
  return html`<!doctype html>
<html lang="en"${attrs({ 'data-hero': hasHero ? 'on' : false })}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Picnic Club">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${page.image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FAF6EF">
${ctx.preview ? raw('<meta name="robots" content="noindex">') : ''}
<link rel="icon" href="/assets/brand/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/assets/brand/favicon-48.png" sizes="48x48" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preload" href="/assets/fonts/italiana-400.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/jost.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${ctx.assets.css}">
${hasHero ? raw(`<script>document.documentElement.dataset.scrolled = scrollY > 80 ? 'yes' : 'no'</script>`) : ''}
<script src="${ctx.assets.js}" defer></script>
${page.schema ? jsonLd(page.schema) : ''}
</head>
<body${attrs({ class: page.bodyClass || false })}>
<a class="skip-link" href="#content">Skip to content</a>
${header(ctx, page)}
<main id="content"${attrs({ class: hasHero ? 'has-hero' : false })}>
${page.body}
</main>
${footer(ctx)}
</body>
</html>
`;
}
