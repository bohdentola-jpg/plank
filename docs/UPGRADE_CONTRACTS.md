# VARSITY 27 → "BROADCAST" upgrade — shared contracts for the build team

This document is the single agreement between the engineers upgrading the game in parallel.
Read it fully before touching code. Detailed technical maps of the current code live in
`/tmp/claude-0/-home-user-plank/8faeb5f6-051e-5c70-a5b1-884a1262b427/scratchpad/understand/`
(`ARCHITECTURE.md`, `quality-bar.md`, `rig-anim.md`, `world.md`, `game-a..d.md`, `shell-ui.md`,
`modes.md`). The owner's brief: *"a good looking 3D American football game, like NFL Street or
Madden, playable on a computer with a plugged-in PS5 controller. Every model perfect; fun, dynamic,
engaging gameplay."*

## 0. Ground rules

- **Engine facts**: Three.js r160 (`vendor/three.module.js`), vanilla ES modules, **no build step**,
  importmap: `three` → `./vendor/three.module.js`, `three/addons/` → `./vendor/addons/` (r160
  examples/jsm, also resolvable in Node via `node_modules/three`). Zero external asset files —
  every mesh is procedural, every texture a 2D canvas, every sound WebAudio.
- **Units**: 1 world unit = 1 yard. X = field length (home drives +X), Z = width (home bench +Z),
  Y up, turf at y=0. `facing = atan2(dx, dz)` (π/2 looks down +X). Rig-local forward is +Z.
  Constants come from `src/field.js` — never re-declare them.
- **Node smoke test must stay green** (`npm run smoke`, `tools/smoke.mjs`): every `src/*` module must
  import in Node without touching `window`/`document` at import time, and builders that the smoke
  exercises (`playerModel`, `stadium`, `school`, `plays`, `textures`, `game` parse) must run with the
  stubbed 2D canvas (any ctx method returns `undefined`; `getImageData` returns `undefined` — guard
  pixel reads with a fallback) and no WebGL. Add a smoke step for each new module you create.
- **QA harnesses must keep working**: `node tools/shot.mjs "?quick" out.png --wait 7000`
  (screenshots to `qa/`), `node tools/padsim.mjs "?quick" --script "…"` (virtual DualSense +
  rumble recorder), URL modes `?quick ?gallery ?nointro ?office ?editor ?drill ?hero ?create`,
  globals `window.__app`, `window.__padui`, `window.__fng = {state, game}`.
  Run screenshots from inside the repo (Playwright is in `node_modules`; in a worktree run
  `ln -s /home/user/plank/node_modules node_modules`). Headless Chromium needs
  `--enable-unsafe-swiftshader` (already in padsim; add to shot if missing).
- **Ownership**: you only edit the files assigned to you (§1). If you need something from another
  owner, code against the contract below and leave a `// INTEGRATION:` comment. Never rename an
  export another module imports. Commit on your branch with clear messages; report the branch name.
- **Quality bar**: Madden-grade rendering + proportions, NFL Street game feel (skill stick, slow-mo
  hits, style points). Every feature must be usable with a DualSense **and** a keyboard.
- **Performance budget**: 60 fps at 1080p on a mid GPU: ≤ 300 draw calls in play, ≤ 12 draw
  calls per athlete, no per-frame allocations in hot loops (pool vectors), no per-frame DOM
  rebuilds (reuse nodes), no textures > 4096², shadow map ≤ 4096² following the ball.

## 1. Workstreams and file ownership (Phase 1 runs in parallel; disjoint files)

