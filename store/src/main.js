// 3RD RAIL — the shop under the city. Boot, main loop, scene + travel flow,
// and every conversation script.
import * as Eng from './engine.js';
import { view, keys, input, pressed, clearPressed } from './engine.js';
import { Stage, FEET } from './world/stage.js';
import { Player } from './world/player.js';
import { Train, drawTunnel } from './world/train.js';
import { drawScreenFx } from './world/fx.js';
import { SCENES, LINE } from './world/scenes.js';
import { SHOPS, productById } from './data/catalog.js';
import { stickerById, EXCHANGE } from './data/content.js';
import { CONFIG } from './config.js';
import * as E from './systems/econ.js';
import * as D from './systems/daily.js';
import * as audio from './audio.js';
import * as hud from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { $, anyOverlay, onOverlayChange, closeOverlay, closeAll, topOverlay } from './ui/dom.js';
import { initShop, openShop, openCatalog, openProduct } from './ui/shop.js';
import { initBag, openBag } from './ui/bag.js';
import { initMap, openMap } from './ui/map.js';
import { initStash, openStash } from './ui/stash.js';
import { openCreator, drawLogo, randomLook } from './ui/creator.js';
import { openGame } from './games/index.js';
import { ellipse, dot, rgba, text, FONTS, INK, shape, makeCanvas } from './ink.js';

const Q = new URLSearchParams(location.search);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const G = {
  scene: null,
  stage: null,
  player: new Player(),
  train: new Train(),
  express: new Train(),
  mode: 'boot', // boot | play | travel | tunnel
  t: 0,
  near: null,
  pickups: [],
  busy: false,
  ghostLeft: 0,
  peeking: false,
  crackHits: 0,
  expressT: 70,
  tunnel: null,
  tagImg: null,
};

let ctx, dlg;

// ---------------------------------------------------------------- boot

async function boot() {
  ctx = Eng.initCanvas($('#world'));
  Eng.initInput($('#world'));
  dlg = new Dialogue($('#dialogue'));
  try {
    await Promise.race([
      Promise.all(['Bungee', 'Gochi Hand', 'Permanent Marker', 'Sedgwick Ave Display', 'Rubik Wet Paint'].map((f) => document.fonts.load(`32px "${f}"`))),
      wait(2500),
    ]);
  } catch { /* fallback fonts are fine */ }

  E.ensureDay();
  if (E.S.tagImage) loadTagImage(E.S.tagImage);
  setupHud();
  setupEvents();
  initShop({ openBag });
  initBag({ openCatalog });
  initMap({ travel, current: () => G.scene });
  initStash({ editLook });
  onOverlayChange(() => { clearPressed(); keys.clear(); $('#hint').hidden = true; });
  dlg.onOpenChange = (open) => { if (open) $('#hint').hidden = true; };

  G.player.look = E.S.profile || randomLook();
  G.player.onStep = () => {};
  G.player.onLand = () => audio.land();
  const startScene = Q.get('scene') && SCENES[Q.get('scene')] ? Q.get('scene') : (LINE.includes(E.S.scene) ? E.S.scene : 'token');
  loadScene(startScene, Q.get('x') ? +Q.get('x') : SCENES[startScene].spawn);

  Eng.onResize(() => {
    if (G.stage) G.stage.invalidate();
    drawLogo($('#boot-logo'));
    Eng.snapCamera(G.player.x);
  });
  drawLogo($('#boot-logo'));
  $('#boot-load').textContent = '';
  Eng.startLoop(frame);

  const enter = () => {
    audio.init();
    applySound();
    $('#boot').classList.add('gone');
    setTimeout(() => { $('#boot').hidden = true; }, 520);
    start();
  };
  if (Q.has('quick')) {
    $('#boot').hidden = true;
    if (!E.S.profile) E.setProfile({ ...randomLook(), name: 'QA RAT' });
    start();
  } else {
    $('#boot-go').addEventListener('click', enter, { once: true });
    $('#boot-go').focus({ preventScroll: true });
  }
  // QA: ?open=shop:threads | bag | map | stash | catalog | creator  ·  ?game=tag
  if (Q.get('open') || Q.get('game')) setTimeout(qaOpen, 300);
}

function start() {
  G.player.look = E.S.profile || G.player.look;
  hud.showHud(true);
  hud.setFace(G.player.look);
  dlg.setPlayer(E.S.profile?.name, G.player.look);
  G.mode = 'play';
  if (!E.S.profile) {
    openCreator(null, (look) => {
      E.setProfile(look);
      G.player.look = look;
      hud.setFace(look);
      dlg.setPlayer(look.name, look);
      firstRun();
    }, { first: true });
    return;
  }
  hud.stationBanner(SCENES[G.scene].name);
  if (!Q.has('quick')) {
    if (E.canCheckIn()) setTimeout(() => hud.toast('Your daily swipe is ready at the <b style="color:var(--sun)">Token Booth</b>', 'sun', 4200), 900);
    else if (E.phoneRinging()) setTimeout(() => hud.toast('The phone booth in Token Sq is ringing…', 'sun', 3600), 900);
  }
  controlsHint();
}

