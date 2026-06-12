// The material world: every block and item, what it's made of, how long it
// takes to break, what it drops, and how to craft it. Pure data — no DOM.

export const B = {
  air: 0, grass: 1, dirt: 2, stone: 3, cobble: 4, bedrock: 5, sand: 6,
  sandstone: 7, water: 8, log: 9, leaves: 10, planks: 11, glass: 12,
  coalOre: 13, ironOre: 14, goldOre: 15, diamondOre: 16, snowyGrass: 17,
  snow: 18, cactus: 19, poppy: 20, dandelion: 21, tallgrass: 22, torch: 23,
  craftingTable: 24, furnace: 25, gravel: 26, spruceLog: 27, spruceLeaves: 28,
  lava: 29, ice: 30, wool: 31, stoneBrick: 32, lantern: 33, ironBlock: 34,
  goldBlock: 35, diamondBlock: 36,
};

export const I = {
  stick: 100, coal: 101, charcoal: 102, ironIngot: 103, goldIngot: 104,
  diamond: 105, porkchop: 106, cookedPorkchop: 107, mutton: 108,
  cookedMutton: 109, apple: 110, bedroll: 111,
  woodPick: 120, woodAxe: 121, woodShovel: 122, woodSword: 123,
  stonePick: 124, stoneAxe: 125, stoneShovel: 126, stoneSword: 127,
  ironPick: 128, ironAxe: 129, ironShovel: 130, ironSword: 131,
  diamondPick: 132, diamondAxe: 133, diamondShovel: 134, diamondSword: 135,
};

// Tile names refer to entries in the texture atlas (textures.js draws them).
// hard: seconds to break bare-handed baseline (Minecraft-ish hardness).
// tool: which tool class speeds it up. tier: minimum pick tier to get a drop
// (1 wood, 2 stone, 3 iron). cross: drawn as an X of two quads (plants).
// emit: block light emitted (0-15). solid: collides. opaque: blocks light.
const def = (name, o) => ({
  name, hard: 0.6, tool: null, tier: 0, drops: undefined, solid: true,
  opaque: true, cross: false, emit: 0, snd: 'stone', tiles: null, fluid: false,
  replaceable: false, ...o,
});

