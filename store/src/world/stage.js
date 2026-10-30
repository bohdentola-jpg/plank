// Scene runtime. Static art is baked into 512-unit background tiles (cached,
// rebuilt on resize); interactive and animated things are entities drawn
// live each frame. The stage knows nothing about the store — interactions go
// out through env.onAct(entity), state comes in through env getters.
import { view, worldTransform } from '../engine.js';
import {
  PALETTES, Y, drawArchitecture, mosaic, hangingSign, column, bench, bin, poster, POSTERS, tag, throwup,
  stickers, plaque,
} from '../art/station.js';
import { storefrontBack, storefrontFront, counterBounds, neonText, shopStyle, SF } from '../art/storefronts.js';
import * as P from '../art/props.js';
import * as C from '../art/critters.js';
import { drawProduct, emblem } from '../art/products.js';
import { SCENES } from './scenes.js';
import { SHOPS } from '../data/catalog.js';
import { Particles } from './fx.js';
import { makeCanvas, mulberry32, hashStr, rgba, text, FONTS, INK, ellipse, dot, rrect, tint } from '../ink.js';

const TILE = 512;
export const FEET = Y.FEET;

const KEEPER_DRAW = {
  pigeon: C.drawPigeon, cheese: C.drawBigCheese, roach: C.drawRoach, raccoon: C.drawRaccoon,
  bat: C.drawBat, cat: C.drawCat, moth: C.drawMoth, gator: C.drawGator, ghost: C.drawGhost,
};
const KEEPER_X = { threads: 0.42, topshelf: 0.5, sole: 0.48, cans: 0.4, tracks: 0.5, bodega: 0.42 };

const NPC_LINES = {
  sleeper: ['Zzz... five more stops...', 'Zzz... is this Token Sq...?', '(snores in a minor key)', "Zzz... don't touch... the third rail..."],
  commuter: [
    "There's so many rats in this city that somewhere along the way we just... became citizens.",
    "I've been waiting on the 3 for forty minutes. It's fine. I'm fine.",
    'They raised the fare again. I pay in crumbs now.',
    'Tip: swipe in at the token booth every day. Shelly pays out if you keep your streak.',
    'That phone booth rings sometimes. Nobody knows who calls it. Nobody asks.',
  ],
  couple: [
    'We met on this platform. He stepped on my tail. Romance.',
    'Have you tried the back room? ...What back room? I said nothing.',
    'Mr. Whiskers used to chase us. Now he sells us chips. Growth.',
    'The maintenance door? Locked. Always. Unless you win a key from that claw machine at Token Sq.',
  ],
  busker: ['(plays a smooth sax riff)', 'Tips appreciated. Tokens even more.', 'I only know one song. It is a really good song.', 'Rascal painted my bucket hat. Free of charge. Legend.'],
  pizza: ["Can't talk. Pizza.", 'This slice? Found it. Fair and square. On the stairs.', "Legend says if you follow me long enough I'll share. Legend is wrong."],
  sewerrat: ["Big Al's alright. Just don't ask about the coat.", "The water's not that bad down here. Okay. It's bad.", 'You came down the maintenance ladder? Respect.'],
  ghostrat: ['...have you seen my train? It was due in 1931.', "It's peaceful here. The tile work is to die for. Heh.", 'The Conductor says the last train runs at midnight. Always midnight.'],
};

function intersects(b, x, y, w, h) {
  return b[0] < x + w && b[0] + b[2] > x && b[1] < y + h && b[1] + b[3] > y;
}

// ---------------------------------------------------------------- entities

