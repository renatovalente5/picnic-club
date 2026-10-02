# Picnic Club

Website for PICNIC CLUB®, slow luxury experiences in Portugal: luxury picnics, marriage
proposals, elopement weddings and private events.

- `content/` — the site's words and settings (JSON; edited by the panel later)
- `media/` — photos (with alt text and focus points in `media/photos.json`), brand files, film
- `src/` — templates, styles, script and fonts
- `scripts/build.mjs` — builds `_site/` (Node 20+, no dependencies; images need Python 3 + Pillow)
- `scripts/films.py` — cuts the short films of the home gallery from the original videos
  (`python3 scripts/films.py _cliente/videos`; the originals stay out of git)

```sh
node scripts/build.mjs                 # preview build into _site/
python3 scripts/dev-server.py 4800     # serve it at http://localhost:4800
node scripts/build.mjs --production    # the build for picnicclub.pt
```

See `docs/PLAN.md` for decisions and phases.
