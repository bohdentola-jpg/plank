# Computer Lab Brawl

An original platform fighter for the browser, built to look, sound and play like
the Flash games you loaded up when the teacher wasn't looking. Rack up damage on
the other players, then knock them off the screen.

No install and no build step: plain JavaScript modules drawing on a canvas.

## Run it

**Windows:** double-click **`brawl.bat`** in the repository root. It starts the
little Python server and opens the game in your browser.

**Mac / Linux:**

```bash
python3 serve.py 8100 --path=brawl/
```

Any static web server pointed at the repository works too; open `/brawl/`.
(It has to be served over http: browsers won't load modules from `file://`.)

## Controls

Everything can be changed under **Options**.

| | One player (either hand position) | Shared keyboard, left | Shared keyboard, right | Controller |
| --- | --- | --- | --- | --- |
| Move | `WASD` or arrows | `WASD` | arrows | left stick / d-pad |
| Jump | `Space` (Up also jumps) | `Space` | `Right Shift` or `Num 0` | `X` / `Y` |
| Attack | `J` or `Z` | `F` | `,` or `Num 1` | `A` |
| Special | `K` or `X` | `G` | `.` or `Num 2` | `B` |
| Strong (hold to charge) | `I` or `V` | `T` | `L` or `Num 5` | right stick |
| Shield / dodge | `L` or `C` | `H` | `/` or `Num 3` | triggers |
| Grab | `U` or `Left Shift` | `R` | `K` or `Num 4` | bumpers |
| Pause | `Enter` or `Esc` | | | `Start` |

- Attack, Strong and Special each change with the direction you hold, on the
  ground and in the air. **Up + Special** is every fighter's way back to the stage.
- Shield, then tap sideways to roll or down to sidestep. In the air it is a dodge.
- Fall next to an edge to grab it; Up climbs, Jump hops off.
- Hold Down on a thin platform to drop through it.
- A second keyboard player joins on the fighter screen with their Attack key;
  controllers join by pressing a button. Up to four players, any mix of people
  and CPUs (levels 1-9).

## What's in a match

- **Damage and stocks.** Every hit raises your %; the higher it is, the farther
  you fly. Cross the edge of the screen and you lose a stock.
- **Gold Star.** Break it when it drifts in to earn your fighter's **super**,
  then press Special on its own.
- **Show & Tell box.** Walk into it and a helper climbs out to fight for you.
- **Stage hazards** can be switched off on the stage screen, along with items,
  the stock count and a match timer.

## Where it came from

The line-up follows a design brief: a fifteen-slot roster, each slot with a
described fighting style, super and home stage (a "what if" video by Mung).
Every character, stage, name and drawing here is original to this game; the
fighters are school-day characters rather than anyone from an existing game.

| Slot | Fighter | The idea |
| --- | --- | --- |
| 1 | Lunch Lady | long-reach spatula, thrown shakers, a conveyor-belt super |
| 2 | Sunny & Drizzle | two weather-chart mascots in one slot; swap mid-match |
| 3 | Zoomie | the class hamster: no air jump, fastest runner, flips the stage |
| 4 | Sneaks | a raccoon burglar: twirling flashlight, zapper, lights-out super |
| 5 | Soup | a hermit crab in a soup can: slow, hovers, shell slams |
| 6 | Globert | the classroom globe: always a ball, five jumps, raining dodgeballs |
| 7 | Crumbs | a pigeon in training: head-rams, dive-bombs, grows huge |
| 8 | Clicky | a mouse pointer: point-and-click movement, takes no knockback |
| 9 | Camp Kids | one shove and otherwise all slingshot; a screen-wide rocket |
| 10 | Doodle & Chomps | a doodle riding a staple remover; fill-in-the-blank super |
| 11 | The Eraser | a block that lurches about and flattens people |
| 12 | Capt. Allowance | fast brawler with a ray gun; earns his super with coins |
| 13 | Honk | a school bus: rev-up charges, drives off with passengers |
| 14 | Dale | fishing rod, honest punches, a bucket of fish to throw |
| 15 | The Sub | the AV cart: telescoping fists, charged screen blast, fast-forward |

Fighters and stages appear on the select screens once they are finished and
checked; the list of what is switched on lives in `js/fighters/index.js` and
`js/stages/index.js` (`READY`).

## For tinkerers

```bash
node brawl/tools/checks.mjs                  # scripted checks of the core mechanics
node brawl/tools/sim.mjs monkey 6000         # button-mashing crash test, every ready fighter and stage
node brawl/tools/sim.mjs cpu 3 7             # CPU round-robin with win/loss numbers
node brawl/tools/shot.mjs "sheet=lunchlady" out.png          # every pose of a fighter, with hitboxes
node brawl/tools/shot.mjs "battle=sneaks,globert&human=0&stage=greenhouse" out.png 300
```

In a match, **F2** draws hitboxes. Handy address-bar switches for testing:
`?battle=a,b,c&stage=id&cpu=7&human=0&intro=0&items=0&super=1&pct=90`.

Layout: `js/core` (input, sound, drawing kit), `js/game` (the engine: fighters,
hits, physics, camera, CPU), `js/fighters` and `js/stages` (one file each),
`js/scenes` (menus), `assets` (fonts and sound effects with their licences).

## Credits

- Sound effects and the announcer: public-domain (CC0) recordings by Kenney,
  rubberduck and artisticdude; a few were generated for this game. The full
  list is in `assets/sfx/SOURCES.txt`.
- Music: written for this game and played by the sequencer in `js/core/music.js`.
- Lettering: Titan One, Carter One, Chewy, Bangers, Boogaloo, Comic Neue,
  Silkscreen and Schoolbell, each under the open licence in `assets/fonts`.
