// Closing time: the curtains draw, the overall podium is revealed, the winner gets the giant teddy bear,
// and the credits roll with the night's highlights.
import { SPEED, h, ordinal } from '../core/util';
import type { GameMeta } from './ctx';
import { MASCOTS, mascot } from './mascot';
import type { Player, Room } from './room';
import { music, preload, sfx, sting } from './sound';

export interface Played { game: GameMeta; team: boolean; headline?: string; rows: { id: string; name: string; rank: number; won: number }[] }
/** Everything remembered about the night, for the credits. */
export interface Night { played: Played[]; crashes: Map<string, number>; outs: Map<string, number>; bestStreak: Map<string, number> }
export const newNight = (): Night => ({ played: [], crashes: new Map(), outs: new Map(), bestStreak: new Map() });

export type AfterFinale = 'again' | 'fresh' | 'desktop';

const wait = (sec: number) => new Promise<void>((r) => setTimeout(r, (sec * 1000) / SPEED));

/** The night's highlights, as credit sections. */
function credits(room: Room, night: Night, standing: Player[]): { title: string; lines: string[] }[] {
  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? night.played.flatMap((g) => g.rows).find((r) => r.id === id)?.name ?? 'Somebody';
  const top = (m: Map<string, number>, min = 1) => { const best = [...m].sort((a, b) => b[1] - a[1])[0]; return best && best[1] >= min ? best : null; };
  const count = (pick: (g: Played) => string[]) => { const m = new Map<string, number>(); for (const g of night.played) for (const id of pick(g)) m.set(id, (m.get(id) || 0) + 1); return m; };
  const contests = night.played.filter((g) => !g.team);

  const rides = night.played.map((g) => {
    const winners = g.rows.filter((r) => r.rank === 0).map((r) => r.name);
    return `${g.game.emoji} ${g.game.name} · ${g.team ? (g.headline || 'a team effort') : `won by ${winners.join(' & ')}`}`;
  });

  const honours: string[] = [];
  if (standing.length) honours.push(`🧸 Grand prize: ${standing[0].name} with ${standing[0].tickets} tickets`);
  const wins = top(count((g) => (g.team ? [] : g.rows.filter((r) => r.rank === 0).map((r) => r.id))));
  if (wins) honours.push(`🏆 Most wins: ${name(wins[0])} (${wins[1]})`);
  const streak = top(night.bestStreak, 2);
  if (streak) honours.push(`🔥 Longest winning streak: ${name(streak[0])}, ${streak[1]} in a row`);
  let haul: { name: string; won: number; game: string } | null = null;
  for (const g of night.played) for (const r of g.rows) if (!haul || r.won > haul.won) haul = { name: r.name, won: r.won, game: g.game.name };
  if (haul) honours.push(`🎟️ Biggest single haul: ${haul.name}, ${haul.won} tickets from ${haul.game}`);
  if (standing.length > 1 && standing[0].tickets - standing[1].tickets <= 30 && night.played.length)
    honours.push(`📸 Photo finish: ${standing[0].name} beat ${standing[1].name} by ${standing[0].tickets - standing[1].tickets} tickets`);
  const crash = top(night.crashes);
  if (crash) honours.push(`💥 Crash test dummy: ${name(crash[0])}, ${crash[1]} wipeout${crash[1] > 1 ? 's' : ''}`);
  const out = top(night.outs);
  if (out) honours.push(`🚪 First to the exit: ${name(out[0])}, knocked out ${out[1]} time${out[1] > 1 ? 's' : ''}`);
  const spoon = top(count((g) => { if (g.team || g.rows.length < 3) return []; const worst = Math.max(...g.rows.map((r) => r.rank)); return g.rows.filter((r) => r.rank === worst).map((r) => r.id); }));
  if (spoon && contests.length > 1) honours.push(`🥄 Wooden spoon: ${name(spoon[0])}, last place ${spoon[1]} time${spoon[1] > 1 ? 's' : ''}`);
  const fav = top(count((g) => [g.game.id]), 2);
  if (fav) { const g = night.played.find((x) => x.game.id === fav[0])!.game; honours.push(`🎠 Favourite ride: ${g.name}, ridden ${fav[1]} times`); }

  return [
    { title: 'A Night at the Fair', lines: ['starring', ...standing.map((p) => `${p.avatar} ${p.name}`)] },
    { title: `Tonight’s rides (${night.played.length})`, lines: rides.length ? rides : ['Nobody rode anything. The fair was lovely anyway.'] },
    { title: 'Honours', lines: honours },
    { title: 'Your hosts', lines: MASCOTS.map((m) => `${m.emoji} ${m.name}${m === mascot ? ' · on duty tonight' : ''}`) },
    { title: 'Thanks for coming', lines: ['The park is now closed.', 'Mind the gap on your way out.'] },
  ].filter((s) => s.lines.length);
}

