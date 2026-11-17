# Drawn track shape from the FIA circuit drawing (owner 2026-11-17: "build the map from real data like the FIA documents, not from driving lines").
#   python3 scripts/sim/tracks/map-fia-drawing.py <id> <circuit-map.pdf> <document url> [page]   -> {fia} in worker/lapsim/map-shape-data.js
# The FIA event notes "Circuit Map" page is a vector drawing made from the circuit survey: the track surface is a grey mesh between
# black edge lines. The PDF is read locally and not stored here (only the derived midline is). Its band has a constant drawn width,
# so the width is not taken from it.
#   1. render the page (600 dpi), mask the grey surface, close the mesh lines, keep the biggest piece (track + pit lane)
#   2. skeleton = centreline, distance transform = half width (pixels)
#   3. similarity fit (rotation, scale, shift) of our drawn midline onto the skeleton; scale checked against our lap length
#   4. walk the skeleton in lap order (shortest skeleton path between successive midline points: never the pit lane), giving the
#      ordered FIA centreline; resample it at our midline's lap distances (anchored every ~100 m so corners keep their lap distance)
# Output in our map frame: mid (n points, 0.1 m), half width (0.1 m), fit numbers. Drawing only.
import sys, json, math, os, subprocess
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra
from skimage.morphology import skeletonize, binary_closing, disk
from PIL import Image
Image.MAX_IMAGE_PIXELS = None
id, pdf, url = sys.argv[1], sys.argv[2], sys.argv[3]; page = int(sys.argv[4]) if len(sys.argv) > 4 else None; DPI = int(os.environ.get('DPI', 600))
tmp = f'/tmp/fia-{id}'
def mids(ids, shape=True):
    out = subprocess.run(['node', '--input-type=module', '-e', '''
import {lineData} from './worker/simulation.js'; import {lapsimAllTracks as T} from './worker/lapsim/tracks.js';
const o = {}; for (const id of process.argv.slice(1)) { const L = lineData(id, {shape: false}); if (L) o[id] = {mid: L.mid, len: T[id].length}; } console.log(JSON.stringify(o));''', *ids], capture_output=True, text=True, check=True).stdout
    return json.loads(out)
if page is None:   # the page that mentions corner numbers / circuit map and has the most grey surface
    best = None
    n = int([l for l in subprocess.run(['pdfinfo', pdf], capture_output=True, text=True).stdout.splitlines() if l.startswith('Pages')][0].split()[-1])
    for p in range(1, n + 1):
        txt = subprocess.run(['pdftotext', '-f', str(p), '-l', str(p), pdf, '-'], capture_output=True, text=True).stdout.lower()
        if not any(k in txt for k in ('corner number', 'circuit map', 'marshal post', 'centreline length', 'centerline length')): continue
        subprocess.run(['pdftoppm', '-r', '40', '-f', str(p), '-l', str(p), '-png', '-singlefile', pdf, tmp + '-lo'], check=True)
        im = np.array(Image.open(tmp + '-lo.png').convert('RGB')).astype(int); g = ((np.abs(im - 219) < 10).all(2)).sum()
        if best is None or g > best[0]: best = (g, p)
    page = best[1]
subprocess.run(['pdftoppm', '-r', str(DPI), '-f', str(page), '-l', str(page), '-png', '-singlefile', pdf, tmp], check=True)
im = np.array(Image.open(tmp + '.png').convert('RGB')).astype(np.int16)
grey = (np.abs(im - 219) < 12).all(2)                        # surface fill (86 % grey)
dark = (im.max(2) < 120) & ((im.max(2) - im.min(2)) < 25)     # edge lines and mesh lines (black / dark grey, not coloured text)
near = ndimage.binary_dilation(grey, disk(3))
mask = binary_closing(grey | (dark & near), disk(2))
lab, nl = ndimage.label(mask); sz = ndimage.sum(mask, lab, range(1, nl + 1)); sl = ndimage.find_objects(lab)
# a track is a thin band: its pieces fill little of their box (title bars and legend boxes fill most of theirs)
fill = np.array([sz[k] / max(1, (b[0].stop - b[0].start) * (b[1].stop - b[1].start)) for k, b in enumerate(sl)])
ok = np.flatnonzero((fill < 0.35) & (sz > 2000)); big = sz[ok].max(); keep = ok[sz[ok] > big * 0.02] + 1
mask = np.isin(lab, keep)
dt = ndimage.distance_transform_edt(mask); sk = skeletonize(mask)
# prune spurs (skeleton whiskers at corners, run-off stubs): drop end points repeatedly; the lap (a cycle) stays
nb = lambda b: ndimage.convolve(b.astype(np.uint8), np.ones((3, 3), np.uint8), mode='constant') - b
sk0, NP = sk.copy(), int(25 * 2.2 * DPI / 600)   # about 25 m of whisker
for _ in range(NP):
    e = sk & (nb(sk) <= 1)
    if not e.any(): break
    sk = sk & ~e
