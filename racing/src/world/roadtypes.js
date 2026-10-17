// PORT HALCYON — road cross-sections. Every road in the world has a type;
// the type says how wide it is, what's painted on it, what lines its edges
// (kerb and sidewalk, guardrail, jersey barrier, nothing), how it lights,
// how it sits on the land (how far the ground is graded to it, how steep it
// may climb) and how traffic uses it.
//
//   hw      half-width of the carriageway (m)
//   walk    sidewalk width each side (m) — a kerb of `curb` height before it
//   shoulder paved/gravel shoulder each side beyond the carriageway (m)
//   median  half-width of a central median (barrier or trees) inside hw
//   edge    what stops a car at the edge: 'curb' | 'rail' | 'jersey' | 'wall' | 'none'
//   paint   road texture style for roadTextures(): lanes, center, edge, base
//   surface physics surface on the carriageway; shoulderSurface off it
//   lamp    street-light style key (null = unlit) and spacing
//   blend   how far the ground is graded back to its own shape past the edge
//   smooth  elevation smoothing window (m); grade = steepest climb allowed
//   speed   traffic cruising speed (m/s); traffic = lanes each way (0 = none)

const T = {
  // ---------------------------------------------------------------- city
  avenue: {
    hw: 7.6, walk: 4.6, curb: 0.15, shoulder: 0, edge: 'curb',
    paint: { lanes: 4, center: 'double-yellow', edge: 'none' },
    surface: 'road', shoulderSurface: 'sidewalk', lamp: 'city', lampEvery: 34,
    blend: 10, smooth: 60, grade: 0.08, speed: 16, traffic: 2, junction: true,
  },
  boulevard: {
    hw: 12.5, median: 3.2, walk: 5.2, curb: 0.15, shoulder: 0, edge: 'curb',
    paint: { lanes: 6, center: 'none', edge: 'none' },
    surface: 'road', shoulderSurface: 'sidewalk', lamp: 'boulevard', lampEvery: 30,
    blend: 10, smooth: 70, grade: 0.07, speed: 17, traffic: 3, junction: true,
  },
  street: {
    hw: 5.4, walk: 3.4, curb: 0.15, shoulder: 0, edge: 'curb',
    paint: { lanes: 2, center: 'dashed-yellow', edge: 'none' },
    surface: 'road', shoulderSurface: 'sidewalk', lamp: 'city', lampEvery: 30,
    blend: 8, smooth: 40, grade: 0.1, speed: 12, traffic: 1, junction: true,
  },
  cobble: {
    hw: 4.9, walk: 2.6, curb: 0.13, shoulder: 0, edge: 'curb',
    paint: { lanes: 0, center: 'none', edge: 'none', base: 'cobble' },
    surface: 'road', shoulderSurface: 'sidewalk', lamp: 'gas', lampEvery: 26,
    blend: 8, smooth: 30, grade: 0.12, speed: 10, traffic: 1, junction: true,
  },
  alley: {
    hw: 3.4, walk: 0, curb: 0, shoulder: 0.4, edge: 'wall',
    paint: { lanes: 0, center: 'none', edge: 'none', base: '#2b2a29' },
    surface: 'road', shoulderSurface: 'road', lamp: 'wall', lampEvery: 22,
    blend: 6, smooth: 24, grade: 0.14, speed: 7, traffic: 0, junction: true,
  },
  service: {
    hw: 3.8, walk: 0, curb: 0, shoulder: 0.6, edge: 'none',
    paint: { lanes: 0, center: 'none', edge: 'none' },
    surface: 'road', shoulderSurface: 'road', lamp: null,
    blend: 8, smooth: 24, grade: 0.14, speed: 8, traffic: 0, junction: true,
  },
  // ---------------------------------------------------------------- highways
  freeway: {
    hw: 15.2, median: 1.0, walk: 0, curb: 0, shoulder: 2.4, edge: 'jersey',
    paint: { lanes: 6, center: 'none', edge: 'white' },
    surface: 'road', shoulderSurface: 'road', lamp: 'highway', lampEvery: 64,
    blend: 26, smooth: 260, grade: 0.05, speed: 30, traffic: 3, junction: false,
  },
  expressway: {
    hw: 9.6, median: 0.8, walk: 0, curb: 0, shoulder: 1.2, edge: 'jersey',
    paint: { lanes: 4, center: 'none', edge: 'white' },
    surface: 'road', shoulderSurface: 'road', lamp: 'highway', lampEvery: 48,
    blend: 20, smooth: 160, grade: 0.06, speed: 26, traffic: 2, junction: false,
  },
  ramp: {
    hw: 4.6, walk: 0, curb: 0, shoulder: 1.4, edge: 'jersey',
    paint: { lanes: 1, center: 'none', edge: 'white' },
    surface: 'road', shoulderSurface: 'road', lamp: 'highway', lampEvery: 56,
    blend: 18, smooth: 90, grade: 0.07, speed: 20, traffic: 1, junction: false,
  },
  highway: {
    hw: 5.8, walk: 0, curb: 0, shoulder: 2.2, edge: 'none',
    paint: { lanes: 2, center: 'double-yellow', edge: 'white' },
    surface: 'road', shoulderSurface: 'gravel', lamp: null,
    blend: 24, smooth: 150, grade: 0.07, speed: 24, traffic: 1, junction: true,
  },
  coastal: {
    hw: 5.6, walk: 0, curb: 0, shoulder: 1.2, edge: 'rail',
    paint: { lanes: 2, center: 'double-yellow', edge: 'white' },
    surface: 'road', shoulderSurface: 'gravel', lamp: 'coast', lampEvery: 70,
    blend: 22, smooth: 80, grade: 0.09, speed: 20, traffic: 1, junction: true,
  },
  mountain: {
    hw: 5.0, walk: 0, curb: 0, shoulder: 0.8, edge: 'rail',
    paint: { lanes: 2, center: 'double-yellow', edge: 'white' },
    surface: 'road', shoulderSurface: 'gravel', lamp: null,
    blend: 30, smooth: 34, grade: 0.13, speed: 16, traffic: 1, junction: true,
  },
  // ---------------------------------------------------------------- race tracks
  circuit: {
    hw: 7.6, walk: 0, curb: 0, shoulder: 1.6, edge: 'none',
    paint: { lanes: 0, center: 'none', edge: 'white' },
    surface: 'road', shoulderSurface: 'curb', lamp: null,
    blend: 30, smooth: 70, grade: 0.09, speed: 0, traffic: 0, junction: true, kerbs: true,
  },
  strip: {
    hw: 12, walk: 0, curb: 0, shoulder: 3, edge: 'none',
    paint: { lanes: 2, center: 'none', edge: 'white', base: '#3a3a3c' },
    surface: 'road', shoulderSurface: 'sand', lamp: null,
    blend: 30, smooth: 300, grade: 0.01, speed: 0, traffic: 0, junction: true,
  },
  // ---------------------------------------------------------------- unpaved
  dirt: {
    hw: 3.6, walk: 0, curb: 0, shoulder: 1.0, edge: 'none',
    paint: { lanes: 0, center: 'none', edge: 'none', base: 'dirt' },
    surface: 'dirt', shoulderSurface: 'dirt', lamp: null,
    blend: 10, smooth: 28, grade: 0.16, speed: 10, traffic: 0, junction: true,
  },
  gravel: {
    hw: 3.3, walk: 0, curb: 0, shoulder: 0.8, edge: 'none',
    paint: { lanes: 0, center: 'none', edge: 'none', base: 'gravel' },
    surface: 'gravel', shoulderSurface: 'gravel', lamp: null,
    blend: 10, smooth: 26, grade: 0.17, speed: 9, traffic: 0, junction: true,
  },
  // ---------------------------------------------------------------- waterfront
  quay: {
    hw: 8.2, walk: 0, curb: 0, shoulder: 1.0, edge: 'none',
    paint: { lanes: 2, center: 'none', edge: 'yellow', base: '#4a4b4d' },
    surface: 'road', shoulderSurface: 'road', lamp: 'mast', lampEvery: 90,
    blend: 6, smooth: 60, grade: 0.05, speed: 12, traffic: 1, junction: true,
  },
  boardwalk: {
    hw: 5.2, walk: 0, curb: 0, shoulder: 0.5, edge: 'rail',
    paint: { lanes: 0, center: 'none', edge: 'none', base: 'wood' },
    surface: 'road', shoulderSurface: 'road', lamp: 'gas', lampEvery: 20,
    blend: 4, smooth: 30, grade: 0.06, speed: 8, traffic: 0, junction: true,
  },
};

for (const [id, t] of Object.entries(T)) {
  t.id = id;
  t.median = t.median || 0;
  // wall distance from the centerline (what physics treats as the edge of
  // the drivable corridor on roads that have one)
  t.reach = t.hw + t.shoulder + t.walk;
}

export const ROAD_TYPES = T;
export const roadType = (id) => T[id] || T.street;
