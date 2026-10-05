#!/usr/bin/env node
// Builds the Picnic Club website into _site/.
//
//   node scripts/build.mjs               preview build (noindex, example reviews allowed)
//   node scripts/build.mjs --production  the build that goes to picnicclub.pt
//   node scripts/build.mjs --no-images   skip scripts/images.py and reuse .cache/images
//   node scripts/build.mjs --base=/picnic-club --origin=https://renatovalente5.github.io
//                                        preview served from a sub-folder (GitHub Pages project site)
//
// No dependencies: Node 20+ and, for the images, Python 3 with Pillow.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { INDEXNOW_KEY } from '../src/lib/indexnow.mjs';
import { problemas } from '../src/lib/regras.mjs';
import { aplicar, caminhoDaTraducao, resumo } from '../src/lib/traduziveis.mjs';
import { layout } from '../src/templates/components.mjs';
import { LANGS, LOCALE, ROUTES, t } from '../src/templates/i18n.mjs';
import * as pages from '../src/templates/pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '_site');
const argv = process.argv.slice(2);
const args = new Set(argv);
const option = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').split('=').slice(1).join('=');
const PRODUCTION = args.has('--production');
const BASE = option('base').replace(/\/+$/, '');
const ORIGIN = option('origin').replace(/\/+$/, '');
if (BASE && !/^\/[a-z0-9-]+$/.test(BASE)) {
  console.error('--base must look like /picnic-club');
  process.exit(1);
}
if (PRODUCTION && BASE) {
  console.error('A production build is served from the domain root; drop --base.');
  process.exit(1);
}

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

