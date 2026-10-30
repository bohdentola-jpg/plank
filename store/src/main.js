// DRIP LINE — the train that never stops. Boot, the daily flow, every car's
// interactions and every conversation.
import * as Eng from './engine.js';
import { view, keys, pressed, clearPressed } from './engine.js';
import { Ride, CAR_DEFS } from './world/ride.js';
import { drawScreenFx } from './world/fx.js';
import { itemById, SHOPS, RARITIES } from './data/items.js';
import { TICKETS, FREEZE_COST } from './data/content.js';
import * as E from './systems/econ.js';
import * as audio from './audio.js';
import * as hud from './ui/hud.js';
import { Bubbles } from './ui/bubbles.js';
import { $, anyOverlay, onOverlayChange, closeOverlay, closeAll, topOverlay } from './ui/dom.js';
import { openShop } from './ui/shop.js';
import { openCloset, initCloset } from './ui/closet.js';
import { openCapsules, initCapsules } from './ui/capsules.js';
import { openTrainMap, initTrainMap, CAR_INFO } from './ui/trainmap.js';
import { openMe, initMe } from './ui/me.js';
import { openCreator, drawLogo } from './ui/creator.js';
import { openGame } from './games/index.js';
import { devParams as Q } from './dev.js';

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (n) => n.toLocaleString('en-US');

const G = { mode: 'boot', busy: false, t: 0, after: null, tagImg: null };
let ctx, talk, ride;

// ---------------------------------------------------------------- boot

async function boot() {
  ctx = Eng.initCanvas($('#world'));
  Eng.initInput();
  talk = new Bubbles($('#bubble'), $('#choices'));
  try {
    await Promise.race([
      Promise.all(['Bungee', 'Gochi Hand', 'Permanent Marker', 'Sedgwick Ave Display', 'Rubik Wet Paint'].map((f) => document.fonts.load(`32px "${f}"`))),
      wait(2500),
    ]);
  } catch { /* fallback fonts are fine */ }

  E.ensureDay();
  if (E.S.tagImage) loadTagImage(E.S.tagImage);
  ride = new Ride($('#world'), $('#hotspots'), {
    body: () => (E.S.profile ? E.S.profile.body : { skin: 'cream', head: 'round', face: 'dots' }),
    outfit: () => E.outfitOf(),
    talking: () => talk.talking,
    state: carState,
    tags: carTags,
    pickups: (car, n) => E.pickups(car, n),
    onHot: (id) => interact(id),
    onCoin: collectCoin,
    onSwipe: (dir) => { if (canAct()) (dir === 'next' ? goNext() : goBack()); },
    onArrive: (id) => arrived(id),
  });
  talk.anchorOf = (who) => ride.anchorOf(who);
  setupHud();
  setupEvents();
  initCloset({ editFigure: () => openCreator((p) => E.setProfile(p)) });
  initCapsules({ wear: (it) => { ride.pose(RARITIES[it.rarity].rank >= 4 ? 'cheer' : 'pose', 1.8); refreshFace(); } });
  initTrainMap({ go: (id) => travelTo(id), current: () => ride.car, order: reachable });
  initMe({ goShop: (sid, item) => { travelTo(sid).then(() => openShop(sid, { item, onBought })); } });
  onOverlayChange(() => { clearPressed(); keys.clear(); $('#hint').hidden = true; ride.refreshTags(); });
  talk.onOpenChange = (open) => { if (open) $('#hint').hidden = true; $('#app').classList.toggle('talking', open); };

  // start car: the front car on a new day (that's where you punch in), else where you left off
  let start = Q.get('car') && CAR_DEFS[Q.get('car')] ? Q.get('car') : E.canCheckIn() ? 'front' : E.CARS.includes(E.S.car) ? E.S.car : 'front';
  ride.setCar(start);
  Eng.onResize(() => {
    ride.resize(view.w, view.h, view.dpr);
    drawLogo($('#boot-logo'));
  });
  ride.resize(view.w, view.h, view.dpr);
  drawLogo($('#boot-logo'));
  $('#boot-load').textContent = '';
  Eng.startLoop(frame);

  const enter = () => {
    audio.init();
    applySound();
    $('#boot').classList.add('gone');
    setTimeout(() => { $('#boot').hidden = true; }, 520);
    start = null;
    begin();
  };
  // When hosted somewhere that hot-swaps new versions (the Claude artifact
  // viewer), keep the player where they were instead of showing the title again.
  const hot = window.claude?.hot;
  hot?.snapshot?.(() => ({ entered: G.mode !== 'boot', car: ride.car }));
  const go = (data = {}) => {
    if (data.entered && E.S.profile && CAR_DEFS[data.car]) {
      ride.setCar(data.car);
      $('#boot').hidden = true;
      audio.init();
      applySound();
      begin(true);
    } else if (Q.has('quick')) {
      $('#boot').hidden = true;
      if (!E.S.profile) E.setProfile({ name: 'QA', body: { skin: 'mint', head: 'round', face: 'dots' } });
      begin(true);
    } else {
      $('#boot-go').addEventListener('click', enter, { once: true });
      $('#boot-go').focus({ preventScroll: true });
    }
  };
  if (hot?.ready) hot.ready(go);
  else go(hot?.data ?? {});
  if (Q.get('open') || Q.get('game')) setTimeout(qaOpen, 400);
}

