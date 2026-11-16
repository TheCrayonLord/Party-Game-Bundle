// Things the host can change from the pause menu. Saved on this computer.
export type Channel = 'master' | 'music' | 'narration' | 'game';
export const CHANNELS: [Channel, string][] = [['master', 'Master volume'], ['music', 'Music'], ['narration', 'Narration'], ['game', 'Game sounds']];
export const THEMES: [string, string][] = [['carnival', 'Retro Carnival']];

export interface Settings { theme: string; volume: Record<Channel, number> }
export const settings: Settings = { theme: 'carnival', volume: { master: 80, music: 70, narration: 100, game: 80 } };

try {
  const saved = JSON.parse(localStorage.getItem('pgb-settings') || '{}');
  if (THEMES.some(([id]) => id === saved.theme)) settings.theme = saved.theme;
  for (const [c] of CHANNELS) if (Number.isFinite(saved.volume?.[c])) settings.volume[c] = Math.max(0, Math.min(100, saved.volume[c]));
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
