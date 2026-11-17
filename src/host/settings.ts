// Things the host can change from the pause menu. Saved on this computer.
export type Channel = 'master' | 'music' | 'narration' | 'game';
export const CHANNELS: [Channel, string][] = [['master', 'Master volume'], ['music', 'Music'], ['narration', 'Narration'], ['game', 'Game sounds']];
export const THEMES: [string, string][] = [['carnival', 'Retro Carnival']];

export interface Settings {
  theme: string; volume: Record<Channel, number>;
  /** Soft shadows in the park (Regular start). Off is lighter on the computer. */
  shadows: boolean;
  /** How much the mascot talks during games: 0 never, 1 now and then, 2 a lot. */
  chatter: 0 | 1 | 2;
  /** Sound off, without losing the volume levels. */
  muted: boolean;
}
export const settings: Settings = { theme: 'carnival', volume: { master: 80, music: 70, narration: 100, game: 80 }, shadows: true, chatter: 1, muted: false };

try {
  const saved = JSON.parse(localStorage.getItem('pgb-settings') || '{}');
  if (THEMES.some(([id]) => id === saved.theme)) settings.theme = saved.theme;
  for (const [c] of CHANNELS) if (Number.isFinite(saved.volume?.[c])) settings.volume[c] = Math.max(0, Math.min(100, saved.volume[c]));
  if (typeof saved.shadows === 'boolean') settings.shadows = saved.shadows;
  if ([0, 1, 2].includes(saved.chatter)) settings.chatter = saved.chatter;
  if (typeof saved.muted === 'boolean') settings.muted = saved.muted;
} catch { /* storage blocked or empty */ }

export function saveSettings() {
  try { localStorage.setItem('pgb-settings', JSON.stringify(settings)); } catch { /* storage blocked */ }
}

/** How loud a channel should play, 0..1, with the master volume applied. For the sound system to use once there is one. */
export const gain = (c: Exclude<Channel, 'master'>) => (settings.volume.master / 100) * (settings.volume[c] / 100);

export const isFullscreen = () => !!document.fullscreenElement;
export async function setFullscreen(on: boolean) {
  try {
    if (on && !isFullscreen()) {
      await document.documentElement.requestFullscreen();
      // Without this the browser keeps Esc for itself (to leave full screen) and the pause menu never sees it.
      await (navigator as any).keyboard?.lock?.(['Escape']);
    } else if (!on && isFullscreen()) await document.exitFullscreen();
  } catch { /* the browser said no */ }
}
