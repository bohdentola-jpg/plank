// Canvas helpers with no three.js in them, on purpose: the EB GAMES launcher
// draws its box art with these, and the shelf has no business loading a 3D
// library to paint a cardboard box.
export function mkCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

/** Lighten (amt > 0) or darken a #rrggbb hex by a flat amount per channel. */
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(v + amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function contrastText(hex) { return luminance(hex) > 0.55 ? '#16181d' : '#f6f6f4'; }