export const BLOCKS = {
  [B.air]: def('Air', { solid: false, opaque: false, replaceable: true, tiles: {} }),
  [B.grass]: def('Grass Block', { hard: 0.7, tool: 'shovel', snd: 'grass', drops: B.dirt, tiles: { top: 'grass_top', side: 'grass_side', bottom: 'dirt' } }),
  [B.dirt]: def('Dirt', { hard: 0.6, tool: 'shovel', snd: 'gravel', tiles: { all: 'dirt' } }),
  [B.stone]: def('Stone', { hard: 1.7, tool: 'pick', tier: 1, drops: B.cobble, tiles: { all: 'stone' } }),
  [B.cobble]: def('Cobblestone', { hard: 2.2, tool: 'pick', tier: 1, tiles: { all: 'cobble' } }),
  [B.bedrock]: def('Bedrock', { hard: Infinity, tiles: { all: 'bedrock' } }),
  [B.sand]: def('Sand', { hard: 0.6, tool: 'shovel', snd: 'sand', tiles: { all: 'sand' } }),
  [B.sandstone]: def('Sandstone', { hard: 1.4, tool: 'pick', tier: 1, tiles: { top: 'sandstone_top', side: 'sandstone', bottom: 'sandstone_top' } }),
  [B.water]: def('Water', { solid: false, opaque: false, fluid: true, replaceable: true, hard: Infinity, tiles: { all: 'water' } }),
  [B.log]: def('Oak Log', { hard: 2.2, tool: 'axe', snd: 'wood', tiles: { top: 'log_top', side: 'log', bottom: 'log_top' } }),
  [B.leaves]: def('Oak Leaves', { hard: 0.35, opaque: false, snd: 'grass', drops: null, tiles: { all: 'leaves' } }),
  [B.planks]: def('Oak Planks', { hard: 2.2, tool: 'axe', snd: 'wood', tiles: { all: 'planks' } }),
  [B.glass]: def('Glass', { hard: 0.4, opaque: false, snd: 'glass', drops: null, tiles: { all: 'glass' } }),
  [B.coalOre]: def('Coal Ore', { hard: 3.2, tool: 'pick', tier: 1, drops: I.coal, tiles: { all: 'coal_ore' } }),
  [B.ironOre]: def('Iron Ore', { hard: 3.2, tool: 'pick', tier: 2, tiles: { all: 'iron_ore' } }),
  [B.goldOre]: def('Gold Ore', { hard: 3.2, tool: 'pick', tier: 3, tiles: { all: 'gold_ore' } }),
  [B.diamondOre]: def('Diamond Ore', { hard: 3.2, tool: 'pick', tier: 3, drops: I.diamond, tiles: { all: 'diamond_ore' } }),
  [B.snowyGrass]: def('Snowy Grass', { hard: 0.7, tool: 'shovel', snd: 'snow', drops: B.dirt, tiles: { top: 'snow', side: 'snowy_side', bottom: 'dirt' } }),
  [B.snow]: def('Snow Block', { hard: 0.3, tool: 'shovel', snd: 'snow', tiles: { all: 'snow' } }),
  [B.cactus]: def('Cactus', { hard: 0.5, snd: 'wool', opaque: false, tiles: { top: 'cactus_top', side: 'cactus', bottom: 'cactus_top' } }),
  [B.poppy]: def('Poppy', { hard: 0.05, solid: false, opaque: false, cross: true, replaceable: true, snd: 'grass', tiles: { all: 'poppy' } }),
  [B.dandelion]: def('Dandelion', { hard: 0.05, solid: false, opaque: false, cross: true, replaceable: true, snd: 'grass', tiles: { all: 'dandelion' } }),
  [B.tallgrass]: def('Tall Grass', { hard: 0.05, solid: false, opaque: false, cross: true, replaceable: true, snd: 'grass', drops: null, tiles: { all: 'tallgrass' } }),
  [B.torch]: def('Torch', { hard: 0.05, solid: false, opaque: false, cross: true, emit: 14, snd: 'wood', tiles: { all: 'torch' } }),
  [B.craftingTable]: def('Crafting Table', { hard: 2.2, tool: 'axe', snd: 'wood', tiles: { top: 'table_top', side: 'table_side', bottom: 'planks' } }),
  [B.furnace]: def('Furnace', { hard: 3.2, tool: 'pick', tier: 1, tiles: { top: 'stone', side: 'furnace_side', front: 'furnace', bottom: 'stone' } }),
  [B.gravel]: def('Gravel', { hard: 0.7, tool: 'shovel', snd: 'gravel', tiles: { all: 'gravel' } }),
  [B.spruceLog]: def('Spruce Log', { hard: 2.2, tool: 'axe', snd: 'wood', tiles: { top: 'log_top', side: 'spruce_log', bottom: 'log_top' } }),
  [B.spruceLeaves]: def('Spruce Leaves', { hard: 0.35, opaque: false, snd: 'grass', drops: null, tiles: { all: 'spruce_leaves' } }),
  [B.lava]: def('Lava', { solid: false, opaque: false, fluid: true, replaceable: true, hard: Infinity, emit: 15, tiles: { all: 'lava' } }),
  [B.ice]: def('Ice', { hard: 0.6, tool: 'pick', opaque: false, snd: 'glass', drops: null, tiles: { all: 'ice' } }),
  [B.wool]: def('Wool', { hard: 0.9, snd: 'wool', tiles: { all: 'wool' } }),
  [B.stoneBrick]: def('Stone Bricks', { hard: 2.2, tool: 'pick', tier: 1, tiles: { all: 'stone_brick' } }),
  [B.lantern]: def('Lantern', { hard: 0.4, emit: 15, snd: 'glass', tiles: { all: 'lantern' } }),
  [B.ironBlock]: def('Iron Block', { hard: 6, tool: 'pick', tier: 2, tiles: { all: 'iron_block' } }),
  [B.goldBlock]: def('Gold Block', { hard: 4, tool: 'pick', tier: 3, tiles: { all: 'gold_block' } }),
  [B.diamondBlock]: def('Diamond Block', { hard: 6, tool: 'pick', tier: 3, tiles: { all: 'diamond_block' } }),
};

