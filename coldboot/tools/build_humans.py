#!/usr/bin/env python3
"""Bake the MakeHuman hm08 base mesh (CC0) into a compact runtime bundle.

  python3 build_humans.py <makehuman/data dir> <coldboot/assets/human dir>

Writes hm.json (layout + skeleton + target table) and hm.bin (little-endian
arrays). Everything is in metres, Y up, the default body standing on y = 0,
facing +Z.

Bundle contents
  basePos      f32 [N,3]   every base-mesh vertex (body, helpers, joint cubes)
  parts        per render part: map u16 [n] (base vertex of each render vertex,
               split at UV seams), uv f32 [n,2], index u16|u32 [m*3]
  targets      sparse morphs: idx u16 [k], delta i16 [k,3] (× scale)
  skin         top-4 bone index u8 [N,4] + weight u8 [N,4]
  ao           u8 [N]       baked ambient occlusion (body)
  face         i16 [N,3]    face coordinates (×1000): offset from between the
                            eyes in units of half the eye distance
  lip          u8 [N]       vermilion mask from the lip-volume targets
  scalp        u8 [N]       where hair grows (near the hair helper)
  eye proxy    refs/weights/offsets to fit the high-poly eyes to the morphed mesh
"""
import json
import math
import os
import shutil
import sys

import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.spatial import cKDTree

DATA = sys.argv[1]
OUT = sys.argv[2]
os.makedirs(OUT, exist_ok=True)
DM = 0.1  # MakeHuman decimetres → metres


# ----------------------------------------------------------------- base mesh
def parse_obj(path):
    V, VT, F = [], [], []
    grp = None
    for line in open(path):
        t = line.split()
        if not t:
            continue
        if t[0] == 'v':
            V.append([float(x) for x in t[1:4]])
        elif t[0] == 'vt':
            VT.append([float(x) for x in t[1:3]])
        elif t[0] == 'g':
            grp = t[1] if len(t) > 1 else None
        elif t[0] == 'f':
            corners = []
            for c in t[1:]:
                parts = c.split('/')
                vi = int(parts[0]) - 1
                ti = int(parts[1]) - 1 if len(parts) > 1 and parts[1] else -1
                corners.append((vi, ti))
            F.append((grp, corners))
    return np.array(V, np.float64), np.array(VT, np.float64), F


V, VT, F = parse_obj(os.path.join(DATA, '3dobjs/base.obj'))
N = len(V)
groups = {}
for g, c in F:
    groups.setdefault(g, []).append(c)
body_vids = sorted({vi for c in groups['body'] for vi, _ in c})
foot_min = V[body_vids, 1].min()
P = (V - np.array([0, foot_min, 0])) * DM  # metres, feet on y=0
print(f'base mesh: {N} verts, {len(F)} quads, height {(V[body_vids,1].max()-foot_min)*DM:.3f} m')


def tri_from_quads(quads):
    tris = []
    for c in quads:
        if len(c) == 4:
            tris.append((c[0], c[1], c[2]))
            tris.append((c[0], c[2], c[3]))
        else:
            for i in range(1, len(c) - 1):
                tris.append((c[0], c[i], c[i + 1]))
    return tris


def make_part(quads):
    """Split at UV seams: one render vertex per (vertex, uv) pair."""
    key = {}
    vmap, uvs, idx = [], [], []
    for tri in tri_from_quads(quads):
        for vi, ti in tri:
            k = (vi, ti)
            r = key.get(k)
            if r is None:
                r = len(vmap)
                key[k] = r
                vmap.append(vi)
                uvs.append(VT[ti] if ti >= 0 else (0.0, 0.0))
            idx.append(r)
    return np.array(vmap, np.uint16), np.array(uvs, np.float32), np.array(idx, np.uint32)


# ------------------------------------------------------------------ skeleton
skel = json.load(open(os.path.join(DATA, 'rigs/default.mhskel')))
bones_def = skel['bones']
order = []
seen = set()


def visit(name):
    if name in seen:
        return
    par = bones_def[name].get('parent')
    if par:
        visit(par)
    seen.add(name)
    order.append(name)