function begin(quiet = false) {
  G.mode = 'play';
  hud.showHud(true);
  if (!E.S.profile) {
    openCreator((p) => {
      E.setProfile(p);
      talk.setPlayerName(p.name);
      refreshFace();
      ride.setCar('front');
      firstRide();
    }, { first: true });
    return;
  }
  talk.setPlayerName(E.S.profile.name);
  refreshFace();
  arrived(ride.car, true);
  if (quiet) return;
  if (E.S.migrated && !E.S.seen.tips.migrated) {
    E.S.seen.tips.migrated = true;
    E.commit();
    setTimeout(() => hud.toast('Welcome back! Your tokens and streak came with you.', 'sun', 4200), 900);
  }
  if (E.canCheckIn()) setTimeout(() => { if (ride.car === 'front' && canAct()) interact('npc'); }, 1300);
  else if (E.freePullReady()) setTimeout(() => hud.toast('Your free daily capsule is waiting in CAR 7', 'sun', 3600), 1200);
  controlsHint();
}

async function firstRide() {
  hud.showHud(true);
  arrived('front', true);
  controlsHint();
  await wait(900);
  interact('npc');
}

function controlsHint() {
  if (matchMedia('(pointer: coarse)').matches) {
    setTimeout(() => { if (!anyOverlay() && !talk.open) hud.toast('Tap things to use them · swipe or tap the door to change cars · tap yourself for your closet', '', 5200); }, 2600);
    return;
  }
  const h = $('#hint');
  h.innerHTML = 'Click anything · <b>→</b> next car · <b>←</b> back · <b>E</b> talk · <b>C</b> closet · <b>M</b> train map';
  h.hidden = false;
  h.style.opacity = '1';
  setTimeout(() => { h.style.opacity = '0'; }, 9000);
  setTimeout(() => { h.hidden = true; }, 10100);
}

function qaOpen() {
  const [what, arg] = (Q.get('open') || '').split(':');
  if (what === 'shop') openShop(arg || 'threads', { onBought });
  if (what === 'closet') openCloset();
  if (what === 'capsules') openCapsules(arg || 'basic');
  if (what === 'train') openTrainMap();
  if (what === 'me') openMe(arg || 'me');
  if (what === 'creator') openCreator((p) => E.setProfile(p));
  if (what === 'talk') interact(arg || 'npc');
  if (Q.get('game')) openGame(Q.get('game'), gameCtx()).then((r) => console.log('[game result]', JSON.stringify(r)));
}

// ---------------------------------------------------------------- HUD + events

function setupHud() {
  hud.initHud({
    train: () => { audio.click(); openTrainMap(); },
    closet: () => { audio.click(); openCloset(); },
    me: () => { audio.click(); openMe(); },
    sound: () => {
      const on = !(E.S.settings.music && E.S.settings.sfx);
      E.S.settings.music = on;
      E.S.settings.sfx = on;
      E.commit();
      audio.init();
      applySound();
    },
    back: () => { if (canAct()) goBack(); },
    next: () => { if (canAct()) goNext(); },
  });
  hud.setTokens(E.S.tokens, true);
  hud.setStreak(E.S.streak.count, E.S.streak.freezes);
  hud.setTicker(E.headlines());
  applySound();
  dots();
}

function applySound() {
  audio.setMusic(!!E.S.settings.music);
  audio.setSfx(!!E.S.settings.sfx);
  hud.setSoundIcon(E.S.settings.music || E.S.settings.sfx);
}

function refreshFace() {
  if (E.S.profile) hud.setFace(E.S.profile.body, E.outfitOf());
}

function dots() {
  hud.setDots({ closet: E.S.fresh.length > 0, me: E.allJobsDone() && !E.S.day.jobsClaimed });
}

const QUIET_TOKENS = ['job', 'jobs', 'claw', 'checkin', 'pickup', 'scrap', 'buy', 'capsule', 'spend', 'freeze', 'test'];

