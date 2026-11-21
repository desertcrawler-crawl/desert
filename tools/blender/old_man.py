"""
Builds the old man (crawler.glb) from scratch in Blender: low-poly mesh with
vertex colours, an armature, and every animation clip the game looks for.

Run (Blender 4.2+ or the `bpy` Python module):
    blender -b -P tools/blender/old_man.py -- out/crawler.glb [out/old_man.blend]

Based on niclas's old man character sheet. Everything here is made in code,
so the result is ours to commit (no third-party assets).
"""
import math
import random
import sys

import bpy
from mathutils import Euler, Quaternion, Vector

random.seed(7)
FPS = 30

# ---------------------------------------------------------------- palette --
def hexc(h):
    return (int(h[1:3], 16) / 255, int(h[3:5], 16) / 255, int(h[5:7], 16) / 255, 1.0)


SKIN = hexc("#e6c2a4")
SKIN_SHADE = hexc("#d4ab8c")
DIRT = hexc("#b39272")
RIB = hexc("#c99f82")
VEST = hexc("#a46a2c")
VEST_DARK = hexc("#6e4620")
SHORTS = hexc("#7c5228")
SHORTS_DARK = hexc("#5c3c1d")
RAG = hexc("#b29a72")
RAG_DARK = hexc("#8a7458")
ROPE = hexc("#a8885a")
HAIR = hexc("#f4f1ea")
HAIR_SHADE = hexc("#d9d6d0")
EYE_WHITE = hexc("#eae4dc")
IRIS = hexc("#2c3488")
SOCKET = hexc("#8a6a6e")
MOUTH = hexc("#5a3436")
GOURD = hexc("#d8c49a")
CORK = hexc("#7a5a38")


def dirty(c, p=0.18):
    return DIRT if random.random() < p else c


# ----------------------------------------------------------- mesh builder --
class MB:
    def __init__(self):
        self.v, self.w, self.f, self.fc = [], [], [], []

    def vert(self, co, w):
        self.v.append(Vector(co))
        self.w.append(dict(w))
        return len(self.v) - 1

    def face(self, idx, col):
        self.f.append(list(idx))
        self.fc.append(col)


def frame(t, ref):
    t = t.normalized()
    if abs(t.dot(ref)) > 0.9:
        ref = Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 0, 1))
    a = t.cross(ref).normalized()
    b = a.cross(t).normalized()
    return a, b


def tube(mb, centers, radii, weights, col, sides=8, cap0=True, cap1=True,
         ref=(0, -1, 0), closed=False, jag=0.0, skip=None, twist=0.0):
    """Rings along a path. radii[i] = (across, depth); (0,0) makes a pole.
    col(i, k, n) -> colour for the quad between ring i and i+1 at side k.
    jag: pull every other vertex of the last ring back for a torn hem.
    skip(i, k) -> True to leave that quad out (open vest front)."""
    ref = Vector(ref)
    cs = [Vector(c) for c in centers]
    n = len(cs)
    rings = []
    for i, c in enumerate(cs):
        if closed:
            t = cs[(i + 1) % n] - cs[i - 1]
        elif i == 0:
            t = cs[1] - c
        elif i == n - 1:
            t = c - cs[i - 1]
        else:
            t = cs[i + 1] - cs[i - 1]
        a, b = frame(t, ref)
        rx, ry = radii[i]
        if rx == 0 and ry == 0:
            rings.append([mb.vert(c, weights[i])])
            continue
        ring = []
        for k in range(sides):
            ang = 2 * math.pi * k / sides + twist
            p = c + a * math.cos(ang) * rx + b * math.sin(ang) * ry
            if jag and i == n - 1 and k % 2 == 1:
                p = p - t.normalized() * jag * (0.6 + 0.8 * random.random())
            ring.append(mb.vert(p, weights[i]))
        rings.append(ring)
    segs = n if closed else n - 1
    for i in range(segs):
        r0, r1 = rings[i], rings[(i + 1) % n]
        if len(r0) == 1 and len(r1) == 1:
            continue
        for k in range(sides):
            if skip and skip(i, k):
                continue
            k1 = (k + 1) % sides
            c_ = col(i, k, n) if callable(col) else col
            if len(r0) == 1:
                mb.face([r0[0], r1[k1], r1[k]], c_)
            elif len(r1) == 1:
                mb.face([r0[k], r0[k1], r1[0]], c_)
            else:
                mb.face([r0[k], r0[k1], r1[k1], r1[k]], c_)
    if not closed:
        ccap = col(0, 0, n) if callable(col) else col
        if cap0 and len(rings[0]) > 1:
            mb.face(list(reversed(rings[0])), ccap)
        ccap = col(n - 2, 0, n) if callable(col) else col
        if cap1 and len(rings[-1]) > 1:
            mb.face(rings[-1], ccap)
    return rings


