// Every page of the site. Each function returns { path, title, description, image, body, ... }.
import { html, raw, attrs } from './html.mjs';
import { picture, arrowLink, paragraphs, whatsappHref, phone, areasLine, shareImage, organisation, COMPLAINTS_BOOK } from './components.mjs';

const EXPERIENCE_LABELS = {
  'luxury-picnic': 'Luxury Picnic',
  'marriage-proposal': 'Marriage Proposal',
  'elopement-wedding': 'Elopement Wedding',
  'private-event': 'Private Event',
  'bespoke-experience': 'Bespoke Experience',
};
const BUDGETS = ['Up to €750', '€750 – €1,500', '€1,500 – €3,000', 'More than €3,000', 'Not sure yet'];
const SOURCES = ['Instagram', 'Google', 'NiT', 'A friend or family member', 'A hotel or planner', 'Other'];

// ---------------------------------------------------------------- shared sections

function pageHero(ctx, { photo, eyebrow, title, lead, id = 'page-title', portrait = false }) {
  return html`<section class="${portrait ? 'page-hero page-hero--portrait' : 'page-hero'}" aria-labelledby="${id}">
  <div class="page-hero__media">${picture(ctx, photo, { eager: true, sizes: '100vw' })}</div>
  <div class="page-hero__veil"></div>
  <div class="page-hero__content wrap">
    <h1 class="display page-hero__title" id="${id}">${title}</h1>
    ${lead ? html`<p class="page-hero__lead">${lead}</p>` : ''}
  </div>
</section>`;
}

function pressStrip(ctx, label = 'As featured in') {
  const items = ctx.content.press.items;
  if (!items.length) return '';
  return html`<section class="press" aria-label="Press">
  <div class="wrap press__inner">
    <p class="eyebrow">${label}</p>
    <ul class="press__list">${items.map((i) => html`<li><a class="press__item" href="${i.url}" rel="noopener">${i.outlet.split(' — ')[0]}</a></li>`)}</ul>
    <a class="link-arrow link-arrow--small" href="/press/">All press<span aria-hidden="true">&nbsp;→</span></a>
  </div>
</section>`;
}

function reviewCard(review, { large = false } = {}) {
  return html`<figure class="${large ? 'review review--large' : 'review'}">
  ${review.example ? html`<p class="review__example">Example</p>` : ''}
  <blockquote><p>${review.text}</p></blockquote>
  <figcaption><span class="review__names">${review.names}</span>${review.location ? html`<span class="review__place">${review.location}</span>` : ''}${review.experience ? html`<span class="review__exp">${EXPERIENCE_LABELS[review.experience] || ''}</span>` : ''}</figcaption>
</figure>`;
}

function locationsList(site) {
  return html`<ul class="places">${site.areas.map((a) => html`<li>${a}</li>`)}</ul>`;
}

// ---------------------------------------------------------------- home

/**
 * The gallery wall: photographs and short silent films, laid out in four columns in reading
 * order (item 1 tops the first column, item 2 the second…). On a phone the first two rows show.
 * A film is its poster (a real <picture>, with the alt text) and a <video> that site.js fills
 * and plays only while it is on screen.
 */
function moments(ctx, g) {
  const columns = [[], [], [], []];
  g.items.forEach((item, i) => columns[i % 4].push({ ...item, extra: i >= 8 }));
  const sizes = '(min-width: 900px) 23vw, (min-width: 700px) 31vw, 47vw';
  const tile = (item) => {
    const extra = attrs({ 'data-extra': item.extra ? '' : false });
    if (!item.film) return html`<figure class="moment"${extra}>${picture(ctx, item.photo, { sizes })}</figure>`;
    return html`<figure class="moment moment--film"${extra}>${picture(ctx, `${item.film}-poster`, { sizes, alt: item.alt })}<video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" data-src="/assets/video/${item.film}.mp4"></video></figure>`;
  };
  return html`<section class="moments" aria-labelledby="moments-title" data-films>
  <div class="wrap moments__head">
    <div>
      <p class="eyebrow moments__eyebrow">${g.eyebrow}</p>
      <h2 class="display" id="moments-title">${g.title}</h2>
    </div>
    <div class="moments__aside">
      <p>${g.text}</p>
      <p class="moments__actions">${arrowLink(g.link)}<button class="moments__pause" type="button" hidden data-state="paused" data-films-toggle><span class="moments__pause-icon" aria-hidden="true"></span><span class="moments__pause-label" data-films-label>Play videos</span></button></p>
    </div>
  </div>
  <div class="wrap moments__wall">${columns.map((col) => html`<div class="moments__col" data-reveal>${col.map(tile)}</div>`)}</div>
</section>`;
}

