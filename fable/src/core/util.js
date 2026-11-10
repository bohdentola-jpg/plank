// Small math + helper toolbox shared by every module.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
/** Frame-rate independent exponential approach. */
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
export const sign = (v) => (v < 0 ? -1 : 1);

export function wrapAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
export function angleDamp(a, b, lambda, dt) {
  return a + wrapAngle(b - a) * (1 - Math.exp(-lambda * dt));
}
/** Move a toward b by at most step. */
export function approach(a, b, step) {
  return a < b ? Math.min(a + step, b) : Math.max(a - step, b);
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed = 1) {
  let s = seed >>> 0;
  const r = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}

export const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export function shuffle(arr, r = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const ease = {
  linear: (t) => t,
  in2: (t) => t * t,
  out2: (t) => 1 - (1 - t) * (1 - t),
  inOut2: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  out3: (t) => 1 - Math.pow(1 - t, 3),
  in3: (t) => t * t * t,
  inOut3: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Circle (x,z,r) vs axis-aligned box {x,z,w,d} centred — returns push-out vector or null. */
export function circleBoxPush(cx, cz, r, b) {
  const hx = b.w / 2, hz = b.d / 2;
  const dx = cx - b.x, dz = cz - b.z;
  const px = clamp(dx, -hx, hx), pz = clamp(dz, -hz, hz);
  const ox = dx - px, oz = dz - pz;
  const d2 = ox * ox + oz * oz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    return { x: (ox / d) * (r - d), z: (oz / d) * (r - d) };
  }
  // centre is inside the box: push out along the shallowest axis
  const penX = hx - Math.abs(dx) + r, penZ = hz - Math.abs(dz) + r;
  return penX < penZ ? { x: sign(dx) * penX, z: 0 } : { x: 0, z: sign(dz) * penZ };
}

export function circleCirclePush(cx, cz, r, ox, oz, or) {
  const dx = cx - ox, dz = cz - oz;
  const rr = r + or;
  const d2 = dx * dx + dz * dz;
  if (d2 >= rr * rr) return null;
  const d = Math.sqrt(d2) || 0.0001;
  return { x: (dx / d) * (rr - d), z: (dz / d) * (rr - d) };
}

export function pointInBox(x, z, b, pad = 0) {
  return Math.abs(x - b.x) <= b.w / 2 + pad && Math.abs(z - b.z) <= b.d / 2 + pad;
}

/** Segment (a→b) vs circle test, for line-of-sight and ball paths. */
export function segCircle(ax, az, bx, bz, cx, cz, r) {
  const abx = bx - ax, abz = bz - az;
  const l2 = abx * abx + abz * abz || 1e-9;
  const t = clamp01(((cx - ax) * abx + (cz - az) * abz) / l2);
  const px = ax + abx * t, pz = az + abz * t;
  return (px - cx) * (px - cx) + (pz - cz) * (pz - cz) <= r * r;
}

export function segBox(ax, az, bx, bz, b, pad = 0) {
  // slab test against the AABB
  const minx = b.x - b.w / 2 - pad, maxx = b.x + b.w / 2 + pad;
  const minz = b.z - b.d / 2 - pad, maxz = b.z + b.d / 2 + pad;
  let t0 = 0, t1 = 1;
  const dx = bx - ax, dz = bz - az;
  for (const [p, d, mn, mx] of [[ax, dx, minx, maxx], [az, dz, minz, maxz]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < mn || p > mx) return false;
    } else {
      let a = (mn - p) / d, c = (mx - p) / d;
      if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, c);
      if (t0 > t1) return false;
    }
  }
  return true;
}

export const ordinal = (n) => ['0th', '1st', '2nd', '3rd', '4th'][n] || `${n}th`;
export const fmtTime = (s) => {
  s = Math.max(0, Math.ceil(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Tiny DOM builder: el('div.cls#id', {attrs}, children...) */
export function el(spec, attrs, ...kids) {
  const m = spec.match(/^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i);
  const tag = (m && m[1]) || 'div';
  const node = document.createElement(tag);
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g) || []) {
      if (part[0] === '.') node.classList.add(part.slice(1));
      else node.id = part.slice(1);
    }
  }
  if (attrs && (typeof attrs !== 'object' || attrs.nodeType || Array.isArray(attrs))) {
    kids.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else node.setAttribute(k, v === true ? '' : v);
    }
  }
  const add = (k) => {
    if (k === null || k === undefined || k === false) return;
    if (Array.isArray(k)) k.forEach(add);
    else node.appendChild(k.nodeType ? k : document.createTextNode(String(k)));
  };
  kids.forEach(add);
  return node;
}

export const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
/** *emphasis* → <b>, with HTML escaped first. */
export const rich = (s) => escapeHtml(s).replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
