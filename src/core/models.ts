// The game's 3D models. Each comes in two builds: the simple one (used by Performance start) and a detailed one
// made of many small pieces (used by Regular start). Detailed builds are merged into one mesh per colour, so a
// model of eighty pieces still costs only a handful of draw calls.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Which build the game should use. Regular start turns this on; Performance start leaves it off. */
export const quality = { detailed: false };

/** Collapses a model's pieces into one mesh per material. */
export function bake(g: THREE.Group): THREE.Group {
  g.updateMatrixWorld(true);
  const by = new Map<THREE.Material, THREE.BufferGeometry[]>();
  g.traverse((o) => {
    const m = o as THREE.Mesh; if (!m.isMesh) return;
    const src = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone();
    src.applyMatrix4(m.matrixWorld);
    const list = by.get(m.material as THREE.Material) ?? []; list.push(src); by.set(m.material as THREE.Material, list);
    m.geometry.dispose();
  });
  const out = new THREE.Group();
  for (const [material, list] of by) { out.add(new THREE.Mesh(mergeGeometries(list)!, material)); list.forEach((x) => x.dispose()); }
  return out;
}

const mats = new Map<string, THREE.Material>();
const mat = (c: string) => { let m = mats.get(c); if (!m) mats.set(c, (m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }))); return m; };
/** Adds one piece to a group. */
function P(g: THREE.Object3D, geo: THREE.BufferGeometry, c: string, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 12) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r: number, seg = 12) => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
const cone = (r: number, h: number, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const torus = (r: number, t: number, seg = 16) => new THREE.TorusGeometry(r, t, 6, seg);
const INK = '#1b1220', CREAM = '#f6ead2', SKIN = '#f3dcc0', H = Math.PI / 2;

// ---------------- the models the game uses now ----------------
export function kartNow(COLOR: string) {
  const g = new THREE.Group();
  P(g, box(1.9, 0.7, 3), COLOR, 0, 0.7, 0); P(g, box(1.2, 0.5, 1), COLOR, 0, 0.6, 1.8);
  P(g, new THREE.IcosahedronGeometry(0.6, 0), CREAM, 0, 1.5, -0.3);
  for (const [x, z] of [[-1.1, 1], [1.1, 1], [-1.1, -1], [1.1, -1]]) P(g, box(0.5, 0.8, 0.9), INK, x, 0.4, z);
  return bake(g);
}
export function boatNow(COLOR: string) {
  const g = new THREE.Group();
  P(g, box(1.9, 0.8, 2.6), COLOR, 0, 0.5, 0);
  P(g, cone(1.34, 1.8, 4), COLOR, 0, 0.5, 2.2, H, 0, Math.PI / 4);
  P(g, box(0.15, 2.6, 0.15), CREAM, 0, 1.9, 0);
  P(g, cone(1.2, 2.2, 3), CREAM, 0, 2.1, -0.5).scale.x = 0.2;
  return bake(g);
}
export function guestNow(COLOR: string) {
  const g = new THREE.Group();
  P(g, cyl(0.75, 1.15, 2.3, 8), COLOR, 0, 1.15, 0); P(g, ball(0.85, 8), SKIN, 0, 2.9, 0);
  P(g, cone(0.75, 0.9, 8), COLOR, 0, 3.95, 0); P(g, ball(0.22, 5), INK, 0, 2.95, 0.8);
  return bake(g);
}
export function garageNow(COLOR: string) {
  const g = new THREE.Group();
  P(g, box(9, 4, 5), '#8d8f96', 0, 2, -1); P(g, box(6, 3, 0.3), INK, 0, 1.5, 1.55);
  for (let i = 0; i < 8; i++) P(g, box(1.15, 0.3, 2.4), i % 2 ? '#f4f0e6' : INK, -4.03 + i * 1.15, 4.3, 2.4, 0.25);
  for (let i = 0; i < 3; i++) P(g, cyl(0.8, 0.8, 0.5, 10), INK, 5.6, 0.25 + i * 0.5, 1.5);
  P(g, box(1.3, 0.5, 2.2), COLOR, -5.6, 0.6, 2.5); P(g, ball(0.4, 8), CREAM, -5.6, 1.2, 2.3);
  return bake(g);
}

// ---------------- the same things, built from many more small pieces ----------------
function wheel(g: THREE.Object3D, x: number, y: number, z: number, r = 0.46, w = 0.42) {
  const s = Math.sign(x) || 1;
  P(g, cyl(r, r, w, 16), INK, x, y, z, 0, 0, H);                       // tyre
  P(g, torus(r * 0.86, 0.07), '#2e2536', x + s * w * 0.4, y, z, 0, H, 0); // sidewall ridge
  P(g, cyl(r * 0.55, r * 0.55, w + 0.04, 12), '#d9d3c4', x, y, z, 0, 0, H); // rim
  P(g, cyl(r * 0.2, r * 0.2, w + 0.1, 8), '#e8b23a', x, y, z, 0, 0, H);     // hub nut
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; P(g, box(0.03, r * 0.5, 0.07), '#8d8f96', x + s * (w / 2 + 0.02), y + Math.cos(a) * r * 0.3, z + Math.sin(a) * r * 0.3, a, 0, 0); }
}
function driver(g: THREE.Object3D, COLOR: string, y: number, z: number, wheelZ: number) {
  P(g, cyl(0.3, 0.36, 0.7, 10), CREAM, 0, y, z);                        // torso in a racing suit
  P(g, box(0.5, 0.1, 0.3), COLOR, 0, y + 0.12, z + 0.02);               // stripe across the chest
  P(g, ball(0.34, 14), COLOR, 0, y + 0.66, z);                          // helmet
  P(g, box(0.5, 0.16, 0.2), '#8fd8ff', 0, y + 0.68, z + 0.24);          // visor
  P(g, box(0.07, 0.36, 0.5), CREAM, 0, y + 0.72, z - 0.02);             // helmet stripe
  for (const s of [-1, 1]) {                                           // arms reaching for the wheel, gloved hands
    P(g, cyl(0.09, 0.09, 0.62, 6), CREAM, s * 0.34, y + 0.06, (z + wheelZ) / 2 + 0.05, H * 0.82, 0, 0);
    P(g, ball(0.11, 8), INK, s * 0.27, y - 0.04, wheelZ - 0.06);
  }
}
export function kartDetailed(COLOR: string) {
  const g = new THREE.Group();
  P(g, box(1.5, 0.14, 3.3), '#2e2536', 0, 0.36, 0.1);                   // floor pan
  P(g, box(1.1, 0.42, 1.5), COLOR, 0, 0.62, -0.2);                      // tub
  P(g, box(0.9, 0.34, 1.0), COLOR, 0, 0.58, 1.0);                       // nose section
  P(g, cyl(0.2, 0.45, 0.7, 10), COLOR, 0, 0.55, 1.75, H, 0, 0);         // nose cone
  P(g, box(0.34, 0.36, 1.9), CREAM, 0, 0.64, 0.75);                     // racing stripe
  P(g, box(2.1, 0.07, 0.42), CREAM, 0, 0.3, 2.05);                      // front wing
  for (const s of [-1, 1]) {
    P(g, box(0.07, 0.3, 0.46), COLOR, s * 1.05, 0.42, 2.05);            // wing end plates
    P(g, box(0.42, 0.34, 1.25), COLOR, s * 0.82, 0.56, -0.25);          // side pods
    P(g, box(0.3, 0.2, 0.1), INK, s * 0.82, 0.58, 0.39);                // air intakes
    P(g, cyl(0.07, 0.07, 0.9, 8), '#b9b4a6', s * 0.5, 0.86, -1.5, H * 0.85, 0, 0); // exhausts
    P(g, cyl(0.09, 0.07, 0.14, 8), INK, s * 0.5, 0.94, -1.96, H * 0.85, 0, 0);
    P(g, box(0.07, 0.62, 0.1), '#8d8f96', s * 0.55, 1.12, -1.55);       // spoiler struts
    P(g, cyl(0.045, 0.045, 0.7, 6), '#8d8f96', s * 0.72, 0.42, 1.25, 0, 0, H); // front axle stubs
    P(g, cyl(0.045, 0.045, 0.6, 6), '#8d8f96', s * 0.78, 0.46, -1.2, 0, 0, H); // rear axle stubs
    P(g, box(0.1, 0.08, 0.2), CREAM, s * 0.62, 0.9, 0.42, 0, 0, 0);      // mirrors
  }
  P(g, box(1.5, 0.08, 0.5), CREAM, 0, 1.46, -1.6, -0.12);               // rear wing
  P(g, box(1.5, 0.2, 0.06), COLOR, 0, 1.38, -1.84);                     // wing lip
  P(g, box(0.9, 0.5, 0.7), '#3a3440', 0, 0.72, -1.25);                  // engine block
  for (let i = 0; i < 4; i++) P(g, box(0.8, 0.04, 0.1), '#8d8f96', 0, 1.0, -1.02 - i * 0.14); // cooling fins
  P(g, box(0.8, 0.75, 0.16), INK, 0, 0.98, -0.72, -0.2);                // seat back
  P(g, box(0.44, 0.24, 0.14), INK, 0, 1.44, -0.82, -0.2);               // headrest
  P(g, cyl(0.04, 0.04, 0.5, 6), '#8d8f96', 0, 0.92, 0.42, H * 0.6, 0, 0); // steering column
  P(g, torus(0.2, 0.04, 14), INK, 0, 1.06, 0.26, H * 0.6 - H, 0, 0);    // steering wheel
  P(g, cyl(0.26, 0.26, 0.05, 16), CREAM, 0, 0.82, 1.3, H * 0.15, 0, 0); // number roundel
  P(g, box(1.0, 0.1, 0.1), '#8d8f96', 0, 0.36, 1.78);                   // front bumper bar
  wheel(g, -1.05, 0.44, 1.25, 0.42, 0.36); wheel(g, 1.05, 0.44, 1.25, 0.42, 0.36);
  wheel(g, -1.12, 0.5, -1.2, 0.5, 0.48); wheel(g, 1.12, 0.5, -1.2, 0.5, 0.48);
  driver(g, COLOR, 1.0, -0.38, 0.26);
  return bake(g);
}
export function boatDetailed(COLOR: string) {
  const g = new THREE.Group();
  // hull: stacked planks that narrow towards the keel and the bow
  for (let i = 0; i < 4; i++) {
    const w = 1.3 + i * 0.2, y = 0.16 + i * 0.2;
    P(g, box(w, 0.2, 2.4), COLOR, 0, y, -0.2);
    for (let j = 0; j < 6; j++) P(g, box(w * (1 - (j + 0.5) / 6.4), 0.2, 0.3), COLOR, 0, y, 1.15 + j * 0.3 + i * 0.04);     // the bow: slices that narrow to a point
  }
  P(g, box(1.6, 0.06, 2.3), '#b08968', 0, 0.9, -0.2);                   // deck
  for (let i = 0; i < 6; i++) P(g, box(1.6, 0.07, 0.03), '#8a6a4c', 0, 0.9, -1.2 + i * 0.4); // deck seams
  for (const s of [-1, 1]) {
    P(g, box(0.08, 0.22, 2.5), '#8a6a4c', s * 0.92, 1.0, -0.2);         // gunwales
    for (let i = 0; i < 3; i++) P(g, torus(0.16, 0.06, 10), i % 2 ? CREAM : '#d9482b', s * 1.0, 0.72, -0.9 + i * 0.7, 0, H, 0); // fenders
    P(g, box(0.05, 0.05, 1.5), '#8d8f96', s * 0.5, 0.2, -1.0);          // rudder arms
  }
  P(g, box(1.84, 0.5, 0.12), COLOR, 0, 0.75, -1.44);                    // transom
  P(g, box(0.08, 0.7, 0.4), '#8a6a4c', 0, 0.45, -1.66);                 // rudder
  P(g, cyl(0.035, 0.035, 0.9, 6), '#8a6a4c', 0, 1.1, -1.25, H * 0.75, 0, 0); // tiller
  P(g, box(0.9, 0.5, 0.8), CREAM, 0, 1.18, -0.45);                      // cabin
  P(g, box(1.0, 0.08, 0.9), COLOR, 0, 1.47, -0.45);                     // cabin roof
  for (const s of [-1, 1]) P(g, cyl(0.13, 0.13, 0.04, 12), '#8fd8ff', s * 0.46, 1.2, -0.45, 0, 0, H); // portholes
  P(g, cyl(0.07, 0.09, 3.3, 8), '#8a6a4c', 0, 2.55, 0.35);              // mast
  P(g, cyl(0.04, 0.04, 1.7, 6), '#8a6a4c', 0, 1.35, -0.45, H, 0, 0);    // boom
  P(g, ball(0.1, 8), '#e8b23a', 0, 4.22, 0.35);                         // mast cap
  // sails: striped panels, each a little narrower than the one below
  for (let i = 0; i < 6; i++) {
    const t = i / 6, w = 1.5 * (1 - t) + 0.12;
    P(g, box(0.05, 0.4, w), i % 2 ? CREAM : COLOR, 0, 1.6 + i * 0.4, 0.3 - w / 2 - 0.05, 0, 0.12, 0);
  }
  for (let i = 0; i < 4; i++) { const t = i / 4, w = 1.0 * (1 - t) + 0.1; P(g, box(0.04, 0.4, w), i % 2 ? COLOR : CREAM, 0, 1.5 + i * 0.4, 0.45 + w / 2, 0, -0.1, 0); } // jib
  P(g, box(0.02, 0.3, 0.5), COLOR, 0, 4.0, 0.08);                       // pennant
  P(g, cyl(0.02, 0.02, 3.9, 4), '#8a6a4c', 0, 2.55, 1.55, -0.62, 0, 0);  // forestay
  P(g, cyl(0.04, 0.04, 0.9, 6), '#8a6a4c', 0, 1.0, 2.95, H * 0.8, 0, 0);  // bowsprit
  P(g, torus(0.28, 0.08, 14), '#d9482b', 0.55, 1.0, 0.7, H, 0, 0);      // life ring on deck
  // skipper
  P(g, cyl(0.2, 0.26, 0.6, 8), '#27457a', 0, 1.25, -1.0); P(g, ball(0.24, 10), SKIN, 0, 1.75, -1.0);
  P(g, cyl(0.26, 0.26, 0.07, 10), CREAM, 0, 1.95, -1.0); P(g, cyl(0.17, 0.2, 0.14, 10), CREAM, 0, 2.02, -1.0);
  return bake(g);
}
export function guestDetailed(COLOR: string) {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    P(g, box(0.5, 0.22, 0.8), INK, s * 0.36, 0.11, 0.1);                // shoes
    P(g, cyl(0.24, 0.26, 0.8, 8), '#3a4a7a', s * 0.36, 0.6, 0);         // legs
    P(g, cyl(0.17, 0.2, 1.1, 8), COLOR, s * 0.98, 1.75, 0, 0, 0, s * 0.28); // arms
    P(g, ball(0.2, 8), SKIN, s * 1.15, 1.22, 0);                        // hands
    P(g, ball(0.2, 8), SKIN, s * 0.86, 3.0, 0);                         // ears
    P(g, ball(0.1, 8), INK, s * 0.3, 3.1, 0.76);                        // eyes
    P(g, ball(0.16, 8), '#f2a7a0', s * 0.52, 2.82, 0.66).scale.z = 0.4; // cheeks
  }
  P(g, cyl(0.6, 0.86, 1.4, 12), COLOR, 0, 1.65, 0);                     // jumper
  P(g, cyl(0.88, 0.88, 0.16, 12), '#b9401f', 0, 1.0, 0);                // jumper hem
  for (let i = 0; i < 3; i++) P(g, ball(0.08, 6), CREAM, 0, 1.3 + i * 0.36, 0.72 - i * 0.07); // buttons
  P(g, torus(0.5, 0.13, 14), CREAM, 0, 2.34, 0, H, 0, 0);               // scarf
  P(g, box(0.24, 0.6, 0.12), CREAM, 0.3, 2.02, 0.56, 0.15, 0, -0.12);
  P(g, ball(0.82, 16), SKIN, 0, 3.0, 0);                                // head
  P(g, ball(0.12, 8), '#e39b84', 0, 2.92, 0.82);                        // nose
  P(g, torus(0.2, 0.035, 10), INK, 0, 2.72, 0.72, 0.2, 0, 0).scale.y = 0.5; // smile
  P(g, cone(0.6, 1.1, 12), COLOR, 0, 4.2, 0);                           // party hat
  for (let i = 0; i < 3; i++) P(g, torus(0.5 - i * 0.16, 0.05, 12), CREAM, 0, 3.86 + i * 0.3, 0, H, 0, 0); // hat stripes
  P(g, ball(0.18, 8), '#e8b23a', 0, 4.8, 0);                            // pom-pom
  P(g, torus(0.62, 0.07, 14), '#e8b23a', 0, 3.66, 0, H, 0, 0);          // hat brim
  // a balloon on a string
  P(g, cyl(0.015, 0.015, 2.1, 4), CREAM, 1.3, 2.3, 0, 0, 0, -0.14);
  P(g, ball(0.5, 14), '#4cc9f0', 1.45, 3.7, 0).scale.y = 1.2; P(g, cone(0.1, 0.16, 6), '#4cc9f0', 1.45, 3.08, 0);
  return bake(g);
}
export function garageDetailed(COLOR: string) {
  const g = new THREE.Group();
  P(g, box(9.6, 0.3, 6), '#6b6470', 0, 0.15, -0.8);                     // concrete slab
  for (let r = 0; r < 6; r++) for (let c = 0; c < 9; c++) {             // brick courses, staggered
    if (r < 5 && c > 1 && c < 7) continue;                             // the door opening
    P(g, box(0.98, 0.6, 0.5), (r + c) % 3 ? '#9a6a5a' : '#8a5a4c', -4 + c + (r % 2 ? 0.15 : -0.15) * (c === 0 || c === 8 ? 0 : 1), 0.62 + r * 0.64, 1.45);
  }
  P(g, box(9, 4, 4.4), '#8d8f96', 0, 2.3, -1.2);                        // shed behind the brick front
  for (let i = 0; i < 9; i++) P(g, box(0.12, 4, 0.1), '#7b7d84', -4.5, 2.3, -3.2 + i * 0.5); // corrugated sides
  for (let i = 0; i < 9; i++) P(g, box(0.12, 4, 0.1), '#7b7d84', 4.5, 2.3, -3.2 + i * 0.5);
  for (let i = 0; i < 5; i++) P(g, box(5.0, 0.56, 0.12), i % 2 ? '#c9553a' : '#b9482e', 0, 0.62 + i * 0.6 + 1.4, 1.5 - 0.1); // roller door, half raised
  P(g, box(5.2, 0.2, 0.3), INK, 0, 3.55, 1.5);                          // door housing
  for (let i = 0; i < 16; i++) P(g, box(0.6, 0.12, 2.6), i % 2 ? '#f4f0e6' : INK, -4.5 + i * 0.6, 4.55, 2.5, 0.28); // checkered awning
  for (let i = 0; i < 16; i++) P(g, box(0.6, 0.3, 0.06), i % 2 ? INK : '#f4f0e6', -4.5 + i * 0.6, 4.05, 3.76);     // awning valance
  for (const s of [-1, 1]) P(g, cyl(0.09, 0.09, 4.2, 8), '#d9d3c4', s * 4.6, 2.1, 3.6);                           // awning poles
  P(g, box(4.4, 1.0, 0.2), CREAM, 0, 5.5, 1.5); P(g, box(4.7, 1.3, 0.1), COLOR, 0, 5.5, 1.42);                    // sign board
  for (let i = 0; i < 9; i++) P(g, ball(0.13, 8), i % 2 ? '#ffe14d' : '#fff', -2.2 + i * 0.55, 6.25, 1.5);        // sign bulbs
  for (let i = 0; i < 4; i++) { P(g, torus(0.55, 0.26, 14), INK, 5.9, 0.56 + i * 0.5, 2.2, H, 0, 0); }            // tyre stack
  P(g, torus(0.55, 0.26, 14), INK, 6.6, 0.85, 3.2, 0, 0.5, 0);                                                    // a tyre leaning on it
  P(g, cyl(0.45, 0.45, 1.2, 12), '#3fa34d', -6.0, 0.9, 1.4); P(g, torus(0.45, 0.05, 12), '#2e7a3a', -6.0, 1.2, 1.4, H, 0, 0); P(g, torus(0.45, 0.05, 12), '#2e7a3a', -6.0, 0.6, 1.4, H, 0, 0); // oil drum
  P(g, box(1.1, 0.9, 0.6), '#d9482b', -3.6, 0.75, 3.2); for (let i = 0; i < 3; i++) P(g, box(1.0, 0.04, 0.05), INK, -3.6, 0.5 + i * 0.25, 3.52);                 // tool chest
  P(g, box(0.5, 0.08, 0.12), '#8d8f96', -3.6, 1.26, 3.2, 0, 0.4, 0);                                              // spanner on top
  for (let i = 0; i < 3; i++) P(g, cone(0.22, 0.6, 8), '#ff9f1c', 2.6 + i * 0.8, 0.6, 4.6);                       // traffic cones
  for (let i = 0; i < 3; i++) P(g, box(0.5, 0.06, 0.5), '#ff9f1c', 2.6 + i * 0.8, 0.33, 4.6);
  P(g, cyl(0.07, 0.07, 6.5, 8), '#d9d3c4', 5.2, 3.5, -2.6);                                                       // flag pole
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) P(g, box(0.4, 0.34, 0.05), (r + c) % 2 ? INK : '#fff', 5.45 + c * 0.4, 6.4 - r * 0.34, -2.6); // checkered flag
  const k = kartDetailed(COLOR); k.scale.setScalar(0.75); k.position.set(0.2, 0.3, 0.4); k.rotation.y = 0.5; g.add(k);  // a kart poking out of the door
  return bake(g);
}

