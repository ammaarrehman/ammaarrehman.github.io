#!/usr/bin/env python3
"""animate: bakes the island's creature sheet (assets/island/dinos.png) and its frame table (the
`var SHEET = {...};` line in js/world.js) from the hand-drawn source frames in art/src/ (dev-only).

Why: the creatures had 4 idle frames at 2.5 fps and a 6-frame walk, so they read as static. This
keeps the hand-drawn art and animates it cut-out style, the way 2D games rig sprites:
  * each species' legs, tail and head/neck are marked on its idle frame (SPEC below)
  * legs swing by horizontal shear about the hip, lifting on the forward swing; the far legs are
    the near ones repeated a tone darker and cooler, behind the body, half a cycle apart
    (quadrupeds walk in the lateral sequence: hind, front, other hind, other front)
  * the tail and head sway by vertical shear about their roots; the body bobs twice a stride
Shear moves whole rows or columns, so the pixel runs stay clean where a rotation would jag them.

Cycles: walk 12, idle 12 (breathing), graze 8 and call 6 where the species has them, blink 1.
The Brachiosaurus comes from its own rig (tools/brachio.py). The pterosaur is kept as drawn.
The raptors become feathered Utahraptors (small dromaeosaurs were feathered): wing feathers on
the arms, a feathered tail fan and a small crest, added here so the source stays untouched.

  python3 tools/animate.py            writes the sheet and the SHEET line
  python3 tools/animate.py preview    writes tools/out/animate-preview.png only
Requires: pillow, numpy
"""
import json, math, re, sys
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = Image.open(ROOT / "art/src/dinos-src.png").convert("RGBA")
IDX = json.load(open(ROOT / "art/src/dinos-src.json"))
PAD = 3                                   # room for feet and tails that swing past the old frame

# legs: (x0, x1, ytop, pivot_x, pivot_y); the pixels in x0..x1 below ytop are the leg.
# tail: (x_max, pivot_x, pivot_y); head: (x_min, y_max, pivot_x, pivot_y). "quad" or "biped".
SPEC = {
    "trex":   {"plan": "biped", "legs": [(22, 37, 29, 29, 25)], "tail": (16, 18, 18), "head": (58, 22, 58, 14), "stride": 0.34, "bob": 1},
    "spino":  {"plan": "biped", "legs": [(23, 37, 35, 30, 31)], "tail": (18, 20, 27), "head": (62, 30, 62, 24), "stride": 0.30, "bob": 1},
    "stego":  {"plan": "quad", "legs": [(15, 27, 31, 21, 27), (33, 44, 31, 38, 27)], "tail": (10, 12, 22), "head": (47, 30, 47, 24), "stride": 0.28, "bob": 0},
    "trike":  {"plan": "quad", "legs": [(10, 24, 29, 17, 24), (30, 44, 28, 37, 24)], "tail": (9, 10, 22), "head": (38, 26, 38, 18), "stride": 0.28, "bob": 0},
    "para":   {"plan": "quad", "legs": [(13, 25, 28, 19, 24), (32, 41, 28, 37, 24)], "tail": (10, 11, 18), "head": (41, 22, 41, 17), "stride": 0.30, "bob": 1},
    "ankylo": {"plan": "quad", "legs": [(10, 21, 17, 15, 14), (27, 37, 17, 32, 14)], "tail": (9, 10, 11), "head": (38, 18, 39, 11), "stride": 0.30, "bob": 0},
    "dilo":   {"plan": "biped", "legs": [(11, 22, 22, 16, 18)], "tail": (10, 11, 14), "head": (29, 15, 29, 12), "stride": 0.34, "bob": 1},
    "galli":  {"plan": "biped", "legs": [(8, 20, 25, 13, 21)], "tail": (5, 7, 20), "head": (24, 17, 25, 15), "stride": 0.32, "bob": 1},
    "raptor": {"plan": "biped", "legs": [(11, 18, 13, 14, 10)], "tail": (10, 10, 7), "head": (23, 9, 23, 7), "stride": 0.40, "bob": 1},
    "pachy":  {"plan": "biped", "legs": [(7, 16, 14, 11, 11)], "tail": (7, 8, 7), "head": (20, 11, 20, 7), "stride": 0.36, "bob": 1},
    "compy":  {"plan": "biped", "legs": [(5, 10, 7, 7, 6)], "tail": (5, 5, 4), "head": (10, 5, 10, 4), "stride": 0.40, "bob": 1},
    "baby":   {"plan": "biped", "legs": [(7, 12, 14, 9, 12)], "tail": (6, 7, 11), "head": (9, 10, 12, 9), "stride": 0.34, "bob": 1},
    "baby2":  {"plan": "biped", "legs": [(7, 12, 14, 9, 12)], "tail": (6, 7, 11), "head": (9, 10, 12, 9), "stride": 0.34, "bob": 1},
}
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]])


