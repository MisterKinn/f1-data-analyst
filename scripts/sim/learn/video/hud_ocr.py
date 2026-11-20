"""OCR the data HUD of a GT3 onboard (720x1280 portrait, 'Car #98' overlay).
Writes per-frame t, gps_kmh, car_kmh, gear, rpm, throttle (0..1), brake (0..1 of bar).
Usage: python3 hud_ocr.py video.mp4 out.csv [fps]"""
import sys, csv, subprocess, numpy as np, pytesseract
from multiprocessing import Pool
from PIL import Image

W, H = 720, 1280
BOX = {'car': (540, 975, 660, 1022), 'gps': (540, 1030, 660, 1077), 'rpm': (150, 942, 220, 970), 'gear': (150, 975, 225, 1062)}
BAR_Y = (908, 1074)  # top / bottom of both bars
THR_X, BRK_X = (252, 276), (98, 126)


def ocr(img, digits):
    g = np.asarray(img.convert('L'), dtype=np.uint8)
    g = (g > 140).astype(np.uint8) * 255  # white text on dark
    im = Image.fromarray(255 - g).resize((g.shape[1] * 3, g.shape[0] * 3), Image.LANCZOS)
    s = pytesseract.image_to_string(im, config=f'--psm 7 -c tessedit_char_whitelist={digits}').strip()
    return s


def num(s, lo, hi, dec):
    s = s.replace(' ', '')
    if dec and '.' not in s and len(s) == 4:
        s = s[:3] + '.' + s[3:]
    try:
        v = float(s)
    except ValueError:
        return None
    return v if lo <= v <= hi else None


def bar(a, xs, chan):
    col = a[BAR_Y[0]:BAR_Y[1], xs[0]:xs[1]].astype(int)
    r, g, b = col[..., 0], col[..., 1], col[..., 2]
    on = (g > 150) & (r < 120) if chan == 'g' else (r > 150) & (g < 90)
    rows = on.mean(axis=1) > 0.5
    return float(rows.mean())


def frame(args):
    i, fps, raw = args
    a = np.frombuffer(raw, np.uint8).reshape(H, W, 3)
    im = Image.fromarray(a)
    c = {k: im.crop(v) for k, v in BOX.items()}
    return dict(t=round(i / fps, 3),
                gps=num(ocr(c['gps'], '0123456789.'), 0, 330, True),
                car=num(ocr(c['car'], '0123456789.'), 0, 330, True),
                gear=num(ocr(c['gear'], '0123456789'), 1, 7, False),
                rpm=num(ocr(c['rpm'], '0123456789'), 1000, 10000, False),
                thr=round(bar(a, THR_X, 'g'), 3), brk=round(bar(a, BRK_X, 'r'), 3))


def main():
    src, out = sys.argv[1], sys.argv[2]
    fps = float(sys.argv[3]) if len(sys.argv) > 3 else 10
    p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', src, '-vf', f'fps={fps}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
    jobs, i = [], 0
    while True:
        raw = p.stdout.read(W * H * 3)
        if len(raw) < W * H * 3:
            break
        jobs.append((i, fps, raw)); i += 1
    with Pool(2) as pool:
        rows = pool.map(frame, jobs, chunksize=8)
    with open(out, 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader(); w.writerows(rows)
    ok = sum(r['gps'] is not None for r in rows)
    print(f'{len(rows)} frames, gps read {ok}')


if __name__ == '__main__':
    main()