/** The home page shows three reviews side by side, a featured one first. */
function homeReviews(items) {
  const first = items.find((r) => r.featured) || items[0];
  if (!first) return [];
  return [first, ...items.filter((r) => r !== first).slice(0, 2)];
}

function quote(review) {
  const meta = [EXPERIENCE_LABELS[review.experience], review.location].filter(Boolean).join(' · ');
  return html`<figure class="quote">
  <div class="quote__top"><span class="quote__mark" aria-hidden="true">“</span>${review.example ? html`<p class="review__example">Example</p>` : ''}</div>
  <blockquote><p>${review.text}</p></blockquote>
  <figcaption><span class="quote__names">${review.names}</span>${meta ? html`<span>${meta}</span>` : ''}</figcaption>
</figure>`;
}

function heroPoster(ctx, hero) {
  const pick = (name) => ctx.images[name];
  const p = pick(hero.video.posterPortrait);
  const l = pick(hero.video.posterLandscape);
  ctx.usedImages.add(hero.video.posterPortrait);
  ctx.usedImages.add(hero.video.posterLandscape);
  const set = (name, m, ext) => m.widths.map((w) => `/assets/img/${name}-${m.hash}-${w}.${ext} ${w}w`).join(', ');
  const formats = l.formats || ['avif', 'webp'];
  return html`<picture>
    ${formats.map((ext) => html`<source media="(orientation: portrait)" type="image/${ext}" srcset="${set(hero.video.posterPortrait, p, ext)}" sizes="100vw">`)}
    ${formats.map((ext) => html`<source type="image/${ext}" srcset="${set(hero.video.posterLandscape, l, ext)}" sizes="100vw">`)}
    <img src="/assets/img/${hero.video.posterLandscape}-${l.hash}-1440.webp" width="${l.width}" height="${l.height}" alt="" fetchpriority="high" decoding="async">
  </picture>`;
}

