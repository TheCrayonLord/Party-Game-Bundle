import type { Stroke } from '../core/types';
import { h, pick, shuffle, strokeCanvas } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import { BOT_SLOGANS, COMPANIES } from './content/logos';

export const logolab: GameDef = {
  meta: { id: 'logolab', name: 'Logo Lab', emoji: '🪧', zone: 'Art Alley', blurb: 'Draw a logo for a ridiculous company. Then write someone else’s slogan.', min: 3, max: 12 },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players), n = P.length;
    const names = shuffle(COMPANIES);
    const company = new Map(P.map((p, i) => [p.id, names[i]]));
    const score = new Map(P.map((p) => [p.id, 0]));

    ctx.show(h('div.col.pad', h('h1.big', 'Design a logo'), h('p.sub', 'Your phone has a company that badly needs one.')));
    const dkey = ctx.key('logo');
    const logos = await ctx.collect(P, (p) => ({ type: 'draw', key: dkey, id: dkey, prompt: company.get(p.id)!, sub: 'Draw their logo.' }), 80);
    const logoOf = (id: string): Stroke[] => (Array.isArray(logos.get(id)) ? logos.get(id) : []);

    // Everyone writes the slogan for the next player's logo.
    ctx.show(h('div.col.pad', h('h1.big', 'Now the slogan'), h('p.sub', 'You’ve been handed someone else’s logo. Give it a tagline.')));
    const skey = ctx.key('slogan');
    const target = (i: number) => P[(i + 1) % n];
    const slogans = await ctx.collect(P, (p) => { const t = target(P.indexOf(p)); return { type: 'text', key: skey, id: skey, prompt: company.get(t.id)!, sub: 'Write a slogan for this logo.', image: logoOf(t.id), maxLen: 60, placeholder: 'A catchy tagline…' }; }, 45, { bot: () => pick(BOT_SLOGANS) });
    const sloganFor = (owner: number) => { const writer = P[(owner - 1 + n) % n]; return { writer, text: String(slogans.get(writer.id) ?? pick(BOT_SLOGANS)) }; };

    // The pitch: each brand in turn.
    const cards: HTMLElement[] = [];
    for (const [i, p] of P.entries()) {
      const s = sloganFor(i);
      const card = h('div.logo-card', h('div.logo-name', company.get(p.id)!), strokeCanvas(logoOf(p.id), 360), h('div.logo-slogan', `“${s.text}”`), h('div.logo-credits', 'Logo: ', badge(p), ' Slogan: ', badge(s.writer)));
      cards.push(card);
      ctx.show(h('div.col.pad', h('p.sub', `Brand ${i + 1} of ${n}`), card));
      await ctx.sleep(5);
    }

    const gallery = h('div.row.logo-gallery', ...cards);
    ctx.show(h('div.col.pad', h('h1.big', 'Vote: best logo'), gallery));
    const v1 = ctx.key('vlogo');
    const best = tally(await ctx.collect(P, (p) => ({ type: 'choice', key: v1, id: v1, prompt: 'Best LOGO?', sub: 'Not your own.', options: P.filter((q) => q !== p).map((q) => ({ id: q.id, label: company.get(q.id)! })) }), 30));
    ctx.show(h('div.col.pad', h('h1.big', 'Vote: best slogan'), gallery));
    const v2 = ctx.key('vslogan');
    const bestS = tally(await ctx.collect(P, (p) => ({ type: 'choice', key: v2, id: v2, prompt: 'Best SLOGAN?', sub: 'Not your own.', options: P.map((_, i) => i).filter((i) => sloganFor(i).writer !== p).map((i) => ({ id: String(i), label: `“${sloganFor(i).text}”` })) }), 30));

    P.forEach((p, i) => {
      const lv = best.get(p.id)?.length || 0, sv = bestS.get(String(i))?.length || 0, writer = sloganFor(i).writer;
      score.set(p.id, score.get(p.id)! + lv * 500);
      score.set(writer.id, score.get(writer.id)! + sv * 500);
      cards[i].append(h('div.pts', `🎨 ${lv} vote${lv === 1 ? '' : 's'} · 💬 ${sv} vote${sv === 1 ? '' : 's'}`));
    });
    ctx.show(h('div.col.pad', h('h1.big', 'The people have spoken'), gallery));
    await ctx.sleep(7);
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)! })) };
  },
};
