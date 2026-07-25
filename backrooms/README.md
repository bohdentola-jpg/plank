# NOCLIP 📼

*Ten floors down. One thing on each of them. Find the lift.*

First-person found-footage horror for the EB GAMES 95 shelf. Everything you see is
through a camcorder you cannot put down — the whole screen is tape: barrel-warped,
chroma-split, tracking bands rolling up through the picture, and `REC` with a
timecode along the top edge.

No asset files. Every wall texture, every creature, every note of the score and
every sound in the game is generated in code at runtime, and every run picks its own
floors from the pool — so nobody else's map of this place will help you.

    python3 serve.py backrooms      # or pick NOCLIP on the desktop

## The run

Ten floors, drawn by depth: the shallow levels first, the bottom of the pool last.
Every floor is the same contract and never the same floor.

- **One lift.** Somewhere out there is a service lift. Reaching it is the objective,
  and it is the only way off the floor.
- **One monster.** Exactly one thing hunts each floor, and contact is death — no
  health bar, no second chance, just the thing in your face and the tape stopping.
- **Somewhere to hide.** Every floor has cover of its own kind: crates in the lobby,
  lockers in the school, gurneys in the hospital, the water itself in the poolrooms.
  Some monsters check hiding places. Not all of them, and not always.
- **Chalk arrows.** Somebody came through before you and marked the way to the lift
  in chalk. You are not meant to be lost, you are meant to be caught.
- **Footage is money.** Filming the thing that is hunting you is worth more than
  anything else you can do, and you spend it in the lift.

## The lift

The doors close, the floor drops, and there is somebody's stall set up against the
back wall. Three of twelve upgrades are on offer, priced in footage, and whatever you
buy is yours for the rest of the run:

| | | |
| --- | --- | --- |
| **BETTER SHOES** | 9% faster, per level of it | **BIG LUNGS** | hold your breath longer |
| **LOW-LIGHT CCD** | a torch that reaches | **WIDE LENS** | more of the room in frame |
| **FLOOR PLAN** | start each floor knowing the way | **SOMEBODY'S CHALK** | more arrows, read further off |
| **TRACKING** | a pip on the tape edge that points at it | **SOFT SOLES** | it hears less of you |
| **QUICK HANDS** | into cover instantly, and it gives up sooner | **FRESH CELLS** | the battery lasts |
| **ADRENALINE** | sprint far longer, and the first second of a chase runs slow | **GAFFER TAPE** | one death, spliced out |

Prices climb each time you buy the same thing, the stall never offers what it has
already sold out of, and none of it carries over to the next run — which is the whole
reason to go again.

## The controls

**WASD** move · **SHIFT** run (loud) · **CTRL** crouch (quiet) · **SPACE** hop / swim up
**F** or right-mouse torch · **R** record/pause · **N** NIGHTSHOT · **scroll** zoom
**E** hide, come out, call the lift · **ESC** pause

The torch starts on, because some of these floors have nothing else. Recording
advances the tape, and the timecode in the corner is the only clock you get.

## The floors

Every floor brings its own trick — the thing that makes it that floor and not the
one above it.

