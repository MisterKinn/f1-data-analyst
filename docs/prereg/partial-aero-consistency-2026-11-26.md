# Partial aero consistency — 2026-11-26

Baseline: ce99c9ada5fdc42ef42ec6703cdb93cae0383710.
Type: deterministic derived-output bug fix; no fitted parameter, physical prior,
measured input, kernel trajectory or accuracy claim changes. One candidate.

The kernel and telemetry channels interpret aeroLow as a clamped 0..1 share.
brakeZones and driveEnergyJ instead interpret every nonzero share as fully open.
Use the existing linear coefficient interpolation in those two consumers.

Before implementation, add synthetic tests that fail on the baseline. Verify
0.25/0.5/0.75 shares against a car with independently calculated effective CdA
and ClA, clamp boundaries and absent low-mode coefficients. Preserve exact
outputs for binary 0/1 and missing aeroLow, including browser serialization of
brakeZones. Inputs must remain unchanged. No empirical fit or statistical gate
is needed to establish this arithmetic consistency; no claim of reduced F1
corner-speed error is made. Existing rejected physics candidates stay excluded.

Release checks: targeted tests, full Node 22 suite, build/artifact validation,
browser simulation smoke, diff/security review. Keep the release isolated from
the dirty research worktree. Production status must be verified separately.
