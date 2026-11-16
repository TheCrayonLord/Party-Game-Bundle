import { COLORS, SHAPES, AVATARS, type ToHost, type ToPhone, type View } from '../core/types';
import type { HostNet } from '../core/transport';

export interface Player {
  id: string; token: string; name: string; avatar: string; color: string; shape: string;
  tickets: number; connected: boolean; bot: boolean; vip: boolean; cid?: string; view: View;
}

export const MAX_PLAYERS = 12;
const BOT_NAMES = ['Biscuit', 'Wobbles', 'Pickle', 'Noodle', 'Gizmo', 'Sprout', 'Bongo', 'Waffles', 'Pepper', 'Dizzy', 'Mopsy', 'Tater'];

/** The people in the park: who is connected, what each phone shows, who is in charge. */
export class Room {
  players: Player[] = [];
  onChange: () => void = () => {};
  onInput: (p: Player, d: any) => void = () => {};
  private byConn = new Map<string, Player>();
  private seq = 0;

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
    let p = this.players.find((x) => !x.bot && x.token === m.token);
    if (!p) {
      if (this.players.length >= MAX_PLAYERS) {
        this.net.send(cid, { t: 'view', v: { type: 'wait', key: 'full', title: 'The park is full', text: 'Twelve guests is the limit. Sorry!', emoji: '🚧' } } satisfies ToPhone);
        return;
      }
      p = this.make(String(m.name || 'Guest').trim().slice(0, 12) || 'Guest', m.avatar, false);
      p.token = m.token;
    } else if (p.cid && p.cid !== cid) this.byConn.delete(p.cid);
    p.cid = cid; p.connected = true;
    this.byConn.set(cid, p);
    this.fixVip();
    this.welcome(p);
    this.net.send(cid, { t: 'view', v: p.view } satisfies ToPhone);
    this.onChange();
  }

  private make(name: string, avatar: string, bot: boolean): Player {
    const used = new Set(this.players.map((x) => x.color));
    const ci = Math.max(0, COLORS.findIndex((c) => !used.has(c)));
    const p: Player = {
      id: 'p' + ++this.seq, token: '', name, avatar: AVATARS.includes(avatar) ? avatar : AVATARS[ci], color: COLORS[ci], shape: SHAPES[ci],
      tickets: 0, connected: bot, bot, vip: false, view: { type: 'wait', key: 'new', title: 'Welcome!' },
    };
    this.players.push(p);
    return p;
  }

  addBot() {
    if (this.players.length >= MAX_PLAYERS) return;
    const name = BOT_NAMES.find((n) => !this.players.some((p) => p.name === n)) || 'Bot';
    this.make(name, AVATARS[(this.seq * 5) % AVATARS.length], true);
    this.onChange();
  }

  remove(p: Player) {
    if (p.cid) { this.net.send(p.cid, { t: 'kicked' } satisfies ToPhone); this.byConn.delete(p.cid); }
    this.players = this.players.filter((x) => x !== p);
    this.fixVip(); this.onChange();
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

  setView(p: Player, v: View) {
    p.view = v;
    if (p.cid) this.net.send(p.cid, { t: 'view', v } satisfies ToPhone);
  }

  live(p: Player, l: Record<string, string>) {
    p.view = { ...p.view, live: { ...p.view.live, ...l } };
    if (p.cid) this.net.send(p.cid, { t: 'live', l } satisfies ToPhone);
  }
}
