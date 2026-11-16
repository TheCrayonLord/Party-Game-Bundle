import type { GameDef } from '../host/ctx';
import { runRace } from './racing';

export const regatta: GameDef = {
  meta: { id: 'regatta', name: 'Riptide Regatta', emoji: '⛵', zone: 'Lagoon', blurb: 'Boats slide! Steer early, ride the waves, swipe up to boost.', min: 2, max: 12 },
  run: async (ctx) => ({ scores: await runRace(ctx, { kind: 'boat' }) }),
};
