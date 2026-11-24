# Step 31 (geometry input, fixed before any fit): per corner, the step 30d apex-radius solver inside the corridor
# TUM white lines − 1 m + official width Δ + f·iRacing kerbs, at f = 0, 0.25, 0.5, 0.75, 1, and on the base corridor (TUM − 1 m).
# The lap uses κ × R_base/R_f around each apex (pre-reg §3.1). Solver, ICP and constants copied from step30d_kerbs.py (fork 9717e859).
# Measured speeds never set a radius. 2022 never read.
# Usage: python3 -I scripts/sim/learn/step31_corridor.py <corridor export json> <TUM racetrack-database dir> <out json>
import sys, json
import numpy as np
from scipy.optimize import linprog
from scipy.spatial import cKDTree

EXP, TUMDIR, OUT = sys.argv[1:4]
E = json.load(open(EXP))
TUM = {'austin': 'Austin', 'hungaroring': 'Budapest', 'mexico-city': 'MexicoCity', 'montreal': 'Montreal', 'monza': 'Monza', 'sakhir': 'Sakhir',
       'interlagos': 'SaoPaulo', 'shanghai': 'Shanghai', 'silverstone': 'Silverstone', 'spa-francorchamps': 'Spa', 'spielberg': 'Spielberg',
       'suzuka': 'Suzuka', 'zandvoort': 'Zandvoort'}
W_OFF = {'monza': 11, 'suzuka': 13, 'silverstone': 15, 'austin': 15, 'spielberg': 12, 'shanghai': 14, 'sakhir': 14.2, 'interlagos': 13.5}  # 30d
KERB_DEFAULT, CAR_HALF = 1.3, 1.0
FS = [0.0, 0.25, 0.5, 0.75, 1.0]
H, HALF, CORE, ARM = 2.0, 200, 60, 2


def fit_rigid(ax, ay, bx, by):  # copied from step30d_kerbs.py
    tb = cKDTree(np.c_[bx, by]); ca = np.array([ax.mean(), ay.mean()]); cb = np.array([bx.mean(), by.mean()]); best = (np.inf, None)
    for m in (1, -1):
        U0 = np.c_[m * (ax - ca[0]), ay - ca[1]]
        for r in range(24):
            th, t = r * np.pi / 12, cb.copy()
            for _ in range(40):
                R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]]); P = U0 @ R.T + t
                d, j = tb.query(P); Q = np.c_[bx[j], by[j]]; mu, mq = U0.mean(0), Q.mean(0); A, B = U0 - mu, Q - mq
                th = np.arctan2((A[:, 0] * B[:, 1] - A[:, 1] * B[:, 0]).sum(), (A * B).sum())
                R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]]); t = mq - R @ mu
            P = U0 @ R.T + t; d, _ = tb.query(P); rms = np.sqrt(np.mean(d ** 2))
            if rms < best[0]: best = (rms, (m, th, t.copy()))
    m, th, t = best[1]; R = np.array([[np.cos(th), -np.sin(th)], [np.sin(th), np.cos(th)]])
    return (lambda x, y: np.c_[m * (np.asarray(x) - ca[0]), np.asarray(y) - ca[1]] @ R.T + t), best[0]


def heading_path(h, ds, mx, my):  # copied from step30d_kerbs.py
    h = np.asarray(h); x = np.cumsum(np.cos(h)) * ds; y = np.cumsum(np.sin(h)) * ds; n = len(h)
    x -= np.arange(1, n + 1) / n * x[-1]; y -= np.arange(1, n + 1) / n * y[-1]
    return x - x.mean() + np.mean(mx), y - y.mean() + np.mean(my)


def curv(Pts):  # copied from step30d_kerbs.py
    a = Pts[ARM:-ARM] - Pts[:-2 * ARM]; b = Pts[2 * ARM:] - Pts[ARM:-ARM]
    cr = a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]
    return 2 * cr / (np.hypot(*a.T) * np.hypot(*b.T) * np.hypot(*(a + b).T))


def solve(C, N, ub, lb, rel, Rcap, iters=60):  # copied from step30d_kerbs.py
    m = len(C); n = np.zeros(m); core = np.abs(rel[ARM:-ARM]) <= CORE
    k0 = curv(C); cap = np.maximum(np.abs(k0), 1 / Rcap)
    free = np.ones(m, bool); free[:3] = free[-3:] = False
    def obj(nn):
        k = curv(C + nn[:, None] * N); return np.abs(k[core]).max(), np.all(np.abs(k[~core]) <= cap[~core] + 1e-6), k
    best, ok, _ = obj(n); tr = 1.0
    if not (np.all(n <= ub) and np.all(n >= lb)): return np.nan, n
    for _ in range(iters):
        k = curv(C + n[:, None] * N); mk = len(k); eps = 1e-3
        G = np.zeros((mk, m)); ii = np.arange(mk)
        for par in range(3):
            nn = n.copy(); nn[par::3] += eps; dk = (curv(C + nn[:, None] * N) - k) / eps
            for p in (0, ARM, 2 * ARM):
                jv = ii + p; mk_ = jv % 3 == par; G[ii[mk_], jv[mk_]] = dk[mk_]
        fi = np.where(free)[0]; nv = len(fi)
        cvec = np.r_[np.zeros(nv), 1.0]; A, b = [], []
        Gf = G[:, fi]
        for i in range(mk):
            if core[i]:
                A.append(np.r_[Gf[i], -1.0]); b.append(-k[i]); A.append(np.r_[-Gf[i], -1.0]); b.append(k[i])
            else:
                A.append(np.r_[Gf[i], 0.0]); b.append(cap[i] - k[i]); A.append(np.r_[-Gf[i], 0.0]); b.append(cap[i] + k[i])
        bounds = [(max(lb[i] - n[i], -tr), min(ub[i] - n[i], tr)) for i in fi] + [(0, None)]
        res = linprog(cvec, A_ub=np.array(A), b_ub=np.array(b), bounds=bounds, method='highs')
        if res.status != 0: tr *= 0.5; continue
        nn = n.copy(); nn[fi] += res.x[:nv]; v, okk, _ = obj(nn)
        if okk and v < best - 1e-7: n, best = nn, v; tr = min(tr * 1.5, 3.0)
        else: tr *= 0.5
        if tr < 0.01: break
    return 1 / best, n


