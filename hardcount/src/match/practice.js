// Practice inside the match engine. A drill decides where the ball goes after
// every rep, keeps the clipboard (what counts, the last few reps, the coach's
// two cents) and knows when a drill with an ending — the field goal ladder,
// the two-minute drill — is over. The match screen asks it at the seams of
// its loop: onSnap, after the sim applies a play's result, and when it draws.
import { text, vText, hints, panel, C } from '../core/ui.js';
import { store } from '../core/settings.js';
import { clamp } from '../core/util.js';
import { glossBar, shadeHex, lum, fmtClock } from './hud.js';
import { drawLogo } from '../gfx/logos.js';

const other = (s) => (s === 'home' ? 'away' : 'home');

export const DRILLS = [
  { id: 'offense', name: 'OFFENSE REPS', desc: 'First and ten from your own 25, every snap. Call anything in the book against the scout defense, then run it again.' },
  { id: 'defense', name: 'DEFENSE REPS', desc: 'The scout offense runs its plays at you from its own 25. Call the coverage, take a man, and get off the field.' },
  { id: 'twominute', name: 'TWO-MINUTE DRILL', desc: 'Down four, 2:00 to play, three timeouts and 80 yards to go. A field goal loses. Score a touchdown.' },
  { id: 'fg', name: 'FIELD GOAL LADDER', desc: 'Ten kicks from alternating hashes. Start at 25 yards; every make backs you up five. Aim, power, accuracy.' },
  { id: 'returns', name: 'KICK RETURNS', desc: 'Kick after kick to your return man. Pick the return, find the crease, make the cover team miss.' },
];
export const DRILL_NAME = Object.fromEntries(DRILLS.map((d) => [d.id, d.name]));

const FG_KICKS = 10, FG_START = 25, FG_STEP = 5;
const MIN_REPS = 5;     // reps before a session counts toward the bests

// ------------------------------------------------------------------ the bests
export function loadBests() { return store.load('practiceBests') || {}; }

/** One line for the practice clipboard: the best session on file. */
export function bestLine(id, bests = loadBests()) {
  const b = bests[id];
  if (!b) return 'NOTHING ON FILE YET';
  switch (id) {
    case 'offense': return `BEST SESSION: ${b.avg.toFixed(1)} YDS A SNAP (${b.reps} REPS) · LONG ${b.long}`;
    case 'defense': return `BEST SESSION: ${b.avg.toFixed(1)} YDS ALLOWED A SNAP (${b.reps} REPS) · ${b.takeaways} TAKEAWAYS`;
    case 'twominute': return `DRIVES WON: ${b.wins} OF ${b.tries}${b.bestLeft !== undefined ? ` · FASTEST WITH ${fmtClock(b.bestLeft)} LEFT` : ''}`;
    case 'fg': return `BEST LADDER: ${b.made} OF ${FG_KICKS} · LONGEST ${b.long} YDS`;
    case 'returns': return `BEST SESSION: ${b.avg.toFixed(1)} YDS A RETURN · LONG ${b.long}${b.td ? ` · ${b.td} TD` : ''}`;
    default: return '';
  }
}