| Stream | Owns | Must not touch |
|---|---|---|
| **A – Rig & animation** | `src/playerModel.js`, `src/animation.js`, `src/clips.js`, `src/gallery.js`, new `src/kitTextures.js` (jersey/helmet atlases, numbers, nameplates, normal maps) | `textures.js` (keep using `mkCanvas`/`tex`; `numberCanvas` may stay unused), `game.js` |
| **B – World & rendering** | `src/stadium.js`, `src/textures.js`, `src/school.js`, `src/logos.js`, new `src/render.js`, `src/field.js` (already created — extend only by appending) | `game.js`, `main.js`, `playerModel.js` |
| **D – Controller, shell, HUD** | `src/gamepad.js`, `src/padui.js`, new `src/input.js`, new `src/hud.js`, new `src/glyphs.js`, `index.html`, `styles.css`, `src/main.js`, `src/intro.js` (skip logic only), `src/office.js`/`src/builders.js`/`src/faceEditor.js`/`src/playEditor.js` (controller & modal fixes only), `README.md` controls table | `game.js`, rig/world files |
| **E – Audio** | `src/audio.js`, new `src/audioBind.js` | everything else |
| **S – game.js split** | `src/game.js` → `src/game/*.js` (behaviour-preserving), new `src/game/events.js` | all other files (may add smoke steps to `tools/smoke.mjs`) |
| **Phase 2 – Integration** | wires A/B/D/E into the split game | — |
| **Phase 3 – Gameplay** (after integration) | `src/game/*` by area: feel / AI / rules & special teams, plus `src/plays.js` | — |

## 2. Rig & animation contract (stream A)

### 2.1 Preserved API
```js
makeKit(uniform, logoCanvas|null) → kit   // uniform keys: jersey pants helmet sleeve numberFill numberStroke
                                          //   pantsStripe helmetStripe facemask socks style('classic'|'panel'|'plain') stripes2? gloves?
kit = { u, jersey, pants, helmet, mask, sock, trim, stripe, pstripe, cleat, glove, numTex, logoTex, numberOf(num) }
      // one shared material object per slot (buildRef re-skins by identity `o.material === kit.jersey`)
buildPlayer(kit, info) → rig
info = { num, build:'slim'|'avg'|'big'|'huge', skin:'#hex', look?, accessories?:{towel},
         name?: string, pos?: 'QB'|'RB'|'FB'|'WR'|'TE'|'LT'|'LG'|'C'|'RG'|'RT'|'DE'|'DT'|'LB'|'MLB'|'CB'|'FS'|'SS'|'K' }
look = { skin, hair:'none'|'buzz'|'curl'|..., hairCol, eyeCol, brow, jaw, facial, eyeBlack, visor:null|'clear'|'dark' }  // save format — keep keys
rig  = { group: THREE.Group (origin at feet, +Z forward), baseY,
         j: { <every name in JOINTS> : Object3D (Bone or Group) },   // rotation overwritten each frame by Animator.apply
         gripR, gripL: Object3D (ball attach points — child of the hand/wrist bones),
         helmetParts: Object3D[] (faceEditor toggles .visible),
         skinned: SkinnedMesh|null, hipY: number }
buildRef() → rig ; buildCoach(primary, secondary) → rig ; buildBall() → Group (long axis +X, half-length ≈ 0.157, r ≈ 0.095)
```
- `JOINTS` keeps the 16 existing names **in order** and appends new ones at the end:
  `clavL clavR wristL wristR toeL toeR` (more allowed, append only). `mirrorPose` must swap the pairs.
- Pose = `{ y, [joint]: [rx, ry, rz] }` in **degrees**; `P(spec, base)`, `clonePose`, `lerpPose`,
  `mirrorPose`, `clip(dur, loop, frames)` keep signatures. `clip()` gains an optional 4th arg
  `events: [{ t: 0..1, name }]`.
- `Animator(rig, clips)`: `play(name, {fade, rate, force, onDone, startAt})` (same-name without
  `force` only updates `rate`; unknown names ignored), `update(dt)`, `.name .t .rate .finished .overlays`.
  `tuckOverlay`, `lookOverlay` still exported (compat).
- Constants `THROW_RELEASE_S`, `KICK_CONTACT_S` exported and **exact** for the new `throwRelease`/`kick` clips at rate 1.

