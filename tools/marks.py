#!/usr/bin/env python3
"""ammaarrehman.github.io — brand toolchain.

Generates the ASCII assets for the portfolio:
  * ansi_shadow wordmark (AMMAAR / REHMAN) as tagged HTML for index.html
  * crescent moon mark (NIGHTFALL cross-brand) as colored HTML spans
  * pi pixel favicon (assets/favicon.png)

Same technique as the NIGHTFALL company site (nightstarlabs/nightstar-labs-site):
draw shape -> downsample to a 2:1 char grid -> brightness ramp " .:;t%S8X@"
-> greys by brightness, ~7% seeded accent glyphs. The ASCII carries the color;
the UI stays monochrome.

Usage:  python3 tools/marks.py            (prints HTML snippets)
        python3 tools/marks.py favicon    (writes assets/favicon.png)
Requires: pillow, pyfiglet
"""
import random
import sys

RAMP = " .:;t%S8X@"
GREYS = ["#3a3a3a", "#5c5c5c", "#7e7e7e", "#9e9e9e",
         "#bcbcbc", "#d8d8d8", "#efefef", "#ffffff"]
ACCENTS = ["#FF5252", "#4ADE80", "#5B8DEF", "#FFA94D", "#4DD6E8", "#E879F9"]
SHADOW = "╔╗╚╝═║"


def wordmark(text: str, seed: int = 7, accent_rate: float = 0.035) -> str:
    """pyfiglet ansi_shadow -> <b>/<i>/accent-span tagged HTML."""
    import pyfiglet
    rng = random.Random(seed)
    art = pyfiglet.Figlet(font="ansi_shadow").renderText(text)
    out = []
    for line in art.rstrip("\n").split("\n"):
        if not line.strip():
            continue
        row = []
        for ch in line.rstrip():
            if ch == "█":
                if rng.random() < accent_rate:
                    row.append('<span style="color:%s">█</span>' % rng.choice(ACCENTS))
                else:
                    row.append("<b>█</b>")
            elif ch in SHADOW:
                row.append("<i>%s</i>" % ch)
            else:
                row.append(ch)
        out.append("".join(row))
    return "\n".join(out)


def crescent_grid(cols: int = 34):
    """Crescent moon, downsampled to a brightness grid."""
    from PIL import Image, ImageDraw
    size = 440
    img = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(img)
    d.ellipse([60, 40, 380, 360], fill=255)
    d.ellipse([150, 20, 470, 340], fill=0)  # cutout -> crescent
    img = img.crop((30, 30, 410, 410))
    rows = cols // 2
    g = img.resize((cols, rows)).convert("L")
    px = g.load()
    return [[px[x, y] / 255 for x in range(cols)] for y in range(rows)]


def grid_to_html(grid, seed: int = 11, accent_rate: float = 0.07) -> str:
    """Brightness grid -> colored <span> glyphs (the shark treatment)."""
    rng = random.Random(seed)
    out = []
    for row in grid:
        line = []
        for v in row:
            if v < 0.06:
                line.append(" ")
                continue
            ch = RAMP[int(v * 9)]
            color = (rng.choice(ACCENTS) if rng.random() < accent_rate
                     else GREYS[min(int(v * 8), 7)])
            line.append('<span style="color:%s">%s</span>' % (color, ch))
        out.append("".join(line).rstrip())
    return "\n".join(out)


def favicon(path: str = "assets/favicon.png", px: int = 64):
    """pi, the resident critter, as the site favicon."""
    from PIL import Image
    SPRITE = ["....W.....", "..WWWWWW..", ".WWWWWWWW.", ".WWKWWKWW.",
              ".WWWWWWWW.", ".WWWWWWWW.", "..GWWWWG..", "..WW..WW..",
              "..WW..WW..", "..GG..GG.."]
    C = {"W": (239, 239, 239), "G": (158, 158, 158), "K": (10, 10, 10)}
    img = Image.new("RGB", (12, 12), (10, 10, 10))
    for y, row in enumerate(SPRITE):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x + 1, y + 1), C[ch])
    img.resize((px, px), Image.NEAREST).save(path)
    print("wrote", path)


if __name__ == "__main__":
    if "favicon" in sys.argv:
        favicon()
    else:
        print("<!-- AMMAAR -->")
        print(wordmark("AMMAAR", seed=7))
        print("<!-- REHMAN -->")
        print(wordmark("REHMAN", seed=13))
        print("<!-- crescent -->")
        print(grid_to_html(crescent_grid()))
