// The galaxy: a persistent 3D scene used by the title screen, the hub menu, and free roam.
import * as THREE from '../../vendor/three.module.js';
import { PLANETS, rangeForParts } from '../data/planets.js';
import { planetTexture, ringTexture, radialGlow, ringGlow, starSprite, labelTexture, gradientMap } from './textures.js';
import { makeRng, clamp, damp, lerp, TAU } from '../util.js';

export function buildRocket(scale = 1) {
  const g = new THREE.Group();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 2.6, 24), toon('#f4f4f8'));
  body.rotation.x = Math.PI / 2; g.add(body);
  const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.57, 0.6, 0.5, 24), toon('#ff7a1a')); stripe.rotation.x = Math.PI / 2; stripe.position.z = 0.4; g.add(stripe);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.56, 1.3, 24), toon('#ff7a1a')); nose.rotation.x = Math.PI / 2; nose.position.z = 1.95; g.add(nose);
  const win = new THREE.Mesh(new THREE.SphereGeometry(0.26, 16, 12), toon('#7fd8ff', { emissive: '#1c5b8a' })); win.position.set(0, 0.42, 0.6); g.add(win);
  const winRim = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 24), toon('#1c2b5a')); winRim.position.copy(win.position); winRim.rotation.x = -Math.PI / 2 + 0.55; g.add(winRim);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.9, 1.1), toon('#1c2b5a'));
    const a = i / 3 * TAU + Math.PI / 2; fin.position.set(Math.cos(a) * 0.85, Math.sin(a) * 0.85, -1.0); fin.rotation.z = a - Math.PI / 2; fin.rotation.x = -0.35; g.add(fin);
  }
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.3, 0.5, 20), toon('#3a3f5a')); nozzle.rotation.x = Math.PI / 2; nozzle.position.z = -1.5; g.add(nozzle);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1.6, 16), new THREE.MeshBasicMaterial({ color: '#ffb347', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.rotation.x = -Math.PI / 2; flame.position.z = -2.5; g.add(flame);
  const flame2 = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 12), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame2.rotation.x = -Math.PI / 2; flame2.position.z = -2.3; g.add(flame2);
  const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.36), new THREE.MeshBasicMaterial({ map: labelTexture('GOOBER', '#1c2b5a', null, 512, 128, 'bold 96px "Arial Black", Impact, sans-serif'), transparent: true }));
  decal.position.set(0.52, -0.1, 0.1); decal.rotation.y = Math.PI / 2; decal.rotation.z = Math.PI / 2; g.add(decal);
  const light = new THREE.PointLight('#ff9a3a', 2, 8); light.position.z = -2.4; g.add(light);
  g.userData = { flame, flame2, light };
  g.scale.setScalar(scale);
  return g;
}

export function buildSaucer(radius = 9) {
  const g = new THREE.Group();
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: gradientMap(), ...extra });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.55, radius * 0.35, 48), toon('#6a7a8a')); g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.98, radius * 0.08, 12, 64), toon('#4a5a6a')); rim.rotation.x = Math.PI / 2; rim.position.y = radius * 0.1; g.add(rim);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.45, 32, 16, 0, TAU, 0, Math.PI / 2), toon('#7fffd4', { transparent: true, opacity: 0.55, emissive: '#1a5a4a' })); dome.position.y = radius * 0.17; g.add(dome);
  const under = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.5, radius * 0.25, radius * 0.25, 32), toon('#3a4a5a')); under.position.y = -radius * 0.25; g.add(under);
  const lights = new THREE.Group();
  for (let i = 0; i < 16; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.05, 8, 8), new THREE.MeshBasicMaterial({ color: i % 2 ? '#7fffd4' : '#ff5ce6' })); const a = i / 16 * TAU; l.position.set(Math.cos(a) * radius * 0.92, radius * 0.0, Math.sin(a) * radius * 0.92); lights.add(l); }
  g.add(lights); g.userData.lights = lights;
  return g;
}

