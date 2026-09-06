> **New in this repo:** [**GRIDIRON GALAXY: The Long Bomb**](gridiron-galaxy/README.md), a from-scratch 5v5 space football game with its own launcher in `gridiron-galaxy/` (`play.bat` or `python3 serve.py`).

# GRIDIRON GALAXY: The Long Bomb 🏈🚀

A cartoon 5-on-5 football game set in space, built from scratch in the browser with
three.js. Ten kids from Maple Street chase their abducted football across 29 planets
and one very smug mothership.

**Play it:** double-click `play.bat` (Windows) or run `python3 serve.py`, then open the
URL it prints. Plug in a PS5 DualSense (or any standard gamepad) over USB and press any
button. Keyboard and mouse work too.

## What's in the box

- **3D space hub.** The main menu is the galaxy itself: fly the GOOBER rocket between
  planets with the sticks, look around, and land wherever your rocket's range allows.
  Range grows with every rocket part you win.
- **31 places to land.** Earth, 29 story planets (moon colony, lava world, candy planet,
  pirate asteroid, disco planet, library planet, a black hole's edge…) and the
  Mothership. Every planet has its own painted 2.5D main district, sky, weather, and
  building style, plus a stadium that changes size, surface, lighting, and physics
  quirks (low gravity, slick ice, wind, fog, sticky turf…).
- **31 teams, 31 species.** Moon bunnies, rover bots, penguins, magma salamanders,
  ghosts, greys… each with an identity perk (better passing, sky-high catches,
  fumble-forcing hits, mind-reading coverage) and a difficulty that climbs as you go.
- **Real 5v5 football.** Pick from 25 base plays (5 deep, 5 mid, 5 short, 5 run,
  5 special including flea flickers, halfback passes, reverses, punts, and field
  goals) plus 5 exclusive plays per planet. Routes are drawn on the field pre-snap.
  Lead receivers, lob or bullet, juke, spin, dive, and lateral to a trailing teammate.
  Downs, first-down markers, the clock, PATs and two-point tries, turnovers, safeties,
  overtime.
- **Shops like Splatoon's.** Each district has a restaurant (one-game food buffs), a
  gear shop (permanent upgrades in three tiers), and a playbook shop (the planet's
  five special plays), each with a talking shopkeeper. Hover a building for a live
  preview of the interior.
- **Story mode.** A backyard tutorial on Earth ends with the ball beamed into a UFO.
  Kevin's dad works for GOOBER (Galactic Operations & Orbital Bureau for Exploration
  & Research) and has a rocket in the garage. Each planet has a side quest at the
  practice field and a match against the planet's team for a rocket part. Beat the
  Probe Squad on the Mothership to get the ball back… briefly.
- **Free roam, practice, playbook.** Fly anywhere in range and play exhibitions for
  coins, practice on any unlocked stadium with the defense on or off, and browse your
  plays, team ratings, and rocket parts.
- **Everything is generated in code.** Characters, stadiums, planets, districts, shop
  interiors, music, and sound effects are procedural. There are no art or audio files.

## Controls

| Situation | PS5 | Keyboard |
| --- | --- | --- |
| Menus | D-pad/stick, ✕ confirm, ◯ back | Arrows/WASD, Space/Enter, Esc |
| Space hub | Left stick fly, right stick look, R2 boost, L2 brake, ✕ land | WASD fly, mouse-drag/arrows look, Shift boost |
| Play call | ◀ ▶ play, L1/R1 category, ✕ call, □ ask coach | A/D, F/R, Space, Q, or number keys |
| Pre-snap | ✕ snap, ◯ change play | Space, Esc |
| Quarterback | Face button over a receiver to throw (tap lob, hold bullet), left stick move, R2 sprint | 1–4 throw, WASD, Shift |
| Ball carrier | □ juke, ◯ spin, ✕ dive, L1 lateral, R2 sprint | Q, E, Space, F, Shift |
| Defense | R1 switch, ✕ dive tackle, □ swat | R, Space, Q |
| Kicks | ✕ stop the meter in the middle | Space |
| Anytime | OPTIONS pause | P / Esc |

## Dev notes

Vanilla ES modules, no build step. `vendor/three.module.js` is three r160.
QA scenes: `?scene=gallery` (every species animating), `?scene=stadium&planet=pyros`,
`?scene=game&planet=luna&auto=1&speed=4` (AI vs AI), `?scene=district&planet=aquaria`,
`?scene=shop&planet=luna&kind=plays`, `?scene=tutorial`, `?scene=hub&mode=roam`.
Save data lives in `localStorage`; erase it from Options.
