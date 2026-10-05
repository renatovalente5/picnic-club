#!/usr/bin/env node
// Works out which pages a publication changes, for IndexNow (src/lib/indexnow.mjs says why).
//
//   node scripts/indexnow.mjs    after the production build, BEFORE the deploy
//
// Compares _site/sitemap.xml with the sitemap that is live on the domain now. In GitHub Actions
// it writes the JSON to send as the step's output `payload` (the deploy job sends it once the new
// pages are live: sent earlier, Bing would fetch the old ones); elsewhere it prints it.
//
// Nothing to send, or no way to know, means no output: when the live sitemap does not answer,
// nothing is sent — better to miss one notice than to send every page on every publication.
// It never stops a publication (the step is continue-on-error, and every problem is a warning).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { changedPages, payload, readSitemap } from '../src/lib/indexnow.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const siteUrl = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'site.json'), 'utf8')).url;
const warn = (message) => console.log(`::warning title=IndexNow::${message}`);

const fresh = readSitemap(fs.readFileSync(path.join(ROOT, '_site', 'sitemap.xml'), 'utf8'));
if (![...fresh.keys()].every((loc) => loc.startsWith(`${siteUrl}/`))) {
  warn(`the new sitemap is not for ${siteUrl} (a preview build?): nothing to send.`);
  process.exit(0);
}

let live;
try {
  const response = await fetch(`${siteUrl}/sitemap.xml`, { signal: AbortSignal.timeout(15000), headers: { 'cache-control': 'no-cache' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  live = readSitemap(await response.text());
} catch (error) {
  warn(`could not read the live sitemap (${error.message}): nothing will be sent this time.`);
  process.exit(0);
}

const urls = changedPages(fresh, live);
if (!urls.length) {
  console.log('IndexNow: no page changed; nothing to send.');
  process.exit(0);
}
console.log(`IndexNow: ${urls.length} page(s) to send after the deploy:`);
for (const url of urls) console.log(`  ${url}`);

const json = JSON.stringify(payload(siteUrl, urls));
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `payload=${json}\n`);
else console.log(json);