export function home(ctx) {
  const h = ctx.content.home;
  const experiences = ctx.content.experiences;
  const kind = homeReviews(ctx.content.reviews.items);
  const body = html`
<section class="hero" aria-labelledby="hero-title">
  <div class="hero__media">
    ${heroPoster(ctx, h.hero)}
    <video class="hero__video" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"
      data-landscape="/assets/video/${h.hero.video.landscape}" data-portrait="/assets/video/${h.hero.video.portrait}"></video>
  </div>
  <div class="hero__veil"></div>
  <div class="hero__content">
    <h1 class="display hero__title" id="hero-title">${h.hero.title}</h1>
    <p class="hero__text">${h.hero.text}</p>
    <div class="hero__actions">
      <a class="button button--gold" href="${h.hero.primary.href}">${h.hero.primary.label}</a>
      <a class="button button--ghost" href="${h.hero.secondary.href}">${h.hero.secondary.label}</a>
    </div>
  </div>
  <button class="round-pause hero__pause" type="button" hidden data-state="paused" title="Play video"><span class="round-pause__icon" aria-hidden="true"></span><span class="round-pause__label">Play video</span></button>
</section>

<section class="split wrap" aria-labelledby="intro-title">
  <div class="split__text">
    <h2 class="display" id="intro-title">${h.intro.title}</h2>
    <div class="prose">${paragraphs(h.intro.text)}</div>
    <p class="intro-places">${areasLine(ctx.site)}</p>
    ${arrowLink(h.intro.link)}
  </div>
  <div class="collage" data-reveal>
    ${h.intro.photos.map((p, i) => html`<figure class="collage__item collage__item--${i + 1}">${picture(ctx, p, { sizes: '(min-width: 900px) 30vw, 60vw' })}</figure>`)}
  </div>
</section>
<section class="experiences" aria-labelledby="experiences-title">
  <div class="wrap">
    <div class="section-head">
      <h2 class="display" id="experiences-title">${h.experiences.title}</h2>
      <div class="section-head__text"><p>${h.experiences.text}</p>${arrowLink(h.experiences.link)}</div>
    </div>
    <ul class="cards">
      ${experiences.map((e) => html`<li class="card" data-reveal>
        <a class="card__link" href="/experiences/${e.slug}/">
          <div class="card__media">${picture(ctx, e.hero, { sizes: '(min-width: 1100px) 23vw, (min-width: 640px) 46vw, 78vw' })}</div>
          <h3 class="display card__title">${e.name}</h3>
          <p class="card__text">${e.short}</p>
          <span class="card__more">Discover<span aria-hidden="true"> →</span></span>
        </a>
      </li>`)}
    </ul>
  </div>
</section>

<section class="philosophy" aria-labelledby="philosophy-title">
  <div class="wrap philosophy__inner">
    <h2 class="display" id="philosophy-title">${h.philosophy.title}</h2>
    <p class="philosophy__lines">${h.philosophy.lines.map((l, i) => html`${i ? raw('<br>') : ''}${l}`)}</p>
    <p class="philosophy__text">${h.philosophy.text}</p>
    ${arrowLink(h.philosophy.link)}
  </div>
</section>

${moments(ctx, h.gallery)}

${kind.length ? html`<section class="kind-words wrap" aria-labelledby="reviews-title">
  <h2 class="display kind-words__title" id="reviews-title">${h.reviews.title}</h2>
  <p class="kind-words__intro">${h.reviews.text}</p>
  <ul class="kind-words__list">${kind.map((r) => html`<li>${quote(r)}</li>`)}</ul>
  <p class="kind-words__links">${arrowLink(h.reviews.link)} <a class="link-arrow" href="/reviews/#write">Write a review<span aria-hidden="true">&nbsp;→</span></a></p>
</section>` : ''}

<section class="insta" aria-labelledby="insta-title">
  <div class="wrap">
    <a class="insta__link" href="${ctx.site.instagram.url}">
      <img class="insta__mark" src="/assets/brand/monogram-gold.png" width="600" height="590" alt="">
      <h2 class="display insta__title" id="insta-title">${h.instagram.title}</h2>
      <span class="insta__handle">${ctx.site.instagram.handle}<span aria-hidden="true">&nbsp;→</span></span>
    </a>
  </div>
</section>`;
  return {
    path: '/',
    title: h.seo.title,
    description: h.seo.description,
    image: shareImage(ctx, 'proposal-sunset-sails'),
    hero: true,
    body,
    schema: organisation(ctx),
  };
}

// ---------------------------------------------------------------- experiences

export function experiencesIndex(ctx) {
  const list = ctx.content.experiences;
  const body = html`
${pageHero(ctx, { photo: 'proposal-two-sails-sea', eyebrow: 'Picnic Club', title: 'Experiences', lead: 'Designed around the setting, the occasion and the people you love.' })}
<section class="wrap intro-text">
  <p class="lead">Every PICNIC CLUB experience is styled from scratch for the place and the moment: a quiet beach at sunset, the shade of a cork oak, a pool at the end of the day.</p>
</section>
${list.map((e, i) => html`<section class="${i % 2 ? 'split split--reverse wrap' : 'split wrap'}" aria-labelledby="exp-${e.slug}">
  <div class="split__text">
    <p class="eyebrow">0${i + 1} — Experience</p>
    <h2 class="display" id="exp-${e.slug}">${e.name}</h2>
    <p class="lead lead--small">${e.statement}</p>
    <div class="prose"><p>${e.short}</p></div>
    <a class="link-arrow" href="/experiences/${e.slug}/">Discover ${e.name.toLowerCase()}<span aria-hidden="true">&nbsp;→</span></a>
  </div>
  <figure class="single" data-reveal>${picture(ctx, e.hero, { sizes: '(min-width: 900px) 50vw, 100vw' })}</figure>
</section>`)}
<section class="places-band wrap" aria-labelledby="places-title">
  <h2 class="display" id="places-title">Where we create</h2>
  ${locationsList(ctx.site)}
  <p>${ctx.site.areasNote}</p>
</section>`;
  return {
    path: '/experiences/',
    title: 'Experiences · Luxury picnics, proposals, elopements and private events · Picnic Club',
    description: 'Luxury picnics, marriage proposals, elopement weddings and private events, styled from scratch in Comporta, Tróia, Melides and Lisbon.',
    image: shareImage(ctx, 'proposal-two-sails-sea'),
    body,
  };
}

