// Shared game context. Modules import G and read/attach what they need;
// main.js is responsible for populating it during init. Keeping this file
// dependency-free avoids circular imports.

export const G = {
  // three.js
  scene: null, camera: null, renderer: null,
  // systems
  world: null, audio: null, hud: null, game: null, combat: null, grenades: null,
  // entities
  player: null, bots: [], drops: [],
  // transient world state
  smokes: [], fires: [], soundEvents: [],
  // settings
  settings: { sens: 1.0, volume: 0.7, fov: 75, difficulty: 1 },
  // timing
  time: 0, tick: 0, paused: false, started: false,
};

export const TICK_RATE = 64;
export const TICK_DT = 1 / TICK_RATE;
