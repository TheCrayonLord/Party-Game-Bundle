import type { GameDef } from '../host/ctx';
import { tiltkart } from './tiltkart';
import { regatta } from './regatta';
import { snail } from './snail';
import { sketch } from './sketch';
import { fakeartist } from './fakeartist';
import { drawracer } from './drawracer';
import { logolab } from './logolab';
import { fib } from './fib';
import { punchline } from './punchline';
import { heist } from './heist';
import { dungeon } from './dungeon';

/** Every attraction in the park, in the order they appear on the menu. */
export const GAMES: GameDef[] = [tiltkart, snail, regatta, sketch, fakeartist, drawracer, logolab, fib, punchline, heist, dungeon];
