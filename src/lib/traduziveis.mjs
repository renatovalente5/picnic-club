/* WHAT GETS TRANSLATED, AND HOW A TRANSLATION IS APPLIED.
 *
 * The one rule about the site's two languages. It has a byte-for-byte copy in the panel
 * (picnic-club-painel, estatico/js/traduziveis.js), which is what translates; a test there
 * compares the two. Written for Picnic Club from the one of ithos·cathelier (Sep 2026).
 *
 * THE SOURCE CONTENT is content/ — in PORTUGUESE, the language Ana writes in, in the panel.
 * A translation lives in content/i18n/<language>/<the same path>, as a flat map:
 *
 *     { "hero.title": { "t": "Moments worth keeping.", "h": "3fa1…" }, "areas.6": { … } }
 *
 * `t` is the translated text; `h` is the digest of the PORTUGUESE text it came from. When Ana
 * changes the Portuguese, the digest stops matching and the translation is «stale»: the panel's
 * Worker redoes it within minutes. Until then the site keeps showing the stale one (if it still
 * passes the checks below against the new Portuguese), and a field with no translation at all
 * shows the Portuguese. `fixo: true` marks a translation Ana wrote herself in the panel (she did
 * not like the automatic one): the Worker never writes over it while the Portuguese is the one she
 * wrote it for. When she changes that Portuguese, it is translated again like any other field — the
 * English never goes on saying something else — unless she corrects the English in the same save.
 *
 * LISTS. A path with a number in it («intro.1», «options.2.text») is a POSITION in a list with no
 * ids. Removing the first paragraph makes the second the first: the translation stored at
 * position 0 now belongs to another text. So in a list a translation is found by its digest, in
 * any position of the same list, and one whose digest matches nothing is not used (the
 * Portuguese shows until the Worker translates it). Reordering, adding or removing items never
 * shows a translation of the wrong text, and costs no new translation. */

export const RESUMO_TAMANHO = 12;

/** The languages the content is translated into. */
export const LINGUAS_ALVO = ['en'];

/* The translated fields of each content file (paths relative to content/). «#» is a position in a
   list; «*» is a key of an object (the name of a photo). Everything else in the files — photos,
   order, addresses, codes, links, names of people and places in reviews — is not translated. */
export const PADROES = [
  ['site.json', ['tagline', 'whatsappMessage', 'areas.#', 'areasNote', 'responseTime', 'legal.status', 'legal.trademark']],
  ['home.json', [
    'seo.title', 'seo.description',
    'hero.title', 'hero.text', 'hero.primary.label', 'hero.secondary.label',
    'intro.title', 'intro.text.#', 'intro.link.label',
    'experiences.title', 'experiences.text', 'experiences.link.label',
    'philosophy.title', 'philosophy.lines.#', 'philosophy.text', 'philosophy.link.label',
    'gallery.eyebrow', 'gallery.title', 'gallery.text', 'gallery.link.label', 'gallery.items.#.alt',
    'reviews.title', 'reviews.text', 'reviews.link.label',
    'instagram.title',
  ]],
  ['story.json', ['seo.title', 'seo.description', 'eyebrow', 'title', 'lead', 'story.#', 'quote']],
  ['press.json', ['seo.title', 'seo.description', 'title', 'items.#.summary']],
  ['reviews.json', ['seo.title', 'seo.description', 'title', 'intro']],
  ['policies.json', ['cancellation.intro', 'cancellation.rules.#.when', 'cancellation.rules.#.what', 'cancellation.rescheduling.#', 'cancellation.exceptional']],
  ['experiences/*.json', [
    'name', 'menu', 'short', 'statement', 'intro.#',
    'options.#.name', 'options.#.text', 'included.#', 'addOns.#',
    'howItWorks.#.title', 'howItWorks.#.text', 'locations.#', 'weather',
    'seo.title', 'seo.description',
  ]],
  ['photos.json', ['*.alt']],
];

const TEXTO = (v) => typeof v === 'string' && v.trim() !== '';

