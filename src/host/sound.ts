// The host's sound: looping music, recorded stings (fanfare, applause…), small synthesised game sounds
// and the mascot's babble. Each kind has its own volume in Settings.
import { settings } from './settings';

export type Track = 'waltz' | 'march' | 'dusk';
export type Sting = 'fanfare' | 'applause' | 'aww' | 'drumroll' | 'ding';
export type Sfx = 'tick' | 'pop' | 'thud' | 'whoosh' | 'boom' | 'go' | 'count';

let ac: AudioContext | null = null;
let master: GainNode, musicBus: GainNode, gameBus: GainNode, voiceBus: GainNode;
const buffers = new Map<string, Promise<AudioBuffer | null>>();
let playing: { track: Track; gain: GainNode; src: AudioBufferSourceNode | null } | null = null;
let wanted: Track | null = null;

function ctx(): AudioContext | null {
  if (ac) return ac;
  const AC: typeof AudioContext | undefined = window.AudioContext || (window as any).webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    master = ac.createGain(); master.connect(ac.destination);
    musicBus = ac.createGain(); gameBus = ac.createGain(); voiceBus = ac.createGain();
    for (const b of [musicBus, gameBus, voiceBus]) b.connect(master);
    applyVolumes();
  } catch { ac = null; }
  return ac;
}

/** Browsers only allow sound after a click or key press; this wakes the audio up on the first one. */
export function unlockSound() {
  const wake = () => { const a = ctx(); if (a && a.state === 'suspended') a.resume().catch(() => {}); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
}

/** Re-reads the volume sliders. */
export function applyVolumes() {
  if (!ac) return;
  const v = settings.volume, t = ac.currentTime;
  master.gain.setTargetAtTime(v.master / 100, t, 0.03);
  musicBus.gain.setTargetAtTime((v.music / 100) * 0.55, t, 0.03);      // music sits under everything else
  gameBus.gain.setTargetAtTime(v.game / 100, t, 0.03);
  voiceBus.gain.setTargetAtTime(v.narration / 100, t, 0.03);
}

function load(name: string): Promise<AudioBuffer | null> {
  let p = buffers.get(name);
  if (!p) {
    const a = ctx();
    p = !a ? Promise.resolve(null) : fetch(new URL(`audio/${name}.mp3`, location.href)).then((r) => r.arrayBuffer()).then((d) => a.decodeAudioData(d)).catch(() => null);
    buffers.set(name, p);
  }
  return p;
}

/** Switches the background music, fading between tracks. `null` fades it out. */
export function music(track: Track | null) {
  wanted = track;
  const a = ctx(); if (!a) return;
  if (playing && playing.track === track) return;
  if (playing) {
    const old = playing; playing = null;
    old.gain.gain.setTargetAtTime(0, a.currentTime, 0.4);
    setTimeout(() => { try { old.src?.stop(); } catch { /* never started */ } old.gain.disconnect(); }, 2500);
  }
  if (!track) return;
  const gain = a.createGain(); gain.gain.value = 0; gain.connect(musicBus);
  const mine = (playing = { track, gain, src: null as AudioBufferSourceNode | null });
  load(track).then((buf) => {
    if (!buf || playing !== mine || wanted !== track) return;
    const src = a.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start();
    mine.src = src;
    gain.gain.setTargetAtTime(1, a.currentTime, 0.6);
  });
}

/** Turns the music down for a moment (under a drum roll, say) or back up. */
export function duck(on: boolean) {
  if (ac && playing) playing.gain.gain.setTargetAtTime(on ? 0.25 : 1, ac.currentTime, 0.2);
}

/** Plays a recorded sting. Resolves when it has finished (straight away if sound is unavailable). */
export function sting(name: Sting, volume = 1): Promise<void> {
  const a = ctx(); if (!a) return Promise.resolve();
  return load(name).then((buf) => new Promise<void>((resolve) => {
    if (!buf || a.state !== 'running') return resolve();
    const g = a.createGain(); g.gain.value = volume; g.connect(gameBus);
    const src = a.createBufferSource(); src.buffer = buf; src.connect(g); src.onended = () => resolve(); src.start();
  }));
}
/** Fetches stings ahead of time so they play on the beat. */
export function preload(...names: Sting[]) { for (const n of names) load(n); }

function tone(bus: GainNode, type: OscillatorType, f0: number, f1: number, dur: number, vol: number, at = 0) {
  const a = ac!; const t = a.currentTime + at;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(bus: GainNode, dur: number, vol: number, freq: number, at = 0) {
  const a = ac!; const t = a.currentTime + at, n = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 2;
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(bus); src.start(t);
}

const last = new Map<string, number>();
/** A short synthesised game sound. The same sound is never stacked more often than every 60 ms. */
export function sfx(kind: Sfx) {
  const a = ctx(); if (!a || a.state !== 'running') return;
  const now = performance.now(); if (now - (last.get(kind) || 0) < 60) return; last.set(kind, now);
  switch (kind) {
    case 'tick': tone(gameBus, 'square', 1100, 900, 0.05, 0.08); break;
    case 'count': tone(gameBus, 'triangle', 520, 520, 0.18, 0.25); break;
    case 'go': tone(gameBus, 'triangle', 1040, 1040, 0.45, 0.3); break;
    case 'pop': tone(gameBus, 'sine', 420, 880, 0.09, 0.2); break;
    case 'thud': tone(gameBus, 'sine', 170, 45, 0.22, 0.5); noise(gameBus, 0.12, 0.25, 900); break;
    case 'whoosh': noise(gameBus, 0.35, 0.3, 2400); tone(gameBus, 'sine', 300, 900, 0.3, 0.06); break;
    case 'boom': tone(gameBus, 'sine', 120, 28, 0.7, 0.8); noise(gameBus, 0.6, 0.6, 700); break;
  }
}

/** The mascot "talking": a run of quick blips, a little different each time. */
export function babble(text: string) {
  const a = ctx(); if (!a || a.state !== 'running') return;
  const n = Math.min(14, Math.max(4, Math.round(text.length / 6)));
  let seed = text.length * 97 + (text.charCodeAt(0) || 1);
  for (let i = 0; i < n; i++) {
    seed = (seed * 16807) % 2147483647;
    const f = 300 + (seed % 9) * 45;
    tone(voiceBus, 'triangle', f, f * 1.12, 0.06, 0.14, i * 0.075);
  }
}