def spike(mb, base, tip, width, w, col, ref=(0, 0, 1), thick=0.4):
    """A flat 4-sided pyramid: one lock of hair, a beard point, a rag strip."""
    base, tip = Vector(base), Vector(tip)
    a, b = frame(tip - base, Vector(ref))
    vs = [mb.vert(base + a * width, w), mb.vert(base + b * width * thick, w),
          mb.vert(base - a * width, w), mb.vert(base - b * width * thick, w)]
    t = mb.vert(tip, w)
    for k in range(4):
        mb.face([vs[k], vs[(k + 1) % 4], t], col)
    mb.face(list(reversed(vs)), col)


def disc(mb, center, normal, r, w, col, sides=6, squash=1.0, bulge=0.0):
    c, nrm = Vector(center), Vector(normal).normalized()
    a, b = frame(nrm, Vector((0, 0, 1)))
    ring = [mb.vert(c + a * math.cos(2 * math.pi * k / sides) * r
                    + b * math.sin(2 * math.pi * k / sides) * r * squash, w) for k in range(sides)]
    tip = mb.vert(c + nrm * bulge, w)
    for k in range(sides):
        mb.face([ring[k], ring[(k + 1) % sides], tip], col)


# ------------------------------------------------------------- skeleton --
# name: (head, tail, parent, roll axis target) — roll makes local Z point
# forward (-Y) on every chain bone, so +X rotation always swings a bone's
# tip forward. Left is +X (the model faces -Y).
FWD = (0, -1, 0)
UP = (0, 0, 1)
BONES = {
    "root": ((0, 0, 0), (0, 0.25, 0), None, UP),
    "hips": ((0, 0, 0.92), (0, 0, 1.02), "root", FWD),
    "spine": ((0, 0, 1.02), (0, 0, 1.18), "hips", FWD),
    "chest": ((0, 0, 1.18), (0, 0, 1.38), "spine", FWD),
    "neck": ((0, 0, 1.38), (0, -0.01, 1.47), "chest", FWD),
    "head": ((0, -0.01, 1.47), (0, -0.01, 1.74), "neck", FWD),
}
for s, sx in (("L", 1), ("R", -1)):
    BONES.update({
        f"thigh_{s}": ((0.10 * sx, 0, 0.88), (0.10 * sx, 0, 0.48), "hips", FWD),
        f"shin_{s}": ((0.10 * sx, 0, 0.48), (0.09 * sx, 0, 0.09), f"thigh_{s}", FWD),
        f"foot_{s}": ((0.09 * sx, 0, 0.09), (0.09 * sx, -0.15, 0.03), f"shin_{s}", UP),
        f"shoulder_{s}": ((0.03 * sx, 0, 1.33), (0.16 * sx, 0, 1.34), "chest", FWD),
        f"upperarm_{s}": ((0.17 * sx, 0, 1.33), (0.215 * sx, 0.02, 1.05), f"shoulder_{s}", FWD),
        f"forearm_{s}": ((0.215 * sx, 0.02, 1.05), (0.245 * sx, 0, 0.79), f"upperarm_{s}", FWD),
        f"hand_{s}": ((0.245 * sx, 0, 0.79), (0.255 * sx, -0.01, 0.62), f"forearm_{s}", FWD),
    })


def W(**kw):
    return kw