function setupEvents() {
  E.on('tokens', ({ n, why }) => {
    hud.setTokens(E.S.tokens);
    if (n > 0) hud.bumpTokens();
    if (n > 0 && !QUIET_TOKENS.includes(why)) hud.tokenToast(n);
  });
  E.on('item', (res) => {
    if (res.isNew || res.upgraded) hud.itemToast(res.item, { prismatic: res.prismatic, upgraded: res.upgraded });
    else if (res.scrap) hud.toast(`DUPLICATE ${res.item.name.toUpperCase()} · <span class="t-big">+${fmt(res.scrap)}</span> TOKENS`, 'cash', 2600);
    dots();
  });
  E.on('equip', () => { refreshFace(); dots(); });
  E.on('job', ({ def }) => {
    hud.toast(`JOB DONE · ${def.text} <span class="t-big">+${def.reward}</span>`, 'cash', 3200);
    audio.fanfare();
    dots();
  });
  E.on('jobsAll', () => setTimeout(() => {
    hud.toast('All 3 jobs done! Signal has a bonus for you in the front car.', 'sun', 4200);
    dots();
  }, 1600));
  E.on('streak', () => hud.setStreak(E.S.streak.count, E.S.streak.freezes));
  E.on('freeze', () => hud.setStreak(E.S.streak.count, E.S.streak.freezes));
  E.on('secret', (w) => hud.toast(`SECRET FOUND · ${({ ghost: 'THE GHOST CAR', vault: 'THE VAULT', cab: 'THE CAB', change: 'A GOLDEN TOKEN' })[w]}`, 'hot', 4000));
  E.on('day', () => {
    hud.setTicker(E.headlines());
    hud.setStreak(E.S.streak.count, E.S.streak.freezes);
    ride.refreshTags();
    if (G.mode === 'play') hud.toast('NEW DAY · fresh stock in every car, new jobs, a free capsule', 'sun', 4200);
  });
  E.on('profile', (p) => { talk.setPlayerName(p.name); refreshFace(); });
}

function loadTagImage(url) {
  const img = new Image();
  img.onload = () => { G.tagImg = img; };
  img.src = url;
}

// ---------------------------------------------------------------- car state for the renderer

function carState(car) {
  const d = CAR_DEFS[car];
  const st = { number: d.num || null, label: d.label, glow: {}, locked: {}, display: [] };
  if (d.shop) {
    const rows = SHOPS[d.shop].secret ? E.secretStock(d.shop) : E.stock(d.shop);
    st.display = rows.map((r) => r.item.art);
  }
  if (car === 'front') {
    if (E.canCheckIn()) st.glow.reader = 1;
    if (E.allJobsDone() && !E.S.day.jobsClaimed) st.glow.board = 1;
  }
  if (car === 'capsules') {
    st.free = E.freePullReady();
    if (st.free) st.glow.basic = 1;
    st.locked.next = !E.ghostOpen();
  }
  if (car === 'arcade' && G.tagImg) st.tagImage = G.tagImg;
  return st;
}

function carTags(car) {
  const d = CAR_DEFS[car];
  const T = {};
  const npcName = (id) => (id ? id.toUpperCase() : '');
  if (d.npc) T.npc = { text: npcName(d.npc), aria: `Talk to ${npcName(d.npc)}` };
  if (d.npc2) T.npc2 = { text: npcName(d.npc2), aria: `Talk to ${npcName(d.npc2)}` };
  const next = nextOf(car);
  T['door-next'] = next ? { aria: `Walk to ${CAR_INFO[next] ? CAR_INFO[next].name : 'the next car'}` } : car === 'capsules' ? { text: 'LOCKED', aria: 'A chained door' } : null;
  if (car === 'front') {
    T.reader = E.canCheckIn() ? { text: 'PUNCH IN', cls: 'go', aria: 'Punch in for today' } : { aria: 'Card reader (already punched in today)' };
    T.board = E.allJobsDone() && !E.S.day.jobsClaimed ? { text: 'JOBS DONE!', cls: 'gold', aria: 'Job board' } : { text: 'JOBS', aria: 'Job board' };
    T.lockers = { text: 'CLOSET', aria: 'Your closet' };
    T.calendar = { aria: 'Streak calendar' };
  }
  if (d.shop) T.display = { text: SHOPS[d.shop].secret ? 'BROWSE' : 'TODAY’S STOCK', cls: 'gold', aria: `Browse ${SHOPS[d.shop].name}` };
  if (car === 'arcade') {
    T.runner = { text: 'TUNNEL RUN', aria: 'Play Tunnel Run' };
    T.tagwall = { text: 'TAG WALL', aria: 'Paint the Tag Wall' };
    T.claw = { text: 'THE GRABBER', aria: 'Play The Grabber claw machine' };
    T.shell = { aria: 'Shell game table' };
  }
  if (car === 'capsules') {
    T.basic = E.freePullReady() ? { text: 'FREE PULL!', cls: 'go', aria: 'Basic capsule machine, free pull ready' } : { text: 'BASIC', aria: 'Basic capsule machine' };
    T.deluxe = { text: 'DELUXE', cls: 'hot2', aria: 'Deluxe capsule machine' };
    T.vault = { aria: 'A graffiti-covered panel' };
  }
  if (car === 'cab') {
    T.lockbox = E.S.day.lockbox ? { aria: 'Lockbox (empty until tomorrow)' } : { text: 'LOCKBOX', cls: 'gold', aria: 'Open the lockbox' };
    T.console = { aria: 'Driver’s console' };
    T.window = { aria: 'Front window' };
  }
  return T;
}

