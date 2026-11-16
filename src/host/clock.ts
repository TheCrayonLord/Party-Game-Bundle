// The host's clock. Pausing freezes `performance.now()` and every timer made with `later()`,
// so games, countdowns and animations driven by either simply stop and carry on afterwards.
const real = performance.now.bind(performance);
let frozenAt: number | null = null;     // real time at which the pause began
let lost = 0;                           // total real time spent paused

performance.now = () => (frozenAt ?? real()) - lost;

interface Timer { due: number; fn: () => void; handle: number }
const timers = new Set<Timer>();
const arm = (t: Timer) => { t.handle = window.setTimeout(() => { timers.delete(t); t.fn(); }, Math.max(0, t.due - performance.now())); };

/** Like setTimeout, but the wait does not run down while the game is paused. Returns a cancel function. */
export function later(ms: number, fn: () => void): () => void {
  const t: Timer = { due: performance.now() + ms, fn, handle: 0 };
  timers.add(t);
  if (frozenAt == null) arm(t);
  return () => { clearTimeout(t.handle); timers.delete(t); };
}

export const isPaused = () => frozenAt != null;

export function setPaused(on: boolean) {
  if (on === isPaused()) return;
  if (on) { frozenAt = real(); for (const t of timers) clearTimeout(t.handle); }
  else { lost += real() - frozenAt!; frozenAt = null; for (const t of timers) arm(t); }
}
