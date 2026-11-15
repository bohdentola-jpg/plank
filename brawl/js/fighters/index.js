// The roster, in select-screen order. Each fighter lives in its own file; a
// file that fails to load is skipped with a console warning instead of taking
// the whole game down.

const IDS = ['lunchlady', 'sunnydrizzle', 'zoomie', 'sneaks', 'soup', 'globert', 'crumbs', 'clicky', 'campkids', 'doodle', 'eraser', 'allowance', 'honk', 'dale', 'thesub'];

const loaded = await Promise.allSettled(IDS.map((id) => import(`./${id}.js`)));
export const FIGHTERS = [];
loaded.forEach((r, i) => {
  if (r.status === 'fulfilled' && r.value.default) FIGHTERS.push(r.value.default);
  else console.warn('fighter failed to load:', IDS[i], r.reason && (r.reason.stack || r.reason.message));
});
export const fighterById = (id) => FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