// ---------------------------------------------------------------- navigation

function reachable() {
  const out = [];
  if (E.S.keys.cab) out.push('cab');
  out.push(...E.CARS);
  if (E.ghostOpen()) out.push('ghost');
  return out;
}

function nextOf(car) {
  if (car === 'vault') return null;
  if (car === 'cab') return 'front';
  if (car === 'ghost') return null;
  const i = E.CARS.indexOf(car);
  if (i >= 0 && i < E.CARS.length - 1) return E.CARS[i + 1];
  if (car === 'capsules' && E.ghostOpen()) return 'ghost';
  return null;
}

function backOf(car) {
  if (car === 'vault') return 'capsules';
  if (car === 'ghost') return 'capsules';
  if (car === 'cab') return null;
  const i = E.CARS.indexOf(car);
  if (i > 0) return E.CARS[i - 1];
  if (car === 'front' && E.S.keys.cab) return 'cab';
  return null;
}

function updateNav() {
  const b = backOf(ride.car), n = nextOf(ride.car);
  const name = (id) => (id === 'cab' ? 'CAB' : id === 'ghost' ? '???' : id === 'capsules' && ride.car === 'vault' ? 'OUT' : CAR_INFO[id] ? CAR_INFO[id].name.split(' ')[0] : 'BACK');
  hud.setNav(b ? name(b) : null, n ? (ride.car === 'cab' ? 'FRONT CAR' : `CAR ${E.CARS.indexOf(n) + 1 || '?'}`) : null);
}

const canAct = () => G.mode === 'play' && !G.busy && !talk.open && !anyOverlay() && !ride.tr;

async function goNext() {
  const n = nextOf(ride.car);
  if (n) return walk(n, 'next');
  if (ride.car === 'capsules') return capsuleDoor();
  return null;
}

async function goBack() {
  const b = backOf(ride.car);
  if (b) return walk(b, 'back');
  if (ride.car === 'front') {
    G.busy = true;
    try {
      await talk.say('signal', E.S.keys.cab ? 'Go ahead, the cab’s open.' : 'Behind me? That’s the driver’s cab. Locked since before I was a lamp. Word is a *7-day streak* gets you the key.');
    } finally { endTalk(); }
  }
}

async function walk(id, dir) {
  if (G.busy) return;
  G.busy = true;
  closeAll();
  talk.end();
  audio.whoosh();
  try {
    await ride.travel(id, dir);
  } finally {
    G.busy = false;
  }
}

async function travelTo(id) {
  if (id === ride.car) return;
  await walk(id, E.CARS.indexOf(id) < E.CARS.indexOf(ride.car) || id === 'cab' ? 'back' : 'next');
}

function arrived(id, silent = false) {
  if (E.CARS.includes(id)) {
    E.S.car = id;
    E.commit();
    E.track('car', id);
  }
  const d = CAR_DEFS[id];
  if (!d.num) hud.carBanner(null, d.label);
  updateNav();
  audio.setMood(id === 'ghost' ? 'ghost' : id === 'vault' || id === 'cab' ? 'sewer' : 'main');
  if (!silent) audio.chime();
  if (id === 'ghost') {
    E.discover('ghost');
  }
  if (id === 'cab') E.discover('cab');
}

// ---------------------------------------------------------------- loose change

function collectCoin(p, sx, sy) {
  E.collect(p);
  audio.coin(!!p.big);
  hud.flyTokens(sx, sy, p.big ? 8 : 3);
}

// ---------------------------------------------------------------- interactions

function endTalk() {
  talk.end();
  G.busy = false;
  clearPressed();
  ride.refreshTags();
  updateNav();
  if (G.after) {
    const fn = G.after;
    G.after = null;
    fn();
  }
}

