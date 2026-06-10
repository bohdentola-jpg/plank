// The three build screens: School, Uniform, Team — each with a live 3D preview.
import * as THREE from 'three';
import { MASCOTS, COLOR_PRESETS, genRoster, genPlayerName, irange } from './names.js';
import { LOGO_IDS, LOGO_LABELS, logoCanvas } from './logos.js';
import { buildSchool } from './school.js';
import { makeKit, buildPlayer } from './playerModel.js';
import { Animator } from './animation.js';
import { makeClips } from './clips.js';
import { grassTileCanvas, tex, contrastText } from './textures.js';
import { sfx } from './audio.js';

const CLIPS = makeClips();

// ---------------------------------------------------------- PreviewApp
class PreviewApp {
  constructor(container, { radius = 16, height = 6, lookY = 2.5, auto = 0.22 } = {}) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#101830');
    this.scene.fog = new THREE.Fog('#101830', radius * 2.2, radius * 7);
    this.camera = new THREE.PerspectiveCamera(46, container.clientWidth / container.clientHeight, 0.1, 600);
    this.yaw = 0.6;
    this.pitch = 0;
    this.radius = radius;
    this.height = height;
    this.lookY = lookY;
    this.auto = auto;
    this.content = null;

    const hemi = new THREE.HemisphereLight('#7a8cc0', '#1e2415', 0.95);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight('#ffe8c4', 1.9);
    key.position.set(12, 18, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -24; key.shadow.camera.right = 24;
    key.shadow.camera.top = 24; key.shadow.camera.bottom = -24;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight('#7a9aff', 0.8);
    rim.position.set(-14, 10, -12);
    this.scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(radius * 2.4, 36),
      new THREE.MeshPhongMaterial({ map: tex(grassTileCanvas('#2c5a28'), { repeat: [radius, radius] }) })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // drag orbit
    this._drag = null;
    const cv = this.renderer.domElement;
    cv.style.cursor = 'grab';
    cv.addEventListener('pointerdown', (e) => { this._drag = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!this._drag) return;
      this.yaw -= (e.clientX - this._drag.x) * 0.008;
      this.height = THREE.MathUtils.clamp(this.height + (e.clientY - this._drag.y) * 0.03, 1.2, this.radius * 1.4);
      this._drag = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener('pointerup', () => { this._drag = null; });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.radius = THREE.MathUtils.clamp(this.radius + e.deltaY * 0.02, 4, 90);
    }, { passive: false });

    this._onResize = () => {
      if (!container.clientWidth) return;
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', this._onResize);

    this.clock = new THREE.Clock();
    this.disposed = false;
    this.onTick = null;
    this.loop();
  }

  setContent(group, { radius, height, lookY } = {}) {
    if (this.content) this.scene.remove(this.content);
    this.content = group;
    if (group) this.scene.add(group);
    if (radius) this.radius = radius;
    if (height !== undefined) this.height = height;
    if (lookY !== undefined) this.lookY = lookY;
  }

  loop() {
    if (this.disposed) return;
    requestAnimationFrame(() => this.loop());
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this._drag) this.yaw += this.auto * dt;
    this.camera.position.set(Math.sin(this.yaw) * this.radius, this.height, Math.cos(this.yaw) * this.radius);
    this.camera.lookAt(0, this.lookY, 0);
    if (this.onTick) this.onTick(dt);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    window.removeEventListener('resize', this._onResize);
    this.renderer.dispose();
    this.container.innerHTML = '';
  }
}

// ---------------------------------------------------------- helpers
function el(tag, cls, html) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (html !== undefined) d.innerHTML = html;
  return d;
}

function field(labelText, input) {
  const w = el('label', 'field');
  w.appendChild(el('span', 'field-label', labelText));
  w.appendChild(input);
  return w;
}

function colorInput(value, onChange) {
  const i = document.createElement('input');
  i.type = 'color';
  i.value = value;
  i.addEventListener('input', () => onChange(i.value));
  return i;
}

