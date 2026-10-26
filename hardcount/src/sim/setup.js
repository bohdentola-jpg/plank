// Putting a play on the field: who's in, where they line up, what they do.
//
// Play space (formations.js) → world: x = ballX − px·dir·flip, z = los + pz·dir.
// "Flip" mirrors the play (run it to the left).
import { FORMATIONS, PERSONNEL, DEF_FORMATIONS, DEF_PERSONNEL } from './plays/formations.js';
import { ROUTES } from './plays/routes.js';
import { SCRIPT_ROUTES } from './plays/offense.js';
import { KICKOFF_ALIGN, RETURN_ALIGN } from './plays/special.js';
import { clamp, headingOf } from './math.js';
import { qbSetup } from './ai/offense.js';

export function toWorld(m, px, pz, flip = 1) {
  return { x: m.ballX - px * m.offDir * flip, z: m.los + pz * m.offDir };
}

/** The player for a personnel slot (skips anyone already used this play). */
function pick(m, side, slot, used) {
  const depth = m.rosters[side].depth;
  const [pos, idx] = slot;
  const list = depth[pos] || [];
  let p = list[idx] || list[list.length - 1];
  if (p && used.has(p.id)) p = list.find((q) => !used.has(q.id));
  if (!p) {
    // fall back to any skill player not on the field
    const pool = ['WR', 'RB', 'TE', 'QB', 'LB', 'S', 'CB'].flatMap((k) => depth[k] || []);
    p = pool.find((q) => !used.has(q.id));
  }
  used.add(p.id);
  return p;
}

const BASE_FOR = {
  C: 'center', LG: 'stance3', RG: 'stance3', FB: 'stance3', TE: 'stance3',
  X: 'stance2', Z: 'stance2', SL: 'stance2', WB: 'stance2', RB: 'ready', HB: 'ready',
};

/** Line up the offense for play `play` (offense.js / special.js entry). */
export function placeOffense(m, play, flip) {
  const side = m.offSide;
  const form = FORMATIONS[play.form] || FORMATIONS.gun_spread;
  const used = new Set();
  const ents = [];
  const fl = flip ? -1 : 1;
  const F = m.field;
  for (const [role, [px, pz]] of Object.entries(form.roles)) {
    const slot = PERSONNEL[role];
    // the locked career player always plays his position if this formation has it
    let p = null;
    const lock = m.lock;
    if (lock && lock.side === side && !used.has(lock.player.id) && lockFits(lock.player, role)) p = lock.player;
    if (!p) p = pick(m, side, slot, used); else used.add(p.id);
    const e = m.entFor(side, p);
    e.reset();
    e.role = role;
    const w = toWorld(m, px, pz, fl);
    w.x = clamp(w.x, -F.halfW + 1.5, F.halfW - 1.5);
    e.x = w.x; e.z = w.z;
    e.heading = headingOf(0, m.offDir);
    e.base = BASE_FOR[role] || 'ready';
    if (role === 'QB') e.base = form.qb === 'under' ? 'qbUnder' : form.qb === 'wide' ? 'stance2' : 'qbGun';
    if (role === 'P' || role === 'K') e.base = 'kick_ready';
    if (role === 'H') e.base = 'kneel';
    if (form.qb === 'direct' && role === 'RB') e.base = 'qbGun';
    if (form.qb === 'direct' && role === 'QB') e.base = 'stance2';
    e.mem.px = px * fl; e.mem.pz = pz;
    e.mem.carrySide = (px * fl) * m.offDir > 0 ? 'L' : 'R';
    ents.push(e);
  }
  return { form, ents };
}

function lockFits(p, role) {
  const want = PERSONNEL[role]?.[0];
  if (!want) return false;
  if (p.pos === want) return true;
  if (p.pos2 === want) return true;
  return false;
}

