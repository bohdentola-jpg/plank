// editor.js — building, in the game.
//
// Two 3D rooms, one canvas:
//
//   the world     fly around your map, click the ground to place things, drag
//                 them, turn them, and hang a boxscript on anything.
//   the modeller  a black-and-white room with a 24³ cage in it. Click a face to
//                 add a voxel, shift-click to carve one away. That's the model
//                 editor — no files, no importing, all in-game.

import * as THREE from '../vendor/three.module.js';
import {
  clamp, lerp, uid, COLORS, colorOf, PALETTE_KEYS, PALETTE_HEX, playSound, DEG,
} from './util.js';
import {
  emptyMap, validateMap, mapToCode, createEntity, refreshSize, entAABB,
  MAX_OBJECTS, MAX_MODELS,
} from './world.js';
import { BUILTIN, MODEL_GROUPS, modelInfo, buildModelMesh, tintMesh, setMeshOpacity } from './models.js';
import { World, TerrainStreamer, BIOMES } from './terrain.js';
import { View, boxGeo, flatMat, makeShadow } from './render.js';
import {
  emptyVoxels, setVox, getVox, buildVoxelGeometry, voxelMaterial, ghostMaterial,
  validateVoxels, VOXEL_UNIT, MAX_DIM, starterShape, countVoxels, resizeVoxels,
} from './voxel.js';
import { compile } from './boxscript.js';
import { saveMap } from './maps.js';
import { CHEATSHEET_HTML, HELP_HTML } from './docs.js';

const GRID = 1;                 // world snap, in units

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text != null) el.textContent = text;
  return el;
}

