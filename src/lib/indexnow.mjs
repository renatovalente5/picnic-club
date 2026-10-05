/* INDEXNOW: telling Bing (and Yandex, Seznam, Naver — they share one network) which pages changed,
 * instead of waiting for them to come back. Google does not take part: for Google there are the
 * sitemap and Search Console.
 *
 * The key is PUBLIC by design: the build publishes it as /<key>.txt, and that file is how Bing
 * checks that whoever sends the list runs the domain. It is not a secret.
 *
 * Only the pages whose <lastmod> differs from the sitemap that is LIVE before the publication are
 * sent (scripts/indexnow.mjs): sending every page on every publication is noise, and they count
 * it. The lastmod is the date and time of the last commit that changed what the page is made of
 * (scripts/build.mjs, gitDate). */

export const INDEXNOW_KEY = 'c5f86669fb4db6488c80a5915556aeb9';
export const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';

/** A sitemap as a Map: address → lastmod ('' when it has none). */
export function readSitemap(xml) {
  const pages = new Map();
  for (const block of String(xml).split('<url>').slice(1)) {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    if (loc) pages.set(loc.trim(), block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1]?.trim() ?? '');
  }
  return pages;
}

/** The addresses of the new sitemap that are not in the live one, or have another lastmod. */
export function changedPages(fresh, live) {
  return [...fresh].filter(([loc, lastmod]) => live.get(loc) !== lastmod).map(([loc]) => loc);
}

/** What IndexNow is sent for these addresses of the site at `siteUrl`. */
export function payload(siteUrl, urls) {
  const host = new URL(siteUrl).host;
  return { host, key: INDEXNOW_KEY, keyLocation: `https://${host}/${INDEXNOW_KEY}.txt`, urlList: urls };
}
