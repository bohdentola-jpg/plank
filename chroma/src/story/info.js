// Story data: sectors, levels, Hue Cores, Lost Swatches and sky presets.
// Pure data (no THREE, no DOM) so every story module can import it.
//
// Ids: sector 1 keeps the original l1..l5 (old saves stay valid); sectors 2
// and 3 continue with l6..l15. Each level's first Lost Swatch uses the level
// id itself (that is what v1 saves stored); extra swatches are `${id}.2` etc.

const sw = (name, colors) => ({ name, colors });

export const INFO = {
  // ---------------------------------------------------------------- sector 1: the Paint Works
  l1: { num: 1, name: 'First Splash', core: 'Rose Core', color: '#ff3d7f', swatches: [sw('Bubblegum Dawn', ['#ffc2d9', '#ff6fa5', '#d81b60']), sw('Flamingo Fizz', ['#ffd6c9', '#ff8a7a', '#e2445c']), sw('Cherry Soda', ['#ffb3c1', '#ff4d6d', '#a4133c'])] },
  l2: { num: 2, name: 'Ghost Walk', core: 'Tide Core', color: '#22d3ee', swatches: [sw('Phantom Teal', ['#b2f5ff', '#38d6e8', '#0f8a9c']), sw('Glowworm Mint', ['#d8fff0', '#6ff2c2', '#14a37f']), sw('Wisp Lilac', ['#efe0ff', '#c29bff', '#7b4fd6'])] },
  l3: { num: 3, name: 'Turret Alley', core: 'Sun Core', color: '#ffc83d', swatches: [sw('Turret Tangerine', ['#ffe0a3', '#ffa53d', '#e0601b']), sw('Brass Shell', ['#fff1c1', '#e8c15a', '#9a7420']), sw('Ember Glow', ['#ffd0b0', '#ff7b3d', '#b8360f'])] },
  l4: { num: 4, name: 'Drone Heights', core: 'Moss Core', color: '#5ee05a', swatches: [sw('Skyhigh Mint', ['#d4ffd1', '#7ff07a', '#2e9e3a']), sw('Rotor Rust', ['#ffd9c2', '#d9824a', '#8a3f1c']), sw('Updraft Azure', ['#d6efff', '#6cc3ff', '#1d6fb8'])] },
  l5: { num: 5, name: 'The Gray Engine', core: 'Prism Heart', color: '#b06bff', boss: true, swatches: [sw('Baron\'s Bane', ['#ff5d5d', '#ffd21a', '#3cb4ff'])] },
  // ---------------------------------------------------------------- sector 2: the Rinse Reservoir
  l6: { num: 1, name: 'Sponge Sluice', core: 'Coral Core', color: '#ff7a5c', swatches: [sw('Sponge Cake', ['#fff3c4', '#ffd36b', '#d99a1e']), sw('Soap Bubble', ['#f0f6ff', '#b9d8ff', '#ff9ad5']), sw('Sluice Gold', ['#fff0b3', '#ffc94d', '#b58200'])] },
  l7: { num: 2, name: 'Rising Tide', core: 'Lagoon Core', color: '#1fb5ff', swatches: [sw('Undertow Blue', ['#cfe9ff', '#4aa8ff', '#0b4f9c']), sw('Flood Lime', ['#efffc9', '#b6f04a', '#5d8f0f']), sw('Driftwood Tan', ['#f6e7d1', '#d2a774', '#7d5531'])] },
  l8: { num: 3, name: 'Bottling Line', core: 'Fizz Core', color: '#c6ff3d', swatches: [sw('Lemon Fizz', ['#ffffd1', '#f6f04a', '#b3a800']), sw('Bottle Green', ['#d1ffe0', '#3ddc84', '#11753d']), sw('Cap Crimson', ['#ffd1d6', '#ff3d5a', '#9c0f24'])] },
  l9: { num: 4, name: 'Pump Station', core: 'Kelp Core', color: '#2ee6a8', swatches: [sw('Pump Purple', ['#ead1ff', '#a95cff', '#5b1fa8']), sw('Pressure Peach', ['#ffe6d6', '#ffab7a', '#c4561f']), sw('Valve Violet', ['#e0d6ff', '#8a7aff', '#3d2fa8'])] },
  l10: { num: 5, name: 'The Grimewyrm', core: 'Pearl Core', color: '#f0e6ff', boss: true, swatches: [sw('Wyrmscale Opal', ['#d6fff6', '#ffd6f5', '#c9c2ff'])] },
  // ---------------------------------------------------------------- sector 3: Grisaille Manor
  l11: { num: 1, name: 'Lights Out', core: 'Lantern Core', color: '#ffe066', swatches: [sw('Candle Amber', ['#fff0c2', '#ffbf47', '#b8740a']), sw('Moth Wing', ['#f4eee0', '#cbb89a', '#7a6650']), sw('Midnight Plum', ['#e6d1f2', '#9b4fc9', '#4a1670'])] },
  l12: { num: 2, name: 'Crumbling Gallery', core: 'Fresco Core', color: '#ff8fab', swatches: [sw('Fresco Rose', ['#ffe0e8', '#ff8fab', '#c2365e']), sw('Gilded Frame', ['#fff6d1', '#e8c547', '#8f6d0a']), sw('Dust Mote', ['#f2ece4', '#cfc1ad', '#8c7b66'])] },
  l13: { num: 3, name: 'Chroma Locks', core: 'Key Core', color: '#7c5cff', swatches: [sw('Lockpick Indigo', ['#dcd6ff', '#7c5cff', '#2f1fa8']), sw('Membrane Magenta', ['#ffd6f6', '#ff4fd8', '#9c0f84']), sw('Tumbler Teal', ['#d1fffa', '#2fe0d0', '#0b8278'])] },
  l14: { num: 4, name: 'The Grand Ascent', core: 'Summit Core', color: '#ff5d3d', swatches: [sw('Spire Scarlet', ['#ffd6cc', '#ff5d3d', '#a8200b']), sw('Updraft Gold', ['#fff6c2', '#ffd23d', '#b38a00']), sw('Railway Rainbow', ['#ff5d5d', '#5ee05a', '#3cb4ff'])] },
  l15: { num: 5, name: 'Baron Grisaille', core: 'Spectrum Crown', color: '#ffffff', boss: true, swatches: [sw('Grisaille\'s Secret Pink', ['#ffe0f0', '#ff8ccf', '#e0479e'])] },
};

