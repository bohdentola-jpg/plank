// Small props you can pick up: battery packs, the lantern, and the comfort
// items that make your hiding spot feel like yours.
import * as THREE from 'three';
import { signTexture } from './textures.js';

const std = (o) => new THREE.MeshStandardMaterial(o);

export const COMFORT = {
  pillow: { name: 'pillow', msg: 'softer now.' },
  teddy: { name: 'teddy bear', msg: 'he can keep watch.' },
  lights: { name: 'string lights', msg: 'a little warmer.' },
  thermos: { name: 'thermos of cocoa', msg: 'still warm.' },
  comic: { name: 'comic book', msg: 'something to hold onto.' },
};

export function makeProps(T, cfg) {
  const shadows = cfg.shadows;
  const cast = (o) => {
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = shadows;
        m.receiveShadow = shadows;
      }
    });
    return o;
  };

  const cardTex = signTexture([{ text: 'VOLTA', size: 0.26 }, { text: 'AA · 4 PACK', size: 0.12 }, { text: 'LONG LASTING', size: 0.08 }], { w: 128, h: 192, bg: '#e8a21b', fg: '#1a1208' });
  const cardMat = std({ map: cardTex, roughness: 0.35, emissive: new THREE.Color(0x2a1a00), emissiveIntensity: 0.4 });
  const cellMat = std({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.6 });
  const tipMat = std({ color: 0xb87333, roughness: 0.3, metalness: 1 });
  const blisterMat = std({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.25 });

  const battery = () => {
    const outer = new THREE.Group();
    const g = new THREE.Group();
    outer.add(g);
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.16, 0.006), cardMat);
    card.position.y = 0.08;
    g.add(card);
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0075, 0.05, 10), cellMat);
      c.position.set(-0.03 + i * 0.02, 0.06, 0.01);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 8), tipMat);
      t.position.set(-0.03 + i * 0.02, 0.087, 0.01);
      g.add(c, t);
    }
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.095, 0.065, 0.02), blisterMat);
    bl.position.set(0, 0.06, 0.011);
    g.add(bl);
    g.rotation.x = -0.14;
    return cast(outer);
  };

  const lantern = () => {
    const g = new THREE.Group();
    const plastic = std({ color: 0x24402c, roughness: 0.5 });
    const globeMat = new THREE.MeshStandardMaterial({ color: 0xfff0d8, emissive: new THREE.Color(0xffb35c), emissiveIntensity: 2.5, roughness: 0.3, transparent: true, opacity: 0.95 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.06, 18), plastic);
    base.position.y = 0.03;
    const globe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.12, 18, 1, true), globeMat);
    globe.position.y = 0.12;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.1, 8), globeMat);
    core.position.y = 0.12;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.03, 18), plastic);
    cap.position.y = 0.195;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 6, 16, Math.PI), plastic);
    handle.position.y = 0.21;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.012, 8), std({ color: 0x888888, metalness: 0.8, roughness: 0.3 }));
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.07, 0.03, 0);
    g.add(base, globe, core, cap, handle, knob);
    cast(g);
    globe.castShadow = false;
    core.castShadow = false;
    return { group: g, globeMat };
  };

  const pillow = () => {
    const geo = new THREE.BoxGeometry(0.5, 0.12, 0.34, 8, 3, 6);
    const p = geo.attributes.position, v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const k = (1 - Math.pow(Math.abs(v.x) / 0.25, 2)) * (1 - Math.pow(Math.abs(v.z) / 0.17, 2));
      v.y *= 0.35 + 0.65 * Math.max(0, k);
      p.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, std({ color: 0xd9cdb8, roughness: 0.95, normalMap: T.tartan.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }));
    m.position.y = 0.06;
    const g = new THREE.Group();
    g.add(m);
    return cast(g);
  };

  const teddy = () => {
    const g = new THREE.Group();
    const fur = std({ color: 0x7a5232, roughness: 1, normalMap: T.tartan.normalMap, normalScale: new THREE.Vector2(0.6, 0.6) });
    const muzzle = std({ color: 0xc8a37a, roughness: 1 });
    const eye = std({ color: 0x050505, roughness: 0.1 });
    const s = (r, x, y, z, sx = 1, sy = 1, sz = 1, mat = fur) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      g.add(m);
      return m;
    };
    s(0.07, 0, 0.08, 0, 1, 1.15, 0.9);
    s(0.055, 0, 0.19, 0.01);
    s(0.022, -0.04, 0.235, 0);
    s(0.022, 0.04, 0.235, 0);
    s(0.024, 0, 0.18, 0.05, 1, 0.8, 0.8, muzzle);
    s(0.008, 0, 0.19, 0.072, 1, 1, 1, eye);
    s(0.007, -0.02, 0.205, 0.05, 1, 1, 1, eye);
    s(0.007, 0.02, 0.205, 0.05, 1, 1, 1, eye);
    s(0.025, -0.07, 0.1, 0.02, 0.8, 1.6, 0.8);
    s(0.025, 0.07, 0.1, 0.02, 0.8, 1.6, 0.8);
    s(0.03, -0.04, 0.02, 0.05, 0.9, 0.8, 1.5);
    s(0.03, 0.04, 0.02, 0.05, 0.9, 0.8, 1.5);
    return cast(g);
  };

  const bulbCols = [0xffb15c, 0xff8a3d, 0xffd27a, 0xff6a4a, 0xffe2a8];
  const bulbMats = bulbCols.map((c) => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: new THREE.Color(c), emissiveIntensity: 2.2 }));
  const wireMat = std({ color: 0x1f2a1f, roughness: 0.6 });
  const stringLights = (strung) => {
    const g = new THREE.Group();
    const pts = [];
    if (strung) {
      // draped along the roof edge of the spot (local z from -0.7 to 0.7)
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        pts.push(new THREE.Vector3(Math.sin(t * 9) * 0.02, -Math.sin(t * Math.PI * 3) * 0.04 - 0.02, -0.68 + t * 1.36));
      }
    } else {
      for (let i = 0; i <= 60; i++) {
        const a = i * 0.55;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.07, 0.01 + i * 0.0012, Math.sin(a) * 0.07));
      }
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, strung ? 60 : 120, 0.0025, 4), wireMat));
    const n = strung ? 16 : 14;
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), bulbMats[i % bulbMats.length]);
      b.position.copy(curve.getPoint((i + 0.5) / n));
      b.scale.y = 1.4;
      g.add(b);
    }
    return g;
  };

  const thermos = () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 18), std({ color: 0x8e2a22, roughness: 0.35, metalness: 0.3 }));
    body.position.y = 0.12;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.06, 18), std({ color: 0x9aa0a4, roughness: 0.25, metalness: 0.9 }));
    cap.position.y = 0.27;
    g.add(body, cap);
    return cast(g);
  };

  const comicTex = signTexture([{ text: 'NIGHT', size: 0.2 }, { text: 'RANGERS', size: 0.2 }, { text: '#12', size: 0.1 }], { w: 128, h: 192, bg: '#2b5fa8', fg: '#ffe14a', weight: '900', font: 'Impact' });
  const comic = () => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.006, 0.26), [
      std({ color: 0xeeeeee }), std({ color: 0xeeeeee }), std({ map: comicTex, roughness: 0.6 }), std({ color: 0xeeeeee }), std({ color: 0xeeeeee }), std({ color: 0xeeeeee }),
    ]);
    m.position.y = 0.003;
    g.add(m);
    g.rotation.y = 0.4;
    return cast(g);
  };

  return { battery, lantern, pillow, teddy, stringLights, thermos, comic, bulbMats };
}