function makeEntity(it, i, stage) {
  const pal = stage.pal;
  const seed = hashStr(`${stage.id}:${i}:${it.kind}`) % 100000;
  const e = { ...it, index: i, seed };
  switch (it.kind) {
    case 'exit':
      e.bbox = [it.x - 10, 90, it.w + 20, 340];
      e.back = (g) => P.exitStairs(g, it.x, it.w, pal, seed);
      e.act = { x: it.x + it.w / 2, y: 140, label: 'STREET', range: 110 };
      break;
    case 'hanging':
      e.bbox = [it.x - 10, -150, 240, 270];
      e.back = (g) => hangingSign(g, it.x, 72, 210, it.label, it.sub, seed);
      break;
    case 'booth':
      e.bbox = [it.x - 12, 200, it.w + 24, 226];
      e.back = (g) => P.boothBack(g, it.x, it.w, seed);
      e.frontBounds = [it.x - 8, 240, it.w + 16, 104];
      e.front = (g) => P.boothFront(g, it.x, it.w, seed);
      e.dyn = (g, t) => {
        C.drawTortoise(g, it.x + it.w * 0.6, 336, { t, facing: -1, scale: 1.05, blink: stage.blinkFor(i, t), talk: stage.talking === 'booth', boil: C.boilSeed(91, t) });
      };
      e.badge = () => (stage.env.boothReady?.() ? 'SWIPE!' : null);
      e.act = { x: it.x + it.w / 2, y: 200, label: 'TOKEN BOOTH', range: 100 };
      break;
    case 'turnstiles':
      e.bbox = [it.x - 6, 314, 200, 112];
      e.back = (g) => P.turnstiles(g, it.x, 3, seed);
      break;
    case 'phone':
      e.bbox = [it.x - 6, 218, 100, 210];
      e.back = (g) => P.phoneBack(g, it.x, seed);
      e.dyn = (g, t) => {
        const ringing = stage.env.phoneRinging?.();
        P.phoneHandset(g, it.x, t, ringing && Math.floor(t * 1.2) % 2 === 0);
      };
      e.badge = () => (stage.env.phoneRinging?.() ? 'RING!' : null);
      e.act = { x: it.x + 43, y: 210, label: 'PHONE', range: 60 };
      break;
    case 'wanted':
      e.bbox = [it.x - 6, 206, 112, 150];
      e.back = (g) => P.wantedFrame(g, it.x, seed);
      e.dyn = (g) => {
        const p = stage.env.dealOfDay?.();
        if (!p) return;
        stage.cachedSprite(`wanted:${p.id}`, [it.x + 4, 236, 96, 96], (gg) => {
          gg.save();
          gg.translate(it.x + 50, 282);
          gg.rotate(-0.03);
          drawProduct(gg, p.art, 0, 0, 0.62, p.seed);
          gg.restore();
        }, g);
        const pct = stage.env.dealPct?.() || 40;
        g.save();
        g.translate(it.x + 86, 246);
        g.rotate(0.2);
        ellipse(g, 0, 0, 19, 19, { fill: '#e8456b', lw: 2.6, seed: 4 });
        text(g, `-${pct}%`, 0, 5, { size: 11, font: FONTS.sign, fill: '#fffaf0', lw: 0 });
        g.restore();
      };
      e.act = { x: it.x + 50, y: 206, label: 'WANTED', range: 55 };
      break;
    case 'column':
      e.bbox = [it.x - 24, 40, 48, 390];
      e.back = (g) => {
        column(g, it.x, pal, seed);
        if (seed % 3 === 0) stickers(g, it.x, 300, 3, seed);
      };
      break;
    case 'shop': {
      const shop = SHOPS[it.shop];
      const st = shopStyle(it.shop);
      e.bbox = [it.x - 22, SF.SIGN_Y - 16, it.w + 44, SF.BOTTOM - SF.SIGN_Y + 26];
      e.back = (g) => storefrontBack(g, it.shop, it.x, it.w, shop.name, seed);
      e.frontBounds = counterBounds(it.x, it.w);
      e.front = (g) => storefrontFront(g, it.shop, it.x, it.w, seed);
      const kx = it.x + it.w * (KEEPER_X[it.shop] || 0.5);
      e.dyn = (g, t) => {
        const draw = KEEPER_DRAW[shop.keeper];
        const face = stage.playerX < kx - 20 ? -1 : 1;
        draw(g, kx, SF.KEEPER_Y, {
          t: t + i, facing: face, scale: 1.12, blink: stage.blinkFor(i, t), talk: stage.talking === it.shop,
          shake: Math.floor(t / 4 + i) % 3 === 0, boil: C.boilSeed(20 + i, t),
        });
        if (st.sign === 'neon') {
          const on = stage.neonOn(i, t);
          stage.neon(g, shop.name, it.x + it.w / 2, SF.SIGN_Y + SF.SIGN_H / 2 + 1, 30, st.neon, on);
        }
      };
      e.act = { x: it.x + it.w / 2, y: SF.SIGN_Y - 6, label: shop.name, range: it.w / 2 - 20, shop: it.shop };
      break;
    }
    case 'poster':
      e.bbox = [it.x - 10, it.y - 10, it.w + 20, it.h + 20];
      e.back = (g) => poster(g, it.x, it.y, it.w, it.h, POSTERS[it.p % POSTERS.length], seed);
      break;
    case 'cups':
      e.frontBounds = [it.x - 50, 340, 150, 86];
      e.front = (g) => P.cupsTable(g, it.x, seed);
      e.dyn = (g, t) => {
        const face = stage.playerX < it.x ? -1 : 1;
        C.drawWeasel(g, it.x - 4, 404, { t, facing: face, blink: stage.blinkFor(i, t), talk: stage.talking === 'cups', boil: C.boilSeed(81, t) });
      };
      e.act = { x: it.x, y: 270, label: '3-CUP CHARLIE', range: 60 };
      break;
    case 'claw':
      e.bbox = [it.x - 10, 176, 146, 250];
      e.back = (g) => P.clawBack(g, it.x, seed);
      e.dyn = (g, t) => P.clawLive(g, it.x, t, stage.env.clawPrizes?.() || [], 0.5 + Math.sin(t * 0.6) * 0.3);
      e.act = { x: it.x + 62, y: 176, label: 'THE GRABBER', range: 64 };
      break;
    case 'mosaic':
      e.bbox = [it.x - 10, it.y - 10, it.w + 20, it.h + 20];
      e.back = (g) => mosaic(g, it.x, it.y, it.w, it.h, it.name, pal, seed);
      break;
    case 'bench':
      e.bbox = [it.x - 6, 350, 162, 76];
      e.back = (g) => bench(g, it.x, seed);
      break;
    case 'bin':
      e.bbox = [it.x - 24, 360, 48, 66];
      e.back = (g) => bin(g, it.x, seed);
      break;
    case 'vending':
      e.bbox = [it.x - 6, 238, 108, 188];
      e.back = (g) => P.vending(g, it.x, seed);
      break;
    case 'tags':
      e.bbox = [it.x - 120, 130, 240, 260];
      e.back = (g) => {
        const r = mulberry32(seed);
        for (let k = 0; k < it.n; k++) {
          const tx = it.x - 80 + r() * 160, ty = 170 + r() * 190;
          if (r() < 0.3) throwup(g, tx, ty, { seed: seed + k, size: 30 + r() * 12 });
          else tag(g, tx, ty, { seed: seed + k });
        }
      };
      break;
    case 'end':
      e.bbox = it.side === 'right' ? [it.x - 70, 30, 320, 400] : [it.x - 250, 30, 320, 400];
      e.back = (g) => P.tunnelEnd(g, it.x, it.side, pal, seed);
      break;
    case 'legal':
      e.bbox = [it.x - 10, 110, it.w + 20, 316];
      e.back = (g) => P.legalWall(g, it.x, it.w, seed);
      e.dyn = (g) => {
        const img = stage.env.legalTag?.();
        if (img) g.drawImage(img, it.x + 36, 150 + 178, 188, 84);
      };
      e.act = { x: it.x + it.w / 2, y: 112, label: 'LEGAL WALL', range: it.w / 2 - 40 };
      break;
    case 'arcade':
      e.bbox = [it.x - 10, 208, 120, 218];
      e.back = (g) => P.arcadeBack(g, it.x, 'RAT RACE', seed);
      e.dyn = (g, t) => P.arcadeLive(g, it.x, t);
      e.act = { x: it.x + 50, y: 200, label: 'RAT RACE', range: 55 };
      break;
    case 'crack':
      e.dyn = (g) => P.crackedTiles(g, it.x, it.y, stage.env.crackBroken?.());
      e.act = { x: it.x, y: it.y - 40, label: '???', range: 36, quiet: true };
      break;
    case 'door':
      e.bbox = [it.x - 14, 220, 140, 206];
      e.back = (g) => P.door(g, it.x, it.door, seed);
      if (it.door === 'maint') {
        e.dyn = (g) => P.padlock(g, it.x, 112, stage.env.maintUnlocked?.());
        e.act = { x: it.x + 56, y: 220, label: 'MAINTENANCE', range: 60 };
      } else {
        e.dyn = (g, t) => {
          if (stage.env.peeking?.()) {
            const x = it.x + 46, y = 236 + 68;
            g.fillStyle = '#0a0406';
            g.fillRect(x - 18, y - 4, 36, 8);
            dot(g, x - 7, y, 2.6, '#ffd23f');
            dot(g, x + 7, y, 2.6, '#ffd23f');
          }
        };
        e.act = { x: it.x + 46, y: 220, label: 'EMPLOYEES ONLY', range: 52 };
      }
      break;
    case 'mural':
      e.bbox = [it.x - 20, 140, it.w + 40, 280];
      e.back = (g) => P.mural(g, it.x, it.w, seed);
      e.act = { x: it.x + it.w * 0.45, y: 300, label: 'READ THE WALL', range: 70, quiet: true };
      break;
    case 'ladder':
      e.bbox = [it.x - 80, -40, 260, 470];
      e.back = (g) => P.ladder(g, it.x, seed);
      e.act = { x: it.x, y: 160, label: 'LADDER UP', range: 60 };
      break;
    case 'sewerpipe':
      e.bbox = [it.x - 60, 180, 120, 160];
      e.back = (g) => P.sewerPipe(g, it.x, seed);
      e.pipe = true;
      break;
    case 'wallend':
      e.bbox = [it.x - 10, -420, 420, 1540];
      e.back = (g) => P.wallEnd(g, it.x);
      break;
    case 'stall':
      e.bbox = [it.x - 50, 120, it.w + 100, 306];
      e.back = (g) => P.stallBack(g, it.x, it.w, seed);
      e.frontBounds = [it.x + 10, 330, it.w - 20, 96];
      e.front = (g) => P.stallFront(g, it.x, it.w, seed);
      e.dyn = (g, t) => {
        P.stallLive(g, it.x, it.w, t);
        const face = stage.playerX < it.x + it.w * 0.45 ? -1 : 1;
        C.drawGator(g, it.x + it.w * 0.45, 398, { t, facing: face, blink: stage.blinkFor(i, t), talk: stage.talking === 'sewer', boil: C.boilSeed(111, t) });
      };
      e.act = { x: it.x + it.w / 2, y: 150, label: "BIG AL'S", range: it.w / 2 - 30, shop: 'sewer' };
      break;
    case 'plaque':
      e.bbox = [it.x - 220, 140, 440, 110];
      e.back = (g) => plaque(g, it.x, it.label, pal, seed);
      break;
    case 'ticket':
      e.bbox = [it.x - 20, 160, it.w + 40, 266];
      e.back = (g) => P.ticketBack(g, it.x, it.w, seed);
      e.frontBounds = [it.x, 316, it.w, 110];
      e.front = (g) => P.ticketFront(g, it.x, it.w, seed);
      e.dyn = (g, t) => {
        const face = stage.playerX < it.x + it.w / 2 ? -1 : 1;
        C.drawGhost(g, it.x + it.w / 2, 380, { t, facing: face, blink: stage.blinkFor(i, t), talk: stage.talking === 'ghost', boil: C.boilSeed(121, t) });
      };
      e.act = { x: it.x + it.w / 2, y: 170, label: 'LOST & FOUND', range: it.w / 2 - 30, shop: 'ghost' };
      break;
    case 'bell':
      e.bbox = [it.x - 40, 220, 80, 206];
      e.back = (g) => P.bellPost(g, it.x, seed);
      e.act = { x: it.x, y: 220, label: 'RING BELL', range: 50 };
      break;
    case 'npc': {
      e.npc = {
        who: it.who, x: it.x, home: it.x, range: it.range || 0, facing: -1, speed: it.who === 'pizza' ? 70 : 40,
        dir: -1, phase: 0, look: it.look, paper: it.paper, idleT: 0,
        lines: NPC_LINES[it.id === 'couple' ? 'couple' : it.id === 'sewerrat' ? 'sewerrat' : it.who] || NPC_LINES.commuter,
      };
      const label = { sleeper: 'SLEEPING RAT', busker: 'BUSKER', pizza: 'PIZZA RAT', ghostrat: '???' }[it.who] || 'STRANGER';
      e.act = { x: it.x, y: 300, label, range: 46, npc: true };
      break;
    }
    default:
      break;
  }
  return e;
}

