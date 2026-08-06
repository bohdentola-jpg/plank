// Sky, light and weather: a full day/night cycle driving sun/moon light,
// horizon fog, a star dome, drifting cloud puffs, and a weather machine
// (clear → overcast → rain/storm) with lightning at the peak. One update()
// call a frame keeps everything — including the shadow camera — glued to
// the player.

import * as THREE from 'three';
import { mulberry32, lerp, clamp, sstep } from './noise.js';

// dayT keyframes: [t, skyColor, fogColor, sunColor, sunI, hemiI]
const KEYS = [
  [0.0, 0x070b18, 0x0a1120, 0x8899cc, 0.0, 0.16],
  [0.21, 0x0d1428, 0x18203a, 0x8899cc, 0.0, 0.18],
  [0.27, 0x5a6ea6, 0xd68a52, 0xffb070, 0.85, 0.5],
  [0.34, 0x7fa8d8, 0xcfdfe8, 0xfff0d8, 1.15, 0.85],
  [0.5, 0x8fc3ea, 0xdfeaf0, 0xfff6e8, 1.3, 1.0],
  [0.66, 0x83aedd, 0xd8e2e6, 0xffeacc, 1.1, 0.85],
  [0.73, 0x6a5a90, 0xe08a4e, 0xff9a50, 0.8, 0.5],
  [0.79, 0x1c2444, 0x2a3050, 0x8899cc, 0.0, 0.2],
  [1.0, 0x070b18, 0x0a1120, 0x8899cc, 0.0, 0.16],
];

const _a = new THREE.Color(), _b = new THREE.Color();
function keyLerp(t, idx) {
  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1][0] < t) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1];
  const f = clamp((t - k0[0]) / (k1[0] - k0[0]), 0, 1);
  if (idx >= 4) return lerp(k0[idx], k1[idx], f);
  _a.setHex(k0[idx]); _b.setHex(k1[idx]);
  return _a.lerp(_b, f);
}

export class Sky {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = mulberry32(seed ^ 0x5e77);

    scene.background = new THREE.Color(0x8fc3ea);
    scene.fog = new THREE.Fog(0xdfeaf0, 380, 1300);

    this.hemi = new THREE.HemisphereLight(0xbfd8ee, 0x50573c, 0.9);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xfff2dd, 1.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    sc.near = 20; sc.far = 420;
    this.sun.shadow.bias = -0.0007;
    scene.add(this.sun);
    scene.add(this.sun.target);

