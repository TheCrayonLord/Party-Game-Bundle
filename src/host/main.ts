import qrcode from 'qrcode-generator';
import '../theme.css';
import './host.css';
import { createHost, type HostNet } from '../core/transport';
import { h, ordinal, qs } from '../core/util';
import { Room, MAX_PLAYERS, type Player } from './room';
import { Cancelled, Ctx, type GameDef, type GameResult } from './ctx';
import { GAMES } from '../games';
import { nextMascot, say } from './mascot';
import { Park } from './park';

const app = document.getElementById('app')!;
const TICKETS = [100, 80, 65, 55, 48, 42, 37, 33, 30, 27, 25, 23];

let room: Room;
let ctx: Ctx | null = null;
let mode: 'lobby' | 'game' | 'results' = 'lobby';
let resultsDone: (() => void) | null = null;
type Menu = 'park' | 'list';
let menu: Menu = 'list';          // 'park' = walk-around carnival (regular start), 'list' = plain list (performance start)
let park: Park | null = null;
const explained = new Set<string>();     // games whose how-to-play page has been shown this session
const BOT_LEVELS = ['Easy', 'Normal', 'Hard'] as const;
let botLevel = (Number(qs.get('botlevel') ?? (() => { try { return localStorage.getItem('pgb-botlevel'); } catch { return null; } })() ?? 1) || 0) as 0 | 1 | 2;
if (!(botLevel in BOT_LEVELS)) botLevel = 1;

boot().catch((e) => fatal(String(e?.message || e)));

function fatal(msg: string) {
  app.replaceChildren(h('div.center', h('h1.big', 'The park is closed'), h('p.sub', msg), h('button.btn', { onclick: () => location.reload() }, 'Try again')));
}

/** The first screen: full walk-around park, or the plain list for slower computers. */
function chooseMenu(): Promise<Menu> {
  const forced = qs.get('menu');
  if (forced === 'park' || forced === 'list') return Promise.resolve(forced);
  if (qs.get('game')) return Promise.resolve('list');
  return new Promise((resolve) => {
    const card = (m: Menu, emoji: string, title: string, text: string) => h('button.start-card', { onclick: () => resolve(m), 'data-menu': m }, h('div.start-emoji', emoji), h('div.start-title', title), h('div.start-text', text));
    app.replaceChildren(h('div.center', h('h1.big', 'Party Game Bundle'), h('p.sub', 'How would you like to start?'),
      h('div.row', card('park', '🎡', 'Regular start', 'Walk around the old carnival and pick rides together.'), card('list', '📋', 'Performance start', 'A plain list of games. Best for slower computers.'))));
  });
}

async function boot() {
  menu = await chooseMenu();
  app.replaceChildren(h('div.center', h('h1.big', 'Opening the gates…')));
  const net = await createHost();
  net.onDown = (why) => fatal(why);
  room = new Room(net);
  room.onChange = () => { if (mode === 'lobby') lobby(); };
  room.onInput = (p, d) => {
    if (mode === 'game') ctx?.input(p, d);
    else if (mode === 'lobby' && park) park.input(p, d);
    else if (mode === 'lobby' && p.vip && d?.id === 'pick') start(GAMES.find((g) => g.meta.id === d.v));
    else if (mode === 'results' && p.vip && d?.id === 'back') resultsDone?.();
  };
  for (let i = 0; i < Math.min(MAX_PLAYERS, Number(qs.get('bots')) || 0); i++) room.addBot();
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && mode === 'game') quitGame(); });
  lobby();
  const auto = qs.get('game'); // ?game=id starts straight away; handy for testing with ?bots=
  if (auto) start(GAMES.find((g) => g.meta.id === auto));
}

function joinUrl(net: HostNet) {
  const u = new URL('play.html', location.href);
  u.search = '';
  u.searchParams.set('room', net.code);
  u.searchParams.set('net', net.kind);
  for (const k of ['relay', 'peerhost', 'peerport']) if (qs.get(k)) u.searchParams.set(k, qs.get(k)!);
  return u.href;
}