function fail(message, problems = []) {
  // In GitHub Actions each problem becomes an annotation, which the panel reads to tell Ana why a
  // publication stopped (picnic-club-painel: src/admin/github.js, porQueFalhou).
  if (process.env.GITHUB_ACTIONS === 'true') for (const p of problems) console.log(`::error title=${p.title.replace(/[\r\n:,]/g, ' ')}::${p.message.replace(/\r?\n/g, ' ')}`);
  console.error(`\nBuild stopped: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- content

/** The content as Ana writes it in the panel: in PORTUGUESE, the source of both languages. */
function loadContent() {
  const dir = path.join(ROOT, 'content', 'experiences');
  const experiences = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => ({ ...readJson(`content/experiences/${f}`), id: f.slice(0, -5) }))
    .sort((a, b) => a.order - b.order);
  return {
    site: readJson('content/site.json'),
    home: readJson('content/home.json'),
    story: readJson('content/story.json'),
    press: readJson('content/press.json'),
    reviews: readJson('content/reviews.json'),
    policies: readJson('content/policies.json'),
    photos: readJson('content/photos.json'),
    experiences,
  };
}

/**
 * The content in another language: the Portuguese with that language's translations on top
 * (content/i18n/<lang>/, written by the panel's Worker; the rules are in src/lib/traduziveis.mjs).
 * Only words change: photos, order and everything else stay the Portuguese's, so the two languages
 * cannot drift apart. A field with no usable translation shows the Portuguese, and is counted.
 */
function translated(content, lang) {
  const report = { emDia: 0, desactualizados: 0, emFalta: 0, invalidos: [] };
  const one = (rel, obj) => {
    const file = caminhoDaTraducao(rel, lang);
    const map = fs.existsSync(path.join(ROOT, file)) ? readJson(file) : {};
    const r = aplicar(rel, obj, map, resumo);
    report.emDia += r.emDia;
    report.desactualizados += r.desactualizados;
    report.emFalta += r.emFalta;
    report.invalidos.push(...r.invalidos.map((x) => `${file}: ${x}`));
    return r.obj;
  };
  const out = {};
  for (const key of ['site', 'home', 'story', 'press', 'reviews', 'policies', 'photos']) out[key] = one(`${key}.json`, content[key]);
  out.experiences = content.experiences.map((e) => one(`experiences/${e.id}.json`, e));
  return { content: out, report };
}

/** A photo's description in each language, by its name. */
const altsOf = (c) => Object.fromEntries(Object.entries(c.photos).map(([name, m]) => [name, m.alt]));

/** The content as the panel sees it: one object per file, by its path under content/. */
function contentFiles(content) {
  const files = {};
  for (const key of ['site', 'home', 'story', 'press', 'reviews', 'policies', 'photos']) files[`${key}.json`] = content[key];
  for (const { id, ...e } of content.experiences) files[`experiences/${id}.json`] = e;
  return files;
}

const namesIn = (dir, ext) => new Set(fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)));

/** The rules of src/lib/regras.mjs (the same the panel applies before saving): a «bloqueia» stops
 *  the build; an «avisa» is printed. A production build also refuses the example reviews. */
/* A photo's file name is its name in the content and in the panel: lowercase ASCII letters, digits
   and hyphens, at most 70 of them (an address with a space or an accent breaks a srcset). The panel
   does not see a photo with any other name, so the site refuses it too — both must see the same
   library. */
const PHOTO_FILE = /^[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/;
const badPhotoNames = () => fs.readdirSync(path.join(ROOT, 'media', 'photos')).filter((f) => !f.startsWith('.') && (!PHOTO_FILE.test(f) || f.length > 74));

function checkContent(content) {
  const all = problemas(contentFiles(content), { fotos: namesIn('media/photos', '.jpg'), filmes: namesIn('media/video', '.mp4') });
  const blocking = all.filter((p) => p.classe === 'bloqueia').map((p) => `content/${p.ficheiro}${p.campo ? ` (${p.campo})` : ''}: ${p.mensagem}`);
  const badNames = badPhotoNames();
  for (const f of badNames) blocking.push(`media/photos/${f}: a photo's file name must be lowercase letters, digits and hyphens, ending in .jpg (at most 70 before it).`);
  const examples = content.reviews.items.filter((r) => r.example);
  if (PRODUCTION && examples.length) {
    blocking.push(`${examples.length} example review(s) are still on the reviews page. Example reviews must never be published: replace them with real reviews from clients, or remove them.`);
  }
  if (blocking.length) {
    const annotations = all.filter((p) => p.classe === 'bloqueia').map((p) => ({ title: `content/${p.ficheiro}`, message: p.mensagem }));
    for (const f of badNames) annotations.push({ title: `media/photos/${f}`, message: `A fotografia «${f}» tem um nome que o site não aceita (só minúsculas, algarismos e hífenes). Avise o Renato.` });
    if (PRODUCTION && examples.length) annotations.push({ title: 'content/reviews.json', message: 'Os testemunhos de exemplo não podem ser publicados no domínio: troque-os por testemunhos verdadeiros, ou tire-os.' });
    fail('\n  - ' + blocking.join('\n  - '), annotations);
  }
  const warnings = all.filter((p) => p.classe === 'avisa' && !p.chave.endsWith('|exemplo'));
  return { examples: examples.length, warnings };
}

// ---------------------------------------------------------------- assets

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst, filter);
    else if (filter(entry.name)) fs.copyFileSync(src, dst);
  }
}

function hashed(name, contents) {
  const hash = createHash('sha256').update(contents).digest('hex').slice(0, 10);
  const [base, ext] = name.split('.');
  const file = `${base}.${hash}.${ext}`;
  fs.writeFileSync(path.join(OUT, 'assets', file), contents);
  return `/assets/${file}`;
}

// Root-relative URLs ("/assets/…", "/experiences/…") get the sub-folder in front.
function rebase(htmlText) {
  if (!BASE) return htmlText;
  const fix = (u) => (u.startsWith('/') && !u.startsWith('//') ? BASE + u : u);
  return htmlText
    .replace(/\b(href|src|poster|data-landscape|data-portrait|action)="([^"]*)"/g, (m, a, u) => `${a}="${fix(u)}"`)
    .replace(/\bsrcset="([^"]*)"/g, (m, list) => `srcset="${list.split(', ').map((c) => fix(c)).join(', ')}"`);
}

