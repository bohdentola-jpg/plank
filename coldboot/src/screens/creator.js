// Character creator — framed as Ivan making your papers: "КТО ТЫ?" Who are you?
// A passport photo booth: pick who you are from twelve people (Rocketbox
// avatars, men and women of different backgrounds), your name, your height and
// the colour of your clothes. Saved as the profile (store 'profile'):
//   { name, avatar, dna: { avatar, sex, height, tint, tintAmt } }
// which playerDNA() (scenes/warehouse.js) hands to every scene that shows Rybka.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { input } from '../core/input.js';
import { C, W, H, text, panel, hints, header, hit, roundRect, statBar } from '../core/ui.js';
import { buildCharacter } from '../people/person.js';
import { Animator } from '../people/animator.js';
import { PLAYER_AVATARS, AVATARS } from '../people/catalog.js';
import { loadAvatar } from '../people/loader.js';
import { getEnvMap } from '../core/envmap.js';
import { store } from '../core/settings.js';
import { sfx } from '../audio/sfx.js';

// clothes: as they come, or dyed
const TINTS = [null, '#2e3a46', '#3e5468', '#5a6a4e', '#6a4a32', '#7a2a24', '#4a3a5a', '#8a8478', '#1e1e22'];
const TINT_NAMES = ['As they come', 'Slate', 'Navy', 'Moss', 'Rust brown', 'Oxblood', 'Plum', 'Stone', 'Black'];
const THUMB = (id) => new URL(`../../assets/people/thumbs/${id}.jpg`, import.meta.url).href;

function defaultProfile() {
  const p = store.load('profile');
  const prof = { name: p?.name || '', avatar: PLAYER_AVATARS[0], height: 1, tint: 0 };
  if (p?.dna?.avatar && PLAYER_AVATARS.includes(p.dna.avatar)) prof.avatar = p.dna.avatar;
  else if (p?.dna && (p.dna.sex ?? 1) < 0.5) prof.avatar = PLAYER_AVATARS.find((id) => AVATARS[id].sex === 'f');
  if (p?.dna?.height) prof.height = p.dna.height;
  if (p?.tintIndex) prof.tint = p.tintIndex;
  return prof;
}

