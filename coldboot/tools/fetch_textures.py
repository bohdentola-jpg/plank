#!/usr/bin/env python3
"""Fetch the CC0 PBR texture sets COLD BOOT's building kit uses and bake them
into small game-ready JPEGs:  assets/tex/<name>_col.jpg, _nrm.jpg, _rgh.jpg.

Sources (both CC0):
  Poly Haven  https://api.polyhaven.com/files/<asset_id>  (1k jpg: Diffuse, nor_gl, Rough, AO)
  ambientCG   https://ambientcg.com/get?file=<AssetId>_1K-JPG.zip

Usage (Pillow required; run isolated, downloads are untrusted data):
  python -I coldboot/tools/fetch_textures.py --dl /some/empty/scratch/dir [--out coldboot/assets/tex] [--size 512]

Conversion: ambient occlusion (if present) is multiplied into the colour map,
optional desaturation + brightness normalisation makes "tintable" bases
(materials.js multiplies them by any paint colour), maps are box-filtered down
to --size (exact 2x reductions keep them seamlessly tileable), JPEG q≈82.
CREDITS.md is written next to the textures.
"""
import argparse
import io
import json
import os
import sys
import urllib.request
import zipfile

from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageStat

UA = {'User-Agent': 'coldboot-texture-fetch/1.0'}

# name, source ('ph' | 'acg'), asset id, options
#   desat: True   -> greyscale colour map (for tinting in materials.js)
#   level: float  -> scale colour so mean sRGB luminance ≈ level (0..1)
#   ao: float     -> how much of the AO map to multiply in (default 0.7)
#   contrast: float -> colour contrast tweak (1 = unchanged)
#   rot90: True   -> rotate all maps 90° (so boards/ribs run the way the kit expects)
#   clean: int    -> grey-dilate the colour map (removes thin dark specks/twigs from snow)
ASSETS = [
    # --- siding & wood
    ('siding_lap', 'acg', 'WoodSiding009', {'desat': True, 'level': 0.78, 'contrast': 1.1}),
    ('siding_lap_old', 'acg', 'WoodSiding011', {}),
    ('siding_panel', 'ph', 'white_planks_clean', {'desat': True, 'level': 0.8}),
    ('siding_peel', 'ph', 'distressed_painted_planks', {'desat': True, 'level': 0.7, 'contrast': 1.15}),
    ('wood_weathered', 'ph', 'wood_planks_grey', {}),
    ('wood_raw', 'ph', 'brown_planks_09', {}),
    ('logs', 'ph', 'wood_trunk_wall', {}),
    ('plywood', 'ph', 'plywood', {}),
    ('osb', 'ph', 'oriented_strand_board', {}),
    ('wood_dark', 'ph', 'dark_wood', {}),
    ('wood_panel', 'ph', 'wooden_panels', {}),
    ('floor_wood', 'ph', 'wood_floor_worn', {}),
    # --- metal
    ('metal_corr', 'ph', 'corrugated_iron_02', {}),
    ('metal_corr_rust', 'ph', 'rusty_corrugated_iron', {}),
    ('metal_corr_paint', 'ph', 'box_profile_metal_sheet', {'desat': True, 'level': 0.72}),
    ('metal_rust', 'ph', 'rust_coarse_01', {}),
    ('metal_paint_rust', 'ph', 'rusty_metal_02', {}),
    ('diamond_plate', 'acg', 'DiamondPlate001', {}),
    # --- roofing
    ('roof_shingle', 'acg', 'RoofingTiles003', {'desat': True, 'level': 0.5, 'contrast': 1.25}),
    # --- masonry & ground
    ('concrete', 'ph', 'concrete_floor_worn_001', {}),
    ('brick', 'ph', 'brick_wall_02', {}),
    ('asphalt', 'ph', 'asphalt_02', {}),
    ('gravel', 'ph', 'gravel_floor_02', {}),
    ('snow', 'ph', 'snow_02', {'clean': 7, 'level': 0.86, 'contrast': 0.8}),
    ('snow_dirty', 'ph', 'snow_03', {}),
    ('rock', 'ph', 'dark_rock_02', {}),
    # --- interiors
    ('plaster', 'ph', 'painted_plaster_wall', {'desat': True, 'level': 0.8}),
    ('tile', 'ph', 'interior_tiles', {}),
    ('carpet', 'acg', 'Carpet016', {'desat': True, 'level': 0.7}),
    ('linoleum', 'ph', 'old_linoleum_flooring_01', {}),
]


