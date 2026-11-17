// 3D versions of the four mascots, built from small pieces. Regular start shows them in the park and beside their speech bubbles.
import * as THREE from 'three';

const cache = new Map<string, THREE.Material>();
const mat = (c: string) => { let m = cache.get(c); if (!m) cache.set(c, (m = new THREE.MeshLambertMaterial({ color: c, flatShading: true }))); return m; };
const glow = (c: string) => new THREE.MeshBasicMaterial({ color: c });
const glass = (c: string, o: number) => new THREE.MeshLambertMaterial({ color: c, transparent: true, opacity: o, depthWrite: false });
function P(g: THREE.Object3D, geo: THREE.BufferGeometry, c: string | THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, typeof c === 'string' ? mat(c) : c); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); g.add(m); return m;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 14) => new THREE.CylinderGeometry(rt, rb, h, seg);
const ball = (r: number, seg = 14) => new THREE.SphereGeometry(r, seg, Math.max(6, seg - 4));
const cone = (r: number, h: number, seg = 12) => new THREE.ConeGeometry(r, h, seg);
const torus = (r: number, t: number, seg = 18, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 6, seg, arc);
const H = Math.PI / 2, INK = '#1b1220', CREAM = '#f6ead2', GOLD = '#e8b23a', RED = '#d9482b';
/** Two eyes with pupils and a highlight, looking forward (+z). */
function eyes(g: THREE.Object3D, x: number, y: number, z: number, r: number) {
  for (const s of [-1, 1]) { P(g, ball(r), '#ffffff', s * x, y, z); P(g, ball(r * 0.55), INK, s * x, y, z + r * 0.62); P(g, ball(r * 0.2), '#ffffff', s * x + r * 0.2, y + r * 0.25, z + r * 1.05); }
}

/** Gus the Goldfish: a deadpan fish who has lived in the same prize bowl since 1954. */
export function gus() {
  const g = new THREE.Group();
  P(g, cyl(1.9, 2.2, 0.5, 20), '#7a5234', 0, 0.25, 0);                    // wooden stand
  P(g, torus(1.95, 0.1, 24), GOLD, 0, 0.5, 0, H);
  P(g, box(1.3, 0.34, 0.08), GOLD, 0, 0.26, 2.12); P(g, box(1.1, 0.2, 0.1), INK, 0, 0.26, 2.13);   // "since 1954" plaque
  for (let i = 0; i < 30; i++) { const a = i * 2.4, r = 0.2 + (i % 6) * 0.26; P(g, ball(0.16, 6), ['#e39b84', '#8fd8ff', '#f6ead2', '#9bc48a'][i % 4], Math.cos(a) * r, 0.66, Math.sin(a) * r); } // gravel
  P(g, cyl(0.3, 0.36, 0.7, 8), '#b9a48a', -1.0, 1.1, -0.7); P(g, cone(0.34, 0.4, 8), RED, -1.0, 1.65, -0.7);       // little castle
  P(g, box(0.16, 0.26, 0.1), INK, -1.0, 0.95, -0.4);
  for (let i = 0; i < 5; i++) P(g, ball(0.2 - i * 0.02, 6), '#3fa34d', 1.0 + Math.sin(i * 1.3) * 0.16, 1.0 + i * 0.3, -0.6).scale.y = 1.6;      // weed
  // the fish
  const f = new THREE.Group(); f.position.set(0, 2.55, 0.2); f.rotation.y = -0.35; g.add(f);
  P(f, ball(0.95, 18), '#f3871f', 0, 0, 0).scale.set(0.8, 0.92, 1.25);     // body
  P(f, ball(0.7, 14), '#f9b04a', 0, -0.22, 0.2).scale.set(0.74, 0.7, 1.1); // pale belly
  for (let i = 0; i < 3; i++) P(f, torus(0.62 - i * 0.07, 0.035, 14, Math.PI), '#d96b12', 0, 0.1, -0.2 - i * 0.3, 0, 0, 0);                      // scale rows
  for (const s of [-1, 1]) {
    P(f, cone(0.55, 1.0, 8), '#f9b04a', s * 0.12, s * 0.3, -1.55, -H + s * 0.45, 0, 0).scale.x = 0.18;                                          // tail fans
    P(f, cone(0.3, 0.6, 8), '#f9b04a', s * 0.72, -0.25, 0.25, 0, 0, s * 1.9).scale.z = 0.25;                                                    // side fins
  }
  P(f, cone(0.4, 0.7, 8), '#f9b04a', 0, 0.95, -0.2, -0.4, 0, 0).scale.x = 0.2;                                                                  // dorsal fin
  eyes(f, 0.42, 0.28, 0.78, 0.26);
  for (const s of [-1, 1]) P(f, box(0.36, 0.07, 0.07), INK, s * 0.42, 0.6, 1.0, 0, 0, s * -0.12);                                               // flat, unimpressed brows
  P(f, torus(0.16, 0.07, 12), '#d9482b', 0, -0.12, 1.14);                                                                                       // lips
  P(f, cyl(0.42, 0.42, 0.05, 16), CREAM, 0, 0.98, 0.5, 0.15); P(f, cyl(0.26, 0.26, 0.2, 16), CREAM, 0, 1.08, 0.5, 0.15); P(f, cyl(0.27, 0.27, 0.07, 16), RED, 0, 1.02, 0.5, 0.15);   // straw boater
  for (let i = 0; i < 4; i++) P(g, ball(0.08 + i * 0.03, 8), glass('#ffffff', 0.7), 0.5 + i * 0.12, 3.0 + i * 0.35, 0.9);                         // bubbles
  P(g, ball(2.15, 24), glass('#7fd3ee', 0.16), 0, 2.45, 0).scale.y = 0.92;                                                                       // water
  P(g, new THREE.SphereGeometry(2.3, 28, 18, 0, Math.PI * 2, 0.5, Math.PI - 0.5), glass('#ffffff', 0.12), 0, 2.55, 0);                            // bowl
  P(g, torus(1.12, 0.1, 24), glass('#ffffff', 0.6), 0, 4.56, 0, H);                                                                             // rim
  return g;
}

