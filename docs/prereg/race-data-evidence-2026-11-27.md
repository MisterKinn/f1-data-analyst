# Race-data evidence audit — 2026-11-27

- Baseline: `8a9c2e0e866390891d16d9f363fb1a3df6eb5fcf` (origin/main).
- Scope: source audit and report-only descriptive statistics. No physics,
  measured-derived dataset, fit, tyre, brake, energy-controller or website change.
- Public 2025 Monza qualifying speed-trap session maxima and 2025 Le Mans
  Hyperpole 2 top-speed maxima may describe cross-car/driver spread only.
  Use every listed entrant in each class, no trimming or fitting. Sample SD uses
  n−1; unavailable apex and within-driver repeatability remain null, not zero.
  Session maxima are NOT pure driver noise or a best-lap straight-end sample.
- Do not treat Brembo zone-peak g as instantaneous g at entry speed, GTD as
  measured LMGT3, laser-scan accuracy as kerb excursion, or lap-time SD as speed SD.
- Bosch's 2023 50 kW drive / up-to-200 kW recuperation statement is historical
  evidence, not a verified current Equity Model. Existing regenMax=50 kW stays
  unchanged and is explicitly labelled ASSUMED pending a controller/energy gate.
- Tests: independently calculated sample SD; empty/singleton/malformed inputs;
  fixed source row counts; missing channels remain null; no runtime dependency.
- Checks: focused tests, existing series/energy regressions, build/artifact
  validation, unchanged production lap-simulator asset hash, diff/security review.
  No lap-accuracy or pipeline reproduction claim. No new variant in the physics gate.
