import type { Stroke, View } from '../core/types';
import { h, pick, shuffle, strokeCanvas } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';
import { SKETCH_SEEDS } from './content/drawing';

type Link = { by: Player; kind: 'text'; text: string } | { by: Player; kind: 'draw'; strokes: Stroke[] };

export const sketch: GameDef = {
  meta: { id: 'sketch', name: 'Sketch & Switch', emoji: '✏️', zone: 'Art Alley', blurb: 'Write it, draw it, guess it, pass it on.', min: 3, max: 12 },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players), n = P.length;
    const steps = Math.min(n, 6);                         // chains never run longer than six links
    const chains: Link[][] = P.map(() => []);
    const score = new Map(P.map((p) => [p.id, 0]));
    const chainFor = (i: number, s: number) => (i - s + n * 8) % n;   // each step, everyone gets a chain they haven't touched

    for (let s = 0; s < steps; s++) {
      const kind = s === 0 ? 'start' : s % 2 ? 'draw' : 'guess';
      ctx.show(h('div.col.pad', h('h1.big', kind === 'start' ? 'Write something to draw' : kind === 'draw' ? 'Draw what it says' : 'What on earth is that?'),
        h('p.sub', kind === 'start' ? 'A person, a thing, a situation. The weirder the better.' : kind === 'draw' ? 'No letters or numbers!' : 'Type your best guess at the drawing.'),
        h('p.sub', `Step ${s + 1} of ${steps}`)));
      const key = ctx.key('sk');
      const res = await ctx.collect(P, (p): View => {
        const prev = chains[chainFor(P.indexOf(p), s)][s - 1];
        if (kind === 'start') return { type: 'text', key, id: key, prompt: 'Write something to draw', sub: 'Someone else will have to draw this.', placeholder: `e.g. ${pick(SKETCH_SEEDS)}`, maxLen: 60 };
        if (kind === 'draw') return { type: 'draw', key, id: key, prompt: prev.kind === 'text' ? prev.text : '?', sub: 'Draw this. No words!' };
        return { type: 'text', key, id: key, prompt: 'What is this?', sub: 'Describe the drawing.', image: prev.kind === 'draw' ? prev.strokes : [], maxLen: 60, placeholder: 'It’s clearly a…' };
      }, kind === 'start' ? 40 : kind === 'draw' ? 80 : 40, { bot: (_p, v) => (v.type === 'text' ? pick(SKETCH_SEEDS) : undefined) });
      P.forEach((p, i) => {
        const chain = chains[chainFor(i, s)], a = res.get(p.id);
        if (kind === 'draw') chain.push({ by: p, kind: 'draw', strokes: Array.isArray(a) ? a : [] });
        else chain.push({ by: p, kind: 'text', text: typeof a === 'string' && a ? a : kind === 'start' ? pick(SKETCH_SEEDS) : '(no idea)' });
      });
    }

    // The reveal: one chain at a time, one link at a time.
    for (const [ci, chain] of chains.entries()) {
      const row = h('div.row.sketch-chain');
      ctx.show(h('div.col.pad', h('p.sub', `Chain ${ci + 1} of ${n}: started by ${chain[0].by.name}`), row));
      const cards: HTMLElement[] = [];
      for (const link of chain) {
        const card = h('div.sketch-link', link.kind === 'text' ? h('div.answer', link.text) : strokeCanvas(link.strokes, 300), h('div', badge(link.by)));
        cards.push(card); row.append(card);
        card.scrollIntoView({ behavior: 'smooth', inline: 'end' });
        await ctx.sleep(link.kind === 'text' ? 2.6 : 3.4);
      }
      const vkey = ctx.key('fav');
      const votes = await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Best bit of this chain?', options: chain.map((l, i) => ({ id: String(i), label: `${l.kind === 'text' ? '💬' : '🎨'} ${l.by.name}${l.kind === 'text' ? `: ${l.text.slice(0, 24)}` : '’s drawing'}` })).filter((_, i) => chain[i].by !== p) }), 15);
      for (const [i, voters] of tally(votes)) {
        const link = chain[Number(i)];
        score.set(link.by.id, score.get(link.by.id)! + voters.length * 100);
        cards[Number(i)].append(h('div.pts', `+${voters.length * 100}`));
      }
      await ctx.sleep(3);
    }
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)! })) };
  },
};