def fetch(url, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 0:
        return dest
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    with open(dest, 'wb') as f:
        f.write(data)
    return dest


def ph_maps(asset, dl):
    """Poly Haven: download the 1k jpgs; returns {kind: path}, info dict."""
    files_json = os.path.join(dl, f'ph_{asset}_files.json')
    fetch(f'https://api.polyhaven.com/files/{asset}', files_json)
    info_json = os.path.join(dl, f'ph_{asset}_info.json')
    fetch(f'https://api.polyhaven.com/info/{asset}', info_json)
    files = json.load(open(files_json))
    info = json.load(open(info_json))
    want = {'col': ['Diffuse', 'diff'], 'nrm': ['nor_gl'], 'rgh': ['Rough', 'rough'], 'ao': ['AO', 'ao'], 'arm': ['arm']}
    out = {}
    for kind, keys in want.items():
        for k in keys:
            if k in files and '1k' in files[k] and 'jpg' in files[k]['1k']:
                url = files[k]['1k']['jpg']['url']
                out[kind] = fetch(url, os.path.join(dl, f'ph_{asset}_{kind}.jpg'))
                break
    dims = info.get('dimensions')  # [x_mm, y_mm]
    size_m = [dims[0] / 1000.0, dims[1] / 1000.0] if dims else None
    return out, {'url': f'https://polyhaven.com/a/{asset}', 'size_m': size_m, 'authors': list((info.get('authors') or {}).keys())}


def acg_maps(asset, dl):
    """ambientCG: download the 1K-JPG zip, pull the maps out by name (no extractall)."""
    zpath = fetch(f'https://ambientcg.com/get?file={asset}_1K-JPG.zip', os.path.join(dl, f'acg_{asset}_1K-JPG.zip'))
    meta_json = os.path.join(dl, f'acg_{asset}_meta.json')
    fetch(f'https://ambientcg.com/api/v2/full_json?id={asset}', meta_json)
    out = {}
    suffix = {'col': '_Color.jpg', 'nrm': '_NormalGL.jpg', 'rgh': '_Roughness.jpg', 'ao': '_AmbientOcclusion.jpg'}
    with zipfile.ZipFile(zpath) as z:
        for name in z.namelist():
            base = os.path.basename(name)
            for kind, suf in suffix.items():
                if base.endswith(suf):
                    dest = os.path.join(dl, f'acg_{asset}_{kind}.jpg')
                    if not os.path.exists(dest):
                        with z.open(name) as src, open(dest, 'wb') as f:
                            f.write(src.read())
                    out[kind] = dest
    size_m = None
    try:
        meta = json.load(open(meta_json))
        a = meta['foundAssets'][0]
        if a.get('dimensionX'):
            size_m = [a['dimensionX'] / 100.0, a['dimensionY'] / 100.0]
    except Exception:
        pass
    return out, {'url': f'https://ambientcg.com/a/{asset}', 'size_m': size_m, 'authors': ['ambientCG (Lennart Demes)']}


def shrink(im, size):
    w, h = im.size
    if w == h and w % size == 0 and w >= size:
        f = w // size
        return im.reduce(f) if f > 1 else im
    return im.resize((size, size), Image.LANCZOS)


def luminance_mean(im):
    return ImageStat.Stat(im.convert('L')).mean[0] / 255.0


def convert(name, maps, opts, out_dir, size, quality):
    if 'col' not in maps:
        raise RuntimeError(f'{name}: no colour map')
    col = Image.open(maps['col']).convert('RGB')
    ao = None
    if 'ao' in maps:
        ao = Image.open(maps['ao']).convert('L')
    elif 'arm' in maps:
        ao = Image.open(maps['arm']).convert('RGB').split()[0]
    if ao is not None:
        if ao.size != col.size:
            ao = ao.resize(col.size, Image.LANCZOS)
        k = opts.get('ao', 0.7)
        ao = ao.point(lambda v: int(255 - (255 - v) * k))
        col = Image.merge('RGB', [ImageChops.multiply(c, ao) for c in col.split()])
    if opts.get('clean'):
        col = col.filter(ImageFilter.MaxFilter(opts['clean'])).filter(ImageFilter.GaussianBlur(1.5))
    if opts.get('desat'):
        col = ImageOps.grayscale(col).convert('RGB')
    if opts.get('contrast'):
        col = ImageEnhance.Contrast(col).enhance(opts['contrast'])
    if opts.get('level'):
        m = luminance_mean(col)
        if m > 0.01:
            col = col.point(lambda v: min(255, int(v * opts['level'] / m)))
    if opts.get('rot90'):
        col = col.rotate(90, expand=True)
    col = shrink(col, size)
    col.save(os.path.join(out_dir, f'{name}_col.jpg'), quality=quality, optimize=True, progressive=False)

    if 'nrm' in maps:
        n = Image.open(maps['nrm']).convert('RGB')
        if opts.get('rot90'):
            # rotating a tangent-space normal map 90° CCW: (x, y) -> (-y, x)
            r, g, b = n.split()
            n = Image.merge('RGB', [ImageOps.invert(g), r, b]).rotate(90, expand=True)
        n = shrink(n, size)
        n.save(os.path.join(out_dir, f'{name}_nrm.jpg'), quality=quality, optimize=True)
    rg = None
    if 'rgh' in maps:
        rg = Image.open(maps['rgh']).convert('L')
    elif 'arm' in maps:
        rg = Image.open(maps['arm']).convert('RGB').split()[1]
    if rg is not None:
        if opts.get('rot90'):
            rg = rg.rotate(90, expand=True)
        rg = shrink(rg, size)
        rg.save(os.path.join(out_dir, f'{name}_rgh.jpg'), quality=quality, optimize=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dl', required=True, help='scratch download directory (its own empty dir)')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'tex'))
    ap.add_argument('--size', type=int, default=512)
    ap.add_argument('--quality', type=int, default=82)
    ap.add_argument('--only', default='', help='comma list of names')
    a = ap.parse_args()
    os.makedirs(a.dl, exist_ok=True)
    os.makedirs(a.out, exist_ok=True)
    only = set(x for x in a.only.split(',') if x)
    credits = []
    for name, src, asset, opts in ASSETS:
        if only and name not in only:
            continue
        try:
            maps, meta = (ph_maps if src == 'ph' else acg_maps)(asset, a.dl)
            convert(name, maps, opts, a.out, a.size, a.quality)
            credits.append((name, src, asset, meta))
            print(f'ok  {name:18s} {src}:{asset:28s} maps={sorted(maps)} size_m={meta["size_m"]}')
        except Exception as e:  # keep going; materials.js has procedural fallbacks
            print(f'ERR {name}: {e}', file=sys.stderr)
    if not only:
        lines = ['# Texture credits', '',
                 'All textures in this folder are **CC0 (public domain)**, downscaled to 512x512 JPEG by',
                 '`coldboot/tools/fetch_textures.py` (ambient occlusion multiplied into the colour map;',
                 'some colour maps desaturated so the game can tint them).', '',
                 '| file prefix | source asset | source URL | author(s) | license |',
                 '|---|---|---|---|---|']
        for name, src, asset, meta in credits:
            site = 'Poly Haven' if src == 'ph' else 'ambientCG'
            authors = ', '.join(meta.get('authors') or []) or site
            lines.append(f'| `{name}` | {site} `{asset}` | {meta["url"]} | {authors} | CC0 1.0 |')
        lines += ['', 'Poly Haven: https://polyhaven.com/license — ambientCG: https://docs.ambientcg.com/license/', '']
        with open(os.path.join(a.out, 'CREDITS.md'), 'w') as f:
            f.write('\n'.join(lines))
    total = sum(os.path.getsize(os.path.join(a.out, f)) for f in os.listdir(a.out))
    print(f'total {total / 1e6:.2f} MB in {a.out}')


if __name__ == '__main__':
    main()