| # | Floor | What lives there | Its trick |
| --- | --- | --- | --- |
| 0 | THE LOBBY | faceling | the grid stutters |
| 1 | HABITABLE ZONE | clump | the floor is loud |
| 2 | PIPE DREAMS | smiler | steam, and no light at all |
| 3 | ELECTRICAL STATION | skin-stealer | arcs off the switchgear |
| 4 | ABANDONED OFFICE | mannequin | flicker across the cubicle sea |
| 4B | THE BREAK ROOM | shepherd | one small floor, and it walks |
| 5 | TERROR HOTEL | partygoer | it shows in the mirrors first |
| 6 | LIGHTS OUT | death moth | total darkness, and it comes to your torch |
| 37 | **THE POOLROOMS** | wretch | the lights go out **under the water** |
| 7 | THALASSOPHOBIA | leviathan | fog banks over black water |
| 8 | THE CAVES | crawler | the ceiling comes down on you |
| 9 | THE SUBURBS | duller | every window is a mirror |
| 10 | THE FIELD | howler | a crowd you can hear and never see |
| 11 | THE ENDLESS CITY | mannequin | fog thick enough to lose a street in |
| 27 | THE PARKING GARAGE | crawler | something keeping pace on the deck above |
| 52 | THE HOSPITAL | nurse | ward lights failing one bay at a time |
| 94 | THE SCHOOL | mannequin | the lights go out corridor by corridor |
| 188 | THE WINDOWS | faceling | it arrives in the glass a beat early |
| FUN | LEVEL FUN =) | partygoer | the whole party hears you run |
| 283 | THE ARCHIVES | howler | a silence rule, enforced |
| 99 | THE WHITEOUT | hound | cold, away from the heat |
| ! | RUN FOR YOUR LIFE | hound | red halls and a floor that carries every step |
| 3999 | THE TERMINUS | skin-stealer | live rail and arcs, and out is a direction again |

A run draws ten: the lobby, the terminus, and eight in between picked by depth,
never the same floor twice.

## Eighteen things down here

Each one hunts differently, and that is the whole game: the **hound** is blind and
follows sound; the **smiler** is frozen by light and lethal without it; the **death
moth** comes to your torch, which on a dark floor is a choice you have to keep
making; the **faceling** ignores you until you stare; the **mannequin** only moves
while unobserved; the **skin-stealer** wears somebody who didn't make it and keeps
its distance until it doesn't; the **wretch** owns the deep end; the **nurse** walks
at your walking pace and never stops; and the **shepherd** hums, points at the way
out, is right every time, and is walking towards you while it does it. Each has its
own voice, and you will learn all of them from behind a locker door.

## How it's built

    src/kit.js         the level-authoring vocabulary — levels are pure data
    src/levels/*.js    twenty-three floor modules, no three.js anywhere in them
    src/world.js       data → merged geometry + baked light with real occlusion
    src/camcorder.js   the tape: one render target, one fullscreen shader
    src/entities.js    the hunter: one state machine, per-species behaviour flags
    src/powerups.js    the stall: twelve upgrades and what footage is worth
    src/bestiary.js    what they are, how they hunt, what they look like
    src/textures.js    63 procedural surfaces
    src/props.js       130 procedural props
    src/audio.js       room tones, footsteps, creature voices, a generative score
    src/fx.js          22 scripted scares, the jumpscare, and the dread budget

Level geometry carries baked irradiance in a vertex attribute, added to the lit
result by four injected lines of GLSL — which is why a torch still reads correctly
in a room whose baked light is zero. Lighting is baked per cell with a 2D DDA for
shadows, so light stops at walls instead of turning corners, and a pool of seven
real point lights follows you for flicker and specular. On top of that you carry two:
a spot for the beam and a short-range lamp at the lens for everything within reach,
and NIGHTSHOT is a third — an emitter, not a filter, which is why it costs battery
and why it actually shows you a room the torch cannot. Every wall is double-sided and
every ceiling change gets a bulkhead, so nothing goes transparent when you look at it
from the wrong side.

Because levels are data, the whole library is checkable without a browser:

    npm run smoke:backrooms                       # builds all 23 floors
    npm run play:backrooms -- --all               # plays the loop on every floor
    npm run shot:backrooms level0 --frames 3      # screenshots in headless Chromium

The data harness proves each floor encloses itself, that the spawn is on floor, that
the lift is reachable *on foot* and far enough away to be an objective, that there is
exactly one monster and at least five hiding places, that the gimmick is one the
engine implements, that no material/prop/entity/scare name is a typo, and that the
same seed builds the same floor twice. The play harness then does it with a keyboard:
hides in the cover, lets the monster catch the player, checks the death card, rides
the lift, buys from the stall, and confirms the upgrade survives the descent.

## Content note

Flashing lights, sudden loud sound, enclosed spaces, deep water. No gore.
Headphones are strongly recommended and are also the worst decision you can make.
