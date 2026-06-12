# LOAM — the brief

## The prompt, as it arrived

> Make a Minecraft clone from scratch: survival and creative mode,
> procedurally generated worlds, etc. make the music be absolutely amazing.

## The prompt, made better

> **Build LOAM, a browser voxel game in the Varsity 27 house style** — same
> repo, same rules: vendored three.js, no build step, no asset files, every
> texture/model/sound generated in code, playable from `serve.py`.
>
> **World.** Infinite, seeded, deterministic: type a seed word, get the same
> world forever. Chunked terrain (16×96×16) streamed around the player with
> a per-frame budget. Continents, ridged mountain ranges, and at least five
> surface biomes plus oceans, beaches, cave systems worth getting lost in,
> lava in the deeps, and ore distributed by depth: coal → iron → gold →
> diamond. Trees that respect their biome. Bedrock floor.
>
> **Light is the game.** Proper voxel lighting, not a sun lamp: skylight
> column-fill + flood, torch light flood, 0–15 levels, smooth corners and
> ambient occlusion, sky channel tinted by a full day/night cycle (square
> sun, square moon, stars, drifting blocky clouds). Mobs spawn by light
> level; dawn burns zombies.
>
> **Survival mode.** Hearts, hunger, breath; fall/lava/cactus/drowning
> damage. Punch-a-tree progression: planks → crafting table → tools in four
> tiers with durability and drop-gating (iron needs stone, diamond needs
> iron). Furnace smelting and cooking with fuel. Sheep and pigs for food and
> wool; zombies at night with chase AI and knockback. A bedroll (wool +
> planks) to skip the night and set spawn. Death screen, respawn, keep your
> stuff.
>
> **Creative mode.** Every block in a palette, infinite placement, instant
> breaking, flight on double-space. No bars, no fear.
>
> **Feel.** First-person with pointer lock; mine-hold with crack stages;
> block highlight; held item with swing and walk-bob; break particles; item
> drops that bob, spin, and magnet to your pocket. Sneak keeps you on edges,
> sprint costs hunger. HUD in pixel art (hearts, drumsticks, bubbles).
> Inventory with cursor-stack dragging; crafting as a recipe list (console
> style) — anywhere for pocket recipes, at a table for the rest.
>
> **The music must carry the game.** No files: a generative composer with
> moods — warm felt-piano over slow maj9 chord beds for daylight, sparse
> minor-pentatonic bells for night, long-reverb drones underground, a fixed
> overture on the title screen. Melodies wander a pentatonic with motif
> recall, humanized timing, named pieces surfaced in the UI (♪ toasts).
> Under it: wind, birds at noon, crickets at night, drips in caves, and
> material-aware foley for every step, dig, splash and groan. Underwater
> muffles the whole mix.
>
> **Persistence.** Multiple named worlds in localStorage; save = seed +
> player + block-edit diffs (the generator rebuilds the rest). Autosave.
>
> **Proof.** Node smoke tests for the seed→light→mesh pipeline, crafting
> math, physics, and the composer; headless screenshot harness with QA URL
> params (`?quick&seed=&mode=&t=`) and an in-page `__loam` probe handle.
> Screenshots in the README.

## Decisions that fell out of building it

| Choice | Why |
| --- | --- |
| three.js for the GL plumbing, custom everything else | The repo already vendors it; "from scratch" means the voxel engine (chunking, meshing, lighting, physics, generation, audio) — not re-implementing a matrix library. The chunk shader is hand-written GLSL. |
| Recipe-list crafting, not a 3×3 puzzle grid | Console Minecraft proved it: same progression, a tenth of the UI friction, and it reads instantly in a browser. |
| Static fluids (no flow simulation) | Flowing water is a project of its own and mostly buys griefing physics. Oceans, lakes, and lava pools deliver the atmosphere at a fraction of the risk. |
| Light BFS per chunk with border exchange | Converges over a few frames, never stalls a frame globally, and keeps edits O(neighbourhood). |
| Cave noise on a coarse lattice, interpolated | Full-resolution 3D fBm per block costs ~50 ms/chunk; the lattice gets the same tunnels for ~5 ms. |
| Bedroll instead of a bed block | One item, no placement/orientation state, same two superpowers (skip night, set spawn). |
| 96-block world height | Halves memory and light/mesh work versus 256; mountains still tower because sea level sits at 40. |
| Tint entity materials by `k²` | Entities run through three's sRGB pipeline, chunks through a raw shader; squaring the factor makes a zombie in a cave as dark as the cave. |
