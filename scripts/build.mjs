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
    .map((f) => readJson(`content/experiences/${f}`))
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

// Links to other websites open in a new tab, and say so to screen readers.
// Our anchors never nest, so the first </a> after an opening tag closes it.
function externalLinks(htmlText, ownOrigin) {
  return htmlText.replace(/<a\b([^>]*?)\bhref="(https?:\/\/[^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (whole, before, url, after, inner) => {
    if (url.startsWith(ownOrigin)) return whole;
    const rest = (before + after).replace(/\s+rel="[^"]*"/, '').replace(/\s+target="[^"]*"/, '');
    return `<a${rest} href="${url}" target="_blank" rel="noopener">${inner}<span class="visually-hidden"> (opens in a new tab)</span></a>`;
  });
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

function sitemap(site, built) {
  const shared = ['src/templates', 'src/styles', 'content/site.json'];
  const urls = built
    .filter((p) => !p.noIndex)
    .map((p) => {
      const date = gitDate([...shared, ...(p.sources || [])]);
      return `  <url><loc>${site.url}${p.path}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`;
    });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
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

  const site = BASE ? { ...content.site, url: (ORIGIN || 'http://localhost:4800') + BASE } : content.site;
  const ctx = {
    site,
    content,
    images,
    usedImages: new Set(),
    year: new Date().getFullYear(),
    preview: !PRODUCTION,
    assets: { css: hashed('site.css', css), js: hashed('site.js', js) },
  };

  const list = [
    { ...pages.home(ctx), sources: ['content/home.json', 'content/experiences', 'content/reviews.json', 'content/press.json'] },
    { ...pages.experiencesIndex(ctx), sources: ['content/experiences'] },
    ...content.experiences.map((e) => ({ ...pages.experiencePage(ctx, e), sources: [`content/experiences/${e.slug}.json`, 'content/reviews.json'] })),
    { ...pages.story(ctx), sources: ['content/story.json', 'content/press.json'] },
    { ...pages.press(ctx), sources: ['content/press.json'] },
    { ...pages.reviews(ctx), sources: ['content/reviews.json'] },
    { ...pages.plan(ctx), sources: [] },
    { ...pages.legalNotice(ctx), sources: [] },
    { ...pages.terms(ctx), sources: ['content/policies.json'] },
    { ...pages.privacy(ctx), sources: [] },
    { ...pages.cookies(ctx), sources: [] },
    pages.notFound(ctx),
  ];

  for (const page of list) {
    const file = page.path.endsWith('.html') ? path.join(OUT, page.path) : path.join(OUT, page.path, 'index.html');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, externalLinks(rebase(layout(ctx, page).toString()), new URL(site.url).origin));
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