const fits = (g: GameDef) => room.players.length >= g.meta.min && room.players.length <= g.meta.max;

function lobby() {
  mode = 'lobby';
  const url = joinUrl(room.net);
  const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
  const qrBox = h('div.qr'); qrBox.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const n = room.players.length;

  const booth = h('div.booth', h('div.ticket-paper',
    h('div.marquee', '★ ADMIT ONE ★'),
    h('div.ticket-sub', 'Scan to enter the park'),
    qrBox,
    h('div.ticket-stub', h('div.code-label', 'or go to'),
      h('div.url', url.replace(/^https?:\/\//, '').replace(/\?.*/, '')),
      h('div.code', room.net.code), h('div.ticket-serial', `No. ${String(Math.abs([...room.net.code].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7)) % 1000000).padStart(6, '0')} · GOOD FOR ONE NIGHT`))),
    local ? h('div.warn', 'Phones can’t reach “localhost”. Open this page using this computer’s network address instead.') : null,
  );
  const botRow = h('div.bot-row', h('button.btn.small', { onclick: () => room.addBot(), disabled: n >= MAX_PLAYERS }, '+ Add a bot'),
    h('button.btn.small', { title: 'How good the bots are', onclick: () => { botLevel = ((botLevel + 1) % 3) as 0 | 1 | 2; try { localStorage.setItem('pgb-botlevel', String(botLevel)); } catch { /* storage blocked */ } lobby(); } }, `Bot skill: ${BOT_LEVELS[botLevel]}`),
    h('button.btn.small', { title: 'Switch between the walk-around park and the plain list', onclick: () => { menu = menu === 'park' ? 'list' : 'park'; park?.destroy(); park = null; lobby(); } }, menu === 'park' ? '📋 Plain list' : '🎡 Walk the park'));

  if (menu === 'park') {
    // The walk-around carnival. It is built once and then kept in step with the guest list.
    park ??= new Park(app, room, GAMES, fits, (g) => start(g));
    park.sync({ ticket: booth, mascot: say('lobby', () => { nextMascot(); lobby(); }), controls: botRow });
    return;
  }

  const guests = h('div.guests',
    h('h2', n ? `Guests in the park (${n}/${MAX_PLAYERS})` : 'Scan to get your ticket'),
    h('div.guest-grid', ...room.players.map((p) => h('div.guest' + (p.connected ? '' : '.away'), { title: 'Click to remove', onclick: () => room.remove(p), style: { background: p.color } },
      h('div.guest-av', p.avatar), h('div.guest-name', p.name), h('div.guest-meta', `${p.shape} ${p.tickets} 🎟️${p.vip ? ' · host' : ''}${p.bot ? ' · bot' : ''}`)))),
    botRow,
  );

  const zones = [...new Set(GAMES.map((g) => g.meta.zone))];
  const rides = h('div.rides', ...zones.map((z) => h('div.zone', h('h3', z),
    h('div.zone-rides', ...GAMES.filter((g) => g.meta.zone === z).map((g) => {
      const ok = fits(g);
      return h('button.ride' + (ok ? '' : '.closed'), { disabled: !ok, onclick: () => start(g), 'data-game': g.meta.id },
        h('span.ride-emoji', g.meta.emoji), h('span.ride-name', g.meta.name),
        h('span.ride-blurb', g.meta.blurb), h('span.ride-count', ok ? `${g.meta.min}–${g.meta.max} players` : `CLOSED · needs ${g.meta.min}–${g.meta.max}`));
    })))));

  app.replaceChildren(h('div.lobby', h('header.banner', h('h1', 'Party Game Bundle'), h('p', 'A night at the fair')), say('lobby', () => { nextMascot(); lobby(); }), h('div.lobby-top', booth, h('div.lobby-right', guests, rides))));

  const open = GAMES.filter(fits);
  for (const p of room.players) {
    if (p.vip) room.setView(p, open.length
      ? { type: 'choice', key: 'lobby-vip-' + open.map((g) => g.meta.id).join(), id: 'pick', prompt: 'Pick an attraction', sub: 'You’re the host: everyone follows you.', options: open.map((g) => ({ id: g.meta.id, label: `${g.meta.emoji} ${g.meta.name}` })) }
      : { type: 'wait', key: 'lobby-vip-none', title: 'You’re the host!', text: 'Waiting for more guests before any ride can open.', emoji: '🎩' });
    else if (p.view.key !== 'lobby') room.setView(p, { type: 'wait', key: 'lobby', title: 'You’re in!', text: 'Watch the big screen. The host picks the ride.', emoji: '🎟️' });
  }
}

async function start(game: GameDef | undefined) {
  if (!game || mode !== 'lobby' || !fits(game)) return;
  mode = 'game';
  park?.destroy(); park = null;       // only one 3D scene is ever alive
  const players = [...room.players];
  const c = (ctx = new Ctx(room, app, players, game.meta));
  c.botLevel = botLevel;
  let result: GameResult | null = null;
  try {
    c.wait(players, game.meta.name, game.meta.blurb, game.meta.emoji);
    c.show(h('div.center.intro', h('div.intro-emoji', game.meta.emoji), h('h1.big', game.meta.name), h('p.sub', game.meta.blurb), say('intro')));
    await c.sleep(3.5);
    if (!explained.has(game.meta.id) && !qs.get('game')) {      // first time this session: explain the rules
      explained.add(game.meta.id);
      c.show(h('div.col.pad.howto', h('h1.big', `${game.meta.emoji} How to play ${game.meta.name}`), h('div.howto-list', ...game.meta.howTo.map((l) => h('div.howto-line', l)))));
      const key = c.key('howto');
      c.all({ type: 'info', key, id: 'none', title: `How to play ${game.meta.name}`, lines: game.meta.howTo });
      await c.next('Got it, let’s play!', 45);
    }
    result = await game.run(c);
  } catch (e) {
    if (!(e instanceof Cancelled)) { console.error(e); result = null; }
  }
  c.destroy();
  if (ctx !== c) return;
  ctx = null;
  if (result) await results(game, result, players);
  lobby();
}

function quitGame() { ctx?.destroy(); ctx = null; lobby(); }

function results(game: GameDef, r: GameResult, players: Player[]): Promise<void> {
  mode = 'results';
  const rows = players.map((p) => ({ p, s: r.scores.find((x) => x.id === p.id) })).sort((a, b) => (b.s?.score ?? -1e9) - (a.s?.score ?? -1e9));
  let rank = 0;
  const list = rows.map((row, i) => {
    if (i === 0 || (row.s?.score ?? -1e9) !== (rows[i - 1].s?.score ?? -1e9)) rank = i;
    const won = row.s?.tickets ?? TICKETS[Math.min(rank, TICKETS.length - 1)];
    row.p.tickets += won;
    room.welcome(row.p);
    return h('div.result-row', { style: { animationDelay: `${i * 0.12}s` } },
      h('span.result-rank', r.coop ? '' : ordinal(rank + 1)),
      h('span.badge', { style: { background: row.p.color } }, `${row.p.avatar} ${row.p.name}`),
      h('span.result-label', row.s?.label ?? (row.s ? String(row.s.score) : '—')),
      h('span.result-tix', `+${won} 🎟️`), h('span.result-total', `${row.p.tickets} total`));
  });
  app.replaceChildren(h('div.results', h('h1.big', r.headline || `${game.meta.emoji} ${game.meta.name}: results`), h('div.result-list', ...list), say('results'),
    h('button.btn', { onclick: () => resultsDone?.() }, 'Back to the park')));
  for (const p of players) room.setView(p, p.vip
    ? { type: 'choice', key: 'results-vip', id: 'back', prompt: `You have ${p.tickets} prize tickets`, options: [{ id: 'go', label: 'Back to the park' }] }
    : { type: 'wait', key: 'results', title: `${p.tickets} prize tickets`, text: 'Waiting for the host…', emoji: '🎟️' });
  return new Promise((resolve) => {
    const t = setTimeout(() => resultsDone?.(), room.vip ? 60000 : 6000);
    resultsDone = () => { clearTimeout(t); resultsDone = null; resolve(); };
  });
}