registerScreen('creator', () => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.05, 50);
  const prof = defaultProfile();
  let ch = null, anim = null, building = false, want = null, t = 0;
  let row = 1, yaw = 0.25, camMode = 'full', camK = 0, naming = false, shown = 0;
  const thumbs = {};
  for (const id of PLAYER_AVATARS) { const im = new Image(); im.src = THUMB(id); thumbs[id] = im; }
  const ROWS = ['name', 'who', 'height', 'clothes', 'done'];

  async function show(id) {
    want = id;
    if (building) return;
    building = true;
    while (want) {
      const target = want;
      want = null;
      const next = await buildCharacter({ avatar: target, height: prof.height, tint: TINTS[prof.tint], tintAmt: 0.8 }, { frustumCulled: false });
      if (want) { next.dispose(); continue; }
      if (ch) ch.dispose();
      ch = next;
      scene.add(ch.group);
      anim = new Animator(ch);
      anim.lookAt = camera.position.clone();
      // a hello from whoever you just picked (not on the first photo)
      if (shown++) anim.play(['wave', 'nod', 'shrug'][PLAYER_AVATARS.indexOf(target) % 3], { upper: true });
      // the neighbours load while you look
      const i = PLAYER_AVATARS.indexOf(target), n = PLAYER_AVATARS.length;
      loadAvatar(PLAYER_AVATARS[(i + 1) % n]).catch(() => {});
      loadAvatar(PLAYER_AVATARS[(i + n - 1) % n]).catch(() => {});
    }
    building = false;
  }

  function pickAvatar(dir) {
    const n = PLAYER_AVATARS.length;
    prof.avatar = PLAYER_AVATARS[(PLAYER_AVATARS.indexOf(prof.avatar) + dir + n) % n];
    show(prof.avatar);
    sfx.ui?.('move');
  }

  function setHeight(v) {
    prof.height = Math.round(Math.min(1.06, Math.max(0.94, v)) * 100) / 100;
    if (ch) ch.holder.scale.setScalar(prof.height);
  }

  function setTint(i) {
    prof.tint = (i + TINTS.length) % TINTS.length;
    ch?.setClothTint(TINTS[prof.tint], 0.8);
    sfx.ui?.('move');
  }

  function finish() {
    const a = AVATARS[prof.avatar];
    const name = prof.name.trim() || 'Sam';
    const old = store.load('profile') || {};
    store.save('profile', {
      ...old, name, avatar: prof.avatar, tintIndex: prof.tint,
      dna: { avatar: prof.avatar, sex: a.sex === 'f' ? 0 : 1, height: prof.height, tint: TINTS[prof.tint], tintAmt: 0.8 },
    });
    store.remove('save0');
    go('warehouse', {}, { transition: 'black' });
  }

  function heightLabel() {
    const base = AVATARS[prof.avatar].sex === 'f' ? 168 : 180;
    const cm = Math.round(base * prof.height);
    const inch = cm / 2.54;
    return `${cm} cm · ${Math.floor(inch / 12)}'${Math.round(inch % 12)}"`;
  }

  return {
    heavy: false,
    async enter() {
      game.renderer.setPost({ exposure: 1.1, bloomStrength: 0.35, vignette: 0.5, grain: 0.035, scanline: 0.1 }, true);
      scene.background = new THREE.Color(0x07090c);
      scene.environment = getEnvMap(game.renderer.gl, 'studio');
      scene.environmentIntensity = 0.32;
      // the photo booth: a pale passport backdrop, soft key + rim
      const back = new THREE.Mesh(new THREE.PlaneGeometry(6, 4), new THREE.MeshStandardMaterial({ color: 0x46525c, roughness: 0.95 }));
      back.position.set(0.6, 1.6, -1.6);
      back.receiveShadow = true;
      scene.add(back);
      const floor = new THREE.Mesh(new THREE.CircleGeometry(3, 40), new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.85 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const key = new THREE.DirectionalLight(0xfff2e6, 2.3);
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
      await show(prof.avatar);
    },
    exit() { ch?.dispose(); input.textCapture = null; },
    update(dt) {
      t += dt;
      if (ch) { ch.group.rotation.y = yaw + Math.sin(t * 0.3) * 0.05; anim?.update(dt); }
      // full body, or head and shoulders (the C key; and while typing a name)
      const wantK = camMode === 'face' ? 1 : ROWS[row] === 'name' ? 0.75 : 0;
      camK += (wantK - camK) * Math.min(1, dt * 4);
      const h = ch?.height || 1.75;
      const eye = ch ? ch.bones.head.getWorldPosition(new THREE.Vector3()).y + 0.06 : h - 0.1;
      // the person stands left of centre (the panel takes the right half)
      const cx = 0.62 * (1 - camK) + 0.3 * camK;
      camera.position.set(cx, 1.05 * (1 - camK) + (eye - 0.02) * camK, 3.9 - 2.35 * camK);
      camera.lookAt(cx, 0.95 * (1 - camK) + (eye - 0.04) * camK, 0);
      camera.fov = 30 - 6 * camK;
      camera.updateProjectionMatrix();
      if (anim) anim.lookAt = camera.position.clone().add(new THREE.Vector3(0, -0.05, 0));

      if (naming) {
        for (const c of input.typed) {
          if (c === '\b') prof.name = prof.name.slice(0, -1);
          else if (/^[\p{L}0-9 .'-]$/u.test(c) && prof.name.length < 18) prof.name += c;
        }
        if (input.pressed('confirm') || input.keys.has('Enter')) { naming = false; input.consume?.('confirm'); }
        return;
      }
      const n = ROWS.length;
      if (input.pressed('up')) { row = (row + n - 1) % n; sfx.ui?.('move'); }
      if (input.pressed('down')) { row = (row + 1) % n; sfx.ui?.('move'); }
      const r = ROWS[row];
      const dir = input.pressed('left') ? -1 : input.pressed('right') ? 1 : 0;
      if (dir) {
        if (r === 'who') pickAvatar(dir);
        if (r === 'height') setHeight(prof.height + dir * 0.01);
        if (r === 'clothes') setTint(prof.tint + dir);
      }
      if (input.pressed('tabL')) pickAvatar(-1);
      if (input.pressed('tabR')) pickAvatar(1);
      if (input.pressed('camera')) camMode = camMode === 'face' ? 'full' : 'face';
      if (input.mouse.down && input.mouse.x < 700 && !hit.hover) yaw += input.mouse.dx * 0.01;
      const click = input.takeClick();
      if (hit.hover) {
        const [kind, a] = hit.hover.split(':');
        if (click) {
          if (kind === 'row') { row = +a; if (ROWS[row] === 'name') naming = true; }
          if (kind === 'av') { row = 1; prof.avatar = PLAYER_AVATARS[+a]; show(prof.avatar); sfx.ui?.('move'); }
          if (kind === 'tint') { row = 3; setTint(+a); }
          if (kind === 'arrow') { const [, rr, d] = hit.hover.split(':'); row = +rr; if (ROWS[row] === 'height') setHeight(prof.height + +d * 0.01); if (ROWS[row] === 'who') pickAvatar(+d); }
          if (kind === 'done') finish();
        }
        if (kind === 'hslide' && input.mouse.down) { row = 2; setHeight(0.94 + 0.12 * +a); }
      }
      if (input.pressed('confirm')) {
        if (r === 'done') finish();
        else if (r === 'name') naming = true;
        else row = Math.min(n - 1, row + 1);
      }
      if (input.pressed('back')) go('title', {});
    },
    draw(ctx) {
      header(ctx, 'Who are you?', 'КТО ТЫ?  ·  Ivan needs a face for your passport', 60, 74);
      const px = 724, pw = 512;
      let y = 128;
      const rowBox = (i, hgt) => {
        const on = row === i;
        hit.add('row:' + i, px - 12, y - 4, pw + 24, hgt);
        panel(ctx, px - 12, y - 4, pw + 24, hgt, { fill: on ? 'rgba(22,26,31,0.92)' : C.panel, accent: on ? C.accent : undefined });
        return on;
      };
      // name
      let on = rowBox(0, 64);
      text(ctx, 'NAME', px + 4, y + 18, { size: 11, weight: 700, color: on ? C.accent : C.dim, spacing: 2 });
      const shown = prof.name || (naming ? '' : 'Type a name…');
      text(ctx, shown + (naming && Math.floor(t * 2) % 2 ? '|' : ''), px + 4, y + 46, { size: 20, weight: 600, color: prof.name ? C.text : C.faint });
      text(ctx, 'The team will call you Rybka anyway.', px + pw - 4, y + 18, { size: 11, color: C.faint, align: 'right' });
      y += 76;
      // who: twelve faces
      on = rowBox(1, 236);
      text(ctx, 'YOU', px + 4, y + 18, { size: 11, weight: 700, color: on ? C.accent : C.dim, spacing: 2 });
      const a = AVATARS[prof.avatar];
      text(ctx, `${a.sex === 'f' ? 'Woman' : 'Man'} · ${(a.label || '').toLowerCase()}`, px + pw - 4, y + 18, { size: 12, color: C.dim, align: 'right' });
      const tw = 78, th = 92, gx = 6;
      PLAYER_AVATARS.forEach((id, i) => {
        const cx = px + 4 + (i % 6) * (tw + gx), cy = y + 30 + Math.floor(i / 6) * (th + 8);
        const sel = id === prof.avatar;
        hit.add('av:' + i, cx, cy, tw, th);
        ctx.save();
        roundRect(ctx, cx, cy, tw, th, 4);
        ctx.fillStyle = '#1b1f24';
        ctx.fill();
        ctx.clip();
        const im = thumbs[id];
        if (im?.complete && im.naturalWidth) ctx.drawImage(im, cx, cy, tw, th);
        if (!sel) { ctx.fillStyle = 'rgba(8,10,12,0.35)'; ctx.fillRect(cx, cy, tw, th); }
        ctx.restore();
        roundRect(ctx, cx, cy, tw, th, 4);
        ctx.strokeStyle = sel ? C.accent : hit.hover === 'av:' + i ? 'rgba(255,255,255,0.35)' : C.edge;
        ctx.lineWidth = sel ? 2 : 1;
        ctx.stroke();
      });
      y += 248;
      // height
      on = rowBox(2, 58);
      text(ctx, 'HEIGHT', px + 4, y + 18, { size: 11, weight: 700, color: on ? C.accent : C.dim, spacing: 2 });
      text(ctx, heightLabel(), px + pw - 4, y + 18, { size: 13, weight: 600, color: C.text, align: 'right' });
      const bx = px + 30, bw = pw - 60;
      text(ctx, '‹', px + 6, y + 44, { size: 20, weight: 700, color: on ? C.accent : C.faint });
      text(ctx, '›', px + pw - 14, y + 44, { size: 20, weight: 700, color: on ? C.accent : C.faint });
      hit.add('arrow:2:-1', px, y + 26, 26, 26); hit.add('arrow:2:1', px + pw - 26, y + 26, 26, 26);
      statBar(ctx, bx, y + 34, bw, 8, (prof.height - 0.94) / 0.12, { color: on ? C.accent : '#7a8a96' });
      for (let s = 0; s <= 24; s++) hit.add(`hslide:${s / 24}`, bx + (bw * s) / 24 - bw / 48, y + 26, bw / 24, 24);
      y += 70;
      // clothes
      on = rowBox(3, 64);
      text(ctx, 'CLOTHES', px + 4, y + 18, { size: 11, weight: 700, color: on ? C.accent : C.dim, spacing: 2 });
      text(ctx, TINT_NAMES[prof.tint], px + pw - 4, y + 18, { size: 13, weight: 600, color: C.text, align: 'right' });
      TINTS.forEach((c, i) => {
        const sx = px + 4 + i * 56, sy = y + 28;
        roundRect(ctx, sx, sy, 48, 24, 4);
        if (c) { ctx.fillStyle = c; ctx.fill(); }
        else {
          ctx.save(); ctx.clip();
          const g = ctx.createLinearGradient(sx, sy, sx + 48, sy + 24);
          g.addColorStop(0, '#6a7a88'); g.addColorStop(0.5, '#8a6a4a'); g.addColorStop(1, '#3c4e68');
          ctx.fillStyle = g; ctx.fillRect(sx, sy, 48, 24); ctx.restore();
        }
        roundRect(ctx, sx, sy, 48, 24, 4);
        ctx.strokeStyle = i === prof.tint ? C.text : C.edge;
        ctx.lineWidth = i === prof.tint ? 2 : 1;
        ctx.stroke();
        hit.add('tint:' + i, sx, sy, 48, 24);
      });
      y += 78;
      // done
      const onDone = row === 4;
      hit.add('done', px - 12, y, pw + 24, 46);
      panel(ctx, px - 12, y, pw + 24, 46, { fill: onDone ? 'rgba(231,167,64,0.16)' : C.panel, accent: onDone ? C.accent : undefined });
      text(ctx, 'THIS IS ME  →  BELY MYS', px + pw / 2, y + 29, { size: 15, weight: 700, color: onDone ? C.text : C.dim, align: 'center', spacing: 2 });
      if (naming) text(ctx, 'Type your name, then Enter.', 60, H - 30, { size: 14, color: C.accent });
      else hints(ctx, [['ud', 'Select'], ['lr', 'Change'], ['tabL', ''], ['tabR', 'Person'], ['camera', 'Face / body'], ['confirm', 'OK']], { x: W - 40, y: H - 30 });
      if (building) text(ctx, 'developing photo…', 60, H - 60, { size: 13, color: C.faint });
    },
    view() { return { scene, camera }; },
  };
});