// ---------------------------------------------------------------- lights

function buildLights(def) {
  const out = [];
  const { start, step } = def.lights;
  const signs = def.items.filter((it) => it.kind === 'hanging').map((it) => it.x + 105);
  for (let x = start, k = 0; x < def.width; x += step, k++) {
    if (signs.some((sx) => Math.abs(sx - x) < 150)) continue;
    const r = mulberry32(hashStr(`${def.name}:light:${k}`));
    out.push({ x, flicker: r() < 0.18, phase: r() * 100, dead: r() < 0.06 });
  }
  return out;
}

// ---------------------------------------------------------------- stage

export class Stage {
  constructor(id, env = {}) {
    this.id = id;
    this.def = SCENES[id];
    this.pal = PALETTES[this.def.pal];
    this.env = env;
    this.tiles = new Map();
    this.sprites = new Map();
    this.px = 0;
    this.frame = 0;
    this.entities = this.def.items.map((it, i) => makeEntity(it, i, this));
    this.npcs = this.entities.filter((e) => e.npc);
    this.lights = buildLights(this.def);
    this.fx = new Particles();
    this.talking = null;
    this.playerX = this.def.spawn;
    this.sparkT = 2;
    this.lightCone = null;
  }

  get width() { return this.def.width; }

  // ---------------------------------------------------------- tiles