for _ in range(NP):   # regrow from the ends that are left (a lap broken by a label keeps its full length; whiskers stay gone)
    e = sk & (nb(sk) <= 1); g = ndimage.binary_dilation(e, np.ones((3, 3), bool)) & sk0 & ~sk
    if not g.any(): break
    sk = sk | g
yy, xx = np.nonzero(sk); P = np.c_[xx, -yy].astype(float); hwpx = dt[yy, xx]
# skeleton graph (8-neighbours)
idx = -np.ones(sk.shape, int); idx[yy, xx] = np.arange(len(yy)); rows, cols, w = [], [], []
H, W = sk.shape
for dy, dx in ((0, 1), (1, -1), (1, 0), (1, 1)):
    x0, x1 = max(0, -dx), W - max(0, dx); a = idx[0:H - dy, x0:x1]; b = idx[dy:H, x0 + dx:x1 + dx]
    ok = (a >= 0) & (b >= 0); rows += list(a[ok]); cols += list(b[ok]); w += [math.hypot(dx, dy)] * int(ok.sum())
G = coo_matrix((w + w, (rows + cols, cols + rows)), shape=(len(P), len(P))).tocsr()
# our midline and the similarity fit
D = mids([id], shape=False)[id]; M = np.array(D['mid'], float); L = D['len']; n = len(M); sM = np.arange(n) * L / n
cM = M.mean(0); S = M - cM; trP = cKDTree(P); cP = P.mean(0)
skl = len(P) * 1.08   # skeleton length in pixels, about
best = None
for deg, f0 in [(d_, f_) for d_ in range(0, 360, 5) for f_ in (0.8, 0.92, 1.05)]:
    th = math.radians(deg); R0 = np.array([[math.cos(th), -math.sin(th)], [math.sin(th), math.cos(th)]])
    sc = skl / L * f0; Rm, t = R0 * sc, cP.copy()
    for _ in range(12):
        X = S @ Rm.T + t; d, j = trP.query(X); wq = d <= np.quantile(d, .85); A, B = S[wq], P[j[wq]]; ma, mb = A.mean(0), B.mean(0)
        U, sv, Vt = np.linalg.svd((B - mb).T @ (A - ma)); Q = U @ Vt
        if np.linalg.det(Q) < 0: U[:, 1] *= -1; Q = U @ Vt
        s_ = sv.sum() / ((A - ma) ** 2).sum(); Rm = s_ * Q; t = mb - ma @ Rm.T
    e = float(np.median(trP.query(S @ Rm.T + t)[0]))
    if best is None or e < best[0]: best = (e, Rm, t)
e, Rm, t = best
for trim in (.85, .7, .7, .7):   # refine: more iterations, tighter trimming
    for _ in range(15):
        X = S @ Rm.T + t; d, j = trP.query(X); wq = d <= np.quantile(d, trim); A, B = S[wq], P[j[wq]]; ma, mb = A.mean(0), B.mean(0)
        U, sv, Vt = np.linalg.svd((B - mb).T @ (A - ma)); Q = U @ Vt
        if np.linalg.det(Q) < 0: U[:, 1] *= -1; Q = U @ Vt
        Rm = sv.sum() / ((A - ma) ** 2).sum() * Q; t = mb - ma @ Rm.T
