// The controller kit: every kind of phone screen the games can ask for.
import type { Stroke, View } from '../core/types';
import { clamp, drawStrokes, h, strokeCanvas } from '../core/util';

type Send = (d: any) => void;
let cleanup: (() => void)[] = [];
const on = <K extends keyof WindowEventMap>(ev: K, fn: (e: WindowEventMap[K]) => void) => { addEventListener(ev, fn); cleanup.push(() => removeEventListener(ev, fn)); };
const every = (ms: number, fn: () => void) => { const i = setInterval(fn, ms); cleanup.push(() => clearInterval(i)); };

/** iOS needs a tap before it will share motion data. Safe to call anywhere; resolves false if refused. */
export async function requestMotion(): Promise<boolean> {
  try {
    for (const E of [(window as any).DeviceOrientationEvent, (window as any).DeviceMotionEvent])
      if (E && typeof E.requestPermission === 'function' && (await E.requestPermission()) !== 'granted') return false;
    return true;
  } catch { return false; }
}

/** Builds the screen for a view. Returns a function that updates its live text fields. */
export function renderView(root: HTMLElement, v: View, send: Send, color: string): (l: Record<string, string>) => void {
  cleanup.forEach((c) => c()); cleanup = [];
  const status = h('div.status', { 'data-live': 'status' });
  root.className = 'screen';
  const kids = build(v, send, color, root);
  root.replaceChildren(...kids, status);
  return (l) => {
    for (const [k, val] of Object.entries(l))
      root.querySelectorAll<HTMLElement>(`[data-live="${k}"]`).forEach((el) => (el.textContent = val));
  };
}

function build(v: View, send: Send, color: string, root: HTMLElement): HTMLElement[] {
  switch (v.type) {
    case 'wait':
      root.classList.add('centered');
      return [h('div.emoji', v.emoji || '🎪'), h('h2', v.title), h('p.sub', v.text || '')];

    case 'text': {
      const max = v.maxLen || 60;
      const input = h<'textarea'>('textarea', { maxLength: max, placeholder: v.placeholder || 'Type here…' });
      const count = h('div.count', `0/${max}`);
      const btn = h<'button'>('button.btn', { disabled: true, onclick: () => { const t = input.value.trim(); if (t) { btn.disabled = true; send({ id: v.id, v: t }); } } }, v.button || 'Send');
      input.oninput = () => { count.textContent = `${input.value.length}/${max}`; btn.disabled = !input.value.trim(); };
      return [h('h2', v.prompt), h('p.sub', v.sub || ''), ...(v.image ? [h('div.drawwrap', strokeCanvas(v.image, 600))] : []), input, count, btn];
    }

    case 'choice': {
      const opts = h('div.opts', ...v.options.map((o) => h('button.opt', {
        onclick: () => { opts.querySelectorAll('button').forEach((b) => ((b as HTMLButtonElement).disabled = true)); send({ id: v.id, v: o.id }); },
      }, o.label)));
      return [h('h2', v.prompt), h('p.sub', v.sub || ''), opts];
    }

    case 'draw': return drawPad(v, send, color);

    case 'info': {
      const card = h('div.card', ...v.lines.map((l) => h('p', l)));
      const out = [h('h2', v.title), card];
      if (v.input) {
        const input = h<'input'>('input', { type: 'text', maxLength: v.input.maxLen, placeholder: v.input.placeholder, inputMode: 'numeric', autocomplete: 'off' });
        out.push(h('div.inline', input, h('button.btn', { onclick: () => { if (input.value.trim()) { send({ id: v.id, v: input.value.trim() }); input.value = ''; } } }, 'Enter')));
      }
      if (v.buttons) out.push(h('div.opts', ...v.buttons.map((b) => h('button.opt', { onclick: () => send({ id: v.id, v: b.id }) }, b.label))));
      return out;
    }

    case 'tilt': return tiltPad(v, send);
    case 'rub': return rubPad(send);
  }
}

const PALETTE = ['#2b1d2e', '#d9482b', '#e8b23a', '#3fa34d', '#4361ee', '#f15bb5', '#b08968', '#fbf5e6'];

