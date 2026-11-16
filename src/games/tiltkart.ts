import * as THREE from 'three';
import { clamp, h, ordinal, pick, rand } from '../core/util';
import type { Ctx, GameDef } from '../host/ctx';
import type { Player } from '../host/room';

const TRACKS: [number, number][][] = [
  [[-60, -20], [-40, -34], [0, -30], [30, -36], [58, -22], [62, 4], [44, 22], [18, 14], [0, 28], [-30, 32], [-56, 20], [-66, 0]],
  [[-62, 0], [-50, -28], [-20, -34], [0, -14], [22, -32], [54, -28], [64, -4], [50, 22], [20, 30], [-8, 16], [-34, 32], [-58, 22]],
];
const N = 360;            // samples along the track centre line
const WIDTH = 11;         // road width
const LAPS = 3;
const VMAX = 24, ACCEL = 15, TURN = 2.5, RADIUS = 1.8;
type Item = 'boost' | 'oil' | 'zap';
const ITEM_LABEL: Record<Item, string> = { boost: '🚀 BOOST!', oil: '🛢️ DROP OIL', zap: '⚡ ZAP!' };

interface Kart {
  p: Player; mesh: THREE.Group; x: number; z: number; th: number; v: number; steer: number;
  idx: number; lap: number; item: Item | null; boost: number; spin: number; slow: number;
  finish: number | null; ai: boolean; skill: number; lane: number; useAt: number; liveText: string; btnText: string;
}