/** Sprocket the Strongman Bear: all muscle and encouragement. */
export function sprocket() {
  const g = new THREE.Group(), FUR = '#8a5a3a', PALE = '#d9b48a';
  for (const s of [-1, 1]) {
    P(g, cyl(0.42, 0.46, 1.0, 10), FUR, s * 0.6, 0.75, 0);                 // legs
    P(g, ball(0.5, 10), FUR, s * 0.62, 0.28, 0.2).scale.set(1, 0.55, 1.4); // feet
    P(g, cyl(0.47, 0.47, 0.3, 10), RED, s * 0.6, 1.1, 0);                  // leotard shorts
    P(g, cyl(0.36, 0.42, 1.3, 10), FUR, s * 1.5, 3.6, 0, 0, 0, s * -0.32); // arms raised
    P(g, ball(0.5, 10), FUR, s * 1.26, 3.0, 0);                            // shoulders
    P(g, ball(0.46, 10), FUR, s * 1.42, 3.35, 0.05);                       // biceps
    P(g, ball(0.36, 10), PALE, s * 1.78, 4.3, 0);                          // paws
    P(g, ball(0.38, 10), FUR, s * 0.68, 4.75, 0); P(g, ball(0.2, 8), PALE, s * 0.68, 4.75, 0.24);     // ears
    P(g, torus(0.24, 0.07, 12, Math.PI * 1.3), INK, s * 0.3, 3.58, 0.98, 0, 0, s > 0 ? -2.4 : -0.75); // handlebar moustache
    for (let i = 0; i < 3; i++) { P(g, cyl(0.62 - i * 0.12, 0.62 - i * 0.12, 0.24, 16), i % 2 ? CREAM : INK, s * (2.4 + i * 0.26), 4.42, 0, 0, 0, H); }   // weight plates
  }
  P(g, ball(1.25, 18), FUR, 0, 2.3, 0).scale.set(1, 1.08, 0.86);           // barrel chest
  for (let i = 0; i < 5; i++) P(g, cyl(1.2 - Math.abs(i - 2) * 0.1, 1.2 - Math.abs(i - 1.5) * 0.1, 0.32, 18), i % 2 ? CREAM : RED, 0, 1.45 + i * 0.32, 0).scale.z = 0.9;   // striped leotard
  for (const s of [-1, 1]) P(g, box(0.3, 1.1, 0.2), RED, s * 0.62, 3.1, 0.55, -0.25, 0, s * 0.28);   // straps
  P(g, cyl(1.24, 1.24, 0.26, 18), INK, 0, 1.36, 0).scale.z = 0.9; P(g, box(0.5, 0.36, 0.14), GOLD, 0, 1.36, 1.1);   // belt and buckle
  // the sprocket on his chest: a gear with teeth
  P(g, cyl(0.36, 0.36, 0.1, 16), GOLD, 0, 2.4, 1.1, H); P(g, cyl(0.14, 0.14, 0.14, 10), INK, 0, 2.4, 1.12, H);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; P(g, box(0.14, 0.16, 0.1), GOLD, Math.cos(a) * 0.42, 2.4 + Math.sin(a) * 0.42, 1.1, 0, 0, a); }
  P(g, ball(0.95, 18), FUR, 0, 4.0, 0.05);                                 // head
  P(g, ball(0.48, 12), PALE, 0, 3.78, 0.78).scale.set(1.1, 0.8, 0.9);      // muzzle
  P(g, ball(0.17, 8), INK, 0, 3.92, 1.16);                                 // nose
  eyes(g, 0.36, 4.2, 0.78, 0.17);
  for (const s of [-1, 1]) P(g, box(0.34, 0.08, 0.08), INK, s * 0.36, 4.46, 0.86, 0, 0, s * 0.3);    // cheerful brows
  P(g, torus(0.2, 0.04, 10, Math.PI), INK, 0, 3.62, 1.12, 0, 0, Math.PI);  // grin
  P(g, cyl(0.07, 0.07, 6.2, 8), '#b9b4a6', 0, 4.42, 0, 0, 0, H);           // barbell
  return g;
}

