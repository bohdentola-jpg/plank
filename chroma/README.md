# CHROMA CLASH 🎨

An original 3D ink-battler for the browser. You play a **Dripkin**, a paint-drop kid who
sprays colored ink, melts into it to swim at high speed, climbs any wall they've painted,
and fights 4v4 to cover the most floor in three minutes. Between matches you hang out in
**Prism Plaza**, a lively city square with shops, NPCs, a paint fountain and a practice yard.

Everything is generated in code: models, textures, levels, music and sound effects.
There are no asset files and no build step.

## Run it

**Windows:** double-click `chroma/play.bat`.

**Mac/Linux:**

```bash
cd plank/chroma
python3 serve.py          # opens http://localhost:8100/chroma/
```

Any static server works if you serve the **repository root** (the game imports
`../vendor/three.module.js`) and open `/chroma/`. You need a WebGL2 browser
(Chrome, Edge, Firefox or Safari 15+).

## Controls

| Action | Keyboard + mouse | Controller |
| --- | --- | --- |
| Move | WASD | Left stick |
| Aim / look | Mouse (click the game to capture it) | Right stick |
| Fire / paint | Left mouse | RT |
| Swim in your ink (goo form) | Hold Shift | Hold LT |
| Jump | Space | A / ✕ |
| Splash Bomb | Right mouse | RB |
| Special | Q (or E in battle) | Y / △ |
| Turf map | Hold Tab | Back / Share |
| Interact (plaza) | E | X / □ |
| Pause | Esc | Start / Options |
| Mute | M | |

## How it plays

- **Ink is everything.** Your shots paint every surface they touch. Standing in enemy ink
  slows you and wears you down.
- **Goo form.** Hold Shift on your own ink to melt into it. You swim about twice as fast,
  refill your ink tank (the paint can on your back) in about 3 seconds, heal faster,
  and are nearly invisible to enemies.
- **Climb anything.** Paint a wall, then swim into it to climb straight up.
- **Specials.** Painting fills your special meter. *Paint Barrage* lobs a volley of giant
  ink balls; *Ink Nova* launches you up for a huge ground slam.
- **Turf Rush.** After three minutes the judges count painted floor; the team with the
  higher percentage wins. You earn coins and XP either way.

### Weapons (buy at Blastworks in the plaza)

| Weapon | Style | Special |
| --- | --- | --- |
| Spritzer | Rapid mid-range shooter, the all-rounder | Paint Barrage |
| Sweeper Roller | Hold to roll a wide carpet of ink and flatten foes; tap to fling a wave | Ink Nova |
| Pop Blaster | Explosive ink balls, and a direct hit splashes in one shot | Ink Nova |
| Longshot | Charge-up sniper beam that one-shots at full charge | Paint Barrage |

Every weapon also carries **Splash Bombs**.

### Stages

- **Tangerine Terminal**: shipping docks surrounded by water, with container lanes, a
  raised central plateau and side catwalks.
- **Skyline Courts**: a rooftop basketball court at sunset, with open light-wells to fall
  through and water-tower perches for chargers.

### Prism Plaza

Walk around, talk to the locals (they give useful tips), customize your Dripkin at the
**Style Lab** (hair style, skin, eyes, outfit and ink color), buy weapons at
**Blastworks**, try them on the pop-up **Bopbots** in the practice yard, and walk into the
**Clash Tower** to queue for Turf Rush against easy, normal or hard bots. You can paint
the whole plaza too, and it stays painted for the rest of your session.

Progress (name, look, coins, level, weapons, settings) is saved in your browser.

## Under the hood

- **Paint system:** every paintable surface has its own region in a 2048² atlas
  (R = team A, G = team B, B = baked ambient occlusion). Splats are drawn on the CPU,
  which gives exact turf counts and "what am I standing in" checks. Only the changed
  rectangles are uploaded each frame. A material shader patch turns that data into
  glossy, bumpy, noise-edged wet ink with wall drips.
- **Rendering:** HDR half-float pipeline with 4× MSAA, a mip-chain bloom, ACES tone
  mapping, sky-based image lighting, soft shadows that follow the action, a stylized
  water shader, outlined characters and a distance-based level of detail.
- **Gameplay:** capsule-versus-solid character physics, projectile and beam combat,
  bomb physics, and bots that use an A* navigation grid with paint / fight / refill /
  retreat behaviors and adjustable skill.
- **Audio:** fully synthesized with WebAudio: seven original music tracks, 3D-panned
  sound effects and ambient loops.
- **Performance:** quality is set automatically (render scale, pixel ratio and shadow
  size) to hold frame rate; you can override it under Settings → Graphics.

## Dev / QA

```bash
node chroma/tools/smoke.mjs               # paint counts, collision, raycasts, pathfinding (no browser)
node chroma/tools/shot.mjs "index.html?quick&skipintro&qa&autoplay" battle.png --wait 20000
node chroma/tools/playtest.mjs plaza      # drives real keyboard/mouse input
node chroma/tools/flowtest.mjs            # title -> creator -> plaza -> lobby -> battle
```

URL flags: `?quick` (straight into a battle), `?plaza`, `&stage=terminal|skyline`,
`&weapon=spritzer|roller|longshot|popper`, `&skill=easy|normal|hard`, `&time=<seconds>`,
`&skipintro`, `&autoplay` (a bot drives you), `&qa` (low-cost rendering for headless runs).
Screenshots go to `chroma/qa/` (git-ignored).

---

CHROMA CLASH is an original game. Its characters, names, art, music and levels are
all made for this project.
