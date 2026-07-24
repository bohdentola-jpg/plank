// What you can carry. Ten things, and eight of them are about light.

export const ITEM_DEFS = {
  battery: {
    name: 'D-CELL',
    tag: 'camcorder + torch',
    stack: 9,
    color: '#c8a02a',
    say: 'A battery. The camera drinks these.',
    use: (g) => { g.camBattery = Math.min(100, g.camBattery + 45); g.lampBattery = Math.min(100, g.lampBattery + 45); },
    auto: false,
  },
  almondWater: {
    name: 'ALMOND WATER',
    tag: 'health + a moment of calm',
    stack: 6,
    color: '#e8e2c8',
    say: 'Almond water. Room temperature, as always.',
    use: (g) => { g.hp = Math.min(100, g.hp + 30); g.sanity = Math.min(100, g.sanity + 34); },
  },
  medkit: {
    name: 'FIRST AID TIN',
    tag: 'health',
    stack: 3,
    color: '#c83a3a',
    say: 'A tin of bandages and iodine.',
    use: (g) => { g.hp = Math.min(100, g.hp + 60); },
  },
  glowstick: {
    name: 'GLOWSTICK',
    tag: 'throwable light, lasts',
    stack: 12,
    color: '#50ff90',
    say: 'Glowsticks. Snap, shake, throw.',
    throwable: true,
    light: { color: 0x60ff90, intensity: 1.1, radius: 8, life: 600 },
  },
  flare: {
    name: 'ROAD FLARE',
    tag: 'bright, hot, most things hate it',
    stack: 6,
    color: '#ff5a2a',
    say: 'Road flares. Nothing likes these.',
    throwable: true,
    scary: true,
    light: { color: 0xff7038, intensity: 2.6, radius: 14, life: 70 },
  },
  tape: {
    name: 'TAPE',
    tag: 'someone else\'s last recording',
    stack: 99,
    color: '#2a2a2e',
    say: 'A tape. Somebody labelled it and then stopped writing.',
    collectible: true,
  },
  key: {
    name: 'KEY',
    tag: 'opens one specific thing',
    stack: 9,
    color: '#b8a06a',
    say: 'A key with a fob. The number is worn off.',
  },
  keycard: {
    name: 'KEYCARD',
    tag: 'maintenance access',
    stack: 9,
    color: '#3a6a9a',
    say: 'A maintenance card. Still warm, which is odd.',
  },
  fuse: {
    name: 'FUSE',
    tag: 'for the levels that lost their power',
    stack: 9,
    color: '#8a8a2a',
    say: 'A ceramic fuse, unbroken.',
  },
  crowbar: {
    name: 'CROWBAR',
    tag: 'opens boarded doors',
    stack: 1,
    color: '#6a3a2a',
    say: 'A crowbar. Heavier than it looks, which is comforting.',
  },
};

// A tiny canvas icon per item for the HUD — drawn once, cached by the HUD.
export function itemIcon(type, size = 34) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const ctx = cv.getContext('2d');
  const c = ITEM_DEFS[type]?.color || '#cccccc';
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = c;
  ctx.fillStyle = c;
  ctx.lineWidth = 2;
  const s = size;
  switch (type) {
    case 'battery':
      ctx.fillRect(s * 0.3, s * 0.18, s * 0.4, s * 0.62);
      ctx.fillRect(s * 0.42, s * 0.1, s * 0.16, s * 0.08);
      break;
    case 'almondWater':
      ctx.fillRect(s * 0.3, s * 0.22, s * 0.4, s * 0.6);
      ctx.strokeRect(s * 0.34, s * 0.3, s * 0.32, s * 0.2);
      break;
    case 'medkit':
      ctx.fillRect(s * 0.18, s * 0.3, s * 0.64, s * 0.44);
      ctx.fillStyle = '#f4f2e8';
      ctx.fillRect(s * 0.46, s * 0.38, s * 0.08, s * 0.28);
      ctx.fillRect(s * 0.36, s * 0.48, s * 0.28, s * 0.08);
      break;
    case 'glowstick':
    case 'flare':
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(s * 0.24, s * 0.76);
      ctx.lineTo(s * 0.74, s * 0.24);
      ctx.stroke();
      break;
    case 'tape':
      ctx.strokeRect(s * 0.14, s * 0.28, s * 0.72, s * 0.44);
      ctx.beginPath(); ctx.arc(s * 0.36, s * 0.5, s * 0.09, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.arc(s * 0.64, s * 0.5, s * 0.09, 0, 7); ctx.stroke();
      break;
    case 'key':
      ctx.beginPath(); ctx.arc(s * 0.34, s * 0.36, s * 0.14, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.44, s * 0.46); ctx.lineTo(s * 0.76, s * 0.78); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(s * 0.62, s * 0.64); ctx.lineTo(s * 0.72, s * 0.54); ctx.stroke();
      break;
    case 'keycard':
      ctx.fillRect(s * 0.16, s * 0.32, s * 0.68, s * 0.4);
      ctx.fillStyle = '#12161c';
      ctx.fillRect(s * 0.22, s * 0.4, s * 0.3, s * 0.1);
      break;
    case 'fuse':
      ctx.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.4);
      ctx.fillStyle = '#d8d0b0';
      ctx.fillRect(s * 0.28, s * 0.3, s * 0.44, s * 0.08);
      break;
    case 'crowbar':
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s * 0.72, s * 0.2);
      ctx.lineTo(s * 0.34, s * 0.72);
      ctx.lineTo(s * 0.2, s * 0.62);
      ctx.stroke();
      break;
    default:
      ctx.fillRect(s * 0.3, s * 0.3, s * 0.4, s * 0.4);
  }
  return cv;
}
