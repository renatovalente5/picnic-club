// Every page of the site. Each function returns { path, title, description, image, body, ... }.
// `path` is the English address; the build gives the Portuguese page its own (src/templates/i18n.mjs).
import { html, raw, attrs } from './html.mjs';
import { picture, arrowLink, paragraphs, whatsappHref, phone, areasLine, icon, shareImage, organisation, experienceHref, COMPLAINTS_BOOK } from './components.mjs';
import { LOCALE, localize, place, t } from './i18n.mjs';

// What the forms send: the same values in both languages, only the words shown change.
const EXPERIENCE_CODES = ['luxury-picnic', 'marriage-proposal', 'elopement-wedding', 'private-event', 'bespoke-experience'];
const SOURCES = ['instagram', 'google', 'nit', 'friend', 'hotel', 'other'];
const experienceOptions = (ctx) => EXPERIENCE_CODES.map((value) => ({ value, label: t(ctx, `exp.${value}`) }));
const experienceLabel = (ctx, code) => (EXPERIENCE_CODES.includes(code) ? t(ctx, `exp.${code}`) : '');

// ---------------------------------------------------------------- shared sections

function pageHero(ctx, { photo, eyebrow, title, lead, id = 'page-title', portrait = false }) {
  // a portrait's words go on the side the person is not: the photo's focus point says where she is
  const onLeft = portrait && parseFloat((ctx.images[photo]?.focus || '50%').split(' ')[0]) < 50;
  const classes = ['page-hero', portrait && 'page-hero--portrait', onLeft && 'page-hero--words-right'].filter(Boolean).join(' ');
  return html`<section class="${classes}" aria-labelledby="${id}">
  <div class="page-hero__media">${picture(ctx, photo, { eager: true, sizes: '100vw' })}</div>
  <div class="page-hero__veil"></div>
  <div class="page-hero__content wrap">
    <h1 class="display page-hero__title" id="${id}">${title}</h1>
    ${lead ? html`<p class="page-hero__lead">${lead}</p>` : ''}
  </div>
</section>`;
}

/** The latest article about Picnic Club: its outlet and date, the article, and the way to all of them on the Press page. */
function pressFeature(ctx, label = t(ctx, 'press.interviews')) {
  const items = [...ctx.content.press.items].sort((a, b) => b.date.localeCompare(a.date));
  const a = items[0];
  if (!a) return '';
  return html`<section class="press-feature" aria-labelledby="press-feature-title">
  <div class="wrap press-feature__inner">
    <h2 class="eyebrow" id="press-feature-title">${label}</h2>
    <p class="press-feature__outlet"><a href="${a.url}"${attrs({ hreflang: a.language || false })}>${a.outlet.split(' — ')[0]}<span class="visually-hidden">: ${t(ctx, 'press.readArticle')}${a.language === 'pt' ? t(ctx, 'press.inPortuguese') : ''}</span></a></p>
    <p class="press-feature__date"><time datetime="${a.date}">${formatDate(ctx, a.date)}</time></p>
    <p class="press-feature__links"><a class="link-arrow" href="${localize(ctx, '/press/')}">${t(ctx, 'press.allInterviews')}<span aria-hidden="true">&nbsp;→</span></a></p>
  </div>
</section>`;
}

/** One review given the stage: large and centred, on cream, with the way to all of them. */
function reviewFeature(ctx, review) {
  const meta = [experienceLabel(ctx, review.experience), review.location && place(ctx, review.location)].filter(Boolean).join(' · ');
  return html`<section class="review-feature" aria-labelledby="review-feature-title">
  <div class="wrap review-feature__inner">
    <h2 class="eyebrow" id="review-feature-title">${t(ctx, 'reviews.kindWords')}</h2>
    <figure class="review-feature__quote">
      ${review.example ? html`<p class="review__example">${t(ctx, 'reviews.example')}</p>` : ''}
      <span class="quote__mark" aria-hidden="true">“</span>
      <blockquote${reviewLang(ctx, review)}><p>${review.text}</p></blockquote>
      <figcaption><span class="quote__names">${review.example ? t(ctx, 'reviews.exampleNames') : review.names}</span>${meta ? html`<span>${meta}</span>` : ''}</figcaption>
    </figure>
    <a class="link-arrow" href="${localize(ctx, '/reviews/')}">${t(ctx, 'reviews.readAll')}<span aria-hidden="true">&nbsp;→</span></a>
  </div>
</section>`;
}

/** A review keeps the words its client wrote: marked with their language when it is not the page's. */
function reviewLang(ctx, review) {
  const lang = review.language || 'en';
  return lang === ctx.lang ? '' : attrs({ lang: LOCALE[lang] ? LOCALE[lang].html : lang });
}

