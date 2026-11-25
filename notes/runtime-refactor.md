# Runtime cost refactor — 2026-11-25

## Contract

- Baseline: canonical main `4e60d9fac17ab01b62afae0a5781f578e85e4a09`.
- Worktree: `f1-data-analyst-refactor`, branch `refactor/runtime-costs`; existing checkout remains untouched.
- No model change: physics, calibration, measured data and stored-view keys retain their semantics.
- Preserve authentication, authorization, account isolation, conditional/atomic writes and rendered results.
- Local implementation and verification only. Push, production deployment, billing and data migration require separate authorization.
- Never claim production or universal equivalence from local tests alone.

## Backup

- Sibling directory `f1-data-analyst-refactor-backup/main-4e60d9f.tar.gz`: tracked baseline source.
  SHA-256: `417b75c409b2f11206074f88706c45113cf05dd15826f14fa5b5573fc1f3eb2b`.
- `existing-handoffs.tar.gz`: original checkout's uncommitted handoff documents.
  SHA-256: `4f08fd2134b873077b7ec1027835f0199d7d432e6941bf7f60939f2286a7fe2b`.

## Checkpoints

- [x] Resolve canonical main, repository authority and preserve existing changes; back up source.
- [x] Establish baseline Node 22 test results: 841 pass, 0 fail, 1 skip.
- [x] Unconditional Firestore set; preserve transactional preconditions; sample diagnostics at 2%.
- [x] Simulator request normalization, bounded descriptor cache and in-flight coalescing; HTML equality tests.
- [x] Build-time public assets, local byte equality and routing configuration; hosted function bypass remains to verify after deployment authorization. Browser cache policy deliberately shortened; versions retained.
- [x] Separate route/storage responsibilities without changing account authorization or moving live data. Public/private page loading and physical collection migration deferred.
- [x] Full regression/build/artifact checks; independent diff review and before/after evidence.
- [x] Final handoff with remaining risks and recommended follow-up.

## Verification

Use Node 22. Test logs live in ignored `.cache/refactor/`. Compare baseline and refactor on the same code inputs and runtime.
CPU timings are local measurements, not Vercel billing predictions. Diagnostic sampling intentionally reduces retained observations.

Final local result: **PASS**.

- `release-check.tap`: 852 tests, 851 pass, 0 fail, 1 skip; Node 22, all features, baseline comparison enabled. The W2-F replay test requires an optional bundle not present locally and is skipped, as in baseline.
- `features-off.tap`: 1 pass, 0 fail.
- `equivalence-final.tap`: 4 pass; includes 36 page responses, 191 assets and 6 MCP responses compared with baseline, purpose boundaries and no-storage request coalescing.
- Build: 191 public assets; ESM artifact validation passed. Existing duplicate translation-key warnings remain in unchanged simulation source.
- `git diff --check`: passed. Physics/model source diff: empty. Changed-source credential-pattern scan: no matches (not a general security audit).
- Intermediate full regression exposed four failures caused by optional storage capabilities being incorrectly advertised. Fixed the adapter, added capability regression coverage, and reran the full suite successfully. No failed tests are waived.
- Original Google browser login, hosted static routing, live billing and Production deployment are not verified or changed in this phase.

See `docs/runtime-costs.md` for reproduction, measurements and deferred work, and `notes/progress.md` for the next-session handoff.
