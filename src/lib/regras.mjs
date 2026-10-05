/* THE CONTENT RULES — what the site needs from content/ to be built and to be lawful.
 *
 * One source for three readers: the build (scripts/build.mjs stops on any «bloqueia»), the panel in
 * the browser (it says what is wrong before saving) and the panel's Worker (it refuses a save that
 * brings a NEW «bloqueia»). The panel keeps a byte-for-byte copy (picnic-club-painel,
 * estatico/js/regras.js) and a test there compares the two: when this file changes, copy it.
 *
 * The messages are for Ana, in Portuguese, saying what to do. Each problem:
 *   { classe: 'bloqueia' | 'avisa', chave, ficheiro, campo, mensagem, ecra }
 *   chave   — stable, so the Worker can tell a new problem from one already in the repository
 *   ficheiro — the file relative to content/ («experiences/luxury-picnics.json»)
 *   campo   — the path in it («legal.nif», «gallery.2»)
 *   ecra    — the panel screen that fixes it */

export const CODIGOS_EXPERIENCIA = ['luxury-picnic', 'marriage-proposal', 'elopement-wedding', 'private-event', 'bespoke-experience'];

/* The photos the site's design uses by name (src/templates: the share cards of the home, the
   legal pages, the press, the reviews and the enquiry, and the cover of the experiences page).
   They can be described again but never leave the library. scripts/test-content.mjs checks this
   list against the templates. */
export const FOTOS_DO_DESENHO = ['proposal-sunset-sails', 'proposal-two-sails-sea', 'proposal-white-roses', 'proposal-embrace', 'proposal-candlelit-night'];
export const LINGUAS_ARTIGO = ['pt', 'en', 'es', 'fr', 'de', 'it'];

const MAX_CURTO = 300;
const MAX_LONGO = 3000;

const vazio = (v) => typeof v !== 'string' || !v.trim();
const eObjecto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** The panel screen of a content file. */
export function ecraDe(ficheiro) {
  if (ficheiro.startsWith('experiences/')) return `experiencias/${ficheiro.slice(12, -5)}`;
  return {
    'site.json': 'contactos', 'home.json': 'pagina-inicial', 'story.json': 'historia', 'press.json': 'imprensa',
    'reviews.json': 'testemunhos', 'policies.json': 'cancelamentos', 'photos.json': 'fotografias',
  }[ficheiro] ?? 'inicio';
}

export function nifValido(nif) {
  const n = String(nif ?? '').replace(/\s+/g, '');
  if (!/^[0-9]{9}$/.test(n)) return false;
  const d = n.split('').map(Number);
  const soma = d.slice(0, 8).reduce((s, x, i) => s + x * (9 - i), 0);
  const c = 11 - (soma % 11);
  return (c >= 10 ? 0 : c) === d[8];
}

export const emailValido = (s) => typeof s === 'string' && s.length <= 254 && /^[^@\s]{1,64}@[^@\s]{1,190}\.[^@\s]{2,}$/.test(s.trim());
export const urlValido = (s) => { try { const u = new URL(s); return u.protocol === 'https:' && !s.includes(' '); } catch { return false; } };
export const dataValida = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);
export const focoValido = (s) => /^(\d{1,3})% (\d{1,3})%$/.test(s ?? '') && s.split(' ').every((x) => Number(x.slice(0, -1)) <= 100);

/**
 * Every problem in the content.
 *   ficheiros — { 'site.json': object, …, 'experiences/<id>.json': object, 'photos.json': object };
 *               a file that could not be read is null
 *   fotos     — the names of the photos in media/photos/ (without «.jpg»)
 *   filmes    — the names of the films in media/video/ (without «.mp4»)
 */
