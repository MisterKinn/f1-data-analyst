# Block 0: deployed-control evidence audit — 2026-11-11

No fit was run. No candidate PR was opened. The requested deployed-control held-out comparison is blocked by an incorrect baseline identity; the verified R replay does not pass.

The saved R control is not the frozen deployed production calibration. Its cars differ in all six class-season groups and pooling choices also differ. Both R arms already used repository geometry. Calling either the archive geometry control or the deployed production model would be inaccurate.

| Measure | n | RMS % |
|---|---:|---:|
| Recorded R control | 33 | 1.166709 |
| Same R fold states replayed on repository geometry | 33 | 1.166709 |
| Consistent candidate at R | 33 | 1.179080 |
| Candidate minus R control, percentage points | 33 | 0.012371 |

The difference is approximately 0.012 pp, below the 0.1 pp caution level for the small class-season samples. That does not establish improvement or satisfy the owner’s non-increase test.

| Class-season | Real s | R control as fitted s | R control on repository geometry s | Candidate held-out s |
|---|---:|---:|---:|---:|
| wec-lmh/2025 | 82.948000 | 82.582161 | 82.582161 | 82.384438 |
| wec-lmh/2026 | 83.387000 | 82.216416 | 82.216416 | 82.773163 |
| wec-lmdh/2025 | 82.570000 | 82.150457 | 82.150457 | 82.762019 |
| wec-lmdh/2026 | 83.041000 | 82.347921 | 82.347921 | 82.920171 |
| wec-lmgt3/2025 | 93.849000 | 92.591737 | 92.591737 | 93.158771 |
| wec-lmgt3/2026 | 93.350000 | 91.858310 | 91.858310 | 92.266118 |

All 33 archived held-out predictions reproduced within 1e-8 s, without optimizer rounds. Geometry changed for zero tracks, including Interlagos.

Repository and both saved fit geometry SHA256: `fe67d1ecf2a4c151f35f98e3da334d835881904ffb4ebda24488983952cee5eb`.
Control calibration SHA256: `b21f64d90e5470d5aac27d495b678762e3c77c70ac0504c6dea1ed877efe021b`.
Candidate calibration SHA256: `b7b691d8aa54b71841c17942bac1fa9fd0c3fe8c4fd14a0cfd23d0ae3e8c65bd`.

The original manifest explicitly calls the control a refit at R, not frozen production cars. Its geometry hash matches the repository file. Frozen production uses different settings and some different choices. Main-fit predictions on their training rows cannot be substituted for held-out predictions.

Missing for the exact requested metric: the deployed production fit’s original held-out parameter states and their geometry/selection provenance. A new R refit would not be the unchanged deployed model. No number is labelled “control as deployed” without that evidence. No live Vercel state was inspected.

Existing dry reproduction audits: F1 39 rows and WEC 33 rows, largest error 0 seconds; both R arms keep F1 seasons and projections unchanged. These do not repair the baseline identity problem.

[Original pinned manifest](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/blob/exp/lapsim-physics-night-2026-11-10/scripts/sim/results/wec-consistent-rounds-2026-11-10/manifest.json)