function drawPad(v: Extract<View, { type: 'draw' }>, send: Send, own: string): HTMLElement[] {
  const size = 600;
  const canvas = h<'canvas'>('canvas.paper', { width: size, height: size });
  const g = canvas.getContext('2d')!;
  const strokes: Stroke[] = [];
  let color = v.color || PALETTE[0], width = 14, cur: Stroke | null = null, sent = false;
  const redraw = () => {
    g.fillStyle = '#fbf5e6'; g.fillRect(0, 0, size, size);
    drawStrokes(g, [...(v.base || []), ...strokes, ...(cur ? [cur] : [])], size);
  };
  const pos = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return [Math.round(clamp(((e.clientX - r.left) / r.width) * 1000, 0, 1000)), Math.round(clamp(((e.clientY - r.top) / r.height) * 1000, 0, 1000))];
  };
  const submit = () => { if (sent) return; sent = true; done.disabled = true; send({ id: v.id, v: strokes }); };
  canvas.onpointerdown = (e) => {
    if (sent || strokes.length >= 80) return;
    canvas.setPointerCapture(e.pointerId);
    cur = { c: color, w: width, p: pos(e) }; redraw();
  };
  canvas.onpointermove = (e) => {
    if (!cur || cur.p.length > 700) return;
    const [x, y] = pos(e), n = cur.p.length;
    if (Math.hypot(x - cur.p[n - 2], y - cur.p[n - 1]) < 7) return;
    cur.p.push(x, y); redraw();
  };
  canvas.onpointerup = canvas.onpointercancel = () => {
    if (!cur) return;
    strokes.push(cur); cur = null; redraw();
    if (v.oneStroke) submit();
  };
  redraw();
  const done = h<'button'>('button.btn', { onclick: submit }, 'Done');
  const tools = v.oneStroke ? h('p.sub', 'One line only. Lift your finger and it’s sent.') : h('div.tools',
    ...(v.color ? [] : PALETTE.map((c) => {
      const b = h<'button'>('button.swatch' + (c === color ? '.on' : ''), { style: { background: c }, onclick: () => { color = c; tools.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('on', x === b)); } });
      return b;
    })),
    h('button.tool', { onclick: (e: Event) => { width = width === 14 ? 34 : width === 34 ? 6 : 14; (e.target as HTMLElement).textContent = width === 14 ? '✏️ Medium' : width === 34 ? '🖌️ Thick' : '🖊️ Thin'; } }, '✏️ Medium'),
    h('button.tool', { onclick: () => { strokes.pop(); redraw(); } }, '↩ Undo'),
    h('button.tool', { onclick: () => { strokes.length = 0; redraw(); } }, '🗑 Clear'),
  );
  return [h('h2', v.prompt), h('p.sub', v.sub || ''), h('div.drawwrap', canvas, tools), ...(v.oneStroke ? [] : [done])];
}

/** How far "downhill" the screen leans to the right, -1..1, whichever way the phone is held. */
function leanFromOrientation(e: DeviceOrientationEvent): number | null {
  if (e.beta == null || e.gamma == null) return null;
  const b = (e.beta * Math.PI) / 180, g = (e.gamma * Math.PI) / 180;
  const gx = Math.sin(g) * Math.cos(b), gy = -Math.sin(b); // gravity along the phone's own x and y edges
  const angle = (screen.orientation?.angle ?? (window as any).orientation ?? 0) as number;
  const sx = angle === 90 ? -gy : angle === 270 || angle === -90 ? gy : angle === 180 ? -gx : gx;
  return clamp(sx * 2.2, -1, 1); // full lock at roughly 27 degrees
}

function tiltPad(v: Extract<View, { type: 'tilt' }>, send: Send): HTMLElement[] {
  const dot = h('div.steerdot');
  const hint = h('p', 'Tilt your phone to steer');
  const pad = h('div.tiltpad', h('div.livebig', { 'data-live': 'big' }), h('div.steerbar', dot), hint, h('p.sub', { 'data-live': 'info' }));
  let tilt = 0, touch: number | null = null, sentVal = 99, gotMotion = false;
  on('deviceorientation', (e) => { const l = leanFromOrientation(e); if (l != null) { gotMotion = true; tilt = l; } });
  const fromTouch = (e: PointerEvent) => { const r = pad.getBoundingClientRect(); touch = clamp(((e.clientX - r.left) / r.width - 0.5) * 2.4, -1, 1); };
  pad.onpointerdown = (e) => { pad.setPointerCapture(e.pointerId); fromTouch(e); };
  pad.onpointermove = (e) => { if (touch != null) fromTouch(e); };
  pad.onpointerup = pad.onpointercancel = () => { touch = null; };
  setTimeout(() => { if (!gotMotion) hint.textContent = 'Drag left and right here to steer'; }, 1500);
  every(50, () => {
    const val = Math.round((touch ?? tilt) * 100) / 100;
    dot.style.left = `${50 + val * 50}%`;
    if (Math.abs(val - sentVal) >= 0.02) { sentVal = val; send({ tilt: val }); }
  });
  const btns = (v.buttons || []).map((b) => h('button.btn.bigbtn', { 'data-live': 'btn-' + b.id, onpointerdown: (e: Event) => { e.preventDefault(); send({ btn: b.id }); } }, b.label));
  return [pad, ...btns];
}

function rubPad(send: Send): HTMLElement[] {
  const pad = h('div.rubpad', h('div.emoji', { 'data-live': 'big' }, '🐌'), h('div', { 'data-live': 'info' }, 'Rub here to crawl'));
  let dist = 0, shake = 0, last: [number, number] | null = null;
  pad.onpointerdown = (e) => { pad.setPointerCapture(e.pointerId); last = [e.clientX, e.clientY]; };
  pad.onpointermove = (e) => { if (!last) return; dist += Math.hypot(e.clientX - last[0], e.clientY - last[1]); last = [e.clientX, e.clientY]; };
  pad.onpointerup = pad.onpointercancel = () => { last = null; };
  on('devicemotion', (e) => { const a = e.acceleration; if (a && a.x != null) shake = Math.max(shake, Math.hypot(a.x, a.y || 0, a.z || 0)); });
  every(100, () => {
    if (dist > 0 || shake > 8) send({ rub: Math.round(dist), shake: Math.round(shake) });
    dist = 0; shake = 0;
  });
  return [pad];
}
