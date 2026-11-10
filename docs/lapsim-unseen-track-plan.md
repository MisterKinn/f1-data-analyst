# Plan: track factors for a never-raced circuit

No experiment was run for this plan. The aim is a measured prediction error for a circuit with geometry but no lap-time evidence in the fit. A fitted track factor is an effective correction: it can absorb geometry and missing physics as well as surface grip.

Use only verified zero-rain geometry and one geometry per track. A new circuit must first have a source and a geometry audit. If usable geometry does not exist, return insufficient evidence. Do not borrow a factor from a circuit chosen by eye.

| Part | Predeclared method |
|---|---|
| Baselines | Unity factor; the training tracks' geometric-mean factor |
| Candidate | Ridge regression for log grip factor from geometry features |
| Features | Track length, curvature RMS, curvature quantiles, elevation range and grade RMS; missing elevation stays missing |
| Other inputs | No held-out lap time, speed trace, fitted car, track factor or race result may enter a feature |
| Series | Fit F1 first. Test transfer to WEC separately at R; do not pool a WEC lap from the hidden circuit into training |
| Drag | Keep the declared baseline drag treatment. Do not reinterpret grip as a drag correction |
| Complexity | Fix the feature list and shrink strength before the first run; no tuning on the outer test folds |

Hide an entire circuit, across every season and series, in each outer fold. Refit the training cars and track factors to the existing convergence rules. Learn the feature transform and the factor predictor on those training tracks only. Predict the hidden factor, then simulate the hidden laps with no raced-session correction. The main fit must never use a factor exported from an all-track fit: that would leak the hidden circuit.

Include a second test for time: hide circuits first added in a later season and train only on earlier data. This checks whether the circuit-holdout result also supports a future-event forecast. Keep wet sessions out using the shared fit/audit scope. Report them separately.

| Required output | Meaning |
|---|---|
| Per season and series | Held-out RMS and bias in lap percentage, absolute error in seconds, and circuit count |
| Per hidden circuit | Source geometry, predicted factor, real and simulated lap, and both baseline errors |
| Factor error | Predicted factor against a separately fitted diagnostic factor, clearly marked as an effective-model comparison |
| Uncertainty | An interval from training-only outer-fold residuals, plus observed interval coverage; do not assume normal errors |
| Physical checks | Corner bias, trap error, bounds and convergence state, alongside lap-time error |

Use the unchanged paired gate on circuit-level errors. Require no protected season or class-season to worsen. Apply the existing small-sample minimum-gain rule. Report missing coverage and cap hits as incomplete evidence. A passing candidate becomes a draft model PR; it does not change production by itself.

Before running, decide whether the available geometry features cover enough different circuit shapes. If they do not, report the coverage gap and collect verified geometry. Do not add a fitted track identity or a nearest-circuit exception to rescue the test.