/** Colonel Kernel: a blustering popcorn officer. */
export function kernel() {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    P(g, cyl(0.2, 0.2, 0.9, 8), '#27457a', s * 0.5, 0.75, 0);              // trouser legs
    P(g, box(0.5, 0.36, 0.9), INK, s * 0.5, 0.2, 0.14);                    // boots
    P(g, box(0.22, 0.9, 0.06), RED, s * 0.5, 0.75, 0.2);                   // trouser stripe (front)
    P(g, box(0.7, 0.16, 0.5), GOLD, s * 1.18, 3.36, 0);                    // epaulettes
    for (let i = 0; i < 4; i++) P(g, cyl(0.03, 0.03, 0.26, 4), GOLD, s * (0.98 + i * 0.14), 3.2, 0.24);   // fringe
    P(g, ball(0.2, 8), '#ffffff', s * 1.72, 1.9, 0.2);                     // white gloves
    P(g, torus(0.3, 0.09, 12, Math.PI * 1.2), '#ffffff', s * 0.34, 4.0, 0.9, 0, 0, s > 0 ? -2.3 : -0.6);  // walrus moustache
  }
  // popcorn-box body: red and white panels, wider at the top
  for (let i = 0; i < 9; i++) { const x = (i - 4) * 0.25; P(g, box(0.25, 2.1, 1.3 - Math.abs(i - 4) * 0.02), i % 2 ? RED : CREAM, x, 2.3, 0).scale.x = 1; }
  for (let i = 0; i < 9; i++) P(g, box(0.27, 0.16, 1.36), i % 2 ? CREAM : RED, (i - 4) * 0.25, 3.42, 0);                 // scalloped rim
  P(g, cyl(0.42, 0.42, 0.1, 18), GOLD, 0, 2.6, 0.67, H); P(g, cyl(0.3, 0.3, 0.12, 18), RED, 0, 2.6, 0.68, H);          // box emblem
  for (let i = 0; i < 4; i++) { P(g, box(0.2, 0.26, 0.06), ['#4361ee', RED, '#3fa34d', GOLD][i], -0.7 + i * 0.26, 3.0, 0.68); P(g, cyl(0.1, 0.1, 0.05, 10), GOLD, -0.7 + i * 0.26, 2.8, 0.68, H); }   // medals
  P(g, cyl(0.16, 0.18, 1.5, 8), '#27457a', -1.5, 2.6, 0.1, 0, 0, -0.35); P(g, cyl(0.16, 0.18, 1.5, 8), '#27457a', 1.5, 2.6, 0.1, 0, 0, 0.35);   // arms
  P(g, cyl(0.05, 0.05, 2.0, 6), '#7a5234', 2.0, 1.4, 0.3, 0, 0, 0.5); P(g, ball(0.1, 8), GOLD, 2.47, 2.28, 0.3);        // swagger stick
  // the head: one big popped kernel, made of puffs
  for (const [x, y, z, r] of [[0, 4.3, 0, 0.85], [-0.6, 4.6, 0.1, 0.5], [0.6, 4.6, 0.1, 0.5], [0, 5.0, 0, 0.55], [-0.5, 4.0, 0.2, 0.45], [0.5, 4.0, 0.2, 0.45], [0, 4.5, -0.6, 0.6], [-0.3, 5.05, 0.3, 0.36], [0.35, 4.95, 0.35, 0.34]]) P(g, ball(r, 12), '#fff4d6', x, y, z);
  for (const [x, y, z] of [[-0.7, 3.6, 0.3], [0.75, 3.62, 0.2], [0, 3.56, -0.4], [-0.3, 3.6, 0.55], [0.35, 3.58, 0.5]]) P(g, ball(0.3, 8), '#fff4d6', x, y, z);    // loose popcorn at the rim
  P(g, ball(0.2, 8), '#e8a33a', 0.2, 4.7, 0.78).scale.set(1, 0.7, 0.5);    // a bit of golden hull
  eyes(g, 0.32, 4.42, 0.72, 0.17);
  P(g, torus(0.24, 0.035, 14), GOLD, 0.32, 4.42, 0.86); P(g, cyl(0.012, 0.012, 0.9, 4), GOLD, 0.6, 4.0, 0.84, 0, 0, -0.3);   // monocle and chain
  for (const s of [-1, 1]) P(g, box(0.4, 0.1, 0.1), '#ffffff', s * 0.32, 4.72, 0.8, 0, 0, s * -0.35);                  // stern white brows
  // peaked cap
  P(g, cyl(0.8, 0.62, 0.36, 18), '#27457a', 0, 5.5, 0); P(g, cyl(0.64, 0.64, 0.16, 18), RED, 0, 5.3, 0);
  P(g, cyl(0.66, 0.66, 0.06, 18, ), INK, 0, 5.22, 0.36).scale.set(1, 1, 0.9); P(g, ball(0.14, 8), GOLD, 0, 5.46, 0.72);
  P(g, torus(0.64, 0.04, 18), GOLD, 0, 5.38, 0, H);
  return g;
}

