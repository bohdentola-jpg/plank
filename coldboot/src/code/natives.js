// Game-side host functions for field hacks (see NATIVES in challenges.js for
// what Python sees). Dotted names become module objects: camera.feed →
// camera = { feed }. Every call that "reaches the world" is recorded in
// `sink` as [name, value] so the mission can react after the laptop closes.

const FEED = [
  'Bering St 02:58 empty', 'Bering St 02:59 empty', 'Bering St 03:00 PERSON at cabin door',
  'Bering St 03:01 PERSON at cabin door', 'Bering St 03:02 empty', 'Bering St 03:03 PERSON walking', 'Bering St 03:04 fox',
];
const VAULT_SCREEN = 'EXXC7\\RN-7SE^AR7U;7D[XC7%';
const VAULT_KEY = 'C0DE9F31B7E2';

/** names: the challenge's natives list. sink: array receiving [name, value]. */
export function buildNatives(names = [], sink = null) {
  const rec = (n, v) => { sink?.push([n, v]); };
  const behave = {
    report: (v) => { rec('report', v); return null; },
    'camera.feed': () => FEED.slice(),
    'camera.loop': (frames) => { rec('camera.loop', frames); return Array.isArray(frames) ? frames.length : 0; },
    submit: (list) => { rec('submit', list); return Array.isArray(list) ? list.length : 0; },
    publish: (ev) => { rec('publish', ev); return null; },
    'vault.insert_key': (key) => { rec('vault.insert_key', key); return key === VAULT_KEY; },
    'vault.screen': () => VAULT_SCREEN,
    send: (code) => { rec('send', code); return 'TRANSMITTED'; },
  };
  const out = {};
  for (const n of names) {
    const fn = behave[n] || (() => null);
    if (n.includes('.')) {
      const [mod, attr] = n.split('.');
      (out[mod] ||= {})[attr] = fn;
    } else out[n] = fn;
  }
  return out;
}

/** Install natives (from buildNatives) and mission data into a PyVM. */
export function installNatives(vm, natives, data) {
  for (const [name, fn] of Object.entries(natives || {})) {
    if (typeof fn === 'function') vm.defineNative(name, fn);
    else if (fn && typeof fn === 'object') vm.defineModuleObject(name, fn);
  }
  if (data) for (const [k, v] of Object.entries(data)) vm.set(k, JSON.parse(JSON.stringify(v)));
}
