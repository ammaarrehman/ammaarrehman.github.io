#!/usr/bin/env python3
"""brachio: draws the Brachiosaurus frames into assets/island/dinos.png (dev-only).

What makes it read as a Brachiosaurus rather than a generic sauropod:
  * front legs longer than the hind legs, so the back slopes down from high shoulders to the hips
  * a deep chest, and the neck rising steeply from the shoulders, held high
  * a small head with the raised bony arch over the nostrils
  * a thick tail held off the ground (sauropods didn't drag their tails)
Sources: Taylor 2009, "A re-evaluation of Brachiosaurus altithorax" (JVP 29:3); the Natural
History Museum's Brachiosaurus page (nhm.ac.uk/discover/dino-directory/brachiosaurus.html).

Frames match the sheet's slots (84 x 83, feet on the bottom row): walk 0-5, idle 6-9, blink 10,
graze 11-12. Light comes from the top left; one outline in the darkest tone of the skin.

  python3 tools/brachio.py            writes the frames into the sheet
  python3 tools/brachio.py preview    writes tools/out/brachio-preview.png only
Requires: pillow
"""
import json, math, re, sys
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
W, H = 84, 83
# skin, darkest to lightest (a cool dark, warm light), then the belly, the eye and the mouth
SKIN = [(38, 52, 30), (58, 80, 42), (82, 108, 56), (108, 136, 70), (140, 164, 92)]
BELLY = [(150, 150, 104), (178, 174, 126)]
EYE, MOUTH = (18, 20, 14), (44, 52, 30)


def bez(p0, p1, p2, t):
    return ((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0],
            (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1])


