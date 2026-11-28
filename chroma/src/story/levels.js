// The Underside level registry: hubs + three sectors of five levels.
// Data (names, cores, swatches, skies) lives in info.js; builders in hubs.js
// and sector1/2/3.js. Coordinates: +z is "forward" along each course.
import { INFO, ORDER, SECTORS, SKY, GRAY_INK } from './info.js';
import { buildHub, buildHub2, buildHub3 } from './hubs.js';
import { buildL1, buildL2, buildL3, buildL4, buildL5 } from './sector1.js';
import { buildL6, buildL7, buildL8, buildL9, buildL10 } from './sector2.js';
import { buildL11, buildL12, buildL13, buildL14, buildL15 } from './sector3.js';

export { INFO, ORDER, SECTORS, SKY, GRAY_INK };

export const LEVELS = {
  hub: { id: 'hub', hub: true, sky: SKY.hub, build: buildHub, tpm: 7, music: 'story_hub', center: [0, 0, 5] },
  hub2: { id: 'hub2', hub: true, sky: SKY.hub2, build: buildHub2, tpm: 7, music: 'story_hub', center: [0, 0, 5], shelf: SECTORS[1].levels },
  hub3: { id: 'hub3', hub: true, sky: SKY.hub3, build: buildHub3, tpm: 7, music: 'shop', center: [0, 0, 5], shelf: SECTORS[2].levels },
  // sector 1: the Paint Works
  l1: { id: 'l1', sky: SKY.l1, build: buildL1, music: 'story_level' },
  l2: { id: 'l2', sky: SKY.l2, build: buildL2, music: 'story_level' },
  l3: { id: 'l3', sky: SKY.l3, build: buildL3, music: 'battle_b' },
  l4: { id: 'l4', sky: SKY.l4, build: buildL4, music: 'story_level' },
  l5: { id: 'l5', sky: SKY.l5, build: buildL5, music: 'story_level', boss: 'engine' },
  // sector 2: the Rinse Reservoir
  l6: { id: 'l6', sky: SKY.l6, build: buildL6, music: 'story_level', tpm: 7 },
  l7: { id: 'l7', sky: SKY.l7, build: buildL7, music: 'battle_c', tpm: 7 },
  l8: { id: 'l8', sky: SKY.l8, build: buildL8, music: 'lobby', tpm: 7 },
  l9: { id: 'l9', sky: SKY.l9, build: buildL9, music: 'story_level', tpm: 7, sealText: () => 'Get the <b>Color Pump</b> running and defend it' },
  l10: { id: 'l10', sky: SKY.l10, build: buildL10, music: 'story_level', boss: 'wyrm', bossDoors: ['wyrmDoor'], bossSpawn: [0, 0, -20], tpm: 7 },
  // sector 3: Grisaille Manor
  l11: { id: 'l11', sky: SKY.l11, build: buildL11, music: 'story_level', dark: true, glowInk: 0.85, tpm: 7, desat: 0.05 },
  l12: { id: 'l12', sky: SKY.l12, build: buildL12, music: 'battle_b', tpm: 7 },
  l13: { id: 'l13', sky: SKY.l13, build: buildL13, music: 'lobby', tpm: 7 },
  l14: { id: 'l14', sky: SKY.l14, build: buildL14, music: 'battle_c', tpm: 7 },
  l15: { id: 'l15', sky: SKY.l15, build: buildL15, music: 'story_level', boss: 'baron', bossDoors: ['baronDoor'], bossSpawn: [0, 0, -16], tpm: 7 },
};
for (const id of ORDER) if (!LEVELS[id]) throw new Error('missing level ' + id);
