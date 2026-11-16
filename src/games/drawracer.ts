import type { Stroke } from '../core/types';
import { h, strokeCanvas } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import { runRace } from './racing';

export const drawracer: GameDef = {
  meta: { id: 'drawracer', name: 'Draw Your Racer', emoji: '🖍️', zone: 'Art Alley', blurb: 'Draw your own vehicle, then race it.', min: 2, max: 12 },
  async run(ctx: Ctx) {
    const P = ctx.players;
    // The host player chooses land or water.
    ctx.show(h('div.col.pad', h('h1.big', 'Kart or boat?'), h('p.sub', ctx.vip && P.includes(ctx.vip) ? `${ctx.vip.name} is choosing…` : '')));
    const ckey = ctx.key('kind');
    const chooser = ctx.vip && P.includes(ctx.vip) ? ctx.vip : P[0];
    ctx.wait(P.filter((p) => p !== chooser));
    const kind = (await ctx.collect([chooser], () => ({ type: 'choice', key: ckey, id: ckey, prompt: 'What are we racing?', options: [{ id: 'kart', label: '🏎️ Karts (Tilt Kart)' }, { id: 'boat', label: '⛵ Boats (Riptide Regatta)' }] }), 20)).get(chooser.id) === 'boat' ? 'boat' : 'kart';

    ctx.show(h('div.col.pad', h('h1.big', `Draw your ${kind}`), h('p.sub', 'Seen from above, with the FRONT pointing to the TOP of your screen.'), h('div.racer-guide', '⬆ front')));
    const dkey = ctx.key('ride');
    const art = await ctx.collect(P, (p) => ({ type: 'draw', key: dkey, id: dkey, prompt: `Draw your ${kind}`, sub: 'From above. Front at the TOP ⬆' }), 70);
    const skins = new Map<string, Stroke[]>();
    for (const p of P) { const s = art.get(p.id); if (Array.isArray(s) && s.length) skins.set(p.id, s); }

    // Parade, then a vote for best ride.
    const cards = P.map((p) => h('div.sketch-link', strokeCanvas(skins.get(p.id) || [], 260), badge(p)));
    ctx.show(h('div.col.pad', h('h1.big', 'The starting grid'), h('div.row', ...cards), h('p.sub', 'Vote for the best ride.')));
    const vkey = ctx.key('best');
    const votes = tally(await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Best ride?', options: P.filter((q) => q !== p).map((q) => ({ id: q.id, label: `${q.avatar} ${q.name}` })) }), 20));
    const top = [...votes.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    const bestRide = top ? ctx.by(top[0]) : null;
    if (bestRide) { cards[P.indexOf(bestRide)].append(h('div.pts', '🏆 Best ride!')); await ctx.sleep(3); }

    const scores = await runRace(ctx, { kind, skins });
    // The crowd favourite gets bumped up one place.
    if (bestRide) { const s = scores.find((x) => x.id === bestRide.id)!; s.score += 1.5; s.label += ' · 🏆 best ride'; }
    return { scores };
  },
};
