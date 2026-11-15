// The roster, in select-screen order. Each fighter lives in its own file; a
// file that fails to load is skipped with a console warning instead of taking
// the whole game down.

const IDS = ['lunchlady', 'sunnydrizzle', 'zoomie', 'sneaks', 'soup', 'globert', 'crumbs', 'clicky', 'campkids', 'doodle', 'eraser', 'allowance', 'honk', 'dale', 'thesub'];

const loaded = await Promise.allSettled(IDS.map((id) => import(`./${id}.js`)));
export const FIGHTERS = [];
// Fighters that have been checked and are offered on the select screen. Anything
// else still loads (so it can be tested by id) but is kept out of the menus.
export const READY = ['lunchlady', 'zoomie', 'sneaks', 'soup', 'globert', 'crumbs', 'campkids', 'doodle', 'eraser', 'allowance', 'honk', 'dale'];

loaded.forEach((r, i) => {
  if (r.status === 'fulfilled' && r.value.default) { const d = r.value.default; if (!READY.includes(d.id)) d.stub = true; FIGHTERS.push(d); }
  else console.warn('fighter failed to load:', IDS[i], r.reason && (r.reason.stack || r.reason.message));
});
export const fighterById = (id) => FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