### 2.2 New API
```js
anim.locomotion(speed, maxSpeed, { strafe = 0 /* rad, velocity dir relative to facing, 0 = forward, ±π/2 = sideways, π = backpedal */, turbo = false })
     // call every frame while not action-locked: blends idle/jog/run/sprint/strafe/backpedal, stride-matched playback, phase-synced
anim.setLean(forwardDeg, lateralDeg)   // procedural lean (accel forward, into turns lateral); smoothed inside
anim.setLook({ yaw, pitch } | null)   // head/neck aim, degrees
anim.setTuck(blend01, side = 'L' | 'R')
anim.onEvent = (name, animator) => {}  // fired when a clip's phase crosses an event t (also on loop wrap)
anim.footIK (bool, default true)        // two-bone leg IK: feet stay on y=0, planted foot lock reduces sliding
anim.locked (getter)                    // true while a non-loop action clip is playing and not finished
```
Clip events every locomotion clip must carry: `footL`, `footR`. Actions: `throwRelease` → `release`;
`kick`/`punt`/`kickoff` → `contact`; `jukeL/jukeR/spin/hurdle/truck/stiffArmL/stiffArmR` → `plant`
(at the commit frame); tackles and falls → `impact`; catches → `catch`.

### 2.3 Clip catalogue (names are the contract; P0 must ship, P1 should)
- Locomotion P0: `idle ready jog run sprint backpedal strafeL strafeR cheer dejected` · P1: `idle2 stopHard pivotL pivotR huddle sidelineIdle sidelineIdle2 dejected2`
- Offense P0: `stance3 stance2 qbUnder snapCatch throwHold throwRelease pumpFake handoff catchHigh catchLow catchDive jukeL jukeR spin hurdle truck stiffArmL stiffArmR diveFwd stumble celebrate celebrate2` · P1: `dropback throwRun handoffTake catchOneHand catchInStride bobble qbSlide celebrate3 spike flex firstDownSignal kneel`
- Defense P0: `block tackleLunge tackleWrap tackleLow hitStick swim rip swat intJump whiff` · P1: `blockPunch bullRush`
- Falls P0: `fallBack fallFwd fallSideL fallSideR fallBigHit getUp` · P1: `fallSpin getUpBack`
- Special P0: `kick refTD` · P1: `punt kickoff refIncomplete refFirstDown`
- Keep `shuffle`. Conventions: thigh/shoulder forward swing = −rx; knee flex +rx; elbow flex −rx; chest lean +rx;
  `body +rx` = fall on face. Every action clip starts with 50–80 ms of anticipation and ends with a settle.

### 2.4 Visual bar for the athlete (P0)
One `SkinnedMesh` body (smooth shoulders/elbows/knees, ≥ 24 radial segments where it matters), PBR
materials (`MeshStandardMaterial`/`MeshPhysicalMaterial`, helmet clearcoat), correct proportions
(legs ≈ half the height; shoulder-pad shelf; position/body-type variation incl. ±3% height), helmet
shell with brow ridge + ear holes, facemask cage from tubes (2 styles: skill vs. lineman), chinstrap,
visor (clear/dark per look), jersey texture with front/back numbers + TV numbers + nameplate
(`info.name` surname) + collar/side panels, pants with stripes and belt, socks, cleats with soles,
gloves with fingers, canvas-generated muscle normal maps on arms/calves, 8 skin tones, sweat gloss on
skin. Ball: lathe prolate spheroid, pebble normal, 4 seams, white laces. Referee (striped shirt via
texture, white hat, no pads) and coach (polo/khaki/headset). `castShadow` on body/helmet,
`receiveShadow` on the body. ≤ 12 draw calls per athlete. Gallery `?gallery` must render the new rigs
with PBR-friendly lighting (use `RoomEnvironment` from `three/addons/environments/RoomEnvironment.js`).

## 3. World & rendering contract (stream B)

### 3.1 `src/render.js`
```js
export function createPipeline(container, { fov = 42, near = 0.1, far = 1200, preset = 'night', quality = 'auto', post = true } = {}) → pipeline
pipeline = {
  renderer, camera, composer,
  attach(scene),                 // scene to render; safe to call again
  render(dt),                    // composer or direct; applies shake / zoom punch / flash; dynamic resolution
  resize(),
  setPreset('night'|'golden'|'day'),   // exposure, bloom strength, fog defaults
  setQuality(level 0..3), quality: { level, auto }, onQualityChange(fn),   // 0 low … 3 ultra
  fx: { shake(amountYd, seconds), zoomPunch(deltaFov, seconds), flash(cssColor, seconds), setSlowMo(t01), setBloom(strength) },
  stats: { fps, ms, calls },
  dispose(),                     // composer render targets + renderer
}
export function disposeScene(scene)          // traverse: dispose geometries, materials, textures
export function makeSkyEnvironment(renderer, preset) → { sky: Object3D (add to scene, fog:false), envMap: Texture (PMREM), sunDir: Vector3, fogColor: Color, exposure: number }
```
Pipeline: sRGB output, ACES tonemapping, `PCFSoftShadowMap` (or VSM if it looks better), MSAA render
target (`samples: 4`) + `UnrealBloomPass` (threshold ≈ 0.9, never blooming jerseys) + `SMAAPass` or
FXAA + vignette/colour-grade `ShaderPass` + `OutputPass`. Dynamic resolution: pixel ratio
`min(dpr, 1.5)` stepping down to 1.0 when frame time > 18 ms for 30 frames, recovering slowly.
Quality levels also control shadow map size (4096/2048/1024/off), bloom on/off, crowd density.

