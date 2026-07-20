// CREATE YOUR PLAYER — face, hair, build, gear, on a rotating bust with the
// helmet on or off. Feeds Hometown Hero.
import * as THREE from 'three';
import { makeKit, buildPlayer } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { logoCanvas } from './logos.js';
import { sfx } from './audio.js';

const CLIPS = makeClips();
const SKINS = ['#e8c49a', '#e0a87f', '#c68863', '#a16a45', '#8d5a3b', '#74462c', '#5d3a26', '#4a2e1e'];
const HAIRC = ['#1a1208', '#2a1c10', '#4a3018', '#6a4a22', '#8a6a3a', '#b8b2a8'];
const EYES = ['#241a12', '#3a2a14', '#2a4a2a', '#2a3a5e', '#4a4a4a'];

function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

export class FaceEditor {
  constructor(panelEl, previewEl, state, onDone) {
    this.panel = panelEl;
    this.holder = previewEl;
    this.state = state;
    this.onDone = onDone;
    this.helmetOn = false;
    this.name = 'Jake Moss';
    this.num = 7;
    this.build = 'avg';
    this.look = {
      skin: '#c68863', hair: 'buzz', hairCol: '#2a1c10', eyeCol: '#241a12',
      brow: 1, jaw: 1, facial: 'none', eyeBlack: true, visor: null,
    };
    // viewer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(previewEl.clientWidth, previewEl.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    previewEl.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#10182e');
    this.scene.add(new THREE.HemisphereLight('#9fb0d8', '#22261c', 1.0));
    const key = new THREE.DirectionalLight('#ffe8c4', 2.4);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7a9aff', 1.4);
    rim.position.set(-4, 3, -3);
    this.scene.add(rim);
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.12, 28), new THREE.MeshPhongMaterial({ color: '#46506a', shininess: 60 }));
    dais.position.y = 0.06;
    this.scene.add(dais);
    this.camera = new THREE.PerspectiveCamera(36, previewEl.clientWidth / previewEl.clientHeight, 0.05, 100);
    this.yaw = 0.4;
    this._drag = null;
    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', (e) => { this._drag = e.clientX; });
    cv.addEventListener('pointermove', (e) => { if (this._drag != null) { this.yaw -= (e.clientX - this._drag) * 0.01; this._drag = e.clientX; } });
    cv.addEventListener('pointerup', () => { this._drag = null; });
    this._onResize = () => {
      if (!previewEl.clientWidth) return;
      this.camera.aspect = previewEl.clientWidth / previewEl.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(previewEl.clientWidth, previewEl.clientHeight);
    };
    window.addEventListener('resize', this._onResize);
    this.clock = new THREE.Clock();
    this.disposed = false;
    this.rebuild();
    this.render();
    this.loop();
  }

  rebuild() {
    if (this.rigGroup) this.scene.remove(this.rigGroup);
    const s = this.state.school;
    const logo = logoCanvas(s.logoId, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
    const kit = makeKit(this.state.uniform, logo);
    const rig = buildPlayer(kit, { num: this.num, build: this.build, skin: this.look.skin, look: { ...this.look }, accessories: { towel: true } });
    rig.group.position.y = 0.12;
    for (const part of rig.helmetParts) part.visible = this.helmetOn;
    this.rigGroup = rig.group;
    this.scene.add(rig.group);
    this.anim = new Animator(rig, CLIPS);
    this.anim.play('idle');
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (this._drag == null) this.yaw += dt * 0.25;
    this.anim?.update(dt);
    // bust framing: close on head & shoulders
    this.camera.position.set(Math.sin(this.yaw) * 2.6, 1.78, Math.cos(this.yaw) * 2.6);
    this.camera.lookAt(0, 1.62, 0);
    this.renderer.render(this.scene, this.camera);
  }

  swRow(values, get, set, colors = true) {
    const row = el('div', 'preset-row');
    for (const v of values) {
      const b = el('button', 'preset-chip' + (get() === v ? ' on' : ''));
      if (colors) b.style.background = v;
      b.onclick = () => { set(v); sfx.chime(); this.render(); this.rebuild(); };
      row.appendChild(b);
    }
    return row;
  }

  segRow(opts, get, set) {
    const row = el('div', 'seg-row');
    for (const [val, label] of opts) {
      const b = el('button', 'seg' + (get() === val ? ' on' : ''), label);
      b.onclick = () => { set(val); sfx.chime(); this.render(); this.rebuild(); };
      row.appendChild(b);
    }
    return row;
  }

  render() {
    const p = this.panel;
    const L = this.look;
    p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title', 'WHO ARE YOU, KID?'));

    const nameIn = document.createElement('input');
    nameIn.type = 'text'; nameIn.maxLength = 22; nameIn.value = this.name;
    nameIn.addEventListener('input', () => { this.name = nameIn.value || 'Jake Moss'; });
    const f1 = el('label', 'field');
    f1.appendChild(el('span', 'field-label', 'YOUR NAME'));
    f1.appendChild(nameIn);
    p.appendChild(f1);

    p.appendChild(el('h3', 'panel-sub', 'JERSEY NUMBER (QB)'));
    p.appendChild(this.segRow([[1, '1'], [3, '3'], [7, '7'], [10, '10'], [12, '12'], [16, '16']], () => this.num, (v) => { this.num = v; }));

    p.appendChild(el('h3', 'panel-sub', 'SKIN TONE'));
    p.appendChild(this.swRow(SKINS, () => L.skin, (v) => { L.skin = v; }));

    p.appendChild(el('h3', 'panel-sub', 'FACE'));
    const jawRow = el('div', 'seg-row');
    for (const [v, label] of [[0.92, 'NARROW'], [1, 'AVERAGE'], [1.09, 'SQUARE']]) {
      const b = el('button', 'seg' + (Math.abs(L.jaw - v) < 0.02 ? ' on' : ''), label);
      b.onclick = () => { L.jaw = v; sfx.chime(); this.render(); this.rebuild(); };
      jawRow.appendChild(b);
    }
    p.appendChild(jawRow);
    p.appendChild(this.segRow([[0.5, 'LIGHT BROW'], [1, 'FULL BROW'], [1.6, 'HEAVY BROW']], () => L.brow, (v) => { L.brow = v; }));
    p.appendChild(el('h3', 'panel-sub', 'EYES'));
    p.appendChild(this.swRow(EYES, () => L.eyeCol, (v) => { L.eyeCol = v; }));

    p.appendChild(el('h3', 'panel-sub', 'HAIR'));
    p.appendChild(this.segRow([['none', 'SHAVED'], ['buzz', 'BUZZ'], ['curl', 'CURLS']], () => L.hair, (v) => { L.hair = v; }));
    p.appendChild(this.swRow(HAIRC, () => L.hairCol, (v) => { L.hairCol = v; }));

    p.appendChild(el('h3', 'panel-sub', 'FACIAL HAIR'));
    p.appendChild(this.segRow([['none', 'CLEAN'], ['stache', 'MUSTACHE'], ['goatee', 'GOATEE']], () => L.facial, (v) => { L.facial = v; }));

    p.appendChild(el('h3', 'panel-sub', 'GAME DAY'));
    p.appendChild(this.segRow([[true, 'EYE BLACK'], [false, 'NO EYE BLACK']], () => L.eyeBlack, (v) => { L.eyeBlack = v; }));
    p.appendChild(this.segRow([[null, 'NO VISOR'], ['clear', 'CLEAR VISOR'], ['dark', 'DARK VISOR']], () => L.visor, (v) => { L.visor = v; }));

    p.appendChild(el('h3', 'panel-sub', 'BUILD'));
    p.appendChild(this.segRow([['slim', 'LEAN'], ['avg', 'ATHLETIC'], ['big', 'POWER']], () => this.build, (v) => { this.build = v; }));

    const hb = el('button', 'seg', this.helmetOn ? '⛑ HELMET: ON' : '⛑ HELMET: OFF');
    hb.style.marginTop = '12px';
    hb.onclick = () => { this.helmetOn = !this.helmetOn; sfx.chime(); this.render(); this.rebuild(); };
    p.appendChild(hb);

    const go = el('button', 'cta big', "★ THAT'S ME — START MY STORY ▸");
    go.onclick = () => { sfx.firstDown(); this.onDone({ name: this.name, num: this.num, build: this.build, look: { ...L } }); };
    p.appendChild(go);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.panel.innerHTML = '';
    this.holder.innerHTML = '';
  }
}
