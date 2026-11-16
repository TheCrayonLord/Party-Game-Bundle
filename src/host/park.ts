// The walk-around menu: an old carnival seen from a high angle. Players appear at the front gate
// and choose a game by walking to it; when most of them stand at the same ride, it starts.
import * as THREE from 'three';
import { clamp, h, pick } from '../core/util';
import type { GameDef } from './ctx';
import type { Player, Room } from './room';

const ZONE_COLORS: Record<string, string> = { Speedway: '#c9553a', Lagoon: '#3f8fa6', 'Art Alley': '#d9a441', Midway: '#b0527a', 'Fortune Tent': '#6f5aa8', 'Haunted Manor': '#4f6b5a' };
const XMAX = 50, ZMIN = -30, ZMAX = 33, SPEED = 15, PAD_R = 4.6;
const SPAWN = { x: 0, z: 27 };

interface Booth { game: GameDef; x: number; z: number; px: number; pz: number; open: boolean; label: HTMLElement; count: HTMLElement; pad: THREE.Mesh; roof: THREE.Mesh; votes: number }
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

  private buildScenery() {
    const { scene } = this, m = (c: string) => this.mat(c), lit = (c: string) => new THREE.MeshBasicMaterial({ color: c });
    const flat = (w: number, d: number, c: string, x: number, z: number, y = 0.02) => { const p = this.add(new THREE.PlaneGeometry(w, d), m(c), x, y, z); p.rotation.x = -Math.PI / 2; return p; };
    flat(400, 300, '#566349', 0, 0, 0);                       // tired old grass
    flat(12, 40, '#bfa77f', 0, 14, 0.03);                      // worn dirt paths: gate to the midway…
    for (const z of [-16, 4, 22]) flat(100, 7, '#bfa77f', 0, z, 0.03);   // …and along each row of rides

    // Front gate: two faded pillars and an arch.
    for (const x of [-7, 7]) { this.add(new THREE.BoxGeometry(2.4, 10, 2.4), m('#c9553a'), x, 5, ZMAX + 1); this.add(new THREE.SphereGeometry(1.5, 8, 6), lit('#ffe2a0'), x, 11, ZMAX + 1); }
    this.add(new THREE.BoxGeometry(18, 2.6, 1.6), m('#e7d7b1'), 0, 10.2, ZMAX + 1);
    for (let i = -3; i <= 3; i++) this.add(new THREE.SphereGeometry(0.4, 6, 5), lit(i % 2 ? '#ffd27a' : '#ff8f6b'), i * 2.2, 8.6, ZMAX + 1.9);
    // Picket fence either side of the gate.
    for (let x = -XMAX - 2; x <= XMAX + 2; x += 3) if (Math.abs(x) > 9) this.add(new THREE.BoxGeometry(0.6, 2.4, 0.4), m('#d8c9a6'), x, 1.2, ZMAX + 1.5);

    // String lights sagging between poles along each path.
    for (const z of [-11.5, 8.5]) {
      for (let x = -48; x <= 48; x += 24) this.add(new THREE.CylinderGeometry(0.2, 0.25, 9, 5), m('#5b4636'), x, 4.5, z);
      for (let x = -48; x < 48; x += 2) {
        const t = ((x + 48) % 24) / 24;
        this.add(new THREE.SphereGeometry(0.32, 6, 5), lit(['#ffd27a', '#ff8f6b', '#9fe0d8'][((x + 48) / 2) % 3]), x, 9 - Math.sin(t * Math.PI) * 2.2, z);
      }
    }

    // A creaky Ferris wheel and a big top behind the back row.
    const wheel = new THREE.Group(); wheel.position.set(30, 15, -44);
    this.add(new THREE.TorusGeometry(12, 0.5, 6, 20), m('#d8c9a6'), 0, 0, 0, wheel);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const spoke = this.add(new THREE.BoxGeometry(24, 0.35, 0.35), m('#d8c9a6'), 0, 0, 0, wheel); spoke.rotation.z = a; if (i >= 4) spoke.visible = false;
      this.add(new THREE.BoxGeometry(2.6, 2.2, 2), m(['#c9553a', '#d9a441', '#3f8fa6', '#b0527a'][i % 4]), Math.cos(a) * 12, Math.sin(a) * 12, 0, wheel);
    }
    scene.add(wheel); this.spinners.push(wheel);
    for (const x of [26, 34]) { const leg = this.add(new THREE.BoxGeometry(0.8, 17, 0.8), m('#5b4636'), x, 8, -44); leg.rotation.z = x < 30 ? -0.25 : 0.25; }
    this.add(new THREE.CylinderGeometry(13, 13, 6, 12), m('#e7d7b1'), -28, 3, -46);
    this.add(new THREE.ConeGeometry(14.5, 9, 12), m('#c9553a'), -28, 10.5, -46);
    this.add(new THREE.SphereGeometry(0.8, 6, 5), lit('#ffe2a0'), -28, 15.5, -46);
    // Scruffy trees around the edge.
    for (let i = 0; i < 26; i++) {
      const side = i % 2 ? 1 : -1, x = side * (XMAX + 6 + (i * 7) % 14), z = ZMIN - 6 + ((i * 13) % 70);
      this.add(new THREE.CylinderGeometry(0.4, 0.5, 3, 5), m('#5b4636'), x, 1.5, z);
      this.add(new THREE.ConeGeometry(3, 7, 6), m(i % 3 ? '#3f5a49' : '#4d6248'), x, 6, z);
    }
  }

  private buildBooths(games: GameDef[]) {
    // Three rows facing the gate: five at the back, five in the middle, four at the front (two each side of the path).
    const slots: [number, number][] = [...[-40, -20, 0, 20, 40].map((x): [number, number] => [x, -25]), ...[-40, -20, 0, 20, 40].map((x): [number, number] => [x, -5]), [-42, 13], [-24, 13], [24, 13], [42, 13]];
    games.slice(0, slots.length).forEach((game, i) => {
      const [x, z] = slots[i], color = ZONE_COLORS[game.meta.zone] || '#c9553a';
      this.add(new THREE.BoxGeometry(8, 3.4, 4.6), this.mat('#e7d7b1'), x, 1.7, z);                          // counter
      for (const sx of [-3.6, 3.6]) this.add(new THREE.BoxGeometry(0.5, 6, 0.5), this.mat('#8a6a45'), x + sx, 3, z + 2);   // awning posts
      const roof = this.add(new THREE.ConeGeometry(6.6, 3.6, 4), this.mat(color), x, 7.6, z); roof.rotation.y = Math.PI / 4;
      this.add(new THREE.BoxGeometry(8.6, 0.7, 0.4), this.mat(color), x, 5.6, z + 2.4);                    // sign board
      const pad = this.add(new THREE.CircleGeometry(PAD_R, 20), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 }), x, 0.06, z + 8);
      pad.rotation.x = -Math.PI / 2;
      const ring = this.add(new THREE.RingGeometry(PAD_R - 0.35, PAD_R, 24), new THREE.MeshBasicMaterial({ color: '#f6ead2' }), x, 0.07, z + 8); ring.rotation.x = -Math.PI / 2;
      const count = h('span.park-count');
      const label = h('div.park-label', h('span.park-emoji', game.meta.emoji), h('span.park-name', game.meta.name), count);
      this.labels.append(label);
      this.booths.push({ game, x, z, px: x, pz: z + 8, open: true, label, count, pad, roof, votes: 0 });
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
      const v = new THREE.Vector3(b.x, 10.5, b.z).project(this.cam);
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
      (b.pad.material as THREE.MeshBasicMaterial).opacity = b.open ? 0.45 : 0.1;
      (b.roof.material as THREE.MeshLambertMaterial).color.set(b.open ? ZONE_COLORS[b.game.meta.zone] || '#c9553a' : '#6b6660');
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
          const dx = g.x - b.x, dz = g.z - b.z;
          if (Math.abs(dx) < 4.8 && Math.abs(dz) < 3.2) { if (4.8 - Math.abs(dx) < 3.2 - Math.abs(dz)) g.x = b.x + Math.sign(dx || 1) * 4.8; else g.z = b.z + Math.sign(dz || 1) * 3.2; }
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
