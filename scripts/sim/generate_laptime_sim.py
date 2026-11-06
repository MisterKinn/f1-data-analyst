"""Generate lap-simulation data for the /simulation page.

Runs TUMFTM laptime-simulation (LGPL-3.0, https://github.com/TUMFTM/laptime-simulation)
as an unmodified library from a separate checkout and writes worker/sim-data.js.

Usage:
  git clone --depth 1 https://github.com/TUMFTM/laptime-simulation /tmp/laptime-simulation
  pip install trajectory_planning_helpers utm numpy
  python scripts/sim/generate_laptime_sim.py /tmp/laptime-simulation [Track ...]

The car file is TUM's generic hybrid F1 model (about 2019 rules). It is not a 2026 car
and not team data; the page states this. Racelines were produced by TUM's
global_racetrajectory_optimization (minimum-curvature line) and ship with the repo.
"""
import contextlib
import io
import json
import os
import sys
import tempfile
import time

import numpy as np

STEP = 5.0
POINTS = 360  # samples kept for the browser


def load(repo):
    sys.path.insert(0, repo)
    import laptimesim  # noqa: E402
    return laptimesim


def run(lts, repo, name, mass=0.0, power=0.0, mu_scale=None):
    track_opts = {"trackname": name, "flip_track": False, "mu_weather": 1.0,
                  "interp_stepsize_des": STEP, "curv_filt_width": 10.0,
                  "use_drs1": True, "use_drs2": True, "use_pit": False}
    solver_opts = {"vehicle": "F1_Shanghai.ini", "series": "F1", "limit_braking_weak_side": "FA",
                   "v_start": 100.0 / 3.6, "find_v_start": True, "max_no_em_iters": 5,
                   "es_diff_max": 1.0}
    driver_opts = {"vel_subtr_corner": 0.5, "vel_lim_glob": None, "yellow_s1": False,
                   "yellow_s2": False, "yellow_s3": False, "yellow_throttle": 0.3,
                   "initial_energy": 4.0e6, "em_strategy": "FCFB", "use_recuperation": True,
                   "use_lift_coast": False, "lift_coast_dist": 10.0}
    inp = os.path.join(repo, "laptimesim", "input")
    track = lts.src.track.Track(pars_track=track_opts,
                                parfilepath=os.path.join(inp, "tracks", "track_pars.ini"),
                                trackfilepath=os.path.join(inp, "tracks", "racelines", name + ".csv"),
                                vel_lim_glob=np.inf, yellow_s1=False, yellow_s2=False, yellow_s3=False)
    if mu_scale is not None:  # per-point grip map (resurfacing, wet patch, ...)
        track.mu = track.mu * mu_scale(track)
    carfile = os.path.join(inp, "vehicles", "F1_Shanghai.ini")
    if power:  # the engine curve is built in the constructor, so change the file copy instead
        txt = open(carfile).read().replace('"pow_max": 575e3', '"pow_max": %.1f' % (575e3 + power))
        carfile = os.path.join(tempfile.gettempdir(), "kongboda_F1_power.ini")
        with open(carfile, "w") as fh:
            fh.write(txt)
    car = lts.src.car_hybrid.CarHybrid(parfilepath=carfile)
    car.pars_general["m"] += mass
    driver = lts.src.driver.Driver(carobj=car, pars_driver=driver_opts, trackobj=track, stepsize=track.stepsize)
    lap = lts.src.lap.Lap(driverobj=driver, trackobj=track, pars_solver=solver_opts,
                          debug_opts={"use_plot": False, "use_debug_plots": False,
                                      "use_plot_comparison_tph": False, "use_print": False,
                                      "use_print_result": False})
    with contextlib.redirect_stdout(io.StringIO()):
        lap.simulate_lap()
    return track, lap


def sectors(track, lap):
    t = lap.t_cl
    a, b = track.zone_inds["s12"], track.zone_inds["s23"]
    return [float(t[a]), float(t[b] - t[a]), float(t[-1] - t[b])]


