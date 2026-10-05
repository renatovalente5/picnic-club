# Picnic Club

Website for PICNIC CLUB®, slow luxury experiences in Portugal: luxury picnics, marriage
proposals, elopement weddings and private events.

- `content/` — the site's words and settings, **in Portuguese**: the source of both languages, which
  Ana edits in her panel (`picnic-club-painel`, private). `content/photos.json` describes each photo
  (alt text, focus point)
- `content/i18n/en/` — the English: a translation of each Portuguese field, with the digest of the
  Portuguese it came from (`{ "hero.title": { "t": "…", "h": "…" } }`). The panel's Worker writes it
  within minutes of a change; until then the English page shows the previous translation or, for a
  new text, the Portuguese. The rules are in `src/lib/traduziveis.mjs`
- `src/lib/regras.mjs` — the content rules, shared with the panel (the build stops on a «bloqueia»).
  The panel keeps byte-for-byte copies of this file and of `traduziveis.mjs`: copy them when they change
- fixed texts of the templates, and the Portuguese addresses, are in `src/templates/i18n.mjs`
- `media/` — photos, brand files, film
- `src/` — templates, styles, script and fonts
- `scripts/build.mjs` — builds `_site/` (Node 20+, no dependencies; images need Python 3 + Pillow)
- `scripts/films.py` — cuts the short films of the home gallery from the original videos
  (`python3 scripts/films.py _cliente/videos`; the originals stay out of git)

```sh
node scripts/test-content.mjs          # the rules and the translations (CI runs it too)
node scripts/build.mjs                 # preview build into _site/
python3 scripts/dev-server.py 4800     # serve it at http://localhost:4800
node scripts/build.mjs --production    # the build for picnicclub.pt
```

See `docs/PLAN.md` for decisions and phases.