out = {'fs': FS, 'core_m': CORE, 'taper_m': 2 * CORE, 'tracks': {}}
for tid, T in E.items():
    ds, kap = T['ds'], np.array(T['kappa']); n = len(kap)
    mx, my = np.array(T['mapx'], float), np.array(T['mapy'], float)
    hx, hy = heading_path(T['heading'], ds, mx, my)
    a = np.loadtxt(f'{TUMDIR}/tracks/{TUM[tid]}.csv', delimiter=',')
    put, rms = fit_rigid(a[:, 0], a[:, 1], mx, my)
    tx, ty = np.gradient(a[:, 0]), np.gradient(a[:, 1]); nl = np.hypot(tx, ty); nx, ny = -ty / nl, tx / nl
    eA = put(a[:, 0] - nx * a[:, 2], a[:, 1] - ny * a[:, 2]); eB = put(a[:, 0] + nx * a[:, 3], a[:, 1] + ny * a[:, 3])
    tA, tB = cKDTree(eA), cKDTree(eB); wmed = float(np.median(a[:, 2] + a[:, 3]))
    wd = max(0.0, (W_OFF[tid] - wmed) / 2) if tid in W_OFF else 0.0
    mid = np.array(T['mid']); nrm = np.array(T['nrm']); tmid = cKDTree(mid)
    kL = np.array(T['kerbL']) if T['kerbL'] else None; kR = np.array(T['kerbR']) if T['kerbR'] else None
    s = np.r_[0, np.cumsum(np.hypot(np.diff(np.r_[hx, hx[:1]]), np.diff(np.r_[hy, hy[:1]])))]; Lh = s[-1]
    apexes = []  # dedupe: one apex per 60 m (first of a run)
    for ia in T['apex']:
        if not apexes or (ia - apexes[-1]) * ds > CORE: apexes.append(ia)
    if len(apexes) > 1 and (apexes[0] + n - apexes[-1]) * ds <= CORE: apexes.pop()
    rows = []
    for ia in apexes:
        w = int(40 / ds); ii = (ia + np.arange(-w, w + 1)) % n; j = ii[np.argmax(np.abs(kap[ii]))]; R = 1 / max(abs(kap[j]), 1e-6)
        q = s[ia] + np.arange(-HALF, HALF + H / 2, H)
        X = np.interp(q % Lh, s, np.r_[hx, hx[:1]]); Y = np.interp(q % Lh, s, np.r_[hy, hy[:1]])
        gx, gy = np.gradient(X), np.gradient(Y); tl = np.hypot(gx, gy); N = np.c_[-gy / tl, gx / tl]; C = np.c_[X, Y]
        lims = []
        for e, tr in ((eA, tA), (eB, tB)):
            _, jj = tr.query(C); lims.append(((e[jj] - C) * N).sum(1))
        lims = np.array(lims); up = lims.max(0); lo = lims.min(0)
        _, jm = tmid.query(C); same = (nrm[jm] * N).sum(1) > 0
        if kL is None: kp = km = np.full(len(q), KERB_DEFAULT)
        else: kp = np.where(same, kL[jm], kR[jm]); km = np.where(same, kR[jm], kL[jm])
        rel = q - s[ia]
        def run(dp, dm):
            ub = np.maximum(up - CAR_HALF + dp, 0); lb = np.minimum(lo + CAR_HALF - dm, 0)
            return float(solve(C, N, ub, lb, rel, R)[0])
        Rb = run(0, 0); Rf = [run(f * kp + wd, f * km + wd) for f in FS]
        ok = np.isfinite(Rb) and all(np.isfinite(Rf))
        rows.append(dict(ia=int(ia), R_kernel=R, R_base=Rb, R_f=Rf, ok=bool(ok),
                         scale=[min(1.0, Rb / r) if ok else 1.0 for r in Rf]))
    out['tracks'][tid] = dict(icp_rms_m=float(rms), width_d=wd, kerbs='iRacing' if kL is not None else f'default {KERB_DEFAULT}',
                              n_corners=len(rows), n_ok=sum(r['ok'] for r in rows), corners=rows)
    g = [100 * (np.sqrt(1 / r['scale'][-1]) - 1) for r in rows if r['ok']]
    print(tid, f'icp {rms:.1f} m', f'corners {len(rows)} ok {sum(r["ok"] for r in rows)}', f'speed gain at f=1 median {np.median(g) if g else float("nan"):.1f} %', flush=True)
json.dump(out, open(OUT, 'w'), indent=1)
