// Race visual effects:
//   • billboard particle systems (instanced): tire smoke, dust, sparks,
//     nitrous + backfire flames
//   • skidmarks: a ring buffer of road-hugging quads that fade with age
//   • rain: GPU-animated streaks around the camera
import * as THREE from 'three';

function smokeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  // lumpy puff
  for (let i = 0; i < 18; i++) {
    const a = Math.random() * Math.PI * 2, r = 6 + Math.random() * 14;
    const px = 32 + Math.cos(a) * r, py = 32 + Math.sin(a) * r, pr = 6 + Math.random() * 10;
    const gg = x.createRadialGradient(px, py, 0, px, py, pr);
    gg.addColorStop(0, 'rgba(255,255,255,0.25)');
    gg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gg;
    x.fillRect(px - pr, py - pr, pr * 2, pr * 2);
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function flameTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.8)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Instanced camera-facing particles simulated on the CPU. */
class ParticleSystem {
  constructor(max, texture, additive) {
    this.max = max;
    this.n = 0;
    this.p = new Float32Array(max * 3);
    this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size0 = new Float32Array(max);
    this.size1 = new Float32Array(max);
    this.col = new Float32Array(max * 3);
    this.a0 = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.rot = new Float32Array(max);
    const quad = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = quad.index;
    g.attributes.position = quad.attributes.position;
    g.attributes.uv = quad.attributes.uv;
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aSize = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
    this.aRot = new THREE.InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.aPos, this.aSize, this.aCol, this.aRot]) a.setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('ipos', this.aPos);
    g.setAttribute('isize', this.aSize);
    g.setAttribute('icol', this.aCol);
    g.setAttribute('irot', this.aRot);
    g.instanceCount = 0;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { map: { value: texture }, nearFade: { value: additive ? 0 : 1 } },
      vertexShader: `
        attribute vec3 ipos; attribute float isize; attribute vec4 icol; attribute float irot;
        uniform float nearFade;
        varying vec2 vUv; varying vec4 vCol;
        void main(){
          vUv = uv; vCol = icol;
          vec4 mv = modelViewMatrix * vec4(ipos, 1.0);
          // smoke thins out right in front of the lens: driving through a
          // cloud shouldn't white out the screen (sparks and flames don't)
          vCol.a *= mix(1.0, smoothstep(2.0, 9.0, -mv.z), nearFade);
          float c = cos(irot), s = sin(irot);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * isize;
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main(){ vec4 t = texture2D(map, vUv); gl_FragColor = vec4(vCol.rgb, vCol.a * t.a); if (gl_FragColor.a < 0.003) discard; }`,
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 6 : 5;
    this.geo = g;
  }

  emit(x, y, z, vx, vy, vz, life, s0, s1, r, gc, b, alpha, drag = 1, grav = 0) {
    let i;
    if (this.n < this.max) i = this.n++;
    else {
      // recycle the oldest-looking particle
      i = Math.floor(Math.random() * this.max);
    }
    this.p[i * 3] = x; this.p[i * 3 + 1] = y; this.p[i * 3 + 2] = z;
    this.v[i * 3] = vx; this.v[i * 3 + 1] = vy; this.v[i * 3 + 2] = vz;
    this.life[i] = 0; this.maxLife[i] = life;
    this.size0[i] = s0; this.size1[i] = s1;
    this.col[i * 3] = r; this.col[i * 3 + 1] = gc; this.col[i * 3 + 2] = b;
    this.a0[i] = alpha; this.drag[i] = drag; this.grav[i] = grav;
    this.rot[i] = Math.random() * Math.PI * 2;
  }

  update(dt) {
    let w = 0;
    for (let i = 0; i < this.n; i++) {
      this.life[i] += dt;
      if (this.life[i] >= this.maxLife[i]) continue;
      // compact live particles to the front
      if (w !== i) {
        for (let k = 0; k < 3; k++) { this.p[w * 3 + k] = this.p[i * 3 + k]; this.v[w * 3 + k] = this.v[i * 3 + k]; this.col[w * 3 + k] = this.col[i * 3 + k]; }
        this.life[w] = this.life[i]; this.maxLife[w] = this.maxLife[i]; this.size0[w] = this.size0[i]; this.size1[w] = this.size1[i];
        this.a0[w] = this.a0[i]; this.drag[w] = this.drag[i]; this.grav[w] = this.grav[i]; this.rot[w] = this.rot[i];
      }
      const d = Math.exp(-this.drag[w] * dt);
      this.v[w * 3] *= d; this.v[w * 3 + 1] = this.v[w * 3 + 1] * d - this.grav[w] * dt; this.v[w * 3 + 2] *= d;
      this.p[w * 3] += this.v[w * 3] * dt; this.p[w * 3 + 1] += this.v[w * 3 + 1] * dt; this.p[w * 3 + 2] += this.v[w * 3 + 2] * dt;
      this.rot[w] += dt * 0.6;
      const t = this.life[w] / this.maxLife[w];
      this.aPos.array[w * 3] = this.p[w * 3]; this.aPos.array[w * 3 + 1] = this.p[w * 3 + 1]; this.aPos.array[w * 3 + 2] = this.p[w * 3 + 2];
      this.aSize.array[w] = this.size0[w] + (this.size1[w] - this.size0[w]) * Math.sqrt(t);
      const fade = t < 0.1 ? t / 0.1 : 1 - (t - 0.1) / 0.9;
      this.aCol.array[w * 4] = this.col[w * 3]; this.aCol.array[w * 4 + 1] = this.col[w * 3 + 1]; this.aCol.array[w * 4 + 2] = this.col[w * 3 + 2];
      this.aCol.array[w * 4 + 3] = this.a0[w] * fade;
      this.aRot.array[w] = this.rot[w];
      w++;
    }
    this.n = w;
    this.geo.instanceCount = w;
    this.aPos.needsUpdate = this.aSize.needsUpdate = this.aCol.needsUpdate = this.aRot.needsUpdate = true;
  }
}

