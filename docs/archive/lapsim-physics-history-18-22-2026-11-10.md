# Historical physics record — 2026-11-10

This is the preserved record before the handoff was shortened. Decisions may have been replaced by the current [handoff](../lapsim-handoff-physics.md#14-current-status--2026-11-10). Local experiment runner/result paths in this record refer to the [experiment branch](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/tree/exp/lapsim-physics-night-2026-11-10), not the core review branch.


## 18. Owner decisions: geometry guard, tolerance yardstick, consistent candidate (2026-11-10)

This section supersedes the blocked disposition in section 17. The owner authorized these steps in order, with no adoption, model PR, merge or Vercel action. b2 remains rejected; trap and aero-ratio experiments remain on hold.

### 18.1 Geometry guard

Separate draft PR: https://github.com/MisterKinn/f1-data-analyst/pull/155 . It chooses the latest session with zero rain observations for each track, retaining existing geometry with a named warning if no eligible source exists. Missing weather is not zero-rain evidence. The owner explicitly deferred Las Vegas, Montreal and Zandvoort. Existing source identities retain their existing geometry bytes. Fetching also obtains full geometry-driver positions and matching-year corners for older sources. Trace projection uses the retained source, driver count and original projection settings.

All 26 repository geometry records are byte-identical in the builder retention integration fixture; Interlagos remains session 9865. Six guard tests pass, including all three requested cases. The latest guard commit, 34451d4bd01b14df57e8fa0ef2fd0d2b37a5cefd, passed the GitHub test check. This is not a claim that the complete raw telemetry pipeline was rerun. Detailed evidence and source links are in the separate PR's docs/lapsim-geometry-guard.md.

| Track | Source / year | Rain observations | Latest verified zero-rain alternative | Source fastest classified lap vs nearby dry pole | Decision |
|---|---|---|---|---|---|
| Las Vegas | 9854 / 2025 | 34/85 = 40% | 9640 / 2024: 0/98 | 107.934 vs 92.312 s (2024), 92.726 s (2023); +16.92% vs 2024 | Not dry-pole pace; retain under owner hold |
| Montreal | 11287 / 2026 | 1/76 = 1.32% | 9959 / 2025: 0/85 | 72.578 vs 70.899 s (2025); +2.37% | Dry-like pace plausible, not proven across 2026 car rules; retain |
| Zandvoort | 11349 / 2026 | 5/77 = 6.49% | 9916 / 2025: 0/78 | 71.163 vs 68.662 s (2025), 69.673 s (2024); +3.64% vs 2025 | Dry-like pace plausible, not proof of a dry session; retain |

Sources are OpenF1 weather?session_key=ID and session_result?session_key=ID under https://api.openf1.org/v1/ (queried 2026-11-10). The comparison uses minimum classified qualifying segment time and the pole winner's Q3 time, not unfiltered/deleted laps. Interlagos 11408 has 106/160 rain observations (66.25%); 9865 has 0/82. Without the guard, the next existing workflow would build from 11408 and push a refresh branch for review. It does not automatically replace main. No workflow was manually triggered.

### 18.2 Tolerance diagnostic — declaration before fitting

Two baseline variants, 1e-4 and 1e-6, factor 100 apart, use a cap of 2000 for both main fits and all folds. Stop only when the best-objective change over 10 iterations / max(1, absolute current best) and the largest log-parameter coordinate distance from the best simplex vertex are both below the tolerance. One deterministic initial simplex; no new restarts. The old rule remains unchanged when LAPSIM_WEC_NM_TOL is unset. LAPSIM_WEC_NM_CAP defaults to 2000.

Inputs are the exact PR #149 archive geometry, production seed and B transfer table, with the section 5.2 hashes checked before each isolated run. WEC only; timing flags off; lap weight 2 and trap weight 0.5. The looser tolerance is predeclared as R, never selected by held-out error. Stability requires all group RMS differences below 0.02 pp and no pooled/bop/gripSource flip. If only LMGT3 2026 fails, retain the owner's unstable label for that group and continue for the other five; if more than one fails, stop before the candidate. The step budget is 90 minutes. The runner uses 85 minutes after implementation/testing time and runs both tolerances plus an unset-flag 70/25 byte-identity control in parallel.

Command: node scripts/sim/run-wec-tolerance.mjs ; then node scripts/sim/report-wec-tolerance.mjs . The manifest and full-precision objective logs are under .cache/wec-tolerance during execution. No production file is overwritten. The full offline test suite passed 425/425, including raced-session reproduction. **Completed: all six groups pass. R = 1e-4, cap 2000.** Pooled RMS is 1.128290926% at R and 1.128032900% at 1e-6 (n=33). Runtime is 2189.383 s and 3260.580 s, respectively, in parallel with the identity control. The maximum group change is 0.001060723 pp; there are no choice flips, main cap hits or fold cap hits. This is within the 90-minute step budget.

| Group | Tolerance | RMS % | n / fitted laps | muY / ClA / CdA | Bound hits | pooled / bop / gripSource | Main iterations | Fold iterations min–max / total | Cap-hit folds / attempts | Seconds |
|---|---|---:|---|---|---|---|---:|---|---|---:|
| wec-lmh/2025 | 1e-4 (R) | 1.076057 | 5 / 15 | 1.569600 / 7.000000 / 1.093433 | clA upper | false / false / transfer | 86 | 71–139 / 1978 | 0 / 21 | 542.7 |
| wec-lmh/2026 | 1e-4 (R) | 1.061361 | 6 / 18 | 1.517814 / 6.635400 / 0.963661 | none | false / not available / transfer | 94 | 57–116 / 1515 | 0 / 19 | 504.7 |
| wec-lmdh/2025 | 1e-4 (R) | 1.270997 | 5 / 15 | 1.560082 / 7.000000 / 1.104771 | clA upper | false / false / transfer | 83 | 70–108 / 1812 | 0 / 21 | 405.2 |
| wec-lmdh/2026 | 1e-4 (R) | 0.983821 | 6 / 18 | 1.528665 / 6.445898 / 0.953756 | none | false / not available / transfer | 80 | 65–112 / 1539 | 0 / 19 | 513.2 |
| wec-lmgt3/2025 | 1e-4 (R) | 1.353040 | 5 / 15 | 1.590291 / 3.500000 / 1.286130 | clA upper | false / not available / transfer | 84 | 83–164 / 1646 | 0 / 16 | 88.1 |
| wec-lmgt3/2026 | 1e-4 (R) | 1.034709 | 6 / 23 | 1.607948 / 3.500000 / 1.295448 | clA upper | true / not available / transfer | 124 | 83–156 / 2236 | 0 / 20 | 134.3 |
| wec-lmh/2025 | 1e-6 | 1.075763 | 5 / 15 | 1.569541 / 7.000000 / 1.093527 | clA upper | false / false / transfer | 158 | 107–211 / 2994 | 0 / 21 | 826.0 |
| wec-lmh/2026 | 1e-6 | 1.061814 | 6 / 18 | 1.517698 / 6.637300 / 0.963595 | none | false / not available / transfer | 170 | 91–196 / 2712 | 0 / 19 | 815.1 |
| wec-lmdh/2025 | 1e-6 | 1.269937 | 5 / 15 | 1.560087 / 7.000000 / 1.104788 | clA upper | false / false / transfer | 137 | 110–183 / 2795 | 0 / 21 | 678.2 |
| wec-lmdh/2026 | 1e-6 | 0.983578 | 6 / 18 | 1.528661 / 6.445959 / 0.953750 | none | false / not available / transfer | 106 | 92–217 / 2359 | 0 / 19 | 629.3 |
| wec-lmgt3/2025 | 1e-6 | 1.353058 | 5 / 15 | 1.590309 / 3.500000 / 1.286084 | clA upper | false / not available / transfer | 124 | 122–220 / 2364 | 0 / 16 | 80.5 |
| wec-lmgt3/2026 | 1e-6 | 1.034249 | 6 / 23 | 1.608032 / 3.500000 / 1.295257 | clA upper | true / not available / transfer | 174 | 122–247 / 3555 | 0 / 20 | 230.1 |

| Group | Tight minus loose (pp) | Choice flip | Stable |
|---|---:|---|---|
| wec-lmh/2025 | -0.000294415 | false | true |
| wec-lmh/2026 | 0.000452628 | false | true |
| wec-lmdh/2025 | -0.001060723 | false | true |
| wec-lmdh/2026 | -0.000242746 | false | true |
| wec-lmgt3/2025 | 0.000017565 | false | true |
| wec-lmgt3/2026 | -0.000459710 | false | true |

Iterations and cap counts include every F1/transfer/pooled/BoP candidate fold, not only selected folds. Full precision and all candidate errors are preserved in scripts/sim/results/wec-tolerance-2026-11-10/results.json. LMGT3 2026 is stable under the two tested tolerances; both choose pooled + transfer. Its new CdA is inside its bound, while ClA remains at 3.5. Thus the conditional unstable exception is not needed. This does not prove a unique physical solution.

Unset-flag control reproduced production exactly except generatedAt and matched the original-source calibration, validation JSON and stdout byte-for-byte. Runtime bootstrap stderr has a process ID and is excluded from byte comparisons. The gate and all 44 production runtime files remain unchanged. Identity hashes, tests, validation, full objective logs (lossless gzip) and source hashes are archived alongside the results. The latest code checkpoint also passed GitHub tests.

LMGT3 2026's **production** car is at ClA=3.5 and CdA=1.3. Earlier higher-iteration fits had CdA slightly inside its bound. Later tables must show actual bound hits rather than assume every fitted candidate remains at both bounds.

### 18.3 Consistent candidate

Step 2 established R for all six groups. The following comparison was declared before candidate fitting. Repository geometry everywhere; rebuild B with production F1 settings and per-track drag off; restore unchanged production F1 seasons before WEC fitting. Current control and candidate are both measured at R. The candidate is not adopted. Pass requires raced-session reproduction, unchanged F1 seasons and pooled WEC no worse. The geometry/projection inputs must match; archive Interlagos traces cannot silently be reused on repository geometry.

A prior geometry-only difference moved LMDh 2025 by 0.37 pp. With n=5 or 6, an apparent gain below about 0.1 pp remains unestablished even if the gate accepts it. This caution will be repeated next to the result. The two open questions in section 17.4 remain questions, not additional experiments.


Step 3 execution declaration: current-configuration control = repository geometry + current B, refit/measured at R; candidate = repository geometry + rebuilt B, refit/measured at R. Frozen production cars are replayed separately and are not confused with the refitted control. B uses LAPSIM_SKIP_WEC=1 LAPSIM_FITTER=bcd LAPSIM_ROUNDS=5 LAPSIM_BCD_ITERS=200 LAPSIM_WTIME=20 LAPSIM_WSECTOR=2 LAPSIM_TRACK_DRAG=off LAPSIM_TEAMS=on LAPSIM_WPRIOR=8; all other LAPSIM variables cleared. Run calibrate.mjs then transfer-grip.mjs on its isolated artifact. B rebuild estimated 3–4 hours from the historical job, followed by WEC fits at R. Timing flags off; WEC lap/trap weights remain 2/0.5. F1 production seasons/projections are restored unchanged before either WEC fit. Any telemetry projection replacement must match the same original measured laps and reproduce the retained geometry; no new fitting rows are silently added.

Input preparation passed: rebuilding source 9865 from 14 original laps / 3707 positions reproduces repository ds, length, sectors, kappa and grade exactly. The repository heading/map/corners are retained verbatim; only projection distance arrays are recovered. All 40 Interlagos trace identities and non-distance fields match the pinned archive exactly; all 845 other trace rows are unchanged. The three wet Interlagos seasons remain excluded. The new trace hash is 36a1f55ac59e73f05abf4144ea08d1c2cdb7d8b78854d7de19e99a83f4f64413. Derived distance overrides and the audit are saved under scripts/sim/results/wec-consistent-2026-11-10; raw API responses remain outside git. The run started 2026-11-10T11:19:02Z and was interrupted before either arm completed. See the stop below.


### 18.4 Step 3 stopped: historical audit scope, not an established model regression

At approximately 11:23 UTC, an expanded historical reproduction assertion failed on frozen production. The public WEC API selects only the latest calibrated season, so the audit selected older seasons in memory and restored the calibration afterward. It used all rows in wec-poles-data.js, which still contains Austin 2025 with rain=false. This was an audit-scope error: scripts/sim/data/wet-sessions.json already excludes 2025 Austin as wet, and it is absent from the fitted 2025 calibration tracks. The fitting input itself respected that exclusion.

| Group | Historical rows checked | Austin 2025 error (s) | Verified dry n | Maximum verified dry reproduction error (s) |
|---|---:|---:|---:|---:|
| LMH 2025 | 6 | +0.028 | 5 | 0.000 |
| LMH 2026 | 6 | not applicable | 6 | 0.000 |
| LMDh 2025 | 6 | +0.068 | 5 | 0.000 |
| LMDh 2026 | 6 | not applicable | 6 | 0.000 |
| LMGT3 2025 | 6 | +0.168 | 5 | 0.000 |
| LMGT3 2026 | 6 | not applicable | 6 | 0.000 |

The historical assertion used the existing reproduction tolerance of 0.0015 s. All 33 verified dry rows reproduce exactly at the public result precision; all three public latest-season groups pass. The three failed cases are outside the dry-session scope and outside the public historical selector (which does not exist). They do not establish a new production regression. No model value, test threshold, wet exclusion or gate was changed to resolve the failure.

Section 5.3 says to stop after a raced-session reproduction test fails. The B rebuild and control were stopped; B completed one round (score 37.3313), but produced no completed transfer table. The control produced no completed class-season report. The candidate arm had not started. There are therefore **no candidate held-out errors, car values, choices or candidate Interlagos replay errors to report**, and no candidate pass/fail decision. Partial logs are explicitly named partial and preserved; no values were adopted. The existing frozen-production Interlagos replay in section 16 remains historical evidence, not a new candidate comparison.

Resume decision requested: apply the existing wet-sessions.json exclusions to the historical audit, then rerun the same declared candidate at R in fresh isolated directories. Do not alter the production pole table or model in this code PR. All six tolerance groups remain stable; b2 remains rejected; no model PR, merge or Vercel action.


## 19. Approved restart and execution-environment interruption (2026-11-10)

The owner approved applying the existing manual wet exclusions and rain-marked-row exclusions to the historical audit. Add a shared exclusion path and a regression test that prevents the fit and audit from diverging. Dry raced rows must reproduce exactly; report n and maximum error. Austin 2025 must be listed separately as excluded wet data. This approval supersedes the decision request in section 18.4; no new approval to resume is required.

R = 1e-4 with cap 2000 is accepted as the standard for all future WEC experiments. Section 5.1 of lapsim-physics-rules.md now records the factor-100 tolerance comparison, <0.02 pp in every group, and no pooled/bop/gripSource choice flips.

The candidate and pass check are unchanged: repository geometry everywhere; rebuild B using production F1 settings with per-track drag off; refit WEC at R. Compare the current-configuration control and candidate at R, with frozen production replay separately identified. Report held-out RMS, n, fitted cars, bound hits, choices, dry raced-session reproduction and Interlagos replay per class-season. Pass requires exact dry reproduction, unchanged F1 seasons and pooled WEC no worse. No adoption, model PR, merge or Vercel action.

**Execution interruption:** the connected PC environment became unavailable while applying the shared-exclusion edit. The edit tool returned "Transport closed"; the subsequent shell check returned "No usable execution environment is available." Local edit persistence is unverified. No new test run or candidate restart is claimed. GitHub remains available, so this documentation update is saved to PR #154. On reconnection, inspect local files before applying edits again, add and run the exclusion regression test, verify frozen dry reproduction, and restart in fresh isolated directories while preserving the prior stopped artifacts. The earlier completed tolerance results remain valid; there is no new candidate result yet.


## 20. GitHub-only restart: shared dry scope and consistent candidate (2026-11-10)

Fresh checkout of PR #154 at df3d65819db9be74f5941ddda83d1b0a94a00841. Read canonical main AGENTS.md and physics rules first, then handoff sections 14–19 and PR #155 at 34451d4bd01b14df57e8fa0ef2fd0d2b37a5cefd. The latest handoff, the WEC tolerance stop implementation and section 5.1 convergence rule are present. No prior-PC files were used. The pinned archive downloaded from its recorded GitHub URL and matched SHA-256; all input checks are recorded in verified-inputs.json. The committed distance override and original measurements reproduce the prepared trace checksum before fitting. Node 22.23.4 is used.

Calibration and the historical audit now call the same splitWecSessions function, which reads wet-sessions.json and also excludes rain-marked rows. The integration test runs both real entry points on a small fixture, then changes the manual list and confirms both scopes change together. Raw observations and production pole tables are unchanged. Historical reproduction requires exact equality at the public result precision; the existing production test thresholds are unchanged.

| Frozen production group | Dry rows | Largest absolute reproduction error s | Wet rows excluded |
|---|---:|---:|---:|
| LMH 2025 | 5 | 0.000 | 1 (Austin) |
| LMH 2026 | 6 | 0.000 | 0 |
| LMDh 2025 | 5 | 0.000 | 1 (Austin) |
| LMDh 2026 | 6 | 0.000 | 0 |
| LMGT3 2025 | 5 | 0.000 | 1 (Austin) |
| LMGT3 2026 | 6 | 0.000 | 0 |
| Total | 33 | 0.000 | 3 |

Preflight: 427/427 offline tests pass; build and artifact validation pass. The first full-suite attempt could not import missing dependencies; after npm ci from the unchanged lockfile, all tests passed. This was an environment setup failure, not a reproduction failure. Section 5.1 already contains the requested factor-100, <0.02 pp and no-choice-flip rule, so no duplicate rule was added.

Execution declaration remains section 18.3: repository geometry for both arms; current B for control; production-settings F1 B rebuild without per-track drag for candidate; unchanged production F1 seasons/projections restored for WEC; R=1e-4, cap 2000 in both arms. Frozen production replay is separate. Timing flags stay off. The saved estimate remains 3–4 hours for B plus WEC; no shorter fit is substituted. Fresh output is .cache/wec-consistent-resume; prior partial artifacts are preserved. Run prepare-wec-consistent.mjs with the pinned archive, then run-wec-consistent.mjs. No adoption, model PR, merge or Vercel action.

The isolated run started after preflight. B and the control are running; the candidate arm waits for rebuilt B. The later stop is recorded in section 21.

The audit reads weather from the same cached session rows as the fit, not from potentially stale pole-table flags. The integration test deliberately gives the pole table a stale dry flag while marking that session wet only in the fit input. Both entry points exclude it; changing the manual exclusion file also changes both scopes together. Historical assertions run again after each WEC arm. This audit-only follow-up was copied into the isolated arms before their historical checks; the active fitting source and inputs did not change. The shell Git push lacked credentials, so checkpoint publication uses the connected GitHub API with an expected-head check.

The audit also refuses different fit/pole-table session inventories, so an added or missing session cannot silently escape the comparison. The regression fixture covers this failure. Frozen F1 public reproduction is exact too: 2025 has 22 dry rows and 2026 has 17, both with maximum absolute error 0.000 s. These reproduction counts differ from held-out counts. The report helper passed an identical-variant smoke check against the saved tolerance evidence; this is a reporting check, not a new fit.


## 21. Consistent candidate stopped: B production settings fail F1 convergence (2026-11-10)

**Stopped; no candidate decision.** The requested fixed production settings for the F1 B rebuild conflict with the standing F1 BCD convergence check in physics rules section 5.1. Section 5 requires convergence before continuing a long run; section 5.3 requires stopping for a rule conflict. No exception to F1 B convergence was recorded in the approved restart. The accepted WEC tolerance rule is unaffected. Do not mistake this F1 issue for a failure of the completed WEC tolerance diagnostic.

The first B main-fit block completed its prescribed rounds but its last score decrease exceeds the limit. Values below are read directly from this run's stdout, rounded there to four decimals. That rounding cannot explain the difference from the limit. No round count, bound, weight or gate was changed after seeing this.

| Check | Value | Result |
|---|---:|---|
| B main rounds / iterations per car fit | 5 / 200 | Requested production settings |
| Main round 1 score | 37.3313 | Recorded |
| Main round 2 score | 28.8612 | Recorded |
| Main round 3 score | 27.0969 | Recorded |
| Main round 4 score | 26.5435 | Recorded |
| Main round 5 score | 26.1867 | Recorded |
| Last-round relative decrease | 1.344209% | Fails |
| Required relative decrease | <1% | Existing F1 rule |
| WEC R / iteration cap | 1e-4 / 2000 | Unchanged |
| Frozen WEC dry reproduction | 33 rows; max 0.000 s | Exact |
| Austin 2025 wet exclusions | 3 class rows | Excluded; not failures |
| Frozen F1 2025 dry reproduction | 22 rows; max 0.000 s | Exact |
| Frozen F1 2026 dry reproduction | 17 rows; max 0.000 s | Exact |

The B rebuild and the control process were interrupted together. The execution session returned exit code 130, and the log hashes stopped changing. B had begun a later fit block but had not produced a completed calibration or transfer table. The control had completed four Hypercar group events, with no cap hit in the partial logs, and had reached LMGT3. It had not written a completed calibration. The candidate WEC arm never started. These partial events are retained as evidence only, not a valid paired result. No full held-out comparison, candidate cars/bounds/choices, candidate reproduction or candidate Interlagos replay is available. No candidate pass or rejection is claimed.

The GitHub-only input recovery succeeded; this stop is not a download or runtime-access failure. The archive, raw/preprocessed WEC rows, archive/repository geometries, original/reprojected traces, production seed, current B table, Timing71 input, distance overrides, projection audit and accepted tolerance-result hashes were checked before fitting. All 44 production runtime files and gate.mjs remain byte-identical to the starting PR branch. No production values or geometry were written, and no model PR, merge or Vercel action occurred.

Evidence: [wec-consistent-resume-2026-11-10](../scripts/sim/results/wec-consistent-resume-2026-11-10/), especially stopped.json, the explicitly partial compressed logs, the dry reproduction reports, verified-inputs.json, production-integrity.json and sha256.json. The shared exclusion test, offline test logs, build and validation evidence are preserved there. Section 5.1 already contains the requested WEC convergence rule; it was verified, not duplicated.

**One decision needed:** may B use more rounds to meet the existing F1 convergence rule, with every other setting unchanged? Do not restart or change the fixed round setting before that decision. WEC R remains accepted, b2 stays rejected, trap/aero-ratio experiments remain on hold, and the three deferred geometry sources remain unchanged.

Final verification after the audit inventory guard: 427/427 offline tests pass. Build and artifact validation had already passed; no application or build source changed afterward. Compressed final test output is final-tests.log.gz.


## 22. B main-fit continuation and consistent candidate (2026-11-10)

Owner approval supersedes section 21's stop: only B's round count may increase. The main fit stops after at least five rounds when its last score decrease is nonnegative and strictly below 1%, with a cap of ten. Existing warm-start variables (`xs`, `factors`, `adj`) continue one round at a time; a regression test verifies exact agreement with an uninterrupted fit. The interrupted run had no saved fit state, so one required B rerun starts from the original inputs. Full round states and scores are saved after each round. The existing outlier removal rule is unchanged.

B exports only track grips; no held-out folds are needed for this export. They are not run and no held-out convergence is claimed. All other B settings remain fixed at the section 21 values. A round-five table saved during this required run supplies a secondary WEC arm only if its outlier exclusions match the final first-pass exclusions; otherwise that arm is skipped because it would require another B run.

Declared arms: control = current production configuration refit at R with the existing B table; candidate = rebuilt converged B table and WEC at R; secondary = saved round-five B and WEC at R if available. All use repository geometry and the unchanged production F1 seasons/projections. R stays tolerance 1e-4, cap 2000, timing flags off. The pinned archive, all source inputs, trace reprojection, production seed and accepted tolerance evidence are hash-checked before fitting. No values are adopted. Production F1 is inspected from existing GitHub Actions logs only.

Results: completed; declared candidate fails. See the tables below. Evidence directory: `scripts/sim/results/wec-consistent-rounds-2026-11-10/`.

### 22.1 Existing production F1 log: convergence report only

Recovered [run 42398451242, job 128480815235](https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42398451242/job/128480815235). It used drag on and the production settings. Its generated commit `b47dce48cde2e47920866938612d922e93f7b73e` has exactly the same F1 seasons and projections as production source `9fb675e2cb60de4ee5e2d395af5acabf45740e73` and this branch's frozen production. This identity was checked on the full objects, not inferred from similar scores. Scores below have the original log's four-decimal precision. No F1 fit was rerun.

| Production F1 check | Previous round score | Final round score | Decrease | Rule result |
|---|---:|---:|---:|---|
| Main, rounds 4 → 5 | 23.9813 | 23.6060 | 1.56497% | Fails |
| Held-out fold 1, rounds 3 → 4 | 25.4832 | 24.6638 | 3.21545% | Fails |
| Held-out fold 2, rounds 3 → 4 | 24.4686 | 23.8289 | 2.61437% | Fails |
| Held-out fold 3, rounds 3 → 4 | 24.3002 | 23.5678 | 3.01397% | Fails |
| Held-out fold 4, rounds 3 → 4 | 24.2573 | 23.7102 | 2.25540% | Fails |
| Held-out fold 5, rounds 3 → 4 | 24.8383 | 24.1357 | 2.82870% | Fails |
| Held-out fold 6, rounds 3 → 4 | 24.8380 | 23.9704 | 3.49303% | Fails |
| Held-out fold 7, rounds 3 → 4 | 23.6660 | 22.8794 | 3.32376% | Fails |
| Held-out fold 8, rounds 3 → 4 | 24.0839 | 23.3470 | 3.05972% | Fails |

`production-f1-convergence.json` records all round scores, source hashes and identity checks; `production-f1-log-excerpt.txt` preserves the relevant original log lines. This is report only. The owner will decide any later F1 action.

Before the new fit, the full offline test suite passed 429/429, including the shared wet-scope regression and exact warm-start parity test. Build and artifact validation passed. R, all pinned input hashes and the latest handoff were checked before starting.

### 22.2 B rounds and saved transfer tables

The required rerun continued from each saved round state. B held-out folds were not run because the transfer exporter does not use them. No convergence claim is made for those folds. The first five printed scores were checked against the stopped run.

| Phase | Round | Score | Decrease (%) | Interlagos grip (unrounded) |
|---|---|---|---|---|
| 1 | 1 | 37.331252429 | — | 0.947605643 |
| 1 | 2 | 28.861197702 | 22.688911 | 0.953571463 |
| 1 | 3 | 27.096892536 | 6.113070 | 0.958617854 |
| 1 | 4 | 26.543546564 | 2.042101 | 0.961360991 |
| 1 | 5 | 26.186742181 | 1.344223 | 0.962344598 |
| 1 | 6 | 25.713567195 | 1.806926 | 0.965567282 |
| 1 | 7 | 25.625011965 | 0.344391 | 0.965463440 |

Round-five snapshots saved during the required rerun; same outlier exclusion set.

| Exported Interlagos factor | Current table | Round five | Final | Final − round five |
|---|---|---|---|---|
| Rounded table value | 0.9823 | 0.9623 | 0.9655 | 0.0032 |

### 22.3 Paired WEC result at R

Control means current production inputs refitted at R with the existing B table. Candidate uses the converged B table. Secondary uses the saved round-five B table. All use repository geometry, tolerance 1e-4 and cap 2000. The frozen production replay is reported separately. Full-precision predictions drive the comparisons; all car fields and selection candidates are saved in results.json.

| Arm | Group | Held-out RMS (%) | n | μy | ClA (m²) | CdA (m²) | Mass (kg) | Power (kW) | Bounds | pooled / bop / gripSource |
|---|---|---|---|---|---|---|---|---|---|---|
| control | wec-lmh/2025 | 1.112168 | 5 | 1.566682 | 7.000000 | 1.085898 | 1120.0 | 500.000 | clA upper | true / false / f1 |
| control | wec-lmh/2026 | 1.110032 | 6 | 1.521487 | 6.551861 | 0.964469 | 1120.0 | 500.000 | none | false / none / transfer |
| control | wec-lmdh/2025 | 1.281673 | 5 | 1.558905 | 7.000000 | 1.104641 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| control | wec-lmdh/2026 | 1.055043 | 6 | 1.530347 | 6.398381 | 0.953725 | 1120.0 | 500.000 | none | false / none / transfer |
| control | wec-lmgt3/2025 | 1.377708 | 5 | 1.589234 | 3.500000 | 1.285003 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| control | wec-lmgt3/2026 | 1.077016 | 6 | 1.608860 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | true / none / transfer |
| candidate | wec-lmh/2025 | 0.994992 | 5 | 1.569174 | 7.000000 | 1.090870 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| candidate | wec-lmh/2026 | 1.158233 | 6 | 1.568847 | 5.823316 | 0.976345 | 1120.0 | 500.000 | none | false / none / transfer |
| candidate | wec-lmdh/2025 | 1.268680 | 5 | 1.560749 | 7.000000 | 1.105001 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| candidate | wec-lmdh/2026 | 1.157331 | 6 | 1.570276 | 5.804265 | 0.964333 | 1120.0 | 500.000 | none | false / none / transfer |
| candidate | wec-lmgt3/2025 | 1.361022 | 5 | 1.591092 | 3.500000 | 1.284597 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| candidate | wec-lmgt3/2026 | 1.120445 | 6 | 1.621114 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | false / none / transfer |
| secondary | wec-lmh/2025 | 0.941279 | 5 | 1.570862 | 7.000000 | 1.090099 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| secondary | wec-lmh/2026 | 1.082699 | 6 | 1.578688 | 5.668301 | 0.976340 | 1120.0 | 500.000 | none | false / none / transfer |
| secondary | wec-lmdh/2025 | 1.221450 | 5 | 1.563042 | 7.000000 | 1.105927 | 1120.0 | 500.000 | clA upper | false / false / transfer |
| secondary | wec-lmdh/2026 | 1.075989 | 6 | 1.574504 | 5.739056 | 0.963723 | 1120.0 | 500.000 | none | false / none / transfer |
| secondary | wec-lmgt3/2025 | 1.336136 | 5 | 1.592236 | 3.500000 | 1.280354 | 1400.0 | 380.000 | clA upper | false / none / transfer |
| secondary | wec-lmgt3/2026 | 0.887280 | 6 | 1.612133 | 3.500000 | 1.300000 | 1400.0 | 380.000 | clA upper, cdA upper | true / none / transfer |

| Group | Candidate − control (pp) | Gate | Choice flip |
|---|---|---|---|
| wec-lmh/2025 | -0.117176 | accepted: held-out error lower beyond noise | yes |
| wec-lmh/2026 | 0.048201 | rejected: worse on held-out rows | no |
| wec-lmdh/2025 | -0.012993 | rejected: gain within noise | no |
| wec-lmdh/2026 | 0.102288 | rejected: worse on held-out rows | no |
| wec-lmgt3/2025 | -0.016686 | rejected: gain within noise | no |
| wec-lmgt3/2026 | 0.043429 | rejected: worse on held-out rows | yes |

| Pooled held-out rows | Control RMS (%) | Candidate RMS (%) | Round-five RMS (%) | Final − round-five (pp) | Gate |
|---|---|---|---|---|---|
| 33 | 1.166709 | 1.179080 | 1.094332 | 0.084748 | rejected: worse on held-out rows |

| Group | Round five − control (pp) | Final − round five (pp) | Round-five gate |
|---|---|---|---|
| wec-lmh/2025 | -0.170888 | 0.053712 | accepted: held-out error lower beyond noise |
| wec-lmh/2026 | -0.027333 | 0.075534 | rejected: gain within noise |
| wec-lmdh/2025 | -0.060223 | 0.047230 | rejected: gain within noise |
| wec-lmdh/2026 | 0.020946 | 0.081342 | rejected: worse on held-out rows |
| wec-lmgt3/2025 | -0.041573 | 0.024887 | rejected: gain within noise |
| wec-lmgt3/2026 | -0.189736 | 0.233165 | accepted: held-out error lower beyond noise |

The declared primary candidate fails because pooled WEC error rises. The saved round-five arm lowers pooled error, but remains diagnostic: its B main fit fails the agreed convergence rule. The extra B rounds lower the F1 training score while making WEC held-out error higher in every group. No arm is substituted after seeing the held-out results.

With held-out n=5/6, a gain below about 0.1 pp remains unestablished even if the unchanged gate accepts it. No model or values are adopted.

### 22.4 Dry raced-session audit and Interlagos replay

The fit and audit share wet-sessions.json plus rain-marked rows. The audit checks the public result exactly at its reported precision. The physics replay below uses the season car, saved track grip and weather. It bypasses the raced-session correction and any per-event BoP patch; it is a separate diagnostic. results.json also stores the original fitted track residual.

| Arm | Dry WEC rows | Largest absolute error (s) | Excluded wet rows |
|---|---|---|---|
| control | 33 | 0.000 | 3 |
| candidate | 33 | 0.000 | 3 |
| secondary | 33 | 0.000 | 3 |

| Group | Dry raced rows | Control max error (s) | Candidate max error (s) | Round-five max error (s) |
|---|---|---|---|---|
| wec-lmh/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmh/2026 | 6 | 0.000 | 0.000 | 0.000 |
| wec-lmdh/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmdh/2026 | 6 | 0.000 | 0.000 | 0.000 |
| wec-lmgt3/2025 | 5 | 0.000 | 0.000 | 0.000 |
| wec-lmgt3/2026 | 6 | 0.000 | 0.000 | 0.000 |

| Excluded group | Track | Reason |
|---|---|---|
| wec-lmh/2025 | austin | wet-sessions.json |
| wec-lmdh/2025 | austin | wet-sessions.json |
| wec-lmgt3/2025 | austin | wet-sessions.json |

| Group | Frozen production error (s) | Control R error (s) | Candidate R error (s) | Round-five R error (s) |
|---|---|---|---|---|
| wec-lmh/2025 | -0.322721 | -0.280787 | -0.494593 | -0.424751 |
| wec-lmh/2026 | -0.919871 | -0.902545 | -0.460589 | -0.365165 |
| wec-lmdh/2025 | -0.440449 | -0.373878 | 0.155082 | 0.218164 |
| wec-lmdh/2026 | -0.577043 | -0.558115 | -0.094176 | 0.008934 |
| wec-lmgt3/2025 | -1.114375 | -1.093671 | -0.583736 | -0.513114 |
| wec-lmgt3/2026 | -1.503135 | -1.364714 | -1.071678 | -0.787288 |

F1 seasons and projections are exactly unchanged in every arm. The frozen dry F1 audit reproduces exactly.

| F1 dry audit | Rows | Maximum absolute error (s) |
|---|---|---|
| 2025 | 22 | 0.000 |
| 2026 | 17 | 0.000 |

| F1 group | Held-out RMS (%) | Held-out n | Interlagos replay error (s) | Wet Interlagos excluded |
|---|---|---|---|---|
| f1/2023 | — | 0 | — | yes |
| f1/2024 | — | 0 | — | yes |
| f1/2025 | 0.839655 | 20 | 0.099256 | no |
| f1/2026 | 0.899973 | 14 | — | yes |

### 22.5 Physical diagnostics, stopping and pass checks

WEC corner measurements are unavailable. The trap diagnostic is simulated lap maximum minus the measured trap, not a verified trap-position comparison. A positive change below is worse.

| Group | Control trap RMS (km/h) | Candidate trap RMS (km/h) | Change (km/h) | New bound hits |
|---|---|---|---|---|
| wec-lmh/2025 | 10.002800 | 10.050572 | 0.047773 | none |
| wec-lmh/2026 | 3.366007 | 3.377573 | 0.011567 | none |
| wec-lmdh/2025 | 11.957592 | 11.917131 | -0.040461 | none |
| wec-lmdh/2026 | 3.406171 | 3.463524 | 0.057353 | none |
| wec-lmgt3/2025 | 5.818419 | 5.823916 | 0.005497 | none |
| wec-lmgt3/2026 | 8.295682 | 8.222733 | -0.072949 | none |

| Arm | Group | Main iterations | Fold iteration range | Fit attempts in folds | Cap hits |
|---|---|---|---|---|---|
| control | wec-lmh/2025 | 86 | 74–119 | 22 | 0 |
| control | wec-lmh/2026 | 73 | 51–93 | 19 | 0 |
| control | wec-lmdh/2025 | 71 | 68–162 | 21 | 0 |
| control | wec-lmdh/2026 | 68 | 58–112 | 19 | 0 |
| control | wec-lmgt3/2025 | 120 | 62–130 | 16 | 0 |
| control | wec-lmgt3/2026 | 103 | 76–148 | 20 | 0 |
| candidate | wec-lmh/2025 | 79 | 72–119 | 21 | 0 |
| candidate | wec-lmh/2026 | 64 | 64–95 | 19 | 0 |
| candidate | wec-lmdh/2025 | 88 | 58–118 | 21 | 0 |
| candidate | wec-lmdh/2026 | 76 | 58–141 | 19 | 0 |
| candidate | wec-lmgt3/2025 | 94 | 62–119 | 16 | 0 |
| candidate | wec-lmgt3/2026 | 92 | 78–190 | 20 | 0 |
| secondary | wec-lmh/2025 | 80 | 70–137 | 21 | 0 |
| secondary | wec-lmh/2026 | 67 | 62–95 | 19 | 0 |
| secondary | wec-lmdh/2025 | 90 | 68–122 | 21 | 0 |
| secondary | wec-lmdh/2026 | 81 | 58–112 | 19 | 0 |
| secondary | wec-lmgt3/2025 | 99 | 62–121 | 16 | 0 |
| secondary | wec-lmgt3/2026 | 83 | 83–127 | 20 | 0 |

| Check | Primary candidate | Round-five secondary |
|---|---|---|
| dryReproduction | PASS | PASS |
| f1Unchanged | PASS | PASS |
| pooledWecNotWorse | FAIL | PASS |
| noCapHits | PASS | PASS |
| declaredCandidatePass | FAIL | Diagnostic only; B convergence fails |

The declared pass is separate from the full statistical and physical checks above. Production F1 still fails the score convergence rule in section 22.1; it was not rerun. The owner will decide any later F1 work.

Geometry remains unchanged: Interlagos uses dry session 9865 (2025). Las Vegas 9854 (2025), Montreal 11287 (2026), and Zandvoort 11349 (2026) remain rain-marked sources on hold. PR #155 remains separate. Sector objective b2 stays rejected and off; trap position and aero ratio remain on hold. No production, bounds, weights, gate or geometry changes; no model PR, merge or Vercel action.

Evidence: scripts/sim/results/wec-consistent-rounds-2026-11-10/. Input checks, full-precision results, saved tables, derived calibrations, compressed objective logs, reproduction audits, source hashes and production integrity checks are included.

Fresh-checkout recipe (Node 22.23.4; archive saved one directory above the checkout):

```sh
node scripts/sim/prepare-wec-consistent.mjs ../lapsim-inputs.tgz
node scripts/sim/run-wec-consistent.mjs
node scripts/sim/report-wec-consistent.mjs
node scripts/sim/archive-wec-consistent.mjs
```

The runners refuse existing run directories. Use a fresh checkout for reproduction. Per-round B snapshots contain xs, factors and adj for the fitter warm-start API; they are derived state, not replacement inputs.