def sector_mask(track, k):
    n = track.raceline.shape[0]
    a, b = track.zone_inds["s12"], track.zone_inds["s23"]
    m = np.zeros(n, dtype=bool)
    m[[slice(0, a), slice(a, b), slice(b, n)][k]] = True
    return m


def simulate(lts, repo, name):
    track, lap = run(lts, repo, name)
    base_t, base_s = float(lap.t_cl[-1]), sectors(track, lap)
    s = np.asarray(track.dists_cl, dtype=float)
    v = np.asarray(lap.vel_cl, dtype=float) * 3.6
    xy = np.asarray(track.raceline, dtype=float)
    idx = np.linspace(0, len(v) - 1, POINTS).round().astype(int)
    idx_xy = idx[idx < len(xy)]
    out = {
        "lapTime": round(base_t, 3),
        "sectors": [round(x, 3) for x in base_s],
        "length": round(float(s[-1]), 1),
        "vmax": round(float(v.max()), 1),
        "vmin": round(float(v.min()), 1),
        "fullThrottleShare": round(float(np.mean(v >= v.max() * 0.95)), 3),
        "distance": [round(float(x), 1) for x in s[idx]],
        "speed": [round(float(x), 1) for x in v[idx]],
        "x": [round(float(p), 1) for p in xy[idx_xy, 0]],
        "y": [round(float(p), 1) for p in xy[idx_xy, 1]],
        "sectorBounds": [round(float(s[track.zone_inds["s12"]]), 1), round(float(s[track.zone_inds["s23"]]), 1)],
    }
    sens = {}
    for key, kw in (("mass10kg", {"mass": 10.0}), ("power10kW", {"power": 10e3}),
                    ("grip1pct", {"mu_scale": lambda tr: 1.01})):
        _, l2 = run(lts, repo, name, **kw)
        sens[key] = round(float(l2.t_cl[-1]) - base_t, 3)
    grip_sector = []
    for k in range(3):
        tr2, l2 = run(lts, repo, name, mu_scale=lambda tr, k=k: np.where(sector_mask(tr, k), 1.03, 1.0))
        grip_sector.append([round(a - b, 3) for a, b in zip(sectors(tr2, l2), base_s)])
    sens["grip3pctBySector"] = grip_sector
    out["sensitivity"] = sens
    return out


def main():
    repo = sys.argv[1]
    lts = load(repo)
    names = sys.argv[2:] or sorted(f[:-4] for f in os.listdir(os.path.join(repo, "laptimesim", "input", "tracks", "racelines"))
                                   if f.endswith(".csv") and "_pit" not in f)
    data = {}
    for n in names:
        t0 = time.time()
        try:
            data[n] = simulate(lts, repo, n)
            print(f"{n}: {data[n]['lapTime']} s ({time.time() - t0:.1f}s)", file=sys.stderr)
        except Exception as e:  # keep going; a broken track is simply left out
            print(f"{n}: skipped ({e})", file=sys.stderr)
    meta = {"generatedAt": time.strftime("%Y-%m-%d"), "model": "TUMFTM laptime-simulation (quasi-steady-state)",
            "car": "TUM generic hybrid F1 model (F1_Shanghai.ini, about 2019 rules)",
            "raceline": "TUMFTM global_racetrajectory_optimization (minimum curvature)",
            "license": "LGPL-3.0, used unmodified as a separate library"}
    target = os.path.join(os.path.dirname(__file__), "..", "..", "worker", "sim-data.js")
    with open(target, "w") as fh:
        fh.write("// Generated by scripts/sim/generate_laptime_sim.py. Do not edit by hand.\n")
        fh.write("export const simMeta=" + json.dumps(meta, ensure_ascii=False, separators=(",", ":")) + ";\n")
        fh.write("export const simTracks=" + json.dumps(data, separators=(",", ":")) + ";\n")


if __name__ == "__main__":
    main()