### 3.2 `buildStadium` (superset of today's return shape)
```js
buildStadium(scene, school, rival, logoCanvas, { daytime = false, preset = daytime ? 'day' : 'night', pipeline = null, seed = school.name })
→ { group, scoreboard: { group, draw(d) }, crowd: { setExcitement(e), calm(e), update(t, dt), setDensity(f) },
    towers, sky, keyLight, envMap,
    field: { setMarkers({ losX, firstDownX, dir, show }), setPlayArt(canvas | null, losX, dir), setControlledRing(x, z, color | null) },
    chainGang: { set({ losX, firstDownX, dir, down }) },
    focusShadow(x, z),           // shadow camera follows the ball (≈ 60 × 40 yd box)
    dispose() }
```
Requirements: PBR everywhere (no Phong/Lambert in the play scene), `scene.environment` from the sky
(PMREM) when a `pipeline`/renderer is available (fall back gracefully when not — office/intro/smoke),
`scene.fog` derived from the sky horizon colour, sun/moon `DirectionalLight` shadow-caster with a
tight frustum that `focusShadow` moves, 4 light towers that actually light (non-shadow `SpotLight`s +
emissive lamp discs for bloom + lens flares via `three/addons/objects/Lensflare.js`), layered turf
(blade noise, mow stripes, paint bleed, wear between the hashes, pellet speckle, normal map), correct
HS geometry (`field.js`), pylons, regulation goalposts (`CROSSBAR_Y`, `UPRIGHT_HALF`), first-down/LOS
marker planes, chain gang + down-marker box, sideline benches with idle instanced players, coolers,
cameras, officials' spots, two-tier stands with seats and a facade, LED ribbon, scoreboard with team
names/logos/play clock, instanced crowd (≥ 8k cards) animated in the vertex shader with excitement,
present in daytime too, sky presets (night with stars & tower haze cones, golden hour, day), town
dressing (houses/streetlights beyond the fence), seeded randomness (no `Math.random()` — use a PRNG
seeded from `seed`). Keep `scoreboard.draw(d)` payload keys (`stadium mascot headerColor headerText
home away clock down toGo ballOn qtr`, plus optional `homeName awayName homeLogo awayLogo playClock
timeouts`). The office camera sits at (0, 11.55, 41.75) looking toward (…, 9.4, 32) — keep a
press-box-like structure there. `buildSchool` and `logoCanvas` keep their signatures.

## 4. Controller, shell and HUD contract (stream D)

### 4.1 `src/gamepad.js` (exports preserved, extended)
```js
export const BTN = { CROSS:0, CIRCLE:1, SQUARE:2, TRIANGLE:3, L1:4, R1:5, L2:6, R2:7, SHARE:8, OPTIONS:9, L3:10, R3:11, UP:12, DOWN:13, LEFT:14, RIGHT:15, PS:16, TOUCHPAD:17 }
export const PAD_GLYPHS = ['□','✕','◯','△']; export const THROW_BUTTONS = [BTN.SQUARE, BTN.CROSS, BTN.CIRCLE, BTN.TRIANGLE]
export function padAnnounced() / markPadAnnounced()
export class PadInput { connected, justConnected, justDisconnected, id, kind:'ps'|'xbox'|'generic',
  lx, ly, rx, ry /* radial deadzone 0.12, saturation 0.95, movement curve ^1.6 */, r2, l2 /* analog */,
  edges[], releases[], down(i), holdTime(i), pressedAt[], poll() /* idempotent per frame */,
  rumble(strong, weak, ms) /* vibrationActuator.playEffect('dual-rumble') — higher magnitude replaces, lower is dropped while stronger plays */,
  rumbleScale (0..1, 0 = off) }
export const pad = new PadInput()   // shared singleton: PadUI and the game read the same instance
```
`gamepadconnected/disconnected` events are handled; first pad that presses a button is P1.

