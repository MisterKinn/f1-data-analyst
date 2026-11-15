# Racing line per driver (every series)

Generated 2026-11-15T04:27:03.385Z by `scripts/sim/learn/fetch-driver-lines.mjs` (GitHub Actions) and `scripts/sim/driver-lines-data.mjs`.

No public source gives a measured driven line, so each driver's line is **estimated**:

- **F1**: from the speed trace of the driver's best clean dry qualifying lap (TracingInsights), judged on the minimum speed of every
  official corner. 10 windows of least-curvature / shortest-path share.
- **Endurance (LMH, LMDh, GT3; WEC, IMSA, ELMS, Asian LMS, qualifying 2024-2026)**: Al Kamel gives no speed trace, only the three
  sector times, placed on the track with the sector positions of tobi/track-atlas. One share per timing sector.

Both first fit the **field line** (median of all drivers at that track and class: what the track, the timing lines and the car model
explain), then each driver's difference from it. The test lap is the driver's next clean lap within 2 % of the best, not used in the fit;
"before" = field line, "after" = driver line. Error: F1 RMS of corner minimum speeds, endurance RMS of sector times, %, after one
common scale.

| Group | Tracks | Drivers | Fit lap, field → driver | Unseen lap, field → driver | Unseen lap better |
|---|---|---|---|---|---|
| F1 2025 | 19 | 363 | 11.49 → 11.07 | 11.48 → 11.15 | 291 / 350 |
| F1 2026 | 15 | 294 | 12.16 → 11.72 | 11.55 → 11.18 | 202 / 265 |
| GT3 | 11 | 494 | 10.7 → 9.96 | 11.07 → 10.32 | 391 / 448 |
| LMDH | 7 | 145 | 11.31 → 10.32 | 10.87 → 9.88 | 120 / 120 |
| LMH | 7 | 105 | 11.4 → 10.37 | 11.01 → 10.01 | 96 / 96 |

## Driver names across series

One id per person (`scripts/sim/learn/drivers.mjs`): accents, case, punctuation and word order are ignored ("Kevin ESTRE" = "Kévin Estre",
"ZHOU Guanyu" = "Guanyu Zhou"); an initial or a short first name ("K. Estre", "Alex Lynn" / "Alexander Lynn") joins a full name only when
exactly one known driver fits; F1 three-letter codes come with the full name from TracingInsights. 277 people;
78 written in more than one way; 0 names left separate as ambiguous.

Written more than one way (first 40): Alessandro PIER GUIDI = Alessandro Pier Guidi; Giammarco LEVORATO = Giammarco Levorato; Sébastien BUEMI = Sebastien Buemi; Sébastien BOURDAIS = Sebastien Bourdais; Francesco Castellacci = Francesco CASTELLACCI; Ferdinand Habsburg = Ferdinand HABSBURG; Alexander Riberas = Alex RIBERAS; François HERIAU = Francois Heriau; Zacharie ROBICHON = Zacharie Robichon; Custodio TOLEDO = Custodio Toledo; Riccardo PERA = Riccardo Pera; Benjamin Keating = Ben KEATING; Benjamin Tuck = Ben TUCK; Raffaele MARCIELLO = Raffaele Marciello; Frédéric MAKOWIECKI = Frederic Makowiecki; Claudio SCHIAVONI = Claudio Schiavoni; Clément MATEU = Clement Mateu; Takeshi KIMURA = Takeshi Kimura; Stefano GATTUSO = Stefano Gattuso; Charles MILESI = Charles Milesi; Sheldon VAN DER LINDE = Sheldon van der Linde; Antonio FUOCO = Antonio Fuoco; Antonio GIOVINAZZI = Antonio Giovinazzi; Nicklas NIELSEN = Nicklas Nielsen; Stoffel VANDOORNE = Stoffel Vandoorne; Charles-Henri SAMANI = Charles-Henri Samani; Michael WAINWRIGHT = Michael Wainwright; Michael BIRCH = Michael Birch; Clemens SCHMID = Clemens Schmid; Anthony McIntosh = Anthony MCINTOSH; Mathieu Jaminet = Mathieu JAMINET; Brendon HARTLEY = Brendon Hartley; Eduardo BARRICHELLO = Eduardo Barrichello; Augusto FARFUS = Augusto Farfus; Alessio ROVERA = Alessio Rovera; Giacomo PETROBELLI = Giacomo Petrobelli; Satoshi HOSHINO = Satoshi Hoshino; William Stevens = Will STEVENS; Darren LEUNG = Darren Leung; Thomas FLOHR = Thomas Flohr.

Limits: the remaining error is mostly the car model, the track geometry and (endurance) the sector positions, not the line; the
field line takes that part, and the unseen-lap check shows whether a driver's own difference is real or noise.
