# Research evidence for live interpretation

Version 1.5, reviewed 2026-11-06. The catalog contains 27 reviewed papers, 6 candidates and 24 rights/access-held entries. It covers IMechE and related publishers plus open driving-theory papers, not every paper on these topics.

## Persistence and provenance

knowledge/research-catalog.json is versioned with the shared backend and bundled into releases. The original nine reviewed cards were recovered from Kongboda_Motorsports_Research_2026-10-29.zip version 1.0. Authors, DOI, publication year, license and license-evidence URL travel with each returned citation. Notes are Korean paraphrases with explicit transfer limits; third-party figures, proprietary code, raw datasets and model weights are not copied. Article permissions do not license separately owned software or data. No foundation-model retraining is performed.

C02 (Heilmeier et al., 2020) was promoted after retrieving the publisher PDF without login and reviewing the method, results, limitations and CC BY 4.0 notice. The implementation uses equations (6)–(9) only, not its trained neural networks. Printed p.32 / PDF p.33 carries the license; printed pp.14–16 give the scalar model and pp.25–26 discuss simulation limitations.

Version 1.2 adds C01 and C04 from publisher-provided public full text on ResearchGate, and C07 from the explicitly licensed arXiv:2512.07847v3. The journal version of C07 is separately identified, not treated as the reviewed version. The previous ten approved cards are unchanged. See [the review log](reviews/2026-10-29-candidate-review.md) and each card's source locator, version, access evidence and limitations.

These additions are available through the existing research_lookup topic/query/ID retrieval. The fixed live-snapshot checklist and pit calculator are unchanged. No new predictor, CFD solver, controller or training process is executed. In particular, C07's CC BY article does not authorize use of its CC BY-NC DrivAerNet++ dataset or separately sourced weights. C04's inconsistent reported time-error percentage is excluded from approved claims.

Version 1.3 adds K10 (tire wear regression) and K11 (battery model fidelity) as explanation references. Their manuscript licenses, required inputs and transfer limits are recorded in the catalog. R09 remains excluded under CC BY-NC-ND. See [the additional review log](reviews/2026-10-29-additional-review.md). The previous 13 approved cards and all prior pending records are unchanged.

Version 1.4 rechecks the previous 15 papers and adds K12 (Monte Carlo scenarios), K13 (wake-aware overtaking), K14 (wheel/ground and attitude effects), and K15 (arXiv v4 racing-line surrogate). R10–R12 remain excluded. See the [complete Korean inventory and applicability report](reviews/2026-10-29-comprehensive-audit.md) for all 19 approved and 16 pending records. None of these four models is executed by the service. K12 is read with its production erratum; K15 is a version-specific preprint approval.

Version 1.5 adds a `driving` topic for race-driving theory: K16 (racing vs non-racing drivers, eye tracking), K17 (human vs RL agent braking and turn-in), K18 (GG-V limited planning), K19 (3D track, banking), K20 (lift-and-coast and regenerative braking), K21 (steering at the handling limit), K22 (coaching-literature drills) and K23 (expertise background). K06 and K15 are also tagged `driving`. Each has an exact CC BY 4.0 statement visible on the article page; MDPI's HTML meta tag value of 3.0 is treated as a template error because the printed statement and Crossref say 4.0. C09 (Kegelman et al., 2017) stays a candidate: its CC BY 4.0 appears only in Crossref metadata, not on the article or PDF. C10 has a metadata license but no captured body. R13–R24 are CC BY-NC-ND, arXiv non-exclusive, SAE, IEEE, Elsevier, Springer or thesis all-rights-reserved sources (including the Velenis trail-braking papers and the Casanova thesis) and are not ingested. Free-to-read is not treated as a reuse license: race-driving books, paid courses and all-rights-reserved blogs are not paraphrased into the pack. See [the driving-theory review](reviews/2026-11-06-driving-theory-review.md).

For driving questions the answer must keep the boundary between mechanism and observation. Public telemetry (speed, throttle, brake on/off, gear, distance) does not contain steering angle, brake pressure, tyre slip or g-g usage, so a card cannot prove that a driver trail-braked or used a particular line. Optimal-control lines are results for a stated vehicle and track.

## How a live answer uses the evidence

