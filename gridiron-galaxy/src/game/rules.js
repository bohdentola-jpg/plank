// Planet house rules: everything about a planet that changes how the football behaves.
export function resolveRules(planet, rnd = Math.random) {
  const q = new Set((planet.stadium && planet.stadium.quirks) || []); const x = planet.rules || {};
  const r = { gravity: 1, ballGravity: 1, jump: 1, traction: 1, drag: 1, bounce: 1, wind: { x: 0, z: 0 }, gusts: null, visibility: 1, staminaDrain: 1, hazards: [], hazardType: null, text: [] };
  if (q.has('lowgrav') || x.lowgrav) { r.gravity = 0.62; r.ballGravity = 0.62; r.jump = 1.5; r.bounce = 1.4; r.lowgrav = true; r.text.push('Low gravity: floaty passes, sky-high jumps, long bounces'); }
  if (q.has('highgrav') || x.highgrav) { r.gravity = 1.3; r.ballGravity = 1.3; r.jump = 0.8; r.bounce = 0.7; r.highgrav = true; r.text.push('Heavy gravity: passes dive, jumps come up short'); }
  if (q.has('dense') || x.dense) { r.drag = 3; r.dense = true; r.ballGravity *= 0.8; r.text.push('Underwater: a slow ball and slow legs'); }
  if (q.has('slick') || x.slick) { r.traction = 0.5; r.slick = true; r.text.push('Slick surface: long slides, sloppy cuts, loose balls'); }
  if (q.has('sticky') || x.sticky) { r.sticky = true; r.traction = 1.2; r.text.push("Sticky turf: slower feet, fewer drops, the ball won't roll"); }
  if (q.has('hot') || x.hot) { r.staminaDrain = 1.8; r.hot = true; r.text.push('Scorching: stamina burns fast'); }
  if (q.has('bouncy') || x.bouncy) { r.bounce *= 1.8; r.bouncy = true; r.text.push('Bouncy ground: wild bounces'); }
  if (x.bigJumps) r.jump *= 1.25;
  if (q.has('wind') || x.wind) { const a = rnd() * 6.283, m = 2.5 + rnd() * 3.5; r.wind = { x: Math.cos(a) * m, z: Math.sin(a) * m }; r.windy = true; r.text.push('Wind: passes and punts drift'); }
  if (x.dustdevils) { r.gusts = { kind: 'dustdevil', min: 7, max: 14, strength: 9, dur: 2.5 }; r.text.push('Dust devils: sudden violent gusts'); }
  if (x.sandstorm) { r.gusts = { kind: 'sandstorm', min: 12, max: 20, strength: 7, dur: 7 }; r.sandstorm = true; r.text.push('Sandstorms roll through: wind, and nobody can see'); }
  if (q.has('fog') || x.fog) { r.fog = true; r.visibility = 0.5; r.text.push('Fog: defenders lose the ball, receivers vanish'); }
  if (x.updraft) { r.ballGravity *= 0.85; r.text.push('Updrafts: the ball hangs in the air'); }
  if (x.hazards) r.hazardType = x.hazards;
  if (x.slowThrow) { r.slowThrow = true; r.text.push('Time dilation: every throw slows time'); }
  if (x.pullCenter) { r.pullCenter = true; r.text.push('Singularity: the ball bends toward the middle of the field'); }
  if (x.magnet) { r.magnet = true; r.text.push('Tractor beam: passes drift toward the Probe Squad'); }
  if (x.mindReader) { r.mindReader = true; r.text.push('They read your play calls'); }
  if (x.jackpot) { r.jackpot = true; r.text.push('Jackpot: touchdowns can pay triple'); }
  if (x.quiet) { r.quiet = true; r.text.push('Library rules: no cheering, only shushing'); }
  if (x.glowball) r.glowball = true;
  if (x.groove) { r.groove = true; r.text.push('Groove time: periodic bursts of agility for everyone'); }
  if (x.stampede) { r.stampede = true; r.text.push('Stampede: broken tackles send defenders flying'); }
  if (x.vines) { r.vines = true; r.text.push('Vines: every tackle attempt tangles the runner'); }
  if (x.sugarRush) { r.staminaDrain = 0.5; r.text.push('Sugar rush: stamina refills fast'); }
  if (x.spores) r.visibility = Math.min(r.visibility, 0.8);
  if (x.swarm) r.swarm = true;
  return r;
}
// Hazard patches are placed once the field size is known (never on the end zones or the first few yards).
export function placeHazards(r, F, rnd = Math.random) {
  if (!r.hazardType) return r;
  const n = { lava: 5, ice: 6, holes: 7, steam: 4, grease: 5, junk: 6 }[r.hazardType] || 5; const rad = { lava: 2.2, ice: 3.2, holes: 1.3, steam: 2.4, grease: 2.8, junk: 1.5 }[r.hazardType] || 2;
  for (let i = 0; i < n; i++) r.hazards.push({ type: r.hazardType, x: (rnd() - 0.5) * (F.W - 8), z: F.EZ + 6 + rnd() * (F.L - 2 * F.EZ - 12), r: rad, phase: rnd() * 6, active: 0 });
  r.text.push({ lava: 'Lava vents on the field: step in and get burned', ice: 'Ice patches: zero traction', holes: 'Cheese holes: watch your step', steam: 'Steam vents: slow going, and they erupt', grease: 'Grease puddles: slippery', junk: 'Junk on the field: trip hazards' }[r.hazardType]);
  return r;
}
export const HAZARD_LOOK = { lava: { color: '#ff6a1f', glow: '#ff5500', ring: '#3a1a10' }, ice: { color: '#dff6ff', glow: '#ffffff', ring: '#9ad8f4' }, holes: { color: '#3a2a08', glow: null, ring: '#c98a00' }, steam: { color: '#6a6a74', glow: '#dddddd', ring: '#3a3a44' }, grease: { color: '#8a6a2a', glow: '#c8a040', ring: '#5a3a10' }, junk: { color: '#1a1a1a', glow: null, ring: '#5d6068' } };
