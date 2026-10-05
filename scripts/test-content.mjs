#!/usr/bin/env node
// Tests of the two shared modules (src/lib/traduziveis.mjs and src/lib/regras.mjs) against the
// real content, against broken copies of it, and against small made-up files. No dependencies.
//
//   node scripts/test-content.mjs          what must always hold (CI runs it before the build)
//   node scripts/test-content.mjs --seed   also: every text has its English, up to date — true right
//                                          after the migration of 5 Oct 2026, not after Ana's edits
//                                          (the panel's Worker translates them within minutes)
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { problemas, mudancasBloqueadas, nifValido } from '../src/lib/regras.mjs';
import { aplicar, campos, resumo, validar, padroesDe, traduzivel, caminhoDaTraducao } from '../src/lib/traduziveis.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
const names = (dir, ext) => new Set(fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).map((f) => f.slice(0, -ext.length)));
const FOTOS = names('media/photos', '.jpg');
const FILMES = names('media/video', '.mp4');

function files() {
  const out = {};
  for (const k of ['site', 'home', 'story', 'press', 'reviews', 'policies', 'photos']) out[`${k}.json`] = read(`content/${k}.json`);
  for (const f of fs.readdirSync(path.join(ROOT, 'content/experiences'))) out[`experiences/${f}`] = read(`content/experiences/${f}`);
  return out;
}

let n = 0;
const test = (name, fn) => { fn(); n++; console.log(`ok ${n} - ${name}`); };
const bloqueios = (f) => problemas(f, { fotos: FOTOS, filmes: FILMES }).filter((p) => p.classe === 'bloqueia');

test('the digest is SHA-256 (the plain-JavaScript one equals node:crypto)', () => {
  for (const s of ['', 'a', 'Momentos para guardar.', 'ã'.repeat(100), 'x'.repeat(64), 'x'.repeat(55), 'x'.repeat(56)]) {
    assert.equal(resumo(s), createHash('sha256').update(s).digest('hex').slice(0, 12));
  }
});

test('the content today has no blocking problem', () => {
  assert.deepEqual(bloqueios(files()), []);
});

if (process.argv.includes('--seed')) test('every Portuguese text that is translated has an English translation, up to date and valid', () => {
  const f = files();
  for (const [rel, obj] of Object.entries(f)) {
    const tr = read(caminhoDaTraducao(rel, 'en'));
    const r = aplicar(rel, obj, tr);
    assert.equal(r.emFalta, 0, `${rel}: ${r.emFalta} missing`);
    assert.equal(r.desactualizados, 0, `${rel}: stale`);
    assert.deepEqual(r.invalidos, [], rel);
    // and no translation of a field that no longer exists
    const vivos = new Set(campos(rel, obj).map(([c]) => c));
    for (const k of Object.keys(tr)) assert.ok(vivos.has(k), `${rel}: translation of a field that does not exist: ${k}`);
  }
});

test('which files are translated', () => {
  assert.ok(traduzivel('content/experiences/luxury-picnics.json'));
  assert.ok(traduzivel('content/photos.json'));
  assert.ok(!traduzivel('content/i18n/en/home.json'));
  assert.deepEqual(padroesDe('content/nothing.json'), []);
});

// A small experience and its English, made up here so the tests never depend on Ana's texts.
const exp = () => ({
  name: 'Piqueniques', short: 'Um resumo.', statement: 'Uma frase.', intro: ['Primeiro parágrafo.'],
  included: ['Toalhas de linho', 'Velas', 'Flores', 'Tudo arrumado no fim'], addOns: [], locations: ['Lisboa'],
  weather: 'Se chover, há sempre um plano B.', seo: { title: 'T', description: 'D' },
  options: [{ name: 'Mais de 7 dias antes', text: 'Reembolso total.' }],
});
const ingles = (pt) => {
  const en = { name: 'Picnics', short: 'A summary.', statement: 'A line.', 'intro.0': 'First paragraph.', 'included.0': 'Linen cloths',
    'included.1': 'Candles', 'included.2': 'Flowers', 'included.3': 'Everything cleared away', 'locations.0': 'Lisbon',
    weather: 'If it rains, there is always a plan B.', 'seo.title': 'T', 'seo.description': 'D', 'options.0.name': 'More than 7 days before', 'options.0.text': 'Full refund.' };
  return Object.fromEntries(campos('experiences/x.json', pt).map(([c, t]) => [c, { t: en[c], h: resumo(t) }]));
};

test('a changed Portuguese text: the stale English stays until redone, unless it no longer fits', () => {
  const pt = exp();
  const en = ingles(pt);
  pt.weather = 'Se o tempo mudar, temos uma alternativa.';
  let r = aplicar('experiences/x.json', pt, en);
  assert.equal(r.desactualizados, 1);
  assert.equal(r.obj.weather, 'If it rains, there is always a plan B.');
  // a positional field (an option) whose Portuguese changed shows the Portuguese
  pt.options[0].name = 'Mais de 10 dias antes';
  r = aplicar('experiences/x.json', pt, en);
  assert.equal(r.obj.options[0].name, 'Mais de 10 dias antes');
  // and a stale one whose numbers no longer match is refused (the Portuguese shows)
  pt.statement = 'Uma frase com 3 velas.';
  r = aplicar('experiences/x.json', pt, en);
  assert.equal(r.obj.statement, 'Uma frase com 3 velas.');
  assert.deepEqual(r.invalidos, ['statement (números)']);
});

