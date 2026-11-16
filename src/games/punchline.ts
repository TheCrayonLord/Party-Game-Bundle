import { h, shuffle } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import type { View } from '../core/types';
import { PUNCHLINE_PROMPTS } from './content/punchline';

export const punchline: GameDef = {
  meta: { id: 'punchline', name: 'Punchline Duel', emoji: '🎭', zone: 'Midway', blurb: 'Two answers enter. The room picks the funnier one.', min: 3, max: 12,
    howTo: [
      "🎭 Answer the prompts on your phone. Be funny.",
      "🥊 Each prompt goes to two players. Everyone else votes for the funnier answer.",
      "🧹 Win every vote for a Clean Sweep bonus.",
      "🎆 Final round: everyone answers the same prompt.",
    ] },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players), n = P.length;
    const score = new Map(P.map((p) => [p.id, 0]));
    const add = (id: string, pts: number) => score.set(id, score.get(id)! + pts);
    const prompts = shuffle(PUNCHLINE_PROMPTS);

    // Small rooms: everyone answers two prompts (n duels). Big rooms: one each, to keep it moving.
    const duels: { prompt: string; a: number; b: number }[] = [];
    if (n <= 8) for (let i = 0; i < n; i++) duels.push({ prompt: prompts[i], a: i, b: (i + 1) % n });
    else for (let i = 0; i + 1 < n; i += 2) duels.push({ prompt: prompts[i], a: i, b: i + 1 });
    if (n > 8 && n % 2) duels.push({ prompt: prompts[n], a: n - 1, b: 0 });

    ctx.show(h('div.col.pad', h('h1.big', 'Be funny.'), h('p.sub', 'Answer the prompts on your phone. You’ll go head-to-head with one other guest.')));
    const mine = (i: number) => duels.map((d, di) => ({ d, di })).filter(({ d }) => d.a === i || d.b === i);
    const answers = await ctx.collectSeq(P, (p) => mine(P.indexOf(p)).map(({ d, di }, k, arr): View => ({ type: 'text', key: `pl-${di}`, id: `pl-${di}`, prompt: d.prompt, sub: `Prompt ${k + 1} of ${arr.length}`, maxLen: 70, placeholder: 'Something funny…' })), 80);
    const answerOf = (i: number, di: number) => { const k = mine(i).findIndex((x) => x.di === di); return String(answers.get(P[i].id)?.[k] ?? '(no answer)'); };

    for (const [di, d] of duels.entries()) {
      const pa = P[d.a], pb = P[d.b], ta = answerOf(d.a, di), tb = answerOf(d.b, di);
      const prompt = h('div.panel.prompt', d.prompt);
      const cardA = h('div.answer', ta), cardB = h('div.answer', tb);
      ctx.show(h('div.col.pad', h('p.sub', `Duel ${di + 1} of ${duels.length}`), prompt, h('div.row', cardA, h('div.pts', 'VS'), cardB)));
      const voters = P.filter((p) => p !== pa && p !== pb);
      const key = ctx.key('duel');
      const votes = await ctx.collect(voters, () => ({ type: 'choice', key, id: key, prompt: d.prompt, sub: 'Which is funnier?', options: [{ id: 'a', label: ta }, { id: 'b', label: tb }] }), 20);
      const t = tally(votes), va = t.get('a') || [], vb = t.get('b') || [], total = va.length + vb.length;
      for (const [card, who, v] of [[cardA, pa, va], [cardB, pb, vb]] as const) {
        const pts = total ? Math.round((1000 * v.length) / total) + (v.length === total && total > 1 ? 250 : 0) : 0;
        add(who.id, pts);
        card.append(h('div.by', 'by ', badge(who)), h('div.who', ...v.map((id) => badge(ctx.by(id)))), h('div.pts', `+${pts}${v.length === total && total > 1 ? ' CLEAN SWEEP!' : ''}`));
      }
      ctx.standings([...P].sort((a, b) => score.get(b.id)! - score.get(a.id)!));
      await ctx.sleep(4.5);
    }

    // Final: one prompt, everyone answers, everyone votes.
    const finalPrompt = prompts[prompts.length - 1];
    const prompt = h('div.panel.prompt', finalPrompt);
    ctx.show(h('div.col.pad', h('h1.big', 'The Grand Finale'), prompt, h('p.sub', 'Everybody answers this one.')));
    const fkey = ctx.key('final');
    const finals = await ctx.collect(P, () => ({ type: 'text', key: fkey, id: fkey, prompt: finalPrompt, sub: 'Final round: everyone answers', maxLen: 70 }), 45);
    const entries = shuffle(P.filter((p) => finals.has(p.id)).map((p) => ({ p, text: String(finals.get(p.id)), card: h('div.answer', String(finals.get(p.id))) })));
    ctx.show(h('div.col.pad', prompt, h('div.row', ...entries.map((e) => e.card))));
    const vkey = ctx.key('fvote');
    const votes = await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Pick your favourite', sub: finalPrompt, options: entries.filter((e) => e.p !== p).map((e) => ({ id: e.p.id, label: e.text })) }), 30);
    const t = tally(votes);
    for (const e of entries) {
      const v = t.get(e.p.id) || [];
      add(e.p.id, v.length * 400);
      e.card.append(h('div.by', 'by ', badge(e.p)), h('div.pts', `+${v.length * 400}`));
    }
    await ctx.sleep(6);
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)! })) };
  },
};