def src(kind, name):
    e = IDX[kind]
    x = e["frames"].get(name)
    if x is None: return None
    a = np.array(SRC.crop((x, e["y"], x + e["w"], e["y"] + e["h"])))
    out = np.zeros((e["h"], e["w"] + PAD * 2, 4), np.uint8)
    out[:, PAD:PAD + e["w"]] = a
    return out


def darker(a):
    """the far side: a tone darker and a little cooler (D1: shadows shift toward blue-violet)"""
    b = a.astype(np.float32).copy()
    m = b[..., 3] > 0
    b[..., 0] *= 0.66; b[..., 1] *= 0.68; b[..., 2] = b[..., 2] * 0.74 + 10
    b[..., :3] = np.clip(b[..., :3], 0, 255)
    b[~m] = 0
    return b.astype(np.uint8)


def paste(dst, piece):
    m = piece[..., 3] > 0
    dst[m] = piece[m]


def region_mask(a, box):
    h, w = a.shape[:2]
    m = np.zeros((h, w), bool)
    x0, x1, y0, y1 = box
    m[max(0, y0):min(h, y1), max(0, x0):min(w, x1)] = True
    return m & (a[..., 3] > 0)


def shear_h(piece, py, s, lift):
    """legs: each row shifts sideways in proportion to its distance below the hip"""
    h, w = piece.shape[:2]
    out = np.zeros_like(piece)
    for y in range(h):
        if not piece[y, :, 3].any(): continue
        dx = int(round(s * max(0, y - py)))
        ny = y - lift
        if not 0 <= ny < h: continue
        row = piece[y]
        if dx > 0: out[ny, dx:] = np.where(row[:w - dx, 3:4] > 0, row[:w - dx], out[ny, dx:])
        elif dx < 0: out[ny, :w + dx] = np.where(row[-dx:, 3:4] > 0, row[-dx:], out[ny, :w + dx])
        else: out[ny] = np.where(row[:, 3:4] > 0, row, out[ny])
    return out


def shear_v(piece, px, s, side):
    """tail (side -1, leftward of the root) and head (side +1): each column shifts up or down in
    proportion to its distance from the root"""
    h, w = piece.shape[:2]
    out = np.zeros_like(piece)
    for x in range(w):
        col = piece[:, x]
        if not col[:, 3].any(): continue
        d = (px - x) if side < 0 else (x - px)
        dy = int(round(s * max(0, d)))
        if dy > 0: out[dy:, x] = np.where(col[:h - dy, 3:4] > 0, col[:h - dy], out[dy:, x])
        elif dy < 0: out[:h + dy, x] = np.where(col[-dy:, 3:4] > 0, col[-dy:], out[:h + dy, x])
        else: out[:, x] = np.where(col[:, 3:4] > 0, col, out[:, x])
    return out


def shift(a, dy):
    if dy == 0: return a
    out = np.zeros_like(a)
    if dy > 0: out[dy:] = a[:-dy]
    else: out[:dy] = a[-dy:]
    return out


