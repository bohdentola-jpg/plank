// The marching band in the stands. It runs the music engine's band themes
// (music/th_band.js) through its own engine instance, so it plays alongside
// whatever the soundtrack is doing — and it isn't heard like a soundtrack: it
// sits across the field (a little dark and narrow, off to one side) and
// mostly arrives through the venue's acoustic (audio.space: slap echoes off
// the far stands outdoors, a long wash in a dome). Routed with the sfx.
//
// API (safe before audio.unlock(); the request starts when audio is ready):
//   band.play('cadence')   drumline cadences, looping, between plays
//   band.play('fight')     the fight song (after touchdowns), once through, then stops
//   band.play('charge')    the CHARGE! call, once
//   band.play(null)        stop (fades out)
//   band.update()          call every frame (an interval timer also keeps it going)
//   band.current           'cadence' | 'fight' | 'charge' | null
//   band.playing           true while a piece is sounding

import { audio } from './audio.js';
import { Music } from './music.js';

const PIECES = { cadence: 'band_cadence', fight: 'band_fight', charge: 'band_charge' };

class Band {
  constructor() {
    this.current = null;
    this._ctx = null;
    this._in = null;
    this.engine = new Music({ bus: () => this._chain(), prewarm: false });
  }

  // the band's place in the stadium
  _chain() {
    const ctx = audio.ctx;
    if (this._ctx === ctx && this._in) return this._in;
    this._ctx = ctx;
    const n = (type, f, q = 0.6) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
    this._in = ctx.createGain();
    const pan = ctx.createStereoPanner();
    pan.pan.value = -0.3;
    this._in.connect(n('highpass', 70)).connect(n('lowpass', 6500)).connect(pan);
    const dry = ctx.createGain();
    dry.gain.value = 0.3;
    pan.connect(dry).connect(audio.sfxBus);
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    pan.connect(wet).connect(audio.space);
    return this._in;
  }

  play(piece) {
    const theme = PIECES[piece];
    if (!theme) {
      this.current = null;
      this.engine.stop(0.9);
      return;
    }
    this.current = piece;
    this.engine.play(theme, { fade: piece === 'cadence' ? 0.5 : 0.04 });
  }

  update() {
    this.engine.update();
    // one-shot pieces stop themselves at their last bar
    if (this.current && this.engine.ctx && !this.engine.deck && !this.engine._want) this.current = null;
  }

  get playing() {
    const d = this.engine.deck;
    return !!(d && !d.dying);
  }
}

export const band = new Band();