async function interact(id) {
  if (G.mode !== 'play' || G.busy || anyOverlay() || ride.tr) return;
  if (id === 'me') { openCloset(); return; }
  if (id === 'door-next') {
    if (nextOf(ride.car)) goNext();
    else capsuleDoor();
    return;
  }
  G.busy = true;
  const car = ride.car;
  try {
    switch (car) {
      case 'front':
        if (id === 'npc') await talkSignal();
        else if (id === 'reader') await punchIn();
        else if (id === 'board') openMe('jobs');
        else if (id === 'lockers') openCloset();
        else if (id === 'calendar') openMe('me');
        break;
      case 'threads': case 'kicks': case 'lids': case 'ice':
        if (id === 'npc') await talkKeeper(CAR_DEFS[car].shop);
        else if (id === 'display') openShop(CAR_DEFS[car].shop, { onBought });
        break;
      case 'arcade':
        if (id === 'npc') await talkJoy();
        else if (id === 'npc2' || id === 'shell') await talkEight();
        else if (id === 'runner') await playGame('runner');
        else if (id === 'tagwall') await playGame('tag');
        else if (id === 'claw') await useClaw();
        break;
      case 'capsules':
        if (id === 'npc') await talkPlug();
        else if (id === 'basic') openCapsules('basic');
        else if (id === 'deluxe') openCapsules('deluxe');
        else if (id === 'vault') await knockVault();
        break;
      case 'ghost':
        if (id === 'npc') await talkStatic();
        else if (id === 'display') openShop('ghost', { onBought });
        break;
      case 'vault':
        if (id === 'npc') await talk.say('plug', pick(['Don’t touch the glass. Okay, touch it a little.', 'One of everything, nothing for cheap. Save up.', 'You found the vault. That makes you family. Family pays full price.']));
        else if (id === 'display') openShop('vault', { onBought });
        break;
      case 'cab':
        if (id === 'lockbox') await lockbox();
        else if (id === 'console') { audio.train('pass', 1.2); await talk.say('narrator', 'You pull the horn cord. Somewhere far down the train, Signal yells “WHO DID THAT.”'); }
        else if (id === 'window') await talk.say('narrator', 'The tunnel rushes at you forever. Nobody is driving. The train seems fine with it.');
        break;
      default: break;
    }
  } catch (err) {
    console.error(err);
  } finally {
    endTalk();
  }
}

function onBought(item) {
  ride.pose('cheer', 1.6);
  refreshFace();
}

// ---------------------------------------------------------------- Signal (front car)

async function talkSignal() {
  if (!E.S.seen.intro) {
    await talk.say('signal', 'Welcome aboard the *Drip Line*! This train never stops, so neither does the shopping.');
    await talk.say('signal', 'Everything on board costs *tokens*. You earn tokens by punching in *every day*, doing my *three jobs*, playing the *arcade* and grabbing loose change off the floor.');
    await talk.say('signal', 'Every car sells different fits and the stock changes at *midnight*. Some items are *insanely rare*. The capsule machines in Car 7 can drop anything.');
    await talk.say('signal', 'Oh, and tap *yourself* anytime to open your closet. Now go on, punch in!');
    E.S.seen.intro = true;
    E.commit();
  }
  for (;;) {
    const can = E.canCheckIn();
    const pv = E.streakPreview();
    const jobsReady = E.allJobsDone() && !E.S.day.jobsClaimed;
    const line = jobsReady ? 'You did all three jobs! I’ve got something for you.'
      : can ? (pv.broken ? 'You missed a day, so your streak starts over. Unless you had freezes! Punch in?' : `Day *${pv.next}* of your streak is ready. Punch in?`)
        : pick(['Doors closing! Just kidding. What do you need?', 'Green means go. I’m on green. What’s up?', 'Need something, rider?']);
    const choices = [
      jobsReady ? { label: 'Claim my job bonus', value: 'jobs' } : { label: 'Today’s jobs', value: 'jobs' },
      can ? { label: 'Punch in for today', value: 'punch' } : { label: 'Already punched in today', value: 'punch', disabled: true },
      { label: `Buy a streak freeze (${FREEZE_COST})`, value: 'freeze', disabled: E.S.streak.freezes >= 2 || E.S.tokens < FREEZE_COST },
      { label: 'How does this train work?', value: 'help' },
      { label: 'See you', value: 'bye' },
    ];
    if (can) [choices[0], choices[1]] = [choices[1], choices[0]];
    const c = await talk.ask('signal', line, choices, { cancel: 'bye' });
    if (c === 'punch') { talk.end(); await punchIn(); return; }
    if (c === 'jobs') { await jobsTalk(); continue; }
    if (c === 'freeze') {
      const r = E.buyFreeze();
      if (r.err) { audio.beepBad(); await talk.say('signal', r.err); } else { audio.register(); await talk.say('signal', `A *streak freeze*. If you miss a day it covers you. You’ve got ${E.S.streak.freezes}.`); }
      continue;
    }
    if (c === 'help') {
      await talk.say('signal', 'Walk car to car with the door at the end, or the arrows. Every shopkeeper restocks at midnight. The *featured* slot can roll *legendary*.');
      await talk.say('signal', 'Rarities go *common*, uncommon, rare, epic, *legendary*, and *mythic*. Mythics are the real deal. Some only come from long streaks. Some from places that aren’t on the map.');
      await talk.say('signal', 'And any capsule can come out *prismatic*. Shimmery. One in two hundred. People cry.');
      continue;
    }
    if (c != null) await talk.say('signal', pick(['Mind the gap!', 'Stand clear of the closing doors!', 'Next stop: everywhere.']));
    return;
  }
}

