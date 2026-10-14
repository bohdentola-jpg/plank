// Dev test card: exercises the renderer, bloom, CRT, fonts and glyphs.
import * as THREE from 'three';
import { registerScreen, game } from '../main.js';
import { C, vText, text, panel, header, hints, padGlyph, statBar, osd } from '../core/ui.js';

registerScreen('dev', () => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070c);
  scene.fog = new THREE.FogExp2(0x0a0f1a, 0.02);
  const camera = new THREE.PerspectiveCamera(55, 4 / 3, 0.1, 500);
  camera.position.set(0, 3, 9);
  camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0x4060a0, 0x101010, 0.6));
  const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
  sun.position.set(5, 10, 4);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.4 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const box = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 4), new THREE.MeshStandardMaterial({ color: 0xc81e1e, metalness: 0.5, roughness: 0.3 }));
  box.position.y = 0.5;
  scene.add(box);
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 6, 1, 0.5).multiplyScalar(6) }));
    m.position.set(-5 + i * 2, 2.5, -2);
    scene.add(m);
  }
  let t = 0;
  return {
    view: () => ({ scene, camera }),
    update(dt) { t += dt; box.rotation.y = t * 0.6; },
    draw(ctx) {
      header(ctx, 'QUICK RACE', 'PICK A CAR · PICK A ROAD · GO');
      panel(ctx, 600, 150, 360, 300);
      vText(ctx, '2ND/4', 640, 220, 48, { color: C.text, outline: 3, outlineColor: '#000' });
      vText(ctx, 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 40, 520, 22, { color: C.cyan, glow: 8 });
      vText(ctx, '0123456789 .,:;-+=/!?\'"%#&()$*', 40, 560, 22, { color: C.accent });
      text(ctx, 'Body text in the system font — Trebuchet-era goodness.', 40, 600, { size: 18 });
      statBar(ctx, 640, 260, 280, 14, 0.7);
      statBar(ctx, 640, 290, 280, 14, 0.45, { compare: 0.6 });
      padGlyph(ctx, 'cross', 650, 340, 13);
      padGlyph(ctx, 'circle', 690, 340, 13);
      padGlyph(ctx, 'square', 730, 340, 13);
      padGlyph(ctx, 'triangle', 770, 340, 13);
      padGlyph(ctx, 'R2', 820, 340, 13);
      osd(ctx, 'PLAY ►', 60, 700);
      hints(ctx, [['confirm', 'SELECT'], ['back', 'BACK'], ['tabR', 'NEXT']]);
      void game;
    },
  };
});
