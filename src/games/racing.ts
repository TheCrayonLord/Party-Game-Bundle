// The shared racing engine. Tilt Kart, Riptide Regatta and Draw Your Racer are all this with different settings.
import * as THREE from 'three';
import type { Stroke } from '../core/types';
import { clamp, drawStrokes, h, ordinal, pick, rand } from '../core/util';
import type { Ctx, Score } from '../host/ctx';
import type { Player } from '../host/room';

export interface RaceConfig {
  kind: 'kart' | 'boat';
  /** Drawn racers (player id -> strokes) replace the standard vehicle with the player's own art. */
  skins?: Map<string, Stroke[]>;
}

const TRACKS: [number, number][][] = [
  [[-60, -20], [-40, -34], [0, -30], [30, -36], [58, -22], [62, 4], [44, 22], [18, 14], [0, 28], [-30, 32], [-56, 20], [-66, 0]],
  [[-62, 0], [-50, -28], [-20, -34], [0, -14], [22, -32], [54, -28], [64, -4], [50, 22], [20, 30], [-8, 16], [-34, 32], [-58, 22]],
];
const N = 360;            // samples along the track centre line
const LAPS = 3;
const RADIUS = 1.8;
type Item = 'boost' | 'oil' | 'zap';
const ITEM_LABEL: Record<Item, string> = { boost: '🚀 BOOST!', oil: '🛢️ DROP OIL', zap: '⚡ ZAP!' };

// Karts grip and turn sharply; boats keep sliding the way they were going.
const PROFILE = {
  kart: { vmax: 24, accel: 15, turn: 2.5, grip: 14, width: 11, offroad: 9, bg: '#33224f', ground: '#2f6b5e', road: '#4a3b5c', edge: '#f6ead2' },
  boat: { vmax: 23, accel: 9, turn: 2.0, grip: 2.4, width: 13, offroad: 7, bg: '#33224f', ground: '#d9c48f', road: '#2b86a8', edge: '#e9f6f7' },
};

interface Racer {
  p: Player; mesh: THREE.Group; x: number; z: number; th: number; vx: number; vz: number; steer: number;
  idx: number; lap: number; item: Item | null; boost: number; spin: number; slow: number; cool: number; immune: number;
  finish: number | null; ai: boolean; skill: number; lane: number; useAt: number; liveText: string; btnText: string;
}

