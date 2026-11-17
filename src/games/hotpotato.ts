import { SPEED, h, pick } from '../core/util';
import { type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';

export const hotpotato: GameDef = {
  meta: { id: 'hotpotato', name: 'Hot Potato Bomb', emoji: '💣', zone: 'Midway', blurb: 'Catch the bomb to score. Flick it away before it overheats.', min: 3, max: 12,
    howTo: [
      "💣 One phone has the bomb. Nobody knows how long the fuse is.",
      "💰 You score while you hold it, but only for the first 2 seconds of each catch.",
      "🔥 Hold it longer than 3 seconds and it OVERHEATS: the fuse burns three times as fast, in your hands.",
      "👉 FLICK it left or right to pass to a neighbour, or up to throw it across the circle.",
      "💥 Holding it when it blows? You’re out. Last one standing wins.",
    ] },
  async run(ctx: Ctx) {
    const P = ctx.players;
    const score = new Map(P.map((p) => [p.id, 0]));
    const add = (p: Player, n: number) => score.set(p.id, score.get(p.id)! + n);
    let alive = [...P];
    const relit = new Set<string>();      // each eliminated player gets one fuse-shortening tap
    const ring = h('div.hp-ring'), banner = h('div.hp-banner'), bombEl = h('div.hp-bomb', '💣');
    const seats = new Map<string, HTMLElement>();
    ctx.show(h('div.hp-stage', banner, ring));
    const layout = () => {
      ring.replaceChildren(bombEl);
      seats.clear();
      P.forEach((p, i) => {
        const a = (i / P.length) * Math.PI * 2 - Math.PI / 2;
        const el = h('div.hp-seat' + (alive.includes(p) ? '' : '.out'), { style: { left: `${50 + Math.cos(a) * 42}%`, top: `${54 + Math.sin(a) * 36}%`, background: p.color } },
          h('div.hp-av', alive.includes(p) ? p.avatar : '💀'), h('div.hp-name', p.name), h('div.hp-pts', { 'data-pts': p.id }, String(Math.round(score.get(p.id)!))));
        seats.set(p.id, el); ring.append(el);
      });
    };
    const moveBomb = (p: Player) => { const s = seats.get(p.id)!; bombEl.style.left = s.style.left; bombEl.style.top = s.style.top; };

    const PAY = 2, HOT = 3;      // seconds of a hold that score; seconds until the bomb overheats
    let round = 0;
    while (alive.length > 1) {
      round++;
      layout();
      let holder = pick(alive), held = 0, fuse = alive.length > 6 ? 5 + Math.random() * 6 : 8 + Math.random() * 9 /* big groups thin out faster */, botPass = 1 + Math.random() * 2.5;
      const calm = `Round ${round}: ${alive.length} left. Catch it to score, then get rid of it!`;
      banner.textContent = calm;
      moveBomb(holder);
      const give = (to: Player) => {
        if (held > HOT) banner.textContent = calm;
        holder = to; held = 0; botPass = 0.8 + Math.random() * 2.8;
        bombEl.classList.remove('hot');
        moveBomb(to);
        ctx.buzz(to, 'turn'); ctx.sfx('whoosh');
        const key = ctx.key('bomb');
        for (const p of P) {
          if (p === to) ctx.view(p, { type: 'bomb', key, title: 'YOU HAVE THE BOMB!' });
          else if (alive.includes(p)) ctx.view(p, { type: 'wait', key, title: `${to.name} has the bomb`, text: 'Brace yourself…', emoji: '😬' });
          else if (!relit.has(p.id)) ctx.view(p, { type: 'info', key, id: 'relight', title: '💀 You’re out', lines: ['You get ONE act of revenge: burn two seconds off the fuse. Pick your moment.'], buttons: [{ id: 'go', label: '🔥 Burn the fuse' }] });
          else ctx.view(p, { type: 'wait', key, title: 'You’re out', text: 'Enjoy the fireworks.', emoji: '💀' });
        }
      };
      const pass = (dir: string) => {
        const i = alive.indexOf(holder), n = alive.length;
        const others = alive.filter((p) => p !== holder);
        const to = dir === 'left' ? alive[(i - 1 + n) % n] : dir === 'right' ? alive[(i + 1) % n] : pick(others.length > 2 ? others.filter((p) => p !== alive[(i + 1) % n] && p !== alive[(i - 1 + n) % n]) : others);
        give(to);
      };
      await ctx.sleep(1.5);
      give(holder);
      const off = ctx.onInput((p, d) => {
        if (p === holder && typeof d.flick === 'string' && held > 0.35) pass(d.flick);
        if (d?.id === 'relight' && !alive.includes(p) && !relit.has(p.id)) { relit.add(p.id); fuse -= 2; ctx.wait([p], 'Sizzle!', 'Two seconds gone.', '🔥'); banner.textContent = `🔥 ${p.name} burned the fuse!`; }
      });
      await new Promise<void>((resolve) => {
        const stop = ctx.frame((dt) => {
          const hot = held > HOT;
          fuse -= dt * SPEED * (hot ? 3 : 1); held += dt * SPEED;
          if (held < PAY) add(holder, dt * SPEED * 15);
          if (held > HOT && !hot) { ctx.live(holder, { info: '🔥 OVERHEATING! The fuse is racing: throw it!' }); ctx.buzz(holder, 'hit'); bombEl.classList.add('hot'); banner.textContent = `🔥 Overheating in ${holder.name}’s hands! The fuse is racing!`; }
          const pts = ring.querySelector<HTMLElement>(`[data-pts="${holder.id}"]`); if (pts) pts.textContent = String(Math.round(score.get(holder.id)!));
          bombEl.style.transform = `translate(-50%, -50%) scale(${1 + Math.sin(performance.now() / (fuse < 4 ? 40 : 110)) * 0.12})`;
          if ((holder.bot || !holder.connected) && held > botPass) pass(pick(['left', 'right', 'up']));
          if (fuse <= 0) { stop(); resolve(); }
        });
      });
      off();
      bombEl.classList.remove('hot');
      const dead = holder;
      ctx.sfx('boom');
      ctx.comment('out', dead, true);
      alive = alive.filter((p) => p !== dead);
      alive.forEach((p) => add(p, 60));
      bombEl.textContent = '💥'; banner.textContent = `BOOM! ${dead.name} is out.`;
      seats.get(dead.id)!.classList.add('out');
      ctx.wait(P, 'BOOM!', `${dead.name} is out.`, '💥');
      await ctx.sleep(2.5);
      bombEl.textContent = '💣';
    }
    add(alive[0], 250);
    banner.textContent = `${alive[0].avatar} ${alive[0].name} survives!`;
    layout();
    await ctx.sleep(3.5);
    return { scores: P.map((p) => ({ id: p.id, score: Math.round(score.get(p.id)!) })) };
  },
};
