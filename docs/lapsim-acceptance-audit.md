# Model-acceptance statistical audit — 2026-11-27

Report only. Baseline `be21f7a`. The F1/WEC summaries below are user-supplied,
not a reproduced pipeline run. No paired raw rows or memberships identifying
that old/new candidate were supplied; no clustered outcome is invented.

## A. Independence: no + method

Do not treat repeated circuit observations across seasons/classes as independent.
Keep paired old/new errors together and cluster by circuit; alternatively resample
whole circuits, retaining all their season/class rows in each bootstrap draw.
CR1 is an approximate cluster-robust interval, not a guaranteed small-sample fix.
Six WEC circuits warrant CR2/Satterthwaite or null-imposed wild-cluster-bootstrap
sensitivity analysis, not a naive percentile-bootstrap certificate. [1]

The original row-weighted target and an equal-circuit target differ when counts
are unbalanced. Predeclare weights; show both, never pick the favorable result.
Shared training fits and season shocks may also correlate different circuits.
Circuit clustering is conditional on the fitted model/observed seasons; two
seasons are not enough for reliable season-cluster inference. New-season claims
need prospective validation, or an outer resampling/refitting design. [1]

## B. Recomputed UB

All errors, harms and bounds are in percentage points (pp), not relative percent.

    h_i = |new error_i| - |old error_i|
    iid UB = mean(h) + t(.95, N-1) * s(h)/sqrt(N)
    U_g = sum_{i in circuit g}(h_i - mean(h))
    SE_CR1² = G/(G-1) * sum_g U_g² / N²
    row-weighted clustered UB = mean(h) + t(.95, G-1) * SE_CR1

The CR1 finite-sample factor is G/(G-1) * (N-1)/(N-K), with K=1 here. [2]
The one-sided t bound has the stated form under iid normal sampling; using
cluster-robust SE and G-1 degrees of freedom is an approximation. [3]

For equal-circuit weighting: compute h_g = mean of paired harms in circuit g;
UB_C = mean_g(h_g) + t(.95,G-1) * s(h_g)/sqrt(G). Class/season weights inside
circuits must also be fixed beforehand. Always retain max_i(h_i) <= 1.0 pp;
an acceptable mean cannot hide one harmful row.

F1, supplied N=35: mean=.031, iid UB=.1026, hence iid SE=.0423437063 and
implied row SD=.250508745. It FAILS the original .10 margin: .1026 > .10,
without rounding. The planning SD=.2 below is not this inferred SD.

Actual clustered UB: NOT IDENTIFIABLE from mean, N and iid UB alone. The
within-circuit sums U_g and actual G are required; clustered SE can increase
or decrease. If G=18 is ASSUMED and SE is artificially held fixed merely to
illustrate the degrees-of-freedom effect, UB=.104661396, still FAIL. This is
not the actual cluster correction. With G=18, passing would require
SE_CR1 <= (.10-.031)/t(.95,17) = .0396641373, plus the individual-row guard.

WEC LMH: supplied UB=.116 also FAILS .10; neither its mean nor raw paired
rows are available, so its clustered UB cannot be computed. N=11 does not
mean eleven independent circuits. The individual-row guard is unverified
for both supplied results. Tests demonstrate identical iid summaries can
produce clustered UBs on opposite sides of the margin.

## C. Power table

ASSUMED planning model: independent normally distributed track-level paired
harms, SD=.2 pp, one-sided alpha=.05, power=.80. These are planning scenarios,
not observed track-level variability. For noninferiority, the detectable gap is
d = margin - true mean harm, not the margin alone.

    normal approximation: n = ceil(((z(.95)+z(.80))*SD/d)²)
    exact t-test power = F_nct(-t(.95,n-1); df=n-1, nc=-d*sqrt(n)/SD)

Exact values use SciPy 1.18.0 noncentral t; normality/independence are essential
to this planning interpretation. [4]

