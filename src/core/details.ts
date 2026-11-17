// The extra pieces Regular start adds on top of the simple models: decoration for each park building,
// and detailed skiers and paper planes. Everything is merged into one mesh per colour (see bake()).
import * as THREE from 'three';
import { P, bake, ball, box, cone, cyl, torus } from './models';

const H = Math.PI / 2, INK = '#1b1220', CREAM = '#f6ead2', GOLD = '#e8b23a', WOOD = '#8a6a45', DARKWOOD = '#5b4636', RED = '#d9482b', GLASS = '#ffe9a8';
type G = THREE.Object3D;

// ---- small reusable bits ----
/** A row of little flags strung between two points. */
function bunting(g: G, x0: number, x1: number, y: number, z: number, colours = [RED, GOLD, '#2ab7a9', CREAM]) {
  const n = Math.max(3, Math.round(Math.abs(x1 - x0) / 0.7));
  for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; P(g, cone(0.26, 0.5, 3), colours[i % colours.length], x0 + (x1 - x0) * t, y - Math.sin(t * Math.PI) * 0.35, z, Math.PI, 0, 0).scale.z = 0.3; }
}
/** A row of light bulbs. */
function bulbs(g: G, x0: number, x1: number, y: number, z: number, n = 8, c = '#ffe9a8') { for (let i = 0; i < n; i++) P(g, ball(0.13, 6), c, x0 + ((x1 - x0) * i) / (n - 1), y, z); }
function windowAt(g: G, x: number, y: number, z: number, w = 1.1, hh = 1.2) {
  P(g, box(w + 0.24, hh + 0.24, 0.1), CREAM, x, y, z); P(g, box(w, hh, 0.14), GLASS, x, y, z);
  P(g, box(0.07, hh, 0.18), CREAM, x, y, z); P(g, box(w, 0.07, 0.18), CREAM, x, y, z); P(g, box(w + 0.4, 0.12, 0.3), CREAM, x, y - hh / 2 - 0.12, z + 0.05);
}
function crate(g: G, x: number, y: number, z: number, s = 0.9, c = '#a57448') {
  P(g, box(s, s, s), c, x, y + s / 2, z); for (const d of [-1, 1]) { P(g, box(s + 0.06, 0.1, s + 0.06), DARKWOOD, x, y + s / 2 + d * s * 0.36, z); }
}
function barrel(g: G, x: number, z: number, c = '#8a6a45') { P(g, cyl(0.42, 0.42, 1.0, 10), c, x, 0.5, z); for (const y of [0.2, 0.8]) P(g, torus(0.43, 0.04, 10), '#3a3440', x, y, z, H); }
function planks(g: G, x0: number, x1: number, y0: number, y1: number, z: number, c = DARKWOOD, step = 0.6) { for (let y = y0; y <= y1; y += step) P(g, box(x1 - x0, 0.05, 0.06), c, (x0 + x1) / 2, y, z); }
function lantern(g: G, x: number, z: number, hgt = 3, c = '#ffd98a') { P(g, cyl(0.07, 0.09, hgt, 6), DARKWOOD, x, hgt / 2, z); P(g, box(0.4, 0.5, 0.4), c, x, hgt + 0.2, z); P(g, cone(0.36, 0.3, 4), INK, x, hgt + 0.6, z, 0, Math.PI / 4, 0); }
function bush(g: G, x: number, z: number, c = '#4f9a4a') { for (const [dx, dy, dz, r] of [[0, 0.4, 0, 0.5], [0.4, 0.3, 0.1, 0.36], [-0.35, 0.3, -0.1, 0.38]]) P(g, ball(r, 7), c, x + dx, dy, z + dz); }
function steps(g: G, w: number, z: number, n = 3, c = '#b7b9be') { for (let i = 0; i < n; i++) P(g, box(w + (n - i) * 0.5, 0.22, 0.5), c, 0, 0.11 + i * 0.22, z + (n - i) * 0.45); }

