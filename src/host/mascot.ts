// The park's announcer. A different mascot hosts each session; add more by adding to MASCOTS.
import { h, pick, qs } from '../core/util';

export interface Mascot {
  id: string; name: string; emoji: string; tagline: string;
  lobby: string[];      // while guests arrive
  intro: string[];      // as a game starts
  results: string[];    // on the scoreboard
}

export const MASCOTS: Mascot[] = [
  {
    id: 'gus', name: 'Gus the Goldfish', emoji: '🐠', tagline: 'The prize nobody won. Since 1954.',
    lobby: ['Oh good. More people.', 'Scan the code. Or don’t. I’m a fish, not your boss.', 'I’ve been in this bowl since 1954. Take your time.', 'Nobody ever won me at ring toss. I’m not bitter. I’m wet.'],
    intro: ['Try not to embarrass yourselves.', 'I’d play too, but: fins.', 'I’ve watched people lose at this for seventy years. Go on.', 'Remember, it’s only a game. A game you will be judged on.'],
    results: ['Somebody won. Statistically, it had to happen.', 'I’ve seen better. I’ve also seen worse. The bowl is round; I see everything.', 'Tickets for everyone. Even you.', 'A performance I will forget in roughly three seconds.'],
  },
  {
    id: 'sprocket', name: 'Sprocket the Strongman Bear', emoji: '🐻', tagline: 'Tin heart. Needs winding.',
    lobby: ['WELCOME, FRIENDS! Sprocket is so happy to seeee… youuu… *click*', 'Could somebody wind Sprocket? The key is in the back.', 'Sprocket can lift ONE WHOLE POPCORN. Scan the code to witness it.', 'More friends! Sprocket’s spring is tingling!'],
    intro: ['Sprocket believes in ALL of you! Equally! That is how tin hearts work.', 'Be STRONG! Be KIND! Be… *whirr*… quick about it.', 'Sprocket would play, but his arms only go up.', 'GO, FRIENDS, GO! Sprocket will watch and slowly run down.'],
    results: ['You were all STRONG today. Some stronger. But all strong.', 'Sprocket is so proud his rivets hurt.', 'Tickets for everybody! Sprocket counted them twice. Different answers.', 'What a show! Sprocket needs… a little… wind… *click*'],
  },
];

/** Picks this session's mascot: the next one along from last time, or ?mascot=id to force one. */
function choose(): Mascot {
  const forced = MASCOTS.find((m) => m.id === qs.get('mascot'));
  if (forced) return forced;
  let last = -1;
  try { last = MASCOTS.findIndex((m) => m.id === localStorage.getItem('pgb-mascot')); } catch { /* storage blocked */ }
  const next = MASCOTS[(last + 1) % MASCOTS.length];
  try { localStorage.setItem('pgb-mascot', next.id); } catch { /* storage blocked */ }
  return next;
}

export let mascot = choose();

/** Swaps to the next mascot mid-session (clicking the mascot in the lobby does this). */
export function nextMascot() {
  mascot = MASCOTS[(MASCOTS.indexOf(mascot) + 1) % MASCOTS.length];
  try { localStorage.setItem('pgb-mascot', mascot.id); } catch { /* storage blocked */ }
}

/** The mascot with a speech bubble. */
export function say(kind: 'lobby' | 'intro' | 'results', onclick?: () => void): HTMLElement {
  return h('div.mascot', { onclick, title: onclick ? 'Click to change mascot' : '' },
    h('div.mascot-face', mascot.emoji), h('div.mascot-bubble', h('div.mascot-name', mascot.name), pick(mascot[kind])));
}
