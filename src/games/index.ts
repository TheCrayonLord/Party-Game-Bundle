import type { GameDef } from '../host/ctx';
import { tiltkart } from './tiltkart';
import { snail } from './snail';
import { fib } from './fib';
import { punchline } from './punchline';

export const GAMES: GameDef[] = [tiltkart, snail, fib, punchline];