export function finale(app: HTMLElement, room: Room, night: Night): { done: Promise<AfterFinale>; input(p: Player, d: any): void } {
  let choose!: (c: AfterFinale) => void;
  const done = new Promise<AfterFinale>((r) => (choose = r));
  const curtain = h('div.curtain', h('div.curtain-l'), h('div.curtain-r'), h('div.curtain-top'), h('div.curtain-sign', '🎪 Grand Prize Ceremony'));
  const finish = (c: AfterFinale) => { curtain.remove(); choose(c); };

  const standing = [...room.players].sort((a, b) => b.tickets - a.tickets);
  const ranks = standing.map((p) => standing.findIndex((q) => q.tickets === p.tickets));     // ties share a place
  const winners = standing.filter((_, i) => ranks[i] === 0);
  const winnerNames = winners.map((p) => p.name).join(' & ');

  (async () => {
    for (const p of room.players) room.setView(p, { type: 'wait', key: 'finale', title: 'The park is closing', text: 'Eyes on the big screen for the grand prize.', emoji: '🎪' });
    document.body.append(curtain);
    preload('drumroll', 'fanfare', 'applause');
    void curtain.offsetWidth;
    curtain.classList.add('closed');
    await wait(1.7);

    // Behind the curtain: set the stage.
    const figure = (p: Player) => h('div.pod-fig', h('div.pod-av', { style: { background: p.color } }, p.avatar), h('div.pod-name', p.name), h('div.pod-tix', `${p.tickets} 🎟️`));
    const bear = h('div.bear', '🧸');
    const step = (rank: number) => h(`div.pod-step.r${rank + 1}`, h('div.pod-figs', ...standing.filter((_, i) => ranks[i] === rank).map(figure), rank === 0 ? bear : null), h('div.pod-block', ordinal(rank + 1)));
    const podium = h('div.podium', step(1), step(0), step(2));
    const banner = h('div.finale-banner');
    const rest = standing.filter((_, i) => ranks[i] > 2);
    const others = h('div.finale-rest', ...rest.map((p) => h('span.badge', { style: { background: p.color } }, `${ordinal(ranks[standing.indexOf(p)] + 1)} ${p.avatar} ${p.name} · ${p.tickets}`)));
    const confetti = h('div.confetti');
    const screen = h('div.finale', h('h1.big', 'Tonight’s Grand Prize'), standing.length ? podium : h('p.sub', 'Nobody came to the fair tonight.'), banner, others, confetti);
    app.replaceChildren(screen);
    await wait(1.6);
    curtain.classList.remove('closed');
    curtain.classList.add('open');
    await wait(1.8);

    if (standing.length) {
      podium.querySelector('.r3')?.classList.add('show'); sfx('pop'); await wait(1.3);
      podium.querySelector('.r2')?.classList.add('show'); sfx('pop'); await wait(0.8);
      sting('drumroll'); await wait(2);
      podium.querySelector('.r1')?.classList.add('show'); sting('fanfare'); await wait(1.4);
      bear.classList.add('drop');
      await wait(0.75); sfx('thud'); sting('applause'); await wait(0.35);
      banner.textContent = `🧸 ${winnerNames} win${winners.length > 1 ? '' : 's'} the giant teddy bear!`;
      banner.classList.add('show'); others.classList.add('show');
      const colours = ['#d9482b', '#e8b23a', '#f6ead2', '#2ab7a9', '#f15bb5'];
      confetti.replaceChildren(...Array.from({ length: 60 }, (_, i) => h('i', { style: { left: `${Math.random() * 100}%`, background: colours[i % colours.length], animationDelay: `${Math.random() * 2.5}s`, animationDuration: `${2.5 + Math.random() * 2.5}s` } })));
      standing.forEach((p, i) => room.setView(p, { type: 'wait', key: 'finale-place', title: ranks[i] === 0 ? 'You won the giant teddy bear!' : `You finished ${ordinal(ranks[i] + 1)}`, text: `${p.tickets} 🎟️ tonight`, emoji: ranks[i] === 0 ? '🧸' : '🎟️' }));
      await wait(6);
    }

    music('dusk');
    // Credits: the night's highlights scroll up over the dimmed stage. Click, Space or Esc skips them.
    const sections = credits(room, night, standing);
    const lines = sections.reduce((n, s) => n + s.lines.length + 3, 0);
    const roll = h('div.credits-roll', { style: { animationDuration: `${Math.max(12, lines * 0.9) / SPEED}s` } },
      ...sections.map((s) => h('div.credits-section', h('h2', s.title), ...s.lines.map((l) => h('p', l)))));
    const layer = h('div.credits', roll);
    screen.append(layer);
    await new Promise<void>((resolve) => {
      const skip = (e: KeyboardEvent) => { if (['Space', 'Escape', 'Enter'].includes(e.code)) end(); };
      const end = () => { removeEventListener('keydown', skip); resolve(); };
      roll.addEventListener('animationend', end);
      layer.onclick = end;
      addEventListener('keydown', skip);
    });

    // The last card.
    layer.onclick = null;
    layer.replaceChildren(h('div.credits-end',
      h('h1.big', 'Thanks for coming!'),
      standing.length ? h('p.sub', `${winners.map((p) => p.avatar).join(' ')} ${winnerNames} took home the bear.`) : null,
      h('div.row',
        h('button.btn', { onclick: () => finish('again'), 'data-finale': 'again' }, 'Keep playing'),
        h('button.btn', { onclick: () => finish('fresh'), 'data-finale': 'fresh' }, 'New night (reset tickets)'),
        h('button.btn', { onclick: () => finish('desktop'), 'data-finale': 'desktop' }, 'Return to desktop'))));
    const vip = room.vip;
    if (vip) room.setView(vip, { type: 'choice', key: 'finale-vip', id: 'finale', prompt: 'What next?', options: [{ id: 'again', label: 'Keep playing' }, { id: 'fresh', label: 'New night (reset tickets)' }] });
  })();

  return { done, input: (p, d) => { if (p.vip && d?.id === 'finale' && (d.v === 'again' || d.v === 'fresh')) finish(d.v); } };
}
