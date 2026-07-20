// Parametric high-school architecture: three styles, wings, gym, signage,
// flagpole, buses. Front of the school faces +Z. Units are yards.
import * as THREE from 'three';
import { mkCanvas, tex, brickCanvas, concreteCanvas, asphaltCanvas, shade, contrastText } from './textures.js';

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function windowCanvas(lit) {
  const cv = mkCanvas(64, 96);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#e8e6dd';
  ctx.fillRect(0, 0, 64, 96);
  if (lit) {
    const g = ctx.createLinearGradient(0, 0, 0, 96);
    g.addColorStop(0, '#ffe9a8');
    g.addColorStop(1, '#e8a84e');
    ctx.fillStyle = g;
  } else {
    const g = ctx.createLinearGradient(0, 0, 64, 96);
    g.addColorStop(0, '#2a3450');
    g.addColorStop(0.5, '#3d4a6a');
    g.addColorStop(1, '#222a40');
    ctx.fillStyle = g;
  }
  ctx.fillRect(5, 5, 54, 86);
  ctx.fillStyle = '#e8e6dd';
  ctx.fillRect(29, 5, 6, 86);
  ctx.fillRect(5, 44, 54, 6);
  if (!lit) {
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.moveTo(8, 90); ctx.lineTo(30, 8); ctx.lineTo(44, 8); ctx.lineTo(22, 90);
    ctx.closePath();
    ctx.fill();
  }
  return cv;
}

function letterBoard(text, w, h, bg, fg, font = 0.62) {
  const cv = mkCanvas(w, h);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.font = `700 ${Math.floor(h * font)}px 'Arial Narrow', Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = fg;
  ctx.fillText(text.toUpperCase(), w / 2, h / 2 + 2);
  return cv;
}

function marqueeCanvas(school, line2) {
  const cv = mkCanvas(512, 320);
  const ctx = cv.getContext('2d');
  const c = school.colors;
  ctx.fillStyle = c.primary;
  ctx.fillRect(0, 0, 512, 96);
  ctx.fillStyle = contrastText(c.primary);
  ctx.font = `900 52px Impact, 'Arial Black', sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`${school.name.toUpperCase()} HIGH`, 256, 64);
  // reader board
  ctx.fillStyle = '#f5f3ea';
  ctx.fillRect(0, 96, 512, 224);
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 98, 508, 220);
  ctx.fillStyle = '#23242a';
  ctx.font = `700 44px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText(`HOME OF THE`, 256, 162);
  ctx.fillStyle = shade(c.primary, -10);
  ctx.font = `900 58px Impact, 'Arial Black', sans-serif`;
  ctx.fillText(school.mascot.toUpperCase(), 256, 226);
  ctx.fillStyle = '#23242a';
  ctx.font = `700 36px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillText((line2 || 'GO BIG OR GO HOME').toUpperCase(), 256, 286);
  return cv;
}

function bus() {
  const g = new THREE.Group();
  const body = box(2.6, 1.5, 8.2, new THREE.MeshPhongMaterial({ color: '#e8a020', shininess: 40 }));
  body.position.y = 1.25;
  g.add(body);
  const hood = box(2.4, 0.9, 1.3, new THREE.MeshPhongMaterial({ color: '#e8a020', shininess: 40 }));
  hood.position.set(0, 0.95, 4.6);
  g.add(hood);
  const stripe = box(2.64, 0.16, 8.24, new THREE.MeshPhongMaterial({ color: '#16161a' }));
  stripe.position.y = 1.18;
  g.add(stripe);
  const winBand = box(2.64, 0.5, 6.8, new THREE.MeshPhongMaterial({ color: '#222d3e', shininess: 80 }));
  winBand.position.set(0, 1.72, -0.4);
  g.add(winBand);
  const bumper = box(2.5, 0.22, 0.2, new THREE.MeshPhongMaterial({ color: '#999' }));
  bumper.position.set(0, 0.55, 5.3);
  g.add(bumper);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12);
  const wheelMat = new THREE.MeshPhongMaterial({ color: '#17181c' });
  for (const [x, z] of [[-1.2, 3.4], [1.2, 3.4], [-1.2, -2.8], [1.2, -2.8]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.42, z);
    g.add(w);
  }
  return g;
}

