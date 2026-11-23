# I4 phase 1 — do track covariates explain the F1 grip factor? (2026-11-23)

Pre-registration: Project `claude/gate-i4-covariates-prereg-2026-11-23.md` (attempt 1, m = 1, amendment 1 before the run).
Ledger: `docs/gate-ledger.md`, row I4 2026-11-23. No production change: nothing in `worker/lapsim/` is read differently.

## Result

**These covariates do not explain the grip factor beyond noise.** Both tests fail; the model is slightly worse than level C.

| Test | Tracks / rows | Level C RMS (median abs) | Model RMS (median abs) | Mean gain per track (%², 90 % bootstrap) | Sign-flip p | Pass |
|---|---|---|---|---|---|---|
| A: leave one track out | 26 / 40 | 2.999 % (2.363) | 3.050 % (2.719) | −0.50 [−2.92, +1.52] | 0.61 | no |
| B: forward chaining (date order, earlier events only) | 26 / 39 | 3.003 % (2.272) | 3.108 % (2.833) | −1.22 [−3.51, +0.53] | 0.78 | no |

Diagnostic (does not decide): grip = 1 gives 2.902 % on the test A rows, 0.10 pp better than the season mean of the other tracks.

Full fit on all 26 tracks (ln grip, per 1 SD of the covariate, 90 % posterior interval):

| Covariate | Effect | 90 % interval |
|---|---|---|
| surface age | −2.1 % | −4.2 to −0.0 % |
| street / temporary | −0.1 % | −2.2 to +2.0 % |
| Pirelli softness | +0.9 % | −1.3 to +3.1 % |
| qualifying rubber evolution | −1.9 % | −3.8 to +0.1 % |

Surface age has an in-sample sign (older asphalt, less grip), but it does not hold out of sample. A model that wins only in-sample is a fail.

## Remaining spread (the honest ± for a track that never ran)

- Track random effect τ = 0.065 in ln grip (raw spread of the factors 0.069; covariates explain at most about 12 % of the variance in-sample).
- Lap-time sensitivity on these rows: median −35 % lap time per unit ln grip (IQR −41 to −29), so τ ≈ **±2.3 % lap time (1σ) from grip alone**.
- Level C total on the same rows: 3.0 % RMS. Rough error budget: grip residual ≈ 2.3² / 3.0² ≈ 60 % of the variance; the rest is the drag
  factor and other per-track terms (not split here).

## Re-run after I3 (one command)

```
node scripts/sim/i4-test.mjs
```

It rebuilds the covariate table from the current repo data (`scripts/sim/data/i4-covariates.json`), reads the current
`worker/lapsim/calibration-data.js` factors, runs tests A and B (about 1 min) and writes `scripts/sim/data/learn/i4-test.json`.
A run on new factors is a re-run of the same pre-registration (new ledger line), not a new attempt. Synthetic check of the fit:
`node --test tests/i4-fit.test.mjs`.

## Covariate table (2025 / 2026 values, sources)

Unknown cells are "unknown" or "?". Surface basis "opening" = no later full resurfacing found (not proof that none happened). Pirelli 1–5
circuit ratings were not collected in phase 1 (not used by the model). Evolution: `worker/lapsim/evolution-data.js` (official lap data).
Softness: `worker/lapsim/compounds-data.js`. Weather: page session weather. iRacing: `surface-learned-data.js`, `track-bumps-data.js`.
Full per-season rows with every source: `scripts/sim/data/i4-covariates.json`.

