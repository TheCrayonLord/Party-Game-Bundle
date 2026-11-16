import type { Stroke, View } from '../core/types';
import { SPEED, h, pick, rand } from '../core/util';
import type { Player, Room } from './room';

export interface GameMeta {
  id: string; name: string; emoji: string; zone: string; blurb: string; min: number; max: number;
  /** Players beyond `max` can't play; games with fewer than `min` are closed. */
}
export interface Score { id: string; score: number; label?: string }
export interface GameResult { scores: Score[]; headline?: string; coop?: boolean }
export interface GameDef { meta: GameMeta; run(ctx: Ctx): Promise<GameResult> }

export class Cancelled extends Error {}

const BOT_TEXTS = ['a suspicious sandwich', 'my uncle Gary', 'forty angry geese', 'soup, but louder', 'the moon (allegedly)', 'haunted trousers', 'a very long nap', 'cheese diplomacy', 'tiny cowboy', 'regret', 'banana for scale', 'the wrong kind of jazz'];

function scribble(color = '#2b1d2e'): Stroke[] {
  return Array.from({ length: 2 + rand(3) }, () => {
    let x = 200 + rand(600), y = 200 + rand(600);
    const p = [x, y];
    for (let i = 0; i < 12; i++) { x = Math.max(40, Math.min(960, x + rand(300) - 150)); y = Math.max(40, Math.min(960, y + rand(300) - 150)); p.push(x, y); }
    return { c: color, w: 14, p };
  });
}

export function botAnswer(v: View): any {
  if (v.type === 'text') return pick(BOT_TEXTS);
  if (v.type === 'choice') return v.options.length ? pick(v.options).id : null;
  if (v.type === 'draw') return v.oneStroke ? scribble(v.color).slice(0, 1) : scribble(v.color);
  return null;
}

/** Everything a running game is allowed to touch. One Ctx per game session. */
export class Ctx {
  alive = true;
  stage: HTMLElement;
  private hudWait: HTMLElement;
  private hudTimer: HTMLElement;
  private inputs = new Set<(p: Player, d: any) => void>();
  private pending = new Set<(e: Error) => void>();
  private cleanups: (() => void)[] = [];
  private timerStop: (() => void) | null = null;
  private keyN = 0;

  constructor(private room: Room, root: HTMLElement, public players: Player[], meta: GameMeta) {
    this.hudWait = h('div.hud-wait');
    this.hudTimer = h('div.hud-timer');
    this.stage = h('div.stage');
    root.replaceChildren(h('div.game', h('div.hud', h('div.hud-title', `${meta.emoji} ${meta.name}`), this.hudWait, this.hudTimer), this.stage));
  }

  get vip() { return this.room.vip; }
  key(prefix = 'k') { return prefix + ++this.keyN; }
  by(id: string) { return this.players.find((p) => p.id === id)!; }

  // ---- phones ----
  view(p: Player, v: View) { this.room.setView(p, v); }
  all(v: View | ((p: Player) => View), players = this.players) { for (const p of players) this.view(p, typeof v === 'function' ? v(p) : v); }
  live(p: Player, l: Record<string, string>) { this.room.live(p, l); }
  wait(players: Player[] = this.players, title = 'Eyes on the big screen', text = '', emoji = '👀') {
    const key = this.key('w');
    this.all({ type: 'wait', key, title, text, emoji }, players);
  }
  onInput(cb: (p: Player, d: any) => void) { this.inputs.add(cb); return () => this.inputs.delete(cb); }
  /** Called by the launcher for every phone message while this game runs. */
  input(p: Player, d: any) { if (this.alive) for (const cb of [...this.inputs]) cb(p, d); }

  // ---- big screen ----
  show(...nodes: (Node | string)[]) { this.stage.replaceChildren(...nodes); }
  title(big: string, small = '') { this.show(h('div.center', h('h1.big', big), small ? h('p.sub', small) : null)); }