export const SECTORS = [
  { id: 's1', num: 1, name: 'The Paint Works', hub: 'hub', color: '#ffb070', levels: ['l1', 'l2', 'l3', 'l4', 'l5'], boss: 'l5' },
  { id: 's2', num: 2, name: 'The Rinse Reservoir', hub: 'hub2', color: '#3fd8e6', levels: ['l6', 'l7', 'l8', 'l9', 'l10'], boss: 'l10' },
  { id: 's3', num: 3, name: 'Grisaille Manor', hub: 'hub3', color: '#b9a6ff', levels: ['l11', 'l12', 'l13', 'l14', 'l15'], boss: 'l15' },
];
export const ORDER = SECTORS.flatMap((s) => s.levels);
export const HUBS = ['hub', 'hub2', 'hub3'];

for (const s of SECTORS) {
  for (const id of s.levels) {
    const inf = INFO[id];
    inf.id = id;
    inf.sector = s.num;
    inf.sectorId = s.id;
    inf.hub = s.hub;
    inf.tag = `${s.num}-${inf.num}`;
    inf.swatchIds = inf.swatches.map((_, i) => (i === 0 ? id : `${id}.${i + 1}`));
    // v1 compatibility: the first swatch is still reachable as info.swatch / info.swatchColors
    inf.swatch = inf.swatches[0].name;
    inf.swatchColors = inf.swatches[0].colors;
  }
}

// every Lost Swatch: id -> { id, level, i, name, colors }
export const SWATCHES = {};
for (const id of ORDER) INFO[id].swatches.forEach((s, i) => { const sid = INFO[id].swatchIds[i]; SWATCHES[sid] = { id: sid, level: id, i, ...s }; });
export const SWATCH_IDS = Object.keys(SWATCHES);

export const sectorOf = (id) => SECTORS.find((s) => s.levels.includes(id) || s.hub === id) || SECTORS[0];
export const GRAY_INK = '#7d7a88';