async function firstRun() {
  hud.stationBanner('TOKEN SQ');
  controlsHint();
  await wait(700);
  // walk to Shelly and get the welcome
  const booth = G.stage.entities.find((e) => e.kind === 'booth');
  if (booth && G.scene === 'token') {
    G.player.walkTo(booth.act.x + 40, () => interact(booth));
  }
}

function controlsHint() {
  if (input.touch || matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => hud.toast('Tap to walk · tap things to use them · tap your rat to hop', '', 5200), 2600);
    return;
  }
  hud.showHint('<b>A/D</b> or <b>←/→</b> walk · <b>SHIFT</b> run · <b>SPACE</b> hop · <b>E</b> talk / use · <b>M</b> map · <b>B</b> bag · or just click things', 10000);
}

function qaOpen() {
  const o = Q.get('open') || '';
  const [what, arg] = o.split(':');
  if (what === 'shop') openShop(arg || 'threads');
  if (what === 'bag') openBag();
  if (what === 'map') openMap();
  if (what === 'stash') openStash(arg || 'me');
  if (what === 'catalog') openCatalog();
  if (what === 'creator') editLook();
  if (what === 'talk') {
    const e = G.stage.entities.find((x) => x.kind === arg || x.id === arg || x.shop === arg);
    if (e) interact(e);
  }
  if (Q.get('game')) openGame(Q.get('game'), gameCtx(Q.get('game'))).then((r) => console.log('[game result]', JSON.stringify(r)));
}

// ---------------------------------------------------------------- HUD + events

function setupHud() {
  hud.initHud({
    map: () => { audio.click(); openMap(); },
    shop: () => { audio.click(); openCatalog(); },
    bag: () => { audio.click(); openBag(); },
    me: () => { audio.click(); hud.setMeDot(false); openStash(); },
    sound: () => {
      const on = !(E.S.settings.music && E.S.settings.sfx);
      E.S.settings.music = on;
      E.S.settings.sfx = on;
      E.commit();
      audio.init();
      applySound();
    },
    prompt: () => { if (G.near) interact(G.near); },
  });
  hud.setTokens(E.S.tokens, true);
  hud.setStreak(E.S.streak.count, E.S.streak.freezes);
  hud.setBag(E.bagCount());
  hud.setTicker(E.headlines());
  applySound();
}

function applySound() {
  audio.setMusic(!!E.S.settings.music);
  audio.setSfx(!!E.S.settings.sfx);
  hud.setSoundIcon(E.S.settings.music || E.S.settings.sfx);
}

function setupEvents() {
  E.on('tokens', ({ n, why }) => {
    hud.setTokens(E.S.tokens);
    if (n > 0) hud.bumpTokens();
    if (n > 0 && !['mission', 'jobs', 'claw', 'crack', 'checkin', 'secret', 'pickup', 'cashback'].includes(why)) hud.tokenToast(n);
  });
  E.on('sticker', ({ id, isNew }) => {
    if (!isNew) return;
    hud.stickerToast(stickerById[id]);
    hud.setMeDot(true);
    audio.fanfare();
  });
  E.on('mission', ({ def }) => {
    hud.toast(`JOB DONE · ${def.text} <span class="t-big">+${def.reward}</span>`, 'cash', 3200);
    audio.fanfare();
  });
  E.on('missionsAll', () => setTimeout(() => {
    hud.toast('All 3 jobs done. The phone in Token Sq is ringing…', 'sun', 4200);
    audio.ring();
  }, 1600));
  E.on('page', (page) => hud.toast(`PAGE COMPLETE · ${page.name} → ${page.reward.label}`, 'sun', 4200));
  E.on('bag', () => hud.setBag(E.bagCount()));
  E.on('streak', () => hud.setStreak(E.S.streak.count, E.S.streak.freezes));
  E.on('freeze', () => hud.setStreak(E.S.streak.count, E.S.streak.freezes));
  E.on('secret', (w) => hud.toast(`SECRET FOUND · ${({ ghost: 'OLD HALL', sewer: 'THE SEWERS', backroom: 'THE BACK ROOM', crack: 'A HIDDEN STASH' })[w]}`, 'hot', 4000));
  E.on('day', () => {
    hud.setTicker(E.headlines());
    if (G.stage) G.pickups = E.pickups(G.scene);
    hud.setStreak(E.S.streak.count, E.S.streak.freezes);
    if (G.mode === 'play') hud.toast('NEW DAY · fresh deals, fresh jobs, fresh tokens on the floor', 'sun', 4200);
  });
  E.on('profile', (p) => { hud.setFace(p); dlg.setPlayer(p.name, p); G.player.look = p; });
}

function editLook() {
  openCreator(E.S.profile, (look) => E.setProfile(look));
}

function loadTagImage(url) {
  const img = new Image();
  img.onload = () => { G.tagImg = img; };
  img.src = url;
}

// ---------------------------------------------------------------- scenes

const env = {
  dealOfDay: () => E.deals().dotd.product,
  dealPct: () => E.deals().dotd.pct,
  clawPrizes: () => E.clawPrizes(),
  phoneRinging: () => E.phoneRinging(),
  boothReady: () => E.canCheckIn(),
  legalTag: () => G.tagImg,
  crackBroken: () => E.S.secrets.crack,
  maintUnlocked: () => E.S.keys.maint,
  peeking: () => G.peeking,
  onSpark: (x) => { if (Math.abs(x - G.player.x) < 500) audio.spark(); },
};

