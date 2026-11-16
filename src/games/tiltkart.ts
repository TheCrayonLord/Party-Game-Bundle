import type { GameDef } from '../host/ctx';
import { runRace } from './racing';

export const tiltkart: GameDef = {
  meta: { id: 'tiltkart', name: 'Tilt Kart', emoji: '🏎️', zone: 'Speedway', blurb: 'Tilt to steer. Tap for items. Three laps.', min: 2, max: 12,
    howTo: [
      "🏎️ Your kart drives itself. TILT your phone left and right to steer.",
      "📦 Drive through a gold box to grab an item, then tap the big button to use it.",
      "🚀 Boost · 🛢️ Oil spins whoever hits it · ⚡ Zap slows the kart ahead.",
      "🏁 Three laps. Stay on the track: the grass is slow.",
    ] },
  run: async (ctx) => ({ scores: await runRace(ctx, { kind: 'kart' }) }),
};
