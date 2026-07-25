// LEVEL 4 — ABANDONED OFFICE
// Cubicles to the horizon, blue-grey carpet, and a fluorescent grid where whole
// zones have gone out and stayed out. Phones ring in rooms you have already
// checked. The conference room chairs are all facing the corner. There is one
// elevator lobby with the lights still on, and the elevator arrives, which it
// should not be able to do.

export const meta = {
  id: 'level4',
  num: '4',
  name: 'ABANDONED OFFICE',
  subtitle: 'the floor plate',
  tagline: 'Somebody is still filing. Nobody is still working.',
  danger: 4,
  survival: 'fair',
  chapter: 5,
  tape: 'TAPE 05',
  brief: `An open-plan floor with no outside walls you can find. Take the lit
    elevator lobby on the east side. Don't stare at the ones with no faces.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 148, h: 148, cell: 3.1, wallH: 2.9,
    palette: { wall: 'drywall', floor: 'carpetOffice', ceil: 'ceilTile' },
    fog: { color: 0x14161a, density: 0.030 },
    ambient: { color: 0x24282e, intensity: 0.17 },
  });
  L.setAmbience({ room: 'buzz', hum: 0.6, drip: 0.05, wind: 0, music: 'drone', reverb: 0.3 });
  L.setRules({ sanityDrain: 1.0 });
  L.setTint(0.98, 1.0, 1.02);

  // ---------------------------------------------------------------- the plate
  L.fill(C.WALL);
  kit.gen.office(L, { x0: 3, z0: 3, x1: 144, z1: 144, pod: 5 });
  L.paintWhere((c) => c === C.HALF, { wall: 'cubicleFabric' });

  // Real rooms punched into the plate: meeting rooms, mail room, restrooms.
  const rooms = [];
  for (const [x, z, w, h, kind] of [
    [12, 12, 20, 14, 'meeting'], [110, 16, 22, 16, 'meeting'], [16, 112, 24, 18, 'mail'],
    [104, 108, 26, 20, 'canteen'], [66, 66, 18, 14, 'server'], [60, 12, 16, 12, 'restroom'],
  ]) {
    L.room(x, z, x + w, z + h, { floor: kind === 'restroom' ? 'linoleum' : 'carpetOffice', wall: 'drywall' });
    L.set(x + Math.floor(w / 2), z + h, C.DOOR);
    rooms.push([x, z, x + w, z + h, kind]);
    const cx = x + Math.floor(w / 2), cz = z + Math.floor(h / 2);
    L.light({ x: cx, z: cz, y: 2.8, color: 0xf0f4e8, intensity: 1.0, radius: 12, fixture: 'panel', flicker: kit.chance(0.4) ? 0.3 : 0 });
    if (kind === 'meeting') {
      L.prop('diningTable', { x: cx, z: cz, rot: 0 });
      for (let i = 0; i < 8; i++) {
        // every chair turned to face the corner of the room
        const ang = Math.atan2(z - cz, x - cx);
        L.prop('officeChair', { x: cx + kit.rand(-4, 4), z: cz + kit.rand(-3, 3), rot: ang });
      }
      L.prop('corkboard', { x: cx, z: z + 0.6 });
    } else if (kind === 'mail') {
      for (let i = 0; i < 10; i++) L.prop('shelf', { x: x + 2 + i * 2, z: z + 2, rot: 0, height: 2.2 });
      L.scatter('boxStack', 12, { where: (px, pz) => px > x && px < x + w && pz > z && pz < z + h });
    } else if (kind === 'canteen') {
      for (let i = 0; i < 6; i++) L.prop('table', { x: x + 4 + (i % 3) * 7, z: z + 4 + Math.floor(i / 3) * 8 });
      L.prop('vendingMachine', { x: x + 1, z: cz, rot: Math.PI / 2 });
      L.prop('watercooler', { x: x + w - 2, z: z + 2 });
    } else if (kind === 'server') {
      for (let i = 0; i < 8; i++) L.prop('serverRack', { x: x + 3 + (i % 4) * 4, z: z + 4 + Math.floor(i / 4) * 6 });
      L.paintRect(x, z, x + w, z + h, { floor: 'metalPlate' });
      L.light({ x: cx, z: cz, y: 2.8, color: 0x60a0ff, intensity: 0.8, radius: 10, fixture: 'none' });
    } else if (kind === 'restroom') {
      for (let i = 0; i < 4; i++) L.prop('bathStall', { x: x + 2 + i * 3, z: z + 3, rot: 0 });
      L.prop('sink', { x: cx, z: z + h - 1.4, rot: Math.PI });
      L.prop('mirrorPanel', { x: cx, z: z + h - 0.6, rot: Math.PI });
      L.paintRect(x, z, x + w, z + h, { wall: 'tileHospital' });
    }
  }

  // A glazed corridor of partition offices — glass on both sides.
  for (let z = 40; z < 100; z++) {
    L.set(52, z, C.GLASS);
    L.set(58, z, C.GLASS);
    for (let x = 53; x < 58; x++) { L.set(x, z, C.OPEN); L.paint(x, z, { floor: 'carpetOffice' }); }
  }
  for (let z = 44; z < 100; z += 9) { L.set(52, z, C.DOOR); L.set(58, z, C.DOOR); }

  // ---------------------------------------------------------------- lights
  L.lightGrid(6, 6, 142, 142, {
    every: 7, color: 0xf4f6e8, intensity: 0.9, radius: 11,
    flickerChance: 0.16, deadChance: 0.1, fixture: 'panel',
  });
  // three dead zones, big enough to lose the way in
  for (const [zx, zz, zr] of [[36, 84, 22], [116, 62, 20], [80, 126, 18]]) {
    for (const l of L.lights) if (Math.hypot(l.x - zx, l.z - zz) < zr) { l.dead = true; }
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('filingCabinet', 46);
  L.scatter('crtMonitor', 40);
  L.scatter('officeChair', 40);
  L.scatter('trashcan', 30);
  L.scatter('payphone', 14);
  L.scatter('plant', 24);
  L.scatter('clock', 12);
  L.scatter('corkboard', 14);
  L.scatter('graffiti', 10);
  L.scatter('boxStack', 18);
  L.scatter('mopBucket', 6);
  L.scatter('picture', 16);
  // ---------------------------------------------------------------- scares
  L.scare('phoneRing', { x: 30, z: 116, radius: 7 });
  L.scare('faceInHall', { x: 55, z: 52, radius: 6 });
  L.scare('mirrorFigure', { x: 68, z: 22, radius: 5 });
  L.scare('shadowCross', { x: 90, z: 70, radius: 7 });
  L.scare('lightsOut', { x: 36, z: 84, radius: 8 });
  L.scare('doorSlam', { x: 20, z: 26, radius: 6 });
  L.scare('crowdLaugh', { x: 112, z: 116, radius: 8 });
  L.scare('footstepsFollow', { x: 78, z: 100, radius: 8 });
  L.scare('tapeGlitch', { x: 128, z: 40, radius: 8 });
  L.scare('breathing', { x: 22, z: 118, radius: 5 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(6, 74, 0);

  L.trigger({ x: 66, z: 74, radius: 6, say: 'Every chair on this side of the floor is facing the same corner.' });
  L.trigger({ x: 120, z: 120, radius: 5, objective: 'obj1', say: 'A keycard, still clipped to a lanyard.' });
  L.trigger({ x: 138, z: 74, radius: 6, say: 'The lobby lights are on. All of them. It is the only place on the floor that is.' });

  L.room(134, 66, 144, 82, { floor: 'marble', wall: 'woodPanel', ceil: 'ceilPanel' });
  L.light({ x: 139, z: 74, y: 2.8, color: 0xfff4e0, intensity: 1.5, radius: 14, fixture: 'panel' });
  L.prop('elevatorDoors', { x: 143, z: 74, rot: -Math.PI / 2 });
  L.prop('plant', { x: 136, z: 68 });
  L.prop('sofa', { x: 136, z: 80, rot: Math.PI / 2 });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('flicker');
  L.hideSpots('cubicle', 10);
  L.monsterFar('mannequin', { tell: 'mannequinScrape', speed: 6.4, patience: 2.0, wanders: 40, checksHides: 0.35 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 143, z: 74 });

  return L.finish();
}