for b in sorted(bones_def):
    visit(b)
bone_index = {b: i for i, b in enumerate(order)}
bones_out = []
for b in order:
    d = bones_def[b]
    plane = d.get('rotation_plane')
    if plane == [None, None, None] or plane == 0:
        plane = None
    bones_out.append({'name': b, 'parent': d.get('parent'), 'head': d['head'], 'tail': d['tail'], 'plane': plane})
joints = skel['joints']
planes = skel['planes']

# weights → top 4 per vertex
wfile = json.load(open(os.path.join(DATA, 'rigs/default_weights.mhw')))['weights']
per_v = [[] for _ in range(N)]
for bname, lst in wfile.items():
    bi = bone_index[bname]
    for vi, w in lst:
        per_v[vi].append((w, bi))
skin_i = np.zeros((N, 4), np.uint8)
skin_w = np.zeros((N, 4), np.uint8)
unweighted = 0
for vi in range(N):
    lst = sorted(per_v[vi], reverse=True)[:4]
    if not lst:
        unweighted += 1
        lst = [(1.0, bone_index['root'])]
    tot = sum(w for w, _ in lst)
    ws = [w / tot for w, _ in lst]
    q = [int(round(w * 255)) for w in ws]
    q[0] += 255 - sum(q)
    for k, (w, bi) in enumerate(lst):
        skin_i[vi, k] = bi
        skin_w[vi, k] = q[k]
print(f'skeleton: {len(order)} bones, {len(wfile)} weighted, {unweighted} unweighted verts')

# ------------------------------------------------------------------- normals
def vertex_normals(pos, quads):
    nrm = np.zeros_like(pos)
    tris = np.array([[a[0], b[0], c[0]] for a, b, c in tri_from_quads(quads)])
    a, b, c = pos[tris[:, 0]], pos[tris[:, 1]], pos[tris[:, 2]]
    fn = np.cross(b - a, c - a)
    for k in range(3):
        np.add.at(nrm, tris[:, k], fn)
    ln = np.linalg.norm(nrm, axis=1, keepdims=True)
    ln[ln == 0] = 1
    return nrm / ln


NRM = vertex_normals(P, groups['body'])

# ------------------------------------------------------------- head vs body
HEAD_BONES = {'head', 'neck01', 'neck02', 'neck03', 'jaw'} | {b for b in order if any(b.startswith(p) for p in (
    'eye', 'oris', 'levator', 'risorius', 'orbicularis', 'oculi', 'temporalis', 'special0', 'tongue'))}
headness = np.zeros(N)
for vi in range(N):
    for w, bi in per_v[vi]:
        if order[bi] in HEAD_BONES:
            headness[vi] += w
neck_base_y = np.mean(P[joints['neck01____head'], 1])
head_quads, body_quads = [], []
for c in groups['body']:
    ys = [P[vi, 1] for vi, _ in c]
    if min(ys) > neck_base_y - 0.035:
        head_quads.append(c)
    else:
        body_quads.append(c)
print(f'head quads {len(head_quads)}, body quads {len(body_quads)} (neck base y={neck_base_y:.3f})')
head_vset = {vi for c in head_quads for vi, _ in c}

# ------------------------------------------------------------------- parts
PARTS = {
    'head': head_quads,
    'body': body_quads,
    'tights': groups['helper-tights'],
    'skirt': groups['helper-skirt'],
    'hair': groups['helper-hair'],
    'lashes': sum((groups[g] for g in groups if 'eyelashes' in g), []),
    'teeth': groups['helper-upper-teeth'] + groups['helper-lower-teeth'],
    'tongue': groups['helper-tongue'],
}

blob = bytearray()
layout = {}


def put(name, arr):
    arr = np.ascontiguousarray(arr)
    while len(blob) % 8:
        blob.append(0)
    layout[name] = {'o': len(blob), 'n': int(arr.size), 't': str(arr.dtype), 's': list(arr.shape)}
    blob.extend(arr.tobytes())


