// The park's announcer. A different mascot hosts each session; add more by adding to MASCOTS.
import { quality } from '../core/models';
import { portrait } from '../core/mascots3d';
import { h, pick, qs } from '../core/util';

/** Things that happen during a game that the mascot may remark on. {name} is the player involved. */
export type Moment = 'lead' | 'last' | 'crash' | 'out';
/** Remarks for the results screen. {name} is the winner (or loser), {other} a rival, {n} a count. */
export type After = 'win' | 'streak' | 'loser' | 'rivalry' | 'teamWin' | 'teamLose';

export interface Mascot {
  id: string; name: string; emoji: string; tagline: string;
  lobby: string[];      // while guests arrive
  intro: string[];      // as a game starts
  results: string[];    // fallback line on the scoreboard
  during: Record<Moment, string[]>;
  after: Record<After, string[]>;
}

export const MASCOTS: Mascot[] = [
  {
    id: 'gus', name: 'Gus the Goldfish', emoji: '🐠', tagline: 'The prize nobody won. Since 1954.',
    lobby: ['Oh good. More people.', 'Scan the code. Or don’t. I’m a fish, not your boss.', 'I’ve been in this bowl since 1954. Take your time.', 'Nobody ever won me at ring toss. I’m not bitter. I’m wet.'],
    intro: ['Try not to embarrass yourselves.', 'I’d play too, but: fins.', 'I’ve watched people lose at this for seventy years. Go on.', 'Remember, it’s only a game. A game you will be judged on.'],
    results: ['Somebody won. Statistically, it had to happen.', 'Tickets for everyone. Even you.'],
    during: {
      lead: ['{name} leads. Enjoy it while it lasts.', '{name} is in front. I’m as surprised as you are.', 'Ah. {name}. Of course.'],
      last: ['{name} is in last. Somebody has to be.', 'I can swim faster than {name}, and I live in a bowl.', '{name} appears to be sightseeing.'],
      crash: ['{name}, that was on purpose, I assume.', 'Graceful, {name}. Like a dropped trifle.', 'I felt that from here, {name}.'],
      out: ['Goodbye, {name}. It was brief.', '{name} is out. The bowl remembers.', 'And that’s {name} done. Next.'],
    },
    after: {
      win: ['{name} won. I’ve seen worse. Not often.', 'Congratulations, {name}. Don’t let it change you. It will.', '{name} takes it. The rest of you were also present.'],
      streak: ['{name} again. That’s {n} in a row. Someone stop them.', '{n} wins running for {name}. This is getting embarrassing for the rest of you.'],
      loser: ['{name} came last. A fish noticed.', 'Chin up, {name}. Someone has to make the others look good.'],
      rivalry: ['{name} and {other} are neck and neck. I don’t have a neck. I still care.', 'Only a few tickets between {name} and {other}. Delicious.'],
      teamWin: ['You worked together. I didn’t think you had it in you.', 'A victory. I’ll alert the pond.'],
      teamLose: ['You lost as a team. That’s still teamwork.', 'Well. That happened.'],
    },
  },
  {
    id: 'sprocket', name: 'Sprocket the Strongman Bear', emoji: '🐻', tagline: 'Tin heart. Needs winding.',
    lobby: ['WELCOME, FRIENDS! Sprocket is so happy to seeee… youuu… *click*', 'Could somebody wind Sprocket? The key is in the back.', 'Sprocket can lift ONE WHOLE POPCORN. Scan the code to witness it.', 'More friends! Sprocket’s spring is tingling!'],
    intro: ['Sprocket believes in ALL of you! Equally! That is how tin hearts work.', 'Be STRONG! Be KIND! Be… *whirr*… quick about it.', 'Sprocket would play, but his arms only go up.', 'GO, FRIENDS, GO! Sprocket will watch and slowly run down.'],
    results: ['You were all STRONG today. Some stronger. But all strong.', 'Sprocket is so proud his rivets hurt.'],
    during: {
      lead: ['{name} is in FRONT! Sprocket’s spring is boinging!', 'LOOK at {name} go! So strong!', '{name} leads! Sprocket claps! *clank clank*'],
      last: ['{name} is last but Sprocket loves them the MOST right now.', 'Do not give up, {name}! Sprocket never… *click*… gives… up…', '{name}, last place is just first place facing the other way!'],
      crash: ['Oh no, {name}! Sprocket felt that in his rivets!', 'Up you get, {name}! Tin bears fall over all the time!', 'OUCH. Sprocket will lend {name} a bolt.'],
      out: ['{name} is out! Sprocket salutes you with both arms! They only go up!', 'Brave {name}! Gone but… *whirr*… not forgotten.', 'Bye bye, {name}! You were STRONG!'],
    },
    after: {
      win: ['{name} WON! Sprocket lifts them in his heart!', 'HOORAY for {name}! Strongest of the strong!', '{name} is the champion! Sprocket’s key is spinning!'],
      streak: ['{name} won {n} times in a ROW! Is {name} also made of tin?', '{n} in a row for {name}! Sprocket has run out of arms to raise!'],
      loser: ['{name} came last, and Sprocket is STILL proud.', 'Next time, {name}! Sprocket will wind you up himself!'],
      rivalry: ['{name} and {other} are SO close! Sprocket cannot choose! Do not make Sprocket choose!', 'Just a few tickets between {name} and {other}! Friendship! But also WAR!'],
      teamWin: ['TEAMWORK! The strongest muscle of all!', 'You did it TOGETHER! Sprocket is leaking oil from his eyes!'],
      teamLose: ['You lost, but you lost as FRIENDS.', 'Sprocket still believes in you! Wind up and try again!'],
    },
  },
  {
    id: 'kernel', name: 'Colonel Kernel', emoji: '🍿', tagline: 'Ringmaster. Popcorn. Legend, by his own account.',
    lobby: ['STEP RIGHT UP! The GREATEST show on this particular street!', 'Scan the ticket, friend, and behold WONDERS! Terms apply!', 'Ladies, gentlemen, and assorted others: WELCOME!', 'Never before, and frankly never again, such a line-up of guests!'],
    intro: ['PREPARE YOURSELVES for the most THRILLING contest in recorded history!', 'A spectacle so daring I had to sign a waiver!', 'They said it couldn’t be done! They were probably right! BEGIN!', 'Feast your eyes! Mind the butter!'],
    results: ['What a SHOW! Give yourselves a hand! No refunds!', 'History was MADE here tonight! Small history, but history!'],
    during: {
      lead: ['And {name} SURGES into the lead! SENSATIONAL!', 'It’s {name} out in front! The crowd goes MILD!', 'BEHOLD! {name}! Leading! With STYLE!'],
      last: ['And bringing up the rear with DIGNITY: {name}!', '{name} is saving it all for a DRAMATIC finish! Presumably!', 'In last place, but FIRST in our hearts: {name}!'],
      crash: ['A SPECTACULAR tumble from {name}! Ten out of ten!', 'OOOH! {name} does their own stunts!', 'What SHOWMANSHIP from {name}! Entirely unplanned!'],
      out: ['{name} takes their FINAL BOW! Magnificent!', 'And {name} EXITS, stage left! In pieces!', 'Farewell, {name}! The show must go on!'],
    },
    after: {
      win: ['Your CHAMPION, the incomparable, the UNSTOPPABLE: {name}!', 'A STANDING OVATION for {name}! I am already standing! I am a box!', '{name} wins! I always believed! Since just now!'],
      streak: ['{n} IN A ROW for {name}! A DYNASTY! An EMPIRE!', 'AGAIN it is {name}! {n} straight! Book them a parade!'],
      loser: ['And a WARM hand for {name}, who also took part!', '{name} finishes last! EVERY show needs a villain’s understudy!'],
      rivalry: ['{name} versus {other}! The RIVALRY of the CENTURY! Tickets nearly level!', 'Mere tickets separate {name} and {other}! I could sell seats to this!'],
      teamWin: ['TOGETHER they triumphed! I take full credit!', 'A VICTORY for the ages! Or at least the evening!'],
      teamLose: ['A GLORIOUS defeat! The best kind! Very cinematic!', 'They FAILED! Magnificently! Encore!'],
    },
  },
  {
    id: 'bulb', name: 'Madame Bulb', emoji: '💡', tagline: 'The brightest thing in the park, darling.',
    lobby: ['Darlings! You came. I simply glowed when I heard.', 'Scan the little ticket, sweetie. I’ll wait. I’m very well lit.', 'Do come in. Mind the cables, they’re vintage.', 'A full house? For me? You shouldn’t have. You should have. Continue.'],
    intro: ['Places, darlings! And do try to be interesting.', 'Lights up! That’s me. I’m the lights.', 'Break a leg. Not literally, the paperwork is ghastly.', 'Dazzle me. I dare you.'],
    results: ['Marvellous, darlings. Simply incandescent.', 'A performance! I’ve seen dimmer.'],
    during: {
      lead: ['{name}, darling, you’re positively glowing.', 'Oh, {name} is in front. How bright of them.', 'All eyes on {name}. Well. After me.'],
      last: ['{name}, sweetie, the race is this way.', 'Last place, {name}? Fashionably late. I respect it.', 'Somebody plug {name} in.'],
      crash: ['Oh, {name}. That was… a choice.', 'Darling {name}, we rehearsed this.', '*flickers* {name}, you startled me.'],
      out: ['Lights out for {name}, I’m afraid.', '{name} has left the stage. Tragic. Brief.', 'And {name} fades. We’ve all been there, darling.'],
    },
    after: {
      win: ['{name}, darling, a star is born. I’d know.', 'Bravo, {name}. Take the spotlight. Give it back afterwards.', '{name} wins. Finally, someone with wattage.'],
      streak: ['{name} again? {n} in a row. Careful, darling, that’s my spotlight.', '{n} straight for {name}. I haven’t seen a run like that since my own.'],
      loser: ['{name}, sweetie, not everyone can shine. Someone has to be the dark.', 'Last, {name}? Darling. We’ll workshop it.'],
      rivalry: ['{name} and {other}, practically tied. I do love a feud.', 'So little between {name} and {other}. The tension! I may flicker.'],
      teamWin: ['An ensemble triumph. I wept. Briefly. It’s bad for the filament.', 'You were all luminous. Together. How novel.'],
      teamLose: ['A flop, darlings. But a stylish one.', 'We don’t speak of this. We simply dim the lights.'],
    },
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

/** The mascot's face: a picture of the 3D model in Regular start, the emoji in Performance start. */
function face(): HTMLElement {
  const src = quality.detailed ? portrait(mascot.id) : '';
  return src ? h('img.mascot-face.model', { src, alt: mascot.name }) : h('div.mascot-face', mascot.emoji);
}

/** The mascot with a speech bubble. */
export function say(kind: 'lobby' | 'intro' | 'results', onclick?: () => void): HTMLElement {
  return h('div.mascot', { onclick, title: onclick ? 'Click to change mascot' : '' },
    face(), h('div.mascot-bubble', h('div.mascot-name', mascot.name), pick(mascot[kind])));
}

/** Fills a line template for the current mascot. */
export function line(lines: string[], vars: Record<string, string | number> = {}): string {
  return pick(lines).replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

/** The mascot saying something specific. */
export function bubble(text: string): HTMLElement {
  return h('div.mascot', face(), h('div.mascot-bubble', h('div.mascot-name', mascot.name), text));
}
