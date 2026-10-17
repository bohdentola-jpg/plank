// Getting put somewhere in PORT HALCYON: a spot on a road near a point,
// on the right-hand side, facing along the road (for fast travel, and for
// being put back on the road).
export function roadPointNear(net, x, z, rad = 3000) {
  const n = net.nearest(x, z, rad);
  if (!n) return { x, z, heading: 0 };
  const r = n.road;
  // a little way along from the very nearest sample, clear of a junction
  let i = n.i;
  const s = Math.max(r.trim0 + 4, Math.min(r.length - r.trim1 - 4, r.S[i]));
  const p = r.posAt(Number.isFinite(s) ? s : r.S[i]);
  i = p.i;
  // drive on the right, facing the way that points away from (x, z)… or
  // simply along the road
  const lat = -Math.min(r.rt.hw * 0.45, 3);
  return { x: r.X[i] + r.LX[i] * lat, z: r.Z[i] + r.LZ[i] * lat, heading: Math.atan2(r.TX[i], r.TZ[i]), road: r };
}
