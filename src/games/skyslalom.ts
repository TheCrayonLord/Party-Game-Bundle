import * as THREE from 'three';
import { clamp, h } from '../core/util';
import type { Ctx, GameDef } from '../host/ctx';
import type { Player } from '../host/room';

const RINGS = 22, GAP = 2.1 /* seconds between rings */, SPEED_Z = 46, FAR = -230;
const XR = 17, YLO = 2, YHI = 19;        // the box the planes fly in

interface Plane { p: Player; mesh: THREE.Group; x: number; y: number; vx: number; vy: number; tx: number; ty: number; score: number; streak: number; aimX: number; aimY: number; live: string }

export const skyslalom: GameDef = {
  meta: { id: 'skyslalom', name: 'Sky Slalom', emoji: '🛩️', zone: 'Speedway', blurb: 'Paper planes over the park. Tilt to bank, dive and climb through the hoops.', min: 2, max: 12,
    howTo: [
      "🛩️ TILT left and right to bank. Tip the phone back to climb, forward to dive.",
      "⭕ Fly through the hoops as they arrive: 100 points each.",
      "🟡 Thread the small gold ring in the middle for 250.",
      "🔥 Don’t miss: every hoop in a row is worth more.",
    ] },
  async run(ctx: Ctx) {
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#3a2358');
    scene.fog = new THREE.Fog('#7a3b6b', 120, 260);
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 400);
    cam.position.set(0, 4, 21); cam.lookAt(0, 10, -12);    // the whole flying box just fills the screen
    scene.add(new THREE.AmbientLight('#ffe1c4', 1.6));
    const sun = new THREE.DirectionalLight('#ffb37a', 1.4); sun.position.set(-20, 40, 30); scene.add(sun);
    const overlay = h('div.kart-overlay'), board = h('div.kart-board');
    ctx.show(renderer.domElement, board, overlay);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%';
    ctx.onEnd(() => { renderer.dispose(); scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.map?.dispose?.(); o.material?.dispose?.(); }); });
    const fit = () => { const w = ctx.stage.clientWidth || 1280, hh = ctx.stage.clientHeight || 680; renderer.setSize(w, hh, false); cam.aspect = w / hh; cam.updateProjectionMatrix(); };
    fit(); addEventListener('resize', fit); ctx.onEnd(() => removeEventListener('resize', fit));
    const mat = (c: string) => new THREE.MeshLambertMaterial({ color: c, flatShading: true });

    // The park far below: tents and lights scrolling past.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 600), mat('#27304f')); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -14, -150); scene.add(ground);
    const scenery: THREE.Mesh[] = [];
    for (let i = 0; i < 60; i++) {
      const tent = i % 3 === 0;
      const m = new THREE.Mesh(tent ? new THREE.ConeGeometry(5, 7, 8) : new THREE.SphereGeometry(0.7, 5, 4), tent ? mat(['#d9482b', '#e8b23a', '#f6ead2'][i % 3 === 0 ? (i / 3) % 3 | 0 : 0]) : new THREE.MeshBasicMaterial({ color: '#ffe9a8' }));
      m.position.set((Math.random() - 0.5) * 220, tent ? -10.5 : -8 - Math.random() * 4, FAR + Math.random() * 280); scene.add(m); scenery.push(m);
    }

    // Planes.
    const paper = () => {      // a folded paper dart: two wings and a keel
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -2.2, -1.5, 0.25, 1, 0, 0, 1,   0, 0, -2.2, 0, 0, 1, 1.5, 0.25, 1,   0, 0, -2.2, 0, -0.6, 1, 0, 0, 1], 3));
      g.computeVertexNormals();
      return g;
    };
    const n = ctx.players.length;
    const planes: Plane[] = ctx.players.map((p, i) => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(paper(), new THREE.MeshLambertMaterial({ color: p.color, side: THREE.DoubleSide, flatShading: true })));
      scene.add(g);
      const x = n > 1 ? -XR * 0.8 + (i / (n - 1)) * XR * 1.6 : 0;
      return { p, mesh: g, x, y: 8 + (i % 3) * 3, vx: 0, vy: 0, tx: 0, ty: 0, score: 0, streak: 0, aimX: 0, aimY: 0, live: '' };
    });
    const by = new Map(planes.map((pl) => [pl.p.id, pl]));
    ctx.all({ type: 'tilt', key: ctx.key('fly'), pitch: true });
    ctx.onInput((p, d) => { const pl = by.get(p.id); if (!pl) return; if (typeof d.tilt === 'number') pl.tx = clamp(d.tilt, -1, 1); if (typeof d.pitch === 'number') pl.ty = clamp(d.pitch, -1, 1); });

    // Rings: a wandering line of hoops, each with a small gold centre.
    const ringGeo = new THREE.TorusGeometry(4.2, 0.4, 6, 20), goldGeo = new THREE.TorusGeometry(1.7, 0.22, 6, 14);
    let rx = 0, ry = 10;
    const rings = Array.from({ length: RINGS }, (_, i) => {
      rx = clamp(rx + (Math.random() - 0.5) * 16, -XR + 4, XR - 4); ry = clamp(ry + (Math.random() - 0.5) * 9, YLO + 4, YHI - 4);
      const g = new THREE.Group();
      g.add(new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#f6ead2' })), new THREE.Mesh(goldGeo, new THREE.MeshBasicMaterial({ color: '#e8b23a' })));
      g.position.set(rx, ry, FAR); g.visible = false; scene.add(g);
      return { g, x: rx, y: ry, at: 3 + i * GAP, done: false };     // `at` = the moment it reaches the planes
    });

    let clock = -3.5, gust = 0, gustUntil = 0, lastHud = 0;
    await new Promise<void>((resolve) => {
      const stop = ctx.frame((dt, t) => {
        clock += dt;
        overlay.textContent = clock < -0.5 ? String(Math.ceil(-clock - 0.5)) : clock < 0.5 ? 'FLY!' : gustUntil > clock ? (gust > 0 ? '💨 Gust! ➡' : '⬅ Gust! 💨') : '';
        overlay.style.fontSize = clock > 0.5 ? '3em' : ''; overlay.style.alignItems = clock > 0.5 ? 'start' : '';
        if (clock > 0 && clock > gustUntil + 7 && Math.random() < dt * 0.25) { gust = Math.random() < 0.5 ? -1 : 1; gustUntil = clock + 2.2; }   // now and then, wind shoves everyone sideways
        const wind = gustUntil > clock ? gust * 16 : 0;
        const next = rings.find((r) => !r.done);

        for (const pl of planes) {
          if (pl.p.bot || !pl.p.connected) {    // bots aim for the next hoop, not always well
            const slop = [13, 7, 3][ctx.botLevel];
            if (next && Math.random() < dt * 1.5) { pl.aimX = next.x + (Math.random() - 0.5) * slop; pl.aimY = next.y + (Math.random() - 0.5) * slop; }
            pl.tx = clamp((pl.aimX - pl.x) * 0.35, -1, 1); pl.ty = clamp((pl.aimY - pl.y) * 0.35, -1, 1);
          }
          if (clock > 0) {
            pl.vx += (pl.tx * 20 - pl.vx) * Math.min(1, dt * 5); pl.vy += (pl.ty * 15 - pl.vy) * Math.min(1, dt * 5);
            pl.x = clamp(pl.x + (pl.vx + wind) * dt, -XR, XR); pl.y = clamp(pl.y + pl.vy * dt, YLO, YHI);
          }
          pl.mesh.position.set(pl.x, pl.y + Math.sin(t * 2 + pl.x) * 0.15, 0);
          pl.mesh.children[0].rotation.set(pl.vy * 0.03, 0, -pl.vx * 0.045);     // bank into turns, nose up when climbing
        }

        for (const r of rings) {
          const z = (clock - r.at) * SPEED_Z;
          r.g.visible = z > FAR && z < 12; r.g.position.z = z; r.g.rotation.z = t * 0.6;
          if (!r.done && z >= 0) {
            r.done = true;
            for (const pl of planes) {
              const d = Math.hypot(pl.x - r.x, pl.y - r.y);
              if (d < 1.9) { pl.score += 250 + pl.streak * 25; pl.streak++; }
              else if (d < 4.4) { pl.score += 100 + pl.streak * 25; pl.streak++; }
              else pl.streak = 0;
            }
          }
        }
        for (const m of scenery) { m.position.z += SPEED_Z * 0.8 * dt; if (m.position.z > 40) m.position.z = FAR; }
        renderer.render(scene, cam);

        if (t - lastHud > 0.3) {
          lastHud = t;
          const order = [...planes].sort((a, b) => b.score - a.score), left = rings.filter((r) => !r.done).length;
          if (clock > 4) ctx.standings(order.map((pl) => pl.p));
          board.replaceChildren(h('div.kart-row', h('span'), h('span', `Hoops left: ${left}`), h('span')), ...order.map((pl, i) => h('div.kart-row', h('span.kart-pos', String(i + 1)), h('span.badge', { style: { background: pl.p.color } }, `${pl.p.shape} ${pl.p.name}`), h('span', `${pl.score}${pl.streak > 1 ? ` 🔥${pl.streak}` : ''}`))));
          for (const pl of planes) { const big = `${pl.score} pts${pl.streak > 1 ? ` · 🔥 ${pl.streak} in a row` : ''}`; if (big !== pl.live) { pl.live = big; ctx.live(pl.p, { big }); } }
        }
        if (rings.every((r) => r.done) && clock > rings[RINGS - 1].at + 1.5) { stop(); resolve(); }
      });
    });
    const order = [...planes].sort((a, b) => b.score - a.score);
    overlay.style.fontSize = ''; overlay.style.alignItems = '';
    overlay.textContent = `${order[0].p.avatar} ${order[0].p.name} wins!`;
    ctx.wait(ctx.players, 'Landed!', '', '🛬');
    await ctx.sleep(3.5);
    return { scores: order.map((pl) => ({ id: pl.p.id, score: pl.score })) };
  },
};
