# QUAHOG HIT & RUN 🚗

*Six Griffins. One town. No supervision.*

A cel-shaded open world in Quahog, Rhode Island, built the way the licensed
cartoon drivers of 2003 were: seven levels, one Griffin per level, story jobs
that unlock the next one, and a whole town to knock about in between.

![Downtown](../docs/quahog-street.png)

## The story

Pawtucket Patriot **ULTRA** turns up in Quahog. Everybody who drinks it starts
clucking. The trail runs through the docks, the Channel 5 newsroom, a
Pewterschmidt bank account and a very large chicken.

| | Level | Who | Where |
| --- | --- | --- | --- |
| 1 | Something in the Beer | Peter | Spooner Street |
| 2 | Follow the Money, the Dog Said | Brian | Downtown |
| 3 | Daddy, What Did You Do | Lois | Civic Center |
| 4 | The Formula | Stewie | Quahog Park |
| 5 | The School Shipment | Chris | James Woods High |
| 6 | Nobody Notices Meg | Meg | The Waterfront |
| 7 | Last Call at the Brewery | Peter | Pawtucket Works |

Each level opens and closes with a cutscene, has four story jobs that gate
progress, a bonus job, and seven collectibles hidden around its patch of town.
Finish the story jobs and the game rolls straight into the next level, swapping
the character with it. **Level Select** reopens anything you have reached;
**Free Roam** turns all six Griffins loose.

![The cold open](../docs/quahog-cutscene.png)

Cutscenes are staged in-engine: letterbox, cut close-ups and two-shots (never a
blend — the show does not blend), lip flaps, per-character voice blips and a
title card. **Eighteen cutaway gags** are hidden on little TV markers around
town: walk up, press the button, and the game stops dead for a joke.

## The town

![Spooner Street](../docs/quahog-spooner.png)

Not a grid. Roads are polylines — Main Street bends, Quahog Avenue cuts the
south-east diagonally, the shore road follows the water, the park has a loop,
and **Spooner Street is a real dead end with a turning circle**. The houses are
in the right order: **33** the Swansons with Joe's ramp, **31** the Griffins,
**29** Quagmire with the hot tub, and across the road the Browns with the
bathtub coming out of the wall, Herbert's porch and the Goldmans.

Downtown has the Drunken Clam on its corner, Goldman's Pharmacy, the Performing
Arts Center, and **Al Harrington's Wacky Waving Inflatable Arm-Flailing Tube Men
Emporium and Warehouse — with the tube men out front**. Plus City Hall, Channel
5, James Woods High and its field, the mall, the hospital, the harbour and
lighthouse, Pewterschmidt Manor behind its gates, St. Philomena's, the airport,
the beach and a salvage yard full of jump ramps.

The clock runs. Pedestrians walk the pavements and gather outside landmarks,
traffic works the road graph, and the whole named cast moves on a 24-hour
schedule — Peter is at the brewery at lunch and the Clam by six, Quagmire is
flying out of the airport, Herbert is on his porch.

![Quahog at night](../docs/quahog-night.png)

## Controls

| | |
| --- | --- |
| **On foot** | **WASD** moves relative to the camera · **SHIFT** sprint · **SPACE** jump · **F** swing · **R** your character's special · **E** get in the nearest car · **G** talk / start a job / trigger a gag |
| **Camera** | **mouse** (click to capture, or drag with the right button) · **arrow keys** also swing and tilt |
| **Driving** | **W/S** throttle and brake · **A/D** steer · **SPACE** handbrake · **H** horn · **E** get out |
| **Anywhere** | **M** map · **ESC** pause · **X** abandon a job · **N** mute |
| **Gamepad** | left stick moves, right stick looks, **✕** jump/handbrake, **◯** enter/exit, **□** swing, **R2** throttle |

## Under the hood

```
src/toon.js       cel shading, the screen-space ink pass, sky, geometry merging
src/cast.js       one parametric rig → 6 Griffins + 20 locals + a cheap crowd variant
src/buildings.js  houses, storefronts, landmarks and the tube men
src/roads.js      the street plan: polylines, plots, junction graph
src/city.js       the layout, the painted ground, colliders, the 24-hour schedule
src/vehicles.js   car bodies from a side profile + arcade driving
src/actors.js     crowd, named cast, traffic, police — all on the road graph
src/world.js      the runtime: player, camera, combat, pickups, wanted level, levels
src/story.js      seven levels of campaign: cutscenes, jobs, collectibles
src/missions.js   the objective runner
src/gags.js  src/cutscene.js  src/hud.js  src/audio.js  src/main.js
```

The ink is a two-pass job: the scene is drawn once into a half-float buffer of
view normals and depth, an edge filter finds silhouettes and creases, and the
result is composited over the beauty pass as black lines. Depth differences are
weighted by how side-on a surface is, or a road at a grazing angle inks itself
into a barcode. Quality scales itself down if the frame rate drops.

Buildings merge to one mesh per material before they go in the world. Nothing
can be built on tarmac: every plot is tested against the road network and shoved
clear if it overlaps.

## Dev

```bash
npm run smoke:quahog     # town, cast, vehicles and the whole campaign, no browser
npm run play:quahog      # headless playtest in Chromium, fails on any page error
node tools/shot.mjs "/quahog/?drop=peter" shot.png --wait 9000
```

QA URL modes: `?drop=<griffin>` boots straight into the world, `?select` opens
the character screen, `?cast=all` lines the whole cast up on a turntable, and
`?city&x=..&z=..&h=..` drops a camera over the town.
