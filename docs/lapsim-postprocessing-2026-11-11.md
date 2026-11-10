# Checkpoint-only postprocessing — 2026-11-11

At 07:33 KST, computation remains active. Do not label these runs accepted or complete.

| Phase | Run | Source commit |
|---|---|---|
| F1 folds + original WEC control/BoP | https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913368752 | c4a2b9f4ba107b5e2b1655de1a370e37092fb033 |
| Sector2 recovery using original approved eligibility | https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42913698920 | 70c680db6121d98527765a6ad056430926553457 |
| F1 export/reproduction/physical/paired comparison | https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42914814278 | a526068fb85ea284a360c4b87ef04e0066c24126 |
| Independent WEC comparison | https://github.com/kangjeongmin1229/f1-data-analyst-deploy/actions/runs/42915252418 | fec2baabb5916b71ac2cfe753fbbd09f530f8f1f |

These workflows use branch exp/lapsim-owner-jobs-2026-11-11 on the fork only. Another concurrent continuation is run 42914964554; some of its jobs were observed cancelled. Do not treat one run's cancellation as termination of the others. Preserve source/run provenance and avoid duplicate fitting.

The F1 export waits for the original 16 fold jobs to finish successfully. It downloads their checkpoints, reconstructs each calibration with **zero optimizer rounds**, validates checkpoint bytes, group inventories and training/options hashes, runs exact dry raced reproduction and physical validation, and emits a paired full-precision held-out comparison. The six old complete folds remain preserved. Main fits remain unchanged. Its final artifacts are final-f1-control, final-f1-candidate and final-f1-comparison.

The WEC comparison waits independently for original control/BoP and recovered sector2. It checks complete statuses, pairs all class-season rows by identity, uses full-precision selected-group objective records, reports each main/fold stop and cap, and compares physical diagnostics. It emits final-wec-comparison. No comparison adopts a model.

Verification before publishing the postprocessing code: three stopping/replay tests passed. A real saved control main fit (215 training rows) and held-out fold (197 training rows) replayed with zero optimizer rounds; scores remained 24.73806466389734 and 25.739488317344442. The WEC reporter reproduced historical n=33 RMS values 1.166709%, 1.271006%, and 1.196784%; those are reporter test values, not results of the active confirmation.

Final review must include all declared acceptance checks, especially dry Las Vegas raw replay (2024 already worse), baseline validity within 0.05 percentage points per season, F1 protection, new bounds, corner/trap diagnostics, exact reproduction and any missing checks. A main-round limit completes a fold under the owner's rule but is not numerical convergence. Missing or failed outputs must remain explicit. No production/main/Vercel/bounds/weights/gate changes.
