# game

A 3D multiplayer world in the style of [snaptic](https://www.youtube.com/@snaptic.3d):
a gray blocky stickman, chunky pixels, and an empty white space to mess about in
with whoever else is online.

- **join lobby** — drop into a public lobby with whoever's there.
- **private** — open a lobby, get a 4-letter code, hand it out.
- **create map** — build your own worlds: model things voxel by voxel in-game,
  place them, and give anything behaviour with **boxscript**
  ([the language](docs/boxscript.md)).

## the world

You spawn in **the void** — the flat blank white circle with cardboard boxes,
two blaster stands and a ping pong table. Walk out of it in any direction and
the world grows a landscape:

| | |
| --- | --- |
| **north** | meadow with flowers, then deep forest |
| **east** | dunes and cacti |
| **south** | ash flats leading to a volcano with a lava lake in the crater |
| **west** | snowfields and pines |
| **far out** | the outer void — endless white with stray boxes |

It's one continuous place, generated from the map's seed, so everyone in a lobby
walks the same ground without a byte of terrain crossing the network.

**Things to do:** chat (bubbles pop over your head — yours in the blue apple
bubble, everyone else's in gray), pick up and throw cardboard boxes, grab a
blaster and pop your friends into a burst of cardboard, play ping pong at the
table (a cardboard box shuffles over and plays you if nobody takes the other
end), climb the volcano, fall in the lava.

**Controls:** `wasd` move · `shift` run · `space` jump · `e` grab (box, blaster,
paddle) · `q` drop · click = throw / blast / swing · `t` chat · wheel zoom ·
`f` pixel size · `esc` pause. Mouse look uses pointer lock, and falls back to
click-drag if your browser won't allow it.

## making things

**create map → new world** opens the editor: fly with `wasd`, right-drag to
look, click the ground to place, `2` to select and drag, `r` to turn, and the
inspector on the right sets size, tint, solidity and the script.

**make a model** opens the modeller — a 3D cage you fill in voxel by voxel.
Click a face to add a block, shift-click to carve one away, pick colours from
the palette, mirror while you work. Save it and it joins your palette, ready to
place or `spawn` from a script. No files, no importing: the modelling happens
inside the game.

**boxscript** is the language. It reads like English but it's a real one —
variables, lists (including lists of lists), your own functions with parameters,
return values and recursion, loops with counters, and the whole 3D world to
command:

```
to tower with n
  repeat with i from 1 to n
    spawn box at my x, i * 1.5, my z
  end
end

when clicked
  tower with 8
  say "there you go"
end
```

Full reference: [docs/boxscript.md](docs/boxscript.md), and the same thing lives
in the editor behind the **boxscript** button.

## multiplayer with no server

Lobbies are peer-to-peer over WebRTC (PeerJS). One player hosts and relays;
the free public PeerJS broker only does the introductions. That's why the whole
game runs from static hosting. If the host leaves, the lobby re-forms around
somebody else and keeps its code.

## run it locally

```bash
npm run game          # → http://localhost:8010
# or: python3 serve.py --dir game
# Windows: double-click play-game.bat
```

Any static server pointed at this folder works too (ES modules need `http://`).

## put it on the internet

```bash
npm run game:export
```

Writes `dist/game-site/` and `dist/game-site.zip` — drag either onto
[netlify drop](https://app.netlify.com/drop) and the game is a website. Or
deploy from git with the site's base directory set to `game/`.

## tests

```bash
npm run game:test     # language + geometry/physics/world suites (plain node)
npm run game:e2e      # browser tests (needs npm install for playwright):
                      #   smoke3d  — menu, world, editor, modeller, test-play
                      #   tour3d   — every biome, pong, blaster, boxes, dying
                      #   mp3d     — two browsers over a local peerjs-server
```

Screenshots land in `qa/shots/`.

## how it's put together

Plain ES modules, no build step, no art assets — every mesh is generated in
code, and the whole scene renders into a small buffer that's scaled up with
nearest-neighbour filtering, which is where the pixels come from.

| file | what it is |
| --- | --- |
| `js/boxscript.js` | the language: lexer → parser → coroutine interpreter, budgeted so a runaway loop can't freeze a frame |
| `js/terrain.js` | the open world: seeded noise, biomes, chunk streaming, props |
| `js/voxel.js` | the model format and its mesher (visible faces only, one draw call per model) |
| `js/rig.js` | the stickman and its animation, plus the cardboard death burst |
| `js/render.js` | scene, camera, and the pixelation pass |
| `js/net.js` | matchmaking, host relay, migration |
| `js/game.js` | a running session |
| `js/editor.js` | the world editor and the modeller |

The only third-party code is `vendor/three.module.js` and
`vendor/peerjs.min.js`, both vendored — nothing is fetched at runtime.