// ------------------------------------------------------------------ what the coach says
const COACH = {
  td: ['THAT IS HOW YOU DO IT. AGAIN.', 'SIX! NOW DO IT TWICE.', "TOUCHDOWN. DON'T GET COMFORTABLE."],
  big: ['THERE IT IS! GOOD READ.', 'EXPLOSIVE. THAT PLAY IS IN THE PLAN.', "NOW YOU'RE MOVING THE BALL."],
  ok: ['GOOD. STAY ON SCHEDULE.', "THAT'LL WORK. NEXT.", 'POSITIVE YARDS. AGAIN.'],
  bad: ['RESET. RUN IT AGAIN.', 'WATCH THE TAPE ON THAT ONE.', 'NOT GOOD ENOUGH. AGAIN.'],
  inc: ['GET YOUR EYES THERE FASTER.', 'BALL HAS TO COME OUT ON TIME.', 'INCOMPLETE. AGAIN.'],
  sack: ['GET RID OF IT! THROW IT AWAY.', 'FEEL THE PRESSURE. STEP UP.', 'YOU HELD IT TOO LONG.'],
  to: ['PROTECT THE FOOTBALL!', 'TWO HANDS IN TRAFFIC.', 'THAT LOSES GAMES ON FRIDAY.'],
  stop: ['THAT IS A STOP. AGAIN.', 'GOOD FIT. RALLY TO THE BALL.', 'GET OFF THE FIELD! GOOD.'],
  gave: ['WHO HAD CONTAINMENT?', 'TACKLE THE BALL CARRIER!', 'TOO EASY. RUN IT BACK.'],
  take: ['BALL! THAT IS A TAKEAWAY!', "THAT'S WHAT WE WANT. TAKE IT AWAY.", 'GREAT EFFORT. TURNOVER!'],
  fgGood: ['MONEY. BACK IT UP.', 'GOOD STROKE. FIVE MORE YARDS.', 'SPLIT IT. NEXT ONE.'],
  fgMiss: ['HEAD DOWN. SAME KICK AGAIN.', 'SMOOTH, NOT HARD.', 'YOU PULLED IT. RESET.'],
  ret: ['HIT IT NORTH AND SOUTH.', 'TRUST YOUR BLOCKS.', 'SET UP THE WALL, THEN GO.'],
  retBig: ['THAT IS A FLIPPED FIELD!', 'GREAT VISION. AGAIN.', 'ALMOST! FINISH IT NEXT TIME.'],
  retTd: ['HOUSE CALL! DO IT AGAIN.', 'GONE! THAT IS THE RETURN.', 'NOBODY TOUCHED YOU!'],
};

// ------------------------------------------------------------------ the drill
export class Drill {
  constructor(id, user = 'home') {
    this.id = DRILL_NAME[id] ? id : 'offense';
    this.name = DRILL_NAME[this.id];
    this.user = user;
    this.them = other(user);
    this.reps = [];
    this.pending = null;
    this.over = null;
    this.ev = {};
    this.snapInfo = null;
    this.t = 0;
    this.coachN = 0;
    this.s = { reps: 0, yds: 0, long: 0, td: 0, to: 0, stops: 0, takeaways: 0, sacks: 0, inc: 0, scored: 0 };
    this.fg = { kick: 0, dist: FG_START, made: 0, long: 0 };
    this.retYds = 0;
    this.saved = false;
  }

  /** The first situation (the match has already been started). */
  start(m) {
    this.retYds = m.stats[this.user].returnYds || 0;
    if (this.id === 'twominute') {
      const F = m.field;
      m.flags = []; m.tryMode = null; m.result = null;
      m.quarter = 4; m.clock = 120; m.clockRunning = false;
      m.twoMin = { 2: true, 4: true };
      m.score = { [this.user]: 17, [this.them]: 21 };
      m.timeouts = { home: 3, away: 3 };
      m.newSeries(this.user, F.ownYardZ(m.dirOf(this.user), 20), 0);
      this.drive = { startClock: 120, startZ: m.los, plays: 0 };
      return;
    }
    this.reset(m);
  }

  /** Back to the drill's spot, a fresh clock, nobody keeping score. */
  reset(m) {
    const F = m.field;
    m.flags = []; m.pendingPenalty = null; m.penaltyChoice = undefined; m.tryMode = null; m.result = null;
    m.quarter = 1; m.clock = 15 * 60; m.clockRunning = false;
    m.twoMin = { 2: true, 4: true };
    m.score = { home: 0, away: 0 };
    m.timeouts = { home: 3, away: 3 };
    switch (this.id) {
      case 'offense': m.newSeries(this.user, F.ownYardZ(m.dirOf(this.user), 25), 0); break;
      case 'defense': m.newSeries(this.them, F.ownYardZ(m.dirOf(this.them), 25), 0); break;
      case 'returns': m.setupKickoff(this.them); break;
      case 'fg': {
        // posts on the end line, the hold seven back: a D-yard kick from the (D − 17)
        const dir = m.dirOf(this.user);
        const toGoal = this.fg.dist - F.EZ - 7;
        m.newSeries(this.user, (F.halfL - toGoal) * dir, [0, -F.hash, F.hash][this.fg.kick % 3]);
        break;
      }
      default: break;
    }
  }

