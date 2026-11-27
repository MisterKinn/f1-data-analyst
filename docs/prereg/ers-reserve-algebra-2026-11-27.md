# ERS reserve algebra — 2026-11-27

- Baseline: `468e817e80266870bae1b9363a78da1971cadbbb` (origin/main).
- Scope: one deterministic arithmetic consolidation; no new strategy, fit,
  regulation interpretation, measured data or default trajectory change.
- The inverse formula supplied in the request is not present in the kernel.
  Do not describe it as an existing production defect.
- Consolidate the three existing reserve-energy evaluations in the
  self-contained kernel. Preserve their positive-input operation order.
  A non-positive post-cut deploy power needs zero reserve, not negative energy.
- Provide the piecewise inverse for a constant-ICE, constant electrical
  post-cut hold followed by a linear ramp to 100 kW. This is an ASSUMED strategy
  envelope, not a complete FIA compliance controller. Keep it out of the
  deployment strategy until that controller is separately validated.
- Tests before implementation: zero, negative post-cut power, 50/100/200 kJ,
  50/100 kW/s, the 100 kW boundary, units, invalid inputs, forward/inverse
  round trips, independent numerical integration, browser serialization.
- Compatibility: exact JSON equality against the baseline kernel in the same
  process, both integrators, F1 2025 and 2026, with/without event ramp and
  different SoC/recharge inputs. No lap-accuracy claim or statistical fit.
- Release checks: related and full Node 22 tests, features-OFF, build and
  artifact validation, focused diff/security review. Production not requested
  in this phase. Document remaining C5.12 hold/controller limitations.
