// Time of day and weather over Port Zarya (65.5° N, late November): the sun
// barely clears the hills around 13:30 and sets by 16:20; the long blue
// twilights fade into nights of moonlight, stars and aurora.
import * as THREE from 'three';
import { WU, updateNightMaterials } from './worldUniforms.js';

const LAT = 65.5 * Math.PI / 180;
const DEC = -20.5 * Math.PI / 180;
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Sun direction (world, +Y up, −Z north) for a local clock hour. */
export function sunDir(hour, out = new THREE.Vector3()) {
  const H = (hour - 13.6) * 15 * Math.PI / 180;
  const el = Math.asin(Math.sin(LAT) * Math.sin(DEC) + Math.cos(LAT) * Math.cos(DEC) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(LAT) - Math.tan(DEC) * Math.cos(LAT)); // from south, west positive
  // south is +Z here; west is −X
  out.set(-Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  return out;
}

export class Environment {
  constructor(scene, sky, opts = {}) {
    this.scene = scene;
    this.sky = sky;
    this.hour = opts.hour ?? 22;
    this.weather = { snow: 0.4, cloud: 0.2, aurora: 0.9, wind: 1 };
    this.sun = new THREE.DirectionalLight(0xffffff, 1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60; sc.near = 1; sc.far = 400;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0x8090a0, 0x202428, 0.4);
    scene.add(this.hemi);
    this.fogColor = new THREE.Color();
    scene.fog = new THREE.FogExp2(0x0a0e14, 0.0022);
    this.moonDir = new THREE.Vector3(-0.42, 0.55, -0.72).normalize();
    this._sd = new THREE.Vector3();
    this.exposure = 1;
  }

  /** Advance/hold the clock and push the look to every system. focus = player position. */
  update(dt, focus, camera) {
    const sd = sunDir(this.hour, this._sd);
    const elev = Math.asin(sd.y) * 180 / Math.PI;
    const night = sm(2, -9, elev);
    const twilight = sm(-12, -2, elev) * (1 - sm(-1, 4, elev));
    WU.night.value = night;
    WU.time.value += dt;
    updateNightMaterials();
    const u = this.sky.uniforms;
    u.sunDir.value.copy(sd);
    u.sunAmt.value = sm(-6, 2, elev);
    u.moonDir.value.copy(this.moonDir);
    u.moonAmt.value = night;
    u.starAmt.value = sm(-4, -12, elev) * (1 - this.weather.cloud * 0.8);
    u.aurora.value = this.weather.aurora * sm(-6, -14, elev) * (1 - this.weather.cloud * 0.7);
    u.cloud.value = this.weather.cloud;
    // sky colours: day (pale, low sun), twilight (deep blue, pink rim), night
    const zDay = new THREE.Color(0.18, 0.3, 0.48), hDay = new THREE.Color(0.75, 0.72, 0.72);
    const zTw = new THREE.Color(0.03, 0.06, 0.16), hTw = new THREE.Color(0.32, 0.22, 0.3);
    const zN = new THREE.Color(0.004, 0.008, 0.022), hN = new THREE.Color(0.02, 0.045, 0.07);
    const dayK = sm(-3, 3, elev);
    u.zenith.value.copy(zN).lerp(zTw, twilight).lerp(zDay, dayK);
    u.horizon.value.copy(hN).lerp(hTw, twilight).lerp(hDay, dayK);
    u.ground.value.copy(u.horizon.value).multiplyScalar(0.4);
    // key light: the sun by day, the moon by night
    const sunUp = sm(-4, 2, elev);
    if (sunUp > 0.02) {
      // At 65° N in late November the sun never climbs past ~4°. Light the
      // world from at least ~11° so the snow doesn't flash cell by cell at a
      // grazing angle (the sky still draws the real, lower sun).
      const ld = this._ld || (this._ld = new THREE.Vector3());
      ld.copy(sd);
      if (ld.y < 0.2) { ld.y = 0.2; ld.normalize(); }
      this.sun.position.copy(ld).multiplyScalar(200);
      this.sun.color.setRGB(1.0, 0.62 + 0.25 * sm(0, 4, elev), 0.38 + 0.3 * sm(0, 4, elev));
      this.sun.intensity = 2.6 * sunUp * (0.5 + 0.5 * sm(0, 10, elev));
    } else {
      this.sun.position.copy(this.moonDir).multiplyScalar(200);
      this.sun.color.setRGB(0.55, 0.68, 0.95);
      this.sun.intensity = 0.42 * (1 - this.weather.cloud * 0.6);
    }
    if (focus) {
      this.sun.position.add(focus);
      this.sun.target.position.copy(focus);
      this.sun.target.updateMatrixWorld();
    }
    this.hemi.color.copy(u.zenith.value).multiplyScalar(2.2).add(new THREE.Color(0.05, 0.06, 0.08));
    this.hemi.groundColor.setRGB(0.12, 0.13, 0.15).multiplyScalar(0.4 + dayK);
    this.hemi.intensity = 0.55 + dayK * 0.7 + u.aurora.value * 0.15;
    if (u.aurora.value > 0.2) this.hemi.color.lerp(new THREE.Color(0.12, 0.45, 0.3), 0.25 * u.aurora.value);
    // fog takes the horizon colour
    this.fogColor.copy(u.horizon.value).multiplyScalar(0.9);
    this.scene.fog.color.copy(this.fogColor);
    this.scene.fog.density = 0.0016 + this.weather.snow * 0.0022 + this.weather.cloud * 0.0006;
    this.sky.update(dt, camera);
    this.exposure = 1.0 + night * 0.25;
    return { night, elev, twilight };
  }

  clockString() {
    const h = Math.floor(this.hour) % 24, m = Math.floor((this.hour % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
}