def feathers(a):
    """Utahraptor: wing feathers under the arm, a feathered tail and a small crest (feathered
    dromaeosaurs: Turner, Makovicky and Norell 2007, Science 317:1721; Utahraptor's size:
    Kirkland et al. 1993, Hunteria 2(10))"""
    a = a.copy()
    DARK, MID, TIP = (46, 30, 26, 255), (86, 56, 40, 255), (214, 196, 160, 255)
    P = PAD
    # the tail: a fringe of feathers above and below it, longer toward the tip
    for x in range(0, 10):
        col = np.where(a[:, P + x, 3] > 0)[0]
        if not len(col): continue
        top, bot = col.min(), col.max()
        n = 1 + (x < 6) + (x < 3)
        for k in range(1, n + 1):
            if top - k >= 0 and x % 2 == 0: a[top - k, P + x] = DARK if k < n else MID
            if bot + k < a.shape[0] and x % 2 == 1: a[bot + k, P + x] = DARK if k < n else TIP
    # wing feathers hanging from the arm
    for i, (x, y) in enumerate([(21, 13), (22, 14), (23, 14), (24, 13), (22, 15), (23, 15)]):
        a[y, P + x] = TIP if y == 15 else MID
    # a crest of short feathers at the back of the head
    for (x, y) in [(23, 0), (24, 0), (22, 1)]:
        a[y, P + x] = DARK
    return a


def build(kind):
    sp = SPEC[kind]
    idle, blink = src(kind, "idle"), src(kind, "blink")
    graze, roar = src(kind, "graze"), src(kind, "roar")
    if kind == "raptor":
        idle, blink = feathers(idle), feathers(blink)
    h, w = idle.shape[:2]
    P = PAD

    def parts(base):
        body = base.copy()
        legs = []
        for (x0, x1, yt, px, py) in sp["legs"]:
            m = region_mask(base, (x0 + P, x1 + P + 1, yt, h))
            piece = np.zeros_like(base); piece[m] = base[m]; body[m] = 0
            legs.append((piece, px + P, py))
        tx, tpx, tpy = sp["tail"]
        m = region_mask(body, (0, tx + P + 1, 0, h)); tail = np.zeros_like(base); tail[m] = body[m]; body[m] = 0
        hx, hy, hpx, hpy = sp["head"]
        m = region_mask(body, (hx + P, w, 0, hy)); head = np.zeros_like(base); head[m] = body[m]; body[m] = 0
        return body, legs, (tail, tpx + P), (head, hpx + P)

    def pose(base, phase, walking, breathe=0.0, tail_s=0.0, head_s=0.0, extra_dy=0):
        body, legs, (tail, tpx), (head, hpx) = parts(base)
        out = np.zeros_like(base)
        quad = sp["plan"] == "quad"
        offs = [0.0, 0.25] if quad else [0.0]
        bob = 0
        if walking and sp["bob"]:
            bob = -int(round(sp["bob"] * (0.5 - 0.5 * math.cos(4 * math.pi * phase))))
        bob += extra_dy
        # far legs first, then the tail, the body, the head, the near legs
        drawn = []
        for (piece, px, py), off in zip(legs, offs):
            for far in (True, False):
                ph = phase + off + (0.5 if far else 0.0)
                if walking:
                    s = sp["stride"] * math.sin(2 * math.pi * ph)
                    lift = 1 if math.cos(2 * math.pi * ph) > 0.35 else 0
                else:
                    s, lift = (0.06 if far else 0.0), 0
                pc = shift(shear_h(piece, py, s, lift), bob)          # the legs ride the body's bob, so no seam opens at the hip
                if far: pc = darker(pc)
                drawn.append((far, pc))
        for far, pc in drawn:
            if far: paste(out, pc if walking else np.roll(pc, -1, axis=1))
        paste(out, shift(shear_v(tail, tpx, tail_s, -1), bob))
        paste(out, shift(body, bob + (1 if breathe > 0.5 else 0) * 0))
        paste(out, shift(shear_v(head, hpx, head_s, +1), bob))
        for far, pc in drawn:
            if not far: paste(out, pc)
        return out

    frames = {}
    frames["walk"] = [pose(idle, i / 12, True, tail_s=0.05 * math.sin(2 * math.pi * i / 12 + 1),
                           head_s=0.03 * math.sin(2 * math.pi * i / 12 * 2)) for i in range(12)]
    frames["idle"] = [pose(idle, 0, False, tail_s=0.06 * math.sin(2 * math.pi * i / 12),
                           head_s=0.035 * math.sin(2 * math.pi * i / 12 + 1.2),
                           extra_dy=(1 if math.sin(2 * math.pi * i / 12) > 0.55 else 0) if sp["bob"] else 0) for i in range(12)]
    frames["blink"] = [pose(blink, 0, False)]
    if graze is not None:
        frames["graze"] = [pose(graze, 0, False, tail_s=0.05 * math.sin(2 * math.pi * i / 8),
                                head_s=0.05 * math.sin(2 * math.pi * i / 8 * 2)) for i in range(8)]
    if roar is not None:
        frames["roar"] = [pose(roar, 0, False, tail_s=0.08 * math.sin(2 * math.pi * i / 6),
                               head_s=-0.06 * (0.5 + 0.5 * math.sin(2 * math.pi * i / 6))) for i in range(6)]
    return frames