def build_mesh():
    mb = MB()

    # ---- torso: pelvis to neck, thin with visible ribs ----
    rows = [  # z, across, depth, weights, y offset
        (0.80, 0.125, 0.095, W(hips=1)),
        (0.88, 0.145, 0.105, W(hips=1)),
        (0.96, 0.135, 0.095, W(hips=1)),
        (1.02, 0.118, 0.082, W(hips=0.5, spine=0.5)),
        (1.08, 0.112, 0.080, W(spine=1)),
        (1.13, 0.122, 0.086, W(spine=1)),
        (1.18, 0.135, 0.092, W(spine=0.5, chest=0.5)),
        (1.23, 0.145, 0.096, W(chest=1)),
        (1.28, 0.152, 0.098, W(chest=1)),
        (1.33, 0.158, 0.094, W(chest=1)),
        (1.38, 0.120, 0.080, W(chest=1)),
        (1.42, 0.055, 0.050, W(chest=0.4, neck=0.6)),
        (1.50, 0.048, 0.046, W(neck=0.4, head=0.6)),
    ]

    def torso_col(i, k, n):
        z = rows[i][0]
        if z < 0.95:
            return dirty(SHORTS, 0.15)
        # side k spans 45k..45k+45 degrees from +X towards the front (-Y)
        if 1.06 <= z <= 1.30 and k in (1, 2):  # ribs on the chest
            return RIB if i % 2 == 0 else SKIN
        if 1.06 <= z <= 1.30 and k in (5, 6):  # ribs on the back
            return SKIN_SHADE if i % 2 == 0 else SKIN
        return dirty(SKIN, 0.1)

    tube(mb, [(0, 0.01 if r[0] < 1.0 else 0, r[0]) for r in rows],
         [(r[1], r[2]) for r in rows], [r[3] for r in rows], torso_col, sides=8, cap1=False)

    # ---- vest: open front, torn hem, holes ----
    vrows = [
        (1.43, 0.085, 0.062, W(chest=0.5, neck=0.5)),
        (1.38, 0.175, 0.105, W(chest=1)),
        (1.30, 0.172, 0.112, W(chest=1)),
        (1.20, 0.158, 0.108, W(spine=0.5, chest=0.5)),
        (1.10, 0.140, 0.100, W(spine=1)),
        (1.03, 0.136, 0.098, W(spine=0.6, hips=0.4)),
    ]
    sides = 10

    def vest_skip(i, k):
        # quad k spans 18+36k .. 54+36k degrees from +X towards the front (-Y), so 1 and 2 face forward
        return (i >= 1 and k in (1, 2)) or (i >= 3 and k in (0, 3))

    def vest_col(i, k, n):
        if i >= 2 and random.random() < 0.10:
            return VEST_DARK
        return VEST_DARK if random.random() < 0.18 else VEST

    tube(mb, [(0, 0.005, r[0]) for r in vrows], [(r[1], r[2]) for r in vrows],
         [r[3] for r in vrows], vest_col, sides=sides, cap0=False, cap1=False,
         ref=(0, -1, 0), jag=0.07, skip=vest_skip, twist=math.pi / sides)

    # ---- rope belt with a knot and two dangling ends ----
    belt = []
    for k in range(12):
        a = 2 * math.pi * k / 12
        belt.append((math.cos(a) * 0.150, 0.01 + math.sin(a) * 0.112, 0.955 + 0.012 * math.sin(3 * a)))
    tube(mb, belt, [(0.016, 0.016)] * 12, [W(hips=1)] * 12, ROPE, sides=4, closed=True)
    tube(mb, [(-0.03, -0.11, 0.95), (-0.04, -0.125, 0.86), (-0.035, -0.13, 0.78)],
         [(0.013, 0.013)] * 3, [W(hips=1)] * 3, ROPE, sides=4)
    tube(mb, [(0.01, -0.11, 0.95), (0.02, -0.125, 0.88)],
         [(0.013, 0.013)] * 2, [W(hips=1)] * 2, ROPE, sides=4)

    # ---- water gourd on the left hip ----
    gx, gy, gz = 0.175, 0.01, 0.84
    tube(mb, [(gx, gy, gz - 0.07), (gx, gy, gz - 0.05), (gx, gy, gz), (gx, gy, gz + 0.04),
              (gx, gy, gz + 0.065), (gx, gy, gz + 0.09)],
         [(0, 0), (0.045, 0.04), (0.06, 0.052), (0.045, 0.04), (0.018, 0.018), (0.02, 0.02)],
         [W(hips=1)] * 6, lambda i, k, n: CORK if i >= 4 else dirty(GOURD, 0.2), sides=7)

    # ---- legs, shorts, rag flaps, feet ----
    for s, sx in (("L", 1), ("R", -1)):
        th, sh, ft = f"thigh_{s}", f"shin_{s}", f"foot_{s}"
        lx = 0.10 * sx
        tube(mb,
             [(lx, 0, 0.90), (lx, 0, 0.80), (lx, 0, 0.64), (lx, 0, 0.52), (lx, 0, 0.47),
              (lx, 0, 0.42), (0.095 * sx, 0, 0.28), (0.09 * sx, 0, 0.14), (0.09 * sx, 0.005, 0.07)],
             [(0.072, 0.075), (0.064, 0.066), (0.050, 0.052), (0.046, 0.048), (0.050, 0.052),
              (0.042, 0.044), (0.040, 0.042), (0.033, 0.035), (0.036, 0.040)],
             [W(hips=0.5, **{th: 0.5}), {th: 1}, {th: 1}, {th: 0.6, sh: 0.4}, {th: 0.5, sh: 0.5},
              {sh: 1}, {sh: 1}, {sh: 1}, {sh: 0.5, ft: 0.5}],
             lambda i, k, n: dirty(SKIN, 0.35 if i >= 4 else 0.15), sides=7, cap0=False, cap1=False)
        # torn shorts over the thigh
        tube(mb, [(lx, 0.005, 0.93), (lx, 0.005, 0.80), (lx, 0.005, 0.64), (lx, 0.005, 0.53)],
             [(0.088, 0.09), (0.085, 0.088), (0.072, 0.075), (0.066, 0.07)],
             [W(hips=0.6, **{th: 0.4}), {th: 1}, {th: 1}, {th: 0.7, sh: 0.3}],
             lambda i, k, n: SHORTS_DARK if random.random() < 0.2 else SHORTS,
             sides=7, cap0=False, cap1=False, jag=0.07)
        # front rag flap (the torn skirt in the front view)
        fx0, fx1 = 0.005 * sx, 0.125 * sx
        rows_ = [(0.95, -0.118, W(hips=1)), (0.80, -0.112, W(hips=0.4, **{th: 0.6})),
                 (0.62, -0.090, {th: 1})]
        grid = []
        for z, y, w in rows_:
            grid.append([mb.vert((fx0 + (fx1 - fx0) * u, y, z), w) for u in (0, 0.5, 1)])
        for r in range(2):
            for c in range(2):
                q = [grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]]
                mb.face(q if sx > 0 else list(reversed(q)), RAG if random.random() > 0.3 else RAG_DARK)
        for c, u in enumerate((0.2, 0.75)):
            spike(mb, (fx0 + (fx1 - fx0) * u, -0.092, 0.63), (fx0 + (fx1 - fx0) * (u + 0.05), -0.085, 0.50),
                  0.032, {th: 1}, RAG_DARK, ref=(0, -1, 0), thick=0.2)
        # foot: heel to toes, big and bony
        fx = 0.09 * sx
        tube(mb, [(fx, 0.045, 0.045), (fx, 0.0, 0.055), (fx, -0.08, 0.040), (fx * 1.03, -0.16, 0.024),
                  (fx * 1.04, -0.185, 0.02)],
             [(0.042, 0.038), (0.05, 0.045), (0.032, 0.058), (0.022, 0.056), (0.012, 0.048)],
             [{sh: 0.3, ft: 0.7}, {ft: 1}, {ft: 1}, {ft: 1}, {ft: 1}],
             lambda i, k, n: dirty(SKIN, 0.4), sides=6, ref=(0, 0, 1))

    # ---- arms and big hands ----
    for s, sx in (("L", 1), ("R", -1)):
        sh_, ua, fa, hd = f"shoulder_{s}", f"upperarm_{s}", f"forearm_{s}", f"hand_{s}"
        tube(mb,
             [(0.14 * sx, 0, 1.345), (0.175 * sx, 0.005, 1.31), (0.195 * sx, 0.012, 1.19),
              (0.215 * sx, 0.02, 1.05), (0.23 * sx, 0.012, 0.93), (0.245 * sx, 0.0, 0.80)],
             [(0.055, 0.055), (0.048, 0.050), (0.036, 0.038), (0.040, 0.040), (0.036, 0.038), (0.026, 0.03)],
             [{sh_: 0.6, "chest": 0.4}, {sh_: 0.3, ua: 0.7}, {ua: 1}, {ua: 0.5, fa: 0.5}, {fa: 1},
              {fa: 0.5, hd: 0.5}],
             lambda i, k, n: dirty(SKIN, 0.15), sides=7, ref=(0, -1, 0))
        # palm: flat, faces the thigh
        hx = 0.25 * sx
        tube(mb, [(hx, 0.0, 0.80), (hx, -0.005, 0.75), (hx + 0.004 * sx, -0.008, 0.70)],
             [(0.022, 0.035), (0.022, 0.048), (0.02, 0.05)],
             [{fa: 0.3, hd: 0.7}, {hd: 1}, {hd: 1}], lambda i, k, n: SKIN, sides=6, ref=(0, -1, 0))
        # fingers, slightly curled
        for j, fy in enumerate((-0.036, -0.012, 0.012, 0.034)):
            ln = (0.085, 0.10, 0.095, 0.075)[j]
            base = Vector((hx + 0.004 * sx, fy - 0.008, 0.705))
            mid = base + Vector((0.004 * sx, -0.012, -ln * 0.6))
            tip = base + Vector((0.0, -0.032, -ln))
            tube(mb, [base, mid, tip], [(0.011, 0.012), (0.01, 0.011), (0.007, 0.008)],
                 [{hd: 1}] * 3, SKIN, sides=4, ref=(0, -1, 0))
        tube(mb, [(hx - 0.01 * sx, -0.04, 0.77), (hx - 0.012 * sx, -0.062, 0.72), (hx - 0.008 * sx, -0.07, 0.68)],
             [(0.012, 0.013), (0.011, 0.011), (0.008, 0.008)], [{hd: 1}] * 3, SKIN, sides=4, ref=(1, 0, 0))

    # ---- head: big bald dome, droopy face ----
    H = {"head": 1}
    hrows = [  # z, across, depth, y centre
        (1.455, 0.0, 0.0, -0.075),
        (1.475, 0.055, 0.045, -0.06),
        (1.52, 0.085, 0.075, -0.035),
        (1.58, 0.108, 0.098, -0.015),
        (1.64, 0.116, 0.112, -0.005),
        (1.70, 0.110, 0.112, 0.0),
        (1.755, 0.085, 0.092, 0.005),
        (1.79, 0.045, 0.05, 0.005),
        (1.80, 0.0, 0.0, 0.005),
    ]
    tube(mb, [(0, r[3], r[0]) for r in hrows], [(r[1], r[2]) for r in hrows], [H] * len(hrows),
         lambda i, k, n: SKIN if hrows[i][0] > 1.6 else (SKIN if random.random() > 0.15 else SKIN_SHADE),
         sides=10, ref=(0, -1, 0))
    # nose: bulbous wedge
    tube(mb, [(0, -0.105, 1.625), (0, -0.135, 1.585), (0, -0.152, 1.565), (0, -0.14, 1.548)],
         [(0.014, 0.012), (0.02, 0.02), (0.026, 0.022), (0.0, 0.0)], [H] * 4, SKIN_SHADE, sides=6,
         ref=(0, -1, 0))
    for sx in (1, -1):
        # big ears
        e0 = mb.vert((0.105 * sx, 0.0, 1.66), H)
        e1 = mb.vert((0.108 * sx, 0.02, 1.57), H)
        e2 = mb.vert((0.16 * sx, 0.035, 1.66), H)
        e3 = mb.vert((0.14 * sx, 0.03, 1.56), H)
        q = [e0, e1, e3, e2]
        mb.face(q if sx > 0 else list(reversed(q)), SKIN_SHADE)
        mb.face(list(reversed(q)) if sx > 0 else q, SKIN)
        # tired eyes: dark socket, white, blue iris, heavy lid
        ex = 0.042 * sx
        disc(mb, (ex, -0.098, 1.618), (0.25 * sx, -1, 0.05), 0.030, H, SOCKET, sides=6, squash=0.8)
        disc(mb, (ex, -0.104, 1.622), (0.25 * sx, -1, 0.0), 0.020, H, EYE_WHITE, sides=6, squash=0.7)
        disc(mb, (ex, -0.109, 1.619), (0.25 * sx, -1, 0.0), 0.010, H, IRIS, sides=5)
        # sad brows: white, inner end raised
        spike(mb, (0.015 * sx, -0.108, 1.666), (0.085 * sx, -0.092, 1.645), 0.011, H, HAIR, ref=(0, -1, 0), thick=1.0)
        # droopy moustache
        spike(mb, (0.005 * sx, -0.135, 1.545), (0.065 * sx, -0.10, 1.49), 0.016, H, HAIR, ref=(0, -1, 0), thick=0.8)
    # sad mouth
    disc(mb, (0, -0.103, 1.52), (0, -1, -0.2), 0.016, H, MOUTH, sides=6, squash=0.4)

    # beard: wedge from the jaw down onto the chest, ragged points
    tube(mb, [(0, -0.07, 1.56), (0, -0.095, 1.47), (0, -0.11, 1.38), (0, -0.12, 1.31)],
         [(0.092, 0.05), (0.08, 0.042), (0.062, 0.032), (0.05, 0.026)],
         [H] * 4, lambda i, k, n: HAIR if random.random() > 0.25 else HAIR_SHADE, sides=8,
         ref=(0, -1, 0), cap0=False, cap1=False, jag=0.06)
    for x, ln in ((-0.035, 0.12), (0.0, 0.15), (0.035, 0.11), (-0.06, 0.08), (0.06, 0.09)):
        spike(mb, (x, -0.13, 1.33), (x * 1.2, -0.135, 1.33 - ln), 0.02, H, HAIR, ref=(0, -1, 0), thick=0.5)

    # hair: bald on top, long wild white locks at the back and sides
    for j in range(11):
        ang = math.radians(8 + j * 164 / 10)  # right temple, round the back, to the left temple
        dx, dy = -math.cos(ang), math.sin(ang)
        base = Vector((dx * 0.105, 0.015 + dy * 0.10, 1.66 + 0.02 * dy))
        side = abs(dx)
        ln = 0.17 + 0.15 * dy + 0.05 * random.random()
        tip = base + Vector((dx * (0.05 + 0.07 * side), 0.03 + dy * 0.07, -ln))
        spike(mb, base, tip, 0.055, H, HAIR if j % 3 else HAIR_SHADE, ref=(0, 0, 1), thick=0.45)
        if side > 0.55:  # wild tufts flaring out over the ears
            spike(mb, base + Vector((0, 0, 0.015)), base + Vector((dx * 0.11, 0.03, -0.05)), 0.03, H, HAIR,
                  ref=(0, 0, 1), thick=0.45)
    # a short fringe of hair hugging the back of the skull
    tube(mb, [(0, 0.0, 1.70), (0, 0.01, 1.60), (0, 0.025, 1.52)],
         [(0.118, 0.115), (0.122, 0.118), (0.10, 0.10)], [H] * 3, HAIR, sides=10, cap0=False, cap1=False,
         skip=lambda i, k: k in (0, 1, 2, 3, 4), ref=(0, -1, 0), jag=0.04, twist=math.pi / 10)
    # Cartoon proportions from the sheet: big head, big hands and feet.
    grow = [("head", (0, -0.01, 1.45), 1.16)]
    for s_ in ("L", "R"):
        sx = 1 if s_ == "L" else -1
        grow += [(f"hand_{s_}", (0.245 * sx, 0, 0.79), 1.25), (f"foot_{s_}", (0.09 * sx, 0, 0.07), 1.12)]
    for bone, pivot, k in grow:
        pv = Vector(pivot)
        for i, w in enumerate(mb.w):
            if w.get(bone, 0) >= 0.99:
                mb.v[i] = pv + (mb.v[i] - pv) * k
    return mb