/** Madame Bulb: a glowing diva who has never met a spotlight she didn't deserve. */
export function bulb() {
  const g = new THREE.Group(), GOWN = '#6f3fa0', DEEP = '#4f2a78', PINK = '#f15bb5';
  for (let i = 0; i < 7; i++) P(g, cyl(0.62 + i * 0.16, 0.7 + i * 0.16, 0.42, 20), i % 2 ? DEEP : GOWN, 0, 2.9 - i * 0.4, 0);   // tiered gown
  P(g, cyl(1.75, 1.85, 0.16, 20), GOLD, 0, 0.3, 0);                        // gold hem
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; P(g, ball(0.06, 6), GOLD, Math.cos(a) * 1.2, 1.9, Math.sin(a) * 1.2); }   // sequins
  P(g, cyl(0.5, 0.62, 0.7, 16), GOWN, 0, 3.35, 0);                         // bodice
  // feather boa round the shoulders
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; P(g, ball(0.3, 8), i % 2 ? PINK : '#ff8fd0', Math.cos(a) * 0.82, 3.62 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.72); }
  for (let i = 0; i < 5; i++) P(g, ball(0.26 - i * 0.02, 8), i % 2 ? '#ff8fd0' : PINK, 0.78 + i * 0.08, 3.4 - i * 0.36, 0.5);                // boa end hanging down
  for (const s of [-1, 1]) {
    P(g, cyl(0.12, 0.14, 1.3, 8), CREAM, s * 1.02, 3.0, 0.25, 0.3, 0, s * (s > 0 ? -1.0 : 0.5));   // long gloves
    P(g, ball(0.16, 8), CREAM, s > 0 ? 1.62 : -1.3, s > 0 ? 3.42 : 2.5, 0.42);
  }
  // an ostrich-feather fan in the raised hand
  for (let i = 0; i < 7; i++) { const a = -0.9 + i * 0.3; P(g, cone(0.2, 1.2, 6), i % 2 ? '#ff8fd0' : PINK, 1.62 + Math.sin(a) * 0.6, 3.95 + Math.cos(a) * 0.5, 0.42, 0, 0, -a).scale.z = 0.25; }
  // screw base for a neck
  for (let i = 0; i < 4; i++) P(g, torus(0.4 - i * 0.02, 0.09, 16), '#b9b4a6', 0, 3.8 + i * 0.16, 0, H);
  P(g, cyl(0.36, 0.42, 0.7, 14), '#8d8f96', 0, 4.05, 0);
  // pearls
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; P(g, ball(0.09, 8), '#ffffff', Math.cos(a) * 0.5, 3.74 - Math.max(0, Math.sin(a)) * 0.2, Math.sin(a) * 0.5); }
  // the bulb: a glowing glass head with a filament
  P(g, ball(1.0, 22), glow('#ffe9a8'), 0, 5.25, 0);
  P(g, cyl(0.42, 0.62, 0.5, 16), glow('#ffe9a8'), 0, 4.45, 0);
  P(g, ball(1.14, 22), glass('#fff6d6', 0.3), 0, 5.25, 0);                 // halo
  P(g, torus(0.2, 0.03, 12), '#d9871f', 0, 5.15, -0.3); P(g, cyl(0.02, 0.02, 0.6, 4), '#d9871f', -0.2, 4.8, -0.3); P(g, cyl(0.02, 0.02, 0.6, 4), '#d9871f', 0.2, 4.8, -0.3);
  eyes(g, 0.36, 5.4, 0.86, 0.19);
  for (const s of [-1, 1]) {
    P(g, box(0.42, 0.14, 0.1), '#6f3fa0', s * 0.36, 5.55, 0.98, 0, 0, s * -0.2);            // heavy eyelids
    for (let i = 0; i < 3; i++) P(g, cyl(0.015, 0.015, 0.22, 4), INK, s * (0.26 + i * 0.12), 5.68, 1.0, 0, 0, s * (-0.2 - i * 0.25));   // lashes
    P(g, ball(0.14, 8), '#ff9aa8', s * 0.6, 5.08, 0.78).scale.z = 0.4;                      // blush
    P(g, ball(0.1, 8), GOLD, s * 1.0, 5.0, 0.1); P(g, ball(0.07, 8), GOLD, s * 1.0, 4.82, 0.1);   // drop earrings
  }
  P(g, torus(0.15, 0.06, 12), '#d9203f', 0, 4.94, 0.96).scale.y = 0.6;     // lips
  P(g, ball(0.035, 6), INK, 0.3, 4.98, 0.94);                              // beauty mark
  // a jewelled turban with a plume
  for (let i = 0; i < 4; i++) P(g, torus(0.86 - i * 0.14, 0.2, 20), i % 2 ? GOWN : DEEP, 0, 5.92 + i * 0.2, -0.05, H + 0.15 * (i % 2 ? 1 : -1));
  P(g, ball(0.2, 8), '#2ab7a9', 0, 6.05, 0.86); P(g, torus(0.22, 0.04, 12), GOLD, 0, 6.05, 0.86);
  for (let i = 0; i < 3; i++) P(g, cone(0.2, 1.3, 6), ['#ff8fd0', '#ffffff', PINK][i], -0.2 + i * 0.2, 7.0, 0.3, -0.15, 0, 0.25 - i * 0.25).scale.z = 0.3;
  return g;
}

