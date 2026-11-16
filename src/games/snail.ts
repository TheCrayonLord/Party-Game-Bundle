import { clamp, h } from '../core/util';
import type { Ctx, GameDef } from '../host/ctx';
import type { Player } from '../host/room';

interface Snail { p: Player; pos: number; rate: number; drowsy: number; asleep: number; moved: number; finish: number | null; el: HTMLElement; zz: HTMLElement; info: string; botRate: number; botWise: number }

const CAP = 900;        // rubbing faster than this many px/s gains nothing…
const FRANTIC = 1500;   // …and faster than this makes the snail drowsy

export const snail: GameDef = {
  meta: { id: 'snail', name: 'Snail Sprint', emoji: '🐌', zone: 'Speedway', blurb: 'Rub to crawl. Stay calm: frantic snails fall asleep.', min: 2, max: 12,
    howTo: [
      "🐌 RUB your screen to crawl.",
      "🥱 Smooth and steady wins. Frantic rubbing (or shaking the phone) sends your snail to sleep.",
      "👀 When the gardener turns round, FREEZE. Moving snails get flicked back.",
    ] },
  async run(ctx: Ctx) {
    const gardener = h('div.snail-gardener', '🧑‍🌾');
    const banner = h('div.snail-banner', 'Get ready…');
    const lanes = h('div.snail-lanes');
    const snails: Snail[] = ctx.players.map((p) => {
      const zz = h('span.snail-zz');
      const el = h('div.snail', h('span.snail-body', '🐌'), zz);
      lanes.append(h('div.snail-lane', h('span.badge.snail-name', { style: { background: p.color } }, `${p.shape} ${p.name}`), h('div.snail-track', { style: { borderColor: p.color } }, el, h('span.snail-flag', '🏁'))));
      return { p, pos: 0, rate: 0, drowsy: 0, asleep: 0, moved: 0, finish: null, el, zz, info: '', botRate: [300, 450, 650][ctx.botLevel] + Math.random() * [400, 500, 250][ctx.botLevel], botWise: Math.min(0.99, Math.random() + [-0.15, 0, 0.3][ctx.botLevel]) };
    });
    const by = new Map(snails.map((s) => [s.p.id, s]));
    ctx.show(h('div.snail-stage', h('div.snail-top', gardener, banner), lanes));
    ctx.all({ type: 'rub', key: ctx.key('rub') });

    let clock = -3, look = 0 /* >0 while the gardener is watching */, nextLook = 6 + Math.random() * 3, warned = false, finished = 0;
    ctx.onInput((p, d) => {
      const s = by.get(p.id); if (!s || clock < 0 || s.finish != null) return;
      if (typeof d.rub === 'number') { s.rate = Math.max(s.rate, d.rub * 10); s.moved = 0.25; }   // phones report every 100 ms
      if (d.shake > 14) s.drowsy += 0.35;
    });

    await new Promise<void>((resolve) => {
      const stop = ctx.frame((dt) => {
        clock += dt;
        if (clock < 0) { banner.textContent = `Rub your screen in ${Math.ceil(-clock)}…`; return; }
        // The gardener: a warning, then a stare. Anything still moving gets flicked back.
        nextLook -= dt;
        if (look > 0) { look -= dt; if (look <= 0) { gardener.classList.remove('looking'); nextLook = 5 + Math.random() * 5; warned = false; } }
        else if (nextLook < 1.2 && !warned) { warned = true; gardener.classList.add('warning'); }
        else if (nextLook <= 0) { look = 2; gardener.classList.remove('warning'); gardener.classList.add('looking'); }
        banner.textContent = look > 0 ? '👀 FREEZE! The gardener is watching!' : warned ? '🚨 The gardener is turning around…' : 'Rub! Smooth and steady.';

        for (const s of snails) {
          if (s.finish != null) continue;
          if (s.p.bot || !s.p.connected) {   // bots: some rub too hard, some ignore the gardener
            const wants = look > 0 ? s.botWise < 0.25 : !(warned && s.botWise > 0.6);
            s.rate = wants ? s.botRate * (s.botWise < 0.3 ? 2.1 : 1) : 0;
            s.moved = wants ? 0.25 : 0;
          }
          s.moved -= dt;
          if (s.asleep > 0) { s.asleep -= dt; s.rate = 0; if (s.asleep <= 0) s.drowsy = 0; }
          else {
            if (s.rate > FRANTIC) s.drowsy += dt * 0.8;
            else s.drowsy = Math.max(0, s.drowsy - dt * 0.25);
            if (s.drowsy >= 1) { s.asleep = 2.5; }
            s.pos += (Math.min(s.rate, CAP) / CAP) * dt * 0.052 * (1 - s.drowsy * 0.5);
            if (look > 0 && look < 1.7 && s.moved > 0 && s.rate > 60) { s.pos = Math.max(0, s.pos - 0.1); s.asleep = 1.2; ctx.comment('crash', s.p); s.el.classList.add('flicked'); setTimeout(() => s.el.classList.remove('flicked'), 600); }
          }
          s.rate *= Math.pow(0.02, dt);   // no fresh rubbing: glide to a stop
          if (s.pos >= 1) { s.pos = 1; s.finish = clock; finished++; if (finished === 1) ctx.timer(12); }
          s.el.style.left = `${s.pos * 100}%`;
          s.el.classList.toggle('asleep', s.asleep > 0);
          s.zz.textContent = s.asleep > 0 ? '💤' : s.drowsy > 0.45 ? '🥱' : '';
          const info = s.finish != null ? '🏁 Finished!' : s.asleep > 0 ? '💤 Asleep! Wait…' : look > 0 ? '🚨 FREEZE!' : s.drowsy > 0.45 ? '🥱 Too frantic! Slow down.' : 'Rub here to crawl';
          if (info !== s.info) { s.info = info; ctx.live(s.p, { info, big: s.asleep > 0 ? '😴' : '🐌' }); }
        }
        ctx.standings([...snails].sort((a, b) => b.pos - a.pos).map((s) => s.p));
        const first = snails.find((s) => s.finish != null)?.finish;
        if (finished === snails.length || (first != null && clock > first + 12) || clock > 75) { stop(); resolve(); }
      });
    });
    const order = [...snails].sort((a, b) => (a.finish ?? 1e9) - (b.finish ?? 1e9) || b.pos - a.pos);
    banner.textContent = `${order[0].p.avatar} ${order[0].p.name} wins by a slime!`;
    ctx.wait(ctx.players, 'Race over!', '', '🏁');
    await ctx.sleep(3.5);
    return { scores: order.map((s, i) => ({ id: s.p.id, score: order.length - i, label: s.finish != null ? `${s.finish.toFixed(1)}s` : `${Math.round(clamp(s.pos, 0, 1) * 100)}% of the way` })) };
  },
};