# ---------------------------------------------------------------- build ---
def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.fps = FPS

    arm_data = bpy.data.armatures.new("OldManRig")
    rig = bpy.data.objects.new("OldMan", arm_data)
    scene.collection.objects.link(rig)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    for name, (h, t, parent, roll) in BONES.items():
        b = arm_data.edit_bones.new(name)
        b.head, b.tail = Vector(h), Vector(t)
        b.align_roll(Vector(roll))
        if parent:
            b.parent = arm_data.edit_bones[parent]
            b.use_connect = (Vector(h) - arm_data.edit_bones[parent].tail).length < 1e-4
    bpy.ops.object.mode_set(mode="OBJECT")

    mb = build_mesh()
    me = bpy.data.meshes.new("OldManMesh")
    me.from_pydata([tuple(v) for v in mb.v], [], mb.f)
    assert len(me.polygons) == len(mb.fc), "face colours out of step"
    col = me.color_attributes.new("Color", "BYTE_COLOR", "CORNER")
    for poly, c in zip(me.polygons, mb.fc):
        for li in poly.loop_indices:
            col.data[li].color_srgb = c
    me.color_attributes.active_color = col
    for p in me.polygons:
        p.use_smooth = False
    body = bpy.data.objects.new("OldManBody", me)
    scene.collection.objects.link(body)
    for name in BONES:
        body.vertex_groups.new(name=name)
    for vi, w in enumerate(mb.w):
        tot = sum(w.values())
        for bn, val in w.items():
            body.vertex_groups[bn].add([vi], val / tot, "REPLACE")
    # consistent outward normals
    bpy.context.view_layer.objects.active = body
    body.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    body.parent = rig
    mod = body.modifiers.new("Armature", "ARMATURE")
    mod.object = rig

    mat = bpy.data.materials.new("OldManSkin")
    mat.use_backface_culling = False
    nt = mat.node_tree if mat.node_tree else None
    if nt is None:
        mat.use_nodes = True
        nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    attr = nt.nodes.new("ShaderNodeVertexColor")
    attr.layer_name = "Color"
    nt.links.new(attr.outputs["Color"], bsdf.inputs["Base Color"])
    bsdf.inputs["Roughness"].default_value = 0.9
    me.materials.append(mat)
    tris = sum(len(p.vertices) - 2 for p in me.polygons)
    print(f"[old_man] {len(me.vertices)} verts, {tris} triangles, {len(BONES)} bones")
    return rig, body


