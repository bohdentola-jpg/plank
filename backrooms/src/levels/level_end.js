// LEVEL 3999 — THE TERMINUS
// A freight terminal at the edge of whatever this is. Loading docks, a flooded
// dock basin, a rail head with a train that has steam up and a control room above
// the platform. The roller doors at the end of the platform lead out, and out is a
// direction that has not been available since the lobby.
//
// This is the finale, so it is built as a sequence: reach the control room, put the
// power back on the door, then get down the platform while every single thing on
// the tape arrives at once.

export const meta = {
  id: 'level_end',
  num: '3999',
  name: 'THE TERMINUS',
  subtitle: 'freight only',
  tagline: 'The train has steam up. Nobody knows who lit it.',
  danger: 10,
  survival: 'if you do not stop for anything',
  chapter: 23,
  tape: 'TAPE 21',
  brief: `Docks, a rail head, and a way out. Restore the door power in the control
    room, then run the platform. Everything comes at once. Get on the train.`,
};

export function build(kit) {
  const { C } = kit;
  const L = kit.level({
    w: 150, h: 150, cell: 3.4, wallH: 12,
    palette: { wall: 'cinder', floor: 'concrete', ceil: 'metalPlate' },
    fog: { color: 0x0c0e10, density: 0.030 },
    ambient: { color: 0x1c2024, intensity: 0.16 },
  });
  L.setAmbience({ room: 'trainYard', hum: 0.6, drip: 0.45, wind: 0.3, music: 'chase', reverb: 0.8 });
  L.setRules({ sanityDrain: 1.4, batteryDrain: 1.1, chase: { after: 260, entity: 'hound', spawnRate: 26, max: 5 } });
  L.setTint(1.04, 0.98, 0.92);

  // ---------------------------------------------------------------- the shed
  // One enormous shed: tall, ribbed, arc-lit, with the rail head down the middle.
  L.fill(C.WALL);
  L.room(4, 4, 145, 145, { floor: 'concrete', wall: 'cinder', ceil: 'metalPlate' });
  L.ceilRect(4, 4, 145, 145, 12);
  kit.gen.hall(L, { x0: 8, z0: 8, x1: 141, z1: 141, every: kit.randInt(12, 16), h: 12, prop: 'pillarSquare', thick: true });

  // Rail head: ballast, rails, and the train, down the middle of the shed.
  for (let x = 10; x < 142; x++) {
    for (let z = 70; z < 80; z++) {
      L.paint(x, z, { floor: 'gravel' });
      L.floorAt(x, z, -0.4);
    }
  }
  L.prop('trainCar', { x: 100, z: 75, rot: Math.PI / 2 });
  L.prop('trainCar', { x: 118, z: 75, rot: Math.PI / 2 });
  L.prop('trainCar', { x: 136, z: 75, rot: Math.PI / 2 });
  for (let x = 12; x < 142; x += 10) {
    L.light({ x, z: 75, y: 11, color: 0xfff0d0, intensity: 1.3, radius: 20, fixture: 'flood', flicker: kit.chance(0.2) ? 0.2 : 0 });
  }

  // The platform: raised concrete along the north side of the rail head.
  for (let x = 10; x < 142; x++) {
    for (let z = 64; z < 70; z++) {
      L.floorAt(x, z, 1.0);
      L.paint(x, z, { floor: 'concrete' });
    }
  }
  L.ramp(60, 60, 60, 65, 0, 1.0, { width: 6 });
  L.ramp(112, 60, 112, 65, 0, 1.0, { width: 6 });
  for (let x = 14; x < 140; x += 12) L.prop('railing', { x, z: 69, len: 8, y: 1.0 });

  // ---------------------------------------------------------------- docks
  // Loading bays down the south wall, and a dock basin that has filled up.
  const bays = kit.randInt(6, 8);
  for (let i = 0; i < bays; i++) {
    const x = 14 + i * 16;
    L.room(x, 118, x + 12, 140, { floor: 'concrete', wall: 'concretePaint' });
    L.prop('doubleDoor', { x: x + 6, z: 141, rot: 0 });
    L.prop('pallet', { x: x + 3, z: 124, rot: kit.rand(0, 1) });
    L.prop('crateStack', { x: x + 8, z: 130 });
    L.light({ x: x + 6, z: 128, y: 8, color: 0xffc060, intensity: 0.9, radius: 14, fixture: 'cage', flicker: kit.rand(0, 0.4) });
  }
  L.room(10, 96, 60, 114, { floor: 'concreteWet', wall: 'concretePaint' });
  L.water(13, 99, 57, 111, { depth: 2.8, level: -0.2, floor: 'concreteWet', wall: 'concretePaint' });
  L.ramp(61, 105, 58, 105, 0, -1.0, { width: 5 });
  L.prop('drainGrate', { x: 34, z: 105, scale: 2 });

  // ---------------------------------------------------------------- control room
  // Up on the gantry above the platform, and the only way to power the doors.
  const cx = 76, cz = 52;
  L.room(cx, cz, cx + 18, cz + 10, { floor: 'metalPlate', wall: 'breakerWall', ceil: 'ductWall' });
  L.floorRect(cx, cz, cx + 18, cz + 10, 3.2);
  L.ceilRect(cx, cz, cx + 18, cz + 10, 7.0);
  L.ramp(cx - 8, cz + 5, cx, cz + 5, 0, 3.2, { width: 4 });
  for (let x = cx; x <= cx + 18; x++) L.set(x, cz + 11, C.GLASS);
  L.prop('serverRack', { x: cx + 3, z: cz + 3, y: 3.2 });
  L.prop('breakerBox', { x: cx + 8, z: cz + 1, y: 3.2 });
  L.prop('desk', { x: cx + 12, z: cz + 4, rot: 0, y: 3.2 });
  L.prop('crtMonitor', { x: cx + 12, z: cz + 3.6, y: 3.95 });
  L.prop('officeChair', { x: cx + 13, z: cz + 5, rot: 2, y: 3.2 });
  L.light({ x: cx + 9, z: cz + 5, y: 6.8, color: 0xe8f4ff, intensity: 1.3, radius: 16, fixture: 'panel', flicker: 0.06 });

  // ---------------------------------------------------------------- lights
  L.lightGrid(10, 10, 140, 60, { every: 14, color: 0xffe0a0, intensity: 1.0, radius: 20, fixture: 'flood', flickerChance: 0.2, deadChance: 0.08 });
  L.lightGrid(10, 84, 140, 140, { every: 14, color: 0xffb050, intensity: 0.9, radius: 18, fixture: 'flood', flickerChance: 0.25, deadChance: 0.12 });
  for (let i = 0; i < 24; i++) {
    const [x, z] = L.randomOpen();
    L.light({ x, z, y: 4, color: 0xff3a20, intensity: 0.5, radius: 8, fixture: 'emergencyLight', flicker: 0.3 });
  }

  // ---------------------------------------------------------------- dressing
  L.scatter('crateStack', 40);
  L.scatter('pallet', 50);
  L.scatter('barrel', 30);
  L.scatter('drum', 24);
  L.scatter('trolley', 20);
  L.scatter('pipeRun', 30, { opts: { len: 10, height: 9 } });
  L.scatter('ductRun', 18, { opts: { len: 12, height: 10 } });
  L.scatter('chainFence', 16, { opts: { len: 4 } });
  L.scatter('rubblePile', 20);
  L.scatter('graffiti', 26);
  L.scatter('clawMarks', 20);
  L.scatter('bloodTrail', 10);
  L.scatter('bodyBag', 4);
  L.scatter('shrine', 3);
  // Everything on the tape, in one shed.

  // ---------------------------------------------------------------- scares
  L.scare('waterStir', { x: 40, z: 100, radius: 9 });
  L.scare('bodyFall', { x: 100, z: 50, radius: 10 });
  L.scare('thingBehindYou', { x: cx + 9, z: cz + 12, radius: 6 });
  L.scare('lightBurst', { x: 60, z: 40, radius: 6 });
  L.scare('screamDistant', { x: 30, z: 70, radius: 14 });
  L.scare('footstepsFollow', { x: 110, z: 90, radius: 9 });
  L.scare('doorSlam', { x: 76, z: 120, radius: 8 });
  L.scare('crawlerDrop', { x: 130, z: 60, radius: 6 });
  L.scare('lightsOut', { x: 76, z: 66, radius: 14 });
  L.scare('staticBurst', { x: 20, z: 40, radius: 8 });
  L.scare('nameOnWall', { x: 140, z: 120, radius: 6 });

  // ---------------------------------------------------------------- the way out
  L.spawnAt(8, 130, -Math.PI / 2);

  L.trigger({ x: cx + 9, z: cz + 5, radius: 6, say: 'The manifest says OUTBOUND: 1, and the column has been empty for a very long time.' });
  L.trigger({ x: cx + 9, z: cz + 2, radius: 4, objective: 'obj1', wake: 'doors', say: 'The fuse goes in. Every light in the shed dies at once, and the doors start to move, and so does everything else.' });
  L.trigger({ x: 40, z: 68, radius: 8, say: 'The platform. Steam, and a shape in the flooded basin keeping pace with you.' });

  L.prop('elevatorDoors', { x: 14, z: 66, rot: -Math.PI / 2 });
  L.light({ x: 16, z: 66, y: 6, color: 0xfff0c0, intensity: 1.4, radius: 18, fixture: 'flood' });

  // ---------------------------------------------------------------- the floor
  // One thing lives here, there is cover, and the way out is a lift.
  L.gimmick('sparks');
  L.hideSpots('crate', 10);
  L.monsterFar('skinstealer', { tell: 'stealerWrong', speed: 5.0, patience: 2.6, sight: 1.4, wanders: 50, checksHides: 0.6 });
  L.objective('Find the service lift.');
  L.elevatorAt({ x: 14, z: 68 });

  return L.finish();
}
