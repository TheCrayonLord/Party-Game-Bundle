"""Synthesises the fairground-organ style samples in audio-samples/.
Original tunes, generated from scratch. Run: python3 tools/make_audio_samples.py"""
import numpy as np, wave, subprocess, os
SR = 44100
rng = np.random.default_rng(7)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def env(n, a, r):
    e = np.ones(n)
    a = min(int(a * SR), n // 2); r = min(int(r * SR), n // 2)
    if a: e[:a] = np.linspace(0, 1, a)
    if r: e[-r:] *= np.linspace(1, 0, r)
    return e

def pipe(m, dur, harm=(1, .55, .32, .16, .1, .05), vib=.004, detune=6, chiff=.25):
    n = int(dur * SR); t = np.arange(n) / SR
    f = hz(m) * 2 ** (rng.uniform(-detune, detune) / 1200)
    ph = 2 * np.pi * f * t + vib * f / 5.5 * np.sin(2 * np.pi * 5.5 * t) * 2 * np.pi / (2*np.pi)
    y = sum(a * np.sin((i + 1) * ph) for i, a in enumerate(harm))
    c = rng.normal(0, 1, n) * np.exp(-t / .018) * chiff      # breathy onset
    return (y + c) * env(n, .012, .05)

def bell(m, dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    y = np.sin(2*np.pi*f*t) + .45*np.sin(2*np.pi*2.76*f*t)*np.exp(-t/.15) + .2*np.sin(2*np.pi*5.4*f*t)*np.exp(-t/.06)
    return y * np.exp(-t / (dur * .28)) * env(n, .002, .02)

def snare(dur=.09):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n); x = x - np.concatenate([[0], x[:-1]]) * .6
    return x * np.exp(-t / .03)

def kick(dur=.18):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 45 + 60 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07)

class Mix:
    def __init__(self, secs): self.b = np.zeros(int(secs * SR) + SR * 3)
    def add(self, y, at, g=1.0):
        i = int(at * SR); self.b[i:i + len(y)] += y * g
    def render(self, name, secs, lp=.45, wow=True):
        y = self.b[: int((secs + 2.0) * SR)]
        # small room: a few comb echoes
        out = y.copy()
        for d, g in ((.031, .28), (.047, .22), (.071, .16), (.113, .1)):
            k = int(d * SR); out[k:] += y[:-k] * g
        # worn-tape wobble + soft saturation + gentle low-pass for a vintage feel
        if wow:
            t = np.arange(len(out)); idx = t + 18 * np.sin(2 * np.pi * .6 * t / SR)
            out = np.interp(idx, t, out)
        z = np.zeros_like(out); a = 0.0
        for i in range(len(out)):
            a += lp * (out[i] - a); z[i] = a
        out = np.tanh(z / (np.max(np.abs(z)) + 1e-9) * 1.6)
        out *= .9 / np.max(np.abs(out))
        fade = int(1.5 * SR); out[-fade:] *= np.linspace(1, 0, fade)
        wav = f"audio-samples/{name}.wav"
        with wave.open(wav, "wb") as w:
            w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
            w.writeframes((out * 32767).astype(np.int16).tobytes())
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", "128k", f"audio-samples/{name}.mp3"], check=True)
        os.remove(wav)

CH = {"C": (48, [60, 64, 67]), "C7": (48, [58, 64, 67]), "G7": (43, [59, 62, 65]), "F": (41, [60, 65, 69]),
      "Bb": (46, [58, 62, 65]), "Am": (45, [57, 60, 64]), "G": (43, [59, 62, 67]), "Dm": (50, [57, 62, 65])}

def melody(mx, notes, t0, beat, voice, g, gate=.9):
    t = t0
    for m, d in notes:
        if m is not None: mx.add(voice(m, d * beat * gate), t, g)
        t += d * beat
    return t

# ---------- 1. Midway Waltz: classic calliope waltz ----------
def waltz():
    bpm = 184; beat = 60 / bpm
    chords = "C C G7 G7 G7 G7 C C C C7 F F C G7 C C".split()
    mel = [(76,1),(79,1),(84,1),(84,2),(79,1),(77,1),(79,1),(83,1),(86,2),(79,1),
           (74,1),(77,1),(83,1),(83,2),(81,1),(79,1),(76,1),(79,1),(84,3),
           (76,1),(79,1),(84,1),(82,2),(79,1),(81,1),(84,1),(89,1),(86,2),(84,1),
           (84,1),(79,1),(76,1),(77,1),(74,1),(71,1),(72,1),(76,1),(79,1),(84,3)]
    total = 2 * len(chords) * 3 * beat; mx = Mix(total)
    for rep in range(2):
        t0 = rep * len(chords) * 3 * beat
        for i, c in enumerate(chords):
            root, tri = CH[c]; t = t0 + i * 3 * beat
            mx.add(pipe(root + (7 if i % 2 and c in ("C", "F") else 0) - 0, beat * .8, harm=(1, .7, .2, .1), chiff=.1), t, .5)
            mx.add(kick(), t, .5)
            for b in (1, 2):
                for n in tri: mx.add(pipe(n, beat * .45, chiff=.15), t + b * beat, .12)
                mx.add(snare(.05), t + b * beat, .08)
        melody(mx, mel, t0, beat, lambda m, d: pipe(m, d, detune=10), .3)
        if rep == 1:  # second time round: bells double the tune an octave up
            melody(mx, mel, t0, beat, lambda m, d: bell(m + 12), .22)
    mx.render("1-midway-waltz", total)