/** Each offensive player's job for this play. */
export function assignOffense(m, play, flip) {
  const fl = flip ? -1 : 1;
  const dir = m.offDir;
  const F = m.field;
  const routes = { ...(play.routes || {}) };
  const blocks = { ...(play.block || {}) };
  const run = play.run;
  for (const e of m.offense) {
    const role = e.role;
    e.mem.route = null; e.mem.routeIdx = 0; e.mem.settle = false; e.mem.routeDelay = 0; e.mem.routeSpeed = 0.95;
    if (role === 'C' || role === 'LG' || role === 'RG') {
      e.asg = { type: 'block', block: play.kind === 'screen' ? 'screen' : run || play.kind === 'qbrun' || play.kind === 'option' ? 'run' : 'pass' };
      if (run && (run.scheme === 'power' || run.scheme === 'counter' || run.scheme === 'sweep')) {
        // the backside guard pulls
        const side = (run.side || 1) * fl;
        const back = side > 0 ? 'LG' : 'RG';
        if (role === back) e.asg.pull = true;
      }
      if (play.kind === 'fake' && play.fake === 'pass') e.asg.block = 'pass';
      continue;
    }
    if (role === 'QB' && !(m.form.qb === 'direct')) {
      e.asg = { type: 'qb' };
      qbSetup(m, e);
      if (routes.QB) setRoute(m, e, routes.QB, fl);
      continue;
    }
    if (role === 'P' || role === 'K' || role === 'H') { e.asg = { type: 'special' }; continue; }
    // skill players
    const r = routes[role];
    const bk = blocks[role];
    if (run && run.carrier === role) { e.asg = { type: 'carrierDesignate' }; if (r) setRoute(m, e, r, fl); continue; }
    if (bk === 'pass') { e.asg = { type: 'block', block: 'pass' }; continue; }
    if (bk === 'lead' || bk === 'block') { e.asg = { type: 'block', block: bk === 'lead' ? 'lead' : 'run' }; continue; }
    if (bk === 'stalk' || r === 'stalk') { e.asg = { type: 'block', block: 'stalk' }; e.mem.blocking = true; continue; }
    if (r) {
      e.asg = { type: 'route' };
      setRoute(m, e, r, fl);
      if (bk === 'chip') { e.mem.routeDelay = 0.8; }
      continue;
    }
    // nothing listed: run plays → block; pass plays → check-down
    if (run || play.kind === 'qbrun') { e.asg = { type: 'block', block: 'stalk' }; e.mem.blocking = true; } else { e.asg = { type: 'route' }; setRoute(m, e, 'checkdown', fl); }
  }
  void dir; void F;
}

function setRoute(m, e, routeId, fl) {
  const R = ROUTES[routeId] || SCRIPT_ROUTES[routeId];
  if (!R) return;
  const F = m.field;
  // which way is "in" (toward the ball) for this man, in world x
  let inSign = Math.sign(m.ballX - e.x);
  const back = Math.abs(e.mem.px) < 2.6;
  if (back || SCRIPT_ROUTES[routeId]) {
    // backs (and scripted legs): "in" is away from the play side
    const side = (m.play.run?.side ?? m.play.option?.side ?? m.play.bootSide ?? 1) * fl;
    inSign = side * m.offDir;   // play-space right → world −x·dir, so "in" (away) = +side·dir
    if (!SCRIPT_ROUTES[routeId] && !m.play.run && !m.play.option) inSign = e.mem.px * m.offDir >= 0 ? 1 : -1;
  }
  if (!inSign) inSign = 1;
  e.mem.route = R.pts.map(([inYd, depth]) => ({
    x: clamp(e.x + inYd * inSign, -F.halfW + 0.9, F.halfW - 0.9),
    z: clamp(m.los + depth * m.offDir, -F.end + 0.5, F.end - 0.5),
  }));
  e.mem.routeId = routeId;
  e.mem.routeIdx = 0;
  e.mem.settle = !!R.settle;
  e.mem.routeDelay = R.delay || 0;
  e.mem.routeSpeed = R.speed || 0.96;
  e.mem.behind = !!R.behind;
  if (R.block) { e.mem.blocking = true; e.asg = { type: 'block', block: 'stalk' }; }
}

export function hotRoute(m, e, routeId) {
  setRoute(m, e, routeId, m.flip ? -1 : 1);
  e.asg = { type: 'route' };
  e.mem.blocking = false;
  e.mem.hot = routeId;
}

