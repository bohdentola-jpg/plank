# NOCLIP 📼

*You noclipped out of reality. Twenty-three levels down. Get out.*

First-person found-footage horror for the EB GAMES 95 shelf. Everything you see is
through a camcorder you cannot put down: the battery is your light, the tape is
your nerve, and the low-light gain is the reason you can see anything at all in a
level with no working fixtures.

No asset files. Every wall texture, every creature, every note of the score and
every sound in the game is generated in code at runtime, and every level is built
fresh from your tape's seed — so nobody else's map of this place will help you.

    python3 serve.py backrooms      # or pick NOCLIP on the desktop

## The tape

**R** record/pause · **N** NIGHTSHOT · **F** or right-mouse torch · **scroll** zoom
**WASD** move · **SHIFT** run (loud) · **CTRL** crouch (quiet) · **SPACE** hop / swim up
**E** take, read, use a door · **Q** use item · **G** throw it · **1–5**/**TAB** select · **ESC** pause

The camcorder has its own battery and so does the torch; D-cells fill both.
NIGHTSHOT sees in the dark and drinks the battery twice as fast. The tape only
advances while you are recording, and the timecode in the corner is the only clock
you get.

## Twenty-three levels

| # | Level | What it is |
| --- | --- | --- |
| 0 | THE LOBBY | The yellow rooms. Damp carpet, the hum, six hundred million square feet of it. |
| 1 | HABITABLE ZONE | Concrete warehouse bays, a flooded loading pit, and the first thing that hunts. |
| 2 | PIPE DREAMS | Service tunnels, hot pipes, no light at all. Smilers wait in the black. |
| 3 | ELECTRICAL STATION | A substation maze. Three fuses, one freight gate, one thing wearing a survivor. |
| 4 | ABANDONED OFFICE | The cubicle sea. Phones ring in rooms you already checked. |
| 4B | THE BREAK ROOM | Safe. Genuinely safe. Restock, read the corkboard, pick a door. |
| 5 | TERROR HOTEL | A hotel running without guests. The party is on the third floor. |
| 6 | LIGHTS OUT | Total darkness. Everything down here hunts by sound. |
| 37 | **THE POOLROOMS** | Warm, tiled, waist-deep, sunlit from nowhere. Something swims in the deep end. |
| 7 | THALASSOPHOBIA | Black water, concrete islands, and eight seconds per crossing. |
| 8 | THE CAVES | Wet limestone, crawl squeezes, sumps, and a growth that is 34 degrees. |
| 9 | THE SUBURBS | An identical night street forever. People stand in the yards facing the houses. |
| 10 | THE FIELD | Wheat over your head under a sky with no sun. Nothing bad happens for a long time. |
| 11 | THE ENDLESS CITY | Fog-blind blocks. The mannequins are in a different window every time. |
| 27 | THE PARKING GARAGE | Three decks, ramps, and something with claws keeping pace above you. |
| 52 | THE HOSPITAL | Green tile, gurneys, a morgue, and a nurse who never stops walking. |
| 94 | THE SCHOOL | Lockers and afternoon light. The crayon drawings are of you, and they're dated. |
| 188 | THE WINDOWS | One corridor. Windows both sides. Look once. Everybody looks once. |
| FUN | LEVEL FUN =) | A birthday party that has been going for decades. Don't run. |
| 283 | THE ARCHIVES | Infinite stacks under a silence rule. The archive is filing you. |
| 99 | THE WHITEOUT | Snow, no horizon, and a queue of people facing away. |
| ! | RUN FOR YOUR LIFE | Red halls. The level spawns hounds behind you until you're out of it. |
| 3999 | THE TERMINUS | A freight shed with a train that has steam up. Out is a direction again. |

Hidden exits inside the levels skip you sideways and forward — a soft tile in the
lobby drops you straight into the poolrooms, room 302 opens onto Level Fun, a cable
chase under a dead cabinet lands you in the red halls. The archive on the title
screen tracks which levels you have seen and which tapes you have recovered.

## Eighteen things down here

Each one hunts differently, and that is the whole game: the **hound** is blind and
follows sound; the **smiler** is frozen by light and lethal without it; the
**faceling** ignores you until you stare; the **mannequin** only moves while
unobserved; the **skin-stealer** wears somebody who didn't make it and keeps its
distance until it doesn't; the **watcher** never comes closer and is unbearable
anyway; the **nurse** walks at your walking pace and never stops; and something very
large patrols the deep water. The **shepherd** is the only one on your side.

## How it's built

    src/kit.js         the level-authoring vocabulary — levels are pure data
    src/levels/*.js    twenty-three level modules, no three.js anywhere in them
    src/world.js       data → merged geometry + baked light with real occlusion
    src/camcorder.js   the tape: one render target, one fullscreen shader
    src/entities.js    one state machine, twelve behaviour flags, eighteen monsters
    src/bestiary.js    what they are, how they hunt, what they look like
    src/textures.js    63 procedural surfaces
    src/props.js       130 procedural props
    src/audio.js       room tones, footsteps, creature voices, a generative score
    src/fx.js          22 scripted scares and the dread budget that rations them

Level geometry carries baked irradiance in a vertex attribute, added to the lit
result by four injected lines of GLSL — which is why a torch still reads correctly
in a room whose baked light is zero. Lighting is baked per cell with a 2D DDA for
shadows, so light stops at walls instead of turning corners, and a pool of seven
real point lights follows you for flicker and specular.

Because levels are data, the whole library is checkable without a browser:

    npm run smoke:backrooms      # builds all 23 levels, walks the exit graph
    npm run shot:backrooms level0 --frames 3     # drives it in headless Chromium

The harness proves each level encloses itself, that the spawn is on floor, that
every exit is reachable *on foot* from the spawn, that no material/prop/entity/scare
name is a typo, that the same seed builds the same level twice, and that every level
is reachable from LEVEL 0 by walking the exit graph.

## Content note

Flashing lights, sudden loud sound, enclosed spaces, deep water. No gore.
Headphones are strongly recommended and are also the worst decision you can make.
