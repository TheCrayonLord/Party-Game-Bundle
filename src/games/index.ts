import type { GameDef } from '../host/ctx';
import { tiltkart } from './tiltkart';
import { regatta } from './regatta';
import { skyslalom } from './skyslalom';
import { snail } from './snail';
import { sketch } from './sketch';
import { fakeartist } from './fakeartist';
import { ski } from './ski';
import { logolab } from './logolab';
import { fib } from './fib';
import { punchline } from './punchline';
import { hotpotato } from './hotpotato';
import { agent } from './agent';
import { heist } from './heist';
import { dungeon } from './dungeon';

/** Every attraction in the park, in the order they appear on the menu. */
export const GAMES: GameDef[] = [tiltkart, skyslalom, ski, snail, regatta, sketch, fakeartist, logolab, fib, punchline, hotpotato, agent, heist, dungeon];
