// Teleport around an area and screenshot each stop.
//   node tools/fable-qa.cjs --script tools/fable-scenarios/tour.cjs --area hollow --preset team --stops "39,14;13,49;39,45" --tag hol
module.exports = async (h, args) => {
  const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
  const area = opt('area', 'hollow'), preset = opt('preset', 'team'), tag = opt('tag', area);
  const stops = opt('stops', '39,33').split(';').map((s) => s.split(',').map(Number));
  await h.open(`area=${area}&preset=${preset}${args.includes('--noshadow') ? '' : '&shadows'}${opt('extra', '') ? '&' + opt('extra', '') : ''}`);
  await h.step(5);
  let i = 0;
  for (const [x, z] of stops) {
    await h.ev(([xx, zz]) => { const w = window.__fable.G.world; w.tp(xx, zz); }, [x, z]);
    await h.step(40);
    await h.shot(`${tag}-${i++}.png`);
  }
};
