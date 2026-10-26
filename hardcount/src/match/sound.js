// What a match sounds like: the sim's events turned into whistles, pads and
// helmets, the QB's cadence, the crowd (whose fans react to what), the band
// in the stands, the PA man, the organ and the soundtrack — plus the
// DualSense rumble when it's your man taking the hit.
import { sfx } from '../audio/sfx.js';
import { crowd } from '../audio/crowd.js';
import { band } from '../audio/band.js';
import { voice } from '../audio/voice.js';
import { music } from '../audio/music.js';
import { audio } from '../audio/audio.js';
import { input } from '../core/input.js';
import { clamp } from '../core/util.js';

const say = (text, kind = 'pa', chime = false) => { try { voice.say(text, { kind, chime }); } catch { /* */ } };

export class MatchSound {
  constructor(m, opts = {}) {
    this.m = m;
    this.opts = opts;
    this.excite = 0.35;
    this.spike = 0;
    this.t = 0;
    this.lastBounce = 0;
    this.prevBall = null;
    this.users = opts.users || { home: null, away: null };
    this.indoor = opts.roof === 'dome';
    this.size = clamp((opts.capacity || 40000) / 70000, 0.08, 1);
    this.homeShare = opts.neutral ? 0.5 : 0.82;
    this.unsub = m.on((ev) => this.onEvent(ev));
    try {
      sfx.ambience(opts.ambience || (this.indoor ? 'dome' : opts.capacity < 1000 ? 'park' : 'stadium'));
      if (opts.weather === 'rain') sfx.rain(0.7);
      if (opts.weather === 'snow' || opts.wind > 0.5) sfx.wind(0.35 + (opts.wind || 0) * 0.4);
    } catch { /* */ }
  }

  dispose() {
    this.unsub?.();
    try { crowd.stop(1.2); band.play(null); sfx.footsteps(0); sfx.rain(0); sfx.wind(0); sfx.stopAll?.(); voice.cancel(); } catch { /* */ }
  }

  /** Whose fans: 'home' / 'away' for a side. */
  fans(side) { return side; }

  rumbleFor(e, strong, weak, ms) {
    if (!e) return;
    const m = this.m;
    const ctrl = this.users[e.side];
    if (ctrl === null || ctrl === undefined) return;
    if (m.userEnt[e.side] !== e) return;
    input.rumble(strong, weak, ms, ctrl);
  }