    // sun disc + moon
    this.sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(26, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff3c8, fog: false })
    );
    scene.add(this.sunDisc);
    this.moon = new THREE.Mesh(
      new THREE.SphereGeometry(15, 16, 12),
      new THREE.MeshBasicMaterial({ color: 0xe8ecf6, fog: false })
    );
    scene.add(this.moon);

    // star dome
    const starPos = [];
    for (let i = 0; i < 900; i++) {
      const a = this.rng() * Math.PI * 2, e = Math.asin(this.rng() * 0.98);
      const r = 1500;
      starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r * 0.9 + 40, Math.sin(a) * Math.cos(e) * r);
    }
    this.starMat = new THREE.PointsMaterial({
      color: 0xdfe8ff, size: 2.2, sizeAttenuation: false, transparent: true,
      opacity: 0, depthWrite: false, fog: false,
    });
    this.stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
      this.starMat
    );
    scene.add(this.stars);

    // cloud puffs
    const puffGeo = new THREE.IcosahedronGeometry(1, 1);
    puffGeo.scale(1, 0.35, 1);
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.82 });
    this.clouds = new THREE.InstancedMesh(puffGeo, this.cloudMat, 70);
    this.clouds.castShadow = false;
    this.clouds.frustumCulled = false;
    this.cloudSeeds = [];
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 70; i++) {
      this.cloudSeeds.push({
        x: (this.rng() - 0.5) * 2400, z: (this.rng() - 0.5) * 2400,
        y: 150 + this.rng() * 90, s: 18 + this.rng() * 42, sy: 0.7 + this.rng() * 0.5,
        v: 2.5 + this.rng() * 2,
      });
      dummy.position.set(0, -1000, 0);
      dummy.updateMatrix();
      this.clouds.setMatrixAt(i, dummy.matrix);
    }
    scene.add(this.clouds);
    this._cloudDummy = dummy;

    // rain
    const RAIN_N = 1400;
    this.rainPos = new Float32Array(RAIN_N * 3);
    for (let i = 0; i < RAIN_N; i++) {
      this.rainPos[i * 3] = (this.rng() - 0.5) * 70;
      this.rainPos[i * 3 + 1] = this.rng() * 40;
      this.rainPos[i * 3 + 2] = (this.rng() - 0.5) * 70;
    }
    this.rainGeo = new THREE.BufferGeometry();
    this.rainGeo.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: 0xa8c2d8, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0,
      depthWrite: false,
    });
    this.rain = new THREE.Points(this.rainGeo, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    scene.add(this.rain);

    // weather machine
    this.weather = { state: 'clear', timer: 60 + this.rng() * 120, cloudiness: 0.25, rainLevel: 0, targetClouds: 0.25, targetRain: 0 };
    this.flash = 0;
    this.onThunder = null;
    this.underwater = false;

    this._fogNear = 380; this._fogFar = 1300;
    this.sunElevation = 1;
    this.isNight = false;
  }

  setUnderwater(u) { this.underwater = u; }

  _stepWeather(dt) {
    const w = this.weather;
    w.timer -= dt;
    if (w.timer <= 0) {
      const r = this.rng();
      if (w.state === 'clear') {
        w.state = r < 0.55 ? 'overcast' : 'clear';
        w.timer = 60 + this.rng() * 120;
      } else if (w.state === 'overcast') {
        w.state = r < 0.45 ? 'rain' : (r < 0.6 ? 'storm' : 'clear');
        w.timer = 50 + this.rng() * 90;
      } else { // rain / storm
        w.state = r < 0.7 ? 'overcast' : w.state;
        w.timer = 40 + this.rng() * 80;
      }
      w.targetClouds = { clear: 0.2 + this.rng() * 0.2, overcast: 0.8, rain: 1, storm: 1 }[w.state];
      w.targetRain = { clear: 0, overcast: 0, rain: 0.7, storm: 1 }[w.state];
    }
    w.cloudiness += (w.targetClouds - w.cloudiness) * Math.min(1, dt * 0.12);
    w.rainLevel += (w.targetRain - w.rainLevel) * Math.min(1, dt * 0.25);

    // lightning
    if (w.state === 'storm' && w.rainLevel > 0.5 && this.rng() < dt * 0.14) {
      this.flash = 0.35 + this.rng() * 0.2;
      if (this.onThunder) this.onThunder(0.6 + this.rng() * 2.2);
    }
    this.flash = Math.max(0, this.flash - dt * 1.6);
  }

  update(dt, dayT, px, py, pz) {
    this._stepWeather(dt);
    const w = this.weather;
    const dim = 1 - 0.55 * w.cloudiness * 0.9;

    const sky = keyLerp(dayT, 1).clone();
    const fogC = keyLerp(dayT, 2).clone();
    const sunC = keyLerp(dayT, 3);
    let sunI = keyLerp(dayT, 4) * dim;
    let hemiI = keyLerp(dayT, 5) * (1 - 0.4 * w.cloudiness);

    // overcast grays the sky
    const gray = _a.setHex(0x9aa4ad);
    sky.lerp(gray, w.cloudiness * 0.55 * (hemiI > 0.3 ? 1 : 0.3));
    fogC.lerp(gray, w.cloudiness * 0.4 * (hemiI > 0.3 ? 1 : 0.3));

    // sun / moon orbit
    const ang = (dayT - 0.25) * Math.PI * 2;
    const el = Math.sin(ang);
    this.sunElevation = el;
    this.isNight = el < -0.02;
    const dirX = Math.cos(ang) * 0.55, dirY = el, dirZ = Math.cos(ang) * 0.45 + 0.35;

    if (!this.isNight) {
      this.sun.color.copy(sunC);
      this.sun.intensity = sunI;
      this.sun.position.set(px + dirX * 260, py + Math.max(0.08, dirY) * 260, pz + dirZ * 260);
    } else {
      // the same light serves as the moon
      this.sun.color.setHex(0x93a7d8);
      this.sun.intensity = 0.22 * dim;
      this.sun.position.set(px - dirX * 260, py + Math.max(0.15, -dirY) * 260, pz - dirZ * 260);
    }
    this.sun.target.position.set(px, py, pz);
    this.sun.target.updateMatrixWorld();

    this.hemi.intensity = Math.max(0.14, hemiI);
    this.hemi.color.copy(sky).lerp(_a.setHex(0xffffff), 0.3);

    // celestial bodies drawn far out on the same axis
    this.sunDisc.position.set(px + dirX * 1400, py + dirY * 1400, pz + dirZ * 1400);
    this.sunDisc.lookAt(px, py, pz);
    this.sunDisc.visible = el > -0.08 && w.cloudiness < 0.85;
    this.sunDisc.material.color.copy(sunC);
    this.moon.position.set(px - dirX * 1400, py - dirY * 1400, pz - dirZ * 1400);
    this.moon.visible = el < 0.1;

    // stars
    const night = sstep(0.03, -0.12, el);
    this.starMat.opacity = night * (1 - w.cloudiness * 0.9);
    this.stars.position.set(px, 0, pz);
    this.stars.rotation.y += dt * 0.004;

    // fog + background
    let fogNear = lerp(380, 210, night), fogFar = lerp(1350, 950, night);
    fogNear = lerp(fogNear, 90, w.rainLevel * 0.9 + (w.cloudiness - 0.3) * 0.25);
    fogFar = lerp(fogFar, 480, w.rainLevel * 0.85 + (w.cloudiness - 0.3) * 0.2);
    if (this.underwater) {
      sky.setHex(0x0d3442); fogC.setHex(0x0d3442);
      fogNear = 2; fogFar = 42;
    }
    if (this.flash > 0.05) {
      sky.lerp(_a.setHex(0xffffff), this.flash);
      fogC.lerp(_a.setHex(0xffffff), this.flash);
      this.hemi.intensity += this.flash * 2.2;
    }
    this.scene.fog.near += (fogNear - this.scene.fog.near) * Math.min(1, dt * 2);
    this.scene.fog.far += (fogFar - this.scene.fog.far) * Math.min(1, dt * 2);
    this.scene.fog.color.copy(fogC);
    this.scene.background.copy(sky);

    // clouds drift, wrap around the player
    const cd = this._cloudDummy;
    const vis = 0.35 + w.cloudiness * 0.65;
    this.cloudMat.opacity = 0.55 * vis * (this.isNight ? 0.5 : 1);
    for (let i = 0; i < this.cloudSeeds.length; i++) {
      const c = this.cloudSeeds[i];
      c.x += c.v * dt;
      let rx = c.x - px, rz = c.z - pz;
      rx = ((rx % 2400) + 3600) % 2400 - 1200;
      rz = ((rz % 2400) + 3600) % 2400 - 1200;
      const show = i < 12 + w.cloudiness * 58;
      cd.position.set(px + rx, c.y, pz + rz);
      cd.scale.set(c.s, c.s * 0.32 * c.sy, c.s * 0.8);
      cd.position.y += show ? 0 : -3000;
      cd.updateMatrix();
      this.clouds.setMatrixAt(i, cd.matrix);
    }
    this.clouds.instanceMatrix.needsUpdate = true;

    // rain follows the camera
    this.rain.visible = w.rainLevel > 0.03;
    if (this.rain.visible) {
      this.rainMat.opacity = 0.5 * w.rainLevel;
      const p = this.rainPos;
      for (let i = 0; i < p.length; i += 3) {
        p[i + 1] -= dt * 26;
        if (p[i + 1] < -6) {
          p[i + 1] += 44;
          p[i] = (this.rng() - 0.5) * 70;
          p[i + 2] = (this.rng() - 0.5) * 70;
        }
      }
      this.rain.position.set(px, py, pz);
      this.rainGeo.attributes.position.needsUpdate = true;
    }
  }
}
