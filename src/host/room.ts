import { COLORS, SHAPES, AVATARS, type ToHost, type ToPhone, type View } from '../core/types';
import type { HostNet } from '../core/transport';

export interface Player {
  id: string; token: string; name: string; avatar: string; color: string; shape: string;
  tickets: number; connected: boolean; bot: boolean; vip: boolean; cid?: string; view: View;
  /** How well this player plays when the computer is driving: 0 easy, 1 normal, 2 hard. Each bot has its own. */
  level: 0 | 1 | 2;
  /** In the audience: the park was full when they arrived. They can vote and cheer but don't play. */
  spectator?: boolean;
}

export const MAX_PLAYERS = 12;
const BOT_NAMES = ['Biscuit', 'Wobbles', 'Pickle', 'Noodle', 'Gizmo', 'Sprout', 'Bongo', 'Waffles', 'Pepper', 'Dizzy', 'Mopsy', 'Tater'];

/** The people in the park: who is connected, what each phone shows, who is in charge. */
export class Room {
  players: Player[] = [];
  audience: Player[] = [];
  onChange: () => void = () => {};
  onInput: (p: Player, d: any) => void = () => {};
  private byConn = new Map<string, Player>();
  private seq = 0;
  private paused = false;

  constructor(public net: HostNet) {
    net.onJoin = () => {};
    net.onLeave = (cid) => {
      const p = this.byConn.get(cid);
      this.byConn.delete(cid);
      if (!p || p.cid !== cid) return;
      p.connected = false; p.cid = undefined;
      this.fixVip(); this.onChange();
    };
    net.onMsg = (cid, m: ToHost) => {
      if (m?.t === 'hello') this.hello(cid, m);
      else if (m?.t === 'in') { const p = this.byConn.get(cid); if (p) this.onInput(p, m.d ?? {}); }
    };
  }

  private hello(cid: string, m: Extract<ToHost, { t: 'hello' }>) {
    let p = this.players.find((x) => !x.bot && x.token === m.token) ?? this.audience.find((x) => x.token === m.token);
    if (!p) {
      const name = String(m.name || 'Guest').trim().slice(0, 12) || 'Guest';
      if (this.players.length >= MAX_PLAYERS) {      // no seats left: they join the audience
        p = { id: 'a' + ++this.seq, token: '', name, avatar: AVATARS[this.seq % AVATARS.length], color: '#8d8478', shape: '👀',
          tickets: 0, connected: false, bot: false, vip: false, level: 1, spectator: true, view: { type: 'wait', key: 'audience', title: 'You’re in the audience', text: 'The park is full, but you can vote and cheer.', emoji: '👀' } };
        this.audience.push(p);
      } else p = this.make(name, false, m.color);
      p.token = m.token;
    } else if (p.cid && p.cid !== cid) this.byConn.delete(p.cid);
    p.cid = cid; p.connected = true;
    this.byConn.set(cid, p);
    this.fixVip();
    this.welcome(p);
    this.net.send(cid, { t: 'view', v: p.view } satisfies ToPhone);
    if (this.paused) this.net.send(cid, { t: 'pause', on: true } satisfies ToPhone);
    this.onChange();
  }

  private make(name: string, bot: boolean, wanted?: string): Player {
    const used = new Set(this.players.map((x) => x.color));
    let ci = Math.max(0, COLORS.findIndex((c) => !used.has(c)));
    const wi = COLORS.indexOf(wanted ?? '');
    if (wi >= 0 && wi !== ci) {
      const holder = this.players.find((x) => x.color === wanted);
      if (!holder) ci = wi;
      else if (holder.bot) { holder.color = COLORS[ci]; holder.shape = SHAPES[ci]; ci = wi; }      // a bot gives up its colour to a person who asks for it
    }
    const icons = new Set(this.players.map((x) => x.avatar));
    const avatar = AVATARS.find((a) => !icons.has(a)) ?? AVATARS[this.seq % AVATARS.length];      // everyone gets their own little icon
    const p: Player = {
      id: 'p' + ++this.seq, token: '', name, avatar, color: COLORS[ci], shape: SHAPES[ci],
      tickets: 0, connected: bot, bot, vip: false, level: 1, view: { type: 'wait', key: 'new', title: 'Welcome!' },
    };
    this.players.push(p);
    return p;
  }

  addBot(level: 0 | 1 | 2 = 1) {
    if (this.players.length >= MAX_PLAYERS) return;
    const name = BOT_NAMES.find((n) => !this.players.some((p) => p.name === n)) || 'Bot';
    this.make(name, true).level = level;
    this.onChange();
  }

  remove(p: Player) {
    if (p.cid) { this.net.send(p.cid, { t: 'kicked' } satisfies ToPhone); this.byConn.delete(p.cid); }
    this.players = this.players.filter((x) => x !== p);
    this.audience = this.audience.filter((x) => x !== p);
    this.fixVip(); this.onChange();
  }

  /** Gives free seats to people waiting in the audience. Returns true if anyone moved. */
  promote(): boolean {
    let moved = false;
    while (this.players.length < MAX_PLAYERS) {
      const p = this.audience.find((x) => x.connected); if (!p) break;
      this.audience = this.audience.filter((x) => x !== p);
      const used = new Set(this.players.map((x) => x.color)), ci = Math.max(0, COLORS.findIndex((c) => !used.has(c)));
      p.color = COLORS[ci]; p.shape = SHAPES[ci]; p.spectator = false;
      this.players.push(p); this.welcome(p); moved = true;
    }
    if (moved) this.fixVip();
    return moved;
  }

  /** Gives a player another colour, if no other person has it (a bot holding it swaps). Returns true if it changed. */
  recolor(p: Player, wanted: string): boolean {
    const wi = COLORS.indexOf(wanted);
    if (wi < 0 || p.color === wanted || p.spectator) return false;
    const holder = this.players.find((x) => x.color === wanted);
    if (holder && !holder.bot) return false;
    if (holder) { holder.color = p.color; holder.shape = p.shape; }
    p.color = wanted; p.shape = SHAPES[wi];
    this.welcome(p); this.onChange();
    return true;
  }

  buzz(p: Player, kind: 'hit' | 'good' | 'turn') {
    if (p.cid) this.net.send(p.cid, { t: 'buzz', kind } satisfies ToPhone);
  }

  /** The VIP is the first connected human; they drive the menus from their phone. */
  get vip(): Player | undefined { return this.players.find((p) => p.vip); }
  private fixVip() {
    const cur = this.vip;
    if (cur?.connected) return;
    const next = this.players.find((p) => p.connected && !p.bot);
    if (!next) return;
    if (cur) cur.vip = false;
    next.vip = true;
    this.welcome(next);
  }

  welcome(p: Player) {
    if (p.cid) this.net.send(p.cid, { t: 'welcome', id: p.id, name: p.name, avatar: p.avatar, color: p.color, shape: p.shape, vip: p.vip, tickets: p.tickets } satisfies ToPhone);
  }

  /** Tells every phone the game is paused (or running again). */
  setPaused(on: boolean) {
    this.paused = on;
    for (const p of [...this.players, ...this.audience]) if (p.cid) this.net.send(p.cid, { t: 'pause', on } satisfies ToPhone);
  }

  setView(p: Player, v: View) {
    p.view = v;
    if (p.cid) this.net.send(p.cid, { t: 'view', v } satisfies ToPhone);
  }

  live(p: Player, l: Record<string, string>) {
    p.view = { ...p.view, live: { ...p.view.live, ...l } };
    if (p.cid) this.net.send(p.cid, { t: 'live', l } satisfies ToPhone);
  }
}
