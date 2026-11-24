# Step 29a rules — amendment 1 (before any result)

Written 2026-11-25 00:45 KST. Base: claude/rules-step29a-stint-2026-11-25.md, sha256 4e024f79525f7cac766308204893ba7537cdd5c3bae779960eb225bd0d60a5bd.

## What was seen before this amendment
A smoke run on one race (2024 Bahrain) printed only: 426 kept laps, race length 57, and "rank" (the design matrix of §5 is
rank-deficient). No lap time, residual, slope or case value was printed or read.

## Why
§5 used one intercept per driver-stint. Inside a stint, tyre age = lap number + a constant (both rise by one per lap, and a
dropped lap drops both). So with a stint intercept, age and lap are the same column up to that intercept: w_c and φ cannot be
separated at all, whatever the data. The tyre-age reset at a pit stop only helps if the intercept is shared across a driver's
stints. §5's own text ("separation works only through tyre-age resets") is kept; the fit is changed to match it.

## Change (replaces the model line of §5; everything else stays)

  t = α[driver] + o_c · 1[compound = c] (c ≠ reference) + Σ_c w_c · age · 1[compound = c] + φ · (lap − 1)

- α per driver (shared by all that driver's stints), o_c = compound offset vs MEDIUM (vs the first of SOFT, MEDIUM, HARD present
  when MEDIUM is not used). This is the same structure as worker/lapsim/race-pace.js `fitRace` (without its ridge shrinkage).
- New assumption (systematic, cannot be bounded from lap times): a driver's pace is constant across stints apart from the
  compound offset, tyre age and the race trend (no change of engine mode or management between stints, no damage).
- Cluster bootstrap and split-half (§7): the unit stays the driver; a resampled driver copy gets its own α.
- The rank check stays: a fit that is still rank-deficient is "not separable" for that event.