// Links to other websites open in a new tab, and say so to screen readers, in the page's language.
// Our anchors never nest, so the first </a> after an opening tag closes it.
function externalLinks(htmlText, ownOrigin, note) {
  return htmlText.replace(/<a\b([^>]*?)\bhref="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (whole, before, url, after, inner) => {
    if (url.startsWith(ownOrigin)) return whole;
    const rest = (before + after).replace(/\s+rel="[^"]*"/, '').replace(/\s+target="[^"]*"/, '');
    return `<a${rest} href="${url}" target="_blank" rel="noopener">${inner}<span class="visually-hidden">${note}</span></a>`;
  });
}

// A page in one language must not lead into the other, except through the PT/EN switch (data-lang)
// and the 404's line for the other language. Checked on every page before it is written.
function crossLanguageLinks(htmlText, lang) {
  const bad = [];
  for (const m of htmlText.matchAll(/<a\b[^>]*\bhref="(\/[^"]*)"[^>]*>/g)) {
    const [tag, href] = m;
    if (/\bdata-lang=/.test(tag) || href.startsWith('/assets/')) continue;
    const isPt = href === '/pt/' || href.startsWith('/pt/');
    if (lang === 'pt' ? !isPt : isPt) bad.push(href);
  }
  return bad;
}

function focusCss(images) {
  return Object.entries(images)
    .filter(([, m]) => m.focus && m.focus !== '50% 50%')
    .map(([name, m]) => `img[data-img="${name}"]{object-position:${m.focus}}`)
    .join('\n');
}

// ---------------------------------------------------------------- sitemap

// The date and time of the last commit that changed what a page is made of (ISO 8601, which the
// sitemap protocol takes): with the time, a second publication on the same day still says which
// pages changed (scripts/indexnow.mjs compares it with the live sitemap).
function gitDate(files) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
}