/** Road-hugging skidmark strips (ring buffer of quads). */
class Skidmarks {
  constructor(max = 1800) {
    this.max = max;
    this.next = 0;
    this.pos = new Float32Array(max * 4 * 3);
    this.alpha = new Float32Array(max * 4);
    this.birth = new Float32Array(max).fill(-1e9);
    const idx = new Uint32Array(max * 6);
    for (let q = 0; q < max; q++) {
      idx.set([q * 4, q * 4 + 1, q * 4 + 2, q * 4, q * 4 + 2, q * 4 + 3], q * 6);
    }
    const g = new THREE.BufferGeometry();
    this.aP = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aA = new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aP);
    g.setAttribute('alpha', this.aA);
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA = alpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying float vA; void main(){ gl_FragColor = vec4(0.02, 0.02, 0.02, vA); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.geo = g;
    this.last = new Map(); // key → {x,y,z}
    this.time = 0;
    this.dirtyFrom = 0;
  }

  /** Add a segment for wheel `key` at world point (x,y,z), side vector (sx,sz), intensity 0..1. */
  add(key, x, y, z, sx, sz, intensity, width = 0.22) {
    const L = this.last.get(key);
    this.last.set(key, { x, y, z, t: this.time });
    if (!L || this.time - L.t > 0.12) return;
    const d2 = (x - L.x) ** 2 + (z - L.z) ** 2;
    if (d2 < 0.04 || d2 > 9) { if (d2 > 9) this.last.set(key, { x, y, z, t: this.time }); return; }
    const q = this.next;
    this.next = (this.next + 1) % this.max;
    const hw = width / 2;
    const P = this.pos;
    const o = q * 12;
    P[o] = L.x + sx * hw; P[o + 1] = L.y + 0.03; P[o + 2] = L.z + sz * hw;
    P[o + 3] = L.x - sx * hw; P[o + 4] = L.y + 0.03; P[o + 5] = L.z - sz * hw;
    P[o + 6] = x - sx * hw; P[o + 7] = y + 0.03; P[o + 8] = z - sz * hw;
    P[o + 9] = x + sx * hw; P[o + 10] = y + 0.03; P[o + 11] = z + sz * hw;
    const a = Math.min(0.75, 0.25 + intensity * 0.55);
    this.alpha.fill(a, q * 4, q * 4 + 4);
    this.birth[q] = this.time;
    this.aP.needsUpdate = true;
    this.aA.needsUpdate = true;
  }

  break(key) { this.last.delete(key); }

  update(dt) { this.time += dt; }
}

