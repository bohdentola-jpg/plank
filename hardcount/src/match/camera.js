// The camera crew. One camera, many jobs:
//   game shots   'broadcast' / 'low' (the playable cams over the offense's
//                shoulder), 'high' (all-22), 'sideline' (the press box angle)
//   cinematics   'closeup' (field level, long lens on one man), 'celebrate',
//                'kickoff', 'flyover' (the stadium on the open), 'coin'
//   replay       'endzone', 'reverse', 'skycam', 'tracking', 'field', 'free'
// Shots ease toward their framing; cut() makes the next frame jump (a real
// camera switch). shake() adds a jolt on a big hit.
import * as THREE from 'three';
import { clamp, lerp } from '../core/util.js';

const v = new THREE.Vector3(), v2 = new THREE.Vector3();

// the game cams (settings.camera): over the offense's shoulder at two heights,
// the all-22, and the press box's sideline angle
export const GAME_CAMS = ['broadcast', 'low', 'high', 'sideline'];
export const GAME_CAM_NAMES = { broadcast: 'BROADCAST', low: 'TIGHT', high: 'ALL-22', sideline: 'SIDELINE' };
export const REPLAY_CAMS = ['sideline', 'endzone', 'reverse', 'skycam', 'tracking', 'field', 'free'];
export const REPLAY_CAM_NAMES = { sideline: 'MAIN', endzone: 'END ZONE', reverse: 'REVERSE ANGLE', skycam: 'SKYCAM', tracking: 'TRACKING', field: 'FIELD LEVEL', free: 'FREE CAM' };

export class CameraDirector {
  constructor(field) {
    this.field = field;
    this.cam = new THREE.PerspectiveCamera(42, 4 / 3, 0.3, 1200);
    this.pos = new THREE.Vector3(0, 20, -40);
    this.look = new THREE.Vector3();
    this.fov = 42;
    this.jump = true;
    this.shakeAmt = 0;
    this.t = 0;
    this.shotT = 0;
    this.shotName = null;
    this.free = { yaw: 0, pitch: 0.35, dist: 22, x: 0, z: 0 };
  }