test('reordering a list keeps each translation with its own text (found by its digest)', () => {
  const pt = exp();
  const en = ingles(pt);
  pt.included.reverse();
  const r = aplicar('experiences/x.json', pt, en);
  assert.deepEqual(r.obj.included, ['Everything cleared away', 'Flowers', 'Candles', 'Linen cloths']);
  assert.equal(r.emFalta, 0);
  // a new item in the middle shows in Portuguese, and the rest keep theirs
  pt.included.splice(1, 0, 'Um item novo');
  const r2 = aplicar('experiences/x.json', pt, en);
  assert.deepEqual(r2.obj.included, ['Everything cleared away', 'Um item novo', 'Flowers', 'Candles', 'Linen cloths']);
  assert.equal(r2.emFalta, 1);
  // a hand-corrected translation (fixo) still has to match its text
  const en2 = { ...en, 'included.0': { ...en['included.0'], t: 'Linen', fixo: true } };
  assert.equal(aplicar('experiences/x.json', exp(), en2).obj.included[0], 'Linen');
});

test('a translation that changes a number, loses the brand or adds markup is refused', () => {
  assert.equal(validar('Mais de 7 dias antes', 'More than 10 days before'), 'números');
  assert.equal(validar('A PICNIC CLUB cria', 'Picnic Club creates'), 'marca');
  assert.equal(validar('Olá', 'Hello <b>there</b>'), 'etiquetas');
  assert.equal(validar('PICNIC CLUB® é uma marca', 'PICNIC CLUB is a brand'), 'marca registada');
  assert.equal(validar('Um texto comprido o suficiente para se medir a tradução que vem.', 'Short.'), 'tamanho');
  assert.equal(validar('Uma linha', ''), 'vazia');
  assert.equal(validar('Uma linha', 'A line'), null);
});

test('rules: a wrong NIF, a missing photo, an empty required text, a bad link', () => {
  assert.ok(nifValido('254 400 094'));
  assert.ok(!nifValido('254 400 095'));
  const f = files();
  f['site.json'].legal.nif = '123 456 788'; // (123 456 789 passes the check digit)
  f['experiences/luxury-picnics.json'].hero = 'nao-existe';
  f['home.json'].hero.title = '  ';
  f['press.json'].items = [{ outlet: 'NiT', title: 'Um título', summary: 'Um resumo.', date: '2026-08-29', language: 'pt', url: 'http://www.nit.pt/x' }];
  f['home.json'].intro.photos.pop();
  const chaves = bloqueios(f).map((p) => p.chave).sort();
  assert.deepEqual(chaves, [
    'experiences/luxury-picnics.json|hero|foto',
    'home.json|hero.title|vazio',
    'home.json|intro.photos|tres',
    'press.json|items.0.url|url',
    'site.json|legal.nif|nif',
  ]);
});

test('rules: a photo described but not on disk, and a photo on disk with no description', () => {
  const f = files();
  f['photos.json']['foto-fantasma'] = { alt: 'Algo', focus: '50% 50%' };
  const primeira = Object.keys(f['photos.json'])[0];
  f['photos.json'][primeira].alt = '';
  const chaves = bloqueios(f).map((p) => p.chave).sort();
  assert.deepEqual(chaves, ['photos.json|foto-fantasma|sem-ficheiro', `photos.json|${primeira}.alt|vazio`]);
});

test('locked fields: addresses, codes, films, and reviews that did not come from the queue', () => {
  const home = { hero: { primary: { href: '/experiences/' } }, gallery: { items: [{ film: 'gallery-arch', alt: 'Arco' }, { photo: 'x' }] } };
  const h2 = structuredClone(home);
  h2.hero.primary.href = '/elsewhere/';
  h2.gallery.items.push({ film: 'plan-candles', alt: 'Velas' });
  h2.gallery.items.reverse();
  assert.deepEqual(mudancasBloqueadas('home.json', home, h2).map((x) => x.motivo).sort(), ['filme-novo', 'fixo']);
  const um = (id) => ({ id, names: `Nome ${id}`, location: 'Lisboa', experience: 'luxury-picnic', text: 'Texto.', date: '2026-09', language: 'pt' });
  const rv = { items: [um('a'), um('b'), um('c')] };
  const r2 = structuredClone(rv);
  r2.items[0].featured = true;          // allowed
  r2.items.splice(1, 1);                 // taking one off: allowed
  assert.deepEqual(mudancasBloqueadas('reviews.json', rv, r2), []);
  r2.items[0].text = 'Outro texto';
  r2.items.push(um('novo'));
  assert.deepEqual(mudancasBloqueadas('reviews.json', rv, r2).map((x) => x.motivo), ['testemunho-mudado', 'testemunho-novo']);
  const e = { slug: 'eventos-privados', formValue: 'private-event', order: 4, name: 'Eventos' };
  assert.deepEqual(mudancasBloqueadas('experiences/private-events.json', e, { ...e, slug: 'outro', name: 'Outro nome' }).map((x) => x.caminho), ['slug']);
  const fotos = { a: { alt: 'A', from: 'x.jpg' } };
  assert.deepEqual(mudancasBloqueadas('photos.json', fotos, { a: { alt: 'Outra', from: 'x.jpg' } }), []);
  assert.deepEqual(mudancasBloqueadas('photos.json', fotos, { a: { alt: 'A', from: 'y.jpg' } }).map((x) => x.motivo), ['origem']);
});

console.log(`\n${n} tests passed`);
