// Every stage, in select-screen order (see fighters/index.js for why these
// are loaded one by one).

const IDS = ['pizza', 'greenhouse', 'habitat', 'afterhours', 'newgym', 'popquiz', 'fieldday', 'loading', 'camplake', 'margin', 'gridpaper', 'snackcorner', 'fieldtrip'];

const loaded = await Promise.allSettled(IDS.map((id) => import(`./${id}.js`)));
export const STAGES = [];
loaded.forEach((r, i) => {
  if (r.status === 'fulfilled' && r.value.default) STAGES.push(r.value.default);
  else console.warn('stage failed to load:', IDS[i], r.reason && (r.reason.stack || r.reason.message));
});
export const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];
