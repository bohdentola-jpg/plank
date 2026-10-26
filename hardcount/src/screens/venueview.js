// QA: a venue on its own, through the TV.
//   ?screen=venueview&venue=friday&time=night&weather=clear&field=sevens&cam=broadcast&los=-15&fd=-5
//   cam: broadcast | endzone | sideline | aerial | low | scoreboard | crowd | orbit
//   extra: home= away= (team ids)  crowd=0..1  wind=0..1  quality=high|low  dir=1|-1
//          exc=0..1  react=cheer|roar|boo|groan|tension  flash=rate  hud=0  t=seconds (orbit angle)
// QA hook: window.__venueview = { venue, camera, stats, setCam(name) }
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { buildVenue, VENUES } from '../gfx/stadium/index.js';
import { makeField } from '../sim/field.js';
import { TEAMS, getTeam } from '../data/teams.js';
import { vText, text, C } from '../core/ui.js';

registerScreen('venueview', () => {
  let venue = null, label = 'LOADING', stats = null, t = 0, frame = 0;
  const camera = new THREE.PerspectiveCamera(45, 4 / 3, 0.1, 3000);
  const figures = new THREE.Group();
  let cfg = {};

  const num = (v, d) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? d : Number(v));

  function placeCam(name) {
    const f = venue.field;
    const dir = cfg.dir;
    const los = Number.isFinite(cfg.los) ? cfg.los : -10 * dir;
    camera.fov = 45;
    const V = venue.cams || {};
    const look = new THREE.Vector3();
    switch (name) {
      case 'endzone':
        camera.position.set(0, 24, -dir * (f.end + 26));
        look.set(0, 0, dir * 6);
        break;
      case 'sideline':
        camera.fov = 38;
        camera.position.set(-(f.halfW + 34), 19, los + dir * 3);
        look.set(0, 0, los + dir * 3);
        break;
      case 'aerial':
        camera.position.set(70, 135, -110);
        look.set(0, 0, 0);
        break;
      case 'low':
        camera.fov = 58;
        camera.position.set(3.2, 0.75, los - dir * 3.5);
        look.set(-1.5, 0.35, los + dir * 6);
        break;
      case 'scoreboard':
        if (V.scoreboard) { camera.position.copy(V.scoreboard.pos); look.copy(V.scoreboard.target); }
        else { camera.position.set(0, 6, f.end - 6); look.set(0, 14, f.end + 40); }
        break;
      case 'crowd':
        if (V.crowd) { camera.position.copy(V.crowd.pos); look.copy(V.crowd.target); }
        else { camera.position.set(f.halfW + 3, 2.5, 6); look.set(f.halfW + 30, 10, 18); }
        break;
      case 'orbit': {
        const a = t * 0.12 + 0.6;
        camera.position.set(Math.sin(a) * 165, 62, Math.cos(a) * 165);
        look.set(0, 4, 0);
        break;
      }
      default:
        // the game's main camera: behind the offence, ~14 yd up, ~22 yd back, looking downfield
        camera.position.set(0, 14, los - dir * 22);
        look.set(0, 0, los + dir * 10);
    }
    camera.updateProjectionMatrix();
    camera.lookAt(look);
  }

  function lineup(los, dir, off, def) {
    figures.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
    figures.clear();
    const cap = new THREE.CapsuleGeometry(0.32, 1.15, 4, 10);
    cap.translate(0, 0.9, 0);
    const head = new THREE.SphereGeometry(0.27, 14, 10);
    head.translate(0, 1.72, 0);
    const kitO = off.uniform.home, kitD = def.uniform.away;
    const hw = venue.field.halfW;
    const O = [[0, -0.6], [-1.1, -0.7], [1.1, -0.7], [0, -5], [-1.4, -6.5], [-(hw - 4), -0.8], [hw - 7, -1.2]];
    const D = [[-1.4, 1.0], [1.4, 1.0], [-3.2, 4.5], [3.4, 4.8], [-(hw - 4.5), 6], [hw - 7, 5.5], [0.5, 11]];
    const bodies = new THREE.InstancedMesh(cap, new THREE.MeshStandardMaterial({ roughness: 0.6 }), 14);
    const heads = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.2 }), 14);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    [...O.map((p) => [p, off, kitO]), ...D.map((p) => [p, def, kitD])].forEach(([[x, dz], team, kit], i) => {
      m.makeTranslation(x, 0, los + dz * dir);
      bodies.setMatrixAt(i, m); heads.setMatrixAt(i, m);
      bodies.setColorAt(i, c.set(kit.jersey)); heads.setColorAt(i, c.set(team.helmet.shell));
    });
    bodies.castShadow = heads.castShadow = true;
    figures.add(bodies, heads);
  }

  function measure() {
    const r = game.renderer, gl = r.gl;
    const prev = gl.getRenderTarget();
    gl.info.autoReset = false;
    gl.info.reset();
    gl.setRenderTarget(r.targets.scene);
    const vis = figures.visible;
    figures.visible = false;           // the venue's own cost, without the QA capsules
    gl.render(venue.scene, camera);
    figures.visible = vis;
    stats = {
      calls: gl.info.render.calls, triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries, textures: gl.info.memory.textures,
      programs: gl.info.programs?.length || 0, crowd: venue.crowdCount,
    };
    gl.info.autoReset = true;
    gl.setRenderTarget(prev);
    return stats;
  }

  return {
    async enter(params) {
      const q = params || {};
      const def = VENUES.find((v) => v.id === q.venue) || VENUES[0];
      const home = q.home ? getTeam(q.home) : (TEAMS.find((tm) => tm.venue === def.id) || TEAMS[0]);
      const away = q.away ? getTeam(q.away) : (TEAMS.find((tm) => tm.id !== home.id) || TEAMS[1]);
      cfg = {
        dir: num(q.dir, 1) >= 0 ? 1 : -1,
        los: q.los !== undefined ? num(q.los, NaN) : NaN,
        fd: q.fd !== undefined ? num(q.fd, NaN) : NaN,
        cam: q.cam || 'broadcast',
        exc: num(q.exc, 0.35), react: q.react || null, flash: num(q.flash, 0),
        hud: q.hud !== '0',
      };
      t = num(q.t, 0);
      label = 'BUILDING';
      const t0 = performance.now();
      venue = await buildVenue(game.renderer.gl, {
        venue: def.id, field: makeField(q.field === 'full' ? 'full' : 'sevens'), home, away,
        time: q.time, weather: q.weather, wind: num(q.wind, 0.35), crowd: num(q.crowd, 0.9), quality: q.quality === 'low' ? 'low' : 'high',
      });
      const buildMs = Math.round(performance.now() - t0);
      venue.scene.add(figures);
      const los = Number.isFinite(cfg.los) ? cfg.los : -10 * cfg.dir;
      lineup(los, cfg.dir, home, away);
      if (Number.isFinite(cfg.los) || Number.isFinite(cfg.fd)) {
        venue.setMarkers({ los, firstDown: Number.isFinite(cfg.fd) ? cfg.fd : los + 10 * cfg.dir, dir: cfg.dir, show: true });
      }
      venue.setScoreboard({
        home: { abbr: home.abbr, score: 14, timeouts: 2 }, away: { abbr: away.abbr, score: 10, timeouts: 3 },
        quarter: 2, clock: '4:32', playClock: 18, down: 3, toGo: 7, ballOn: 35, possession: 'home', msg: q.msg || null,
      });
      venue.focusShadow(0, los + 4 * cfg.dir, 30);
      venue.flashes(cfg.flash);
      game.renderer.setPost(venue.post, true);
      placeCam(cfg.cam);
      venue.update(0.016, { camera, time: t, excitement: cfg.exc, reaction: cfg.react, homeHasBall: true, ball: { x: 0, y: 1, z: los } });
      measure();
      stats.buildMs = buildMs;
      label = 'READY';
      window.__venueview = {
        venue, camera, get stats() { return measure(); },
        setCam(name) { cfg.cam = name; placeCam(name); },
      };
    },
    exit() {
      venue?.dispose();
      venue = null;
      figures.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
    },
    update(dt) {
      if (!venue) return;
      t += dt;
      frame++;
      if (cfg.cam === 'orbit') placeCam('orbit');
      venue.update(dt, {
        camera, time: t, excitement: cfg.exc, reaction: cfg.react, homeHasBall: true,
        ball: { x: 0, y: 1, z: Number.isFinite(cfg.los) ? cfg.los : 0 },
      });
      if (frame % 120 === 0) { const b = stats?.buildMs; measure(); stats.buildMs = b; }
    },
    view() { return label === 'READY' ? { scene: venue.scene, camera } : null; },
    draw(ctx) {
      if (label !== 'READY') {
        vText(ctx, 'PLEASE STAND BY', 512, 380, 30, { align: 'center' });
        text(ctx, label, 512, 410, { align: 'center', color: C.dim });
        return;
      }
      if (!cfg.hud || !stats) return;
      const v = venue.def;
      text(ctx, `${v.name.toUpperCase()} · ${venue.time.toUpperCase()} · ${venue.weather.toUpperCase()} · CAM ${cfg.cam.toUpperCase()}`, 40, 40, { size: 13, color: '#d8ffd8', font: '"Consolas", monospace', weight: 700 });
      text(ctx, `CALLS ${stats.calls}  TRIS ${(stats.triangles / 1000).toFixed(1)}K  FANS ${stats.crowd}  GEOS ${stats.geometries}  TEX ${stats.textures}  BUILD ${stats.buildMs}MS  FPS ${Math.round(game.fps || 0)}`, 40, 58, { size: 12, color: '#a8c8a8', font: '"Consolas", monospace', weight: 700 });
    },
  };
});
