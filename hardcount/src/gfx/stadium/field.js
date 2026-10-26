// The playing surface as geometry: the painted tiles (paint.js), the apron
// out to the walls, a shader layer for close-up grass/turf detail and the
// wet/mud/snow roughness, the goalposts (yellow goosenecks, padded, wind
// flags on the uprights), the eight pylons, and the broadcast lines (blue
// line of scrimmage, yellow line to gain) that sit on the grass under the players.
import * as THREE from 'three';
import { GeoBuilder } from '../geo.js';
import { paintField, apronCanvas } from './paint.js';
import { grassDetail, tex } from './tex.js';
import { poolPatch } from './kit.js';

const _m = new THREE.Matrix4();

/** MeshStandardMaterial + world-space detail texture and roughness map. */
export function surfaceMaterial(map, shared, opts = {}) {
  const m = new THREE.MeshStandardMaterial({
    map, roughness: 1, metalness: 0, envMapIntensity: shared.envI ?? 0.6,
    polygonOffset: !!opts.offset, polygonOffsetFactor: opts.offset || 0, polygonOffsetUnits: opts.offset || 0,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = shared.tDetail;
    sh.uniforms.tRough = shared.tRough;
    sh.uniforms.uExt = shared.uExt;
    sh.uniforms.uDetail = shared.uDetail;
    if (shared.uPool) poolPatch(sh, { uPool: shared.uPool });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nuniform sampler2D tDetail;\nuniform sampler2D tRough;\nuniform vec4 uExt;\nuniform float uDetail;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          float d1 = texture2D(tDetail, vWP.xz * 0.43).r;
          float d2 = texture2D(tDetail, vWP.xz * 0.117 + vec2(0.31, 0.77)).r;
          float dd = d1 * 0.62 + d2 * 0.38;
          float dist = length(cameraPosition - vWP);
          float k = uDetail * (1.0 - 0.55 * smoothstep(20.0, 90.0, dist));
          diffuseColor.rgb *= 1.0 + (dd - 0.47) * 1.15 * k;
        }`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness * texture2D(tRough, clamp((vWP.xz - uExt.xy) * uExt.zw, 0.001, 0.999)).g;`);
  };
  m.customProgramCacheKey = () => 'hc-surface' + (opts.offset ? 'o' : '');
  return m;
}

/**
 * Build the field.
 * ctx: { field, quality, aniso, paint (paintField opts), weather, wind, windDir, padColor, flagColor, apronCanvas? }
 */
export function buildField(ctx) {
  const { field } = ctx;
  const group = new THREE.Group();
  group.name = 'field';
  const P = paintField(field, { ...ctx.paint, quality: ctx.quality, weather: ctx.weather });
  const aniso = ctx.aniso || 8;
  const roughTex = tex(P.rough, { srgb: false, repeat: false, aniso: 4 });
  const turf = ctx.paint.surface === 'turf';
  const shared = {
    tDetail: { value: grassDetail(turf ? 'turf' : 'grass') },
    tRough: { value: roughTex },
    uExt: { value: new THREE.Vector4(P.x0, P.z0, 1 / (P.x1 - P.x0), 1 / (P.z1 - P.z0)) },
    uDetail: { value: ctx.weather === 'snow' ? 0.35 : 0.8 },
    envI: ctx.weather === 'rain' ? 0.75 : 0.5,
    uPool: ctx.uPool,
  };
  const mats = [];
  // painted tiles
  for (const t of P.tiles) {
    const map = tex(t.canvas, { repeat: false, aniso });
    map.wrapS = map.wrapT = THREE.ClampToEdgeWrapping;
    const mat = surfaceMaterial(map, shared);
    mats.push(mat);
    const w = P.x1 - P.x0, h = t.z1 - t.z0;
    const g = new THREE.PlaneGeometry(w, h);
    g.rotateX(-Math.PI / 2);
    g.translate((P.x0 + P.x1) / 2, 0, (t.z0 + t.z1) / 2);
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true;
    mesh.name = 'fieldTile';
    group.add(mesh);
  }
  // apron: a ring of ground around the tiles out to `ctx.apron` yd
  const R = ctx.apron || 120;
  const ac = ctx.apronCanvas || apronCanvas(ctx.paint);
  const amap = tex(ac, { aniso });
  const amat = surfaceMaterial(amap, shared);
  amat.map.repeat.set(1 / 8, 1 / 8);
  mats.push(amat);
  const gb = new GeoBuilder();
  const V = (x, z) => new THREE.Vector3(x, 0, z);
  const rect = (x0, z0, x1, z1) => gb.quad(V(x0, z1), V(x1, z1), V(x1, z0), V(x0, z0), [x0, -z1, x1, -z0]);
  rect(-R, P.z1, R, R);
  rect(-R, -R, R, P.z0);
  rect(-R, P.z0, P.x0, P.z1);
  rect(P.x1, P.z0, R, P.z1);
  const apron = new THREE.Mesh(gb.build(), amat);
  apron.receiveShadow = true;
  apron.name = 'apron';
  if (ctx.apronVisible !== false) group.add(apron);

  // ---- goalposts, padding, flags, pylons
  const posts = goalposts(field, ctx);
  group.add(posts.group);
  const pyl = pylons(field);
  group.add(pyl);

  // ---- broadcast lines
  const lineGeo = new THREE.PlaneGeometry(2 * field.halfW, 1);
  lineGeo.rotateX(-Math.PI / 2);
  const mkLine = (color, width) => {
    const m = new THREE.Mesh(lineGeo, new THREE.MeshBasicMaterial({
      color, transparent: true, opacity: 0.88, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6,
    }));
    m.scale.z = width;
    m.position.y = 0.012;
    m.renderOrder = 2;
    m.visible = false;
    group.add(m);
    return m;
  };
  const losLine = mkLine(new THREE.Color(0.12, 0.38, 1.6), 0.16);
  const fdLine = mkLine(new THREE.Color(1.5, 1.12, 0.05), 0.2);
  // yellow line clone (separate geometry scale) is fine: both reference lineGeo

  return {
    group, paint: P, shared, materials: mats,
    flags: posts.flags,
    setLines({ los, firstDown, show }) {
      const on = show !== false;
      losLine.visible = on && Number.isFinite(los);
      fdLine.visible = on && Number.isFinite(firstDown) && Math.abs(firstDown) < field.halfL + 0.01;
      if (losLine.visible) losLine.position.z = los;
      if (fdLine.visible) fdLine.position.z = firstDown;
    },
    update(dt, t, wind) {
      const u = posts.flagUniforms;
      u.uTime.value = t;
      u.uWind.value += (wind - u.uWind.value) * Math.min(1, dt * 2);
    },
  };
}

