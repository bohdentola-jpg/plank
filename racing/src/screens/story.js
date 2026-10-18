// STORY — "WHO RUNS PORT HALCYON?"  The hub is Santos Auto Body (garageScene):
// the race board on the wall, THE LIST of every crew and rival, the parts
// shop, the body shop, the dealer's lot, and a flip phone that carries the
// plot. Races go through the normal race screen with onResult/onDone
// callbacks back into the story; chapter cards, pink slips and texts follow
// a race in that order (advance()). The map, flyer, list and cards are
// drawn by the modules in ./story/.
import * as THREE from 'three';
import { registerScreen, game, go } from '../main.js';
import { buildGarageScene } from './garageScene.js';
import { buildCarModel } from '../car/model.js';
import { CARS, CAR_BY_ID } from '../car/cars.js';
import { carStats } from '../car/stats.js';
import { TRACK_BY_ID } from '../track/tracks.js';
import { trackInfo } from './trackmap.js';
import { story, EVENT_BY_ID, prFor } from '../story/state.js';
import {
  CHAPTERS, EVENTS, RIVALS, PERF_PARTS, TIER_NAMES, BODY_PARTS, STARTERS, DEALER_CLASS_UNLOCK, GARAGE_SLOTS,
  V1_EVENTS, upgradesFor,
} from '../story/data.js';
import { CLASS_COLORS, TYPE_NAMES, engineLabel } from './showroom.js';
import { C, vText, vWidth, text, paragraph, panel, hints, statBar, hit, roundRect } from '../core/ui.js';
import { Menu, uiSound } from '../core/menu.js';
import { input } from '../core/input.js';
import { settings } from '../core/settings.js';
import { clamp } from '../core/util.js';
import { music } from '../audio/music.js';
import { sfx } from '../audio/sfx.js';
import { knockLaps } from '../race/sim.js';
import { money, wrap, drawRank } from './story/common.js';
import { drawCityMap } from './story/map.js';
import { drawFlyer } from './story/flyer.js';
import { drawRivals, drawRivalCar, rivalRows, LIST_TABS } from './story/rivals.js';
import { drawChapterCard, drawSlipPaper, drawResult } from './story/cards.js';

const LAST = CHAPTERS.length - 1;
const carName = (id) => { const sp = CAR_BY_ID[id]; return `${sp.make} ${sp.model}`; };

