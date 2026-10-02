#!/usr/bin/env python3
"""Draws the coast map of the home page: Lisbon to Melides, from OpenStreetMap.

    python3 scripts/coast-map.py            uses the copy in .cache/map/ when there is one
    python3 scripts/coast-map.py --refresh  asks the Overpass API again

Writes media/map/coast.svg (land and coastline, no text) and media/map/coast.json (the frame
and where each place sits on it, in percent). The labels are HTML laid over the drawing, so
they use the site's fonts and stay the same size on every screen.

The data is © OpenStreetMap contributors (ODbL): the page must credit it next to the map.
Standard library only.
"""
import json
import math
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / '.cache' / 'map'
OUT = ROOT / 'media' / 'map'
OVERPASS = 'https://overpass-api.de/api/interpreter'

# The frame (degrees). Lisbon at the top, Melides at the bottom, Alcácer do Sal at the right.
WEST, EAST, SOUTH, NORTH = -9.26, -8.40, 38.04, 38.82
WIDTH = 1000  # SVG units; the height follows from the projection
TOLERANCE = 0.7  # Douglas-Peucker, in SVG units (about 50 m)
MIN_ISLAND = 40  # square SVG units; smaller islands are salt marsh specks at this scale
LAND = '#E7DCC7'  # on the cream band of the home page, which is the sea
COAST = '#A88A50'

# name as in content/site.json "areas" → OpenStreetMap node, and where the label goes
# label side (n, e, s, w: above, right, below, left of the dot), and on a narrow map when it differs
PLACES = [
    ('Lisbon', 265958490, 'n', None),
    ('Tróia', 3289734235, 'w', None),
    ('Comporta', 199212628, 'w', None),
    ('Carvalhal', 1684423383, 'e', 'w'),  # on a narrow map «Alcácer / do Sal» takes two lines on its right
    ('Alcácer do Sal', 25619074, 's', None),
    ('Grândola', 3673206553, 'n', None),
    ('Melides', 907066345, 'w', None),
]


def overpass(query, cache_name, refresh):
    path = CACHE / cache_name
    if path.exists() and not refresh:
        return json.loads(path.read_text())
    data = urllib.parse.urlencode({'data': query}).encode()
    req = urllib.request.Request(OVERPASS, data=data, headers={'User-Agent': 'picnic-club-site-build/1.0'})
    for attempt in range(4):  # the public server answers 429/504 when it is busy
        try:
            with urllib.request.urlopen(req, timeout=180) as res:
                body = res.read()
            break
        except urllib.error.HTTPError as err:
            if err.code not in (429, 502, 503, 504) or attempt == 3:
                raise
            time.sleep(20 * (attempt + 1))
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_bytes(body)
    return json.loads(body)


# ---------------------------------------------------------------- projection

LAT0 = math.radians((SOUTH + NORTH) / 2)
KX = math.cos(LAT0)
SCALE = WIDTH / ((EAST - WEST) * KX)
HEIGHT = (NORTH - SOUTH) * SCALE


def project(lon, lat):
    """Equirectangular, y UP (geographic orientation; flipped only when written out)."""
    return ((lon - WEST) * KX * SCALE, (lat - SOUTH) * SCALE)


# ---------------------------------------------------------------- chains of coastline

def chains(ways):
    """Joins the coastline ways end to start. OpenStreetMap keeps the land on the left."""
    by_start = {}
    for i, w in enumerate(ways):
        by_start.setdefault(w[0], []).append(i)
    used = set()
    out = []
    for i, w in enumerate(ways):
        if i in used:
            continue
        used.add(i)
        line = list(w)
        while line[-1] != line[0]:  # forward
            nxt = [j for j in by_start.get(line[-1], []) if j not in used]
            if not nxt:
                break
            used.add(nxt[0])
            line.extend(ways[nxt[0]][1:])
        if line[-1] != line[0]:  # backward
            by_end = {}
            for j, v in enumerate(ways):
                if j not in used:
                    by_end.setdefault(v[-1], []).append(j)
            while line[0] != line[-1]:
                prv = [j for j in by_end.get(line[0], []) if j not in used]
                if not prv:
                    break
                used.add(prv[0])
                line = ways[prv[0]][:-1] + line
        out.append(line)
    return out