const BUILDERS: Record<string, (g: G, color: string) => void> = {
  skyslalom(g) {      // tower at (-2.5, -1), runway along x = 2.5
    for (const y of [1.6, 3.4, 5.2]) P(g, torus(1.75 - y * 0.05, 0.08, 16), '#c9b48c', -2.5, y, -1, H);
    for (const [dx, dz] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) P(g, box(0.16, 1.7, 0.16), CREAM, -2.5 + dx, 7.6, -1 + dz);
    P(g, box(3.8, 0.14, 3.8), CREAM, -2.5, 6.78, -1); P(g, cyl(0.04, 0.04, 2.2, 5), '#b9b4a6', -2.5, 10.6, -1); P(g, ball(0.16, 6), RED, -2.5, 11.7, -1);
    P(g, cyl(0.5, 0.1, 0.3, 10), '#b9b4a6', -1.4, 9.9, -1, 0.6); P(g, box(0.9, 1.5, 0.12), INK, -2.5, 0.75, 0.82);                           // radar dish, door
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) P(g, ball(0.14, 6), i % 2 ? '#8fd8ff' : '#ffe14d', 2.5 + s * 1.7, 0.16, -3.2 + i * 1.7);   // runway lights
    for (let i = 0; i < 5; i++) P(g, box(0.34, 0.03, 0.9), CREAM, 1.3 + i * 0.6, 0.15, 4.9);                                                 // threshold stripes
    crate(g, 5.4, 0, 3.6, 0.8); crate(g, 6.1, 0, 3.0, 0.7, '#c9553a'); crate(g, 5.6, 0.8, 3.4, 0.6);
    P(g, box(1.6, 0.5, 0.8), '#3f8fa6', -5.4, 0.55, 2.4); for (const dx of [-0.6, 0.6]) P(g, cyl(0.2, 0.2, 0.14, 8), INK, -5.4 + dx, 0.2, 2.8, H);   // baggage cart
    for (let i = 0; i < 3; i++) P(g, box(0.5, 0.36, 0.5), ['#d9482b', '#e8b23a', '#6f5aa8'][i], -5.9 + i * 0.5, 0.98, 2.4);
    for (let i = 0; i < 7; i++) P(g, cyl(0.05, 0.05, 1, 5), CREAM, -6.5 + i * 0.9, 0.5, -4.2);                                               // fence
    P(g, box(5.6, 0.06, 0.06), CREAM, -3.8, 0.8, -4.2);
  },
  ski(g, color) {      // lodge 7x3x5 centred (0, -1), front at z = 1.5
    planks(g, -3.5, 3.5, 0.4, 2.8, 1.53, DARKWOOD, 0.48);
    windowAt(g, -2.3, 1.7, 1.56); windowAt(g, 2.3, 1.7, 1.56);
    P(g, box(1.1, 2.4, 1.1), '#8d8478', 2.4, 5.4, -2.2); P(g, box(1.3, 0.2, 1.3), '#6b6660', 2.4, 6.7, -2.2);
    for (let i = 0; i < 3; i++) P(g, ball(0.35 + i * 0.14, 7), '#ffffff', 2.5 + i * 0.3, 7.3 + i * 0.7, -2.2);                               // chimney smoke
    for (let i = 0; i < 9; i++) P(g, cone(0.09, 0.5, 4), '#dff1fb', -3.4 + i * 0.85, 2.85, 1.7, Math.PI);                                     // icicles
    for (const [x, z, r] of [[-4.6, 2.2, 0.9], [4.8, 0.4, 1.1], [-3.2, 3.4, 0.6], [5.6, 2.6, 0.7]]) P(g, ball(r, 8), '#f4f9fd', x, r * 0.25, z).scale.y = 0.5;   // drifts
    P(g, ball(0.7, 9), '#ffffff', -4.9, 0.9, 3.2); P(g, ball(0.5, 9), '#ffffff', -4.9, 1.9, 3.2); P(g, ball(0.36, 8), '#ffffff', -4.9, 2.6, 3.2);   // snowman
    P(g, cone(0.08, 0.36, 5), '#ff8f3c', -4.9, 2.6, 3.6, H); P(g, cyl(0.3, 0.3, 0.06, 10), INK, -4.9, 2.94, 3.2); P(g, cyl(0.2, 0.2, 0.3, 10), INK, -4.9, 3.1, 3.2);
    P(g, torus(0.42, 0.09, 10), color, -4.9, 2.3, 3.2, H);
    P(g, box(2.2, 0.12, 0.3), DARKWOOD, 3.2, 1.2, 1.9); for (let i = 0; i < 4; i++) P(g, box(0.16, 2.6, 0.08), ['#4cc9f0', '#ffe14d', '#f15bb5', '#a8c256'][i], 2.4 + i * 0.5, 1.5, 2.0, -0.12);   // ski rack
    for (const [x, z] of [[6.2, -3], [-6.4, 0.6]]) { P(g, cyl(0.16, 0.2, 0.8, 5), DARKWOOD, x, 0.4, z); for (let i = 0; i < 3; i++) P(g, cone(1.1 - i * 0.28, 1.2, 7), '#2f5d4c', x, 1.3 + i * 0.75, z); P(g, cone(0.5, 0.5, 7), '#f4f9fd', x, 3.3, z); }
    P(g, box(2, 0.6, 0.12), CREAM, 0, 3.3, 1.6); P(g, box(2.2, 0.8, 0.08), color, 0, 3.3, 1.56);                                              // sign over the door
    lantern(g, -1.5, 2.3, 2.2); lantern(g, 1.5, 2.3, 2.2);
  },
  snail(g, color) {    // shed 6x3.4x4.5 centred (0, -1); vegetable patch at x 2.5..7.5
    planks(g, -3, 3, 0.4, 3.2, 1.28, '#5f7a50', 0.5);
    P(g, box(1.3, 2.3, 0.12), DARKWOOD, -1.3, 1.15, 1.3); P(g, ball(0.09, 6), GOLD, -0.85, 1.2, 1.4);
    windowAt(g, 1.4, 2.0, 1.3, 1.2, 1.0); P(g, box(1.5, 0.3, 0.4), DARKWOOD, 1.4, 1.25, 1.5);
    for (let i = 0; i < 5; i++) P(g, ball(0.16, 6), ['#f15bb5', '#ffe14d', '#ff8f3c'][i % 3], 0.85 + i * 0.28, 1.5, 1.55);                    // window box
    for (let i = 0; i < 10; i++) { P(g, box(0.16, 0.9, 0.06), CREAM, 2.5 + i * 0.56, 0.45, 2.5); P(g, cone(0.1, 0.16, 4), CREAM, 2.5 + i * 0.56, 0.98, 2.5); }   // picket fence
    P(g, box(5.3, 0.07, 0.05), CREAM, 5.0, 0.6, 2.52);
    for (let i = 0; i < 6; i++) P(g, cone(0.2, 0.5, 5), '#3f8a3f', 3.2 + (i % 3) * 1.7, 1.0, 0.4 + Math.floor(i / 3) * 1.3);                  // leaves on the vegetables
    P(g, cyl(0.3, 0.26, 0.5, 8), '#6f9fb0', -4.2, 0.25, 2.2); P(g, cyl(0.04, 0.06, 0.7, 5), '#6f9fb0', -3.7, 0.5, 2.2, 0, 0, -0.9); P(g, torus(0.2, 0.03, 8), '#6f9fb0', -4.55, 0.35, 2.2);   // watering can
    P(g, box(1.1, 0.4, 0.7), '#c9553a', -5.2, 0.6, 0.2); P(g, cyl(0.26, 0.26, 0.1, 8), INK, -5.2, 0.26, 0.75, H); for (const s of [-1, 1]) P(g, box(0.06, 0.06, 1), DARKWOOD, -5.2 + s * 0.4, 0.75, -0.5);   // wheelbarrow
    for (let i = 0; i < 6; i++) P(g, cyl(0.3, 0.3, 0.02, 8), '#cfe8c0', -1.6 + i * 0.5, 0.06, 3.0 + Math.sin(i) * 0.3);                       // slime trail
    P(g, cyl(0.06, 0.06, 1.2, 5), DARKWOOD, -3.6, 0.6, 3.6); P(g, box(0.6, 0.4, 0.36), color, -3.6, 1.3, 3.6);                                // mailbox
    bush(g, 3.8, -2.6); bush(g, -3.9, -1.4, '#5fa85a');
  },
  regatta(g, color) {  // pier deck 9 x 6 at y 0.9..1.15; boathouse at (-1, -1)
    for (let i = 0; i < 9; i++) P(g, box(0.04, 0.03, 6), DARKWOOD, -4 + i, 1.17, -0.5);                                                       // deck seams
    for (const [x, z] of [[-4.4, 2.4], [-1.5, 2.4], [1.5, 2.4], [4.4, 2.4], [4.4, 0], [4.4, -3.4], [-4.4, -3.4], [-4.4, 0]] as [number, number][]) { P(g, cyl(0.1, 0.1, 1.1, 6), DARKWOOD, x, 1.7, z); P(g, ball(0.14, 6), CREAM, x, 2.3, z); }
    for (const [x, z, w, ry] of [[-2.95, 2.4, 2.9, 0], [0, 2.4, 3, 0], [4.4, 1.2, 2.4, H], [4.4, -1.7, 3.4, H]] as [number, number, number, number][]) P(g, cyl(0.04, 0.04, w, 5), '#c9b48c', x, 2.05, z, 0, ry, H);   // rope rails
    windowAt(g, -2.9, 3.2, 1.03, 0.9, 0.9); windowAt(g, 0.9, 3.2, 1.03, 0.9, 0.9);
    P(g, torus(0.4, 0.13, 12), RED, 1.2, 2.0, 1.06); P(g, torus(0.4, 0.14, 12, ), CREAM, 1.2, 2.0, 1.04).scale.set(1, 1, 0.5);                // life ring
    crate(g, 3.3, 1.15, -2.4, 0.8); crate(g, 3.4, 1.95, -2.4, 0.6, '#8a6a45'); barrel(g, 2.6, 1.6); barrel(g, 3.4, 0.9, '#6f5a3a');
    for (const b of g.children.slice(-6)) b.position.y += 1.15;                                                                               // barrels stand on the deck
    for (const s of [0, 1]) P(g, box(0.1, 3.2, 0.14), '#c9b48c', -4.0 + s * 0.3, 2.7, 1.2, 0, 0, 0.12 - s * 0.24);                            // oars against the wall
    P(g, cyl(0.1, 0.1, 3.6, 6), DARKWOOD, -4.4, 3.0, 2.4); P(g, box(0.4, 0.5, 0.4), '#ffd98a', -4.4, 4.9, 2.4); P(g, cone(0.36, 0.3, 4), INK, -4.4, 5.3, 2.4);
    P(g, ball(0.2, 7), '#ffffff', 4.4, 2.55, -3.4).scale.z = 1.5; P(g, ball(0.12, 6), '#ffffff', 4.4, 2.75, -3.2); P(g, cone(0.05, 0.14, 4), GOLD, 4.4, 2.74, -3.05, H);   // gull
    bunting(g, -3.7, 1.7, 4.5, 1.1, [color, CREAM, '#2f6f86']);
    P(g, box(1.6, 0.5, 0.1), CREAM, -1, 3.9, 1.04);
  },
  sketch(g, color) {   // stall 6 x 2.6 x 3 at (-1, -1.5); easel at x 2.5; pencil at x -4.6
    for (let i = 0; i < 11; i++) P(g, box(0.6, 0.5, 0.1), i % 2 ? CREAM : color, -3.98 + i * 0.6, 2.42, 0.32);                                // awning valance
    P(g, box(6.2, 0.16, 0.7), WOOD, -1, 1.5, 0.3);                                                                                           // counter
    for (let i = 0; i < 5; i++) { P(g, cyl(0.2, 0.17, 0.34, 8), '#b9b4a6', -3.2 + i * 0.7, 1.75, 0.35); P(g, cyl(0.18, 0.18, 0.04, 8), ['#d9482b', '#4361ee', '#ffe14d', '#3fa34d', '#f15bb5'][i], -3.2 + i * 0.7, 1.93, 0.35); }   // paint pots
    P(g, cyl(0.2, 0.2, 0.4, 8), '#8fd8ff', 0.6, 1.78, 0.35); for (let i = 0; i < 4; i++) P(g, cyl(0.03, 0.03, 0.8, 4), ['#8a6a45', RED, GOLD, INK][i], 0.5 + i * 0.07, 2.2, 0.35, 0, 0, -0.2 + i * 0.13);   // brushes in a jar
    for (const [x, y, c] of [[-3, 0.8, '#4cc9f0'], [-1.6, 0.75, '#ffe14d'], [-0.2, 0.8, '#f15bb5']] as [number, number, string][]) { P(g, box(1.0, 0.8, 0.08), GOLD, x, y, 0.04); P(g, box(0.8, 0.6, 0.1), c, x, y, 0.05); }   // pictures on the front
    for (const [x, z, r, c] of [[1.2, 3.2, 0.7, '#d9482b'], [3.6, 3.4, 0.5, '#4361ee'], [0.2, 2.6, 0.4, '#ffe14d'], [4.4, 2.2, 0.35, '#3fa34d']] as [number, number, number, string][]) P(g, cyl(r, r, 0.03, 9), c, x, 0.05, z);   // paint splats
    P(g, cyl(0.4, 0.4, 0.1, 10), WOOD, 0.9, 1.0, 2.4); for (let i = 0; i < 3; i++) P(g, cyl(0.04, 0.05, 1, 5), DARKWOOD, 0.9 + Math.cos(i * 2.1) * 0.28, 0.5, 2.4 + Math.sin(i * 2.1) * 0.28);   // stool
    P(g, cyl(0.6, 0.6, 0.05, 12), '#c9a574', 4.3, 1.4, 1.6, 0.5); for (let i = 0; i < 4; i++) P(g, ball(0.1, 6), ['#d9482b', '#4361ee', '#ffe14d', '#3fa34d'][i], 4.0 + i * 0.2, 1.5, 1.7);   // palette
    bunting(g, -4, 2, 3.6, 0.2);
  },
  fakeartist(g, color) {   // gallery 9 x 5 x 4.5 at (0, -1); columns at z 1.6
    steps(g, 8, 1.6, 3, '#d8cfb8');
    for (const x of [-3.8, -1.3, 1.3, 3.8]) { P(g, box(1.1, 0.3, 1.1), '#f4f0e6', x, 4.7, 1.6); P(g, box(1.0, 0.3, 1.0), '#f4f0e6', x, 0.15, 1.6); for (let i = 0; i < 6; i++) P(g, box(0.05, 4, 0.05), '#d8cfb8', x + Math.cos(i) * 0.44, 2.4, 1.6 + Math.sin(i) * 0.44); }
    const ped = P(g, cyl(0.1, 5.2, 1.6, 3), '#e7d7b1', 0, 6.5, 1.2, 0, Math.PI / 6, 0); ped.scale.z = 0.12;                                   // pediment
    for (const x of [-2.55, 2.55]) { P(g, box(0.9, 2.6, 0.06), color, x, 3.2, 1.35); P(g, cone(0.45, 0.5, 3), color, x, 1.7, 1.35, Math.PI).scale.z = 0.14; }   // banners
    P(g, box(2.0, 3.0, 0.1), GOLD, 0, 1.5, 1.28);                                                                                             // gilded door frame
    for (const x of [-2.4, 2.4]) { P(g, cyl(0.07, 0.1, 1.0, 6), GOLD, x, 0.5, 4.0); P(g, ball(0.12, 6), GOLD, x, 1.05, 4.0); }
    P(g, cyl(0.05, 0.05, 4.8, 5), '#c0392b', 0, 0.85, 4.0, 0, 0, H);                                                                          // velvet rope
    for (const x of [-5.2, 5.2]) { P(g, cyl(0.4, 0.3, 0.6, 8), '#b0705a', x, 0.3, 2.4); P(g, ball(0.6, 8), '#3f8a3f', x, 1.1, 2.4); P(g, ball(0.42, 8), '#3f8a3f', x, 1.9, 2.4); }   // topiaries
    P(g, box(0.9, 1.0, 0.9), '#d8cfb8', 5.4, 0.5, -0.6); P(g, ball(0.34, 8), '#f4f0e6', 5.4, 1.9, -0.6); P(g, cyl(0.3, 0.42, 0.7, 8), '#f4f0e6', 5.4, 1.35, -0.6);   // bust on a plinth
    bulbs(g, -4.6, 4.6, 5.0, 1.75, 12);
  },
  logolab(g, color) {   // workshop 7 x 3.6 x 4.5 at (0, -1); door in the middle
    windowAt(g, -2.3, 2.0, 1.28); windowAt(g, 2.3, 2.0, 1.28);
    P(g, box(1.9, 2.7, 0.08), CREAM, 0, 1.3, 1.27);
    for (let i = 0; i < 4; i++) { P(g, cyl(0.24, 0.24, 0.4, 8), '#b9b4a6', -4.4 + (i % 2) * 0.6, 0.2 + Math.floor(i / 2) * 0.4, 1.9); P(g, cyl(0.2, 0.2, 0.03, 8), ['#e4572e', '#4cc9f0', '#ffe14d', '#9b5de5'][i], -4.4 + (i % 2) * 0.6, 0.42 + Math.floor(i / 2) * 0.4, 1.9); }   // paint cans
    for (const s of [-1, 1]) P(g, box(0.1, 5.4, 0.1), WOOD, 4.3 + s * 0.35, 2.6, 1.9, -0.2);                                                  // ladder
    for (let i = 0; i < 7; i++) P(g, box(0.7, 0.07, 0.08), WOOD, 4.3, 0.5 + i * 0.7, 2.36 - i * 0.14);
    for (const [x, y, c] of [[-3.3, 4.4, '#3fa34d'], [3.0, 7.2, '#f15bb5'], [0.9, 4.5, '#f6ead2']] as [number, number, string][]) { P(g, box(1.3, 0.9, 0.16), c, x, y, 0.75, 0, 0, (x % 2) * 0.12); P(g, cyl(0.05, 0.05, 0.8, 4), '#3f3328', x, y - 0.8, 0.7); }   // extra small signs
    for (const [x0, x1, y] of [[-3.9, -0.9, 6.5], [0, 3.2, 6.9], [-1.5, 0.7, 8.4]]) bulbs(g, x0, x1, y, 0.75, 6);
    P(g, cone(0.6, 1.0, 3), '#ff5fa2', -0.4, 4.6, 1.4, 0, 0, Math.PI).scale.z = 0.14; P(g, box(0.36, 0.8, 0.1), '#ff5fa2', -0.4, 5.4, 1.4);   // neon arrow at the door
    crate(g, -5.2, 0, -0.8, 1.0); crate(g, -5.1, 1.0, -0.8, 0.7, '#c9553a');
    P(g, box(1.5, 0.08, 0.9), WOOD, 5.4, 0.9, 0.2); for (const [dx, dz] of [[-0.6, -0.3], [0.6, -0.3], [-0.6, 0.3], [0.6, 0.3]]) P(g, box(0.08, 0.9, 0.08), DARKWOOD, 5.4 + dx, 0.45, 0.2 + dz);   // workbench
    P(g, box(0.5, 0.06, 0.4), color, 5.3, 0.98, 0.2);
  },
  fib(g, color) {      // booth 6.5 x 3 x 4 at (0, -1); striped panels above
    P(g, box(6.9, 0.18, 0.8), WOOD, 0, 1.4, 1.3);
    bulbs(g, -3.2, 3.2, 5.5, 1.35, 12); bulbs(g, -3.2, 3.2, 3.0, 1.35, 12, '#ffd23f');
    bunting(g, -4.4, 4.4, 3.0, 2.2, [color, CREAM, GOLD]);
    P(g, cone(0.5, 1.2, 10), RED, 2.6, 1.9, 1.5, 0, 0, H); P(g, cyl(0.12, 0.12, 0.4, 8), INK, 3.3, 1.9, 1.5, 0, 0, H);                         // megaphone
    for (let i = 0; i < 4; i++) { P(g, box(0.5, 0.7, 0.04), i % 2 ? CREAM : GOLD, -2.8 + i * 0.36, 1.86, 1.4 + i * 0.03, -0.3, 0, -0.2 + i * 0.13); }   // question cards
    barrel(g, -4.3, 1.4); barrel(g, 4.4, 0.6, '#6f5a3a');
    for (const x of [-0.42, 0.42]) { P(g, ball(0.17, 7), '#ffffff', x, 2.5, 2.05); P(g, ball(0.09, 6), INK, x, 2.5, 2.2); }                   // eyes on the barker
    P(g, cyl(0.7, 0.7, 0.1, 12), INK, 0, 3.1, 1.2); P(g, cyl(0.46, 0.5, 0.7, 12), INK, 0, 3.5, 1.2); P(g, cyl(0.47, 0.47, 0.14, 12), RED, 0, 3.24, 1.2);   // his top hat
    for (const s of [-1, 1]) P(g, torus(0.2, 0.05, 8, ), INK, s * 0.26, 1.9, 2.1).scale.y = 0.5;                                               // moustache
    P(g, cyl(0.22, 0.22, 0.3, 10), '#f15bb5', 1.2, 1.64, 1.4, 0, 0, H); P(g, cyl(0.22, 0.22, 0.3, 10), '#4cc9f0', 1.2, 1.64, 1.05, 0, 0, H);  // ticket rolls
  },
  punchline(g, color) {   // puppet theatre: stage opening between x ±2.7, y 2.4..5.8
    P(g, box(7.4, 0.2, 3.9), GOLD, 0, 2.5, -1); P(g, box(7.2, 0.16, 0.2), GOLD, 0, 5.8, 0.8);
    bulbs(g, -3.2, 3.2, 2.72, 0.9, 10, '#fff1b8');
    for (let i = 0; i < 9; i++) P(g, cone(0.4, 0.7, 6), i % 2 ? '#c0392b' : '#a52a20', -3.2 + i * 0.8, 5.5, 0.85, Math.PI);                   // swagged valance
    for (const x of [-2.5, 2.5]) { P(g, torus(0.24, 0.07, 8), GOLD, x, 3.6, 1.0, H); P(g, cone(0.12, 0.4, 5), GOLD, x, 3.3, 1.05, Math.PI); }  // curtain ties
    for (const [x, c, up] of [[-1.5, CREAM, true], [1.5, '#3a3440', false]] as [number, string, boolean][]) {                                 // comedy and tragedy masks
      P(g, cyl(0.6, 0.5, 0.14, 10), c, x, 8.9, -0.4, H); for (const s of [-1, 1]) P(g, ball(0.1, 6), INK, x + s * 0.22, 9.05, -0.3);
      P(g, torus(0.24, 0.05, 8, ), INK, x, up ? 8.74 : 8.6, -0.3).scale.y = 0.5;
    }
    for (let r = 0; r < 2; r++) { P(g, box(5 - r, 0.12, 0.6), WOOD, 0, 0.6, 3.2 + r * 1.3); for (const s of [-1, 1]) P(g, box(0.12, 0.6, 0.5), DARKWOOD, s * (2.2 - r * 0.5), 0.3, 3.2 + r * 1.3); }   // benches
    for (let i = 0; i < 5; i++) P(g, new THREE.OctahedronGeometry(0.2), GOLD, -2.8 + i * 1.4, 6.9, 0.85);                                     // stars
    planks(g, -3.5, 3.5, 0.3, 2.2, 0.78, DARKWOOD, 0.5);
    P(g, box(2.4, 0.7, 0.1), CREAM, 0, 1.3, 0.8); P(g, box(2.6, 0.9, 0.06), color, 0, 1.3, 0.78);
  },
  hotpotato(g, color) {   // stand 6 x 2.6 x 3.4 at (-1.5, -1); bomb at x 3.6
    for (let i = 0; i < 11; i++) P(g, box(0.6, 0.5, 0.1), i % 2 ? '#c0392b' : CREAM, -4.5 + i * 0.6, 2.42, 1.0);
    crate(g, -5.4, 0, 1.2, 0.9); crate(g, -5.3, 0.9, 1.2, 0.7, '#c9553a'); crate(g, -4.4, 0, 2.0, 0.8);
    for (let i = 0; i < 5; i++) { P(g, cyl(0.1, 0.1, 0.9, 6), ['#ffe14d', '#4cc9f0', '#f15bb5', '#a8c256', '#ff8f3c'][i], -4.6 + (i % 3) * 0.2, 1.3, 1.9 + Math.floor(i / 3) * 0.2, 0.15, 0, -0.2 + i * 0.1); P(g, cone(0.14, 0.3, 6), RED, -4.6 + (i % 3) * 0.2 + (-0.2 + i * 0.1) * -0.5, 1.9, 1.9 + Math.floor(i / 3) * 0.2 + 0.1); }   // rockets in a crate
    P(g, cyl(0.42, 0.34, 0.6, 10), '#6f9fb0', 0.9, 0.3, 2.0); P(g, cyl(0.38, 0.38, 0.04, 10), '#8fd8ff', 0.9, 0.58, 2.0); P(g, torus(0.36, 0.03, 10, Math.PI), '#b9b4a6', 0.9, 0.62, 2.0);   // bucket of water
    P(g, cyl(0.06, 0.06, 1.6, 5), DARKWOOD, 1.6, 0.8, 3.2); const sign = P(g, box(1.1, 1.1, 0.08), '#ffd23f', 1.6, 1.9, 3.2, 0, 0, Math.PI / 4); void sign; P(g, box(0.12, 0.5, 0.1), INK, 1.6, 2.0, 3.26); P(g, ball(0.08, 5), INK, 1.6, 1.6, 3.26);   // warning sign
    for (let i = 0; i < 5; i++) P(g, ball(0.5, 7), '#b9a98a', 2.2 + (i % 3) * 0.9, 0.25 + Math.floor(i / 3) * 0.4, 3.4 - Math.floor(i / 3) * 0.1).scale.y = 0.55;   // sandbags
    P(g, torus(2.22, 0.1, 22), '#3a3440', 3.6, 2.2, 0.8, H); P(g, ball(0.5, 8), '#ffffff', 2.8, 3.2, 2.3).scale.set(1, 1.4, 0.3);              // band and shine on the bomb
    bulbs(g, -4.4, 1.4, 2.95, 1.05, 10, '#ffd23f');
    P(g, box(2.6, 0.7, 0.1), color, -1.5, 3.4, 1.0); P(g, box(2.3, 0.44, 0.12), CREAM, -1.5, 3.4, 1.02);
  },
  agent(g, color) {    // tent: cone radius 5.4, height 8, centred (0, -1); door flap at z 3.4; crystal ball at (3.2, 3.6)
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.39; P(g, box(0.5, 8.4, 0.12), i % 2 ? GOLD : CREAM, Math.sin(a) * 2.8, 4.1, -1 + Math.cos(a) * 2.8, -0.585, a, 0); }   // stripes down the canvas
    for (const s of [-1, 1]) { P(g, box(0.9, 3.2, 0.14), '#c0392b', s * 1.3, 1.9, 3.3, -0.32, 0, s * 0.2); P(g, torus(0.2, 0.06, 8), GOLD, s * 1.5, 1.7, 3.5, H); }   // door drapes
    P(g, box(2.0, 0.04, 3.2), '#8a2f4a', 0, 0.05, 5.2); for (const s of [-1, 1]) P(g, box(0.1, 0.05, 3.2), GOLD, s * 0.9, 0.06, 5.2);          // carpet runner
    lantern(g, -2.6, 5.4, 2.6, '#b9a2ff'); lantern(g, 2.6, 6.6, 2.6, '#b9a2ff');
    P(g, torus(0.5, 0.1, 12, Math.PI * 1.4), GOLD, 0, 10.0, -1, 0, 0, 0.9); for (let i = 0; i < 3; i++) P(g, new THREE.OctahedronGeometry(0.16), GOLD, -0.9 + i * 0.9, 9.3 + (i % 2) * 0.5, -0.2);   // moon and stars
    P(g, cyl(1.0, 1.0, 0.1, 12), '#4f2a78', 3.2, 1.25, 3.6); for (let i = 0; i < 4; i++) P(g, box(0.34, 0.02, 0.5), i % 2 ? CREAM : GOLD, 2.6 + i * 0.22, 1.32, 4.1, 0, -0.3 + i * 0.2, 0);   // cloth and tarot cards
    for (const [x, z, c] of [[1.6, 5.2, '#c0392b'], [4.6, 4.8, '#2ab7a9'], [-3.6, 4.2, GOLD]] as [number, number, string][]) P(g, ball(0.5, 8), c, x, 0.22, z).scale.y = 0.45;   // cushions
    P(g, ball(0.2, 6), '#ffffff', 2.9, 2.5, 4.1).scale.set(1, 1.3, 0.4);                                                                       // shine on the crystal ball
    void color;
  },
  heist(g, color) {    // bank 9 x 5.6 x 4.6 at (0, -1); columns at x ±3.9, z 1.6; vault door in the middle
    steps(g, 8.4, 1.4, 3);
    for (const x of [-3.9, 3.9]) { P(g, box(1.3, 0.34, 1.3), '#d5d7dc', x, 5.55, 1.6); P(g, box(1.2, 0.3, 1.2), '#d5d7dc', x, 0.15, 1.6); }
    for (const x of [-2.9, 2.9]) { P(g, box(1.0, 1.6, 0.1), '#2e3a4a', x, 4.2, 1.32); for (let i = 0; i < 4; i++) P(g, cyl(0.04, 0.04, 1.6, 4), '#5b5d63', x - 0.36 + i * 0.24, 4.2, 1.4); }   // barred windows
    P(g, box(4.4, 0.9, 0.14), '#2e3a4a', 0, 6.05, 1.75); for (let i = 0; i < 4; i++) P(g, box(0.5, 0.56, 0.1), GOLD, -1.2 + i * 0.8, 6.05, 1.84);   // name plate with four gold letters
    bulbs(g, -2.1, 2.1, 6.62, 1.8, 9);
    P(g, torus(2.36, 0.12, 22), '#8a6a2a', 0, 2.7, 1.72); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; P(g, ball(0.1, 6), '#8a6a2a', Math.cos(a) * 2.05, 2.7 + Math.sin(a) * 2.05, 1.76); }   // rivets round the vault
    for (const [x, z] of [[4.9, 2.6], [5.6, 2.2], [5.2, 3.2]]) { P(g, ball(0.5, 8), '#c9b48c', x, 0.42, z).scale.y = 0.85; P(g, cyl(0.16, 0.24, 0.3, 7), '#c9b48c', x, 0.92, z); P(g, torus(0.18, 0.04, 8), DARKWOOD, x, 0.82, z, H); }   // money bags
    P(g, box(0.5, 0.3, 0.7), '#3a3440', -4.3, 5.2, 2.0, 0.3, -0.5, 0); P(g, ball(0.08, 5), RED, -4.15, 5.12, 2.36);                             // security camera
    for (const x of [-5.6, 5.6]) { P(g, cyl(0.1, 0.14, 3.4, 6), '#3a3440', x, 1.7, 4.4); P(g, ball(0.34, 8), '#ffe9a8', x, 3.6, 4.4); }
    P(g, cyl(0.7, 0.7, 0.14, 14), CREAM, 0, 8.0, 0.9, H); P(g, box(0.06, 0.5, 0.06), INK, 0, 8.2, 1.0); P(g, box(0.34, 0.06, 0.06), INK, 0.16, 8.0, 1.0);   // clock
    void color;
  },
  dungeon(g, color) {   // ghost train 9 x 6 x 5 at (0, -1.5); mouth at z 1.05; rails run out the front
    for (let i = 0; i < 7; i++) P(g, box(0.8, 0.8, 0.8), '#34313f', -3.9 + i * 1.3, 6.4, 0.6);                                                 // battlements
    for (let i = 0; i < 6; i++) P(g, box(2.6, 0.12, 0.3), DARKWOOD, 0, 0.06, 1.4 + i * 0.9);                                                    // sleepers
    for (const [x, z, r] of [[-5.4, 2.6, 0.2], [5.6, 3.4, -0.15], [6.4, 1.2, 0.1]] as [number, number, number][]) { P(g, box(0.9, 1.3, 0.24), '#8d8f96', x, 0.65, z, 0, 0, r); P(g, cyl(0.45, 0.45, 0.24, 10, ), '#8d8f96', x - r * 1.3, 1.3, z, H); P(g, box(0.5, 0.08, 0.26), '#5b5d63', x, 0.9, z, 0, 0, r); }   // tombstones
    for (const [x, y] of [[-3.6, 5.2], [3.5, 5.6], [-2.2, 7.4]]) for (const s of [-1, 1]) P(g, cone(0.3, 0.6, 3), INK, x + s * 0.3, y, 1.2, 0, 0, s * 1.2).scale.z = 0.2;   // bats
    P(g, ball(0.6, 9), CREAM, 0, 4.6, 1.2); P(g, box(0.5, 0.3, 0.4), CREAM, 0, 4.1, 1.3); for (const s of [-1, 1]) P(g, ball(0.16, 6), INK, s * 0.22, 4.65, 1.72);   // skull over the mouth
    for (const s of [-1, 1]) { P(g, cyl(0.02, 0.02, 2.2, 4), '#d5d7dc', s * 3.6, 4.4, 1.1, 0, 0, s * 0.8); P(g, cyl(0.02, 0.02, 2.2, 4), '#d5d7dc', s * 3.6, 4.4, 1.1, 0, 0, s * -0.3); P(g, torus(0.5, 0.015, 8), '#d5d7dc', s * 3.6, 4.4, 1.1); }   // cobwebs
    P(g, cyl(0.2, 0.3, 3.4, 6), '#2e2536', -6.4, 1.7, -0.6); for (const [a, l] of [[0.7, 1.6], [-0.6, 1.3], [0.2, 1.0]]) P(g, cyl(0.06, 0.1, l, 5), '#2e2536', -6.4 + Math.sin(a) * l * 0.5, 3.4 + Math.cos(a) * l * 0.5, -0.6, 0, 0, -a);   // dead tree
    lantern(g, -2.8, 3.8, 2.4, '#8dff7a'); lantern(g, 2.8, 3.8, 2.4, '#8dff7a');
    P(g, box(1.9, 0.6, 0.1), color, 0, 5.7, 1.1);
  },
};

