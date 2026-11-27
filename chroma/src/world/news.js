// PRISM NEWS: a tiny TV studio with two host Chromeleons, rendered into a
// texture for the Clash Tower's big screen (and shown full screen on arrival).
import * as THREE from 'three';
import { Dripkin } from '../actors/character.js';
import { signTexture } from './textures.js';

export const HOSTS = [
  { name: 'Nova', color: '#ff2e88', look: { skin: '#e78fa6', pattern: 'spots', patternColor: '#f4f1ea', crest: 'fan', eyes: '#3a7bff', bottom: '#23263a', hat: 'phones', clothes: 'varsity', shoes: 'hightop_red' } },
  { name: 'Dex', color: '#00d8c0', look: { skin: '#5fb8a6', pattern: 'stripes', patternColor: '#1f4f6b', crest: 'horns', eyes: '#ff9f1c', bottom: '#3d405b', hat: 'goggles', clothes: 'jacket_night', shoes: 'kicks_neon' } },
];

export class NewsStudio {
  constructor() {
    const scene = this.scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1b1530);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x553366, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(2, 4, 5); scene.add(key);
    const rim = new THREE.DirectionalLight(0xff7ad0, 2.0);
    rim.position.set(-3, 3, -4); scene.add(rim);
    // curved backdrop
    const c = document.createElement('canvas');
    c.width = 1024; c.height = 512;
    const x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 1024, 512);
    gr.addColorStop(0, '#ff2e88'); gr.addColorStop(0.5, '#a335ff'); gr.addColorStop(1, '#1e6bff');
    x.fillStyle = gr; x.fillRect(0, 0, 1024, 512);
    x.fillStyle = 'rgba(255,255,255,0.14)';
    for (let i = 0; i < 26; i++) { x.beginPath(); x.arc(Math.random() * 1024, Math.random() * 512, 10 + Math.random() * 60, 0, Math.PI * 2); x.fill(); }
    x.font = '150px "Lilita One", "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 18; x.strokeStyle = '#1b1530'; x.strokeText('PRISM NEWS', 512, 200);
    x.fillStyle = '#ffd21a'; x.fillText('PRISM NEWS', 512, 200);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.repeat.x = -1; // inside of the cylinder: un-mirror
    this.backTex = tex;
    const back = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 4.5, 40, 1, true, -0.8, 1.6), new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide }));
    back.position.set(0, 1.8, 3.2);
    back.rotation.y = Math.PI;
    scene.add(back);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 32), new THREE.MeshStandardMaterial({ color: 0x2b2140, roughness: 0.3, metalness: 0.4 }));
    floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const desk = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.72, 0.8), new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.4 }));
    desk.position.set(0, 0.36, 0.75); scene.add(desk);
    const riser = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.3, 1.4), new THREE.MeshStandardMaterial({ color: 0x3a2f5a, roughness: 0.5 }));
    riser.position.set(0, 0.15, -0.1); scene.add(riser);
    const deskSign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.55), new THREE.MeshBasicMaterial({ map: signTexture('PRISM NEWS', { w: 512, h: 108, size: 64, accent: '#ff2e88' }) }));
    deskSign.position.set(0, 0.38, 1.16); scene.add(deskSign);
    this.hosts = HOSTS.map((h, i) => {
      const m = new Dripkin(h.look, h.color, null);
      m.root.position.set(i === 0 ? -0.75 : 0.75, 0.3, 0);
      m.root.rotation.y = i === 0 ? 0.25 : -0.25;
      scene.add(m.root);
      return m;
    });
    this.camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 50);
    this.camera.position.set(0, 1.6, 5.0);
    this.camera.lookAt(0, 1.3, 0);
    this.rt = new THREE.WebGLRenderTarget(640, 360, { samples: 4 });
    this.time = 0;
    this.speaking = 0;
  }

  get texture() { return this.rt.texture; }

  update(dt, speaking = 0) {
    this.time += dt;
    this.speaking = speaking;
    this.hosts.forEach((h, i) => {
      h.emote = speaking === i + 1 ? 'talk' : (Math.sin(this.time * 0.7 + i * 2) > 0.85 ? 'wave' : null);
      h.update(dt, { speed: 0, grounded: true, vy: 0, pitch: -0.05, chroma: 0.05 });
    });
  }

  render(renderer, target = this.rt, camera = this.camera) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(this.scene, camera);
    renderer.setRenderTarget(prev);
  }

  dispose() {
    this.rt.dispose();
    for (const h of this.hosts) h.dispose();
    this.backTex.dispose();
  }
}
