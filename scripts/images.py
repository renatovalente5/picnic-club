#!/usr/bin/env python3
"""Responsive images for the site.

Reads every photo in media/photos/ (with alt text and focus point from media/photos.json)
and every poster in media/video/, and writes AVIF + WebP at fixed widths, plus a 1200×630
JPEG share card: the photo on the left, cropped around the focus point, and the gold logo on
an ivory panel on the right. Nothing is laid over the photo (in several it would sit on a
face), and a 720×630 window keeps most of a vertical photo, where a full-width crop kept a
band.

Output goes to .cache/images/ (kept between builds, keyed by the source's content hash)
and is copied to _site/assets/img/. A manifest describing every image is written to
.cache/images/manifest.json for scripts/build.mjs.

    python3 scripts/images.py            # build what changed
    python3 scripts/images.py --check    # only verify media/photos.json matches the files
"""
import hashlib
import json
import os
import shutil
import sys

from PIL import Image, ImageOps, features

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PHOTOS = os.path.join(ROOT, 'media', 'photos')
POSTERS = os.path.join(ROOT, 'media', 'video')
INDEX = os.path.join(ROOT, 'media', 'photos.json')
CACHE = os.path.join(ROOT, '.cache', 'images')
OUT = os.path.join(ROOT, '_site', 'assets', 'img')

WIDTHS = [480, 768, 1080, 1440, 1920]
AVIF_QUALITY = 52
WEBP_QUALITY = 78
SHARE = (1200, 630)
SHARE_PHOTO = 720           # the photo's width on the card; the panel takes the rest
SHARE_LOGO = 300            # the logo's width on the panel
IVORY = (250, 246, 239)     # --ivory
LOGO = os.path.join(ROOT, 'media', 'brand', 'logo-gold.png')
FORMATS = ('avif', 'webp') if features.check('avif') else ('webp',)
SETTINGS = f'v1-{WIDTHS}-{AVIF_QUALITY}-{WEBP_QUALITY}-{SHARE}'


def content_hash(path, *more, extra=''):
    h = hashlib.sha256((SETTINGS + extra).encode())
    for p in (path, *more):
        with open(p, 'rb') as f:
            h.update(f.read())
    return h.hexdigest()[:10]


def share_card(im, focus, logo):
    card = Image.new('RGB', SHARE, IVORY)
    card.paste(crop_to(im, (SHARE_PHOTO, SHARE[1]), focus), (0, 0))
    height = round(logo.height * SHARE_LOGO / logo.width)
    mark = logo.convert('RGBa').resize((SHARE_LOGO, height), Image.LANCZOS).convert('RGBA')
    left = SHARE_PHOTO + (SHARE[0] - SHARE_PHOTO - SHARE_LOGO) // 2
    card.paste(mark, (left, (SHARE[1] - height) // 2), mark)
    return card


def parse_focus(focus):
    """'50% 60%' -> (0.5, 0.6)."""
    try:
        x, y = focus.replace('%', '').split()
        return float(x) / 100, float(y) / 100
    except Exception:
        return 0.5, 0.5


def crop_to(im, size, focus):
    tw, th = size
    k = max(tw / im.width, th / im.height)
    w, h = round(im.width * k), round(im.height * k)
    scaled = im.resize((w, h), Image.LANCZOS)
    fx, fy = focus
    left = min(max(round(fx * w - tw / 2), 0), w - tw)
    top = min(max(round(fy * h - th / 2), 0), h - th)
    return scaled.crop((left, top, left + tw, top + th))


def build_one(name, src, focus, kind, logo):
    digest = content_hash(src)
    folder = os.path.join(CACHE, name)
    os.makedirs(folder, exist_ok=True)
    im = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    widths = [w for w in WIDTHS if w < im.width] + [im.width]
    files = []
    for w in widths:
        h = round(im.height * w / im.width)
        resized = None
        for ext in FORMATS:
            fname = f'{name}-{digest}-{w}.{ext}'
            target = os.path.join(folder, fname)
            if not os.path.exists(target):
                if resized is None:
                    resized = im if w == im.width else im.resize((w, h), Image.LANCZOS)
                if ext == 'avif':
                    resized.save(target, 'AVIF', quality=AVIF_QUALITY, speed=6)
                else:
                    resized.save(target, 'WEBP', quality=WEBP_QUALITY, method=6)
            files.append(fname)
    # its own name: a new layout or logo gives the card a new address, which the apps that keep
    # link previews (WhatsApp, Facebook) fetch again
    share = f'{name}-{content_hash(src, LOGO, __file__, extra=repr(focus))}-share.jpg'
    target = os.path.join(folder, share)
    if not os.path.exists(target):
        share_card(im, focus, logo).save(target, 'JPEG', quality=84, progressive=True, optimize=True)
    files.append(share)
    # drop files from older versions of this source
    for old in os.listdir(folder):
        if old not in files:
            os.remove(os.path.join(folder, old))
    return {'kind': kind, 'width': im.width, 'height': im.height, 'hash': digest,
            'widths': widths, 'formats': list(FORMATS), 'share': share, 'files': files}


def main():
    index = json.load(open(INDEX, encoding='utf-8'))
    on_disk = {f[:-4] for f in os.listdir(PHOTOS) if f.lower().endswith('.jpg')}
    missing = sorted(set(index) - on_disk)
    unlisted = sorted(on_disk - set(index))
    if missing or unlisted:
        if missing:
            print('media/photos.json lists photos that are not in media/photos/:', ', '.join(missing))
        if unlisted:
            print('Photos without an entry (alt text) in media/photos.json:', ', '.join(unlisted))
        sys.exit(1)
    if '--check' in sys.argv:
        print(f'{len(index)} photos, all described.')
        return

    manifest = {}
    logo = Image.open(LOGO).convert('RGBA')
    for name, meta in sorted(index.items()):
        info = build_one(name, os.path.join(PHOTOS, name + '.jpg'), parse_focus(meta.get('focus', '50% 50%')), 'photo', logo)
        info.update({'alt': meta['alt'], 'focus': meta.get('focus', '50% 50%')})
        manifest[name] = info
    for f in sorted(os.listdir(POSTERS)):
        if f.endswith('-poster.jpg'):
            name = f[:-4]
            info = build_one(name, os.path.join(POSTERS, f), (0.5, 0.5), 'poster', logo)
            info.update({'alt': '', 'focus': '50% 50%'})
            manifest[name] = info

    os.makedirs(OUT, exist_ok=True)
    for name, info in manifest.items():
        for fname in info['files']:
            shutil.copy2(os.path.join(CACHE, name, fname), os.path.join(OUT, fname))
    with open(os.path.join(CACHE, 'manifest.json'), 'w', encoding='utf-8') as f:
        json.dump(manifest, f, indent=1, ensure_ascii=False)
    total = sum(len(i['files']) for i in manifest.values())
    print(f'{len(manifest)} images, {total} files ({", ".join(FORMATS)}).')


if __name__ == '__main__':
    main()
