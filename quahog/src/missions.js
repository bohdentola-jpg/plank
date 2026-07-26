// The objective runner. Mission *data* lives in story.js; this turns an
// objective list into markers, pickups, timers, chases and boss fights.
import { sfx } from './audio.js';

export {
  LEVELS, MISSIONS, missionById, levelById, missionsForLevel,
  availableIn, levelComplete, storyProgress,
} from './story.js';

// ------------------------------------------------------------------- runner
/**
 * Turns an objective list into live world state. The world provides the
 * spawning primitives; this only decides what should exist and when.
 */
export class MissionRunner {
  constructor(world) {
    this.world = world;
    this.mission = null;
    this.objIndex = 0;
    this.obj = null;
    this.timer = 0;
    this.count = 0;
    this.crashes = 0;
    this.failed = false;
  }

  get active() { return !!this.mission; }

  start(mission) {
    this.mission = mission;
    this.objIndex = -1;
    this.crashes = 0;
    this.failed = false;
    this.world.onMissionStart?.(mission);
    this.nextObjective();
  }

  nextObjective() {
    this.cleanup();
    this.objIndex++;
    const list = this.mission.objectives;
    if (this.objIndex >= list.length) { this.complete(); return; }
    const o = list[this.objIndex];
    this.obj = o;
    this.count = 0;
    this.timer = o.time || 0;
    const w = this.world;

    if (o.type === 'goto') {
      const p = w.resolveSpot(o.to);
      w.setMarker(p.x, p.z, { color: '#f2b705', radius: o.r || 6, label: o.label });
    } else if (o.type === 'collect') {
      const pts = o.spread === 'town' ? w.randomTownPoints(o.n) : w.randomPointsAround(w.resolveSpot(o.around), o.radius || 50, o.n);
      w.spawnPickups(pts, o.item || 'crate');
    } else if (o.type === 'race') {
      w.spawnCheckpoints(o.route);
      if (o.rival) w.spawnRival(o.rival, o.route);
    } else if (o.type === 'smash' || o.type === 'zap') {
      w.setMarker(null);
    } else if (o.type === 'evade') {
      w.setWanted(o.wanted || 2);
    } else if (o.type === 'brawl') {
      w.spawnBrawlers(o.n);
    } else if (o.type === 'boss') {
      w.spawnBoss(o.hits);
    }
    w.hud.setObjective(this.mission.title, o.label, this.timer);
  }

  /** Called by the world when something mission-relevant happens. */
  notify(event, data) {
    if (!this.obj) return;
    const o = this.obj;
    if (event === 'pickup' && o.type === 'collect') {
      this.count++;
      sfx.coin();
      if (this.count >= o.n) this.nextObjective();
    } else if (event === 'smash' && o.type === 'smash') {
      this.count++;
      if (this.count >= o.n) this.nextObjective();
    } else if (event === 'zap' && o.type === 'zap') {
      this.count++;
      if (this.count >= o.n) this.nextObjective();
    } else if (event === 'checkpoint' && o.type === 'race') {
      this.count++;
      sfx.coin();
      if (this.world.checkpointsLeft() === 0) this.nextObjective();
    } else if (event === 'reachedMarker' && o.type === 'goto') {
      this.nextObjective();
    } else if (event === 'brawlDown' && o.type === 'brawl') {
      this.count++;
      if (this.count >= o.n) this.nextObjective();
    } else if (event === 'bossDown' && o.type === 'boss') {
      this.nextObjective();
    } else if (event === 'crash') {
      this.crashes++;
      if (o.maxCrashes && this.crashes > o.maxCrashes) this.fail('You wrecked the cargo.');
    } else if (event === 'busted') {
      this.fail('Busted.');
    }
  }

  update(dt) {
    if (!this.mission || !this.obj) return;
    const o = this.obj;
    const w = this.world;
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        // running the clock out is the whole point of an escape
        if (o.type === 'evade') { this.nextObjective(); return; }
        this.fail('Out of time.');
        return;
      }
    }
    // shaking the cops early also counts
    if (o.type === 'evade' && w.wanted === 0) { this.nextObjective(); return; }

    const total = o.n || 0;
    const shown = o.type === 'race' ? `${w.checkpointsTaken()}/${w.checkpointsTotal()}`
      : total ? `${this.count}/${total}` : '';
    w.hud.updateObjective(shown, this.timer);
  }

  complete() {
    const m = this.mission;
    this.cleanup();
    this.mission = null;
    this.obj = null;
    this.world.onMissionComplete?.(m);
  }

  fail(reason) {
    const m = this.mission;
    this.cleanup();
    this.mission = null;
    this.obj = null;
    this.world.onMissionFail?.(m, reason);
  }

  abandon() {
    if (!this.mission) return;
    const m = this.mission;
    this.cleanup();
    this.mission = null;
    this.obj = null;
    this.world.onMissionFail?.(m, 'Abandoned.');
  }

  cleanup() {
    const w = this.world;
    w.clearPickups();
    w.clearCheckpoints();
    w.setMarker(null);
    w.clearBrawlers();
    w.clearRival();
  }
}
