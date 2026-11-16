import type { Stroke } from '../core/types';
import { drawStrokes, h, pick, shuffle } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import { FAKE_WORDS } from './content/drawing';

export const fakeartist: GameDef = {
  meta: { id: 'fakeartist', name: 'Fake Artist', emoji: '🎨', zone: 'Art Alley', blurb: 'One drawing, one line each. One of you has no idea what it is.', min: 4, max: 10 },
  async run(ctx: Ctx) {
    const P = ctx.players, n = P.length;
    const score = new Map(P.map((p) => [p.id, 0]));
    const add = (id: string, pts: number) => score.set(id, score.get(id)! + pts);
    const rounds = n <= 6 ? 2 : 1;
    const fakers = shuffle(P);

    for (let r = 0; r < rounds; r++) {
      const category = pick(Object.keys(FAKE_WORDS)), word = pick(FAKE_WORDS[category]), faker = fakers[r];
      const order = shuffle(P), laps = n <= 7 ? 2 : 1;
      const strokes: Stroke[] = [];
      const canvas = h<'canvas'>('canvas.paper', { width: 640, height: 640 });
      const g = canvas.getContext('2d')!;
      const paint = () => { g.fillStyle = '#fbf5e6'; g.fillRect(0, 0, 640, 640); drawStrokes(g, strokes, 640); };
      paint();
      const turnEl = h('div.fake-turn');
      const queue = h('div.fake-queue');

      // Secret cards.
      ctx.show(h('div.col.pad', h('h1.big', `Round ${r + 1}: check your phone`), h('p.sub', `Category: ${category}`), h('p.sub', 'Everyone has the secret word… except the Fake Artist.')));
      const ckey = ctx.key('card');
      await ctx.collect(P, (p) => ({ type: 'choice', key: ckey, id: ckey, prompt: p === faker ? '🤫 You are the FAKE ARTIST' : `The word is: ${word.toUpperCase()}`,
        sub: p === faker ? `Category: ${category}. You don’t know the word. Draw confidently and blend in.` : `Category: ${category}. Draw one line per turn: clear enough to prove you know it, vague enough that the faker can’t guess.`, options: [{ id: 'ok', label: 'Got it' }] }), 20);

      ctx.show(h('div.fake-stage', canvas, h('div.col.fake-side', h('p.sub', `Category: ${category}`), turnEl, queue)));
      const turns = Array.from({ length: laps }, () => order).flat();
      for (const [ti, p] of turns.entries()) {
        turnEl.replaceChildren(badge(p), h('span', ' adds a line'));
        queue.replaceChildren(h('p.sub', 'Up next:'), ...turns.slice(ti + 1, ti + 5).map((q) => badge(q)));
        ctx.wait(P.filter((q) => q !== p), `${p.name} is drawing`, 'Watch the big screen for clues.', '🖌️');
        const key = ctx.key('line');
        const res = await ctx.collect([p], () => ({ type: 'draw', key, id: key, prompt: p === faker ? `Category: ${category}` : word.toUpperCase(), sub: 'Add ONE line.', color: p.color, oneStroke: true, base: strokes }), 20);
        const line = res.get(p.id);
        if (Array.isArray(line) && line[0]) { strokes.push({ ...line[0], c: p.color, w: 14 }); paint(); }
      }

      // Accusation.
      turnEl.replaceChildren(h('span', 'Who is the Fake Artist?'));
      queue.replaceChildren(h('p.sub', 'Talk it over, then vote on your phone.'));
      const vkey = ctx.key('accuse');
      const votes = await ctx.collect(P, (p) => ({ type: 'choice', key: vkey, id: vkey, prompt: 'Who is the Fake Artist?', options: P.filter((q) => q !== p).map((q) => ({ id: q.id, label: `${q.avatar} ${q.name}` })) }), 45);
      const t = tally(votes);
      const top = [...t.entries()].sort((a, b) => b[1].length - a[1].length);
      const caught = top.length > 0 && top[0][0] === faker.id && (top.length === 1 || top[1][1].length < top[0][1].length);
      queue.replaceChildren(...top.map(([id, v]) => h('div', badge(ctx.by(id)), ` ${v.length} vote${v.length === 1 ? '' : 's'}`)));
      await ctx.sleep(3);

      let outcome: string;
      if (!caught) {
        add(faker.id, 3); outcome = `${faker.name} was the Fake Artist… and got away with it!`;
      } else {
        turnEl.replaceChildren(badge(faker), h('span', ' is caught! One guess at the word…'));
        const options = shuffle([word, ...shuffle(FAKE_WORDS[category].filter((w) => w !== word)).slice(0, 5)]);
        const gkey = ctx.key('guess');
        ctx.wait(P.filter((q) => q !== faker), 'Caught!', `${faker.name} gets one guess at the word.`, '🚨');
        const guess = (await ctx.collect([faker], () => ({ type: 'choice', key: gkey, id: gkey, prompt: 'Caught! What was the word?', sub: 'Guess right and you still win.', options: options.map((w) => ({ id: w, label: w })) }), 20)).get(faker.id);
        if (guess === word) { add(faker.id, 2); outcome = `Caught, but ${faker.name} guessed “${word}” and steals the win!`; }
        else { P.filter((p) => p !== faker).forEach((p) => add(p.id, t.get(faker.id)!.includes(p.id) ? 2 : 1)); outcome = `Caught! ${faker.name} guessed “${guess ?? 'nothing'}”. The artists win.`; }
      }
      turnEl.replaceChildren(h('span', outcome));
      queue.replaceChildren(h('p.sub', `The word was “${word}”.`));
      await ctx.next(r + 1 < rounds ? 'Next round' : 'See results', 12);
    }
    return { scores: P.map((p) => ({ id: p.id, score: score.get(p.id)!, label: `${score.get(p.id)} pts` })) };
  },
};