registerScreen('story', () => {
  let G = null;
  let page = 'hub';
  let pageT = 0;
  let t = 0;
  let model = null;
  let modelKey = '';
  let pendingModel = null;
  let toast = null;         // { text, t, color }
  let flowNext = 'hub';     // where advance() lands once the story has nothing to show
  let phoneScroll = 0;
  let hubMenu = null;
  // board
  let boardCh = 0, boardSel = 0, quitArm = 0;
  // the list
  let rivTab = 1, rivSel = 0;
  // perf
  let perfSel = 0, perfTier = 0;
  // body
  let bodySel = 0, bodyVal = null, bodyOrbit = 0;
  // cars
  let carsTab = 0, carsSel = 0, sellArm = 0;
  // classifieds
  let adSel = 0;
  // result, chapter card, pink slip
  let result = null;
  let card = null;
  let slipMenu = null, slipLater = false;
  const cam = { pos: new THREE.Vector3(3.9, 1.55, 5.6), tgt: new THREE.Vector3(-0.9, 0.55, -0.3) };
  const _p = new THREE.Vector3(), _t = new THREE.Vector3();

  const say = (txt, color = C.accent) => { toast = { text: txt, t: 0, color }; };

  function setPage(p) {
    page = p;
    pageT = 0;
    if (p === 'hub') hubMenu = makeHub();
    if (p === 'perf') perfTier = story.car.levels[PERF_PARTS[perfSel].id] || 0;
    if (p === 'body') { bodyVal = currentBodyVal(); }
    if (p === 'board') {
      boardCh = Math.min(story.s.chapter, LAST);
      if (story.s.cup) boardCh = EVENT_BY_ID[story.s.cup.id].ch;
      boardSel = firstOpen(boardCh);
      quitArm = 0;
      story.queueWarm(boardCh);
    }
    if (p === 'rivals') {
      rivTab = Math.min(story.s.chapter, LAST) + 1;
      rivSel = 0;
    }
    if (p === 'cars') { carsSel = 0; sellArm = 0; }
    if (p === 'phone') { phoneScroll = 0; }
    if (p === 'slip') slipMenu = makeSlipMenu();
  }

  /** The story's next beat after a race, a card or the phone: a boss's
   *  closing card, its pink slip, the texts, a new chapter's card, then
   *  flowNext (or `next`). */
  function advance(next) {
    if (next) flowNext = next;
    const s = story.s;
    const out = story.pendingOutro();
    if (out) { showCard(out); return; }
    if (s.slips.length && !slipLater) { setPage('slip'); return; }
    if (s.unread) { setPage('phone'); return; }
    if (!s.cars.length) { setPage('classifieds'); return; }
    const intro = story.pendingIntro();
    if (intro) { showCard(intro); return; }
    const to = flowNext;
    flowNext = 'hub';
    setPage(to);
  }

  function showCard(c) {
    card = c;
    setPage('card');
    try { sfx.ui(c.kind === 'outro' ? 'buy' : 'select'); } catch { /* */ }
  }

  function firstOpen(ch) {
    const evs = story.events(ch);
    const cup = evs.findIndex((e) => story.status(e) === 'cup');
    if (cup >= 0) return cup;
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
    } else if (page === 'rivals' && rivalRows(rivTab)[rivSel]?.known) {
      const r = rivalRows(rivTab)[rivSel];
      showCar(CAR_BY_ID[r.R.car], { ...r.R.look });
    } else if (page === 'slip' && story.s.slips[0]) {
      const sl = story.s.slips[0];
      showCar(CAR_BY_ID[sl.car], { ...sl.look });
    } else if (story.car) {
      showCar(story.spec(), story.look());
    }
  }

  // ---------------------------------------------------------------- hub
  function makeHub() {
    const unread = story.s.unread;
    const slips = story.s.slips.length;
    const items = [
      { label: 'THE BOARD', id: 'board', hint: 'Races, crews and the city map.' },
      { label: 'THE LIST', id: 'rivals', hint: 'Every crew in the city: who they are, what they drive.' },
      { label: 'PERFORMANCE', id: 'perf', hint: 'Engine, turbo, suspension, tires, nitrous...' },
      { label: 'BODY SHOP', id: 'body', hint: 'Paint, vinyls, rims, kits, wings, glow.' },
      { label: 'CARS', id: 'cars', hint: 'Your garage and the dealer lot.' },
      { label: unread ? `PHONE  (${unread})` : 'PHONE', id: 'phone', hint: 'Messages.' },
    ];
    if (slips) items.splice(5, 0, { label: `PINK SLIP  (${slips})`, id: 'slip', hint: 'A car you won off a boss. Keep it or sell it.' });
    items.push({ label: 'CRUISE', id: 'cruise', hint: 'Take your car out: the whole city, every road joined up by the tunnels.' });
    items.push({ label: 'SAVE & EXIT', id: 'exit', hint: 'Back to the radio. Progress saves itself.' });
    return new Menu(items, { id: 'hub', sel: Math.min(hubMenu?.sel ?? 0, items.length - 1) });
  }

  /** Free roam in your story car, starting in this chapter's part of town. */
  function cruise() {
    if (!story.car) { say('NO CAR', C.red); uiSound('error'); return; }
    story.save();
    const ev = EVENTS.find((e) => e.ch === story.s.chapter && TRACK_BY_ID[e.track]) || EVENTS[0];
    const def = TRACK_BY_ID[ev.track];
    // out on the streets where this chapter's races are
    const T = trackInfo(def).T, p = T.posAt(T.startS);
    go('world', {
      spec: story.spec(), look: story.look(), upgrades: story.up(), x: p.x, z: p.z, heading: p.heading, time: 'night',
      noGarage: true, quitLabel: 'BACK TO THE GARAGE', onExit: () => go('story', {}),
    });
  }

  function makeSlipMenu() {
    const sl = story.s.slips[0];
    if (!sl) return null;
    const full = story.garageFull;
    const items = [
      { label: full ? 'KEEP IT  (GARAGE FULL)' : 'KEEP IT', id: 'keep', hint: full ? `All ${GARAGE_SLOTS} bays are taken. Sell a car first, or take the cash.` : 'Into the garage, with the parts it came with.' },
      { label: `SELL IT  +${money(story.slipValue(sl))}`, id: 'sell', hint: 'The yard pays cash, no questions.' },
    ];
    if (full) items.push({ label: 'MY GARAGE', id: 'garage', hint: 'Make room: sell a car, then come back from the hub.' });
    items.push({ label: 'DECIDE LATER', id: 'later', hint: 'It waits in the hub under PINK SLIP.' });
    return new Menu(items, { id: 'slip' });
  }

  // ---------------------------------------------------------------- racing
  function lapsFor(ev, def) {
    if (ev.type === 'knockout') return knockLaps(ev.rivals, def.laps);
    if (ev.type === 'timeattack') return def.type === 'sprint' ? 1 : def.laps || 3;
    return ev.laps || def.laps || 3;
  }

  function raceEvent(ev) {
    if (ev.kind === 'cup') { raceCup(ev); return; }
    const def = TRACK_BY_ID[ev.track];
    if (!def) { say('TRACK STILL UNDER CONSTRUCTION', C.red); return; }
    const chap = CHAPTERS[ev.ch];
    const grid = story.rivals(ev);
    const laps = lapsFor(ev, def);
    const opp = ev.boss ? chap.boss : ev.kind === 'duel' ? RIVALS[ev.vs] : null;
    go('race', {
      trackDef: def, spec: story.spec(), look: story.look(), upgrades: story.up(), type: ev.type, laps,
      opponents: grid, rubber: ev.boss ? 0.4 : ev.kind === 'duel' ? 0.55 : 0.75, ttFactor: ev.tt, traffic: ev.traffic,
      driftRivals: ev.type === 'drift' ? story.driftRivals(ev) : undefined,
      musicTheme: ev.boss ? 'race_boss' : undefined, playerGrid: 'back',
      quitLabel: 'QUIT TO GARAGE', story: ev.id,
      banner: {
        title: ev.name, color: chap.color,
        sub: `${chap.crew}  ·  ${ev.boss ? 'BOSS RACE  ·  PINK SLIP' : ev.kind === 'duel' ? `DUEL  ·  ${TYPE_NAMES[ev.type]}` : TYPE_NAMES[ev.type] || ''}`,
        boss: opp ? { name: opp.name, car: carName(opp.car), quote: opp.quote } : null,
      },
      onResult: (res) => story.applyResult(ev, res, { grid, laps }),
      onDone: () => go('story', { from: 'race', event: ev.id }),
    });
  }

  /** A cup: start it (or carry on with it) and race the next round. The
   *  round only counts once you CONTINUE from its results, so RACE AGAIN
   *  re-runs it. */
  function raceCup(ev) {
    const s = story.s;
    if (s.cup && s.cup.id !== ev.id) { say(`FINISH THE ${EVENT_BY_ID[s.cup.id].name} FIRST`, C.red); uiSound('error'); return; }
    const round = s.cup ? s.cup.round : 0;
    const leg = ev.rounds[round];
    const def = TRACK_BY_ID[leg.track];
    if (!def) { say('TRACK STILL UNDER CONSTRUCTION', C.red); return; }
    if (!s.cup) story.startCup(ev);
    const chap = CHAPTERS[ev.ch];
    const grid = story.rivals(ev);
    const laps = leg.type === 'circuit' ? leg.laps || def.laps || 3 : 1;
    go('race', {
      trackDef: def, spec: story.spec(), look: story.look(), upgrades: story.up(), type: leg.type, laps,
      opponents: grid, rubber: 0.75, traffic: leg.traffic, playerGrid: 'back',
      quitLabel: 'QUIT TO GARAGE', story: ev.id,
      banner: { title: ev.name, color: chap.color, sub: `${chap.crew}  ·  ROUND ${round + 1} OF ${ev.rounds.length}  ·  ${TYPE_NAMES[leg.type]}` },
      onDone: (res, where) => {
        if (res && where === 'continue') {
          try { story.applyResult(ev, res, { grid, laps, round }); } catch (e) { console.warn('cup result', e); }
        }
        go('story', { from: 'race', event: ev.id });
      },
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
      flowNext = 'hub';
      slipLater = false;
      result = null;
      card = null;
      if (p.newGame || !story.load()) {
        story.start();
        advance('hub');
      } else if (p.from === 'race' && story.lastSummary) {
        result = story.lastSummary;
        story.lastSummary = null;
        setPage('result');
      } else {
        advance('hub');
      }
      story.queueWarm(Math.min(story.s.chapter, LAST));
      const st = G.stations[stationFor(page)];
      cam.pos.fromArray(st[0]);
      cam.tgt.fromArray(st[1]);
      syncCar();
      if (pendingModel) pendingModel.at = 0;
      buildPending(0);
      window.__story = {
        story, setPage, raceEvent, advance, showCard,
        showResult(r) { result = r; setPage('result'); },
        get page() { return page; },
        get card() { return card; },
        set rivals(v) { rivTab = v.tab ?? rivTab; rivSel = v.sel ?? rivSel; },
        set board(v) { boardCh = v.ch ?? boardCh; boardSel = v.sel ?? boardSel; },
        EVENTS, CHAPTERS, RIVALS, V1_EVENTS,
      };
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
      if (quitArm > 0) quitArm -= dt;
      if (!busy) handleInput(dt);
      syncCar();
      buildPending(dt);
      if (model) model.animate(dt, 0, 0);
      updateCamera(dt);
      // measure the rival cars the board is about to need, a slice a frame
      if (!busy && (page === 'hub' || page === 'board' || page === 'rivals') && pageT > 0.4) story.warmStep();
    },
    view() { return G ? { scene: G.scene, camera: G.camera } : null; },
    draw(ctx) {
      if (!G) return;
      const a = clamp(pageT / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      if (page !== 'phone' && page !== 'result' && page !== 'card') drawTopBar(ctx);
      if (page === 'hub') drawHub(ctx);
      else if (page === 'board') drawBoard(ctx);
      else if (page === 'rivals') drawList(ctx);
      else if (page === 'perf') drawPerf(ctx);
      else if (page === 'body') drawBody(ctx);
      else if (page === 'cars') drawCars(ctx);
      else if (page === 'classifieds') drawClassifieds(ctx);
      else if (page === 'phone') drawPhone(ctx);
      else if (page === 'slip') drawSlipPage(ctx);
      else if (page === 'card' && card) {
        drawChapterCard(ctx, card, clamp(pageT / 0.5, 0, 1));
        if (pageT > 0.6) hints(ctx, [['confirm', 'CONTINUE']], { y: 740 });
      } else if (page === 'result' && result) {
        drawResult(ctx, result, pageT);
        if (pageT > 0.8) hints(ctx, cupNext() ? [['confirm', 'NEXT ROUND'], ['back', 'LATER']] : [['confirm', 'CONTINUE']], { y: 740 });
      }
      ctx.restore();
      if (toast) {
        const k = Math.min(1, toast.t * 6) * Math.min(1, (2.6 - toast.t) * 3);
        ctx.save();
        ctx.globalAlpha = k;
        panel(ctx, 312, 330, 400, 56, { accent: toast.color, accentLen: 400, alpha: 0.95 });
        vText(ctx, toast.text, 512, 368, Math.min(20, 370 / Math.max(1, vWidth(toast.text, 1))), { align: 'center', color: toast.color });
        ctx.restore();
      }
    },
  };

  function stationFor(p) {
    return { hub: 'hub', board: 'board', rivals: 'body', perf: 'perf', body: 'body', cars: 'dealer', classifieds: 'dealer', phone: 'phone', result: 'hub', card: 'hub', slip: 'hub' }[p] || 'hub';
  }

  function updateCamera(dt) {
    const st = G.stations[stationFor(page)];
    _p.fromArray(st[0]);
    _t.fromArray(st[1]);
    const orbit = page === 'body' || page === 'rivals';
    if (page === 'body') {
      const rs = Math.abs(input.axes[2] || 0) > 0.15 ? input.axes[2] : 0;
      bodyOrbit += (rs ? rs * 1.8 : 0.18) * dt;
      if (input.mouse.down && input.device === 'mouse') bodyOrbit += (input.mouse.dx || 0) * 0.005;
      const r = 6.0, a = bodyOrbit + 0.6;
      _p.set(Math.sin(a) * r, 1.35, Math.cos(a) * r);
      _t.set(-Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7);
    } else if (page === 'rivals') {
      // a slow swing round the rival's car, never wider than the shop
      const r = 6.0, a = 0.35 + Math.sin(t * 0.22) * 0.55;
      _p.set(Math.sin(a) * r, 1.3, Math.cos(a) * r);
      _t.set(-Math.cos(a) * 1.7, 0.5, Math.sin(a) * 1.7);
    }
    G.lift.visible = !orbit;
    const k = 1 - Math.exp(-dt * 3.2);
    cam.pos.lerp(_p, k);
    cam.tgt.lerp(_t, k);
    G.camera.position.copy(cam.pos);
    G.camera.position.y += Math.sin(t * 0.5) * 0.01;
    G.camera.lookAt(cam.tgt);
  }

  // ---------------------------------------------------------------- input per page
  const cupNext = () => result && result.kind === 'cup' && !result.done && !result.practice && story.s.cup?.id === result.ev;

  function handleInput(dt) {
    const back = input.pressed('back');
    const ok = input.pressed('confirm');
    const click = input.takeClick();
    if (page === 'hub') {
      const it = hubMenu.update(dt);
      if (it) {
        if (it.id === 'exit') { story.save(); go('radio', { station: 'story' }); return; }
        if (it.id === 'cruise') { cruise(); return; }
        if (it.id === 'phone') { flowNext = 'hub'; setPage('phone'); return; }
        if (it.id === 'slip') { slipLater = false; setPage('slip'); return; }
        setPage(it.id);
      }
      if (back) { story.save(); go('radio', { station: 'story' }); }
      return;
    }
    if (page === 'phone') {
      const n = story.inbox().length;
      if (input.pressed('up')) phoneScroll = Math.min(phoneScroll + 1, Math.max(0, n - 1));
      if (input.pressed('down')) phoneScroll = Math.max(0, phoneScroll - 1);
      if ((ok || back || click) && pageT > 0.4) {
        story.markRead();
        uiSound('back');
        advance();
      }
      return;
    }
    if (page === 'card') {
      if ((ok || back || click) && pageT > 0.6) {
        story.markSeen(card);
        card = null;
        uiSound('select');
        advance();
      }
      return;
    }
    if (page === 'result') {
      if ((ok || back || click) && pageT > 0.8) {
        const r = result;
        // a cup carries straight on to its next round (back: later, from the board)
        const nextRound = cupNext() && (ok || click);
        result = null;
        if (nextRound) {
          raceEvent(EVENT_BY_ID[r.ev]);
          if (game._transition) return;
        }
        advance(r?.won || (r?.kind === 'cup' && !r?.done) ? 'board' : 'hub');
      }
      return;
    }
    if (page === 'slip') { slipInput(dt); return; }
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
    else if (page === 'rivals') rivalsInput(click);
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
    advance('hub');
  }

  function boardInput(ok, click) {
    const evs = story.events(boardCh);
    const pick = (k) => { boardSel = k; quitArm = 0; uiSound('move'); };
    if (input.pressed('right') || input.pressed('down')) pick((boardSel + 1) % evs.length);
    if (input.pressed('left') || input.pressed('up')) pick((boardSel + evs.length - 1) % evs.length);
    const maxCh = Math.min(story.s.chapter, LAST);
    const toCh = (ch) => { boardCh = ch; boardSel = firstOpen(ch); quitArm = 0; story.queueWarm(ch); uiSound('tab'); };
    if (input.pressed('tabR') && boardCh < maxCh) toCh(boardCh + 1);
    if (input.pressed('tabL') && boardCh > 0) toCh(boardCh - 1);
    if (click && hit.hover?.startsWith('pin:')) {
      const k = parseInt(hit.hover.slice(4), 10);
      if (k === boardSel) ok = true; else pick(k);
    }
    if (click && hit.hover?.startsWith('dist:')) {
      const ch = parseInt(hit.hover.slice(5), 10);
      if (ch <= maxCh && ch !== boardCh) toCh(ch);
    }
    const ev = evs[boardSel];
    if (!ev) return;
    const st = story.status(ev);
    if (input.pressed('extra') && st === 'cup') {
      if (quitArm > 0) { story.abandonCup(); quitArm = 0; say('CUP ABANDONED', C.dim); uiSound('back'); } else { quitArm = 2.5; say('QUIT THE CUP? PRESS AGAIN', C.accent); }
      return;
    }
    if (ok) {
      if (st === 'locked') { say(story.lockReason(ev), C.red); uiSound('error'); return; }
      uiSound('select');
      raceEvent(ev);
    }
  }

  function rivalsInput(click) {
    const tab = (k) => { rivTab = (k + LIST_TABS) % LIST_TABS; rivSel = 0; uiSound('tab'); };
    if (input.pressed('tabR')) tab(rivTab + 1);
    if (input.pressed('tabL')) tab(rivTab - 1);
    if (click && hit.hover?.startsWith('rtab:')) tab(parseInt(hit.hover.slice(5), 10));
    const n = rivalRows(rivTab).length;
    if (input.pressed('down') || input.pressed('right')) { rivSel = (rivSel + 1) % n; uiSound('move'); }
    if (input.pressed('up') || input.pressed('left')) { rivSel = (rivSel + n - 1) % n; uiSound('move'); }
    if (click && hit.hover?.startsWith('rrow:')) { rivSel = parseInt(hit.hover.slice(5), 10); uiSound('move'); }
  }

  function slipInput(dt) {
    if (!slipMenu) { advance(); return; }
    const it = slipMenu.update(dt);
    if (input.pressed('back')) { slipLater = true; uiSound('back'); advance(); return; }
    if (!it) return;
    const sl = story.s.slips[0];
    if (it.id === 'keep') {
      const err = story.keepSlip(0);
      if (err) { say(err === 'GARAGE FULL' ? 'GARAGE FULL: SELL A CAR FIRST' : err, C.red); uiSound('error'); return; }
      say(`${CAR_BY_ID[sl.car].model} IS IN THE GARAGE`, C.green);
      try { sfx.engineStart(); } catch { /* */ }
    } else if (it.id === 'sell') {
      const v = story.slipValue(sl);
      story.sellSlip(0);
      say(`SOLD TO THE YARD  +${money(v)}`, C.green);
      try { sfx.ui('buy'); } catch { /* */ }
    } else if (it.id === 'garage') {
      slipLater = true;
      setPage('cars');
      return;
    } else {
      slipLater = true;
    }
    if (story.s.slips.length && !slipLater) { slipMenu = makeSlipMenu(); return; }
    advance();
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
          const v = story.value(car);
          const err = story.sellCar(car.uid);
          if (err) say(err, C.red); else { say(`SOLD  +${money(v)}`, C.green); carsSel = 0; }
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
    const ch = CHAPTERS[Math.min(story.s.chapter, LAST)];
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

  /** The hub's line on the current chapter: what the boss still wants. */
  function chapterLine(chI) {
    const s = story.s;
    const ch = CHAPTERS[chI];
    if (s.finished) return 'Every crew in the city answers to you. The rematches are still on the board.';
    if (s.bosses[chI]) return 'Crew beaten.';
    const cup = s.cup && EVENT_BY_ID[s.cup.id];
    if (cup) return `${cup.name}: round ${s.cup.round + 1} of ${cup.rounds.length} is waiting on the board.`;
    const need = story.bossNeeds(chI);
    if (need.city) {
      const left = CHAPTERS.filter((c, i) => i !== chI && !s.bosses[i]).map((c) => c.crew);
      return `ZERO only calls once every crew is down. Still standing: ${left.join(', ')}.`;
    }
    if (story.bossOpen(chI)) return `${ch.boss.name} is waiting for you. Check the board.`;
    const parts = [];
    if (need.wins) parts.push(`win ${need.wins} more race${need.wins === 1 ? '' : 's'}`);
    if (need.rep) parts.push(`earn ${need.rep.toLocaleString()} more REP`);
    const txt = parts.join(' and ');
    return `${txt.charAt(0).toUpperCase()}${txt.slice(1)} to call out ${ch.boss.name}.`;
  }

  function drawHub(ctx) {
    const n = hubMenu.items.length;
    const rowH = 40;
    const mh = 30 + n * rowH;
    panel(ctx, 34, 108, 360, mh, { accent: C.accent, alpha: 0.9 });
    hubMenu.draw(ctx, 76, 152, 290, { rowH, size: 20, hintX: 60, hintY: 108 + mh + 24 });
    // chapter status
    const chI = Math.min(story.s.chapter, LAST);
    const ch = CHAPTERS[chI];
    const py = Math.max(500, 108 + mh + 46);
    panel(ctx, 34, py, 360, 124, { accent: ch.color, accentLen: 140, alpha: 0.88 });
    text(ctx, `CHAPTER ${chI + 1}  ·  ${ch.name}`, 58, py + 28, { size: 12, color: ch.color, weight: 900, spacing: 2 });
    vText(ctx, ch.crew, 56, py + 58, Math.min(20, 300 / Math.max(1, vWidth(ch.crew, 1))), { color: '#fff' });
    paragraph(ctx, chapterLine(chI), 58, py + 84, 316, { size: 13, color: '#c8d0dc', weight: 600, lineHeight: 17 });
    // street rank
    panel(ctx, 640, 104, 360, 104, { accent: C.cyan, accentLen: 120, alpha: 0.88 });
    drawRank(ctx, story.s.rep, 664, 130, 312);
    drawCarChip(ctx, 660, 620);
    hints(ctx, [['ud', 'SELECT'], ['confirm', 'OPEN'], ['back', 'RADIO']], { y: 740 });
  }

  // ---- the board: city map + flyer
  function drawBoard(ctx) {
    drawCityMap(ctx, 30, 104, 560, 560, { ch: boardCh, sel: boardSel, t });
    const evs = story.events(boardCh);
    const ev = evs[boardSel];
    if (ev) drawFlyer(ctx, ev, 612, 112);
    const st = ev ? story.status(ev) : null;
    const go1 = st === 'cup' ? 'NEXT ROUND' : ev?.kind === 'cup' ? 'START CUP' : 'GO';
    const row = [['tabR', 'CREW'], ['lr', 'RACE'], ['confirm', go1], ['back', 'BACK']];
    if (st === 'cup') row.splice(3, 0, ['extra', 'QUIT CUP']);
    hints(ctx, row, { y: 740 });
  }

  // ---- the list
  function drawList(ctx) {
    drawRivals(ctx, { tab: rivTab, sel: rivSel });
    drawRivalCar(ctx, rivalRows(rivTab)[rivSel], 640, 618);
    hints(ctx, [['tabR', 'CREW'], ['ud', 'RIVAL'], ['back', 'BACK']], { y: 740 });
  }

  // ---- the pink slip
  function drawSlipPage(ctx) {
    const sl = story.s.slips[0];
    if (!sl || !slipMenu) return;
    const b = RIVALS[sl.rival];
    const sp = CAR_BY_ID[sl.car];
    panel(ctx, 34, 104, 470, 92, { accent: '#ff5ac8', accentLen: 160, alpha: 0.9 });
    text(ctx, `PINK SLIP  ·  ${CHAPTERS[sl.ch].crew}`, 58, 132, { size: 12, color: '#ff8ad0', weight: 900, spacing: 2 });
    const title = `${b.name}'S ${sp.model}`;
    vText(ctx, title, 56, 172, Math.min(28, 420 / Math.max(1, vWidth(title, 1))), { color: '#fff' });
    const mh = 40 + slipMenu.items.length * 44;
    panel(ctx, 34, 470, 400, mh, { accent: C.accent, alpha: 0.92 });
    slipMenu.draw(ctx, 76, 514, 330, { rowH: 44, size: 18, hintX: 56, hintY: 470 + mh + 24 });
    text(ctx, `${story.s.cars.length} / ${GARAGE_SLOTS} BAYS`, 412, 470 + mh - 12, { size: 11, color: story.garageFull ? C.red : C.dim, weight: 800, spacing: 2, align: 'right' });
    drawSlipPaper(ctx, sl, 572, 360);
    hints(ctx, [['ud', 'CHOOSE'], ['confirm', 'OK'], ['back', 'LATER']], { y: 740 });
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
        const won = c.from && RIVALS[c.from] ? `  · WON OFF ${RIVALS[c.from].name}` : '';
        text(ctx, `${sp.make} · CLASS ${sp.cls}${c.uid === story.s.active ? '  · ACTIVE' : won}`, 60, y + 10, { size: 11, color: c.uid === story.s.active ? C.green : won ? '#ff8ad0' : C.dim, weight: 800, spacing: 1.5 });
        vText(ctx, sp.model, 60, y + 38, Math.min(20, 260 / Math.max(1, vWidth(sp.model, 1))), { color: '#fff' });
        text(ctx, `PR ${story.pr(c)}`, 420, y + 14, { size: 13, color: C.accent, weight: 900, align: 'right' });
        text(ctx, money(story.value(c)), 420, y + 36, { size: 12, color: C.dim, weight: 700, align: 'right' });
      });
      if (story.s.slips.length) text(ctx, 'A PINK SLIP IS WAITING: OPEN IT FROM THE HUB', 60, 614, { size: 11, color: '#ff8ad0', weight: 900, spacing: 1.5 });
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
    // messages: the newest at the bottom, as many older ones above as fit
    const msgs = story.inbox();
    const font = { size: 13, weight: 600, font: '"Consolas", monospace' };
    const top = sy + 34, bottom = sy + sh - 26;
    const blocks = [];
    let used = 0;
    for (let i = msgs.length - 1 - phoneScroll; i >= 0; i--) {
      const lines = wrap(ctx, msgs[i].text, sw - 24, font);
      const hgt = 22 + lines.length * 17 + 12;
      if (blocks.length && used + hgt > bottom - top) break;
      blocks.unshift({ m: msgs[i], lines, hgt, i });
      used += hgt;
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(sx, sy + 30, sw, sh - 34);
    ctx.clip();
    let my = Math.max(top, bottom - used);
    for (const b of blocks) {
      const fresh = !b.m.read;
      text(ctx, `FROM: ${b.m.from}${fresh ? '  *NEW*' : ''}`, sx + 12, my + 14, { size: 12, color: fresh ? '#ffffff' : '#8affc0', weight: 900, shadow: false, font: '"Consolas", monospace' });
      b.lines.forEach((ln, k) => text(ctx, ln, sx + 12, my + 36 + k * 17, { ...font, color: fresh ? '#d8ffe8' : '#7fd0a2', shadow: false }));
      my += b.hgt;
    }
    ctx.restore();
    const older = blocks.length ? blocks[0].i : 0;
    if (older > 0) text(ctx, `▲ ${older} OLDER`, sx + sw - 10, sy + 44, { size: 11, color: '#8affc0', weight: 900, align: 'right', shadow: false, font: '"Consolas", monospace' });
    // keypad hint
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      roundRect(ctx, x + 50 + c * 92, y + 566 + r * 28, 76, 22, 8);
      ctx.fillStyle = '#2b2e35';
      ctx.fill();
    }
    const blink = Math.floor(t * 2) % 2;
    if (blink) text(ctx, phoneScroll ? `▼ ${phoneScroll} NEWER` : '▼ PRESS ✕', sx + sw / 2, sy + sh - 10, { size: 12, color: '#8affc0', weight: 900, align: 'center', shadow: false, font: '"Consolas", monospace' });
    hints(ctx, [['ud', 'SCROLL'], ['confirm', 'CLOSE']], { y: 740 });
  }

  return scr;
});