e = float(np.median(trP.query(S @ Rm.T + t)[0])); scale = float(np.sqrt(abs(np.linalg.det(Rm))))   # px per metre
X = S @ Rm.T + t; d, j = trP.query(X)
print(f'{id}: page {page}, fit median {e / scale:.2f} m, p95 {np.percentile(d, 95) / scale:.1f} m, scale {scale:.3f} px/m')
# lap-ordered FIA centreline: shortest skeleton paths between successive nearest nodes
order = []
for i in range(n):
    a, b = j[i], j[(i + 1) % n]
    if a == b: continue
    dist, pred = dijkstra(G, indices=a, return_predecessors=True, limit=60 * scale)
    if not np.isfinite(dist[b]): order.append(b); continue
    path = [b]
    while path[-1] != a: path.append(pred[path[-1]])
    order += path[::-1][1:]
C = ndimage.gaussian_filter1d(P[order], 2.0 * scale, axis=0, mode='wrap'); Cw = hwpx[order]; seg = np.hypot(*np.diff(np.vstack([C, C[:1]]), axis=0).T); u = np.r_[0, np.cumsum(seg)]; Lc = u[-1]
# where each midline point sits along C (first time its node is reached), then a smooth monotone map s -> u through anchors
pos = {}; [pos.setdefault(k, ui) for k, ui in zip(order, u[:-1])]
ui = np.array([pos.get(j[i], np.nan) for i in range(n)]); ui = np.unwrap(ui / Lc * 2 * np.pi) * Lc / (2 * np.pi)
anc = np.arange(0, n, max(1, int(100 / (L / n)))); ok = np.isfinite(ui[anc]) & (d[anc] / scale < 4); ok[0] = np.isfinite(ui[0]); a_s, a_u = sM[anc][ok], ui[anc][ok]
a_u = np.maximum.accumulate(a_u - a_u[0]) + a_u[0]
uq = np.interp(sM, np.r_[a_s, L], np.r_[a_u, a_u[0] + Lc])
mx = np.interp(uq % Lc, u, np.r_[C[:, 0], C[0, 0]]); my = np.interp(uq % Lc, u, np.r_[C[:, 1], C[0, 1]]); hw = np.interp(uq % Lc, u, np.r_[Cw, Cw[0]]) / scale
Fp = np.c_[mx, my]
newM = (Fp - t) @ np.linalg.inv(Rm).T + cM          # back to our map frame
# where two parts of the lap touch in the drawing (Baku T7 / T19) the grey bands merge and the skeleton runs between them: keep our
# line there (blended over ~5 points) and the typical width
hm = np.median(hw); bad = ndimage.binary_dilation(hw > 1.4 * hm, np.ones(7, bool)); wgt = ndimage.uniform_filter1d(bad.astype(float), 5, mode='wrap')
newM = newM * (1 - wgt[:, None]) + M * wgt[:, None]; hw = np.where(bad, hm, hw)
moved = np.hypot(*(newM - M).T)
W = newM - M
if e / scale > 3: sys.exit(f'{id}: the drawing does not fit our line (median {e / scale:.1f} m); not stored')
out = {'atlas': 'fia-drawing', 'fia': {'x': [int(round(v * 10)) for v in W[:, 0]], 'y': [int(round(v * 10)) for v in W[:, 1]]}, 'fiaDoc': url, 'fiaPage': page,
       'fitMedianM': round(e / scale, 2), 'drawingLapM': round(Lc / scale, 1), 'maxMoveM': round(float(moved.max()), 1), 'keptOwnPoints': int(bad.sum())}
f = 'worker/lapsim/map-shape-data.js'; s = open(f).read(); head, body = s.split('\nexport const lapsimMapShape = ')
data = json.loads(body.rstrip().rstrip(';')); data['tracks'].setdefault(id, {}).update(out)
if 'map-fia-drawing' not in head: head += '\n// fia: midline from the FIA circuit drawing (scripts/sim/tracks/map-fia-drawing.py), 0.1 m moves of lineData(id, {shape: false}).mid; drawn without smoothing.'
open(f, 'w').write(head + '\nexport const lapsimMapShape = ' + json.dumps(data, separators=(',', ':')) + ';\n')
print(f"{id}: drawing lap {out['drawingLapM']} m vs ours {L} m; fit median {out['fitMedianM']} m; largest move {out['maxMoveM']} m; own line kept at {out['keptOwnPoints']} points")