// Every page with its twin in the other language (the same alternates as the page's <head>).
function sitemap(site, built) {
  const shared = ['src/templates', 'src/styles', 'content/site.json'];
  const urls = built
    .filter((p) => !p.noIndex)
    .map((p) => {
      const date = gitDate([...shared, ...(p.sources || [])]);
      const alternates = [
        ...LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${LOCALE[l].hreflang}" href="${site.url}${p.alternates[l]}"/>`),
        `<xhtml:link rel="alternate" hreflang="x-default" href="${site.url}${p.alternates.en}"/>`,
      ];
      return `  <url><loc>${site.url}${p.path}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}${alternates.join('')}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

// ---------------------------------------------------------------- build

function main() {
  const started = Date.now();
  const content = loadContent();
  const { examples, warnings } = checkContent(content);
  const { content: contentEn, report: english } = translated(content, 'en');

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });

  if (!args.has('--no-images')) {
    execFileSync(process.env.PYTHON || 'python3', [path.join(ROOT, 'scripts', 'images.py')], { cwd: ROOT, stdio: 'inherit' });
  }
  const images = JSON.parse(fs.readFileSync(path.join(ROOT, '.cache', 'images', 'manifest.json'), 'utf8'));
  if (args.has('--no-images')) {
    // reuse the cache: one folder per image there, one flat folder on the site
    fs.mkdirSync(path.join(OUT, 'assets', 'img'), { recursive: true });
    for (const [name, m] of Object.entries(images)) {
      for (const file of m.files) fs.copyFileSync(path.join(ROOT, '.cache', 'images', name, file), path.join(OUT, 'assets', 'img', file));
    }
  }

  copyDir(path.join(ROOT, 'src', 'fonts'), path.join(OUT, 'assets', 'fonts'));
  copyDir(path.join(ROOT, 'media', 'brand'), path.join(OUT, 'assets', 'brand'));
  copyDir(path.join(ROOT, 'media', 'video'), path.join(OUT, 'assets', 'video'), (f) => f.endsWith('.mp4'));

  let css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'site.css'), 'utf8') + '\n/* focus points from content/photos.json */\n' + focusCss(images) + '\n';
  if (BASE) css = css.replace(/url\("\/assets\//g, `url("${BASE}/assets/`);
  const js = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'site.js'), 'utf8');

  // English path → Portuguese path, for every page (an experience's Portuguese address is its slug;
  // its English one is the name of its file)
  const routes = { ...ROUTES };
  for (const e of content.experiences) routes[`/experiences/${e.id}/`] = `${ROUTES['/experiences/']}${e.slug}/`;
  const shared = {
    images,
    usedImages: new Set(),
    year: new Date().getFullYear(),
    preview: !PRODUCTION,
    assets: { css: hashed('site.css', css), js: hashed('site.js', js) },
    routes,
    source: content,
  };
  const siteFor = (c) => (BASE ? { ...c.site, url: (ORIGIN || 'http://localhost:4800') + BASE } : c.site);

  const list = [];
  for (const lang of LANGS) {
    const c = lang === 'pt' ? content : contentEn;
    const ctx = { ...shared, lang, site: siteFor(c), content: c, alts: altsOf(c) };
    const built = [
      { ...pages.home(ctx), sources: ['content/home.json', 'content/experiences', 'content/reviews.json'] },
      { ...pages.experiencesIndex(ctx), sources: ['content/experiences'] },
      ...c.experiences.map((e) => ({ ...pages.experiencePage(ctx, e), sources: [`content/experiences/${e.id}.json`, 'content/reviews.json'] })),
      { ...pages.story(ctx), sources: ['content/story.json', 'content/press.json'] },
      { ...pages.press(ctx), sources: ['content/press.json'] },
      { ...pages.reviews(ctx), sources: ['content/reviews.json'] },
      { ...pages.plan(ctx), sources: [] },
      { ...pages.legalNotice(ctx), sources: [] },
      { ...pages.terms(ctx), sources: ['content/policies.json'] },
      { ...pages.privacy(ctx), sources: [] },
      { ...pages.cookies(ctx), sources: [] },
      ...(lang === 'en' ? [pages.notFound(ctx)] : []),
    ];
    for (const page of built) {
      const en = page.path;
      page.alternates = page.noIndex ? { en: '/', pt: routes['/'] } : { en, pt: routes[en] };
      page.path = page.noIndex ? en : page.alternates[lang];
      if (lang !== 'pt' && page.sources) page.sources = page.sources.concat(page.sources.map((s) => s.replace(/^content\//, `content/i18n/${lang}/`)));
      const text = layout(ctx, page).toString();
      const bad = crossLanguageLinks(text, page.noIndex ? null : lang);
      if (!page.noIndex && bad.length) fail(`${page.path} links to the other language: ${[...new Set(bad)].join(', ')}`);
      const file = page.path.endsWith('.html') ? path.join(OUT, page.path) : path.join(OUT, page.path, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, externalLinks(rebase(text), new URL(ctx.site.url).origin, t(ctx, 'newTab')));
      list.push(page);
    }
  }
  const site = siteFor(contentEn);
  const ctx = shared;

  /* THE OLD SITE'S ADDRESSES (Framer, on www.picnicclub.pt until 5 Oct 2026, from its sitemap) and
     where each one lives now. History, not content: never derived from today's pages. Each becomes a
     small page that sends on at once (refresh 0 and location.replace, so «Back» never gets stuck),
     marked as a stub by name, with the new page as its canonical and a visible link. A stub never
     writes over a page of the site: the build stops. */
  const OLD_ADDRESSES = {
    '/about/': '/our-story/',
    '/contact/': '/plan-your-experience/',
    '/collections/atelier/': '/experiences/',
    '/collections/noir/': '/experiences/',
    '/collections/lumen/': '/experiences/',
    '/collections/soiree/': '/experiences/',
    '/collections/aube/': '/experiences/',
    '/collections/maison/': '/experiences/',
  };
  const pagePaths = new Set(list.map((p) => p.path));
  for (const [from, to] of Object.entries(OLD_ADDRESSES)) {
    if (!pagePaths.has(to)) fail(`the old address ${from} would send to ${to}, which is not a page of the site`);
    const file = path.join(OUT, from, 'index.html');
    if (pagePaths.has(from) || fs.existsSync(file)) fail(`the old address ${from} is a page of the site now: no stub over it`);
    const go = `${BASE}${to}`;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="generator" content="redirect-stub"><meta name="robots" content="noindex"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Picnic Club</title><link rel="canonical" href="${content.site.url}${to}"><meta http-equiv="refresh" content="0; url=${go}"></head><body><p><a id="go" href="${go}">Picnic Club</a></p><script>location.replace(document.getElementById('go').href)</script></body></html>\n`);
  }

  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap(content.site, list));
  fs.writeFileSync(
    path.join(OUT, 'robots.txt'),
    PRODUCTION ? `User-agent: *\nAllow: /\n\nSitemap: ${content.site.url}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n'
  );
  fs.writeFileSync(
    path.join(OUT, 'site.webmanifest'),
    JSON.stringify(
      {
        name: 'Picnic Club',
        short_name: 'Picnic Club',
        start_url: `${BASE}/`,
        display: 'browser',
        background_color: '#FAF6EF',
        theme_color: '#FAF6EF',
        icons: [
          { src: `${BASE}/assets/brand/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${BASE}/assets/brand/icon-512.png`, sizes: '512x512', type: 'image/png' },
        ],
      },
      null,
      2
    )
  );
  if (PRODUCTION) fs.writeFileSync(path.join(OUT, 'CNAME'), new URL(content.site.url).hostname + '\n');
  // The IndexNow key, public by design (src/lib/indexnow.mjs): just the key, no newline.
  if (PRODUCTION) fs.writeFileSync(path.join(OUT, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY);

  // Images in the manifest that no page uses are not published — except, for a photo, its smallest
  // WebP: the panel shows the whole library from assets/painel.json (one small picture of each photo,
  // its size and its focus point), used or not.
  const unused = Object.keys(images).filter((n) => !ctx.usedImages.has(n));
  const thumb = (name) => `${name}-${images[name].hash}-${images[name].widths[0]}.webp`;
  for (const name of unused) {
    const keep = images[name].kind === 'photo' ? thumb(name) : null;
    for (const file of images[name].files) if (file !== keep) fs.rmSync(path.join(OUT, 'assets', 'img', file), { force: true });
  }
  const forPanel = (kind) => Object.fromEntries(Object.entries(images).filter(([, m]) => m.kind === kind)
    .map(([name, m]) => [name, { src: `assets/img/${thumb(name)}`, width: m.width, height: m.height, focus: m.focus }]));
  fs.writeFileSync(path.join(OUT, 'assets', 'painel.json'), `${JSON.stringify({ fotos: forPanel('photo'), posters: forPanel('poster') })}\n`);

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Built ${list.length} pages in ${seconds}s${PRODUCTION ? ' (production)' : ' (preview)'}${BASE ? `, served from ${site.url}/` : ''}.`);
  console.log(`English: ${english.emDia} texts translated${english.desactualizados ? `, ${english.desactualizados} from an older Portuguese (being redone)` : ''}${english.emFalta ? `, ${english.emFalta} still in Portuguese` : ''}.`);
  for (const x of english.invalidos) console.log(`  translation refused, the Portuguese shows: ${x}`);
  for (const w of warnings) console.log(`  note: content/${w.ficheiro} (${w.campo}): ${w.mensagem}`);
  if (examples) console.log(`Note: ${examples} example review(s) are visible. A production build refuses to publish them.`);
  if (unused.length) console.log(`Not used on any page (not published): ${unused.join(', ')}`);
}

main();
