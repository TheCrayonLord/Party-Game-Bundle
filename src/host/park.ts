// The walk-around menu: an old carnival seen from a high angle. Players appear at the front gate
// and choose a game by walking to it; when most of them stand at the same ride, it starts.
import * as THREE from 'three';
import { clamp, h, pick } from '../core/util';
import type { GameDef } from './ctx';
import type { Player, Room } from './room';

const ZONE_COLORS: Record<string, string> = { Speedway: '#c9553a', Lagoon: '#3f8fa6', 'Art Alley': '#d9a441', Midway: '#b0527a', 'Fortune Tent': '#6f5aa8', 'Haunted Manor': '#4f6b5a' };
const XMAX = 50, ZMIN = -30, ZMAX = 33, SPEED = 15, PAD_R = 4.6;
const SPAWN = { x: 0, z: 27 };

/** Where each ride stands: x, z and which way it faces (degrees; 0 = towards the gate). Hand-placed so the park feels grown, not planned. */
const LAYOUT: Record<string, [number, number, number]> = {
  tiltkart: [-38, -21, 20], skyslalom: [-19, -25, 5], ski: [0, -26, 0], snail: [-43, -3, 35],
  regatta: [24, -24, -10], sketch: [44, -2, -35], fakeartist: [27, -6, -15], logolab: [42, 15, -40],
  fib: [-22, -5, 15], punchline: [5, -8, 0], hotpotato: [-14, 13, 25], agent: [22, 13, -20],
  heist: [-44, 16, 40], dungeon: [-30, 22, 30],
};
const SPARE: [number, number, number][] = [[0, -26, 0], [10, 24, -10], [-6, 26, 10]];   // for any ride without a hand-picked spot
type Tick = (t: number) => void;

interface Booth { game: GameDef; x: number; z: number; px: number; pz: number; open: boolean; label: HTMLElement; count: HTMLElement; pad: THREE.Mesh; ring: THREE.Mesh; shut: THREE.Mesh; votes: number }
interface Guest { p: Player; g: THREE.Group; x: number; z: number; mx: number; mz: number; face: number; tx: number; tz: number; think: number; at: Booth | null; live: string }

export interface ParkOverlays { ticket: HTMLElement; mascot: HTMLElement; controls: HTMLElement }

export class Park {
  private renderer = new THREE.WebGLRenderer({ antialias: true });
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(36, 16 / 9, 1, 500);
  private booths: Booth[] = [];
  private guests = new Map<string, Guest>();
  private puffs: { m: THREE.Mesh; life: number }[] = [];
  private spinners: THREE.Object3D[] = [];
  private ticks: Tick[] = [];
  private labels = h('div.park-labels');
  private banner = h('div.park-banner');
  private overlay = h('div.park-overlay');
  private raf = 0;
  private last = performance.now();
  private alive = true;
  private countdown = 0;
  private choiceKey = '';

  constructor(private root: HTMLElement, private room: Room, games: GameDef[], private fits: (g: GameDef) => boolean, private start: (g: GameDef) => void) {
    const { scene, renderer } = this;
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.domElement.className = 'park-canvas';
    scene.background = new THREE.Color('#3b2752');
    scene.fog = new THREE.Fog('#6d3566', 110, 230);
    scene.add(new THREE.AmbientLight('#ffdcc0', 1.35));
    const sun = new THREE.DirectionalLight('#ffab73', 1.5); sun.position.set(-30, 60, 40); scene.add(sun);
    root.replaceChildren(h('div.park', renderer.domElement, this.labels, this.banner, this.overlay));
    this.buildScenery();
    this.buildBooths(games);
    this.fit();
    addEventListener('resize', this.fit);
    this.raf = requestAnimationFrame(this.frame);
  }

