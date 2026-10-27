// The broadcast booth, as closed captions: a play-by-play man who calls what
// happens and a color man who has an opinion about it afterwards. Lines are
// picked from the match's events, with names, spots and yardage filled in,
// and never the same line twice in a row.
import { makeRng } from '../core/util.js';
import { reporterName } from '../data/names.js';

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

function nm(e) {
  if (!e?.p) return 'HE';
  return (e.p.last || '').toUpperCase();
}
function teamName(m, side) { return (m.teams[side]?.name || side).toUpperCase(); }
// the verb after a team agrees with its name: THE GRIZZLIES SCORE, THE TIDE SCORES ({s})
const agree = (name) => (/(S|MEN)$/.test(name) ? '' : 'S');
function teamVars(m, side) { const team = teamName(m, side); return { team, s: agree(team) }; }
function spot(m, z, dir) { return m.field.spotText(z, dir); }

const L = {
  open: [
    'GOOD EVENING EVERYBODY, AND WELCOME TO {venue}. {away} AND {home}, SEVEN ON SEVEN, AND THE PLACE IS ROCKING.',
    'IT IS A BEAUTIFUL NIGHT FOR FOOTBALL HERE AT {venue}. {away} VISITING {home}.',
    'WELCOME IN TO {venue}, WHERE {home} HOST{hs} {away}. I\'M {pbp}, ALONGSIDE {clr}.',
  ],
  kickoff: ['HERE\'S THE KICK.', 'AND WE\'RE UNDERWAY.', 'THE KICK IS AWAY.', 'HIGH, END OVER END.'],
  kickTb: ['TAKES A KNEE IN THE END ZONE. TOUCHBACK.', 'NO RETURN. TOUCHBACK.'],
  deep: ['{qb} LOOKS DEEP...', 'HERE\'S THE BOMB...', '{qb} LETS IT FLY...', 'GOING FOR IT ALL...'],
  short: ['{qb} THROWS...', 'QUICK THROW...', '{qb} FIRES...'],
  catch: ['CAUGHT BY {rec} AT THE {spot}.', '{rec} HAULS IT IN.', 'COMPLETE TO {rec}.', '{rec} WITH THE GRAB.'],
  catchBig: ['WHAT A CATCH BY {rec}!', '{rec} MAKES THE PLAY! WOW!', 'HOW DID HE COME DOWN WITH THAT? {rec}!'],
  incomplete: ['INCOMPLETE.', 'NOBODY THERE. INCOMPLETE.', 'THAT ONE FALLS HARMLESSLY.', 'BROKEN UP!'],
  drop: ['AND HE DROPS IT!', 'RIGHT THROUGH HIS HANDS.', 'HE HAS TO HAVE THAT ONE.'],
  pick: ['PICKED OFF! {def}!', 'INTERCEPTED! {def} JUMPS THE ROUTE!', 'OH, IT\'S PICKED! {def} HAS IT!'],
  fumble: ['FUMBLE! THE BALL IS LOOSE!', 'HE PUTS IT ON THE GROUND!', 'IT\'S OUT! FUMBLE!'],
  recoverOff: ['{e} FALLS ON IT. THEY KEEP IT.', 'BUT {team} HANG{s} ON TO IT.'],
  recoverDef: ['{e} RECOVERS FOR {team}!', 'AND {team} COME{s} UP WITH IT! TURNOVER!'],
  td: ['TOUCHDOWN, {team}!', 'HE\'S IN! TOUCHDOWN!', '{e} INTO THE END ZONE! TOUCHDOWN!', 'TOUCHDOWN! {team} SCORE{s}!'],
  tdLong: ['{e}... {e}... HE COULD GO ALL THE WAY... TOUCHDOWN!', 'NOBODY IS CATCHING {e}! {yds} YARDS, TOUCHDOWN!'],
  sack: ['SACKED! {def} BRINGS DOWN {qb}.', '{qb} GOES DOWN. A SACK FOR {def}.', 'AND THE QUARTERBACK IS BURIED.'],
  bigRun: ['{e} BREAKS INTO THE CLEAR!', '{e} TURNS THE CORNER!', 'DAYLIGHT FOR {e}!'],
  lateral: ['THEY PITCH IT BACK!', 'A LATERAL! IT\'S STILL ALIVE!', 'AND HE FLIPS IT BACK TO {to}!', 'HE PITCHES IT TO {to}!'],
  lateral2: ['ANOTHER LATERAL!', 'AND ANOTHER ONE, TO {to}!', 'STILL ALIVE! THEY KEEP PITCHING IT!'],
  firstDown: ['FIRST DOWN.', 'THAT\'LL MOVE THE CHAINS.', 'AND THAT\'S ENOUGH FOR THE FIRST.'],
  flag: ['THERE\'S A FLAG ON THE PLAY.', 'LAUNDRY ON THE FIELD.', 'WE HAVE A FLAG.'],
  fgGood: ['THE KICK IS... GOOD!', 'RIGHT DOWN THE MIDDLE. IT\'S GOOD.', 'IT\'S GOOD FROM {dist}.'],
  fgMiss: ['NO GOOD!', 'WIDE! HE MISSES IT.', 'AND IT DOINKS OFF THE UPRIGHT. NO GOOD.'],
  safety: ['SAFETY! TWO POINTS FOR {team}!'],
  tod: ['TURNOVER ON DOWNS. THE DEFENSE HOLDS!', 'STOPPED SHORT! {team} TAKE{s} OVER.'],
  twoMin: ['TWO-MINUTE WARNING.', 'AND THAT\'LL BRING US TO THE TWO-MINUTE WARNING.'],
  ot: ['WE ARE GOING TO OVERTIME! {team} GET{s} THE BALL FIRST.', 'NOBODY BLINKED. IT\'S OVERTIME, AND {team} START{s} WITH THE BALL.'],
  ot2: ['STILL TIED! ANOTHER ROUND OF OVERTIME.', 'NEITHER ONE WILL GO AWAY. WE PLAY ON.'],
  shootout: ['STILL TIED! NOW IT\'S A SHOOTOUT: TWO-POINT TRIES, ONE EACH.', 'A SHOOTOUT! TWO-POINT TRIES UNTIL SOMEBODY MISSES.'],
  qEnd: ['THAT WILL DO IT FOR THE QUARTER.', 'END OF THE QUARTER HERE.'],
  half: ['THAT\'S HALFTIME. {lead}.', 'WE\'LL TAKE A BREAK. AT THE HALF, {lead}.'],
  final: ['AND THAT\'S THE BALLGAME. FINAL SCORE, {lead}.', 'IT\'S OVER! {lead}.'],
  third: ['THIRD AND {togo}. BIG DOWN HERE.', 'THIRD DOWN AND {togo} TO GO.', 'A CRUCIAL THIRD DOWN.'],
  fourth: ['THEY\'RE GOING FOR IT ON FOURTH DOWN!', 'FOURTH AND {togo}... AND THEY\'RE STAYING ON THE FIELD.'],
  hit: ['OH, WHAT A HIT!', 'HE GOT BLOWN UP.', 'BOOM! YOU FELT THAT ONE IN THE STANDS.'],
  juke: ['NICE MOVE!', 'HE MAKES HIM MISS!', 'JUKES HIM OUT OF HIS SHOES!'],
  hurdle: ['RIGHT OVER THE TOP!', 'HE HURDLES HIM!'],
  timeout: ['{team} CALL{s} TIME OUT.', 'TIMEOUT, {team}.'],
  // the color man, after the whistle
  cBig: ['THAT\'S A PLAYMAKER. YOU GIVE HIM A CREASE AND IT\'S OVER.', 'YOU CAN\'T COACH THAT KIND OF SPEED.', 'GREAT EFFORT. HE WANTED THAT ONE.'],
  cPick: ['HE STARED HIM DOWN THE WHOLE WAY. YOU CAN\'T DO THAT.', 'BAD DECISION. HE SHOULD HAVE THROWN IT AWAY.', 'THE DEFENSIVE BACK READ IT ALL THE WAY.'],
  cSack: ['NOWHERE TO GO WITH IT. COVERAGE WAS GREAT ON THE BACK END.', 'HE HELD IT TOO LONG.', 'THAT\'S A WIN UP FRONT FOR THE DEFENSE.'],
  cTd: ['THAT\'S HOW YOU FINISH A DRIVE.', 'THEY MADE THAT LOOK EASY.', 'WHAT A PLAY CALL. THEY HAD THEM OUTNUMBERED.'],
  cStuff: ['NOTHING THERE. THEY WERE WAITING FOR IT.', 'THE DEFENSE WINS THAT ONE AT THE LINE.'],
  cLat: ['NOW THAT\'S SEVEN-ON-SEVEN FOOTBALL. EVERYBODY GETS A TOUCH.', 'IF IT\'S WORKING, KEEP PITCHING IT!'],
};

