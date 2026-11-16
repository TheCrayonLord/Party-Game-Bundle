// The pause menu (Esc on the host computer) and its settings page.
import { h } from '../core/util';
import { isPaused, setPaused } from './clock';
import { MAX_PLAYERS, type Player, type Room } from './room';
import { CHANNELS, THEMES, isFullscreen, saveSettings, setFullscreen, settings } from './settings';

export const BOT_LEVELS = ['Easy', 'Normal', 'Hard'] as const;

export interface PauseHooks {
  /** False while there is nothing to pause (start screen, closing ceremony). */
  available(): boolean;
  /** True while a ride is running or showing its results, so "leave this ride" makes sense. */
  onRide(): boolean;
  leaveRide(): void;
  endGame(): void;
  desktop(): void;
  menu(): 'park' | 'list';
  setMenu(m: 'park' | 'list'): void;
  /** Bots can only be added or removed between rides. */
  canEditGuests(): boolean;
  /** Called after a bot's skill changes, so the lobby can redraw. */
  botsChanged(): void;
}

export function initPause(room: Room, hooks: PauseHooks) {
  const box = h('div.pause-box');
  const overlay = h('div.pause', box);
  const button = h('button.pause-btn', { title: 'Pause (Esc)', onclick: () => open() }, '⏸');
  let page: 'main' | 'settings' = 'main';
  document.body.append(button);

  const open = () => {
    if (isPaused() || !hooks.available()) return;
    setPaused(true); room.setPaused(true);
    page = 'main'; draw();
    document.body.append(overlay);
  };
  const close = () => {
    if (!isPaused()) return;
    overlay.remove();
    setPaused(false); room.setPaused(false);
  };
  const then = (fn: () => void) => () => { close(); fn(); };

  const draw = () => (page === 'main' ? drawMain() : drawSettings());

  const drawMain = () => {
    box.replaceChildren(...[
      h('h1.pause-title', '⏸ Paused'),
      h('button.btn.pause-opt', { onclick: close, 'data-pause': 'resume' }, '▶ Resume game'),
      h('button.btn.pause-opt', { onclick: () => { page = 'settings'; draw(); }, 'data-pause': 'settings' }, '⚙ Settings'),
      h('button.btn.pause-opt', { onclick: then(hooks.endGame), 'data-pause': 'end' }, '🏆 End game'),
      h('button.btn.pause-opt', { onclick: then(hooks.desktop), 'data-pause': 'desktop' }, '🚪 Return to desktop'),
      hooks.onRide() ? h('button.pause-link', { onclick: then(hooks.leaveRide), 'data-pause': 'leave' }, 'Leave this ride and go back to the park') : null,
      h('p.pause-hint', 'End game closes the park for the night: the overall podium, the grand prize and the credits.'),
    ].filter(Boolean) as HTMLElement[]);
  };

  const seg = (options: [string, boolean, () => void][]) => h('div.seg', ...options.map(([label, on, pick]) => h('button' + (on ? '.on' : ''), { onclick: () => { pick(); draw(); } }, label)));
  const row = (label: string, control: Node) => h('div.set-row', h('span.set-label', label), control);

  const drawSettings = () => {
    const sliders = CHANNELS.map(([id, label]) => {
      const out = h('span.set-val', `${settings.volume[id]}%`);
      const input = h<'input'>('input', { type: 'range', min: '0', max: '100', step: '5', value: String(settings.volume[id]), 'data-vol': id,
        oninput: () => { settings.volume[id] = Number(input.value); out.textContent = `${input.value}%`; saveSettings(); } });
      return row(label, h('span.set-slider', input, out));
    });
    const theme = h<'select'>('select', { onchange: () => { settings.theme = theme.value; saveSettings(); } }, ...THEMES.map(([id, name]) => h('option', { value: id, selected: id === settings.theme }, name)));
    const bots = room.players.filter((p) => p.bot), edit = hooks.canEditGuests();
    const botRow = (p: Player) => h('div.set-row.bot', { 'data-bot': p.name },
      h('span.badge', { style: { background: p.color } }, `${p.avatar} ${p.name}`),
      seg(BOT_LEVELS.map((name, i) => [name, p.level === i, () => { p.level = i as 0 | 1 | 2; hooks.botsChanged(); }])),
      edit ? h('button.set-x', { title: 'Remove this bot', onclick: () => { room.remove(p); draw(); } }, '✕') : null);

    box.replaceChildren(
      h('h1.pause-title', '⚙ Settings'),
      h('div.set-scroll',
        h('h3', 'Display'),
        row('Full screen', seg([['On', isFullscreen(), () => setFullscreen(true).then(draw)], ['Off', !isFullscreen(), () => setFullscreen(false).then(draw)]])),
        row('Theme', theme),
        row('Menu', seg([['🎡 Regular', hooks.menu() === 'park', () => hooks.setMenu('park')], ['📋 Performance', hooks.menu() === 'list', () => hooks.setMenu('list')]])),
        h('p.set-note', 'Regular is the walk-around park. Performance is a plain list of games, for slower computers.'),
        h('h3', 'Audio'),
        ...sliders,
        h('p.set-note', 'The park has no sound yet. These levels are saved and will apply once it does.'),
        h('h3', `Bots (${bots.length})`),
        ...bots.map(botRow),
        bots.length ? null : h('p.set-note', 'No bots in the park.'),
        edit ? h('button.btn.small', { disabled: room.players.length >= MAX_PLAYERS, onclick: () => { room.addBot(); draw(); } }, '+ Add a bot') : h('p.set-note', 'Bots can be added or removed between rides. A new skill level applies from the next ride.'),
      ),
      h('button.btn.pause-opt', { onclick: () => { page = 'main'; draw(); }, 'data-pause': 'back' }, '← Back'),
    );
  };

  addEventListener('keydown', (e) => {
    if (e.code !== 'Escape') return;
    if (!isPaused()) open();
    else if (page === 'settings') { page = 'main'; draw(); }
    else close();
  });
  document.addEventListener('fullscreenchange', () => { if (isPaused() && page === 'settings') draw(); });
  return { open, close };
}
