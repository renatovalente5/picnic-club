#!/usr/bin/env python3
"""Cuts the short films of the home gallery and the enquiry page from the original videos (run by hand).

    python3 scripts/films.py _cliente/videos

Each film is one shot, slowed to half speed where the source allows it (the 4K film carries
60 distinct frames per second inside a 120 fps stream), and made into a seamless loop by
cross-fading its last moment into its first. Output: H.264 MP4 without sound in media/video/,
plus a poster frame (<name>-poster.jpg) that scripts/images.py turns into AVIF and WebP.
The originals stay out of git (_cliente/ is private).
"""
import os
import subprocess
import sys

FFMPEG = '/opt/homebrew/bin/ffmpeg'
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUT = os.path.join(ROOT, 'media', 'video')

FILM = 'IMG_0331.MOV'      # elopement film, 2160×3840, 120 fps stream with 60 distinct frames/s
PROPOSAL = 'IMG_6923.MP4'  # proposal film, 464×848, 30 fps (the only copy we have)

# name, source, start, end (seconds), speed (0.5 = half speed), width, crf
CLIPS = [
    ('gallery-candles', FILM, 47.90, 52.50, 1.0, 640, 28),     # drone: the candlelit table at dusk
    ('gallery-rings', FILM, 18.48, 20.15, 0.5, 640, 28),       # the ring, slipped on
    ('gallery-arch', FILM, 13.52, 16.60, 0.5, 640, 28),        # the couple at the heart-shaped arch
    ('gallery-table', FILM, 7.70, 9.62, 0.5, 640, 28),         # bottles on ice beside the table
    ('gallery-toast', FILM, 52.60, 54.78, 0.5, 640, 28),       # the toast at night
    ('gallery-sunset', PROPOSAL, 30.05, 33.00, 1.0, 464, 25),  # the proposal: about to kiss, at sunset
    ('plan-candles', FILM, 47.90, 52.50, 1.0, 1080, 27),       # the enquiry page: the candlelit table, large
]
FADE = 0.7  # seconds of cross-fade that close each loop


def run(args):
    subprocess.run([FFMPEG, '-nostdin', '-loglevel', 'error', '-y', *args], check=True)


def make(src_dir, name, source, start, end, speed, width, crf):
    src = os.path.join(src_dir, source)
    out = os.path.join(OUT, f'{name}.mp4')
    rate = 'fps=60,' if source == FILM else ''  # one frame of each repeated pair
    base = f'{rate}setpts={1 / speed:.4f}*PTS,fps=30,scale={width}:-2:flags=lanczos,format=yuv420p'
    length = (end - start) / speed
    f = FADE
    graph = (
        f'[0:v]{base},split[a][b];'
        f'[a]trim=start={f}:end={length},setpts=PTS-STARTPTS[main];'
        f'[b]trim=start=0:end={f},setpts=PTS-STARTPTS[head];'
        # xfade hands back 4:4:4, which the x264 high profile refuses
        f'[main][head]xfade=transition=fade:duration={f}:offset={length - 2 * f:.3f},format=yuv420p[v]'
    )
    run(['-ss', f'{start}', '-t', f'{end - start}', '-i', src, '-filter_complex', graph, '-map', '[v]', '-an',
         '-c:v', 'libx264', '-preset', 'slow', '-crf', str(crf), '-profile:v', 'high', '-movflags', '+faststart', out])
    run(['-ss', '0.05', '-i', out, '-frames:v', '1', '-q:v', '2', os.path.join(OUT, f'{name}-poster.jpg')])
    return os.path.getsize(out)


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    os.makedirs(OUT, exist_ok=True)
    total = 0
    for clip in CLIPS:
        size = make(sys.argv[1], *clip)
        total += size
        print(f'{clip[0]:<16} {size / 1e6:5.2f} MB')
    print(f'{"total":<16} {total / 1e6:5.2f} MB')


if __name__ == '__main__':
    main()
