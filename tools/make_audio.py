"""Synthesises the game's music and stings into public/audio/.
Original tunes, generated from scratch with numpy; needs ffmpeg for the mp3 encode.
Run: python3 tools/make_audio.py [name ...]      (names: waltz march dusk stings; default all)"""
import numpy as np, wave, subprocess, os, sys
SR = 44100
OUT = "public/audio"
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
    ph = 2 * np.pi * f * t + vib * f / 5.5 * np.sin(2 * np.pi * 5.5 * t)
    y = sum(a * np.sin((i + 1) * ph) for i, a in enumerate(harm))
    c = rng.normal(0, 1, n) * np.exp(-t / .018) * chiff      # breathy onset
    return (y + c) * env(n, .012, .05)

def bell(m, dur=1.2):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    y = np.sin(2*np.pi*f*t) + .45*np.sin(2*np.pi*2.76*f*t)*np.exp(-t/.15) + .2*np.sin(2*np.pi*5.4*f*t)*np.exp(-t/.06)
    return y * np.exp(-t / (dur * .28)) * env(n, .002, .02)

def bass(m, dur):
    """A round, plucked upright-bass / tuba note."""
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    y = np.sin(2*np.pi*f*t) + .5*np.sin(2*np.pi*2*f*t)*np.exp(-t/.25) + .22*np.sin(2*np.pi*3*f*t)*np.exp(-t/.12)
    return y * (0.35 + 0.65 * np.exp(-t / (dur * .6))) * env(n, .006, .06)

def brass(m, dur, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m) * 2 ** (rng.uniform(-5, 5) / 1200)
    swell = np.minimum(1, t / .05)
    y = sum((bright ** i) / (i + 1) * np.sin(2*np.pi*(i+1)*f*t + .3*i) * (swell ** (1 + i * .5)) for i in range(9))
    return y * env(n, .02, .08) * (1 + .03*np.sin(2*np.pi*5.2*t) * np.minimum(1, t / .3))

def band(n, lo, hi):
    """White noise limited to lo..hi Hz."""
    X = np.fft.rfft(rng.normal(0, 1, n)); f = np.fft.rfftfreq(n, 1 / SR)
    X[(f < lo) | (f > hi)] = 0
    y = np.fft.irfft(X, n)
    return y / (np.max(np.abs(y)) + 1e-9)

def snare(dur=.09):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.normal(0, 1, n); x = x - np.concatenate([[0], x[:-1]]) * .6
    return (x + .5 * np.sin(2*np.pi*190*t)) * np.exp(-t / .03)

def kick(dur=.18):
    n = int(dur * SR); t = np.arange(n) / SR
    f = 45 + 60 * np.exp(-t / .03)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / .07)

def hat(dur=.04, open_=False):
    n = int((.25 if open_ else dur) * SR); t = np.arange(n) / SR
    return band(n, 6500, 14000) * np.exp(-t / (.07 if open_ else .012))

def brush(dur=.12):
    n = int(dur * SR); t = np.arange(n) / SR
    return band(n, 1800, 7000) * np.exp(-t / .04) * np.minimum(1, t / .01)

def crash(dur=1.6):
    n = int(dur * SR); t = np.arange(n) / SR
    return band(n, 3000, 15000) * np.exp(-t / .45)

def triangle(dur=1.0):
    n = int(dur * SR); t = np.arange(n) / SR
    return (np.sin(2*np.pi*4200*t) + .6*np.sin(2*np.pi*6630*t) + .3*np.sin(2*np.pi*9800*t)) * np.exp(-t / .3)

def finish(y, lp=.45, wow=True, drive=1.6):
    out = y.copy()
    for d, g in ((.031, .28), (.047, .22), (.071, .16), (.113, .1)):      # small room: a few comb echoes
        k = int(d * SR); out[k:] += y[:-k] * g
    if wow:                                                               # worn-tape wobble
        t = np.arange(len(out)); out = np.interp(t + 18 * np.sin(2 * np.pi * .6 * t / SR), t, out)
    # gentle one-pole low-pass, done in the frequency domain so long tracks render quickly
    X = np.fft.rfft(out); f = np.fft.rfftfreq(len(out), 1 / SR)
    fc = -np.log(1 - lp) * SR / (2 * np.pi)
    out = np.fft.irfft(X / np.sqrt(1 + (f / fc) ** 2), len(out))
    out = np.tanh(out / (np.max(np.abs(out)) + 1e-9) * drive)
    return out * .9 / np.max(np.abs(out))