export class Booth {
  constructor(m, hud, opts = {}) {
    this.m = m;
    this.hud = hud;
    this.rng = makeRng(opts.seed ?? 77);
    const r = makeRng((opts.seed ?? 77) + 13);
    let pbp, clr;
    try { pbp = reporterName(r); clr = reporterName(r); } catch { pbp = { first: 'Jim', last: 'Halloran' }; clr = { first: 'Ray', last: 'Dukes' }; }
    this.pbp = `${pbp.first} ${pbp.last}`.toUpperCase();
    this.clr = `${clr.first} ${clr.last}`.toUpperCase();
    this.venueName = (opts.venueName || 'THE STADIUM').toUpperCase();
    this.last = new Map();
    this.cool = 0;
    this.pending = [];
    this.enabled = opts.enabled !== false;
    this.play = { lats: 0, big: false };
    this.unsub = m.on((ev) => this.onEvent(ev));
  }

  dispose() { this.unsub?.(); }

  fill(str, vars) { return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : '')); }

  say(kind, vars = {}, delay = 0, who = 'pbp') {
    if (!this.enabled) return;
    const list = L[kind];
    if (!list) return;
    let line = pick(this.rng, list);
    if (list.length > 1 && this.last.get(kind) === line) line = pick(this.rng, list);
    this.last.set(kind, line);
    this.pending.push({ at: delay, text: this.fill(line, vars), who });
  }

  /** The open, from the top of the broadcast. */
  intro() {
    const m = this.m;
    this.say('open', { venue: this.venueName, home: teamName(m, 'home'), hs: agree(teamName(m, 'home')), away: teamName(m, 'away'), pbp: this.pbp, clr: this.clr });
  }

  lead() {
    const m = this.m;
    const h = m.score.home, a = m.score.away;
    if (h === a) return `TIED AT ${h}`;
    const s = h > a ? 'home' : 'away';
    return `${teamName(m, s)} ${Math.max(h, a)}, ${teamName(m, s === 'home' ? 'away' : 'home')} ${Math.min(h, a)}`;
  }

  update(dt) {
    for (const p of this.pending) p.at -= dt;
    const ready = this.pending.filter((p) => p.at <= 0);
    if (ready.length) {
      this.pending = this.pending.filter((p) => p.at > 0);
      // the last thing said wins if a lot happened at once
      for (const p of ready.slice(-2)) this.hud.caption(p.text, p.who);
    }
  }

  onEvent(ev) {
    const m = this.m;
    switch (ev.type) {
      case 'lineup':
        this.play = { lats: 0, big: false };
        if (m.playKind !== 'kickoff' && !m.tryMode) {
          if (m.down === 3 && m.toGo >= 4 && this.rng() < 0.6) this.say('third', { togo: Math.round(m.toGo) }, 0.4);
          if (m.down === 4 && m.play && !['punt', 'fg'].includes(m.playKind) && m.play.kind !== 'punt' && !String(m.play.id).startsWith('pt_') && !String(m.play.id).startsWith('fg_')) this.say('fourth', { togo: Math.round(m.toGo) }, 0.4);
        }
        break;
      case 'kick':
        if (ev.kind === 'kickoff' || ev.kind === 'punt') this.say('kickoff');
        break;
      case 'throw':
        if (!ev.rec || ev.away) break;
        this.say((ev.plan?.dist || 0) > 22 ? 'deep' : 'short', { qb: nm(ev.qb) });
        break;
      case 'catch': {
        const big = ev.kind === 'dive' || ev.kind === 'high' || ev.kind === 'contested';
        this.say(big ? 'catchBig' : 'catch', { rec: nm(ev.e), spot: spot(m, ev.e.z, m.offDir) }, 0.15);
        break;
      }
      case 'drop': this.say('drop', {}, 0.1); break;
      case 'interception': this.say('pick', { def: nm(ev.e) }); this.say('cPick', {}, 3.2, 'clr'); break;
      case 'fumble': if (ev.c) this.say('fumble'); break;
      case 'recover':
        if (ev.e) this.say(ev.turnover ? 'recoverDef' : 'recoverOff', { e: nm(ev.e), ...teamVars(m, ev.e.side) }, 0.3);
        break;
      case 'lateral': case 'pitch':
        // (a toss sweep's pitch and a designed handoff aren't laterals worth shouting about)
        if (ev.type === 'pitch' && (m.play?.run?.give === 'toss' || m.playKind === 'run')) break;
        this.play.lats++;
        this.say(this.play.lats > 1 ? 'lateral2' : 'lateral', { to: nm(ev.to) });
        break;
      case 'hit': if (ev.kind === 'big' && ev.power > 0.75 && this.rng() < 0.6) this.say('hit', {}, 0.2); break;
      case 'move':
        if ((ev.move === 'juke' || ev.move === 'spin') && this.rng() < 0.25) this.say('juke', {}, 0.3);
        if (ev.move === 'hurdle') this.say('hurdle', {}, 0.2);
        break;
      case 'flag': this.say('flag', {}, 0.6); break;
      case 'firstDown': if (this.rng() < 0.55) this.say('firstDown', {}, 0.5); break;
      case 'turnoverOnDowns': this.say('tod', teamVars(m, m.defSide), 0.4); break;
      case 'twoMinute': this.say('twoMin'); break;
      case 'overtime': this.say(ev.round === 1 ? 'ot' : ev.round === 3 ? 'shootout' : 'ot2', teamVars(m, ev.first), 0.6); break;
      case 'quarterEnd': if (ev.quarter === 1 || ev.quarter === 3) this.say('qEnd', {}, 0.4); break;
      case 'halftime': this.say('half', { lead: this.lead() }, 0.6); break;
      case 'final': this.say('final', { lead: this.lead() }, 0.6); break;
      case 'timeout': this.say('timeout', teamVars(m, ev.side)); break;
      case 'score': {
        const t = teamVars(m, ev.side);
        if (ev.kind === 'td') {
          const yds = Math.abs(Math.round(m.result?.yards ?? 0));
          const e = ev.e;
          if (yds >= 25 && e) this.say('tdLong', { e: nm(e), yds });
          else this.say('td', { ...t, e: nm(e) });
          this.say(this.play.lats >= 2 ? 'cLat' : 'cTd', {}, 3.4, 'clr');
        } else if (ev.kind === 'fg') this.say('fgGood', { dist: ev.dist ? `${ev.dist} YARDS` : 'THERE' });
        else if (ev.kind === 'safety') this.say('safety', t);
        break;
      }
      case 'fgMissed': this.say('fgMiss'); break;
      case 'whistle': {
        const r = ev.result;
        if (!r) break;
        if (r.sack) { this.say('sack', { def: nm(r.e?.mem?.fallBy), qb: nm(r.e) }); this.say('cSack', {}, 2.6, 'clr'); break; }
        if (r.type === 'incomplete') { this.say('incomplete'); break; }
        if (r.type === 'touchback' && m.playKind === 'kickoff') { this.say('kickTb'); break; }
        if (r.type === 'tackle' && r.side === m.offSide && r.yards >= 15 && !m.passCompleted) { this.say('cBig', {}, 1.2, 'clr'); break; }
        if (r.type === 'tackle' && r.side === m.offSide && r.yards <= -1 && !m.passThrown && this.rng() < 0.5) this.say('cStuff', {}, 1.2, 'clr');
        break;
      }
      default: break;
    }
  }
}
