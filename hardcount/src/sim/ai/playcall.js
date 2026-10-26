// The CPU's head coach: play calls for both sides of the ball, fourth downs,
// tries after touchdowns, kickoffs (onside when it's desperate), the hurry-up,
// spikes and kneel-downs. Situational, with the team's style as the bias, and
// it doesn't run the same play three times in a row.
import { OFFENSE } from '../plays/offense.js';
import { DEFENSE } from '../plays/defense.js';
import { maxRange } from '../passing.js';

const R99 = (v) => (v ?? 50) / 99;
const other = (s) => (s === 'home' ? 'away' : 'home');

function weighted(rng, items) {
  let tot = 0;
  for (const [, w] of items) tot += Math.max(0, w);
  let r = rng() * tot;
  for (const [it, w] of items) { r -= Math.max(0, w); if (r <= 0) return it; }
  return items[items.length - 1][0];
}

export function situation(m, side = m.offSide) {
  const F = m.field;
  const dir = m.dirOf(side);
  const toGoal = F.toGoal(m.los, dir);
  const diff = m.score[side] - m.score[other(side)];
  const late = m.quarter >= 4 && m.clock < 180;
  const half2min = (m.quarter === 2 || m.quarter >= 4) && m.clock < 120;
  return { toGoal, diff, late, half2min, down: m.down, toGo: m.toGo, q: m.quarter, clock: m.clock };
}

/** Kicker's honest range, in yards to the uprights. */
export function fgRange(m, side) {
  const k = m.rosters[side].depth.K[0];
  return 30 + R99(k.r.kpw) * 26;
}

export function cpuCalls(m) {
  const n = m.callNeeds();
  if (!n) return {};
  if (n.kind === 'kickoff') return { off: kickoffCall(m), def: returnCall(m) };
  if (n.kind === 'pat') return { pat: patCall(m) };
  const off = offenseCall(m);
  return { off, def: specialDefenseFor(m, off) || defenseCall(m), flip: m.rng() < 0.5 };
}

/** The CPU defense's answer once it knows what the offense lined up in. */
export function cpuDefenseFor(m, offId) { return specialDefenseFor(m, offId) || defenseCall(m); }

function kickoffCall(m) {
  const s = situation(m, m.offSide);
  if (s.late && s.diff < 0 && s.diff >= -16 && m.clock < 150) return 'ko_onside';
  if (m.safetyKick) return 'ko_deep';
  return m.rng() < 0.85 ? 'ko_deep' : m.rng() < 0.5 ? 'ko_squib' : 'ko_pooch';
}

function returnCall(m) {
  const s = situation(m, m.offSide);
  if (s.late && s.diff < 0 && s.diff >= -16 && m.clock < 150) return 'kr_hands';
  return weighted(m.rng, [['kr_middle', 4], ['kr_left', 2], ['kr_right', 2], ['kr_reverse', 0.4], ['kr_throwback', 0.25]]);
}

export function patCall(m) {
  const side = m.offSide;
  const diff = m.score[side] - m.score[other(side)];   // already includes the six
  const late = m.quarter >= 4 && m.clock < 360;
  const style = m.teams[side].style?.offense;
  if (late && [-2, -5, -10, 1, 5, -9, 12].includes(diff)) return 'two';
  if (late && diff === -1) return m.rng() < 0.35 ? 'two' : 'kick';
  if (style === 'airraid' && m.rng() < 0.12) return 'two';
  return 'kick';
}

