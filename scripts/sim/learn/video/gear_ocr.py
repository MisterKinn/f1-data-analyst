"""Gear digit on the steering-wheel display (read only when the wheel is straight enough for OCR)."""
import sys, subprocess, numpy as np, cv2, pytesseract, json
video, box, out = sys.argv[1], list(map(int, sys.argv[2].split(','))), sys.argv[3]
x0, y0, x1, y1 = box; W, H = 1920, 1080; FPS = 5
p = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', video, '-vf', f'fps={FPS},scale={W}:{H}', '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], stdout=subprocess.PIPE)
rows, k = [], 0
while True:
    raw = p.stdout.read(W * H)
    if len(raw) < W * H: break
    g = np.frombuffer(raw, np.uint8).reshape(H, W)[y0:y1, x0:x1]
    g = cv2.resize(g, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC)
    _, b = cv2.threshold(g, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    if b.mean() > 127: b = 255 - b                               # dark digit on a light disc
    s = pytesseract.image_to_string(255 - b, config='--psm 10 -c tessedit_char_whitelist=1234567').strip()
    d = int(s) if s.isdigit() and len(s) == 1 else None
    if d in (1, 7):                                            # 7 has a top bar as wide as the digit; 1 does not
        n, lab, st, _ = cv2.connectedComponentsWithStats(b)
        if n > 1:
            i = 1 + int(np.argmax(st[1:, cv2.CC_STAT_AREA])); x, y, w, h = st[i, :4]
            top = (lab[y:y + max(2, h // 7), x:x + w] == i).any(0).mean()
            d = 7 if top > 0.6 and w > 0.45 * h else 1
    rows.append([k / FPS, d]); k += 1
json.dump(rows, open(out, 'w')); print(sum(r[1] is not None for r in rows), 'of', len(rows))