| Track | Seasons | Grip | Surface age (yr) | Surface basis | Street | Pirelli softness | Evolution 60 min (%) | Track temp °C | Pressure hPa | iRacing rough | iRacing bump idx |
|---|---|---|---|---|---|---|---|---|---|---|---|
| melbourne | 2025, 2026 | 1.0836 | 3 / 4 | [full](https://downergroup.com/The%20Australian%20Grand%20Prix%20Track%20gets%20a%20Downer%20Revamp) | 1 | 4 / 4 | 1.42 | 41 / 31.8 | 1009.1 / 1013.6 | unknown | unknown |
| shanghai | 2025, 2026 | 1.0582 | 1 / 2 | [full](https://dynapac.com/en/news/dynapac-fleet-successful-completed-china-shanghai-f1-project-in-september-2) | 0 | 3 / 3 | 1.88 | 36.9 / 29.8 | 1015 / 1023.5 | unknown | unknown |
| suzuka | 2025, 2026 | 1.0242 | ? / 0 | [full (T1–T8 2025, T7–T17 2026)](https://www.redbullracing.com/int-en/races/japanese-grand-prix-2026/japan-bulls-guide-2026) | 0 | 2 / 2 | 1.32 | 29.3 / 28.3 | 1013.2 / 1008.7 | 1.22 | 12.8 |
| sakhir | 2025 | 0.9145 | 15 | [opening](https://en.wikipedia.org/wiki/Bahrain_International_Circuit) | 0 | 2 | 1.57 | 30.6 | 1004.5 | unknown | unknown |
| jeddah | 2025 | 1.1889 | 4 | [opening](https://en.wikipedia.org/wiki/Jeddah_Corniche_Circuit) | 1 | 4 | 0.26 | 36.6 | 1006.5 | unknown | unknown |
| miami | 2025, 2026 | 0.9402 | 2 / 3 | [full](https://tilke.de/portfolio/miami-international-autodrome-2/) | 1 | 4 / 4 | 1.49 | 39.1 / 51.3 | 1013.4 / 1010.1 | unknown | 15.4 |
| imola | 2025 | 1.1505 | ? | unknown | 0 | 5 | 0.56 | 38.6 | 1008.6 | unknown | 13.0 |
| monte-carlo | 2025, 2026 | 0.9431 | ? / ? | unknown (partial every year, e.g. T19–T1 2026 in FIA notes) | 1 | 5 / 4 | 2.09 | 38.9 / 33.1 | 1014.8 / 1017.5 | unknown | unknown |
| catalunya | 2025, 2026 | 1.0039 | 7 / 8 | [full](https://www.sorigue.com/en/asphalts/surfacing-circuit-barcelona-catalunya) | 0 | 2 / 3 | 1.55 | 44.2 / 49.4 | 1005.4 / 1005.9 | unknown | unknown |
| montreal | 2025 | 0.9956 | 1 | [full (FIA RD notes 2024)](https://www.planetf1.com/news/fia-reveal-13-track-changes-canadian-grand-prix) | 1 | 5 | 2.24 | 41.8 | 1018.9 | 1.16 | 12.3 |
| spielberg | 2025, 2026 | 1.0325 | 9 / 10 | [full](https://www.motorsport.com/f1/news/analysis-hungaroring-track-changes-put-lap-records-in-sight-799805/799805/) | 0 | 4 / 4 | 2.03 | 46.5 / 51.2 | 945.4 / 942.9 | 0.59 | 19.1 |
| silverstone | 2025, 2026 | 0.9262 | 6 / 7 | [full](https://www.motorsportweek.com/?p=23573) | 0 | 3 / 2 | 0.90 | 30 / 40 | 994.5 / 1007.5 | 1.24 | 11.3 |
| spa-francorchamps | 2025, 2026 | 1.0167 | ? / ? | [unknown (about half resurfaced 2022)](https://racingnews365.com/circuit-designer-had-20-iterations-of-eau-rouge-in-spa-f1-track-revamp) | 0 | 2.667 / 3 | 1.65 | 38.5 / 34.8 | 967.6 / 968.4 | 1.10 | 12.9 |
| hungaroring | 2025, 2026 | 0.9498 | 9 / 10 | [full](https://hungaroring.hu/site/en/about-us/history-of-the-track) | 0 | 4 / 4 | 1.47 | 38 / 42.7 | 983.4 / 984.1 | unknown | 14.6 |
| zandvoort | 2025 | 1.062 | 5 | [full](https://www.racefans.net/?p=422789) | 0 | 3 | 2.91 | 34.2 | 1006.1 | 0.88 | 13.7 |
| monza | 2025, 2026 | 1.0162 | 1 / 2 | [full](https://en.ilsole24ore.com/art/f1-monza-new-look-gp-ditalia-sticchi-damiani-state-of-the-art-track-AFxju8ZD) | 0 | 4 / 4 | 1.11 | 41.8 / 52.3 | 998.5 / 994.5 | 1.29 | 11.4 |
| singapore | 2025, 2026 | 0.9439 | 15 / 15 | [opening](https://en.wikipedia.org/wiki/Marina_Bay_Street_Circuit) | 1 | 4 / 4 | 1.01 | 34.6 / 40 | 1011.9 / 1010.4 | unknown | unknown |
| austin | 2025, 2026 | 0.9851 | 13 / 14 | [opening (partial patches only)](https://www.planetf1.com/features/new-mclaren-rear-wing-spotted-as-fia-ramp-up-flexing-investigations) | 0 | 2.667 / 3 | 1.66 | 44.4 / 38 | 989.3 / 1001.7 | 0.69 | 13.8 |
| mexico-city | 2025, 2026 | 0.9098 | 10 / 11 | [full (rebuild)](https://tilke.de/?p=10517) | 0 | 3.667 / 4 | 1.72 | 43.5 / 40.2 | 780.4 / 781.9 | 0.89 | 13.8 |
| interlagos | 2025 | 0.9479 | 1 | [full](https://fia.com/sites/default/files/2024_f1_gp_sao_paulo_media_kit_english.pdf) | 0 | 3 | 1.35 | 37.1 | 918.4 | unknown | 12.2 |
| lusail | 2025 | 1.0796 | 2 | [full](https://pirelli.com/global/en-ww/race/racingspot/formula-1/f1gp-five-fast-facts-about-the-qatar-gp-98804) | 0 | 2 | 1.25 | 24.9 | 1016.5 | unknown | unknown |
| yas-marina-circuit | 2025 | 1.0782 | 15 | [opening (three sections relaid 2021)](https://www.arabnews.pk/node/1963761/sport) | 0 | 4 | 1.24 | 28.6 | 1017.4 | unknown | unknown |
| madring | 2026 | 1.0878 | 0 | [opening](FIA 2026 calendar (new circuit)) | 1 | 3 | 2.04 | 53.5 | 942.8 | unknown | unknown |
| baku | 2026 | 1.0599 | 10 | [opening (no repave in 8 years, 2023)](https://www.conexpoconagg.com/news/las-vegas-strip-turns-racetrack-again-for-formula) | 1 | 4 | 0.71 | 35.8 | 1023.9 | unknown | unknown |
| kuala-lumpur | 2026 | 0.9758 | 10 | [full](https://www.formula1.com/en/latest/features/2016/9/f1-malaysia-gp-preview-sepang-revamp.html) | 0 | ? | unknown | 54.3 | 1006.3 | unknown | unknown |
| las-vegas | 2026 | 0.9731 | 3 | [opening (no repave since, 2025)](https://www.fox5vegas.com/2025/11/13/f1-track-preparation-nears-completion-ahead-las-vegas-grand-prix/) | 1 | ? | 2.30 | 15.2 | 941.2 | unknown | unknown |
