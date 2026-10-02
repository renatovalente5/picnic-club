#!/usr/bin/env python3
"""Responsive images for the site.

Reads every photo in media/photos/ (with alt text and focus point from media/photos.json)
and every poster in media/video/, and writes AVIF + WebP at fixed widths, plus a 1200×630
JPEG share card cropped around the focus point.

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
FORMATS = ('avif', 'webp') if features.check('avif') else ('webp',)
SETTINGS = f'v1-{WIDTHS}-{AVIF_QUALITY}-{WEBP_QUALITY}-{SHARE}'


def content_hash(path):
    h = hashlib.sha256(SETTINGS.encode())
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()[:10]


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


def build_one(name, src, focus, kind):
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
    share = f'{name}-{digest}-share.jpg'
    target = os.path.join(folder, share)
    if not os.path.exists(target):
        crop_to(im, SHARE, focus).save(target, 'JPEG', quality=84, progressive=True, optimize=True)
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
    for name, meta in sorted(index.items()):
        info = build_one(name, os.path.join(PHOTOS, name + '.jpg'), parse_focus(meta.get('focus', '50% 50%')), 'photo')
        info.update({'alt': meta['alt'], 'focus': meta.get('focus', '50% 50%')})
        manifest[name] = info
    for f in sorted(os.listdir(POSTERS)):
        if f.endswith('-poster.jpg'):
            name = f[:-4]
            info = build_one(name, os.path.join(POSTERS, f), (0.5, 0.5), 'poster')
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