put('basePos', P.astype(np.float32))
parts_meta = {}
for name, quads in PARTS.items():
    vmap, uv, idx = make_part(quads)
    if len(vmap) < 65536:
        idx = idx.astype(np.uint16)
    put(f'part.{name}.map', vmap)
    put(f'part.{name}.uv', uv)
    put(f'part.{name}.index', idx)
    parts_meta[name] = {'verts': int(len(vmap)), 'tris': int(len(idx) // 3)}
    print(f'part {name}: {len(vmap)} verts, {len(idx)//3} tris')

put('skin.i', skin_i)
put('skin.w', skin_w)

# ------------------------------------------------------------------ targets
def read_target(path):
    idx, d = [], []
    for line in open(path):
        t = line.split()
        if not t or t[0].startswith('#'):
            continue
        idx.append(int(t[0]))
        d.append([float(t[1]), float(t[2]), float(t[3])])
    return np.array(idx, np.int64), np.array(d, np.float64) * DM


targets_meta = []
total_entries = 0


def add_target(name, path, restrict=None):
    global total_entries
    idx, d = read_target(path)
    if restrict is not None and len(idx):
        keep = np.array([i in restrict for i in idx])
        idx, d = idx[keep], d[keep]
    mag = np.abs(d).max(axis=1) if len(idx) else np.zeros(0)
    keep = mag > 2e-5
    idx, d = idx[keep], d[keep]
    scale = float(np.abs(d).max()) / 32767 if len(idx) else 1.0
    q = np.round(d / scale).astype(np.int16) if len(idx) else np.zeros((0, 3), np.int16)
    tid = len(targets_meta)
    put(f't{tid}.i', idx.astype(np.uint16))
    put(f't{tid}.d', q)
    targets_meta.append({'name': name, 'k': int(len(idx)), 'scale': scale})
    total_entries += len(idx)


T = os.path.join(DATA, 'targets')
for g in ('female', 'male'):
    for a in ('young', 'old'):
        for m in ('minmuscle', 'averagemuscle', 'maxmuscle'):
            for w in ('minweight', 'averageweight', 'maxweight'):
                add_target(f'macro/universal-{g}-{a}-{m}-{w}', os.path.join(T, f'macrodetails/universal-{g}-{a}-{m}-{w}.target'))
for r in ('african', 'asian', 'caucasian'):
    for g in ('female', 'male'):
        for a in ('young', 'old'):
            add_target(f'macro/{r}-{g}-{a}', os.path.join(T, f'macrodetails/{r}-{g}-{a}.target'))
DETAIL_GROUPS = ['head', 'forehead', 'eyebrows', 'neck', 'eyes', 'nose', 'mouth', 'ears', 'chin', 'cheek',
                 'torso', 'hip', 'stomach', 'buttocks']
for grp in DETAIL_GROUPS:
    for f in sorted(os.listdir(os.path.join(T, grp))):
        if f.endswith('.target'):
            add_target(f'{grp}/{f[:-7]}', os.path.join(T, grp, f))
EXPR = os.path.join(T, 'expression/units/caucasian')
expr_restrict = head_vset | {vi for g in ('helper-upper-teeth', 'helper-lower-teeth', 'helper-tongue') for c in groups[g] for vi, _ in c} \
    | {vi for g in groups if 'eyelashes' in g for c in groups[g] for vi, _ in c} \
    | {vi for g in ('helper-l-eye', 'helper-r-eye') for c in groups[g] for vi, _ in c}
for f in sorted(os.listdir(EXPR)):
    if f.endswith('.target'):
        add_target(f'expr/{f[:-7]}', os.path.join(EXPR, f), restrict=expr_restrict)
print(f'targets: {len(targets_meta)}, {total_entries} entries ({total_entries*8/1e6:.2f} MB)')

# ----------------------------------------------------- eyes (mhclo proxy fit)
def parse_mhclo(path):
    meta, refs = {}, []
    in_verts = False
    for line in open(path):
        t = line.split()
        if not t or t[0].startswith('#'):
            continue
        if t[0] == 'verts':
            in_verts = True
            continue
        if in_verts:
            if len(t) == 9:
                refs.append([float(x) for x in t])
                continue
            in_verts = False
        meta[t[0]] = t[1:]
    return meta, np.array(refs)


emeta, erefs = parse_mhclo(os.path.join(DATA, 'eyes/high-poly/high-poly.mhclo'))
EV, EVT, EF = parse_obj(os.path.join(DATA, 'eyes/high-poly/high-poly.obj'))
assert len(erefs) == len(EV), (len(erefs), len(EV))
key, emap, euv, eidx = {}, [], [], []
for g, c in EF:
    for tri in tri_from_quads([c]):
        for vi, ti in tri:
            k = (vi, ti)
            r = key.get(k)
            if r is None:
                r = len(emap)
                key[k] = r
                emap.append(vi)
                euv.append(EVT[ti])
            eidx.append(r)
# split eyeball (opaque) from the cornea shell (samples the texture's clear disc)
eimg = np.array(Image.open(os.path.join(DATA, 'eyes/materials/brown_eye.png')).convert('RGBA'))
EH = eimg.shape[0]
ball, cornea = [], []
euv_a = np.array(euv)
for t in range(0, len(eidx), 3):
    tri = eidx[t:t + 3]
    uv = euv_a[tri].mean(axis=0)
    a = eimg[int((1 - uv[1]) * (EH - 1)), int(uv[0] * (EH - 1)), 3]
    (cornea if a < 128 else ball).extend(tri)
put('eye.map', np.array(emap, np.uint16))
put('eye.uv', np.array(euv, np.float32))
put('eye.index', np.array(ball + cornea, np.uint16))
eye_groups = [len(ball), len(cornea)]
print(f'eyes: {len(ball)//3} ball tris, {len(cornea)//3} cornea tris')
put('eye.refs', erefs[:, 0:3].astype(np.uint16))
put('eye.w', erefs[:, 3:6].astype(np.float32))
put('eye.off', (erefs[:, 6:9] * DM).astype(np.float32))
eye_scale = {ax: [int(emeta[f'{ax}_scale'][0]), int(emeta[f'{ax}_scale'][1]), float(emeta[f'{ax}_scale'][2]) * DM] for ax in 'xyz'}
# which proxy verts belong to the left eye (+x)
put('eye.side', (EV[:, 0] > 0).astype(np.uint8))
img = Image.open(os.path.join(DATA, 'eyes/materials/brown_eye.png')).convert('RGBA').resize((512, 512), Image.LANCZOS)
img.save(os.path.join(OUT, 'eye.png'))

# ------------------------------------------------------- face coordinates
le = P[sorted({vi for c in groups['helper-l-eye'] for vi, _ in c})].mean(axis=0)
re = P[sorted({vi for c in groups['helper-r-eye'] for vi, _ in c})].mean(axis=0)
mid = (le + re) / 2
half = np.linalg.norm(le - re) / 2
face = ((P - mid) / half * 1000).clip(-32000, 32000).astype(np.int16)
put('face', face)
print(f'eyes at {le.round(3)} / {re.round(3)}, half-distance {half*100:.2f} cm')

# lip mask from the lip-volume targets
lipmag = np.zeros(N)
for f in ('mouth-upperlip-volume-incr', 'mouth-lowerlip-volume-incr'):
    idx, d = read_target(os.path.join(T, 'mouth', f + '.target'))
    np.maximum.at(lipmag, idx, np.linalg.norm(d, axis=1))
lip = (lipmag / max(lipmag.max(), 1e-9)).clip(0, 1)
put('lip', (lip * 255).astype(np.uint8))

# scalp: body vertices close to the hair helper's cap (above the ears)
hair_v = np.array(sorted({vi for c in groups['helper-hair'] for vi, _ in c}))
tree = cKDTree(P[hair_v])
dist, _ = tree.query(P)
ear_y = mid[1] - half * 0.6
scalp = np.clip(1 - (dist - 0.006) / 0.02, 0, 1) * (P[:, 1] > ear_y - 0.02)
scalp[[i for i in range(N) if i not in head_vset]] = 0
put('scalp', (scalp * 255).astype(np.uint8))

# --------------------------------------------------------- ambient occlusion
def fib_sphere(n):
    i = np.arange(n) + 0.5
    phi = np.arccos(1 - 2 * i / n)
    th = math.pi * (1 + 5 ** 0.5) * i
    return np.stack([np.cos(th) * np.sin(phi), np.cos(phi), np.sin(th) * np.sin(phi)], 1)


def ao_pass(points, normals, occluders, res, dirs, eps, dil):
    vis = np.zeros(len(points))
    wsum = np.zeros(len(points))
    for d in dirs:
        up = np.array([0, 1, 0]) if abs(d[1]) < 0.9 else np.array([1, 0, 0])
        u = np.cross(d, up); u /= np.linalg.norm(u)
        v = np.cross(d, u)
        allp = np.concatenate([occluders, points])
        pu, pv = allp @ u, allp @ v
        lo_u, lo_v = pu.min(), pv.min()
        span = max(pu.max() - lo_u, pv.max() - lo_v) + 1e-6
        iu = ((pu - lo_u) / span * (res - 1)).astype(int)
        iv = ((pv - lo_v) / span * (res - 1)).astype(int)
        depth = allp @ d
        zb = np.full((res, res), -1e9)
        no = len(occluders)
        np.maximum.at(zb, (iu[:no], iv[:no]), depth[:no])
        zb = ndimage.maximum_filter(zb, size=dil)
        dp = depth[no:]
        visible = dp >= zb[iu[no:], iv[no:]] - eps
        w = np.clip(normals @ d, 0, None)
        vis += w * visible
        wsum += w
    return np.where(wsum > 0, vis / np.maximum(wsum, 1e-9), 1)


dirs = fib_sphere(128)
body_idx = np.array(body_vids)
ao = np.ones(N)
ao_body = ao_pass(P[body_idx], NRM[body_idx], P[body_idx], 300, dirs, 0.012, 3)
head_idx = np.array(sorted(head_vset))
ao_head = ao_pass(P[head_idx], NRM[head_idx], P[head_idx], 420, dirs, 0.004, 3)
ao[body_idx] = ao_body
for k, vi in enumerate(head_idx):
    ao[vi] = min(ao[vi], ao_head[k])
# soften (average with neighbours twice)
nbrs = [[] for _ in range(N)]
for c in groups['body']:
    for a in range(len(c)):
        x, y = c[a][0], c[(a + 1) % len(c)][0]
        nbrs[x].append(y); nbrs[y].append(x)
for _ in range(2):
    ao2 = ao.copy()
    for vi in body_vids:
        if nbrs[vi]:
            ao2[vi] = 0.5 * ao[vi] + 0.5 * np.mean(ao[nbrs[vi]])
    ao = ao2
print(f'AO: body mean {ao[body_idx].mean():.3f}, min {ao[body_idx].min():.3f}')
put('ao', (ao.clip(0, 1) * 255).astype(np.uint8))

# --------------------------------------------------------------------- write
meta = {
    'version': 1,
    'license': 'Base mesh, targets, rig, weights and eye texture: MakeHuman (CC0 1.0).',
    'N': N,
    'layout': layout,
    'parts': parts_meta,
    'bones': bones_out,
    'joints': joints,
    'planes': planes,
    'targets': targets_meta,
    'eyeScale': eye_scale,
    'eyeGroups': eye_groups,
    'eyeCenters': {'l': le.tolist(), 'r': re.tolist(), 'half': half},
    'neckBaseY': float(neck_base_y),
    'boneIndex': bone_index,
}
with open(os.path.join(OUT, 'hm.bin'), 'wb') as f:
    f.write(bytes(blob))
with open(os.path.join(OUT, 'hm.json'), 'w') as f:
    json.dump(meta, f, separators=(',', ':'))
print(f'wrote hm.bin {len(blob)/1e6:.2f} MB, hm.json {os.path.getsize(os.path.join(OUT, "hm.json"))/1e3:.0f} KB')