export async function runRace(ctx: Ctx, cfg: RaceConfig): Promise<Score[]> {
  const boat = cfg.kind === 'boat', pr = PROFILE[cfg.kind], WIDTH = pr.width;

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(pr.bg);
  const cam = new THREE.PerspectiveCamera(38, 16 / 9, 1, 600);
  scene.add(new THREE.AmbientLight('#ffe1c4', 1.5));
  const sun = new THREE.DirectionalLight('#ffb37a', 1.6); sun.position.set(-40, 80, 30); scene.add(sun);
  const overlay = h('div.kart-overlay');
  const board = h('div.kart-board');
  ctx.show(renderer.domElement, board, overlay);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  ctx.onEnd(() => { renderer.dispose(); scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); });

  const curve = new THREE.CatmullRomCurve3(pick(TRACKS).map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'catmullrom', 0.5);
  const S = curve.getSpacedPoints(N).slice(0, N);                 // centre line
  const T = S.map((_, i) => curve.getTangentAt(i / N).setY(0).normalize());
  const NRM = T.map((t) => new THREE.Vector3(-t.z, 0, t.x));      // points to the left of travel
  const mat = (c: string, opacity = 1) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, transparent: opacity < 1, opacity });
  const at = (i: number, off = 0) => ({ x: S[i].x + NRM[i].x * off, z: S[i].z + NRM[i].z * off });

  const ribbon = (half: number, y: number, color: string) => {
    const pos: number[] = [], idx: number[] = [];
    for (let i = 0; i < N; i++) { const a = S[i], n = NRM[i]; pos.push(a.x + n.x * half, y, a.z + n.z * half, a.x - n.x * half, y, a.z - n.z * half); }
    for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })));
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), mat(pr.ground)); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; scene.add(ground);
  ribbon(WIDTH / 2 + 0.9, 0, pr.edge);     // painted edge / foam
  ribbon(WIDTH / 2, 0.05, pr.road);        // tarmac / water
  const line = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.05, 1.2), mat('#f6ead2'));
  line.position.set(S[0].x, 0.1, S[0].z); line.rotation.y = Math.atan2(T[0].x, T[0].z); scene.add(line);
  // scenery, kept off the course
  const clear = (x: number, z: number) => S.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 > (WIDTH / 2 + 5) ** 2);
  for (let i = 0; i < 70; i++) {
    const x = rand(170) - 85, z = rand(100) - 50;
    if (!clear(x, z)) continue;
    const big = i % 4 === 0;
    const m = boat
      ? new THREE.Mesh(big ? new THREE.DodecahedronGeometry(3, 0) : new THREE.ConeGeometry(2.4, 5, 6), mat(big ? '#8d8478' : '#3b7d4f'))
      : new THREE.Mesh(new THREE.ConeGeometry(big ? 4 : 2, big ? 5 : 6, big ? 8 : 5), mat(big ? pick(['#d9482b', '#e8b23a', '#f6ead2']) : '#1f4d45'));
    m.position.set(x, big ? 2 : 3, z); scene.add(m);
  }

  const fit = () => {
    const w = ctx.stage.clientWidth || 1280, hh = ctx.stage.clientHeight || 680;
    renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
    const corners = [[-76, -46], [76, -46], [-76, 46], [76, 46]].map(([x, z]) => new THREE.Vector3(x, 0, z));
    for (let d = 80; d < 400; d += 5) {      // back the camera off until the whole course is in view
      cam.position.set(0, d * 0.86, d * 0.5); cam.lookAt(0, 0, 3); cam.updateMatrixWorld();
      if (corners.every((c) => { const v = c.clone().project(cam); return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9; })) break;
    }
  };
  fit(); addEventListener('resize', fit); ctx.onEnd(() => removeEventListener('resize', fit));

  // ---------- racers ----------
  const label = (p: Player) => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d')!;
    g.fillStyle = p.color; g.strokeStyle = '#1b1220'; g.lineWidth = 5;
    g.beginPath(); g.roundRect(3, 3, 250, 58, 28); g.fill(); g.stroke();
    g.fillStyle = '#1b1220'; g.font = 'bold 34px Trebuchet MS, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(`${p.shape} ${p.name}`, 128, 34, 236);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
    s.scale.set(9, 2.25, 1); s.position.y = 4.6; s.renderOrder = 10;
    return s;
  };
  const build = (p: Player) => {
    const g = new THREE.Group();
    const skin = cfg.skins?.get(p.id);
    if (skin?.length) {
      // The player's drawing, laid flat on a plate in their colour. The top of the drawing is the front.
      const c = document.createElement('canvas'); c.width = c.height = 256;
      drawStrokes(c.getContext('2d')!, skin, 256);
      const art = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 4.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true }));
      art.rotation.x = -Math.PI / 2; art.rotation.z = Math.PI; art.position.y = 0.75;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.5, 8), mat('#fbf5e6')); plate.position.y = 0.4;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.8, 0.3, 8), mat(p.color)); rim.position.y = 0.2;
      g.add(rim, plate, art);
    } else if (boat) {
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
    g.add(label(p)); g.scale.setScalar(1.5); scene.add(g);
    return g;
  };
  const racers: Racer[] = ctx.players.map((p, i) => {
    const row = Math.floor(i / 3), col = (i % 3) - 1, idx = (N - 5 - row * 5) % N, s = at(idx, col * 3.2);
    return {
      p, mesh: build(p), x: s.x, z: s.z, th: Math.atan2(T[idx].x, T[idx].z), vx: 0, vz: 0, steer: 0,
      idx, lap: -1, item: null, boost: 0, spin: 0, slow: 0, cool: 2, immune: 0, finish: null, ai: p.bot, skill: 0.84 + Math.random() * 0.14, lane: col * 2.5, useAt: 0, liveText: '', btnText: '',
    };
  });
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
    for (const [i, off] of [[95, 2.5], [200, -2.5], [280, 2]]) {   // whirlpools: spin you round, then fling you out
      const s = at(i, off), m = new THREE.Mesh(new THREE.CylinderGeometry(4, 2.4, 0.4, 7), mat('#12425c'));
      m.position.set(s.x, 0.15, s.z); scene.add(m); pools.push({ ...s, m });
    }
    for (const [from, dir] of [[20, 1], [165, -1], [255, 1]]) {    // currents: a sideways shove along a stretch of water
      currents.push({ from, to: from + 22, dir });
      for (let i = from; i < from + 22; i += 4) for (const off of [-3.5, 0, 3.5]) {
        const s = at(i, off), a = new THREE.Mesh(new THREE.ConeGeometry(0.7, 2, 3), mat('#9fe0ee', 0.8));
        a.position.set(s.x, 0.2, s.z); a.rotation.x = Math.PI / 2; a.rotation.z = -Math.atan2(NRM[i].x * dir, NRM[i].z * dir); a.scale.y = 1; scene.add(a);
      }
    }
    for (const [i, off] of [[70, -3], [75, 3.5], [120, 0], [185, 3.5], [240, -3.5], [300, -1], [340, 3]]) {   // buoys: solid
      const s = at(i, off); buoys.push(s);
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 1.6, 8), mat('#d9482b')); b.position.set(s.x, 0.8, s.z);
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 5), mat('#f6ead2')); top.position.set(s.x, 1.9, s.z);
      scene.add(b, top);
    }
  }

  const use = (k: Racer) => {
    if (k.finish != null || k.spin > 0) return;
    if (boat) { if (k.cool <= 0) { k.boost = 1.3; k.cool = 6; } return; }
    if (!k.item) return;
    const it = k.item; k.item = null;
    if (it === 'boost') k.boost = 1.6;
    else if (it === 'oil') {
      const m = new THREE.Mesh(oilGeo, oilMat); m.position.set(k.x - Math.sin(k.th) * 4, 0.12, k.z - Math.cos(k.th) * 4); scene.add(m);
      oils.push({ m, owner: k, age: 0 });
    } else {
      const r = ranked(), me = r.indexOf(k), target = r.slice(0, me).reverse().find((o) => o.finish == null);
      if (target) target.slow = 2; else k.boost = 0.8; // leading the race: a little consolation boost
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
  let clock = -3.6, firstFinish: number | null = null, lastHud = 0;
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

  const step = (k: Racer, dt: number, place: number) => {
    const ai = k.ai || !k.p.connected;
    if (ai || k.finish != null) {       // bots (and finishers on their victory lap) follow the racing line
      const tgt = (k.idx + (boat ? 17 : 13)) % N;
      k.lane += (Math.random() - 0.5) * dt * 3; k.lane = clamp(k.lane, -3.5, 3.5);
      const s = at(tgt, k.lane);
      k.steer = clamp(-wrap(Math.atan2(s.x - k.x, s.z - k.z) - k.th) * 2.5, -1, 1);
      if (ai && clock > k.useAt && (boat ? k.cool <= 0 : k.item)) { use(k); k.useAt = clock + 1 + Math.random() * 5; }
    }
    // nearest centre-line sample, searched near the last one
    let best = k.idx, bd = 1e9;
    for (let o = -8; o <= 22; o++) { const i = (k.idx + o + N) % N, d = (S[i].x - k.x) ** 2 + (S[i].z - k.z) ** 2; if (d < bd) { bd = d; best = i; } }
    if (k.idx > N * 0.75 && best < N * 0.25) k.lap++; else if (k.idx < N * 0.25 && best > N * 0.75) k.lap--;
    const crossed = (i: number) => (best - i + N) % N < 30 && (k.idx - i + N) % N > N - 30;   // passed sample i this frame
    const dist = Math.sqrt(bd), off = dist > WIDTH / 2 + 0.5;
    if (k.lap >= LAPS && k.finish == null) { k.finish = clock; firstFinish ??= clock; }

    const fx = Math.sin(k.th), fz = Math.cos(k.th);
    if (boat && k.spin <= 0) {
      for (const w of waves) if (crossed(w.i)) { if (fx * T[w.i].x + fz * T[w.i].z > 0.93) k.boost = Math.max(k.boost, 0.9); else k.slow = 1; }
      for (const c of currents) if (best >= c.from && best < c.to) { k.vx += NRM[best].x * c.dir * 9 * dt; k.vz += NRM[best].z * c.dir * 9 * dt; }
      for (const pl of pools) if (k.immune <= 0 && (pl.x - k.x) ** 2 + (pl.z - k.z) ** 2 < 16) { k.spin = 0.9; k.immune = 6; }
      for (const b of buoys) { const dx = k.x - b.x, dz = k.z - b.z, d = Math.hypot(dx, dz); if (d < 2.6 && d > 0.01) { k.x = b.x + (dx / d) * 2.6; k.z = b.z + (dz / d) * 2.6; k.vx *= 0.6; k.vz *= 0.6; } }
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
      k.th -= k.steer * pr.turn * dt * clamp(Math.abs(vf) / 8, 0, 1);
    }
    k.x += k.vx * dt; k.z += k.vz * dt;
    const lim = WIDTH / 2 + 6;        // invisible fence beside the verge
    if (dist > lim) { const s = S[k.idx]; k.x = s.x + ((k.x - s.x) / dist) * lim; k.z = s.z + ((k.z - s.z) / dist) * lim; k.vx *= 0.9; k.vz *= 0.9; }

    for (const b of boxes) if (b.back <= 0 && !k.item && k.finish == null && (b.m.position.x - k.x) ** 2 + (b.m.position.z - k.z) ** 2 < 6) {
      b.back = 3.5; b.m.visible = false;
      const behind = place / Math.max(1, racers.length - 1);
      k.item = Math.random() < 0.25 + behind * 0.4 ? 'boost' : Math.random() < 0.5 ? 'zap' : 'oil';
      k.useAt = clock + 0.5 + Math.random() * 3;
    }
    for (const o of oils) if ((o.owner !== k || o.age > 1) && k.spin <= 0 && (o.m.position.x - k.x) ** 2 + (o.m.position.z - k.z) ** 2 < 7) { k.spin = 1.1; k.boost = 0; o.age = 99; }
  };

  await new Promise<void>((resolve) => {
    const stop = ctx.frame((dt, t) => {
      clock += dt;
      overlay.textContent = clock < -0.6 ? String(Math.ceil(-clock - 0.6)) : clock < 0.6 ? 'GO!' : '';
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
      for (const pl of pools) pl.m.rotation.y = -t * 3;
      for (const w of waves) w.m.position.y = 0.3 + Math.sin(t * 3 + w.i) * 0.15;
      for (const k of racers) {
        k.mesh.position.set(k.x, boat ? Math.sin(t * 2.5 + k.x) * 0.12 : 0, k.z);
        k.mesh.rotation.y = k.th + (k.spin > 0 ? k.spin * 14 : 0);
        k.mesh.scale.setScalar(k.slow > 0 ? 1 : 1.5); k.mesh.scale.z = k.boost > 0 ? 2 : k.mesh.scale.x;
      }
      renderer.render(scene, cam);

      if (t - lastHud > 0.25) {
        lastHud = t;
        board.replaceChildren(...order.map((k, i) => h('div.kart-row', h('span.kart-pos', String(i + 1)), h('span.badge', { style: { background: k.p.color } }, `${k.p.shape} ${k.p.name}`),
          h('span', k.finish != null ? '🏁' : `${k.item ? ITEM_LABEL[k.item].split(' ')[0] : ''} L${clamp(k.lap + 1, 1, LAPS)}`))));
        order.forEach((k, i) => {
          const big = k.finish != null ? `🏁 Finished ${ordinal(i + 1)}!` : `${ordinal(i + 1)} · Lap ${clamp(k.lap + 1, 1, LAPS)}/${LAPS}`;
          const info = k.spin > 0 ? (boat ? 'Whirlpool!' : 'Spinning out!') : k.slow > 0 ? (boat ? 'Hit a wave sideways!' : 'Zapped!') : '';
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