  private mat(c: string) { return new THREE.MeshLambertMaterial({ color: c, flatShading: true }); }
  private add(geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene) {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); parent.add(m); return m;
  }

  // Small shape helpers; every building is made from these.
  private lit(c: string) { return new THREE.MeshBasicMaterial({ color: c }); }
  private box(g: THREE.Object3D, w: number, hh: number, d: number, c: string | THREE.Material, x = 0, y = 0, z = 0) { return this.add(new THREE.BoxGeometry(w, hh, d), typeof c === 'string' ? this.mat(c) : c, x, y, z, g); }
  private cyl(g: THREE.Object3D, rt: number, rb: number, hh: number, c: string | THREE.Material, x = 0, y = 0, z = 0, seg = 8) { return this.add(new THREE.CylinderGeometry(rt, rb, hh, seg), typeof c === 'string' ? this.mat(c) : c, x, y, z, g); }
  private cone(g: THREE.Object3D, r: number, hh: number, c: string | THREE.Material, x = 0, y = 0, z = 0, seg = 8) { return this.add(new THREE.ConeGeometry(r, hh, seg), typeof c === 'string' ? this.mat(c) : c, x, y, z, g); }
  private ball(g: THREE.Object3D, r: number, c: string | THREE.Material, x = 0, y = 0, z = 0) { return this.add(new THREE.SphereGeometry(r, 8, 6), typeof c === 'string' ? this.mat(c) : c, x, y, z, g); }
  /** A flat blob on the ground: ponds, plazas, patches of tarmac. */
  private patch(r: number, c: string, x: number, z: number, sx = 1, sz = 1, y = 0.02, seg = 9) {
    const m = this.add(new THREE.CircleGeometry(r, seg), this.mat(c), x, y, z); m.rotation.x = -Math.PI / 2; m.rotation.z = x * 0.37; m.scale.set(sx, sz, 1); return m;
  }
  /** A dirt trail that wanders through the given points. */
  private trail(pts: [number, number][], width: number, c = '#bfa77f') {
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    const n = Math.max(8, Math.round(curve.getLength() / 1.5)), pos: number[] = [], idx: number[] = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), w = (width / 2) * (0.85 + 0.3 * Math.sin(i * 1.7 + pts[0][0]));   // uneven edges
      pos.push(p.x - t.z * w, 0.03, p.z + t.x * w, p.x + t.z * w, 0.03, p.z - t.x * w);
      if (i < n) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    this.scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color: c, side: THREE.DoubleSide })));
  }

  private buildScenery() {
    const s = this.scene;
    const ground = this.add(new THREE.PlaneGeometry(400, 300), this.mat('#566349'), 0, 0, 0); ground.rotation.x = -Math.PI / 2;       // tired old grass
    // Each corner of the park has its own ground: tarmac by the speedway, a pond, cobbles in Art Alley, dead earth by the manor.
    this.patch(17, '#5a5560', -30, -19, 1.25, 0.8);
    this.patch(11, '#2f8fb0', 40, -19, 1.1, 0.9, 0.03); this.patch(12.2, '#d9c79a', 40, -19, 1.1, 0.9, 0.02);
    this.patch(15, '#8f8a80', 37, 6, 0.9, 1.25);
    this.patch(16, '#4a4a3c', -37, 20, 1.05, 0.75);
    this.patch(9, '#c8b189', 0, 7, 1.15, 0.9, 0.035);          // the plaza where the paths meet
    this.trail([[0, 36], [2, 27], [-2, 17], [0, 8]], 6.5);      // gate to plaza

    // Front gate: two faded pillars and an arch.
    for (const x of [-7, 7]) { this.box(s, 2.4, 10, 2.4, '#c9553a', x, 5, ZMAX + 1); this.ball(s, 1.5, this.lit('#ffe2a0'), x, 11, ZMAX + 1); }
    this.box(s, 18, 2.6, 1.6, '#e7d7b1', 0, 10.2, ZMAX + 1);
    for (let i = -3; i <= 3; i++) this.ball(s, 0.4, this.lit(i % 2 ? '#ffd27a' : '#ff8f6b'), i * 2.2, 8.6, ZMAX + 1.9);
    for (let x = -XMAX - 2; x <= XMAX + 2; x += 3) if (Math.abs(x) > 9) this.box(s, 0.6, 2.4, 0.4, '#d8c9a6', x, 1.2, ZMAX + 1.5).rotation.z = Math.sin(x) * 0.12;   // a wonky picket fence

    // A ring of string lights round the plaza, and crooked lamp posts along the trails.
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2 + 0.3; this.cyl(s, 0.18, 0.24, 8, '#5b4636', Math.cos(a) * 11, 4, 7 + Math.sin(a) * 9, 5); }
    for (let i = 0; i < 42; i++) { const a = (i / 42) * Math.PI * 2 + 0.3, sag = Math.abs(Math.sin((i / 42) * Math.PI * 6)) * 1.6; this.ball(s, 0.3, this.lit(['#ffd27a', '#ff8f6b', '#9fe0d8'][i % 3]), Math.cos(a) * 11, 8 - sag, 7 + Math.sin(a) * 9); }
    for (const [x, z, lean] of [[-12, 24, 0.1], [13, 22, -0.08], [-30, 6, 0.06], [32, -12, -0.1], [-10, -16, 0.08], [14, -18, -0.05], [-46, 8, 0.1], [47, 8, -0.07]]) {
      const post = this.cyl(s, 0.16, 0.22, 6.5, '#3f3328', x, 3.25, z, 5); post.rotation.z = lean; this.ball(s, 0.55, this.lit('#ffd98a'), x - lean * 6, 6.7, z);
    }
    // Clutter: barrels, crates and a bench or two.
    for (const [x, z] of [[-8, 2], [9, 3], [-27, 12], [33, 22], [-16, -14], [15, 26], [-48, -12], [48, -8]]) this.cyl(s, 0.9, 0.9, 1.6, '#8a6a45', x, 0.8, z);
    for (const [x, z] of [[11, -2], [-33, -8], [30, 2], [-20, 27]]) this.box(s, 1.6, 1.4, 1.6, '#a98b5e', x, 0.7, z).rotation.y = x;
    for (const [x, z, r] of [[-6, 13, 0.5], [7, 14, -0.5]]) { const b = this.box(s, 4, 0.4, 1.2, '#7a5d3c', x, 1, z); b.rotation.y = r; }

    // A creaky Ferris wheel and the big top loom behind the rides.
    const wheel = new THREE.Group(); wheel.position.set(34, 15, -42);
    this.add(new THREE.TorusGeometry(12, 0.5, 6, 20), this.mat('#d8c9a6'), 0, 0, 0, wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (i < 4) this.box(wheel, 24, 0.35, 0.35, '#d8c9a6').rotation.z = a;
      this.box(wheel, 2.6, 2.2, 2, ['#c9553a', '#d9a441', '#3f8fa6', '#b0527a'][i % 4], Math.cos(a) * 12, Math.sin(a) * 12, 0);
    }
    s.add(wheel); this.spinners.push(wheel);
    for (const x of [30, 38]) this.box(s, 0.8, 17, 0.8, '#5b4636', x, 8, -42).rotation.z = x < 34 ? -0.25 : 0.25;
    this.cyl(s, 13, 13, 6, '#e7d7b1', -30, 3, -46, 12); this.cone(s, 14.5, 9, '#c9553a', -30, 10.5, -46, 12); this.ball(s, 0.8, this.lit('#ffe2a0'), -30, 15.5, -46);
    for (let i = 0; i < 30; i++) {      // scruffy trees round the edge
      const side = i % 2 ? 1 : -1, x = side * (XMAX + 5 + (i * 7) % 16), z = ZMIN - 8 + ((i * 13) % 74), hgt = 5 + (i % 4);
      this.cyl(s, 0.4, 0.5, 3, '#5b4636', x, 1.5, z, 5); this.cone(s, 2.6 + (i % 3) * 0.4, hgt, i % 3 ? '#3f5a49' : '#4d6248', x, 3 + hgt / 2, z, 6);
    }
  }

  /** Each ride's building says what's inside. Built facing +z around the origin; returns an animation if it has one. */
  private building(id: string, g: THREE.Group, color: string): Tick | void {
    const W = '#e7d7b1', WOOD = '#8a6a45', DARK = '#2b1d2e';
    switch (id) {
      case 'tiltkart': {          // pit garage, checkered awning, tyres, a parked kart
        this.box(g, 9, 4, 5, '#8d8f96', 0, 2, -1); this.box(g, 6, 3, 0.3, DARK, 0, 1.5, 1.55);
        for (let i = 0; i < 8; i++) this.box(g, 1.15, 0.3, 2.4, i % 2 ? '#f4f0e6' : DARK, -4.03 + i * 1.15, 4.3, 2.4).rotation.x = 0.25;
        for (let i = 0; i < 3; i++) this.cyl(g, 0.8, 0.8, 0.5, DARK, 5.6, 0.25 + i * 0.5, 1.5, 10);
        this.box(g, 1.3, 0.5, 2.2, color, -5.6, 0.6, 2.5); this.ball(g, 0.4, W, -5.6, 1.2, 2.3);
        break;
      }
      case 'skyslalom': {         // little airfield: control tower, windsock, runway, paper plane
        this.cyl(g, 1.4, 1.8, 7, W, -2.5, 3.5, -1); this.box(g, 3.6, 1.6, 3.6, '#7fc4d6', -2.5, 7.6, -1); this.cone(g, 2.8, 1.2, color, -2.5, 9, -1, 4).rotation.y = Math.PI / 4;
        this.box(g, 3, 0.1, 9, '#4a4750', 2.5, 0.08, 1); for (let i = 0; i < 4; i++) this.box(g, 0.3, 0.12, 1, '#f4f0e6', 2.5, 0.1, -2.5 + i * 2.2);
        this.cyl(g, 0.12, 0.12, 5, WOOD, 5.2, 2.5, -2.5, 5);
        const sock = this.cone(g, 0.6, 2.4, '#ff8f3c', 6.3, 4.8, -2.5, 6); sock.rotation.z = -Math.PI / 2;
        const plane = this.cone(g, 0.9, 2.6, '#f4f0e6', 2.5, 0.7, 2.5, 3); plane.rotation.x = Math.PI / 2; plane.scale.y = 1; plane.scale.z = 0.35;
        return (t) => { sock.rotation.y = Math.sin(t * 2.3) * 0.5; sock.position.z = -2.5 + Math.sin(t * 2.3) * 0.5; };
      }
      case 'ski': {               // ski lodge: A-frame with a snowy roof, skis, and a chairlift
        const snow = this.add(new THREE.CircleGeometry(8, 9), this.mat('#eef4f8'), 0, 0.04, 0.5, g); snow.rotation.x = -Math.PI / 2;
        this.box(g, 7, 3, 5, WOOD, 0, 1.5, -1);
        const roof = this.cone(g, 5.6, 5, '#f4f8fb', 0, 5.4, -1, 4); roof.rotation.y = Math.PI / 4; roof.scale.z = 0.85;
        this.box(g, 1.6, 2.2, 0.3, '#5b3f2a', 0, 1.1, 1.55);
        for (const sx of [-0.25, 0.25]) this.box(g, 0.25, 3.6, 0.12, color, 3.2 + sx, 1.9, 1.7).rotation.z = sx * 0.8;
        this.cyl(g, 0.2, 0.25, 8, '#6b6660', -5.5, 4, -2, 5); this.box(g, 3, 0.2, 0.2, '#6b6660', -5.5, 8, -2);
        const chair = this.box(g, 1.2, 1, 0.8, color, -4.4, 6.6, -2);
        return (t) => { chair.position.x = -5.5 + Math.sin(t * 0.8) * 1.3; chair.rotation.z = Math.sin(t * 1.6) * 0.15; };
      }
      case 'snail': {             // garden shed, vegetable patch, and a giant snail on the roof
        this.box(g, 6, 3.4, 4.5, '#7d9a6a', 0, 1.7, -1); const roof = this.cone(g, 4.8, 2.4, '#8a5a44', 0, 4.6, -1, 4); roof.rotation.y = Math.PI / 4;
        const shell = this.add(new THREE.TorusGeometry(1.1, 0.75, 6, 12), this.mat(color), 0.4, 6.6, -1, g); this.ball(g, 0.8, '#e9cfa0', -1.2, 6.2, -1);
        const eyeL = this.cyl(g, 0.08, 0.08, 1, '#e9cfa0', -1.5, 7.2, -0.7, 4), eyeR = this.cyl(g, 0.08, 0.08, 1, '#e9cfa0', -1.5, 7.2, -1.3, 4);
        this.box(g, 5, 0.3, 2.4, '#5b4636', 5, 0.15, 1); for (let i = 0; i < 6; i++) this.ball(g, 0.45, i % 2 ? '#4f9a4a' : '#e0803a', 3.2 + (i % 3) * 1.7, 0.5, 0.4 + Math.floor(i / 3) * 1.3);
        return (t) => { shell.rotation.z = Math.sin(t * 0.7) * 0.12; eyeL.rotation.z = Math.sin(t * 1.5) * 0.3; eyeR.rotation.z = Math.cos(t * 1.5) * 0.3; };
      }
      case 'regatta': {           // boathouse on a pier, a moored boat bobbing beside it
        this.box(g, 9, 0.5, 6, WOOD, 0, 0.9, -0.5); for (const [x, z] of [[-4, 2], [4, 2], [-4, -3], [4, -3]]) this.cyl(g, 0.3, 0.3, 1.8, '#5b4636', x, 0.3, z, 5);
        this.box(g, 5.5, 3.2, 4, '#e9f3f5', -1, 2.8, -1); const roof = this.cone(g, 4.4, 2.2, color, -1, 5.5, -1, 4); roof.rotation.y = Math.PI / 4;
        this.box(g, 2.4, 2.2, 0.3, '#2f6f86', -1, 2.2, 1.05);
        const boat = new THREE.Group(); boat.position.set(6.5, 0.5, 1); g.add(boat);
        this.box(boat, 1.5, 0.7, 3, '#d9553a'); this.cyl(boat, 0.08, 0.08, 3, W, 0, 1.6, 0, 4); this.cone(boat, 1, 2.2, W, 0.1, 1.9, -0.3, 3).scale.x = 0.2;
        this.cyl(g, 0.5, 0.7, 1.2, '#e4572e', 3.6, 1.7, 2, 6);
        return (t) => { boat.position.y = 0.5 + Math.sin(t * 2) * 0.18; boat.rotation.z = Math.sin(t * 1.4) * 0.12; };
      }
      case 'sketch': {            // artist's stall: a huge easel and a giant pencil
        this.box(g, 6, 2.6, 3, W, -1, 1.3, -1.5); this.box(g, 6.6, 0.4, 3.6, color, -1, 2.8, -1.5);
        for (const sx of [-1.4, 1.4]) this.box(g, 0.3, 6, 0.3, WOOD, 2.5 + sx, 3, 1).rotation.z = -sx * 0.12;
        this.box(g, 3.6, 3, 0.2, '#fbf5e6', 2.5, 3.6, 1.2); this.box(g, 2.4, 0.25, 0.25, '#d9482b', 2.4, 4, 1.35).rotation.z = 0.5; this.ball(g, 0.5, '#4361ee', 3.2, 3.1, 1.35);
        const pencil = new THREE.Group(); pencil.position.set(-4.6, 0, 1.2); pencil.rotation.z = 0.22; g.add(pencil);
        this.cyl(pencil, 0.55, 0.55, 6, '#f3c63f', 0, 3.6, 0, 6); this.cone(pencil, 0.55, 1.2, '#e9cfa0', 0, 0.6, 0, 6).rotation.x = Math.PI; this.cyl(pencil, 0.56, 0.56, 0.7, '#f08aa0', 0, 6.9, 0, 6);
        break;
      }
      case 'fakeartist': {        // a pompous little gallery with one painting hung very crooked
        this.box(g, 9, 5, 4.5, W, 0, 2.5, -1); this.box(g, 10, 0.7, 5.4, '#c9b48c', 0, 5.3, -1);
        for (const x of [-3.8, -1.3, 1.3, 3.8]) this.cyl(g, 0.4, 0.45, 4.6, '#f4f0e6', x, 2.3, 1.6, 8);
        const frame = this.box(g, 2.6, 2, 0.25, '#d9a441', 0, 6.9, 0.2); frame.rotation.z = 0.32; this.box(g, 2, 1.4, 0.3, color, 0, 6.9, 0.25).rotation.z = 0.32;
        this.box(g, 1.6, 2.6, 0.3, DARK, 0, 1.3, 1.3);
        return (t) => { frame.rotation.z = 0.32 + Math.sin(t * 1.2) * 0.05; };
      }
      case 'logolab': {           // sign-maker's workshop buried under mismatched billboards
        this.box(g, 7, 3.6, 4.5, '#b9a98a', 0, 1.8, -1); this.box(g, 7.6, 0.5, 5, '#6b5a4a', 0, 3.8, -1);
        const signs: [number, number, number, number, string, number][] = [[-2.4, 5.4, 3, 2, '#e4572e', -0.2], [1.6, 6, 3.4, 1.6, '#4cc9f0', 0.15], [3.6, 4.6, 2, 2.4, '#ffe14d', -0.1], [-0.4, 7.6, 2.4, 1.4, '#9b5de5', 0.25]];
        for (const [x, y, w, hh, c, r] of signs) { this.box(g, w, hh, 0.3, c, x, y, 0.4 + r).rotation.z = r; this.cyl(g, 0.1, 0.1, y - 3.8, '#3f3328', x, (y + 3.8) / 2, 0.2, 4); }
        this.box(g, 1.6, 2.4, 0.3, color, 0, 1.2, 1.3);
        break;
      }
      case 'fib': {               // barker's booth with a giant question mark and a very long nose
        this.box(g, 6.5, 3, 4, W, 0, 1.5, -1); for (let i = 0; i < 5; i++) this.box(g, 1.3, 2.4, 0.2, i % 2 ? '#f4f0e6' : color, -2.6 + i * 1.3, 4.2, 1.2);
        this.add(new THREE.TorusGeometry(1.3, 0.45, 6, 12, Math.PI * 1.4), this.mat('#e8b23a'), 0, 8, -0.5, g).rotation.z = -0.6; this.cyl(g, 0.45, 0.45, 1.2, '#e8b23a', 0.3, 6.5, -0.5, 6); this.ball(g, 0.5, '#e8b23a', 0.3, 5.5, -0.5);
        this.ball(g, 1, '#f3dcc0', 0, 2.2, 1.2); const nose = this.cone(g, 0.35, 1.5, '#f3dcc0', 0, 2.2, 2.4, 6); nose.rotation.x = Math.PI / 2;
        return (t) => { const l = 1 + (Math.sin(t * 0.9) * 0.5 + 0.5) * 1.6; nose.scale.y = l; nose.position.z = 1.9 + l * 0.75; };
      }
      case 'punchline': {         // puppet theatre: curtains and two puppets squaring up
        this.box(g, 7, 2.4, 3.5, WOOD, 0, 1.2, -1); this.box(g, 7, 0.8, 3.5, color, 0, 6.2, -1); this.cone(g, 3, 1.6, '#e8b23a', 0, 7.4, -1, 4).rotation.y = Math.PI / 4;
        for (const x of [-3.1, 3.1]) { this.box(g, 0.8, 3.6, 3.5, WOOD, x, 4.2, -1); this.box(g, 1.2, 3.4, 0.3, '#c0392b', x * 0.72, 4.1, 0.8); }
        this.box(g, 5.4, 3.4, 0.2, DARK, 0, 4.1, -1.5);
        const a = new THREE.Group(), b = new THREE.Group(); a.position.set(-0.9, 2.9, 0.2); b.position.set(0.9, 2.9, 0.2); g.add(a, b);
        this.ball(a, 0.6, '#f3a712'); this.cone(a, 0.45, 0.8, '#d9482b', 0, 0.7, 0, 6); this.ball(b, 0.6, '#4cc9f0'); this.cone(b, 0.45, 0.8, '#9b5de5', 0, 0.7, 0, 6);
        return (t) => { a.position.y = 2.9 + Math.abs(Math.sin(t * 3)) * 0.5; a.rotation.z = Math.sin(t * 3) * 0.3; b.position.y = 2.9 + Math.abs(Math.cos(t * 3)) * 0.5; b.rotation.z = -Math.cos(t * 3) * 0.3; };
      }
      case 'hotpotato': {         // fireworks stand with an enormous cartoon bomb
        this.box(g, 6, 2.6, 3.4, '#c0392b', -1.5, 1.3, -1); this.box(g, 6.6, 0.4, 4, '#f4f0e6', -1.5, 2.8, -1);
        for (let i = 0; i < 4; i++) { this.cyl(g, 0.22, 0.22, 2, ['#ffe14d', '#4cc9f0', '#f15bb5', '#a8c256'][i], -3.3 + i * 1.2, 4, -1, 6).rotation.z = (i - 1.5) * 0.18; this.cone(g, 0.3, 0.6, '#e4572e', -3.3 + i * 1.2 - (i - 1.5) * 0.2, 5.2, -1, 6); }
        this.ball(g, 2.2, DARK, 3.6, 2.2, 0.8); this.cyl(g, 0.5, 0.5, 0.6, '#3f3328', 3.6, 4.5, 0.8, 8); const fuse = this.cyl(g, 0.1, 0.1, 1.4, '#c9b48c', 3.9, 5.3, 0.8, 4); fuse.rotation.z = -0.4;
        const spark = this.ball(g, 0.4, this.lit('#ffd23f'), 4.2, 6, 0.8);
        return (t) => { spark.scale.setScalar(0.7 + Math.abs(Math.sin(t * 17)) * 0.9); (spark.material as THREE.MeshBasicMaterial).color.set(Math.sin(t * 23) > 0 ? '#ffd23f' : '#ff7a1f'); };
      }
      case 'agent': {             // fortune teller's tent with a glowing crystal ball
        this.cone(g, 5.4, 8, color, 0, 4, -1, 8); this.cone(g, 1.4, 1.6, '#e8b23a', 0, 8.6, -1, 8);
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; this.ball(g, 0.3, this.lit('#ffd98a'), Math.cos(a) * 5.2, 0.5, -1 + Math.sin(a) * 5.2); }
        this.box(g, 2.2, 3.4, 0.3, DARK, 0, 1.7, 3.4).rotation.x = -0.32;
        this.cyl(g, 0.9, 0.7, 1.2, WOOD, 3.2, 0.6, 3.6, 8); const orb = this.ball(g, 0.9, this.lit('#b9a2ff'), 3.2, 2, 3.6);
        return (t) => { orb.scale.setScalar(1 + Math.sin(t * 2.2) * 0.14); (orb.material as THREE.MeshBasicMaterial).color.setHSL(0.72 + Math.sin(t * 0.8) * 0.08, 0.9, 0.78); };
      }
      case 'heist': {             // a stern little bank with a great round vault door
        this.box(g, 9, 5.6, 4.6, '#8f9197', 0, 2.8, -1); this.box(g, 10, 0.8, 5.4, '#6f7177', 0, 6, -1); this.cone(g, 5.6, 1.8, '#6f7177', 0, 7.3, -1, 3).rotation.y = Math.PI / 6;
        for (const x of [-3.9, 3.9]) this.cyl(g, 0.5, 0.55, 5.4, '#b7b9be', x, 2.7, 1.6, 8);
        const door = new THREE.Group(); door.position.set(0, 2.7, 1.45); g.add(door);
        this.cyl(door, 2.3, 2.3, 0.5, '#c9a441', 0, 0, 0, 16).rotation.x = Math.PI / 2;
        for (let i = 0; i < 3; i++) this.box(door, 3.4, 0.3, 0.3, '#5b5d63', 0, 0, 0.35).rotation.z = (i / 3) * Math.PI;
        this.ball(door, 0.45, '#5b5d63', 0, 0, 0.4);
        return (t) => { door.rotation.z = Math.sin(t * 0.6) * 1.2; };
      }
      case 'dungeon': {           // ghost train: a tunnel mouth with teeth, and a cart that rolls in and out
        this.box(g, 9, 6, 5, '#3d3a4a', 0, 3, -1.5); this.cone(g, 2, 3, '#3d3a4a', -3.4, 7.5, -1.5, 5); this.cone(g, 2, 3, '#3d3a4a', 3.4, 7.5, -1.5, 5);
        this.box(g, 5, 3.8, 0.4, '#0d0a12', 0, 1.9, 1.05);
        for (let i = 0; i < 5; i++) this.cone(g, 0.45, 1, '#f4f0e6', -1.8 + i * 0.9, 3.3, 1.3, 4).rotation.x = Math.PI;
        for (const x of [-1.7, 1.7]) this.ball(g, 0.45, this.lit('#8dff7a'), x, 5, 1.1);
        for (const x of [-1, 1]) this.box(g, 0.2, 0.15, 6, '#6b6660', x, 0.1, 3.5);
        const cart = new THREE.Group(); g.add(cart); this.box(cart, 2.6, 1.3, 2.2, color, 0, 0.9, 0); this.box(cart, 2.6, 1, 0.3, color, 0, 1.9, -1);
        return (t) => { cart.position.z = 2.2 + Math.sin(t * 0.7) * 2.6; cart.visible = cart.position.z > 0.4; };
      }
      default:                    // a plain striped booth for anything without its own design
        this.box(g, 8, 3.4, 4.6, W, 0, 1.7, 0); this.cone(g, 6.6, 3.6, color, 0, 7.6, 0, 4).rotation.y = Math.PI / 4;
    }
  }

  private buildBooths(games: GameDef[]) {
    let spare = 0;
    games.forEach((game) => {
      const [x, z, deg] = LAYOUT[game.meta.id] || SPARE[spare++ % SPARE.length], rot = (deg * Math.PI) / 180, color = ZONE_COLORS[game.meta.zone] || '#c9553a';
      const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot; this.scene.add(g);
      const tick = this.building(game.meta.id, g, color);
      if (tick) this.ticks.push(tick);
      // "Closed" boards across the front, shown when the group is the wrong size for this ride.
      const shut = this.box(g, 7, 0.9, 0.3, '#f4f0e6', 0, 2.6, 3.4); shut.rotation.z = -0.12; shut.visible = false;
      // The standing circle sits a few steps in front of the door, with a trail leading to it from the plaza.
      const px = clamp(x + Math.sin(rot) * 8, -XMAX + 3, XMAX - 3), pz = clamp(z + Math.cos(rot) * 8, ZMIN + 3, ZMAX - 4);
      const bend = ((x * 7 + z * 13) % 9) - 4;
      this.trail([[0, 7], [px * 0.45 + bend * 0.6, 7 + (pz - 7) * 0.45 - bend], [px, pz]], 3.6);
      const pad = this.add(new THREE.CircleGeometry(PAD_R, 22), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.1, depthWrite: false }), px, 0.07, pz); pad.rotation.x = -Math.PI / 2;
      const ring = this.add(new THREE.RingGeometry(PAD_R - 0.4, PAD_R, 26), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0.1, depthWrite: false }), px, 0.08, pz); ring.rotation.x = -Math.PI / 2;
      const count = h('span.park-count');
      const label = h('div.park-label', h('span.park-emoji', game.meta.emoji), h('span.park-name', game.meta.name), count);
      this.labels.append(label);
      this.booths.push({ game, x, z, px, pz, open: true, label, count, pad, ring, shut, votes: 0 });
    });
  }

  private fit = () => {
    const w = this.root.clientWidth || 1280, hh = this.root.clientHeight || 720;
    this.renderer.setSize(w, hh, false); this.cam.aspect = w / hh; this.cam.updateProjectionMatrix();
    const corners = [[-XMAX - 4, ZMIN - 10], [XMAX + 4, ZMIN - 10], [-XMAX - 4, ZMAX + 3], [XMAX + 4, ZMAX + 3]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let d = 60; d < 300; d += 4) {       // high three-quarter view, backed off until the whole park fits
      this.cam.position.set(0, d * 0.78, d * 0.72 + 4); this.cam.lookAt(0, 0, 1); this.cam.updateMatrixWorld();
      if (corners.every((c) => { const v = c.clone().project(this.cam); return Math.abs(v.x) < 0.97 && Math.abs(v.y) < 0.9; })) break;
    }
    for (const b of this.booths) {            // pin each ride's name tag above its roof
      const v = new THREE.Vector3(b.x, 11.5, b.z).project(this.cam);
      b.label.style.left = `${(v.x * 0.5 + 0.5) * 100}%`; b.label.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
    }
  };

  /** Called whenever the guest list changes: adds and removes characters, refreshes the overlays and which rides are open. */
  sync(o: ParkOverlays) {
    this.overlay.replaceChildren(o.ticket, o.mascot, o.controls);
    const present = this.room.players.filter((p) => p.connected);
    for (const p of present) if (!this.guests.has(p.id)) this.spawn(p);
    for (const [id, g] of this.guests) if (!present.some((p) => p.id === id)) { this.puff(g.x, g.z); this.scene.remove(g.g); this.guests.delete(id); }
    for (const b of this.booths) {
      b.open = this.fits(b.game);
      b.label.classList.toggle('closed', !b.open);
      b.shut.visible = !b.open;
    }
    for (const p of this.room.players) if (p.view.key !== 'park') this.room.setView(p, { type: 'walk', key: 'park' });
  }

  private spawn(p: Player) {
    const g = new THREE.Group();
    this.add(new THREE.CylinderGeometry(0.75, 1.15, 2.3, 8), this.mat(p.color), 0, 1.15, 0, g);                 // body
    this.add(new THREE.SphereGeometry(0.85, 8, 6), this.mat('#f3dcc0'), 0, 2.9, 0, g);                        // head
    this.add(new THREE.ConeGeometry(0.75, 0.9, 8), this.mat(p.color), 0, 3.95, 0, g);                         // party hat
    this.add(new THREE.SphereGeometry(0.22, 5, 4), this.mat('#2b1d2e'), 0, 2.95, 0.8, g);                     // nose, so you can see which way they face
    const shadow = this.add(new THREE.CircleGeometry(1.2, 12), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.22 }), 0, 0.05, 0, g); shadow.rotation.x = -Math.PI / 2;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const cx = c.getContext('2d')!; cx.font = '46px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(p.avatar, 32, 36);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); tag.scale.set(2.2, 2.2, 1); tag.position.y = 5.6; g.add(tag);
    const x = SPAWN.x + (Math.random() - 0.5) * 10, z = SPAWN.z + (Math.random() - 0.5) * 4;
    g.position.set(x, 0, z); g.scale.setScalar(0.01);
    this.scene.add(g);
    this.guests.set(p.id, { p, g, x, z, mx: 0, mz: 0, face: Math.PI, tx: x, tz: z, think: 1 + Math.random() * 2, at: null, live: '' });
    this.puff(x, z);
  }

  /** A puff of smoke: a handful of grey balls that swell and fade. */
  private puff(x: number, z: number) {
    for (let i = 0; i < 9; i++) {
      const m = this.add(new THREE.SphereGeometry(0.9, 6, 5), new THREE.MeshBasicMaterial({ color: '#efe6da', transparent: true, opacity: 0.9 }), x + (Math.random() - 0.5) * 2.4, 1 + Math.random() * 3, z + (Math.random() - 0.5) * 2.4);
      this.puffs.push({ m, life: 1 });
    }
  }

  /** A phone's joystick or arrows. */
  input(p: Player, d: any) {
    const g = this.guests.get(p.id);
    if (g && Array.isArray(d?.move)) { g.mx = clamp(Number(d.move[0]) || 0, -1, 1); g.mz = -clamp(Number(d.move[1]) || 0, -1, 1); }
  }

  private frame = (now: number) => {
    if (!this.alive) return;
    const dt = Math.min(0.05, (now - this.last) / 1000), t = now / 1000; this.last = now;
    const guests = [...this.guests.values()];
    const humansAt = (b: Booth) => guests.filter((g) => !g.p.bot && g.at === b).length;

    for (const g of guests) {
      if (g.p.bot) {       // bots wander, then follow the crowd to whichever ride the humans are gathering at
        g.think -= dt;
        if (g.think <= 0) {
          g.think = 1.5 + Math.random() * 3;
          const busy = this.booths.filter((b) => b.open && humansAt(b) > 0).sort((a, b) => humansAt(b) - humansAt(a))[0];
          if (busy) { g.tx = busy.px + (Math.random() - 0.5) * 5; g.tz = busy.pz + (Math.random() - 0.5) * 5; }
          else { g.tx = (Math.random() - 0.5) * 60; g.tz = 2 + Math.random() * 26; }
        }
        const dx = g.tx - g.x, dz = g.tz - g.z, d = Math.hypot(dx, dz);
        g.mx = d > 1 ? (dx / d) * 0.7 : 0; g.mz = d > 1 ? (dz / d) * 0.7 : 0;
      }
      const moving = Math.hypot(g.mx, g.mz) > 0.08;
      if (moving) {
        g.x = clamp(g.x + g.mx * SPEED * dt, -XMAX, XMAX); g.z = clamp(g.z + g.mz * SPEED * dt, ZMIN, ZMAX);
        g.face = Math.atan2(g.mx, g.mz);
        for (const b of this.booths) {       // rides are solid
          const dx = g.x - b.x, dz = g.z - b.z, d = Math.hypot(dx, dz);
          if (d < 5 && d > 0.01) { g.x = b.x + (dx / d) * 5; g.z = b.z + (dz / d) * 5; }
        }
      }
      g.g.position.set(g.x, moving ? Math.abs(Math.sin(t * 11)) * 0.35 : 0, g.z);
      g.g.rotation.y += Math.atan2(Math.sin(g.face - g.g.rotation.y), Math.cos(g.face - g.g.rotation.y)) * Math.min(1, dt * 12);
      g.g.scale.setScalar(Math.min(1.35, g.g.scale.x + dt * 4));            // grow out of the smoke
      g.at = this.booths.find((b) => b.open && (g.x - b.px) ** 2 + (g.z - b.pz) ** 2 < PAD_R * PAD_R) || null;
    }
    for (let i = 0; i < guests.length; i++) for (let j = i + 1; j < guests.length; j++) {     // don't stand inside each other
      const a = guests[i], b = guests[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 2.5 && d > 0.01) { const push = (2.5 - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
    }

    // Voting with your feet.
    const n = guests.length;
    for (const b of this.booths) {
      b.votes = guests.filter((g) => g.at === b).length;
      const txt = !b.open ? `CLOSED · ${b.game.meta.min}–${b.game.meta.max} players` : b.votes ? `👣 ${b.votes}` : '';
      if (b.count.textContent !== txt) b.count.textContent = txt;
      b.pad.scale.setScalar(b.votes ? 1 + Math.sin(t * 6) * 0.05 : 1);
      // The circle brightens as anyone walks up to it and fades to a hint when nobody is near.
      const near = Math.min(99, ...guests.map((g) => Math.hypot(g.x - b.px, g.z - b.pz)));
      const vis = b.open ? clamp(1 - (near - 6) / 16, 0.1, 1) : 0.05;
      (b.pad.material as THREE.MeshBasicMaterial).opacity = 0.55 * vis; (b.ring.material as THREE.MeshBasicMaterial).opacity = vis;
    }
    const decided = guests.filter((g) => g.at).length, top = Math.max(0, ...this.booths.map((b) => b.votes));
    const leaders = this.booths.filter((b) => b.votes === top && top > 0);
    // One ride with more than half the park wins outright. If more than half have chosen but the lead is shared, it's a draw between the leaders.
    const choice = n > 0 && top > n / 2 ? leaders : n > 0 && decided > n / 2 && leaders.length > 1 ? leaders : [];
    const key = choice.map((b) => b.game.meta.id).join();
    if (key !== this.choiceKey) { this.choiceKey = key; this.countdown = choice.length > 1 ? 4.5 : 3.5; }
    if (choice.length) {
      this.countdown -= dt;
      const secs = Math.max(1, Math.ceil(this.countdown));
      this.banner.textContent = choice.length > 1 ? `It’s a tie! ${choice.map((b) => b.game.meta.name).join(' vs ')}: picking at random in ${secs}…` : `${choice[0].game.meta.emoji} ${choice[0].game.meta.name} starts in ${secs}…`;
      if (this.countdown <= 0) { this.alive = false; this.start(pick(choice).game); return; }
    } else this.banner.textContent = n ? 'Walk to a ride. When most of you are standing at the same one, it starts.' : 'Scan the ticket to come in through the gate';
    for (const g of guests) {
      const live = g.at ? `${g.at.game.meta.emoji} ${g.at.game.meta.name}: ${g.at.votes} of ${n} here` : 'Walk to a ride';
      if (live !== g.live) { g.live = live; this.room.live(g.p, { big: live }); }
    }

    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i]; p.life -= dt * 1.4;
      p.m.scale.setScalar(1 + (1 - p.life) * 1.8); p.m.position.y += dt * 2; (p.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, p.life) * 0.9;
      if (p.life <= 0) { this.scene.remove(p.m); p.m.geometry.dispose(); (p.m.material as THREE.Material).dispose(); this.puffs.splice(i, 1); }
    }
    for (const s of this.spinners) s.rotation.z = t * 0.15;
    for (const tick of this.ticks) tick(t);
    this.renderer.render(this.scene, this.cam);
    this.raf = requestAnimationFrame(this.frame);
  };

  /** Stops drawing and frees everything, so the park costs nothing while a game is running. */
  destroy() {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.fit);
    this.scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); });
    this.renderer.dispose();
  }
}
