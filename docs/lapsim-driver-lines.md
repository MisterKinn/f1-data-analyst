# Racing line per driver (every series)

Generated 2026-11-15T05:44:05.795Z by `scripts/sim/learn/fetch-driver-lines.mjs` (GitHub Actions) and `scripts/sim/driver-lines-data.mjs`.

No public source gives a measured driven line, so each driver's line is **estimated**:

- **F1**: from the speed trace of the driver's best clean dry qualifying lap (TracingInsights), judged on the minimum speed of every
  official corner. 10 windows of least-curvature / shortest-path share.
- **Endurance (LMH, LMDh, GT3; WEC, IMSA, ELMS, Asian LMS, qualifying 2024-2026), Formula E (Gen2, Gen3, Gen3 Evo; Al Kamel
  qualifying) and SRO GT3 (Timing71 laps that name the driver)**: no speed trace, only the three sector times. Sector positions:
  tobi/track-atlas when they put the field's sector shares within 1.5 % of the lap on this layout; otherwise estimated (the cut pair
  that makes the car line's simulated shares match the field's median shares). One share per timing sector.

Both first fit the **field line** (median of all drivers at that track and class: what the track, the timing lines and the car model
explain), then each driver's difference from it. The test lap is the driver's next clean lap within 2 % of the best, not used in the fit;
"before" = field line, "after" = driver line. Error: F1 RMS of corner minimum speeds, endurance RMS of sector times, %, after one
common scale.

| Group | Tracks | Drivers | Fit lap, field → driver | Unseen lap, field → driver | Unseen lap better | Shown |
|---|---|---|---|---|---|---|
| F1 2025 | 23 | 443 | 11.74 → 11.24 | 11.51 → 11.16 | 352 / 421 | yes |
| F1 2026 | 19 | 366 | 12.65 → 12.25 | 11.91 → 11.61 | 215 / 327 | yes |
| FE-GEN2 | 6 | 162 | 0.99 → 0.83 | 0.98 → 1 | 40 / 103 | no: not better than the field line on unseen laps |
| FE-GEN3 | 12 | 271 | 0.74 → 0.57 | 0.63 → 0.57 | 129 / 264 | no: not better than the field line on unseen laps |
| FE-GEN3EVO | 11 | 241 | 0.58 → 0.45 | 0.64 → 0.65 | 76 / 223 | no: not better than the field line on unseen laps |
| GT3 | 15 | 669 | 1.37 → 1.06 | 1.39 → 1.22 | 389 / 603 | yes |
| LMDH | 8 | 160 | 1.78 → 1.36 | 1.82 → 1.48 | 99 / 139 | yes |
| LMH | 8 | 116 | 1.41 → 0.99 | 1.36 → 1.15 | 71 / 106 | yes |

## Driver names across series

One id per person (`scripts/sim/learn/drivers.mjs`): accents, case, punctuation and word order are ignored ("Kevin ESTRE" = "Kévin Estre",
"ZHOU Guanyu" = "Guanyu Zhou"); an initial or a short first name ("K. Estre", "Alex Lynn" / "Alexander Lynn") joins a full name only when
exactly one known driver fits; F1 three-letter codes come with the full name from TracingInsights. 320 people;
83 written in more than one way; 0 names left separate as ambiguous.

Written more than one way (first 40): Alessandro PIER GUIDI = Alessandro Pier Guidi; Giammarco LEVORATO = Giammarco Levorato; Alexander LYNN = Alex LYNN; Sébastien BUEMI = Sebastien Buemi; Alexander Riberas = Alex RIBERAS; Francesco CASTELLACCI = Francesco Castellacci; Sébastien BOURDAIS = Sebastien Bourdais; Ferdinand HABSBURG = Ferdinand Habsburg; Francois Heriau = François HERIAU; Benjamin Keating = Ben KEATING; Zacharie ROBICHON = Zacharie Robichon; Benjamin Tuck = Ben TUCK; Custodio Toledo = Custodio TOLEDO; Riccardo PERA = Riccardo Pera; Frédéric MAKOWIECKI = Frederic Makowiecki; Raffaele MARCIELLO = Raffaele Marciello; Claudio Schiavoni = Claudio SCHIAVONI; Clément MATEU = Clement Mateu; Takeshi Kimura = Takeshi KIMURA; Stefano GATTUSO = Stefano Gattuso; Charles MILESI = Charles Milesi; Sheldon VAN DER LINDE = Sheldon van der Linde; Antonio FUOCO = Antonio Fuoco; Antonio GIOVINAZZI = Antonio Giovinazzi; Nicklas NIELSEN = Nicklas Nielsen; Stoffel VANDOORNE = Stoffel Vandoorne; Charles-Henri Samani = Charles-Henri SAMANI; Michael Wainwright = Michael WAINWRIGHT; Michael BIRCH = Michael Birch; Bihuang Zhou = Zhou Bihuang; Satoshi Hoshino = Satoshi HOSHINO; Anthony McIntosh = Anthony MCINTOSH; Giacomo Petrobelli = Giacomo PETROBELLI; Antonio Felix da Costa = António Félix DA COSTA = Antonio Félix DA COSTA; Brendon HARTLEY = Brendon Hartley; Eduardo BARRICHELLO = Eduardo Barrichello; Clemens SCHMID = Clemens Schmid; Mathieu JAMINET = Mathieu Jaminet; Augusto FARFUS = Augusto Farfus; Alessio ROVERA = Alessio Rovera.

Limits: the remaining error is mostly the car model, the track geometry and (endurance) the sector positions, not the line; the
field line takes that part, and the unseen-lap check shows whether a driver's own difference is real or noise.
