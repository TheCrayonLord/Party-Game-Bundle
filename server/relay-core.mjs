// Tiny room relay: one host and many phones per room code. Used by the Vite dev
// server and by server/relay.mjs. It only forwards messages; no game logic lives here.
import { WebSocketServer } from 'ws';

export function attachRelay(httpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const rooms = new Map(); // code -> { host, clients: Map<id, ws> }
  let nextId = 1;

  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://x');
    if (!url.pathname.endsWith('/relay')) return; // leave other upgrades (Vite HMR) alone
    wss.handleUpgrade(req, socket, head, (ws) => connect(ws, url.searchParams));
  });

  function connect(ws, q) {
    const code = (q.get('room') || '').toUpperCase();
    if (q.get('role') === 'host') {
      if (!code || rooms.has(code)) return ws.close(4409, 'room taken');
      const room = { host: ws, clients: new Map() };
      rooms.set(code, room);
      ws.on('message', (raw) => {
        let m; try { m = JSON.parse(raw); } catch { return; }
        const c = room.clients.get(m.to);
        if (c && c.readyState === 1) c.send(JSON.stringify(m.d));
      });
      ws.on('close', () => {
        rooms.delete(code);
        for (const c of room.clients.values()) c.close(4410, 'host left');
      });
      return;
    }
    const room = rooms.get(code);
    if (!room) return ws.close(4404, 'no such room');
    const id = 'c' + nextId++;
    room.clients.set(id, ws);
    const toHost = (m) => room.host.readyState === 1 && room.host.send(JSON.stringify(m));
    toHost({ ev: 'join', id });
    ws.on('message', (raw) => {
      let d; try { d = JSON.parse(raw); } catch { return; }
      toHost({ ev: 'msg', id, d });
    });
    ws.on('close', () => { room.clients.delete(id); toHost({ ev: 'leave', id }); });
  }
  return wss;
}