// food: hunger points restored. tool: {kind, tier, speed, dmg, uses}.
const item = (name, o = {}) => ({ name, icon: null, food: 0, tool: null, ...o });
const tool = (name, kind, tier, speed, dmg, uses, icon) => item(name, { tool: { kind, tier, speed, dmg, uses }, icon });

export const ITEMS = {
  [I.stick]: item('Stick', { icon: 'stick' }),
  [I.coal]: item('Coal', { icon: 'coal' }),
  [I.charcoal]: item('Charcoal', { icon: 'charcoal' }),
  [I.ironIngot]: item('Iron Ingot', { icon: 'iron_ingot' }),
  [I.goldIngot]: item('Gold Ingot', { icon: 'gold_ingot' }),
  [I.diamond]: item('Diamond', { icon: 'diamond' }),
  [I.porkchop]: item('Raw Porkchop', { food: 3, icon: 'porkchop' }),
  [I.cookedPorkchop]: item('Cooked Porkchop', { food: 8, icon: 'porkchop_cooked' }),
  [I.mutton]: item('Raw Mutton', { food: 3, icon: 'mutton' }),
  [I.cookedMutton]: item('Cooked Mutton', { food: 7, icon: 'mutton_cooked' }),
  [I.apple]: item('Apple', { food: 4, icon: 'apple' }),
  [I.bedroll]: item('Bedroll', { icon: 'bedroll' }),
  [I.woodPick]: tool('Wooden Pickaxe', 'pick', 1, 2, 2, 60, 'pick_wood'),
  [I.woodAxe]: tool('Wooden Axe', 'axe', 1, 2, 3, 60, 'axe_wood'),
  [I.woodShovel]: tool('Wooden Shovel', 'shovel', 1, 2, 2, 60, 'shovel_wood'),
  [I.woodSword]: tool('Wooden Sword', 'sword', 1, 1.5, 4, 60, 'sword_wood'),
  [I.stonePick]: tool('Stone Pickaxe', 'pick', 2, 4, 3, 132, 'pick_stone'),
  [I.stoneAxe]: tool('Stone Axe', 'axe', 2, 4, 4, 132, 'axe_stone'),
  [I.stoneShovel]: tool('Stone Shovel', 'shovel', 2, 4, 2, 132, 'shovel_stone'),
  [I.stoneSword]: tool('Stone Sword', 'sword', 2, 1.5, 5, 132, 'sword_stone'),
  [I.ironPick]: tool('Iron Pickaxe', 'pick', 3, 6, 4, 251, 'pick_iron'),
  [I.ironAxe]: tool('Iron Axe', 'axe', 3, 6, 5, 251, 'axe_iron'),
  [I.ironShovel]: tool('Iron Shovel', 'shovel', 3, 6, 3, 251, 'shovel_iron'),
  [I.ironSword]: tool('Iron Sword', 'sword', 3, 1.5, 6, 251, 'sword_iron'),
  [I.diamondPick]: tool('Diamond Pickaxe', 'pick', 4, 8, 5, 1562, 'pick_diamond'),
  [I.diamondAxe]: tool('Diamond Axe', 'axe', 4, 8, 6, 1562, 'axe_diamond'),
  [I.diamondShovel]: tool('Diamond Shovel', 'shovel', 4, 8, 4, 1562, 'shovel_diamond'),
  [I.diamondSword]: tool('Diamond Sword', 'sword', 4, 1.5, 7, 1562, 'sword_diamond'),
};

export const isBlock = (id) => id > 0 && id < 100;
export const nameOf = (id) => (isBlock(id) ? BLOCKS[id]?.name : ITEMS[id]?.name) || '?';
export const STACK_MAX = (id) => (ITEMS[id]?.tool || id === I.bedroll ? 1 : 64);

// what lands on the ground when a block breaks (undefined → itself, null → nothing)
export function dropFor(id, rand = Math.random) {
  const b = BLOCKS[id];
  if (!b) return null;
  if (id === B.leaves && b.drops === null) return rand() < 0.06 ? I.apple : null;
  return b.drops === undefined ? id : b.drops;
}

// ------------------------------------------------------------ crafting
// Ingredient groups: a recipe slot can accept any member.
export const GROUPS = {
  log: [B.log, B.spruceLog],
  coalish: [I.coal, I.charcoal],
  fuel: [I.coal, I.charcoal, B.planks, I.stick, B.log, B.spruceLog],
};