export function experiencePage(ctx, e) {
  const related = ctx.content.reviews.items.filter((r) => r.experience === e.formValue).slice(0, 2);
  const planHref = `/plan-your-experience/?experience=${e.formValue}`;
  const body = html`
${pageHero(ctx, { photo: e.hero, eyebrow: 'Experience', title: e.name, lead: e.statement })}
<section class="split wrap" aria-labelledby="about-${e.slug}">
  <div class="split__text">
    <h2 class="display" id="about-${e.slug}">The experience</h2>
    <div class="prose">${paragraphs(e.intro)}</div>
    <a class="button button--dark" href="${planHref}">Plan your experience</a>
  </div>
  <figure class="single" data-reveal>${picture(ctx, e.gallery[0], { sizes: '(min-width: 900px) 50vw, 100vw' })}</figure>
</section>
${e.options ? html`<section class="options" aria-labelledby="options-${e.slug}">
  <div class="wrap">
    <h2 class="display" id="options-${e.slug}">Ways to say it</h2>
    <ul class="options__list">${e.options.map((o) => html`<li class="option"><h3 class="display option__name">${o.name}</h3><p>${o.text}</p></li>`)}</ul>
    <p class="options__note">Every proposal is quoted individually, around your plans. <a href="${planHref}">Ask for a proposal</a>.</p>
  </div>
</section>` : ''}
<section class="included wrap" aria-labelledby="included-${e.slug}">
  <div class="section-head">
    <h2 class="display" id="included-${e.slug}">What’s included</h2>
    <div class="section-head__text"><p>Clearly planned, beautifully delivered. Every experience is tailored, so this is where we start rather than where we stop.</p></div>
  </div>
  <ul class="ticks">${e.included.map((i) => html`<li>${i}</li>`)}</ul>
</section>
<section class="gallery wrap" aria-label="Gallery">
  <ul class="gallery__grid">${e.gallery.slice(1).map((p, i) => html`<li class="gallery__item gallery__item--${(i % 5) + 1}" data-reveal>${picture(ctx, p, { sizes: '(min-width: 900px) 45vw, 100vw' })}</li>`)}</ul>
</section>
<section class="extras wrap" aria-labelledby="extras-${e.slug}">
  <div>
    <h2 class="eyebrow" id="extras-${e.slug}">Optional add-ons</h2>
    <ul class="inline-list">${e.addOns.map((a) => html`<li>${a}</li>`)}</ul>
  </div>
  <div>
    <h2 class="eyebrow">Where it can take place</h2>
    <ul class="inline-list">${e.locations.map((a) => html`<li>${a}</li>`)}</ul>
    <p class="extras__note">${ctx.site.areasNote}</p>
  </div>
</section>
${related.length ? html`<section class="reviews-band wrap" aria-label="Reviews">${related.map((r) => reviewCard(r, { large: true }))}</section>` : ''}`;
  return {
    path: `/experiences/${e.slug}/`,
    title: e.seo.title,
    description: e.seo.description,
    image: shareImage(ctx, e.hero),
    body,
  };
}

// ---------------------------------------------------------------- story, press, reviews

