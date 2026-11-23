#!/usr/bin/env python3
"""Texture half of tools/build_people.mjs (Pillow + numpy).

Converts one Rocketbox avatar's TGA maps into web textures:
  color  → WebP (sRGB), optional looks: greying/whitening hair, ageing skin,
           clothing recolour (cloth = not skin, skin colour learnt from the face)
  normal → WebP, green flipped (3ds Max maps are Y-down, glTF is Y-up)
  rough  → greyscale JPEG from the specular-level map (matte skin, glossy eyes)
  rgba   → WebP with alpha (hair cards, glasses)
  thumb  → a small JPEG portrait from the avatar's preview render

  python3 -I build_people_tex.py <job.json>
job = {"maps": [{"kind", "src", "out", "size", "quality"?, "part"?}],
       "hairRef": path to the opacity map (for hair masks), "faceRef": head colour map,
       "look": {"hair": {"grey": 0..1, "white": 0..1}, "age": 0..1,
                "cloth": {"hue": deg, "sat": k, "val": k, "grey": 0..1}}, "debug": dir?}
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


def load_rgb(path):
    im = Image.open(path)
    im.load()
    return im


def resize(im, size):
    if im.size[0] == size and im.size[1] == size:
        return im
    if im.mode == 'RGBA':
        # Pillow resamples RGBA premultiplied: colour under (near-)zero alpha comes back as noise.
        # Our alpha is a mask (cloth / hair coverage), not opacity of the colour: resample apart.
        rgb = im.convert('RGB').resize((size, size), Image.LANCZOS)
        a = im.getchannel('A').resize((size, size), Image.LANCZOS)
        return Image.merge('RGBA', (*rgb.split(), a))
    return im.resize((size, size), Image.LANCZOS)


def to_f(im):
    return np.asarray(im, dtype=np.float32) / 255.0


def to_im(arr, mode=None):
    return Image.fromarray((np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8), mode)


def srgb_to_lin(c):
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def rgb_to_lab(rgb):
    lin = srgb_to_lin(rgb)
    m = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], np.float32)
    xyz = lin @ m.T
    xyz /= np.array([0.95047, 1.0, 1.08883], np.float32)
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def stats(lab, mask, reg=4.0):
    px = lab[mask]
    if len(px) < 50:
        return None
    return px.mean(0), np.linalg.inv(np.cov(px.T) + np.eye(3) * reg)


def mahal(lab, st):
    d = lab - st[0]
    return np.einsum('...i,ij,...j->...', d, st[1], d)


def face_skin_stats(head_rgb):
    """Skin colour model from the middle of the face (cheeks, nose, forehead)."""
    lab = rgb_to_lab(head_rgb)
    H, W = lab.shape[:2]
    sk = np.zeros((H, W), bool)
    sk[int(H * 0.17):int(H * 0.30), int(W * 0.40):int(W * 0.60)] = True
    # drop dark (brows, eye sockets) and very bright samples
    L = lab[..., 0]
    sk &= (L > np.percentile(L[sk], 15)) & (L < np.percentile(L[sk], 97))
    return stats(lab, sk, 6.0)


def hair_mask(head_rgb, hair_rgba, skin_st):
    """Soft mask of hair (scalp, brows, beard, hair cards) in the head colour map."""
    lab = rgb_to_lab(head_rgb)
    H, W = lab.shape[:2]
    if hair_rgba is not None:
        h = to_f(hair_rgba)
        st_hair = stats(rgb_to_lab(h[..., :3]), h[..., 3] > 0.7)
    else:
        # no hair cards: learn the hair colour from the back/sides of the head (the map's top corners)
        reg = np.zeros((H, W), bool)
        reg[int(H * 0.03):int(H * 0.2), int(W * 0.03):int(W * 0.22)] = True
        reg[int(H * 0.03):int(H * 0.2), int(W * 0.78):int(W * 0.97)] = True
        reg &= lab[..., 0] > 3
        if skin_st is not None:
            reg &= mahal(lab, skin_st) > 12
        st_hair = stats(lab, reg)
    if st_hair is None or skin_st is None:
        return np.zeros((H, W), np.float32)
    dh, ds = mahal(lab, st_hair), mahal(lab, skin_st)
    m = 1.0 / (1.0 + np.exp(-np.clip((ds - dh) * 0.35, -30, 30)))
    m[int(H * 0.6):, :int(W * 0.3)] = 0     # the mouth/eye atlas is never hair
    for x0, y0, x1, y1 in ((0.34, 0.24, 0.48, 0.335), (0.52, 0.24, 0.66, 0.335), (0.4, 0.355, 0.6, 0.43)):
        m[int(H * y0):int(H * y1), int(W * x0):int(W * x1)] = 0   # eye sockets, lips
    m[lab[..., 0] < 2] = 0                   # nor the empty atlas
    return m.astype(np.float32)


def skin_mask(rgb, skin_st):
    """1 where a texel looks like this person's skin (hands, neck), else 0."""
    d = mahal(rgb_to_lab(rgb), skin_st)
    return (1.0 / (1.0 + np.exp(np.clip((d - 9.0) * 0.6, -30, 30)))).astype(np.float32)


