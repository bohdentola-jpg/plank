// Character creator — framed as Ivan making your papers: "КТО ТЫ?" Who are you?
// A passport photo booth with your new face on a turntable, and tabs of
// sliders. The result is saved as the profile (store 'profile') and used by
// every scene that shows Rybka.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, panel, hints, vText, hit, statBar, roundRect } from '../core/ui.js';
import { buildCharacter } from '../human/character.js';
import { Animator } from '../human/anim.js';
import { CAST } from '../data/cast.js';
import { getEnvMap } from '../core/envmap.js';
import { store } from '../core/settings.js';
import { makeRng } from '../core/util.js';
import { sfx } from '../audio/sfx.js';

const HAIR_COLORS = ['#0e0b09', '#2b1d14', '#3a2618', '#5a4026', '#7a5634', '#a07848', '#c8a066', '#e0c890', '#8c3a1e', '#b04a22', '#9a948c', '#d8d4cc', '#2a3a6a', '#6a2a5a'];
const EYE_COLORS = ['#3a2412', '#5a3a22', '#7a5a2a', '#4a6a5a', '#3f6a3a', '#5d7286', '#6c8a9a', '#3a5a8a', '#7a8a9a', '#5a4a6a'];
const CLOTH_COLORS = ['#3e5468', '#6a7a88', '#5a6a4e', '#7a4a32', '#8e2a24', '#2a2a2e', '#d8cdb8', '#9a8a62', '#3c4e68', '#7a7e86', '#5a3e6a', '#c87a30'];
const OUTFITS = [
  { name: 'Sweater & jeans', top: { pattern: 'knit', thick: 0.008 }, bottom: { pattern: 'denim', thick: 0.004 } },
  { name: 'Flannel & work pants', top: { pattern: 'plaid', thick: 0.006, color2: '#141414', color3: '#c8a040' }, bottom: { pattern: 'duck', thick: 0.007 } },
  { name: 'Hoodie & jeans', top: { pattern: 'fleece', thick: 0.012 }, bottom: { pattern: 'denim', thick: 0.004 } },
  { name: 'Turtleneck & wool', top: { pattern: 'rib', thick: 0.007, neckUp: 0.03 }, bottom: { pattern: 'wool', thick: 0.005 } },
];

// face sliders: [label, modifier(s), mirrored pair?]
const FACE = [
  ['Face width', 'head/head-scale-horiz'], ['Face length', 'head/head-scale-vert'], ['Fullness', 'head/head-fat'],
  ['Square jaw', 'head/head-square', 'pos'], ['Chin width', 'chin/chin-width'], ['Chin forward', 'chin/chin-prominent'],
  ['Chin height', 'chin/chin-height'], ['Cheekbones', 'cheek/l-cheek-bones', 'lr'], ['Cheeks', 'cheek/l-cheek-volume', 'lr'],
  ['Brow height', 'eyebrows/eyebrows-trans'], ['Brow angle', 'eyebrows/eyebrows-angle'],
  ['Eye size', 'eyes/l-eye-scale', 'lr'], ['Eye spacing', 'eyes/l-eye-trans', 'lrIn'], ['Eye tilt', 'eyes/l-eye-corner1', 'lr'],
  ['Eyelid fold', 'eyes/l-eye-epicanthus', 'lr'], ['Under-eye', 'eyes/l-eye-bag', 'lr'],
  ['Nose width', 'nose/nose-scale-horiz'], ['Nose length', 'nose/nose-scale-vert'], ['Nose bridge', 'nose/nose-hump'],
  ['Nose tip', 'nose/nose-point'], ['Nostrils', 'nose/nose-nostrils-width'],
  ['Mouth width', 'mouth/mouth-scale-horiz'], ['Upper lip', 'mouth/mouth-upperlip-volume'], ['Lower lip', 'mouth/mouth-lowerlip-volume'],
  ['Mouth corners', 'mouth/mouth-angles'], ['Ears', 'ears/l-ear-scale', 'lr'], ['Ear angle', 'ears/l-ear-flap', 'lr'],
];

function setFace(dna, [, mod, kind], v) {
  dna.face = { ...(dna.face || {}) };
  if (kind === 'lr' || kind === 'lrIn') {
    dna.face[mod] = v;
    dna.face[mod.replace('/l-', '/r-')] = v;
  } else dna.face[mod] = kind === 'pos' ? Math.max(0, v) : v;
}
function getFace(dna, [, mod]) { return dna.face?.[mod] ?? 0; }