export function story(ctx) {
  const s = ctx.content.story;
  const body = html`
${pageHero(ctx, { photo: s.photos[1], eyebrow: s.eyebrow, title: s.title, lead: s.lead, portrait: true })}
<section class="split wrap" aria-labelledby="story-title">
  <div class="split__text">
    <h2 class="display" id="story-title">How it began</h2>
    <div class="prose">${paragraphs(s.story)}</div>
  </div>
  <figure class="single" data-reveal>${picture(ctx, s.photos[0], { sizes: '(min-width: 900px) 50vw, 100vw' })}</figure>
</section>
<section class="quote-band" aria-label="In Ana’s words">
  <figure class="wrap">
    <blockquote><p>${s.quote.split(/(?<=[.!?])\s+/).map((line) => html`<span class="quote-band__line">${line}</span> `)}</p></blockquote>
    <figcaption>Ana, founder of Picnic Club</figcaption>
  </figure>
</section>
<section class="wrap narrow" aria-labelledby="approach-title">
  <h2 class="display" id="approach-title">${s.approach.title}</h2>
  <div class="prose">${paragraphs(s.approach.text)}</div>
  <a class="link-arrow" href="/experiences/">Discover our experiences<span aria-hidden="true">&nbsp;→</span></a>
</section>
${pressStrip(ctx, 'Where you have seen us')}`;
  return { path: '/our-story/', title: s.seo.title, description: s.seo.description, image: shareImage(ctx, s.photos[1]), body };
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, d || 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}

export function press(ctx) {
  const p = ctx.content.press;
  const body = html`
<section class="wrap page-head" aria-labelledby="page-title">
  <p class="eyebrow">Press</p>
  <h1 class="display" id="page-title">${p.title}</h1>
</section>
<section class="wrap press-list" aria-label="Articles">
  <ul>${p.items.map((i) => html`<li class="${i.image ? 'press-entry press-entry--image' : 'press-entry'}">
    ${i.image ? html`<figure class="press-entry__media">${picture(ctx, i.image, { sizes: '(min-width: 900px) 42vw, 100vw' })}</figure>` : ''}
    <div class="press-entry__text">
      <p class="eyebrow">${i.outlet} · <time datetime="${i.date}">${formatDate(i.date)}</time></p>
      <h2 class="display press-entry__title"${attrs({ lang: i.language && i.language !== 'en' ? i.language : false })}>${i.title}</h2>
      <p>${i.summary}</p>
      <a class="link-arrow" href="${i.url}" rel="noopener">Read the article${i.language === 'pt' ? ' (in Portuguese)' : ''}<span aria-hidden="true">&nbsp;→</span></a>
    </div>
  </li>`)}</ul>
</section>`;
  const cover = p.items.find((i) => i.image);
  return { path: '/press/', title: p.seo.title, description: p.seo.description, image: shareImage(ctx, cover ? cover.image : 'proposal-white-roses'), body };
}

function field({ id, label, type = 'text', required = false, autocomplete, hint, options, rows, attrsExtra = {} }) {
  const describedby = hint ? `${id}-hint` : false;
  const common = { id, name: id, required, autocomplete: autocomplete || false, 'aria-describedby': describedby, ...attrsExtra };
  let control;
  if (type === 'select') {
    control = html`<select${attrs(common)}><option value="">Choose…</option>${options.map((o) => html`<option value="${o.value ?? o}">${o.label ?? o}</option>`)}</select>`;
  } else if (type === 'textarea') {
    control = html`<textarea${attrs({ ...common, rows: rows || 6 })}></textarea>`;
  } else {
    control = html`<input${attrs({ ...common, type })}>`;
  }
  return html`<div class="field">
  <label for="${id}">${label}${required ? html`<span class="field__req" aria-hidden="true"> *</span>` : html`<span class="field__opt"> (optional)</span>`}</label>
  ${control}
  ${hint ? html`<p class="field__hint" id="${id}-hint">${hint}</p>` : ''}
  <p class="field__error" id="${id}-error" hidden></p>
</div>`;
}