  onEvent(ev) {
    const m = this.m;
    try {
      switch (ev.type) {
        case 'lineup':
          if (m.playKind !== 'kickoff') { band.play(null); }
          break;
        case 'hardCount': sfx.cadence('hard'); break;
        case 'snap':
          sfx.cadence('hut');
          setTimeout(() => { try { sfx.snap(); } catch { /* */ } }, 60);
          break;
        case 'kick':
          sfx.kickBall(ev.kind === 'pat' ? 'fg' : ev.kind);
          if (ev.kind === 'kickoff') crowd.react('cheer', 0.5, 'all');
          break;
        case 'hit': {
          const p = ev.power || 0.4;
          sfx.hit(p, ev.kind === 'big' ? (Math.random() < 0.5 ? 'helmet' : 'pads') : ev.kind === 'truck' ? 'pads' : 'tackle');
          if (p > 0.55 && Math.random() < 0.6) sfx.grunt(0.5 + p * 0.4, 0.04);
          if (ev.kind === 'big' && p > 0.7) { crowd.react('ooh', 0.6 + p * 0.3, 'all'); this.spike = Math.max(this.spike, 0.35); }
          this.rumbleFor(ev.c, 0.4 + p * 0.6, 0.3 + p * 0.4, 120 + p * 160);
          this.rumbleFor(ev.d, 0.3 + p * 0.5, 0.2 + p * 0.3, 100 + p * 120);
          break;
        }
        case 'block': if (Math.random() < 0.3) sfx.hit(0.25, 'pads'); break;
        case 'pancake': sfx.hit(0.7, 'ground'); crowd.react('ooh', 0.4, 'all'); break;
        case 'catch':
          sfx.catchBall(ev.kind === 'dive' || ev.kind === 'high' ? 'body' : 'hands');
          this.rumbleFor(ev.e, 0.15, 0.35, 70);
          break;
        case 'drop': sfx.catchBall('bobble'); crowd.react('aah', 0.6, 'all'); break;
        case 'throw':
          if (ev.rec && (ev.plan?.dist || 0) > 20) { crowd.react('murmur', 0.5, 'all'); this.spike = Math.max(this.spike, 0.3); }
          this.rumbleFor(ev.qb, 0.05, 0.25, 60);
          break;
        case 'interception':
          crowd.react('gasp', 0.9, 'all');
          crowd.react(ev.e.side === 'home' ? 'roar' : 'groan', 0.9, 'home');
          music.stinger('turnover');
          this.spike = 0.8;
          break;
        case 'fumble':
          if (ev.c) { crowd.react('gasp', 0.8, 'all'); this.spike = 0.7; this.rumbleFor(ev.c, 0.8, 0.6, 260); }
          break;
        case 'recover':
          if (ev.turnover) { crowd.react(ev.e?.side === 'home' ? 'roar' : 'boo', 0.85, 'home'); music.stinger('turnover'); }
          break;
        case 'lateral': case 'pitch':
          if (ev.type === 'lateral') { crowd.react('ooh', 0.7, 'all'); this.spike = Math.max(this.spike, 0.5); }
          break;
        case 'move':
          if (ev.move === 'hurdle' || ev.move === 'spin' || ev.move === 'juke') { crowd.react('ooh', 0.45, 'all'); }
          break;
        case 'missedTackle': crowd.react('ooh', 0.4, 'all'); break;
        case 'flag': sfx.flagThrow(); crowd.react('murmur', 0.6, 'all'); break;
        case 'firstDown':
          sfx.chains();
          crowd.react('cheer', 0.55, ev.side === 'home' ? 'home' : 'away');
          break;
        case 'whistle': {
          const r = ev.result;
          sfx.whistle(m.flags.length ? 'double' : r?.type === 'td' ? 'long' : 'short');
          if (!r) break;
          if (r.sack) { crowd.react(m.defSide === 'home' ? 'roar' : 'groan', 0.7, 'home'); }
          else if (r.type === 'incomplete') crowd.react(m.offSide === 'home' ? 'aah' : 'cheer', 0.5, 'home');
          else if (r.side === m.offSide && r.yards >= 20 && r.type !== 'td') { crowd.react(m.offSide === 'home' ? 'roar' : 'groan', 0.8, 'home'); music.stinger('bigplay'); }
          break;
        }
        case 'score': {
          const home = ev.side === 'home';
          if (ev.kind === 'td') {
            crowd.react(home ? 'roar' : 'boo', 1, 'home');
            if (!home) crowd.react('cheer', 1, 'away');
            music.stinger('td');
            if (home) setTimeout(() => { try { band.play('fight'); } catch { /* */ } }, 2600);
            const t = m.teams[ev.side];
            setTimeout(() => say(`Touchdown, ${t.city}!`, 'pa', true), 1400);
            this.spike = 1;
            for (const side of ['home', 'away']) { const c = this.users[side]; if (c !== null && c !== undefined) input.rumble(side === ev.side ? 0.6 : 0.2, 0.8, 500, c); }
          } else if (ev.kind === 'fg') {
            crowd.react(home ? 'cheer' : 'groan', 0.8, 'home');
            setTimeout(() => say(`The kick is good. ${m.teams[ev.side].city} three.`, 'pa', true), 1200);
          } else if (ev.kind === 'pat' || ev.kind === 'two') crowd.react(home ? 'cheer' : 'boo', 0.5, 'home');
          else if (ev.kind === 'safety') { crowd.react(home ? 'roar' : 'groan', 0.9, 'home'); say('Safety!', 'pa', true); }
          break;
        }
        case 'fgMissed': crowd.react(m.offSide === 'home' ? 'groan' : 'cheer', 0.8, 'home'); break;
        case 'turnoverOnDowns': crowd.react(m.defSide === 'home' ? 'roar' : 'groan', 0.8, 'home'); break;
        case 'twoMinute':
          music.stinger('twominute');
          say('Two minutes remaining in the ' + (m.quarter === 2 ? 'half.' : 'game.'), 'pa', true);
          break;
        case 'timeout': sfx.whistle('short'); say(`Timeout, ${m.teams[ev.side].city}.`, 'pa', false); break;
        case 'penaltyAccepted': {
          const f = ev.flag;
          if (f) say(`${f.name.toLowerCase().replace(', offense', '')}, ${f.on === m.offSide ? 'offense' : 'defense'}. ${f.yards} yard penalty.`, 'ref');
          break;
        }
        case 'quarterEnd': sfx.whistle('long'); break;
        case 'halftime': band.play('fight'); music.play('halftime', { fade: 2 }); break;
        case 'final': {
          const u = this.users.home !== null && this.users.home !== undefined ? 'home' : this.users.away !== null && this.users.away !== undefined ? 'away' : 'home';
          const won = m.score[u] > m.score[u === 'home' ? 'away' : 'home'];
          music.stinger(won ? 'win' : 'lose');
          setTimeout(() => { try { music.play(won ? 'postgame_win' : 'postgame_loss', { fade: 2.5 }); } catch { /* */ } }, 2600);
          crowd.react(m.score.home > m.score.away ? 'roar' : 'boo', 1, 'home');
          break;
        }
        default: break;
      }
    } catch (e) { /* sound never breaks the game */ }
  }