function defaultProfile() {
  const p = store.load('profile');
  if (p?.dna) return JSON.parse(JSON.stringify(p));
  return { name: '', outfit: 0, colors: { top: 1, bottom: 8 }, dna: JSON.parse(JSON.stringify(CAST.player.dna)) };
}

function outfitFor(prof) {
  const o = OUTFITS[prof.outfit] || OUTFITS[0];
  return [
    { slot: 'top', hem: 'hip', ...o.top, color: CLOTH_COLORS[prof.colors.top] },
    { slot: 'bottom', ...o.bottom, color: CLOTH_COLORS[prof.colors.bottom] },
    { slot: 'boots', pattern: 'leather', color: '#3a2618', thick: 0.012, shaft: 0.3 },
  ];
}

function randomize(prof, seed) {
  const r = makeRng(seed);
  const d = prof.dna;
  d.seed = Math.floor(r() * 1e6);
  d.sex = r() < 0.5 ? r() * 0.15 : 0.85 + r() * 0.15;
  d.age = Math.round(22 + r() * 30);
  d.muscle = 0.3 + r() * 0.5; d.weight = 0.3 + r() * 0.45; d.height = 0.95 + r() * 0.08;
  const a = r(), b = r(), c = r() * 2;
  d.ethnic = { african: a * a, asian: b * b, caucasian: c };
  const dark = (d.ethnic.african / (d.ethnic.african + d.ethnic.asian + d.ethnic.caucasian));
  d.skin = { tone: Math.min(1, 0.08 + dark * 0.85 + r() * 0.15), warmth: 0.35 + r() * 0.4, rosy: r(), freckles: r() < 0.2 ? r() * 0.5 : 0 };
  d.face = {};
  for (const f of FACE) if (r() < 0.6) setFace(d, f, (r() * 2 - 1) * 0.6);
  const hc = dark > 0.4 || r() < 0.4 ? r.int(0, 2) : r.int(0, HAIR_COLORS.length - 3);
  const styles = d.sex > 0.5 ? ['buzz', 'short', 'swept', 'messy', 'short'] : ['bun', 'bob', 'long', 'short', 'messy'];
  d.hair = { style: r.pick(styles), color: HAIR_COLORS[hc], recede: d.sex > 0.5 && d.age > 38 ? r() * 0.7 : 0 };
  d.brows = { color: HAIR_COLORS[Math.min(hc, 6)], density: 0.6 + r() * 0.35, thickness: 0.3 + r() * 0.5 };
  d.eyes = { color: r.pick(dark > 0.4 ? EYE_COLORS.slice(0, 3) : EYE_COLORS) };
  d.beard = d.sex > 0.5 ? { style: r.pick(['none', 'none', 'short', 'full', 'moustache', 'goatee']), stubble: r() * 0.8 } : { style: 'none', stubble: 0 };
  prof.outfit = r.int(0, OUTFITS.length - 1);
  prof.colors = { top: r.int(0, CLOTH_COLORS.length - 1), bottom: r.int(0, CLOTH_COLORS.length - 1) };
}