# ----------------------------------------------------------- animation ----
def mirror(pose):
    """Copy every _L entry to _R with Y and Z rotations flipped, unless _R is given."""
    out = dict(pose)
    for k, v in pose.items():
        if k.endswith("_L") and k[:-2] + "_R" not in pose:
            out[k[:-2] + "_R"] = (v[0], -v[1], -v[2])
    return out


def lerp_pose(a, b, t):
    keys = set(a) | set(b)
    out = {}
    for k in keys:
        va, vb = a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0))
        out[k] = tuple(x + (y - x) * t for x, y in zip(va, vb))
    return out


def add(a, b):
    keys = set(a) | set(b)
    return {k: tuple(x + y for x, y in zip(a.get(k, (0, 0, 0)), b.get(k, (0, 0, 0)))) for k in keys}


# Poses: bone -> (x, y, z) degrees; "loc" -> hips offset (right, up, forward) in metres.
CRAWL = mirror({
    "loc": (0, -0.43, 0.10),
    "hips": (72, 0, 0),
    "spine": (12, 0, 0),
    "chest": (10, 0, 0),
    "neck": (-30, 0, 0),
    "head": (-38, 0, 0),
    "thigh_L": (66, 0, 6),
    "shin_L": (-86, 0, 0),
    "foot_L": (-65, 0, 0),
    "shoulder_L": (0, 0, 0),
    "upperarm_L": (100, 0, 18),
    "forearm_L": (8, 0, -8),
    "hand_L": (70, 0, 0),
})
HUNCH = mirror({
    "loc": (0, -0.07, 0.0),
    "hips": (16, 0, 0),
    "spine": (14, 0, 0),
    "chest": (16, 0, 0),
    "neck": (-16, 0, 0),
    "head": (-22, 0, 0),
    "thigh_L": (30, 0, 3),
    "shin_L": (-30, 0, 0),
    "foot_L": (16, 0, 0),
    "upperarm_L": (14, 0, 8),
    "forearm_L": (16, 0, 0),
    "hand_L": (8, 0, 0),
})
KNEEL = mirror({  # sitting back on the heels, hands on the thighs
    "loc": (0, -0.55, 0.06),
    "hips": (20, 0, 0),
    "spine": (12, 0, 0),
    "chest": (12, 0, 0),
    "neck": (-10, 0, 0),
    "head": (-12, 0, 0),
    "thigh_L": (95, 0, 8),
    "shin_L": (-150, 0, 0),
    "foot_L": (-60, 0, 0),
    "upperarm_L": (30, 0, 12),
    "forearm_L": (40, 0, 0),
    "hand_L": (20, 0, 0),
})
LUNGE = mirror({  # one foot planted, pushing up from the knee
    "loc": (0, -0.30, 0.02),
    "hips": (40, 0, 0),
    "spine": (14, 0, 0),
    "chest": (14, 0, 0),
    "neck": (-24, 0, 0),
    "head": (-20, 0, 0),
    "thigh_L": (110, 0, 4),
    "shin_L": (-100, 0, 0),
    "foot_L": (-30, 0, 0),
    "thigh_R": (40, 0, -6),
    "shin_R": (-110, 0, 0),
    "foot_R": (-50, 0, 0),
    "upperarm_L": (60, 0, 10),
    "forearm_L": (40, 0, 0),
    "hand_L": (30, 0, 0),
    "upperarm_R": (70, 0, -10),
    "forearm_R": (30, 0, 0),
    "hand_R": (40, 0, 0),
})
LIE_BACK = mirror({  # on the back, legs a little bent
    "loc": (0, -0.78, 0.0),
    "hips": (-88, 0, 0),
    "spine": (-4, 0, 0),
    "chest": (-2, 0, 0),
    "neck": (8, 0, 0),
    "head": (6, 0, 14),
    "thigh_L": (22, 0, 10),
    "shin_L": (-38, 0, 0),
    "foot_L": (-10, 0, 0),
    "upperarm_L": (-4, 0, 38),
    "forearm_L": (18, 0, 0),
    "hand_L": (0, 0, 0),
    "upperarm_R": (-4, 0, -26),
    "forearm_R": (28, 0, 0),
    "hand_R": (0, 0, 0),
})


