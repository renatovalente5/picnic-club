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

function fail(message) {
  console.error(`\nBuild stopped: ${message}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- content

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
    experiences,
  };
}

/**
 * The words of content/pt/ laid over the English content: objects key by key, a list of objects
 * item by item (in the English order), a list of words replaced whole. Photos, order and the rest
 * stay English, so the two languages cannot drift apart on anything but words.
 */
function overlay(base, top) {
  if (top === undefined) return base;
  if (Array.isArray(base) && Array.isArray(top)) {
    if (base.some((x) => x && typeof x === 'object')) return base.map((item, i) => overlay(item, top[i]));
    return top;
  }
  if (base && typeof base === 'object' && top && typeof top === 'object' && !Array.isArray(top)) {
    const out = { ...base };
    for (const [key, value] of Object.entries(top)) out[key] = overlay(base[key], value);
    return out;
  }
  return top;
}

function portuguese(content) {
  const pt = (rel) => (fs.existsSync(path.join(ROOT, 'content', 'pt', rel)) ? readJson(`content/pt/${rel}`) : undefined);
  const out = {};
  for (const key of ['site', 'home', 'story', 'press', 'reviews', 'policies']) out[key] = overlay(content[key], pt(`${key}.json`));
  out.experiences = content.experiences.map((e) => {
    const words = pt(`experiences/${e.id}.json`);
    if (!words || !words.slug) fail(`content/pt/experiences/${e.id}.json is missing (or has no "slug"): the Portuguese page needs its words and its address.`);
    return overlay(e, words);
  });
  return { content: out, alts: pt('photos.json') || {} };
}

function checkContent(content) {
  const problems = [];
  const legal = content.site.legal || {};
  for (const key of ['name', 'status', 'nif', 'address']) {
    if (!legal[key] || (Array.isArray(legal[key]) && !legal[key].length)) problems.push(`content/site.json: legal.${key} is empty (the law requires it on the site).`);
  }
  const nif = String(legal.nif || '').replace(/\s+/g, '');
  if (!/^[0-9]{9}$/.test(nif) || !validNif(nif)) problems.push(`content/site.json: legal.nif "${legal.nif}" is not a valid Portuguese NIF.`);
  const slugs = new Set();
  for (const e of content.experiences) {
    if (!/^[a-z0-9-]+$/.test(e.slug || '')) problems.push(`experience "${e.name}": invalid slug "${e.slug}".`);
    if (slugs.has(e.slug)) problems.push(`two experiences share the slug "${e.slug}".`);
    slugs.add(e.slug);
    for (const key of ['name', 'short', 'hero', 'statement']) if (!e[key]) problems.push(`experience "${e.slug}": ${key} is empty.`);
  }
  const examples = content.reviews.items.filter((r) => r.example);
  if (PRODUCTION && examples.length) {
    problems.push(`${examples.length} example review(s) are still on the reviews page. Example reviews must never be published: replace them with real reviews from clients, or remove them.`);
  }
  if (problems.length) fail('\n  - ' + problems.join('\n  - '));
  return { examples: examples.length };
}

function validNif(nif) {
  const d = nif.split('').map(Number);
  const sum = d.slice(0, 8).reduce((s, n, i) => s + n * (9 - i), 0);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === d[8];
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

function gitDate(files) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...files], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
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
  const { examples } = checkContent(content);

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

  let css = fs.readFileSync(path.join(ROOT, 'src', 'styles', 'site.css'), 'utf8') + '\n/* focus points from media/photos.json */\n' + focusCss(images) + '\n';
  if (BASE) css = css.replace(/url\("\/assets\//g, `url("${BASE}/assets/`);
  const js = fs.readFileSync(path.join(ROOT, 'src', 'scripts', 'site.js'), 'utf8');

  const { content: contentPt, alts } = portuguese(content);
  // English path → Portuguese path, for every page (the experiences take their slug from content/pt/)
  const routes = { ...ROUTES };
  for (const e of contentPt.experiences) routes[`/experiences/${e.id}/`] = `${ROUTES['/experiences/']}${e.slug}/`;
  const shared = {
    images,
    usedImages: new Set(),
    year: new Date().getFullYear(),
    preview: !PRODUCTION,
    assets: { css: hashed('site.css', css), js: hashed('site.js', js) },
    routes,
    alts,
  };
  const siteFor = (c) => (BASE ? { ...c.site, url: (ORIGIN || 'http://localhost:4800') + BASE } : c.site);

  const list = [];
  for (const lang of LANGS) {
    const c = lang === 'pt' ? contentPt : content;
    const ctx = { ...shared, lang, site: siteFor(c), content: c };
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
      if (lang === 'pt') page.sources = page.sources.map((s) => s.replace(/^content\//, 'content/pt/')).concat(page.sources);
      const text = layout(ctx, page).toString();
      const bad = crossLanguageLinks(text, page.noIndex ? null : lang);
      if (!page.noIndex && bad.length) fail(`${page.path} links to the other language: ${[...new Set(bad)].join(', ')}`);
      const file = page.path.endsWith('.html') ? path.join(OUT, page.path) : path.join(OUT, page.path, 'index.html');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, externalLinks(rebase(text), new URL(ctx.site.url).origin, t(ctx, 'newTab')));
      list.push(page);
    }
  }
  const site = siteFor(content);
  const ctx = shared;

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

  // Images in the manifest that no page uses are not published.
  const unused = Object.keys(images).filter((n) => !ctx.usedImages.has(n));
  for (const name of unused) {
    for (const file of images[name].files) fs.rmSync(path.join(OUT, 'assets', 'img', file), { force: true });
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`Built ${list.length} pages in ${seconds}s${PRODUCTION ? ' (production)' : ' (preview)'}${BASE ? `, served from ${site.url}/` : ''}.`);
  if (examples) console.log(`Note: ${examples} example review(s) are visible. A production build refuses to publish them.`);
  if (unused.length) console.log(`Not used on any page (not published): ${unused.join(', ')}`);
}

main();
