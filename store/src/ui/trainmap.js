// The train map: every car in a row, with today's highlights. Tap to go.
import { el, openOverlay, xButton, panelHead } from './dom.js';
import { SHOPS } from '../data/items.js';
import * as E from '../systems/econ.js';
import * as audio from '../audio.js';

export const CAR_INFO = {
  cab: { name: 'THE CAB', color: '#2a2238', blurb: 'The driver’s cab. Locked.' },
  front: { name: 'FRONT CAR', color: '#ff4f4f', keeper: 'SIGNAL', blurb: 'Punch in, daily jobs, your closet' },
  threads: { name: 'THREADS', color: SHOPS.threads.color, keeper: 'DRIPPY', blurb: 'Tops and bottoms' },
  kicks: { name: 'KICKS & DECKS', color: SHOPS.kicks.color, keeper: 'LACE', blurb: 'Sneakers and skate decks' },
  lids: { name: 'LIDS', color: SHOPS.lids.color, keeper: 'CONE', blurb: 'Hats and shades' },
  ice: { name: 'ICE', color: SHOPS.ice.color, keeper: 'MIRA', blurb: 'Chains, grills, bags' },
  arcade: { name: 'ARCADE', color: '#7b5cff', keeper: 'JOY + EIGHT', blurb: 'Tunnel Run, Tag Wall, The Grabber, shell game' },
  capsules: { name: 'CAPSULES', color: '#e8456b', keeper: 'PLUG', blurb: 'Capsule machines. Anything can drop.' },
  ghost: { name: 'THE GHOST CAR', color: '#9ad8c8', keeper: 'STATIC', blurb: 'A car from 1931. Only coupled on some nights.' },
};

let api = { go: () => {}, current: () => 'front', order: () => E.CARS };
export function initTrainMap(a) { api = { ...api, ...a }; }

function badges(id) {
  const out = [];
  if (id === 'capsules' && E.freePullReady()) out.push(['FREE PULL', 'go']);
  if (E.SHOP_CARS.includes(id)) {
    const drop = E.dropOfDay();
    if (drop.shop === id) out.push(['DROP OF THE DAY', 'hot']);
    const leg = E.stock(id).find((r) => r.featured && r.item.rarity === 'legendary');
    if (leg) out.push(['LEGENDARY IN STOCK', 'gold']);
  }
  if (id === 'front' && E.canCheckIn()) out.push(['PUNCH IN', 'go']);
  if (id === 'front' && E.allJobsDone() && !E.S.day.jobsClaimed) out.push(['JOBS DONE', 'gold']);
  return out;
}

export function openTrainMap() {
  openOverlay('train', (panel, close) => {
    const here = api.current();
    const head = panelHead('THE DRIP LINE', 'Seven cars and a couple that aren’t on any map. Tap a car to walk there.');
    const row = el('div', { class: 'train-row' });
    const cars = ['cab', ...E.CARS, 'ghost'];
    cars.forEach((id, i) => {
      const info = CAR_INFO[id];
      const secret = id === 'cab' || id === 'ghost';
      const known = !secret || (id === 'cab' ? E.S.secrets.cab : E.S.secrets.ghost);
      const reachable = api.order().includes(id);
      const num = E.CARS.indexOf(id) + 1;
      const b = el('button', {
        type: 'button', class: `train-car${id === here ? ' here' : ''}${secret ? ' secret' : ''}${!reachable ? ' locked' : ''}`,
        style: { '--car': info.color }, disabled: !reachable || id === here,
        'aria-label': known ? `${info.name}${id === here ? ', you are here' : ''}` : 'Unknown car',
      },
      el('span', { class: 'tc-num' }, num > 0 ? `CAR ${num}` : '???'),
      el('span', { class: 'tc-name' }, known ? info.name : '???'),
      el('span', { class: 'tc-blurb' }, known ? info.blurb : secret && id === 'cab' ? 'Behind the front car. Needs a key.' : 'Behind the last car. Chained shut most nights.'),
      known && info.keeper ? el('span', { class: 'tc-keeper' }, info.keeper) : null,
      el('span', { class: 'tc-badges' }, ...badges(id).map(([t, c]) => el('span', { class: `badge ${c}` }, t)), id === here ? el('span', { class: 'badge own' }, 'YOU ARE HERE') : null),
      el('span', { class: 'tc-wheels', 'aria-hidden': 'true' }));
      if (reachable && id !== here) b.addEventListener('click', () => { audio.click(); close(); api.go(id); });
      row.append(b);
      if (i < cars.length - 1) row.append(el('span', { class: 'train-link', 'aria-hidden': 'true' }));
    });
    panel.append(head, el('div', { class: 'panel-body' }, el('div', { class: 'train-scroll' }, row)), xButton(close));
    requestAnimationFrame(() => {
      const cur = row.querySelector('.here');
      if (cur) cur.scrollIntoView({ block: 'center', inline: 'center' });
    });
  }, { label: 'Train map' });
}