  /** The calls the drill makes itself (null: ask the play-callers). */
  calls(m, cpu) {
    if (this.id === 'fg' && m.phase === 'playcall') return { off: 'fg_kick', def: 'fgd_safe', skipBand: true };
    if (this.id === 'returns' && m.phase === 'kickoff') {
      const r = m.rng();
      return { off: r < 0.78 ? 'ko_deep' : r < 0.9 ? 'ko_squib' : 'ko_pooch' };
    }
    void cpu;
    return null;
  }

  onSnap(m) {
    this.ev = {};
    this.snapInfo = { los: m.los, dir: m.offDir, play: m.play?.name || '', down: m.down, toGo: m.toGo, kind: m.playKind, clock: m.clock };
  }

  onEvent(ev) {
    if (ev.type === 'interception') this.ev.int = true;
    if (ev.type === 'fumble' && ev.c) this.ev.fumble = true;
    if (ev.type === 'penaltyAccepted') this.ev.flag = ev.flag;
  }

  /** A play's result was applied (the sim is on to its next phase). */
  settle(m, coach) {
    const r = this.pending;
    this.pending = null;
    if (!r) return;
    this.t = 0;
    if (this.id === 'twominute') return this.settleTwoMinute(m, r, coach);
    const line = this.record(m, r);
    if (line && coach) coach(line);
    if (this.id === 'fg' && this.fg.kick >= FG_KICKS) {
      this.over = { win: this.fg.made >= 6, title: this.fg.made >= 8 ? 'LIGHTS OUT' : this.fg.made >= 6 ? 'LADDER CLIMBED' : 'BACK TO THE NET', lines: [`${this.fg.made} OF ${FG_KICKS} MADE`, this.fg.long ? `LONGEST: ${this.fg.long} YARDS` : 'NO MAKES'] };
      this.saveBest();
      return;
    }
    this.reset(m);
  }

  pick(kind) { const l = COACH[kind]; return l[(this.coachN++) % l.length]; }

  /** Write the rep on the clipboard. Returns what the coach says about it. */
  record(m, r) {
    const F = m.field, S = this.s;
    const si = this.snapInfo || { los: m.los, dir: m.offDir, play: '' };
    const flag = this.ev.flag;
    const fumble = this.ev.fumble, int = this.ev.int;
    this.snapInfo = null;
    // ---- the field goal ladder
    if (this.id === 'fg') {
      const made = r.type === 'fgGood';
      this.reps.push({ name: `${this.fg.dist} YARDS`, res: made ? 'GOOD' : r.type === 'fgMiss' ? 'NO GOOD' : 'BLOCKED', good: made });
      this.fg.kick++;
      if (made) { this.fg.made++; this.fg.long = Math.max(this.fg.long, this.fg.dist); this.fg.dist += FG_STEP; }
      return this.pick(made ? 'fgGood' : 'fgMiss');
    }
    // ---- kick returns
    if (this.id === 'returns') {
      S.reps++;
      const ret = (m.stats[this.user].returnYds || 0) - this.retYds;
      this.retYds = m.stats[this.user].returnYds || 0;
      if (r.type === 'touchback') { this.reps.push({ name: 'TOUCHBACK', res: `OWN ${F.touchbackYard}`, good: null }); S.reps--; return null; }
      if (r.type === 'kickOob') { this.reps.push({ name: 'KICK OUT OF BOUNDS', res: 'OWN 30', good: null }); S.reps--; return null; }
      if (r.type === 'td' && r.side === this.user) {
        const y = ret > 0 ? ret : F.L;
        S.td++; S.yds += y; S.long = Math.max(S.long, y);
        this.reps.push({ name: 'RETURN', res: 'TOUCHDOWN', good: true });
        return this.pick('retTd');
      }
      if (r.side !== this.user) { this.reps.push({ name: 'RETURN', res: fumble ? 'FUMBLED' : 'KICKERS BALL', good: false }); S.to++; return this.pick('to'); }
      const own = Math.round(F.L - F.toGoal(r.z, m.dirOf(this.user)));
      S.yds += ret; S.long = Math.max(S.long, ret);
      this.reps.push({ name: `${ret} YDS`, res: own >= F.L / 2 ? `OPP ${F.L - own}` : `OWN ${own}`, good: own >= 30 });
      return this.pick(ret >= 30 ? 'retBig' : 'ret');
    }
    // ---- a scrimmage rep (offense or defense)
    S.reps++;
    const name = si.play || m.play?.name || '';
    const toGoal = Math.round(F.toGoal(si.los, si.dir));
    const yds = r.type === 'incomplete' ? 0 : clamp(Math.round((r.z - si.los) * si.dir), -99, toGoal);
    const mine = this.id === 'offense';
    let res, good, say;
    if (flag) {
      S.reps--;
      res = 'FLAG'; good = null; say = 'FLAG ON THE PLAY. RUN IT AGAIN.';
    } else if (r.side !== r.offense) {
      res = int ? 'INTERCEPTED' : fumble ? 'FUMBLE LOST' : 'TURNOVER';
      if (mine) { S.to++; good = false; say = this.pick('to'); } else { S.takeaways++; good = true; say = this.pick('take'); }
    } else if (r.kind === 'fg' || r.kind === 'punt') {
      S.reps--;
      res = r.kind === 'punt' ? 'PUNT' : r.type === 'fgGood' ? 'FG GOOD' : 'FG NO GOOD';
      good = null; say = null;
    } else if (r.type === 'td') {
      S.td++; S.yds += yds; S.long = Math.max(S.long, yds);
      res = `TD ${yds}`;
      good = mine; say = this.pick(mine ? 'td' : 'gave');
    } else if (r.type === 'incomplete') {
      S.inc++;
      res = 'INCOMPLETE';
      good = !mine; say = this.pick(mine ? 'inc' : 'stop');
    } else {
      S.yds += yds; S.long = Math.max(S.long, yds);
      if (r.sack) S.sacks++;
      res = r.sack ? `SACK ${yds}` : yds > 0 ? `+${yds}` : yds === 0 ? 'NO GAIN' : `${yds}`;
      if (mine) { good = yds >= 4; say = this.pick(r.sack ? 'sack' : yds >= 15 ? 'big' : yds >= 4 ? 'ok' : 'bad'); }
      else { good = yds <= 3; if (good) S.stops++; say = this.pick(good ? 'stop' : 'gave'); }
    }
    if (!mine && (r.type === 'incomplete' || r.side !== r.offense) && !flag) S.stops++;
    this.reps.push({ name, res, good });
    return say;
  }

