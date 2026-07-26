// Do arriving guests ever use the front doors the lobby is built around?
const stubCtx = () => new Proxy({}, { get: (t, p) => (p === 'measureText' ? () => ({ width: 10 }) : typeof p === 'string' ? () => {} : undefined), set: () => true });
globalThis.document = { createElement: () => ({ width: 0, height: 0, style: {}, getContext: stubCtx }), getElementById: () => null, querySelector: () => null, addEventListener() {} };
globalThis.window = globalThis;
globalThis.performance ??= { now: () => Date.now() };

const nav = await import('../hotel/src/nav.js');
const sim = await import('../hotel/src/sim.js');

// World geometry, straight out of world.js buildLobby().
const HALF_W = nav.HALF_W;                       // side walls at +/- HALF_W, z in [-5.25, 2.75]
const SIDE_Z = [(nav.LOBBY_BACK + nav.RAIL_Z) / 2 - 4, (nav.LOBBY_BACK + nav.RAIL_Z) / 2 + 4];
const GLASS = [[-HALF_W, nav.DOOR_X - 1.9], [nav.DOOR_X + 1.9, HALF_W]];   // panes at z = RAIL_Z
const DOOR_GAP = [nav.DOOR_X - 1.9, nav.DOOR_X + 1.9];

const s = sim.newHotel();
console.log(`lobby: side walls at x = +/-${HALF_W} (z ${SIDE_Z[0]}..${SIDE_Z[1]}), glazing at z = ${nav.RAIL_Z}`);
console.log(`doorway gap: x in (${DOOR_GAP[0]}, ${DOOR_GAP[1]}), door centre x = ${nav.DOOR_X}\n`);

let throughGlass = 0, throughSideWall = 0, throughDoor = 0;
for (let i = 0; i < 15; i++) {
  const start = nav.street(i);
  const target = nav.queueSpot(i % 12);
  const pts = [{ x: start.x, y: 0, z: start.z }, ...nav.pathTo(s, { ...start, y: 0 }, target)];
  const notes = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    // crossing the glazing plane z = RAIL_Z
    if ((a.z - nav.RAIL_Z) * (b.z - nav.RAIL_Z) < 0) {
      const t = (nav.RAIL_Z - a.z) / (b.z - a.z);
      const x = a.x + (b.x - a.x) * t;
      const inDoor = x > DOOR_GAP[0] && x < DOOR_GAP[1];
      const inGlass = GLASS.some(([lo, hi]) => x > lo && x < hi);
      notes.push(`crosses the shopfront plane at x=${x.toFixed(2)} -> ${inDoor ? 'THROUGH THE DOORS' : inGlass ? 'THROUGH THE PLATE GLASS' : 'outside the building'}`);
      if (inDoor) throughDoor++; else if (inGlass) throughGlass++;
    }
    // crossing a side wall plane x = +/- HALF_W within the wall's z span
    for (const sx of [-HALF_W, HALF_W]) {
      if ((a.x - sx) * (b.x - sx) < 0) {
        const t = (sx - a.x) / (b.x - a.x);
        const z = a.z + (b.z - a.z) * t;
        if (z > SIDE_Z[0] && z < SIDE_Z[1]) {
          notes.push(`crosses the side wall x=${sx} at z=${z.toFixed(2)} -> THROUGH THE WALL`);
          throughSideWall++;
        }
      }
    }
  }
  console.log(`arrival ${String(i).padStart(2)} from (${start.x.toFixed(1)}, ${start.z.toFixed(1)}): ${notes.join(' | ') || 'no facade crossing'}`);
}
console.log(`\nthrough the doors: ${throughDoor} · through the glass: ${throughGlass} · through a side wall: ${throughSideWall}`);
console.log(`nav.entrance() exists and returns ${JSON.stringify(nav.entrance())} but nothing in the repo calls it.`);
