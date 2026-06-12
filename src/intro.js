// The opening cinematic: America from above, gold lights where the football
// towns are, three schools at dusk, then a packed stadium and the logo.
// Skippable with any key / click / ✕.
import * as THREE from 'three';
import { buildSchool } from './school.js';
import { makeKit, buildPlayer } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { buildStadium } from './stadium.js';
import { mkCanvas, tex } from './textures.js';
import { sfx } from './audio.js';

// ---------------------------------------------------------------- the logo
export function varsityLogoCanvas(w = 1200, h = 460) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.textAlign = 'center';
  // "27" massive behind
  ctx.save();
  ctx.translate(w * 0.74, h * 0.56);
  ctx.rotate(-0.04);
  ctx.font = `900 ${h * 0.92}px Impact, 'Arial Black', sans-serif`;
  const grad27 = ctx.createLinearGradient(0, -h * 0.45, 0, h * 0.45);
  grad27.addColorStop(0, '#ffe9a0');
  grad27.addColorStop(0.48, '#f2b705');
  grad27.addColorStop(0.52, '#a87c00');
  grad27.addColorStop(1, '#ffd75e');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0a1024';
  ctx.lineWidth = h * 0.06;
  ctx.strokeText('27', 0, h * 0.3);
  ctx.fillStyle = grad27;
  ctx.fillText('27', 0, h * 0.3);
  ctx.restore();
  // VARSITY chrome wordmark
  ctx.save();
  ctx.translate(w * 0.42, h * 0.52);
  ctx.transform(1, 0, -0.13, 1, 0, 0); // italic shear
  ctx.font = `900 ${h * 0.46}px Impact, 'Arial Black', sans-serif`;
  const chrome = ctx.createLinearGradient(0, -h * 0.25, 0, h * 0.18);
  chrome.addColorStop(0, '#f8fbff');
  chrome.addColorStop(0.44, '#c7d2e2');
  chrome.addColorStop(0.5, '#5a6a86');
  chrome.addColorStop(0.56, '#e8eef8');
  chrome.addColorStop(1, '#8fa0ba');
  ctx.strokeStyle = '#0a1024';
  ctx.lineWidth = h * 0.05;
  ctx.lineJoin = 'round';
  ctx.strokeText('VARSITY', 0, 0);
  ctx.fillStyle = chrome;
  ctx.fillText('VARSITY', 0, 0);
  ctx.restore();
  // subtitle bar
  ctx.fillStyle = '#f2b705';
  ctx.fillRect(w * 0.13, h * 0.62, w * 0.56, h * 0.012);
  ctx.font = `700 ${h * 0.085}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillStyle = '#dfe6f2';
  ctx.textAlign = 'left';
  ctx.fillText('H I G H   S C H O O L   F O O T B A L L', w * 0.135, h * 0.74);
  return cv;
}

// ---------------------------------------------------------------- USA mesh
function usaShape() {
  // stylized continental silhouette (x east, y south in shape space)
  const pts = [
    [2, 8], [10, 4], [28, 2], [42, 4], [49, 8], [54, 6], [58, 9], [62, 6],
    [68, 3], [70, 7], [66, 12], [64, 16], [62, 20], [63, 24], [60, 28],
    [58, 32], [60, 38], [64, 46], [58, 42], [50, 36], [44, 38], [38, 36],
    [34, 44], [28, 38], [26, 30], [18, 32], [10, 28], [8, 30], [4, 22], [1, 14],
  ];
  const s = new THREE.Shape();
  s.moveTo(pts[0][0], -pts[0][1]);
  for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], -pts[i][1]);
  s.closePath();
  return s;
}

export class Intro {
  constructor(container, onDone) {
    this.container = container;
    this.onDone = onDone;
    this.done = false;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(44, container.clientWidth / container.clientHeight, 0.1, 2000);
    this.t = 0;
    this.section = -1;
    this.clock = new THREE.Clock();
    this.caption = document.getElementById('intro-caption');
    this.flash = document.getElementById('intro-flash');
    this.logoEl = document.getElementById('intro-logo');
    this.music = sfx.introScore();
    this._skip = (e) => { e.preventDefault?.(); this.finish(); };
    window.addEventListener('keydown', this._skip);
    container.addEventListener('pointerdown', this._skip);
    this._padPoll = setInterval(() => {
      try {
        for (const g of navigator.getGamepads?.() || []) {
          if (g?.buttons?.some((b) => b.pressed)) { this.finish(); break; }
        }
      } catch { /* fine */ }
    }, 120);
    this.buildMap();
    this.loop();
  }

  setCaption(kicker, line) {
    if (!this.caption) return;
    this.caption.innerHTML = kicker ? `<div class="ic-kick">${kicker}</div><div class="ic-line">${line || ''}</div>` : '';
    this.caption.classList.toggle('show', !!kicker);
  }

  flashCut() {
    if (!this.flash) return;
    this.flash.classList.remove('go');
    void this.flash.offsetWidth;
    this.flash.classList.add('go');
  }

  // ------------------------------------------------ section builders
  freshScene(bg = '#04060f') {
    if (this.scene) {
      this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    }
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(bg);
    return this.scene;
  }

  buildMap() {
    const s = this.freshScene('#03040c');
    s.fog = null;
    const geo = new THREE.ExtrudeGeometry(usaShape(), { depth: 1.6, bevelEnabled: true, bevelSize: 0.4, bevelThickness: 0.4, bevelSegments: 2 });
    geo.rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: '#0e1c3a', shininess: 30, specular: '#223a66' }));
    land.position.set(-35, 0, 22);
    s.add(land);
    // town lights
    const dotG = new THREE.SphereGeometry(0.28, 6, 5);
    const dim = new THREE.MeshBasicMaterial({ color: '#9fb4d8' });
    this.goldDots = [];
    for (let i = 0; i < 120; i++) {
      const x = 4 + Math.random() * 62, z = 5 + Math.random() * 36;
      // crude inside test: skip far corners
      if ((x < 10 && z > 26) || (x > 58 && z > 34 && x < 62)) continue;
      const m = new THREE.Mesh(dotG, dim);
      m.position.set(x - 35, 2.2, z - 22);
      s.add(m);
    }
    const goldMat = new THREE.MeshBasicMaterial({ color: '#ffd75e' });
    for (const [x, z] of [[30, 36], [14, 12], [48, 14], [40, 30], [60, 18], [26, 22]]) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), goldMat);
      m.position.set(x - 35, 2.4, z - 22);
      s.add(m);
      const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.5, 9, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffd75e', transparent: true, opacity: 0.22, depthWrite: false })
      );
      beam.position.set(x - 35, 6.5, z - 22);
      s.add(beam);
      this.goldDots.push(m);
    }
    s.add(new THREE.HemisphereLight('#36507e', '#05070f', 1.1));
    const moon = new THREE.DirectionalLight('#aac2ff', 1.4);
    moon.position.set(-30, 60, -20);
    s.add(moon);
    // star field
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 700;
      starPos[i * 3 + 1] = 60 + Math.random() * 240;
      starPos[i * 3 + 2] = (Math.random() - 0.5) * 700;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    s.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#cfd9ee', size: 0.7, sizeAttenuation: false })));
    this.section = 0;
  }

  buildSchools() {
    const s = this.freshScene('#1a2745');
    s.fog = new THREE.Fog('#1a2745', 60, 220);
    s.add(new THREE.HemisphereLight('#92a8d8', '#2a3220', 1.05));
    const sun = new THREE.DirectionalLight('#ffd9a8', 2.2);
    sun.position.set(40, 30, 30);
    sun.castShadow = true;
    s.add(sun);
    const presets = [
      { name: 'Permian Flats', mascot: 'Rams', colors: { primary: '#5e1f2e', secondary: '#9aa0a6' }, building: { style: 'brick', floors: 1, length: 3, wingL: true, wingR: true, gym: true, cupola: false, brick: '#b06a3c', buses: true } },
      { name: 'Saint Bosco', mascot: 'Spartans', colors: { primary: '#1d4d2b', secondary: '#d9b310' }, building: { style: 'classic', floors: 3, length: 2, wingL: true, wingR: false, gym: false, cupola: true, brick: '#8a8078', buses: false } },
      { name: 'Eastlake', mascot: 'Chargers', colors: { primary: '#1f4fd8', secondary: '#c7ccd4' }, building: { style: 'modern', floors: 2, length: 2, wingL: false, wingR: true, gym: true, cupola: false, brick: '#9fb3c8', buses: true } },
    ];
    this.vignettes = [];
    presets.forEach((school, i) => {
      const g = buildSchool(school, { signLine2: 'FRIDAY 7PM' });
      g.position.set(i * 320, 0, 0);
      s.add(g);
      const lawn = new THREE.Mesh(new THREE.CircleGeometry(120, 24), new THREE.MeshPhongMaterial({ color: '#2a4a26' }));
      lawn.rotation.x = -Math.PI / 2;
      lawn.position.set(i * 320, -0.12, 0);
      s.add(lawn);
      this.vignettes.push({
        cx: i * 320,
        kicker: ['WEST TEXAS', 'THE MIDWEST', 'THE COAST'][i],
        line: `${school.name.toUpperCase()} HIGH — HOME OF THE ${school.mascot.toUpperCase()}`,
      });
    });
    this.section = 1;
  }

  buildHeroes() {
    const s = this.freshScene('#05070f');
    s.fog = new THREE.Fog('#05070f', 6, 30);
    s.add(new THREE.HemisphereLight('#3a4a78', '#0a0c08', 0.55));
    const key = new THREE.DirectionalLight('#ffe8c4', 2.6);
    key.position.set(4, 7, 5);
    key.castShadow = true;
    s.add(key);
    const rim = new THREE.DirectionalLight('#6a8aff', 3.2);
    rim.position.set(-6, 4, -7);
    s.add(rim);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 24), new THREE.MeshPhongMaterial({ color: '#15240f' }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    s.add(ground);
    const kit = makeKit({
      jersey: '#14306e', pants: '#f2f1ec', helmet: '#14306e', sleeve: '#f2b705',
      numberFill: '#f4f4f2', numberStroke: '#f2b705', pantsStripe: '#14306e',
      helmetStripe: '#f2b705', facemask: '#2d2f33', socks: '#14306e', style: 'classic',
    }, null);
    const CLIPS = makeClips();
    this.heroAnims = [];
    const place = (build, num, clip, x, z, face, rate = 1) => {
      const rig = buildPlayer(kit, { num, build, skin: ['#8d5a3b', '#c68863', '#5d3a26'][num % 3], look: { eyeBlack: true } });
      rig.group.position.set(x, 0, z);
      rig.group.rotation.y = face;
      s.add(rig.group);
      const a = new Animator(rig, CLIPS);
      a.play(clip, { fade: 0 });
      a.rate = rate;
      this.heroAnims.push({ a, clip });
    };
    // three hero vignettes spaced apart: lineman, QB, sprinter at camera
    place('huge', 72, 'stance3', 0, 0, 0.35, 0.7);
    place('avg', 7, 'throwHold', 60, 0, -0.25, 0.65);
    place('slim', 23, 'sprint', 120, 0, 0.05, 1);
    this.section = 2;
  }

  buildFinale() {
    const s = this.freshScene('#0a0f22');
    const school = {
      name: 'Westfield', mascot: 'Falcons',
      colors: { primary: '#14306e', secondary: '#f2b705' },
      building: { style: 'brick', floors: 2, length: 2, wingL: true, wingR: false, gym: true, cupola: true, brick: '#9a4a32', buses: true },
    };
    const logo = mkCanvas(64, 64); // tiny blank; midfield logo not the star here
    this.stadiumRef = buildStadium(s, school, { name: 'Visitors', colors: { primary: '#8f1d2c', secondary: '#f4f4f2' } }, logo, {});
    this.section = 3;
  }

  // ------------------------------------------------ timeline
  loop() {
    if (this.done) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.t += dt;
    const t = this.t;
    const cam = this.camera;

    if (t < 4.6) {
      // start tight on one burning gold light, rip upward to reveal them all
      const k = Math.min(1, t / 4.6);
      const e = k * k * (3 - 2 * k);
      const r = 7 + e * 120;
      const ang = 0.2 + e * 0.85;
      cam.position.set(-5 + Math.sin(ang) * r * 0.5, 3 + e * 105, 14 + Math.cos(ang) * r * 0.45);
      cam.lookAt(-5, 1.5, 14);
      if (t < 0.2) this.setCaption('EVERY FALL', 'SIX THOUSAND TOWNS TURN ON THE LIGHTS');
      if (t > 3.6 && t < 3.7) this.setCaption('', '');
    } else if (t < 12.7) {
      if (this.section === 0) { this.buildSchools(); this.flashCut(); }
      const local = t - 4.6;
      const vi = Math.min(2, Math.floor(local / 2.7));
      const vt = (local - vi * 2.7) / 2.7;
      const v = this.vignettes[vi];
      if (this._lastVi !== vi) {
        this._lastVi = vi;
        this.flashCut();
        this.setCaption(v.kicker, v.line);
      }
      // fast low whip past the front doors, slight roll for energy
      cam.position.set(v.cx - 30 + vt * 58, 2.6 + vt * 4, 34 - vt * 9);
      cam.lookAt(v.cx + 3, 5.5, -2);
      cam.rotation.z = (vt - 0.5) * 0.05;
    } else if (t < 17.6) {
      if (this.section === 1) { this.buildHeroes(); this.flashCut(); this.setCaption('', ''); }
      cam.rotation.z = 0;
      for (const { a } of this.heroAnims || []) a.update(dt);
      const local = t - 12.7;
      const hi = Math.min(2, Math.floor(local / 1.63));
      const ht = (local - hi * 1.63) / 1.63;
      if (this._lastHero !== hi) {
        this._lastHero = hi;
        this.flashCut();
        this.setCaption(['THE TRENCHES', 'THE ARM', 'THE BURNER'][hi], '');
      }
      const cx = hi * 60;
      // slow push-in on each hero, low and tight
      cam.position.set(cx + 2.6 - ht * 0.9, 1.5 + ht * 0.25, 3.4 - ht * 0.8);
      cam.lookAt(cx, 1.35, 0);
    } else if (t < 24) {
      if (this.section === 2) {
        this.buildFinale();
        this.flashCut();
        this.setCaption('FRIDAY NIGHT', 'THIS IS WHERE LEGENDS START');
      }
      const local = (t - 17.6) / 6.4;
      cam.position.set(-58 + local * 40, 1.6 + local * 7.5, 10 - local * 6);
      cam.lookAt(20, 2.5, 0);
      this.stadiumRef?.crowd.setExcitement(0.8);
      this.stadiumRef?.crowd.update(this.t, dt);
      if (t > 20.4 && this.logoEl && !this.logoEl.classList.contains('show')) {
        this.setCaption('', '');
        this.logoEl.classList.add('show');
      }
    } else {
      this.finish();
      return;
    }
    this.renderer.render(this.scene, cam);
  }

  finish() {
    if (this.done) return;
    this.done = true;
    this.music?.stop();
    window.removeEventListener('keydown', this._skip);
    this.container.removeEventListener('pointerdown', this._skip);
    clearInterval(this._padPoll);
    this.setCaption('', '');
    this.logoEl?.classList.remove('show');
    this.renderer.dispose();
    this.container.innerHTML = '';
    this.onDone();
  }
}