  invalidate() {
    this.tiles.clear();
    this.sprites.clear();
    this.lightCone = null;
  }

  bakeTile(ix, iy) {
    const x0 = ix * TILE, y0 = iy * TILE;
    const px = this.px;
    const c = makeCanvas(TILE * px, TILE * px);
    const g = c.getContext('2d');
    g.scale(c.width / TILE, c.height / TILE);
    g.translate(-x0, -y0);
    g.beginPath();
    g.rect(x0, y0, TILE, TILE);
    g.clip();
    drawArchitecture(g, this.pal, x0, x0 + TILE, y0, y0 + TILE, { variant: this.def.variant, seed: hashStr(this.id) % 1000 });
    for (const e of this.entities) {
      if (!e.back || !e.bbox) continue;
      if (!intersects(e.bbox, x0, y0, TILE, TILE)) continue;
      g.save();
      e.back(g);
      g.restore();
    }
    return { canvas: c, x: x0, y: y0, used: this.frame };
  }

  tile(ix, iy) {
    const key = `${ix},${iy}`;
    let t = this.tiles.get(key);
    if (!t) {
      t = this.bakeTile(ix, iy);
      this.tiles.set(key, t);
    }
    t.used = this.frame;
    return t;
  }

  visibleTileRange(margin = 0) {
    return [
      Math.floor((view.camX - margin) / TILE), Math.floor((view.camX + view.vw + margin) / TILE),
      Math.floor(view.camY / TILE), Math.floor((view.camY + view.vh) / TILE),
    ];
  }