class Canvas:
    """a mask of parts: each pixel knows its part, and a 0..1 'height' used for shading"""
    def __init__(self):
        self.part = {}        # (x, y) -> (layer, shade)

    def disc(self, cx, cy, r, layer, shade_fn):
        for y in range(int(cy - r) - 1, int(cy + r) + 2):
            for x in range(int(cx - r) - 1, int(cx + r) + 2):
                if (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r and 0 <= x < W and 0 <= y < H:
                    s = shade_fn(x, y, cx, cy, r)
                    old = self.part.get((x, y))
                    if old is None or old[0] <= layer:
                        self.part[(x, y)] = (layer, s)

    def ellipse(self, cx, cy, rx, ry, rot, layer, belly=False):
        c, s = math.cos(rot), math.sin(rot)
        for y in range(int(cy - max(rx, ry)) - 1, int(cy + max(rx, ry)) + 2):
            for x in range(int(cx - max(rx, ry)) - 1, int(cx + max(rx, ry)) + 2):
                dx, dy = x + 0.5 - cx, y + 0.5 - cy
                u, v = dx * c + dy * s, -dx * s + dy * c
                if (u / rx) ** 2 + (v / ry) ** 2 <= 1 and 0 <= x < W and 0 <= y < H:
                    k = v / ry                                     # -1 at the back, +1 at the belly
                    shade = 0.78 - 0.5 * (k + 1) / 2 - 0.12 * (u / rx)
                    tag = "belly" if belly and k > 0.55 else None
                    old = self.part.get((x, y))
                    if old is None or old[0] <= layer:
                        self.part[(x, y)] = (layer, shade, tag)

    def tube(self, p0, p1, p2, r0, r1, layer, steps=60):
        """a tapered tube along a quadratic curve, shaded round"""
        for i in range(steps + 1):
            t = i / steps
            cx, cy = bez(p0, p1, p2, t)
            r = r0 + (r1 - r0) * t
            self.disc(cx, cy, r, layer, lambda x, y, cx, cy, r: 0.8 - 0.55 * ((y + 0.5 - cy) / r + 1) / 2 - 0.1 * ((x + 0.5 - cx) / r))

    def leg(self, top, foot_x, foot_y, width, layer, lift=0):
        """a pillar leg from the shoulder or hip to the foot, a slight knee, a pad of a foot"""
        tx, ty = top
        kx, ky = (tx + foot_x) / 2 + 1, (ty + foot_y) / 2
        self.tube((tx, ty), (kx, ky), (foot_x, foot_y - 2 - lift), width / 2, width / 2 - 0.6, layer, 40)
        for x in range(int(foot_x - width / 2), int(foot_x + width / 2) + 1):
            if 0 <= x < W:
                y = int(foot_y - lift)
                if 0 <= y < H:
                    self.part[(x, y)] = (layer, 0.18)


def render(pose):
    """pose: dict of offsets. returns an RGBA image"""
    cv = Canvas()
    bob = pose.get("bob", 0)
    sh = (57, 41 + bob)                   # shoulder (high)
    hip = (27, 51 + bob)                  # hip (lower)
    # far legs first (darker, behind the body), then the tail, body, near legs, neck, head
    for (top, fx, lift, w) in pose["far"]:
        cv.leg(top(sh, hip), fx, 82, w, 1, lift)
    tail_tip = (3, 58 + pose.get("tail", 0) + bob)
    cv.tube((hip[0] + 3, hip[1] - 5), (11, 46 + bob), tail_tip, 8.5, 1.4, 2)
    cv.ellipse(40, 49 + bob, 25, 15, -0.2, 3, belly=True)             # a barrel of a body, higher at the chest
    cv.ellipse(53, 45 + bob, 13, 13, 0, 3, belly=True)                # the deep chest
    for (top, fx, lift, w) in pose["near"]:
        cv.leg(top(sh, hip), fx, 82, w, 2, lift)                        # near legs come out from under the body
    nb = (60, 38 + bob)                                                 # neck base
    head = (72 + pose.get("hx", 0), 9 + pose.get("hy", 0) + bob)
    cv.tube(nb, (67 + pose.get("nx", 0), 22 + bob), head, 8.8, 3.4, 4, 80)
    hx, hy = head
    cv.ellipse(hx + 3.5, hy + 0.5, 5.5, 3.2, 0.12 + pose.get("tilt", 0), 6)   # the head, snout forward
    cv.disc(hx + 2.6, hy - 2.8, 2.1, 6, lambda *a: 0.95)                     # the nasal arch

    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    for (x, y), v in cv.part.items():
        layer, shade = v[0], v[1]
        tag = v[2] if len(v) > 2 else None
        far = layer == 1
        s = max(0.0, min(0.999, shade - (0.28 if far else 0)))
        # a little mottling on the back, deterministic
        if not far and tag is None and layer == 3 and ((x * 7 + y * 13) % 17 == 0) and s > 0.4:
            s -= 0.1
        col = BELLY[1 if s > 0.45 else 0] if tag == "belly" and not far else SKIN[1 + int(s * 4) if s < 0.999 else 4]
        px[x, y] = col + (255,)
    # outline: every empty pixel touching the animal takes the darkest skin tone; lighter on the lit side
    solid = {(x, y) for (x, y) in cv.part}
    for y in range(H):
        for x in range(W):
            if (x, y) in solid:
                continue
            n = [(x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)]
            if any(q in solid for q in n):
                lit = (x + 1, y) in solid or (x, y + 1) in solid
                px[x, y] = (SKIN[0] if not lit else (48, 64, 36)) + (255,)
    # eye and mouth
    ex, ey = int(hx + 3), int(hy - 1)
    if pose.get("blink"):
        px[ex, ey] = SKIN[1] + (255,); px[ex + 1, ey] = SKIN[1] + (255,)
    else:
        px[ex, ey] = EYE + (255,); px[ex, ey - 1] = (230, 226, 200, 255)
    for i in range(4):
        mx, my = int(hx + 5 + i), int(hy + 2 + pose.get("jaw", 0) * (i > 1))
        if 0 <= mx < W and 0 <= my < H:
            px[mx, my] = MOUTH + (255,)
    return img


# legs hang from the shoulder (front) and hip (back); foot x is where the foot is planted
def F(dx=0):
    return lambda sh, hip: (sh[0] - 2 + dx, sh[1] + 4)


def B(dx=0):
    return lambda sh, hip: (hip[0] + 2 + dx, hip[1] + 2)


def walk(i):
    # a slow walk: each foot swings forward (lifted) for 2 of 6 frames, the diagonal pairs offset
    ph = [0, 1, 2, 3, 4, 5]
    def foot(base, phase):
        p = (i + phase) % 6
        swing = [-4, -1.5, 1.5, 4, 2, -2][p]
        lift = [0, 0, 0, 0, 3, 3][p]
        return base + swing, lift
    fnx, fnl = foot(58, 0); ffx, ffl = foot(54, 3)
    bnx, bnl = foot(28, 3); bfx, bfl = foot(24, 0)
    return {
        "bob": [0, 0, 1, 0, 0, 1][i],
        "near": [(B(), bnx, bnl, 11), (F(), fnx, fnl, 10)],
        "far": [(B(-3), bfx, bfl, 9), (F(-3), ffx, ffl, 8)],
        "tail": [0, 1, 1, 0, -1, -1][i], "nx": [0, 0, 1, 1, 0, 0][i], "hx": [0, 0, 1, 1, 0, 0][i],
    }


def still(extra=None):
    p = {"near": [(B(), 28, 0, 11), (F(), 58, 0, 10)], "far": [(B(-3), 24, 0, 9), (F(-3), 54, 0, 8)]}
    p.update(extra or {})
    return p


FRAMES = [walk(i) for i in range(6)] + [
    still({"hy": 0}), still({"hy": 1, "tail": 1}), still({"hy": 1, "hx": 1, "tail": 1}), still({"hy": 0, "tail": 0}),   # idle: the neck breathes
    still({"blink": True}),                                                                                           # blink
    still({"hx": 2, "hy": -1, "nx": 2, "tilt": 0.35, "jaw": 1}), still({"hx": 2, "hy": -1, "nx": 2, "tilt": 0.35}),     # graze: reaching up to browse
]


def main():
    world = (ROOT / "js/world.js").read_text()
    sheet = json.loads(re.search(r"var SHEET = (\{.*?\});\n", world).group(1))
    b = sheet["brachio"]
    assert (b["w"], b["h"]) == (W, H) and len(b["f"]) == len(FRAMES)
    frames = [render(p) for p in FRAMES]
    out_dir = ROOT / "tools/out"; out_dir.mkdir(exist_ok=True)
    prev = Image.new("RGBA", (W * 7 * 3, H * 2 * 3), (200, 214, 196, 255))
    for i, f in enumerate(frames):
        big = f.resize((W * 3, H * 3), Image.NEAREST)
        prev.paste(big, ((i % 7) * W * 3, (i // 7) * H * 3), big)
    prev.save(out_dir / "brachio-preview.png")
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        return
    sh = Image.open(ROOT / "assets/island/dinos.png").convert("RGBA")
    for (x, y), f in zip(b["f"], frames):
        sh.paste((0, 0, 0, 0), (x, y, x + W, y + H))
        sh.paste(f, (x, y))
    sh.save(ROOT / "assets/island/dinos.png", optimize=True)
    print("wrote", len(frames), "brachiosaurus frames")


if __name__ == "__main__":
    main()