def brachio_frames():
    sys.path.insert(0, str(ROOT / "tools"))
    import brachio
    return {m: [np.array(brachio.render(p)) for p in ps] for m, ps in brachio.cycles().items()}


def main():
    out_frames = {k: build(k) for k in SPEC}
    out_frames["brachio"] = brachio_frames()
    order = ["trex", "raptor", "brachio", "stego", "trike", "para", "ankylo", "spino", "dilo", "pachy", "galli", "compy", "baby", "baby2"]
    rows = []
    for k in order:
        fr = out_frames[k]
        flat, m = [], {}
        for mode in ["walk", "idle", "blink", "graze", "roar"]:
            if mode in fr:
                m[mode] = list(range(len(flat), len(flat) + len(fr[mode])))
                flat += fr[mode]
        rows.append((k, flat, m))
    # the pterosaur, as drawn
    pe = IDX["ptero"]
    ptero = [np.array(SRC.crop((pe["frames"]["f%d" % n], pe["y"], pe["frames"]["f%d" % n] + pe["w"], pe["y"] + pe["h"]))) for n in range(len(pe["frames"]))]
    rows.append(("ptero", ptero, pe["m"]))

    W = max(len(f) * (f[0].shape[1] + 1) for k, f, m in rows)
    H = sum(f[0].shape[0] + 1 for k, f, m in rows)
    sheet = np.zeros((H, W, 4), np.uint8)
    table, y = {}, 0
    for k, flat, m in rows:
        fh, fw = flat[0].shape[:2]
        pos = []
        for i, f in enumerate(flat):
            x = i * (fw + 1)
            sheet[y:y + fh, x:x + fw] = f; pos.append([x, y])
        table[k] = {"w": fw, "h": fh, "f": pos, "m": m}
        y += fh + 1
    img = Image.fromarray(sheet)
    out_dir = ROOT / "tools/out"; out_dir.mkdir(exist_ok=True)
    # preview: every species' walk and idle cycles at 3x
    prev_rows = []
    for k, flat, m in rows:
        seq = [flat[i] for i in m.get("walk", m.get("fly", []))] + [flat[i] for i in m.get("idle", m.get("glide", []))][:6]
        strip = np.concatenate([np.pad(f, ((0, 0), (0, 2), (0, 0))) for f in seq], axis=1)
        prev_rows.append(strip)
    PW = max(r.shape[1] for r in prev_rows)
    prev = np.concatenate([np.pad(r, ((0, 3), (0, PW - r.shape[1]), (0, 0))) for r in prev_rows], axis=0)
    pv = Image.fromarray(prev); bg = Image.new("RGBA", pv.size, (206, 218, 198, 255)); bg.alpha_composite(pv)
    bg.resize((pv.width * 3, pv.height * 3), Image.NEAREST).save(out_dir / "animate-preview.png")
    if len(sys.argv) > 1 and sys.argv[1] == "preview":
        return
    img.save(ROOT / "assets/island/dinos.png", optimize=True)
    world = (ROOT / "js/world.js").read_text()
    world = re.sub(r"var SHEET = \{.*?\};\n", "var SHEET = " + json.dumps(table, separators=(",", ":")) + ";\n", world, count=1)
    (ROOT / "js/world.js").write_text(world)
    print("sheet", img.size, "species", len(table))


if __name__ == "__main__":
    main()