// ------------------------------------------------------------------ defense
/** Number the receivers from the sideline in, per side (offense's left/right). */
export function numberReceivers(m) {
  const elig = m.offense.filter((e) => !['C', 'LG', 'RG'].includes(e.role) && e.asg?.type !== 'qb');
  const left = [], right = [], backs = [];
  for (const e of elig) {
    const px = (m.ballX - e.x) * m.offDir;   // play-space x (right +)
    const back = Math.abs(px) < 2.6 && (e.z - m.los) * m.offDir < -2;
    if (back) backs.push(e);
    else if (px < 0) left.push(e); else right.push(e);
  }
  const keyL = (e) => (m.ballX - e.x) * m.offDir;  // more negative = further left
  left.sort((a, b) => keyL(a) - keyL(b));
  right.sort((a, b) => keyL(b) - keyL(a));
  return { L1: left[0], L2: left[1], L3: left[2], R1: right[0], R2: right[1], R3: right[2], B1: backs[0], B2: backs[1], left, right, backs, all: elig };
}

export function placeDefense(m, dplay) {
  const side = m.defSide;
  const form = DEF_FORMATIONS[dplay.form] || DEF_FORMATIONS.base;
  const used = new Set();
  const ents = [];
  const F = m.field;
  for (const role of Object.keys(DEF_PERSONNEL)) {
    let p = null;
    const lock = m.lock;
    if (lock && lock.side === side && !used.has(lock.player.id) && defLockFits(lock.player, role)) p = lock.player;
    if (!p) p = pick(m, side, DEF_PERSONNEL[role], used); else used.add(p.id);
    const e = m.entFor(side, p);
    e.reset();
    e.role = role;
    const [px, pz] = form[role];
    const w = toWorld(m, px, pz, 1);
    e.x = clamp(w.x, -F.halfW + 1, F.halfW - 1); e.z = w.z;
    e.heading = headingOf(0, -m.offDir);
    e.base = role.startsWith('DL') ? 'stance3' : 'ready';
    ents.push(e);
  }
  return ents;
}

function defLockFits(p, role) {
  const want = DEF_PERSONNEL[role]?.[0];
  return p.pos === want || p.pos2 === want;
}

/** Give every defender his job and line him up for it. */
export function assignDefense(m, dplay) {
  const nums = numberReceivers(m);
  const taken = new Set();
  const F = m.field;
  const dir = m.offDir;
  // pass 1: explicit man assignments
  const jobs = dplay.jobs;
  const autos = [];
  for (const e of m.defense) {
    const job = jobs[e.role] || { zone: 'hookM' };
    e.mem.facingQb = true;
    if (job.man && job.man !== 'auto') {
      const t = nums[job.man];
      if (t && !taken.has(t)) { taken.add(t); e.asg = { type: 'man', target: t, tech: job.tech || 'off', help: job.help, fallback: job.else?.zone }; e.mem.facingQb = false; continue; }
      if (job.else) { applyJob(m, e, job.else); continue; }
      autos.push(e); continue;
    }
    if (job.man === 'auto') { autos.push(e); continue; }
    applyJob(m, e, job);
  }
  // pass 2: whoever's left over goes to the 'auto' men
  for (const e of autos) {
    const left = nums.all.filter((r) => !taken.has(r));
    if (!left.length) { applyJob(m, e, jobs[e.role]?.else || { zone: 'hookM' }); continue; }
    left.sort((a, b) => Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z));
    taken.add(left[0]);
    e.asg = { type: 'man', target: left[0], tech: jobs[e.role]?.tech || 'off', fallback: jobs[e.role]?.else?.zone };
    e.mem.facingQb = false;
  }
  // nobody on a receiver at all? a free receiver must be picked up by the nearest zone man
  // line up on the assignments
  for (const e of m.defense) {
    const a = e.asg;
    if (a.type === 'man') {
      const t = a.target;
      const inSign = Math.sign(m.ballX - t.x) || 1;
      const depth = a.tech === 'press' ? 1.1 : t.mem.px !== undefined && Math.abs(t.mem.px) < 4 ? 4.5 : 6;
      e.x = clamp(t.x + inSign * 0.7, -F.halfW + 0.8, F.halfW - 0.8);
      e.z = m.los + dir * Math.max(depth, (t.z - m.los) * dir + depth * 0.6);
      if (e.role.startsWith('LB') && Math.abs(t.mem.px ?? 0) < 3) { e.z = m.los + dir * 4.5; e.x = t.x * 0.6 + m.ballX * 0.4; }
    } else if (a.type === 'rush') {
      const laneX = { A: 0.75, B: 2.1, C: 3.5, edge: 5.2, contain: 5.6 }[a.rush] ?? 2;
      const sideW = a.sideW;
      e.x = m.ballX + sideW * laneX;
      if (!e.role.startsWith('DL')) {
        // blitzers show it late: creep up from depth
        e.z = m.los + dir * (e.role.startsWith('LB') ? 3.8 : e.role === 'S' ? 7 : 3.5);
        if (e.role.startsWith('CB')) { e.x = m.ballX + sideW * Math.min(F.halfW - 2, 9); e.z = m.los + dir * 3; }
      } else e.z = m.los + dir * 0.85;
    } else if (a.type === 'zone') {
      // zone defenders line up near where their drop starts
      const fx = { CB1: -1, CB2: 1 }[e.role];
      if (fx) {
        const r = fx < 0 ? nums.L1 : nums.R1;
        if (r) { e.x = clamp(r.x + (Math.sign(m.ballX - r.x) || 1) * 1, -F.halfW + 1, F.halfW - 1); e.z = m.los + dir * 6.5; }
      }
    }
  }
}

