# GTWC support review — 2026-10-30

The current application has calendar entries and logos for Europe, Asia, America and Australia, but no GTWC ingestion adapter in official.js or series_standings.js. They must not be advertised as supported post-race analysis.

Reviewed each region's official results index and representative event/session pages:
- Europe: https://www.gt-world-challenge-europe.com/results/2026/circuit-paul-ricard/main-race
- Asia: https://www.gt-world-challenge-asia.com/results/2026/sepang/race-1
- America: https://www.gt-world-challenge-america.com/results/2026/sonoma-raceway/
- Australia: https://www.gt-world-challenge-australia.com/results/2026/gt-festival-phillip-island

Official classifications exist. This is not a finding that official timing is unreliable or that detailed timing cannot exist elsewhere. We have not audited every historical file. The product has not demonstrated reliable retrieval and parsing of all-car lap/sector histories, pit events, driver changes where relevant, final/provisional status, and multi-event coverage with provenance. No region currently meets the user's required Al Kamel-comparable end-to-end service standard.

All four regions are therefore reference-only: retain shared white GTWC logo and independently sourced calendar information, remove analysis selection and generic analysis promotion, exclude from the supported-analysis API list. Existing detail URLs explicitly state analysis is unavailable. Restore support only after source coverage and ingestion are validated with representative sessions and regression fixtures.

Account follow-up: authenticated website requests and Google callback resolve the stable provider subject to the existing site account. First linking requires verified simultaneous identities with matching email; later Google-only or ChatGPT-only sessions reuse that mapping without another linking step. Never merge unproven identities solely by typed/email similarity, nor imply a Google cookie creates a ChatGPT platform session.