export function reviews(ctx) {
  const r = ctx.content.reviews;
  const experienceOptions = Object.entries(EXPERIENCE_LABELS).map(([value, label]) => ({ value, label }));
  const body = html`
<section class="wrap page-head" aria-labelledby="page-title">
  <p class="eyebrow">Reviews</p>
  <h1 class="display" id="page-title">${r.title}</h1>
  <p class="page-head__lead">${r.intro}</p>
  <a class="link-arrow" href="#write">Write a review<span aria-hidden="true">&nbsp;→</span></a>
</section>
<section class="wrap reviews-list" aria-label="Reviews">
  ${r.items.length ? html`<ul>${r.items.map((item) => html`<li>${reviewCard(item)}</li>`)}</ul>` : html`<p>The first reviews will appear here soon.</p>`}
</section>
<section class="form-section" id="write" aria-labelledby="write-title">
  <div class="wrap form-layout">
    <div class="form-layout__intro">
      <h2 class="display" id="write-title">Write a review</h2>
      <p>Celebrated with us? We would love to hear how it felt. Your review appears on this page once Picnic Club has read and approved it.</p>
      <p class="small">Your email is only used to confirm the review is yours. It is never published.</p>
    </div>
    <form class="form" id="review-form" data-endpoint="${ctx.site.endpoints.review}" data-kind="review" novalidate>
      <div class="form__grid">
        ${field({ id: 'names', label: 'Your names', required: true, autocomplete: 'name', hint: 'As you would like them to appear, for example “Sofia & Miguel”.' })}
        ${field({ id: 'location', label: 'Where you are from', autocomplete: 'address-level2' })}
        ${field({ id: 'experience', label: 'Your experience', type: 'select', required: true, options: experienceOptions })}
        ${field({ id: 'when', label: 'When it was', hint: 'Month and year, for example “September 2026”.' })}
        ${field({ id: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' })}
      </div>
      ${field({ id: 'text', label: 'Your review', type: 'textarea', required: true, rows: 6, attrsExtra: { minlength: 20, maxlength: 1500 } })}
      <div class="check">
        <input type="checkbox" id="consent" name="consent" required>
        <label for="consent">I agree that Picnic Club may publish this review with the names and place above. <a href="/privacy/">Privacy</a></label>
      </div>
      <p class="field__error" id="consent-error" hidden></p>
      <div class="form__status" role="status" aria-live="polite"></div>
      <button class="button button--dark" type="submit">Send review</button>
    </form>
  </div>
</section>`;
  return { path: '/reviews/', title: r.seo.title, description: r.seo.description, image: shareImage(ctx, 'proposal-embrace'), body };
}

// ---------------------------------------------------------------- enquiry

