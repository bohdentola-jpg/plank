// Screen effects drawn over the car: vignette and film grain.
import { view } from '../engine.js';
import { noiseCanvas, makeCanvas } from '../ink.js';

// ---------------------------------------------------------------- screen fx

let vignette = null, vigKey = '';
let grain = null, grainPattern = null;

export function drawScreenFx(g, t, o = {}) {
  const W = g.canvas.width, H = g.canvas.height;
  const key = `${W}x${H}:${o.tint || ''}`;
  if (key !== vigKey) {
    vignette = makeCanvas(W, H);
    const vg = vignette.getContext('2d');
    const r = Math.hypot(W, H) / 2;
    const grad = vg.createRadialGradient(W / 2, H * 0.55, r * 0.35, W / 2, H * 0.5, r * 1.05);
    grad.addColorStop(0, 'rgba(8,4,20,0)');
    grad.addColorStop(1, o.tint || 'rgba(8,4,20,0.7)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, W, H);
    vigKey = key;
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(vignette, 0, 0);
  if (view.quality >= 1 && !o.noGrain) {
    if (!grain) {
      grain = noiseCanvas(192, 13, 34);
      grainPattern = g.createPattern(grain, 'repeat');
    }
    const fr = Math.floor(t * 12);
    g.save();
    g.globalCompositeOperation = 'overlay';
    g.globalAlpha = 0.55;
    g.translate((fr * 67) % 192, (fr * 131) % 192);
    g.fillStyle = grainPattern;
    g.fillRect(-192, -192, W + 384, H + 384);
    g.restore();
  }
}