export function problemas(ficheiros, { fotos = new Set(), filmes = new Set() } = {}) {
  const out = [];
  const juntar = (classe, ficheiro, campo, tipo, mensagem) =>
    out.push({ classe, chave: `${ficheiro}|${campo}|${tipo}`, ficheiro, campo, mensagem, ecra: ecraDe(ficheiro) });
  const bloqueia = (...a) => juntar('bloqueia', ...a);
  const avisa = (...a) => juntar('avisa', ...a);

  const descritas = eObjecto(ficheiros['photos.json']) ? ficheiros['photos.json'] : {};
  const fotoExiste = (nome) => typeof nome === 'string' && fotos.has(nome) && Object.hasOwn(descritas, nome);

  /* Shared checks. `rotulo` is how Ana knows the field. */
  const texto = (f, obj, campo, rotulo, { max = MAX_CURTO, obrigatorio = true } = {}) => {
    const v = campo.split('.').reduce((x, k) => (x == null ? undefined : x[k]), obj);
    if (v === undefined || v === null || v === '') { if (obrigatorio) bloqueia(f, campo, 'vazio', `${rotulo}: escreva este texto (não pode ficar vazio).`); return; }
    if (typeof v !== 'string') { bloqueia(f, campo, 'tipo', `${rotulo}: tem de ser um texto.`); return; }
    if (obrigatorio && !v.trim()) bloqueia(f, campo, 'vazio', `${rotulo}: escreva este texto (não pode ficar vazio).`);
    if (v.length > max) bloqueia(f, campo, 'longo', `${rotulo}: tem ${v.length} caracteres; o máximo são ${max}.`);
  };
  const lista = (f, obj, campo, rotulo, { min = 1, max = 40, maxItem = MAX_LONGO } = {}) => {
    const v = campo.split('.').reduce((x, k) => (x == null ? undefined : x[k]), obj);
    if (!Array.isArray(v)) { bloqueia(f, campo, 'tipo', `${rotulo}: falta a lista.`); return []; }
    if (v.length < min) bloqueia(f, campo, 'poucos', min === 1 ? `${rotulo}: escreva pelo menos um.` : `${rotulo}: são precisos pelo menos ${min}.`);
    if (v.length > max) bloqueia(f, campo, 'muitos', `${rotulo}: tem ${v.length}; o máximo são ${max}.`);
    v.forEach((x, i) => {
      if (typeof x === 'string') {
        if (!x.trim()) bloqueia(f, `${campo}.${i}`, 'vazio', `${rotulo}: o ${i + 1}.º está vazio — escreva-o ou tire-o.`);
        if (x.length > maxItem) bloqueia(f, `${campo}.${i}`, 'longo', `${rotulo}: o ${i + 1}.º tem ${x.length} caracteres; o máximo são ${maxItem}.`);
      }
    });
    return v;
  };
  const foto = (f, campo, nome, rotulo) => {
    if (vazio(nome)) { bloqueia(f, campo, 'foto-vazia', `${rotulo}: escolha uma fotografia.`); return; }
    if (!fotoExiste(nome)) bloqueia(f, campo, 'foto', `${rotulo}: a fotografia «${nome}» já não está na biblioteca. Escolha outra.`);
  };
  const seo = (f, obj) => {
    texto(f, obj, 'seo.title', 'Título para o Google', { max: 160 });
    texto(f, obj, 'seo.description', 'Descrição para o Google', { max: 320 });
    const t = obj?.seo?.title; const d = obj?.seo?.description;
    if (typeof t === 'string' && t.length > 70) avisa(f, 'seo.title', 'seo-longo', `Título para o Google: com ${t.length} caracteres, o Google corta-o perto dos 60. Mais curto mostra-se inteiro.`);
    if (typeof d === 'string' && d.trim() && (d.length < 70 || d.length > 170)) avisa(f, 'seo.description', 'seo-tamanho', `Descrição para o Google: tem ${d.length} caracteres; mostra-se melhor entre 120 e 160.`);
  };
  const ler = (f) => {
    const obj = ficheiros[f];
    if (obj === undefined) { bloqueia(f, '', 'falta', `Falta o ficheiro ${f}.`); return null; }
    if (!eObjecto(obj)) { bloqueia(f, '', 'ilegivel', `O ficheiro ${f} não se consegue ler. Avise o Renato.`); return null; }
    return obj;
  };

  /* --- contacts and legal data (site.json) --- */
  const s = ler('site.json');
  if (s) {
    const f = 'site.json';
    texto(f, s, 'tagline', 'Frase da marca');
    if (!emailValido(s.email)) bloqueia(f, 'email', 'email', 'Email: escreva um endereço completo, como hello@picnicclub.pt.');
    const tel = String(s.phone ?? '').replace(/[\s()-]/g, '');
    if (!/^\+?\d{9,15}$/.test(tel)) bloqueia(f, 'phone', 'telefone', 'Telefone: escreva o número com o indicativo, como +351 918 721 042.');
    if (!/^\d{9,15}$/.test(String(s.whatsapp ?? ''))) bloqueia(f, 'whatsapp', 'whatsapp', 'WhatsApp: escreva só os algarismos, com o indicativo e sem o «+» (351918721042).');
    texto(f, s, 'whatsappMessage', 'Mensagem do WhatsApp');
    if (vazio(s.instagram?.handle) || !String(s.instagram.handle).startsWith('@')) bloqueia(f, 'instagram.handle', 'instagram', 'Instagram: o nome começa por «@» (@picnicclub.pt).');
    if (!urlValido(s.instagram?.url) || !/^https:\/\/(www\.)?instagram\.com\//.test(s.instagram.url)) bloqueia(f, 'instagram.url', 'instagram-url', 'Instagram: o endereço tem de ser o da página, https://www.instagram.com/…');
    if (!urlValido(s.facebook) || !/^https:\/\/(www\.|m\.)?facebook\.com\//.test(s.facebook)) bloqueia(f, 'facebook', 'facebook', 'Facebook: o endereço tem de ser o da página, https://www.facebook.com/…');
    const zonas = lista(f, s, 'areas', 'Zonas onde trabalha', { max: 15, maxItem: 60 });
    const vistas = new Set();
    zonas.forEach((z, i) => { const k = String(z).trim().toLowerCase(); if (k && vistas.has(k)) bloqueia(f, `areas.${i}`, 'repetida', `Zonas: «${z}» aparece duas vezes.`); vistas.add(k); });
    texto(f, s, 'areasNote', 'Nota sobre outros locais');
    texto(f, s, 'responseTime', 'Prazo de resposta');
    /* The law asks for the provider's identification on the site (DL 7/2004, art. 10.º). */
    texto(f, s, 'legal.name', 'Nome da titular');
    texto(f, s, 'legal.status', 'Forma jurídica');
    if (!nifValido(s.legal?.nif)) bloqueia(f, 'legal.nif', 'nif', `NIF: «${s.legal?.nif ?? ''}» não é um NIF português válido. Confirme os 9 algarismos.`);
    const morada = Array.isArray(s.legal?.address) ? s.legal.address : [];
    if (morada.filter((l) => !vazio(l)).length < 2) bloqueia(f, 'legal.address', 'morada', 'Morada: são precisas pelo menos duas linhas (rua e código postal com a localidade).');
    morada.forEach((l, i) => { if (vazio(l)) bloqueia(f, `legal.address.${i}`, 'vazio', `Morada: a ${i + 1}.ª linha está vazia — escreva-a ou tire-a.`); });
    if (morada.length && !morada.some((l) => /\d{4}-\d{3}/.test(String(l)))) avisa(f, 'legal.address', 'codigo-postal', 'Morada: não encontrei o código postal (0000-000).');
    texto(f, s, 'legal.trademark', 'Marca registada');
  }

  /* --- photos (photos.json) --- */
  const p = ler('photos.json');
  if (p) {
    for (const nome of FOTOS_DO_DESENHO) if (!fotoExiste(nome)) bloqueia('photos.json', nome, 'desenho', `A fotografia «${nome}» é usada pelo desenho do site (nos cartões de partilha): não pode sair da biblioteca.`);
    for (const [nome, m] of Object.entries(p)) {
      if (!eObjecto(m)) { bloqueia('photos.json', nome, 'ilegivel', `A fotografia «${nome}» está mal gravada. Avise o Renato.`); continue; }
      if (vazio(m.alt)) bloqueia('photos.json', `${nome}.alt`, 'vazio', `Fotografia «${nome}»: descreva o que se vê (é o que ouve quem não vê a imagem, e o que o Google lê).`);
      else if (m.alt.length > 300) bloqueia('photos.json', `${nome}.alt`, 'longo', `Fotografia «${nome}»: a descrição tem ${m.alt.length} caracteres; o máximo são 300.`);
      if (m.focus !== undefined && !focoValido(m.focus)) bloqueia('photos.json', `${nome}.focus`, 'foco', `Fotografia «${nome}»: o ponto de foco está mal gravado. Escolha-o outra vez.`);
      if (!fotos.has(nome)) bloqueia('photos.json', nome, 'sem-ficheiro', `A fotografia «${nome}» está descrita mas o ficheiro não existe. Avise o Renato.`);
    }
  }

  /* --- home page (home.json) --- */
  const h = ler('home.json');
  if (h) {
    const f = 'home.json';
    seo(f, h);
    texto(f, h, 'hero.title', 'Título da abertura');
    texto(f, h, 'hero.text', 'Frase da abertura');
    texto(f, h, 'hero.primary.label', 'Botão principal da abertura', { max: 40 });
    texto(f, h, 'hero.secondary.label', 'Segundo botão da abertura', { max: 40 });
    texto(f, h, 'intro.title', 'Título da apresentação');
    lista(f, h, 'intro.text', 'Texto da apresentação', { max: 6 });
    texto(f, h, 'intro.link.label', 'Ligação da apresentação', { max: 40 });
    const tres = Array.isArray(h.intro?.photos) ? h.intro.photos : [];
    if (tres.length !== 3) bloqueia(f, 'intro.photos', 'tres', `Fotografias da apresentação: são precisas exactamente 3 (tem ${tres.length}).`);
    tres.forEach((n, i) => foto(f, `intro.photos.${i}`, n, `Fotografias da apresentação, a ${i + 1}.ª`));
    texto(f, h, 'experiences.title', 'Título das experiências');
    texto(f, h, 'experiences.text', 'Texto das experiências');
    texto(f, h, 'experiences.link.label', 'Ligação das experiências', { max: 40 });
    texto(f, h, 'philosophy.title', 'Título da filosofia');
    lista(f, h, 'philosophy.lines', 'Linhas da filosofia', { max: 10, maxItem: 120 });
    texto(f, h, 'philosophy.text', 'Texto da filosofia', { max: MAX_LONGO });
    texto(f, h, 'philosophy.link.label', 'Ligação da filosofia', { max: 40 });
    texto(f, h, 'gallery.eyebrow', 'Etiqueta da galeria', { max: 40 });
    texto(f, h, 'gallery.title', 'Título da galeria');
    texto(f, h, 'gallery.text', 'Texto da galeria', { max: MAX_LONGO });
    texto(f, h, 'gallery.link.label', 'Ligação da galeria', { max: 40 });
    const itens = Array.isArray(h.gallery?.items) ? h.gallery.items : [];
    if (itens.length < 4) bloqueia(f, 'gallery.items', 'poucos', `Galeria: são precisos pelo menos 4 (tem ${itens.length}).`);
    if (itens.length > 24) bloqueia(f, 'gallery.items', 'muitos', `Galeria: tem ${itens.length}; o máximo são 24.`);
    if (itens.length >= 4 && itens.length % 4) avisa(f, 'gallery.items', 'colunas', `Galeria: com ${itens.length}, a última fila fica incompleta. Fica certa com um múltiplo de 4 (8, 12, 16…).`);
    itens.forEach((it, i) => {
      if (!eObjecto(it)) { bloqueia(f, `gallery.items.${i}`, 'ilegivel', `Galeria: o ${i + 1}.º está mal gravado.`); return; }
      if (it.film !== undefined) {
        if (!filmes.has(it.film)) bloqueia(f, `gallery.items.${i}`, 'filme', `Galeria: o filme «${it.film}» não existe.`);
        if (vazio(it.alt)) bloqueia(f, `gallery.items.${i}.alt`, 'vazio', `Galeria: descreva o filme n.º ${i + 1}.`);
      } else foto(f, `gallery.items.${i}.photo`, it.photo, `Galeria, a ${i + 1}.ª`);
    });
    texto(f, h, 'reviews.title', 'Título dos testemunhos');
    texto(f, h, 'reviews.text', 'Texto dos testemunhos');
    texto(f, h, 'reviews.link.label', 'Ligação dos testemunhos', { max: 40 });
    texto(f, h, 'instagram.title', 'Título do Instagram');
  }

  /* --- our story (story.json) --- */
  const st = ler('story.json');
  if (st) {
    const f = 'story.json';
    seo(f, st);
    texto(f, st, 'eyebrow', 'Etiqueta', { max: 40 });
    texto(f, st, 'title', 'Título');
    texto(f, st, 'lead', 'Frase de abertura', { max: MAX_LONGO });
    lista(f, st, 'story', 'A história', { max: 12 });
    texto(f, st, 'quote', 'Citação', { max: MAX_LONGO });
    const duas = Array.isArray(st.photos) ? st.photos : [];
    if (duas.length !== 2) bloqueia(f, 'photos', 'duas', `Fotografias: são precisas exactamente 2 (tem ${duas.length}).`);
    duas.forEach((n, i) => foto(f, `photos.${i}`, n, i === 1 ? 'Fotografia da abertura' : 'Fotografia ao lado da história'));
  }

  /* --- press (press.json) --- */
  const pr = ler('press.json');
  if (pr) {
    const f = 'press.json';
    seo(f, pr);
    texto(f, pr, 'title', 'Título da página');
    const artigos = Array.isArray(pr.items) ? pr.items : [];
    if (!Array.isArray(pr.items)) bloqueia(f, 'items', 'tipo', 'Falta a lista dos artigos.');
    artigos.forEach((a, i) => {
      const r = `Artigo ${i + 1}`;
      if (!eObjecto(a)) { bloqueia(f, `items.${i}`, 'ilegivel', `${r}: está mal gravado.`); return; }
      for (const k of ['outlet', 'title', 'summary']) {
        const v = a[k];
        if (vazio(v)) bloqueia(f, `items.${i}.${k}`, 'vazio', `${r}: falta ${{ outlet: 'a publicação', title: 'o título', summary: 'o resumo' }[k]}.`);
        else if (v.length > (k === 'summary' ? 600 : 200)) bloqueia(f, `items.${i}.${k}`, 'longo', `${r}: ${{ outlet: 'a publicação', title: 'o título', summary: 'o resumo' }[k]} é longo de mais.`);
      }
      if (!dataValida(a.date)) bloqueia(f, `items.${i}.date`, 'data', `${r}: a data tem de ser um dia do calendário.`);
      if (!urlValido(a.url)) bloqueia(f, `items.${i}.url`, 'url', `${r}: o endereço do artigo tem de começar por https://`);
      if (!LINGUAS_ARTIGO.includes(a.language)) bloqueia(f, `items.${i}.language`, 'lingua', `${r}: escolha a língua em que o artigo está escrito.`);
      if (a.image !== undefined && a.image !== '') foto(f, `items.${i}.image`, a.image, `${r}, fotografia`);
    });
  }

  /* --- reviews (reviews.json) --- */
  const rv = ler('reviews.json');
  if (rv) {
    const f = 'reviews.json';
    seo(f, rv);
    texto(f, rv, 'title', 'Título da página');
    texto(f, rv, 'intro', 'Texto da página', { max: MAX_LONGO });
    const itens = Array.isArray(rv.items) ? rv.items : [];
    if (!Array.isArray(rv.items)) bloqueia(f, 'items', 'tipo', 'Falta a lista dos testemunhos.');
    const ids = new Set();
    itens.forEach((t, i) => {
      const r = `Testemunho ${i + 1}`;
      if (!eObjecto(t)) { bloqueia(f, `items.${i}`, 'ilegivel', `${r}: está mal gravado.`); return; }
      if (vazio(t.id) || ids.has(t.id)) bloqueia(f, `items.${i}.id`, 'id', `${r}: está mal gravado (identificação repetida). Avise o Renato.`);
      ids.add(t.id);
      if (vazio(t.names) || vazio(t.text)) bloqueia(f, `items.${i}`, 'vazio', `${r}: falta o nome ou o texto.`);
      if (!CODIGOS_EXPERIENCIA.includes(t.experience)) bloqueia(f, `items.${i}.experience`, 'experiencia', `${r}: a experiência não é nenhuma das do site.`);
      if (t.example) avisa(f, `items.${i}`, 'exemplo', `${r} é um exemplo, escrito para mostrar o desenho: tem de sair antes de o site ir para picnicclub.pt.`);
    });
  }

  /* --- cancellation policy (policies.json) --- */
  const po = ler('policies.json');
  if (po) {
    const f = 'policies.json';
    texto(f, po, 'cancellation.intro', 'Introdução', { max: MAX_LONGO });
    const regras = Array.isArray(po.cancellation?.rules) ? po.cancellation.rules : [];
    if (!regras.length) bloqueia(f, 'cancellation.rules', 'poucos', 'Prazos de cancelamento: escreva pelo menos um.');
    regras.forEach((r, i) => {
      if (!eObjecto(r) || vazio(r.when) || vazio(r.what)) bloqueia(f, `cancellation.rules.${i}`, 'vazio', `Prazo ${i + 1}: escreva o «quando» e o «o que acontece».`);
    });
    lista(f, po, 'cancellation.rescheduling', 'Alteração de data', { max: 10 });
    texto(f, po, 'cancellation.exceptional', 'Circunstâncias excecionais', { max: MAX_LONGO });
  }

  /* --- the experiences (experiences/<id>.json) --- */
  const slugs = new Map();
  const ordens = new Map();
  for (const f of Object.keys(ficheiros).filter((k) => /^experiences\/[a-z0-9-]+\.json$/.test(k)).sort()) {
    const e = ler(f);
    if (!e) continue;
    seo(f, e);
    texto(f, e, 'name', 'Nome', { max: 60 });
    if (e.menu !== undefined) texto(f, e, 'menu', 'Nome curto no menu', { max: 30 });
    texto(f, e, 'short', 'Resumo');
    texto(f, e, 'statement', 'Frase');
    lista(f, e, 'intro', 'Apresentação', { max: 8 });
    lista(f, e, 'included', 'O que está incluído', { max: 20, maxItem: 200 });
    lista(f, e, 'addOns', 'Extras', { min: 0, max: 20, maxItem: 120 });
    lista(f, e, 'locations', 'Onde', { max: 15, maxItem: 60 });
    if (e.weather !== undefined) texto(f, e, 'weather', 'Se o tempo mudar', { max: MAX_LONGO, obrigatorio: false });
    if (e.options !== undefined) {
      if (!Array.isArray(e.options)) bloqueia(f, 'options', 'tipo', 'As opções estão mal gravadas.');
      else e.options.forEach((o, i) => { if (!eObjecto(o) || vazio(o.name) || vazio(o.text)) bloqueia(f, `options.${i}`, 'vazio', `Opção ${i + 1}: escreva o nome e o texto.`); });
    }
    if (e.howItWorks !== undefined) {
      if (!Array.isArray(e.howItWorks)) bloqueia(f, 'howItWorks', 'tipo', 'Os passos estão mal gravados.');
      else e.howItWorks.forEach((o, i) => { if (!eObjecto(o) || vazio(o.title) || vazio(o.text)) bloqueia(f, `howItWorks.${i}`, 'vazio', `Passo ${i + 1}: escreva o título e o texto.`); });
    }
    foto(f, 'hero', e.hero, 'Fotografia de capa');
    const galeria = Array.isArray(e.gallery) ? e.gallery : [];
    if (galeria.length < 2) bloqueia(f, 'gallery', 'poucos', `Galeria: são precisas pelo menos 2 fotografias (tem ${galeria.length}).`);
    if (galeria.length > 24) bloqueia(f, 'gallery', 'muitos', `Galeria: tem ${galeria.length}; o máximo são 24.`);
    galeria.forEach((n, i) => foto(f, `gallery.${i}`, n, `Galeria, a ${i + 1}.ª`));
    if (new Set(galeria).size !== galeria.length) avisa(f, 'gallery', 'repetida', 'Galeria: há uma fotografia repetida.');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(e.slug ?? '')) bloqueia(f, 'slug', 'slug', 'O endereço em português está mal gravado. Avise o Renato.');
    else if (slugs.has(e.slug)) bloqueia(f, 'slug', 'slug-repetido', `O endereço «${e.slug}» é o mesmo de outra experiência. Avise o Renato.`);
    slugs.set(e.slug, f);
    if (!CODIGOS_EXPERIENCIA.includes(e.formValue)) bloqueia(f, 'formValue', 'codigo', 'O código da experiência está mal gravado. Avise o Renato.');
    if (!Number.isInteger(e.order) || ordens.has(e.order)) bloqueia(f, 'order', 'ordem', 'A ordem das experiências está mal gravada. Avise o Renato.');
    ordens.set(e.order, f);
  }
  return out;
}

/**
 * Where each photo is used: Map(name → [{ ficheiro, campo }]). The design's own photos
 * (FOTOS_DO_DESENHO) count as used, by «design». A photo that nothing uses can leave the library.
 */
export function fotosUsadas(ficheiros) {
  const m = new Map();
  const usar = (nome, ficheiro, campo) => {
    if (typeof nome !== 'string' || !nome) return;
    if (!m.has(nome)) m.set(nome, []);
    m.get(nome).push({ ficheiro, campo });
  };
  for (const nome of FOTOS_DO_DESENHO) usar(nome, 'design', '');
  const h = ficheiros['home.json'];
  (Array.isArray(h?.intro?.photos) ? h.intro.photos : []).forEach((n, i) => usar(n, 'home.json', `intro.photos.${i}`));
  (Array.isArray(h?.gallery?.items) ? h.gallery.items : []).forEach((it, i) => usar(it?.photo, 'home.json', `gallery.items.${i}.photo`));
  const st = ficheiros['story.json'];
  (Array.isArray(st?.photos) ? st.photos : []).forEach((n, i) => usar(n, 'story.json', `photos.${i}`));
  const pr = ficheiros['press.json'];
  (Array.isArray(pr?.items) ? pr.items : []).forEach((a, i) => usar(a?.image, 'press.json', `items.${i}.image`));
  for (const f of Object.keys(ficheiros).filter((k) => /^experiences\/[a-z0-9-]+\.json$/.test(k)).sort()) {
    const e = ficheiros[f];
    usar(e?.hero, f, 'hero');
    (Array.isArray(e?.gallery) ? e.gallery : []).forEach((n, i) => usar(n, f, `gallery.${i}`));
  }
  return m;
}

/* WHAT THE PANEL DOES NOT EDIT, and a save must leave as it was (the Worker refuses one that
   changes it: 422 campo_bloqueado). The addresses and codes the site is built on, the films, the
   provenance of the photos — and the reviews, which only enter through the moderation queue: a
   save may take one off the site or mark one as featured, never add or reword one. */
const BLOQUEADOS = {
  'site.json': ['brand', 'url', 'endpoints'],
  'home.json': ['hero.video', 'hero.primary.href', 'hero.secondary.href', 'intro.link.href', 'experiences.link.href', 'philosophy.link.href', 'gallery.link.href', 'reviews.link.href'],
  experiencia: ['slug', 'formValue', 'order'],
};
const valorEm = (obj, campo) => campo.split('.').reduce((x, k) => (x == null ? undefined : x[k]), obj);
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The locked fields a save would change: [{ caminho, motivo }]. */
export function mudancasBloqueadas(ficheiro, antes, depois) {
  const out = [];
  const tipo = /^experiences\//.test(ficheiro) ? 'experiencia' : ficheiro;
  for (const c of BLOQUEADOS[tipo] ?? []) if (!igual(valorEm(antes, c), valorEm(depois, c))) out.push({ caminho: c, motivo: 'fixo' });
  if (ficheiro === 'home.json') {
    /* No film is added (the films are cut by hand from the originals): a film item can move or go. */
    const filmesAntes = new Set((antes?.gallery?.items ?? []).filter((x) => x && x.film).map((x) => x.film));
    (depois?.gallery?.items ?? []).forEach((x, i) => { if (x && x.film !== undefined && !filmesAntes.has(x.film)) out.push({ caminho: `gallery.items.${i}.film`, motivo: 'filme-novo' }); });
  }
  if (ficheiro === 'reviews.json') {
    const porId = new Map((antes?.items ?? []).map((x) => [x?.id, x]));
    (depois?.items ?? []).forEach((x, i) => {
      const a = porId.get(x?.id);
      if (!a) { out.push({ caminho: `items.${i}`, motivo: 'testemunho-novo' }); return; }
      const { featured: fa, ...ra } = a; const { featured: fd, ...rd } = x;
      if (!igual(ra, rd)) out.push({ caminho: `items.${i}`, motivo: 'testemunho-mudado' });
    });
  }
  if (ficheiro === 'photos.json') {
    for (const [nome, m] of Object.entries(depois ?? {})) {
      const a = antes?.[nome];
      if (a && (!igual(a.from, m?.from) || !igual(a.labelledBy, m?.labelledBy))) out.push({ caminho: nome, motivo: 'origem' });
    }
  }
  return out;
}