function loadScene(id, x) {
  G.scene = id;
  G.stage = new Stage(id, env);
  const def = SCENES[id];
  view.worldW = def.width;
  G.player.minX = def.minX;
  G.player.maxX = def.maxX;
  G.player.x = Math.max(def.minX, Math.min(def.maxX, x));
  G.player.h = 0;
  G.player.vh = 0;
  G.player.stop();
  Eng.snapCamera(G.player.x);
  G.stage.warm();
  G.pickups = E.pickups(id);
  G.crackHits = 0;
  G.ghostDue = false;
  audio.setMood(id === 'sewer' ? 'sewer' : id === 'ghost' ? 'ghost' : 'main');
  if (LINE.includes(id)) {
    E.S.scene = id;
    E.commit();
  }
}

// ---------------------------------------------------------------- loop

function frame(dt, t) {
  G.t = t;
  Eng.beginFrame(dt);
  Eng.pollGamepad();
  E.ensureDay();
  const blocked = dlg.open || anyOverlay() || G.mode !== 'play' || G.busy;
  G.player.noKeys = blocked;
  G.player.frozen = blocked && G.mode !== 'travel';
  if (!blocked) handleInput();
  else {
    // tapping the station during a conversation advances it, like clicking the box
    if (input.taps.length && dlg.open && !anyOverlay()) dlg.advance();
    input.taps.length = 0;
    if (pressed('back') && anyOverlay()) closeOverlay();
  }
  G.player.update(dt);
  if (G.stage) G.stage.update(dt, t, G.player.x);
  collectPickups();
  // ambient express (main line only)
  if (G.mode === 'play' && !G.express.active && !G.train.active && LINE.includes(G.scene)) {
    G.expressT -= dt;
    if (G.expressT < 0) {
      G.expressT = 60 + Math.random() * 60;
      if (!anyOverlay()) {
        G.express.passThrough(view.camX);
        audio.train('pass', 2.2);
      }
    }
  }
  if (G.express.active && G.express.x + 2000 > view.camX && G.express.x < view.camX + view.vw) view.shake = Math.max(view.shake, 3);
  // ghost station timer (waits for any conversation to finish)
  if (G.scene === 'ghost' && G.mode === 'play' && G.ghostLeft > 0) {
    G.ghostLeft -= dt;
    if (G.ghostLeft <= 0) G.ghostDue = true;
  }
  if (G.ghostDue && G.mode === 'play' && !G.busy && !dlg.open) {
    G.ghostDue = false;
    ghostDeparture(true);
  }
  // camera
  if (G.mode === 'play' || G.mode === 'travel') Eng.follow(G.player.x, dt, G.player.moving ? G.player.facing * 60 : 0);
  G.train.update(dt, view.camX + view.vw);
  G.express.update(dt, view.camX + view.vw);
  // render
  if (G.mode === 'tunnel') {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawTunnel(ctx, ctx.canvas.width, ctx.canvas.height, t, G.tunnel?.name || '', G.tunnel?.ghost);
    drawScreenFx(ctx, t);
  } else if (G.stage) {
    G.stage.render(ctx, t, (g) => {
      drawPickups(g, t);
      G.player.draw(g, t, FEET);
    });
    Eng.worldTransform(ctx);
    G.train.draw(ctx, t, view.camX, view.camX + view.vw);
    G.express.draw(ctx, t, view.camX, view.camX + view.vw);
    if (G.scene === 'ghost') drawGhostClock(ctx);
    drawScreenFx(ctx, t, G.scene === 'ghost' ? { tint: 'rgba(4,30,26,0.7)' } : G.scene === 'sewer' ? { tint: 'rgba(4,20,8,0.75)' } : {});
  }
  updatePrompt(blocked);
  hud.updateHud(dt);
  dlg.update(dt, t);
}

function handleInput() {
  if (pressed('jump') || pressed('up')) {
    if (G.player.jump()) audio.jump();
  }
  if (pressed('act') && G.near) interact(G.near);
  if (pressed('map')) openMap();
  if (pressed('bag')) openBag();
  if (pressed('stash')) openStash();
  pressed('back');
  for (const tap of input.taps.splice(0)) {
    const [wx, wy] = Eng.toWorld(tap.x, tap.y);
    // tap your rat to hop
    if (Math.abs(wx - G.player.x) < 34 && wy > FEET - 120 - G.player.h && wy < FEET + 10) {
      if (G.player.jump()) audio.jump();
      continue;
    }
    // tap a floating token: walk under it, then hop
    const high = G.pickups.find((p) => p.h > 0 && Math.abs(p.x - wx) < 40 && Math.abs(FEET - 26 - p.h - wy) < 50);
    if (high) {
      G.player.walkTo(high.x, () => { if (G.player.jump()) audio.jump(); });
      continue;
    }
    const e = G.stage.entityAt(wx, wy);
    if (e) {
      const p = G.stage.actPoint(e);
      const stand = Math.abs(G.player.x - p.x) <= e.act.range ? G.player.x : p.x + (G.player.x < p.x ? -20 : 20);
      G.player.walkTo(stand, () => interact(e));
    } else {
      G.player.walkTo(wx);
    }
  }
}