function applyJob(m, e, job) {
  if (job.rush) {
    // side −1/+1 is the offense's left/right → world x
    const sideW = -(job.side ?? 1) * m.offDir;
    e.asg = { type: 'rush', rush: job.rush, sideW };
    e.base = e.role.startsWith('DL') ? 'stance3' : 'ready';
  } else if (job.zone) e.asg = { type: 'zone', zone: job.zone };
  else if (job.spy) e.asg = { type: 'spy' };
  else e.asg = { type: 'zone', zone: 'hookM' };
}

// ------------------------------------------------------------------ kickoffs
export function placeKickoff(m, kickSide, recvSide) {
  const F = m.field;
  const dir = m.offDir;   // the kicking team's direction
  const used = new Set();
  const kick = [], ret = [];
  const kd = m.rosters[kickSide].depth;
  // kicker + six coverage men (special teamers: backups first)
  const kPlayer = kd.K[0];
  used.add(kPlayer.id);
  const cover = [kd.LB[2], kd.S[1], kd.CB[2], kd.WR[3], kd.RB[1], kd.LB[1], kd.S[0], kd.TE[0]].filter(Boolean);
  const roles = ['L1', 'L2', 'L3', 'R3', 'R2', 'R1'];
  const kE = m.entFor(kickSide, kPlayer); kE.reset(); kE.role = 'K';
  const kp = toWorld(m, 0, KICKOFF_ALIGN.K[1]); kE.x = m.ballX; kE.z = kp.z;
  kE.heading = headingOf(0, dir); kE.base = 'kick_ready';
  kick.push(kE);
  roles.forEach((role, i) => {
    const p = cover.find((q) => !used.has(q.id)) || kd.WR[0];
    used.add(p.id);
    const e = m.entFor(kickSide, p); e.reset(); e.role = role;
    const [fx, pz] = KICKOFF_ALIGN[role];
    e.x = fx * (F.halfW - 2) * -dir; e.z = m.los + pz * dir;
    e.heading = headingOf(0, dir); e.base = 'ready';
    kick.push(e);
  });
  // the return team: the best return man deep, blockers in front
  const rd = m.rosters[recvSide].depth;
  const rUsed = new Set();
  const kr = m.lock?.side === recvSide && ['WR', 'RB', 'CB'].includes(m.lock.player.pos) && m.lockReturns ? m.lock.player : [rd.WR[2], rd.CB[2], rd.RB[1], rd.WR[0]].filter(Boolean).sort((a, b) => b.r.spd + b.r.elu - a.r.spd - a.r.elu)[0];
  rUsed.add(kr.id);
  const blockers = [rd.TE[0], rd.LB[1], rd.LB[2], rd.S[1], rd.RB[0], rd.WR[1], rd.G[2], rd.DL[2]].filter(Boolean);
  const kickYd = F.kickoffYard;
  const deep = F.L - kickYd - 3;   // the return man stands on his own 3
  for (const [role, [fx, pz]] of Object.entries(RETURN_ALIGN)) {
    const p = role === 'KR' ? kr : blockers.find((q) => !rUsed.has(q.id));
    rUsed.add(p.id);
    const e = m.entFor(recvSide, p); e.reset(); e.role = role;
    const z = pz === null ? deep : role === 'U' ? deep - 12 : pz;
    e.x = fx * (F.halfW - 3) * -dir; e.z = m.los + z * dir;
    e.heading = headingOf(0, -dir); e.base = 'ready';
    ret.push(e);
  }
  return { kick, ret };
}
