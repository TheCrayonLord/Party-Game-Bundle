// The shared racing engine. Tilt Kart and Riptide Regatta are both this with different settings.
import { boatDetailed, kartDetailed, quality } from '../core/models';
import * as THREE from 'three';
import { clamp, h, ordinal, pick, rand } from '../core/util';
import type { Ctx, Score } from '../host/ctx';
import type { Player } from '../host/room';

export interface RaceConfig { kind: 'kart' | 'boat' }

/** Lets the host player choose the course from their phone; falls back to a random one. */
async function chooseCourse(ctx: Ctx, kind: 'kart' | 'boat'): Promise<Course> {
  const list = COURSES[kind], vip = ctx.vip && ctx.players.includes(ctx.vip) && !ctx.vip.bot ? ctx.vip : null;
  if (!vip) return pick(list);
  ctx.show(h('div.col.pad', h('h1.big', 'Pick a course'), h('div.row', ...list.map((c) => h('div.answer', c.name))), h('p.sub', `${vip.name} is choosing…`)));
  ctx.wait(ctx.players.filter((p) => p !== vip));
  const key = ctx.key('course');
  const v = (await ctx.collect([vip], () => ({ type: 'choice', key, id: key, prompt: 'Pick a course', options: [...list.map((c, i) => ({ id: String(i), label: c.name })), { id: 'r', label: '🎲 Surprise me' }] }), 15)).get(vip.id);
  return list[Number(v)] ?? pick(list);
}

type Prop = 'tent' | 'tree' | 'lolly' | 'gumdrop' | 'cactus' | 'rock' | 'pine' | 'snowman' | 'tower' | 'palm' | 'bush' | 'islet' | 'lighthouse' | 'lily' | 'stump' | 'iceberg' | 'lava';
interface Theme { ground: string; road: string; edge: string; sky: string; props: Prop[]; /** Light colour; warm sunset by default. */ light?: string; /** Dark course: boats carry lamps, buoys and lanterns glow. */ night?: boolean }
interface Course { name: string; theme: Theme; pts: [number, number][] }

/** Six kart tracks and five boat courses, each with its own look. The host player picks one before each race. */
export const COURSES: Record<'kart' | 'boat', Course[]> = {
  kart: [
    { name: 'Big Top Loop', theme: { ground: '#2f6b5e', road: '#4a3b5c', edge: '#f6ead2', sky: '#33224f', props: ['tent', 'tree', 'tree', 'tree'] },
      pts: [[-60, -20], [-40, -34], [0, -30], [30, -36], [58, -22], [62, 4], [44, 22], [18, 14], [0, 28], [-30, 32], [-56, 20], [-66, 0]] },
    { name: 'Candy Pretzel', theme: { ground: '#e79bb8', road: '#7a4a62', edge: '#ffffff', sky: '#5b2a5e', props: ['lolly', 'gumdrop', 'gumdrop', 'lolly'] },
      pts: [[-62, 0], [-50, -28], [-20, -34], [0, -14], [22, -32], [54, -28], [64, -4], [50, 22], [20, 30], [-8, 16], [-34, 32], [-58, 22]] },
    { name: 'Hourglass Canyon', theme: { ground: '#d8a45c', road: '#5a4636', edge: '#f3d9a4', sky: '#6b3a3a', props: ['cactus', 'rock', 'cactus', 'rock'] },
      pts: [[-66, -26], [-24, -20], [18, -32], [60, -26], [68, 2], [60, 30], [22, 22], [-18, 32], [-58, 30], [-68, 2]] },
    { name: 'Snowball Circuit', theme: { ground: '#e6f1fb', road: '#5d6f85', edge: '#8fc7ea', sky: '#2c3e63', props: ['pine', 'pine', 'snowman', 'pine'], light: '#eaf3ff' },
      pts: [[-60, -24], [0, -34], [60, -24], [68, 4], [58, 28], [0, 36], [-58, 28], [-68, 4]] },
    { name: 'Neon Zigzag', theme: { ground: '#141026', road: '#2a2440', edge: '#ff4fd8', sky: '#0b0818', props: ['tower', 'tower', 'tower'] },
      pts: [[-66, -10], [-52, -32], [-28, -18], [-6, -34], [18, -18], [42, -34], [64, -16], [66, 14], [40, 32], [0, 24], [-40, 34], [-66, 16]] },
    { name: 'Jungle Horseshoe', theme: { ground: '#1f5a2e', road: '#6b4a2e', edge: '#c9a36a', sky: '#1d3a3a', props: ['palm', 'bush', 'palm', 'bush', 'rock'] },
      pts: [[-66, -30], [-40, -34], [-28, -10], [-10, 8], [14, 8], [30, -10], [42, -34], [66, -30], [70, 10], [50, 34], [0, 36], [-50, 34], [-70, 10]] },
  ],
  boat: [
    { name: 'Lazy Lagoon', theme: { ground: '#1c8fa6', road: '#27a3ba', edge: '#27a3ba', sky: '#33224f', props: ['islet', 'islet', 'rock'] },
      pts: [[-62, -8], [-46, -30], [-10, -36], [26, -32], [58, -24], [68, 2], [54, 28], [20, 34], [-16, 32], [-48, 28], [-68, 10]] },
    { name: 'Sunset Harbour', theme: { ground: '#5b3f78', road: '#70508f', edge: '#70508f', sky: '#c9623f', props: ['lighthouse', 'rock', 'rock'] },
      pts: [[-64, -14], [-38, -34], [0, -22], [36, -36], [64, -16], [62, 14], [38, 34], [8, 16], [-22, 34], [-54, 28], [-70, 6]] },
    { name: 'Serpent Swamp', theme: { ground: '#35583a', road: '#43704c', edge: '#43704c', sky: '#1f2f2a', props: ['lily', 'lily', 'stump', 'lily'] },
      pts: [[-66, -14], [-36, -34], [4, -32], [30, -20], [56, -32], [70, -4], [56, 26], [22, 34], [-6, 22], [-34, 34], [-60, 26], [-70, 6]] },
    { name: 'Iceberg Ring', theme: { ground: '#3f7fa8', road: '#5196c2', edge: '#5196c2', sky: '#23395c', props: ['iceberg', 'iceberg', 'iceberg'], light: '#eaf3ff' },
      pts: [[-62, -20], [-20, -36], [24, -36], [62, -22], [70, 6], [52, 30], [10, 36], [-34, 34], [-64, 22], [-72, 0]] },
    { name: 'Midnight Marina', theme: { ground: '#0e2a40', road: '#12324c', edge: '#12324c', sky: '#04060d', props: ['rock', 'lighthouse', 'rock'], light: '#8fb4ff', night: true },
      pts: [[-64, -18], [-30, -36], [12, -32], [50, -36], [70, -10], [60, 22], [28, 34], [-10, 26], [-44, 36], [-70, 12]] },
    { name: 'Volcano Bay', theme: { ground: '#2a2030', road: '#3d2c44', edge: '#3d2c44', sky: '#3a1414', props: ['lava', 'lava', 'rock'] },
      pts: [[-64, -22], [-24, -36], [20, -28], [60, -34], [72, -6], [60, 26], [24, 36], [0, 20], [-28, 34], [-60, 30], [-72, 4]] },
  ],
};