/** Rain streaks that live in a box around the camera (GPU animated). */
class Rain {
  constructor(count = 2400) {
    const pos = new Float32Array(count * 2 * 3);
    const seed = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 60, y = Math.random() * 30, z = (Math.random() - 0.5) * 60;
      pos.set([x, y, z, x, y, z], i * 6);
      seed[i * 2] = 0; seed[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('tip', new THREE.BufferAttribute(seed, 1));
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, cam: { value: new THREE.Vector3() }, wind: { value: new THREE.Vector3() }, strength: { value: 0.35 } },
      vertexShader: `
        attribute float tip; uniform float time; uniform vec3 cam; uniform vec3 wind; varying float vT;
        void main(){
          vec3 p = position;
          float fall = 22.0;
          p.y = mod(p.y - time * fall, 30.0) - 8.0;
          p.xz = mod(p.xz - cam.xz + 30.0, 60.0) - 30.0;
          p += cam * vec3(1.0, 0.0, 1.0);
          p.y += cam.y;
          vec3 streak = vec3(0.0, 0.9, 0.0) + wind * 0.05;
          p += streak * tip;
          vT = tip;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }`,
      fragmentShader: 'uniform float strength; varying float vT; void main(){ gl_FragColor = vec4(vec3(0.55,0.62,0.75) * strength * (0.35 + vT * 0.65), 1.0); }',
    });
    this.mesh = new THREE.LineSegments(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 7;
  }
  update(dt, camera, carVel) {
    this.mat.uniforms.time.value += dt;
    this.mat.uniforms.cam.value.copy(camera.position);
    this.mat.uniforms.wind.value.set(-(carVel?.x || 0), 0, -(carVel?.z || 0));
  }
}

export class Effects {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.smoke = new ParticleSystem(700, smokeTexture(), false);
    this.glow = new ParticleSystem(500, flameTexture(), true);
    this.skids = new Skidmarks(2200);
    scene.add(this.smoke.mesh, this.glow.mesh, this.skids.mesh);
    if (opts.rain) {
      this.rain = new Rain();
      scene.add(this.rain.mesh);
    }
    this.night = !!opts.night;
    this.smokeColor = opts.smokeColor || [0.82, 0.82, 0.85];
  }

  tireSmoke(x, y, z, vx, vz, amount, surface) {
    const dusty = surface === 'dirt' || surface === 'sand' || surface === 'gravel' || surface === 'grass';
    const c = dusty ? (surface === 'sand' ? [0.78, 0.66, 0.48] : surface === 'grass' ? [0.42, 0.38, 0.28] : [0.55, 0.47, 0.37]) : this.smokeColor;
    const k = this.night && !dusty ? 0.55 : 1;
    // light, low and quick to clear: you see the slide, and still see the road
    this.smoke.emit(x + (Math.random() - 0.5) * 0.3, y + 0.2, z + (Math.random() - 0.5) * 0.3,
      vx * 0.3 + (Math.random() - 0.5) * 1.2, 0.3 + Math.random() * 0.7, vz * 0.3 + (Math.random() - 0.5) * 1.2,
      0.8 + Math.random() * 0.6 + amount * 0.4, 0.6, 2.0 + amount * 1.6, c[0] * k, c[1] * k, c[2] * k, Math.min(0.3, 0.1 + amount * 0.2), 1.8, -0.15);
  }

  sparks(x, y, z, nx, nz, count = 6, speed = 8) {
    for (let i = 0; i < count; i++) {
      const sp = speed * (0.4 + Math.random());
      this.glow.emit(x, y + 0.3, z,
        nx * sp * 0.5 + (Math.random() - 0.5) * sp, 1 + Math.random() * 3, nz * sp * 0.5 + (Math.random() - 0.5) * sp,
        0.25 + Math.random() * 0.35, 0.12, 0.05, 2.6, 1.5, 0.5, 1, 0.6, 9.8);
    }
  }

  flame(x, y, z, vx, vy, vz, nitro) {
    if (nitro) {
      this.glow.emit(x, y, z, vx, vy, vz, 0.1 + Math.random() * 0.06, 0.32, 0.12, 0.45, 0.65, 2.4, 0.9, 2);
      this.glow.emit(x, y, z, vx * 1.2, vy, vz * 1.2, 0.06, 0.18, 0.08, 1.6, 1.8, 2.6, 1, 2);
    } else {
      this.glow.emit(x, y, z, vx, vy + 0.5, vz, 0.12 + Math.random() * 0.08, 0.35, 0.15, 3.0, 1.2, 0.3, 1, 2);
    }
  }

  update(dt, camera, carVel) {
    this.smoke.update(dt);
    this.glow.update(dt);
    this.skids.update(dt);
    if (this.rain) this.rain.update(dt, camera, carVel);
  }
}
