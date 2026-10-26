// A snapshot of everything the 3D world needs to draw one moment of a play:
// every body on the field, the ball and the officials. The match screen
// captures one each sim step, the world draws it, and the replay deck keeps
// the stream so a play can be shown again from any camera.

/** Plain-data copy of the sim's state (no references back into the sim). */
export function captureFrame(m, refs = null) {
  const ents = [];
  for (const e of m.active) {
    const a = e.action;
    let eng = null;
    const rec = e.engaged;
    if (rec && !rec.done) {
      const o = rec.a === e ? rec.b : rec.a;
      const dx = o.x - e.x, dz = o.z - e.z, l = Math.hypot(dx, dz) || 1;
      eng = { dx: dx / l, dz: dz / l, push: rec.a === e ? -(rec.bal || 0) : (rec.bal || 0) };
    }
    ents.push({
      id: e.id, side: e.side, role: e.role,
      x: e.x, z: e.z, y: e.y || 0, h: e.heading || 0, vx: e.vx, vz: e.vz, vTop: e.vTop || 9,
      base: e.base,
      act: a ? { name: a.name, t: a.t, side: a.side, power: a.power } : null,
      carry: e.carry,
      look: e.look ? { x: e.look.x, y: e.look.y ?? 1.5, z: e.look.z } : null,
      reach: e.reachAt ? { x: e.reachAt.x, y: e.reachAt.y, z: e.reachAt.z } : null,
      eng,
      ws: e.want?.s || 0,
      state: e.state,
    });
  }
  const b = m.ball;
  const ball = {
    st: b.state, kind: b.kind, x: b.x, y: b.y, z: b.z, vx: b.vx || 0, vy: b.vy || 0, vz: b.vz || 0,
    car: b.carrier ? b.carrier.id : null, carry: b.carrier ? b.carrier.carry : null,
    spin: b.spin || 0, tumble: b.tumble || 0, t: b.t || 0,
    tee: m.playKind === 'kickoff' && !m.kickoff?.kicked && !b.carrier && b.state !== 'air',
  };
  return { t: m.time, playT: m.playT, phase: m.phase, ents, ball, refs: refs ? refs.map((r) => ({ ...r, act: r.act ? { ...r.act } : null, look: r.look ? { ...r.look } : null })) : null };
}
