# Driver margin per corner type and phase (step 11a, phase a)

Measurement only, 2026-11-23. Pre-registration: Project `claude/gate-driver-margin-prereg-2026-11-23.md`; ledger row "11a".
Script `scripts/sim/driver-margin.mjs`, data `scripts/sim/data/learn/driver-margin.json`, tests `tests/lapsim-driver-margin.test.mjs`.
No kernel, fit, page or lap value changes.

**What it measures.** Margin = a driver's value / the best driver's value at the same corner, season and track. It is the margin
**to the best driver**, not to the car's physical limit. Evidence layer 2 (measured speed); label "measured ratio".

## Data
- TracingInsights qualifying 2023–26, each driver's fastest timed dry lap (not deleted, no pit in/out, no rain flag; sessions with
  ≥ 10 % rain laps dropped). 80 sessions, 1,619 laps picked, 1,617 with telemetry, 2 dropped (> 50 % frozen).
- Frozen samples masked (rules C and D, ± 1 sample); a phase value with a masked sample within 150 m is dropped.
- Distance integrated from speed over time. Sample spacing: median 0.129 s, 6.8 m.
- Dropped sessions: wet 2023 Silverstone, Montreal, Zandvoort, Catalunya; 2024 Spa, Hungaroring, Interlagos; 2025 Las Vegas;
  2026 Interlagos. No FastF1 corner list (layout check impossible): 2026 Kuala Lumpur, Madring. 12 corners dropped (> 80 m from
  the FastF1 position).
- Coverage: about 7 of ~17 corners per lap give an apex. A corner is skipped when its minimum is on the window edge (corner
  sequences such as Suzuka T1–T2, the Esses) or it drops < 10 km/h (flat).

## Phases
brake = peak deceleration before the apex (local linear fit ± 0.25 s); apex = minimum speed; exit = speed at apex + 60 m. Type by
the corner's median apex speed in the season: slow < 120, medium 120–200, fast > 200 km/h. Envelope = the highest driver value
(≥ 5 drivers).

## Floors
- B1: + 1.3 km/h at the corner minimum → 1.3 / v (apex and exit).
- Noise: each lap recomputed on its even and odd samples; σ_half per type and phase. Because the envelope is a maximum of ~19
  drivers, noise alone makes a typical driver look short by σ_half × 1.84. σ_half: apex 0.7 / 0.4 / 0.2 %, exit 1.7 / 1.3 / 0.8 %
  (slow / medium / fast), **brake 50–53 %**.
- A cell is resolved when 1 − median > max(B1, noise floor).

## Margin table
Median, p10, p90 of the pooled margins (equal weight per track, seasons pooled); CI90 of the median by bootstrap over tracks;
± sys from the systematic rows (top-3 mean envelope, exit + 40 / + 80 m, decel window ± 0.2 / ± 0.35 s, type from the envelope apex).