export function offenseCall(m) {
  const side = m.offSide;
  const s = situation(m, side);
  const team = m.teams[side];
  const style = team.style?.offense || 'balanced';
  // ---- the clock
  if (s.late && s.diff > 0 && m.clockRunning) {
    const playsLeft = 5 - m.down;
    if (m.clock < playsLeft * (m.settings.accelClock ? 22 : 40)) return 'ck_kneel';
  }
  if (s.half2min && s.diff <= 0 && m.clockRunning && m.clock < 25 && m.timeouts[side] === 0 && m.down < 4 && s.toGoal < 45) return 'ck_spike';
  m.hurry[side] = s.half2min && (s.diff <= 0 || m.quarter === 2);
  // ---- the try (two-point conversion)
  if (m.tryMode === 'two') return pickPlay(m, side, (p) => p.tags.includes('2pt') || p.tags.includes('goal') || p.tags.includes('short'), style);
  // ---- fourth down
  if (s.down === 4) {
    const kickDist = s.toGoal + 17;
    const range = fgRange(m, side);
    const needTd = s.late && s.diff < -3;
    const goShort = s.toGo <= 1.5 && (s.toGoal < 45 || (s.late && s.diff < 0));
    if (needTd || (s.late && s.diff < 0 && m.clock < 90 && kickDist > range)) return pickPlay(m, side, (p) => s.toGo <= 3 ? p.tags.includes('short') : p.kind === 'pass', style);
    if (goShort && m.rng() < 0.6) return pickPlay(m, side, (p) => p.tags.includes('short') || p.tags.includes('sneak'), style);
    if (kickDist <= range) return 'fg_kick';
    if (s.toGoal > 30) return m.rng() < 0.03 ? (m.rng() < 0.5 ? 'pt_fakepass' : 'pt_fakerun') : 'pt_normal';
    return pickPlay(m, side, (p) => s.toGo <= 3 ? p.tags.includes('short') : p.kind === 'pass', style);
  }
  // ---- normal downs
  const w = { run: 1.1, short: 1, mid: 1, deep: 0.55, screen: 0.35, trick: 0.06, pa: 0.4, option: 0.3, lateral: 0.12 };
  if (s.toGo <= 2) { w.run += 1.6; w.short += 0.6; w.deep *= 0.5; }
  if (s.toGo >= 10) { w.mid += 0.8; w.deep += 0.6; w.screen += 0.4; w.run *= 0.6; }
  if (s.down === 1) { w.run += 0.4; w.pa += 0.4; w.trick += 0.03; }
  if (s.down === 3) { w.run *= s.toGo <= 3 ? 1 : 0.35; w.short += 0.5; w.mid += 0.6; }
  if (s.toGoal < 12) { w.deep *= 0.15; w.short += 0.7; w.run += 0.5; w.goal = 1.2; }
  if (s.half2min && s.diff <= 0) { w.run *= 0.25; w.mid += 1; w.deep += 0.7; w.short += 0.4; w.screen *= 0.5; }
  if (s.late && s.diff > 0) { w.run += 2; w.deep *= 0.2; }
  if (s.late && s.diff < -8) { w.deep += 1; w.trick += 0.2; w.lateral += 0.4; }
  if (m.quarter >= 4 && m.clock < 8 && s.diff < 0 && s.diff >= -8) {
    // last snap: hail mary from long range, a lateral play from closer
    if (s.toGoal > 38) return 'em_hail';
    if (s.toGoal > 18 && m.rng() < 0.5) return m.rng() < 0.5 ? 'tr_ladder' : 'wb_rugby';
  }
  const mul = {
    spread: { short: 1.2, mid: 1.2, screen: 1.3, option: 1.3 },
    airraid: { mid: 1.5, deep: 1.6, run: 0.55, short: 1.2 },
    option: { run: 1.5, option: 4, pa: 1.5, short: 0.7 },
    power: { run: 1.8, pa: 1.5, deep: 0.8, option: 0.6 },
    balanced: {},
  }[style] || {};
  for (const k of Object.keys(mul)) w[k] = (w[k] || 0) * mul[k];
  const tag = weighted(m.rng, Object.entries(w));
  return pickPlay(m, side, (p) => p.tags.includes(tag) || (tag === 'goal' && p.tags.includes('goal')), style);
}

