// THE SERVICE LIFT — the only room in the game that is not trying to kill you.
//
// Between floors you are in the car. It is a real room built out of the same level data
// every floor is built from, so it gets the same geometry, collision, baked light and
// footsteps for free: you walk around in it, you look at what is for sale, and you press
// the button when you are ready to go further down.
//
// Three things are in here with you:
//   · the STALL along the right-hand wall — somebody set up a trestle table against the
//     panelling and put three things on it, each with a price written on card
//   · the PANEL by the doors — one lit button per floor of the descent, the one below
//     you lit brightest, and that is what takes you down
//   · a MIRROR on the back wall, because you should have to look at yourself
//
// The car is deliberately small. It is the only safe room in the game and it should still
// feel like being inside a box that is moving.

import { makeKit } from './kit.js';

export const CAR = {
  // in cells; the cell is 0.7m, so the interior is about 4.9m x 7.7m — a goods lift, big
  // enough that three people and a trestle table are not standing on each other
  w: 11, h: 15, cell: 0.7,
  x0: 2, z0: 2, x1: 8, z1: 12,
};

// Where things are in the car, in world metres. main.js turns these into the prompts you
// walk up to, so the shop and the button are places rather than menu items.
export function carSpots(offers) {
  const S = CAR.cell;
  const shelfX = (CAR.x1 - 1.1) * S;
  const spots = offers.map((key, i) => ({
    kind: 'buy',
    key,
    x: shelfX - 0.55,
    z: (CAR.z0 + 2.8 + i * 3.1) * S,
    r: 1.15,
  }));
  spots.push({
    kind: 'go',
    x: (CAR.x0 + 0.95) * S,
    z: (CAR.z0 + 1.1) * S,
    r: 1.1,
  });
  return spots;
}

// The car interior as level data. `offers` are the three catalogue keys on the stall and
// `labels` their display names, so the price cards can be built into the props.
export function buildLiftCar({ offers = [], labels = [], prices = [], owned = [], seed = 7 } = {}) {
  const kit = makeKit(seed);
  const { C } = kit;
  const L = kit.level({
    w: CAR.w, h: CAR.h, cell: CAR.cell, wallH: 2.6,
    palette: { wall: 'woodPanel', floor: 'metalPlate', ceil: 'ceilPanel' },
    fog: { color: 0x1a1710, density: 0.02 },
    ambient: { color: 0x50442e, intensity: 0.55 },
  });
  L.setAmbience({ room: 'machinery', hum: 0.7, drip: 0, wind: 0, music: 'calm', reverb: 0.25 });
  L.setRules({ sanityDrain: 0, batteryDrain: 0.2 });
  L.setTint(1.05, 1.0, 0.9);

  // ---- the box
  L.fill(C.WALL);
  L.rect(CAR.x0, CAR.z0, CAR.x1, CAR.z1, C.OPEN);
  L.paintRect(CAR.x0, CAR.z0, CAR.x1, CAR.z1, { floor: 'metalPlate', wall: 'woodPanel', ceil: 'ceilPanel' });
  L.enclose();

  const S = CAR.cell;
  const midZ = (CAR.z0 + CAR.z1) / 2;
  const midX = (CAR.x0 + CAR.x1) / 2;

  // ---- light: one panel in the ceiling, and it flickers exactly once on the way down
  L.light({
    x: midX, z: midZ, y: 2.5, color: 0xffe6b4, intensity: 1.15, radius: 9,
    fixture: 'panel', flicker: 0.06, hum: 0.5,
  });
  L.light({ x: midX, z: CAR.z0 + 1, y: 2.4, color: 0xffd090, intensity: 0.7, radius: 5, fixture: 'none' });

  // ---- the doors you came in by, at the near end
  L.prop('elevatorDoors', { x: midX, z: CAR.z0 - 0.4, rot: Math.PI });

  // ---- the stall: a table down the right-hand wall with the goods on it
  L.prop('shopStall', { x: CAR.x1 - 0.9, z: midZ, rot: -Math.PI / 2, len: (CAR.z1 - CAR.z0 - 2) * S });
  offers.forEach((key, i) => {
    const z = CAR.z0 + 2.8 + i * 3.1;
    L.prop('shopGood', { x: CAR.x1 - 1.1, z, rot: -Math.PI / 2, key, y: 0.92 });
    L.prop('shopTag', {
      x: CAR.x1 - 1.6, z, rot: -Math.PI / 2, y: 0.96,
      text: labels[i] || key, price: prices[i], sold: owned[i],
    });
  });
  // and whoever runs it left their lamp and their tin on the end of the table
  L.prop('lamp', { x: CAR.x1 - 1.1, z: CAR.z1 - 1.2, y: 0.92 });
  L.light({ x: CAR.x1 - 1.4, z: CAR.z1 - 1.2, y: 1.25, color: 0xffc070, intensity: 0.55, radius: 4, fixture: 'none' });
  L.prop('boxStack', { x: CAR.x1 - 0.7, z: CAR.z1 - 0.6 });

  // ---- the panel by the doors: the buttons for the descent
  // rot 0: the buttons are built on the prop's +X face, and the panel is on the left-hand
  // wall, so they already face into the car. Turning it puts the buttons in the panelling.
  L.prop('liftPanel', { x: CAR.x0 + 0.55, z: CAR.z0 + 1.2, rot: 0, y: 0.85, floors: 10, at: 1 });

  // ---- the back wall: a mirror, a handrail, and the inspection certificate
  L.prop('mirrorPanel', { x: midX, z: CAR.z1 + 0.4, rot: 0 });
  L.prop('railing', { x: midX, z: CAR.z1 + 0.3, len: 2.4 });
  L.prop('notice', { x: midX + 1.4, z: CAR.z1 + 0.4, rot: 0 });

  L.spawnAt(midX, CAR.z0 + 1.6, Math.PI);
  return L.finishRoom();
}
