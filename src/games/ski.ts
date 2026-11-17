// Downhill Dash: a third-person ski race. Each skier gets their own view, so at most four race at once;
// bigger groups race in heats and the best times win.
import * as THREE from 'three';
import { clamp, h, ordinal, pick, shuffle } from '../core/util';
import { quality } from '../core/models';
import { skierDetailed } from '../core/details';
import type { Ctx, GameDef, Score } from '../host/ctx';
import type { Player } from '../host/room';

const LENGTH = 1500;            // how far it is to the finish
const HALF = 22;               // half-width of the groomed piste
const SLOPE = 0.22;            // drop per unit travelled
const Y = (z: number) => z * SLOPE;      // the hill: forward is -z, and downhill
const VMAX = 31, TUCK = 41;
const MISS = 1;                // seconds added to your time for every gate you miss

interface Hill { name: string; sky: string; snow: string; light: string; ambient: number; trees: number; rocks: number; night?: boolean }
const HILLS: Hill[] = [
  { name: 'Sunny Bowl', sky: '#9fd3f2', snow: '#f4f9fd', light: '#ffffff', ambient: 1.7, trees: 26, rocks: 8 },
  { name: 'Sunset Pines', sky: '#e8845c', snow: '#fff6ef', light: '#ffe0cc', ambient: 1.5, trees: 46, rocks: 12 },
  { name: 'Midnight Run', sky: '#070b1a', snow: '#9fb4d6', light: '#8fb4ff', ambient: 0.45, trees: 34, rocks: 10, night: true },
];

interface Skier {
  p: Player; g: THREE.Group; cam: THREE.PerspectiveCamera; x: number; z: number; a: number; v: number; steer: number; tuck: boolean;
  stun: number; air: number; boost: number; gates: number; missed: number; missFlash: number; nextGate: number; finish: number | null; hud: HTMLElement; line: HTMLElement; miss: HTMLElement; live: string; skill: number;
}

export const ski: GameDef = {
  meta: {
    id: 'ski', name: 'Downhill Dash', emoji: '⛷️', zone: 'Speedway', blurb: 'A ski race from behind your own skier. Four at a time.', min: 2, max: 12,
    howTo: [
      '⛷️ You see your own skier from behind, in your own part of the screen.',
      '↔️ TILT to carve left and right. Hard turns scrub off speed.',
      '⬇️ HOLD the tuck button to go faster. You turn less while tucked.',
      `🚩 Ski between the flags for a boost. Every gate you miss adds ${MISS} second to your time.`,
      '🌲 Dodge trees and rocks, and hit the ramps.',
    ],
  },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players);
    const vip = ctx.vip && P.includes(ctx.vip) && !ctx.vip.bot ? ctx.vip : null;
    let hill = pick(HILLS);
    if (vip) {         // the host player picks the hill
      ctx.show(h('div.col.pad', h('h1.big', 'Pick a hill'), h('div.row', ...HILLS.map((x) => h('div.answer', x.name))), h('p.sub', `${vip.name} is choosing…`)));
      ctx.wait(P.filter((p) => p !== vip));
      const key = ctx.key('hill');
      const v = (await ctx.collect([vip], () => ({ type: 'choice', key, id: key, prompt: 'Pick a hill', options: [...HILLS.map((x, i) => ({ id: String(i), label: x.name })), { id: 'r', label: '🎲 Surprise me' }] }), 15)).get(vip.id);
      hill = HILLS[Number(v)] ?? hill;
    }
    // Split into heats of at most four, as evenly as possible.
    const heatCount = Math.ceil(P.length / 4), heats: Player[][] = Array.from({ length: heatCount }, () => []);
    P.forEach((p, i) => heats[i % heatCount].push(p));

    const times = new Map<string, Run>();
    for (const [i, racers] of heats.entries()) {
      if (heatCount > 1) {
        ctx.show(h('div.col.pad', h('h1.big', `Heat ${i + 1} of ${heatCount}`), h('div.row', ...racers.map((p) => h('span.badge', { style: { background: p.color, fontSize: '1.6em' } }, `${p.avatar} ${p.name}`))), h('p.sub', 'Fastest times across all heats win.')));
        for (const p of P) if (!racers.includes(p)) {
          const mine = heats.findIndex((x) => x.includes(p));
          ctx.view(p, { type: 'wait', key: ctx.key('heat'), title: mine > i ? `You’re in heat ${mine + 1}` : 'Your run is done', text: 'Watch the big screen and heckle.', emoji: '🍿' });
        }
        await ctx.sleep(3.5);
      }
      for (const [id, r] of await heat(ctx, hill, racers)) times.set(id, r);
    }
    const order = [...P].sort((a, b) => (times.get(a.id)!.time ?? 1e9) - (times.get(b.id)!.time ?? 1e9) || times.get(b.id)!.dist - times.get(a.id)!.dist);
    const scores: Score[] = order.map((p, i) => { const r = times.get(p.id)!; return { id: p.id, score: order.length - i, label: r.time != null ? `${r.time.toFixed(1)}s${r.missed ? ` (${r.missed} missed, +${r.missed * MISS}s)` : ''}` : `fell ${Math.round(LENGTH - r.dist)}m short` }; });
    return { scores };
  },
};

