#!/usr/bin/env python3
"""The browser-tab icons: the «P» monogram of the logo on a transparent ground (run by hand).

    python3 scripts/icons.py

Reads Ana's logo at full size (_cliente/marca/logotipo/, private, outside git), takes the monogram
(the first block of ink from the top, above the wordmark) and writes media/brand/favicon-16.png,
favicon-32.png and favicon-48.png.

The circle and the «P» are hairlines: at 32 px a stroke is under a pixel wide and comes out pale,
more so on a light tab. So the partly covered pixels are made more opaque (alpha ** 0.5) and every
pixel takes the flat gold of the logo, which keeps the gold-leaf texture from leaving specks round
the edges. The shapes are the logo's own; only how solid they look at this size changes.
"""
import os

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SOURCE = os.path.join(ROOT, '_cliente', 'marca', 'logotipo', 'picnic-club-logo-dourado-liso.png')
OUT = os.path.join(ROOT, 'media', 'brand')
SIZES = (16, 32, 48)
STRENGTH = 0.5  # alpha ** STRENGTH: 1 leaves it as drawn, lower is more solid (0.35 shows specks)


def monogram(logo):
    """The monogram, squared on a transparent ground: the top block of ink of the logo."""
    alpha = logo.getchannel('A').point(lambda v: 255 if v > 24 else 0)
    width, height = logo.size
    top = bottom = None
    for y in range(height):
        inked = alpha.crop((0, y, width, y + 1)).getbbox() is not None
        if inked and top is None:
            top = y
        elif not inked and top is not None:
            bottom = y
            break
    left, _, right, _ = alpha.crop((0, top, width, bottom)).getbbox()
    mark = logo.crop((left, top, right, bottom))
    side = max(mark.size)
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(mark, ((side - mark.width) // 2, (side - mark.height) // 2))
    return square


def icon(square, size, gold):
    small = square.convert('RGBa').resize((size, size), Image.LANCZOS).convert('RGBA')
    alpha = small.getchannel('A').point(lambda v: round(255 * (v / 255) ** STRENGTH))
    flat = Image.new('RGBA', (size, size), gold + (0,))
    flat.putalpha(alpha)
    return flat


def main():
    logo = Image.open(SOURCE).convert('RGBA')
    square = monogram(logo)
    solid = [p[:3] for p in square.getdata() if p[3] > 250]
    gold = max(set(solid), key=solid.count)  # the flat gold of the logo
    for size in SIZES:
        path = os.path.join(OUT, f'favicon-{size}.png')
        icon(square, size, gold).save(path, optimize=True)
        print(f'favicon-{size}.png  {os.path.getsize(path)} bytes')
    print(f'monogram {square.size[0]} px square, gold #{"%02X%02X%02X" % gold}')


if __name__ == '__main__':
    main()
