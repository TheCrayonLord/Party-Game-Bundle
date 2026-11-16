import type { GameDef } from '../host/ctx';
import { runRace } from './racing';

export const tiltkart: GameDef = {
  meta: { id: 'tiltkart', name: 'Tilt Kart', emoji: '🏎️', zone: 'Speedway', blurb: 'Tilt to steer. Tap for items. Three laps.', min: 2, max: 12 },
  run: async (ctx) => ({ scores: await runRace(ctx, { kind: 'kart' }) }),
};