  /** Every frame: crowd excitement, footsteps, ball bounces, music state. */
  update(dt, st = {}) {
    const m = this.m;
    this.t += dt;
    // how loud the place is: the situation plus whatever is happening right now
    const F = m.field;
    const close = 1 - clamp(Math.abs(m.score.home - m.score.away) / 21, 0, 1);
    const late = m.quarter >= 4 ? 0.25 : m.quarter === 2 && m.clock < 120 ? 0.1 : 0;
    const toGoal = m.phase === 'live' || m.phase === 'presnap' ? F.toGoal(m.los, m.offDir) : 50;
    const redZone = toGoal < 20 ? 0.18 : 0;
    let live = 0;
    if (m.phase === 'live') {
      const c = m.ball.carrier;
      if (c) live = clamp(c.speed / 10, 0, 1) * 0.35 + (F.toGoal(c.z, m.dirFor(c)) < 15 ? 0.25 : 0);
      if (m.ball.state === 'air' && m.ball.kind === 'pass') live = 0.45;
    }
    // home fans get loud when the visitors have the ball on a big down
    const thirdDownD = m.phase === 'presnap' && m.down >= 3 && m.offSide === 'away' ? 0.25 : 0;
    this.spike = Math.max(0, this.spike - dt * 0.12);
    const target = clamp(0.28 + close * 0.15 + late + redZone + live + thirdDownD + this.spike, 0, 1);
    this.excite += (target - this.excite) * (1 - Math.exp(-dt * 1.6));
    try {
      crowd.update(dt, { excitement: this.excite, size: this.size, home: this.homeShare, indoor: this.indoor });
      band.update();
      music.update();
      // footsteps: the pace of the bodies nearest the camera
      if (m.phase === 'live') {
        let s = 0, n = 0;
        for (const e of m.active) { s += Math.min(1, e.speed / 9); n++; }
        sfx.footsteps(clamp((n ? s / n : 0) * 0.9, 0, 1));
      } else sfx.footsteps(0);
      // the ball hitting the turf
      const b = m.ball;
      if (b.state === 'loose' || b.state === 'air') {
        if (this.prevBall && this.prevBall.vy < -1.5 && b.vy > 0 && b.y < 0.3 && this.t - this.lastBounce > 0.12) {
          sfx.ballBounce(clamp(-this.prevBall.vy / 8, 0.2, 1));
          this.lastBounce = this.t;
        }
      }
      this.prevBall = { vy: b.vy, y: b.y };
      music.setGameState({
        quarter: m.quarter, clock: m.clock,
        scoreDiff: st.userSide ? m.score[st.userSide] - m.score[st.userSide === 'home' ? 'away' : 'home'] : 0,
        redZone: toGoal < 20, twoMinute: (m.quarter === 2 || m.quarter >= 4) && m.clock < 120,
        playLive: m.phase === 'live',
      });
    } catch { /* */ }
  }

  /** Between plays: the band, the organ, the PA. */
  betweenPlays() {
    const m = this.m;
    try {
      const r = Math.random();
      if (m.offSide === 'away' && m.down >= 3 && r < 0.45) {
        sfx.pa(r < 0.2 ? 'organ_defense' : 'organ_charge');
        if (r >= 0.2) setTimeout(() => { try { crowd.react('charge', 0.8, 'home'); } catch { /* */ } }, 2400);
        else setTimeout(() => { try { crowd.react('chant', 0.8, 'home'); } catch { /* */ } }, 600);
      } else if (r < 0.25 && !band.playing) band.play('cadence');
      else if (r < 0.32) sfx.pa('organ_letsgo');
    } catch { /* */ }
  }

  setUsers(users) { this.users = users; }
  get audio() { return audio; }
}
