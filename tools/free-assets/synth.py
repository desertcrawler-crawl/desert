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
def write(name, chans, q=4):
    a = np.stack(chans, 1); a = a / np.max(np.abs(a)) * 0.89
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

n = SR * 46
wl = wind_channel(n, 0); wr = wind_channel(n, 1)
write('wind_loop', [loopify(wl, 6), loopify(wr, 6)])

# One gust to layer on top now and then.
n = SR * 7; env = np.sin(np.linspace(0, np.pi, n)) ** 2.5
g = [ (lp(np.cumsum(rng.standard_normal(n)) - lp(np.cumsum(rng.standard_normal(n)), 0.5, 1), 600) / 300 + bp(rng.standard_normal(n), 600, 1800) * 2) * env for _ in range(2)]
write('wind_gust', g)

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

parts = []
for k in range(6):
    parts.append(breath(rng.uniform(0.9, 1.25), rng.uniform(1.4, 1.9), rng.uniform(0.5, 1.0), rng.uniform(0.25, 0.6)))
b = np.concatenate(parts); b = lp(b, 6000)
write('breathing_loop', [b * 0.95 + np.roll(b, 40) * 0.05, b])

# Slower, weaker, rattling breaths for the dying state.
parts = [breath(rng.uniform(1.2, 1.6), rng.uniform(2.0, 2.6), rng.uniform(1.2, 2.0), rng.uniform(0.7, 1.0)) * rng.uniform(0.6, 1.0) for _ in range(5)]
b = lp(np.concatenate(parts), 4500)
write('breathing_dying', [b, b])
