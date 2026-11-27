# ERS reserve calculation and release boundary

This change consolidates existing kernel reserve arithmetic. It does not replace
the ERS strategy, alter fitted cars, or claim complete FIA controller compliance.
The inverse formula in the research request was **not** in the production kernel.

## Units and envelope

ASSUMED: constant ICE, post-cut electrical power `x = max(0, P - step)` held for
`h` seconds, then reduced linearly at `R` W/s until `q = 100000` W, after which
deploy may stop. `P`, `step`, `x`, `q` are W and energy `E` is J, not MJ or SoC %.

```
E(x) = h*x + max(0, (x*x - q*q)/(2*R))
x_max(E) = E/h                                  if E <= h*q
           sqrt((R*h)^2 + q*q + 2*R*E) - R*h    otherwise
P_envelope = step + x_max(E)
```

The low-energy branch is essential: 50000 J with a one-second hold allows
50000 W post-cut, not 100000 W. For a 150000 W step, the corresponding pre-cut
envelope is 200000 W, not 250000 W. With 200000 J, the post-cut limits are
130277.563773 W at 50000 W/s and 144948.974278 W at 100000 W/s.
These are calculated examples, not measured F1 values.

Dimension check: `R*h` is W; `R*E` is W²; the square root is W. The linear `h*x`
term already includes the hold exactly once. Pre-cut energy, the 350 kW absolute
ceiling, speed taper, driver demand, regeneration, and zone exceptions are not
included in this reserve envelope and remain separate constraints.

`ersRampEnergyJ` is used at all three existing reserve evaluations. It retains
the previous positive-input operation order and clamps a non-positive post-cut
power to zero reserve. `ersRampPostCutLimitW` exposes the tested inverse but is
deliberately **not** connected to the deployment controller.

## Sourced rules versus model assumptions

[FIA 2026 Section C, Issue 21, 19 October 2026](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_c_technical_-_iss_21_-_2026-10-19.pdf):
C5.12.4 specifies an initial total-PU-power reduction normally limited to 150 kW
and a reduction held for at least one second, with event-defined exceptions.
C5.12.6 limits the reduction over a one-second period to 50 or 100 kW/s above
100 kW depending on power-limited distance; C5.12.7 contains exemptions.
The electrical constant-power/linear-ramp envelope above is an assumption, not
the verbatim rule. C5.2.7–10 supply separate power/energy restrictions.

[FIA Qatar 2026 Power Unit Information](https://www.fia.com/system/files/decision-document/2026_qatar_grand_prix_-_power_unit_information.pdf)
provides event-specific parameters. Existing event data remain unchanged.

Known limitation: the current kernel skips starting this reserve hold when the
post-cut value is at or below 100 kW (`HOLD_MIN`). The helper's low-power branch
is mathematically defined but **does not fix or certify that controller policy**.
Changing that behavior requires a separately registered, paired physical-model
validation; earlier research recorded nonzero lap-time changes. This release
does not silently enable that candidate or call the model fully FIA-compliant.

## Verification

```
node --test tests/lapsim-ers-reserve.test.mjs
node scripts/sim/check-ers-reserve-parity.mjs
```

The second command compares full result JSON with baseline `468e817` in the same
process: four tracks, both integrators, 2025/2026, ramp on/off, and zero recharge
(32 cases). It requires that baseline Git object, not a shallow checkout without
it. This is local arithmetic compatibility, not telemetry/accuracy validation.
See `notes/progress.md` for release-check evidence and deployment status.
