import type { GameDef } from '../host/ctx';
import { tiltkart } from './tiltkart';
import { snail } from './snail';
import { sketch } from './sketch';
import { fakeartist } from './fakeartist';
import { fib } from './fib';
import { punchline } from './punchline';

export const GAMES: GameDef[] = [tiltkart, snail, sketch, fakeartist, fib, punchline];
