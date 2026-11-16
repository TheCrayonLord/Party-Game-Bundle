import { h, pick, shuffle } from '../core/util';
import { badge, tally, type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';
import { ROOMS } from './content/dungeon';

export const dungeon: GameDef = {
  meta: { id: 'dungeon', name: 'Dungeon Vote', emoji: '👻', zone: 'Haunted Manor', blurb: 'Vote your way through the ghost train. Someone is steering you wrong.', min: 4, max: 12,
    howTo: [
      "🚂 Ride the ghost train through seven rooms. Each room, vote for one of two ways on.",
      "😈 One of you is a traitor who knows which way is dangerous.",
      "🔮 Each room, one loyal passenger gets a gut feeling about the safe way. It’s usually right.",
      "❤️ Three hits and the cart is wrecked. Argue, accuse, vote.",
    ] },
  async run(ctx: Ctx) {
    const P = ctx.players, n = P.length;
    const traitors = shuffle(P).slice(0, n >= 9 ? 2 : 1);
    const loyal = P.filter((p) => !traitors.includes(p));
    const rooms = shuffle(ROOMS).slice(0, 7);
    let hp = 3;
    const exiled = new Set<Player>();
    const hearts = h('div.dv-hearts'), prog = h('div.dv-prog'), main = h('div.col.dv-main');
    const hud = (i: number) => { hearts.textContent = '❤️'.repeat(hp) + '🖤'.repeat(3 - hp); prog.textContent = `Room ${Math.min(i + 1, rooms.length)} of ${rooms.length}`; };
    ctx.show(h('div.dv-stage', h('div.dv-top', hearts, prog), main));
    hud(0);

    // Roles.
    main.replaceChildren(h('div.dv-emoji', '🚂'), h('h1.big', 'All aboard the ghost train'), h('p.sub', `Survive ${rooms.length} rooms with at least one heart. ${traitors.length > 1 ? 'Two of you are traitors' : 'One of you is a traitor'} who wants the cart wrecked.`), h('p.sub', 'Check your phone for your role. Keep it secret.'));
    const rkey = ctx.key('role');
    await ctx.collect(P, (p) => {
      const t = traitors.includes(p), mate = traitors.find((x) => x !== p);
      return { type: 'choice', key: rkey, id: rkey, prompt: t ? '😈 You are a TRAITOR' : '🙂 You are a loyal passenger',
        sub: t ? `Each room, you’ll be told which way is dangerous. Talk the group into it without getting caught.${mate ? ` Your partner is ${mate.name}.` : ''}` : 'Each room, one loyal passenger gets a gut feeling about the safe way. It’s usually right. Listen, argue, and vote.',
        options: [{ id: 'ok', label: 'Got it' }] };
    }, 25);

    for (const [ri, room] of rooms.entries()) {
      hud(ri);
      const danger = Math.random() < 0.5 ? 'a' : 'b', safe = danger === 'a' ? 'b' : 'a';
      const voters = P.filter((p) => !exiled.has(p));
      const scout = pick(loyal.filter((p) => !exiled.has(p)).length ? loyal.filter((p) => !exiled.has(p)) : loyal);
      const gut = Math.random() < 0.8 ? safe : danger;      // gut feelings are right four times out of five
      const label = (k: string) => (k === 'a' ? room.a : room.b);
      main.replaceChildren(h('div.panel.prompt', room.text), h('div.row', h('div.answer', `🅰️ ${room.a}`), h('div.answer', `🅱️ ${room.b}`)), h('p.sub', 'Someone has a gut feeling. Someone is lying. Talk, then vote in secret.'));
      const key = ctx.key('room');
      const votes = await ctx.collect(voters, (p) => ({ type: 'choice', key, id: key, prompt: room.text,
        sub: traitors.includes(p) ? `😈 The dangerous way is: “${label(danger)}”. Steer them into it.` : p === scout ? `🔮 Your gut says “${label(gut)}” is SAFE. (Your gut is usually right.) Convince the others!` : 'You have no special feeling about this one. Who do you believe?',
        options: [{ id: 'a', label: room.a }, { id: 'b', label: room.b }] }), 40,
        { bot: (p) => (traitors.includes(p) ? danger : Math.random() < [0.45, 0.6, 0.8][ctx.botLevel] ? safe : danger) });
      ctx.wait(exiled.size ? [...exiled] : [], 'You’ve been thrown off the train', 'Watch and heckle.', '🪦');
      const t = tally(votes), a = t.get('a')?.length || 0, b = t.get('b')?.length || 0;
      const chosen = a === b ? pick(['a', 'b']) : a > b ? 'a' : 'b';
      const hurt = chosen === danger;
      if (hurt) hp--;
      hud(ri);
      main.replaceChildren(h('div.panel.prompt', room.text), h('p.sub', `The votes: ${room.a} ${a} · ${room.b} ${b}${a === b ? ' (a tie! The cart picks for itself)' : ''}`),
        h('div.answer' + (hurt ? '.dv-hurt' : '.truth'), `${label(chosen)}: ${hurt ? room.hurt : room.safe}`), h('p.pts', hurt ? '💔 The cart takes a hit!' : '😮‍💨 Safe.'));
      if (hurt) { main.classList.add('shake'); setTimeout(() => main.classList.remove('shake'), 400); }
      await ctx.sleep(5);
      if (hp <= 0) break;

      // Halfway: the passengers may throw one person off the train.
      if (ri === 3) {
        main.replaceChildren(h('div.dv-emoji', '⚖️'), h('h1.big', 'Emergency stop!'), h('p.sub', 'You may throw ONE passenger off the train. They lose their vote for the rest of the ride. A majority is needed.'), h('div.row', ...voters.map((p) => badge(p))));
        const tkey = ctx.key('trial');
        const tv = await ctx.collect(voters, (p) => ({ type: 'choice', key: tkey, id: tkey, prompt: 'Throw someone off?', sub: 'Majority needed.', options: [...voters.filter((q) => q !== p).map((q) => ({ id: q.id, label: `${q.avatar} ${q.name}` })), { id: 'none', label: 'Nobody' }] }), 45);
        const top = [...tally(tv).entries()].sort((x, y) => y[1].length - x[1].length)[0];
        if (top && top[0] !== 'none' && top[1].length > voters.length / 2) {
          const out = ctx.by(top[0]); exiled.add(out);
          main.replaceChildren(h('div.dv-emoji', '🪦'), h('h1.big', `${out.name} is thrown off!`), h('p.sub', 'Were they the traitor? The train rolls on…'));
        } else main.replaceChildren(h('div.dv-emoji', '🤷'), h('h1.big', 'Nobody is thrown off'), h('p.sub', 'No majority. The train rolls on…'));
        await ctx.sleep(4);
      }
    }

    const survived = hp > 0;
    main.replaceChildren(h('div.dv-emoji', survived ? '🌅' : '💀'), h('h1.big', survived ? 'You made it out!' : 'The cart is wrecked!'),
      h('p.sub', `The traitor${traitors.length > 1 ? 's were' : ' was'}:`), h('div.row', ...traitors.map((p) => badge(p))), h('p.sub', survived ? 'The loyal passengers win.' : 'The traitors win.'));
    ctx.wait(P, survived ? 'Daylight!' : 'Wrecked!', '', survived ? '🌅' : '💀');
    await ctx.sleep(6);
    return { headline: survived ? '👻 Dungeon Vote: the passengers escape' : '👻 Dungeon Vote: the traitors win',
      scores: P.map((p) => { const win = traitors.includes(p) !== survived; return { id: p.id, score: win ? 1 : 0, label: `${traitors.includes(p) ? '😈 traitor' : 'loyal'} · ${win ? 'won' : 'lost'}`, tickets: win ? (traitors.includes(p) ? 120 : 80) : 25 }; }) };
  },
};