| type | phase | group | tracks | n | median | p10 | p90 | CI90 median | ± sys | floor | status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| slow | brake | pole | 24 | 293 | 0.669 | 0.460 | 0.911 | 0.649–0.687 | 0.082 | 0.943 | not resolved |
| slow | brake | top5 | 24 | 1465 | 0.687 | 0.469 | 0.907 | 0.671–0.702 | 0.089 | 0.943 | not resolved |
| slow | brake | field | 24 | 5881 | 0.683 | 0.463 | 0.916 | 0.671–0.696 | 0.087 | 0.943 | not resolved |
| slow | apex | pole | 24 | 293 | 0.961 | 0.927 | 1.000 | 0.959–0.968 | 0.011 | 0.014 | resolved |
| slow | apex | top5 | 24 | 1465 | 0.963 | 0.921 | 1.000 | 0.961–0.965 | 0.011 | 0.014 | resolved |
| slow | apex | field | 24 | 5889 | 0.949 | 0.902 | 0.991 | 0.948–0.951 | 0.010 | 0.014 | resolved |
| slow | exit | pole | 24 | 295 | 0.958 | 0.910 | 1.000 | 0.953–0.962 | 0.016 | 0.031 | resolved |
| slow | exit | top5 | 24 | 1482 | 0.954 | 0.903 | 0.996 | 0.951–0.957 | 0.016 | 0.031 | resolved |
| slow | exit | field | 24 | 5975 | 0.944 | 0.887 | 0.990 | 0.942–0.946 | 0.016 | 0.031 | resolved |
| medium | brake | pole | 23 | 194 | 0.661 | 0.410 | 0.863 | 0.625–0.684 | 0.104 | 0.928 | not resolved |
| medium | brake | top5 | 23 | 967 | 0.661 | 0.443 | 0.873 | 0.640–0.677 | 0.096 | 0.928 | not resolved |
| medium | brake | field | 23 | 3895 | 0.669 | 0.451 | 0.924 | 0.655–0.685 | 0.094 | 0.928 | not resolved |
| medium | apex | pole | 23 | 200 | 0.985 | 0.944 | 1.000 | 0.979–0.988 | 0.008 | 0.008 | resolved |
| medium | apex | top5 | 23 | 995 | 0.977 | 0.944 | 1.000 | 0.975–0.978 | 0.011 | 0.008 | resolved |
| medium | apex | field | 24 | 3977 | 0.949 | 0.902 | 0.992 | 0.946–0.952 | 0.012 | 0.008 | resolved |
| medium | exit | pole | 23 | 200 | 0.972 | 0.936 | 1.000 | 0.965–0.977 | 0.011 | 0.024 | resolved |
| medium | exit | top5 | 23 | 1003 | 0.970 | 0.928 | 1.000 | 0.967–0.973 | 0.011 | 0.024 | resolved |
| medium | exit | field | 24 | 4031 | 0.955 | 0.908 | 0.992 | 0.952–0.957 | 0.011 | 0.024 | resolved |
| fast | brake | pole | 12 | 48 | 0.600 | 0.450 | 0.826 | 0.546–0.641 | 0.103 | 0.970 | not resolved |
| fast | brake | top5 | 15 | 268 | 0.579 | 0.370 | 0.889 | 0.546–0.631 | 0.121 | 0.970 | not resolved |
| fast | brake | field | 16 | 1233 | 0.656 | 0.378 | 0.978 | 0.624–0.684 | 0.108 | 0.970 | not resolved |
| fast | apex | pole | 14 | 82 | 0.989 | 0.967 | 1.000 | 0.987–0.992 | 0.008 | 0.006 | resolved |
| fast | apex | top5 | 17 | 423 | 0.984 | 0.954 | 1.000 | 0.980–0.987 | 0.007 | 0.006 | resolved |
| fast | apex | field | 17 | 1740 | 0.962 | 0.917 | 0.996 | 0.960–0.967 | 0.008 | 0.006 | resolved |
| fast | exit | pole | 14 | 84 | 0.995 | 0.971 | 1.000 | 0.989–1.000 | 0.005 | 0.014 | not resolved |
| fast | exit | top5 | 17 | 427 | 0.982 | 0.954 | 1.000 | 0.978–0.985 | 0.007 | 0.014 | resolved |
| fast | exit | field | 17 | 1757 | 0.969 | 0.927 | 0.995 | 0.965–0.971 | 0.007 | 0.014 | resolved |
## Reading
- **Apex and exit are resolved** in 17 of 18 cells. The field is 3–6 % below the best driver; pole and top-5 are 0.5–4.6 % below.
  The gap shrinks with corner speed (slow 4 %, fast 1 %), as expected when time cost per km/h is lower in slow corners and line
  choice (slow-in, fast-out) spreads the slow-corner minimum.
- **Fast exit, pole:** 0.995, below its floor (1.4 %) → not resolved.
- **Brake is not resolved anywhere.** Peak deceleration from 0.13 s speed samples is noise: its half-rate split differs by ~50 %,
  so the "envelope" is the noisiest driver, not the best braker. The 0.60–0.69 medians are not driver margins. The half-rate noise
  over-states full-rate noise (the ± 0.25 s window holds only ~3 samples at half rate), so the true brake floor is unknown; under the
  declared rule every brake cell stays unresolved, and the wide p10–p90 (0.37–0.98) points to noise too. Braking needs a different measure (zone-mean deceleration or braking distance), which needs a new
  pre-registration.
- Apex margin is a ratio of minimum speeds, not of grip: grip use goes with v², so a 0.96 speed margin is about 0.92 of the best
  driver's lateral acceleration at that point (if the radius is the same, which line choice breaks).

## Phase b (step 11b) pre-registration
In the same Project doc, section 8: pole lap = car limit (from step 9) × margin, only for resolved cells (others 1). Primary:
speed-trace RMS vs the measured pole lap, sign-flip over tracks; co-primary: held-out lap RMS, level C and forward-chaining
non-inferior (δ 5 %). Not run before step 9 merges; with today's fitted car it would count the margin twice.