# ---------- 2. Ticket Booth March: bouncy band-organ oom-pah ----------
def march():
    bpm = 132; beat = 60 / bpm
    chords = "F F C7 F Bb F C7 F".split()
    CHF = {"F": (41, [60, 65, 69]), "C7": (48, [58, 64, 67]), "Bb": (46, [58, 62, 65])}
    e, q, h = .5, 1, 2
    mel = [(72,e),(77,e),(81,e),(77,e),(84,e),(81,e),(77,e),(81,e),
           (84,q),(86,e),(84,e),(81,q),(77,q),
           (76,e),(79,e),(82,e),(79,e),(84,e),(82,e),(79,e),(76,e),
           (77,q),(81,q),(84,h),
           (82,e),(86,e),(89,e),(86,e),(91,e),(89,e),(86,e),(82,e),
           (84,q),(81,e),(84,e),(89,q),(84,q),
           (82,e),(79,e),(76,e),(79,e),(82,e),(84,e),(86,e),(88,e),
           (89,q),(84,q),(77,h)]
    total = 2 * len(chords) * 4 * beat; mx = Mix(total)
    for rep in range(2):
        t0 = rep * len(chords) * 4 * beat
        for i, c in enumerate(chords):
            root, tri = CHF[c]; t = t0 + i * 4 * beat
            for b in range(4):
                if b % 2 == 0:
                    mx.add(pipe(root + (7 if b == 2 else 0), beat * .7, harm=(1, .8, .3, .15), chiff=.1), t + b * beat, .5)
                    mx.add(kick(), t + b * beat, .6)
                else:
                    for n in tri: mx.add(pipe(n, beat * .35, chiff=.2), t + b * beat, .13)
                    mx.add(snare(), t + b * beat, .16)
            if i % 4 == 3:  # little drum fill
                for k in range(4): mx.add(snare(.05), t + (3 + k * .25) * beat, .12)
        melody(mx, mel, t0, beat, lambda m, d: pipe(m, d, harm=(1, .6, .45, .25, .15, .1), detune=8), .28, gate=.8)
        if rep == 1:
            melody(mx, mel, t0, beat, lambda m, d: bell(m + 12, .6), .2)
            melody(mx, [(m - 9 if m else None, d) for m, d in mel], t0, beat, lambda m, d: pipe(m, d, vib=.006), .12, gate=.8)
    mx.render("2-ticket-booth-march", total)

# ---------- 3. Dusk Carousel: slow music box for the park at night ----------
def dusk():
    bpm = 96; beat = 60 / bpm
    chords = "Am F C G Am F G C".split()
    mel = [(76,2),(81,1),(81,2),(77,1),(79,2),(76,1),(74,3),(76,1),(81,1),(84,1),(81,2),(84,1),(83,2),(79,1),(84,3)]
    total = 2 * len(chords) * 3 * beat; mx = Mix(total)
    for rep in range(2):
        t0 = rep * len(chords) * 3 * beat
        for i, c in enumerate(chords):
            root, tri = CH[c]; t = t0 + i * 3 * beat
            for n in tri: mx.add(pipe(n, beat * 3, harm=(1, .25, .08), vib=.006, chiff=.03) * env(int(beat*3*SR), .25, .4), t, .1)
            mx.add(pipe(root, beat * 2.8, harm=(1, .4, .1), chiff=.03), t, .3)
            arp = [tri[0] + 12, tri[2] + 12, tri[0] + 24, tri[1] + 24, tri[0] + 24, tri[2] + 12]
            for k, n in enumerate(arp):
                if rep == 1 or k % 2 == 0: mx.add(bell(n, 1.6), t + k * beat / 2, .16)
        melody(mx, mel, t0, beat, lambda m, d: bell(m + 12, 2.2), .34)
        if rep == 1: melody(mx, mel, t0, beat, lambda m, d: pipe(m, d, harm=(1, .3, .1), vib=.007, chiff=.05), .16)
    mx.render("3-dusk-carousel", total, lp=.3)

# ---------- 4. Stings: short jingles for wins, joins and reveals ----------
def stings():
    mx = Mix(12); beat = .16
    t = melody(mx, [(72,1),(76,1),(79,1),(84,2),(79,1),(84,4)], .2, beat, lambda m, d: pipe(m, d), .3)      # fanfare
    for n in (48, 60, 64, 67): mx.add(pipe(n, beat * 4), .2 + 6 * beat, .12)
    t += 1.2
    t = melody(mx, [(84,1),(88,1),(91,1),(96,3)], t, .11, lambda m, d: bell(m, .9), .35) + 1.0               # ticket earned
    t = melody(mx, [(67,1),(66,1),(65,1),(64,4)], t, .22, lambda m, d: pipe(m, d, vib=.012, detune=25), .3)  # sad trombone-ish
    t += 1.2
    for k in range(12): mx.add(snare(.05), t + k * .07, .1 + k * .012)                                     # drum roll + hit
    t += 12 * .07
    for n in (48, 60, 64, 67, 72, 76): mx.add(pipe(n, 1.2), t, .14)
    mx.add(kick(), t, .7); mx.add(bell(96, 1.5), t, .3)
    mx.render("4-stings", t + 1.0, wow=False)

waltz(); march(); dusk(); stings()
print(os.listdir("audio-samples"))