fastf1_live_snapshot attaches research_context to every available snapshot. It includes a pace-decomposition checklist, thermal/wear distinctions and pit-strategy tradeoffs with citation metadata. Live eligibility uses the existing feed freshness result plus the collector's actual topic_times records (received_at, source_time, initial_snapshot). The 45-second topic recency flag is a conservative interpretation check, not a claim that unchanged event-driven fields are invalid. Recent topic receipt does not validate individual fields or align history to a lap.

The answer must separate:
1. Observations with session, lap and timestamp.
2. A conditional explanation citing a reviewed paper.
3. Missing measurements, alternative causes and transfer limits.

Missing, disconnected, stale, finished or different-session data cannot become current observations by attaching a paper. Initial snapshots are not timed updates. Fuel, tyre temperature, wear, aero coefficients, brake temperature and SOC are still unavailable. The method checklists do not execute CFD, tyre thermodynamics or an ANN. They must not be presented as proof that a particular mechanism occurred.

research_lookup retrieves reviewed cards by topic, literal query or ID. Pending records are excluded unless include_pending=true, and then appear only as ineligible metadata/access actions. These do not become analysis references. Topic filters apply to reviewed cards; pending records have no topic classification.

## Conditional pit-loss calculation

research_pit_scenario independently implements the sum of a linear tyre-loss model:
loss = n * offset + slope * (n * starting_age + n * (n + 1) / 2).

starting_age counts completed laps; the first modeled lap uses age + 1. Both the current tyre set and replacement set can be used sets. Pit-now adds the full relative pit loss and a separately supplied, non-overlapping total warm-up loss. Positive pit_minus_stay_seconds means pit-now has higher modeled loss.

All coefficients and their provenance are required. Values must be either explicit scenario assumptions or documented fitted coefficients. The tool does not estimate them from raw timing. Base pace and fuel terms cancel only by the explicit assumption that they are identical across alternatives. There is no traffic, opponent-response, SC/VSC, changing-weather, tire allocation or sporting-rule model. It is not an optimal strategy, recommendation or validated live predictor. Do not import old regulation assumptions from the paper.

## Access and rights queue

- R01/R02: CC BY-NC; R04/R05: CC BY-NC-ND; R07/R08: CC BY-NC-SA in the previous review. These remain outside the commercial knowledge notes. Login does not resolve the license restriction. Recheck the exact version and proposed use before promotion.
- R03, DOI 10.1177/09544070211047343: the institutional record additionally lists an open accepted manuscript with an unspecified Creative Commons license. Its exact license remains unverified; the publisher version is restricted. Neither version is approved.
- R06, DOI 10.1016/j.simpat.2022.102517: institutional record describes the file as private/restricted and offers a copy request. Access and reuse both need review.
- C03/C08: publisher PDF license notices and some body sections are visible in search indexing, but direct HTML/PDF requests return 403. Partial indexed excerpts are not promoted. C08's separate doctoral thesis has a noncommercial license and is not a substitute.
- C05: indexed publisher methods/results/limitations are available, but continuous full-text retrieval and the exact publisher license remain unresolved. The institutional record labels its file restricted to registered users; its generic CC Attribution label does not resolve the publisher version's terms.
- C06: indexed methods/conclusions and an institutional CC Attribution record are available; continuous full-text retrieval and article-specific license details remain pending.
- C01/C04/C07: former access failures were resolved through the exact alternative versions stated above. A 403, 429, timeout or cookie redirect alone is not proof that payment or login is required.

A rights-holder contact or paid purchase requires a separate user instruction. Do not request credentials in chat, copy session cookies, bypass access controls, or assume a university subscription licenses service redistribution.

## Validation and release

Node tests cover citation metadata, held-source exclusion, lookup pagination, independently enumerated linear loss arithmetic, initial/old/future/unknown topic timestamps, stale feed handling, live response integration and authenticated MCP dispatch. Python collector tests remain unchanged. Build and artifact checks are required before the normal GitHub release pipeline. These tests verify implementation behavior, not real-race prediction accuracy.

Repository commit, CI success, production deployment and observed live-session validation are separate states. Do not claim a feature live based on a saved branch or PR. Tool discovery clients may need a refresh after deployment.