# ---------------------------------------------------------------- clipping to the frame

def inside(p):
    return 0 <= p[0] <= WIDTH and 0 <= p[1] <= HEIGHT


def clip_segment(p, q):
    """Liang-Barsky: the part of p→q inside the frame as (t0, t1), or None."""
    t0, t1 = 0.0, 1.0
    dx, dy = q[0] - p[0], q[1] - p[1]
    for pk, qk in ((-dx, p[0]), (dx, WIDTH - p[0]), (-dy, p[1]), (dy, HEIGHT - p[1])):
        if pk == 0:
            if qk < 0:
                return None
            continue
        t = qk / pk
        if pk < 0:
            if t > t1:
                return None
            t0 = max(t0, t)
        else:
            if t < t0:
                return None
            t1 = min(t1, t)
    return t0, t1


def lerp(p, q, t):
    return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)


def pieces(line):
    """The parts of an open line that lie inside the frame, each from border to border."""
    out, cur = [], None
    for p, q in zip(line, line[1:]):
        c = clip_segment(p, q)
        if c is None:
            continue
        t0, t1 = c
        a, b = lerp(p, q, t0), lerp(p, q, t1)
        if cur is None:
            cur = [a]
        cur.append(b)
        if t1 < 1:  # leaves the frame here
            out.append(cur)
            cur = None
    if cur is not None:
        out.append(cur)
    return out


def border_pos(p):
    """Position along the frame's border, counter-clockwise from the south-west corner."""
    x, y = p
    eps = 1e-6
    if abs(y) < eps:
        return x
    if abs(x - WIDTH) < eps:
        return WIDTH + y
    if abs(y - HEIGHT) < eps:
        return WIDTH + HEIGHT + (WIDTH - x)
    if abs(x) < eps:
        return 2 * WIDTH + HEIGHT + (HEIGHT - y)
    raise ValueError(f'{p} is not on the border')


CORNERS = [(0.0, (0.0, 0.0)), (WIDTH, (WIDTH, 0.0)), (WIDTH + HEIGHT, (WIDTH, HEIGHT)), (2 * WIDTH + HEIGHT, (0.0, HEIGHT))]
PERIMETER = 2 * (WIDTH + HEIGHT)


def land_polygons(open_pieces):
    """Closes the coastline pieces along the border, keeping the land on the left."""
    starts = sorted(((border_pos(pc[0]), i) for i, pc in enumerate(open_pieces)))
    used = set()
    polys = []
    for first in range(len(open_pieces)):
        if first in used:
            continue
        ring, i = [], first
        while True:
            used.add(i)
            ring.extend(open_pieces[i])
            s_exit = border_pos(open_pieces[i][-1])
            # the next start counter-clockwise from this exit
            ahead = [(s - s_exit) % PERIMETER for s, _ in starts]
            k = min(range(len(starts)), key=lambda n: ahead[n] if ahead[n] > 1e-9 else PERIMETER)
            gap, nxt = ahead[k], starts[k][1]
            for c, pt in sorted(CORNERS, key=lambda c: (c[0] - s_exit) % PERIMETER):
                if 1e-9 < (c - s_exit) % PERIMETER < gap:
                    ring.append(pt)
            if nxt == first:
                break
            if nxt in used:
                raise RuntimeError('coastline pieces do not close into rings')
            i = nxt
        polys.append(ring)
    return polys


# ---------------------------------------------------------------- simplification

def dp(points, tol):
    if len(points) < 3:
        return points
    a, b = points[0], points[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    norm = math.hypot(dx, dy) or 1e-12
    best, idx = -1.0, 0
    for i in range(1, len(points) - 1):
        p = points[i]
        d = abs(dy * (p[0] - a[0]) - dx * (p[1] - a[1])) / norm
        if d > best:
            best, idx = d, i
    if best <= tol:
        return [a, b]
    return dp(points[: idx + 1], tol)[:-1] + dp(points[idx:], tol)


def dp_ring(ring, tol):
    """A closed ring degenerates in Douglas-Peucker (first = last): split it at the far point."""
    pts = ring[:-1] if ring[0] == ring[-1] else ring
    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    out = dp(pts[: far + 1], tol)[:-1] + dp(pts[far:] + [pts[0]], tol)
    return out


def area(ring):
    return 0.5 * sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(ring, ring[1:] + ring[:1]))