// ---------------------------------------------------------------- skies
const base = { cloud: 0x000000, cloudShade: 0x000000, clouds: 0 };
export const SKY = {
  hub: { ...base, zenith: 0x0c0a12, horizon: 0x3a2e42, ground: 0x1a1418, sun: 0xffd6a8, sunDir: [0.35, 1, 0.25], sunI: 2.6, hemiSky: 0xc0aed0, hemiGround: 0x5a4a48, hemiI: 1.5, fog: 0x1d1622, fogD: 0.018 },
  l1: { ...base, zenith: 0x0b080a, horizon: 0x3a2a26, ground: 0x140e0e, sun: 0xffcf9a, sunDir: [0.3, 1, -0.35], sunI: 2.8, hemiSky: 0xd8b8a8, hemiGround: 0x5a4438, hemiI: 1.4, fog: 0x2a2026, fogD: 0.015 },
  l2: { ...base, zenith: 0x050b10, horizon: 0x123540, ground: 0x061418, sun: 0xc8f2ff, sunDir: [0.25, 1, 0.45], sunI: 2.6, hemiSky: 0x9ad8e8, hemiGround: 0x2a4048, hemiI: 1.4, fog: 0x0f2a33, fogD: 0.02 },
  l3: { ...base, zenith: 0x0c0806, horizon: 0x40261a, ground: 0x140c08, sun: 0xffb878, sunDir: [-0.35, 1, 0.2], sunI: 2.8, hemiSky: 0xe0b498, hemiGround: 0x5a4030, hemiI: 1.35, fog: 0x2e1f19, fogD: 0.014 },
  l4: { ...base, zenith: 0x0b1220, horizon: 0x2e4058, ground: 0x0c121c, sun: 0xe4f0ff, sunDir: [0.18, 1, 0.12], sunI: 3.0, hemiSky: 0xb4cce8, hemiGround: 0x3a4258, hemiI: 1.4, fog: 0x1a2638, fogD: 0.013 },
  l5: { ...base, zenith: 0x0d0709, horizon: 0x40181a, ground: 0x120809, sun: 0xffc4a8, sunDir: [0.3, 1, -0.25], sunI: 2.6, hemiSky: 0xd8a8a0, hemiGround: 0x4a2a28, hemiI: 1.35, fog: 0x26110f, fogD: 0.014 },
  // the Rinse Reservoir: cool tiled water works
  hub2: { ...base, zenith: 0x06121a, horizon: 0x1f4a58, ground: 0x0a1a20, sun: 0xd2f4ff, sunDir: [0.2, 1, 0.3], sunI: 2.7, hemiSky: 0xa8e0f0, hemiGround: 0x2f5560, hemiI: 1.5, fog: 0x10303a, fogD: 0.017 },
  l6: { ...base, zenith: 0x07141c, horizon: 0x1d5260, ground: 0x0a1c22, sun: 0xe0f8ff, sunDir: [0.3, 1, 0.2], sunI: 2.9, hemiSky: 0xb0e8f4, hemiGround: 0x35606a, hemiI: 1.45, fog: 0x123844, fogD: 0.013 },
  l7: { ...base, zenith: 0x04101a, horizon: 0x18425a, ground: 0x08161e, sun: 0xc8ecff, sunDir: [-0.25, 1, 0.3], sunI: 2.7, hemiSky: 0x98d0ec, hemiGround: 0x2a4a5c, hemiI: 1.4, fog: 0x0d2a3a, fogD: 0.014 },
  l8: { ...base, zenith: 0x0a1410, horizon: 0x2a5048, ground: 0x0c1814, sun: 0xeaffe0, sunDir: [0.35, 1, -0.2], sunI: 2.9, hemiSky: 0xc0ecd8, hemiGround: 0x3a5a4c, hemiI: 1.45, fog: 0x163a32, fogD: 0.012 },
  l9: { ...base, zenith: 0x06121a, horizon: 0x214a5a, ground: 0x0a1820, sun: 0xd8f6ff, sunDir: [0.15, 1, 0.35], sunI: 2.8, hemiSky: 0xa8e4f2, hemiGround: 0x30586a, hemiI: 1.45, fog: 0x11323e, fogD: 0.013 },
  l10: { ...base, zenith: 0x050c12, horizon: 0x1a3440, ground: 0x081014, sun: 0xd8e8ff, sunDir: [0.3, 1, -0.2], sunI: 2.6, hemiSky: 0x98c0d8, hemiGround: 0x2a3e4c, hemiI: 1.35, fog: 0x0f2230, fogD: 0.014 },
  // Grisaille Manor: dark monochrome halls (ink glows here)
  hub3: { ...base, zenith: 0x08070c, horizon: 0x2a2634, ground: 0x0c0b10, sun: 0xd8d0ff, sunDir: [0.25, 1, 0.3], sunI: 2.2, hemiSky: 0xb8b0d0, hemiGround: 0x403a4c, hemiI: 1.25, fog: 0x17141f, fogD: 0.02 },
  l11: { ...base, zenith: 0x020203, horizon: 0x0a0a10, ground: 0x030304, sun: 0x8890c0, sunDir: [0.2, 1, 0.3], sunI: 0.35, hemiSky: 0x4a4a66, hemiGround: 0x15141c, hemiI: 0.38, fog: 0x06060a, fogD: 0.03 },
  l12: { ...base, zenith: 0x09080c, horizon: 0x2e2a36, ground: 0x0d0c10, sun: 0xe8e0ff, sunDir: [-0.3, 1, 0.25], sunI: 2.3, hemiSky: 0xc0b8d8, hemiGround: 0x46404f, hemiI: 1.25, fog: 0x1a1722, fogD: 0.012 },
  l13: { ...base, zenith: 0x0a0810, horizon: 0x2c2440, ground: 0x0d0a14, sun: 0xe0d4ff, sunDir: [0.3, 1, 0.15], sunI: 2.4, hemiSky: 0xbcb0e0, hemiGround: 0x403656, hemiI: 1.3, fog: 0x1a1428, fogD: 0.014 },
  l14: { ...base, zenith: 0x0e0b14, horizon: 0x3a2e48, ground: 0x100c16, sun: 0xffe0d0, sunDir: [0.25, 1, -0.3], sunI: 2.6, hemiSky: 0xd0c0e0, hemiGround: 0x4a3c58, hemiI: 1.3, fog: 0x1e1828, fogD: 0.011 },
  l15: { ...base, zenith: 0x0a090c, horizon: 0x302c38, ground: 0x0c0b0e, sun: 0xf0ecff, sunDir: [0.2, 1, 0.2], sunI: 2.4, hemiSky: 0xc8c4d8, hemiGround: 0x46424e, hemiI: 1.3, fog: 0x1a1820, fogD: 0.012 },
};