// needs: [idOrGroupName, count][]. station: null = anywhere, 'table', 'furnace'.
// Furnace recipes additionally consume 1 of the 'fuel' group.
const R = (out, count, needs, station = null) => ({ out, count, needs, station });

export const RECIPES = [
  R(B.planks, 4, [['log', 1]]),
  R(I.stick, 4, [[B.planks, 2]]),
  R(B.torch, 4, [['coalish', 1], [I.stick, 1]]),
  R(B.craftingTable, 1, [[B.planks, 4]]),
  R(B.furnace, 1, [[B.cobble, 8]], 'table'),
  R(I.woodPick, 1, [[B.planks, 3], [I.stick, 2]], 'table'),
  R(I.woodAxe, 1, [[B.planks, 3], [I.stick, 2]], 'table'),
  R(I.woodShovel, 1, [[B.planks, 1], [I.stick, 2]], 'table'),
  R(I.woodSword, 1, [[B.planks, 2], [I.stick, 1]], 'table'),
  R(I.stonePick, 1, [[B.cobble, 3], [I.stick, 2]], 'table'),
  R(I.stoneAxe, 1, [[B.cobble, 3], [I.stick, 2]], 'table'),
  R(I.stoneShovel, 1, [[B.cobble, 1], [I.stick, 2]], 'table'),
  R(I.stoneSword, 1, [[B.cobble, 2], [I.stick, 1]], 'table'),
  R(I.ironPick, 1, [[I.ironIngot, 3], [I.stick, 2]], 'table'),
  R(I.ironAxe, 1, [[I.ironIngot, 3], [I.stick, 2]], 'table'),
  R(I.ironShovel, 1, [[I.ironIngot, 1], [I.stick, 2]], 'table'),
  R(I.ironSword, 1, [[I.ironIngot, 2], [I.stick, 1]], 'table'),
  R(I.diamondPick, 1, [[I.diamond, 3], [I.stick, 2]], 'table'),
  R(I.diamondAxe, 1, [[I.diamond, 3], [I.stick, 2]], 'table'),
  R(I.diamondShovel, 1, [[I.diamond, 1], [I.stick, 2]], 'table'),
  R(I.diamondSword, 1, [[I.diamond, 2], [I.stick, 1]], 'table'),
  R(I.bedroll, 1, [[B.wool, 3], [B.planks, 3]], 'table'),
  R(B.stoneBrick, 4, [[B.stone, 4]], 'table'),
  R(B.lantern, 1, [[B.torch, 4], [B.glass, 1]], 'table'),
  R(B.ironBlock, 1, [[I.ironIngot, 9]], 'table'),
  R(B.goldBlock, 1, [[I.goldIngot, 9]], 'table'),
  R(B.diamondBlock, 1, [[I.diamond, 9]], 'table'),
  R(B.glass, 1, [[B.sand, 1]], 'furnace'),
  R(B.stone, 1, [[B.cobble, 1]], 'furnace'),
  R(I.charcoal, 1, [['log', 1]], 'furnace'),
  R(I.ironIngot, 1, [[B.ironOre, 1]], 'furnace'),
  R(I.goldIngot, 1, [[B.goldOre, 1]], 'furnace'),
  R(I.cookedPorkchop, 1, [[I.porkchop, 1]], 'furnace'),
  R(I.cookedMutton, 1, [[I.mutton, 1]], 'furnace'),
];

// mining: how long a block takes with a given held item, and whether it drops
export function breakInfo(blockId, heldId) {
  const b = BLOCKS[blockId];
  if (!b || b.hard === Infinity) return null;
  const t = ITEMS[heldId]?.tool;
  const rightTool = b.tool && t && t.kind === b.tool;
  const gated = b.tool === 'pick' && b.tier > 0; // stone-class: pick required for drops
  const canDrop = !gated || (t && t.kind === 'pick' && t.tier >= b.tier);
  let speed = rightTool && (!gated || canDrop) ? t.speed : 1;
  let time = (b.hard * 1.5) / speed;
  if (gated && !canDrop) time = b.hard * 5; // punching stone: slow and fruitless
  return { time: Math.max(0.05, time), drops: canDrop, sound: b.snd };
}
