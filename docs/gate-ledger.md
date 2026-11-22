# Gate ledger

One line per Gate G run (AGENTS.md "Gate G v3 additions"). Add the line before the run with result "pending"; fill in the result after.
No line, no ship.

- **Type:** acc (accuracy claim), corr (rule or physics correctness, non-inferiority), data (data fix, no gate).
- **Idea:** one quantity on one set of held-out rows. **Attempt:** the n-th try at that idea; m counts every candidate of every attempt.
- **n:** held-out units (tracks or events; seasons sharing tracks are pooled). **k:** `kForVariants(m, n)` in `scripts/sim/gate.mjs`.
- **Decision (v3.1):** `signFlip(gains, {m})` on per-unit gains (p < 0.16 / m, n ≥ 5), with the 90 % bootstrap interval of the gain.
- **Milestones:** one line per opening of the locked confirmation set (month end or release), with the prediction-log and forward-chaining RMS and the ± coverage.
- **Day count:** accuracy gates on the same rows that day (from the 6th, add 5 to m).

| Date (KST) | Session | Pre-registration | Type | Idea | Attempt | m | n | k | Metric | Result | Shipped |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-22 | C | claude/status-2026-11-21-C.md (Step 2) | acc | F1 clipping: X superclip, Y lookahead | 1 | 2 | 67 rows | 1.45 | lap RMS % | ✗ (f1 1.061 → 1.136 / 1.155) | no |
| 2026-11-22 | C | claude/gate-driver-timing-prereg-2026-11-22.md | acc | iRacing pedal timing, GT3 + GTP (rise, pick-up, brake off) | 1 | 1 | 8–16 tracks | 1.0 | median abs vs page | ✗ every class and quantity | no |
| 2026-11-22 | C | claude/gate-f1-driver-timing-prereg-2026-11-22.md | acc | F1 brake off before apex, pole laps 2025 + 2026 | 1 | 1 | ~13 per season | 1.0 | median abs vs page | ✓ each season (v2) | #399 |
| 2026-11-22 | C | claude/gate-f1-shifts-prereg-2026-11-22.md | acc | F1 shift points, pole laps 2025 + 2026 | 1 | 1 | ~13 per season | 1.0 | median abs vs page | ✓ each season (v2) | #401 |
| 2026-11-22 | C | claude/gate-f1-driver-timing-prereg-2026-11-22.md | acc | F1 throttle (rise into τ; pick-up lead), pole laps 2025 + 2026 | 1 | 1 | ~13 per season | 1.0 | median abs vs page | ✗ | no |
| 2026-11-22 | C | claude/gate-f1-throttle-prereg-2026-11-22.md | acc | same idea as the line above (τ grid, lead grid) | 2 | 3 under v3 (was 2) | ~13 per season | v3: k(3, n) | median abs vs page | lead ✓ both, τ ✓ 2025 / ✗ 2026 (v2) | PR #402 open: re-judge under v3 |
| 2026-11-22 | C | claude/gate-iracing-shifts-prereg-2026-11-22.md | acc | iRacing shift points, GTP and GT3 | 1 | 1 | 8 tracks | v3: 1.07 | median abs vs page | GTP ✓ (+0.0093 ± 0.0012), GT3 ✗ | branch open: re-judge under v3 |

## Re-judging under v3 (before merging the open ones)
- #402 and the Hypercar shift branch: pool 2025 + 2026 per track (one value per track), k = `kForVariants(m, n)` with m = all
  candidates of all attempts at the idea, n = pooled tracks. Write the new result on the line above.
- #399 and #401 stay shipped (v2 rules at the time); when either is next touched, re-judge pooled and note it here.
