import type { GameDef } from '../host/ctx';
import { runRace } from './racing';

export const regatta: GameDef = {
  meta: { id: 'regatta', name: 'Riptide Regatta', emoji: '⛵', zone: 'Lagoon', blurb: 'Boats slide! Steer early, ride the waves, swipe up to boost.', min: 2, max: 12,
    howTo: [
      "⛵ TILT to steer. Boats slide, so start your turn early.",
      "⬆ SWIPE UP on your phone to boost. It recharges.",
      "🌊 Hit a wave head-on for a burst of speed. Hit it sideways and you stall.",
      "🌀 Whirlpools spin you round. Arrows are currents. Stay between the red and green buoys.",
    ] },
  run: async (ctx) => ({ scores: await runRace(ctx, { kind: 'boat' }) }),
};
