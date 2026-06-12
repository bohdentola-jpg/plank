// Chunk → triangles. Hidden faces are culled, every visible corner gets
// smooth light (average of the four cells it touches) and classic
// three-neighbour ambient occlusion, fluids get lowered tops. Returns raw
// arrays — the renderer wraps them, tests can inspect them without WebGL.
import { CH, WORLD_H, OPAQUE, FLUID } from './world.js';
import { B, BLOCKS } from './blocks.js';

const CROSS = new Uint8Array(64);
for (const [id, b] of Object.entries(BLOCKS)) CROSS[id] = b.cross ? 1 : 0;

// face: outward dir, 4 corners (CCW from outside), which axes feed u/v
const FACES = [
  { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], shade: 0.78 },
  { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], shade: 0.78 },
  { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.55 },
  { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], shade: 0.86 },
  { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], shade: 0.86 },
];
const AO_LEVEL = [0.42, 0.62, 0.82, 1.0];

function faceUVs(face, corner, uv) {
  const [u0, v0, u1, v1] = uv;
  const [dx, dy] = face.d[1] !== 0 ? [0, 2] : [face.d[0] !== 0 ? 2 : 0, 1]; // axes for u,v
  const u = corner[dx] ? u1 : u0;
  let v;
  if (face.d[1] !== 0) v = corner[dy] ? v1 : v0;
  else v = corner[1] ? v1 : v0; // side faces keep textures upright
  return [u, v];
}

// a face shows iff its neighbour is see-through and not the same block type
const faceVisible = (id, nb) => !OPAQUE[nb] && nb !== id;

export function buildChunkMesh(world, chunk, uvFor) {
  const solid = { pos: [], uv: [], light: [], index: [] };
  const fluid = { pos: [], uv: [], light: [], index: [] };
  const x0 = chunk.cx * CH, z0 = chunk.cz * CH;
  const blocks = chunk.blocks;

  const lightOf = (x, y, z) => {
    const l = world.lightAt(x, y, z);
    return [((l >> 4) & 15) / 15, (l & 15) / 15];
  };

  const quad = (buf, pts, uvs, lights) => {
    const base = buf.pos.length / 3;
    for (let i = 0; i < 4; i++) {
      buf.pos.push(pts[i][0], pts[i][1], pts[i][2]);
      buf.uv.push(uvs[i][0], uvs[i][1]);
      buf.light.push(lights[i][0], lights[i][1]);
    }
    // flip the quad's diagonal toward the brighter pair: kills AO seams
    const a = lights[0][0] + lights[0][1] + lights[2][0] + lights[2][1];
    const b = lights[1][0] + lights[1][1] + lights[3][0] + lights[3][1];
    if (a >= b) buf.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else buf.index.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
  };

  for (let y = 0; y < WORLD_H; y++) {
    for (let z = 0; z < CH; z++) {
      for (let x = 0; x < CH; x++) {
        const id = blocks[x + (z << 4) + (y << 8)];
        if (id === B.air) continue;
        const wx = x0 + x, wz = z0 + z;
        const def = BLOCKS[id];
        const tiles = def.tiles;

        if (CROSS[id]) { // plants & torches: two crossed quads, both sides
          const uv = uvFor(tiles.all || tiles.side);
          const L = lightOf(wx, y, wz);
          const l4 = [L, L, L, L];
          const p = (ax, az, bx, bz) => [
            [wx + ax, y, wz + az], [wx + bx, y, wz + bz], [wx + bx, y + 1, wz + bz], [wx + ax, y + 1, wz + az],
          ];
          const uvq = [[uv[0], uv[1]], [uv[2], uv[1]], [uv[2], uv[3]], [uv[0], uv[3]]];
          const uvr = [[uv[2], uv[1]], [uv[0], uv[1]], [uv[0], uv[3]], [uv[2], uv[3]]];
          quad(solid, p(0.15, 0.15, 0.85, 0.85), uvq, l4);
          quad(solid, p(0.85, 0.85, 0.15, 0.15), uvr, l4);
          quad(solid, p(0.85, 0.15, 0.15, 0.85), uvq, l4);
          quad(solid, p(0.15, 0.85, 0.85, 0.15), uvr, l4);
          continue;
        }

        const isFluid = FLUID[id] === 1;
        const surf = isFluid && world.block(wx, y + 1, wz) !== id;
        const topY = isFluid && surf ? 0.875 : 1;

        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nb = world.block(wx + face.d[0], y + face.d[1], wz + face.d[2]);
          if (!faceVisible(id, nb)) continue;

          const tileName = f === 2 ? tiles.top || tiles.all
            : f === 3 ? tiles.bottom || tiles.all
            : (f === 4 || f === 0) && tiles.front ? tiles.front
            : tiles.side || tiles.all;
          const uv = uvFor(tileName);

          const pts = [], uvs = [], lights = [];
          const ax1 = face.d[0] !== 0 ? 1 : 0;          // tangent axes
          const ax2 = face.d[2] !== 0 ? 1 : 2;
          const nbase = [wx + face.d[0], y + face.d[1], wz + face.d[2]];

          for (let ci = 0; ci < 4; ci++) {
            const corner = face.c[ci];
            let cy = corner[1];
            if (isFluid && cy === 1) cy = topY;
            pts.push([wx + corner[0], y + cy, wz + corner[2]]);
            uvs.push(faceUVs(face, corner, uv));

            if (isFluid) { lights.push(lightOf(nbase[0], nbase[1], nbase[2])); continue; }

            // smooth light: average the 4 cells meeting at this corner
            const t1 = [0, 0, 0], t2 = [0, 0, 0];
            t1[ax1] = corner[ax1] ? 1 : -1;
            t2[ax2] = corner[ax2] ? 1 : -1;
            const cells = [
              nbase,
              [nbase[0] + t1[0], nbase[1] + t1[1], nbase[2] + t1[2]],
              [nbase[0] + t2[0], nbase[1] + t2[1], nbase[2] + t2[2]],
              [nbase[0] + t1[0] + t2[0], nbase[1] + t1[1] + t2[1], nbase[2] + t1[2] + t2[2]],
            ];
            let sky = 0, blk = 0, occ = 0;
            const o1 = OPAQUE[world.block(cells[1][0], cells[1][1], cells[1][2])];
            const o2 = OPAQUE[world.block(cells[2][0], cells[2][1], cells[2][2])];
            const oc = OPAQUE[world.block(cells[3][0], cells[3][1], cells[3][2])];
            for (let s = 0; s < 4; s++) {
              const cb = world.block(cells[s][0], cells[s][1], cells[s][2]);
              if (OPAQUE[cb]) continue;
              const l = world.lightAt(cells[s][0], cells[s][1], cells[s][2]);
              sky += ((l >> 4) & 15) / 15; blk += (l & 15) / 15; occ++;
            }
            const ao = AO_LEVEL[o1 && o2 ? 0 : 3 - (o1 + o2 + oc)];
            const denom = Math.max(1, occ);
            lights.push([(sky / denom) * ao * face.shade, (blk / denom) * ao * face.shade]);
          }
          quad(isFluid ? fluid : solid, pts, uvs, lights);
        }
      }
    }
  }

  const pack = (b) => ({
    pos: new Float32Array(b.pos), uv: new Float32Array(b.uv),
    light: new Float32Array(b.light), index: new Uint32Array(b.index),
    count: b.index.length,
  });
  return { solid: pack(solid), fluid: pack(fluid) };
}