def path(rings, closed):
    out = []
    for r in rings:
        pts = [(round(x, 1), round(HEIGHT - y, 1)) for x, y in r]
        d = 'M' + ' '.join(f'{x:g},{y:g}' for x, y in pts)
        out.append(d + ('Z' if closed else ''))
    return ''.join(out)


# ---------------------------------------------------------------- main

def main():
    refresh = '--refresh' in sys.argv
    pad = 0.12
    coast = overpass(
        f'[out:json][timeout:120];way["natural"="coastline"]({SOUTH - pad},{WEST - pad},{NORTH + pad},{EAST + pad});out geom;',
        'coastline.json', refresh)
    ids = ','.join(str(p[1]) for p in PLACES)
    nodes = overpass(f'[out:json][timeout:60];node(id:{ids});out;', 'places.json', refresh)

    ways = [[project(p['lon'], p['lat']) for p in e['geometry']] for e in coast['elements'] if e['type'] == 'way']
    lines = chains(ways)

    open_pieces, islands = [], []
    for line in lines:
        closed = line[0] == line[-1]
        if closed and all(inside(p) for p in line):
            if area(line) >= MIN_ISLAND:
                islands.append(line)
            continue
        if closed:  # start the ring outside the frame so it clips into border-to-border pieces
            k = next(i for i, p in enumerate(line) if not inside(p))
            line = line[k:-1] + line[: k + 1]
        elif inside(line[0]) or inside(line[-1]):
            raise RuntimeError('a coastline ends inside the frame: fetch a wider area')
        open_pieces.extend(pieces(line))

    # simplify first, then close: the fill and the line share every vertex
    simple_pieces = [dp(pc, TOLERANCE) for pc in open_pieces]
    simple_islands = [dp_ring(r, TOLERANCE) for r in islands]
    simple_land = [r for r in land_polygons(simple_pieces) if abs(area(r)) >= MIN_ISLAND]

    h = round(HEIGHT, 1)
    # the drawing fades out at its edges, so the frame never shows as a box on the page
    fade = '<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".14" stop-color="#fff"/><stop offset=".86" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>'
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {WIDTH} {h:g}" width="{WIDTH}" height="{h:g}">'
        f'<defs><linearGradient id="fx">{fade}</linearGradient><linearGradient id="fy" x2="0" y2="1">{fade}</linearGradient>'
        f'<mask id="my"><rect width="{WIDTH}" height="{h:g}" fill="url(#fy)"/></mask>'
        f'<mask id="m"><rect width="{WIDTH}" height="{h:g}" fill="url(#fx)" mask="url(#my)"/></mask></defs>'
        '<g mask="url(#m)">'
        f'<path fill="{LAND}" d="{path(simple_land + simple_islands, True)}"/>'
        f'<path fill="none" stroke="{COAST}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" '
        f'd="{path(simple_pieces, False)}{path(simple_islands, True)}"/>'
        '</g></svg>\n'
    )
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'coast.svg').write_text(svg)

    found = {e['id']: e for e in nodes['elements']}
    places = []
    for name, node, label, small in PLACES:
        e = found[node]
        x, y = project(e['lon'], e['lat'])
        if not inside((x, y)):
            raise RuntimeError(f'{name} falls outside the frame')
        place = {'name': name, 'x': round(100 * x / WIDTH, 2), 'y': round(100 * (HEIGHT - y) / HEIGHT, 2), 'label': label}
        if small:
            place['labelSmall'] = small
        places.append(place)
    km = (EAST - WEST) * KX * 111.32
    meta = {
        'source': 'OpenStreetMap (natural=coastline, place nodes), via the Overpass API',
        'licence': 'ODbL: credit "© OpenStreetMap contributors" next to the map',
        'frame': {'west': WEST, 'east': EAST, 'south': SOUTH, 'north': NORTH},
        'width': WIDTH,
        'height': h,
        'kmAcross': round(km, 2),
        'places': places,
    }
    (OUT / 'coast.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2) + '\n')
    print(f'coast.svg {len(svg) / 1024:.1f} KB · {len(simple_pieces)} coast pieces, {len(simple_islands)} islands, {len(simple_land)} land shapes · {km:.1f} km across')


if __name__ == '__main__':
    main()
