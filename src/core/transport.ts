// Two ways for phones to reach the host, behind one interface:
//  - 'r' relay: WebSocket through the small Node relay (dev server, or server/relay.mjs)
//  - 'p' peer:  WebRTC data channels via PeerJS (works from static hosting, no server of ours)
import { qs } from './util';

export type NetKind = 'r' | 'p';

export interface HostNet {
  kind: NetKind;
  code: string;
  send(cid: string, msg: unknown): void;
  onJoin: (cid: string) => void;
  onLeave: (cid: string) => void;
  onMsg: (cid: string, msg: any) => void;
  /** Called if the host itself loses its connection to the relay or signalling service. */
  onDown: (why: string) => void;
}

export interface ClientNet {
  send(msg: unknown): void;
  onMsg: (msg: any) => void;
  onClose: (why: string) => void;
  close(): void;
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const newCode = () => Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join('');
const PEER_PREFIX = 'party-game-bundle-';

function relayBase(): string {
  const custom = qs.get('relay') || (import.meta.env.VITE_RELAY_URL as string | undefined);
  if (custom) return custom.replace(/\/$/, '');
  return new URL('.', location.href).href.replace(/^http/, 'ws').replace(/\/$/, '');
}

async function hasRelay(): Promise<boolean> {
  if (qs.get('net') === 'p') return false;
  if (qs.get('relay') || import.meta.env.VITE_RELAY_URL || qs.get('net') === 'r') return true;
  try {
    const r = await fetch(new URL('relay-info', location.href));
    return r.ok && (await r.json()).relay === true;
  } catch { return false; }
}

function peerOptions() {
  // ?peerhost=&peerport= point at a self-hosted PeerServer (used in tests)
  const host = qs.get('peerhost');
  return host ? { host, port: Number(qs.get('peerport') || 9000), path: '/', secure: false } : {};
}

export async function createHost(): Promise<HostNet> {
  return (await hasRelay()) ? relayHost() : peerHost();
}

function relayHost(attempt = 0): Promise<HostNet> {
  return new Promise((resolve, reject) => {
    const code = newCode();
    const ws = new WebSocket(`${relayBase()}/relay?role=host&room=${code}`);
    const net: HostNet = {
      kind: 'r', code,
      send: (cid, msg) => ws.readyState === 1 && ws.send(JSON.stringify({ to: cid, d: msg })),
      onJoin() {}, onLeave() {}, onMsg() {}, onDown() {},
    };
    let open = false;
    ws.onopen = () => { open = true; resolve(net); };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.ev === 'join') net.onJoin(m.id);
      else if (m.ev === 'leave') net.onLeave(m.id);
      else if (m.ev === 'msg') net.onMsg(m.id, m.d);
    };
    ws.onclose = (e) => {
      if (open) net.onDown('Lost connection to the relay');
      else if (e.code === 4409 && attempt < 5) relayHost(attempt + 1).then(resolve, reject);
      else reject(new Error('Could not reach the relay'));
    };
  });
}

async function peerHost(attempt = 0): Promise<HostNet> {
  const { Peer } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const code = newCode();
    const peer = new Peer(PEER_PREFIX + code, peerOptions());
    const conns = new Map<string, any>();
    const net: HostNet = {
      kind: 'p', code,
      send: (cid, msg) => { const c = conns.get(cid); if (c?.open) c.send(msg); },
      onJoin() {}, onLeave() {}, onMsg() {}, onDown() {},
    };
    let open = false;
    peer.on('open', () => { open = true; resolve(net); });
    peer.on('connection', (conn) => {
      const cid = conn.peer;
      conn.on('open', () => { conns.set(cid, conn); net.onJoin(cid); });
      conn.on('data', (d) => net.onMsg(cid, d));
      conn.on('close', () => { if (conns.get(cid) === conn) { conns.delete(cid); net.onLeave(cid); } });
    });
    peer.on('disconnected', () => { if (open) peer.reconnect(); });
    peer.on('error', (err: any) => {
      if (open) { if (err.type === 'network' || err.type === 'server-error') net.onDown('Lost connection to the matchmaking service'); return; }
      if (err.type === 'unavailable-id' && attempt < 5) peerHost(attempt + 1).then(resolve, reject);
      else reject(new Error('Could not reach the matchmaking service'));
    });
  });
}

export function connectClient(code: string, kind: NetKind): Promise<ClientNet> {
  return kind === 'r' ? relayClient(code) : peerClient(code);
}

function relayClient(code: string): Promise<ClientNet> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${relayBase()}/relay?role=client&room=${code}`);
    const net: ClientNet = {
      send: (m) => ws.readyState === 1 && ws.send(JSON.stringify(m)),
      onMsg() {}, onClose() {}, close: () => ws.close(),
    };
    let open = false;
    ws.onopen = () => { open = true; resolve(net); };
    ws.onmessage = (e) => net.onMsg(JSON.parse(e.data));
    ws.onclose = (e) => {
      const why = e.code === 4404 ? 'No park with that code' : e.code === 4410 ? 'The host closed the park' : 'Connection lost';
      if (open) net.onClose(why); else reject(new Error(why));
    };
  });
}

async function peerClient(code: string): Promise<ClientNet> {
  const { Peer } = await import('peerjs');
  return new Promise((resolve, reject) => {
    const peer = new Peer(peerOptions());
    let open = false;
    const fail = (why: string) => { if (!open) { peer.destroy(); reject(new Error(why)); } };
    const timer = setTimeout(() => fail('Could not connect to the host'), 12000);
    peer.on('error', (err: any) => fail(err.type === 'peer-unavailable' ? 'No park with that code' : 'Could not connect'));
    peer.on('open', () => {
      const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
      const net: ClientNet = {
        send: (m) => { if (conn.open) conn.send(m); },
        onMsg() {}, onClose() {}, close: () => peer.destroy(),
      };
      conn.on('open', () => { open = true; clearTimeout(timer); resolve(net); });
      conn.on('data', (d) => net.onMsg(d));
      conn.on('close', () => { if (open) { net.onClose('Connection lost'); peer.destroy(); } });
    });
  });
}
