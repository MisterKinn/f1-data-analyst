# Historical status, superseded

## 14. Current status — 2026-11-10

Production is unchanged. No model has been adopted. No merge or Vercel action was made.
This status replaces the earlier continuation sections. Detailed history is in
[archive part one](archive/lapsim-physics-history-14-17-2026-11-10.md) and
[archive part two](archive/lapsim-physics-history-18-22-2026-11-10.md).

| Item | Current result |
|---|---|
| Standard WEC yardstick R | tolerance 1e-4, cap 2000; verified against 1e-6; maximum group change 0.001061 pp, no choice flips |
| Consistent candidate | Failed: pooled RMS 1.166709% control, 1.179080% candidate; n=33 |
| Round-five secondary arm | RMS 1.094332%, n=33; diagnostic only because B round five was not converged |
| B main fit | Converged at round 7; last decrease 0.344391%; held-out folds not needed for table export |
| Interlagos B grip | round 5: 0.9623445984; final: 0.9654634398; old table: 0.9823 |
| Production F1, existing logs only | Round 4: 23.9813; round 5: 23.6060; decrease 1.564969%; fails the 1% rule |
| Dry raced reproduction | WEC 33 rows and F1 39 rows; largest error 0 s |
| Wet WEC exclusion | Austin 2025: 3 class rows, reported separately |
| Model-matched BoP at R | Rejected: pooled 1.271006%, control 1.166709%, n=33 |
| Sector weight 2 retest at R | Rejected: pooled 1.196784%, control 1.166709%, n=33 |
| WEC follow-up caps / downforce | 0 cap hits; no class-season left its downforce bound |
| Hypercar 2025 trap RMS | control 11.023611, BoP 12.246551, sector2 11.015988 km/h; n=10 class-track rows |
| Dry Las Vegas candidate | Parked at the time box: main fits converged at 6 rounds; only 2/8 held-out folds complete per arm; dry 2024 raw error worsens from -0.143109 to -0.145542 s |
| Per-model Hypercar | Rejected: all-model pooled RMS 1.391909% → 1.314548%, n=22, but every class-best result is worse than production; 0 cap hits |
| Optional per-model LMGT3 | Parked: 2025 main and 2026 hidden-Austin fold hit cap 2000; 0 completed held-out folds |
| All-car inventory | 425 timed car-event rows; 389 dry; 204 model-event rows |
| Gear measurement | 41 team-season folds, 82 Monza laps; correct distance 79.857–83.439%; absolute gearbox ratios unverified |
| Production integrity | 45 runtime/gate files and 12 pinned inputs verified unchanged |
| Core PR review checks | Latest local tests 432/432; build and artifact validation passed; earlier GitHub workflow passed, latest-head CI unconfirmed |
| Review state | PR #154 ready for review; full experiment history saved separately; no merge |

Keep sector and trap flags off. Trap position and aero ratio remain on hold.
Interlagos stays on the dry geometry source, session 9865. Session 11408 was wet.
One geometry serves every series. The dry-source guard remains in draft PR #155.
Montreal and Zandvoort were not started in the used geometry time box. All three remain unchanged.
The old WEC baseline mismatch came from archive versus repository Interlagos geometry;
the exact historical recipe remains in physics rules section 5.2.

The shared wet-session helper and integration test keep fit and audit scopes equal, including
an audit called from another checkout with a different manual wet list.
The BoP model join uses exact season, event and entry identity, including leading zeros.
Unverified aero limits and event values stay blank; no prior, bound, weight or gate changed.
The fresh WEC control matches the earlier R control exactly for saved series values.
Small class-season gains below the declared minimum are not established.

The review branch contains reusable fitting/audit code, tests, derived tables and documentation.
Experiment runners, forced BoP fitting, model hierarchy and full result files stay on the
[experiment branch](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/tree/exp/lapsim-physics-night-2026-11-10). No experiment result directory is added to the core PR.
[Artifact index](archive/lapsim-experiment-index-2026-11-10.md) gives manifest hashes and source links.

See the [night report](lapsim-night-session-2026-11-10.md),
[consistent comparison](archive/lapsim-consistent-candidate-2026-11-10.md),
[WEC follow-up](archive/lapsim-wec-followup-2026-11-10.md),
[dry Vegas](archive/lapsim-dry-vegas-2026-11-10.md),
[model tests](archive/lapsim-wec-models-2026-11-10.md),
[fixed-input audit](lapsim-wec-fixed-inputs-2026-11-10.md),
[all-car inventory](lapsim-wec-all-car-inventory-2026-11-10.md), and
[gear measurements](lapsim-f1-gears-2026-11-10.md).
The [unseen-track plan](lapsim-unseen-track-plan.md) is a plan only; no fit was run.

Open decisions: keep production as baseline; decide later how to address its F1 convergence
failure and incomplete Las Vegas / LMGT3 validation. Hypercar is rejected.
Do not select the unconverged secondary table. All runs have ended; there is no model PR.