  // ---- time ----
  sleep(sec: number): Promise<void> {
    return new Promise((res, rej) => {
      if (!this.alive) return rej(new Cancelled());
      const t = setTimeout(() => { this.pending.delete(rej); res(); }, (sec * 1000) / SPEED);
      this.pending.add(rej);
      this.cleanups.push(() => clearTimeout(t));
    });
  }
  /** Runs `cb` every animation frame until the returned function is called or the game ends. */
  frame(cb: (dt: number, t: number) => void) {
    let id = 0, last = performance.now(), on = true;
    const loop = (now: number) => {
      if (!on || !this.alive) return;
      const dt = Math.min(0.05, (now - last) / 1000) ; last = now;
      cb(dt, now / 1000);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    const stop = () => { on = false; cancelAnimationFrame(id); };
    this.cleanups.push(stop);
    return stop;
  }
  /** Shows a countdown in the corner. Purely visual. */
  timer(sec: number) {
    this.timerStop?.();
    const end = performance.now() + (sec * 1000) / SPEED;
    const tick = () => {
      const left = Math.max(0, Math.ceil(((end - performance.now()) * SPEED) / 1000));
      this.hudTimer.textContent = left > 0 ? String(left) : '';
      this.hudTimer.classList.toggle('low', left <= 5 && left > 0);
    };
    tick();
    const iv = setInterval(tick, 200);
    this.timerStop = () => { clearInterval(iv); this.hudTimer.textContent = ''; this.timerStop = null; };
    this.cleanups.push(() => clearInterval(iv));
  }
  clearTimer() { this.timerStop?.(); }

  private chips(players: Player[], done: Set<string>) {
    this.hudWait.replaceChildren(...players.map((p) => h('span.chip' + (done.has(p.id) ? '.done' : ''), { style: { background: p.color } }, p.avatar)));
  }

  // ---- collecting answers ----
  /** Sends each player a queue of screens and resolves with their answers when all are in or time is up. */
  collectSeq(players: Player[], viewsFor: (p: Player) => View[], seconds: number, opts: { bot?: (p: Player, v: View) => any } = {}): Promise<Map<string, any[]>> {
    const out = new Map<string, any[]>(players.map((p) => [p.id, []]));
    const queues = new Map(players.map((p) => [p.id, viewsFor(p)]));
    const done = new Set<string>();
    this.timer(seconds);
    return new Promise((resolve, reject) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true; off(); this.clearTimer(); this.hudWait.replaceChildren();
        this.wait(players.filter((p) => !done.has(p.id)), "Time's up!", '', '⏰');
        resolve(out);
      };
      const advance = (p: Player) => {
        const q = queues.get(p.id)!, i = out.get(p.id)!.length;
        if (i >= q.length) {
          done.add(p.id);
          this.wait([p], 'Got it!', 'Eyes on the big screen', '✅');
          this.chips(players, done);
          if (done.size === players.length) finish();
          return;
        }
        const v = q[i];
        this.view(p, v);
        if (p.bot) this.sleep(1.2 + Math.random() * 3).then(() => { if (!finished) take(p, { id: (v as any).id, v: opts.bot ? opts.bot(p, v) : botAnswer(v) }); }, () => {});
      };
      const take = (p: Player, d: any) => {
        const q = queues.get(p.id); if (!q) return;
        const cur = q[out.get(p.id)!.length] as any;
        if (!cur || d?.id !== cur.id) return;
        out.get(p.id)!.push(d.v);
        advance(p);
      };
      const off = this.onInput(take);
      this.chips(players, done);
      players.forEach(advance);
      if (!players.length) finish();
      this.sleep(seconds).then(finish, reject);
    });
  }

  /** One screen per player; resolves with playerId -> answer (missing if they ran out of time). */
  async collect(players: Player[], viewFor: (p: Player) => View, seconds: number, opts: { bot?: (p: Player, v: View) => any } = {}): Promise<Map<string, any>> {
    const res = await this.collectSeq(players, (p) => [viewFor(p)], seconds, opts);
    const out = new Map<string, any>();
    for (const [id, a] of res) if (a.length) out.set(id, a[0]);
    return out;
  }

  /** Waits for the VIP to tap a button (or anyone to press space / click the TV), with an automatic fallback. */
  async next(label = 'Continue', auto = 20): Promise<void> {
    const vip = this.vip && this.players.includes(this.vip) && this.vip.connected ? this.vip : null;
    const id = this.key('next');
    if (vip) this.view(vip, { type: 'choice', key: id, id, prompt: 'You hold the lever', options: [{ id: 'go', label }] });
    const hint = h('div.next-hint', vip ? `${vip.avatar} ${vip.name}: tap “${label}”` : label);
    this.stage.append(hint);
    await new Promise<void>((resolve, reject) => {
      const done = () => { off(); removeEventListener('keydown', onKey); hint.remove(); resolve(); };
      const off = this.onInput((p, d) => { if (p === vip && d?.id === id) done(); });
      const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') done(); };
      addEventListener('keydown', onKey);
      hint.onclick = done;
      this.cleanups.push(() => removeEventListener('keydown', onKey));
      this.sleep(vip ? auto : Math.min(auto, 4)).then(done, reject);
    });
    if (vip) this.wait([vip]);
  }

  /** Registers something to tear down when the game ends (renderers, listeners). */
  onEnd(fn: () => void) { this.cleanups.push(fn); }

  destroy() {
    if (!this.alive) return;
    this.alive = false;
    for (const c of this.cleanups) c();
    for (const rej of this.pending) rej(new Cancelled());
    this.pending.clear(); this.inputs.clear();
  }
}

/** Counts votes: returns optionId -> list of voter ids. */
export function tally(votes: Map<string, any>): Map<string, string[]> {
  const t = new Map<string, string[]>();
  for (const [voter, opt] of votes) { if (opt == null) continue; if (!t.has(opt)) t.set(opt, []); t.get(opt)!.push(voter); }
  return t;
}

export function badge(p: Player, extra = ''): HTMLElement {
  return h('span.badge', { style: { background: p.color } }, `${p.avatar} ${p.name}${extra}`);
}