function pickPlay(m, side, filter, style) {
  const recent = (m.recentCalls ||= { home: [], away: [] })[side];
  let pool = OFFENSE.filter((p) => p.kind !== 'kneel' && p.kind !== 'spike' && filter(p));
  // hail marys only when asked for
  pool = pool.filter((p) => !p.tags.includes('hail'));
  if (!pool.length) pool = OFFENSE.filter((p) => p.kind === 'pass' && !p.tags.includes('hail'));
  // style: option teams live in the flexbone, air raid in the gun
  const items = pool.map((p) => {
    let w = 1;
    if (recent.includes(p.id)) w *= recent[recent.length - 1] === p.id ? 0.05 : 0.4;
    if (style === 'option' && (p.form === 'flexbone' || p.form === 'wishbone' || p.kind === 'option')) w *= 2.2;
    if (style === 'airraid' && p.form.startsWith('gun')) w *= 1.6;
    if (style === 'power' && (p.form === 'i_form' || p.form === 'pistol' || p.form === 'goal_line')) w *= 1.8;
    if (p.kind === 'trick') w *= 0.5;
    return [p, w];
  });
  const p = weighted(m.rng, items);
  recent.push(p.id);
  if (recent.length > 4) recent.shift();
  return p.id;
}

export function defenseCall(m) {
  const side = m.defSide;
  const s = situation(m, m.offSide);
  const team = m.teams[side];
  const style = team.style?.defense || 'balanced';
  if (m.tryMode === 'two') return weighted(m.rng, [['goal', 3], ['c0', 1.5], ['c1press', 2], ['bear', 1]]);
  const w = {};
  for (const d of DEFENSE) w[d.id] = 1;
  if (s.toGo <= 2) { w.goal += s.toGoal < 5 ? 4 : 0.5; w.bear += 2; w.c0 += 1; w.c1press += 1.5; w.prevent = 0; w.c4 *= 0.3; w.dime_c3 *= 0.3; }
  if (s.toGo >= 8) { w.c3 += 1.2; w.c2 += 1; w.tampa += 1; w.c4 += 1; w.dime_c3 += 1; w.bear *= 0.3; w.goal = 0; }
  if (s.down === 3 && s.toGo >= 5) { w.c0 += 0.6; w.firezone += 0.8; w.cblitz += 0.6; w.sblitz += 0.6; w.mike += 0.5; }
  if (s.toGoal < 6) { w.goal += 3; w.bear += 1; w.prevent = 0; w.c4 = 0.2; }
  if (s.toGoal > 25) w.goal = 0;
  if (s.half2min && s.diff < 0 === false && m.score[side] > m.score[m.offSide]) { w.prevent += m.clock < 40 ? 4 : 1.5; w.c4 += 1; w.c0 *= 0.3; }
  else w.prevent *= 0.15;
  if (m.quarter >= 4 && m.clock < 8 && s.toGoal > 38) return 'prevent';
  const mul = { blitz: { c0: 2.5, firezone: 2, cblitz: 2, sblitz: 2, mike: 2 }, zone: { c3: 2, c2: 2, tampa: 2, c4: 1.8 }, man: { c1: 2.2, c1press: 2.2, spy: 1.5 }, balanced: {} }[style] || {};
  for (const k of Object.keys(mul)) w[k] *= mul[k];
  const recent = (m.recentDef ||= { home: [], away: [] })[side];
  for (const id of recent) w[id] *= 0.5;
  const id = weighted(m.rng, Object.entries(w));
  recent.push(id); if (recent.length > 3) recent.shift();
  return id;
}

/** Special-teams defense for the kicking plays the CPU's opponent might call. */
export function specialDefenseFor(m, offId) {
  if (offId === 'pt_normal' || offId === 'pt_coffin' || offId === 'pt_fakepass' || offId === 'pt_fakerun') {
    const s = situation(m, m.offSide);
    return s.late && m.score[m.defSide] < m.score[m.offSide] ? 'pr_block' : m.rng() < 0.15 ? 'pr_block' : 'pr_return';
  }
  if (offId.startsWith('fg_')) return m.rng() < 0.7 ? 'fgd_block' : 'fgd_safe';
  return null;
}

export { maxRange };