  settleTwoMinute(m, r, coach) {
    const u = this.user, F = m.field;
    const si = this.snapInfo;
    this.snapInfo = null;
    if (si && r) {
      this.drive.plays++;
      const yds = r.type === 'incomplete' ? 0 : Math.round((r.z - si.los) * si.dir);
      const res = r.side !== r.offense ? (this.ev.int ? 'INTERCEPTED' : 'TURNOVER') : r.type === 'td' ? 'TOUCHDOWN' : r.type === 'incomplete' ? 'INCOMPLETE' : r.type === 'fgGood' ? 'FG GOOD' : r.sack ? `SACK ${yds}` : yds > 0 ? `+${yds}` : yds === 0 ? 'NO GAIN' : `${yds}`;
      this.reps.push({ name: si.play, res, good: r.side === r.offense && (r.type === 'td' || yds >= 5), sub: fmtClock(si.clock) });
    }
    if (m.score[u] > m.score[this.them]) {
      const left = Math.max(0, m.clock);
      this.over = { win: true, title: 'TOUCHDOWN! DRILL WON', lines: [`${m.teams[u].abbr} ${m.score[u]}  ${m.teams[this.them].abbr} ${m.score[this.them]}`, `${this.drive.plays} PLAYS · ${Math.round(F.toGoal(this.drive.startZ, m.dirOf(u)))} YARDS · ${fmtClock(left)} LEFT`, `${m.timeouts[u]} TIMEOUT${m.timeouts[u] === 1 ? '' : 'S'} TO SPARE`], left };
      if (coach) coach('THAT IS A WINNING DRIVE. HUSTLE OFF THE FIELD.');
      this.saveBest();
      return;
    }
    const lost = (why) => {
      this.over = { win: false, title: why, lines: [`${m.teams[u].abbr} ${m.score[u]}  ${m.teams[this.them].abbr} ${m.score[this.them]}`, `${this.drive.plays} PLAYS · ${fmtClock(Math.max(0, m.clock))} LEFT`] };
      this.saveBest();
    };
    if (m.phase === 'final') return lost('TIME RAN OUT');
    if (r && r.type === 'fgGood') return lost("A FIELD GOAL WON'T DO IT");
    if (r && r.type === 'safety') return lost('SAFETY');
    if (r && r.side !== r.offense && r.offense === u) return lost(this.ev.int ? 'INTERCEPTED' : 'TURNOVER');
    if (m.possession !== u || m.phase === 'kickoff') return lost('TURNOVER ON DOWNS');
  }

