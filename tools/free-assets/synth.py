"""Synthesised desert ambience (wind) and laboured breathing. Made from noise, CC0."""
import numpy as np, subprocess, sys
from scipy.signal import butter, sosfilt, sosfiltfilt
SR = 44100; OUT = sys.argv[1]
rng = np.random.default_rng(7)

def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, hi], 'bandpass', fs=SR, output='sos'), x)
def lp(x, f, order=2): return sosfilt(butter(order, f, 'lowpass', fs=SR, output='sos'), x)
def smooth_noise(n, rate):
    """Slow random curve in 0..1 with about `rate` changes per second."""
    k = int(n / SR * rate) + 4; pts = rng.random(k)
    xs = np.linspace(0, k - 3, n); i = xs.astype(int); t = xs - i; t = t * t * (3 - 2 * t)
    return pts[i] * (1 - t) + pts[i + 1] * t
def loopify(x, fade):
    """Crossfade the tail into the head so the file loops without a click."""
    f = int(fade * SR); w = np.linspace(0, 1, f)
    y = x[f:].copy(); y[-f:] = y[-f:] * (1 - w) + x[:f] * w
    return y
def write(name, chans, q=4, peak=0.89):
    a = np.stack(chans, 1); a = a / np.max(np.abs(a)) * peak
    raw = (a * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', str(a.shape[1]), '-i', '-', '-c:a', 'libvorbis', '-q:a', str(q), f'{OUT}/{name}.ogg'], input=raw, check=True)
    print(name, f'{len(a)/SR:.1f}s')

def wind_channel(n, seed_shift):
    white = rng.standard_normal(n)
    brown = np.cumsum(rng.standard_normal(n)); brown = brown - lp(brown, 0.5, 1); brown /= np.std(brown)
    gust = smooth_noise(n, 0.18) ** 1.6
    gust2 = smooth_noise(n, 0.6)
    body = lp(brown, 400) * (0.15 + 1.0 * gust)                    # low roar
    # whistle: narrow bands that drift with the gusts
    whistle = np.zeros(n)
    for c, amt in [(520, 0.5), (880, 0.3), (1400, 0.15)]:
        whistle += bp(white, c * 0.92, c * 1.08) * amt * gust * gust2
    hiss = bp(white, 2500, 7000) * 0.05 * (0.3 + gust)            # sand hiss
    nz = lambda v: v / (np.std(v) + 1e-9)
    return nz(body) * 1.0 + nz(whistle) * 0.55 * (0.2 + gust) + nz(hiss) * 0.12 * (0.3 + gust)

n = SR * 36
wl = wind_channel(n, 0); wr = wind_channel(n, 1)
write('wind', [loopify(wl, 6), loopify(wr, 6)])

# One gust to layer on top now and then.
for k in range(3):
    n = int(SR * rng.uniform(3, 5)); env = np.sin(np.linspace(0, np.pi, n)) ** 2.5
    def ch():
        b = np.cumsum(rng.standard_normal(n)); b = lp(b - lp(b, 0.5, 1), 600); b /= np.std(b)
        w = bp(rng.standard_normal(n), 600, 1800); w /= np.std(w)
        s = bp(rng.standard_normal(n), 3000, 8000); s /= np.std(s)
        return (b + w * 0.6 + s * 0.15 * env) * env
    write('gust' if k == 0 else f'gust_{k + 1}', [ch(), ch()])

# Laboured breathing of an exhausted old man: in through a dry throat, slow rasping out.
def breath(dur_in, dur_out, pause, rasp):
    ni, no, npz = int(dur_in * SR), int(dur_out * SR), int(pause * SR)
    w = rng.standard_normal(ni + no)
    ein = np.sin(np.linspace(0, np.pi / 2, ni)) ** 1.5 * np.linspace(1, 0.7, ni); ein[-int(0.08*SR):] *= np.linspace(1, 0, int(0.08*SR))
    eout = np.exp(-np.linspace(0, 3.2, no)) * np.minimum(1, np.linspace(0, 12, no))
    inh = (bp(w[:ni], 900, 3200) * 0.8 + bp(w[:ni], 2600, 5200) * 0.4) * ein * 0.55
    t = np.arange(no) / SR
    f0 = 85 + 8 * np.sin(t * 7)                                    # rough voice under the exhale
    saw = ((np.cumsum(f0) / SR) % 1) * 2 - 1
    voice = bp(saw * (0.6 + 0.4 * rng.standard_normal(no) ** 2), 150, 1100) * rasp
    exh = (bp(w[ni:], 350, 1600) * 1.0 + voice) * eout
    return np.concatenate([inh, exh, np.zeros(npz)])

# Single breath halves for the game's breath_in / breath_out slots (it times them itself).
def half(dur, inhale, rasp):
    n = int(dur * SR); w = rng.standard_normal(n)
    if inhale:
        env = np.sin(np.linspace(0, np.pi / 2, n)) ** 1.5; env[-int(0.06*SR):] *= np.linspace(1, 0, int(0.06*SR))
        return (bp(w, 900, 3200) * 0.8 + bp(w, 2600, 5200) * 0.4) * env
    env = np.exp(-np.linspace(0, 3.2, n)) * np.minimum(1, np.linspace(0, 12, n))
    t = np.arange(n) / SR; f0 = 85 + 8 * np.sin(t * 7)
    saw = ((np.cumsum(f0) / SR) % 1) * 2 - 1
    voice = bp(saw * (0.6 + 0.4 * rng.standard_normal(n) ** 2), 150, 1100) * rasp
    return (bp(w, 350, 1600) + voice) * env
for k in range(4):
    suf = '' if k == 0 else f'_{k + 1}'
    a = lp(half(rng.uniform(0.55, 0.75), True, 0), 6000); write('breath_in' + suf, [a], peak=0.3)
    b = lp(half(rng.uniform(0.65, 0.9), False, rng.uniform(0.3, 0.7)), 6000); write('breath_out' + suf, [b], peak=0.4)