def blur(m, r):
    return to_f(Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r)))


LUMA = np.array([0.2126, 0.7152, 0.0722], np.float32)


def grey_hair(rgb, mask, grey, white):
    lum = (rgb * LUMA).sum(-1, keepdims=True)
    k = np.clip(grey + white, 0, 1)
    # silver keeps the strand contrast; white lifts it further
    base = 0.34 + 0.55 * white
    target = np.clip(base + (lum - lum.mean()) * (1.2 - 0.5 * white) + lum * 0.5, 0.05, 0.93)
    silver = np.concatenate([target * 0.985, target * 0.99, target], -1)
    w = mask[..., None] * k
    return rgb * (1 - w) + silver * w


def age_skin(rgb, mask, amount):
    lum = (rgb * LUMA).sum(-1, keepdims=True)
    desat = rgb * (1 - 0.22 * amount) + lum * 0.22 * amount
    crease = np.clip((0.5 - lum) * 0.6, 0, 1) * amount
    out = np.clip(desat * (1 - crease * 0.3), 0, 1)
    w = mask[..., None]
    return rgb * (1 - w) + out * w


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn + 1e-6
    h = np.where(mx == r, (g - b) / d % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    s = np.where(mx > 0, (mx - mn) / (mx + 1e-6), 0)
    return np.stack([h, s, mx], -1)


def hsv_to_rgb(hsv):
    h, s, v = hsv[..., 0] % 360, hsv[..., 1], hsv[..., 2]
    c = v * s
    x = c * (1 - np.abs((h / 60) % 2 - 1))
    m = v - c
    z = np.zeros_like(h)
    conds = [h < 60, h < 120, h < 180, h < 240, h < 300, h >= 300]
    rs = [c, x, z, z, x, c]
    gs = [x, c, c, x, z, z]
    bs = [z, z, x, c, c, x]
    r = np.select(conds, rs)
    g = np.select(conds, gs)
    b = np.select(conds, bs)
    return np.stack([r + m, g + m, b + m], -1)


def recolor_cloth(rgb, cloth, look):
    """Recolour clothing: grey (desaturate + set value), or hue/sat/val shifts."""
    hsv = rgb_to_hsv(rgb)
    if look.get('grey') is not None:
        lum = (rgb * LUMA).sum(-1, keepdims=True)
        g = look['grey']
        tgt = np.clip(lum * look.get('val', 1.0) + look.get('lift', 0.0), 0, 1)
        col = np.concatenate([tgt, tgt, tgt * 1.02], -1)
        out = rgb * (1 - g) + col * g
    else:
        hsv[..., 0] = hsv[..., 0] + look.get('hue', 0)
        hsv[..., 1] = np.clip(hsv[..., 1] * look.get('sat', 1.0), 0, 1)
        hsv[..., 2] = np.clip(hsv[..., 2] * look.get('val', 1.0) + look.get('lift', 0.0), 0, 1)
        out = hsv_to_rgb(hsv)
    w = cloth[..., None]
    return rgb * (1 - w) + out * w


def main():
    job = json.load(open(sys.argv[1]))
    look = job.get('look') or {}
    dbg = job.get('debug')
    hair_ref = load_rgb(job['hairRef']).convert('RGBA') if job.get('hairRef') else None
    face = to_f(load_rgb(job['faceRef']).convert('RGB')) if job.get('faceRef') else None
    skin_st = face_skin_stats(face) if face is not None else None
    for m in job['maps']:
        kind, size, q = m['kind'], m.get('size'), m.get('quality', 86)
        os.makedirs(os.path.dirname(m['out']), exist_ok=True)
        if kind == 'color':
            arr = to_f(load_rgb(m['src']).convert('RGB'))
            part = m.get('part')
            if part == 'head' and skin_st is not None:
                hl = look.get('hair') or {}
                if hl.get('grey') or hl.get('white'):
                    hm = blur(hair_mask(arr, hair_ref, skin_st), 2)
                    arr = grey_hair(arr, hm, hl.get('grey', 0), hl.get('white', 0))
                    if dbg:
                        to_im(hm).resize((512, 512)).save(os.path.join(dbg, 'hairmask.png'))
                if look.get('age'):
                    sm = blur(skin_mask(arr, skin_st), 3)
                    arr = age_skin(arr, sm, look['age'])
            for rg in look.get('regions', []):
                if rg.get('part', 'head') != part:
                    continue
                H, W = arr.shape[:2]
                x0, y0, x1, y1 = rg['rect']
                mk = np.zeros((H, W), np.float32)
                mk[int(H * y0):int(H * y1), int(W * x0):int(W * x1)] = 1
                arr = recolor_cloth(arr, blur(mk, 2), rg)
            cloth = None
            if part == 'body' and skin_st is not None:
                cloth = 1 - blur(skin_mask(arr, skin_st), 2)
                if look.get('cloth'):
                    arr = recolor_cloth(arr, cloth, look['cloth'])
                if dbg:
                    to_im(cloth).resize((512, 512)).save(os.path.join(dbg, 'clothmask.png'))
            if cloth is not None:
                # alpha = cloth mask (the game tints clothes, never hands)
                resize(to_im(np.concatenate([arr, cloth[..., None]], -1), 'RGBA'), size).save(m['out'], quality=q, method=6, alpha_quality=60, exact=True)
            else:
                resize(to_im(arr), size).save(m['out'], quality=q, method=6)
        elif kind == 'normal':
            r, g, b = load_rgb(m['src']).convert('RGB').split()
            g = g.point(lambda v: 255 - v)
            resize(Image.merge('RGB', (r, g, b)), size).save(m['out'], quality=min(96, q + 6), method=6)
        elif kind == 'rough':
            s = to_f(load_rgb(m['src']).convert('L'))
            # 3ds Max specular level → roughness: matte skin/cloth ~0.8, eyes/teeth/lips glossy
            rough = np.clip(0.9 - np.sqrt(s) * 0.9, 0.16, 0.95)
            resize(to_im(rough, 'L'), size).save(m['out'], quality=90)
        elif kind == 'rgba':
            im = load_rgb(m['src']).convert('RGBA')
            hl = look.get('hair') or {}
            if m.get('part') == 'hair' and (hl.get('grey') or hl.get('white')):
                a = to_f(im)
                rgb = grey_hair(a[..., :3], np.ones(a.shape[:2], np.float32), hl.get('grey', 0), hl.get('white', 0))
                im = to_im(np.concatenate([rgb, a[..., 3:]], -1), 'RGBA')
            # bleed colour into transparent texels so mips/filtering don't pull in black fringes
            a = to_f(im)
            alpha = a[..., 3:]
            rgb = a[..., :3]
            acc, wsum = rgb * alpha, alpha.copy()
            for r in (2, 6, 16):
                acc = acc + to_f(Image.fromarray((np.clip(rgb * alpha, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))) * 1.0
                wsum = wsum + blur(alpha[..., 0], r)[..., None]
            filled = np.where(alpha > 0.5, rgb, acc / np.maximum(wsum, 1e-3))
            im = to_im(np.concatenate([np.clip(filled, 0, 1), alpha], -1), 'RGBA')
            resize(im, size).save(m['out'], quality=q, method=6, alpha_quality=92, exact=True)
        elif kind == 'thumb':
            # a portrait for the character creator, cut from Rocketbox's T-pose render (head found by its alpha)
            im = load_rgb(m['src']).convert('RGBA')
            a = np.asarray(im)[..., 3] > 40
            W0 = a.shape[1]
            rows = np.where(a[:, W0 // 4:W0 * 3 // 4].any(1))[0]
            top = int(rows[0]) if len(rows) else 40
            band = a[top:top + 70, W0 // 4:W0 * 3 // 4]
            xs = np.where(band.any(0))[0] + W0 // 4
            cx = int(xs.mean()) if len(xs) else W0 // 2
            w, h = m.get('cut', [150, 177])
            x0, y0 = cx - w // 2, max(0, top - 14)
            bg = Image.new('RGBA', im.size, (27, 31, 36, 255))
            im = Image.alpha_composite(bg, im).convert('RGB')
            im = im.crop((x0, y0, x0 + w, y0 + h)).resize(tuple(m['px']), Image.LANCZOS)
            im.save(m['out'], quality=q, optimize=True)
        else:
            raise SystemExit('unknown map kind ' + kind)


if __name__ == '__main__':
    main()