  /** The clock ran out between plays (the runoff took the rest of it). */
  timeUp(m) {
    if (this.over) return;
    this.pending = null;
    this.settleTwoMinute(m, null, null);
    if (!this.over) this.over = { win: false, title: 'TIME RAN OUT', lines: [] };
  }

  saveBest() {
    if (this.saved) return;
    const bests = loadBests();
    const S = this.s;
    const b = bests[this.id];
    switch (this.id) {
      case 'offense': case 'defense': case 'returns': {
        if (S.reps < MIN_REPS) return;
        const avg = S.yds / S.reps;
        const better = !b || (this.id === 'defense' ? avg < b.avg : avg > b.avg);
        if (better) bests[this.id] = { reps: S.reps, avg, long: S.long, td: S.td, takeaways: S.takeaways };
        break;
      }
      case 'fg':
        if (!b || this.fg.made > b.made || (this.fg.made === b.made && this.fg.long > b.long)) bests.fg = { made: this.fg.made, long: this.fg.long };
        break;
      case 'twominute': {
        const o = { tries: (b?.tries || 0) + 1, wins: (b?.wins || 0) + (this.over?.win ? 1 : 0), bestLeft: b?.bestLeft };
        if (this.over?.win && (o.bestLeft === undefined || this.over.left > o.bestLeft)) o.bestLeft = this.over.left;
        bests.twominute = o;
        break;
      }
      default: break;
    }
    this.saved = true;
    store.save('practiceBests', bests);
  }

  // ---------------------------------------------------------------- the clipboard on screen
  /** The practice bug: where the score bug would be. */
  drawBug(ctx, m) {
    const team = m.teams[this.user];
    const S = this.s;
    let chips;
    switch (this.id) {
      case 'fg': chips = [['KICK', `${Math.min(this.fg.kick + 1, FG_KICKS)}/${FG_KICKS}`], ['DISTANCE', `${this.fg.dist}`], ['MADE', `${this.fg.made}`], ['LONG', this.fg.long ? `${this.fg.long}` : '-']]; break;
      case 'returns': chips = [['RETURNS', `${S.reps}`], ['AVG', S.reps ? (S.yds / S.reps).toFixed(1) : '-'], ['LONG', `${S.long}`], ['TD', `${S.td}`]]; break;
      case 'defense': chips = [['SNAPS', `${S.reps}`], ['ALLOWED', S.reps ? (S.yds / S.reps).toFixed(1) : '-'], ['STOPS', `${S.stops}`], ['TAKEAWAYS', `${S.takeaways}`]]; break;
      default: chips = [['SNAPS', `${S.reps}`], ['AVG', S.reps ? (S.yds / S.reps).toFixed(1) : '-'], ['LONG', `${S.long}`], ['TD', `${S.td}`], ['TO', `${S.to}`]]; break;
    }
    const chipW = 84, slabW = 196, nameW = 214;
    const W = slabW + nameW + chips.length * chipW;
    let x = Math.round(512 - W / 2);
    const y = 690, H = 40;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(x + 4, y + 5, W, H);
    const col = team.colors.primary;
    glossBar(ctx, x, y, slabW, H, shadeHex(col, 0.18), shadeHex(col, -0.35));
    ctx.save();
    ctx.beginPath(); ctx.rect(x + 1, y + 1, slabW - 2, H - 2); ctx.clip();
    try { drawLogo(ctx, team, x + 22, y + H / 2, 34); } catch { /* */ }
    ctx.restore();
    const light = lum(col) > 0.62;
    vText(ctx, 'PRACTICE', x + 46, y + 28, 19, { color: light ? '#10131a' : '#ffffff', outline: light ? 0 : 2.5, outlineColor: 'rgba(0,0,0,0.6)', weight: 0.2 });
    x += slabW;
    glossBar(ctx, x, y, nameW, H, '#f1ead2', '#c9bf9a');
    vText(ctx, this.name, x + nameW / 2, y + 27, this.name.length > 14 ? 15 : 17, { align: 'center', color: '#1c1a12', weight: 0.2 });
    x += nameW;
    for (const [k, v] of chips) {
      glossBar(ctx, x, y, chipW, H, '#2b3346', '#0a0d15');
      text(ctx, k, x + chipW / 2, y + 13, { size: 9, weight: 900, color: '#ffd23a', align: 'center', spacing: 1, shadow: false });
      vText(ctx, v, x + chipW / 2, y + 34, 18, { align: 'center', color: '#ffffff', weight: 0.18 });
      x += chipW;
    }
    ctx.restore();
  }

