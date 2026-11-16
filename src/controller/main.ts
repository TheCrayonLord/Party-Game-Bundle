import '../theme.css';
import './phone.css';
import { connectClient, type ClientNet, type NetKind } from '../core/transport';
import { AVATARS, type ToPhone, type View } from '../core/types';
import { h, pick, qs } from '../core/util';
import { renderView, requestMotion, watchRotation } from './kit';

const app = document.getElementById('app')!;
const store = {
  get: (k: string) => { try { return localStorage.getItem('pgb-' + k) || ''; } catch { return ''; } },
  set: (k: string, v: string) => { try { localStorage.setItem('pgb-' + k, v); } catch { /* private mode */ } },
};
let token = store.get('token');
if (!token) { token = Math.random().toString(36).slice(2) + Date.now().toString(36); store.set('token', token); }

let net: ClientNet | null = null;
let me: Extract<ToPhone, { t: 'welcome' }> | null = null;
let code = (qs.get('room') || '').toUpperCase();
let kind = (qs.get('net') as NetKind) || 'p';
let name = store.get('name');
let avatar = store.get('avatar') || pick(AVATARS);
let curKey = '';
let liveEls: (l: Record<string, string>) => void = () => {};
const ticket = h('div.ticket');
const screen = h('div.screen');

watchRotation();
joinForm();

function joinForm(error = '') {
  const nameIn = h<'input'>('input', { type: 'text', maxLength: 12, placeholder: 'Your name', value: name, autocomplete: 'off' });
  const codeIn = h<'input'>('input', { type: 'text', maxLength: 4, placeholder: 'Park code (4 letters)', value: code, autocapitalize: 'characters', autocomplete: 'off' });
  const err = h('div.err', error);
  const grid = h('div.avatars', ...AVATARS.map((a) => {
    const b = h<'button'>('button' + (a === avatar ? '.on' : ''), { onclick: () => { avatar = a; grid.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); } }, a);
    return b;
  }));
  const go = h<'button'>('button.btn', {
    onclick: async () => {
      name = nameIn.value.trim(); code = codeIn.value.trim().toUpperCase();
      if (!name) return (err.textContent = 'Type a name first');
      if (code.length !== 4) return (err.textContent = 'Enter the 4-letter park code');
      store.set('name', name); store.set('avatar', avatar);
      // Must happen inside this tap: iOS only allows the motion prompt from a user gesture.
      await requestMotion();
      keepAwake();
      (window.screen.orientation as any)?.lock?.('portrait')?.catch?.(() => {});      // works on some phones; the rest get the counter-rotated layout
      go.disabled = true; err.textContent = '';
      if (!qs.get('net')) kind = await fetch(new URL('relay-info', location.href)).then((r) => (r.ok ? 'r' : 'p'), () => 'p') as NetKind;
      connect(true);
    },
  }, 'Get my ticket 🎟️');
  app.replaceChildren(h('div.screen', h('h2', '🎪 Welcome to the fair'), qs.get('room') ? null : codeIn, nameIn, h('p.sub', 'Pick your look'), grid, err, go));
}

async function connect(first: boolean) {
  try {
    net = await connectClient(code, kind);
  } catch (e: any) {
    if (first || /No park/.test(e.message)) return joinForm(e.message || 'Could not connect');
    return setTimeout(() => connect(false), 1500);
  }
  hideOverlay();
  net.onMsg = onMsg;
  net.onClose = (why) => {
    net = null;
    if (/closed the park/.test(why)) return joinForm(why);
    showOverlay('Reconnecting…');
    setTimeout(() => connect(false), 800);
  };
  net.send({ t: 'hello', token, name, avatar });
}

function onMsg(m: ToPhone) {
  if (m.t === 'welcome') {
    me = m;
    ticket.style.borderLeft = `14px solid ${m.color}`;
    ticket.replaceChildren(h('div.ticket-av', { style: { background: m.color } }, m.avatar), h('div.ticket-name', `${m.shape} ${m.name}${m.vip ? ' 🎩' : ''}`), h('div.ticket-tix', `${m.tickets} 🎟️`));
    if (!ticket.isConnected) app.replaceChildren(ticket, screen);
  } else if (m.t === 'view') show(m.v);
  else if (m.t === 'live') liveEls(m.l);
  else if (m.t === 'buzz') buzz(m.kind);
  else if (m.t === 'pause') { if (m.on) showOverlay('⏸ Paused'); else hideOverlay(); }
  else if (m.t === 'kicked') { net?.close(); net = null; joinForm('You were removed from the park'); }
}

/** Vibrates where the phone allows it (iPhones don't) and flashes the screen edge for everyone. */
function buzz(kind: 'hit' | 'good' | 'turn') {
  try { navigator.vibrate?.(kind === 'hit' ? [140] : kind === 'good' ? [40] : [70, 60, 70]); } catch { /* not allowed */ }
  const f = h('div.flash.' + kind);
  document.body.append(f);
  setTimeout(() => f.remove(), 500);
}

function show(v: View) {
  document.body.classList.toggle('keep-portrait', v.type === 'tilt');      // tilting must not flip the layout
  if (v.key !== curKey) {
    curKey = v.key;
    liveEls = renderView(screen, v, (d) => net?.send({ t: 'in', d }), me?.color || '#e8b23a');
  }
  if (v.live) liveEls(v.live);
}

let overlay: HTMLElement | null = null;
function showOverlay(text: string) { hideOverlay(); overlay = h('div.overlay', text); document.body.append(overlay); }
function hideOverlay() { overlay?.remove(); overlay = null; }

function keepAwake() {
  const lock = () => (navigator as any).wakeLock?.request('screen').catch(() => {});
  lock();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lock(); });
}
