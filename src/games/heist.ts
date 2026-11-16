import type { Option } from '../core/types';
import { SPEED, h, pick, rand, shuffle } from '../core/util';
import { badge, type Ctx, type GameDef } from '../host/ctx';
import type { Player } from '../host/room';

/** One lock on the vault. The operator has the controls; everyone else holds a piece of the instructions. */
interface Puzzle {
  name: string; emoji: string; brief: string;
  operator: { lines: string[]; buttons?: Option[]; input?: { placeholder: string; maxLen: number } };
  clues: string[];
  /** Feeds in what the operator did; returns 'solved', 'wrong', or 'more' (keep going). */
  check(v: string): 'solved' | 'wrong' | 'more';
  solution: string[];   // the inputs a perfect operator would send (used by bots)
}

const COLORS = ['RED', 'BLUE', 'YELLOW', 'GREEN', 'WHITE', 'BLACK'];
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

function wires(): Puzzle {
  const w = shuffle(COLORS).slice(0, 4 + rand(2));
  const has = (c: string) => w.includes(c);
  // Rules are checked in order; the first that applies wins. The last always applies.
  const pool: { text: string; when: boolean; cut: number }[] = shuffle([
    { text: 'If there is a RED wire and no WHITE wire, cut the LAST wire.', when: has('RED') && !has('WHITE'), cut: w.length - 1 },
    { text: 'If there are exactly FIVE wires, cut the SECOND wire.', when: w.length === 5, cut: 1 },
    { text: 'If the BLACK wire comes somewhere before the YELLOW wire, cut the BLACK wire.', when: has('BLACK') && has('YELLOW') && w.indexOf('BLACK') < w.indexOf('YELLOW'), cut: w.indexOf('BLACK') },
    { text: 'If the last wire is GREEN or BLUE, cut the THIRD wire.', when: ['GREEN', 'BLUE'].includes(w[w.length - 1]), cut: 2 },
    { text: 'If there is no RED wire, cut the wire right after the first one.', when: !has('RED'), cut: 1 },
  ]).slice(0, 3);
  pool.push({ text: 'If none of the other rules apply, cut the FIRST wire.', when: true, cut: 0 });
  const answer = pool.find((r) => r.when)!.cut;
  return {
    name: 'The Wire Box', emoji: '✂️', brief: 'One wire opens the lock. The others set off the alarm.',
    operator: { lines: [`You see ${w.length} wires, in this order from left to right:`, w.join(' · '), 'Describe them to your crew. They have the rules. Cut only when you’re sure.'], buttons: w.map((c, i) => ({ id: String(i), label: `✂️ Cut the ${c} wire (${ORD[i]})` })) },
    clues: pool.map((r, i) => `Rule ${i + 1} of ${pool.length} (follow the rules in order; use the first one that fits): ${r.text}`),
    check: (v) => (Number(v) === answer ? 'solved' : 'wrong'),
    solution: [String(answer)],
  };
}

function keypad(): Puzzle {
  const d = Array.from({ length: 4 }, () => 1 + rand(8));
  const clue = (i: number): string => {
    const v = d[i];
    const forms = [
      `Digit ${i + 1} is ${v + 3} minus 3.`,
      `Digit ${i + 1} is ${v * 2} cut in half.`,
      i > 0 ? `Digit ${i + 1} is digit ${i} ${v >= d[i - 1] ? `plus ${v - d[i - 1]}` : `minus ${d[i - 1] - v}`}.` : `Digit 1 is ${v % 2 ? 'odd' : 'even'}, and it’s ${v > 4 ? `${9 - v} less than 9` : `${v - 1} more than 1`}.`,
    ];
    return pick(forms);
  };
  const code = d.join('');
  return {
    name: 'The Keypad', emoji: '🔢', brief: 'Four digits. Each of you knows something about one of them.',
    operator: { lines: ['A keypad with four digits.', 'Your crew each know part of the code. Ask them, then type all four digits.'], input: { placeholder: '4 digits', maxLen: 4 } },
    clues: d.map((_, i) => clue(i)),
    check: (v) => (v.replace(/\D/g, '') === code ? 'solved' : 'wrong'),
    solution: [code],
  };
}

function symbols(): Puzzle {
  const set = shuffle(['★', '☂', '♞', '☾', '♫', '✿', '⚓', '☀']).slice(0, 5);
  const order = shuffle(set);
  let at = 0;
  return {
    name: 'The Symbol Dials', emoji: '🔣', brief: 'Press the symbols in the right order. One slip and it resets.',
    operator: { lines: ['Five buttons, each with a symbol.', 'Your crew know the order. Press them one at a time.'], buttons: set.map((s) => ({ id: s, label: s })) },
    clues: order.map((s, i) => `The ${ORD[i]} symbol to press is ${s}.`),
    check: (v) => { if (v !== order[at]) { at = 0; return 'wrong'; } return ++at === order.length ? 'solved' : 'more'; },
    solution: order,
  };
}