  /** The last few reps, written down the side of the clipboard. */
  drawLog(ctx, m) {
    const list = this.reps.slice(-6);
    if (!list.length) return;
    const x = 742, w = 240;
    let y = 60;
    ctx.save();
    glossBar(ctx, x, y, w, 26, '#f1ead2', '#c9bf9a');
    text(ctx, this.id === 'twominute' ? 'THE DRIVE' : this.id === 'fg' ? 'THE KICKS' : 'LAST REPS', x + 12, y + 18, { size: 12, weight: 900, color: '#1c1a12', spacing: 2, shadow: false });
    text(ctx, `${this.id === 'twominute' ? this.drive.plays : this.reps.length}`, x + w - 12, y + 18, { size: 12, weight: 900, color: '#6a5a2a', align: 'right', shadow: false });
    y += 26;
    const start = this.reps.length - list.length;
    list.forEach((r, i) => {
      const fresh = i === list.length - 1 && this.t < 1.2;
      ctx.fillStyle = fresh ? 'rgba(60,52,20,0.92)' : 'rgba(8,10,16,0.78)';
      ctx.fillRect(x, y, w, 24);
      text(ctx, `${start + i + 1}`, x + 10, y + 17, { size: 11, weight: 900, color: '#8a93a6', shadow: false });
      const nm = r.name.length > 17 ? `${r.name.slice(0, 16)}.` : r.name;
      text(ctx, nm, x + 32, y + 17, { size: 12, weight: 800, color: '#e6ebf5', shadow: false });
      const col = r.good === true ? '#7dff9a' : r.good === false ? '#ff8a8a' : '#ffd23a';
      text(ctx, r.res.length > 14 ? `${r.res.slice(0, 13)}.` : r.res, x + w - 10, y + 17, { size: 12, weight: 900, color: col, align: 'right', shadow: false });
      y += 25;
    });
    ctx.restore();
    void m;
  }

  /** The top line under the clipboard in the huddle: what this rep is. */
  huddleLine(m) {
    if (this.id === 'fg') return `KICK ${Math.min(this.fg.kick + 1, FG_KICKS)} OF ${FG_KICKS}: ${this.fg.dist} YARDS`;
    if (this.id === 'twominute') return `NEED A TOUCHDOWN · ${fmtClock(m.clock)} LEFT · ${m.timeouts[this.user]} TIMEOUTS`;
    return null;
  }

  drawOver(ctx) {
    const o = this.over;
    if (!o) return;
    ctx.save();
    ctx.fillStyle = 'rgba(2,4,8,0.5)';
    ctx.fillRect(0, 0, 1024, 768);
    panel(ctx, 262, 214, 500, 290, { accent: o.win ? '#7dff9a' : C.red, accentLen: 300 });
    text(ctx, this.name, 300, 258, { size: 14, weight: 900, color: C.dim, spacing: 3 });
    vText(ctx, o.title, 300, 304, o.title.length > 18 ? 26 : 34, { color: o.win ? '#ffd23a' : '#ffffff', weight: 0.2 });
    o.lines.forEach((l, i) => text(ctx, l, 300, 350 + i * 28, { size: 17, weight: 800, color: '#e6ebf5', spacing: 1 }));
    text(ctx, bestLine(this.id), 300, 470, { size: 12, weight: 900, color: '#8fd0ff', spacing: 1 });
    ctx.restore();
    hints(ctx, [['confirm', 'RUN IT AGAIN'], ['back', 'PRACTICE MENU']]);
  }
}