  get camera() { return this.cam; }
  cut() { this.jump = true; }
  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  /**
   * s = { shot, offDir, viewDir, los, ballX, focus {x,y,z}, vel {x,z}, spread, carrier {x,z,h}|null,
   *       target {x,z,h}|null (closeup subject), kind, dt-rate, side }
   */
  update(dt, s) {
    this.t += dt;
    if (s.shot !== this.shotName) { this.shotName = s.shot; this.shotT = 0; if (!s.blend) this.jump = true; }
    this.shotT += dt;
    const P = v, L = v2;
    let fov = 42, rate = 3.2, lookRate = 5;
    const F = this.field;
    const f = s.focus || { x: 0, y: 1, z: 0 };
    const dir = s.viewDir || 1;
    switch (s.shot) {
      case 'broadcast':
      case 'low': {
        // over the offense's shoulder: back and up, leaning toward the action
        const deep = s.deep ? 1 : 0;
        const lowK = s.shot === 'low' ? 0.72 : 1;
        const dist = (lerp(12.5, 17, deep) + (s.kind === 'kickoff' ? 6 : 0)) * lowK;
        const h = (lerp(7.2, 11, deep) + (s.kind === 'kickoff' ? 3 : 0)) * (s.shot === 'low' ? 0.62 : 1);
        const cx = clamp(f.x * 0.55 + (s.ballX ?? 0) * 0.2, -F.halfW + 4, F.halfW - 4);
        P.set(cx, h, f.z - dir * dist);
        L.set(f.x * 0.75, 0.8, f.z + dir * (5 + deep * 4));
        fov = 46;
        rate = s.live ? 4.5 : 3;
        break;
      }
      case 'high': {
        const cx = clamp(f.x * 0.3, -F.halfW + 6, F.halfW - 6);
        P.set(cx, 26, f.z - dir * 21);
        L.set(f.x * 0.4, 0, f.z + dir * 9);
        fov = 48;
        break;
      }
      case 'sideline': {
        // the press box angle: high on the home sideline, panning with the ball
        const side = -1;
        const zoom = clamp((s.spread || 18) / 30, 0.55, 1.25);
        P.set(side * (F.halfW + 34), 19 + 6 * zoom, clamp(f.z * 0.92, -F.end, F.end));
        L.set(f.x * 0.35, 0, f.z + (s.vel ? clamp(s.vel.z * 0.35, -6, 6) : 0));
        fov = 24 + 14 * zoom;
        rate = 2.4;
        break;
      }
      case 'kickoff': {
        // behind the kicker, high: the whole coverage unit and the return
        P.set(f.x * 0.3, 15, f.z - dir * 24);
        L.set(f.x * 0.5, 0, f.z + dir * 22);
        fov = 50;
        rate = 2;
        break;
      }
      case 'closeup': {
        // field level, long lens, a little drift so it breathes
        const tg = s.target || f;
        const ang = (s.angle ?? 0.9) + this.shotT * 0.05;
        const d = s.dist ?? 9;
        P.set(tg.x + Math.sin(ang) * d, 1.6, tg.z + Math.cos(ang) * d);
        L.set(tg.x, 1.25, tg.z);
        fov = s.fov ?? 26;
        rate = 2.5;
        break;
      }
      case 'celebrate': {
        // in the end zone, looking back up at the scorer
        const tg = s.target || f;
        const ez = Math.sign(tg.z || 1);
        P.set(tg.x * 0.6 + Math.sin(this.shotT * 0.3) * 3, 2.2, tg.z + ez * 9);
        L.set(tg.x, 1.4, tg.z);
        fov = 32;
        rate = 2;
        break;
      }
      case 'flyover': {
        // the open: a slow arc over the stadium, settling on the field
        const k = clamp(this.shotT / (s.dur || 7), 0, 1);
        const a = lerp(-2.2, -0.4, k * k * (3 - 2 * k));
        const r = lerp(150, 70, k), h = lerp(70, 26, k);
        P.set(Math.sin(a) * r, h, Math.cos(a) * r * 0.9);
        L.set(0, 0, 0);
        fov = 44;
        this.jump = true;
        break;
      }
      case 'coin': {
        P.set(4.5, 2.6, -6.5);
        L.set(0, 1.4, 0);
        fov = 36;
        break;
      }
      case 'endzone': {
        const ez = -(s.offDir || 1);
        P.set(f.x * 0.25, 16, ez * (F.end + 14));
        L.set(f.x * 0.6, 0, f.z);
        fov = clamp(18 + Math.abs(f.z - ez * (F.end + 14)) * 0.18, 18, 44);
        break;
      }
      case 'reverse': {
        P.set(F.halfW + 22, 9, f.z - (s.offDir || 1) * 6);
        L.set(f.x, 0.8, f.z);
        fov = 30;
        break;
      }
      case 'skycam': {
        const vz = s.vel ? s.vel.z : 0, vx = s.vel ? s.vel.x : 0;
        P.set(f.x - vx * 0.6, 13, f.z - (s.offDir || 1) * 10 - vz * 0.6);
        L.set(f.x + vx * 0.3, 0.5, f.z + (s.offDir || 1) * 4 + vz * 0.3);
        fov = 50;
        rate = 3.5;
        break;
      }
      case 'tracking': {
        // a cable cam alongside the runner, at helmet height plus a bit
        P.set(f.x + (f.x > 0 ? -7 : 7), 3.2, f.z - (s.vel ? clamp(s.vel.z, -9, 9) * 0.2 : 0));
        L.set(f.x, 1.2, f.z + (s.vel ? clamp(s.vel.z, -9, 9) * 0.25 : 0));
        fov = 38;
        rate = 4;
        break;
      }
      case 'field': {
        P.set(-(F.halfW + 3), 1.5, f.z - 2);
        L.set(f.x, 1.3, f.z);
        fov = 30;
        rate = 3;
        break;
      }
      case 'free': {
        const fr = this.free;
        fr.x = s.freeTarget ? s.freeTarget.x : fr.x;
        fr.z = s.freeTarget ? s.freeTarget.z : fr.z;
        P.set(fr.x + Math.sin(fr.yaw) * Math.cos(fr.pitch) * fr.dist, 1 + Math.sin(fr.pitch) * fr.dist, fr.z + Math.cos(fr.yaw) * Math.cos(fr.pitch) * fr.dist);
        L.set(fr.x, 1, fr.z);
        fov = 40;
        rate = 8;
        break;
      }
      default: {
        P.set(0, 30, -40);
        L.set(0, 0, 0);
      }
    }
    // never under the turf or inside the stands' first rows on the game cams
    P.y = Math.max(0.5, P.y);
    if (this.jump) {
      this.pos.copy(P); this.look.copy(L); this.fov = fov;
      this.jump = false;
    } else {
      const k = 1 - Math.exp(-dt * rate), kl = 1 - Math.exp(-dt * lookRate);
      this.pos.lerp(P, k);
      this.look.lerp(L, kl);
      this.fov += (fov - this.fov) * k;
    }
    this.cam.position.copy(this.pos);
    if (this.shakeAmt > 0.001) {
      const a = this.shakeAmt;
      this.cam.position.x += (Math.sin(this.t * 61) + Math.sin(this.t * 37)) * 0.06 * a;
      this.cam.position.y += (Math.sin(this.t * 53) + Math.sin(this.t * 29)) * 0.06 * a;
      this.shakeAmt *= Math.exp(-dt * 7);
    }
    this.cam.lookAt(this.look);
    this.cam.fov = this.fov;
    this.cam.updateProjectionMatrix();
  }

  /** World point → UI canvas coordinates (1024×768), or null when behind the camera. */
  project(p, out = { x: 0, y: 0, z: 0 }) {
    v.set(p.x, p.y, p.z).project(this.cam);
    if (v.z > 1 || v.z < -1) return null;
    out.x = (v.x + 1) * 512;
    out.y = (1 - v.y) * 384;
    out.z = v.z;
    return out;
  }
}