### 4.2 `src/input.js`
```js
export class Input {
  constructor({ pad = sharedPad, settings } = {})
  update(dt)                              // once per frame, first thing
  device: 'ps' | 'xbox' | 'kb'            // live switch with 500 ms hysteresis
  move: { x, y, mag }                     // left stick / WASD-arrows, x = right, y = forward (up-field), 0..1
  look: { x, y, mag }                     // right stick (raw, radial deadzone), keyboard: none
  turbo: 0..1 (R2 or Shift)  strafe: 0..1 (L2 or Ctrl)
  pressed(name) released(name) held(name) holdTime(name)   // 'cross' 'circle' 'square' 'triangle' 'l1' 'r1' 'l2' 'r2' 'l3' 'r3' 'up' 'down' 'left' 'right' 'options' 'share' 'touchpad'
  flick() → null | 'left' | 'right' | 'up' | 'down'   // RS flick (0.3→0.7 within 80 ms, 45° sectors, must return < 0.4); keyboard: arrow keys tap
  heldDir() → null | 'up' | 'down' | 'left' | 'right' // RS held > 0.7 for ≥ 150 ms (truck)
  rumble(strong, weak, ms)                // respects settings.rumble
  glyph(name) → HTML string               // device-aware badge (PS shapes coloured, Xbox letters, key caps)
  prompt([[name, label], ...]) → HTML     // "✕ Snap  △ Hot route  ◯ Motion"
  anyPressed()
  consumeAll()                            // clear edges (after a menu handled them)
  dispose()
}
export const KEYBOARD = { /* documented default map */ }
```
Default keyboard map: `WASD`/arrows move · `Shift` turbo · `Ctrl` strafe · `Space` = cross · `K` = cross ·
`J` = square · `L` = circle · `I` = triangle · `1 2 3 4` = square/cross/circle/triangle (receiver order) ·
`Q` = L1 · `E` = R1 · `F` = R3 · `G` = L3 · `Tab` = touchpad (legend) · `Esc` = options · arrow keys = skill-stick
flicks while carrying · `Enter` = cross in menus · `Backspace` = circle in menus · `M` mute.

