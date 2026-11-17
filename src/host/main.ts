import qrcode from 'qrcode-generator';
import '../theme.css';
import './host.css';
import { createHost, type HostNet } from '../core/transport';
import { SPEED, h, ordinal, qs } from '../core/util';
import { Room, MAX_PLAYERS, type Player } from './room';
import { Cancelled, Ctx, type GameDef, type GameResult } from './ctx';
import { GAMES } from '../games';
import { bubble, line, mascot, nextMascot, say } from './mascot';
import { Park } from './park';
import { quality } from '../core/models';
import { later } from './clock';
import { BOT_LEVELS, initPause } from './pause';
import { finale, newNight } from './finale';
import { setFullscreen } from './settings';
import { babble, duck, music, preload, sfx, sting, unlockSound, type Track } from './sound';

const app = document.getElementById('app')!;
const TICKETS = [100, 80, 65, 55, 48, 42, 37, 33, 30, 27, 25, 23];

let room: Room;
let ctx: Ctx | null = null;
let mode: 'boot' | 'lobby' | 'game' | 'results' | 'ending' | 'closed' = 'boot';
let night = newNight();                  // what happened tonight, for the closing credits
let closing: ReturnType<typeof finale> | null = null;
let resultsDone: ((next?: 'again' | 'park') => void) | null = null;
/** Which tune plays under each part of the park. */
const ZONE_MUSIC: Record<string, Track> = { Speedway: 'march', Lagoon: 'march', Midway: 'march', 'Art Alley': 'waltz', 'Fortune Tent': 'dusk', 'Haunted Manor': 'dusk' };
type Menu = 'park' | 'list';
let menu: Menu = 'list';          // 'park' = walk-around carnival (regular start), 'list' = plain list (performance start)
let park: Park | null = null;
const explained = new Set<string>();     // games whose how-to-play page has been shown this session
let botLevel = (Number(qs.get('botlevel') ?? (() => { try { return localStorage.getItem('pgb-botlevel'); } catch { return null; } })() ?? 1) || 0) as 0 | 1 | 2;
if (!(botLevel in BOT_LEVELS)) botLevel = 1;