/** A finished run: the time including penalties for missed gates (null if they never reached the bottom). */
interface Run { time: number | null; dist: number; missed: number }

/** One race of up to four skiers. Resolves with each skier's time (or how far they got). */
async function heat(ctx: Ctx, hill: Hill, racers: Player[]): Promise<Map<string, Run>> {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(racers.length > 1 ? 1 : Math.min(devicePixelRatio, 1.5));     // several views at once: keep it light
  renderer.setScissorTest(true);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(hill.sky);
  scene.fog = new THREE.Fog(hill.sky, 70, 240);
  scene.add(new THREE.AmbientLight(hill.light, hill.ambient));
  const sun = new THREE.DirectionalLight(hill.light, hill.night ? 0.3 : 1.3); sun.position.set(-30, 60, 40); scene.add(sun);
  const huds = h('div.ski-huds'), overlay = h('div.kart-overlay');
  ctx.show(renderer.domElement, huds, overlay);
  renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
  const dispose = () => { renderer.dispose(); scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); };
  ctx.onEnd(dispose);
  const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });
  const lit = (c: string) => new THREE.MeshBasicMaterial({ color: c });

  // ---------- the hill ----------
  const slab = (x0: number, x1: number, z0: number, z1: number, lift: number, material: THREE.Material) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([x0, Y(z0) + lift, z0, x1, Y(z0) + lift, z0, x0, Y(z1) + lift, z1, x1, Y(z1) + lift, z1], 3));
    g.setIndex([0, 1, 2, 1, 3, 2]); g.computeVertexNormals();
    const m = new THREE.Mesh(g, material); scene.add(m); return m;
  };
  slab(-140, 140, 80, -LENGTH - 260, 0, new THREE.MeshLambertMaterial({ color: hill.snow, side: THREE.DoubleSide }));
  slab(-HALF, HALF, 80, -LENGTH - 260, 0.04, new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide, transparent: true, opacity: hill.night ? 0.1 : 0.35 }));

  // Everything on the hill is placed from a fixed sequence, so every skier (and every heat) gets the same course.
  let seed = hill.name.length * 9973;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const solids: { x: number; z: number; r: number }[] = [];
  const gates: { x: number; z: number }[] = [];
  for (let z = -70; z > -LENGTH + 30; z -= 46) gates.push({ x: Math.sin(z * 0.021) * 12 + (rnd() - 0.5) * 5, z });
  const ramps: { x: number; z: number }[] = [0.14, 0.32, 0.5, 0.68, 0.85].map((f) => ({ x: (rnd() - 0.5) * 22, z: -LENGTH * f }));
  const ice: { x: number; z: number }[] = [0.24, 0.42, 0.6, 0.78].map((f) => ({ x: (rnd() - 0.5) * 16, z: -LENGTH * f }));
  const clearOf = (x: number, z: number) => gates.every((g) => Math.abs(g.z - z) > 9 || Math.abs(g.x - x) > 8) && ramps.every((r) => Math.abs(r.z - z) > 16 || Math.abs(r.x - x) > 7);

  const trees: [number, number, number][] = [];       // x, z, size
  for (let z = 60; z > -LENGTH - 200; z -= 5) for (const side of [-1, 1]) trees.push([side * (HALF + 4 + rnd() * 26), z + rnd() * 4, 0.8 + rnd() * 0.7]);   // forest either side
  for (let i = 0; i < hill.trees * 1.7; i++) { const x = (rnd() - 0.5) * (HALF * 2 - 4), z = -60 - rnd() * (LENGTH - 110); if (clearOf(x, z)) { trees.push([x, z, 0.9 + rnd() * 0.4]); solids.push({ x, z, r: 1.7 }); } }
  const dummy = new THREE.Object3D();
  const instanced = (geo: THREE.BufferGeometry, material: THREE.Material, list: [number, number, number][], lift: number) => {
    const m = new THREE.InstancedMesh(geo, material, list.length);
    list.forEach(([x, z, s], i) => { dummy.position.set(x, Y(z) + lift * s, z); dummy.scale.setScalar(s); dummy.rotation.set(0, x, 0); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); });
    scene.add(m);
  };
  instanced(new THREE.ConeGeometry(2.4, 8, 6), mat('#1f4d45'), trees, 4.4);
  instanced(new THREE.ConeGeometry(1.5, 3, 6), mat('#f4f8fb'), trees, 7.6);
  const rocks: [number, number, number][] = [];
  for (let i = 0; i < hill.rocks * 1.7; i++) { const x = (rnd() - 0.5) * (HALF * 2 - 6), z = -90 - rnd() * (LENGTH - 150); if (clearOf(x, z)) { rocks.push([x, z, 0.8 + rnd() * 0.6]); solids.push({ x, z, r: 1.9 }); } }
  instanced(new THREE.DodecahedronGeometry(1.8, 0), mat('#7b7f8a'), rocks, 0.8);

  gates.forEach((g, i) => {      // a pair of flags to ski between
    for (const side of [-1, 1]) {
      const c = i % 2 ? '#2f6bff' : '#ff3b30';
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4.5, 5), hill.night ? lit(c) : mat(c)); pole.position.set(g.x + side * 4.5, Y(g.z) + 2.25, g.z);
      const flag = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.9, 0.1), hill.night ? lit(c) : mat(c)); flag.position.set(g.x + side * 4.5 - side * 0.75, Y(g.z) + 3.9, g.z);
      scene.add(pole, flag);
    }
  });
  for (const r of ramps) {       // jumps: a wedge of packed snow with coloured markers
    const m = new THREE.Mesh(new THREE.BoxGeometry(8, 1.6, 6), mat('#dfe9f2')); m.position.set(r.x, Y(r.z) + 0.3, r.z); m.rotation.x = -SLOPE + 0.32; scene.add(m);
    for (const side of [-1, 1]) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.6, 5), lit('#ff9f1c')); f.position.set(r.x + side * 4.6, Y(r.z) + 0.9, r.z + 2); scene.add(f); }
  }
  for (const p of ice) slab(p.x - 7, p.x + 7, p.z + 14, p.z - 14, 0.06, new THREE.MeshLambertMaterial({ color: '#8fd8ff', side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
  // start and finish banners
  for (const [z, c] of [[-6, '#ffd23f'], [-LENGTH, '#ff3b30']] as [number, string][]) {
    for (const side of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 9, 6), mat('#5b4636')); post.position.set(side * HALF, Y(z) + 4.5, z); scene.add(post); }
    const banner = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2, 2, 0.3), lit(c)); banner.position.set(0, Y(z) + 9.5, z); scene.add(banner);
  }

  // ---------- skiers ----------
  const n = racers.length;
  const skiers: Skier[] = racers.map((p, i) => {
    const g = new THREE.Group();
    const add = (geo: THREE.BufferGeometry, c: string, x: number, y: number, z: number) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); g.add(m); return m; };
    if (quality.detailed) g.add(skierDetailed(p.color));
    else {
      add(new THREE.BoxGeometry(1, 1.5, 0.7), p.color, 0, 1.6, 0).rotation.x = -0.35;        // jacket, leaning into the hill
      add(new THREE.SphereGeometry(0.5, 8, 6), '#f3dcc0', 0, 2.75, -0.35);
      add(new THREE.SphereGeometry(0.53, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), p.color, 0, 2.8, -0.35);   // hat
      for (const sx of [-0.3, 0.3]) { add(new THREE.BoxGeometry(0.3, 0.9, 0.4), '#2b1d2e', sx, 0.6, 0.05); add(new THREE.BoxGeometry(0.22, 0.08, 2.8), '#e8b23a', sx, 0.1, -0.2); }
    }
    scene.add(g);
    if (hill.night) { const lamp = new THREE.PointLight('#fff1c9', 130, 34, 1.5); lamp.position.set(0, 3, -8); g.add(lamp); }
    const line = h('div', { style: { display: 'contents' } }), miss = h('span.ski-miss', { hidden: true }, `Missed gate! +${MISS}s`);
    const hud = h('div.ski-hud', { style: { borderColor: p.color } }, line, miss);
    huds.append(hud);
    const x = n > 1 ? -9 + (i / (n - 1)) * 18 : 0;
    return { p, g, cam: new THREE.PerspectiveCamera(62, 1, 0.5, 400), x, z: 0, a: 0, v: 0, steer: 0, tuck: false, stun: 0, air: 0, boost: 0, gates: 0, missed: 0, missFlash: 0, nextGate: 0, finish: null, hud, line, miss, live: '', skill: [0.78, 0.88, 0.97][p.level] + Math.random() * 0.06 };
  });
  const by = new Map(skiers.map((s) => [s.p.id, s]));
  ctx.all({ type: 'tilt', key: ctx.key('ski'), holds: [{ id: 'tuck', label: '⬇️ HOLD to tuck' }] }, racers);
  ctx.onInput((p, d) => {
    const s = by.get(p.id); if (!s) return;
    if (typeof d.tilt === 'number') s.steer = clamp(d.tilt, -1, 1);
    if (d.hold === 'tuck') s.tuck = !!d.on;
  });

  // One view per skier: full screen, side by side, or quarters.
  const cols = n === 1 ? 1 : 2, rowsN = n > 2 ? 2 : 1;
  const layout = () => {
    const w = ctx.stage.clientWidth || 1280, hh = ctx.stage.clientHeight || 680;
    renderer.setSize(w, hh, false);
    skiers.forEach((s, i) => {
      s.cam.aspect = (w / cols) / (hh / rowsN); s.cam.updateProjectionMatrix();
      Object.assign(s.hud.style, { left: `${((i % cols) / cols) * 100}%`, top: `${(Math.floor(i / cols) / rowsN) * 100}%`, width: `${100 / cols}%`, height: `${100 / rowsN}%` });
    });
  };
  layout(); addEventListener('resize', layout); ctx.onEnd(() => removeEventListener('resize', layout));

  let clock = -3.6, first: number | null = null, lastHud = 0;
  const step = (s: Skier, dt: number) => {
    const ai = s.p.bot || !s.p.connected;
    if (ai) {      // bots aim for the next gate and swerve round whatever is in the way
      const g = gates[s.nextGate];
      let aim = g ? g.x : 0;
      for (const o of solids) if (o.z < s.z - 1 && o.z > s.z - 18 && Math.abs(o.x - s.x) < 3.2) aim = o.x + (s.x >= o.x ? 6 : -6);
      const want = clamp((aim - s.x) * 0.09, -0.75, 0.75);
      s.steer = clamp((want - s.a) * 3, -1, 1);
      s.tuck = Math.abs(want - s.a) < 0.12 && s.skill > 0.84;
    }
    while (s.nextGate < gates.length && gates[s.nextGate].z > s.z) {       // crossed a gate line: through the flags or not?
      if (Math.abs(gates[s.nextGate].x - s.x) < 4.6) { s.gates++; s.boost = 1.2; }
      else if (s.finish == null) { s.missed++; s.missFlash = 1.6; ctx.buzz(s.p, 'hit'); }
      s.nextGate++;
    }
    if (s.finish != null) { s.v = Math.max(0, s.v - 26 * dt); s.a *= 1 - 3 * dt; }
    else if (s.stun > 0) { s.stun -= dt; s.v = Math.max(0, s.v - 60 * dt); }
    else {
      const onIce = ice.some((p) => Math.abs(p.z - s.z) < 14 && Math.abs(p.x - s.x) < 7), off = Math.abs(s.x) > HALF;
      let vmax = (s.tuck ? TUCK : VMAX) * (ai ? s.skill : 1) + (s.boost > 0 ? 9 : 0);
      if (off) vmax = 13;          // deep snow off the piste
      if (s.air <= 0) s.a = clamp(s.a + s.steer * (s.tuck ? 0.9 : 1.9) * (onIce ? 0.35 : 1) * dt, -1.05, 1.05);
      s.v += clamp(vmax - s.v, -22 * dt, (s.tuck ? 15 : 11) * dt);
      s.v -= Math.abs(s.a) * 5 * dt;       // carving costs speed
      for (const r of ramps) if (s.air <= 0 && Math.abs(r.z - s.z) < 3 && Math.abs(r.x - s.x) < 4) { s.air = 1; s.v += 5; ctx.sfx('whoosh'); ctx.buzz(s.p, 'good'); }
      for (const o of solids) if (s.air <= 0 && (o.x - s.x) ** 2 + (o.z - s.z) ** 2 < o.r * o.r) { s.stun = 1.2; s.x += s.x >= o.x ? 2.6 : -2.6; s.a = 0; ctx.comment('crash', s.p); }
    }
    s.boost -= dt; s.missFlash -= dt; if (s.air > 0) s.air -= dt;
    s.x = clamp(s.x + Math.sin(s.a) * s.v * dt, -HALF - 9, HALF + 9);
    s.z -= Math.cos(s.a) * s.v * dt;
    if (s.z <= -LENGTH && s.finish == null) { s.finish = clock; first ??= clock; }
  };

  await new Promise<void>((resolve) => {
    const stop = ctx.frame((dt, t) => {
      clock += dt;
      const sign = clock < -2.9 ? hill.name : clock < -0.6 ? String(Math.ceil(-clock - 0.6)) : clock < 0.6 ? 'GO!' : '';
      if (sign !== overlay.textContent) { overlay.textContent = sign; if (sign === 'GO!') ctx.sfx('go'); else if (sign.length === 1) ctx.sfx('count'); }
      if (clock >= 0) skiers.forEach((s) => step(s, dt));
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {      // skiers can't share the same patch of snow
        const a = skiers[i], b = skiers[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
        if (d < 1.8 && d > 0.01) { a.x -= (dx / d) * (1.8 - d) / 2; b.x += (dx / d) * (1.8 - d) / 2; }
      }
      for (const s of skiers) {
        const hop = s.air > 0 ? Math.sin((1 - s.air) * Math.PI) * 3.4 : 0;
        s.g.position.set(s.x, Y(s.z) + hop, s.z);
        s.g.rotation.set(s.stun > 0 ? s.stun * 9 : 0, -s.a, -s.a * 0.3);      // lean into turns; tumble when stunned
        s.g.scale.y = s.tuck && s.stun <= 0 ? 0.72 : 1;
        s.cam.position.set(s.x * 0.9, Y(s.z) + 5.2 + hop * 0.5, s.z + 10.5);
        s.cam.lookAt(s.x, Y(s.z - 12) + 1.5, s.z - 12);
      }
      const w = renderer.domElement.clientWidth, hh = renderer.domElement.clientHeight, vw = w / cols, vh = hh / rowsN;
      skiers.forEach((s, i) => {
        const vx = (i % cols) * vw, vy = hh - (Math.floor(i / cols) + 1) * vh;      // viewports are measured from the bottom
        renderer.setViewport(vx, vy, vw, vh); renderer.setScissor(vx, vy, vw, vh);
        renderer.render(scene, s.cam);
      });

      if (t - lastHud > 0.2) {
        lastHud = t;
        const order = [...skiers].sort((a, b) => (a.finish ?? 1e9) - (b.finish ?? 1e9) || a.z - b.z);
        if (clock > 3) ctx.standings(order.filter((s) => s.finish == null).map((s) => s.p));
        for (const s of skiers) {
          const place = order.indexOf(s) + 1, left = Math.max(0, Math.round(LENGTH + s.z));
          const pen = s.missed * MISS;
          const text = s.finish != null ? `🏁 ${(s.finish + pen).toFixed(1)}s${pen ? ` (incl. +${pen}s)` : ''}` : `${ordinal(place)} · ${left}m to go`;
          s.miss.hidden = !(s.missFlash > 0 && s.finish == null);      // showing it once plays its pop once
          s.line.replaceChildren(h('span.badge', { style: { background: s.p.color } }, `${s.p.shape} ${s.p.name}`), h('span.ski-place', text), h('span.ski-speed', s.finish != null ? '' : `${Math.round(s.v * 2.4)} km/h · 🚩${s.gates}${pen ? ` · ⏱ +${pen}s` : ''}`));
          const info = s.stun > 0 ? 'Wipeout!' : s.missFlash > 0 ? `Missed a gate: +${MISS}s on your time` : s.boost > 0 ? 'Through the flags: boost!' : Math.abs(s.x) > HALF ? 'Deep snow! Get back on the piste.' : '';
          const live = text + info;
          if (live !== s.live) { s.live = live; ctx.live(s.p, { big: text, info }); }
        }
        if (first != null && !huds.dataset.t) { huds.dataset.t = '1'; ctx.timer(15); }
      }
      if (skiers.every((s) => s.finish != null) || (first != null && clock > first + 15) || clock > 150) { stop(); resolve(); }
    });
  });
  ctx.clearTimer();
  const total = (s: Skier) => (s.finish != null ? s.finish + s.missed * MISS : null);
  const best = [...skiers].sort((a, b) => (total(a) ?? 1e9) - (total(b) ?? 1e9) || a.z - b.z)[0];
  overlay.textContent = `${best.p.avatar} ${best.p.name} takes the heat!`;
  ctx.wait(racers, 'Run over!', '', '🏁');
  await ctx.sleep(3);
  dispose();
  return new Map(skiers.map((s) => [s.p.id, { time: total(s), dist: Math.min(LENGTH, -s.z), missed: s.missed }]));
}
