// Backyard Blitz: quick two-on-two football around the sprinklers. This is the
// drive-battle engine on a small yard (no linemen, a rush count, four downs to
// score), wrapped in the minigame shell for medals and prizes.
import { G } from '../core/game.js';
import { Minigame } from './shell.js';
import { CAST } from '../data/cast.js';

export default class Blitz extends Minigame {
  static meta = {
    id: 'blitz', title: 'Backyard Blitz', icon: '🏡',
    blurb: 'Two on two against the Acorn twins. Four downs to score, then they get the ball. First to three touchdowns. The sprinklers stay ON.',
    controls: [['a', 'snap on HIKE, catch, juke, dive tackle'], ['t1', 'throw'], ['b', 'spin'], ['y', 'lateral / switch']],
    scoreLabel: 'points', goals: [5, 40, 50], hasHard: true, music: 'minigame',
  };

  setup() {
    this.scene.background = null;
  }

  async begin() {
    const S = G.S;
    const partner = ['zip', 'june', 'slush', 'sal', 'pip', 'hollow'].find((id) => S.roster.includes(id)) || S.roster.find((id) => id !== 'captain') || 'captain';
    const res = await G.hooks.battle({
      team: 'acorns', bonus: this.hard ? 3 : 0, kind: 'drive', blitz: { target: 3, maxTurns: 8 },
      size: 2, offRoles: ['QB', 'WR1'], defRoles: ['RUSH', 'CB1'], cpuIdx: [0, 2],
      L: 30, HW: 8, EZ: 5, venue: 'blitz', hazard: 'sprinklers', tod: 'day',
      squad: ['captain', partner], rushDelay: this.hard ? 1.5 : 2.3,
      plays: ['sprinkler_slant', 'pumpkin_post', 'fence_fade', 'curl_flat'], defPlays: ['man_lock'],
      noRewards: true, quietEnd: true, music: 'minigame',
    });
    const mine = Math.round((res.score ? res.score[0] : 0) / 6), theirs = Math.round((res.score ? res.score[1] : 0) / 6);
    const score = Math.max(0, mine * 10 + (res.won ? 20 : 0) - theirs * 5);
    this.finish({ score, won: !!res.won, title: res.won ? 'You win!' : 'The twins take it', detail: `${CAST[partner] ? 'You and ' + (partner === 'captain' ? 'yourself' : CAST[partner].name) : 'You'} ${mine} — ${theirs} Acorn twins` });
  }
}
