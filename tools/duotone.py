#!/usr/bin/env python3
"""Green-vision duotone — film-print treatment for photos
(Fallen Angels / Blue Spring poster palette).

Maps grayscale through a 3-stop ramp:
shadows #0b120d -> mids #41604c -> highlights #dfe3cf

Usage:  python3 tools/duotone.py input.jpg [output.jpg] [maxpx]
Requires: pillow  (pillow-heif if the input is HEIC)
"""
import sys
from PIL import Image, ImageOps

SHADOW = (11, 18, 13)
MID = (65, 96, 76)
HILITE = (223, 227, 207)


def ramp(v):
    if v < 128:
        t = v / 128
        return tuple(int(SHADOW[i] + (MID[i] - SHADOW[i]) * t) for i in range(3))
    t = (v - 128) / 127
    return tuple(int(MID[i] + (HILITE[i] - MID[i]) * t) for i in range(3))


def duotone(src, dst="assets/headshot.jpg", maxpx=720):
    try:
        from pillow_heif import register_heif_opener
        register_heif_opener()
    except ImportError:
        pass
    im = Image.open(src)
    im = ImageOps.exif_transpose(im).convert("L")
    im = ImageOps.autocontrast(im, cutoff=1)
    w, h = im.size
    s = maxpx / max(w, h)
    if s < 1:
        im = im.resize((int(w * s), int(h * s)), Image.LANCZOS)
    lut = [ramp(v) for v in range(256)]
    out = Image.new("RGB", im.size)
    out.putdata([lut[v] for v in im.getdata()])
    out.save(dst, quality=88)
    print("wrote", dst, out.size)


if __name__ == "__main__":
    a = sys.argv[1:]
    duotone(a[0], a[1] if len(a) > 1 else "assets/headshot.jpg",
            int(a[2]) if len(a) > 2 else 720)