/** The decoration Regular start adds to a park building, or null if that ride has none. Built facing +z, like the building itself. */
export function boothDetail(id: string, color: string): THREE.Group | null {
  const build = BUILDERS[id]; if (!build) return null;
  const g = new THREE.Group(); build(g, color);
  return bake(g);
}

/** A skier with goggles, scarf, poles and proper skis. Faces -z (downhill), like the simple one. */
export function skierDetailed(COLOR: string) {
  const g = new THREE.Group(), SKIN = '#f3dcc0';
  for (const s of [-1, 1]) {
    P(g, box(0.24, 0.07, 3.0), GOLD, s * 0.32, 0.08, -0.2); P(g, box(0.24, 0.07, 0.5), GOLD, s * 0.32, 0.2, -1.9, -0.5);                       // skis with turned-up tips
    P(g, box(0.34, 0.3, 0.6), INK, s * 0.32, 0.28, 0.0); P(g, box(0.3, 0.16, 0.2), '#8d8f96', s * 0.32, 0.2, 0.36);                           // boots and bindings
    P(g, cyl(0.17, 0.2, 0.7, 8), '#27457a', s * 0.32, 0.72, -0.08, 0.35); P(g, cyl(0.2, 0.18, 0.6, 8), '#27457a', s * 0.32, 1.2, 0.04, -0.4);  // bent knees
    P(g, cyl(0.14, 0.16, 0.9, 8), COLOR, s * 0.66, 1.7, -0.3, -1.0, 0, s * 0.2); P(g, ball(0.16, 7), INK, s * 0.74, 1.45, -0.74);             // arms and gloves
    P(g, cyl(0.03, 0.03, 2.4, 5), '#b9b4a6', s * 0.8, 0.9, 0.1, 0.75); P(g, cyl(0.16, 0.16, 0.03, 8), INK, s * 0.8, 0.14, 0.86, 0.75);        // poles and baskets
  }
  P(g, box(0.95, 1.3, 0.66), COLOR, 0, 1.75, -0.02, -0.35);                                                                                   // jacket
  P(g, box(0.1, 1.2, 0.04), CREAM, 0, 1.74, -0.4, -0.35); P(g, box(0.97, 0.16, 0.68), CREAM, 0, 1.5, 0.06, -0.35);                            // zip and stripe
  P(g, box(0.56, 0.5, 0.06), CREAM, 0, 1.9, 0.36, -0.35); P(g, box(0.2, 0.26, 0.08), INK, 0, 1.92, 0.4, -0.35);                               // race bib on the back
  P(g, torus(0.36, 0.12, 10), CREAM, 0, 2.36, -0.3, H); P(g, box(0.2, 0.6, 0.08), CREAM, 0.22, 2.3, 0.26, 0.5, 0, -0.2);                      // scarf, flying behind
  P(g, ball(0.48, 12), SKIN, 0, 2.78, -0.36);
  P(g, new THREE.SphereGeometry(0.52, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), COLOR, 0, 2.82, -0.36); P(g, torus(0.5, 0.07, 12), CREAM, 0, 2.84, -0.36, H); P(g, ball(0.16, 7), CREAM, 0, 3.4, -0.36);   // bobble hat
  P(g, box(0.72, 0.24, 0.2), INK, 0, 2.84, -0.76); P(g, box(0.6, 0.16, 0.2), '#ff9f1c', 0, 2.84, -0.8);                                       // goggles
  return bake(g);
}

