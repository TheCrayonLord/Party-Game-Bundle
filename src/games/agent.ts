import { SPEED, h, pick, shuffle } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';
import { LOCATIONS } from './content/agent';

export const agent: GameDef = {
  meta: { id: 'agent', name: 'Secret Agent', emoji: '🔮', zone: 'Fortune Tent', blurb: 'Everyone knows where you are. Except the spy.', min: 4, max: 10 },
  async run(ctx: Ctx) {
    const P = ctx.players, n = P.length;
    const options = shuffle(LOCATIONS).slice(0, 12);
    const place = pick(options), spy = pick(P);
    const roles = shuffle(place.roles);
    const role = new Map(P.filter((p) => p !== spy).map((p, i) => [p.id, roles[i % roles.length]]));
    const accused = new Set<string>();        // each player may call one vote
    let left = Math.min(360, 60 + n * 40), result: { spyWins: boolean; why: string } | null = null;

    const timeEl = h('div.heist-time'), main = h('div.col.dv-main');
    ctx.show(h('div.dv-stage', h('div.dv-top', h('div.dv-hearts', '🔮 Where are we?'), timeEl), main));
    const cardKey = ctx.key('card');
    const cards = () => {
      for (const p of P) {
        const btn = accused.has(p.id) ? [] : [{ id: 'accuse', label: '☝️ Accuse someone (once per game)' }];
        if (p === spy) ctx.view(p, { type: 'info', key: cardKey + accused.has(p.id), id: 'act', title: '🕵️ You are the SPY', lines: ['You don’t know where everyone is. Listen, bluff, and work it out. It’s one of:', options.map((o) => o.name).join(' · ')], buttons: [{ id: 'guess', label: '🎯 I know where we are!' }, ...btn] });
        else ctx.view(p, { type: 'info', key: cardKey + accused.has(p.id), id: 'act', title: `📍 ${place.name}`, lines: [`Your role: ${role.get(p.id)}`, 'One of you is a spy who doesn’t know the location. Ask questions that prove you know it without giving it away.'], buttons: btn });
      }
    };
    const fmt = () => { timeEl.textContent = `⏱ ${Math.floor(left / 60)}:${String(Math.max(0, Math.ceil(left)) % 60).padStart(2, '0')}`; timeEl.classList.toggle('low', left < 30); };
    const question = () => {
      const [a, b] = shuffle(P);
      main.replaceChildren(h('div.dv-emoji', '🔮'), h('h1.big', 'Question time'), h('div.agent-ask', badge(a), ' asks ', badge(b), ' a question'),
        h('p.sub', 'Anything you like, e.g. “How did you get here today?” Then anyone can follow up.'), h('div.agent-places', ...options.map((o) => h('span.agent-place', o.name))));
    };

    main.replaceChildren(h('div.dv-emoji', '🕵️'), h('h1.big', 'Check your phone'), h('p.sub', 'Everyone gets the location and a role. One of you gets nothing: the spy.'));
    fmt(); cards();
    await ctx.sleep(7);

    let nextQ = 0, running = true;
    ctx.frame((dt) => { if (running && !result) { left -= dt * SPEED; nextQ -= dt * SPEED; fmt(); } });

    while (!result) {
      // Wait for something to happen: a button press, the next question, or the clock.
      const ev = await new Promise<{ p: Player; v: string } | 'tick' | 'time'>((resolve) => {
        const off = ctx.onInput((p, d) => { if (d?.id === 'act' && (d.v === 'accuse' || d.v === 'guess')) { off(); stop(); resolve({ p, v: d.v }); } });
        const stop = ctx.frame(() => { if (left <= 0) { off(); stop(); resolve('time'); } else if (nextQ <= 0) { off(); stop(); resolve('tick'); } });
      });
      if (ev === 'tick') { question(); nextQ = 35; continue; }
      running = false;
      if (ev === 'time') {
        // Out of time: everyone names a suspect.
        main.replaceChildren(h('div.dv-emoji', '⏰'), h('h1.big', 'Time’s up! Who is the spy?'), h('p.sub', 'Everyone votes.'));
        const k = ctx.key('final');
        const t = tally(await ctx.collect(P, (p) => ({ type: 'choice', key: k, id: k, prompt: 'Who is the spy?', options: P.filter((q) => q !== p).map((q) => ({ id: q.id, label: `${q.avatar} ${q.name}` })) }), 40));
        const top = [...t.entries()].sort((a, b) => b[1].length - a[1].length);
        const caught = top.length > 0 && top[0][0] === spy.id && (top.length === 1 || top[1][1].length < top[0][1].length);
        result = { spyWins: !caught, why: caught ? 'The group voted out the spy.' : 'The group picked the wrong person.' };
      } else if (ev.v === 'guess' && ev.p === spy) {
        main.replaceChildren(h('div.dv-emoji', '🎯'), h('h1.big', `${spy.name} is the spy!`), h('p.sub', '…and thinks they know where we are.'));
        ctx.wait(P.filter((p) => p !== spy), `${spy.name} is the spy!`, 'They get one guess at the location.', '🎯');
        const k = ctx.key('guess');
        const g = (await ctx.collect([spy], () => ({ type: 'choice', key: k, id: k, prompt: 'Where are we?', options: options.map((o) => ({ id: o.name, label: o.name })) }), 30)).get(spy.id);
        result = { spyWins: g === place.name, why: g === place.name ? `The spy correctly guessed “${place.name}”.` : `The spy guessed “${g ?? 'nothing'}”. Wrong!` };
      } else if (ev.v === 'accuse' && !accused.has(ev.p.id)) {
        accused.add(ev.p.id);
        main.replaceChildren(h('div.dv-emoji', '☝️'), h('h1.big', `${ev.p.name} is making an accusation…`));
        ctx.wait(P.filter((p) => p !== ev.p), `${ev.p.name} is accusing someone`, '', '☝️');
        const k = ctx.key('who');
        const who = (await ctx.collect([ev.p], () => ({ type: 'choice', key: k, id: k, prompt: 'Who is the spy?', options: P.filter((q) => q !== ev.p).map((q) => ({ id: q.id, label: `${q.avatar} ${q.name}` })) }), 20)).get(ev.p.id);
        const suspect = who ? ctx.by(who) : null;
        if (suspect) {
          main.replaceChildren(h('div.dv-emoji', '⚖️'), h('h1.big', 'Is this the spy?'), h('div.agent-ask', badge(ev.p), ' accuses ', badge(suspect)), h('p.sub', 'Everyone else votes. It must be unanimous.'));
          const jury = P.filter((p) => p !== ev.p && p !== suspect), vk = ctx.key('jury');
          ctx.wait([ev.p, suspect], 'The jury is voting', '', '⚖️');
          const t = tally(await ctx.collect(jury, () => ({ type: 'choice', key: vk, id: vk, prompt: `Is ${suspect.name} the spy?`, options: [{ id: 'yes', label: 'Yes, guilty' }, { id: 'no', label: 'No' }] }), 30));
          if ((t.get('yes')?.length || 0) === jury.length) result = { spyWins: suspect !== spy, why: suspect === spy ? `${suspect.name} was caught!` : `${suspect.name} was innocent. The spy slips away.` };
          else { main.replaceChildren(h('div.dv-emoji', '🙅'), h('h1.big', 'Not unanimous'), h('p.sub', 'The game goes on.')); await ctx.sleep(3); }
        }
      }
      if (!result) { cards(); question(); nextQ = 35; running = true; }
    }

    main.replaceChildren(h('div.dv-emoji', result.spyWins ? '🕵️' : '🎉'), h('h1.big', result.spyWins ? 'The spy wins!' : 'The agents win!'), h('p.sub', result.why),
      h('div.agent-ask', 'The spy was ', badge(spy)), h('p.sub', `The location was: ${place.name}`));
    ctx.wait(P, result.spyWins ? 'The spy wins!' : 'The agents win!', `It was ${place.name}.`, '🔮');
    await ctx.sleep(7);
    const spyWins = result.spyWins;
    return { headline: spyWins ? '🔮 Secret Agent: the spy got away' : '🔮 Secret Agent: spy caught',
      scores: P.map((p) => { const win = (p === spy) === spyWins; return { id: p.id, score: win ? 1 : 0, label: `${p === spy ? '🕵️ spy' : role.get(p.id)} · ${win ? 'won' : 'lost'}`, tickets: win ? (p === spy ? 120 : 80) : 25 }; }) };
  },
};