unlockSound();
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
  quality.detailed = menu === 'park';
  app.replaceChildren(h('div.center', h('h1.big', 'Opening the gates…')));
  const net = await createHost();
  net.onDown = (why) => fatal(why);
  room = new Room(net);
  room.onChange = () => { if (mode === 'lobby') lobby(); else if (mode === 'game') ctx?.crowdSync(); };
  room.onInput = (p, d) => {
    if (mode === 'game') ctx?.input(p, d);
    else if (mode === 'lobby' && park) park.input(p, d);
    else if (mode === 'lobby' && p.vip && d?.id === 'pick') start(GAMES.find((g) => g.meta.id === d.v));
    else if (mode === 'results' && p.vip && d?.id === 'back') resultsDone?.(d.v === 'again' ? 'again' : 'park');
    else if (mode === 'ending') closing?.input(p, d);
  };
  for (let i = 0; i < Math.min(MAX_PLAYERS, Number(qs.get('bots')) || 0); i++) room.addBot(botLevel);
  initPause(room, {
    available: () => mode === 'lobby' || mode === 'game' || mode === 'results',
    onRide: () => mode === 'game' || mode === 'results',
    leaveRide,
    endGame,
    desktop,
    menu: () => menu,
    setMenu: (m) => { if (m === menu) return; menu = m; if (mode === 'lobby') { park?.destroy(); park = null; lobby(); } },
    canEditGuests: () => mode === 'lobby',
    botsChanged: () => { if (mode === 'lobby') lobby(); },
  });
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
  quality.detailed = menu === 'park';       // Regular start gets the detailed models; Performance start keeps the simple ones
  music('waltz');
  room.promote();       // a free seat goes to whoever has waited longest in the audience
  for (const s of room.audience) if (s.view.key !== 'audience') room.setView(s, { type: 'wait', key: 'audience', title: 'You’re in the audience', text: 'The park is full, but you can vote and cheer once a ride starts.', emoji: '👀' });
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
  const bots = room.players.filter((p) => p.bot), mixed = bots.some((p) => p.level !== bots[0].level);
  const botRow = h('div.bot-row', h('button.btn.small', { onclick: () => room.addBot(botLevel), disabled: n >= MAX_PLAYERS }, '+ Add a bot'),
    h('button.btn.small', { title: 'Sets every bot to the same skill. Each bot can be set on its own in Settings (Esc)' + (menu === 'list' ? ', or by clicking the skill on its card.' : '.'),
      onclick: () => { botLevel = ((botLevel + 1) % 3) as 0 | 1 | 2; try { localStorage.setItem('pgb-botlevel', String(botLevel)); } catch { /* storage blocked */ } for (const p of bots) p.level = botLevel; lobby(); } }, `All bots: ${mixed ? 'Mixed' : BOT_LEVELS[bots[0]?.level ?? botLevel]}`),
    h('button.btn.small', { title: 'Switch between the walk-around park and the plain list', onclick: () => { menu = menu === 'park' ? 'list' : 'park'; park?.destroy(); park = null; lobby(); } }, menu === 'park' ? '📋 Plain list' : '🎡 Walk the park'));

  if (menu === 'park') {
    // The walk-around carnival. It is built once and then kept in step with the guest list.
    park ??= new Park(app, room, GAMES, fits, (g) => start(g));
    park.sync({ ticket: booth, mascot: say('lobby', () => { nextMascot(); lobby(); }), controls: botRow });
    return;
  }

  const guests = h('div.guests',
    h('h2', n ? `Guests in the park (${n}/${MAX_PLAYERS})` : 'Scan to get your ticket'),
    room.audience.length ? h('div.audience-note', `👀 Audience (${room.audience.length}): ${room.audience.map((a) => a.name).join(', ')}`) : null,
    h('div.guest-grid', ...room.players.map((p) => h('div.guest' + (p.connected ? '' : '.away'), { title: 'Click to remove', onclick: () => room.remove(p), style: { background: p.color } },
      h('div.guest-av', p.avatar), h('div.guest-name', p.name), h('div.guest-meta', `${p.shape} ${p.tickets} 🎟️${p.vip ? ' · host' : ''}${p.bot ? ' · bot' : ''}`),
      p.bot ? h('button.guest-skill', { title: 'Click to change this bot’s skill', 'data-level': String(p.level), onclick: (e: Event) => { e.stopPropagation(); p.level = ((p.level + 1) % 3) as 0 | 1 | 2; lobby(); } }, BOT_LEVELS[p.level]) : null))),
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
  park?.destroy(); park = null;       // only one 3D scene is ever alive
  // "Play again" on the results screen comes back round this loop; any other choice of game means a walk through the park.
  let replay = false;
  while ((await play(game, replay)) === 'again' && fits(game)) replay = true;      // same ride again, straight in
  if (['game', 'results'].includes(mode as string)) lobby();
}

