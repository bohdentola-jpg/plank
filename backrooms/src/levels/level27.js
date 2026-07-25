// LEVEL 27 — THE PARKING GARAGE
// Three decks of poured concrete joined by ramps, sodium tubes in rows, painted
// bay numbers going up past any number of cars anyone ever owned. Every footstep
// arrives twice. The second time it is a little late, and a little heavier, and
// it is on the deck above you.

export const meta = {
  id: 'level27',
  num: '27',
  name: 'THE PARKING GARAGE',
  subtitle: 'level P3',
  tagline: 'Whatever is up on P1 has claws and it is keeping pace with you.',
  danger: 7,
  survival: 'poor',
  chapter: 15,
  tape: 'TAPE 13',
  brief: `Three decks, ramps between them, and a stair core marked AMBULATORY
    ENTRANCE. Hounds use the ramps. So can you.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 148, h: 148, cell: 3.4, wallH: 2.6,
    palette: { wall: 'concretePaint', floor: 'concrete', ceil: 'concrete' },
    fog: { color: 0x101110, density: 0.034 },
    ambient: { color: 0x22241f, intensity: 0.14 },
  });
  L.setAmbience({ room: 'machinery', hum: 0.4, drip: 0.5, wind: 0.15, music: 'dread', reverb: 0.85 });
  L.setRules({ noiseLimit: 0.45, sanityDrain: 1.1 });
  L.setTint(1.06, 0.98, 0.86);

  // ---------------------------------------------------------------- three decks
  // Deck heights are floor heights: one big plate, stepped, with ramps between.
  L.fill(C.OPEN);
  L.paintAll({ floor: 'concrete', wall: 'concretePaint', ceil: 'concrete' });
  const decks = [
    { z0: 2, z1: 48, y: 0 },
    { z0: 52, z1: 98, y: 2.4 },
    { z0: 102, z1: 145, y: 4.8 },
  ];
  for (const d of decks) {
    L.floorRect(2, d.z0, 145, d.z1, d.y);
    L.ceilRect(2, d.z0, 145, d.z1, d.y + 2.6);
  }
  // the walls between decks, with a ramp gap at alternating ends
  for (const [i, d] of decks.entries()) {
    if (i === 0) continue;
    const rampAtWest = i % 2 === 1;
    for (let x = 2; x <= 145; x++) {
      const inRamp = rampAtWest ? x >= 8 && x <= 22 : x >= 124 && x <= 138;
      for (let z = d.z0 - 3; z < d.z0; z++) {
        if (inRamp) continue;
        L.set(x, z, C.WALL);
      }
    }
    const rx = rampAtWest ? 15 : 131;
    L.ramp(rx, d.z0 - 4, rx, d.z0 + 1, decks[i - 1].y, d.y, { width: 8, head: 2.6 });
    for (let x = rx - 4; x <= rx + 4; x++) {
      for (let z = d.z0 - 4; z <= d.z0 + 1; z++) {
        L.paint(x, z, { floor: 'asphalt' });
      }
    }
  }

  // Pillar grid, bay markings, and the oil trench down the spine of each deck.
  for (const d of decks) {
    kit.gen.hall(L, { x0: 4, z0: d.z0 + 2, x1: 143, z1: d.z1 - 2, every: 10, h: d.y + 2.6, prop: 'pillarSquare' });
    const tz = Math.floor((d.z0 + d.z1) / 2);
    for (let x = 6; x < 142; x++) {
      L.set(x, tz, C.WATER);
      L.floorAt(x, tz, d.y - 0.25);
      L.paint(x, tz, { floor: 'mud' });
    }
  }
  L.waterLevel = null;   // the trenches are shallow and local; no global surface

  // Cars, in rows, most of them nose-in.
  for (const d of decks) {
    for (let x = 8; x < 142; x += 6) {
      for (const z of [d.z0 + 5, d.z1 - 6]) {
        if (!kit.chance(0.55)) continue;
        L.prop('car', {
          x, z, rot: z < (d.z0 + d.z1) / 2 ? 0 : Math.PI,
          color: kit.pick([0x5a6470, 0x7a3a30, 0x2a4a3a, 0x8a8a80, 0x30343c, 0xa8a49a]),
          y: d.y,
        });
        L.collider(x - 0.8, z - 1.2, x + 0.8, z + 1.2, { y0: 0, y1: 1.4 });
      }
    }
  }

  // The security office, on the middle deck, with the light still on.
  const so = [70, 70];
  L.room(so[0], so[1], so[0] + 10, so[1] + 8, { floor: 'linoleum', wall: 'drywall', ceil: 'ceilTile' });
  L.floorRect(so[0], so[1], so[0] + 10, so[1] + 8, 2.4);
  L.ceilRect(so[0], so[1], so[0] + 10, so[1] + 8, 5.0);
  L.prop('desk', { x: so[0] + 3, z: so[1] + 2, rot: 0, y: 2.4 });
  L.prop('crtMonitor', { x: so[0] + 3, z: so[1] + 1.6, y: 3.15 });
  L.prop('crtMonitor', { x: so[0] + 5, z: so[1] + 1.6, y: 3.15 });
  L.prop('officeChair', { x: so[0] + 4, z: so[1] + 3, rot: 2, y: 2.4 });
  L.prop('lockers', { x: so[0] + 8, z: so[1] + 6, rot: Math.PI, y: 2.4 });
  L.light({ x: so[0] + 5, z: so[1] + 4, y: 4.8, color: 0xf0f4e0, intensity: 1.1, radius: 12, fixture: 'panel', flicker: 0.1 });

  // ---------------------------------------------------------------- lights
  for (const d of decks) {
    for (let z = d.z0 + 4; z < d.z1; z += 9) {
      for (let x = 6; x < 143; x += 9) {
        const dead = kit.chance(0.16);
        L.light({
          x, z, y: d.y + 2.5, color: 0xffb050, intensity: dead ? 0 : 0.9, radius: 12,
          fixture: 'tube', rot: Math.PI / 2, dead, flicker: kit.chance(0.22) ? kit.rand(0.2, 0.8) : 0,
        });
      }
    }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('trafficCone', 40);
  L.scatter('dumpster', 10);
  L.scatter('shoppingCart', 20);
  L.scatter('drainGrate', 24);
  L.scatter('graffiti', 26);
  L.scatter('clawMarks', 20);
  L.scatter('bloodTrail', 8);
  L.scatter('rubblePile', 14);
  L.scatter('pipeRun', 20, { opts: { len: 8, height: 2.4 } });
  L.scatter('carWreck', 6);
  L.scatter('signpost', 10);
  // ---------------------------------------------------------------- scares
  L.scare('footstepsFollow', { x: 50, z: 30, radius: 9 });
  L.scare('doorSlam', { x: so[0] + 5, z: so[1] + 9, radius: 6 });
  L.scare('lightBurst', { x: 100, z: 40, radius: 5 });
  L.scare('shadowCross', { x: 60, z: 66, radius: 8 });
  L.scare('bodyFall', { x: 110, z: 100, radius: 10 });
  L.scare('crawlerDrop', { x: 130, z: 120, radius: 6 });
  L.scare('screamDistant', { x: 30, z: 70, radius: 14 });
  L.scare('lightsOut', { x: 90, z: 130, radius: 12 });
  L.scare('nameOnWall', { x: 20, z: 118, radius: 6 });
  L.scare('breathing', { x: 140, z: 40, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 10, Math.PI / 2);

  L.trigger({ x: 24, z: 90, radius: 4, objective: 'obj1', say: 'A crowbar, and a note that says the door is only chained.' });
  L.trigger({ x: so[0] + 5, z: so[1] + 4, radius: 5, say: 'Three monitors, three decks, one shape on all of them at once.' });
  L.trigger({ x: 130, z: 138, radius: 8, wake: 'p3', say: 'Something on this deck has just noticed the ramp behind you.' });

  L.room(138, 132, 145, 144, { floor: 'concrete', wall: 'cinder', ceil: 'concrete' });
  L.floorRect(138, 132, 145, 144, 4.8);
  L.ceilRect(138, 132, 145, 144, 8.0);
  L.prop('stairFlight', { x: 142, z: 138, height: 2.4, steps: 8, y: 4.8 });
  L.prop('doubleDoor', { x: 141, z: 144, rot: 0 });
  L.prop('exitSign', { x: 141, z: 143 });
  L.light({ x: 141, z: 138, y: 7.6, color: 0xd0e8ff, intensity: 0.9, radius: 12, fixture: 'tube', flicker: 0.2 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('ceiling');
  L.hideSpots('car', 10);
  // The thing keeping pace with you on the deck above, and coming down the ramp.
  L.monsterFar('crawler', { tell: 'clawStep', speed: 5.8, patience: 1.5, hearing: 1.5, wanders: 46, checksHides: 0.55 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 141, z: 143 });

  return L.finish();
}