| Target / scenario | SD, pp | Independent units needed / available | Power / MDE |
|---|---:|---:|---|
| Gap .10, true mean harm 0 with margin .10 | .2 ASSUMED | 25 normal approximation; **27 exact** | 81.18% at 27; 79.81% at 26 |
| Gap .069, true mean harm .031 with margin .10 | .2 ASSUMED | 52 normal approximation; **54 exact** | 80.45% at 54 |
| Gap .05 | .2 ASSUMED | 99 normal approximation; **101 exact** | 80.25% at 101 |
| WEC sector primary, gap .10 | .2 ASSUMED at track-sector-primary level | 6 tracks available; 27 needed | **27.99%**; MDE80=.23716 pp |
| Class rule if all 11 units were independent | .2 ASSUMED | 11 | 46.03%; MDE80=.16122 pp |
| F1 if only 18 track-level units | .2 ASSUMED | 18 | 65.21%; MDE80=.12218 pp |

Additional seasons, sectors, classes or laps do not automatically create new
independent circuits. Predefine the sector primary's denominator (sector error
pp versus lap error pp); do not reuse lap-error SD without evidence. WEC
class-level G near six uses the six-track scenario, not the eleven-unit row.
The .031 scenario illustrates planning sensitivity, not post-hoc observed power.

## D. Recommendation (5 lines)

1. Keep .10 pp mean and +1.0 pp row guard; predeclare circuit clustering and target weights.
2. N=11 is underpowered, but ignoring positive dependence can also make it too permissive; do not relax the margin.
3. Consider a predeclared pooled WEC primary with class safety checks; retain old class behavior when evidence is inconclusive.
4. Plan using track-level SD: .2 pp and true harm 0 need 27 independent tracks; six-track sectors need more evidence.
5. Use few-cluster sensitivity and fresh confirmation; no method/weight/margin shopping or automatic policy replacement.

Requiring every class to pass is an intersection-union noninferiority claim;
it does not automatically require Bonferroni for the single global all-pass
claim. Separate selected claims, multiple candidates and repeated peeks are
different multiplicity problems. Proposed pooled/class policy is not implemented.

## Sources

[1] MacKinnon, Nielsen & Webb, *Cluster-Robust Inference: A Guide to Empirical
Practice*, 2022 preprint (accepted in Journal of Econometrics):
https://arxiv.org/html/2205.03285v1

[2] statsmodels, `cov_cluster` source, finite-sample correction and cluster sums:
https://www.statsmodels.org/stable/_modules/statsmodels/stats/sandwich_covariance.html#cov_cluster

[3] Pacific Northwest National Laboratory, VSP, *Confidence Interval on a Mean*:
https://vsp.pnnl.gov/help/Vsample/Test_Sub_page_for_CI_on_a_Mean.htm

[4] SciPy 1.18.0, `scipy.stats.nct`, noncentral-t distribution:
https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.nct.html

## Reproduction and scope

    node --test tests/lapsim-acceptance-audit.test.mjs
    node scripts/sim/acceptance-audit.mjs paired-errors.json
    python3 scripts/sim/acceptance-power.py

The optional Python power reproduction requires SciPy; it does not add a runtime
or CI dependency. The JS audit has no added dependency. Example input schema:

    {"group":"F1 predeclared candidate","rows":[
      {"id":"2025/track-a","circuit":"track-a","oldErrorPp":-2,"newErrorPp":-2.1},
      {"id":"2026/track-a","circuit":"track-a","oldErrorPp":1,"newErrorPp":1.05}
    ]}

Schema example is synthetic, not evidence. Pair complete old/new cohorts upstream
and reject missing pair IDs before constructing input; a row-only report cannot
detect silently omitted rows. Supply one predeclared series/class per invocation,
use canonical circuit/layout identities, and do not combine incompatible metrics.
The tool reads JSON, returns diagnostic intervals and row safety only, and writes
no simulator state. Existing gates, acceptance margins and physics stay unchanged.
No new model accuracy or statistical acceptance claim is made.