export function plan(ctx) {
  const { site } = ctx;
  const experienceOptions = Object.entries(EXPERIENCE_LABELS).map(([value, label]) => ({ value, label }));
  const body = html`
<section class="plan" aria-labelledby="page-title">
  <div class="wrap plan__layout">
    <div class="plan__aside">
      <div class="plan__film" data-films>
        ${picture(ctx, 'plan-candles-poster', { sizes: '(min-width: 1000px) 36vw, 100vw', eager: true, alt: 'Seen from above: a candlelit table on the sand at dusk' })}
        <video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" data-src="/assets/video/plan-candles.mp4"></video>
        <button class="round-pause plan__pause" type="button" hidden data-state="paused" data-films-toggle="icon"><span class="round-pause__icon" aria-hidden="true"></span><span class="round-pause__label" data-films-label>Play video</span></button>
      </div>
      <div class="contact-card plan__contact">
        <p class="eyebrow">Prefer to talk?</p>
        <a class="button button--outline" href="${whatsappHref(site)}">WhatsApp</a>
        <p><a href="mailto:${site.email}">${site.email}</a></p>
        <p>${phone(site)}</p>
        <p class="small">${areasLine(site)}. ${site.areasNote}</p>
      </div>
    </div>
    <div class="plan__main">
      <div class="plan__head">
        <p class="eyebrow">Plan your experience</p>
        <h1 class="display" id="page-title">Tell us about your moment.</h1>
        <p class="plan__lead">Share a few details and we will come back to you with ideas and a tailored proposal. ${site.responseTime}</p>
      </div>
      <form class="form" id="enquiry-form" data-endpoint="${site.endpoints.enquiry}" data-kind="enquiry" novalidate>
      <div class="form__grid">
        ${field({ id: 'name', label: 'Name', required: true, autocomplete: 'name' })}
        ${field({ id: 'email', label: 'Email', type: 'email', required: true, autocomplete: 'email' })}
        ${field({ id: 'phone', label: 'Phone / WhatsApp', type: 'tel', autocomplete: 'tel' })}
        ${field({ id: 'experience', label: 'Type of experience', type: 'select', required: true, options: experienceOptions })}
        ${field({ id: 'date', label: 'Preferred date', type: 'date' })}
        ${field({ id: 'location', label: 'Location', type: 'select', options: [...site.areas, 'Somewhere else', 'Not sure yet'] })}
        ${field({ id: 'guests', label: 'Number of guests', type: 'number', attrsExtra: { min: 1, max: 500, inputmode: 'numeric' } })}
        ${field({ id: 'budget', label: 'Budget range', type: 'select', options: BUDGETS })}
      </div>
      ${field({ id: 'message', label: 'Tell us about your plans', type: 'textarea', required: true, rows: 6, attrsExtra: { maxlength: 3000 } })}
      ${field({ id: 'source', label: 'How did you hear about us?', type: 'select', options: SOURCES })}
      <p class="small">We use these details only to reply to you and prepare your proposal. <a href="/privacy/">Privacy</a></p>
      <div class="form__status" role="status" aria-live="polite"></div>
      <button class="button button--dark" type="submit">Send enquiry</button>
    </form>
    </div>
  </div>
</section>`;
  return {
    path: '/plan-your-experience/',
    title: 'Plan your experience · Picnic Club',
    description: 'Tell us about your proposal, elopement, picnic or celebration in Portugal. We reply within one working day.',
    image: shareImage(ctx, 'proposal-candlelit-night'),
    body,
  };
}

// ---------------------------------------------------------------- legal

function legalPage(ctx, { path, title, description, sections }) {
  const body = html`
<section class="wrap page-head" aria-labelledby="page-title">
  <p class="eyebrow">Legal</p>
  <h1 class="display" id="page-title">${title}</h1>
</section>
<article class="wrap legal prose">${sections}</article>`;
  return { path, title: `${title} · Picnic Club`, description, image: shareImage(ctx, 'proposal-sunset-sails'), body };
}

export function legalNotice(ctx) {
  const { site } = ctx;
  const l = site.legal;
  return legalPage(ctx, {
    path: '/legal-notice/',
    title: 'Legal notice',
    description: 'Who runs Picnic Club: identification, contacts, trademark, complaints book and dispute resolution.',
    sections: html`
<h2>Who we are</h2>
<p>This website and the PICNIC CLUB experiences are provided by:</p>
<address>${l.name}<br>${l.status}<br>NIF (tax number) ${l.nif}<br>${l.address.map((line, i) => html`${i ? raw('<br>') : ''}${line}`)}</address>
<p>Email: <a href="mailto:${site.email}">${site.email}</a><br>Phone: ${phone(site)}</p>
<h2>Trademark</h2>
<p>${l.trademark}</p>
<h2>Complaints book</h2>
<p>You can file a complaint in the electronic complaints book: <a href="${COMPLAINTS_BOOK}">livroreclamacoes.pt</a>.</p>
<h2>Alternative dispute resolution</h2>
<p>If a dispute cannot be settled with us directly, you can turn to an alternative dispute resolution (ADR) entity. The competent entity depends on where you live; you can find it at <a href="https://www.consumidor.gov.pt">consumidor.gov.pt</a>. Where no regional centre applies, the competent entity is CNIACC, the National Centre for Information and Arbitration of Consumer Disputes (<a href="https://www.cniacc.pt">cniacc.pt</a>).</p>`,
  });
}