async function jobsTalk() {
  if (E.allJobsDone() && !E.S.day.jobsClaimed) {
    const b = E.claimJobsBonus();
    audio.fanfare();
    await talk.say('signal', `All three! Here’s *${b.tokens} tokens* and a *capsule ticket*.`);
    await talk.say('signal', `And a secret: this week, the word is _${b.password.word}_. Plug in the last car might want to hear it. You didn’t hear it from me.`);
    dots();
    return;
  }
  const lines = E.jobs().map((j, i) => `${i + 1}) ${j.def.text}${j.done ? ' ✓' : j.def.goal > 1 ? ` (${j.progress}/${j.def.goal})` : ''}`);
  await talk.say('signal', `Today’s jobs: ${lines.join('  ')}`);
  if (E.allJobsDone()) await talk.say('signal', 'You already got paid today. New jobs at midnight!');
  else if (!E.S.week.heard) await talk.say('signal', `Finish all three and I’ll tell you a secret word. Hint: ${E.weekPassword().riddle}`);
}

async function punchIn() {
  if (!E.canCheckIn()) {
    await talk.say('signal', 'Already punched in! Come back tomorrow, same train.');
    return;
  }
  talk.end();
  const res = await openGame('swipe', gameCtx());
  if (res && res.checkin) await checkinReport(res.checkin);
}

async function checkinReport(r) {
  ride.pose('cheer', 1.6);
  await talk.say('signal', `Day *${r.count}*${r.count > 1 ? ' in a row' : ''}! Here’s *${r.tokens} tokens*${r.perfect ? '. Perfect swipe, show-off' : ''}.`);
  if (r.usedFreezes) await talk.say('signal', `You missed ${r.usedFreezes === 1 ? 'a day' : `${r.usedFreezes} days`}, but a *streak freeze* covered you.`);
  if (r.broke) await talk.say('signal', 'Your old streak broke. It happens. Start again!');
  for (const k of r.tickets) await talk.say('signal', `Plus an *${TICKETS[k].name.toLowerCase()}*. Use it at Plug’s machines in Car 7.`);
  for (const id of r.items) {
    const it = itemById[id];
    audio.fanfare();
    await talk.say('signal', `*${r.count} DAYS.* That earns you the *${it.name}*. ${RARITIES[it.rarity].name}. You can’t get it any other way.`);
  }
  if (r.key) {
    audio.fanfare();
    await talk.say('signal', 'Seven days straight! Here, the *cab key*. The driver’s cab is right behind me. Nobody’s been in there for years.');
    updateNav();
  }
  const nm = E.nextMilestone();
  await talk.say('signal', nm && nm.left <= 7 ? `Come back tomorrow! *${nm.left} more day${nm.left === 1 ? '' : 's'}* until the day-${nm.day} reward.` : 'Come back tomorrow! Day 7 of every week pays big.');
  if (E.freePullReady()) await talk.say('signal', 'And don’t forget your *free capsule* in Car 7.');
}

// ---------------------------------------------------------------- shopkeepers

async function talkKeeper(shopId) {
  const sh = SHOPS[shopId];
  E.track('talk', sh.keeper);
  const rows = E.stock(shopId);
  const feat = rows.find((r) => r.featured);
  const c = await talk.ask(sh.keeper, pick(sh.hello), [
    { label: 'Show me today’s stock', value: 'shop' },
    feat ? { label: `What’s featured? (${RARITIES[feat.item.rarity].name.toLowerCase()})`, value: 'feat' } : null,
    { label: 'See you', value: 'bye' },
  ].filter(Boolean), { cancel: 'bye' });
  if (c === 'shop') { talk.end(); openShop(shopId, { onBought }); return; }
  if (c === 'feat') {
    await talk.say(sh.keeper, `Today’s featured piece is the *${feat.item.name}*. ${feat.drop ? `It’s the *drop of the day*, ${feat.pct}% off!` : `${RARITIES[feat.item.rarity].name}. Gone at midnight.`}`);
    talk.end();
    openShop(shopId, { item: feat.item.id, onBought });
    return;
  }
  if (c != null) await talk.say(sh.keeper, pick(sh.bye));
}

