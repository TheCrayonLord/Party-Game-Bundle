import { h, shuffle, pick } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import { FIB_QUESTIONS } from './content/fib';

const norm = (s: string) => s.toLowerCase().replace(/^(a|an|the)\s+/, '').replace(/[^a-z0-9]/g, '');

export const fib: GameDef = {
  meta: { id: 'fib', name: 'Fib Finder', emoji: '🤥', zone: 'Midway', blurb: 'Write a convincing lie. Then find the truth.', min: 3, max: 12,
    howTo: [
      "❓ A weird-but-true trivia question appears with a blank.",
      "🤥 Write a LIE that sounds like the real answer.",
      "🔎 Then pick the truth from everyone’s lies.",
      "💰 1000 for finding the truth. 500 for every player your lie fools.",
    ] },
  async run(ctx: Ctx) {
    const P = ctx.players;
    const score = new Map(P.map((p) => [p.id, 0]));
    const add = (id: string, n: number) => score.set(id, score.get(id)! + n);
    const questions = shuffle(FIB_QUESTIONS).slice(0, P.length > 8 ? 3 : 4);

    for (const [qi, q] of questions.entries()) {
      const prompt = h('div.panel.prompt', q.q);
      ctx.show(h('div.col.pad', h('p.sub', `Question ${qi + 1} of ${questions.length}`), prompt, h('p.sub', 'Fill the blank with a lie that sounds true.')));
      const key = ctx.key('lie');
      const lies = await ctx.collect(P, () => ({ type: 'text', key, id: key, prompt: q.q, sub: 'Write a believable LIE.', maxLen: 40, placeholder: 'Your lie…', button: 'Submit lie' }), 45,
        { bot: () => pick(q.d) });

      // Build the options: the truth, each distinct lie, and house lies if the room came up short.
      type Opt = { id: string; text: string; authors: string[]; truth: boolean };
      const opts: Opt[] = [{ id: 'truth', text: q.a, authors: [], truth: true }];
      for (const p of P) {
        let text = String(lies.get(p.id) ?? '').trim();
        if (!text || norm(text) === norm(q.a)) text = q.d.find((d) => !opts.some((o) => norm(o.text) === norm(d))) || pick(q.d); // blank or accidentally true: swap in a house lie
        const same = opts.find((o) => !o.truth && norm(o.text) === norm(text));
        if (same) same.authors.push(p.id); else opts.push({ id: 'o' + opts.length, text, authors: [p.id], truth: false });
      }
      const shown = shuffle(opts).slice(0, 9);
      if (!shown.some((o) => o.truth)) shown[0] = opts[0];
      const order = shuffle(shown);

      ctx.show(h('div.col.pad', prompt, h('div.row', ...order.map((o) => h('div.answer', o.text.toUpperCase()))), h('p.sub', 'Which one is TRUE? Vote on your phone.')));
      const vkey = ctx.key('vote');
      const votes = await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Which is the truth?', sub: q.q, options: order.filter((o) => !o.authors.includes(p.id)).map((o) => ({ id: o.id, label: o.text.toUpperCase() })) }), 30,
        { bot: (_p, v) => (v.type === 'choice' ? (Math.random() < [0.2, 0.4, 0.65][ctx.botLevel] && v.options.some((o) => o.id === 'truth') ? 'truth' : pick(v.options).id) : null) });
      const t = tally(votes);

      // Reveal lies that fooled someone first, the truth last.
      const reveal = [...order.filter((o) => !o.truth && t.get(o.id)?.length), order.find((o) => o.truth)!];
      for (const o of reveal) {
        const fooled = (t.get(o.id) || []).map((id) => ctx.by(id));
        if (o.truth) fooled.forEach((p) => add(p.id, 1000)); else o.authors.forEach((a) => add(a, 500 * fooled.length));
        ctx.show(h('div.col.pad', prompt,
          h('div.answer' + (o.truth ? '.truth' : ''), o.text.toUpperCase(),
            h('div.by', o.truth ? 'THE TRUTH' : `A lie by ${o.authors.map((a) => ctx.by(a).name).join(' & ')}`),
            h('div.who', ...fooled.map((p) => badge(p)))),
          h('p.pts', o.truth ? (fooled.length ? `+1000 for spotting it` : 'Nobody found the truth!') : `Fooled ${fooled.length}: +${500 * fooled.length}`)));
        await ctx.sleep(o.truth ? 4.5 : 3.2);
      }
    }
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)! })) };
  },
};