export function terms(ctx) {
  const c = ctx.content.policies.cancellation;
  return legalPage(ctx, {
    path: '/terms/',
    title: 'Terms & cancellations',
    description: 'How booking a Picnic Club experience works, and our cancellation and rescheduling policy.',
    sections: html`
<h2>How booking works</h2>
<p>Every PICNIC CLUB experience is tailored. Once you tell us about your plans, we send you a written proposal with the details and the total price, VAT included. Your experience is confirmed once you accept the proposal and make the payment it sets out.</p>
<h2>Cancellation policy</h2>
<p>${c.intro}</p>
<dl class="rules">${c.rules.map((r) => html`<div><dt>${r.when}</dt><dd>${r.what}</dd></div>`)}</dl>
<h2>Rescheduling</h2>
${paragraphs(c.rescheduling)}
<p>${c.exceptional}</p>
<p>Thank you for understanding that every PICNIC CLUB experience involves advance planning, preparation, staff and supplier commitments.</p>`,
  });
}

export function privacy(ctx) {
  const { site } = ctx;
  return legalPage(ctx, {
    path: '/privacy/',
    title: 'Privacy',
    description: 'How Picnic Club uses the personal data you share through this website.',
    sections: html`
<h2>Who is responsible</h2>
<p>${site.legal.name} (PICNIC CLUB), NIF ${site.legal.nif}, contactable at <a href="mailto:${site.email}">${site.email}</a>, is responsible for your personal data.</p>
<h2>What we collect, and why</h2>
<p><strong>Enquiries.</strong> When you send the “Plan your experience” form we receive your name, email, phone number if you give it, and what you tell us about your plans (type of experience, date, place, number of guests, budget, how you heard about us). We use them only to reply and to prepare your proposal: steps taken at your request before a contract (GDPR art. 6(1)(b)).</p>
<p><strong>Reviews.</strong> When you write a review we receive your names, where you are from, the experience, when it was, your text and your email. We publish the names, the place and the text only with your consent (art. 6(1)(a)), which you can withdraw at any time. The email is never published; we use it to confirm the review is yours.</p>
<p><strong>WhatsApp, email and phone.</strong> If you contact us directly, we use your messages to reply.</p>
<h2>How long we keep it</h2>
<p>Enquiries that do not become a booking are deleted after 12 months. Booking records are kept for as long as the law requires. Reviews stay published until you ask us to remove them.</p>
<h2>Who helps us</h2>
<p>The website is hosted by GitHub Pages (GitHub, Inc., United States), the forms are processed by Cloudflare (Cloudflare, Inc.), and our email is provided by Hostinger. Transfers outside the EU rely on the EU–US Data Privacy Framework and the European Commission’s standard contractual clauses. If you message us on WhatsApp or Instagram, Meta Platforms Ireland processes those messages under its own terms.</p>
<h2>Your rights</h2>
<p>You can ask to access, correct or delete your data, to restrict or object to its use, and to receive it in a portable format, by writing to <a href="mailto:${site.email}">${site.email}</a>. You can also complain to the Portuguese data protection authority, CNPD (<a href="https://www.cnpd.pt">cnpd.pt</a>).</p>
<h2>Cookies</h2>
<p>This website uses no cookies. See <a href="/cookies/">Cookies</a>.</p>`,
  });
}

export function cookies(ctx) {
  return legalPage(ctx, {
    path: '/cookies/',
    title: 'Cookies',
    description: 'Picnic Club’s website uses no cookies and no tracking.',
    sections: html`
<h2>No cookies, no tracking</h2>
<p>This website does not use cookies, analytics, advertising pixels or any other tracking technology, and it stores nothing on your device. That is why you see no cookie banner.</p>
<p>Our fonts and images are served from our own website. Links to Instagram, Facebook and WhatsApp only take you to those services when you choose to follow them; from then on their own policies apply.</p>`,
  });
}

export function notFound(ctx) {
  const body = html`
<section class="wrap page-head page-head--centre" aria-labelledby="page-title">
  <p class="eyebrow">Page not found</p>
  <h1 class="display" id="page-title">This moment is somewhere else.</h1>
  <p class="page-head__lead">The page you were looking for has moved or no longer exists.</p>
  <p><a class="button button--dark" href="/">Back to the home page</a></p>
</section>`;
  return { path: '/404.html', title: 'Page not found · Picnic Club', description: 'This page does not exist.', image: shareImage(ctx, 'proposal-sunset-sails'), body, noIndex: true };
}
