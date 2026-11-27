# Acceptance-rule audit — pre-registration

- Baseline: `be21f7a4e22a111a841a093fc2ce5ed1c73b9ecf`.
- Scope: report-only statistical audit; no physics, calibration, data, runtime,
  acceptance-policy or deployment-configuration change. Not a Gate G experiment.
- Inputs: one predeclared series/class, paired signed errors in percentage points,
  unique row IDs and circuit IDs. Original old/new rows and circuit memberships
  for the supplied F1/WEC results are unavailable; never reconstruct them from
  an unrelated candidate or claim their clustered result has been reproduced.
- Compare iid-row t intervals (diagnostic), intercept-only circuit-cluster CR1
  intervals preserving the row-weighted estimand, and equal-circuit t intervals
  (a different estimand when cluster sizes differ). Always retain the original
  individual-row +1.0 pp guard. No automatic ship decision is exposed.
- Sparse, missing, non-finite or duplicate pairs are errors, not dropped rows.
  One cluster cannot supply a clustered interval. Few clusters and shared-fit /
  season dependence must remain visible limitations.
- Power planning: one-sided alpha .05, power .80; normal independent paired
  track-level harms with SD .2 pp is ASSUMED, not measured. Show both normal
  approximation and noncentral-t results, with units and true-mean assumptions.
- Verify numerical t critical values against SciPy, hand-computed CR1 examples,
  distinct covariance with identical row summaries, malformed inputs, strict
  row guard, full existing CI-mode tests, build and unchanged runtime artifact.
- Do not widen a margin, change the primary unit, pool classes, or select a
  favorable method after observing results. Such policy changes need separate
  pre-registration and owner approval.