def save(name, out, kbps="112k"):
    os.makedirs(OUT, exist_ok=True)
    wav = f"{OUT}/{name}.wav"
    with wave.open(wav, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(out, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-b:a", kbps, f"{OUT}/{name}.mp3"], check=True)
    os.remove(wav)
    print(f"{name}.mp3  {len(out) / SR:.1f}s  {os.path.getsize(f'{OUT}/{name}.mp3') // 1024} KB")

class Mix:
    def __init__(self, secs): self.n = int(secs * SR); self.b = np.zeros(self.n + SR * 4)
    def add(self, y, at, g=1.0):
        i = int(at * SR); y = y[: len(self.b) - i]; self.b[i:i + len(y)] += y * g
    def loop(self, name, lp=.45, wow=True):
        """Renders a track that repeats seamlessly: whatever rings on past the end is folded back onto the start."""
        out = finish(self.b, lp, wow)
        tail = out[self.n:]; out = out[: self.n]; out[: len(tail)] += tail
        save(name, out * .92 / np.max(np.abs(out)))
    def oneshot(self, name, secs, lp=.5, fade=.25):
        out = finish(self.b[: int(secs * SR)], lp, wow=False)
        k = int(fade * SR); out[-k:] *= np.linspace(1, 0, k)
        save(name, out, "128k")

CH = {"C": (48, [60, 64, 67]), "C7": (48, [58, 64, 67]), "G7": (43, [59, 62, 65]), "F": (41, [60, 65, 69]),
      "Bb": (46, [58, 62, 65]), "Am": (45, [57, 60, 64]), "G": (43, [59, 62, 67]), "Dm": (50, [57, 62, 65]),
      "Gm": (43, [58, 62, 67]), "E7": (40, [59, 62, 64]), "Em": (40, [59, 64, 67])}

def melody(mx, notes, t0, beat, voice, g, gate=.9):
    t = t0
    for m, d in notes:
        if m is not None: mx.add(voice(m, d * beat * gate), t, g)
        t += d * beat
    return t

# ---------- Midway Waltz: calliope waltz, ~95 s ----------
def waltz():
    bpm = 184; beat = 60 / bpm; bar = 3 * beat
    A = "C C G7 G7 G7 G7 C C C C7 F F C G7 C C".split()
    B = "F F C C G7 G7 C C F F C Am Dm G7 C C".split()
    melA = [(76,1),(79,1),(84,1),(84,2),(79,1),(77,1),(79,1),(83,1),(86,2),(79,1),
            (74,1),(77,1),(83,1),(83,2),(81,1),(79,1),(76,1),(79,1),(84,3),
            (76,1),(79,1),(84,1),(82,2),(79,1),(81,1),(84,1),(89,1),(86,2),(84,1),
            (84,1),(79,1),(76,1),(77,1),(74,1),(71,1),(72,1),(76,1),(79,1),(84,3)]
    melB = [(81,2),(77,1),(84,2),(81,1),(79,2),(76,1),(84,3),(83,1),(86,1),(89,1),(86,2),(83,1),(84,1),(79,1),(76,1),(79,3),
            (81,2),(77,1),(84,2),(81,1),(88,2),(84,1),(81,3),(77,1),(81,1),(86,1),(83,2),(79,1),(84,3),(84,2),(None,1)]
    # counter-line for the last time round: long notes a third or sixth under the tune
    counter = [(64,3),(67,3),(65,3),(62,3),(65,3),(62,3),(64,3),(67,3),(64,3),(70,3),(69,3),(65,3),(67,3),(65,3),(64,3),(64,3)]
    plan = [(A, melA, "plain"), (A, melA, "bells"), (B, melB, "plain"), (B, melB, "bells"), (A, melA, "plain"), (A, melA, "full")]
    mx = Mix(len(plan) * 16 * bar)
    for s, (chords, mel, style) in enumerate(plan):
        t0 = s * 16 * bar
        mx.add(crash(), t0, .1 if s else .0)
        for i, c in enumerate(chords):
            root, tri = CH[c]; t = t0 + i * bar
            fifth = i % 2 == 1 and c in ("C", "F", "G7")
            mx.add(bass(root - 12 + (7 if fifth else 0), beat * 1.6), t, .6)
            mx.add(pipe(root + (7 if fifth else 0), beat * .8, harm=(1, .7, .2, .1), chiff=.1), t, .3)
            mx.add(kick(), t, .5)
            for b in (1, 2):
                for n in tri: mx.add(pipe(n, beat * .45, chiff=.15), t + b * beat, .11)
                mx.add(brush(), t + b * beat, .1)
                mx.add(hat(), t + b * beat, .05)
            if i % 4 == 3:        # a little walk-up and a triangle ting into the next phrase
                nxt = CH[chords[(i + 1) % 16]][0]
                mx.add(bass(nxt - 12 - 2, beat * .9), t + beat, .45); mx.add(bass(nxt - 12 - 1, beat * .9), t + 2 * beat, .45)
                mx.add(triangle(), t + 2 * beat, .04)
            if i == 15:
                for k in range(6): mx.add(snare(.05), t + beat + k * beat / 3, .05 + k * .012)
        melody(mx, mel, t0, beat, lambda m, d: pipe(m, d, detune=10), .3)
        if style in ("bells", "full"): melody(mx, mel, t0, beat, lambda m, d: bell(m + 12), .2)
        if style == "full": melody(mx, counter, t0, beat, lambda m, d: pipe(m, d, harm=(1, .35, .12), vib=.007, chiff=.05), .16)
    mx.loop("waltz")

# ---------- Ticket Booth March: band-organ oom-pah, ~87 s ----------
def march():
    bpm = 132; beat = 60 / bpm; bar = 4 * beat
    A = "F F C7 F Bb F C7 F".split()
    B = "Bb Bb F F C7 C7 F C7".split()
    e, q, hh = .5, 1, 2
    melA = [(72,e),(77,e),(81,e),(77,e),(84,e),(81,e),(77,e),(81,e),
            (84,q),(86,e),(84,e),(81,q),(77,q),
            (76,e),(79,e),(82,e),(79,e),(84,e),(82,e),(79,e),(76,e),
            (77,q),(81,q),(84,hh),
            (82,e),(86,e),(89,e),(86,e),(91,e),(89,e),(86,e),(82,e),
            (84,q),(81,e),(84,e),(89,q),(84,q),
            (82,e),(79,e),(76,e),(79,e),(82,e),(84,e),(86,e),(88,e),
            (89,q),(84,q),(77,hh)]
    melB = [(74,q),(77,q),(82,hh), (84,e),(82,e),(81,q),(77,hh), (72,q),(77,q),(81,hh), (84,e),(81,e),(77,q),(72,hh),
            (76,q),(79,q),(82,hh), (84,q),(82,q),(79,q),(76,q), (77,q),(81,q),(84,q),(89,q), (88,e),(86,e),(84,e),(82,e),(79,q),(76,q)]
    plan = [(A, melA, "plain"), (A, melA, "bells"), (B, melB, "soft"), (B, melB, "bells"), (A, melA, "plain"), (A, melA, "full")]
    mx = Mix(len(plan) * 8 * bar)
    for s, (chords, mel, style) in enumerate(plan):
        t0 = s * 8 * bar; soft = style == "soft"
        if s: mx.add(crash(), t0, .12)
        for i, c in enumerate(chords):
            root, tri = CH[c]; t = t0 + i * bar
            for b in range(4):
                tb = t + b * beat
                if b % 2 == 0:
                    mx.add(bass(root - 12 + (7 if b == 2 else 0), beat * .9), tb, .65)
                    mx.add(pipe(root + (7 if b == 2 else 0), beat * .7, harm=(1, .8, .3, .15), chiff=.1), tb, .3)
                    mx.add(kick(), tb, .4 if soft else .6)
                else:
                    for n in tri: mx.add(pipe(n, beat * .35, chiff=.2), tb, .12)
                    mx.add(snare(), tb, .08 if soft else .16)
                mx.add(hat(), tb, .05); mx.add(hat(), tb + beat / 2, .035)
            if i % 4 == 3:       # drum fill and a bass run into the next phrase
                for k in range(6): mx.add(snare(.05), t + (2.5 + k * .25) * beat, .07 + k * .015)
                nxt = CH[chords[(i + 1) % 8]][0]
                mx.add(bass(nxt - 12 - 2, beat * .45), t + 3 * beat, .5); mx.add(bass(nxt - 12 - 1, beat * .45), t + 3.5 * beat, .5)
        lead = (lambda m, d: pipe(m, d, harm=(1, .3, .12), vib=.006, chiff=.08)) if soft else (lambda m, d: pipe(m, d, harm=(1, .6, .45, .25, .15, .1), detune=8))
        melody(mx, mel, t0, beat, lead, .3, gate=.8)
        if style in ("bells", "full"): melody(mx, mel, t0, beat, lambda m, d: bell(m + 12, .6), .2)
        if style == "full": melody(mx, [(m - 9 if m else None, d) for m, d in mel], t0, beat, lambda m, d: pipe(m, d, vib=.006), .12, gate=.8)
    mx.loop("march")

# ---------- Dusk Carousel: slow music box for the park at night, ~90 s ----------
def dusk():
    bpm = 96; beat = 60 / bpm; bar = 3 * beat
    A = "Am F C G Am F G C".split()
    B = "F G C Am F G Am Am".split()
    melA = [(76,2),(81,1),(81,2),(77,1),(79,2),(76,1),(74,3),(76,1),(81,1),(84,1),(81,2),(84,1),(83,2),(79,1),(84,3)]
    melB = [(81,2),(84,1),(83,2),(79,1),(84,1),(88,1),(84,1),(81,3),(77,2),(81,1),(79,2),(83,1),(81,3),(76,2),(None,1)]
    plan = [(A, melA, "sparse"), (A, melA, "full"), (B, melB, "full"), (B, melB, "pipe"), (A, melA, "pipe"), (A, melA, "sparse")]
    mx = Mix(len(plan) * 8 * bar)
    for s, (chords, mel, style) in enumerate(plan):
        t0 = s * 8 * bar; sparse = style == "sparse"
        for i, c in enumerate(chords):
            root, tri = CH[c]; t = t0 + i * bar
            for n in tri: mx.add(pipe(n, beat * 3, harm=(1, .25, .08), vib=.006, chiff=.03) * env(int(beat*3*SR), .25, .4), t, .1)
            mx.add(pipe(root, beat * 2.8, harm=(1, .4, .1), chiff=.03), t, .22)
            mx.add(bass(root - 12, beat * 2.6), t, .5)                       # soft bass under everything
            if not sparse:
                mx.add(bass(root - 12 + 7, beat * .9), t + 2 * beat, .3)
                mx.add(kick(), t, .22)                                       # a heartbeat, and brushes on two and three
                mx.add(brush(.18), t + beat, .05); mx.add(brush(.18), t + 2 * beat, .05)
            arp = [tri[0] + 12, tri[2] + 12, tri[0] + 24, tri[1] + 24, tri[0] + 24, tri[2] + 12]
            for k, n in enumerate(arp):
                if not sparse or k % 2 == 0: mx.add(bell(n, 1.6), t + k * beat / 2, .16)
            if i == 7 and not sparse: mx.add(triangle(1.4), t + 2 * beat, .03)
        melody(mx, mel, t0, beat, lambda m, d: bell(m + 12, 2.2), .34)
        if style == "pipe": melody(mx, mel, t0, beat, lambda m, d: pipe(m, d, harm=(1, .3, .1), vib=.007, chiff=.05), .16)
    mx.loop("dusk", lp=.3)

# ---------- Stings: fanfare, applause, the crowd's sad "ohh", a drum roll, a ticket ding ----------
def clap_crowd(secs, people=55, swell=.25, fade=1.4):
    n = int(secs * SR); y = np.zeros(n + SR)
    shape = band(int(.03 * SR), 900, 4200) * np.exp(-np.arange(int(.03 * SR)) / SR / .008)
    for p in range(people):
        rate = rng.uniform(3.4, 5.6); t = rng.uniform(0, .5); g = rng.uniform(.3, 1)
        tone = np.interp(np.arange(len(shape)) * rng.uniform(.75, 1.3), np.arange(len(shape)), shape, right=0)
        while t < secs:
            i = int(t * SR); y[i:i + len(tone)] += tone * g
            t += 1 / rate * rng.uniform(.85, 1.15)
    y = y[:n]; t = np.arange(n) / SR
    return y * np.minimum(1, t / swell) * np.minimum(1, (secs - t) / fade)

def crowd_voice(f0, f1, secs, formants):
    """One person going "ohh": a buzzy tone, sliding down, shaped by vowel formants."""
    n = int(secs * SR); t = np.arange(n) / SR
    f = f0 + (f1 - f0) * (t / secs) ** 1.6 + 2.5 * np.sin(2 * np.pi * rng.uniform(4.5, 6) * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = sum(np.sin(k * ph) / k for k in range(1, 26))
    X = np.fft.rfft(y); fr = np.fft.rfftfreq(n, 1 / SR)
    gain = sum(a * np.exp(-((fr - c) / w) ** 2) for c, w, a in formants) + .02
    y = np.fft.irfft(X * gain, n)
    return y / (np.max(np.abs(y)) + 1e-9) * np.minimum(1, t / .12) * np.minimum(1, (secs - t) / .5)

def stings():
    # fanfare: brass call with a held chord, timpani and a crash
    beat = .15; mx = Mix(5)
    call = [(67,1),(72,1),(76,1),(79,2),(76,1),(79,2),(84,6)]
    t = melody(mx, call, .05, beat, lambda m, d: brass(m, d), .32)
    melody(mx, [(m - 5 if m != 84 else 76, d) for m, d in call], .05, beat, lambda m, d: brass(m, d, .8), .2)
    hold = .05 + 8 * beat
    for nn in (48, 55, 60, 64, 67): mx.add(brass(nn, beat * 7, .7), hold, .12)
    for k in range(10): mx.add(kick(.25), hold + k * .06, .25 + .03 * k)
    mx.add(crash(2.2), hold, .3); mx.add(kick(.3), hold, .8); mx.add(bell(96, 1.8), hold, .15)
    mx.oneshot("fanfare", t + 1.3, lp=.6, fade=.6)

    # applause with a few whoops
    y = clap_crowd(4.6) * .9
    for k in range(4):
        w = crowd_voice(rng.uniform(380, 520), rng.uniform(600, 820), rng.uniform(.5, .8), [(700, 200, 1), (1200, 300, .6), (2600, 500, .2)])
        i = int(rng.uniform(.3, 2.6) * SR); y[i:i + len(w)] += w * .12
    save("applause", finish(y, lp=.75, wow=False, drive=1.2), "128k")

    # the crowd's sad "ohh"
    n = int(2.1 * SR); y = np.zeros(n)
    for k in range(14):
        f0 = rng.choice([150, 165, 196, 220, 247, 294]) * rng.uniform(.97, 1.03)
        v = crowd_voice(f0, f0 * rng.uniform(.68, .8), rng.uniform(1.5, 2.0), [(480, 130, 1), (820, 160, .7), (2500, 400, .08)])
        i = int(rng.uniform(0, .14) * SR); v = v[: n - i]; y[i:i + len(v)] += v * rng.uniform(.5, 1)
    save("aww", finish(y, lp=.5, wow=False, drive=1.2), "128k")

    # drum roll: swells, then a hit and cymbal
    roll = 2.0; mx = Mix(4); t = 0.0; k = 0
    while t < roll:
        mx.add(snare(.05), t, (.07 + .2 * (t / roll) ** 2) * (1 if k % 2 else .8)); t += .036 + rng.uniform(-.004, .004); k += 1
    mx.add(snare(.2), roll, .5); mx.add(kick(.3), roll, .9); mx.add(crash(1.4), roll, .3)
    mx.oneshot("drumroll", roll + 1.2, lp=.7, fade=.5)

    # prize tickets: a quick run of bells
    mx = Mix(3)
    melody(mx, [(84,1),(88,1),(91,1),(96,3)], .02, .1, lambda m, d: bell(m, .9), .35)
    mx.oneshot("ding", 1.4, lp=.8)

ALL = {"waltz": waltz, "march": march, "dusk": dusk, "stings": stings}
for name in (sys.argv[1:] or ALL): ALL[name]()
