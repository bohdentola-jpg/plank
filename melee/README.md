# MASCOT MELEE 64 🏆

*Twelve mascots. One trophy. No rules worth mentioning.*

A chunky 64-era platform fighter for the EB GAMES 95 shelf: knock the other
mascots off the stage, don't get knocked off yourself. Rendered at a third of the
resolution and scaled up, with crisp DOM overlays on top, the way the 64 did it.

    python3 serve.py melee        # or pick MASCOT MELEE 64 on the desktop

## The roster

Twelve original mascots, each with a full moveset — jabs, tilts, smashes, five
aerials, four specials, a finisher, grabs and four throws — and stats that actually
differ: weight, fall speed, air speed, jump height, traction.

## Modes

- **SMASH** — up to four fighters, stocks or time, items on or off
- **GAUNTLET** — a ladder of fights that gets meaner, with a boss at the top
- **TRAINING** — a dummy, hitbox readouts, and infinite patience

Two players share a keyboard, or plug in two pads — press any button on a pad and
it takes over a slot. **CRT mode** and the 64-era **render scale** are in OPTIONS.

## Dev

The sim — fighters, hitboxes, stages, CPU — is deliberately free of three.js and
the DOM, so a whole match runs headless at thousands of frames per second:

    npm run smoke:melee        # frame data, move drill, and CPU-vs-CPU matches

That harness validates every hitbox window against its move, executes all 300-odd
moves against a pinned dummy and requires each to connect, then plays matches
across the roster and every stage watching for stalls, NaN and broken collision —
and reports kill percents and match lengths so the balance can be read at a glance.
