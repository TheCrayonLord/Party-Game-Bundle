import type { GameDef } from '../host/ctx';
import { tiltkart } from './tiltkart';
import { snail } from './snail';
import { sketch } from './sketch';
import { fakeartist } from './fakeartist';
import { fib } from './fib';
import { punchline } from './punchline';
import { heist } from './heist';
import { dungeon } from './dungeon';

/** Every attraction in the park, in the order they appear on the menu. */
export const GAMES: GameDef[] = [tiltkart, snail, sketch, fakeartist, fib, punchline, heist, dungeon];