registerScreen('creator', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 50);
  const prof = defaultProfile();
  let ch = null, anim = null, building = false, dirty = true, dirtyT = 0;
  let tab = 0, row = 0, yaw = 0.25, camMode = 'full', camK = 0, t = 0;
  let naming = false;
  const TABS = ['IDENTITY', 'BODY', 'FACE', 'COLOURING', 'HAIR', 'CLOTHES'];

  const rows = () => {
    const d = prof.dna;
    switch (TABS[tab]) {
      case 'IDENTITY': return [
        { label: 'Name', kind: 'name' },
        { label: 'Body', kind: 'slider', get: () => d.sex, set: (v) => { d.sex = v; }, min: 0, max: 1, fmt: (v) => (v < 0.35 ? 'feminine' : v > 0.65 ? 'masculine' : 'androgynous') },
        { label: 'Randomize', kind: 'action', act: () => { randomize(prof, Date.now()); dirty = true; } },
      ];
      case 'BODY': return [
        { label: 'Age', kind: 'slider', get: () => d.age, set: (v) => { d.age = Math.round(v); }, min: 18, max: 72, fmt: (v) => `${Math.round(v)}` },
        { label: 'Height', kind: 'slider', get: () => d.height, set: (v) => { d.height = v; }, min: 0.9, max: 1.1, fmt: (v) => { const cm = v * (d.sex > 0.5 ? 176 : 163); const inch = cm / 2.54; return `${Math.floor(inch / 12)}'${Math.round(inch % 12)}"`; } },
        { label: 'Muscle', kind: 'slider', get: () => d.muscle, set: (v) => { d.muscle = v; }, min: 0, max: 1 },
        { label: 'Weight', kind: 'slider', get: () => d.weight, set: (v) => { d.weight = v; }, min: 0, max: 1 },
      ];
      case 'FACE': return FACE.map((f) => ({ label: f[0], kind: 'slider', get: () => getFace(d, f), set: (v) => setFace(d, f, v), min: -1, max: 1, face: true }));
      case 'COLOURING': {
        const e = d.ethnic;
        const tot = () => (e.african || 0) + (e.asian || 0) + (e.caucasian || 0) || 1;
        const eth = (k, label) => ({ label, kind: 'slider', get: () => (e[k] || 0) / tot(), set: (v) => {
          const others = Object.keys(e).filter((x) => x !== k);
          const rest = others.reduce((s, x) => s + (e[x] || 0), 0) || 1;
          e[k] = v;
          for (const x of others) e[x] = (e[x] || 0) / rest * (1 - v) || (1 - v) / 2;
        }, min: 0, max: 1 });
        return [
          eth('caucasian', 'European'), eth('african', 'African'), eth('asian', 'Asian / Native'),
          { label: 'Skin tone', kind: 'slider', get: () => d.skin.tone, set: (v) => { d.skin = { ...d.skin, tone: v }; }, min: 0, max: 1 },
          { label: 'Undertone', kind: 'slider', get: () => d.skin.warmth, set: (v) => { d.skin = { ...d.skin, warmth: v }; }, min: 0, max: 1, fmt: (v) => (v < 0.4 ? 'cool' : v > 0.6 ? 'warm' : 'neutral') },
          { label: 'Rosiness', kind: 'slider', get: () => d.skin.rosy ?? 0.5, set: (v) => { d.skin = { ...d.skin, rosy: v }; }, min: 0, max: 1 },
          { label: 'Freckles', kind: 'slider', get: () => d.skin.freckles ?? 0, set: (v) => { d.skin = { ...d.skin, freckles: v }; }, min: 0, max: 1 },
          { label: 'Eyes', kind: 'swatch', list: EYE_COLORS, get: () => EYE_COLORS.indexOf(d.eyes.color), set: (i) => { d.eyes = { color: EYE_COLORS[i] }; } },
        ];
      }
      case 'HAIR': {
        const styles = ['bald', 'buzz', 'short', 'swept', 'messy', 'bun', 'bob', 'long'];
        const beards = ['none', 'short', 'full', 'goatee', 'moustache'];
        return [
          { label: 'Style', kind: 'list', list: styles, get: () => Math.max(0, styles.indexOf(d.hair.style)), set: (i) => { d.hair = { ...d.hair, style: styles[i] }; } },
          { label: 'Colour', kind: 'swatch', list: HAIR_COLORS, get: () => HAIR_COLORS.indexOf(d.hair.color), set: (i) => { d.hair = { ...d.hair, color: HAIR_COLORS[i] }; d.brows = { ...d.brows, color: HAIR_COLORS[Math.min(i, 11)] }; } },
          { label: 'Hairline', kind: 'slider', get: () => d.hair.recede ?? 0, set: (v) => { d.hair = { ...d.hair, recede: v }; }, min: 0, max: 1 },
          { label: 'Brows', kind: 'slider', get: () => d.brows.density, set: (v) => { d.brows = { ...d.brows, density: v }; }, min: 0.2, max: 1 },
          { label: 'Brow weight', kind: 'slider', get: () => d.brows.thickness, set: (v) => { d.brows = { ...d.brows, thickness: v }; }, min: 0, max: 1 },
          { label: 'Beard', kind: 'list', list: beards, get: () => Math.max(0, beards.indexOf(d.beard?.style || 'none')), set: (i) => { d.beard = { ...(d.beard || {}), style: beards[i] }; } },
          { label: 'Stubble', kind: 'slider', get: () => d.beard?.stubble ?? 0, set: (v) => { d.beard = { ...(d.beard || {}), stubble: v }; }, min: 0, max: 1 },
        ];
      }
      case 'CLOTHES': return [
        { label: 'Outfit', kind: 'list', list: OUTFITS.map((o) => o.name), get: () => prof.outfit, set: (i) => { prof.outfit = i; } },
        { label: 'Top', kind: 'swatch', list: CLOTH_COLORS, get: () => prof.colors.top, set: (i) => { prof.colors.top = i; } },
        { label: 'Bottom', kind: 'swatch', list: CLOTH_COLORS, get: () => prof.colors.bottom, set: (i) => { prof.colors.bottom = i; } },
      ];
      default: return [];
    }
  };

  async function rebuild() {
    building = true;
    const dna = { ...prof.dna, outfit: outfitFor(prof) };
    const next = await buildCharacter(dna);
    if (ch) ch.dispose();
    ch = next;
    scene.add(ch.group);
    const prev = anim;
    anim = new Animator(ch);
    if (prev) { anim.t = prev.t; }
    anim.lookAt = camera.position.clone();
    building = false;
  }

  function adjust(r, dir, big) {
    if (r.kind === 'slider') {
      const step = (r.max - r.min) / (big ? 10 : 40);
      r.set(Math.min(r.max, Math.max(r.min, r.get() + dir * step)));
    } else if (r.kind === 'list' || r.kind === 'swatch') {
      const n = r.list.length;
      r.set(((Math.max(0, r.get()) + dir) % n + n) % n);
    }
    dirty = true; dirtyT = 0.16;
    sfx.ui?.('move');
  }

  function finish() {
    if (!prof.name.trim()) prof.name = prof.dna.sex > 0.5 ? 'Sam' : 'Sam';
    const save = { name: prof.name.trim(), outfit: prof.outfit, colors: prof.colors, dna: { ...prof.dna, outfit: outfitFor(prof) } };
    store.save('profile', save);
    store.remove('save0');
    go('warehouse', {}, { transition: 'black' });
  }

  return {
    heavy: false,
    async enter() {
      game.renderer.setPost({ exposure: 1.1, bloomStrength: 0.4, vignette: 0.5, grain: 0.035, scanline: 0.1 }, true);
      scene.background = new THREE.Color(0x07090c);
      scene.environment = getEnvMap(game.renderer.gl, 'studio');
      scene.environmentIntensity = 0.3;
      // the photo booth: a pale passport backdrop, a stool, soft key + rim
      const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.95 }));
      back.position.set(0.6, 1.6, -1.6);
      back.receiveShadow = true;
      scene.add(back);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.85 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const key = new THREE.DirectionalLight(0xfff2e6, 2.4);
      key.position.set(1.2, 2.6, 2.4);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5; key.shadow.camera.top = 2.2; key.shadow.camera.bottom = -0.3;
      key.shadow.bias = -0.0002; key.shadow.normalBias = 0.01;
      scene.add(key);
      const fill = new THREE.DirectionalLight(0xbfd4ff, 0.7);
      fill.position.set(-2, 1.6, 1.8);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xd8f0ff, 1.4);
      rim.position.set(-0.8, 2.4, -2.2);
      scene.add(rim);
      scene.add(new THREE.HemisphereLight(0x4a5866, 0x1a1612, 0.35));
      await rebuild();
      dirty = false;
    },
    exit() { ch?.dispose(); input.textCapture = null; },
    update(dt) {
      t += dt;
      if (ch) { ch.group.rotation.y = yaw + Math.sin(t * 0.3) * 0.05; anim?.update(dt); }
      if (dirty && !building) { dirtyT -= dt; if (dirtyT <= 0) { dirty = false; rebuild(); } }
      // camera: full body, or the face while sculpting it
      const wantFace = TABS[tab] === 'FACE' || TABS[tab] === 'HAIR' || (TABS[tab] === 'COLOURING' && row >= 3) || camMode === 'face';
      camK += ((wantFace ? 1 : 0) - camK) * Math.min(1, dt * 4);
      const h = ch?.height || 1.75;
      // the person stands left of centre (the panel takes the right half)
      camera.position.set(0.62 * (1 - camK) + 0.16 * camK, 1.05 + (h - 1.05) * camK - 0.1 * camK + 0.05, 3.9 - 3.15 * camK);
      camera.lookAt(0.62 * (1 - camK) + 0.16 * camK, 0.95 + (h - 0.95) * camK - 0.11 * camK, 0);
      camera.fov = 30 - 10 * camK;
      camera.updateProjectionMatrix();
      if (anim) anim.lookAt = camera.position.clone().add(new THREE.Vector3(0, -0.05, 0));

      if (naming) {
        for (const c of input.typed) {
          if (c === '\b') prof.name = prof.name.slice(0, -1);
          else if (/^[\p{L}0-9 .'-]$/u.test(c) && prof.name.length < 18) prof.name += c;
        }
        if (input.pressed('confirm') || input.keys.has('Enter')) { naming = false; input.consume('confirm'); }
        return;
      }
      const list = rows();
      if (input.pressed('tabL')) { tab = (tab + TABS.length - 1) % TABS.length; row = 0; sfx.ui?.('move'); }
      if (input.pressed('tabR')) { tab = (tab + 1) % TABS.length; row = 0; sfx.ui?.('move'); }
      const nRows = list.length + 1; // + the DONE button
      if (input.pressed('up')) row = (row - 1 + nRows) % nRows;
      if (input.pressed('down')) row = (row + 1) % nRows;
      const r = list[row];
      if (r && input.pressed('left')) adjust(r, -1, input.keys.has('ShiftLeft'));
      if (r && input.pressed('right')) adjust(r, 1, input.keys.has('ShiftLeft'));
      if (input.keys.has('KeyR') && input.pressed('any')) { randomize(prof, Date.now()); dirty = true; dirtyT = 0; }
      if (input.pressed('camera')) camMode = camMode === 'face' ? 'full' : 'face';
      if (input.mouse.down && input.mouse.x < 760) yaw += input.mouse.dx * 0.01;
      // mouse
      const click = input.takeClick();
      if (hit.hover) {
        const [kind, a, b] = hit.hover.split(':');
        if (kind === 'tab' && click) { tab = +a; row = 0; }
        if (kind === 'row' && click) {
          row = +a;
          const rr = list[row];
          if (rr?.kind === 'name') { naming = true; }
          if (rr?.kind === 'action') rr.act();
        }
        if (kind === 'slide' && input.mouse.down) {
          row = +a;
          const rr = list[row];
          rr.set(rr.min + (rr.max - rr.min) * Math.min(1, Math.max(0, +b)));
          dirty = true; dirtyT = 0.12;
        }
        if (kind === 'sw' && click) { row = +a; list[row].set(+b); dirty = true; dirtyT = 0; }
        if (kind === 'arrow' && click) { row = +a; adjust(list[row], +b, false); }
        if (kind === 'done' && click) finish();
      }
      if (input.pressed('confirm')) {
        if (row === list.length) finish();
        else if (r?.kind === 'name') naming = true;
        else if (r?.kind === 'action') r.act();
      }
      if (input.pressed('back')) go('title', {});
    },
    draw(ctx) {
      // header
      vText(ctx, 'WHO ARE YOU?', 60, 70, 34, { color: '#fff', weight: 0.16, glow: 10, glowColor: 'rgba(127,230,255,0.5)' });
      text(ctx, 'КТО ТЫ?  ·  Ivan needs a face for your passport', 62, 98, { size: 15, weight: 700, color: C.dim, spacing: 2 });
      // tabs
      let tx = 720;
      TABS.forEach((name, i) => {
        const w = name.length * 9.5 + 24;
        const on = i === tab;
        hit.add('tab:' + i, tx, 36, w, 30);
        ctx.fillStyle = on ? 'rgba(127,230,255,0.18)' : 'rgba(255,255,255,0.04)';
        ctx.fillRect(tx, 36, w, 30);
        if (on) { ctx.fillStyle = C.accent; ctx.fillRect(tx, 64, w, 2); }
        text(ctx, name, tx + w / 2, 56, { size: 13, weight: 800, color: on ? '#fff' : C.dim, align: 'center', spacing: 1 });
        tx += w + 6;
      });
      // rows
      const list = rows();
      const px = 760, py = 100, pw = 480;
      const rowH = TABS[tab] === 'FACE' ? 19.5 : 44;
      panel(ctx, px - 16, py - 10, pw + 32, Math.min(560, list.length * rowH + 30), { accentLen: 160 });
      list.forEach((r, i) => {
        const y = py + 14 + i * rowH;
        const on = i === row;
        hit.add('row:' + i, px, y - 12, 180, rowH - 2);
        if (on) { ctx.fillStyle = 'rgba(127,230,255,0.1)'; ctx.fillRect(px - 6, y - 13, pw + 12, rowH - 3); ctx.fillStyle = C.accent; ctx.fillRect(px - 6, y - 13, 3, rowH - 3); }
        const fs = TABS[tab] === 'FACE' ? 13 : 16;
        text(ctx, r.label, px + 6, y + (TABS[tab] === 'FACE' ? 2 : 6), { size: fs, weight: on ? 800 : 600, color: on ? '#fff' : C.dim });
        const vx = px + 190, vw = 250;
        if (r.kind === 'slider') {
          const k = (r.get() - r.min) / (r.max - r.min);
          const bh = TABS[tab] === 'FACE' ? 7 : 10;
          statBar(ctx, vx, y - bh / 2 - 2 + (TABS[tab] === 'FACE' ? 1 : 3), vw - 40, bh, k, { segments: 24, color: on ? C.accent : '#7a8a96' });
          for (let s = 0; s <= 20; s++) hit.add(`slide:${i}:${s / 20}`, vx + (vw - 40) * s / 20 - (vw - 40) / 40, y - 10, (vw - 40) / 20, rowH - 4);
          if (r.fmt) text(ctx, r.fmt(r.get()), vx + vw, y + 6, { size: 13, weight: 700, color: C.dim, align: 'right' });
        } else if (r.kind === 'list') {
          const v = r.list[r.get()] || '';
          text(ctx, '‹', vx, y + 6, { size: 22, weight: 800, color: on ? C.accent : C.faint });
          text(ctx, String(v).toUpperCase(), vx + vw / 2, y + 6, { size: 15, weight: 800, color: '#fff', align: 'center', spacing: 1 });
          text(ctx, '›', vx + vw - 10, y + 6, { size: 22, weight: 800, color: on ? C.accent : C.faint });
          hit.add(`arrow:${i}:-1`, vx - 6, y - 14, 30, 30); hit.add(`arrow:${i}:1`, vx + vw - 24, y - 14, 30, 30);
        } else if (r.kind === 'swatch') {
          const n = r.list.length, sw = Math.min(26, (vw + 20) / n - 4);
          r.list.forEach((c, k) => {
            const sx = vx + k * (sw + 4);
            roundRect(ctx, sx, y - 10, sw, 22, 4);
            ctx.fillStyle = c; ctx.fill();
            if (k === r.get()) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke(); }
            hit.add(`sw:${i}:${k}`, sx, y - 10, sw, 22);
          });
        } else if (r.kind === 'name') {
          const show = prof.name || (naming ? '' : 'type a name…');
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(vx, y - 14, vw, 30);
          text(ctx, show + (naming && Math.floor(t * 2) % 2 ? '_' : ''), vx + 10, y + 7, { size: 17, weight: 700, color: prof.name ? '#fff' : C.faint });
        } else if (r.kind === 'action') {
          text(ctx, 'R', vx, y + 6, { size: 14, weight: 800, color: C.faint });
        }
      });
      // done
      const dy = py + Math.min(560, list.length * rowH + 30) + 18;
      const onDone = row === list.length;
      hit.add('done', px, dy, pw, 44);
      panel(ctx, px, dy, pw, 44, { accent: onDone ? C.green : C.accent, fill: onDone ? 'rgba(20,60,40,0.85)' : undefined });
      vText(ctx, 'THIS IS ME  →  BELY MYS', px + pw / 2, dy + 30, 18, { align: 'center', color: onDone ? '#fff' : C.dim, weight: 0.16 });
      if (naming) text(ctx, 'Type your name — ENTER when done. (The Russians will call you Rybka anyway.)', 60, 690, { size: 14, color: C.accent });
      else hints(ctx, [['tabL', 'TAB'], ['tabR', ''], ['ud', 'SELECT'], ['lr', 'ADJUST'], ['camera', 'FACE / BODY'], ['confirm', 'OK']], { x: W - 40, y: H - 30 });
      if (building) text(ctx, 'developing photo…', 60, 650, { size: 13, color: C.faint, italic: true });
    },
    view() { return { scene, camera }; },
  };
});