function flagpole(colors, h = 9) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, h, 8), new THREE.MeshPhongMaterial({ color: '#c8ccd2', shininess: 90 }));
  pole.position.y = h / 2;
  g.add(pole);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshPhongMaterial({ color: '#e8c860', shininess: 90 }));
  ball.position.y = h + 0.08;
  g.add(ball);
  const cv = mkCanvas(128, 80);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, 128, 40);
  ctx.fillStyle = colors.secondary;
  ctx.fillRect(0, 40, 128, 40);
  const geo = new THREE.PlaneGeometry(2.4, 1.5, 8, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x + 1.2) * 2.4) * 0.12);
  }
  geo.computeVertexNormals();
  const flag = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ map: tex(cv), side: THREE.DoubleSide }));
  flag.position.set(1.25, h - 1, 0);
  g.add(flag);
  return g;
}

/**
 * Build the school. school = { name, mascot, colors, building: { style, floors,
 * length, wingL, wingR, gym, cupola, brick, buses } }
 */
export function buildSchool(school, { signLine2 = null, ground = true } = {}) {
  const g = new THREE.Group();
  const B = school.building;
  const c = school.colors;
  const style = B.style || 'brick';
  const floors = Math.max(1, Math.min(3, B.floors || 2));
  const FH = 3.4;
  const W = 20 + (B.length || 2) * 7;
  const H = floors * FH + 0.7;
  const D = 9;

  // wall material by style
  let wallMat, trimColor;
  if (style === 'modern') {
    wallMat = new THREE.MeshPhongMaterial({ color: shade(B.brick, 30), shininess: 35 });
    trimColor = '#5a6470';
  } else {
    wallMat = new THREE.MeshPhongMaterial({ map: tex(brickCanvas(B.brick), { repeat: [W / 7, H / 7] }), shininess: 4 });
    trimColor = style === 'classic' ? '#e8e4d8' : shade(B.brick, -50);
  }
  const trimMat = new THREE.MeshPhongMaterial({ color: trimColor, shininess: 10 });

  // main block
  const main = box(W, H, D, wallMat);
  main.position.y = H / 2;
  g.add(main);
  // parapet + foundation
  const parapet = box(W + 0.4, 0.5, D + 0.4, trimMat);
  parapet.position.y = H + 0.22;
  g.add(parapet);
  const foundation = box(W + 0.3, 0.6, D + 0.3, new THREE.MeshPhongMaterial({ color: '#8a8478' }));
  foundation.position.y = 0.3;
  g.add(foundation);

  // ---- windows (instanced, lit + dark)
  const winGeo = new THREE.PlaneGeometry(1.0, 1.45);
  const litMat = new THREE.MeshBasicMaterial({ map: tex(windowCanvas(true)) });
  const darkMat = new THREE.MeshPhongMaterial({ map: tex(windowCanvas(false)), shininess: 60 });
  const placements = [];
  const cols = Math.floor((W - 8) / 2.4);
  for (let f = 0; f < floors; f++) {
    for (let i = 0; i < cols; i++) {
      const x = -((cols - 1) * 2.4) / 2 + i * 2.4;
      if (Math.abs(x) < 3.4 && f === 0) continue; // entrance gap
      const y = f * FH + 2.1;
      placements.push([x, y, D / 2 + 0.03, 0]);
      placements.push([x, y, -D / 2 - 0.03, Math.PI]);
    }
  }
  const litList = [], darkList = [];
  for (const p of placements) (Math.random() < 0.45 ? litList : darkList).push(p);
  for (const [list, mat] of [[litList, litMat], [darkList, darkMat]]) {
    if (!list.length) continue;
    const inst = new THREE.InstancedMesh(winGeo, mat, list.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
    list.forEach(([x, y, z, ry], i) => {
      q.setFromEuler(new THREE.Euler(0, ry, 0));
      m4.compose(new THREE.Vector3(x, y, z), q, s);
      inst.setMatrixAt(i, m4);
    });
    g.add(inst);
  }

  // ---- entrance
  const doorMat = new THREE.MeshPhongMaterial({ color: '#33271e', shininess: 30 });
  const glassLit = new THREE.MeshBasicMaterial({ color: '#ffd98a' });
  const door = box(2.6, 2.5, 0.15, doorMat);
  door.position.set(0, 1.25, D / 2 + 0.05);
  g.add(door);
  const transom = box(2.6, 0.7, 0.1, glassLit);
  transom.position.set(0, 3.0, D / 2 + 0.05);
  g.add(transom);
  // steps
  for (let i = 0; i < 3; i++) {
    const st = box(5.2 - i * 0.7, 0.22, 1.6 - i * 0.45, new THREE.MeshPhongMaterial({ color: '#a8a296' }));
    st.position.set(0, 0.11 + i * 0.22, D / 2 + 1.0 - i * 0.28);
    g.add(st);
  }

  if (style === 'classic') {
    // columns + pediment
    for (const x of [-2.6, -0.9, 0.9, 2.6]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.6, 10), trimMat);
      col.position.set(x, 2.3, D / 2 + 1.7);
      col.castShadow = true;
      g.add(col);
    }
    const arch = box(7, 0.5, 2.6, trimMat);
    arch.position.set(0, 4.85, D / 2 + 1.2);
    g.add(arch);
    const shape = new THREE.Shape();
    shape.moveTo(-3.5, 0); shape.lineTo(3.5, 0); shape.lineTo(0, 1.6); shape.closePath();
    const ped = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }), trimMat);
    ped.position.set(0, 5.1, D / 2 + 1.6);
    g.add(ped);
    if (B.cupola) {
      const base = box(2.2, 0.8, 2.2, trimMat);
      base.position.y = H + 0.8;
      g.add(base);
      const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.3, 8), new THREE.MeshPhongMaterial({ color: '#f0ecdf' }));
      drum.position.y = H + 1.8;
      g.add(drum);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhongMaterial({ color: '#2f6e57', shininess: 60 }));
      dome.position.y = H + 2.45;
      g.add(dome);
      const finial = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.0, 6), new THREE.MeshPhongMaterial({ color: '#d8c060' }));
      finial.position.y = H + 3.5;
      g.add(finial);
    }
  } else if (style === 'modern') {
    // glass curtain entry + angled canopy
    const curtain = box(6.4, FH * floors * 0.9, 0.25, new THREE.MeshPhongMaterial({ color: '#2e4a66', shininess: 95, specular: '#88aacc' }));
    curtain.position.set(0, FH * floors * 0.45 + 0.4, D / 2 + 0.15);
    g.add(curtain);
    const mull = new THREE.MeshPhongMaterial({ color: '#1a222e' });
    for (let i = -2; i <= 2; i++) {
      const v = box(0.1, FH * floors * 0.9, 0.32, mull);
      v.position.set(i * 1.5, FH * floors * 0.45 + 0.4, D / 2 + 0.16);
      g.add(v);
    }
    const canopy = box(7.4, 0.18, 3.2, new THREE.MeshPhongMaterial({ color: trimColor, shininess: 30 }));
    canopy.position.set(0, 3.4, D / 2 + 1.6);
    canopy.rotation.x = 0.07;
    g.add(canopy);
    for (const x of [-3.3, 3.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.3, 8), mull);
      post.position.set(x, 1.65, D / 2 + 2.9);
      g.add(post);
    }
  } else {
    // 50s brick: flat canopy + pilasters
    const canopy = box(6.8, 0.3, 2.8, trimMat);
    canopy.position.set(0, 3.5, D / 2 + 1.4);
    g.add(canopy);
    for (const x of [-3.1, 3.1]) {
      const pil = box(0.5, 3.5, 0.5, trimMat);
      pil.position.set(x, 1.75, D / 2 + 2.5);
      g.add(pil);
    }
  }

  // ---- name board above entrance
  const board = letterBoard(`${school.name} High School`, 1024, 96, shade(c.primary, -16), contrastText(c.primary));
  const nb = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.05), new THREE.MeshBasicMaterial({ map: tex(board) }));
  nb.position.set(0, Math.min(H - 0.8, FH + 2.2), D / 2 + 0.06);
  g.add(nb);

  // ---- wings
  for (const side of [-1, 1]) {
    if ((side < 0 && !B.wingL) || (side > 0 && !B.wingR)) continue;
    const wf = Math.max(1, floors - 1);
    const wh = wf * FH + 0.5;
    const ww = 12;
    const wing = box(ww, wh, D - 1.5, wallMat);
    wing.position.set(side * (W / 2 + ww / 2 - 0.5), wh / 2, -0.75);
    g.add(wing);
    const wpar = box(ww + 0.3, 0.4, D - 1.2, trimMat);
    wpar.position.set(wing.position.x, wh + 0.18, -0.75);
    g.add(wpar);
    // wing windows
    const n = 4;
    for (let f = 0; f < wf; f++) {
      for (let i = 0; i < n; i++) {
        const win = new THREE.Mesh(winGeo, Math.random() < 0.4 ? litMat : darkMat);
        win.position.set(wing.position.x - (n - 1) * 1.1 + i * 2.2, f * FH + 2.1, (D - 1.5) / 2 - 0.75 + 0.03);
        g.add(win);
      }
    }
  }

  // ---- gym block
  if (B.gym) {
    const gw = 14, gh = 7.5, gd = 18;
    const gym = box(gw, gh, gd, wallMat);
    gym.position.set(-W / 2 - (B.wingL ? 12 : 0) - gw / 2 + 2, gh / 2, -D / 2 - gd / 2 + 1);
    g.add(gym);
    const barrel = new THREE.Mesh(
      new THREE.CylinderGeometry(gw / 2, gw / 2, gd, 16, 1, false, 0, Math.PI),
      new THREE.MeshPhongMaterial({ color: B.roofColor || '#5a6068', shininess: 20 })
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.rotation.z = Math.PI;
    barrel.scale.y = 0.35;
    barrel.position.set(gym.position.x, gh, gym.position.z);
    barrel.castShadow = true;
    g.add(barrel);
    // clerestory strip
    const strip = box(gw - 2, 0.9, 0.1, glassLit);
    strip.position.set(gym.position.x, gh - 1.2, gym.position.z + gd / 2 + 0.05);
    g.add(strip);
    const gymSign = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 0.8),
      new THREE.MeshBasicMaterial({ map: tex(letterBoard(`${school.mascot} Gymnasium`, 768, 80, '#23242a', '#e8e4d8')) })
    );
    gymSign.position.set(gym.position.x, gh - 2.4, gym.position.z + gd / 2 + 0.06);
    g.add(gymSign);
  }

  // ---- roof clutter
  const acMat = new THREE.MeshPhongMaterial({ color: '#9aa0a8', shininess: 30 });
  for (let i = 0; i < 3; i++) {
    const ac = box(1.4, 0.8, 1.4, acMat);
    ac.position.set(-W / 3 + i * (W / 3), H + 0.85, (i % 2 ? 1.6 : -1.8));
    g.add(ac);
  }

  // ---- grounds
  if (ground) {
    const lawnMat = new THREE.MeshPhongMaterial({ color: '#2a5a2c' });
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(W + 46, 0.1, D + 36), lawnMat);
    lawn.position.set(0, -0.05, 6);
    lawn.receiveShadow = true;
    g.add(lawn);
    const walk = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 14), new THREE.MeshPhongMaterial({ map: tex(concreteCanvas(), { repeat: [2, 7] }) }));
    walk.position.set(0, 0.0, D / 2 + 8);
    walk.receiveShadow = true;
    g.add(walk);
    // bushes
    const bushMat = new THREE.MeshPhongMaterial({ color: '#1d4220' });
    for (const x of [-5.5, -3.8, 3.8, 5.5, -W / 2 + 3, W / 2 - 3]) {
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6), bushMat);
      bush.scale.y = 0.7;
      bush.position.set(x, 0.5, D / 2 + 1.6);
      bush.castShadow = true;
      g.add(bush);
    }
    // flag + marquee
    const fp = flagpole(c);
    fp.position.set(-7.5, 0, D / 2 + 9);
    g.add(fp);
    const mq = new THREE.Group();
    const post1 = box(0.18, 2.2, 0.18, trimMat); post1.position.set(-1.6, 1.1, 0); mq.add(post1);
    const post2 = box(0.18, 2.2, 0.18, trimMat); post2.position.set(1.6, 1.1, 0); mq.add(post2);
    const mqTex = tex(marqueeCanvas(school, signLine2));
    const boardM = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.85), new THREE.MeshBasicMaterial({ map: mqTex }));
    boardM.position.y = 3.4;
    mq.add(boardM);
    const boardB = boardM.clone();
    boardB.rotation.y = Math.PI;
    mq.add(boardB);
    mq.position.set(9, 0, D / 2 + 12.5);
    g.add(mq);

    // parking + buses
    if (B.buses) {
      const lot = new THREE.Mesh(new THREE.BoxGeometry(26, 0.08, 14), new THREE.MeshPhongMaterial({ map: tex(asphaltCanvas(), { repeat: [6, 3] }) }));
      lot.position.set(W / 2 + 6, 0, D / 2 + 12);
      g.add(lot);
      for (let i = 0; i < 3; i++) {
        const b = bus();
        b.position.set(W / 2 + i * 4.2, 0, D / 2 + 12);
        b.rotation.y = 0.12 * (i - 1);
        g.add(b);
      }
    }
  }

  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return g;
}