export const tiltkart: GameDef = {
  meta: { id: 'tiltkart', name: 'Tilt Kart', emoji: '🏎️', zone: 'Speedway', blurb: 'Tilt to steer. Tap for items. Three laps.', min: 2, max: 12 },
  async run(ctx: Ctx) {
    // ---------- scene ----------
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#33224f');
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
    const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

    const ribbon = (half: number, y: number, color: string) => {
      const pos: number[] = [], idx: number[] = [];
      for (let i = 0; i < N; i++) { const a = S[i], n = NRM[i]; pos.push(a.x + n.x * half, y, a.z + n.z * half, a.x - n.x * half, y, a.z - n.z * half); }
      for (let i = 0; i < N; i++) { const a = i * 2, b = ((i + 1) % N) * 2; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
      scene.add(m);
    };
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(600, 400), mat('#2f6b5e')); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.1; scene.add(ground);
    ribbon(WIDTH / 2 + 0.9, 0, '#f6ead2');   // painted edge
    ribbon(WIDTH / 2, 0.05, '#4a3b5c');      // tarmac
    // start line
    const line = new THREE.Mesh(new THREE.BoxGeometry(WIDTH, 0.05, 1.2), mat('#f6ead2'));
    line.position.set(S[0].x, 0.1, S[0].z); line.rotation.y = Math.atan2(T[0].x, T[0].z); scene.add(line);
    // scenery: tents and trees, kept off the road
    const offRoad = (x: number, z: number) => S.every((s) => (s.x - x) ** 2 + (s.z - z) ** 2 > (WIDTH / 2 + 5) ** 2);
    for (let i = 0; i < 70; i++) {
      const x = rand(170) - 85, z = rand(100) - 50;
      if (!offRoad(x, z)) continue;
      const tent = i % 4 === 0;
      const m = new THREE.Mesh(new THREE.ConeGeometry(tent ? 4 : 2, tent ? 5 : 6, tent ? 8 : 5), mat(tent ? pick(['#d9482b', '#e8b23a', '#f6ead2']) : '#1f4d45'));
      m.position.set(x, tent ? 2.5 : 3, z); scene.add(m);
    }

    const fit = () => {
      const w = ctx.stage.clientWidth || 1280, hh = ctx.stage.clientHeight || 680;
      renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix();
      const corners = [[-74, -44], [74, -44], [-74, 44], [74, 44]].map(([x, z]) => new THREE.Vector3(x, 0, z));
      for (let d = 80; d < 400; d += 5) {      // back the camera off until the whole track is in view
        cam.position.set(0, d * 0.86, d * 0.5); cam.lookAt(0, 0, 3); cam.updateMatrixWorld();
        if (corners.every((c) => { const v = c.clone().project(cam); return Math.abs(v.x) < 0.94 && Math.abs(v.y) < 0.9; })) break;
      }
    };
    fit(); addEventListener('resize', fit); ctx.onEnd(() => removeEventListener('resize', fit));

    // ---------- karts ----------
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
    const karts: Kart[] = ctx.players.map((p, i) => {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 3), mat(p.color)); body.position.y = 0.7;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 1), mat(p.color)); nose.position.set(0, 0.6, 1.8);
      const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 0), mat('#f6ead2')); head.position.set(0, 1.5, -0.3);
      g.add(body, nose, head, label(p));
      for (const [wx, wz] of [[-1.1, 1], [1.1, 1], [-1.1, -1], [1.1, -1]]) { const w = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.9), mat('#1b1220')); w.position.set(wx, 0.4, wz); g.add(w); }
      g.scale.setScalar(1.5); scene.add(g);
      const row = Math.floor(i / 3), col = (i % 3) - 1, idx = (N - 5 - row * 5) % N;
      return {
        p, mesh: g, x: S[idx].x + NRM[idx].x * col * 3.2, z: S[idx].z + NRM[idx].z * col * 3.2, th: Math.atan2(T[idx].x, T[idx].z), v: 0, steer: 0,
        idx, lap: -1, item: null, boost: 0, spin: 0, slow: 0, finish: null, ai: p.bot, skill: 0.84 + Math.random() * 0.14, lane: col * 2.5, useAt: 0, liveText: '', btnText: '',
      };
    });
    const kartOf = new Map(karts.map((k) => [k.p.id, k]));

    // ---------- items ----------
    const boxGeo = new THREE.BoxGeometry(1.8, 1.8, 1.8), boxMat = mat('#e8b23a');
    const boxes = [40, 100, 160, 220, 280, 330].flatMap((i) => [-3.2, 0, 3.2].map((off) => {
      const m = new THREE.Mesh(boxGeo, boxMat); m.position.set(S[i].x + NRM[i].x * off, 1.6, S[i].z + NRM[i].z * off); scene.add(m);
      return { m, back: 0 };
    }));
    const oils: { m: THREE.Mesh; owner: Kart; age: number }[] = [];
    const oilGeo = new THREE.CylinderGeometry(2, 2, 0.1, 10), oilMat = mat('#120c1c');
    const progress = (k: Kart) => k.lap * N + k.idx;
    const ranked = () => [...karts].sort((a, b) => (a.finish ?? 1e9) - (b.finish ?? 1e9) || progress(b) - progress(a));

    const use = (k: Kart) => {
      if (!k.item || k.finish != null || k.spin > 0) return;
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

    ctx.all({ type: 'tilt', key: ctx.key('kart'), buttons: [{ id: 'item', label: 'No item' }] });
    ctx.onInput((p, d) => {
      const k = kartOf.get(p.id); if (!k) return;
      if (typeof d.tilt === 'number') k.steer = clamp(d.tilt, -1, 1);
      if (d.btn === 'item') use(k);
    });

    // ---------- race ----------
    let clock = -3.6, firstFinish: number | null = null, lastHud = 0;
    const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

    const step = (k: Kart, dt: number, place: number) => {
      const ai = k.ai || !k.p.connected;
      if (ai || k.finish != null) {       // bots (and finished karts on their victory lap) follow the racing line
        const tgt = (k.idx + 13) % N;
        k.lane += (Math.random() - 0.5) * dt * 3; k.lane = clamp(k.lane, -3.5, 3.5);
        const tx = S[tgt].x + NRM[tgt].x * k.lane, tz = S[tgt].z + NRM[tgt].z * k.lane;
        k.steer = clamp(-wrap(Math.atan2(tx - k.x, tz - k.z) - k.th) * 2.5, -1, 1);
        if (ai && k.item && clock > k.useAt) use(k);
      }
      // nearest centre-line sample, searched near the last one
      let best = k.idx, bd = 1e9;
      for (let o = -8; o <= 22; o++) { const i = (k.idx + o + N) % N, d = (S[i].x - k.x) ** 2 + (S[i].z - k.z) ** 2; if (d < bd) { bd = d; best = i; } }
      if (k.idx > N * 0.75 && best < N * 0.25) k.lap++; else if (k.idx < N * 0.25 && best > N * 0.75) k.lap--;
      k.idx = best;
      const dist = Math.sqrt(bd), off = dist > WIDTH / 2 + 0.5;
      if (k.lap >= LAPS && k.finish == null) { k.finish = clock; firstFinish ??= clock; }

      let vmax = VMAX * (ai ? k.skill : 1) * (1 + 0.07 * (place / Math.max(1, karts.length - 1)));   // gentle catch-up for those behind
      if (off) vmax = 9;
      if (k.slow > 0) vmax *= 0.5;
      if (k.boost > 0) vmax = VMAX * 1.6;
      if (k.finish != null) vmax = VMAX * 0.5;
      k.boost -= dt; k.slow -= dt;
      if (k.spin > 0) { k.spin -= dt; k.v *= 1 - 2.5 * dt; }
      else {
        k.v += clamp(vmax - k.v, -ACCEL * 2.2 * dt, (k.boost > 0 ? ACCEL * 3 : ACCEL) * dt);
        k.th -= k.steer * TURN * dt * clamp(k.v / 8, 0, 1);
      }
      k.x += Math.sin(k.th) * k.v * dt; k.z += Math.cos(k.th) * k.v * dt;
      const lim = WIDTH / 2 + 6;        // invisible fence beside the grass verge
      if (dist > lim) { const s = S[k.idx]; k.x = s.x + ((k.x - s.x) / dist) * lim; k.z = s.z + ((k.z - s.z) / dist) * lim; k.v *= 0.9; }

      for (const b of boxes) if (b.back <= 0 && !k.item && k.finish == null && (b.m.position.x - k.x) ** 2 + (b.m.position.z - k.z) ** 2 < 6) {
        b.back = 3.5; b.m.visible = false;
        const behind = place / Math.max(1, karts.length - 1);
        k.item = Math.random() < 0.25 + behind * 0.4 ? 'boost' : Math.random() < 0.5 ? 'zap' : 'oil';
        k.useAt = clock + 0.5 + Math.random() * 3;
      }
      for (const o of oils) if ((o.owner !== k || o.age > 1) && k.spin <= 0 && (o.m.position.x - k.x) ** 2 + (o.m.position.z - k.z) ** 2 < 7) {
        k.spin = 1.1; k.boost = 0; o.age = 99;
      }
    };

    await new Promise<void>((resolve) => {
      const stop = ctx.frame((dt, t) => {
        clock += dt;
        const racing = clock >= 0;
        overlay.textContent = clock < -0.6 ? String(Math.ceil(-clock - 0.6)) : clock < 0.6 ? 'GO!' : '';
        const order = ranked();
        if (racing) {
          order.forEach((k, place) => step(k, dt, place));
          for (let i = 0; i < karts.length; i++) for (let j = i + 1; j < karts.length; j++) {     // karts nudge each other apart
            const a = karts[i], b = karts[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
            if (d < RADIUS * 2 && d > 0.001) { const push = (RADIUS * 2 - d) / 2; a.x -= (dx / d) * push; a.z -= (dz / d) * push; b.x += (dx / d) * push; b.z += (dz / d) * push; }
          }
          for (const b of boxes) { b.m.rotation.y = t * 2; b.m.rotation.x = t; if (b.back > 0 && (b.back -= dt) <= 0) b.m.visible = true; }
          for (let i = oils.length - 1; i >= 0; i--) { const o = oils[i]; o.age += dt; if (o.age > 25) { scene.remove(o.m); oils.splice(i, 1); } }
        }
        for (const k of karts) {
          k.mesh.position.set(k.x, 0, k.z);
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
            const info = k.spin > 0 ? 'Spinning out!' : k.slow > 0 ? 'Zapped!' : '';
            const btn = k.item ? ITEM_LABEL[k.item] : 'No item';
            if (big + info !== k.liveText || btn !== k.btnText) { k.liveText = big + info; k.btnText = btn; ctx.live(k.p, { big, info, 'btn-item': btn }); }
          });
          if (firstFinish != null && !board.dataset.t) { board.dataset.t = '1'; ctx.timer(20); }
        }
        if (karts.every((k) => k.finish != null) || (firstFinish != null && clock > firstFinish + 20) || clock > 150) { stop(); resolve(); }
      });
    });

    const final = ranked();
    overlay.textContent = `${final[0].p.avatar} ${final[0].p.name} wins!`;
    ctx.wait(ctx.players, 'Race over!', '', '🏁');
    await ctx.sleep(3.5);
    return { scores: final.map((k, i) => ({ id: k.p.id, score: final.length - i, label: k.finish != null ? `${k.finish.toFixed(1)}s` : 'did not finish' })) };
  },
};