export class SpaceScene {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 4000);
    this.planets = []; this.labels = new Map();
    this.ship = { pos: new THREE.Vector3(-14, 3, 22), vel: new THREE.Vector3(), yaw: 2.6, pitch: -0.1, speed: 0 };
    this.cam = { yaw: 2.6, pitch: -0.12, pos: new THREE.Vector3(-22, 8, 34) };
    this.mode = 'menu'; // 'menu' (free camera) | 'rocket' (chase cam) | 'cinematic'
    this.range = rangeForParts(0);
    this.time = 0;
    this.labelRoot = document.getElementById('labels');
    this._build();
  }
  _build() {
    const s = this.scene; const rnd = makeRng(1337);
    s.background = new THREE.Color('#02030a');
    // stars
    const N = 4000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), size = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const r = 1500 + rnd() * 1200, th = rnd() * TAU, ph = Math.acos(rnd() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th); pos[i * 3 + 1] = r * Math.cos(ph); pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const c = new THREE.Color().setHSL(rnd.pick([0.6, 0.62, 0.1, 0.55, 0.0]), rnd.range(0.2, 0.8), rnd.range(0.7, 1));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; size[i] = rnd.range(4, 14);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3)); sg.setAttribute('size', new THREE.BufferAttribute(size, 1));
    const sm = new THREE.ShaderMaterial({
      uniforms: { map: { value: starSprite() }, time: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      vertexShader: `attribute float size; varying vec3 vColor; varying float vTw; uniform float time; void main(){ vColor=color; vec4 mv=modelViewMatrix*vec4(position,1.0); vTw = 0.75+0.25*sin(time*2.0+position.x*0.01+position.y*0.013); gl_PointSize = size * vTw; gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `uniform sampler2D map; varying vec3 vColor; varying float vTw; void main(){ vec4 t=texture2D(map,gl_PointCoord); gl_FragColor=vec4(vColor*t.rgb, t.a*vTw); }`,
    });
    this.stars = new THREE.Points(sg, sm); s.add(this.stars);
    // nebulae
    const nebColors = ['#4a2f9a', '#0f5a7a', '#8a2a5a', '#2a6a4a', '#7a3a1a', '#3a3a9a', '#6a1a6a', '#1a4a8a'];
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow(nebColors[i % nebColors.length], 256, 0, 1), transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false }));
      const r = 900 + rnd() * 600, th = rnd() * TAU, ph = Math.acos(rnd() * 2 - 1) * 0.8 + 0.3;
      sp.position.set(r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)); sp.scale.setScalar(rnd.range(500, 1100)); s.add(sp);
    }
    // sun
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow('#fff2c0', 256, 0.15, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sun.position.set(900, 300, -1200); sun.scale.setScalar(420); s.add(sun);
    const dir = new THREE.DirectionalLight('#fff4e0', 1.3); dir.position.copy(sun.position).normalize().multiplyScalar(100); s.add(dir);
    const fill = new THREE.DirectionalLight('#ffffff', 1.7); fill.position.set(-60, 50, 90); s.add(fill); // keeps the near planets readable from the menu camera
    s.add(new THREE.AmbientLight('#5a6a9a', 1.1));
    s.add(new THREE.HemisphereLight('#8090ff', '#402040', 0.6));
    // planets
    for (const p of PLANETS) {
      const g = new THREE.Group(); g.position.set(...p.pos);
      let body;
      if (p.isFinal) { body = buildSaucer(p.radius); g.add(body); }
      else {
        const mat = new THREE.MeshStandardMaterial({ map: planetTexture(p.look, p.id), roughness: 0.85, metalness: p.look.type === 'metal' || p.look.type === 'ringworld' ? 0.5 : 0.05 });
        if (p.look.glow && ['lava', 'metal', 'disco', 'void', 'crystal'].includes(p.look.type)) { mat.emissive = new THREE.Color(p.look.glow); mat.emissiveIntensity = 0.25; mat.emissiveMap = mat.map; }
        body = new THREE.Mesh(new THREE.SphereGeometry(p.radius, 48, 32), mat); g.add(body);
        // atmosphere glow
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialGlow(p.look.glow || '#ffffff', 128, 0.4, 0.8), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
        glow.scale.setScalar(p.radius * 3.0); g.add(glow);
        if (p.look.clouds) { const cl = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.03, 32, 24), new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, alphaMap: planetTexture({ type: 'gas', colors: ['#000000', '#ffffff', '#000000'] }, p.id + 'c'), roughness: 1 })); g.add(cl); g.userData.clouds = cl; }
        if (['gas', 'crystal', 'swirl', 'ringworld', 'void'].includes(p.look.type) || p.id === 'stratos') {
          const ring = new THREE.Mesh(new THREE.RingGeometry(p.radius * 1.4, p.radius * 2.4, 64), new THREE.MeshBasicMaterial({ map: ringTexture([p.look.colors[1], p.look.colors[2]]), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
          // map the ring texture radially
          const uv = ring.geometry.attributes.uv, ps = ring.geometry.attributes.position; for (let i = 0; i < uv.count; i++) { const x = ps.getX(i), y = ps.getY(i); const rr = Math.hypot(x, y); uv.setXY(i, (rr - p.radius * 1.4) / (p.radius), 0.5); }
          ring.rotation.x = Math.PI / 2 + 0.35; ring.rotation.y = 0.2; g.add(ring);
        }
        if (p.index % 3 === 1 && !p.isHome) {
          const moon = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 0.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#cfcfd8', roughness: 1 }));
          g.add(moon); g.userData.moon = moon; g.userData.moonR = p.radius * 2.2; g.userData.moonSpeed = 0.5 + (p.index % 4) * 0.2;
        }
        if (p.look.type === 'void') { const disk = new THREE.Mesh(new THREE.RingGeometry(p.radius * 2.8, p.radius * 6, 64), new THREE.MeshBasicMaterial({ color: '#c77dff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })); disk.rotation.x = Math.PI / 2 + 0.6; g.add(disk); const hole = new THREE.Mesh(new THREE.SphereGeometry(p.radius * 1.6, 32, 16), new THREE.MeshBasicMaterial({ color: '#000000' })); hole.position.set(p.radius * 6, p.radius * 2, -p.radius * 4); g.add(hole); }
        if (p.look.type === 'ringworld') { const big = new THREE.Mesh(new THREE.TorusGeometry(p.radius * 3.2, p.radius * 0.22, 8, 96), new THREE.MeshStandardMaterial({ color: '#dfe4ee', metalness: 0.6, roughness: 0.3, emissive: '#3ee8ff', emissiveIntensity: 0.15 })); big.rotation.x = Math.PI / 2 - 0.3; g.add(big); }
      }
      g.userData.planet = p; g.userData.body = body;
      s.add(g); this.planets.push(g);
      const lab = document.createElement('div'); lab.className = 'plabel'; lab.innerHTML = `<b>${p.name}</b><span>${p.team.name}</span><em></em>`; this.labelRoot.appendChild(lab); this.labels.set(p.id, lab);
    }
    // rocket
    this.rocket = buildRocket(1); this.rocket.position.copy(this.ship.pos); s.add(this.rocket);
    // range ring (in the plane of the spiral)
    this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(1, 1.01, 128), new THREE.MeshBasicMaterial({ color: '#7fb3ff', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    this.rangeRing.rotation.x = Math.PI / 2; s.add(this.rangeRing); this.setRange(this.range);
    // faint travel path between planets
    const pts = PLANETS.map(p => new THREE.Vector3(...p.pos));
    const curve = new THREE.CatmullRomCurve3(pts); const lg = new THREE.BufferGeometry().setFromPoints(curve.getPoints(400));
    this.path = new THREE.Line(lg, new THREE.LineDashedMaterial({ color: '#4a5a9a', dashSize: 3, gapSize: 5, transparent: true, opacity: 0.3 })); this.path.computeLineDistances(); s.add(this.path);
    // story target marker
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringGlow('#ffd23f'), transparent: true, opacity: 0.9, depthWrite: false })); this.marker.visible = false; s.add(this.marker);
  }
  setRange(r) { this.range = r; this.rangeRing.scale.setScalar(r); }
  aimCam(x, y, z) { const d = new THREE.Vector3(x, y, z).sub(this.cam.pos).normalize(); this.cam.yaw = Math.atan2(d.x, -d.z); this.cam.pitch = Math.asin(clamp(d.y, -1, 1)); }
  syncCamFromCamera() { this.cam.pos.copy(this.camera.position); const d = new THREE.Vector3(); this.camera.getWorldDirection(d); this.cam.yaw = Math.atan2(d.x, -d.z); this.cam.pitch = Math.asin(clamp(d.y, -1, 1)); }
  setTarget(planet) { if (!planet) { this.marker.visible = false; this.target = null; return; } this.target = planet; this.marker.visible = true; this.marker.position.set(...planet.pos); this.marker.scale.setScalar(planet.radius * 3.2); }
  resize(w, h) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  planetAt(pos, extra = 6) { let best = null, bd = 1e9; for (const g of this.planets) { const p = g.userData.planet; const d = g.position.distanceTo(pos) - p.radius; if (d < bd) { bd = d; best = p; } } return bd < extra ? best : null; }
  nearest(pos) { let best = null, bd = 1e9; for (const g of this.planets) { const d = g.position.distanceTo(pos) - g.userData.planet.radius; if (d < bd) { bd = d; best = g.userData.planet; } } return { planet: best, dist: bd }; }
  inRange(planet) { return Math.hypot(...planet.pos) <= this.range + 0.01; }

  // ---- per-frame ----
  update(dt, input, opts = {}) {
    this.time += dt; this.stars.material.uniforms.time.value = this.time;
    for (const g of this.planets) {
      const p = g.userData.planet; if (g.userData.body && !p.isFinal) g.userData.body.rotation.y += dt * 0.05 * (1 + (p.index % 3) * 0.3);
      if (g.userData.clouds) g.userData.clouds.rotation.y += dt * 0.08;
      if (g.userData.moon) { const a = this.time * g.userData.moonSpeed; g.userData.moon.position.set(Math.cos(a) * g.userData.moonR, Math.sin(a * 0.7) * g.userData.moonR * 0.2, Math.sin(a) * g.userData.moonR); }
      if (p.isFinal) { g.rotation.y += dt * 0.2; g.userData.body.userData.lights.children.forEach((l, i) => { l.material.color.set((Math.floor(this.time * 4) + i) % 2 ? '#7fffd4' : '#ff5ce6'); }); }
    }
    if (this.target) this.marker.material.opacity = 0.5 + 0.4 * Math.sin(this.time * 4);
    const ud = this.rocket.userData; const flick = 0.85 + 0.3 * Math.sin(this.time * 37) + 0.15 * Math.sin(this.time * 61);
    const thrust = clamp(this.ship.speed / 30, 0.25, 1.6);
    ud.flame.scale.set(1, thrust * flick, 1); ud.flame2.scale.set(1, thrust * flick * 0.9, 1); ud.light.intensity = 1.5 * thrust * flick;
    if (this.mode === 'menu') this._updateFreeCam(dt, input, opts);
    else if (this.mode === 'rocket') this._updateRocket(dt, input, opts);
    this._updateLabels(opts);
  }
  _look(dt, input, sens = 1.6, arrowLook = false) {
    const look = input ? input.lookVec() : { x: 0, y: 0 };
    const inv = this.app && this.app.save.settings.invertY ? -1 : 1;
    let dy = look.x * sens * dt, dp = -look.y * sens * dt * inv;
    if (input && input.mouse.down && !input.usingPad()) { dy += input.mouse.dx * 0.003; dp -= input.mouse.dy * 0.003 * inv; }
    if (arrowLook && input && !input.usingPad()) { if (input.keys.has('ArrowLeft')) dy -= 1.5 * dt; if (input.keys.has('ArrowRight')) dy += 1.5 * dt; if (input.keys.has('ArrowUp')) dp += 1.2 * dt; if (input.keys.has('ArrowDown')) dp -= 1.2 * dt; }
    return { dy, dp };
  }
  _updateFreeCam(dt, input, opts) {
    const c = this.cam;
    if (input && !opts.lockInput) {
      const { dy, dp } = this._look(dt, input, 1.4);
      c.yaw += dy; c.pitch = clamp(c.pitch + dp, -1.2, 1.2);
      const mv = input.moveVec(); const sp = (input.down('r2') ? 60 : 24) * dt;
      const fwd = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
      const right = new THREE.Vector3(Math.cos(c.yaw), 0, Math.sin(c.yaw));
      // in menu mode the stick moves only when the menu isn't using it (opts.freeMove)
      if (opts.freeMove) { c.pos.addScaledVector(fwd, mv.y * sp); c.pos.addScaledVector(right, mv.x * sp); }
      if (input.down('l2') || input.keys.has('KeyQ')) c.pos.y -= sp * 0.6; if (input.down('r1') || input.keys.has('KeyE')) c.pos.y += sp * 0.6;
    }
    // gentle idle drift
    const drift = opts.drift === undefined ? 1 : opts.drift;
    const fwd = new THREE.Vector3(Math.sin(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.cos(c.yaw) * Math.cos(c.pitch));
    this.camera.position.copy(c.pos); this.camera.position.y += Math.sin(this.time * 0.4) * 0.6 * drift;
    this.camera.lookAt(this.camera.position.clone().add(fwd));
    // idle rocket cruising near Earth in menu mode
    const rp = this.rocket.position; const orbit = 12; const a = this.time * 0.25;
    const tgt = new THREE.Vector3(Math.cos(a) * orbit, 2 + Math.sin(a * 2) * 1.2, Math.sin(a) * orbit);
    rp.lerp(tgt, 1 - Math.exp(-2 * dt));
    const ahead = new THREE.Vector3(Math.cos(a + 0.1) * orbit, 2 + Math.sin((a + 0.1) * 2) * 1.2, Math.sin(a + 0.1) * orbit);
    this.rocket.lookAt(ahead); this.rocket.rotateZ(Math.sin(this.time * 0.7) * 0.2); this.ship.speed = 8;
  }
  _updateRocket(dt, input, opts) {
    const sh = this.ship;
    if (input && !opts.lockInput) {
      const { dy, dp } = this._look(dt, input, 2.0, true);
      sh.yaw += dy; sh.pitch = clamp(sh.pitch + dp, -1.3, 1.3);
      const mv = input.moveVec();
      const boost = input.down('r2'); const brake = input.down('l2');
      const maxSp = boost ? 95 : 42;
      const fwd = new THREE.Vector3(Math.sin(sh.yaw) * Math.cos(sh.pitch), Math.sin(sh.pitch), -Math.cos(sh.yaw) * Math.cos(sh.pitch));
      const right = new THREE.Vector3(Math.cos(sh.yaw), 0, Math.sin(sh.yaw));
      const want = new THREE.Vector3().addScaledVector(fwd, mv.y).addScaledVector(right, mv.x * 0.8);
      if (input.down('r1')) want.y += 0.7; if (input.down('l1')) want.y -= 0.7;
      const accel = 60;
      if (want.lengthSq() > 0.001) sh.vel.addScaledVector(want.normalize(), accel * dt);
      sh.vel.multiplyScalar(brake ? Math.exp(-4 * dt) : Math.exp(-0.9 * dt));
      if (sh.vel.length() > maxSp) sh.vel.setLength(maxSp);
    }
    sh.pos.addScaledVector(sh.vel, dt);
    // stay inside rocket range (soft wall)
    const d = sh.pos.length();
    if (d > this.range) { const n = sh.pos.clone().normalize(); sh.pos.copy(n.multiplyScalar(this.range)); const vn = sh.vel.dot(n); if (vn > 0) sh.vel.addScaledVector(n, -vn * 1.5); this.hitWall = 0.6; }
    if (this.hitWall > 0) this.hitWall -= dt;
    // bump off planets
    for (const g of this.planets) { const r = g.userData.planet.radius + 3; const dd = sh.pos.distanceTo(g.position); if (dd < r) { const n = sh.pos.clone().sub(g.position).normalize(); sh.pos.copy(g.position).addScaledVector(n, r); const vn = sh.vel.dot(n); if (vn < 0) sh.vel.addScaledVector(n, -vn * 1.4); } }
    sh.speed = sh.vel.length();
    this.rocket.position.copy(sh.pos);
    const fwd = new THREE.Vector3(Math.sin(sh.yaw) * Math.cos(sh.pitch), Math.sin(sh.pitch), -Math.cos(sh.yaw) * Math.cos(sh.pitch));
    const faceDir = sh.speed > 4 ? sh.vel.clone().normalize().lerp(fwd, 0.5).normalize() : fwd;
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), faceDir);
    this.rocket.quaternion.slerp(q, 1 - Math.exp(-6 * dt));
    // chase cam
    const camTgt = sh.pos.clone().addScaledVector(fwd, -11).add(new THREE.Vector3(0, 3.5, 0));
    this.camera.position.lerp(camTgt, 1 - Math.exp(-5 * dt));
    const look = sh.pos.clone().addScaledVector(fwd, 12);
    const m = new THREE.Matrix4().lookAt(this.camera.position, look, new THREE.Vector3(0, 1, 0));
    const cq = new THREE.Quaternion().setFromRotationMatrix(m); this.camera.quaternion.slerp(cq, 1 - Math.exp(-8 * dt));
  }
  _updateLabels(opts) {
    const w = window.innerWidth, h = window.innerHeight; const v = new THREE.Vector3();
    const show = opts.labels !== false;
    for (const g of this.planets) {
      const p = g.userData.planet; const lab = this.labels.get(p.id);
      if (!show) { lab.style.display = 'none'; continue; }
      v.copy(g.position); v.y += p.radius * 1.15; v.project(this.camera);
      const dist = g.position.distanceTo(this.camera.position);
      const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 && dist < 260;
      lab.style.display = visible ? 'block' : 'none';
      if (!visible) continue;
      lab.style.left = `${(v.x * 0.5 + 0.5) * w}px`; lab.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
      const locked = !this.inRange(p);
      lab.classList.toggle('locked', locked); lab.classList.toggle('near', opts.nearId === p.id); lab.classList.toggle('target', this.target && this.target.id === p.id);
      lab.style.opacity = clamp(1.3 - dist / 260, 0.25, 1);
      lab.querySelector('em').textContent = locked ? 'OUT OF RANGE' : (opts.nearId === p.id ? (opts.landHint || 'LAND') : (opts.beaten && opts.beaten.includes(p.id) ? 'DEFEATED' : ''));
    }
  }
  hideLabels() { for (const l of this.labels.values()) l.style.display = 'none'; }
  render(renderer) { renderer.render(this.scene, this.camera); }
  // place the rocket at a planet (after take-off) and aim at the next one
  placeAt(planet, facing) {
    const p = new THREE.Vector3(...planet.pos); const dirTo = facing ? new THREE.Vector3(...facing.pos).sub(p).normalize() : new THREE.Vector3(0, 0, -1);
    this.ship.pos.copy(p).addScaledVector(dirTo, planet.radius + 8); this.ship.vel.set(0, 0, 0);
    this.ship.yaw = Math.atan2(dirTo.x, -dirTo.z); this.ship.pitch = Math.asin(clamp(dirTo.y, -1, 1));
    this.rocket.position.copy(this.ship.pos);
    const fwd = dirTo; this.camera.position.copy(this.ship.pos).addScaledVector(fwd, -11).add(new THREE.Vector3(0, 3.5, 0)); this.camera.lookAt(this.ship.pos.clone().addScaledVector(fwd, 12));
  }
}