async function talkJoy() {
  E.track('talk', 'joy');
  const c = await talk.ask('joy', pick(['PLAYER ONE! Insert tokens! Or don’t, most games are free!', 'High scores, low lighting. Pick a game!', 'Beep boop. That means hello.']), [
    { label: 'Tunnel Run', value: 'runner' },
    { label: 'Tag Wall', value: 'tag' },
    { label: 'The Grabber (15 tokens)', value: 'claw' },
    { label: 'Eight’s shell game', value: 'shell' },
    { label: 'Later', value: 'bye' },
  ], { cancel: 'bye' });
  if (c === 'runner' || c === 'tag') { talk.end(); await playGame(c); return; }
  if (c === 'claw') { await useClaw(); return; }
  if (c === 'shell') { await talkEight(); return; }
  if (c != null) await talk.say('joy', 'GAME OVER. Kidding. See you!');
}

async function talkEight() {
  E.track('talk', 'eight');
  if (E.S.day.cupsWins >= 5) {
    await talk.say('eight', 'Nope. You cleaned me out today, pal. Signs point to: come back tomorrow.');
    return;
  }
  const bets = [10, 25, 50, 100];
  const choices = bets.map((b) => ({ label: `Bet ${b} tokens`, value: b, disabled: E.S.tokens < b }));
  choices.push({ label: 'How does it work?', value: 'how' }, { label: 'No thanks', value: 'bye' });
  const c = await talk.ask('eight', pick(['Follow the token, double your tokens! Outlook good!', 'Ask again later. Kidding. Wanna play?', 'Easy money, friend. Keep your eye on the token.']), choices, { cancel: 'bye' });
  if (c === 'how') {
    await talk.say('eight', 'I put a token under a cup. I shuffle. You pick. Find it and you double your bet. Bigger bets, faster hands. It’s fair. My sources say yes.');
    return;
  }
  if (typeof c === 'number') {
    talk.end();
    await openGame('cups', { ...gameCtx(), bet: c });
    return;
  }
  if (c != null) await talk.say('eight', 'Reply hazy. Suit yourself.');
}

async function useClaw() {
  const cost = 15;
  if (!E.clawPrizes().length) {
    await talk.say('grabber', 'MACHINE EMPTY. RESTOCKING AT MIDNIGHT. BEEP.');
    return;
  }
  const c = await talk.ask('grabber', `INSERT *${cost} TOKENS*. GRAB A CAPSULE. PRIZES: tokens, capsule tickets, clothes, streak freezes${E.S.keys.cab ? '' : ', *one rare key*'}. BEEP BOOP.`, [
    { label: `Play (${cost} tokens)`, value: 'play', disabled: E.S.tokens < cost },
    { label: 'Walk away', value: 'bye' },
  ], { cancel: 'bye' });
  if (c !== 'play' || !E.spend(cost, 'claw')) return;
  talk.end();
  await openGame('claw', gameCtx());
  updateNav();
}

async function playGame(name) {
  talk.end();
  await openGame(name, gameCtx());
}

// ---------------------------------------------------------------- Plug (capsules) + the vault

async function talkPlug() {
  E.track('talk', 'plug');
  const free = E.freePullReady();
  const c = await talk.ask('plug', free ? 'Your *free pull* is ready. Could be a mythic. Probably a sock. We don’t sell socks.' : pick(['I’m the plug. Capsules, rare stuff, questions you shouldn’t ask.', 'Every capsule could be the one.', 'You want rare? I got rare.']), [
    { label: free ? 'Use my free pull' : `Basic capsule (${fmt(250)})`, value: 'basic' },
    { label: `Deluxe capsule (${fmt(1200)})`, value: 'deluxe' },
    { label: 'What are the odds?', value: 'odds' },
    { label: 'What’s with that panel?', value: 'panel' },
    { label: 'Later', value: 'bye' },
  ], { cancel: 'bye' });
  if (c === 'basic' || c === 'deluxe') { talk.end(); openCapsules(c); return; }
  if (c === 'odds') {
    await talk.say('plug', 'Basic: mostly commons, *0.1%* mythic. Deluxe: never a common, *1.5%* mythic, and a *legendary is guaranteed* within 25 pulls. Every pull: *1 in 200* comes out prismatic.');
    await talk.say('plug', 'Doubles turn into tokens. Prismatic doubles upgrade the one you’ve got. I’m generous like that.');
    return;
  }
  if (c === 'panel') {
    await talk.say('plug', 'What panel? That’s just graffiti. Very solid graffiti. That opens for people who know *the word*.');
    await talk.say('plug', 'Signal hears things. Do Signal’s jobs. All three.');
    return;
  }
  if (c != null) await talk.say('plug', 'You were never here.');
}

