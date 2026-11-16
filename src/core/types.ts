/** A drawn line: colour, width and flat x,y pairs on a 0..1000 square. */
export interface Stroke { c: string; w: number; p: number[] }

export interface Option { id: string; label: string }

/**
 * What a phone should show. The host sends one of these to each phone; the phone
 * renders it with the shared controller kit, so most games need no phone code.
 * `key` identifies the screen: the phone only rebuilds when it changes.
 */
export type View = { key: string; live?: Record<string, string> } & (
  | { type: 'wait'; title: string; text?: string; emoji?: string }
  | { type: 'text'; id: string; prompt: string; sub?: string; placeholder?: string; maxLen?: number; button?: string; image?: Stroke[] }
  | { type: 'choice'; id: string; prompt: string; sub?: string; options: Option[] }
  | { type: 'draw'; id: string; prompt: string; sub?: string; color?: string; oneStroke?: boolean; base?: Stroke[] }
  | { type: 'info'; id: string; title: string; lines: string[]; buttons?: Option[]; input?: { placeholder: string; maxLen: number } }
  /** Tilt controller. `pitch` adds a second (forward/back) axis; `swipe` adds a swipe-up zone that sends {btn: id}. */
  | { type: 'tilt'; buttons?: Option[]; pitch?: boolean; swipe?: Option; /** Press-and-hold buttons: send {hold: id, on: true|false}. */ holds?: Option[] }
  /** Walk around the park: arrow buttons and a drag-anywhere joystick. Sends {move: [x, y]} with y pointing away from the camera. */
  | { type: 'walk' }
  /** The hot potato: flick left, right or up to throw it. Sends {flick}. */
  | { type: 'bomb'; title: string }
  | { type: 'rub' }
);

export type ToHost =
  | { t: 'hello'; token: string; name: string; avatar: string }
  | { t: 'in'; d: any };

export type ToPhone =
  | { t: 'welcome'; id: string; name: string; avatar: string; color: string; shape: string; vip: boolean; tickets: number }
  | { t: 'view'; v: View }
  | { t: 'live'; l: Record<string, string> }
  | { t: 'pause'; on: boolean }
  | { t: 'kicked' };

export const COLORS = ['#e4572e', '#f3a712', '#ffe14d', '#a8c256', '#3fa34d', '#2ab7a9', '#4cc9f0', '#4361ee', '#9b5de5', '#f15bb5', '#b08968', '#f8f4e3'];
export const SHAPES = ['●', '■', '▲', '◆', '★', '♥', '⬟', '✚', '☾', '⬢', '✿', '☂'];
export const AVATARS = ['🎈', '🎪', '🍿', '🎠', '🎡', '🍭', '🤡', '🎟️', '🦄', '🐘', '🍦', '🎯', '🦁', '🐒', '🌭', '🎩'];
