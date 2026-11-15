# Racing line per driver (every series)

Generated 2026-11-15T11:52:31.329Z by `scripts/sim/learn/fetch-driver-lines.mjs` (GitHub Actions) and `scripts/sim/driver-lines-data.mjs`.

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
| F1 2025 | 23 | 443 | 11.61 → 11.06 | 11.38 → 10.98 | 352 / 421 | yes |
| F1 2026 | 18 | 359 | 12.42 → 12.02 | 11.8 → 11.5 | 212 / 324 | yes |
| FE-GEN3EVO | 9 | 194 | 0.6 → 0.46 | 0.68 → 0.66 | 67 / 177 | no: not better than the field line on unseen laps |
| GT3 | 22 | 941 | 1.96 → 1.5 | 2 → 1.68 | 566 / 871 | yes |
| LMDH | 13 | 264 | 2.06 → 1.58 | 2.17 → 1.83 | 157 / 242 | yes |
| LMH | 8 | 116 | 0.66 → 0.29 | 0.6 → 0.52 | 54 / 106 | yes |

## Driver names across series

One id per person (`scripts/sim/learn/drivers.mjs`): accents, case, punctuation and word order are ignored ("Kevin ESTRE" = "Kévin Estre",
"ZHOU Guanyu" = "Guanyu Zhou"); an initial or a short first name ("K. Estre", "Alex Lynn" / "Alexander Lynn") joins a full name only when
exactly one known driver fits; F1 three-letter codes come with the full name from TracingInsights. 405 people;
117 written in more than one way; 0 names left separate as ambiguous.

Written more than one way (first 40): Christopher Mies = Christopher MIES; Alessandro Pier Guidi = Alessandro PIER GUIDI; Giammarco Levorato = Giammarco LEVORATO; Alexander LYNN = Alex LYNN; Sébastien BUEMI = Sebastien Buemi; Alexander Riberas = Alex Riberas = Alex RIBERAS; Sebastian Priaulx = Seb Priaulx; Alexander Sims = Alexander SIMS; Sebastien Bourdais = Sébastien BOURDAIS; Francesco CASTELLACCI = Francesco Castellacci; Ferdinand HABSBURG = Ferdinand Habsburg; Francois Heriau = François HERIAU; Benjamin Keating = Ben KEATING; Zacharie Robichon = Zacharie ROBICHON; Benjamin Tuck = Ben TUCK; Custodio Toledo = Custodio TOLEDO; Benjamin Barker = Benjamin BARKER; Nicholas Yelloly = Nick Yelloly; Nicholas Tandy = Nick Tandy = Nick TANDY; Riccardo PERA = Riccardo Pera; Frédéric MAKOWIECKI = Frederic Makowiecki; Michelle Gatting = Michelle GATTING; Frederik Schandorff = Frederik SCHANDORFF; Raffaele MARCIELLO = Raffaele Marciello; Valentin Hasse-Clot = Valentin Hasse Clot; Claudio Schiavoni = Claudio SCHIAVONI; Clément MATEU = Clement Mateu; Takeshi Kimura = Takeshi KIMURA; Stefano GATTUSO = Stefano Gattuso; Charles MILESI = Charles Milesi; Sheldon van der Linde = Sheldon VAN DER LINDE; Nicolas VARRONE = Nico Varrone; Antonio Fuoco = Antonio FUOCO; Antonio GIOVINAZZI = Antonio Giovinazzi; Nicklas NIELSEN = Nicklas Nielsen; Stoffel VANDOORNE = Stoffel Vandoorne; Charles-Henri Samani = Charles-Henri SAMANI; Michael Wainwright = Michael WAINWRIGHT; Michael BIRCH = Michael Birch; Bihuang Zhou = Zhou Bihuang.

Track and class groups left out because their drivers were not better than the field line on unseen laps: austin LMDH (0.57 → 0.60 %, 9 drivers), imola LMDH (0.61 → 0.62 %, 20 drivers), interlagos F1 2026 (11.86 → 11.94 %, 15 drivers), sakhir GT3 (0.36 → 0.44 %, 35 drivers), silverstone GT3 (0.43 → 0.43 %, 13 drivers), zandvoort F1 2025 (10.03 → 10.04 %, 19 drivers), zandvoort F1 2026 (9.18 → 9.18 %, 22 drivers), fe-mexico FE-GEN3EVO (0.57 → 0.60 %, 16 drivers), fe-sanya FE-GEN3EVO (0.32 → 0.33 %, 16 drivers), fe-shanghai FE-GEN3EVO (0.29 → 0.36 %, 25 drivers), fuji LMDH (0.40 → 0.42 %, 15 drivers), fuji LMH (0.38 → 0.41 %, 9 drivers), le-mans LMH (0.41 → 0.41 %, 24 drivers), long-beach GT3 (0.86 → 0.88 %, 30 drivers), long-beach LMDH (0.82 → 0.85 %, 19 drivers).

2026 races not held (Bahrain, Saudi Arabia): the TracingInsights folders of those events are not a qualifying on the layout (field error above 50 %), so they give no driver lines.

Not possible with the data we have: **SRO GT3** (GT World Challenge, IGTC, British GT) per driver. The SRO result tables give one best
lap per car without sectors, and the Timing71 lap rows name the driver in only 54 of 775,064 GT3 rows (the rest carry a seat number).
SRO GT3 cars keep the car line; their drivers appear only where they also raced WEC, IMSA, ELMS or Asian LMS. Formula E driver lines
were fitted but did not beat the field line on unseen laps, so the page keeps the car line for Formula E (table above).

Limits: the remaining error is mostly the car model, the track geometry and (endurance) the sector positions, not the line; the
field line takes that part, and the unseen-lap check shows whether a driver's own difference is real or noise.
