export const qs = new URLSearchParams(location.search);
/** Speeds up every timer; used by automated tests (?speed=10). */
export const SPEED = Math.max(1, Number(qs.get('speed')) || 1);

export const rand = (n: number) => Math.floor(Math.random() * n);
export const pick = <T>(a: readonly T[]): T => a[rand(a.length)];
export function shuffle<T>(a: readonly T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = rand(i + 1); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}
export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export function ordinal(n: number) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }

type Child = Node | string | null | undefined | false;
/** Tiny DOM builder: h('div.card.big', {onclick}, 'text', child) */
export function h<K extends keyof HTMLElementTagNameMap = 'div'>(sel: string, props?: Record<string, any> | Child, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const [tag, ...cls] = sel.split('.');
  const el = document.createElement(tag || 'div');
  if (cls.length) el.className = cls.join(' ');
  if (props && typeof props === 'object' && !(props instanceof Node)) {
    for (const [k, v] of Object.entries(props)) {
      if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k in el) (el as any)[k] = v;
      else el.setAttribute(k, v);
    }
  } else kids.unshift(props as Child);
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el as any;
}

export function drawStrokes(ctx: CanvasRenderingContext2D, strokes: { c: string; w: number; p: number[] }[], size: number) {
  const s = size / 1000;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const st of strokes) {
    ctx.strokeStyle = st.c; ctx.fillStyle = st.c; ctx.lineWidth = st.w * s;
    ctx.beginPath();
    if (st.p.length <= 2) { ctx.arc(st.p[0] * s, st.p[1] * s, st.w * s / 2, 0, 7); ctx.fill(); continue; }
    ctx.moveTo(st.p[0] * s, st.p[1] * s);
    for (let i = 2; i < st.p.length; i += 2) ctx.lineTo(st.p[i] * s, st.p[i + 1] * s);
    ctx.stroke();
  }
}

export function strokeCanvas(strokes: { c: string; w: number; p: number[] }[], size = 500): HTMLCanvasElement {
  const c = h<'canvas'>('canvas.paper', { width: size, height: size });
  const g = c.getContext('2d')!;
  g.fillStyle = '#fbf5e6'; g.fillRect(0, 0, size, size);
  drawStrokes(g, strokes, size);
  return c;
}