/** The path of a content file relative to content/ («experiences/luxury-picnics.json»). */
export const relativo = (caminho) => String(caminho).replace(/^content\//, '');

/** The patterns of a content file, or [] if nothing in it is translated. */
export function padroesDe(caminho) {
  const rel = relativo(caminho);
  for (const [ficheiro, padroes] of PADROES) {
    if (ficheiro === rel) return padroes;
    if (ficheiro.includes('*') && new RegExp(`^${ficheiro.replace(/[.]/g, '\\.').replace('*', '[a-z0-9-]+')}$`).test(rel)) return padroes;
  }
  return [];
}

/** Is this a content file whose words are translated? (content/i18n/ never is.) */
export const traduzivel = (caminho) => !relativo(caminho).startsWith('i18n/') && padroesDe(caminho).length > 0;

/** Where the translation of a content file into `lingua` lives. */
export const caminhoDaTraducao = (caminho, lingua) => `content/i18n/${lingua}/${relativo(caminho)}`;

/** The fields to translate in a content object: [[path, text], …], in a fixed order (the order the
 *  maps are written in: see ordenado). */
export function campos(caminho, obj) {
  const out = [];
  const andar = (no, partes, feito) => {
    if (!partes.length) { if (TEXTO(no)) out.push([feito.join('.'), no]); return; }
    const [p, ...resto] = partes;
    if (no === null || typeof no !== 'object') return;
    if (p === '#') { if (Array.isArray(no)) no.forEach((x, i) => andar(x, resto, [...feito, String(i)])); return; }
    if (p === '*') { if (!Array.isArray(no)) for (const k of Object.keys(no)) andar(no[k], resto, [...feito, k]); return; }
    if (!Array.isArray(no) && Object.hasOwn(no, p)) andar(no[p], resto, [...feito, p]);
  };
  for (const padrao of padroesDe(caminho)) andar(obj, padrao.split('.'), []);
  return out;
}

/** A translation map in the order of campos(), without the fields the Portuguese no longer has:
 *  the Worker and the panel write a map the same way, so one never rewrites the other's file just to
 *  reorder it. */
export function ordenado(caminho, origem, traducao) {
  const out = {};
  for (const [campo] of campos(caminho, origem)) if (traducao && Object.hasOwn(traducao, campo)) out[campo] = traducao[campo];
  return out;
}

/** A field that is a position in a list (see LISTS at the top). */
export const posicional = (campo) => /(^|\.)\d+(\.|$)/.test(campo);

/** The list a positional field belongs to: «options.2.text» → «options.#.text». */
export const familia = (campo) => campo.replace(/(^|\.)\d+(?=\.|$)/g, '$1#');

/* Puts a text at a path; numbers are positions in lists. */
function pôr(obj, caminho, texto) {
  const p = caminho.split('.');
  let x = obj;
  for (const k of p.slice(0, -1)) {
    if (x == null || typeof x !== 'object') return;
    x = Array.isArray(x) ? x[Number(k)] : x[k];
  }
  if (x == null || typeof x !== 'object') return;
  const ultimo = p.at(-1);
  if (Array.isArray(x)) x[Number(ultimo)] = texto; else x[ultimo] = texto;
}

/** The translation to use for a field, by its digest — see LISTS at the top.
 *  → { tr, estado: 'em-dia' | 'desactualizada' } or null (no usable translation). */
export function escolher(traducao, campo, h, porFamilia) {
  const tr = traducao?.[campo];
  const boa = (x) => x && typeof x.t === 'string' && x.t.trim() !== '';
  if (boa(tr) && tr.h === h) return { tr, estado: 'em-dia' };
  if (posicional(campo)) {
    const outra = porFamilia.get(`${familia(campo)}|${h}`);
    return boa(outra) ? { tr: outra, estado: 'em-dia' } : null;
  }
  return boa(tr) ? { tr, estado: 'desactualizada' } : null;
}

/** The translations of a file, indexed by list and digest (for escolher). */
export function indicePorFamilia(traducao) {
  const m = new Map();
  for (const [k, v] of Object.entries(traducao ?? {})) {
    if (v && typeof v === 'object' && typeof v.h === 'string' && posicional(k)) {
      const chave = `${familia(k)}|${v.h}`;
      if (!m.has(chave)) m.set(chave, v);
    }
  }
  return m;
}

/**
 * The object in the other language: a copy of the Portuguese with the translated texts on top.
 * Also says how many fields are up to date, stale, missing (the Portuguese shows) or refused by
 * the checks, for the build's report and the panel.
 *   resumir(text) → digest of a Portuguese text (resumo, below)
 */
export function aplicar(caminho, origem, traducao, resumir = resumo) {
  const obj = structuredClone(origem);
  const porFamilia = indicePorFamilia(traducao);
  let emDia = 0; let desactualizados = 0; let emFalta = 0; const invalidos = [];
  for (const [campo, texto] of campos(caminho, origem)) {
    const e = escolher(traducao, campo, resumir(texto), porFamilia);
    if (!e) { emFalta++; continue; }
    /* A translation that does not fit today's Portuguese — a number changed, the brand lost —
       does not go in: the Portuguese shows. So a translated page always says what the original
       says on the things that matter, and passes the checks whenever the original passes. */
    const porque = validar(texto, e.tr.t);
    if (porque) { invalidos.push(`${campo} (${porque})`); emFalta++; continue; }
    if (e.estado === 'em-dia') emDia++; else desactualizados++;
    pôr(obj, campo, e.tr.t);
  }
  return { obj, emDia, desactualizados, emFalta, invalidos };
}

/* THE CHECK OF A TRANSLATION. The Worker runs it before saving one and the build runs it again
   before publishing. It does not judge style — that is the model's job — only what would break or
   falsify the page: a number that changed, the brand lost or recased, markup added, an answer cut
   in half or about something else. */
const todos = (re, s) => [...String(s).matchAll(re)].map((m) => m[0]).sort().join('\u0000');
const conta = (re, s) => (String(s).match(re) ?? []).length;

/** Why a translation is not usable, or null if it is. */
export function validar(origem, traducao) {
  if (typeof traducao !== 'string' || !traducao.trim()) return 'vazia';
  const o = String(origem);
  const par = (f, nome) => (f(o) === f(traducao) ? null : nome);
  const r = par((s) => todos(/(?<!\{)\{[A-Za-z0-9_]+\}(?!\})/g, s), 'variáveis')
    ?? par((s) => todos(/\]\([^)]*\)/g, s), 'ligações')
    ?? par((s) => todos(/<\/?[A-Za-z][^>]*>/g, s), 'etiquetas')
    /* And the loose signs: «<img src=x onerror=…» without its closing «>» passed the tag count. */
    ?? par((s) => `${conta(/</g, s)}:${conta(/>/g, s)}`, 'sinais < >')
    ?? par((s) => conta(/\*\*/g, s), 'negrito')
    /* The numbers: a deadline, a percentage, a trademark number. «7 dias» translated as «10 days»
       would pass everything else. */
    ?? par((s) => todos(/\d+/g, s), 'números')
    ?? par((s) => conta(/®/g, s), 'marca registada');
  if (r) return r;
  /* The brand: as many times, and written the same way («PICNIC CLUB» in capitals in the running
     text, «Picnic Club» in titles). */
  if (conta(/picnic\s+club/gi, o) !== conta(/picnic\s+club/gi, traducao)) return 'marca';
  if (conta(/PICNIC CLUB/g, o) !== conta(/PICNIC CLUB/g, traducao)) return 'marca';
  /* Length is only measured in running text: in a name, a right translation can be a third as
     long. */
  if (o.length >= 60) {
    const razao = traducao.length / o.length;
    if (razao < 0.35 || razao > 2.8) return 'tamanho';
  }
  return null;
}