### 4.3 `src/hud.js` (new `Hud`; `game.js` switches to it in Phase 2)
```js
export class Hud {
  constructor(root = document, input)
  update(dt)                                        // sim-time timers for banners/tickers (no wall-clock setTimeout)
  setDevice('ps'|'xbox'|'kb')
  setBar({ homeAbbr, awayAbbr, home, away, qtr, clock, down, toGo, ballOn /* label string */, poss, homeColor, awayColor,
           homeLogo, awayLogo /* canvas|null */, timeouts: { home, away }, grade, playClock /* seconds|null */ })
  setPlayClock(seconds | null)                      // red ≤ 5
  banner(main, sub = '', seconds = 2.2, cls = '' /* 'good'|'bad'|'' */)   hideBanner()
  ticker(text, seconds)                             // "+23 YDS" under the score bug
  stylePop(text, x, y)                              // floating "+50 JUKE" at screen px
  commentary(text, seconds = 3)                     // lower-third play-by-play
  hint(html | null)                                 // contextual prompt strip (bottom-right)
  icons(list)                                       // [{ key: html, x, y, label, hot, open: 0..1 }] — reuse nodes, no innerHTML thrash
  clearIcons()
  playcall(title, cards, cb, { cols = 4 } = {})     // cards: [{ id, name, desc, art: canvas|null, tag? }]; 2-D grid; first 4 tiles show □✕◯△ shortcuts
  navPlaycall(dx, dy)  confirmPlaycall()  pickPlay(i)  hidePlaycall()  get playcallVisible
  turbo(frac | null)                                // meter; null hides
  style(points, mult)                               // style meter (NFL Street layer)
  kickMeter({ visible, phase: 'aim'|'power'|'accuracy'|'done', power: 0..1, accuracy: -1..1, aim: -1..1 })
  preSnap(menu | null)                              // { title, items: [{ glyph, label, hot }] }
  legend(visible)                                   // controller legend overlay with phase tabs
  matchup(html)  hideMatchup()  final(html)  hideFinal()  quarterCard(html, seconds)
  pause(visible)  pauseFocus(index)                 // pause menu incl. settings tab wired by main.js
}
```
DOM ids that must exist in `index.html`: existing `#game-holder #hud-bar #hud-score #hud-situation
#hud-clock #hud-banner(.main,.sub) #icons #playcall(.pc-title,.grid) #hud-hint #matchup #final #pause
#pause-resume #pause-exit` plus new `#hud-playclock #hud-ticker #hud-commentary #hud-turbo #hud-style
#hud-kick #hud-presnap #hud-legend #hud-pops`. `#office-modal` **moves to `#app` level** (the hero-mode
dead-lock fix); every non-game screen gets a `[data-back]` element for ◯; `PadUI` ignores scopes with no
visible candidates, uses the shared `pad`, highlights the first office hotspot on entry, and gets an
on-screen keyboard for text inputs. Settings: `state.settings = { difficulty:'rookie'|'pro'|'allpro'|
'allmadden', quarterMin: 3|5|8, preset:'night'|'golden'|'day', rumble: 0..1, volumes:{master,crowd,sfx,
music}, camera:'broadcast'|'hero', showArt: true, reduceMotion: false }`, persisted in the save and passed
to `new Game(holder, appState, opts)` as `appState.settings`. Play Now shows an options card first.
Title/build tag becomes a single constant `BUILD` in `main.js` rendered into the DOM.

## 5. Audio contract (stream E)

`sfx` keeps every existing method (`ensure setMuted muted crowd whistle hike thud catchPop horn chime
back firstDown kickThump introScore`) and adds:
```js
sfx.setVolumes({ master, crowd, sfx, music })   sfx.setListener(camera)  // pans/attenuates by world x relative to the camera
sfx.footstep(speed01, dist)  sfx.padHit(impulse01)  sfx.bigHit()  sfx.whistle(kind = 'play'|'penalty'|'end')
sfx.catchBall()  sfx.throwWhip()  sfx.incomplete()  sfx.kickThump(power01 = 0.8)  sfx.ballBounce(v)
sfx.crowdOhh()  sfx.crowdGroan()  sfx.crowdRoar()  sfx.chant()  sfx.organRiff()  sfx.paHorn()
sfx.menuMove()  sfx.menuConfirm()  sfx.menuBack()  sfx.playSelected()  sfx.bannerWhoosh()  sfx.tick()
sfx.music = { title(), stop(), duck(on) }        // procedural loop generator (P1)
```
Architecture: one context, master → compressor → limiter; buses crowd/sfx/ui/music; generated stadium
impulse-response reverb send; layered crowd bed with an excitement parameter; no `AudioBuffer`
allocation per hit (pre-generate noise buffers); `visibilitychange` suspend/resume; muted ramps.
`src/audioBind.js` exports `bindGameAudio(game)` that subscribes to the event bus (§6) and returns an
unsubscribe function.

## 6. Game event bus (created by stream S, used by everyone)

`src/game/events.js`: `export class Emitter { on(name, fn) → off; off(name, fn); once(name, fn); emit(name, payload) }`.
`game.events` exists on every `Game`. Event names and payloads:

| event | payload |
|---|---|
| `phase` | `{ from, to }` |
| `snap` | `{ shotgun }` |
| `throw` | `{ qb, target, power: 'lob'|'normal'|'bullet', dist }` |
| `catch` | `{ catcher, contested, user }` |
| `drop`, `incomplete` | `{}` |
| `interception` | `{ defender, user }` |
| `tackle` | `{ carrier, tackler, impulse: 0..1, big, user }` |
| `bigHit` | `{ impulse }` |
| `brokenTackle` | `{ carrier, how: 'juke'|'spin'|'truck'|'stiffArm'|'strength' }` |
| `skillMove` | `{ kind: 'juke'|'spin'|'hurdle'|'truck'|'stiffArm'|'dive'|'slide'|'protect', athlete }` |
| `fumble`, `recovery` | `{ team }` |
| `sack` | `{}` |
| `firstDown` | `{ team }` |
| `touchdown` | `{ team, scorer }` |
| `score` | `{ home, away }` |
| `kick` | `{ type: 'FG'|'XP'|'PUNT'|'KO', power }` |
| `kickResult` | `{ type, good }` |
| `whistle` | `{ kind }` |
| `playEnd` | `{ reason, gain }` |
| `crowd` | `{ excite, team }` |
| `footstep` | `{ athlete, speed, x, z }` |
| `style` | `{ points, text, athlete }` |
| `slowMo` | `{ on }` |
| `quarterEnd` | `{ qtr }` · `halftime` `{}` · `gameEnd` `{ won }` |
| `pause` | `{ on }` |
| `menu` | `{ kind: 'move'|'confirm'|'back'|'play' }` |
| `turboEmpty` | `{}` · `playClockTick` `{ seconds }` |
| `padConnected` | `{ kind }` · `padDisconnected` `{}` |

## 7. `game.js` split contract (stream S)

Behaviour-preserving extraction of the 2,722-line `Game` into `src/game/*.js` following
`ARCHITECTURE.md §13.3` (util, athlete, hud (old class stays until Phase 2), flow, rules, coachAI, lineup,
live, ai/offense, ai/defense, blocking, tackle, passing, ball, userControl, specialTeams, drills, camera,
input adapter, loop). Modules export plain functions taking `game` first (or install mixins onto
`Game.prototype`). `src/game.js` remains the facade: `export class Game` with the same constructor
signature/callbacks and `export { Hud, rosterPick, OFF_ROLES, DEF_ROLES, CLIPS }`. The `loop()` phase
switch becomes a registry (`game.phases[name] = (game, dt) => {}`) so new phases (kickoff, replay) plug
in. Field constants are imported from `src/field.js`. `game.events` is created and emitted at the
existing sites for: `phase snap throw catch drop incomplete interception tackle sack firstDown touchdown
score kick kickResult whistle playEnd crowd quarterEnd halftime gameEnd pause`. Verify with
`npm run smoke` and before/after screenshots of `?quick` (same seed/wait).

## 8. Gameplay targets for Phase 3 (so Phase 1 leaves room for them)

Movement: `maxSpd = 6.2 + spd/99·3.8` yd/s (+0.9 turbo), accel 10–13 yd/s², braking 16–18, yaw rate
8 rad/s at rest → 1.6 rad/s at top speed, turbo meter (drain 20/s, refill 12/s). Skill stick on RS:
juke L/R (0.35 s, 2.2 yd lateral), spin (0.45 s), hurdle (0.55 s, beats low tackles), truck (hold
forward, strength + momentum contest), stiff arm L1/R1, dive ✕, protect L2. QB: hold time on the
receiver button → lob/normal/bullet (21/24/28 yd/s), left stick leads the pass, L3 pump fake, R3 throw
away, R2 scramble, on-the-run accuracy penalty. Defense: L2 strafe, RS flick hit stick, ✕ dive tackle,
□ wrap/swat, △ ball hawk/INT jump, R1 switch to nearest, RS moves vs. blockers. Tackling: angle +
momentum + ratings roll, forward progress, gang tackles, fumbles (1.5% base), big hits → slow-mo 0.25×
for 0.45 s + shake + rumble + crowd "OHH". Rules: clock stops on incomplete/OOB/score/turnover, 25 s
play clock, 2-minute warning, timeouts, kickoffs, PAT/2-pt, halftime possession flip, OT. Special
teams: RS kick meter (aim → power → accuracy), FG uprights/crossbar check, punts with returner + fair
catch, kickoffs with returns. Pre-snap: △ hot routes, ◯ motion, □ audibles, L1 flip, L2 play art on
the field. AI: honest reaction delays by difficulty, zone polygons, pursuit angles, blocking contests
every 0.5 s, CPU QB progressions, tendency-aware play calling. Presentation: Madden score bug + play
clock, banners, yardage ticker, style points, commentary lines, quarter cards, box score.
