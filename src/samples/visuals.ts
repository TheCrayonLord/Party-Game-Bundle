// A look at "buffed up" visuals: the models the game uses now (top row) next to versions built from
// many more small pieces, with soft shadows (bottom row). Nothing here is used by the game yet.
import * as THREE from 'three';
import { MASCOT_DRAFTS } from './mascots';
import { boatDetailed, boatNow, garageDetailed, garageNow, guestDetailed, guestNow, kartDetailed, kartNow } from '../core/models';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.append(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color('#3b2752');
const cam = new THREE.PerspectiveCamera(34, 1, 0.5, 300);
scene.add(new THREE.HemisphereLight('#ffe9d0', '#5a3a6a', 1.5));
const sun = new THREE.DirectionalLight('#ffd0a0', 2.2); sun.position.set(-18, 30, 22); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 30, bottom: -30, near: 1, far: 90 }); sun.shadow.bias = -0.0005;
scene.add(sun);
const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ color: '#4a3560' })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

const COLOR = '#e4572e';
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const sized = (make: (c: string) => THREE.Group, s: number) => () => { const g = make(COLOR); g.scale.setScalar(s); return g; };

// ---------------- stage ----------------
const pairs: [string, () => THREE.Group, () => THREE.Group][] = [
  ['Kart', sized(kartNow, 1.5), sized(kartDetailed, 1.5)], ['Boat', sized(boatNow, 1.5), sized(boatDetailed, 1.5)], ['Park guest', sized(guestNow, 1.2), sized(guestDetailed, 1.2)], ['Tilt Kart building', sized(garageNow, 0.62), sized(garageDetailed, 0.62)],
];
const turning: THREE.Group[] = [];
const labels = document.createElement('div');
labels.style.cssText = 'position:fixed;inset:0;pointer-events:none;font:700 15px system-ui,sans-serif;color:#f6ead2';
app.append(labels);
const tags: { el: HTMLElement; at: THREE.Vector3 }[] = [];
const tag = (text: string, at: THREE.Vector3, big = false) => {
  const el = document.createElement('div'); el.textContent = text;
  el.style.cssText = `position:absolute;transform:translate(-50%,-50%);white-space:nowrap;${big ? 'font-size:20px;color:#e8b23a' : 'background:rgba(20,12,35,.6);padding:1px 8px;border-radius:99px'}`;
  labels.append(el); tags.push({ el, at });
};
const mascots = new URLSearchParams(location.search).has('mascots');      // visuals.html?mascots shows the mascot drafts instead
if (mascots) MASCOT_DRAFTS.forEach(([name, make], i) => {
  const x = (i - 1.5) * 9.4;
  const plinth = new THREE.Mesh(cyl(4.2, 4.5, 0.5, 32), new THREE.MeshLambertMaterial({ color: '#6d5486' })); plinth.position.set(x, 0.25, 0); plinth.receiveShadow = true; scene.add(plinth);
  const m = make(); m.scale.setScalar(1.25); m.position.set(x, 0.5, 0);
  m.traverse((o) => { const mesh = o as THREE.Mesh; if (mesh.isMesh && !(mesh.material as THREE.Material).transparent) { o.castShadow = true; o.receiveShadow = true; } });
  scene.add(m); turning.push(m);
  tag(name, new THREE.Vector3(x, 0.2, 5.6), true);
});
else pairs.forEach(([name, now, detailed], i) => {
  const x = (i - 1.5) * 12 + 2.5;
  for (const [make, z, shadows] of [[now, -9, false], [detailed, 7, true]] as [() => THREE.Group, number, boolean][]) {
    const plinth = new THREE.Mesh(cyl(5, 5.3, 0.5, 32), new THREE.MeshLambertMaterial({ color: shadows ? '#6d5486' : '#55406c' })); plinth.position.set(x, 0.25, z); plinth.receiveShadow = true; scene.add(plinth);
    const m = make(); m.position.set(x, 0.5, z);
    if (shadows) m.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    let pieces = 0; m.traverse((o) => { if ((o as THREE.Mesh).isMesh) pieces++; });      // after merging: one mesh per colour
    scene.add(m); turning.push(m);
    tag(shadows ? `${name} · ${pieces} meshes` : `${pieces} meshes`, new THREE.Vector3(x, 0.2, z + 5.9));
  }
});
if (!mascots) { tag('NOW', new THREE.Vector3(-23, 0.2, -9), true); tag('DETAILED', new THREE.Vector3(-23, 0.2, 7), true); }

let spin = mascots ? 0.35 : 0.6, dragging = false, lastX = 0;
renderer.domElement.onpointerdown = (e) => { dragging = true; lastX = e.clientX; };
addEventListener('pointerup', () => { dragging = false; });
addEventListener('pointermove', (e) => { if (dragging) { spin += (e.clientX - lastX) * 0.01; lastX = e.clientX; } });
const fit = () => {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h); cam.aspect = w / h;
  cam.position.set(0, 34 / Math.min(1, cam.aspect / 1.7), 48 / Math.min(1, cam.aspect / 1.7)); cam.lookAt(0, mascots ? 4 : 1.5, 0); if (mascots) { const k = 1 / Math.min(1, cam.aspect / 1.7); cam.position.set(0, 13 * k, 41 * k); cam.lookAt(0, 4, 0); }
  cam.updateProjectionMatrix();
};
fit(); addEventListener('resize', fit);
const still = new URLSearchParams(location.search).has('still');
const v = new THREE.Vector3();
renderer.setAnimationLoop(() => {
  if (!dragging && !still) spin += 0.006;
  for (const m of turning) m.rotation.y = spin;
  renderer.render(scene, cam);
  for (const t of tags) { v.copy(t.at).project(cam); t.el.style.left = `${(v.x * 0.5 + 0.5) * innerWidth}px`; t.el.style.top = `${(-v.y * 0.5 + 0.5) * innerHeight}px`; }
});
