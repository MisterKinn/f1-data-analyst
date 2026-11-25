# Step 35 G — amendment A1 (before the run): owner rule 08:38 (real aero, no lap-only tuning)

Base pre-reg: docs/prereg/step35-fe-G-sector-proj-2026-11-26.md (sha256 89129e74…), unchanged.
- G moves no fitted parameter. The FE lap fit must stay byte-identical; the judge already checks this. If it does not, the run is FAIL.
- No aero value changes (FE CdA, ClA, μ stay as in step35-fe-D 9f51f773). The report lists them with a note on whether each is inside its source window.
- The sector-line positions come from the printed map distances only. They are never tuned to lower the sector or lap error.
- Flag, not changed here: the FE fit's G (rule set) and T (layout) are lap-time factors fitted to lap error with no physical source window.
  Under rule 08:38 they need a label or a physical explanation. Central decides; G does not touch them.