export const MASCOT_DRAFTS: [string, () => THREE.Group][] = [['Gus the Goldfish', gus], ['Sprocket the Strongman Bear', sprocket], ['Colonel Kernel', kernel], ['Madame Bulb', bulb]];
/** The model for each mascot id used in host/mascot.ts. */
export const MASCOT_MODELS: Record<string, () => THREE.Group> = { gus, sprocket, kernel, bulb };

// Where the portrait camera looks for each mascot: height of the face, and how far back to stand.
const FRAME: Record<string, [number, number]> = { gus: [2.7, 9.5], sprocket: [3.6, 11], kernel: [3.9, 10.5], bulb: [4.9, 10.5] };
const portraits = new Map<string, string>();
/** A small picture of a mascot, rendered once and reused. Returns '' if the browser can't draw it. */
export function portrait(id: string): string {
  const done = portraits.get(id); if (done != null) return done;
  let url = '';
  try {
    const make = MASCOT_MODELS[id], [y, d] = FRAME[id] ?? [3.5, 10];
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(220, 220, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#fff1dc', '#6a4a7a', 1.7));
    const key = new THREE.DirectionalLight('#ffe0b8', 2); key.position.set(-6, 10, 12); scene.add(key);
    const m = make(); m.rotation.y = -0.3; scene.add(m);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.5, 100); cam.position.set(0, y + 1.2, d); cam.lookAt(0, y, 0);
    renderer.render(scene, cam);
    url = renderer.domElement.toDataURL('image/png');
    scene.traverse((o: any) => { o.geometry?.dispose?.(); });
    renderer.dispose(); renderer.forceContextLoss();
  } catch { /* no WebGL: the emoji stands in */ }
  portraits.set(id, url);
  return url;
}
