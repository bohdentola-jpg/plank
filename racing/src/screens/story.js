// STORY — "WHO RUNS PORT HALCYON?"  The hub is Santos Auto Body (garageScene):
// the race board on the wall, the parts shop, the body shop, the dealer's
// lot, and a flip phone that carries the plot. Races go through the normal
// race screen with onResult/onDone callbacks back into the story.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { buildGarageScene } from './garageScene.js';
import { buildCarModel } from '../car/model.js';
import { CARS, CAR_BY_ID, CLASS_ORDER } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { story, EVENT_BY_ID, prFor } from '../story/state.js';
import {
  CHAPTERS, PERF_PARTS, TIER_NAMES, TIER_UNLOCK, BODY_PARTS, STARTERS, DEALER_CLASS_UNLOCK, GARAGE_SLOTS,
  upgradesFor, BOSS_UNLOCK_WINS,
} from '../story/data.js';
import { drawTrackMap, trackInfo, fmtDistance } from './trackmap.js';
import { CLASS_COLORS, TYPE_NAMES, engineLabel } from './showroom.js';
import { C, vText, vWidth, text, paragraph, panel, hints, statBar, hit, roundRect } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp, damp, fmtTime, makeRng } from '../core/util.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';

const money = (n) => '$' + Math.round(n).toLocaleString();
const DISTRICTS = {
  city: { x: 0.53, y: 0.57 }, docks: { x: 0.22, y: 0.8 }, mountain: { x: 0.22, y: 0.24 },
  desert: { x: 0.84, y: 0.6 }, highway: { x: 0.68, y: 0.2 },
};

