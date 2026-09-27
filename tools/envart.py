#!/usr/bin/env python3
"""envart: the island's environment sprites, baked into img/atlas/env.png + img/atlas/env.json
(dev-only; handoff 3 D1 and D2). Seeded, so a rebuild gives the same pixels.

What it draws, all lit from the top left, outlined in each material's own darkest tone, from the
master palette in art/palette.json:
  trees      broadleaf (canopy built from clustered blobs), birch, monkey-puzzle conifer, ginkgo;
             two or three variants each
  cretaceous tree ferns (tfern), cycads, horsetails, a magnolia shrub (flowering plants did exist then)
  shrubs     a round bush, a fern clump, the magnolia
  rocks      5 variants in each of 3 sizes: faceted, cracked, moss on top, grass at the base
  water      reeds and lily pads, in clusters
The shadows aren't baked in: the game draws one soft cool ellipse per size under each sprite.

  python3 tools/envart.py            writes the atlas
  python3 tools/envart.py preview    writes tools/out/envart-preview.png only
Requires: pillow, numpy
"""
import json, math, random, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
PAL = json.load(open(ROOT / "art/palette.json"))
def rgb(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
R = {k: [rgb(c) for c in v] for k, v in PAL.items() if isinstance(v, list)}
L = np.array([-0.6, -0.75, 0.6]); L = L / np.linalg.norm(L)
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


class Sprite:
    """an RGBA canvas plus a material map, so outlines can use each material's own dark"""
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), np.uint8)
        self.mat = np.full((h, w), "", dtype=object)

    def put(self, x, y, col, mat):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y, x] = (*col, 255); self.mat[y, x] = mat

    def outline(self, skip=()):
        """every empty pixel next to the sprite takes the neighbour's material dark; on the lit
        side (above or left of the shape) one tone lighter"""
        a = self.px[..., 3] > 0
        out = []
        for y in range(self.h):
            for x in range(self.w):
                if a[y, x]: continue
                for dx, dy, lit in ((1, 0, True), (0, 1, True), (-1, 0, False), (0, -1, False)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.w and 0 <= ny < self.h and a[ny, nx]:
                        m = self.mat[ny, nx]
                        if m in skip or m not in R: break
                        out.append((x, y, R[m][1] if lit else R[m][0], m)); break
        for x, y, c, m in out: self.put(x, y, c, m)

    def image(self): return Image.fromarray(self.px)


def tone(ramp, v, x, y, spread=0.45):
    """a 0..1 light value to a ramp colour, ordered-dithered across the band edges"""
    n = len(ramp)
    q = v * (n - 1) + (BAYER[y % 4, x % 4] - 0.5) * spread
    return ramp[int(max(0, min(n - 1, round(q))))]


def blob(sp, cx, cy, r, mat, ramp, glob=None, rng=None, jag=0.0, lift=0.0):
    """a shaded sphere-ish clump. glob(x, y) adds the whole shape's light, so clumps on the lit
    side of a canopy come out lighter; jag roughens the edge like leaves"""
    seeds = [rng.random() * 6.28 for _ in range(3)] if rng else [0, 0, 0]
    for y in range(int(cy - r - 2), int(cy + r + 2)):
        for x in range(int(cx - r - 2), int(cx + r + 2)):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            a = math.atan2(dy, dx)
            rr = r * (1 + jag * (0.5 * math.sin(5 * a + seeds[0]) + 0.3 * math.sin(9 * a + seeds[1]) + 0.2 * math.sin(13 * a + seeds[2])))
            d = math.hypot(dx, dy)
            if d > rr: continue
            nx, ny = dx / rr, dy / rr
            nz = math.sqrt(max(0.0, 1 - nx * nx - ny * ny))
            lam = max(0.0, nx * L[0] + ny * L[1] + nz * L[2])
            v = 0.15 + 0.85 * lam
            if glob: v = 0.6 * v + 0.4 * glob(x, y)
            v = max(0.0, min(1.0, v + lift))
            sp.put(x, y, tone(ramp, v, x, y), mat)


def trunk(sp, x0, ytop, ybot, w0, w1, ramp, mat="wood", marks=None, flare=2):
    for y in range(ytop, ybot + 1):
        u = (y - ytop) / max(1, ybot - ytop)
        w = w0 + (w1 - w0) * u + (flare * max(0, u - 0.8) / 0.2 if flare else 0)
        for x in range(int(round(x0 - w / 2)), int(round(x0 + w / 2)) + 1):
            k = (x - (x0 - w / 2)) / max(1, w)                # 0 at the lit left edge, 1 at the right
            v = 0.85 - 0.75 * k + (0.05 if (y * 7 + x * 3) % 5 == 0 else 0)
            col = tone(ramp, v, x, y, 0.3)
            if marks and marks(x, y): col = ramp[0] if k > 0.3 else ramp[1]
            sp.put(x, y, col, mat)


def canopy(sp, cx, cy, w, h, ramp, rng, n=16, rmin=3.5, rmax=6.5, mat="leaf", jag=0.12):
    """ref-5's method: a rounded mass built from overlapping clumps; the clumps toward the
    lower right go down first and darker, the lit upper-left ones sit on top"""
    def glob(x, y):
        u, v = (x - cx) / (w / 2), (y - cy) / (h / 2)
        return max(0.0, min(1.0, 0.62 - 0.38 * (u * 0.6 + v * 0.8)))
    pts = []
    for i in range(n):
        for _ in range(20):
            u, v = rng.uniform(-1, 1), rng.uniform(-1, 1)
            if u * u + v * v <= 1: break
        r = rng.uniform(rmin, rmax)
        pts.append((cx + u * (w / 2 - r * 0.6), cy + v * (h / 2 - r * 0.6), r))
    pts.sort(key=lambda p: -(p[0] - cx) * 0.6 - (p[1] - cy) * 0.8)
    for (x, y, r) in pts:
        blob(sp, x, y, r, mat, ramp, glob, rng, jag)


def broadleaf(seed):
    rng = random.Random(seed); sp = Sprite(34, 42)
    trunk(sp, 17, 24, 40, 3, 5, R["wood"], flare=3)
    canopy(sp, 17, 15, 30, 25, R["leaf"], rng, n=18)
    sp.outline(); return sp, (17, 40)


def birch(seed):
    rng = random.Random(seed); sp = Sprite(26, 46)
    marks = lambda x, y: (y * 13 + x * 5 + seed) % 11 == 0 or ((y + seed) % 7 == 0 and x % 3 == 0)
    trunk(sp, 13, 12, 44, 2, 3, R["birch"], mat="birch", marks=marks, flare=1)
    for i in range(3):
        canopy(sp, 13 + rng.uniform(-3, 3), 9 + i * 8, 18 - i * 2, 12, R["leaf2"], rng, n=7, rmin=3, rmax=5, mat="leaf2")
    sp.outline(); return sp, (13, 44)


def conifer(seed):
    """a monkey-puzzle: a tall bare trunk and tiers of drooping branch clumps"""
    rng = random.Random(seed); sp = Sprite(28, 50)
    trunk(sp, 14, 6, 48, 2, 3, R["wood"], flare=2)
    for i in range(6):
        y = 8 + i * 6; hw = 4 + i * 1.8
        for side in (-1, 1):
            for j in range(3):
                bx = 14 + side * (hw * (0.4 + j * 0.3)); by = y + j * 1.2
                blob(sp, bx, by, 2.6 - j * 0.3, "leaf", R["leaf"], lambda x, y2, i=i: 0.75 - i * 0.08, rng, 0.2, lift=-0.05)
    blob(sp, 14, 5, 3, "leaf", R["leaf"], lambda x, y: 0.8, rng, 0.2)
    sp.outline(); return sp, (14, 48)


def ginkgo(seed):
    rng = random.Random(seed); sp = Sprite(30, 40)
    trunk(sp, 15, 20, 38, 2, 4, R["wood"], flare=2)
    canopy(sp, 15, 14, 26, 22, R["ginkgo"], rng, n=14, rmin=3, rmax=5.5, mat="ginkgo", jag=0.2)
    sp.outline(); return sp, (15, 38)


def frond(sp, x0, y0, ang, length, droop, ramp, mat, leaflets=True):
    pts = []
    for i in range(int(length)):
        u = i / length
        a = ang + droop * u * u
        pts.append((x0 + math.cos(a) * i, y0 + math.sin(a) * i, a))
    for i, (x, y, a) in enumerate(pts):
        u = i / len(pts)
        sp.put(int(round(x)), int(round(y)), tone(ramp, 0.75 - 0.4 * u, int(x), int(y)), mat)
        if leaflets and i % 2 == 0 and u > 0.15:
            ln = max(1, int(3.2 * (1 - u) + 1))
            for s in (-1, 1):
                for k in range(1, ln + 1):
                    lx, ly = x + math.cos(a + s * 1.2) * k, y + math.sin(a + s * 1.2) * k + k * 0.3
                    sp.put(int(round(lx)), int(round(ly)), tone(ramp, (0.9 if s < 0 else 0.45) - 0.3 * u, int(lx), int(ly)), mat)


def treefern(seed):
    rng = random.Random(seed); sp = Sprite(34, 34)
    trunk(sp, 17, 12, 32, 3, 4, R["wood"], marks=lambda x, y: (y % 3 == 0 and x % 2 == 0), flare=1)
    for i in range(9):
        a = -math.pi / 2 + (i - 4) * 0.42 + rng.uniform(-0.1, 0.1)
        frond(sp, 17, 12, a, 13 + rng.uniform(-2, 2), 0.9 * (1 if a > -math.pi / 2 else -1), R["leaf"], "leaf")
    sp.outline(); return sp, (17, 32)


def cycad(seed):
    rng = random.Random(seed); sp = Sprite(24, 22)
    for y in range(12, 21):                                   # a stout trunk with a diamond pattern
        for x in range(9, 15):
            k = (x - 9) / 6
            col = R["wood"][1] if (x + y) % 3 == 0 else tone(R["wood"], 0.85 - 0.7 * k, x, y)
            sp.put(x, y, col, "wood")
    for i in range(7):
        a = -math.pi / 2 + (i - 3) * 0.48
        frond(sp, 12, 12, a, 9 + rng.uniform(-1, 1), 0.5 * (1 if a > -math.pi / 2 else -1), R["leaf2"], "leaf2")
    sp.outline(); return sp, (12, 20)


def horsetail(seed):
    rng = random.Random(seed); sp = Sprite(14, 18)
    for s in range(5):
        x = 3 + s * 2 + rng.randint(-1, 1); top = 3 + rng.randint(0, 5)
        for y in range(top, 17):
            sp.put(x, y, R["leaf2"][3 if (y - top) % 4 else 1], "leaf2")
            if (y - top) % 4 == 0 and y > top + 1:
                sp.put(x - 1, y + 1, R["leaf2"][2], "leaf2"); sp.put(x + 1, y + 1, R["leaf2"][1], "leaf2")
        sp.put(x, top - 1, R["dirt"][2], "dirt")               # a little cone at the tip
    sp.outline(); return sp, (7, 17)


def magnolia(seed):
    rng = random.Random(seed); sp = Sprite(22, 16)
    canopy(sp, 11, 9, 20, 13, R["leaf"], rng, n=8, rmin=2.5, rmax=4)
    for i in range(6):                                          # blossoms, white-pink, on the lit side
        x, y = int(4 + rng.random() * 14), int(3 + rng.random() * 8)
        if sp.px[y, x, 3]:
            sp.put(x, y, R["blossom"][1], "blossom"); sp.put(x + 1, y, R["blossom"][0], "blossom"); sp.put(x, y + 1, R["blossom"][0], "blossom")
    sp.outline(skip=("blossom",)); return sp, (11, 15)


def bush(seed):
    rng = random.Random(seed); sp = Sprite(18, 14)
    canopy(sp, 9, 8, 16, 11, R["leaf"], rng, n=7, rmin=2.5, rmax=4)
    sp.outline(); return sp, (9, 13)


def fernclump(seed):
    rng = random.Random(seed); sp = Sprite(20, 14)
    for i in range(7):
        a = -math.pi / 2 + (i - 3) * 0.45
        frond(sp, 10, 13, a, 9 + rng.uniform(-1, 1), 0.8 * (1 if a > -math.pi / 2 else -1), R["leaf2"], "leaf2")
    sp.outline(); return sp, (10, 13)


def rock(size, seed):
    """ref-3's boulders: faceted planes lit from the top left, a lit top, cracks, moss over the top
    and a few grass tufts at the foot"""
    rng = random.Random(seed * 31 + size)
    W, H = [(12, 9), (18, 13), (26, 19)][size]
    sp = Sprite(W + 2, H + 3)
    lobes = [(W / 2 + rng.uniform(-1.5, 1.5), H * 0.55, W * 0.42, H * 0.5)]
    for _ in range(1 + size):
        lobes.append((W / 2 + rng.uniform(-W * 0.3, W * 0.3), H * rng.uniform(0.45, 0.7), W * rng.uniform(0.2, 0.32), H * rng.uniform(0.3, 0.45)))
    base = H
    facets = rng.choice([4, 5, 6])
    for y in range(H + 1):
        for x in range(W + 1):
            best = None
            for (cx, cy, rx, ry) in lobes:
                u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                d = u * u + v * v
                if d <= 1 and (best is None or d < best[0]): best = (d, u, v)
            if best is None or y > base: continue
            d, u, v = best
            ang = math.atan2(v, u)
            ang = round(ang / (math.pi / facets)) * (math.pi / facets)          # chunky planes
            rr = math.sqrt(d)
            nx, ny = math.cos(ang) * rr, math.sin(ang) * rr
            nz = math.sqrt(max(0, 1 - nx * nx - ny * ny))
            lam = max(0.0, nx * L[0] + ny * L[1] + nz * L[2])
            val = 0.12 + 0.88 * lam - 0.25 * max(0, (y - H * 0.7) / (H * 0.3))
            col = tone(R["rock"], min(1, val), x + 1, y, 0.15)                   # clean planes, little dither
            mat = "rock"
            cap = -0.42 + 0.22 * math.sin(x * 0.9 + seed * 1.7) + 0.12 * math.sin(x * 2.3 + seed)
            if ny < cap:                                                         # a moss cap with a wavy edge
                col = tone(R["moss"], 0.35 + 0.65 * lam, x + 1, y, 0.2); mat = "moss"
            sp.put(x + 1, y, col, mat)
    for _ in range(size + 1):                                                   # moss drips over the cap's edge
        x = rng.randint(2, W - 1)
        for y in range(H):
            if sp.mat[y, x] == "moss" and y + 1 < sp.h and sp.mat[y + 1, x] == "rock":
                for k in range(1, 2 + rng.randint(0, 1)):
                    if y + k < sp.h and sp.mat[y + k, x] == "rock": sp.put(x, y + k, R["moss"][1], "moss")
                break
    for _ in range(1 + size):                                                   # cracks
        x, y = rng.uniform(W * 0.3, W * 0.7), rng.uniform(H * 0.3, H * 0.6)
        for i in range(3 + size * 2):
            xi, yi = int(x) + 1, int(y)
            if 0 <= yi < sp.h and 0 <= xi < sp.w and sp.mat[yi, xi] == "rock": sp.put(xi, yi, R["rock"][1], "rock")
            x += rng.uniform(-0.8, 0.8); y += 0.9
    sp.outline(skip=("moss",))
    for _ in range(2 + size):                                                   # grass at the foot
        x = rng.randint(1, W)
        for k, (dx, dy) in enumerate([(0, 0), (-1, -1), (1, -1), (0, -2)][:2 + size % 2]):
            if 0 <= base + 1 + dy < sp.h: sp.put(x + dx, base + 1 + dy, R["grass"][4 - k % 2], "grass")
    return sp, (sp.w // 2, base + 1)


def reeds(seed):
    rng = random.Random(seed); sp = Sprite(12, 16)
    for s in range(6):
        x = 1 + s * 2 + rng.randint(0, 1); top = 2 + rng.randint(0, 6); lean = rng.choice([-1, 0, 1])
        for y in range(top, 15):
            sp.put(x + (lean if y < top + 3 else 0), y, R["leaf2"][2 if s % 2 else 3], "leaf2")
        if s % 2 == 0: sp.put(x, top - 1, R["wood"][2], "wood"); sp.put(x, top - 2, R["wood"][3], "wood")
    sp.outline(); return sp, (6, 15)


def lilies(seed):
    rng = random.Random(seed); sp = Sprite(16, 10)
    for i in range(3):
        cx, cy, r = rng.uniform(4, 12), rng.uniform(3, 7), rng.uniform(2, 3)
        for y in range(int(cy - r), int(cy + r) + 1):
            for x in range(int(cx - r - 1), int(cx + r) + 2):
                u, v = (x + 0.5 - cx) / (r * 1.3), (y + 0.5 - cy) / r
                if u * u + v * v <= 1 and not (abs(math.atan2(v, u) - 0.4) < 0.35):            # the notch
                    sp.put(x, y, tone(R["leaf2"], 0.9 - 0.5 * (u + v + 1) / 2, x, y), "leaf2")
        if i == 0: sp.put(int(cx), int(cy) - 1, R["blossom"][1], "blossom"); sp.put(int(cx) + 1, int(cy) - 1, R["flower"][1], "blossom")
    sp.outline(skip=("blossom",)); return sp, (8, 9)


def rockblob(sp, cx, cy, rx, ry, rng, moss=True):
    """one boulder in a pile: faceted, lit from the top left, a moss cap"""
    facets = rng.choice([4, 5, 6])
    for y in range(int(cy - ry) - 1, int(cy + ry) + 2):
        for x in range(int(cx - rx) - 1, int(cx + rx) + 2):
            u, v = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
            d = u * u + v * v
            if d > 1: continue
            ang = round(math.atan2(v, u) / (math.pi / facets)) * (math.pi / facets)
            rr = math.sqrt(d); nx, ny = math.cos(ang) * rr, math.sin(ang) * rr
            nz = math.sqrt(max(0, 1 - nx * nx - ny * ny))
            lam = max(0.0, nx * L[0] + ny * L[1] + nz * L[2])
            if moss and ny < -0.5 + 0.2 * math.sin(x * 0.9 + cx):
                sp.put(x, y, tone(R["moss"], 0.35 + 0.65 * lam, x, y, 0.2), "moss")
            else:
                sp.put(x, y, tone(R["rock"], min(1, 0.12 + 0.88 * lam), x, y, 0.15), "rock")


def cavemouth(seed):
    """ref-6's cave: a hillside of stacked boulders around a dark opening, grass hanging over the
    lip, the floor running in. the terminal's glow is drawn by the game, inside the opening"""
    rng = random.Random(seed); W, H = 60, 46; sp = Sprite(W, H)
    # the hill behind: big boulders, back to front
    piles = [(12, 26, 11, 9), (48, 26, 11, 9), (18, 14, 10, 8), (42, 14, 10, 8), (30, 9, 12, 8), (8, 36, 8, 7), (52, 36, 8, 7), (22, 32, 7, 7), (38, 32, 7, 7)]
    for (cx, cy, rx, ry) in piles: rockblob(sp, cx, cy, rx, ry, rng)
    # grass over the top of the hill, hanging in tufts
    for x in range(8, 53):
        top = next((y for y in range(H) if sp.px[y, x, 3]), None)
        if top is None: continue
        hang = 2 + int(abs(math.sin(x * 0.7 + seed)) * 3) + (3 if (x * 7 + seed) % 11 == 0 else 0)
        for k in range(-1, hang):
            if 0 <= top + k < H: sp.put(x, top + k, R["grass"][5 if k < 0 else 4 if k < hang - 1 else 2], "grass")
    # the opening: an arch, dark and going darker inward, with a lit rim of rock around it
    ox, oy, orx, ory = 30, 34, 10, 13
    for y in range(oy - ory, H):
        for x in range(ox - orx - 1, ox + orx + 2):
            u, v = (x + 0.5 - ox) / orx, (y + 0.5 - oy) / ory
            inside = (u * u + v * v <= 1) if y < oy else abs(u) <= 1 - (y - oy) * 0.01
            if not inside: continue
            depth = 1 - min(1, abs(u) * 0.8 + max(0, (oy - y) / ory) * 0.3)
            c = (int(22 - 14 * depth), int(18 - 12 * depth), int(30 - 16 * depth))
            sp.put(x, y, c, "void")
    for x in range(ox - orx, ox + orx + 1):                      # a lip of lit rock over the arch
        for y in range(oy - ory - 2, oy + 2):
            if sp.mat[y, x] == "rock" and 0 <= y + 1 < H and sp.mat[y + 1, x] == "void":
                sp.put(x, y, R["rock"][4], "rock"); break
    for y in range(H - 6, H):                                     # the floor running in, packed dirt
        for x in range(ox - orx + 2, ox + orx - 1):
            if sp.mat[y, x] == "void" and (y - (H - 6)) > abs(x - ox) * 0.4:
                sp.put(x, y, tone(R["dirt"], 0.25 + (y - (H - 6)) * 0.08, x, y, 0.2), "dirt")
    sp.outline(skip=("void", "grass", "moss", "dirt")); return sp, (30, H - 1)


def baretree(seed):
    """a dead, branching tree by the cave: no leaves, wood lit on the left"""
    rng = random.Random(seed); sp = Sprite(30, 36)
    def branch(x, y, ang, length, w, depth):
        for i in range(int(length)):
            px, py = x + math.cos(ang) * i, y + math.sin(ang) * i
            for k in range(-int(w // 2), int(w // 2) + 1):
                qx = int(round(px + k * math.cos(ang + math.pi / 2)))
                sp.put(qx, int(round(py)), R["wood"][3 if k < 0 else 2 if k == 0 else 1], "wood")
        ex, ey = x + math.cos(ang) * length, y + math.sin(ang) * length
        if depth > 0:
            for s in (-1, 1):
                if rng.random() < 0.9: branch(ex, ey, ang + s * rng.uniform(0.35, 0.7), length * rng.uniform(0.55, 0.75), max(1, w - 1), depth - 1)
    branch(15, 35, -math.pi / 2, 12, 3, 4)
    sp.outline(); return sp, (15, 35)


def all_sprites():
    s = {}
    for i in range(3): s["oak%d" % i] = broadleaf(10 + i)
    for i in range(2): s["birch%d" % i] = birch(20 + i)
    for i in range(2): s["pine%d" % i] = conifer(30 + i)
    for i in range(2): s["ginkgo%d" % i] = ginkgo(40 + i)
    for i in range(2): s["tfern%d" % i] = treefern(50 + i)
    for i in range(2): s["cycad%d" % i] = cycad(60 + i)
    s["horsetail0"] = horsetail(70)
    s["magnolia0"] = magnolia(80)
    for i in range(2): s["bush%d" % i] = bush(90 + i)
    for i in range(2): s["fern%d" % i] = fernclump(100 + i)
    for size in range(3):
        for v in range(5): s["rock%d_%d" % (size, v)] = rock(size, v)
    for i in range(3): s["reeds%d" % i] = reeds(120 + i)
    for i in range(3): s["lilies%d" % i] = lilies(130 + i)
    s["cavemouth"] = cavemouth(140)
    for i in range(2): s["baretree%d" % i] = baretree(150 + i)
    return s


def main():
    sprites = all_sprites()
    # shelf-pack them into one atlas
    items = sorted(sprites.items(), key=lambda kv: -kv[1][0].h)
    W, x, y, rowh, pos = 320, 0, 0, 0, {}
    for name, (sp, anchor) in items:
        if x + sp.w > W: x, y, rowh = 0, y + rowh + 1, 0
        pos[name] = (x, y); x += sp.w + 1; rowh = max(rowh, sp.h)
    H = y + rowh
    atlas = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    table = {}
    for name, (sp, anchor) in items:
        px, py = pos[name]
        atlas.paste(sp.image(), (px, py))
        table[name] = [px, py, sp.w, sp.h, anchor[0], anchor[1]]
    out = ROOT / "tools/out"; out.mkdir(exist_ok=True)
    prev = Image.new("RGBA", (W, H), (120, 170, 96, 255)); prev.alpha_composite(atlas)
    prev.resize((W * 4, H * 4), Image.NEAREST).save(out / "envart-preview.png")
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        print("preview", atlas.size); return
    (ROOT / "img/atlas").mkdir(parents=True, exist_ok=True)
    atlas.save(ROOT / "img/atlas/env.png", optimize=True)
    json.dump(table, open(ROOT / "img/atlas/env.json", "w"), separators=(",", ":"))
    # and the frame table inline in world.js, so the island can plan with sizes before the image loads
    import re
    world = (ROOT / "js/world.js").read_text()
    line = "var ENV = " + json.dumps(table, separators=(",", ":")) + ";\n"
    world, n = re.subn(r"var ENV = \{.*?\};\n", line, world, count=1)
    if n: (ROOT / "js/world.js").write_text(world)
    else: print("note: no `var ENV = {...};` line in js/world.js to update")
    print("atlas", atlas.size, len(table), "sprites")


if __name__ == "__main__":
    main()