export class Editor {
  constructor(opts) {
    this.dom = opts.dom;
    this.root = opts.root;
    this.map = validateMap(opts.map) || emptyMap();
    this.mapId = opts.mapId || uid();
    this.onExit = opts.onExit;
    this.onTest = opts.onTest;
    this.onHost = opts.onHost;

    this.mode = 'world';
    this.tool = 'place';
    this.currentModel = 'box';
    this.selected = null;         // spec
    this.selectedEnt = null;      // live preview entity
    this.undoStack = [];
    this.running = true;
    this.status = '';
    this.statusT = 0;
    this.keys = new Set();
    this.raycaster = new THREE.Raycaster();
    this.ents = [];

    // ---- world room
    this.view = new View(this.dom.canvas);
    this.worldScene = this.view.scene;
    this.world = new World(this.map.terrain === false ? 0 : this.map.seed);
    this.flatVoid = this.map.terrain === false;
    if (this.flatVoid) { this.world.heightAt = () => 0; this.world.biomeAt = () => 'void'; }
    this.terrain = this.flatVoid
      ? this.makeFlatGround()
      : new TerrainStreamer(this.world, this.worldScene, { radius: 6, budget: 2 });

    this.fly = {
      pos: new THREE.Vector3(this.map.spawn.x, this.world.heightAt(this.map.spawn.x, this.map.spawn.z) + 14, this.map.spawn.z + 20),
      yaw: Math.PI, pitch: -0.5, speed: 26,
    };

    this.ghost = null;
    this.spawnMarker = this.makeSpawnMarker();
    this.worldScene.add(this.spawnMarker);
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), 0x5f89bd);
    this.selBox.visible = false;
    this.worldScene.add(this.selBox);

    for (const spec of this.map.objects) this.addEnt(spec);
    this.setGhost(this.currentModel);

    // ---- modeller room (built lazily)
    this.modelScene = null;

    this.buildUI();
    this.bind();
    this.refreshPalette();
    if (this.terrain.prime) this.terrain.prime(this.fly.pos.x, this.fly.pos.z, 3);
    this.last = performance.now();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  makeFlatGround() {
    const geo = new THREE.PlaneGeometry(1200, 1200);
    geo.rotateX(-Math.PI / 2);
    const mesh = new THREE.Mesh(geo, flatMat(0xf6f6f6));
    this.worldScene.add(mesh);
    const grid = new THREE.GridHelper(400, 40, 0xdedede, 0xebebeb);
    grid.position.y = 0.02;
    this.worldScene.add(grid);
    const scene = this.worldScene;
    return {
      update() {}, prime() {},
      dispose() {
        scene.remove(mesh); mesh.geometry.dispose();
        scene.remove(grid); grid.geometry.dispose();
      },
    };
  }

  makeSpawnMarker() {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.12, 6, 18), flatMat(0x7fa06a));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const pin = new THREE.Mesh(boxGeo(0.2, 3.4, 0.2), flatMat(0x7fa06a));
    pin.position.y = 1.7;
    g.add(pin);
    const flag = new THREE.Mesh(boxGeo(1.1, 0.7, 0.08), flatMat(0x7fa06a));
    flag.position.set(0.6, 3.1, 0);
    g.add(flag);
    g.position.set(this.map.spawn.x, this.map.spawn.y, this.map.spawn.z);
    return g;
  }

  // ------------------------------------------------------------- entities
  addEnt(spec) {
    const ent = createEntity(this.map, spec);
    if (!this.flatVoid && (spec.y == null || spec.y === 0)) ent.y = this.world.heightAt(ent.x, ent.z);
    ent.spec = spec;
    ent.mesh = buildModelMesh(this.map, ent.model);
    ent.mesh.scale.setScalar(ent.scale);
    ent.mesh.userData.entId = ent.id;
    if (ent.color) tintMesh(ent.mesh, colorOf(ent.color));
    ent.mesh.position.set(ent.x, ent.y, ent.z);
    ent.mesh.rotation.y = ent.yaw * DEG;
    this.worldScene.add(ent.mesh);
    this.ents.push(ent);
    return ent;
  }

  entForSpec(spec) { return this.ents.find(e => e.spec === spec); }

  rebuildEnt(spec) {
    const ent = this.entForSpec(spec);
    if (!ent) return;
    this.worldScene.remove(ent.mesh);
    ent.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
    this.ents = this.ents.filter(e => e !== ent);
    const fresh = this.addEnt(spec);
    if (this.selected === spec) this.selectedEnt = fresh;
  }

  rebuildAll() {
    for (const ent of this.ents) {
      this.worldScene.remove(ent.mesh);
      ent.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
    }
    this.ents = [];
    for (const spec of this.map.objects) this.addEnt(spec);
    this.selected = null;
    this.selectedEnt = null;
    this.selBox.visible = false;
    this.refreshInspector();
  }

  removeSpec(spec) {
    const ent = this.entForSpec(spec);
    if (ent) {
      this.worldScene.remove(ent.mesh);
      ent.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
      this.ents = this.ents.filter(e => e !== ent);
    }
    this.map.objects = this.map.objects.filter(o => o !== spec);
    if (this.selected === spec) { this.selected = null; this.selectedEnt = null; this.selBox.visible = false; this.refreshInspector(); }
  }

  setGhost(model) {
    if (this.ghost) {
      this.worldScene.remove(this.ghost);
      this.ghost.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
    }
    this.ghost = buildModelMesh(this.map, model);
    setMeshOpacity(this.ghost, 0.45);
    this.ghost.visible = false;
    this.worldScene.add(this.ghost);
  }

  // ------------------------------------------------------------- UI
  buildUI() {
    this.root.innerHTML = '';
    this.root.style.display = 'block';

    const top = h('div', 'ed-top');
    const back = h('button', 'ed-btn', '← menu');
    back.onclick = () => this.exit();
    this.nameInput = h('input');
    this.nameInput.value = this.map.name;
    this.nameInput.maxLength = 40;
    this.nameInput.oninput = () => { this.map.name = this.nameInput.value || 'untitled'; };

    const saveBtn = h('button', 'ed-btn', 'save');
    saveBtn.onclick = () => this.save(true);
    const testBtn = h('button', 'ed-btn ed-primary', '▶ test');
    testBtn.onclick = () => { const m = this.map, id = this.mapId; this.save(); this.teardown(); this.onTest(m, id); };
    const hostBtn = h('button', 'ed-btn', 'host lobby');
    hostBtn.onclick = () => { const m = this.map, id = this.mapId; this.save(); this.teardown(); this.onHost(m, id); };
    const shareBtn = h('button', 'ed-btn', 'share');
    shareBtn.onclick = () => this.shareModal();
    const helpBtn = h('button', 'ed-btn', 'boxscript');
    helpBtn.onclick = () => this.helpModal();

    const terrLab = h('label', 'ed-check');
    this.terrCheck = h('input');
    this.terrCheck.type = 'checkbox';
    this.terrCheck.checked = this.map.terrain !== false;
    this.terrCheck.onchange = () => {
      this.map.terrain = this.terrCheck.checked;
      this.flash('reopen the editor to switch the world on or off');
    };
    terrLab.append(this.terrCheck, document.createTextNode(' landscape'));

    const seedBtn = h('button', 'ed-btn', 'reroll world');
    seedBtn.onclick = () => {
      this.pushUndo();
      this.map.seed = Math.floor(Math.random() * 1e9);
      this.flash('new seed ' + this.map.seed + ' — reopen to see it');
    };

    top.append(back, this.nameInput, terrLab, seedBtn, saveBtn, shareBtn, helpBtn, hostBtn, testBtn);

    this.left = h('div', 'ed-left');
    this.right = h('div', 'ed-right');
    this.right.style.display = 'none';
    this.statusEl = h('div', 'ed-status');
    this.hintEl = h('div', 'ed-hint');
    this.modalHost = h('div');
    this.root.append(top, this.left, this.right, this.statusEl, this.hintEl, this.modalHost);
  }

  refreshPalette() {
    this.left.innerHTML = '';
    this.left.append(h('div', 'ed-h', 'tool'));
    const tools = h('div', 'ed-tools');
    for (const [t, label] of [['place', '＋ place'], ['select', '↖ select / move'], ['erase', '✕ erase'], ['spawn', '⌂ set spawn']]) {
      const b = h('button', 'ed-tool' + (this.tool === t ? ' on' : ''), label);
      b.onclick = () => { this.tool = t; this.refreshPalette(); };
      tools.append(b);
    }
    this.left.append(tools);

    const addBtn = (name, label) => {
      const b = h('button', 'ed-model' + (this.tool === 'place' && this.currentModel === name ? ' on' : ''));
      b.append(h('span', 'ed-dot'), h('span', null, label));
      b.onclick = () => {
        this.tool = 'place';
        this.currentModel = name;
        this.setGhost(name);
        this.refreshPalette();
      };
      return b;
    };

    for (const grp of MODEL_GROUPS) {
      const names = Object.keys(BUILTIN).filter(n => BUILTIN[n].group === grp);
      if (!names.length) continue;
      this.left.append(h('div', 'ed-h', grp));
      for (const n of names) this.left.append(addBtn(n, BUILTIN[n].label));
    }

    this.left.append(h('div', 'ed-h', 'my models'));
    const mine = Object.keys(this.map.models);
    if (!mine.length) this.left.append(h('div', 'ed-note', 'nothing painted yet'));
    for (const name of mine) {
      const row = h('div', 'ed-model-row');
      const b = addBtn(name, name);
      const edit = h('button', 'ed-mini', '✎');
      edit.title = 'edit this model';
      edit.onclick = () => this.openModeller(name);
      row.append(b, edit);
      this.left.append(row);
    }
    const newBtn = h('button', 'ed-btn ed-wide', '✎ make a model');
    newBtn.onclick = () => this.openModeller(null);
    this.left.append(newBtn);
    this.left.append(h('div', 'ed-note', this.map.objects.length + ' / ' + MAX_OBJECTS + ' objects'));
  }

  refreshInspector() {
    const spec = this.selected;
    if (!spec) { this.right.style.display = 'none'; return; }
    this.right.style.display = 'block';
    this.right.innerHTML = '';
    const info = modelInfo(this.map, spec.model);
    this.right.append(h('div', 'ed-h', info.label || spec.model));

    const row = (label, el) => {
      const r = h('div', 'ed-row');
      r.append(h('span', null, label), el);
      this.right.append(r);
      return el;
    };

    const scale = h('input');
    scale.type = 'range'; scale.min = '10'; scale.max = '500'; scale.step = '5';
    scale.value = String(spec.scale || 100);
    scale.oninput = () => {
      spec.scale = +scale.value;
      const ent = this.entForSpec(spec);
      if (ent) { ent.scale = spec.scale / 100; ent.mesh.scale.setScalar(ent.scale); refreshSize(this.map, ent); }
    };
    scale.onchange = () => this.pushUndo();
    row('size', scale);

    const yaw = h('input');
    yaw.type = 'range'; yaw.min = '0'; yaw.max = '345'; yaw.step = '15';
    yaw.value = String(spec.yaw || 0);
    yaw.oninput = () => {
      spec.yaw = +yaw.value;
      const ent = this.entForSpec(spec);
      if (ent) { ent.yaw = spec.yaw; ent.mesh.rotation.y = spec.yaw * DEG; }
    };
    row('turn', yaw);

    const yBox = h('input');
    yBox.type = 'number'; yBox.step = '0.5';
    yBox.value = String(Math.round((spec.y || 0) * 10) / 10);
    yBox.onchange = () => {
      this.pushUndo();
      spec.y = +yBox.value || 0;
      const ent = this.entForSpec(spec);
      if (ent) { ent.y = spec.y; ent.mesh.position.y = spec.y; }
    };
    row('height', yBox);

    const solid = h('input'); solid.type = 'checkbox';
    solid.checked = spec.solid != null ? spec.solid : info.solid;
    solid.onchange = () => { this.pushUndo(); spec.solid = solid.checked; };
    row('solid', solid);

    const phys = h('input'); phys.type = 'checkbox';
    phys.checked = spec.physical != null ? spec.physical : info.physical;
    phys.onchange = () => { this.pushUndo(); spec.physical = phys.checked; };
    row('physical', phys);

    const color = h('select');
    const def = h('option', null, 'as painted'); def.value = '';
    color.append(def);
    for (const nm of PALETTE_KEYS) {
      const o = h('option', null, nm); o.value = nm;
      color.append(o);
    }
    color.value = spec.color || '';
    color.onchange = () => {
      this.pushUndo();
      spec.color = color.value || null;
      this.rebuildEnt(spec);
    };
    row('tint', color);

    const scriptBtn = h('button', 'ed-btn ed-wide', spec.script ? '✎ edit script' : '+ add a script');
    if (spec.script && !compile(spec.script).ok) scriptBtn.textContent = '⚠ script has errors';
    scriptBtn.onclick = () => this.scriptModal(
      spec.script || '',
      (src) => { this.pushUndo(); spec.script = src || null; this.refreshInspector(); },
      'script on this ' + spec.model,
    );
    this.right.append(scriptBtn);

    const dup = h('button', 'ed-btn ed-wide', 'duplicate');
    dup.onclick = () => {
      if (this.map.objects.length >= MAX_OBJECTS) { this.flash('this map is full'); return; }
      this.pushUndo();
      const copy = { ...spec, id: uid(), x: spec.x + 3, z: spec.z + 3 };
      this.map.objects.push(copy);
      const ent = this.addEnt(copy);
      this.selected = copy;
      this.selectedEnt = ent;
      this.refreshInspector();
      this.refreshPalette();
    };
    this.right.append(dup);

    const del = h('button', 'ed-btn ed-wide ed-danger', 'delete');
    del.onclick = () => { this.pushUndo(); this.removeSpec(spec); this.refreshPalette(); };
    this.right.append(del);
  }

  // ------------------------------------------------------------- modals
  modal(title, wide) {
    this.closeModal();
    const back = h('div', 'ed-modal-back');
    const box = h('div', 'ed-modal' + (wide ? ' ed-modal-wide' : ''));
    box.append(h('div', 'ed-modal-title', title));
    back.append(box);
    back.addEventListener('mousedown', (e) => {
      if (e.target === back) { this.closeModal(); if (this.onModalClose) { const f = this.onModalClose; this.onModalClose = null; f(); } }
    });
    this.modalHost.append(back);
    this.modalOpen = true;
    return box;
  }

  closeModal() {
    this.modalHost.innerHTML = '';
    this.modalOpen = false;
  }

  scriptModal(source, onSave, title, onCancel) {
    const box = this.modal(title || 'boxscript', true);
    this.onModalClose = onCancel || null;
    const wrap = h('div', 'ed-script-wrap');
    const ta = h('textarea', 'ed-script');
    ta.value = source;
    ta.spellcheck = false;
    ta.placeholder = 'when touched\n  say "hello!"\nend';
    const side = h('div', 'ed-cheat');
    side.innerHTML = CHEATSHEET_HTML;
    wrap.append(ta, side);
    const errBox = h('div', 'ed-errors');
    const check = () => {
      const res = compile(ta.value);
      if (res.ok) {
        errBox.className = 'ed-errors ok';
        errBox.textContent = ta.value.trim() ? '✓ looks good' : '';
      } else {
        errBox.className = 'ed-errors';
        errBox.textContent = res.errors.slice(0, 6).map(e => 'line ' + e.line + ': ' + e.msg).join('\n');
      }
      return res.ok;
    };
    ta.addEventListener('input', () => { clearTimeout(this._chk); this._chk = setTimeout(check, 400); });
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = ta.selectionStart;
        ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
        ta.selectionStart = ta.selectionEnd = s + 2;
      }
    });
    const bar = h('div', 'ed-modal-bar');
    const checkBtn = h('button', 'ed-btn', 'check');
    checkBtn.onclick = check;
    const cancel = h('button', 'ed-btn', 'cancel');
    cancel.onclick = () => { this.onModalClose = null; this.closeModal(); if (onCancel) onCancel(); };
    const save = h('button', 'ed-btn ed-primary', 'save script');
    save.onclick = () => { this.onModalClose = null; check(); onSave(ta.value.trim()); this.closeModal(); };
    bar.append(checkBtn, cancel, save);
    box.append(wrap, errBox, bar);
    setTimeout(() => { ta.focus(); check(); }, 0);
  }

  shareModal() {
    const box = this.modal('share this map');
    box.append(h('p', 'ed-p', 'this code holds the whole map — models, scripts, the world seed. paste it into “create → import”.'));
    const ta = h('textarea', 'ed-share');
    ta.readOnly = true;
    ta.value = mapToCode(this.map);
    ta.onclick = () => ta.select();
    box.append(ta, h('div', 'ed-note', (ta.value.length / 1024).toFixed(1) + ' kb'));
    const bar = h('div', 'ed-modal-bar');
    const copy = h('button', 'ed-btn ed-primary', 'copy');
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(ta.value); copy.textContent = 'copied'; }
      catch (e) { ta.select(); try { document.execCommand('copy'); copy.textContent = 'copied'; } catch (e2) { copy.textContent = 'select + ⌘C'; } }
    };
    const done = h('button', 'ed-btn', 'done');
    done.onclick = () => this.closeModal();
    bar.append(copy, done);
    box.append(bar);
  }

  helpModal() {
    const box = this.modal('boxscript', true);
    const div = h('div', 'ed-help');
    div.innerHTML = HELP_HTML;
    box.append(div);
    const bar = h('div', 'ed-modal-bar');
    const done = h('button', 'ed-btn ed-primary', 'got it');
    done.onclick = () => this.closeModal();
    bar.append(done);
    box.append(bar);
  }

  // ------------------------------------------------------------- modeller
  openModeller(name) {
    const existing = name ? this.map.models[name] : null;
    this.mode = 'model';
    this.mdl = {
      name: name || '',
      origName: name,
      vox: existing ? validateVoxels(existing.vox) : starterShape('cube', 12, 12, 12),
      solid: existing ? existing.solid !== false : true,
      physical: existing ? !!existing.physical : false,
      script: existing ? existing.script : null,
      color: PALETTE_KEYS.indexOf('gray'),
      undo: [],
      yaw: 0.6, pitch: 0.5, dist: 14,
      mirror: false,
    };
    this.buildModelScene();
    this.buildModellerUI();
  }

  buildModelScene() {
    if (this.modelScene) this.disposeModelScene();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f7f7);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xcccccc, 1.0));
    const sun = new THREE.DirectionalLight(0xffffff, 0.7);
    sun.position.set(6, 12, 8);
    scene.add(sun);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const v = this.mdl.vox;
    const size = { x: v.w * VOXEL_UNIT, y: v.h * VOXEL_UNIT, z: v.d * VOXEL_UNIT };

    // the floor of the cage: also the click target for the first layer
    const floorGeo = new THREE.PlaneGeometry(size.x, size.z);
    floorGeo.rotateX(-Math.PI / 2);
    this.mdlFloor = new THREE.Mesh(floorGeo, new THREE.MeshBasicMaterial({ color: 0xe9e9e9 }));
    this.mdlFloor.position.y = 0.001;
    scene.add(this.mdlFloor);
    const grid = new THREE.GridHelper(Math.max(size.x, size.z), Math.max(v.w, v.d), 0xd0d0d0, 0xdedede);
    grid.position.y = 0.01;
    scene.add(grid);

    // the cage
    const cage = new THREE.Box3Helper(new THREE.Box3(
      new THREE.Vector3(-size.x / 2, 0, -size.z / 2),
      new THREE.Vector3(size.x / 2, size.y, size.z / 2),
    ), 0xc8c8c8);
    scene.add(cage);

    this.mdlMesh = new THREE.Mesh(buildVoxelGeometry(v), voxelMaterial());
    scene.add(this.mdlMesh);

    this.mdlCursor = new THREE.Mesh(boxGeo(VOXEL_UNIT, VOXEL_UNIT, VOXEL_UNIT),
      new THREE.MeshBasicMaterial({ color: 0x5f89bd, transparent: true, opacity: 0.4 }));
    this.mdlCursor.visible = false;
    scene.add(this.mdlCursor);

    this.modelScene = scene;
    this.modelCam = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
  }

  disposeModelScene() {
    if (!this.modelScene) return;
    this.modelScene.traverse(o => {
      if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose();
    });
    this.modelScene = null;
  }

  remeshModel() {
    if (!this.mdlMesh) return;
    this.mdlMesh.geometry.dispose();
    this.mdlMesh.geometry = buildVoxelGeometry(this.mdl.vox);
  }

  buildModellerUI() {
    this.left.innerHTML = '';
    this.right.style.display = 'none';
    const M = this.mdl;

    this.left.append(h('div', 'ed-h', 'model'));
    const nameRow = h('div', 'ed-row');
    const nameIn = h('input');
    nameIn.placeholder = 'name it';
    nameIn.maxLength = 24;
    nameIn.value = M.name;
    nameIn.oninput = () => { M.name = nameIn.value; };
    nameRow.append(nameIn);
    this.left.append(nameRow);

    this.left.append(h('div', 'ed-h', 'colour'));
    const sw = h('div', 'ed-swatches');
    PALETTE_KEYS.forEach((key, i) => {
      const b = h('button', 'ed-swatch' + (i === M.color ? ' on' : ''));
      b.style.background = '#' + PALETTE_HEX[i].toString(16).padStart(6, '0');
      b.title = key;
      b.onclick = () => {
        M.color = i;
        [...sw.children].forEach((el, j) => el.classList.toggle('on', j === i));
      };
      sw.append(b);
    });
    this.left.append(sw);

    this.left.append(h('div', 'ed-h', 'cage'));
    const sizeRow = h('div', 'ed-row');
    const sizeSel = h('select');
    for (const s of [8, 12, 16, 20, 24]) {
      const o = h('option', null, s + '³'); o.value = String(s);
      sizeSel.append(o);
    }
    sizeSel.value = String(Math.max(M.vox.w, M.vox.h, M.vox.d));
    sizeSel.onchange = () => {
      const n = clamp(+sizeSel.value, 1, MAX_DIM);
      this.pushModelUndo();
      M.vox = resizeVoxels(M.vox, n, n, n);
      this.buildModelScene();
    };
    sizeRow.append(sizeSel);
    this.left.append(sizeRow);

    for (const [kind, label] of [['cube', 'start: cube'], ['ball', 'start: ball'], ['box', 'start: box'], ['tree', 'start: tree'], ['pillar', 'start: pillar']]) {
      const b = h('button', 'ed-tool', label);
      b.onclick = () => {
        this.pushModelUndo();
        const n = Math.max(M.vox.w, M.vox.h, M.vox.d);
        M.vox = starterShape(kind, n, n, n);
        this.remeshModel();
      };
      this.left.append(b);
    }
    const clear = h('button', 'ed-tool', 'clear');
    clear.onclick = () => {
      this.pushModelUndo();
      M.vox = emptyVoxels(M.vox.w, M.vox.h, M.vox.d);
      this.remeshModel();
    };
    this.left.append(clear);

    const mirrorLab = h('label', 'ed-check');
    const mirrorIn = h('input'); mirrorIn.type = 'checkbox';
    mirrorIn.checked = M.mirror;
    mirrorIn.onchange = () => { M.mirror = mirrorIn.checked; };
    mirrorLab.append(mirrorIn, document.createTextNode(' mirror left/right'));
    this.left.append(mirrorLab);

    this.left.append(h('div', 'ed-h', 'behaviour'));
    const solidLab = h('label', 'ed-check');
    const solidIn = h('input'); solidIn.type = 'checkbox';
    solidIn.checked = M.solid;
    solidIn.onchange = () => { M.solid = solidIn.checked; };
    solidLab.append(solidIn, document.createTextNode(' solid'));
    this.left.append(solidLab);

    const physLab = h('label', 'ed-check');
    const physIn = h('input'); physIn.type = 'checkbox';
    physIn.checked = M.physical;
    physIn.onchange = () => { M.physical = physIn.checked; };
    physLab.append(physIn, document.createTextNode(' physical (falls, throwable)'));
    this.left.append(physLab);

    const scriptBtn = h('button', 'ed-btn ed-wide', M.script ? '✎ model script' : '+ model script');
    scriptBtn.onclick = () => this.scriptModal(
      M.script || '',
      (src) => { M.script = src || null; this.buildModellerUI(); },
      'script for every ' + (M.name || 'copy of this model'),
      () => this.buildModellerUI(),
    );
    this.left.append(scriptBtn);

    const saveBtn = h('button', 'ed-btn ed-primary ed-wide', 'save model');
    saveBtn.onclick = () => this.saveModel();
    this.left.append(saveBtn);
    const cancelBtn = h('button', 'ed-btn ed-wide', 'back to the map');
    cancelBtn.onclick = () => this.closeModeller();
    this.left.append(cancelBtn);
    this.left.append(h('div', 'ed-note', countVoxels(M.vox) + ' voxels'));
  }

  saveModel() {
    const M = this.mdl;
    const name = (M.name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (!name) { this.flash('give the model a name first'); return; }
    if (BUILTIN[name]) { this.flash('"' + name + '" is a built-in name'); return; }
    if (!countVoxels(M.vox)) { this.flash('the model is empty'); return; }
    if (name !== M.origName && this.map.models[name]) { this.flash('you already have a model called "' + name + '"'); return; }
    if (!M.origName && Object.keys(this.map.models).length >= MAX_MODELS) { this.flash('that is all the models one map can hold'); return; }

    this.pushUndo();
    if (M.origName && M.origName !== name) {
      delete this.map.models[M.origName];
      for (const o of this.map.objects) if (o.model === M.origName) o.model = name;
      // scripts that spawn the old name should follow the rename
      const re = new RegExp('\\bspawn\\s+' + M.origName + '\\b', 'gi');
      for (const o of this.map.objects) if (o.script) o.script = o.script.replace(re, 'spawn ' + name);
      for (const k of Object.keys(this.map.models)) {
        const mm = this.map.models[k];
        if (mm.script) mm.script = mm.script.replace(re, 'spawn ' + name);
      }
    }
    this.map.models[name] = {
      vox: M.vox, solid: M.solid, physical: M.physical, script: M.script || null,
    };
    this.currentModel = name;
    this.tool = 'place';
    playSound('ding');
    this.closeModeller();
    this.rebuildAll();
    this.setGhost(name);
    this.flash('saved "' + name + '" — click the ground to place it');
  }

  closeModeller() {
    this.mode = 'world';
    this.disposeModelScene();
    this.mdl = null;
    this.refreshPalette();
    this.refreshInspector();
  }

  pushModelUndo() {
    if (!this.mdl) return;
    this.mdl.undo.push(this.mdl.vox);
    if (this.mdl.undo.length > 80) this.mdl.undo.shift();
  }

  // ------------------------------------------------------------- editing
  pushUndo() {
    this.undoStack.push(JSON.stringify({
      objects: this.map.objects, models: this.map.models,
      spawn: this.map.spawn, seed: this.map.seed, terrain: this.map.terrain,
    }));
    if (this.undoStack.length > 50) this.undoStack.shift();
  }

  undo() {
    if (this.mode === 'model') {
      const prev = this.mdl.undo.pop();
      if (!prev) { this.flash('nothing to undo'); return; }
      this.mdl.vox = prev;
      this.remeshModel();
      return;
    }
    const prev = this.undoStack.pop();
    if (!prev) { this.flash('nothing to undo'); return; }
    const snap = JSON.parse(prev);
    const merged = validateMap({ ...this.map, ...snap, name: this.map.name });
    this.map = merged;
    this.spawnMarker.position.set(this.map.spawn.x, this.map.spawn.y, this.map.spawn.z);
    this.rebuildAll();
    this.refreshPalette();
    this.flash('undone');
  }

  save(loud) {
    this.map.name = (this.nameInput.value || '').trim() || 'untitled';
    const ok = saveMap(this.mapId, this.map);
    if (loud) this.flash(ok ? 'saved' : "couldn't save — the browser is out of room. share the code instead");
    else if (!ok) this.flash("couldn't save — out of browser storage");
    return ok;
  }

  flash(text) { this.status = text; this.statusT = 3.2; }

  // ------------------------------------------------------------- input
  bind() {
    const canvas = this.dom.canvas;
    this.onKeyDown = (e) => {
      const tag = document.activeElement && document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      this.keys.add(k === ' ' ? 'space' : k);
      if (this.modalOpen) {
        if (e.key === 'Escape') { this.closeModal(); const f = this.onModalClose; this.onModalClose = null; if (f) f(); }
        return;                                  // shortcuts stay out of modals
      }
      if (e.key === 'Escape') {
        if (this.mode === 'model') this.closeModeller();
        else this.exit();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); this.undo(); return; }
      if (this.mode === 'world') {
        if (k === 'delete' || k === 'backspace') {
          if (this.selected) { this.pushUndo(); this.removeSpec(this.selected); this.refreshPalette(); }
        }
        if (k === 'r' && this.selected) {
          this.selected.yaw = ((this.selected.yaw || 0) + 45) % 360;
          const ent = this.entForSpec(this.selected);
          if (ent) { ent.yaw = this.selected.yaw; ent.mesh.rotation.y = ent.yaw * DEG; }
          this.refreshInspector();
        }
        if (k === '1') { this.tool = 'place'; this.refreshPalette(); }
        if (k === '2') { this.tool = 'select'; this.refreshPalette(); }
        if (k === '3') { this.tool = 'erase'; this.refreshPalette(); }
      }
      if (k === 'space') e.preventDefault();
    };
    this.onKeyUp = (e) => {
      const k = e.key.toLowerCase();
      this.keys.delete(k === ' ' ? 'space' : k);
    };
    this.onMouseDown = (e) => {
      if (this.modalOpen) return;
      if (e.target !== canvas) return;
      if (e.button === 2 || e.button === 1) { this.dragLook = true; return; }
      if (this.mode === 'model') this.modelClick(e);
      else this.worldClick(e);
    };
    this.onMouseUp = () => { this.dragLook = false; this.dragging = null; };
    this.onMouseMove = (e) => {
      const dx = e.movementX || 0, dy = e.movementY || 0;
      this.mouse = { x: e.clientX, y: e.clientY };
      if (this.dragLook) {
        if (this.mode === 'model') {
          this.mdl.yaw -= dx * 0.007;
          this.mdl.pitch = clamp(this.mdl.pitch + dy * 0.007, -1.4, 1.4);
        } else {
          this.fly.yaw -= dx * 0.0035;
          this.fly.pitch = clamp(this.fly.pitch - dy * 0.0035, -1.45, 1.45);
        }
        return;
      }
      if (this.dragging && this.mode === 'world') this.dragMove(e);
    };
    this.onWheel = (e) => {
      if (this.modalOpen) return;
      if (this.mode === 'model') {
        this.mdl.dist = clamp(this.mdl.dist + Math.sign(e.deltaY) * 1.2, 4, 40);
      } else if (this.selected && this.keys.has('shift')) {
        this.selected.y = (this.selected.y || 0) - Math.sign(e.deltaY) * 0.5;
        const ent = this.entForSpec(this.selected);
        if (ent) { ent.y = this.selected.y; ent.mesh.position.y = ent.y; }
      } else {
        this.fly.speed = clamp(this.fly.speed - Math.sign(e.deltaY) * 4, 6, 90);
      }
    };
    this.onCtx = (e) => { if (e.target === canvas) e.preventDefault(); };
    this.onResize = () => this.view.resize();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('contextmenu', this.onCtx);
    window.addEventListener('resize', this.onResize);
  }

  unbind() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('contextmenu', this.onCtx);
    window.removeEventListener('resize', this.onResize);
  }

  ndc(e) {
    return new THREE.Vector2(
      (e.clientX / this.view.w) * 2 - 1,
      -(e.clientY / this.view.h) * 2 + 1,
    );
  }

  // where the cursor meets the world: an object's top, or the terrain
  pickWorld(e) {
    this.raycaster.setFromCamera(this.ndc(e), this.view.camera);
    this.raycaster.far = 600;
    const meshes = this.ents.map(en => en.mesh);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length) {
      let obj = hits[0].object;
      while (obj && !obj.userData.entId) obj = obj.parent;
      const ent = obj ? this.ents.find(en => en.id === obj.userData.entId) : null;
      return { point: hits[0].point, normal: hits[0].face ? hits[0].face.normal : null, ent };
    }
    // march the ray against the terrain
    const origin = this.raycaster.ray.origin.clone();
    const dir = this.raycaster.ray.direction.clone();
    let t = 0;
    let last = origin.y - this.world.heightAt(origin.x, origin.z);
    for (let i = 0; i < 340; i++) {
      t += 1.6;
      const p = origin.clone().addScaledVector(dir, t);
      const d = p.y - this.world.heightAt(p.x, p.z);
      if (d <= 0 && last > 0) {
        const hit = origin.clone().addScaledVector(dir, t - 0.8);
        hit.y = this.world.heightAt(hit.x, hit.z);
        return { point: hit, normal: new THREE.Vector3(0, 1, 0), ent: null };
      }
      last = d;
      if (t > 520) break;
    }
    return null;
  }

  worldClick(e) {
    const pick = this.pickWorld(e);
    if (this.tool === 'place') {
      if (!pick) return;
      if (this.map.objects.length >= MAX_OBJECTS) { this.flash('this map is full (' + MAX_OBJECTS + ' objects)'); return; }
      this.pushUndo();
      const p = this.snap(pick.point);
      const spec = {
        id: uid(), model: this.currentModel,
        x: p.x, y: p.y, z: p.z,
        yaw: 0, scale: 100, solid: null, physical: null, color: null, script: null,
      };
      this.map.objects.push(spec);
      const ent = this.addEnt(spec);
      this.selected = spec;
      this.selectedEnt = ent;
      playSound('pip');
      this.refreshInspector();
      this.refreshPalette();
      return;
    }
    if (this.tool === 'erase') {
      if (pick && pick.ent) {
        this.pushUndo();
        this.removeSpec(pick.ent.spec);
        playSound('thud');
        this.refreshPalette();
      }
      return;
    }
    if (this.tool === 'spawn') {
      if (!pick) return;
      this.pushUndo();
      const p = this.snap(pick.point);
      this.map.spawn = { x: p.x, y: p.y, z: p.z };
      this.spawnMarker.position.set(p.x, p.y, p.z);
      this.flash('spawn point moved here');
      return;
    }
    // select / move
    if (pick && pick.ent) {
      this.selected = pick.ent.spec;
      this.selectedEnt = pick.ent;
      this.dragging = { ent: pick.ent, started: false, grab: pick.point.clone() };
      this.refreshInspector();
    } else {
      this.selected = null;
      this.selectedEnt = null;
      this.selBox.visible = false;
      this.refreshInspector();
    }
  }

  dragMove(e) {
    const d = this.dragging;
    if (!d) return;
    const pick = this.pickWorld(e);
    if (!pick) return;
    if (!d.started) { this.pushUndo(); d.started = true; }
    const p = this.snap(pick.point);
    const spec = d.ent.spec;
    spec.x = p.x; spec.z = p.z;
    if (!this.keys.has('shift')) spec.y = p.y;
    d.ent.x = spec.x; d.ent.y = spec.y; d.ent.z = spec.z;
    d.ent.mesh.position.set(spec.x, spec.y, spec.z);
  }

  snap(point) {
    const x = Math.round(point.x / GRID) * GRID;
    const z = Math.round(point.z / GRID) * GRID;
    const y = this.flatVoid ? 0 : this.world.heightAt(x, z);
    return { x, y: Math.max(y, Math.round(point.y * 2) / 2 > y + 0.6 ? Math.round(point.y * 2) / 2 : y), z };
  }

  // ---- the modeller's click: add or carve one voxel
  modelClick(e) {
    const M = this.mdl;
    this.raycaster.setFromCamera(this.ndc(e), this.modelCam);
    const hits = this.raycaster.intersectObjects([this.mdlMesh, this.mdlFloor], true);
    if (!hits.length) return;
    const hit = hits[0];
    const n = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    const remove = this.keys.has('shift');
    const probe = hit.point.clone().addScaledVector(n, remove ? -VOXEL_UNIT * 0.5 : VOXEL_UNIT * 0.5);
    const cell = this.voxelAt(probe);
    if (!cell) return;
    this.pushModelUndo();
    M.vox = setVox(M.vox, cell.x, cell.y, cell.z, remove ? -1 : M.color);
    if (M.mirror) {
      const mx = M.vox.w - 1 - cell.x;
      M.vox = setVox(M.vox, mx, cell.y, cell.z, remove ? -1 : M.color);
    }
    this.remeshModel();
    playSound(remove ? 'thud' : 'pip');
  }

  voxelAt(p) {
    const v = this.mdl.vox;
    const ox = -(v.w * VOXEL_UNIT) / 2, oz = -(v.d * VOXEL_UNIT) / 2;
    const x = Math.floor((p.x - ox) / VOXEL_UNIT);
    const y = Math.floor(p.y / VOXEL_UNIT);
    const z = Math.floor((p.z - oz) / VOXEL_UNIT);
    if (x < 0 || y < 0 || z < 0 || x >= v.w || y >= v.h || z >= v.d) return null;
    return { x, y, z };
  }

  updateModelCursor() {
    if (!this.mouse || !this.mdlCursor) return;
    this.raycaster.setFromCamera(
      new THREE.Vector2((this.mouse.x / this.view.w) * 2 - 1, -(this.mouse.y / this.view.h) * 2 + 1),
      this.modelCam,
    );
    const hits = this.raycaster.intersectObjects([this.mdlMesh, this.mdlFloor], true);
    if (!hits.length) { this.mdlCursor.visible = false; return; }
    const hit = hits[0];
    const n = hit.face ? hit.face.normal.clone() : new THREE.Vector3(0, 1, 0);
    const remove = this.keys.has('shift');
    const probe = hit.point.clone().addScaledVector(n, remove ? -VOXEL_UNIT * 0.5 : VOXEL_UNIT * 0.5);
    const cell = this.voxelAt(probe);
    if (!cell) { this.mdlCursor.visible = false; return; }
    const v = this.mdl.vox;
    const ox = -(v.w * VOXEL_UNIT) / 2, oz = -(v.d * VOXEL_UNIT) / 2;
    this.mdlCursor.visible = true;
    this.mdlCursor.position.set(
      ox + (cell.x + 0.5) * VOXEL_UNIT,
      (cell.y + 0.5) * VOXEL_UNIT,
      oz + (cell.z + 0.5) * VOXEL_UNIT,
    );
    this.mdlCursor.material.color.setHex(remove ? 0xc4685c : 0x5f89bd);
  }

  // ------------------------------------------------------------- loop
  frame() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.raf = requestAnimationFrame(() => this.frame());

    if (this.mode === 'model') {
      this.frameModel(dt);
      return;
    }

    // fly the camera
    const f = this.fly;
    const sp = f.speed * (this.keys.has('shift') ? 2.4 : 1) * dt;
    const cp = Math.cos(f.pitch);
    const fwd = new THREE.Vector3(Math.sin(f.yaw) * cp, Math.sin(f.pitch), Math.cos(f.yaw) * cp);
    const right = new THREE.Vector3(Math.cos(f.yaw), 0, -Math.sin(f.yaw));
    if (!this.modalOpen) {
      if (this.keys.has('w')) f.pos.addScaledVector(fwd, sp);
      if (this.keys.has('s')) f.pos.addScaledVector(fwd, -sp);
      if (this.keys.has('d')) f.pos.addScaledVector(right, sp);
      if (this.keys.has('a')) f.pos.addScaledVector(right, -sp);
      if (this.keys.has('e') || this.keys.has('space')) f.pos.y += sp;
      if (this.keys.has('q')) f.pos.y -= sp;
    }
    f.pos.y = clamp(f.pos.y, this.world.heightAt(f.pos.x, f.pos.z) + 1.2, 700);

    this.view.scene = this.worldScene;
    this.view.flyCamera(f.pos, f.yaw, f.pitch);
    this.terrain.update(f.pos.x, f.pos.z, dt);
    const look = BIOMES[this.world.biomeAt(f.pos.x, f.pos.z)] || BIOMES.void;
    this.view.setBiomeLook(look.fog, 0xffffff);
    this.view.setFogRange(220, 520);

    // the ghost of what you're about to place
    if (this.ghost) {
      if (this.tool === 'place' && this.mouse && !this.modalOpen) {
        const pick = this.pickWorld({ clientX: this.mouse.x, clientY: this.mouse.y });
        if (pick) {
          const p = this.snap(pick.point);
          this.ghost.visible = true;
          this.ghost.position.set(p.x, p.y, p.z);
        } else this.ghost.visible = false;
      } else this.ghost.visible = false;
    }

    // selection outline
    if (this.selectedEnt) {
      const b = entAABB(this.selectedEnt);
      this.selBox.box.min.set(b.x0, b.y0, b.z0);
      this.selBox.box.max.set(b.x1, b.y1, b.z1);
      this.selBox.visible = true;
    } else this.selBox.visible = false;

    // spin markers so they read as UI, not scenery
    this.spawnMarker.rotation.y += dt * 0.9;

    this.statusTick(dt);
    this.hintEl.textContent = 'right-drag look · wasd fly · q/e down/up · 1 place · 2 select · 3 erase · r turn · shift+wheel lift · ctrl+z undo · esc leave';
    this.view.render();
  }

  frameModel(dt) {
    const M = this.mdl;
    const cp = Math.cos(M.pitch);
    this.modelCam.aspect = this.view.rw / this.view.rh;
    this.modelCam.updateProjectionMatrix();
    this.modelCam.position.set(
      Math.sin(M.yaw) * cp * M.dist,
      Math.sin(M.pitch) * M.dist + M.vox.h * VOXEL_UNIT * 0.5,
      Math.cos(M.yaw) * cp * M.dist,
    );
    this.modelCam.lookAt(0, M.vox.h * VOXEL_UNIT * 0.45, 0);
    if (!this.modalOpen) {
      if (this.keys.has('arrowleft')) M.yaw -= dt * 1.4;
      if (this.keys.has('arrowright')) M.yaw += dt * 1.4;
    }
    this.updateModelCursor();
    this.statusTick(dt);
    this.hintEl.textContent = 'click a face to add · shift+click to carve · right-drag to spin · wheel to zoom · ctrl+z undo · esc back';
    this.view.scene = this.modelScene;
    const cam = this.view.camera;
    this.view.camera = this.modelCam;
    this.view.render();
    this.view.camera = cam;
  }

  statusTick(dt) {
    if (this.statusT > 0) {
      this.statusT -= dt;
      this.statusEl.textContent = this.status;
      this.statusEl.style.opacity = String(clamp(this.statusT, 0, 1));
    } else if (this.statusEl.textContent) {
      this.statusEl.textContent = '';
    }
  }

  // ------------------------------------------------------------- teardown
  teardown() {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.unbind();
    this.closeModal();
    this.disposeModelScene();
    for (const ent of this.ents) {
      this.worldScene.remove(ent.mesh);
      ent.mesh.traverse(o => { if (o.isMesh && o.geometry && !o.geometry.__shared) o.geometry.dispose(); });
    }
    this.ents = [];
    if (this.ghost) this.worldScene.remove(this.ghost);
    this.terrain.dispose();
    this.view.scene = this.worldScene;
    this.view.dispose();
    this.root.style.display = 'none';
    this.root.innerHTML = '';
  }

  exit() {
    if (!this.running) return;
    this.save();
    this.teardown();
    this.onExit();
  }
}