def key_pose(rig, pose, frame):
    for name, pb in rig.pose.bones.items():
        rot = pose.get(name, (0, 0, 0))
        pb.rotation_mode = "QUATERNION"
        pb.rotation_quaternion = Euler([math.radians(a) for a in rot], "XYZ").to_quaternion()
        pb.keyframe_insert("rotation_quaternion", frame=frame)
        if name == "hips":
            x, up, fwd = pose.get("loc", (0, 0, 0))
            pb.location = Vector((x, up, fwd))  # hips local axes: X right, Y up, Z forward
            pb.keyframe_insert("location", frame=frame)


def make_clip(rig, name, keys):
    """keys: list of (seconds, pose)."""
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    rig.animation_data_create()
    rig.animation_data.action = act
    for t, pose in keys:
        key_pose(rig, pose, round(t * FPS) + 1)
    return act


def cyc(t, period, phase=0.0):
    return math.sin(2 * math.pi * (t / period + phase))


def crawl_frame(t, period=1.3, amt=1.0):
    """Diagonal gait: left hand moves with right knee."""
    p = {}
    a = cyc(t, period)
    lift_l = max(0.0, cyc(t, period, 0.25))  # left hand up while it travels forward
    lift_r = max(0.0, -cyc(t, period, 0.25))
    p["upperarm_L"] = (-18 * a * amt, 0, 0)
    p["upperarm_R"] = (18 * a * amt, 0, 0)
    p["forearm_L"] = (30 * lift_l * amt, 0, 0)
    p["forearm_R"] = (30 * lift_r * amt, 0, 0)
    p["hand_L"] = (-25 * lift_l * amt, 0, 0)
    p["hand_R"] = (-25 * lift_r * amt, 0, 0)
    p["thigh_R"] = (-14 * a * amt, 0, 0)
    p["thigh_L"] = (14 * a * amt, 0, 0)
    p["shin_R"] = (-16 * lift_l * amt, 0, 0)
    p["shin_L"] = (-16 * lift_r * amt, 0, 0)
    p["hips"] = (0, 6 * a * amt, 4 * a * amt)
    p["chest"] = (0, -7 * a * amt, -4 * a * amt)
    p["head"] = (4 * cyc(t, period / 2) * amt, 5 * a * amt, 0)
    p["loc"] = (0.015 * a * amt, 0.015 * cyc(t, period / 2, 0.25) * amt, 0)
    return add(CRAWL, p)