function select(options, value, onChange) {
  const s = document.createElement('select');
  for (const o of options) {
    const op = document.createElement('option');
    op.value = o.value ?? o;
    op.textContent = o.label ?? o;
    s.appendChild(op);
  }
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function slider(min, max, value, onChange) {
  const s = document.createElement('input');
  s.type = 'range';
  s.min = min; s.max = max; s.value = value; s.step = 1;
  s.addEventListener('input', () => onChange(parseInt(s.value, 10)));
  return s;
}

function check(value, onChange) {
  const c = document.createElement('input');
  c.type = 'checkbox';
  c.checked = value;
  c.addEventListener('change', () => onChange(c.checked));
  return c;
}

function textInput(value, onChange, max = 14) {
  const i = document.createElement('input');
  i.type = 'text';
  i.maxLength = max;
  i.value = value;
  i.addEventListener('input', () => onChange(i.value));
  return i;
}

// ---------------------------------------------------------- School builder
export class SchoolBuilder {
  constructor(panelEl, previewEl, state, onNext) {
    this.state = state;
    this.panel = panelEl;
    this.preview = new PreviewApp(previewEl, { radius: 42, height: 14, lookY: 4 });
    this._rebuildT = null;
    this.render();
    this.rebuild();
  }

  render() {
    const s = this.state.school;
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title', 'BUILD YOUR SCHOOL'));

    const idGrid = el('div', 'form-grid');
    idGrid.appendChild(field('TOWN / SCHOOL NAME', textInput(s.name, (v) => { s.name = v || 'Westfield'; this.queueRebuild(); })));
    idGrid.appendChild(field('MASCOT', select(MASCOTS.map((m) => m.name), s.mascot, (v) => {
      s.mascot = v;
      s.logoId = MASCOTS.find((m) => m.name === v)?.logo || s.logoId;
      this.renderLogoGrid();
      this.queueRebuild();
    })));
    p.appendChild(idGrid);

    // colors
    p.appendChild(el('h3', 'panel-sub', 'SCHOOL COLORS'));
    const presets = el('div', 'preset-row');
    for (const cp of COLOR_PRESETS) {
      const b = el('button', 'preset-chip');
      b.title = cp.name;
      b.style.background = `linear-gradient(135deg, ${cp.primary} 50%, ${cp.secondary} 50%)`;
      b.onclick = () => {
        s.colors.primary = cp.primary;
        s.colors.secondary = cp.secondary;
        sfx.chime();
        this.render();
        this.rebuild();
      };
      presets.appendChild(b);
    }
    p.appendChild(presets);
    const cGrid = el('div', 'form-grid');
    cGrid.appendChild(field('PRIMARY', colorInput(s.colors.primary, (v) => { s.colors.primary = v; this.renderLogoGrid(); this.queueRebuild(); })));
    cGrid.appendChild(field('SECONDARY', colorInput(s.colors.secondary, (v) => { s.colors.secondary = v; this.renderLogoGrid(); this.queueRebuild(); })));
    p.appendChild(cGrid);

    // logo
    p.appendChild(el('h3', 'panel-sub', 'LOGO'));
    this.logoGrid = el('div', 'logo-grid');
    p.appendChild(this.logoGrid);
    this.renderLogoGrid();

    // building
    p.appendChild(el('h3', 'panel-sub', 'THE BUILDING'));
    const B = s.building;
    const styleRow = el('div', 'seg-row');
    for (const [id, label] of [['classic', 'CLASSIC 1925'], ['brick', "BRICK '58"], ['modern', "MODERN '99"]]) {
      const b = el('button', 'seg' + (B.style === id ? ' on' : ''), label);
      b.onclick = () => { B.style = id; sfx.chime(); this.render(); this.rebuild(); };
      styleRow.appendChild(b);
    }
    p.appendChild(styleRow);
    const bGrid = el('div', 'form-grid');
    bGrid.appendChild(field(`FLOORS: ${B.floors}`, slider(1, 3, B.floors, (v) => { B.floors = v; this.render(); this.queueRebuild(); })));
    bGrid.appendChild(field(`MAIN HALL SIZE: ${['COZY', 'STANDARD', 'GRAND'][B.length - 1]}`, slider(1, 3, B.length, (v) => { B.length = v; this.render(); this.queueRebuild(); })));
    p.appendChild(bGrid);
    const checks = el('div', 'check-row');
    const ck = (label, key) => {
      const w = el('label', 'check');
      w.appendChild(check(B[key], (v) => { B[key] = v; this.queueRebuild(); }));
      w.appendChild(el('span', '', label));
      checks.appendChild(w);
    };
    ck('LEFT WING', 'wingL');
    ck('RIGHT WING', 'wingR');
    ck('GYMNASIUM', 'gym');
    if (B.style === 'classic') ck('CUPOLA', 'cupola');
    ck('BUS FLEET', 'buses');
    p.appendChild(checks);

    p.appendChild(el('h3', 'panel-sub', 'MASONRY'));
    const bricks = el('div', 'preset-row');
    for (const col of ['#9a4a32', '#7e3b28', '#b06a3c', '#8a8078', '#5c4a42', '#c2b8a4']) {
      const b = el('button', 'preset-chip' + (B.brick === col ? ' on' : ''));
      b.style.background = col;
      b.onclick = () => { B.brick = col; this.render(); this.rebuild(); };
      bricks.appendChild(b);
    }
    p.appendChild(bricks);

    const next = el('button', 'cta', 'NEXT: UNIFORMS ▸');
    next.onclick = () => { sfx.chime(); this.onNextCb?.(); };
    p.appendChild(next);
  }

  renderLogoGrid() {
    const s = this.state.school;
    this.logoGrid.innerHTML = '';
    for (const id of LOGO_IDS) {
      const cell = el('button', 'logo-cell' + (s.logoId === id ? ' on' : ''));
      cell.title = LOGO_LABELS[id];
      const cv = logoCanvas(id, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
      cv.style.width = '100%';
      cv.style.height = '100%';
      cell.appendChild(cv);
      cell.onclick = () => { s.logoId = id; sfx.chime(); this.renderLogoGrid(); this.queueRebuild(); };
      this.logoGrid.appendChild(cell);
    }
  }

  queueRebuild() {
    clearTimeout(this._rebuildT);
    this._rebuildT = setTimeout(() => this.rebuild(), 180);
  }

  rebuild() {
    const g = buildSchool(this.state.school, { signLine2: 'FOOTBALL FRIDAY 7PM' });
    this.preview.setContent(g, { radius: Math.max(34, 26 + this.state.school.building.length * 6) });
  }

  onNext(cb) { this.onNextCb = cb; }

  dispose() {
    clearTimeout(this._rebuildT);
    this.preview.dispose();
    this.panel.innerHTML = '';
  }
}

// ---------------------------------------------------------- Uniform builder
export class UniformBuilder {
  constructor(panelEl, previewEl, state, onNext) {
    this.state = state;
    this.panel = panelEl;
    this.preview = new PreviewApp(previewEl, { radius: 5.2, height: 2.4, lookY: 1.05, auto: 0.4 });
    this._rebuildT = null;
    this._clipIdx = 0;
    this._clipT = 0;
    this._showcase = ['run', 'throwHold', 'sprint', 'celebrate', 'stance3', 'idle'];
    this.preview.onTick = (dt) => {
      if (!this.anim) return;
      this._clipT += dt;
      if (this._clipT > 2.6) {
        this._clipT = 0;
        this._clipIdx = (this._clipIdx + 1) % this._showcase.length;
        this.anim.play(this._showcase[this._clipIdx], { fade: 0.25 });
      }
      this.anim.update(dt);
    };
    this.render();
    this.rebuild();
  }

  render() {
    const u = this.state.uniform;
    const s = this.state.school;
    const p = this.panel;
    p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title', 'UNIFORM LAB'));

    p.appendChild(el('h3', 'panel-sub', 'QUICK SETS'));
    const sets = el('div', 'seg-row');
    const apply = (cfg, label) => {
      const b = el('button', 'seg', label);
      b.onclick = () => { Object.assign(u, cfg); sfx.chime(); this.render(); this.rebuild(); };
      sets.appendChild(b);
    };
    const c = s.colors;
    apply({ jersey: c.primary, pants: '#f2f1ec', helmet: c.primary, sleeve: c.secondary, numberFill: '#f4f4f2', numberStroke: c.secondary, pantsStripe: c.primary, helmetStripe: c.secondary, socks: c.primary }, 'HOME');
    apply({ jersey: '#f2f1ec', pants: c.primary, helmet: c.primary, sleeve: c.primary, numberFill: c.primary, numberStroke: c.secondary, pantsStripe: c.secondary, helmetStripe: c.secondary, socks: '#f2f1ec' }, 'WHITES');
    apply({ jersey: c.secondary, pants: c.primary, helmet: c.secondary, sleeve: c.primary, numberFill: c.primary, numberStroke: '#16161a', pantsStripe: '#16161a', helmetStripe: c.primary, socks: c.secondary }, 'ALTERNATE');
    apply({ jersey: '#17181c', pants: '#17181c', helmet: '#17181c', sleeve: c.secondary, numberFill: c.secondary, numberStroke: '#f4f4f2', pantsStripe: c.secondary, helmetStripe: c.secondary, socks: '#17181c' }, 'BLACKOUT');
    p.appendChild(sets);

    p.appendChild(el('h3', 'panel-sub', 'TRIM STYLE'));
    const styles = el('div', 'seg-row');
    for (const [id, label] of [['classic', 'SLEEVE STRIPES'], ['panel', 'SIDE PANELS'], ['plain', 'CLEAN']]) {
      const b = el('button', 'seg' + (u.style === id ? ' on' : ''), label);
      b.onclick = () => { u.style = id; sfx.chime(); this.render(); this.rebuild(); };
      styles.appendChild(b);
    }
    p.appendChild(styles);

    const grid = el('div', 'form-grid three');
    const cf = (label, key) => grid.appendChild(field(label, colorInput(u[key], (v) => { u[key] = v; this.queueRebuild(); })));
    cf('JERSEY', 'jersey');
    cf('SLEEVE TRIM', 'sleeve');
    cf('NUMBERS', 'numberFill');
    cf('NUMBER TRIM', 'numberStroke');
    cf('PANTS', 'pants');
    cf('PANT STRIPE', 'pantsStripe');
    cf('HELMET', 'helmet');
    cf('HELMET STRIPE', 'helmetStripe');
    cf('FACEMASK', 'facemask');
    cf('SOCKS', 'socks');
    p.appendChild(grid);

    const checks = el('div', 'check-row');
    const w = el('label', 'check');
    w.appendChild(check(u.stripes2, (v) => { u.stripes2 = v; this.queueRebuild(); }));
    w.appendChild(el('span', '', 'TWIN HELMET STRIPES'));
    checks.appendChild(w);
    p.appendChild(checks);

    const next = el('button', 'cta', 'NEXT: THE ROSTER ▸');
    next.onclick = () => { sfx.chime(); this.onNextCb?.(); };
    p.appendChild(next);
  }

  queueRebuild() {
    clearTimeout(this._rebuildT);
    this._rebuildT = setTimeout(() => this.rebuild(), 160);
  }

  rebuild() {
    const s = this.state.school;
    const logo = logoCanvas(s.logoId, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
    const kit = makeKit(this.state.uniform, logo);
    const star = this.state.roster.find((r) => r.pos === 'QB') || { num: 7, skin: '#c68863' };
    const rig = buildPlayer(kit, { num: star.num, build: 'avg', skin: star.skin, accessories: { towel: true } });
    const g = new THREE.Group();
    g.add(rig.group);
    const podium = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.7, 0.18, 24),
      new THREE.MeshPhongMaterial({ color: '#23242c', shininess: 40 })
    );
    podium.position.y = -0.09;
    podium.receiveShadow = true;
    g.add(podium);
    this.anim = new Animator(rig, CLIPS);
    this.anim.play(this._showcase[this._clipIdx], { fade: 0 });
    this.preview.setContent(g);
  }

  onNext(cb) { this.onNextCb = cb; }
  dispose() {
    clearTimeout(this._rebuildT);
    this.preview.dispose();
    this.panel.innerHTML = '';
  }
}

// ---------------------------------------------------------- Team builder
export class TeamBuilder {
  constructor(panelEl, previewEl, state) {
    this.state = state;
    this.panel = panelEl;
    this.preview = new PreviewApp(previewEl, { radius: 7.5, height: 2.6, lookY: 1.0, auto: 0.3 });
    this.anims = [];
    this.preview.onTick = (dt) => { for (const a of this.anims) a.update(dt); };
    this.render();
    this.rebuild();
  }

  render() {
    const p = this.panel;
    const s = this.state.school;
    p.innerHTML = '';
    p.appendChild(el('h2', 'panel-title', `${s.name.toUpperCase()} ${s.mascot.toUpperCase()} — VARSITY`));

    const tools = el('div', 'seg-row');
    const rr = el('button', 'seg', '↻ RE-ROLL WHOLE TEAM');
    rr.onclick = () => { this.state.roster = genRoster(4); sfx.chime(); this.render(); this.rebuild(); };
    tools.appendChild(rr);
    p.appendChild(tools);

    const tbl = el('div', 'roster');
    const head = el('div', 'roster-row head');
    head.innerHTML = '<span>#</span><span>NAME</span><span>POS</span><span>SPD</span><span>STR</span><span>HANDS</span><span></span>';
    tbl.appendChild(head);
    for (const player of this.state.roster) {
      const row = el('div', 'roster-row');
      const num = document.createElement('input');
      num.type = 'text'; num.maxLength = 2; num.value = player.num; num.className = 'num';
      num.addEventListener('input', () => { player.num = parseInt(num.value, 10) || 0; });
      const name = document.createElement('input');
      name.type = 'text'; name.maxLength = 20; name.value = player.name; name.className = 'name';
      name.addEventListener('input', () => { player.name = name.value; });
      const bar = (v) => `<i class="bar"><b style="width:${v}%"></b></i>`;
      row.appendChild(num);
      row.appendChild(name);
      row.appendChild(el('span', 'pos', player.pos));
      row.appendChild(el('span', '', bar(player.spd)));
      row.appendChild(el('span', '', bar(player.str)));
      row.appendChild(el('span', '', bar(player.hands)));
      const re = el('button', 'mini', '↻');
      re.title = 'Re-roll this player';
      re.onclick = () => {
        const fresh = genRoster(4).find((x) => x.pos === player.pos);
        Object.assign(player, { ...fresh, id: player.id, num: player.num });
        sfx.chime();
        this.render();
      };
      row.appendChild(re);
      tbl.appendChild(row);
    }
    p.appendChild(tbl);

    const next = el('button', 'cta big', '★ FRIDAY NIGHT — KICK OFF ▸');
    next.onclick = () => { sfx.chime(); this.onNextCb?.(); };
    p.appendChild(next);
  }

  rebuild() {
    const s = this.state.school;
    const logo = logoCanvas(s.logoId, { fg: s.colors.secondary, bg: s.colors.primary, line: '#101014', letter: s.name[0] });
    const kit = makeKit(this.state.uniform, logo);
    const g = new THREE.Group();
    this.anims = [];
    const lineup = [
      { pos: 'QB', clip: 'throwHold', at: [0, 0], face: 0.2 },
      { pos: 'WR', clip: 'catchHigh', at: [-1.9, 0.4], face: -0.3 },
      { pos: 'LT', clip: 'stance3', at: [1.9, 0.5], face: 0.3 },
      { pos: 'RB', clip: 'run', at: [-0.7, -1.6], face: -0.1 },
      { pos: 'MLB', clip: 'stance2', at: [1.0, -1.7], face: 0.15 },
    ];
    for (const spec of lineup) {
      const info = this.state.roster.find((r) => r.pos === spec.pos) || this.state.roster[0];
      const rig = buildPlayer(kit, { num: info.num, build: info.build, skin: info.skin });
      rig.group.position.set(spec.at[0], 0, spec.at[1]);
      rig.group.rotation.y = spec.face;
      g.add(rig.group);
      const anim = new Animator(rig, CLIPS);
      anim.play(spec.clip, { fade: 0, startAt: Math.random() * 0.6 });
      if (spec.clip === 'catchHigh' || spec.clip === 'throwHold') anim.rate = 0.6;
      this.anims.push(anim);
    }
    this.preview.setContent(g);
  }

  onNext(cb) { this.onNextCb = cb; }
  dispose() {
    this.preview.dispose();
    this.panel.innerHTML = '';
  }
}