/* --- the digest ---------------------------------------------------------------
   SHA-256 in plain JavaScript, synchronous: the same code in the build (Node) and in the Worker,
   where each crypto.subtle call is a round trip and hundreds of fields on the free plan's 10 ms
   of CPU made the difference between finishing and being cut off (ithos, Sep 2026). A test in the
   panel compares it with node:crypto. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const te = new TextEncoder();
export function sha256hex(texto) {
  const dados = te.encode(texto);
  const n = dados.length;
  const total = Math.ceil((n + 9) / 64) * 64;
  const m = new Uint8Array(total);
  m.set(dados); m[n] = 0x80;
  const bits = n * 8;
  const dv = new DataView(m.buffer);
  dv.setUint32(total - 8, Math.floor(bits / 0x100000000));
  dv.setUint32(total - 4, bits >>> 0);
  const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const W = new Uint32Array(64);
  const rotr = (x, k) => (x >>> k) | (x << (32 - k));
  for (let o = 0; o < total; o += 64) {
    for (let i = 0; i < 16; i++) W[i] = dv.getUint32(o + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) >>> 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
  }
  let out = '';
  for (const x of H) out += x.toString(16).padStart(8, '0');
  return out;
}

/** The digest of a Portuguese text, as it goes in `h`. */
export const resumo = (texto) => sha256hex(String(texto)).slice(0, RESUMO_TAMANHO);