/** Runs one round of a game and its results screen. Resolves with what the players want next. */
async function play(game: GameDef, replay = false): Promise<'again' | 'park' | 'gone'> {
  mode = 'game';
  music(ZONE_MUSIC[game.meta.zone] ?? 'march');
  preload('drumroll', 'fanfare', 'applause', 'aww', 'ding');
  const players = [...room.players];
  const c = (ctx = new Ctx(room, app, players, game.meta));
  let result: GameResult | null = null;
  try {
    c.wait(players, game.meta.name, game.meta.blurb, game.meta.emoji);
    if (!replay) {        // "Play again" skips the title card
      const hello = say('intro');
      c.show(h('div.center.intro', h('div.intro-emoji', game.meta.emoji), h('h1.big', game.meta.name), h('p.sub', game.meta.blurb), hello));
      babble(hello.textContent || '');
      await c.sleep(3.5);
    }
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
  for (const [id, k] of c.moments.crash) night.crashes.set(id, (night.crashes.get(id) || 0) + k);
  for (const [id, k] of c.moments.out) night.outs.set(id, (night.outs.get(id) || 0) + k);
  if (ctx !== c) return 'gone';
  ctx = null;
  if (!result) return 'park';
  const next = await results(game, result, players);
  return (mode as string) === 'results' ? next : 'gone';
}

/** Abandons the ride in progress (or its results screen) and goes back to the park. */
function leaveRide() {
  if (mode === 'results') return resultsDone?.('park');
  if (mode !== 'game') return;
  ctx?.destroy(); ctx = null; lobby();
}

/** Closes the park for the night: curtains, the overall podium, the grand prize and the credits. */
async function endGame() {
  if (mode !== 'lobby' && mode !== 'game' && mode !== 'results') return;
  const was = mode;
  mode = 'ending';
  ctx?.destroy(); ctx = null;
  if (was === 'results') resultsDone?.('park');
  park?.destroy(); park = null;
  music(null);
  closing = finale(app, room, night);
  const next = await closing.done;
  closing = null;
  if (next === 'desktop') return desktop();
  if (next === 'fresh') { for (const p of room.players) { p.tickets = 0; room.welcome(p); } night = newNight(); streaks.clear(); nextMascot(); }
  mode = 'lobby';
  lobby();
}

/** Leaves the game altogether. A browser tab can only close itself if a script opened it, so there is a fallback screen. */
function desktop() {
  mode = 'closed';
  ctx?.destroy(); ctx = null;
  park?.destroy(); park = null;
  for (const p of room.players) room.setView(p, { type: 'wait', key: 'closed', title: 'The park is closed', text: 'Thanks for coming!', emoji: '🌙' });
  setFullscreen(false);
  setTimeout(() => {
    window.close();
    app.replaceChildren(h('div.center', h('h1.big', 'The park is closed'), h('p.sub', 'You can close this tab now.'), h('button.btn', { onclick: () => location.reload() }, 'Open the park again')));
  }, 300);
}

const streaks = new Map<string, number>();     // wins in a row, per player, for the mascot to gloat about

/** The placements screen: a podium revealed third to first, then the full table with prize tickets. */
function results(game: GameDef, r: GameResult, players: Player[]): Promise<'again' | 'park'> {
  mode = 'results';
  const overall = () => new Map([...room.players].sort((a, b) => b.tickets - a.tickets).map((p, i) => [p.id, i]));
  const before = overall();
  const rows = players.map((p) => ({ p, s: r.scores.find((x) => x.id === p.id), rank: 0, won: 0 })).sort((a, b) => (b.s?.score ?? -1e9) - (a.s?.score ?? -1e9));
  rows.forEach((row, i) => {
    row.rank = i > 0 && (row.s?.score ?? -1e9) === (rows[i - 1].s?.score ?? -1e9) ? rows[i - 1].rank : i;
    row.won = row.s?.tickets ?? TICKETS[Math.min(row.rank, TICKETS.length - 1)];
    row.p.tickets += row.won;
    room.welcome(row.p);
  });
  const after = overall();
  // Team games and hidden-role games set their own ticket amounts; they get a banner instead of a podium.
  const team = !!r.coop || rows.every((row) => row.s?.tickets != null);
  for (const row of rows) {
    const run = !team && row.rank === 0 ? (streaks.get(row.p.id) || 0) + 1 : 0;
    streaks.set(row.p.id, run);
    night.bestStreak.set(row.p.id, Math.max(night.bestStreak.get(row.p.id) || 0, run));
  }
  night.played.push({ game: game.meta, team, headline: r.headline, rows: rows.map((row) => ({ id: row.p.id, name: row.p.name, rank: row.rank, won: row.won })) });

  // What the mascot has to say about it.
  const champ = rows[0].p, loser = rows[rows.length - 1].p, standing = [...room.players].sort((a, b) => b.tickets - a.tickets);
  let remark: string;
  if (r.coop) remark = line(mascot.after[(rows[0].s?.score ?? 0) > 0 ? 'teamWin' : 'teamLose']);
  else if (team) remark = line(mascot.results);
  else if ((streaks.get(champ.id) || 0) >= 2) remark = line(mascot.after.streak, { name: champ.name, n: streaks.get(champ.id)! });
  else if (standing.length > 1 && standing[0].tickets - standing[1].tickets <= 30 && Math.random() < 0.4) remark = line(mascot.after.rivalry, { name: standing[0].name, other: standing[1].name });
  else if (rows.length > 2 && loser !== champ && Math.random() < 0.3) remark = line(mascot.after.loser, { name: loser.name });
  else remark = line(mascot.after.win, { name: champ.name });

  const figure = (p: Player) => h('div.pod-fig', h('div.pod-av', { style: { background: p.color } }, p.avatar), h('div.pod-name', p.name));
  const step = (rank: number) => h(`div.pod-step.r${rank + 1}`, h('div.pod-figs', ...rows.filter((x) => x.rank === rank).map((x) => figure(x.p))), h('div.pod-block', ordinal(rank + 1)));
  const podium = team ? null : h('div.podium', step(1), step(0), step(2));
  const table = h('div.result-list' + (rows.length > 8 ? '.many' : ''), ...rows.map((row, i) => {
    const move = (before.get(row.p.id) ?? 0) - (after.get(row.p.id) ?? 0);
    return h('div.result-row', { style: { animationDelay: `${i * 0.1}s` } },
      h('span.result-rank', team ? '' : ordinal(row.rank + 1)),
      h('span.badge', { style: { background: row.p.color } }, `${row.p.avatar} ${row.p.name}`),
      h('span.result-label', row.s?.label ?? (row.s ? String(row.s.score) : '—')),
      h('span.result-tix', `+${row.won} 🎟️`), h('span.result-total', `${row.p.tickets} total`),
      h('span.result-move' + (move > 0 ? '.up' : move < 0 ? '.down' : ''), move > 0 ? `▲${move}` : move < 0 ? `▼${-move}` : '–'));
  }));
  const says = bubble(remark);
  const screen = h('div.results' + (team ? '.team' : ''), h('h1.big', r.headline || `${game.meta.emoji} ${game.meta.name}`), podium, table, says,
    h('div.row.result-next', h('button.btn', { onclick: () => resultsDone?.('again'), 'data-next': 'again' }, '🔁 Play again'), h('button.btn', { onclick: () => resultsDone?.('park'), 'data-next': 'park' }, 'Back to the park')));
  app.replaceChildren(screen);
  // Reveal: third, second, a pause, then first; after that the table and the mascot.
  const timers: (() => void)[] = [];      // made with later(), so the pause menu freezes the reveal too
  const at = (sec: number, fn: () => void) => timers.push(later((sec * 1000) / SPEED, fn));
  if (podium) {
    at(0.6, () => { podium.querySelector('.r3')?.classList.add('show'); sfx('pop'); });
    at(1.6, () => { podium.querySelector('.r2')?.classList.add('show'); sfx('pop'); });
    at(2.2, () => { duck(true); sting('drumroll'); });                 // two seconds of roll, then the hit lands with first place
    at(4.2, () => { podium.querySelector('.r1')?.classList.add('show'); sting('fanfare', 0.9); sting('applause', 0.8); });
  } else at(0.3, () => { if (r.coop && !((rows[0].s?.score ?? 0) > 0)) sting('aww'); else { sting('fanfare', 0.9); sting('applause', 0.7); } });
  at(podium ? 6.2 : 0.3, () => { screen.classList.add('reveal'); sting('ding', 0.7); babble(remark); duck(false); done(); });
  // A click on the screen, or Space / Enter, jumps straight to the finished podium and table.
  const hint = h('div.result-skip', 'Click or press Space to skip');
  if (podium) screen.append(hint);
  const reveals = timers.splice(0);
  const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); skip(); } };
  const done = () => { hint.remove(); removeEventListener('keydown', onKey); screen.onclick = null; };
  const skip = () => {
    if (screen.classList.contains('reveal')) return;
    reveals.forEach((cancel) => cancel());
    podium?.querySelectorAll('.pod-step').forEach((el) => el.classList.add('show'));
    screen.classList.add('reveal');
    sting('fanfare', 0.9); duck(false); done();
  };
  if (podium) { addEventListener('keydown', onKey); screen.onclick = (e) => { if (!(e.target as HTMLElement).closest('button')) skip(); }; }
  timers.push(...reveals, done);

  for (const row of rows) {
    const title = team ? (row.s?.label ?? game.meta.name) : `You came ${ordinal(row.rank + 1)}`, text = `+${row.won} 🎟️ · ${row.p.tickets} total`;
    room.setView(row.p, row.p.vip
      ? { type: 'choice', key: 'results-vip', id: 'back', prompt: title, sub: text, options: [{ id: 'again', label: '🔁 Play again' }, { id: 'go', label: 'Back to the park' }] }
      : { type: 'wait', key: 'results', title, text, emoji: !team && row.rank === 0 ? '🏆' : '🎟️' });
  }
  return new Promise((resolve) => {
    for (const s of room.audience) room.setView(s, { type: 'wait', key: 'results-audience', title: game.meta.name, text: 'Watch the big screen for the results.', emoji: '👀' });
    timers.push(later(room.vip ? 75000 : 16000 / SPEED, () => resultsDone?.('park')));
    resultsDone = (next = 'park') => { timers.forEach((cancel) => cancel()); duck(false); resultsDone = null; resolve(next); };
  });
}