function locationsList(ctx) {
  return html`<ul class="places">${ctx.site.areas.map((a) => html`<li>${place(ctx, a)}</li>`)}</ul>`;
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
      <p class="moments__actions">${arrowLink(ctx, g.link)}<button class="moments__pause" type="button" hidden data-state="paused" data-films-toggle><span class="moments__pause-icon" aria-hidden="true"></span><span class="moments__pause-label" data-films-label>${t(ctx, 'films.play')}</span></button></p>
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

function quote(ctx, review) {
  const meta = [experienceLabel(ctx, review.experience), review.location && place(ctx, review.location)].filter(Boolean).join(' · ');
  return html`<figure class="quote">
  <div class="quote__top"><span class="quote__mark" aria-hidden="true">“</span>${review.example ? html`<p class="review__example">${t(ctx, 'reviews.example')}</p>` : ''}</div>
  <blockquote${reviewLang(ctx, review)}><p>${review.text}</p></blockquote>
  <figcaption><span class="quote__names">${review.example ? t(ctx, 'reviews.exampleNames') : review.names}</span>${meta ? html`<span>${meta}</span>` : ''}</figcaption>
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
      <a class="button button--gold" href="${localize(ctx, h.hero.primary.href)}">${h.hero.primary.label}</a>
      <a class="button button--ghost" href="${localize(ctx, h.hero.secondary.href)}">${h.hero.secondary.label}</a>
    </div>
  </div>
  <button class="round-pause hero__pause" type="button" hidden data-state="paused" title="${t(ctx, 'film.play')}"><span class="round-pause__icon" aria-hidden="true"></span><span class="round-pause__label">${t(ctx, 'film.play')}</span></button>
</section>

<section class="split wrap" aria-labelledby="intro-title">
  <div class="split__text">
    <h2 class="display" id="intro-title">${h.intro.title}</h2>
    <div class="prose">${paragraphs(h.intro.text)}</div>
    <p class="intro-places">${areasLine(ctx)}</p>
    ${arrowLink(ctx, h.intro.link)}
  </div>
  <div class="collage" data-reveal>
    ${h.intro.photos.map((p, i) => html`<figure class="collage__item collage__item--${i + 1}">${picture(ctx, p, { sizes: '(min-width: 900px) 30vw, 60vw' })}</figure>`)}
  </div>
</section>
<section class="experiences" aria-labelledby="experiences-title">
  <div class="wrap">
    <div class="section-head">
      <h2 class="display" id="experiences-title">${h.experiences.title}</h2>
      <div class="section-head__text"><p>${h.experiences.text}</p>${arrowLink(ctx, h.experiences.link)}</div>
    </div>
    <ul class="cards">
      ${experiences.map((e) => html`<li class="card" data-reveal>
        <a class="card__link" href="${experienceHref(ctx, e)}">
          <div class="card__media">${picture(ctx, e.hero, { sizes: '(min-width: 1100px) 23vw, (min-width: 640px) 46vw, 78vw' })}</div>
          <h3 class="display card__title">${e.name}</h3>
          <p class="card__text">${e.short}</p>
          <span class="card__more">${t(ctx, 'home.discover')}<span aria-hidden="true"> →</span></span>
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
    ${arrowLink(ctx, h.philosophy.link)}
  </div>
</section>

${moments(ctx, h.gallery)}

${kind.length ? html`<section class="kind-words wrap" aria-labelledby="reviews-title">
  <h2 class="display kind-words__title" id="reviews-title">${h.reviews.title}</h2>
  <p class="kind-words__intro">${h.reviews.text}</p>
  <ul class="kind-words__list">${kind.map((r) => html`<li>${quote(ctx, r)}</li>`)}</ul>
  <p class="kind-words__links">${arrowLink(ctx, h.reviews.link)} <a class="link-arrow" href="${localize(ctx, '/reviews/#write')}">${t(ctx, 'reviews.write')}<span aria-hidden="true">&nbsp;→</span></a></p>
</section>` : ''}

<section class="insta" aria-labelledby="insta-title">
  <div class="wrap">
    <a class="insta__card" href="${ctx.site.instagram.url}">
      <img class="insta__mark" src="/assets/brand/monogram-gold.png" width="600" height="590" alt="">
      <div class="insta__text">
        <h2 class="eyebrow insta__title" id="insta-title">${h.instagram.title}</h2>
        <span class="insta__handle">${ctx.site.instagram.handle}</span>
      </div>
      <span class="insta__button">${icon('instagram')}${t(ctx, 'home.followInstagram')}</span>
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
${pageHero(ctx, { photo: 'proposal-two-sails-sea', eyebrow: 'Picnic Club', title: t(ctx, 'experiences.title'), lead: t(ctx, 'experiences.lead') })}
<section class="wrap intro-text">
  <p class="lead">${t(ctx, 'experiences.intro')}</p>
</section>
${list.map((e, i) => html`<section class="${i % 2 ? 'split split--reverse wrap' : 'split wrap'}" aria-labelledby="exp-${e.id}">
  <div class="split__text">
    <p class="eyebrow">${t(ctx, 'experiences.number', { n: i + 1 })}</p>
    <h2 class="display" id="exp-${e.id}">${e.name}</h2>
    <p class="lead lead--small">${e.statement}</p>
    <div class="prose"><p>${e.short}</p></div>
    <a class="link-arrow" href="${experienceHref(ctx, e)}">${t(ctx, 'experiences.discover', { name: e.name.toLowerCase() })}<span aria-hidden="true">&nbsp;→</span></a>
  </div>
  <figure class="single" data-reveal>${picture(ctx, e.hero, { sizes: '(min-width: 900px) 50vw, 100vw' })}</figure>
</section>`)}
<section class="places-band wrap" aria-labelledby="places-title">
  <h2 class="display" id="places-title">${t(ctx, 'experiences.where')}</h2>
  ${locationsList(ctx)}
  <p>${ctx.site.areasNote}</p>
</section>`;
  return {
    path: '/experiences/',
    title: t(ctx, 'experiences.seoTitle'),
    description: t(ctx, 'experiences.seoDescription'),
    image: shareImage(ctx, 'proposal-two-sails-sea'),
    body,
  };
}

export function experiencePage(ctx, e) {
  const related = ctx.content.reviews.items.filter((r) => r.experience === e.formValue);
  const planHref = localize(ctx, `/plan-your-experience/?experience=${e.formValue}`);
  const body = html`
${pageHero(ctx, { photo: e.hero, eyebrow: t(ctx, 'experience.eyebrow'), title: e.name, lead: e.statement })}
<section class="split wrap" aria-labelledby="about-${e.id}">
  <div class="split__text">
    <h2 class="display" id="about-${e.id}">${t(ctx, 'experience.about')}</h2>
    <div class="prose">${paragraphs(e.intro)}</div>
    <a class="button button--dark" href="${planHref}">${t(ctx, 'experience.plan')}</a>
  </div>
  <figure class="single" data-reveal>${picture(ctx, e.gallery[0], { sizes: '(min-width: 900px) 50vw, 100vw' })}</figure>
</section>
${e.options ? html`<section class="options" aria-labelledby="options-${e.id}">
  <div class="wrap">
    <h2 class="display" id="options-${e.id}">${t(ctx, 'experience.options')}</h2>
    <ul class="options__list">${e.options.map((o) => html`<li class="option"><h3 class="display option__name">${o.name}</h3><p>${o.text}</p></li>`)}</ul>
    <p class="options__note">${t(ctx, 'experience.optionsNote')} <a href="${planHref}">${t(ctx, 'experience.optionsAsk')}</a>.</p>
  </div>
</section>` : ''}
<section class="included wrap" aria-labelledby="included-${e.id}">
  <div class="section-head">
    <h2 class="display" id="included-${e.id}">${t(ctx, 'experience.included')}</h2>
    <div class="section-head__text"><p>${t(ctx, 'experience.includedNote')}</p></div>
  </div>
  <ul class="ticks">${e.included.map((i) => html`<li>${i}</li>`)}</ul>
</section>
${e.howItWorks ? html`<section class="steps wrap" aria-labelledby="steps-${e.id}">
  <h2 class="display" id="steps-${e.id}">${t(ctx, 'experience.steps')}</h2>
  <ol class="steps__list" role="list">${e.howItWorks.map((s) => html`<li class="step"><h3 class="step__title">${s.title}</h3><p>${s.text}</p></li>`)}</ol>
</section>` : ''}
<section class="gallery wrap" aria-label="${t(ctx, 'experience.gallery')}">
  <ul class="gallery__grid">${e.gallery.slice(1).map((p, i) => html`<li class="gallery__item gallery__item--${(i % 5) + 1}" data-reveal>${picture(ctx, p, { sizes: '(min-width: 900px) 45vw, 100vw' })}</li>`)}</ul>
</section>
<section class="extras wrap" aria-labelledby="extras-${e.id}">
  <div>
    <h2 class="eyebrow" id="extras-${e.id}">${t(ctx, 'experience.addOns')}</h2>
    <ul class="inline-list">${e.addOns.map((a) => html`<li>${a}</li>`)}</ul>
  </div>
  <div>
    <h2 class="eyebrow">${t(ctx, 'experience.where')}</h2>
    <ul class="inline-list">${e.locations.map((a) => html`<li>${place(ctx, a)}</li>`)}</ul>
    <p class="extras__note">${ctx.site.areasNote}</p>
    ${e.weather ? html`<p class="extras__note">${e.weather}</p>` : ''}
  </div>
</section>
${related.length ? reviewFeature(ctx, related.find((r) => r.featured) || related[0]) : ''}`;
  return {
    path: `/experiences/${e.id}/`,
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
    <h2 class="display" id="story-title">${t(ctx, 'story.began')}</h2>
    <div class="prose">${paragraphs(s.story)}</div>
  </div>
  <figure class="single single--story" data-reveal>${picture(ctx, s.photos[0], { sizes: '(min-width: 900px) 34vw, 100vw' })}</figure>
</section>
<section class="quote-band" aria-label="${t(ctx, 'story.inHerWords')}">
  <figure class="wrap">
    <blockquote><p>${s.quote}</p></blockquote>
    <figcaption>${t(ctx, 'story.signature')}</figcaption>
  </figure>
</section>
${pressFeature(ctx)}`;
  return { path: '/our-story/', title: s.seo.title, description: s.seo.description, image: shareImage(ctx, s.photos[1]), body };
}

function formatDate(ctx, iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(Date.UTC(y, m - 1, d || 1)).toLocaleString(LOCALE[ctx.lang].date, { month: 'long', timeZone: 'UTC' });
  if (ctx.lang === 'pt') return d ? `${d} de ${month} de ${y}` : `${month} de ${y}`;
  return d ? `${d} ${month} ${y}` : `${month} ${y}`;
}

export function press(ctx) {
  const p = ctx.content.press;
  const body = html`
<section class="wrap page-head" aria-labelledby="page-title">
  <p class="eyebrow">${t(ctx, 'press.eyebrow')}</p>
  <h1 class="display" id="page-title">${p.title}</h1>
</section>
<section class="wrap press-list" aria-label="${t(ctx, 'press.articles')}">
  <ul>${p.items.map((i) => html`<li class="${i.image ? 'press-entry press-entry--image' : 'press-entry'}">
    ${i.image ? html`<figure class="press-entry__media">${picture(ctx, i.image, { sizes: '(min-width: 900px) 42vw, 100vw' })}</figure>` : ''}
    <div class="press-entry__text">
      <p class="eyebrow">${i.outlet} · <time datetime="${i.date}">${formatDate(ctx, i.date)}</time></p>
      <h2 class="display press-entry__title"${attrs({ lang: i.language && i.language !== ctx.lang ? (LOCALE[i.language] ? LOCALE[i.language].html : i.language) : false })}>${i.title}</h2>
      <p>${i.summary}</p>
      <a class="link-arrow" href="${i.url}" rel="noopener">${t(ctx, 'press.readArticleLink')}${i.language === 'pt' ? t(ctx, 'press.inPortuguese') : ''}<span aria-hidden="true">&nbsp;→</span></a>
    </div>
  </li>`)}</ul>
</section>`;
  const cover = p.items.find((i) => i.image);
  return { path: '/press/', title: p.seo.title, description: p.seo.description, image: shareImage(ctx, cover ? cover.image : 'proposal-white-roses'), body };
}

function field(ctx, { id, label, type = 'text', required = false, autocomplete, hint, options, rows, attrsExtra = {} }) {
  const describedby = hint ? `${id}-hint` : false;
  const common = { id, name: id, required, autocomplete: autocomplete || false, 'aria-describedby': describedby, ...attrsExtra };
  let control;
  if (type === 'select') {
    control = html`<select${attrs(common)}><option value="">${t(ctx, 'form.choose')}</option>${options.map((o) => html`<option value="${o.value ?? o}">${o.label ?? o}</option>`)}</select>`;
  } else if (type === 'textarea') {
    control = html`<textarea${attrs({ ...common, rows: rows || 6 })}></textarea>`;
  } else {
    control = html`<input${attrs({ ...common, type })}>`;
  }
  return html`<div class="field">
  <label for="${id}">${label}${required ? html`<span class="field__req" aria-hidden="true"> *</span>` : html`<span class="field__opt">${t(ctx, 'form.optional')}</span>`}</label>
  ${control}
  ${hint ? html`<p class="field__hint" id="${id}-hint">${hint}</p>` : ''}
  <p class="field__error" id="${id}-error" hidden></p>
</div>`;
}

export function reviews(ctx) {
  const r = ctx.content.reviews;
  const body = html`
<section class="wrap page-head" aria-labelledby="page-title">
  <p class="eyebrow">${t(ctx, 'reviews.eyebrow')}</p>
  <h1 class="display" id="page-title">${r.title}</h1>
  <p class="page-head__lead">${r.intro}</p>
  <a class="link-arrow" href="#write">${t(ctx, 'reviews.write')}<span aria-hidden="true">&nbsp;→</span></a>
</section>
<section class="wrap reviews-list" aria-label="${t(ctx, 'reviews.list')}">
  ${r.items.length ? html`<ul class="reviews-wall">${r.items.map((item) => html`<li>${quote(ctx, item)}</li>`)}</ul>` : html`<p>${t(ctx, 'reviews.none')}</p>`}
</section>
<section class="form-section" id="write" aria-labelledby="write-title">
  <div class="wrap form-layout">
    <div class="form-layout__intro">
      <h2 class="display" id="write-title">${t(ctx, 'reviews.write')}</h2>
      <p>${t(ctx, 'reviews.formIntro')}</p>
      <p class="small">${t(ctx, 'reviews.formEmail')}</p>
    </div>
    <form class="form" id="review-form" data-endpoint="${ctx.site.endpoints.review}" data-kind="review" novalidate>
      <div class="form__grid">
        ${field(ctx, { id: 'names', label: t(ctx, 'reviews.names'), required: true, autocomplete: 'name', hint: t(ctx, 'reviews.namesHint') })}
        ${field(ctx, { id: 'location', label: t(ctx, 'reviews.from'), autocomplete: 'address-level2' })}
        ${field(ctx, { id: 'experience', label: t(ctx, 'reviews.experience'), type: 'select', required: true, options: experienceOptions(ctx) })}
        ${field(ctx, { id: 'when', label: t(ctx, 'reviews.when'), hint: t(ctx, 'reviews.whenHint') })}
        ${field(ctx, { id: 'email', label: t(ctx, 'reviews.email'), type: 'email', required: true, autocomplete: 'email' })}
      </div>
      ${field(ctx, { id: 'text', label: t(ctx, 'reviews.text'), type: 'textarea', required: true, rows: 6, attrsExtra: { minlength: 20, maxlength: 1500 } })}
      <div class="check">
        <input type="checkbox" id="consent" name="consent" required>
        <label for="consent">${t(ctx, 'reviews.consent')} <a href="${localize(ctx, '/privacy/')}">${t(ctx, 'form.privacy')}</a></label>
      </div>
      <p class="field__error" id="consent-error" hidden></p>
      <div class="form__status" role="status" aria-live="polite"></div>
      <button class="button button--dark" type="submit">${t(ctx, 'reviews.send')}</button>
    </form>
  </div>
</section>`;
  return { path: '/reviews/', title: r.seo.title, description: r.seo.description, image: shareImage(ctx, 'proposal-embrace'), body };
}

// ---------------------------------------------------------------- enquiry

export function plan(ctx) {
  const { site } = ctx;
  // the form sends the place as Ana wrote it (in Portuguese) from both languages; only the label changes
  const places = [...site.areas.map((a, i) => ({ value: ctx.source.site.areas[i] ?? a, label: place(ctx, a) })), { value: 'elsewhere', label: t(ctx, 'place.elsewhere') }, { value: 'unsure', label: t(ctx, 'place.unsure') }];
  const sources = SOURCES.map((value) => ({ value, label: t(ctx, `source.${value}`) }));
  const body = html`
<section class="plan" aria-labelledby="page-title">
  <div class="wrap plan__layout">
    <div class="plan__aside">
      <div class="plan__film" data-films>
        ${picture(ctx, 'plan-candles-poster', { sizes: '(min-width: 1000px) 36vw, 100vw', eager: true, alt: t(ctx, 'plan.filmAlt') })}
        <video muted loop playsinline preload="none" aria-hidden="true" tabindex="-1" data-src="/assets/video/plan-candles.mp4"></video>
        <button class="round-pause plan__pause" type="button" hidden data-state="paused" data-films-toggle="icon"><span class="round-pause__icon" aria-hidden="true"></span><span class="round-pause__label" data-films-label>${t(ctx, 'film.play')}</span></button>
      </div>
      <div class="contact-card plan__contact">
        <p class="eyebrow">${t(ctx, 'plan.talk')}</p>
        <a class="button button--outline" href="${whatsappHref(site)}">WhatsApp</a>
        <p><a href="mailto:${site.email}">${site.email}</a></p>
        <p>${phone(ctx)}</p>
        <p class="small">${areasLine(ctx)}. ${site.areasNote}</p>
      </div>
    </div>
    <div class="plan__main">
      <div class="plan__head">
        <p class="eyebrow">${t(ctx, 'plan.eyebrow')}</p>
        <h1 class="display" id="page-title">${t(ctx, 'plan.title')}</h1>
        <p class="plan__lead">${t(ctx, 'plan.lead')} ${site.responseTime}</p>
      </div>
      <form class="form" id="enquiry-form" data-endpoint="${site.endpoints.enquiry}" data-kind="enquiry" novalidate>
      <div class="form__grid">
        ${field(ctx, { id: 'name', label: t(ctx, 'plan.name'), required: true, autocomplete: 'name' })}
        ${field(ctx, { id: 'email', label: t(ctx, 'plan.email'), type: 'email', required: true, autocomplete: 'email' })}
        ${field(ctx, { id: 'phone', label: t(ctx, 'plan.phone'), type: 'tel', autocomplete: 'tel' })}
        ${field(ctx, { id: 'experience', label: t(ctx, 'plan.experience'), type: 'select', required: true, options: experienceOptions(ctx) })}
        ${field(ctx, { id: 'date', label: t(ctx, 'plan.date'), type: 'date' })}
        ${field(ctx, { id: 'location', label: t(ctx, 'plan.location'), type: 'select', options: places })}
        ${field(ctx, { id: 'guests', label: t(ctx, 'plan.guests'), type: 'number', attrsExtra: { min: 1, max: 500, inputmode: 'numeric' } })}
        ${field(ctx, { id: 'source', label: t(ctx, 'plan.source'), type: 'select', options: sources })}
      </div>
      ${field(ctx, { id: 'message', label: t(ctx, 'plan.message'), type: 'textarea', required: true, rows: 6, attrsExtra: { maxlength: 3000 } })}
      <p class="small">${t(ctx, 'plan.privacy')} <a href="${localize(ctx, '/privacy/')}">${t(ctx, 'form.privacy')}</a></p>
      <div class="form__status" role="status" aria-live="polite"></div>
      <button class="button button--dark" type="submit">${t(ctx, 'plan.send')}</button>
    </form>
    </div>
  </div>
</section>`;
  return {
    path: '/plan-your-experience/',
    title: t(ctx, 'plan.seoTitle'),
    description: t(ctx, 'plan.seoDescription'),
    image: shareImage(ctx, 'proposal-candlelit-night'),
    body,
  };
}

// ---------------------------------------------------------------- legal

function legalPage(ctx, { path, title, description, sections }) {
  const body = html`
<section class="wrap page-head page-head--legal" aria-labelledby="page-title">
  <p class="eyebrow">${t(ctx, 'legal.eyebrow')}</p>
  <h1 class="display" id="page-title">${title}</h1>
</section>
<article class="wrap legal prose">${sections}</article>`;
  return { path, title: `${title} · Picnic Club`, description, image: shareImage(ctx, 'proposal-sunset-sails'), body };
}

export function legalNotice(ctx) {
  const { site } = ctx;
  const l = site.legal;
  const address = html`<address>${l.name}<br>${l.status}<br>${ctx.lang === 'pt' ? 'NIF' : 'NIF (tax number)'} ${l.nif}<br>${l.address.map((line, i) => html`${i ? raw('<br>') : ''}${line}`)}</address>`;
  if (ctx.lang === 'pt') {
    return legalPage(ctx, {
      path: '/legal-notice/',
      title: 'Aviso legal',
      description: 'Quem gere a Picnic Club: identificação, contactos, marca, livro de reclamações e resolução de litígios.',
      sections: html`
<h2>Quem somos</h2>
<p>Este site e as experiências PICNIC CLUB são prestados por:</p>
${address}
<p>Email: <a href="mailto:${site.email}">${site.email}</a><br>Telefone: ${phone(ctx)}</p>
<h2>Marca</h2>
<p>${l.trademark}</p>
<h2>Livro de Reclamações</h2>
<p>Pode apresentar uma reclamação no Livro de Reclamações Eletrónico: <a href="${COMPLAINTS_BOOK}">livroreclamacoes.pt</a>.</p>
<h2>Resolução alternativa de litígios</h2>
<p>Se um litígio não puder ser resolvido diretamente connosco, pode recorrer a uma entidade de resolução alternativa de litígios (RAL). A entidade competente depende do local onde vive e pode encontrá-la em <a href="https://www.consumidor.gov.pt">consumidor.gov.pt</a>. Quando nenhum centro regional se aplica, a entidade competente é o CNIACC, Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (<a href="https://www.cniacc.pt">cniacc.pt</a>).</p>`,
    });
  }
  return legalPage(ctx, {
    path: '/legal-notice/',
    title: 'Legal notice',
    description: 'Who runs Picnic Club: identification, contacts, trademark, complaints book and dispute resolution.',
    sections: html`
<h2>Who we are</h2>
<p>This website and the PICNIC CLUB experiences are provided by:</p>
${address}
<p>Email: <a href="mailto:${site.email}">${site.email}</a><br>Phone: ${phone(ctx)}</p>
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
  const rules = html`<dl class="rules">${c.rules.map((r) => html`<div><dt>${r.when}</dt><dd>${r.what}</dd></div>`)}</dl>`;
  if (ctx.lang === 'pt') {
    return legalPage(ctx, {
      path: '/terms/',
      title: 'Termos e cancelamentos',
      description: 'Como funciona a reserva de uma experiência Picnic Club, e a nossa política de cancelamento e de alteração de data.',
      sections: html`
<h2>Como funciona a reserva</h2>
<p>Cada experiência PICNIC CLUB é feita à medida. Depois de nos contar os seus planos, enviamos-lhe uma proposta escrita com os pormenores e o preço total, com IVA incluído. A sua experiência fica confirmada quando aceita a proposta e faz o pagamento nela indicado.</p>
<h2>Política de cancelamento</h2>
<p>${c.intro}</p>
${rules}
<h2>Alteração de data</h2>
${paragraphs(c.rescheduling)}
<p>${c.exceptional}</p>
<p>Obrigado pela compreensão: cada experiência PICNIC CLUB implica planeamento antecipado, preparação e compromissos com a equipa e com os fornecedores.</p>`,
    });
  }
  return legalPage(ctx, {
    path: '/terms/',
    title: 'Terms & cancellations',
    description: 'How booking a Picnic Club experience works, and our cancellation and rescheduling policy.',
    sections: html`
<h2>How booking works</h2>
<p>Every PICNIC CLUB experience is tailored. Once you tell us about your plans, we send you a written proposal with the details and the total price, VAT included. Your experience is confirmed once you accept the proposal and make the payment it sets out.</p>
<h2>Cancellation policy</h2>
<p>${c.intro}</p>
${rules}
<h2>Rescheduling</h2>
${paragraphs(c.rescheduling)}
<p>${c.exceptional}</p>
<p>Thank you for understanding that every PICNIC CLUB experience involves advance planning, preparation, staff and supplier commitments.</p>`,
  });
}

export function privacy(ctx) {
  const { site } = ctx;
  const mail = html`<a href="mailto:${site.email}">${site.email}</a>`;
  if (ctx.lang === 'pt') {
    return legalPage(ctx, {
      path: '/privacy/',
      title: 'Privacidade',
      description: 'Como a Picnic Club usa os dados pessoais que partilha através deste site.',
      sections: html`
<h2>Responsável pelo tratamento</h2>
<p>${site.legal.name} (PICNIC CLUB), NIF ${site.legal.nif}, contactável através de ${mail}, é a responsável pelo tratamento dos seus dados pessoais.</p>
<h2>Que dados recolhemos e porquê</h2>
<p><strong>Pedidos de proposta.</strong> Quando envia o formulário «Pedir proposta», recebemos o seu nome, o seu email, o seu telefone se o indicar, e o que nos conta sobre os seus planos (tipo de experiência, data, local, número de convidados e como nos conheceu). Usamos estes dados apenas para lhe responder e preparar a sua proposta: diligências pré-contratuais a seu pedido (RGPD, art. 6.º, n.º 1, alínea b)).</p>
<p><strong>Testemunhos.</strong> Quando escreve um testemunho, recebemos os vossos nomes, de onde são, a experiência, quando foi, o texto e o seu email. Só publicamos os nomes, o local e o texto com o seu consentimento (art. 6.º, n.º 1, alínea a)), que pode retirar a qualquer momento. O email nunca é publicado: usamo-lo para confirmar que o testemunho é seu.</p>
<p><strong>WhatsApp, email e telefone.</strong> Se nos contactar diretamente, usamos as suas mensagens para lhe responder.</p>
<h2>Durante quanto tempo os guardamos</h2>
<p>Os pedidos que não dão origem a uma reserva são apagados ao fim de 12 meses. Os registos das reservas são guardados durante o tempo que a lei exige. Os testemunhos ficam publicados até nos pedir que os retiremos.</p>
<h2>Quem nos ajuda</h2>
<p>O site está alojado no GitHub Pages (GitHub, Inc., Estados Unidos), os formulários são tratados pela Cloudflare (Cloudflare, Inc.) e o nosso email é fornecido pela Hostinger. As transferências para fora da UE assentam no Quadro de Privacidade de Dados UE-EUA e nas cláusulas contratuais-tipo da Comissão Europeia. Se nos enviar mensagens por WhatsApp ou Instagram, a Meta Platforms Ireland trata essas mensagens nos seus próprios termos.</p>
<h2>Os seus direitos</h2>
<p>Pode pedir o acesso aos seus dados, a sua retificação ou o seu apagamento, a limitação do tratamento ou opor-se a ele, e recebê-los num formato portável, escrevendo para ${mail}. Pode também apresentar reclamação à Comissão Nacional de Proteção de Dados, a CNPD (<a href="https://www.cnpd.pt">cnpd.pt</a>).</p>
<h2>Cookies</h2>
<p>Este site não usa cookies. Veja <a href="${localize(ctx, '/cookies/')}">Cookies</a>.</p>`,
    });
  }
  return legalPage(ctx, {
    path: '/privacy/',
    title: 'Privacy',
    description: 'How Picnic Club uses the personal data you share through this website.',
    sections: html`
<h2>Who is responsible</h2>
<p>${site.legal.name} (PICNIC CLUB), NIF ${site.legal.nif}, contactable at ${mail}, is responsible for your personal data.</p>
<h2>What we collect, and why</h2>
<p><strong>Enquiries.</strong> When you send the “Plan your experience” form we receive your name, email, phone number if you give it, and what you tell us about your plans (type of experience, date, place, number of guests, how you heard about us). We use them only to reply and to prepare your proposal: steps taken at your request before a contract (GDPR art. 6(1)(b)).</p>
<p><strong>Reviews.</strong> When you write a review we receive your names, where you are from, the experience, when it was, your text and your email. We publish the names, the place and the text only with your consent (art. 6(1)(a)), which you can withdraw at any time. The email is never published; we use it to confirm the review is yours.</p>
<p><strong>WhatsApp, email and phone.</strong> If you contact us directly, we use your messages to reply.</p>
<h2>How long we keep it</h2>
<p>Enquiries that do not become a booking are deleted after 12 months. Booking records are kept for as long as the law requires. Reviews stay published until you ask us to remove them.</p>
<h2>Who helps us</h2>
<p>The website is hosted by GitHub Pages (GitHub, Inc., United States), the forms are processed by Cloudflare (Cloudflare, Inc.), and our email is provided by Hostinger. Transfers outside the EU rely on the EU–US Data Privacy Framework and the European Commission’s standard contractual clauses. If you message us on WhatsApp or Instagram, Meta Platforms Ireland processes those messages under its own terms.</p>
<h2>Your rights</h2>
<p>You can ask to access, correct or delete your data, to restrict or object to its use, and to receive it in a portable format, by writing to ${mail}. You can also complain to the Portuguese data protection authority, CNPD (<a href="https://www.cnpd.pt">cnpd.pt</a>).</p>
<h2>Cookies</h2>
<p>This website uses no cookies. See <a href="${localize(ctx, '/cookies/')}">Cookies</a>.</p>`,
  });
}

// The language a visitor chooses with the PT/EN switch is the one thing kept on their device
// (site.js). It never leaves it, so it needs no consent; this page has to say so.
export function cookies(ctx) {
  if (ctx.lang === 'pt') {
    return legalPage(ctx, {
      path: '/cookies/',
      title: 'Cookies',
      description: 'O site da Picnic Club não usa cookies nem rastreamento.',
      sections: html`
<h2>Sem cookies, sem rastreamento</h2>
<p>Este site não usa cookies, ferramentas de análise, píxeis de publicidade nem qualquer outra tecnologia de rastreamento. É por isso que não vê nenhum aviso de cookies.</p>
<p>A única coisa que pode guardar no seu aparelho é a língua que escolher, e só se a escolher no botão PT/EN: o seu browser lembra-se dela para que o site abra nessa língua da próxima vez. Essa escolha nunca sai do seu aparelho, e apagar os dados do site no browser remove-a.</p>
<p>Os tipos de letra e as imagens são servidos pelo nosso próprio site. As ligações para o Instagram, o Facebook e o WhatsApp só o levam a esses serviços quando decide segui-las; a partir daí aplicam-se as políticas deles.</p>`,
    });
  }
  return legalPage(ctx, {
    path: '/cookies/',
    title: 'Cookies',
    description: 'Picnic Club’s website uses no cookies and no tracking.',
    sections: html`
<h2>No cookies, no tracking</h2>
<p>This website does not use cookies, analytics, advertising pixels or any other tracking technology. That is why you see no cookie banner.</p>
<p>The only thing it can keep on your device is your choice of language, and only if you make one with the PT/EN switch: your browser remembers it so the site opens in that language next time. It never leaves your device, and clearing your browser’s data for this site removes it.</p>
<p>Our fonts and images are served from our own website. Links to Instagram, Facebook and WhatsApp only take you to those services when you choose to follow them; from then on their own policies apply.</p>`,
  });
}

// GitHub Pages serves one 404 page for every address, so it speaks both languages.
export function notFound(ctx) {
  const body = html`
<section class="wrap page-head page-head--centre" aria-labelledby="page-title">
  <p class="eyebrow">${t(ctx, 'notFound.eyebrow')}</p>
  <h1 class="display" id="page-title">${t(ctx, 'notFound.title')}</h1>
  <p class="page-head__lead">${t(ctx, 'notFound.lead')}</p>
  <p><a class="button button--dark" href="${localize(ctx, '/')}">${t(ctx, 'notFound.back')}</a></p>
  <p class="page-head__other" lang="pt-PT">A página que procura não existe. <a href="/pt/">Ir para a página inicial em português</a>.</p>
</section>`;
  return { path: '/404.html', title: t(ctx, 'notFound.seoTitle'), description: t(ctx, 'notFound.seoDescription'), image: shareImage(ctx, 'proposal-sunset-sails'), body, noIndex: true };
}
