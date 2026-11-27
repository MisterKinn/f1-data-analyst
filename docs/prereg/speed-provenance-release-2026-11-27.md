# Speed provenance display release

- Type: display-only correctness; no physics, fit, source-data or lap prediction change.
- Baseline: latest main da61e761868891db2cc50967f27e8ce62a0002fc and the currently deployed browser script, evaluated on identical local page inputs.
- Candidate: one; expose the existing raw kernel speed as a separately labelled model lane when measured telemetry exists. Preserve every measured lane.
- Primary: exact parity of existing lap/facts/map/telemetry lanes and CSV columns, excluding the added model lane and cursor position.
- Scenarios: Monza English desktop, Silverstone Korean desktop, Monza Korean mobile; default, DRS off, manual conditions (9 states, 3 CSV comparisons).
- Pass: parity in every scenario; translated model labels, hide/show and shared cursor work; no browser errors; regression tests and build pass.
- Stop: any existing output changes or any failure. Do not change model parameters to pass. No accuracy or held-out improvement claim; diagnostic local results are not a pipeline reproduction.
- Deployment: GitHub PR, passing CI, merge, existing native Vercel main deployment; verify Production asset hash and real browser interactions.