// ------------------------------------------------------------------ goalposts

function goalposts(field, ctx) {
  const group = new THREE.Group();
  const gp = field.goalpost;
  const yellow = new GeoBuilder();
  const pad = new GeoBuilder();
  const back = 2.0;                 // the base stands 2 yd behind the end line
  for (const s of [-1, 1]) {
    const zl = s * (field.end + gp.offset);
    const zb = zl + s * back;
    // gooseneck: up from the base, curving forward to the crossbar
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, zb),
      new THREE.Vector3(0, gp.crossbar * 0.95, zb),
      new THREE.Vector3(0, gp.crossbar, zb - s * back * 0.25),
      new THREE.Vector3(0, gp.crossbar, zl),
    );
    const tube = new THREE.TubeGeometry(curve, 16, 0.11, 10, false);
    yellow.geometry(tube, _m.identity());
    tube.dispose();
    // crossbar
    const bar = new THREE.CylinderGeometry(0.075, 0.075, gp.width + 0.1, 10, 1, true);
    bar.rotateZ(Math.PI / 2);
    yellow.geometry(bar, _m.makeTranslation(0, gp.crossbar, zl));
    bar.dispose();
    // elbow fill where the neck meets the bar
    const ball = new THREE.SphereGeometry(0.12, 10, 8);
    yellow.geometry(ball, _m.makeTranslation(0, gp.crossbar, zl));
    ball.dispose();
    // uprights
    for (const sx of [-1, 1]) {
      const up = new THREE.CylinderGeometry(0.06, 0.07, gp.top - gp.crossbar, 10, 1, true);
      yellow.geometry(up, _m.makeTranslation(sx * gp.width / 2, (gp.top + gp.crossbar) / 2, zl));
      up.dispose();
      const cap = new THREE.SphereGeometry(0.075, 8, 6);
      yellow.geometry(cap, _m.makeTranslation(sx * gp.width / 2, gp.crossbar, zl));
      cap.dispose();
    }
    // padding wrapped around the base
    const pg = new THREE.CylinderGeometry(0.33, 0.33, 2.0, 14, 1, false);
    pad.geometry(pg, _m.makeTranslation(0, 1.0, zb));
    pg.dispose();
  }
  const yMat = new THREE.MeshStandardMaterial({ color: new THREE.Color('#f2c80a'), roughness: 0.38, metalness: 0.25, emissive: new THREE.Color('#3a2a00'), envMapIntensity: 1.2 });
  const posts = new THREE.Mesh(yellow.build(), yMat);
  posts.castShadow = true;
  posts.receiveShadow = true;
  group.add(posts);
  const pMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(ctx.padColor || '#1a3a7a'), roughness: 0.7 });
  const padM = new THREE.Mesh(pad.build(), pMat);
  padM.castShadow = true;
  group.add(padM);

  // wind flags on top of the uprights: ribbons animated in the vertex shader
  const flagLen = 1.1, flagW = 0.16, seg = 10;
  const fp = [], fn = [], fuv = [], ft = [], fa = [], idx = [];
  let base = 0;
  let k = 0;
  for (const s of [-1, 1]) {
    for (const sx of [-1, 1]) {
      const ax = sx * gp.width / 2, ay = gp.top + 0.05, az = s * (field.end + gp.offset);
      for (let i = 0; i <= seg; i++) {
        for (let j = 0; j < 2; j++) {
          fp.push(ax, ay, az);
          fn.push(0, 0, 1);
          fuv.push(i / seg, j);
          ft.push(i / seg, j * 2 - 1, k * 1.7, 0);
          fa.push(ax, ay, az);
        }
      }
      for (let i = 0; i < seg; i++) {
        const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
        idx.push(a, c, b, b, c, d);
      }
      base += (seg + 1) * 2;
      k++;
    }
  }
  const fg = new THREE.BufferGeometry();
  fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  fg.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
  fg.setAttribute('uv', new THREE.Float32BufferAttribute(fuv, 2));
  fg.setAttribute('aFlag', new THREE.Float32BufferAttribute(ft, 4));
  fg.setIndex(idx);
  const flagUniforms = {
    uTime: { value: 0 },
    uWind: { value: ctx.wind ?? 0.3 },
    uWindDir: { value: new THREE.Vector2(Math.cos(ctx.windDir ?? 0.6), Math.sin(ctx.windDir ?? 0.6)) },
    uLen: { value: flagLen },
    uHalfW: { value: flagW / 2 },
  };
  const fMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(ctx.flagColor || '#ff5a12'), roughness: 0.8, side: THREE.DoubleSide, emissive: new THREE.Color(ctx.flagColor || '#ff5a12').multiplyScalar(0.12) });
  fMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, flagUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aFlag;
        uniform float uTime, uWind, uLen, uHalfW;
        uniform vec2 uWindDir;
        vec3 flagPos(float t, float side) {
          float w = clamp(uWind, 0.0, 1.0);
          // calm: the ribbon hangs; windy: it streams out and flaps
          float droop = mix(1.35, 0.12, sqrt(w));
          float ph = aFlag.z;
          vec3 dir = normalize(vec3(uWindDir.x, 0.0, uWindDir.y));
          vec3 sideV = normalize(cross(dir, vec3(0.0, 1.0, 0.0)));
          float along = t * uLen;
          float sag = along * sin(droop) + t * t * 0.25 * (1.0 - w);
          float flap = sin(t * 6.5 - uTime * (4.0 + 11.0 * w) + ph) * (0.05 + 0.16 * w) * t;
          float flutter = sin(t * 13.0 - uTime * (9.0 + 14.0 * w) + ph * 2.0) * 0.03 * w * t;
          vec3 p = dir * along * cos(droop) - vec3(0.0, sag, 0.0) + sideV * (flap + flutter);
          // the ribbon's width is vertical-ish near the pole, twists with the flap
          p += vec3(0.0, 1.0, 0.0) * side * uHalfW * (1.0 - 0.4 * t) + sideV * side * uHalfW * 0.3 * sin(uTime * 3.0 + ph + t * 4.0);
          return p;
        }`)
      .replace('#include <beginnormal_vertex>', `
        vec3 fa = flagPos(aFlag.x, aFlag.y);
        vec3 fb = flagPos(min(1.0, aFlag.x + 0.05), aFlag.y);
        vec3 fc = flagPos(aFlag.x, aFlag.y + 0.2);
        vec3 objectNormal = normalize(cross(fb - fa, fc - fa + vec3(0.0, 1e-4, 0.0)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(1.0, 0.0, 0.0);
        #endif`)
      .replace('#include <begin_vertex>', 'vec3 transformed = position + fa;');
  };
  fMat.customProgramCacheKey = () => 'hc-flag';
  const flags = new THREE.Mesh(fg, fMat);
  flags.frustumCulled = false;
  group.add(flags);
  return { group, flags, flagUniforms };
}

function pylons(field) {
  const gb = new GeoBuilder();
  const [w, h] = field.pylonSize;
  const xs = field.halfW + field.lineWidth / 2;
  for (const sx of [-1, 1]) {
    for (const z of [field.halfL, field.end, -field.halfL, -field.end]) {
      gb.box(sx * xs, 0, z, w, h, w, 0, { uFit: true });
    }
  }
  const m = new THREE.Mesh(gb.build(), new THREE.MeshStandardMaterial({
    color: new THREE.Color('#ff5a0a'), roughness: 0.55, emissive: new THREE.Color('#ff3a00'), emissiveIntensity: 0.35,
  }));
  m.castShadow = true;
  m.name = 'pylons';
  return m;
}
