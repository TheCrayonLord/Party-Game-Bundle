import type { Stroke, View } from '../core/types';
import { h, pick, shuffle, strokeCanvas } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';
import { SKETCH_SEEDS } from './content/drawing';

type Link = { by: Player; kind: 'text'; text: string } | { by: Player; kind: 'draw'; strokes: Stroke[] };

export const sketch: GameDef = {
  meta: { id: 'sketch', name: 'Sketch & Switch', emoji: '✏️', zone: 'Art Alley', blurb: 'Write it, draw it, guess it. Then see what survived.', min: 3, max: 12,
    howTo: [
      "✏️ Everyone writes something to draw.",
      "🎨 You get someone else’s words and draw them.",
      "💬 You get someone else’s drawing and guess what it is.",
      "😂 We reveal each one: the words, the drawing, the guess. Then one vote for the best drawing.",
    ] },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players), n = P.length;
    // Small groups pass twice more (draw, guess, draw, guess); bigger groups do one lap so the game stays short.
    const steps = n === 5 || n === 6 ? 5 : 3;
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
      }, kind === 'start' ? 30 : kind === 'draw' ? 60 : 30, { bot: (_p, v) => (v.type === 'text' ? pick(SKETCH_SEEDS) : undefined) });
      P.forEach((p, i) => {
        const chain = chains[chainFor(i, s)], a = res.get(p.id);
        if (kind === 'draw') chain.push({ by: p, kind: 'draw', strokes: Array.isArray(a) ? a : [] });
        else chain.push({ by: p, kind: 'text', text: typeof a === 'string' && a ? a : kind === 'start' ? pick(SKETCH_SEEDS) : '(no idea)' });
      });
    }

    // The reveal: one chain at a time, one link at a time, no stopping to vote in between.
    const card = (link: Link, size: number) => h('div.sketch-link', link.kind === 'text' ? h('div.answer', link.text) : strokeCanvas(link.strokes, size), h('div', badge(link.by)));
    ctx.wait(P, 'The reveal', 'Watch the big screen.', '🍿');
    for (const [ci, chain] of chains.entries()) {
      const row = h('div.row.sketch-chain');
      ctx.show(h('div.col.pad', h('p.sub', `${ci + 1} of ${n}: started by ${chain[0].by.name}`), row));
      for (const link of chain) {
        const c = card(link, steps > 3 ? 240 : 320);
        row.append(c);
        c.scrollIntoView({ behavior: 'smooth', inline: 'end' });
        await ctx.sleep(link.kind === 'text' ? 2.2 : 3);
      }
      await ctx.sleep(1.5);
    }

    // One vote at the end, for the best drawing. The artist scores, and so does whoever wrote what they had to draw.
    const drawings = chains.flatMap((c) => c.map((l, i) => ({ l, asked: c[i - 1] })).filter((x): x is { l: Extract<Link, { kind: 'draw' }>; asked: Link } => x.l.kind === 'draw'));
    const asked = (d: (typeof drawings)[number]) => (d.asked.kind === 'text' ? d.asked.text : '?');
    const tiles = drawings.map((d) => h('div.sketch-tile', strokeCanvas(d.l.strokes, 150), h('div.sketch-tile-text', `“${asked(d).slice(0, 40)}”`), h('div', badge(d.l.by))));
    ctx.show(h('div.col.pad', h('h1.big', 'Vote for the best drawing'), h('div.row.sketch-tiles' + (drawings.length > 8 ? '.many' : ''), ...tiles)));
    const vkey = ctx.key('fav');
    const votes = await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Best drawing?', sub: 'Not your own.',
      options: drawings.map((d, i) => ({ id: String(i), label: `🎨 ${d.l.by.name}: “${asked(d).slice(0, 24)}”` })).filter((_, i) => drawings[i].l.by !== p) }), 25);
    for (const [i, voters] of tally(votes)) {
      const d = drawings[Number(i)], pts = voters.length * 100;
      score.set(d.l.by.id, score.get(d.l.by.id)! + pts);
      if (d.asked.by !== d.l.by) score.set(d.asked.by.id, score.get(d.asked.by.id)! + pts / 2);
      tiles[Number(i)].append(h('div.pts', `+${pts}`), h('div.sketch-tile-text', `and +${pts / 2} to ${d.asked.by.name} for the idea`));
    }
    await ctx.sleep(5);
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)! })) };
  },
};