  // bake everything near the camera now (used behind the fade on scene load)
  warm() {
    if (this.px !== view.px) { this.invalidate(); this.px = view.px; }
    const [ix0, ix1, iy0, iy1] = this.visibleTileRange(TILE);
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      if (ix * TILE > this.width + TILE || (ix + 1) * TILE < -TILE) continue;
      this.tile(ix, iy);
    }
  }

  // one tile per frame ahead of the camera; evict far ones
  prefetch() {
    const [ix0, ix1, iy0, iy1] = this.visibleTileRange(TILE * 1.5);
    for (let iy = iy0; iy <= iy1; iy++) for (let ix = ix0; ix <= ix1; ix++) {
      if (ix * TILE > this.width + TILE || (ix + 1) * TILE < -TILE) continue;
      if (!this.tiles.has(`${ix},${iy}`)) {
        this.tile(ix, iy);
        return;
      }
    }
    if (this.tiles.size > 24) {
      const sorted = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let k = 0; k < sorted.length - 20; k++) this.tiles.delete(sorted[k][0]);
    }
  }

  cachedSprite(key, bounds, draw, g) {
    let s = this.sprites.get(key);
    if (!s) {
      const [x, y, w, h] = bounds;
      const c = makeCanvas(w * this.px, h * this.px);
      const gg = c.getContext('2d');
      gg.scale(c.width / w, c.height / h);
      gg.translate(-x, -y);
      draw(gg);
      s = { canvas: c, x, y, w, h };
      this.sprites.set(key, s);
    }
    if (g) g.drawImage(s.canvas, s.x, s.y, s.w, s.h);
    return s;
  }

  neon(g, str, x, y, size, color, on) {
    const w = str.length * size * 0.82 + size * 2;
    const h = size * 2.6;
    const s = this.cachedSprite(`neon:${str}:${on ? 1 : 0}`, [x - w / 2, y - h / 2, w, h], (gg) => neonText(gg, str, x, y, size, color, on ? 1 : 0));
    g.save();
    g.globalCompositeOperation = on ? 'lighter' : 'source-over';
    g.drawImage(s.canvas, s.x, s.y, s.w, s.h);
    g.restore();
  }

  neonOn(i, t) {
    const r = Math.sin(t * 0.7 + i * 3.1) + Math.sin(t * 2.3 + i);
    if (r > 1.82) return Math.sin(t * 60) > 0;
    return true;
  }

  blinkFor(i, t) {
    const cyc = (t + i * 1.37) % (3.2 + (i % 3));
    return cyc < 0.13 ? 1 : 0;
  }

  // ---------------------------------------------------------- interaction

  nearest(x) {
    let best = null, bd = Infinity;
    for (const e of this.entities) {
      if (!e.act) continue;
      const ax = e.npc ? e.npc.x : e.act.x;
      const d = Math.abs(x - ax);
      if (d <= e.act.range && d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  entityAt(wx, wy) {
    // tap target: entities whose act zone covers the tap x and a generous y band
    let best = null, bd = Infinity;
    for (const e of this.entities) {
      if (!e.act) continue;
      const ax = e.npc ? e.npc.x : e.act.x;
      const half = Math.max(e.act.range, 40);
      if (Math.abs(wx - ax) > half) continue;
      const top = e.npc ? FEET - 110 : Math.min(e.act.y, FEET - 140);
      // the floor itself means "walk here"; only the object (or a critter) is a tap target
      if (wy < top - 30 || wy > (e.npc ? FEET + 12 : FEET - 6)) continue;
      const d = Math.abs(wx - ax);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  actPoint(e) {
    return { x: e.npc ? e.npc.x : e.act.x, y: e.npc ? FEET - 118 : e.act.y };
  }

  // ---------------------------------------------------------- update

  update(dt, t, playerX) {
    this.playerX = playerX;
    for (const e of this.npcs) {
      const n = e.npc;
      if (n.range > 0) {
        if (n.idleT > 0) {
          n.idleT -= dt;
        } else {
          n.x += n.dir * n.speed * dt;
          n.phase = (n.phase + (n.speed * dt) / 62) % 1;
          if (Math.abs(n.x - n.home) > n.range) {
            n.dir *= -1;
            n.x = n.home + Math.sign(n.x - n.home) * n.range;
            n.idleT = 1 + Math.random() * 2;
          }
          n.facing = n.dir;
        }
      } else {
        n.facing = playerX < n.x ? -1 : 1;
      }
      if (n.who === 'sleeper' && Math.random() < dt * 0.8) {
        this.fx.add({ kind: 'z', x: n.x - 20, y: FEET - 70, vx: 10, vy: -26, g: 0, life: 2.2, size: 14 + Math.random() * 6, color: '#e6e0ff' });
      }
      if (n.who === 'busker' && Math.random() < dt * 1.6) {
        this.fx.add({ kind: 'note', text: Math.random() < 0.5 ? '♪' : '♫', x: n.x + 36 * n.facing, y: FEET - 60, vx: 20 * n.facing, vy: -40, g: 0, life: 1.8, size: 16, color: '#ffd23f' });
      }
    }
    // third-rail sparks
    if (this.def.variant !== 'sewer') {
      this.sparkT -= dt;
      if (this.sparkT < 0) {
        this.sparkT = 1.5 + Math.random() * 5;
        const sx = view.camX + Math.random() * view.vw;
        this.fx.burst(sx, 529, 10, { color: ['#bfe9ff', '#ffffff', '#7ab8ff'], speed: 160, g: 500, life: 0.45, kind: 'spark', spread: Math.PI, angle: -Math.PI / 2, add: true });
        this.env.onSpark?.(sx);
      }
    }
    // sewer pipes trickle
    for (const e of this.entities) {
      if (e.pipe && Math.random() < dt * 8) {
        this.fx.add({ x: e.x + (Math.random() - 0.5) * 20, y: 272, vx: 0, vy: 30, g: 600, life: 0.9, size: 2.2, color: '#7ed957' });
      }
    }
    this.fx.update(dt);
  }

  // ---------------------------------------------------------- render

  render(g, t, actors) {
    this.frame++;
    if (this.px !== view.px) { this.invalidate(); this.px = view.px; }
    const k = view.s * view.dpr;
    const offX = view.shakeX || 0, offY = view.shakeY || 0;
    // 1. background tiles in device space with integer snapping (no seams)
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = this.pal.pit;
    g.fillRect(0, 0, g.canvas.width, g.canvas.height);
    const [ix0, ix1, iy0, iy1] = this.visibleTileRange();
    for (let iy = iy0; iy <= iy1; iy++) {
      for (let ix = ix0; ix <= ix1; ix++) {
        if (ix * TILE > this.width + TILE || (ix + 1) * TILE < -TILE) continue;
        const tl = this.tile(ix, iy);
        const dx = Math.round((tl.x - view.camX + offX) * k);
        const dy = Math.round((tl.y - view.camY + offY) * k);
        const dw = Math.round((tl.x + TILE - view.camX + offX) * k) - dx;
        const dh = Math.round((tl.y + TILE - view.camY + offY) * k) - dy;
        g.drawImage(tl.canvas, dx, dy, dw, dh);
      }
    }
    this.prefetch();
    worldTransform(g);
    const vx0 = view.camX - 200, vx1 = view.camX + view.vw + 200;
    const vis = (e) => {
      const b = e.frontBounds || e.bbox;
      const x = b ? b[0] : (e.x ?? 0) - 100, w = b ? b[2] : 200;
      return x < vx1 && x + w > vx0;
    };
    // 2. live back layer
    for (const e of this.entities) if (e.dyn && vis(e)) e.dyn(g, t);
    // water for the sewer
    if (this.def.variant === 'sewer') this.drawWater(g, t);
    // 3. front sprites
    for (const e of this.entities) {
      if (!e.front || !vis(e)) continue;
      this.cachedSprite(`front:${e.index}`, e.frontBounds, e.front, g);
    }
    // 4. lights
    this.drawLights(g, t);
    // 5. NPCs + actors
    for (const e of this.npcs) if (e.npc.x > vx0 && e.npc.x < vx1) this.drawNpc(g, e, t);
    if (actors) actors(g);
    // 6. particles
    this.fx.draw(g);
  }

  drawNpc(g, e, t) {
    const n = e.npc;
    const boil = C.boilSeed(130 + e.index, t);
    const blink = this.blinkFor(e.index, t);
    switch (n.who) {
      case 'sleeper':
        C.drawSleeper(g, n.x, FEET - 54, { t, boil });
        break;
      case 'busker':
        C.drawBusker(g, n.x, FEET, { t, facing: n.facing, blink, boil });
        break;
      case 'pizza':
        C.drawPizzaRat(g, n.x, FEET, { t, facing: n.facing, walk: n.idleT > 0 ? null : n.phase, blink, boil });
        break;
      case 'ghostrat':
        C.drawGhostRat(g, n.x, FEET - 30, { t, facing: n.facing, blink, boil });
        break;
      default:
        C.drawCommuter(g, n.x, FEET, { t, facing: n.facing, paper: n.paper, blink, boil, fur: n.look?.fur, suit: n.look?.suit, hat: n.look?.hat, hatColor: n.look?.hatColor });
    }
  }

  drawWater(g, t) {
    const x0 = view.camX - 20, x1 = view.camX + view.vw + 20;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let row = 0; row < 7; row++) {
      const y = Y.FACE + 18 + row * 16;
      const sp = 30 + row * 8;
      g.strokeStyle = rgba('#7ed957', 0.1 + (row % 2) * 0.05);
      g.lineWidth = 2;
      g.beginPath();
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
        const ox = ((t * sp + row * 37) % 60);
        g.moveTo(x + ox, y);
        g.lineTo(x + ox + 24, y);
      }
      g.stroke();
    }
    g.restore();
  }

  drawLights(g, t) {
    const v = this.def.variant;
    const col = this.pal.light;
    if (!this.lightCone) this.lightCone = this.makeCone(col, v);
    const cone = this.lightCone;
    const x0 = view.camX - 300, x1 = view.camX + view.vw + 300;
    for (const L of this.lights) {
      if (L.x < x0 || L.x > x1) continue;
      let on = 1;
      if (L.dead) on = 0;
      else if (L.flicker) {
        const f = Math.sin(t * 13 + L.phase) + Math.sin(t * 31 + L.phase * 2) + Math.sin(t * 0.9 + L.phase);
        on = f > 1.4 ? 0.15 : 1;
      }
      if (v === 'ghost') {
        // chandelier + skylight beam
        this.chandelier(g, L.x, t, L);
        continue;
      }
      if (v === 'sewer') {
        // caged bulb on the wall
        const by = 140;
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 0.9 * on;
        g.drawImage(cone.canvas, L.x - cone.w / 2, by - 10, cone.w, cone.h);
        g.restore();
        ellipse(g, L.x, by, 8, 10, { fill: on > 0.5 ? '#fff6c8' : '#5a5a40', lw: 2.4, seed: 3 });
        g.strokeStyle = INK;
        g.lineWidth = 1.6;
        g.beginPath();
        g.moveTo(L.x - 8, by); g.lineTo(L.x + 8, by);
        g.moveTo(L.x, by - 10); g.lineTo(L.x, by + 10);
        g.stroke();
        continue;
      }
      // fluorescent fixture + cone
      if (on > 0.05) {
        g.save();
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = on;
        g.drawImage(cone.canvas, L.x - cone.w / 2, 80, cone.w, cone.h);
        g.restore();
      }
      rrect(g, L.x - 34, 72, 68, 12, 3, { fill: '#2a2640', lw: 2.6, seed: 5 });
      rrect(g, L.x - 30, 80, 60, 6, 3, { fill: on > 0.5 ? tint(col, 0.5) : '#4a4660', lw: 2, seed: 6 });
      g.strokeStyle = '#0a0716';
      g.lineWidth = 1.6;
      g.beginPath();
      g.moveTo(L.x - 24, 72); g.lineTo(L.x - 24, 48);
      g.moveTo(L.x + 24, 72); g.lineTo(L.x + 24, 48);
      g.stroke();
    }
    if (v === 'ghost') {
      // moonbeams from the skylights (one per vault)
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let cx = 210; cx < this.width; cx += 420) {
        if (cx < x0 || cx > x1) continue;
        const a = 0.08 + Math.sin(t * 0.5 + cx) * 0.02;
        const bg = g.createLinearGradient(0, -150, 0, Y.FLOOR_FRONT);
        bg.addColorStop(0, rgba('#c8fff0', a * 1.6));
        bg.addColorStop(1, rgba('#c8fff0', 0));
        g.fillStyle = bg;
        g.beginPath();
        g.moveTo(cx - 60, -150); g.lineTo(cx + 60, -150); g.lineTo(cx + 150, Y.FLOOR_FRONT); g.lineTo(cx - 30, Y.FLOOR_FRONT);
        g.fill();
      }
      g.restore();
    }
  }

  chandelier(g, x, t, L) {
    const y = 40;
    g.strokeStyle = '#2a2a1a';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x, -120); g.lineTo(x, y); g.stroke();
    const flick = L.flicker ? (Math.sin(t * 17 + L.phase) > 0.6 ? 0.4 : 1) : 1;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(x, y + 10, 4, x, y + 10, 120);
    gl.addColorStop(0, rgba('#ffd98a', 0.32 * flick));
    gl.addColorStop(1, rgba('#ffd98a', 0));
    g.fillStyle = gl;
    g.fillRect(x - 120, y - 110, 240, 240);
    g.restore();
    rrect(g, x - 30, y, 60, 8, 3, { fill: '#c8a050', lw: 2.4, seed: 7 });
    for (const dx of [-26, -9, 9, 26]) {
      g.strokeStyle = '#c8a050';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + dx, y + 8); g.lineTo(x + dx, y + 18); g.stroke();
      dot(g, x + dx, y + 20, 4, flick > 0.5 ? '#fff0b8' : '#8a7a50');
    }
  }

  makeCone(col, variant) {
    const w = variant === 'sewer' ? 200 : 280, h = variant === 'sewer' ? 300 : 340;
    const c = makeCanvas(w * this.px, h * this.px);
    const g = c.getContext('2d');
    g.scale(this.px, this.px);
    if (variant === 'sewer') {
      g.save();
      g.translate(w / 2, 10);
      g.scale(1, h / (w / 2) * 0.95);
      const rg = g.createRadialGradient(0, 0, 2, 0, 0, w / 2);
      rg.addColorStop(0, rgba(col, 0.34));
      rg.addColorStop(0.5, rgba(col, 0.1));
      rg.addColorStop(1, rgba(col, 0));
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, w / 2, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else {
      const lg = g.createLinearGradient(0, 0, 0, h);
      lg.addColorStop(0, rgba(col, 0.2));
      lg.addColorStop(0.7, rgba(col, 0.06));
      lg.addColorStop(1, rgba(col, 0));
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(w / 2 - 30, 0);
      g.lineTo(w / 2 + 30, 0);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.closePath();
      g.fill();
      // hot spot under the tube
      const rg = g.createRadialGradient(w / 2, 4, 2, w / 2, 4, 60);
      rg.addColorStop(0, rgba(col, 0.35));
      rg.addColorStop(1, rgba(col, 0));
      g.fillStyle = rg;
      g.fillRect(0, 0, w, 70);
    }
    return { canvas: c, w, h };
  }
}
