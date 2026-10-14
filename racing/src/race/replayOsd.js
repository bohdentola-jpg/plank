// The replay's on-screen display: a VCR's transport and tape counter, who
// the camera is following and from where, and the controls.
import { C, vText, text, hints, osd } from '../core/ui.js';

const GREEN = '#d8ffd8';

function transportIcon(ctx, kind, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = 'rgba(160,255,160,0.5)';
  ctx.shadowBlur = 6;
  const tri = (x0, dir) => {
    ctx.beginPath();
    ctx.moveTo(x0, y - s / 2);
    ctx.lineTo(x0 + dir * s * 0.8, y);
    ctx.lineTo(x0, y + s / 2);
    ctx.closePath();
    ctx.fill();
  };
  if (kind === 'play') tri(x, 1);
  else if (kind === 'ff') { tri(x, 1); tri(x + s * 0.7, 1); }
  else if (kind === 'rew') { tri(x + s * 0.8, -1); tri(x + s * 1.5, -1); }
  else if (kind === 'pause') { ctx.fillRect(x, y - s / 2, s * 0.28, s); ctx.fillRect(x + s * 0.5, y - s / 2, s * 0.28, s); }
  ctx.restore();
}

const timecode = (t) => {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60), sec = Math.floor(s % 60), fr = Math.floor((s % 1) * 30);
  return `${m}:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
};

export function drawReplayOSD(ctx, rp, session, time) {
  const st = rp.status();
  // transport, top left (the label blinks while paused, like a real deck)
  const blinkOff = st.icon === 'pause' && Math.floor(time * 2) % 2 === 1;
  transportIcon(ctx, st.icon, 58, 62, 26, GREEN);
  if (!blinkOff) osd(ctx, st.label, st.icon === 'ff' || st.icon === 'rew' ? 112 : 92, 74, 30, GREEN);
  // tape counter, top right
  osd(ctx, `SP ${timecode(rp.t)}`, 968, 74, 30, GREEN, 'right');
  const w = 220, x0 = 968 - w, y0 = 90;
  ctx.fillStyle = 'rgba(216,255,216,0.18)';
  ctx.fillRect(x0, y0, w, 3);
  ctx.fillStyle = GREEN;
  ctx.fillRect(x0, y0, w * Math.min(1, rp.t / Math.max(0.01, rp.duration)), 3);

  // who and where, bottom left
  const r = rp.focusRacer;
  vText(ctx, 'INSTANT REPLAY', 56, 628, 22, { color: C.accent || '#ffb000' });
  text(ctx, 'FOLLOWING', 56, 656, { size: 13, weight: 700, color: C.dim, spacing: 2 });
  text(ctx, `${r.name}  ·  ${r.spec.make} ${r.spec.model}`, 160, 656, { size: 15, weight: 800, color: r.isPlayer ? '#7fe8ff' : C.text, spacing: 1 });
  text(ctx, 'CAMERA', 56, 680, { size: 13, weight: 700, color: C.dim, spacing: 2 });
  text(ctx, `${rp.shotName}  ·  ${rp.modeName}`, 160, 680, { size: 15, weight: 800, color: C.text, spacing: 1 });

  hints(ctx, [['confirm', 'PLAY'], ['tabL', 'REW'], ['tabR', 'FF'], ['lr', 'CAR'], ['camera', 'CAMERA'], ['back', 'EXIT']]);
}