/** Builds one piece of scenery out of simple shapes. */
function makeProp(kind: Prop): THREE.Group {
  const g = new THREE.Group();
  const m = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const lit = (c: string) => new THREE.MeshBasicMaterial({ color: c });
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => { const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); g.add(mesh); return mesh; };
  switch (kind) {
    case 'tent': add(new THREE.ConeGeometry(4, 5, 8), m(pick(['#d9482b', '#e8b23a', '#f6ead2'])), 0, 2.5, 0); break;
    case 'tree': add(new THREE.ConeGeometry(2, 6, 5), m('#1f4d45'), 0, 3, 0); break;
    case 'lolly': add(new THREE.CylinderGeometry(0.25, 0.25, 5, 5), m('#ffffff'), 0, 2.5, 0); add(new THREE.SphereGeometry(1.8, 8, 6), m(pick(['#ff5fa2', '#7be0e0', '#ffe14d', '#b47bff'])), 0, 5.6, 0); break;
    case 'gumdrop': add(new THREE.SphereGeometry(2.2, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), m(pick(['#ff5fa2', '#7be0e0', '#ffe14d', '#9be37b'])), 0, 0, 0); break;
    case 'cactus': add(new THREE.CylinderGeometry(0.8, 0.9, 5, 6), m('#3f8a4f'), 0, 2.5, 0); add(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 5), m('#3f8a4f'), 1.3, 3.2, 0); add(new THREE.CylinderGeometry(0.45, 0.45, 1.8, 5), m('#3f8a4f'), -1.3, 2.4, 0); break;
    case 'rock': add(new THREE.DodecahedronGeometry(2 + Math.random() * 1.5, 0), m('#8d8478'), 0, 0.8, 0).scale.y = 0.7; break;
    case 'pine': add(new THREE.ConeGeometry(2.2, 5, 6), m('#24574a'), 0, 2.5, 0); add(new THREE.ConeGeometry(1.5, 2.2, 6), m('#f4f8fb'), 0, 5.2, 0); break;
    case 'snowman': add(new THREE.SphereGeometry(1.6, 7, 6), m('#ffffff'), 0, 1.4, 0); add(new THREE.SphereGeometry(1.1, 7, 6), m('#ffffff'), 0, 3.5, 0); add(new THREE.ConeGeometry(0.25, 0.9, 5), m('#f3a712'), 0, 3.5, 1.2).rotation.x = Math.PI / 2; break;
    case 'tower': { const c = pick(['#35e0ff', '#ff4fd8', '#ffe14d', '#7dff7a']), hh = 4 + Math.random() * 7; add(new THREE.BoxGeometry(3, hh, 3), m('#221a3a'), 0, hh / 2, 0); add(new THREE.BoxGeometry(3.2, 0.4, 3.2), lit(c), 0, hh, 0); add(new THREE.BoxGeometry(3.2, 0.3, 3.2), lit(c), 0, hh * 0.5, 0); break; }
    case 'palm': add(new THREE.CylinderGeometry(0.35, 0.5, 6, 5), m('#8a6a45'), 0, 3, 0).rotation.z = 0.15; for (let i = 0; i < 5; i++) { const l = add(new THREE.ConeGeometry(0.7, 3.6, 4), m('#2f9a55'), Math.cos(i * 1.26) * 1.5 - 0.4, 6, Math.sin(i * 1.26) * 1.5); l.rotation.z = Math.cos(i * 1.26) * -1.1; l.rotation.x = Math.sin(i * 1.26) * 1.1; } break;
    case 'bush': add(new THREE.IcosahedronGeometry(2, 0), m('#2d7a3f'), 0, 1.2, 0); break;
    case 'islet': { add(new THREE.CylinderGeometry(4, 5, 0.8, 9), m('#e2cf9a'), 0, 0.3, 0); const p = makeProp('palm'); p.position.set(0.5, 0.5, 0); g.add(p); break; }
    case 'lighthouse': add(new THREE.CylinderGeometry(3.5, 4.5, 1, 8), m('#8d8478'), 0, 0.4, 0); add(new THREE.CylinderGeometry(1.2, 1.8, 8, 8), m('#f6ead2'), 0, 4.8, 0); add(new THREE.CylinderGeometry(1.5, 1.5, 1.2, 8), lit('#ffe9a8'), 0, 9.4, 0); add(new THREE.ConeGeometry(1.8, 1.6, 8), m('#d9482b'), 0, 10.8, 0); break;
    case 'lily': add(new THREE.CylinderGeometry(2.4, 2.4, 0.15, 9), m('#5fae5a'), 0, 0.1, 0); add(new THREE.SphereGeometry(0.5, 6, 5), m('#f7b6d2'), 0.6, 0.5, 0.3); break;
    case 'stump': add(new THREE.CylinderGeometry(0.6, 1.1, 5, 5), m('#4a3d2e'), 0, 2.5, 0).rotation.z = 0.2; add(new THREE.CylinderGeometry(0.2, 0.3, 2.5, 4), m('#4a3d2e'), 1, 3.6, 0).rotation.z = -0.9; break;
    case 'iceberg': add(new THREE.ConeGeometry(3 + Math.random() * 2, 4 + Math.random() * 4, 5), m('#f1f8fc'), 0, 2, 0); add(new THREE.ConeGeometry(2, 3, 4), m('#cfe8f5'), 2.2, 1.3, 1); break;
    case 'lava': add(new THREE.ConeGeometry(4, 5, 7), m('#2b2228'), 0, 2.2, 0); add(new THREE.CylinderGeometry(1.3, 1.6, 0.5, 7), lit('#ff6a1f'), 0, 4.6, 0); break;
  }
  return g;
}