function updatePrompt(blocked) {
  if (blocked || !G.stage || hud.bannerUp()) {
    hud.hidePrompt();
    G.near = null;
    return;
  }
  const e = G.stage.nearest(G.player.x);
  G.near = e;
  if (!e) { hud.hidePrompt(); return; }
  const p = G.stage.actPoint(e);
  const [sx, sy] = Eng.toScreen(p.x, p.y - 10);
  const badge = e.badge ? e.badge() : null;
  hud.showPrompt(sx, Math.max(sy, 120), e.act.label, { touch: input.touch, badge });
}

// ---------------------------------------------------------------- floor tokens

function drawPickups(g, t) {
  for (const p of G.pickups) {
    const y = FEET - 26 - p.h + Math.sin(t * 3 + p.x) * 3;
    const s = p.big ? 1.6 : 1;
    const spin = Math.cos(t * 4 + p.x * 0.01);
    g.save();
    g.globalCompositeOperation = 'lighter';
    const gl = g.createRadialGradient(p.x, y, 2, p.x, y, 26 * s);
    gl.addColorStop(0, 'rgba(255,220,120,0.45)');
    gl.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gl;
    g.fillRect(p.x - 30 * s, y - 30 * s, 60 * s, 60 * s);
    g.restore();
    g.save();
    g.translate(p.x, y);
    g.scale(Math.max(0.15, Math.abs(spin)) * s, s);
    ellipse(g, 0, 0, 11, 11, { fill: spin > 0 ? '#f0c24a' : '#d4a030', lw: 3, amp: 0.3, seed: 3 });
    ellipse(g, 0, 0, 6.5, 6.5, { fill: '#ffe08a', lw: 0, amp: 0, seed: 4 });
    g.fillStyle = INK;
    g.beginPath();
    g.moveTo(1.5, -5); g.lineTo(-3.5, 1); g.lineTo(0, 1); g.lineTo(-1.5, 5); g.lineTo(3.5, -1); g.lineTo(0, -1); g.lineTo(2, -5);
    g.fill();
    g.restore();
    if (p.h > 0) {
      g.fillStyle = 'rgba(10,6,24,0.25)';
      g.beginPath();
      g.ellipse(p.x, FEET, 9 * s, 2.5, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function collectPickups() {
  if (G.mode !== 'play') return;
  const pl = G.player;
  for (const p of [...G.pickups]) {
    if (Math.abs(pl.x - p.x) > (p.big ? 30 : 24)) continue;
    const need = p.h;
    if (need > 0 ? pl.h < need - 36 || pl.h > need + 40 : pl.h > 40) continue;
    G.pickups.splice(G.pickups.indexOf(p), 1);
    E.collect(p);
    audio.coin(p.big);
    G.stage.fx.burst(p.x, FEET - 26 - p.h, p.big ? 24 : 12, { color: ['#ffd23f', '#fff6c8', '#ff9a3c'], speed: 200, g: 500, life: 0.6, add: true });
    G.stage.fx.add({ kind: 'text', text: `+${p.value}`, x: p.x, y: FEET - 60 - p.h, vx: 0, vy: -60, g: 0, life: 1, size: 20, color: '#6dff9a' });
    const [sx, sy] = Eng.toScreen(p.x, FEET - 26 - p.h);
    hud.flyTokens(sx, sy, p.big ? 8 : 3);
  }
}

// ---------------------------------------------------------------- interactions

async function interact(e) {
  if (G.busy || G.mode !== 'play' || anyOverlay()) return;
  G.busy = true;
  G.player.stop();
  const p = G.stage.actPoint(e);
  if (Math.abs(p.x - G.player.x) > 4) G.player.facing = p.x > G.player.x ? 1 : -1;
  try {
    switch (e.kind) {
      case 'shop': await talkShop(e.shop); break;
      case 'stall': await talkShop('sewer'); break;
      case 'ticket': await talkShop('ghost'); break;
      case 'booth': await talkShelly(); break;
      case 'phone': await callOperator(); break;
      case 'wanted': wanted(); break;
      case 'cups': await talkCharlie(); break;
      case 'claw': await useClaw(); break;
      case 'legal': await useLegal(); break;
      case 'arcade': await useArcade(); break;
      case 'crack': await crack(); break;
      case 'door': if (e.door === 'maint') await maintDoor(); else await backDoor(); break;
      case 'mural': await readMural(); break;
      case 'ladder': await climbUp(); break;
      case 'bell': await ringBell(); break;
      case 'exit': await dlg.say('me', pick(["It's raining up there. Everything good is down here anyway.", 'The street can wait. The deals reset at midnight.', 'Nah. Too bright.'])); break;
      case 'npc': await talkNpc(e); break;
      default: break;
    }
  } catch (err) {
    console.error(err);
  } finally {
    G.stage.talking = null;
    G.peeking = false;
    if (dlg.open) dlg.end();
    G.busy = false;
    clearPressed();
  }
  // actions that need the world unlocked (e.g. leaving on a train)
  if (G.after) {
    const fn = G.after;
    G.after = null;
    fn();
  }
}

async function talkShop(shopId) {
  const sh = SHOPS[shopId];
  G.stage.talking = shopId;
  const d = E.deals();
  const deal = d.dotd.product.shop === shopId ? d.dotd : d.list.find((x) => x.product.shop === shopId);
  const first = shopId === 'sewer' ? !E.S.seen.tips.sewerHello : shopId === 'ghost' ? !E.S.seen.tips.ghostHello : false;
  if (first) {
    E.S.seen.tips[`${shopId}Hello`] = true;
    E.commit();
    await dlg.say(sh.keeper, sh.hello[0]);
  }
  const choices = ['Show me the goods', deal ? 'What’s on sale today?' : 'What’s good here?', 'Just passing through'];
  if (shopId === 'bodega') choices.splice(2, 0, 'Pet the cat');
  const c = await dlg.ask(sh.keeper, first ? sh.hello[1] : pick(sh.hello), choices, { cancel: choices.length - 1 });
  const label = choices[c];
  if (label === 'Show me the goods') {
    dlg.end();
    openShop(shopId);
  } else if (label && label.startsWith('What')) {
    if (deal) {
      await dlg.say(sh.keeper, sh.deal(deal.product.name));
      dlg.end();
      openShop(shopId, { product: deal.product.id, line: `${deal.pct}% off. Today only.` });
    } else {
      const items = Object.values(productById).filter((p) => p.shop === shopId);
      const p = items.find((x) => x.tags.includes('new')) || pick(items);
      await dlg.say(sh.keeper, `The *${p.name}*. ${p.desc.split('. ')[0]}.`);
      dlg.end();
      openShop(shopId, { product: p.id });
    }
  } else if (label === 'Pet the cat') {
    E.track('pet');
    if (!E.S.stickers.whiskers) E.addSticker('whiskers');
    await dlg.say('cat', pick(['...Fine. One pet. ...Okay two.', 'Purrrr. Don\'t tell anybody I purred.', 'You have permission to continue. Briefly.']));
  } else if (c != null) {
    await dlg.say(sh.keeper, pick(sh.bye));
  }
}

async function talkShelly() {
  G.stage.talking = 'booth';
  if (!E.S.seen.intro) {
    await dlg.say('shelly', 'Mm... a new face... Welcome... to the *3rd Rail*... the shop... under the city.');
    await dlg.say('shelly', 'Every shop down here... takes real money... but they all love... *tokens*.');
    await dlg.say('shelly', 'You get tokens... for swiping in here... *every day*... for doing jobs... for games... and for picking them up... off the floor.');
    await dlg.say('shelly', 'Trade tokens... for coupons... right here. Keep a streak... and things... get interesting. Keys. Secrets. Who knows.');
    await dlg.say('shelly', 'Swipe in now... I\'ll be here... I\'m always here... since 1971.');
    E.S.seen.intro = true;
    E.commit();
  }
  for (;;) {
    const can = E.canCheckIn();
    const pv = E.streakPreview();
    const line = can
      ? (pv.broken ? 'Mm... you missed a day... your streak... starts over... unless... you had freezes. Swipe in?' : `Mm... day *${pv.next}* of your streak... is waiting. Swipe in?`)
      : 'Mm... you already swiped today... come back... tomorrow... same booth.';
    const c = await dlg.ask('shelly', line, [
      can ? 'Swipe in (daily)' : { label: 'Already swiped today', disabled: true },
      'Trade tokens for coupons',
      'How does this place work?',
      'Bye, Shelly',
    ], { cancel: 3 });
    if (c === 0 && can) {
      dlg.end();
      const res = await openGame('swipe', gameCtx('swipe'));
      if (res && res.checkin) await checkinReport(res.checkin);
      return;
    }
    if (c === 1) {
      const items = EXCHANGE.map((it) => ({ label: `${it.label} · ${it.cost}`, disabled: E.S.tokens < it.cost }));
      items.push('Never mind');
      const k = await dlg.ask('shelly', `You have *${E.S.tokens}* tokens... What do you want...`, items, { cancel: items.length - 1 });
      if (k != null && k < EXCHANGE.length) {
        const r = E.exchange(EXCHANGE[k].id);
        if (r.err) { audio.beepBad(); await dlg.say('shelly', r.err); }
        else { audio.register(); await dlg.say('shelly', `Here... one *${EXCHANGE[k].label.toLowerCase()}*. It's in your stash. Use it... in your bag... at checkout.`); }
      }
      continue;
    }
    if (c === 2) {
      await dlg.say('shelly', 'Walk around... talk to the shopkeepers... they sell... the goods. Tap *BAG* to check out.');
      await dlg.say('shelly', 'That phone booth... somebody calls it... every day... with *three jobs*. Do them... get paid.');
      await dlg.say('shelly', 'The *Grabber*... *Charlie\'s cups*... the *legal wall*... the *arcade* at Drip St... all pay tokens. Three paid plays... per game... per day.');
      await dlg.say('shelly', 'And there are... doors... and trains... that aren\'t on the map. I didn\'t... say that.');
      continue;
    }
    if (c === 3 || c == null) {
      if (c === 3) await dlg.say('shelly', pick(['Mm... bye...', 'Mind... the gap...', 'Zzz... oh. Bye.']));
      return;
    }
  }
}

async function checkinReport(r) {
  G.stage.talking = 'booth';
  await dlg.say('shelly', `Day *${r.count}*${r.count > 1 ? ' in a row' : ''}... here's *${r.tokens} tokens*${r.perfect ? '... perfect swipe... show-off' : ''}.`);
  if (r.usedFreezes) await dlg.say('shelly', `You missed... ${r.usedFreezes === 1 ? 'a day' : `${r.usedFreezes} days`}... a *streak freeze* covered you. Lucky.`);
  if (r.broke) await dlg.say('shelly', 'Your old streak... broke... it happens... start again...');
  if (r.key) {
    audio.fanfare();
    await dlg.say('shelly', 'Seven days... straight... Here. A *maintenance key*. I found it... in 1983. There\'s a door... at *Bodega Blvd*.');
  }
  for (const sid of r.stickers) if (sid !== 'shelly') await dlg.say('shelly', `And a sticker... *${stickerById[sid].name}*... for your book.`);
  if (r.stickers.includes('shelly')) await dlg.say('shelly', 'Oh... and a sticker... of me. For your book. Don\'t... make it weird.');
  await dlg.say('shelly', 'Come back... tomorrow... the streak... grows. Day 7... is the big one.');
}

async function callOperator() {
  audio.ring();
  await wait(600);
  const firstEver = !E.S.seen.tips.operator;
  E.S.day.opHeard = true;
  E.S.seen.tips.operator = true;
  E.commit();
  if (firstEver) {
    await dlg.say('operator', '...You picked up. Good. You don\'t know me. But I know you, kid.');
    await dlg.say('operator', 'Every day I got *three jobs*. You do \'em, I pay. Simple. The jobs change at midnight.');
  }
  if (E.allMissionsDone() && !E.S.day.opClaimed) {
    const b = E.claimOperatorBonus();
    audio.fanfare();
    await dlg.say('operator', `All three. Nice work. Here's *${b.tokens} tokens* extra${b.sticker ? `, and a sticker: *${stickerById[b.sticker].name}*` : ''}.`);
    const pw = E.weekPassword();
    E.S.week.knows = true;
    E.commit();
    await dlg.say('operator', `And since you're reliable... the door marked *EMPLOYEES ONLY* at *Bodega Blvd*? This week the word is _${pw.word}_. You didn't hear it from me.`);
    await dlg.say('operator', '*Click.*');
    return;
  }
  const ms = E.missions();
  const lines = ms.map((m, i) => `${i + 1}) ${m.def.text}${m.done ? ' ✓' : m.def.goal > 1 ? ` (${m.progress}/${m.def.goal})` : ''}`);
  await dlg.say('operator', `Today's jobs. ${lines.join('  ')}`);
  if (E.allMissionsDone()) {
    await dlg.say('operator', 'You already got paid today. Come back tomorrow. *Click.*');
    return;
  }
  if (!E.S.week.backroom) {
    await dlg.say('operator', `One more thing. There's a door at Bodega Blvd that opens for whoever knows the word. Hint: ${E.weekPassword().riddle}`);
  }
  await dlg.say('operator', pick(['Don\'t call me. I call you. *Click.*', 'Mind the third rail. *Click.*', 'Tick tock, kid. *Click.*']));
}

function wanted() {
  E.track('wanted');
  const p = E.deals().dotd.product;
  openShop(p.shop, { product: p.id, line: `WANTED: ${p.name}. ${E.deals().dotd.pct}% off, today only.` });
}

async function talkCharlie() {
  G.stage.talking = 'cups';
  if (E.S.day.cupsWins >= 5) {
    await dlg.say('weasel', 'Nope. Nuh-uh. You cleaned me out today, pal. Come back tomorrow when I got more tokens.');
    return;
  }
  const bets = [10, 25, 50, 100];
  const choices = bets.map((b) => ({ label: `Bet ${b} tokens`, disabled: E.S.tokens < b }));
  choices.push('How does it work?', 'No thanks');
  const c = await dlg.ask('weasel', pick(['Step right up! Follow the token, double your tokens!', 'Easy money, friend. Keep your eye on the token. That\'s all.', 'Ya look like a sharp one. Wanna test those eyes?']), choices, { cancel: choices.length - 1 });
  if (c == null || c === choices.length - 1) {
    if (c != null) await dlg.say('weasel', 'Suit yourself. The cups ain\'t goin\' nowhere.');
    return;
  }
  if (c === bets.length) {
    await dlg.say('weasel', 'I put a token under a cup. I shuffle. You pick. Find it, you double your bet. Bigger bets, faster hands. It\'s fair. Mostly. Totally. It\'s fair.');
    return;
  }
  dlg.end();
  await openGame('cups', { ...gameCtx('cups'), bet: bets[c] });
}

async function useClaw() {
  const cost = 15;
  const prizes = E.clawPrizes();
  if (!prizes.length) {
    await dlg.say('grabber', 'MACHINE EMPTY. RESTOCKING AT MIDNIGHT. BEEP.');
    return;
  }
  const c = await dlg.ask('grabber', `INSERT *${cost} TOKENS*. GRAB A CAPSULE. PRIZES: tokens, stickers, coupons, streak freezes${E.S.keys.maint ? '' : ', *one rare key*'}. BEEP BOOP.`, [
    { label: `Play (${cost} tokens)`, disabled: E.S.tokens < cost }, 'Walk away',
  ], { cancel: 1 });
  if (c !== 0) return;
  if (!E.spend(cost)) return;
  dlg.end();
  await openGame('claw', gameCtx('claw'));
}

async function useLegal() {
  dlg.end();
  await openGame('tag', gameCtx('tag'));
}

async function useArcade() {
  dlg.end();
  await openGame('runner', gameCtx('runner'));
}

async function crack() {
  if (!E.S.secrets.crack) {
    G.crackHits++;
    audio.knock();
    view.shake = 4;
    if (G.crackHits < 3) {
      await dlg.say('narrator', pick(['The tiles here are cracked. They sound... hollow.', 'Something rattles behind the tile. One more good knock…']));
      return;
    }
    G.stage.fx.burst(1782, 386, 20, { color: ['#5a4a8a', '#8a7ab8', '#2a2252'], speed: 220, g: 600, life: 0.8 });
    audio.clunk();
  }
  const loot = E.crackLoot();
  if (!loot) {
    await dlg.say('narrator', 'The hole behind the tile is empty. Somebody refills it every day.');
    return;
  }
  audio.coin(true);
  if (loot.first) hud.toast('SECRET FOUND · A HIDDEN STASH', 'hot', 4000);
  const [sx, sy] = Eng.toScreen(1782, 380);
  hud.flyTokens(sx, sy, 10);
  await dlg.say('narrator', loot.first ? `The tile crumbles. Behind it: a stash of *${loot.tokens} tokens* and a note: “take some, leave some.”` : `Somebody refilled the hole. *${loot.tokens} tokens*.`);
}

async function backDoor() {
  audio.knock();
  await wait(500);
  G.peeking = true;
  if (E.S.week.backroom) {
    await dlg.say('moth', 'Ah. You again. Come in, come in.');
    return enterBackRoom();
  }
  const answer = await dlg.input('moth', 'A slot slides open. Two glowing eyes. “...Password?”', 'TYPE THE WORD');
  if (answer == null || !answer.trim()) {
    await dlg.say('moth', 'Then shoo.');
    return;
  }
  if (!E.checkPassword(answer)) {
    audio.beepBad();
    await dlg.say('moth', pick(['Wrong. The slot slams shut.', 'No. The phone booth knows the word. Ask it nicely.', 'Ha. No.']));
    return;
  }
  audio.fanfare();
  E.S.week.backroom = true;
  E.commit();
  const first = E.discover('backroom');
  if (first) {
    E.addSticker('eye');
    E.addTokens(100, 'secret');
  }
  await dlg.say('moth', first ? 'Correct. Welcome to *the Back Room*. First visit is on the house: *100 tokens* and a little something for your book.' : 'Correct. Come in. Quickly.');
  return enterBackRoom();
}

async function enterBackRoom() {
  dlg.end();
  await fade(true);
  await wait(250);
  await fade(false);
  openShop('backroom', { line: pick(SHOPS.backroom.hello) });
}

async function maintDoor() {
  if (!E.S.keys.maint) {
    await dlg.say('narrator', 'Locked. A heavy padlock, and a sign: *AUTHORIZED PERSONNEL ONLY*.');
    await dlg.say('me', 'There\'s gotta be a key somewhere. Maybe that claw machine in Token Sq… or Shelly’s 7-day streak prize.');
    return;
  }
  const c = await dlg.ask('narrator', 'The maintenance key fits. Behind the door, a ladder goes down into the dark. It smells… green.', ['Climb down', 'Not today'], { cancel: 1 });
  if (c !== 0) return;
  dlg.end();
  await fade(true);
  loadScene('sewer', SCENES.sewer.spawn);
  await wait(250);
  await fade(false);
  hud.stationBanner('THE SEWERS');
  await wait(1800);
  if (E.discover('sewer')) {
    E.addSticker('gator');
    E.addTokens(100, 'secret');
    hud.toast('First time in the sewers: +100 tokens', 'cash', 3000);
  }
}

async function climbUp() {
  const c = await dlg.ask('narrator', 'The ladder goes back up to Bodega Blvd.', ['Climb up', 'Stay down here'], { cancel: 1 });
  if (c !== 0) return;
  dlg.end();
  await fade(true);
  loadScene('bodega', 1456);
  await wait(250);
  await fade(false);
  hud.stationBanner('BODEGA BLVD');
}

async function readMural() {
  await dlg.say('narrator', 'Scrawled in white paint: *“the last train runs at midnight.”* Under it, a tiny ghost.');
  await dlg.say('me', 'Sometimes the train that shows up isn\'t the 3. Especially around midnight.');
}

async function ringBell() {
  const c = await dlg.ask('ghost', 'Ring the bell and the last train comes for you. Ready to return to the living?', ['Ring it', 'Not yet'], { cancel: 1 });
  if (c !== 0) return;
  audio.chime();
  G.after = () => ghostDeparture(false);
}

const TALKED = new Set();
async function talkNpc(e) {
  const n = e.npc;
  E.track('talk', e.id);
  const who = n.who === 'pizza' ? 'stranger' : n.who === 'ghostrat' ? 'stranger' : 'stranger';
  if (n.who === 'busker') {
    const c = await dlg.ask('stranger', pick(n.lines), [{ label: 'Tip 5 tokens', disabled: E.S.tokens < 5 }, 'Just listen', 'Walk on'], { cancel: 2 });
    if (c === 0 && E.spend(5)) {
      E.track('tip');
      audio.sax();
      await dlg.say('stranger', pick(['Ayy! This one\'s for you.', 'Generous! Here\'s my one song again!', 'Respect. Rent\'s paid. Partially.']));
    } else if (c === 1) {
      audio.sax();
      await dlg.say('narrator', 'He plays the one song he knows. It\'s a really good song.');
    }
    return;
  }
  if (n.who === 'sleeper') {
    await dlg.say('narrator', 'He\'s fast asleep. He\'s been asleep since the late nineties.');
    await dlg.say('stranger', pick(n.lines));
    return;
  }
  const lines = n.lines;
  const idx = TALKED.has(e.id) ? Math.floor(Math.random() * lines.length) : 0;
  TALKED.add(e.id);
  await dlg.say(who, lines[idx]);
}

// ---------------------------------------------------------------- minigame context

function gameCtx(name) {
  return {
    econ: E,
    audio,
    hud,
    look: G.player.look,
    name: E.S.profile?.name || 'YOU',
    onTagImage: (url) => { E.S.tagImage = url; E.commit(); loadTagImage(url); },
  };
}

// ---------------------------------------------------------------- travel

async function fade(on) {
  $('#fade').classList.toggle('on', on);
  await wait(360);
}

function trainArrive(ghost) {
  return new Promise((res) => {
    G.train.passengerLook = G.player.look;
    G.train.showPassenger = false;
    G.train.arrive(G.player.x, view.camX, { ghost, onStop: res });
  });
}

function trainDepart() {
  return new Promise((res) => G.train.depart(res));
}

async function travel(dest, opts = {}) {
  if (G.mode !== 'play' || G.busy) return;
  if (dest === G.scene) return;
  G.busy = true;
  G.mode = 'travel';
  closeAll();
  dlg.end();
  G.player.stop();
  const fromGhost = G.scene === 'ghost';
  try {
    let ghost = opts.ghost ?? (dest !== 'ghost' && E.rollGhost());
    audio.train('arrive', 2.8);
    await trainArrive(ghost);
    audio.chime();
    if (ghost && dest !== 'ghost' && !fromGhost) {
      audio.ghostWail();
      const c = await dlg.ask('narrator', 'That\'s… not the 3. The car glows green. A conductor\'s cap tips at you through the glass.', ['Get on', 'Wait for the next train'], { cancel: 1 });
      dlg.end();
      if (c === 0) dest = 'ghost';
      else {
        await wait(300);
        await trainDepart();
        ghost = false;
        audio.train('arrive', 2.8);
        await trainArrive(false);
        audio.chime();
      }
    }
    // board
    G.player.walkTo(G.train.doorX());
    await wait(500);
    G.player.hidden = true;
    G.train.showPassenger = true;
    await wait(500);
    audio.chime();
    audio.train('depart', 2);
    await trainDepart();
    // tunnel
    G.tunnel = { name: dest === 'ghost' && !E.S.secrets.ghost ? '???' : SCENES[dest].name, ghost: dest === 'ghost' || fromGhost };
    G.mode = 'tunnel';
    await wait(1700);
    // arrive
    loadScene(dest, SCENES[dest].arrive);
    G.mode = 'travel';
    G.player.hidden = true;
    audio.train('arrive', 2.4);
    await trainArrive(dest === 'ghost' || fromGhost);
    G.train.showPassenger = true;
    audio.chime();
    await wait(400);
    G.train.showPassenger = false;
    G.player.hidden = false;
    G.player.x = G.train.doorX();
    G.player.walkTo(G.player.x + 40);
    await wait(500);
    audio.train('depart', 2);
    await trainDepart();
    E.track('ride');
    hud.stationBanner(SCENES[dest].name);
    if (dest === 'ghost') arriveGhost();
  } finally {
    G.mode = 'play';
    G.busy = false;
    G.player.hidden = false;
  }
}

function arriveGhost() {
  G.ghostLeft = 180;
  setTimeout(() => {
    const first = E.discover('ghost');
    E.addSticker('ghosttrain');
    if (first) {
      E.addSticker('ghost');
      E.addTokens(100, 'secret');
      hud.toast('First ride on the last train: +100 tokens', 'cash', 3000);
    }
    hud.toast('The ghost train comes back in 3 minutes. Shop fast.', 'sun', 4200);
  }, 1900);
}

async function ghostDeparture(forced) {
  if (G.mode !== 'play' || G.scene !== 'ghost') return;
  G.ghostLeft = 0;
  if (forced) {
    closeAll();
    dlg.end();
    G.busy = true;
    await dlg.say('ghost', 'All aboard who\'s going aboard! The last train waits for no one. Except me.');
    dlg.end();
    G.busy = false;
  }
  G.mode = 'play';
  await travel('token', { ghost: true });
}

function drawGhostClock(g) {
  if (G.ghostLeft <= 0) return;
  const s = Math.ceil(G.ghostLeft);
  const txt = `LAST TRAIN IN ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  Eng.screenTransform(g);
  text(g, txt, view.w / 2, view.h - (view.w < 720 ? 104 : 30), { size: view.w < 720 ? 18 : 24, font: FONTS.sign, fill: G.ghostLeft < 30 ? '#ff4f9a' : '#9ad8c8', lw: 5 });
}

// keyboard: Escape closes the top panel even while the world is blocked
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && anyOverlay() && !dlg.open) {
    const top = topOverlay();
    if (top && top.opts.dismissable !== false) closeOverlay();
  }
});

boot();