async function knockVault() {
  audio.knock();
  await wait(400);
  if (S_vaultOpen()) {
    await talk.say('plug', 'Back again? Get in, get in.');
    talk.end();
    G.after = () => walk('vault', 'next');
    return;
  }
  const answer = await talk.input('plug', 'Plug leans in. “...What’s the word?”', 'TYPE THE WORD');
  if (answer == null || !answer.trim()) {
    await talk.say('plug', 'Then it’s just graffiti.');
    return;
  }
  if (!E.checkPassword(answer)) {
    audio.beepBad();
    await talk.say('plug', pick(['Wrong word. Signal knows the right one.', 'Nope. Finish Signal’s three jobs and listen close.', 'Ha. No.']));
    return;
  }
  audio.fanfare();
  const first = E.openVault();
  await talk.say('plug', first ? 'That’s the word. Welcome to *the vault*. First visit, I’ll throw in *200 tokens*. Don’t get used to it.' : 'That’s the word. Come on in.');
  talk.end();
  G.after = () => walk('vault', 'next');
}

const S_vaultOpen = () => E.S.week.vault;

async function capsuleDoor() {
  if (ride.car !== 'capsules') return;
  G.busy = true;
  try {
    if (E.ghostOpen()) { talk.end(); G.after = () => walk('ghost', 'next'); return; }
    if (E.S.ghostTicket) {
      const c = await talk.ask('narrator', 'The chain on the last door hums when your *ghost ticket* gets close. Use it? The ghost car stays coupled for the rest of today.', [
        { label: 'Use the ghost ticket', value: 'yes' }, { label: 'Not now', value: 'no' },
      ], { cancel: 'no' });
      if (c === 'yes' && E.useGhostTicket()) {
        audio.ghostWail();
        updateNav();
        G.after = () => walk('ghost', 'next');
      }
      return;
    }
    await talk.say('narrator', '*NO PASSENGERS BEYOND THIS POINT.* The chain is ice cold. On some nights, people say, there’s another car back there.');
    await talk.say('plug', 'The ghost car? Comes and goes. Midnight’s your best bet. Or a ghost ticket. The Grabber has one sometimes.');
  } finally {
    endTalk();
  }
}

async function talkStatic() {
  const c = await talk.ask('static', pick(['...kzzt... tickets, please... ah, a living passenger...', 'This car was retired in 1931. I was not.', 'Mind the gap. It is rather wider for me.']), [
    { label: 'Browse the lost & found', value: 'shop' },
    { label: 'Who are you?', value: 'who' },
    { label: 'Goodbye', value: 'bye' },
  ], { cancel: 'bye' });
  if (c === 'shop') { talk.end(); openShop('ghost', { onBought }); return; }
  if (c === 'who') {
    await talk.say('static', 'I ran the last car on the old line. One night the line closed and the car... kept going. So did I.');
    await talk.say('static', 'I sell what passengers left behind. Spectral goods. You can see right through them. Very fashionable.');
    return;
  }
  if (c != null) await talk.say('static', '...kzzt... all aboard who’s going aboard...');
}

async function lockbox() {
  const r = E.openLockbox();
  if (!r) {
    await talk.say('narrator', 'The lockbox is empty. Something refills it every night.');
    return;
  }
  audio.coin(true);
  await talk.say('narrator', `The lockbox clicks open: *${r.tokens} tokens*${r.item ? ` and the *${r.item.item.name}*` : ''}. Something refills it every night.`);
}

// ---------------------------------------------------------------- minigames

function gameCtx() {
  return {
    econ: E, audio, hud,
    body: E.S.profile ? E.S.profile.body : null,
    outfit: E.outfitOf(),
    name: E.S.profile?.name || 'YOU',
    onTagImage: (url) => { E.S.tagImage = url; E.commit(); loadTagImage(url); },
  };
}

// ---------------------------------------------------------------- loop

function frame(dt, t) {
  G.t = t;
  Eng.beginFrame(dt);
  Eng.pollGamepad();
  E.ensureDay();
  if (canAct()) {
    if (pressed('act')) interact(ride.def.npc ? 'npc' : (ride.L.hotspots[0] || {}).id);
    if (pressed('right') || pressed('up')) goNext();
    if (pressed('left') || pressed('down')) goBack();
    if (pressed('map')) openTrainMap();
    if (pressed('bag')) openCloset();
    if (pressed('stash')) openMe();
  } else if (pressed('back') && anyOverlay()) closeOverlay();
  ride.render(dt, t);
  drawScreenFx(ctx, t, ride.car === 'ghost' ? { tint: 'rgba(4,30,26,0.6)' } : {});
  hud.updateHud(dt);
  talk.update(dt);
}

// keyboard: Escape closes the top panel even while the world is blocked
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && anyOverlay() && !talk.open) {
    const top = topOverlay();
    if (top && top.opts.dismissable !== false) closeOverlay();
  }
  if (e.code === 'KeyC' && canAct()) openCloset();
});

boot();