const N = 360;            // samples along the track centre line
const LAPS = 3;
const RADIUS = 1.8;
type Item = 'boost' | 'oil' | 'zap';
const ITEM_LABEL: Record<Item, string> = { boost: '🚀 BOOST!', oil: '🛢️ DROP OIL', zap: '⚡ ZAP!' };

// Karts grip and turn sharply; boats keep sliding the way they were going.
const PROFILE = {
  kart: { vmax: 24, accel: 15, turn: 2.5, grip: 14, width: 11, offroad: 9 },
  boat: { vmax: 23, accel: 9, turn: 2.0, grip: 2.4, width: 21, offroad: 11 },
};

interface Racer {
  p: Player; mesh: THREE.Group; x: number; z: number; th: number; vx: number; vz: number; steer: number;
  rockAt: number; idx: number; lap: number; item: Item | null; boost: number; spin: number; slow: number; cool: number; immune: number;
  finish: number | null; off: boolean; ai: boolean; skill: number; lane: number; useAt: number; liveText: string; btnText: string;
}

export async function runRace(ctx: Ctx, cfg: RaceConfig): Promise<Score[]> {
  const boat = cfg.kind === 'boat', pr = PROFILE[cfg.kind], WIDTH = pr.width;
  const course = await chooseCourse(ctx, cfg.kind), th = course.theme;

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(th.sky);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 1, 600);
  const night = !!th.night;
  if (night) renderer.setPixelRatio(1);      // a dozen boat lamps cost extra, so draw the night course at plain resolution
  scene.add(new THREE.AmbientLight(th.light ?? '#ffe1c4', night ? 0.3 : 1.5));
  const sun = new THREE.DirectionalLight(th.light ?? '#ffb37a', night ? 0.25 : 1.6); sun.position.set(-40, 80, 30); scene.add(sun);
  const overlay = h('div.kart-overlay');
  const board = h('div.kart-board');
  ctx.show(renderer.domElement, board, overlay);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  ctx.onEnd(() => { renderer.dispose(); scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); });

  const curve = new THREE.CatmullRomCurve3(course.pts.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  const S = curve.getSpacedPoints(N).slice(0, N);                 // centre line
  const T = S.map((_, i) => curve.getTangentAt(i / N).setY(0).normalize());
  const NRM = T.map((t) => new THREE.Vector3(-t.z, 0, t.x));      // points to the left of travel
  const mat = (c: string, opacity = 1) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: opacity < 1, opacity });
  const at = (i: number, off = 0) => ({ x: S[i].x + NRM[i].x * off, z: S[i].z + NRM[i].z * off });

  const ribbon = (half: number, y: number, color: string, opacity = 1) => {
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < N; i++) { const a = S[i], n = NRM[i]; pos.push(a.x + n.x * half, y, a.z + n.z * half, a.x - n.x * half, y, a.z - n.z * half); }
    for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity })));
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), mat(th.ground)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; scene.add(ground);
  if (!boat) ribbon(WIDTH / 2 + 0.9, 0, th.edge);     // painted edge
  ribbon(WIDTH / 2, 0.05, boat ? '#ffffff' : th.road, boat ? 0.13 : 1);        // tarmac, or a paler lane of water

  // Water: two layers of ripples drifting in different directions, plus foam trails behind the boats.
  const waterLayers: THREE.Texture[] = [];
  const wakes: { m: THREE.Mesh; life: number }[] = [];
  let wakeAt = 0;
  if (boat) {
    const ripples = (seed: number) => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g = c.getContext('2d')!;
      g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {         // short curved glints, light and dark
        const x = ((i * 97 + seed * 53) % 256), y = ((i * 61 + seed * 29) % 256), w = 18 + ((i * 13) % 26);
        g.strokeStyle = i % 3 ? 'rgba(255,255,255,0.20)' : 'rgba(0,20,40,0.16)'; g.lineWidth = 2 + (i % 3);
        for (const dx of [-256, 0, 256]) { g.beginPath(); g.moveTo(x + dx, y); g.quadraticCurveTo(x + dx + w / 2, y - 5, x + dx + w, y); g.stroke(); }
      }
      const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    };
    for (const [i, rep] of [[0, 17], [1, 10.5]]) {
      const tex = ripples(i + 1); tex.repeat.set(rep * 1.5, rep); waterLayers.push(tex);
      const layer = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, opacity: night ? 0.22 : 1 }));
      layer.rotation.x = -Math.PI / 2; layer.position.y = 0.02 + i * 0.01; scene.add(layer);
    }
    const foam = new THREE.CircleGeometry(1, 8);
    for (let i = 0; i < 140; i++) {
      const m = new THREE.Mesh(foam, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
      m.rotation.x = -Math.PI / 2; m.position.y = 0.09; m.visible = false; scene.add(m); wakes.push({ m, life: 0 });
    }
  }
  // The start / finish line: a checkered strip across the course, a gantry with a FINISH banner, and flags.
  {
    const fin = new THREE.Group();
    fin.position.set(S[0].x, 0, S[0].z); fin.rotation.y = Math.atan2(T[0].x, T[0].z); scene.add(fin);
    const cols = Math.round(WIDTH / 1.1), sq = WIDTH / cols;
    const cc = document.createElement('canvas'); cc.width = cols * 16; cc.height = 64;
    const cg = cc.getContext('2d')!;
    for (let r = 0; r < 4; r++) for (let c = 0; c < cols; c++) { cg.fillStyle = (r + c) % 2 ? '#15101c' : '#ffffff'; cg.fillRect(c * 16, r * 16, 16, 16); }
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, sq * 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cc) }));
    strip.rotation.x = -Math.PI / 2; strip.position.y = 0.11; fin.add(strip);
    const sc = document.createElement('canvas'); sc.width = 512; sc.height = 96;
    const sg = sc.getContext('2d')!; sg.fillStyle = '#d9482b'; sg.fillRect(0, 0, 512, 96); sg.strokeStyle = '#f6ead2'; sg.lineWidth = 8; sg.strokeRect(4, 4, 504, 88);
    sg.fillStyle = '#f6ead2'; sg.font = 'bold 68px Georgia, serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('★ FINISH ★', 256, 52);
    // A sprite always faces the camera, so the word reads the right way up wherever the line points.
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), depthTest: false }));
    sign.scale.set(17, 17 * 96 / 512, 1); sign.position.set(0, 9, 0); sign.renderOrder = 5; fin.add(sign);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.34, 5.4, 8), mat(boat ? '#d9482b' : '#f6ead2')); post.position.set(side * (WIDTH / 2 + 1), 2.7, -sq * 1.5 - 1.2); fin.add(post);
      const float = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.7, 10), mat(boat ? '#f6ead2' : '#15101c')); float.position.set(side * (WIDTH / 2 + 1), 0.35, -sq * 1.5 - 1.2); fin.add(float);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {      // a checkered flag on each post
        const f = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: (r + c) % 2 ? '#15101c' : '#ffffff' }));
        f.position.set(side * (WIDTH / 2 + 1.6 + c * 0.5), 5.5, -sq * 1.5 - 1.2 + (r - 1) * 0.5); fin.add(f);
      }
    }
  }
  // scenery, kept off the course
  const clear = (x: number, z: number) => S.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 > (WIDTH / 2 + 7) ** 2);
  if (boat) {
    // Open water: the course is marked by pairs of buoys, red on the left, green on the right.
    const glowing = (c: string) => new THREE.MeshBasicMaterial({ color: c });      // at night the marker buoys are lit
    const bGeo = new THREE.CylinderGeometry(0.6, 0.9, 1.7, 6), red = night ? glowing('#ff5a3c') : mat('#e4572e'), green = night ? glowing('#6dff8a') : mat('#7bd67b');
    for (let i = 0; i < N; i += 18) for (const side of [1, -1]) {
      const s = at(i, side * (WIDTH / 2 + 0.6)), b = new THREE.Mesh(bGeo, side > 0 ? red : green);
      b.position.set(s.x, 0.8, s.z); scene.add(b);
    }
  }
  for (let i = 0; i < (boat ? 26 : 75); i++) {
    const x = rand(176) - 88, z = rand(104) - 52;
    if (!clear(x, z)) continue;
    const prop = makeProp(th.props[i % th.props.length]);
    prop.position.set(x, 0, z); prop.rotation.y = Math.random() * 6; scene.add(prop);
  }

  const fit = () => {
    const w = ctx.stage.clientWidth || 1280, hh = ctx.stage.clientHeight || 680;
    renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    const corners = [[-80, -46], [80, -46], [-80, 46], [80, 46]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let d = 80; d < 400; d += 5) {      // back the camera off until the whole course is in view
      cam.position.set(0, d * 0.86, d * 0.5); cam.lookAt(0, 0, 3); cam.updateMatrixWorld();
      fullD = d;
      if (corners.every((c) => { const v = c.clone().project(cam); return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9; })) break;
    }
    view.d = Math.min(view.d, fullD);
  };
  // The camera follows the people racing: it closes in while they are bunched up and backs off as they spread out,
  // never further than the whole-course view.
  let fullD = 200;
  const view = { x: 0, z: 0, d: 400 };
  const follow = (dt: number) => {
    const people = racers.filter((k) => !k.ai && k.p.connected && k.finish == null);
    const pack = people.length ? people : racers.filter((k) => k.finish == null);
    let tx = 0, tz = 0, td = fullD;
    if (pack.length) {
      const xs = pack.map((k) => k.x), zs = pack.map((k) => k.z);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
      const need = Math.max((x1 - x0 + 70) / 170, (z1 - z0 + 60) / 102);      // the share of the whole-course view the pack needs
      td = fullD * clamp(need, 0.42, 1);
      const free = 1 - td / fullD;                                              // how far the view may drift from the centre
      tx = clamp((x0 + x1) / 2, -85 * free, 85 * free); tz = clamp((z0 + z1) / 2, -51 * free, 51 * free);
    }
    const k = Math.min(1, dt * 1.6);
    view.x += (tx - view.x) * k; view.z += (tz - view.z) * k; view.d += (td - view.d) * k;
    cam.position.set(view.x, view.d * 0.86, view.z + view.d * 0.5); cam.lookAt(view.x, 0, view.z + 3);
  };
  fit(); addEventListener('resize', fit); ctx.onEnd(() => removeEventListener('resize', fit));

  // ---------- racers ----------
  // No floating name tags (they hid other racers). Each vehicle carries its player's shape on top instead.
  const badge = (p: Player) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = '#fbf5e6'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill();
    g.fillStyle = '#1b1220'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.shape, 32, 35);
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.75, 12), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = Math.PI;
    return m;
  };
  const build = (p: Player) => {
    const g = new THREE.Group();
    if (quality.detailed) g.add(boat ? boatDetailed(p.color) : kartDetailed(p.color));
    else if (boat) {
      const hull = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.8, 2.6), mat(p.color)); hull.position.y = 0.5;
      const bow = new THREE.Mesh(new THREE.ConeGeometry(1.34, 1.8, 4), mat(p.color)); bow.rotation.x = Math.PI / 2; bow.rotation.z = Math.PI / 4; bow.position.set(0, 0.5, 2.2);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.6, 0.15), mat('#f6ead2')); mast.position.set(0, 1.9, 0);
      const sail = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.2, 3), mat('#f6ead2')); sail.position.set(0, 2.1, -0.5); sail.scale.x = 0.2;
      g.add(hull, bow, mast, sail);
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 3), mat(p.color)); body.position.y = 0.7;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1), mat(p.color)); nose.position.set(0, 0.6, 1.8);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat('#f6ead2')); head.position.set(0, 1.5, -0.3);
      g.add(body, nose, head);
      for (const [wx, wz] of [[-1.1, 1], [1.1, 1], [-1.1, -1], [1.1, -1]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.9), mat('#1b1220')); w.position.set(wx, 0.4, wz); g.add(w); }
    }
    const b = badge(p);
    if (!quality.detailed) b.position.set(0, boat ? 0.95 : 1.07, 0.9);
    else if (boat) { b.position.set(0, 1.53, -0.45); b.scale.setScalar(0.6); }      // on the cabin roof
    else { b.position.set(0, 0.83, 1.15); b.scale.setScalar(0.55); }                // on the nose
    g.add(b);
    g.scale.setScalar(1.5); scene.add(g);
    return g;
  };
  // Night courses: a soft pool of light for each lamp, drawn on the water.
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!, grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0.9)'); grad.addColorStop(0.4, 'rgba(255,255,255,0.3)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const pool = (color: string, size: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: glowTex, color, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.y = 0.12;
    return m;
  };
  const lamps: { k: Racer; light: THREE.PointLight; glow: THREE.Mesh }[] = [];
  if (night) {
    for (let i = 20; i < N; i += 30) {        // lanterns floating along the channel
      const s = at(i, (i / 30) % 2 ? 6 : -6);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 5), mat('#3a3020')); post.position.set(s.x, 1.5, s.z);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); bulb.position.set(s.x, 3.2, s.z);
      const g = pool('#ffb85a', 26); g.position.x = s.x; g.position.z = s.z;
      scene.add(post, bulb, g);      // lanterns are painted glow only: real lights are saved for the boats
    }
  }

  const racers: Racer[] = ctx.players.map((p, i) => {
    const per = boat ? 4 : 3, row = Math.floor(i / per), col = (i % per) - (per - 1) / 2, idx = (N - 5 - row * 5) % N, s = at(idx, col * (boat ? 4.4 : 3.2));
    return {
      p, mesh: build(p), x: s.x, z: s.z, th: Math.atan2(T[idx].x, T[idx].z), vx: 0, vz: 0, steer: 0,
      rockAt: -9, idx, lap: -1, item: null, boost: 0, spin: 0, slow: 0, cool: 2, immune: 0, finish: null, off: false, ai: p.bot, skill: [0.7, 0.84, 0.97][p.level] + Math.random() * [0.12, 0.14, 0.08][p.level], lane: col * 2.5, useAt: 0, liveText: '', btnText: '',
    };
  });
  if (night) for (const k of racers) {         // every boat carries a lamp that lights the water just ahead
    const light = new THREE.PointLight('#fff1c9', 90, 22, 1.6), glow = pool('#fff1c9', 15);
    scene.add(light, glow); lamps.push({ k, light, glow });
  }
  const racerOf = new Map(racers.map((k) => [k.p.id, k]));
  const progress = (k: Racer) => k.lap * N + k.idx;
  const ranked = () => [...racers].sort((a, b) => (a.finish ?? 1e9) - (b.finish ?? 1e9) || progress(b) - progress(a));

  // ---------- karts: item boxes and oil ----------
  const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8), boxMat = mat('#e8b23a');
  const boxes = boat ? [] : [40, 100, 160, 220, 280, 330].flatMap((i) => [-3.2, 0, 3.2].map((off) => {
    const m = new THREE.Mesh(boxGeo, boxMat), s = at(i, off); m.position.set(s.x, 1.6, s.z); scene.add(m);
    return { m, back: 0 };
  }));
  const oils: { m: THREE.Mesh; owner: Racer; age: number }[] = [];
  const oilGeo = new THREE.CylinderGeometry(2, 2, 0.1, 10), oilMat = mat('#120c1c');

  // ---------- boats: waves, whirlpools, currents and buoys ----------
  const waves: { i: number; m: THREE.Mesh }[] = [], pools: { x: number; z: number; m: THREE.Mesh }[] = [];
  const currents: { from: number; to: number; dir: number }[] = [], buoys: { x: number; z: number }[] = [];
  if (boat) {
    for (const i of [50, 140, 230, 310]) {         // waves: hit them straight for a burst of speed
      const m = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.5, 1.6), mat('#e9f6f7', 0.85));
      m.position.set(S[i].x, 0.3, S[i].z); m.rotation.y = Math.atan2(T[i].x, T[i].z); scene.add(m); waves.push({ i, m });
    }
    for (const [i, off] of [[95, 4], [200, -4.5], [280, 3.5]]) {   // whirlpools: spin you round, then fling you out
      const s = at(i, off), m = new THREE.Mesh(new THREE.CylinderGeometry(4, 2.4, 0.4, 7), mat('#12425c'));
      m.position.set(s.x, 0.15, s.z); scene.add(m); pools.push({ ...s, m });
    }
    for (const [from, dir] of [[20, 1], [165, -1], [255, 1]]) {    // currents: a sideways shove along a stretch of water
      currents.push({ from, to: from + 22, dir });
      for (let i = from; i < from + 22; i += 4) for (const off of [-6.5, -2.2, 2.2, 6.5]) {
        const s = at(i, off), a = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 3), mat('#9fe0ee', 0.8));
        a.position.set(s.x, 0.2, s.z); a.rotation.x = Math.PI / 2; a.rotation.z = -Math.atan2(NRM[i].x * dir, NRM[i].z * dir); a.scale.y = 1; scene.add(a);
      }
    }
    for (const [i, off] of [[70, -5], [75, 6], [120, 0], [150, -7], [185, 6], [240, -6], [265, 2], [300, -2], [340, 5.5]]) {   // rocks in the channel: solid
      const s = at(i, off); buoys.push(s);
      const r = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5, 0), mat('#6f675d')); r.position.set(s.x, 0.5, s.z); scene.add(r);
    }
  }

  const use = (k: Racer) => {
    if (k.finish != null || k.spin > 0) return;
    if (boat) { if (k.cool <= 0) { k.boost = 1.3; k.cool = 6; ctx.sfx('whoosh'); ctx.buzz(k.p, 'good'); } return; }
    if (!k.item) return;
    const it = k.item; k.item = null;
    if (it === 'boost') { k.boost = 1.6; ctx.sfx('whoosh'); ctx.buzz(k.p, 'good'); }
    else if (it === 'oil') {
      const m = new THREE.Mesh(oilGeo, oilMat); m.position.set(k.x - Math.sin(k.th) * 4, 0.12, k.z - Math.cos(k.th) * 4); scene.add(m);
      oils.push({ m, owner: k, age: 0 });
    } else {
      const r = ranked(), me = r.indexOf(k), target = r.slice(0, me).reverse().find((o) => o.finish == null);
      if (target) { target.slow = 2; ctx.buzz(target.p, 'hit'); } else k.boost = 0.8; // leading the race: a little consolation boost
    }
  };

  ctx.all(boat
    ? { type: 'tilt', key: ctx.key('race'), swipe: { id: 'boost', label: 'Swipe up to boost' } }
    : { type: 'tilt', key: ctx.key('race'), buttons: [{ id: 'item', label: 'No item' }] });
  ctx.onInput((p, d) => {
    const k = racerOf.get(p.id); if (!k) return;
    if (typeof d.tilt === 'number') k.steer = clamp(d.tilt, -1, 1);
    if (d.btn === 'item' || d.btn === 'boost') use(k);
  });

  // ---------- race ----------
  let clock = -4.6, firstFinish: number | null = null, lastHud = 0;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  const step = (k: Racer, dt: number, place: number) => {
    const ai = k.ai || !k.p.connected;
    if (ai || k.finish != null) {       // bots (and finishers on their victory lap) follow the racing line
      const tgt = (k.idx + (boat ? 17 : 13)) % N;
      k.lane += (Math.random() - 0.5) * dt * 3; k.lane = clamp(k.lane, -WIDTH * 0.32, WIDTH * 0.32);
      const s = at(tgt, k.lane);
      k.steer = clamp(-wrap(Math.atan2(s.x - k.x, s.z - k.z) - k.th) * [1.6, 2.5, 3][k.p.level], -1, 1);
      if (ai && clock > k.useAt && (boat ? k.cool <= 0 : k.item)) { use(k); k.useAt = clock + 1 + Math.random() * 5; }
    }
    // nearest centre-line sample, searched near the last one
    let best = k.idx, bd = 1e9;
    for (let o = -8; o <= 22; o++) { const i = (k.idx + o + N) % N, d = (S[i].x - k.x) ** 2 + (S[i].z - k.z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (k.idx > N * 0.75 && best < N * 0.25) k.lap++; else if (k.idx < N * 0.25 && best > N * 0.75) k.lap--;
    const crossed = (i: number) => (best - i + N) % N < 30 && (k.idx - i + N) % N > N - 30;   // passed sample i this frame
    const dist = Math.sqrt(bd), off = dist > WIDTH / 2 + 0.5;
    k.off = off;
    if (k.lap >= LAPS && k.finish == null) { k.finish = clock; firstFinish ??= clock; }

    const fx = Math.sin(k.th), fz = Math.cos(k.th);
    if (boat && k.spin <= 0) {
      for (const w of waves) if (crossed(w.i)) { if (fx * T[w.i].x + fz * T[w.i].z > 0.93) k.boost = Math.max(k.boost, 0.9); else k.slow = 1; }
      for (const c of currents) if (best >= c.from && best < c.to) { k.vx += NRM[best].x * c.dir * 9 * dt; k.vz += NRM[best].z * c.dir * 9 * dt; }
      for (const pl of pools) if (k.immune <= 0 && (pl.x - k.x) ** 2 + (pl.z - k.z) ** 2 < 16) { k.spin = 0.9; k.immune = 6; ctx.comment('crash', k.p); }
      for (const b of buoys) { const dx = k.x - b.x, dz = k.z - b.z, d = Math.hypot(dx, dz); if (d < 2.6 && d > 0.01) {
        // Bounce off the rock: keep the sliding-past part of the speed, and get pushed clear of it, so nobody sits pinned nose-on.
        const nx = dx / d, nz = dz / d, into = k.vx * nx + k.vz * nz;
        k.x = b.x + nx * 2.7; k.z = b.z + nz * 2.7;
        k.vx += nx * (Math.max(0, -into) + 7); k.vz += nz * (Math.max(0, -into) + 7);
        if (k.rockAt < clock - 1) { k.rockAt = clock; ctx.sfx('thud'); ctx.buzz(k.p, 'hit'); }
      } }
    }
    k.idx = best;

    let vmax = pr.vmax * (ai ? k.skill : 1) * (1 + 0.07 * (place / Math.max(1, racers.length - 1)));   // gentle catch-up for those behind
    if (off) vmax = pr.offroad;
    if (k.slow > 0) vmax *= 0.5;
    if (k.boost > 0) vmax = pr.vmax * 1.6;
    if (k.finish != null) vmax = pr.vmax * 0.5;
    k.boost -= dt; k.slow -= dt; k.cool -= dt; k.immune -= dt;
    if (k.spin > 0) {
      k.spin -= dt; k.vx *= 1 - 2.5 * dt; k.vz *= 1 - 2.5 * dt;
      if (k.spin <= 0 && boat) { k.th = Math.atan2(T[k.idx].x, T[k.idx].z); k.boost = 0.7; k.vx = Math.sin(k.th) * 8; k.vz = Math.cos(k.th) * 8; }  // flung out of the whirlpool
    } else {
      let vf = k.vx * fx + k.vz * fz;                       // speed along the nose
      let lx = k.vx - fx * vf, lz = k.vz - fz * vf;          // sideways slide
      vf += clamp(vmax - vf, -pr.accel * 2.2 * dt, (k.boost > 0 ? pr.accel * 3 : pr.accel) * dt);
      const keep = Math.exp(-pr.grip * dt); lx *= keep; lz *= keep;
      k.vx = fx * vf + lx; k.vz = fz * vf + lz;
      k.th -= k.steer * pr.turn * dt * clamp(Math.abs(vf) / 8, boat ? 0.45 : 0.2, 1);      // some steering even at a standstill, so you can always turn away from what you hit
    }
    k.x += k.vx * dt; k.z += k.vz * dt;
    const lim = WIDTH / 2 + (boat ? 9 : 6);        // invisible fence beside the verge
    if (dist > lim) { const s = S[k.idx]; k.x = s.x + ((k.x - s.x) / dist) * lim; k.z = s.z + ((k.z - s.z) / dist) * lim; k.vx *= 0.9; k.vz *= 0.9; }

    for (const b of boxes) if (b.back <= 0 && !k.item && k.finish == null && (b.m.position.x - k.x) ** 2 + (b.m.position.z - k.z) ** 2 < 6) {
      b.back = 3.5; b.m.visible = false;
      const behind = place / Math.max(1, racers.length - 1);
      k.item = Math.random() < 0.25 + behind * 0.4 ? 'boost' : Math.random() < 0.5 ? 'zap' : 'oil';
      k.useAt = clock + 0.5 + Math.random() * 3;
      ctx.buzz(k.p, 'good'); ctx.sfx('pop');
    }
    for (const o of oils) if ((o.owner !== k || o.age > 1) && k.spin <= 0 && (o.m.position.x - k.x) ** 2 + (o.m.position.z - k.z) ** 2 < 7) { k.spin = 1.1; k.boost = 0; o.age = 99; ctx.comment('crash', k.p); }
  };

  await new Promise<void>((resolve) => {
    const stop = ctx.frame((dt, t) => {
      clock += dt;
      const sign = clock < -2.9 ? course.name : clock < -0.6 ? String(Math.ceil(-clock - 0.6)) : clock < 0.6 ? 'GO!' : '';
      if (sign !== overlay.textContent) { overlay.textContent = sign; if (sign === 'GO!') ctx.sfx('go'); else if (sign.length === 1) ctx.sfx('count'); }
      const order = ranked();
      if (clock >= 0) {
        order.forEach((k, place) => step(k, dt, place));
        for (let i = 0; i < racers.length; i++) for (let j = i + 1; j < racers.length; j++) {     // racers nudge each other apart
          const a = racers[i], b = racers[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          if (d < RADIUS * 2 && d > 0.001) { const push = (RADIUS * 2 - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
        }
        for (const b of boxes) { b.m.rotation.y = t * 2; b.m.rotation.x = t; if (b.back > 0 && (b.back -= dt) <= 0) b.m.visible = true; }
        for (let i = oils.length - 1; i >= 0; i--) { const o = oils[i]; o.age += dt; if (o.age > 25) { scene.remove(o.m); oils.splice(i, 1); } }
      }
      if (boat) {
        waterLayers[0].offset.set(t * 0.03, Math.sin(t * 0.4) * 0.05);
        waterLayers[1].offset.set(-t * 0.02, t * 0.025);
        if (clock > 0 && t - wakeAt > 0.09) {      // drop a puff of foam behind every moving boat
          wakeAt = t;
          for (const k of racers) {
            if (Math.hypot(k.vx, k.vz) < 6) continue;
            const w = wakes.find((x) => x.life <= 0); if (!w) break;
            w.life = 1; w.m.visible = true; w.m.position.x = k.x - Math.sin(k.th) * 2.6; w.m.position.z = k.z - Math.cos(k.th) * 2.6;
          }
        }
        for (const w of wakes) if (w.life > 0) {
          w.life -= dt * 0.9;
          (w.m.material as THREE.MeshBasicMaterial).opacity = Math.max(0, w.life) * 0.5;
          w.m.scale.setScalar(0.7 + (1 - w.life) * 1.6);
          if (w.life <= 0) w.m.visible = false;
        }
      }
      for (const pl of pools) pl.m.rotation.y = -t * 3;
      for (const w of waves) w.m.position.y = 0.3 + Math.sin(t * 3 + w.i) * 0.15;
      for (const k of racers) {
        k.mesh.position.set(k.x, boat ? Math.sin(t * 2.5 + k.x) * 0.12 : 0, k.z);
        k.mesh.rotation.y = k.th + (k.spin > 0 ? k.spin * 14 : 0);
        k.mesh.scale.setScalar(k.slow > 0 ? 1 : 1.5);
      }
      for (const l of lamps) {
        const ax = l.k.x + Math.sin(l.k.th) * 7, az = l.k.z + Math.cos(l.k.th) * 7;
        l.light.position.set(ax, 3.5, az); l.glow.position.x = ax; l.glow.position.z = az;
      }
      for (const k of racers) { k.mesh.scale.z = k.boost > 0 ? 2 : k.mesh.scale.x;
      }
      follow(dt);
      renderer.render(scene, cam);

      if (t - lastHud > 0.25) {
        lastHud = t;
        if (clock > 0) ctx.standings(order.filter((k) => k.finish == null).map((k) => k.p));
        board.replaceChildren(...order.map((k, i) => h('div.kart-row', h('span.kart-pos', String(i + 1)), h('span.badge', { style: { background: k.p.color } }, `${k.p.shape} ${k.p.name}`),
          h('span', k.finish != null ? '🏁' : `${k.item ? ITEM_LABEL[k.item].split(' ')[0] : ''} L${clamp(k.lap + 1, 1, LAPS)}`))));
        order.forEach((k, i) => {
          const big = k.finish != null ? `🏁 Finished ${ordinal(i + 1)}!` : `${ordinal(i + 1)} · Lap ${clamp(k.lap + 1, 1, LAPS)}/${LAPS}`;
          const info = k.spin > 0 ? (boat ? 'Whirlpool!' : 'Spinning out!') : k.slow > 0 ? (boat ? 'Hit a wave sideways!' : 'Zapped!') : k.off ? (boat ? 'Outside the buoys: rough water!' : 'Off the track!') : '';
          const btn = boat ? (k.cool <= 0 ? 'Swipe up to BOOST!' : 'Recharging…') : k.item ? ITEM_LABEL[k.item] : 'No item';
          if (big + info !== k.liveText || btn !== k.btnText) { k.liveText = big + info; k.btnText = btn; ctx.live(k.p, { big, info, 'btn-item': btn, 'btn-boost': btn }); }
        });
        if (firstFinish != null && !board.dataset.t) { board.dataset.t = '1'; ctx.timer(20); }
      }
      if (racers.every((k) => k.finish != null) || (firstFinish != null && clock > firstFinish + 20) || clock > 150) { stop(); resolve(); }
    });
  });

  const final = ranked();
  overlay.textContent = `${final[0].p.avatar} ${final[0].p.name} wins!`;
  ctx.wait(ctx.players, 'Race over!', '', '🏁');
  await ctx.sleep(3.5);
  return final.map((k, i) => ({ id: k.p.id, score: final.length - i, label: k.finish != null ? `${k.finish.toFixed(1)}s` : 'did not finish' }));
}