/** A paper plane with creases, coloured stripes, a paperclip on the nose and a streamer. Nose points at -z. */
export function planeDetailed(COLOR: string) {
  const g = new THREE.Group();
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -2.2, -1.5, 0.25, 1, 0, 0, 1, 0, 0, -2.2, 0, 0, 1, 1.5, 0.25, 1, 0, 0, -2.2, 0, -0.6, 1, 0, 0, 1,
    0, 0, -2.2, 0, 0, 1, -1.5, 0.25, 1, 0, 0, -2.2, 1.5, 0.25, 1, 0, 0, 1, 0, 0, -2.2, 0, 0, 1, 0, -0.6, 1], 3));     // both faces, so the merged mesh needs no double-sided material
  geo.computeVertexNormals();
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(36).fill(0), 2));
  P(g, geo, COLOR);
  for (const s of [-1, 1]) {
    P(g, cyl(0.2, 0.2, 0.02, 10), CREAM, s * 0.9, 0.19, 0.55, 0, 0, s * 0.165); P(g, cyl(0.11, 0.11, 0.03, 10), '#d9482b', s * 0.9, 0.2, 0.55, 0, 0, s * 0.165);   // roundels
    P(g, box(1.1, 0.02, 0.16), CREAM, s * 0.85, 0.165, 0.9, 0, 0, s * 0.165);                                                                  // a stripe along the back edge of each wing
  }
  P(g, box(0.03, 0.03, 3.1), INK, 0, 0.02, -0.6);                                                                                              // centre crease
  P(g, torus(0.1, 0.025, 8), '#b9b4a6', 0, -0.05, -1.7, 0, H, 0).scale.set(1, 2.2, 1);                                                         // paperclip
  for (let i = 0; i < 4; i++) P(g, box(0.14, 0.02, 0.5), i % 2 ? CREAM : COLOR, Math.sin(i * 1.3) * 0.12, -0.3 - i * 0.03, 1.3 + i * 0.5, 0, Math.sin(i * 1.7) * 0.3, 0);   // streamer
  return bake(g);
}
