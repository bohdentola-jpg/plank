# game

A tiny multiplayer place. A gray pixel stickman in an empty white space —
the world of the [snaptic](https://www.youtube.com/@snaptic.3d) videos, playable
with your friends.

- **join lobby** — drop into a public lobby with whoever's online.
- **private** — open a lobby, get a 4-letter code, hand it to friends.
- **create map** — build your own maps: paint pixel models, place them, and
  give anything behavior with **boxscript**, the built-in language
  ([docs/boxscript.md](docs/boxscript.md)).

In the main map you can chat (bubbles pop up over your head — yours blue,
everyone else's gray), pick up and throw cardboard boxes, grab a blaster from a
stand and pop your friends into a burst of cardboard, and play ping pong at the
table (a box-bot fills in if nobody takes the other side).

**Controls:** `a/d` move · `w`/`space` jump · `e` grab (box / blaster / paddle)
· `q` drop · click = throw / blast / swing · `t` or `enter` chat · `esc` leave.

## multiplayer with no server

Lobbies run peer-to-peer over WebRTC (PeerJS). One player hosts, the rest
connect straight to them; the free public PeerJS broker only does the
introductions. That's why this whole game can live on a static host. If the
host leaves, the lobby quietly re-forms around someone else.

## run it locally

From the repo root (this game shares the repo with VARSITY 27 but is fully
separate — see the root README):

```bash
npm run game          # → http://localhost:8010
# or: python3 serve.py --dir game
# Windows: double-click play-game.bat
```

Any static file server pointed at this folder works too (ES modules need
`http://`, not `file://`).

## put it on the internet

```bash
npm run game:export
```

That writes `dist/game-site/` and `dist/game-site.zip` — drag either onto
[netlify drop](https://app.netlify.com/drop) and the game is a website.
(Or deploy from git and set the site's base directory to `game/`.)

## tests

```bash
npm run game:test     # boxscript language test suite (plain node, no deps)
npm run game:e2e      # browser tests (needs `npm install` for playwright):
                      #  - menu/editor/play smoke tour with screenshots
                      #  - boxscript bindings driven in a real session
                      #  - two-browser multiplayer over a local peerjs-server
                      #    (join by code, chat, boxes, blaster pop, pong,
                      #     host migration)
```

Screenshots land in `qa/shots/`.

## how it's put together

Plain ES modules, no build step, no assets — everything is drawn in code onto
a low-res canvas scaled up with smoothing off (that's where the pixels come
from). `js/boxscript.js` is the language (lexer → parser → coroutine
interpreter, sandboxed, budgeted so `forever` loops can't freeze a frame).
`js/net.js` is matchmaking + host-relay netcode. `js/game.js` runs a session.
`js/editor.js` is the map editor. The only third-party code is
`vendor/peerjs.min.js`.
