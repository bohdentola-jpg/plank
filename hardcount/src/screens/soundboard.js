// SOUNDBOARD — audio QA. Every sound effect, loop, crowd reaction, band piece,
// music theme and stinger in the game, playable from the pad or the keyboard,
// with the controls the game drives (crowd excitement/size/home share, game
// state for the music, loop levels) and a live output meter.
//   L1/R1 [Q/E] pages · ↑↓ choose · ✕ [Enter] play · ←→ adjust · ◯ [Esc] back
// Open it with ?screen=soundboard.
import { registerScreen, go } from '../main.js';
import { input } from '../core/input.js';
import { Menu } from '../core/menu.js';
import { C, W, H, text, vText, panel, header, hints } from '../core/ui.js';
import { audio } from '../audio/audio.js';
import { sfx } from '../audio/sfx.js';
import { crowd } from '../audio/crowd.js';
import { band } from '../audio/band.js';
import { music } from '../audio/music.js';
import { voice } from '../audio/voice.js';
import { THEMES } from '../audio/music/themes.js';

const pct = (v) => `${Math.round(v * 100)}%`;

registerScreen('soundboard', () => {
  const st = {
    strength: 1, crowdOn: true, excitement: 0.3, size: 0.85, home: 0.7, indoor: false, side: 'default',
    steps: 0, rain: 0, wind: 0, amb: 'stadium', intensity: 0.6, pa: 'theme',
    quarter: 1, diff: 0, red: false, two: false, live: false,
  };
  let last = 'NONE', lastT = 0, tab = 0, t = 0;
  const timers = [];
  const fire = (label, fn) => {
    audio.unlock();
    try { fn(); } catch (e) { console.error(e); }
    last = label;
    lastT = 0;
  };
  const act = (label, fn, hint) => ({ label, type: 'action', run: () => fire(label, fn), hint });
  const slider = (label, key, hint, step = 0.05) => ({ label, type: 'slider', min: 0, max: 1, step, get: () => st[key], set: (v) => { st[key] = v; }, hint });
  const toggle = (label, key, hint, onSet) => ({ label, type: 'toggle', get: () => st[key], set: (v) => { st[key] = v; onSet?.(v); }, hint });
  const choice = (label, key, options, hint, onSet) => ({ label, type: 'choice', options, get: () => st[key], set: (v) => { st[key] = v; onSet?.(v); }, hint });
  const gameState = () => music.setGameState({ quarter: st.quarter, clock: st.two ? 110 : 600, scoreDiff: st.diff, redZone: st.red, twoMinute: st.two, playLive: st.live });
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  const pages = [
    {
      name: 'FIELD',
      items: [
        choice('HIT STRENGTH', 'strength', [0.15, 0.3, 0.5, 0.75, 1].map((v) => ({ value: v, label: pct(v) })), 'how hard the hits land'),
        ...['short', 'long', 'double'].map((k) => act(`WHISTLE · ${k.toUpperCase()}`, () => sfx.whistle(k), 'referee\'s pea whistle')),
        ...['pads', 'helmet', 'ground', 'tackle'].map((k) => act(`HIT · ${k.toUpperCase()}`, () => sfx.hit(st.strength, k), 'contact at the chosen strength')),
        act('GRUNT', () => sfx.grunt(st.strength)),
        ...['hands', 'body', 'bobble'].map((k) => act(`CATCH · ${k.toUpperCase()}`, () => sfx.catchBall(k))),
        ...['kickoff', 'punt', 'fg'].map((k) => act(`KICK · ${k.toUpperCase()}`, () => sfx.kickBall(k), 'boot on leather + the ball leaving')),
        act('SNAP', () => sfx.snap(), 'ball into the QB\'s hands, the line fires off'),
        ...['set', 'hut', 'hard'].map((k) => act(`CADENCE · ${k.toUpperCase()}`, () => sfx.cadence(k), 'the QB barking the count')),
        act('BALL BOUNCE', () => sfx.ballBounce(st.strength), 'one bounce at the chosen strength'),
        act('BALL BOUNCE · LOOSE BALL', () => {
          for (const [ms, s] of [[0, 1], [420, 0.62], [710, 0.4], [860, 0.28], [950, 0.15], [1020, 0.08]]) later(ms, () => sfx.ballBounce(s));
        }, 'a series of bounces, end over end'),
        act('FLAG THROWN', () => sfx.flagThrow()),
        act('CHAINS', () => sfx.chains()),
        act('SEQUENCE · SET, HUT, SNAP', () => {
          sfx.cadence('set'); later(700, () => sfx.cadence('hut')); later(1150, () => sfx.cadence('hut')); later(1400, () => sfx.snap());
          later(1500, () => sfx.footsteps(1)); later(2600, () => sfx.hit(0.9, 'tackle')); later(3300, () => sfx.whistle('short'));
        }, 'a whole play'),
      ],
    },
    {
      name: 'PA · UI · TV',
      items: [
        act('PA · CHIME', () => sfx.pa('chime')),
        act('PA · AIR HORN', () => sfx.pa('horn')),
        act('ORGAN · CHARGE!', () => sfx.pa('organ_charge')),
        act('ORGAN · CHARGE! + CROWD', () => { sfx.pa('organ_charge'); later(2000, () => crowd.react('charge', 1)); }, 'the organ calls, the crowd answers'),
        act('ORGAN · DE-FENSE', () => sfx.pa('organ_defense')),
        act('ORGAN · LET\'S GO', () => sfx.pa('organ_letsgo')),
        ...['move', 'select', 'back', 'tab', 'error', 'buy', 'unlock'].map((k) => act(`UI · ${k.toUpperCase()}`, () => sfx.ui(k))),
        act('STATIC BURST', () => sfx.staticBurst(0.6), 'the channel change'),
        act('TV ON', () => sfx.tvOn()),
        act('TV OFF', () => sfx.tvOff()),
        act('KNOB', () => sfx.knob()),
        act('PHONE', () => sfx.phone(), 'the flip phone in the career hub'),
      ],
    },
    {
      name: 'LOOPS',
      items: [
        slider('FOOTSTEPS', 'steps', 'cleats on turf — how many players are running'),
        slider('RAIN', 'rain', 'rain level'),
        slider('WIND', 'wind', 'wind level'),
        choice('AMBIENCE', 'amb', ['stadium', 'dome', 'park', 'bedroom', null].map((v) => ({ value: v, label: v ? v.toUpperCase() : 'OFF' })), 'venue bed + acoustic', (v) => sfx.ambience(v)),
        act('STOP ALL LOOPS', () => { st.steps = st.rain = st.wind = 0; st.amb = null; sfx.stopAll(); }),
      ],
    },
    {
      name: 'CROWD',
      items: [
        toggle('CROWD BED', 'crowdOn', 'the crowd follows the sliders below', (v) => { if (!v) crowd.stop(1); }),
        slider('EXCITEMENT', 'excitement'),
        slider('SIZE', 'size', 'a few dozen at the park … seventy thousand'),
        slider('HOME SHARE', 'home', 'how much of the crowd is cheering for the home side'),
        toggle('INDOOR', 'indoor', 'dome'),
        choice('REACTING', 'side', ['default', 'home', 'away', 'all'].map((v) => ({ value: v, label: v.toUpperCase() })), 'whose fans react'),
        ...['cheer', 'roar', 'ooh', 'aah', 'groan', 'boo', 'gasp', 'murmur', 'clap', 'chant', 'stomp', 'charge'].map((k) => act(`REACT · ${k.toUpperCase()}`, () => crowd.react(k, st.strength, st.side === 'default' ? undefined : st.side))),
        choice('REACTION STRENGTH', 'strength', [0.15, 0.3, 0.5, 0.75, 1].map((v) => ({ value: v, label: pct(v) }))),
        act('TOUCHDOWN!', () => {
          crowd.react('roar', 1); sfx.pa('horn'); music.stinger('td');
          later(2500, () => band.play('fight')); later(4000, () => voice.say('Touchdown!', { kind: 'pa' }));
        }, 'roar, air horn, stinger, then the band'),
        act('STOP CROWD', () => { st.crowdOn = false; crowd.stop(1); }),
      ],
    },
    {
      name: 'BAND',
      items: [
        act('DRUMLINE CADENCE', () => band.play('cadence'), 'between plays (loops)'),
        act('FIGHT SONG', () => band.play('fight'), 'after a touchdown (once)'),
        act('CHARGE!', () => band.play('charge')),
        act('STOP BAND', () => band.play(null)),
      ],
    },
    {
      name: 'MUSIC',
      items: [
        ...Object.keys(THEMES).filter((k) => !k.startsWith('band_')).map((k) => act(`THEME · ${k.toUpperCase()}`, () => music.play(k, { fade: 1 }))),
        slider('INTENSITY', 'intensity', 'layer density (next bar)', 0.1),
        choice('STADIUM PA', 'pa', [{ value: 'theme', label: 'THEME' }, { value: 0, label: 'CLEAN' }, { value: 1, label: 'PA' }], 'through the stadium speakers?', (v) => music.setPA(v === 'theme' ? null : v)),
        act('STOP MUSIC', () => music.stop(1.2)),
      ],
    },
    {
      name: 'GAME',
      items: [
        ...['td', 'turnover', 'bigplay', 'kickoff', 'win', 'lose', 'twominute'].map((k) => act(`STINGER · ${k.toUpperCase()}`, () => music.stinger(k))),
        act('PLAY-CALL BED', () => music.play('playcall', { fade: 1 }), 'then change the state below'),
        choice('QUARTER', 'quarter', [1, 2, 3, 4, 5].map((v) => ({ value: v, label: v === 5 ? 'OT' : `Q${v}` })), '', gameState),
        choice('SCORE DIFF', 'diff', [-21, -7, -3, 0, 3, 7, 21].map((v) => ({ value: v, label: v > 0 ? `+${v}` : `${v}` })), 'behind → the tense ostinato', gameState),
        toggle('RED ZONE', 'red', '', gameState),
        toggle('TWO-MINUTE DRILL', 'two', 'lifts the key into the climax', gameState),
        toggle('PLAY LIVE', 'live', 'music ducks under the play', gameState),
      ],
    },
    {
      name: 'VOICE',
      items: [
        { label: 'ANNOUNCER', type: 'toggle', get: () => voice.enabled, set: (v) => { voice.enabled = v; }, hint: voice.available ? 'speech synthesis' : 'no speech synthesis in this browser' },
        act('PA · TOUCHDOWN', () => voice.say('Touchdown!', { kind: 'pa', chime: true })),
        act('PA · FIRST DOWN', () => voice.say('That\'s another Bayside first down!', { kind: 'pa' })),
        act('PA · THIRD DOWN', () => voice.say('Third down. Make some noise!', { kind: 'pa' })),
        act('PA · ATTENDANCE', () => voice.say('Today\'s attendance: sixty-eight thousand, four hundred and twelve. Thank you for coming out.', { kind: 'pa', chime: true })),
        act('REF · HOLDING', () => voice.say('Holding. Offense, number seventy-two. Ten yard penalty. Repeat first down.', { kind: 'ref' })),
        act('REF · FALSE START', () => voice.say('False start. Offense, number sixty-five. Five yard penalty. Second down.', { kind: 'ref' })),
        act('STOP SPEAKING', () => voice.cancel()),
      ],
    },
  ];
  const menus = pages.map((p, i) => new Menu(p.items, { id: 'sb' + i }));
  const scroll = pages.map(() => 0);
  let meterBuf = null, freqBuf = null, peakHold = -90, peakT = 0;

  return {
    enter() {
      audio.unlock();
    },
    exit() {
      for (const id of timers) clearTimeout(id);
      try { sfx.stopAll(); crowd.stop(0.5); band.play(null); music.stop(0.5); voice.cancel(); } catch { /* */ }
    },
    update(dt, busy) {
      t += dt;
      lastT += dt;
      // the things the game drives every frame
      sfx.footsteps(st.steps);
      sfx.rain(st.rain);
      sfx.wind(st.wind);
      if (st.crowdOn) crowd.update(dt, { excitement: st.excitement, size: st.size, home: st.home, indoor: st.indoor });
      band.update();
      music.update();
      if (Math.abs(st.intensity - (st._int ?? -1)) > 1e-3) { st._int = st.intensity; music.setIntensity(st.intensity); }
      if (busy) return;
      if (input.pressed('tabL')) { tab = (tab + pages.length - 1) % pages.length; sfx.ui('tab'); }
      if (input.pressed('tabR')) { tab = (tab + 1) % pages.length; sfx.ui('tab'); }
      if (input.pressed('back')) { go('huddle'); return; }
      const it = menus[tab].update(dt);
      if (it?.run) it.run();
    },
    draw(ctx) {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0b1220');
      g.addColorStop(1, '#04060b');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      header(ctx, 'SOUNDBOARD', 'AUDIO QA · EVERY SOUND IN THE GAME', 56, 70, { size: 36 });
      // page tabs
      let x = 56;
      pages.forEach((p, i) => {
        const on = i === tab;
        const w = Math.max(70, p.name.length * 11 + 24);
        panel(ctx, x, 128, w, 30, { alpha: on ? 1 : 0.55, accent: on ? C.accent : false, skew: 8 });
        text(ctx, p.name, x + w / 2, 149, { size: 14, weight: 800, align: 'center', color: on ? '#fff' : C.dim, spacing: 1 });
        x += w + 6;
      });
      // the list (scrolls to keep the selection in view)
      const m = menus[tab], rowH = 34, top = 200, viewH = 450;
      const selY = m.sel * rowH;
      if (selY - scroll[tab] > viewH - rowH * 2) scroll[tab] = selY - viewH + rowH * 2;
      if (selY - scroll[tab] < rowH) scroll[tab] = Math.max(0, selY - rowH);
      panel(ctx, 40, 172, 560, 500, { alpha: 0.7 });
      ctx.save();
      ctx.beginPath();
      ctx.rect(40, 176, 560, 470);
      ctx.clip();
      m.draw(ctx, 84, top - scroll[tab], 480, { rowH, size: 18, hints: false });
      ctx.restore();
      const cur = m.current;
      if (cur?.hint) text(ctx, cur.hint, 64, 664, { size: 14, color: C.dim });
      if (m.items.length * rowH > viewH) {
        const sbH = viewH * (viewH / (m.items.length * rowH));
        const sbY = 180 + (scroll[tab] / (m.items.length * rowH)) * viewH;
        ctx.fillStyle = 'rgba(255,178,30,0.5)';
        ctx.fillRect(592, sbY, 3, sbH);
      }
      // status + meters
      panel(ctx, 620, 172, 370, 500, { alpha: 0.7, accent: C.cyan });
      const live = audio.ctx && audio.ctx.state === 'running';
      text(ctx, live ? 'AUDIO RUNNING' : 'NO SOUND YET — PRESS ANY KEY', 644, 204, { size: 14, weight: 800, color: live ? C.green : '#ffe8a0', spacing: 1 });
      text(ctx, 'LAST', 644, 234, { size: 12, color: C.dim, spacing: 2 });
      vText(ctx, last, 644, 260, 17, { color: lastT < 0.4 ? C.accent : '#fff', weight: 0.15 });
      const rows = [
        ['MUSIC', music.theme ? `${music.theme}${music.deck ? ` · ${Math.round(music.beatInfo().bpm)} BPM` : ''}` : '—'],
        ['BAND', band.current || '—'],
        ['CROWD', st.crowdOn ? `level ${pct(crowd.level)} · ${crowd.activeReactions} reacting` : 'off'],
        ['SFX VOICES', String(sfx.activeVoices)],
        ['SPACE', audio.spaceKind],
        ['SPEECH', voice.available ? (voice.enabled ? 'on' : 'off (announcer setting)') : 'unavailable'],
      ];
      rows.forEach(([k, v], i) => {
        text(ctx, k, 644, 298 + i * 24, { size: 12, color: C.dim, spacing: 2 });
        text(ctx, v, 760, 298 + i * 24, { size: 14, color: C.text });
      });
      // output meter: peak / RMS (dBFS) and a spectrum
      const an = audio.meter();
      if (an) {
        meterBuf ||= new Float32Array(an.fftSize);
        freqBuf ||= new Uint8Array(an.frequencyBinCount);
        an.getFloatTimeDomainData(meterBuf);
        let pk = 0, ss = 0;
        for (const v of meterBuf) { const a = Math.abs(v); if (a > pk) pk = a; ss += v * v; }
        const db = (v) => (v > 1e-6 ? 20 * Math.log10(v) : -90);
        const pdb = db(pk), rdb = db(Math.sqrt(ss / meterBuf.length));
        peakT += 1 / 60;
        if (pdb > peakHold || peakT > 1.5) { peakHold = pdb; peakT = 0; }
        const bar = (y, label, v, col) => {
          text(ctx, label, 644, y + 11, { size: 12, color: C.dim, spacing: 2 });
          ctx.fillStyle = 'rgba(255,255,255,0.08)';
          ctx.fillRect(700, y, 260, 12);
          ctx.fillStyle = col;
          ctx.fillRect(700, y, 260 * Math.max(0, (v + 60) / 60), 12);
        };
        bar(456, 'PEAK', pdb, pdb > -1.5 ? C.red : C.accent);
        bar(476, 'RMS', rdb, C.cyan);
        ctx.fillStyle = '#fff';
        ctx.fillRect(700 + 260 * Math.max(0, (peakHold + 60) / 60), 452, 2, 20);
        text(ctx, `${pdb.toFixed(1)} / ${rdb.toFixed(1)} dBFS`, 960, 506, { size: 12, color: C.dim, align: 'right' });
        an.getByteFrequencyData(freqBuf);
        const n = 48;
        for (let i = 0; i < n; i++) {
          const k = Math.floor(Math.pow(freqBuf.length, i / n));
          const v = freqBuf[Math.min(freqBuf.length - 1, k)] / 255;
          ctx.fillStyle = `rgba(70,232,255,${0.35 + 0.6 * v})`;
          ctx.fillRect(644 + i * 6.6, 650 - v * 120, 5, v * 120);
        }
      }
      hints(ctx, [['tabL', 'PAGE'], ['ud', 'CHOOSE'], ['lr', 'ADJUST'], ['confirm', 'PLAY'], ['back', 'BACK']]);
    },
  };
});
