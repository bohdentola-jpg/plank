// The playbook. Offense attacks +X; alignments are [x, z] relative to the ball.
// Routes are waypoint lists [dx, dzInside] — dzInside > 0 bends toward midfield.
import { mkCanvas } from './textures.js';

export const OL_ALIGN = { LT: [-0.7, -2.6], LG: [-0.7, -1.3], C: [-0.7, 0], RG: [-0.7, 1.3], RT: [-0.7, 2.6] };

export const OFFENSE_PLAYS = [
  {
    id: 'dive', name: 'HB Dive', type: 'run', shotgun: false,
    desc: 'Smashmouth. Follow the fullback through the A-gap.',
    align: { QB: [-1.6, 0], FB: [-4.2, 0], RB: [-6.4, 0], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: 'RB',
    handoff: { x: -2.4, z: 0.4 },
    paths: { RB: [[2.5, 0.8], [9, 1.4], [40, 1.8]], FB: [[2.2, 0.6], [4.5, 0.8]] },
    assignments: { WR1: { route: [[10, 0], [24, 0]] }, WR2: { route: [[10, 0], [24, 0]] }, TE: { block: true }, FB: { leadBlock: true } },
    targets: [],
  },
  {
    id: 'toss', name: 'HB Toss', type: 'run', shotgun: false, toss: true,
    desc: 'Get the edge. Pitch wide and turn the corner.',
    align: { QB: [-1.6, 0], FB: [-4.2, 0.8], RB: [-6.0, -1.2], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: 'RB',
    paths: { RB: [[-0.5, 7], [3, 11.5], [10, 14], [40, 15]], FB: [[1.5, 6], [3.5, 9]] },
    assignments: { WR1: { route: [[12, 0]] }, WR2: { block: true }, TE: { block: true }, FB: { leadBlock: true } },
    targets: [],
  },
  {
    id: 'sneak', name: 'QB Sneak', type: 'run', shotgun: false,
    desc: 'Lean on the center. One tough yard.',
    align: { QB: [-1.6, 0], FB: [-4.2, 0], RB: [-6.4, 0], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: 'QB',
    paths: { QB: [[2.5, 0.3], [12, 0.5]], RB: [[2, -1], [4, -2]], FB: [[2, 1], [4, 2]] },
    assignments: { WR1: { block: true }, WR2: { block: true }, TE: { block: true }, FB: { leadBlock: true } },
    targets: [],
  },
  {
    id: 'slants', name: 'Quick Slants', type: 'pass', shotgun: true,
    desc: 'Three steps and throw. Take what they give you.',
    align: { QB: [-5.2, 0], RB: [-5.2, -1.9], FB: [-0.9, -7.5], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: null,
    assignments: {
      WR1: { route: [[2.5, 0], [9, 5.5], [16, 11]] },
      WR2: { route: [[2.5, 0], [9, 5.5], [16, 11]] },
      TE:  { route: [[1.5, -2.5], [3, -7], [3.5, -11]] },
      RB:  { route: [[1.5, -3], [2.5, -7]] },
      FB:  { route: [[2.5, 0], [8, 4]] },
    },
    targets: ['WR1', 'WR2', 'TE', 'RB'],
  },
  {
    id: 'curls', name: 'Curl Flood', type: 'pass', shotgun: true,
    desc: 'Hooks at the sticks, back to the ball.',
    align: { QB: [-5.2, 0], RB: [-5.2, 1.9], FB: [-0.9, -7.5], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: null,
    assignments: {
      WR1: { route: [[10.5, 0], [9, 1]] },
      WR2: { route: [[10.5, 0], [9, 1]] },
      TE:  { route: [[8, 1.5], [16, 3]] },
      RB:  { route: [[0.5, -4.5], [1.5, -9]] },
      FB:  { route: [[6, 0], [5.5, 1]] },
    },
    targets: ['WR1', 'WR2', 'TE', 'RB'],
  },
  {
    id: 'pa_post', name: 'PA Post Shot', type: 'pass', shotgun: false, playAction: true,
    desc: 'Sell the dive, then take the top off.',
    align: { QB: [-1.6, 0], FB: [-4.2, 0], RB: [-6.4, 0], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: null,
    assignments: {
      WR1: { route: [[11, 0], [26, 9]] },
      WR2: { route: [[11, 0], [24, -8]] },
      TE:  { route: [[2, -1], [6, -9], [8, -14]] },
      RB:  { block: true },
      FB:  { block: true },
    },
    targets: ['WR1', 'WR2', 'TE'],
  },
  {
    id: 'verts', name: 'Four Verticals', type: 'pass', shotgun: true,
    desc: 'Everybody go. Pick a matchup and let it rip.',
    align: { QB: [-5.2, 0], RB: [-5.2, -1.9], FB: [-0.9, 7.5], WR1: [-0.9, -13], WR2: [-1.5, 11], TE: [-0.7, 3.9] },
    carrier: null,
    assignments: {
      WR1: { route: [[14, 0], [34, 1]] },
      WR2: { route: [[14, 0], [34, 1]] },
      TE:  { route: [[12, 1.5], [30, 3]] },
      FB:  { route: [[14, -1], [32, -2]] },
      RB:  { route: [[1, -4], [2.5, -8.5]] },
    },
    targets: ['WR1', 'WR2', 'TE', 'FB'],
  },
];

export const DEFENSE_PLAYS = [
  {
    id: 'base', name: '4-3 Base', desc: 'Sound man coverage, four-man rush.',
    rush: ['DE1', 'DT1', 'DT2', 'DE2'],
    man: { CB1: 'WR1', CB2: 'WR2', SS: 'TE', MLB: 'RB', OLB1: 'FB' },
    zone: { OLB2: [5, 4], FS: [13, 0] },
  },
  {
    id: 'blitz', name: 'LB Blitz', desc: 'Send the house. Win now or get burned.',
    rush: ['DE1', 'DT1', 'DT2', 'DE2', 'MLB', 'OLB1'],
    man: { CB1: 'WR1', CB2: 'WR2', SS: 'TE', OLB2: 'RB', FS: 'FB' },
    zone: {},
  },
  {
    id: 'cover2', name: 'Cover 2', desc: 'Two deep halves, sit in the zones.',
    rush: ['DE1', 'DT1', 'DT2', 'DE2'],
    man: {},
    zone: { CB1: [3, -11], CB2: [3, 11], OLB1: [6, -5], MLB: [7, 0], OLB2: [6, 5], FS: [15, -8], SS: [15, 8] },
  },
  {
    id: 'goalline', name: 'Goal Line', desc: 'All eleven in the box. Nothing inside.',
    rush: ['DE1', 'DT1', 'DT2', 'DE2', 'OLB1', 'OLB2'],
    man: { CB1: 'WR1', CB2: 'WR2', SS: 'TE', MLB: 'RB', FS: 'FB' },
    zone: {},
    press: true,
  },
];

export const DEF_ALIGN = {
  DE1: [0.8, -3.3], DT1: [0.8, -1.1], DT2: [0.8, 1.1], DE2: [0.8, 3.3],
  OLB1: [4.0, -3.6], MLB: [4.4, 0], OLB2: [4.0, 3.6],
  CB1: [5.5, -12.5], CB2: [5.5, 10.5], FS: [12, -1.5], SS: [8.5, 4.5],
};

// ------------------------------------------------------------- play art
function arrow(ctx, pts, color, dashed = false) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.setLineDash(dashed ? [6, 5] : []);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
  ctx.setLineDash([]);
  const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 10 * Math.cos(a - 0.45), y2 - 10 * Math.sin(a - 0.45));
  ctx.lineTo(x2 - 10 * Math.cos(a + 0.45), y2 - 10 * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fill();
}

/** Chalkboard diagram for an offensive play. */
export function drawPlayArt(play) {
  const W = 248, H = 178;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#10231a';
  ctx.fillRect(0, 0, W, H);
  // map field coords: z → canvas x, x (upfield) → canvas -y. Ball at (W/2, H-58).
  const bx = W / 2, by = H - 58, s = 4.4;
  const px = (x, z) => [bx + z * s, by - x * s];
  // LOS + yard dashes
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, by); ctx.lineTo(W - 8, by); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  for (let yd = 5; yd <= 25; yd += 5) {
    const [, yy] = px(yd, 0);
    if (yy < 6) break;
    ctx.beginPath(); ctx.moveTo(8, yy); ctx.lineTo(W - 8, yy); ctx.stroke();
  }
  const O = (x, z, label = '') => {
    const [cx, cy] = px(x, z);
    ctx.strokeStyle = '#f3efe2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.5, 0, Math.PI * 2);
    ctx.stroke();
    return [cx, cy];
  };
  // OL
  for (const k in OL_ALIGN) O(OL_ALIGN[k][0], OL_ALIGN[k][1]);
  const inside = (z) => (z <= 0 ? 1 : -1);
  for (const role in play.align) {
    const [ax, az] = play.align[role];
    const [cx, cy] = O(ax, az);
    const asg = play.assignments?.[role];
    if (asg?.route) {
      const pts = [[cx, cy]];
      let wx = ax, wz = az;
      for (const [dx, dzi] of asg.route) {
        wx = ax + dx;
        wz = az + dzi * inside(az);
        pts.push(px(wx, wz));
      }
      arrow(ctx, pts, '#ffd84a');
    } else if (asg?.block || asg?.leadBlock) {
      const [ex, ey] = px(ax + 1.6, az);
      ctx.strokeStyle = '#9fd0ff';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex - 6, ey); ctx.lineTo(ex + 6, ey); ctx.stroke();
    }
    if (play.paths?.[role] && play.carrier === role) {
      const pts = [[cx, cy]];
      for (const [dx, dz] of play.paths[role]) {
        const [qx, qy] = px(ax + Math.min(dx, 24), dz);
        pts.push([qx, Math.max(qy, 8)]);
      }
      arrow(ctx, pts, '#ff7a4a');
    }
  }
  return cv;
}

/** Chalkboard diagram for a defensive call. */
export function drawDefArt(play) {
  const W = 248, H = 178;
  const cv = mkCanvas(W, H);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#231016';
  ctx.fillRect(0, 0, W, H);
  const bx = W / 2, by = 52, s = 4.4;
  const px = (x, z) => [bx + z * s, by + x * s];
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(8, by); ctx.lineTo(W - 8, by); ctx.stroke();
  const X = (x, z) => {
    const [cx, cy] = px(x, z);
    ctx.strokeStyle = '#f3efe2';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 5, cy - 5); ctx.lineTo(cx + 5, cy + 5);
    ctx.moveTo(cx + 5, cy - 5); ctx.lineTo(cx - 5, cy + 5);
    ctx.stroke();
    return [cx, cy];
  };
  for (const role in DEF_ALIGN) {
    const [ax, az] = DEF_ALIGN[role];
    const dx = play.press && (role === 'CB1' || role === 'CB2') ? 1.5 : ax;
    const [cx, cy] = X(dx, az);
    if (play.rush.includes(role)) {
      arrow(ctx, [[cx, cy], [cx, cy - (ax + 2.2) * s]], '#ff5a4a');
    } else if (play.zone[role]) {
      const [zx, zz] = play.zone[role];
      const [ex, ey] = px(zx, zz);
      ctx.strokeStyle = '#7ad0ff';
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 17, 13, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // man
      ctx.fillStyle = '#ffd84a';
      ctx.font = '700 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('M', cx, cy - 9);
    }
  }
  return cv;
}