def walk_frame(t, period=1.5):
    p = {}
    a = cyc(t, period)
    up_l = max(0.0, cyc(t, period, 0.25))
    up_r = max(0.0, -cyc(t, period, 0.25))
    p["thigh_L"] = (22 * a, 0, 0)
    p["thigh_R"] = (-22 * a, 0, 0)
    p["shin_L"] = (-35 * up_l, 0, 0)
    p["shin_R"] = (-35 * up_r, 0, 0)
    p["foot_L"] = (10 * up_l, 0, 0)
    p["foot_R"] = (10 * up_r, 0, 0)
    p["upperarm_L"] = (-14 * a, 0, 0)
    p["upperarm_R"] = (14 * a, 0, 0)
    p["forearm_L"] = (6 + 6 * a, 0, 0)
    p["forearm_R"] = (6 - 6 * a, 0, 0)
    p["hips"] = (0, 8 * a, -3 * a)
    p["chest"] = (0, -6 * a, 0)
    p["head"] = (3 * cyc(t, period / 2), 3 * a, 0)
    p["loc"] = (0.02 * a, -0.02 * abs(a), 0)
    return add(HUNCH, p)


def breathe(base, t, period, chest=4.0, head=3.0, lift=0.01):
    b = cyc(t, period)
    return add(base, {"chest": (-chest * b, 0, 0), "spine": (-chest * 0.4 * b, 0, 0),
                      "head": (head * b, 0, 0), "loc": (0, lift * b, 0),
                      "upperarm_L": (0, 0, 1.5 * b), "upperarm_R": (0, 0, -1.5 * b)})