function doors(): Puzzle {
  const names = shuffle(['RED', 'BLUE', 'GREEN', 'GOLD', 'PURPLE']);
  const safe = names[0], rest = shuffle(names.slice(1));
  return {
    name: 'The Guard Rota', emoji: '🚪', brief: 'Five doors. Guards behind four of them.',
    operator: { lines: ['Five doors. Only one has no guard behind it.', 'Your crew have the guard rota. Pick a door.'], buttons: shuffle(names).map((n) => ({ id: n, label: `🚪 Open the ${n} door` })) },
    clues: rest.map((n, i) => [`There is a guard asleep behind the ${n} door.`, `Two guards are playing cards behind the ${n} door.`, `Don’t open the ${n} door. Just don’t.`, `The ${n} door leads straight to the security office.`][i]),
    check: (v) => (v === safe ? 'solved' : 'wrong'),
    solution: [safe],
  };
}

export const heist: GameDef = {
  meta: { id: 'heist', name: 'Heist Crew', emoji: '💰', zone: 'Haunted Manor', blurb: 'Work together. Everyone holds a different piece of the plan. TALK!', min: 2, max: 12 },
  async run(ctx: Ctx) {
    const P = shuffle(ctx.players);
    const puzzles = shuffle([wires, keypad, symbols, doors]).map((f) => f());
    const total = 240;
    let left = total, strikes = 0, cleared = 0;
    const timeEl = h('div.heist-time'), strikeEl = h('div.heist-strikes'), main = h('div.col.heist-main');
    const locks = h('div.heist-locks', ...puzzles.map((p) => h('span.heist-lock', p.emoji)));
    ctx.show(h('div.heist-stage', h('div.heist-top', locks, timeEl, strikeEl), main));
    const hud = () => { timeEl.textContent = `⏱ ${Math.floor(left / 60)}:${String(Math.max(0, Math.ceil(left)) % 60).padStart(2, '0')}`; strikeEl.textContent = strikes > 5 ? `🚨 × ${strikes}` : '🚨'.repeat(strikes); timeEl.classList.toggle('low', left < 30); };

    let ticking = false;
    ctx.frame((dt) => { if (ticking) { left -= dt * SPEED; hud(); } });
    hud();

    for (const [pi, puz] of puzzles.entries()) {
      const op: Player = P[pi % P.length], crew = P.filter((p) => p !== op);
      main.replaceChildren(h('div.heist-emoji', puz.emoji), h('h1.big', `Lock ${pi + 1}: ${puz.name}`), h('p.sub', puz.brief), h('p.sub', badge(op), ' is at the controls. Everyone else: read out your clues!'));
      const id = ctx.key('heist');
      ctx.view(op, { type: 'info', key: id, id, title: `${puz.emoji} You’re at the controls`, ...puz.operator });
      // Deal the clues round the crew; with a small crew some people hold several.
      const hands = new Map(crew.map((p) => [p.id, [] as string[]]));
      shuffle(puz.clues).forEach((c, i) => hands.get(crew[i % crew.length].id)!.push(c));
      for (const p of crew) {
        const mine = hands.get(p.id)!;
        ctx.view(p, { type: 'info', key: id + p.id, id: 'none', title: `${puz.emoji} ${puz.name}`, lines: mine.length ? ['Read this out loud. Only you can see it:', ...mine] : ['You have no clue this time. Keep everyone calm and watch the clock.'] });
      }
      ticking = true;
      const outcome = await new Promise<'solved' | 'timeout'>((resolve, reject) => {
        const attempt = (v: string) => {
          const r = puz.check(v);
          if (r === 'wrong') { strikes++; left -= 15; hud(); main.classList.add('shake'); setTimeout(() => main.classList.remove('shake'), 400); ctx.live(op, { status: '🚨 WRONG! −15 seconds' }); }
          else if (r === 'more') ctx.live(op, { status: '✅ Good, keep going…' });
          else { off(); stop(); resolve('solved'); }
        };
        const off = ctx.onInput((p, d) => { if (p === op && d?.id === id && typeof d.v === 'string') attempt(d.v); });
        const stop = ctx.frame(() => { if (left <= 0) { off(); stop(); resolve('timeout'); } });
        // A bot at the controls slowly gets it right, so mixed human/bot crews still work.
        if (op.bot) (async () => { for (const s of puz.solution) { await ctx.sleep(3 + Math.random() * 3); attempt(s); } })().catch(reject);
      });
      ticking = false;
      if (outcome === 'timeout') break;
      cleared++;
      locks.children[pi].classList.add('open');
      ctx.wait(P, 'CLICK!', 'Lock open.', '🔓');
      main.replaceChildren(h('div.heist-emoji', '🔓'), h('h1.big', 'CLICK! Lock open.'));
      await ctx.sleep(2.2);
    }

    const won = cleared === puzzles.length;
    main.replaceChildren(h('div.heist-emoji', won ? '💰' : '🚔'), h('h1.big', won ? 'The vault is open!' : 'Busted!'), h('p.sub', won ? `With ${Math.max(0, Math.ceil(left))} seconds to spare and ${strikes} alarm${strikes === 1 ? '' : 's'}.` : `You cracked ${cleared} of ${puzzles.length} locks.`));
    ctx.wait(P, won ? 'You’re rich!' : 'Busted!', '', won ? '💰' : '🚔');
    await ctx.sleep(4);
    const pts = cleared * 100 + (won ? Math.max(0, Math.ceil(left)) : 0);
    return { coop: true, headline: won ? '💰 Heist Crew: clean getaway' : '🚔 Heist Crew: busted', scores: P.map((p) => ({ id: p.id, score: won ? 1 : 0, label: `${pts} crew points`, tickets: won ? 90 : 20 + cleared * 10 })) };
  },
};