registerScreen('story', () => {
  let G = null;
  let page = 'hub';
  let pageT = 0;
  let t = 0;
  let model = null;
  let modelKey = '';
  let pendingModel = null;
  let toast = null;         // { text, t, color }
  let afterPhone = 'hub';
  let phoneScroll = 0;
  let hubMenu = null;
  // board
  let boardCh = 0, boardSel = 0;
  // perf
  let perfSel = 0, perfTier = 0;
  // body
  let bodySel = 0, bodyVal = null, bodyOrbit = 0;
  // cars
  let carsTab = 0, carsSel = 0, sellArm = 0;
  // classifieds
  let adSel = 0;
  // result
  let result = null;
  const cam = { pos: new THREE.Vector3(3.9, 1.55, 5.6), tgt: new THREE.Vector3(-0.9, 0.55, -0.3) };
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();

  const say = (txt, color = C.accent) => { toast = { text: txt, t: 0, color }; };

  function setPage(p) {
    page = p;
    pageT = 0;
    if (p === 'hub') hubMenu = makeHub();
    if (p === 'perf') perfTier = story.car.levels[PERF_PARTS[perfSel].id] || 0;
    if (p === 'body') { bodyVal = currentBodyVal(); }
    if (p === 'board') { boardCh = Math.min(story.s.chapter, CHAPTERS.length - 1); boardSel = firstOpen(boardCh); }
    if (p === 'cars') { carsSel = 0; sellArm = 0; }
    if (p === 'phone') { phoneScroll = 0; }
  }

  function firstOpen(ch) {
    const evs = story.events(ch);
    const k = evs.findIndex((e) => story.status(e) === 'open');
    if (k >= 0) return k;
    const b = evs.findIndex((e) => e.boss && story.status(e) !== 'locked' && story.status(e) !== 'won');
    return b >= 0 ? b : 0;
  }

  // ---------------------------------------------------------------- the car on the floor
  function showCar(spec, look) {
    const key = spec.id + JSON.stringify(look);
    if (key === modelKey) return;
    modelKey = key;
    pendingModel = { spec, look, at: 0.12 };
  }
  function buildPending(dt) {
    if (!pendingModel) return;
    pendingModel.at -= dt;
    if (pendingModel.at > 0) return;
    const { spec, look } = pendingModel;
    pendingModel = null;
    if (model) { G.scene.remove(model.group); model.dispose(); }
    model = buildCarModel(spec, look, { hiRes: true, interior: true, shadow: true });
    model.group.traverse((o) => { if (o.isMesh && !o.material?.transparent) o.castShadow = true; });
    model.setLights(0, 0.1, 0);
    G.scene.add(model.group);
  }
  function syncCar() {
    if (page === 'classifieds') {
      const ad = STARTERS[adSel];
      showCar(CAR_BY_ID[ad.id], ad.look);
    } else if (page === 'cars' && carsTab === 1) {
      const list = dealerList();
      const sp = list[carsSel]?.spec;
      if (sp) showCar(sp, { ...(sp.stockLook || {}) });
    } else if (page === 'cars' && carsTab === 0) {
      const c = story.s.cars[carsSel];
      if (c) showCar(CAR_BY_ID[c.id], story.look(c));
    } else if (page === 'body' && bodyVal !== null) {
      const part = BODY_PARTS[bodySel];
      showCar(story.spec(), { ...story.look(), [part.key]: bodyVal });
    } else if (story.car) {
      showCar(story.spec(), story.look());
    }
  }

  // ---------------------------------------------------------------- hub
  function makeHub() {
    const unread = story.s.unread;
    return new Menu([
      { label: 'THE BOARD', id: 'board', hint: 'Races, crews and the city map.' },
      { label: 'PERFORMANCE', id: 'perf', hint: 'Engine, turbo, suspension, tires, nitrous...' },
      { label: 'BODY SHOP', id: 'body', hint: 'Paint, vinyls, rims, kits, wings, glow.' },
      { label: 'CARS', id: 'cars', hint: 'Your garage and the dealer lot.' },
      { label: unread ? `PHONE  (${unread})` : 'PHONE', id: 'phone', hint: 'Messages.' },
      { label: 'SAVE & EXIT', id: 'exit', hint: 'Back to the radio. Progress saves itself.' },
    ], { id: 'hub', sel: hubMenu?.sel ?? 0 });
  }

  // ---------------------------------------------------------------- racing
  function raceEvent(ev) {
    const def = TRACK_BY_ID[ev.track];
    if (!def) { say('TRACK STILL UNDER CONSTRUCTION', C.red); return; }
    const spec = story.spec();
    const laps = ev.type === 'knockout' ? Math.max(2, ev.rivals) : ev.type === 'timeattack' ? (def.type === 'sprint' ? 1 : 3) : ev.laps || def.laps || 3;
    go('race', {
      trackDef: def, spec, look: story.look(), upgrades: story.up(), type: ev.type, laps,
      opponents: story.rivals(ev), rubber: ev.boss ? 0.4 : 0.75, ttFactor: ev.tt, traffic: ev.traffic,
      driftRivals: ev.type === 'drift' ? CHAPTERS[ev.ch].members.slice(0, 3).map((n, k) => [n, [2.3, 3.6, 4.8][k] * (1 + ev.ch * 0.15)]) : undefined,
      musicTheme: ev.boss ? 'race_boss' : undefined, playerGrid: ev.boss ? 'back' : 'back',
      quitLabel: 'QUIT TO GARAGE', story: ev.id,
      banner: {
        title: ev.name, sub: `${CHAPTERS[ev.ch].crew}  ·  ${ev.boss ? 'BOSS RACE' : TYPE_NAMES[ev.type] || ''}`, color: CHAPTERS[ev.ch].color,
        boss: ev.boss ? { name: CHAPTERS[ev.ch].boss.name, car: `${CAR_BY_ID[CHAPTERS[ev.ch].boss.car].make} ${CAR_BY_ID[CHAPTERS[ev.ch].boss.car].model}`, quote: CHAPTERS[ev.ch].boss.quote } : null,
      },
      onResult: (res) => story.applyResult(ev, res),
      onDone: () => go('story', { from: 'race', event: ev.id }),
    });
  }

  // ---------------------------------------------------------------- cars
  function dealerList() {
    return CARS.map((spec) => {
      const locked = (DEALER_CLASS_UNLOCK[spec.cls] ?? 9) > story.s.chapter;
      return { spec, locked, price: spec.price };
    });
  }

  function currentBodyVal() {
    const part = BODY_PARTS[bodySel];
    const L = { ...story.look() };
    const sp = story.spec();
    const stock = { ...(sp.stockLook || {}) };
    let v = L[part.key] ?? stock[part.key];
    if (v === undefined) v = part.options[0];
    return v;
  }

  const bodyPrice = (part, v) => (typeof part.price === 'function' ? part.price(v) : part.price);

  // ---------------------------------------------------------------- screen
  const scr = {
    enter(p = {}) {
      G = buildGarageScene(game.renderer.gl);
      game.renderer.setPost({ exposure: 1.12, bloomStrength: 0.85, bloomThreshold: 0.95, saturation: 1.02, contrast: 1.08, vignette: 0.9, lift: [0.006, 0.004, 0.0], gain: [1.03, 1.0, 0.97] }, true);
      try {
        if (music.theme !== 'underground') music.play('underground', { fade: 2, intensity: 0.6 });
        music.setTuning(0, true);
        sfx.rain(0.25);
      } catch { /* */ }
      if (p.newGame || !story.load()) {
        story.start();
        afterPhone = 'classifieds';
        setPage('phone');
      } else if (!story.s.cars.length) {
        setPage('classifieds');
      } else if (p.from === 'race' && story.lastSummary) {
        result = story.lastSummary;
        story.lastSummary = null;
        setPage('result');
      } else {
        setPage('hub');
      }
      const st = G.stations[stationFor(page)];
      cam.pos.fromArray(st[0]);
      cam.tgt.fromArray(st[1]);
      syncCar();
      if (pendingModel) pendingModel.at = 0;
      buildPending(0);
      window.__story = { story, setPage, raceEvent, get page() { return page; } };
    },
    exit() {
      if (model) model.dispose();
      model = null;
      try { sfx.rain(0); } catch { /* */ }
      G?.dispose();
      G = null;
    },
    update(dt, busy) {
      if (!G) return;
      t += dt;
      pageT += dt;
      G.update(dt, t);
      try { music.update?.(); } catch { /* */ }
      if (toast) { toast.t += dt; if (toast.t > 2.6) toast = null; }
      if (sellArm > 0) sellArm -= dt;
      if (!busy) handleInput(dt);
      syncCar();
      buildPending(dt);
      if (model) model.animate(dt, 0, 0);
      updateCamera(dt);
    },
    view() { return G ? { scene: G.scene, camera: G.camera } : null; },
    draw(ctx) {
      if (!G) return;
      const a = clamp(pageT / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (page !== 'phone' && page !== 'result') drawTopBar(ctx);
      if (page === 'hub') drawHub(ctx);
      else if (page === 'board') drawBoard(ctx);
      else if (page === 'perf') drawPerf(ctx);
      else if (page === 'body') drawBody(ctx);
      else if (page === 'cars') drawCars(ctx);
      else if (page === 'classifieds') drawClassifieds(ctx);
      else if (page === 'phone') drawPhone(ctx);
      else if (page === 'result') drawResult(ctx);
      ctx.restore();
      if (toast) {
        const k = Math.min(1, toast.t * 6) * Math.min(1, (2.6 - toast.t) * 3);
        ctx.save();
        ctx.globalAlpha = k;
        panel(ctx, 312, 330, 400, 56, { accent: toast.color, accentLen: 400, alpha: 0.95 });
        vText(ctx, toast.text, 512, 368, 20, { align: 'center', color: toast.color });
        ctx.restore();
      }
    },
  };

  function stationFor(p) {
    return { hub: 'hub', board: 'board', perf: 'perf', body: 'body', cars: 'dealer', classifieds: 'dealer', phone: 'phone', result: 'hub' }[p] || 'hub';
  }

  function updateCamera(dt) {
    const st = G.stations[stationFor(page)];
    _p.fromArray(st[0]);
    _t.fromArray(st[1]);
    if (page === 'body') {
      const rs = Math.abs(input.axes[2] || 0) > 0.15 ? input.axes[2] : 0;
      bodyOrbit += (rs ? rs * 1.8 : 0.18) * dt;
      if (input.mouse.down && input.device === 'mouse') bodyOrbit += (input.mouse.dx || 0) * 0.005;
      const r = 6.0, a = bodyOrbit + 0.6;
      _p.set(Math.sin(a) * r, 1.35, Math.cos(a) * r);
      _t.set(-Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7);
    }
    G.lift.visible = page !== 'body';
    const k = 1 - Math.exp(-dt * 3.2);
    cam.pos.lerp(_p, k);
    cam.tgt.lerp(_t, k);
    G.camera.position.copy(cam.pos);
    G.camera.position.y += Math.sin(t * 0.5) * 0.01;
    G.camera.lookAt(cam.tgt);
  }

  // ---------------------------------------------------------------- input per page
  function handleInput(dt) {
    const back = input.pressed('back');
    const ok = input.pressed('confirm');
    const click = input.takeClick();
    if (page === 'hub') {
      const it = hubMenu.update(dt);
      if (it) {
        if (it.id === 'exit') { story.save(); go('radio', { station: 'story' }); return; }
        if (it.id === 'phone') { afterPhone = 'hub'; setPage('phone'); return; }
        setPage(it.id);
      }
      if (back) { story.save(); go('radio', { station: 'story' }); }
      return;
    }
    if (page === 'phone') {
      if (input.pressed('up')) phoneScroll = Math.min(phoneScroll + 1, Math.max(0, story.inbox().length - 4));
      if (input.pressed('down')) phoneScroll = Math.max(0, phoneScroll - 1);
      if ((ok || back || click) && pageT > 0.4) {
        story.markRead();
        uiSound('back');
        const next = afterPhone;
        afterPhone = 'hub';
        setPage(next);
      }
      return;
    }
    if (page === 'result') {
      if ((ok || back || click) && pageT > 0.8) {
        if (result?.newMessages) { afterPhone = 'hub'; setPage('phone'); } else setPage(result?.won ? 'board' : 'hub');
        result = null;
      }
      return;
    }
    if (page === 'classifieds') {
      if (input.pressed('right') || input.pressed('down')) { adSel = (adSel + 1) % STARTERS.length; uiSound('move'); }
      if (input.pressed('left') || input.pressed('up')) { adSel = (adSel + STARTERS.length - 1) % STARTERS.length; uiSound('move'); }
      if (click && hit.hover?.startsWith('ad:')) { const k = parseInt(hit.hover.slice(3), 10); if (k === adSel) buyStarter(); else adSel = k; }
      if (ok) buyStarter();
      if (back && story.s.cars.length) setPage('hub');
      return;
    }
    if (back) { uiSound('back'); setPage('hub'); return; }
    if (page === 'board') boardInput(ok, click);
    else if (page === 'perf') perfInput(ok);
    else if (page === 'body') bodyInput(ok);
    else if (page === 'cars') carsInput(ok, click);
  }

  function buyStarter() {
    const ad = STARTERS[adSel];
    if (story.s.cash < ad.price) { say('NOT ENOUGH CASH', C.red); return; }
    story.s.cash -= ad.price;
    story.addCar(ad.id, ad.look);
    story.message('starter');
    story.save();
    try { sfx.ui('buy'); sfx.engineStart(); } catch { /* */ }
    afterPhone = 'hub';
    setPage('phone');
  }

  function boardInput(ok, click) {
    const evs = story.events(boardCh);
    if (input.pressed('right') || input.pressed('down')) { boardSel = (boardSel + 1) % evs.length; uiSound('move'); }
    if (input.pressed('left') || input.pressed('up')) { boardSel = (boardSel + evs.length - 1) % evs.length; uiSound('move'); }
    const maxCh = Math.min(story.s.chapter, CHAPTERS.length - 1);
    if (input.pressed('tabR') && boardCh < maxCh) { boardCh++; boardSel = firstOpen(boardCh); uiSound('tab'); }
    if (input.pressed('tabL') && boardCh > 0) { boardCh--; boardSel = firstOpen(boardCh); uiSound('tab'); }
    if (click && hit.hover?.startsWith('pin:')) {
      const k = parseInt(hit.hover.slice(4), 10);
      if (k === boardSel) ok = true; else { boardSel = k; uiSound('move'); }
    }
    if (click && hit.hover?.startsWith('dist:')) {
      const ch = parseInt(hit.hover.slice(5), 10);
      if (ch <= maxCh) { boardCh = ch; boardSel = firstOpen(ch); uiSound('tab'); }
    }
    if (ok) {
      const ev = evs[boardSel];
      const st = story.status(ev);
      if (st === 'locked') { say(ev.boss ? `WIN ${BOSS_UNLOCK_WINS} RACES FIRST` : 'LOCKED', C.red); uiSound('error'); return; }
      uiSound('select');
      raceEvent(ev);
    }
  }

  function perfInput(ok) {
    const n = PERF_PARTS.length;
    if (input.pressed('down')) { perfSel = (perfSel + 1) % n; perfTier = story.car.levels[PERF_PARTS[perfSel].id] || 0; uiSound('move'); }
    if (input.pressed('up')) { perfSel = (perfSel + n - 1) % n; perfTier = story.car.levels[PERF_PARTS[perfSel].id] || 0; uiSound('move'); }
    if (input.pressed('right')) { perfTier = Math.min(3, perfTier + 1); uiSound('tab'); }
    if (input.pressed('left')) { perfTier = Math.max(0, perfTier - 1); uiSound('tab'); }
    if (ok) {
      const part = PERF_PARTS[perfSel];
      const cur = story.car.levels[part.id] || 0;
      if (perfTier === cur) { say('ALREADY INSTALLED', C.dim); return; }
      const owned = story.car.owned[part.id] || 0;
      const err = story.setPart(part.id, perfTier);
      if (err) { say(err, C.red); uiSound('error'); return; }
      say(perfTier > owned ? `BOUGHT ${TIER_NAMES[perfTier]} ${part.name}` : `INSTALLED ${TIER_NAMES[perfTier]} ${part.name}`, C.green);
      try { sfx.airWrench(); sfx.ui('buy'); } catch { /* */ }
    }
  }

  function bodyInput(ok) {
    const n = BODY_PARTS.length;
    const move = (d) => { bodySel = (bodySel + d + n) % n; bodyVal = currentBodyVal(); uiSound('move'); };
    if (input.pressed('down')) move(1);
    if (input.pressed('up')) move(-1);
    const part = BODY_PARTS[bodySel];
    const dir = input.pressed('right') ? 1 : input.pressed('left') ? -1 : 0;
    if (dir) {
      const opts = part.options;
      const i = Math.max(0, opts.indexOf(bodyVal));
      bodyVal = opts[(i + dir + opts.length) % opts.length];
      uiSound('tab');
    }
    if (ok) {
      const cur = currentBodyVal();
      if (bodyVal === cur) { say('ALREADY ON THE CAR', C.dim); return; }
      const price = bodyPrice(part, bodyVal);
      const err = story.buyLook({ [part.key]: bodyVal }, price);
      if (err) { say(err, C.red); uiSound('error'); return; }
      say(`${part.name} DONE  -${money(price)}`, C.green);
      try { sfx.spray(); sfx.ui('buy'); } catch { /* */ }
    }
  }

  function carsInput(ok, click) {
    if (input.pressed('tabR') || input.pressed('tabL')) { carsTab = 1 - carsTab; carsSel = 0; uiSound('tab'); }
    if (click && hit.hover?.startsWith('ctab:')) { carsTab = parseInt(hit.hover.slice(5), 10); carsSel = 0; uiSound('tab'); }
    const n = carsTab === 0 ? story.s.cars.length : dealerList().length;
    if (input.pressed('down')) { carsSel = (carsSel + 1) % n; sellArm = 0; uiSound('move'); }
    if (input.pressed('up')) { carsSel = (carsSel + n - 1) % n; sellArm = 0; uiSound('move'); }
    if (click && hit.hover?.startsWith('crow:')) { const k = parseInt(hit.hover.slice(5), 10); if (k === carsSel) ok = true; else carsSel = k; }
    if (carsTab === 0) {
      const car = story.s.cars[carsSel];
      if (ok && car) { story.setActive(car.uid); say(`${CAR_BY_ID[car.id].model} IS YOUR RIDE`, C.green); uiSound('select'); }
      if (input.pressed('extra') && car) {
        if (sellArm > 0) {
          const err = story.sellCar(car.uid);
          if (err) say(err, C.red); else { say(`SOLD  +${money(story.value(car))}`, C.green); carsSel = 0; }
          sellArm = 0;
        } else { sellArm = 2.5; say(`SELL FOR ${money(story.value(car))}? PRESS AGAIN`, C.accent); }
      }
    } else {
      const d = dealerList()[carsSel];
      if (ok && d) {
        const err = story.buyCar(d.spec, d.price, { ...(d.spec.stockLook || {}) });
        if (err) { say(err, C.red); uiSound('error'); } else { say(`BOUGHT ${d.spec.make} ${d.spec.model}`, C.green); try { sfx.ui('buy'); sfx.engineStart(); } catch { /* */ } carsTab = 0; carsSel = story.s.cars.length - 1; }
      }
    }
  }

  // ---------------------------------------------------------------- drawing
  function drawTopBar(ctx) {
    const ch = CHAPTERS[Math.min(story.s.chapter, CHAPTERS.length - 1)];
    text(ctx, 'THE UNDERGROUND 92.7  ·  STORY', 40, 38, { size: 12, color: C.cyan, weight: 800, spacing: 3 });
    vText(ctx, 'SANTOS AUTO BODY', 38, 74, 30, { color: '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.7)', shadow: [3, 3, 'rgba(0,0,0,0.5)'] });
    // cash + chapter chip
    panel(ctx, 700, 20, 300, 64, { accent: ch.color, accentLen: 120, alpha: 0.92 });
    vText(ctx, money(story.s.cash), 982, 58, 26, { align: 'right', color: C.green, outline: 2, outlineColor: 'rgba(0,0,0,0.6)' });
    text(ctx, story.s.finished ? 'PORT HALCYON IS YOURS' : `CH ${story.s.chapter + 1} · ${ch.crew}`, 724, 76, { size: 11, color: ch.color, weight: 800, spacing: 1.5 });
  }

  function drawCarChip(ctx, x, y) {
    const car = story.car;
    if (!car) return;
    const sp = story.spec();
    panel(ctx, x, y, 330, 70, { accent: CLASS_COLORS[sp.cls], accentLen: 100, alpha: 0.9 });
    text(ctx, `${sp.make}  ·  CLASS ${sp.cls}`, x + 24, y + 26, { size: 11, color: C.dim, weight: 800, spacing: 2 });
    const nm = sp.model;
    vText(ctx, nm, x + 24, y + 54, Math.min(22, 200 / Math.max(1, vWidth(nm, 1))), { color: '#fff' });
    text(ctx, 'PR', x + 262, y + 26, { size: 11, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, String(story.pr()), x + 306, y + 56, 26, { align: 'right', color: C.accent });
  }

  function drawHub(ctx) {
    panel(ctx, 34, 120, 360, 330, { accent: C.accent, alpha: 0.9 });
    hubMenu.draw(ctx, 76, 172, 290, { rowH: 46, size: 21, hintX: 60, hintY: 476 });
    // chapter status
    const chI = Math.min(story.s.chapter, CHAPTERS.length - 1);
    const ch = CHAPTERS[chI];
    const wins = story.winsIn(chI);
    panel(ctx, 34, 500, 360, 108, { accent: ch.color, accentLen: 140, alpha: 0.88 });
    text(ctx, `CHAPTER ${chI + 1}  ·  ${ch.name}`, 58, 528, { size: 12, color: ch.color, weight: 900, spacing: 2 });
    vText(ctx, ch.crew, 56, 558, 20, { color: '#fff' });
    const bossDone = story.s.bosses[chI];
    const line = story.s.finished ? 'Every crew in the city answers to you.'
      : bossDone ? 'Crew beaten.'
        : wins >= BOSS_UNLOCK_WINS ? `${ch.boss.name} is waiting for you. Check the board.`
          : `Win ${BOSS_UNLOCK_WINS - wins} more race${BOSS_UNLOCK_WINS - wins === 1 ? '' : 's'} to call out ${ch.boss.name}.`;
    text(ctx, line, 58, 586, { size: 13, color: '#c8d0dc', weight: 600 });
    drawCarChip(ctx, 660, 620);
    hints(ctx, [['ud', 'SELECT'], ['confirm', 'OPEN'], ['back', 'RADIO']], { y: 740 });
  }

  // ---- the board: city map + flyer
  function drawBoard(ctx) {
    const mx = 30, my = 104, mw = 560, mh = 560;
    drawCityMap(ctx, mx, my, mw, mh);
    const evs = story.events(boardCh);
    const ev = evs[boardSel];
    if (ev) drawFlyer(ctx, ev, 612, 112);
    hints(ctx, [['tabR', 'CREW'], ['lr', 'RACE'], ['confirm', 'GO'], ['back', 'BACK']], { y: 740 });
  }

  function drawCityMap(ctx, x, y, w, h) {
    ctx.save();
    // paper
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-0.012);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#e6dfc8';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    const rng = makeRng('citymap');
    // water (the bay)
    ctx.fillStyle = '#9cbbd0';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.66);
    ctx.bezierCurveTo(w * 0.2, h * 0.6, w * 0.35, h * 0.9, w * 0.42, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    ctx.fill();
    // mountains
    ctx.strokeStyle = 'rgba(90,80,60,0.55)';
    ctx.lineWidth = 1.5;
    for (let k = 0; k < 16; k++) {
      const px = 20 + rng() * w * 0.4, py = 20 + rng() * h * 0.36, s = 10 + rng() * 16;
      ctx.beginPath(); ctx.moveTo(px - s, py + s * 0.6); ctx.lineTo(px, py - s * 0.6); ctx.lineTo(px + s, py + s * 0.6); ctx.stroke();
    }
    // desert stipple
    ctx.fillStyle = 'rgba(190,140,80,0.35)';
    for (let k = 0; k < 500; k++) ctx.fillRect(w * 0.68 + rng() * w * 0.32, h * 0.32 + rng() * h * 0.6, 2, 2);
    // street grid downtown
    ctx.strokeStyle = 'rgba(120,110,90,0.35)';
    ctx.lineWidth = 1;
    for (let k = 0; k < 9; k++) {
      ctx.beginPath(); ctx.moveTo(w * 0.38 + k * 14, h * 0.42); ctx.lineTo(w * 0.38 + k * 14, h * 0.72); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w * 0.36, h * 0.44 + k * 12); ctx.lineTo(w * 0.7, h * 0.44 + k * 12); ctx.stroke();
    }
    // highways linking the districts
    ctx.strokeStyle = 'rgba(200,60,40,0.6)';
    ctx.lineWidth = 4;
    const P = (d) => [DISTRICTS[d].x * w, DISTRICTS[d].y * h];
    const road = (a, b, bend = 0) => {
      const [ax, ay] = P(a), [bx, by] = P(b);
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo((ax + bx) / 2 + bend, (ay + by) / 2 - bend, bx, by);
      ctx.stroke();
    };
    road('city', 'docks', 30); road('city', 'mountain', -40); road('city', 'desert', 20); road('city', 'highway', 30); road('highway', 'mountain', 20);
    // districts
    CHAPTERS.forEach((ch, i) => {
      const [cx, cy] = P(ch.district);
      const open = i <= story.s.chapter;
      const sel = i === boardCh;
      hit.add(`dist:${i}`, x + cx - 60, y + cy - 60, 120, 120);
      ctx.beginPath();
      ctx.arc(cx, cy, 64, 0, Math.PI * 2);
      ctx.fillStyle = open ? hexA(ch.color, sel ? 0.22 : 0.12) : 'rgba(40,40,40,0.25)';
      ctx.fill();
      ctx.setLineDash(sel ? [] : [6, 5]);
      ctx.strokeStyle = open ? ch.color : 'rgba(60,60,60,0.6)';
      ctx.lineWidth = sel ? 3 : 2;
      ctx.stroke();
      ctx.setLineDash([]);
      text(ctx, open ? ch.name : '???', cx, cy - 70, { size: 13, color: open ? '#1d1b16' : '#5a5a5a', weight: 900, align: 'center', shadow: false, spacing: 1.5 });
      if (story.s.bosses[i]) text(ctx, 'BEATEN', cx, cy + 82, { size: 11, color: '#1d6a32', weight: 900, align: 'center', shadow: false, spacing: 2 });
    });
    // pins for the selected chapter
    const ch = CHAPTERS[boardCh];
    const [cx, cy] = P(ch.district);
    const evs = story.events(boardCh);
    evs.forEach((ev, k) => {
      const a = (k / evs.length) * Math.PI * 2 - Math.PI / 2;
      const px = ev.boss ? cx : cx + Math.cos(a) * 42;
      const py = ev.boss ? cy : cy + Math.sin(a) * 42;
      const st = story.status(ev);
      const sel = k === boardSel;
      hit.add(`pin:${k}`, x + px - 14, y + py - 14, 28, 28);
      const r = (ev.boss ? 11 : 8) + (sel ? 3 + Math.sin(t * 6) * 1.5 : 0);
      ctx.beginPath();
      ctx.arc(px + 1.5, py + 2, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = st === 'locked' ? '#777' : st === 'won' ? '#2f9e57' : ev.boss ? '#111' : ch.color;
      ctx.fill();
      ctx.strokeStyle = sel ? '#fff' : 'rgba(0,0,0,0.6)';
      ctx.lineWidth = sel ? 3 : 1.5;
      ctx.stroke();
      if (ev.boss) text(ctx, st === 'locked' ? '?' : '★', px, py + 5, { size: 14, color: '#ffd34a', weight: 900, align: 'center', shadow: false, font: 'Arial' });
      else if (st === 'won') text(ctx, '✓', px, py + 4, { size: 11, color: '#fff', weight: 900, align: 'center', shadow: false, font: 'Arial' });
    });
    // tape
    ctx.fillStyle = 'rgba(240,230,190,0.6)';
    ctx.fillRect(w / 2 - 50, -10, 100, 24);
    text(ctx, 'PORT HALCYON', 18, 30, { size: 18, color: '#1d1b16', weight: 900, shadow: false, spacing: 3 });
    ctx.restore();
  }

  function drawFlyer(ctx, ev, x, y) {
    const ch = CHAPTERS[ev.ch];
    const def = TRACK_BY_ID[ev.track];
    const st = story.status(ev);
    const w = 384, h = 560;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(0.018);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 18;
    ctx.fillStyle = ev.boss ? '#14151a' : '#f1ecdc';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    const ink = ev.boss ? '#f1ecdc' : '#16140f';
    const sub = ev.boss ? '#9aa0ac' : '#5a5446';
    ctx.fillStyle = ch.color;
    ctx.fillRect(0, 0, w, 8);
    text(ctx, ev.boss ? `${ch.crew}  ·  BOSS` : ch.crew, 22, 34, { size: 11, color: ev.boss ? ch.color : sub, weight: 900, spacing: 2, shadow: false });
    const ns = Math.min(30, (w - 44) / Math.max(1, vWidth(ev.name, 1)));
    vText(ctx, ev.name, 22, 72, ns, { color: ink, skew: -0.1 });
    // mini map
    if (def) {
      drawTrackMap(ctx, def, 22, 88, w - 44, 168, { t: game.time, grid: false });
      text(ctx, def.name, 32, 110, { size: 12, color: '#fff', weight: 900, spacing: 1.5 });
    } else {
      ctx.fillStyle = '#222';
      ctx.fillRect(22, 88, w - 44, 168);
      text(ctx, 'COMING SOON', w / 2, 178, { size: 14, color: '#888', weight: 900, align: 'center' });
    }
    const units = settings.get('units');
    const facts = [
      ['TYPE', TYPE_NAMES[ev.type] || ev.type.toUpperCase()],
      ['LAPS', ev.type === 'sprint' || ev.type === 'drag' ? '—' : ev.type === 'knockout' ? String(Math.max(2, ev.rivals)) : ev.type === 'timeattack' ? (def?.type === 'sprint' ? '1 RUN' : 'BEST OF 3') : String(ev.laps || def?.laps || 3)],
      ['LENGTH', def ? fmtDistance(trackInfo(def).length, units) : '—'],
      ['RIVALS', ev.type === 'timeattack' ? 'THE CLOCK' : ev.type === 'drift' ? 'POSTED SCORES' : ev.boss ? ch.boss.name : String(ev.rivals)],
    ];
    facts.forEach(([k, v], i) => {
      const fx = 22 + (i % 2) * 180, fy = 282 + Math.floor(i / 2) * 42;
      text(ctx, k, fx, fy, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
      vText(ctx, v, fx, fy + 22, 16, { color: ink, skew: 0 });
    });
    // performance comparison
    const mine = story.pr();
    const theirs = ev.type === 'timeattack' || ev.type === 'drift' ? null : story.rivalPR(ev);
    text(ctx, 'YOUR PR', 22, 382, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
    vText(ctx, String(mine), 22, 408, 22, { color: ink, skew: 0 });
    if (theirs) {
      text(ctx, ev.boss ? `${ch.boss.name}'S PR` : 'RIVALS PR', 202, 382, { size: 10, color: sub, weight: 900, spacing: 2, shadow: false });
      const col = theirs > mine + 25 ? '#d42a2a' : theirs < mine - 25 ? '#2f9e57' : ink;
      vText(ctx, String(theirs), 202, 408, 22, { color: col, skew: 0 });
    }
    paragraph(ctx, ev.flavor, 22, 440, w - 44, { size: 13, color: ink, weight: 600, lineHeight: 18, shadow: false });
    // prize stamp
    ctx.save();
    ctx.translate(w - 222, h - 60);
    ctx.rotate(-0.1);
    ctx.strokeStyle = st === 'won' ? '#2f9e57' : '#c21c1c';
    ctx.lineWidth = 3;
    ctx.strokeRect(-6, -30, 196, 50);
    vText(ctx, st === 'won' ? 'WON' : money(ev.prize), 92, 6, 26, { align: 'center', color: st === 'won' ? '#2f9e57' : '#c21c1c', skew: 0 });
    ctx.restore();
    if (st === 'locked') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w, h);
      vText(ctx, 'LOCKED', w / 2, h / 2, 40, { align: 'center', color: '#fff', skew: 0 });
      if (ev.boss) text(ctx, `WIN ${BOSS_UNLOCK_WINS} OF ${ch.crew}'S RACES`, w / 2, h / 2 + 30, { size: 13, color: '#ddd', weight: 800, align: 'center' });
    } else {
      const rec = story.s.events[ev.id];
      if (rec && !rec.won && rec.best) text(ctx, `BEST: ${rec.best}${['', 'ST', 'ND', 'RD'][rec.best] || 'TH'}`, 22, h - 22, { size: 12, color: sub, weight: 900, spacing: 2, shadow: false });
    }
    // pin
    ctx.fillStyle = '#c21c1c';
    ctx.beginPath(); ctx.arc(w / 2, 14, 7, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ---- performance shop
  function drawPerf(ctx) {
    const car = story.car;
    const sp = story.spec();
    const part = PERF_PARTS[perfSel];
    panel(ctx, 30, 108, 420, 560, { accent: C.accent, alpha: 0.92 });
    text(ctx, 'PERFORMANCE', 56, 136, { size: 13, color: C.accent, weight: 900, spacing: 3 });
    PERF_PARTS.forEach((p, k) => {
      const y = 172 + k * 43;
      const sel = k === perfSel;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(46, y - 26, 390, 38); }
      vText(ctx, p.name, 62, y, 15, { color: sel ? '#fff' : '#c9d1de' });
      const lv = car.levels[p.id] || 0, own = car.owned[p.id] || 0;
      for (let tI = 1; tI <= 3; tI++) {
        const px = 330 + (tI - 1) * 30;
        ctx.strokeStyle = tI <= own ? C.accent : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px, y - 14, 22, 12);
        if (tI <= lv) { ctx.fillStyle = C.accent; ctx.fillRect(px + 2, y - 12, 18, 8); }
        if (sel && tI <= perfTier && tI > lv) { ctx.fillStyle = 'rgba(77,255,139,0.7)'; ctx.fillRect(px + 2, y - 12, 18, 8); }
      }
    });
    // detail
    const levels = { ...car.levels, [part.id]: perfTier };
    const now = carStats(sp, story.up());
    const next = carStats(sp, upgradesFor(levels, sp));
    const prNow = story.pr(), prNext = prFor(sp, upgradesFor(levels, sp));
    panel(ctx, 480, 108, 516, 560, { accent: C.cyan, accentLen: 160, alpha: 0.92 });
    vText(ctx, part.name, 506, 150, 24, { color: '#fff' });
    paragraph(ctx, part.desc, 508, 178, 460, { size: 13, color: C.dim, weight: 600, lineHeight: 18 });
    // tier choices
    TIER_NAMES.forEach((nm, tI) => {
      const x = 508 + tI * 118, y = 232;
      const sel = tI === perfTier;
      const owned = tI <= (car.owned[part.id] || 0);
      const open = story.tierOpen(tI);
      ctx.fillStyle = sel ? 'rgba(70,232,255,0.2)' : 'rgba(255,255,255,0.04)';
      ctx.fillRect(x, y, 108, 64);
      ctx.strokeStyle = sel ? C.cyan : 'rgba(255,255,255,0.12)';
      ctx.lineWidth = sel ? 2 : 1;
      ctx.strokeRect(x, y, 108, 64);
      vText(ctx, nm, x + 54, y + 26, 14, { align: 'center', color: open ? '#fff' : C.faint });
      const price = tI ? story.partPrice(part.id, tI) : 0;
      const lbl = tI === (car.levels[part.id] || 0) ? 'INSTALLED' : owned ? 'OWNED' : !open ? 'LOCKED' : money(price);
      text(ctx, lbl, x + 54, y + 50, { size: 12, color: lbl === 'INSTALLED' ? C.green : lbl === 'LOCKED' ? C.faint : price > story.s.cash && !owned ? C.red : C.accent, weight: 800, align: 'center' });
    });
    // PR + stats
    text(ctx, 'PERFORMANCE RATING', 508, 336, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, String(prNow), 508, 380, 40, { color: '#fff' });
    if (prNext !== prNow) {
      vText(ctx, '→', 610, 376, 26, { color: C.dim });
      vText(ctx, String(prNext), 648, 380, 40, { color: prNext > prNow ? C.green : C.red });
    }
    const units = settings.get('units');
    const rows = [
      ['SPEED', now.bars.speed, next.bars.speed, units === 'kmh' ? `${Math.round(next.vmax * 3.6)} KM/H` : `${Math.round(next.vmax * 2.237)} MPH`],
      ['ACCELERATION', now.bars.accel, next.bars.accel, `0-60 ${next.t60.toFixed(1)}S`],
      ['HANDLING', now.bars.handling, next.bars.handling, `${next.latG.toFixed(2)} G`],
      ['BRAKING', now.bars.braking, next.bars.braking, `${Math.round(next.brake60)} FT`],
    ];
    rows.forEach(([k, a, b, v], i) => {
      const y = 424 + i * 40;
      text(ctx, k, 508, y + 10, { size: 12, color: C.text, weight: 800, spacing: 1.5 });
      statBar(ctx, 650, y, 200, 12, a, { segments: 20, compare: b, color: C.accent });
      text(ctx, v, 976, y + 11, { size: 12, color: C.dim, weight: 700, align: 'right' });
    });
    text(ctx, `${engineLabel(sp)}  ·  ${Math.round(next.hp)} HP  ·  ${next.drive}`, 508, 600, { size: 13, color: '#c9d1de', weight: 700 });
    hints(ctx, [['ud', 'PART'], ['lr', 'TIER'], ['confirm', 'BUY / FIT'], ['back', 'BACK']], { y: 740 });
  }

  // ---- body shop
  function drawBody(ctx) {
    panel(ctx, 30, 108, 400, 600, { accent: C.accent, alpha: 0.9 });
    text(ctx, 'BODY SHOP', 56, 136, { size: 13, color: C.accent, weight: 900, spacing: 3 });
    const cur = currentBodyVal();
    BODY_PARTS.forEach((p, k) => {
      const y = 170 + k * 38;
      const sel = k === bodySel;
      if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(46, y - 24, 370, 34); }
      vText(ctx, p.name, 62, y, 14, { color: sel ? '#fff' : '#c9d1de' });
      const v = sel ? bodyVal : (story.look()[p.key] ?? story.spec().stockLook?.[p.key] ?? p.options[0]);
      if (p.swatch) {
        if (v) { ctx.fillStyle = v; ctx.fillRect(330, y - 16, 34, 18); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.strokeRect(330, y - 16, 34, 18); }
        else text(ctx, 'NONE', 398, y, { size: 12, color: C.dim, weight: 800, align: 'right' });
      } else {
        text(ctx, p.label(v), 398, y, { size: 12, color: sel ? C.accent : C.dim, weight: 800, align: 'right' });
      }
      if (sel) { text(ctx, '◄', 312, y, { size: 11, color: C.accent }); text(ctx, '►', 402, y, { size: 11, color: C.accent }); }
    });
    const part = BODY_PARTS[bodySel];
    const changed = bodyVal !== cur;
    const price = bodyPrice(part, bodyVal);
    panel(ctx, 640, 600, 356, 76, { accent: changed ? C.green : C.faint, accentLen: 120, alpha: 0.92 });
    text(ctx, changed ? 'PRICE' : 'ON THE CAR', 664, 628, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, changed ? money(price) : '—', 664, 660, 24, { color: changed ? (price > story.s.cash ? C.red : C.green) : C.dim });
    hints(ctx, [['ud', 'PART'], ['lr', 'STYLE'], ['stick', 'ROTATE'], ['confirm', 'BUY'], ['back', 'BACK']], { y: 740 });
  }

  // ---- cars: garage + dealer
  function drawCars(ctx) {
    ['MY GARAGE', 'DEALER'].forEach((nm, k) => {
      const x = 40 + k * 170;
      hit.add(`ctab:${k}`, x, 96, 160, 34);
      ctx.fillStyle = k === carsTab ? C.accent : 'rgba(10,14,22,0.8)';
      ctx.fillRect(x, 96, 160, 34);
      vText(ctx, nm, x + 80, 120, 15, { align: 'center', color: k === carsTab ? '#14100a' : C.dim });
    });
    panel(ctx, 30, 140, 420, 520, { accent: C.accent, alpha: 0.92, skew: 0 });
    if (carsTab === 0) {
      story.s.cars.forEach((c, k) => {
        const sp = CAR_BY_ID[c.id];
        const y = 170 + k * 70;
        const sel = k === carsSel;
        hit.add(`crow:${k}`, 40, y - 10, 400, 64);
        if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(40, y - 10, 400, 64); }
        text(ctx, `${sp.make} · CLASS ${sp.cls}${c.uid === story.s.active ? '  · ACTIVE' : ''}`, 60, y + 10, { size: 11, color: c.uid === story.s.active ? C.green : C.dim, weight: 800, spacing: 1.5 });
        vText(ctx, sp.model, 60, y + 38, Math.min(20, 260 / Math.max(1, vWidth(sp.model, 1))), { color: '#fff' });
        text(ctx, `PR ${story.pr(c)}`, 420, y + 14, { size: 13, color: C.accent, weight: 900, align: 'right' });
        text(ctx, money(story.value(c)), 420, y + 36, { size: 12, color: C.dim, weight: 700, align: 'right' });
      });
      text(ctx, `${story.s.cars.length} / ${GARAGE_SLOTS} BAYS`, 60, 640, { size: 12, color: C.dim, weight: 800, spacing: 2 });
      hints(ctx, [['tabR', 'DEALER'], ['ud', 'CAR'], ['confirm', 'DRIVE THIS'], ['extra', 'SELL'], ['back', 'BACK']], { y: 740 });
    } else {
      const list = dealerList();
      const per = 12;
      const first = Math.max(0, Math.min(carsSel - 5, list.length - per));
      list.slice(first, first + per).forEach((d, i) => {
        const k = first + i;
        const y = 168 + i * 40;
        const sel = k === carsSel;
        hit.add(`crow:${k}`, 40, y - 24, 400, 36);
        if (sel) { ctx.fillStyle = 'rgba(255,178,30,0.16)'; ctx.fillRect(40, y - 24, 400, 36); }
        ctx.fillStyle = CLASS_COLORS[d.spec.cls];
        ctx.fillRect(52, y - 18, 22, 22);
        text(ctx, d.spec.cls, 63, y - 2, { size: 13, color: '#fff', weight: 900, align: 'center' });
        text(ctx, `${d.spec.make} ${d.spec.model}`, 86, y - 1, { size: 14, color: d.locked ? C.faint : sel ? '#fff' : '#c9d1de', weight: 700 });
        text(ctx, d.locked ? 'LOCKED' : money(d.price), 428, y - 1, { size: 13, color: d.locked ? C.faint : d.price > story.s.cash ? C.red : C.accent, weight: 800, align: 'right' });
      });
      const d = list[carsSel];
      if (d) {
        const st = carStats(d.spec);
        panel(ctx, 640, 470, 356, 190, { accent: CLASS_COLORS[d.spec.cls], accentLen: 120, alpha: 0.9 });
        text(ctx, `${d.spec.year} · ${engineLabel(d.spec)} · ${st.drive}`, 664, 498, { size: 11, color: C.dim, weight: 800, spacing: 1 });
        text(ctx, `${st.hp} HP   0-60 ${st.t60.toFixed(1)}S   PR ${prFor(d.spec, {})}`, 664, 522, { size: 13, color: '#fff', weight: 800 });
        paragraph(ctx, d.spec.blurb, 664, 548, 310, { size: 12, color: '#bcc5d3', weight: 500, lineHeight: 16 });
        if (d.locked) text(ctx, `ON THE LOT FROM CHAPTER ${(DEALER_CLASS_UNLOCK[d.spec.cls] ?? 0) + 1}`, 664, 646, { size: 12, color: C.red, weight: 800 });
      }
      hints(ctx, [['tabL', 'GARAGE'], ['ud', 'CAR'], ['confirm', 'BUY'], ['back', 'BACK']], { y: 740 });
    }
  }

  // ---- classifieds (first car)
  function drawClassifieds(ctx) {
    // newspaper page
    const x = 40, y = 108, w = 420, h = 590;
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(-0.015);
    ctx.translate(-w / 2, -h / 2);
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#ece6d4';
    ctx.fillRect(0, 0, w, h);
    ctx.shadowBlur = 0;
    text(ctx, 'THE HALCYON GAZETTE', w / 2, 40, { size: 22, color: '#141210', weight: 900, align: 'center', shadow: false, font: 'Georgia, "Times New Roman", serif' });
    ctx.fillStyle = '#141210';
    ctx.fillRect(20, 52, w - 40, 3);
    text(ctx, 'CLASSIFIEDS  ·  AUTOS FOR SALE', w / 2, 76, { size: 12, color: '#141210', weight: 900, align: 'center', shadow: false, spacing: 2 });
    STARTERS.forEach((ad, k) => {
      const ay = 100 + k * 120;
      const sel = k === adSel;
      hit.add(`ad:${k}`, x + 20, y + ay, w - 40, 112);
      if (sel) {
        ctx.strokeStyle = '#c21c1c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(w / 2, ay + 54, w / 2 - 14, 58, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      const sp = CAR_BY_ID[ad.id];
      text(ctx, `${sp.make} ${sp.model}`.toUpperCase(), 30, ay + 26, { size: 15, color: '#141210', weight: 900, shadow: false, font: 'Georgia, serif' });
      paragraph(ctx, ad.ad, 30, ay + 48, w - 60, { size: 13, color: '#2a2620', weight: 500, lineHeight: 17, shadow: false, font: 'Georgia, serif' });
      text(ctx, money(ad.price) + ' OBO', w - 30, ay + 26, { size: 15, color: '#141210', weight: 900, align: 'right', shadow: false, font: 'Georgia, serif' });
    });
    ctx.restore();
    const ad = STARTERS[adSel];
    const sp = CAR_BY_ID[ad.id];
    const st = carStats(sp);
    panel(ctx, 620, 500, 376, 150, { accent: CLASS_COLORS[sp.cls], accentLen: 120, alpha: 0.9 });
    text(ctx, `${sp.year} · ${engineLabel(sp)} · ${st.drive}`, 644, 528, { size: 12, color: C.dim, weight: 800, spacing: 1 });
    vText(ctx, sp.model, 644, 562, 24, { color: '#fff' });
    text(ctx, `${st.hp} HP  ·  0-60 ${st.t60.toFixed(1)} S  ·  PR ${prFor(sp, {})}`, 644, 592, { size: 13, color: '#c9d1de', weight: 700 });
    text(ctx, `LEFT AFTER: ${money(story.s.cash - ad.price)}`, 644, 626, { size: 13, color: C.green, weight: 900, spacing: 1 });
    hints(ctx, [['ud', 'AD'], ['confirm', 'CALL THE SELLER']], { y: 740 });
  }

  // ---- phone
  function drawPhone(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, 1024, 768);
    const x = 332, y = 40, w = 360, h = 690;
    // the clamshell
    roundRect(ctx, x, y, w, h, 34);
    const g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, '#5c616b');
    g.addColorStop(0.5, '#b9bec7');
    g.addColorStop(1, '#4a4e57');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#1b1d22';
    ctx.lineWidth = 3;
    ctx.stroke();
    // screen
    const sx = x + 28, sy = y + 70, sw = w - 56, sh = 470;
    ctx.fillStyle = '#06110d';
    ctx.fillRect(sx - 6, sy - 6, sw + 12, sh + 12);
    const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
    sg.addColorStop(0, '#0f3b2a');
    sg.addColorStop(1, '#082419');
    ctx.fillStyle = sg;
    ctx.fillRect(sx, sy, sw, sh);
    text(ctx, 'NOVATEL', x + w / 2, y + 44, { size: 14, color: '#2a2d33', weight: 900, align: 'center', shadow: false, spacing: 4 });
    // status bar
    ctx.fillStyle = '#8affc0';
    for (let b = 0; b < 4; b++) ctx.fillRect(sx + 8 + b * 5, sy + 18 - (b + 1) * 3, 3, (b + 1) * 3);
    text(ctx, '11:58P', sx + sw - 8, sy + 18, { size: 12, color: '#8affc0', weight: 700, shadow: false, align: 'right', font: '"Consolas", monospace' });
    ctx.fillStyle = 'rgba(138,255,192,0.4)';
    ctx.fillRect(sx + 6, sy + 26, sw - 12, 1);
    // messages, newest at the bottom
    const msgs = story.inbox();
    const vis = msgs.slice(Math.max(0, msgs.length - 4 - phoneScroll), msgs.length - phoneScroll);
    let my = sy + 48;
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy + 30, sw, sh - 34);
    ctx.clip();
    vis.forEach((m) => {
      const fresh = !m.read;
      text(ctx, `FROM: ${m.from}`, sx + 12, my, { size: 12, color: fresh ? '#ffffff' : '#8affc0', weight: 900, shadow: false, font: '"Consolas", monospace' });
      my += 8;
      const yy = paragraph(ctx, m.text, sx + 12, my + 12, sw - 24, { size: 13, color: fresh ? '#d8ffe8' : '#7fd0a2', weight: 600, lineHeight: 17, shadow: false, font: '"Consolas", monospace' });
      my = yy + 16;
    });
    ctx.restore();
    // keypad hint
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      roundRect(ctx, x + 50 + c * 92, y + 566 + r * 28, 76, 22, 8);
      ctx.fillStyle = '#2b2e35';
      ctx.fill();
    }
    const blink = Math.floor(t * 2) % 2;
    if (blink) text(ctx, '▼ PRESS ✕', sx + sw / 2, sy + sh - 10, { size: 12, color: '#8affc0', weight: 900, align: 'center', shadow: false, font: '"Consolas", monospace' });
    hints(ctx, [['ud', 'SCROLL'], ['confirm', 'CLOSE']], { y: 740 });
  }

  // ---- result card
  function drawResult(ctx) {
    if (!result) return;
    const ev = EVENT_BY_ID[result.ev];
    const ch = CHAPTERS[ev?.ch ?? 0];
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, 1024, 768);
    panel(ctx, 212, 170, 600, 400, { accent: result.won ? C.green : C.red, accentLen: 300, alpha: 0.95 });
    text(ctx, ev ? `${ch.crew}  ·  ${ev.name}` : '', 250, 212, { size: 13, color: ch.color, weight: 900, spacing: 2 });
    const title = result.finished ? 'PORT HALCYON IS YOURS' : result.won ? (ev?.boss ? `${ch.boss.name} IS DONE` : 'YOU WON') : ev?.type === 'timeattack' ? 'TOO SLOW' : result.place ? `${result.place}${['', 'ST', 'ND', 'RD'][result.place] || 'TH'} PLACE` : 'OUT';
    vText(ctx, title, 248, 270, Math.min(44, 520 / Math.max(1, vWidth(title, 1))), { color: result.won ? C.green : '#fff', outline: 3, outlineColor: 'rgba(0,0,0,0.6)' });
    text(ctx, 'PAYOUT', 250, 330, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, result.pay ? `+${money(result.pay)}` : '$0', 250, 370, 34, { color: result.pay ? C.green : C.dim });
    text(ctx, 'CASH', 520, 330, { size: 12, color: C.dim, weight: 800, spacing: 2 });
    vText(ctx, money(story.s.cash), 520, 370, 34, { color: '#fff' });
    let y = 430;
    const line = (s, col) => { vText(ctx, s, 250, y, 18, { color: col }); y += 34; };
    if (result.bossUnlocked) line(`${ch.boss.name} WANTS A WORD`, C.accent);
    if (result.chapterUp) line(`CHAPTER ${Math.min(5, (ev?.ch ?? 0) + 2)} UNLOCKED`, C.cyan);
    if (result.finished) line('YOU RUN THE FREQUENCY NOW', C.cyan);
    if (result.newMessages) line(`${result.newMessages} NEW MESSAGE${result.newMessages > 1 ? 'S' : ''}`, '#8affc0');
    if (!result.won && !result.pay) line('Tune the car, try again.', C.dim);
    if (pageT > 0.8) hints(ctx, [['confirm', 'CONTINUE']], { y: 740 });
  }

  return scr;
});

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