def sampled(fn, length, step=0.1):
    n = int(round(length / step))
    return [(i * step, fn(i * step)) for i in range(n + 1)]


def build_clips(rig):
    make_clip(rig, "crawl", sampled(crawl_frame, 1.3))
    make_clip(rig, "crawl_idle", sampled(lambda t: breathe(CRAWL, t, 2.6, 5, -4, 0.012), 2.6, 0.2))
    make_clip(rig, "walk", sampled(walk_frame, 1.5))
    make_clip(rig, "walk_idle", sampled(lambda t: breathe(HUNCH, t, 3.0, 4, 3, 0.008), 3.0, 0.2))
    # Transitions: the game gives stand_up 3 s and lie_down 2 s.
    make_clip(rig, "stand_up", [(0.0, CRAWL), (0.7, add(CRAWL, {"loc": (0, 0.03, -0.05), "hips": (-10, 0, 0)})),
                                (1.3, KNEEL), (2.1, LUNGE),
                                (2.6, lerp_pose(LUNGE, HUNCH, 0.7)), (3.0, HUNCH)])
    make_clip(rig, "lie_down", [(0.0, HUNCH), (0.6, lerp_pose(HUNCH, LUNGE, 0.8)), (1.1, KNEEL),
                                (1.6, lerp_pose(KNEEL, CRAWL, 0.8)), (2.0, CRAWL)])
    weak = lambda t: breathe(LIE_BACK, t, 3.2, 7, -4, 0.006)
    make_clip(rig, "dying_breathe", sampled(weak, 3.2, 0.2))
    # Collapse: arms give way, he rolls onto his back.
    side = add(lerp_pose(CRAWL, LIE_BACK, 0.5), {"hips": (0, 60, 0), "loc": (0.1, 0, 0)})
    make_clip(rig, "death", [(0.0, CRAWL),
                             (0.35, add(CRAWL, {"upperarm_L": (25, 0, 10), "upperarm_R": (25, 0, -10),
                                                "loc": (0, -0.12, 0), "head": (20, 0, 0)})),
                             (0.9, side), (1.5, LIE_BACK),
                             (2.2, add(LIE_BACK, {"chest": (-6, 0, 0), "head": (-6, 0, 20)})),
                             (3.0, add(LIE_BACK, {"head": (4, 0, 28), "upperarm_R": (0, 0, 8)}))])
    # Slap from the crawl: right hand swings back, then across.
    windup = add(CRAWL, {"upperarm_R": (-40, 0, -60), "forearm_R": (50, 0, 0), "chest": (0, 15, 0),
                         "loc": (0, 0.05, 0)})
    swing = add(CRAWL, {"upperarm_R": (30, 0, 40), "forearm_R": (5, 0, 0), "hand_R": (0, 0, 0),
                        "chest": (0, -20, 0), "hips": (0, -6, 0), "loc": (0, 0.05, 0)})
    make_clip(rig, "slap", [(0.0, CRAWL), (0.17, windup), (0.3, swing), (0.5, CRAWL)])
    hit = lambda d: add(CRAWL, {"head": (8, 28 * d, 22 * d), "neck": (0, 20 * d, 10 * d), "chest": (0, 8 * d, 0)})
    make_clip(rig, "slapped", [(0.0, CRAWL), (0.08, hit(1)), (0.25, hit(-0.6)), (0.42, hit(0.35)),
                               (0.6, hit(-0.15)), (0.8, CRAWL)])
    # Drink: kneel, cup water to the mouth.
    sip = add(KNEEL, {"upperarm_R": (60, 0, 12), "forearm_R": (100, 0, 0), "hand_R": (-20, 0, 0),
                      "upperarm_L": (60, 0, -12), "forearm_L": (100, 0, 0), "hand_L": (-20, 0, 0),
                      "head": (-25, 0, 0), "neck": (-5, 0, 0)})
    scoop = add(KNEEL, {"hips": (35, 0, 0), "upperarm_R": (75, 0, 0), "upperarm_L": (75, 0, 0),
                        "forearm_R": (20, 0, 0), "forearm_L": (20, 0, 0), "head": (10, 0, 0)})
    make_clip(rig, "drink", [(0.0, scoop), (0.7, sip), (1.5, sip), (2.2, scoop)])
    rig.animation_data.action = bpy.data.actions["crawl_idle"]


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    out = argv[0] if argv else "crawler.glb"
    rig, body = build()
    build_clips(rig)
    if len(argv) > 1:
        bpy.ops.wm.save_as_mainfile(filepath=argv[1])
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=out, export_format="GLB", export_animations=True,
                              export_animation_mode="ACTIONS", export_vertex_color="ACTIVE",
                              export_apply=True, export_skins=True, export_yup=True)
    print("[old_man] wrote", out)


if __name__ == "__main__":
    main()
