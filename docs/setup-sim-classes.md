# SetupSim: GT3, LMP2, every circuit, qualifying vs race, live sessions (owner 2026-11-16)

- **Cars.** GT3 per car model: every model the learning step knows (`worker/lapsim/learned-data.js`, base names, not the IMSA/ACO/DTM
  BoP-body duplicates). Engine layout sets the static rear weight share (front-mid 52 %, mid 57 %, rear 61 %, assumed). The BoP is the
  WEC LMGT3 estimate of the make at this track. LMP2: the Oreca 07 Gibson only: the LMDh class car without hybrid at 1,020 kg and 447 kW
  (layer 4, assumed until an LMP2 fit exists). No traction-control knob for LMP2 (no TC article found; ABS banned, LMP2 TR 14.5).
- **Circuits.** Every simulator circuit, for every series. Circuits a series does not visit use the plausible default weather.
- **Qualifying vs race.** WEC and IMSA may change the set-up between qualifying and race (WEC: parc fermé only after the race, SR 15.1.3;
  IMSA impounds only selected cars after qualifying). ELMS (SR 10.2.5), GT World Challenge (briefing notes: parc fermé after
  qualifying) and DTM put cars in parc fermé after qualifying, and F1 from qualifying to the race: one set-up there.
  Race set-up = mean stint fuel (+25 kg prototypes, +30 kg GT3) and worn tyres (−1.5 % grip), then less camber, more brake cooling and
  more traction control. All assumed (layer 4) until fitted from stint data.
- **Live.** During an event weekend (4 days from the first session) the plan uses the real weather of the latest session of that event:
  F1 from OpenF1 (`worker/setup-live.js`, circuit_key), WEC from the Al Kamel weather file of the latest published session. So the estimate
  moves after every FP1/FP2/FP3/qualifying/race. OpenF1 locks free users during a live F1 session; the update arrives when it opens.
  IMSA, ELMS and the GT3 series have no live source in the worker yet. Between events, the weekly learning run refits the cars and tracks.
- Tests: `tests/setup-gt3-lmp2.test.mjs`.

## iRacing setup learning, layer 4 (session C, 2026-11-21)

Source: the CarSetup block of the 407 SRS 26S4 pro setups (`scripts/sim/learn/iracing/setup_table.py` on the owner's PC; raw files stay
there). Every session is "Offline Testing", so qualifying vs race setups cannot be learned from this pack.
- **Shipped:** GT3 static rear weight share per car (corner weights), 11 car families, Gate G 11/11 cars, gain 0.0189 ± 0.0058
  (#356, `setup_weight.py`). Shown as "model (iRacing)" with the session count; other GT3 cars keep the engine-layout guess (assumed).
- **Not shipped (Gate G per track, `setup_knob_gate.py`):** the SetupSim knob, scaled to the setup unit on the other tracks, does not
  predict a held-out track's setups better than "no track effect" for any knob. Values are each session minus that car's median.

| Class | Knob | Tracks | Sessions | Gain ± SE | Rank agreement ρ (p) | Track spread |
|---|---|---|---|---|---|---|
| GT3 | ride height (rear, mm) | 14 | 142 | −0.085 ± 0.033 ✗ | 0.00 (1.00) | 2.6 mm |
| GT3 | springs (N/mm) | 14 | 142 | −0.29 ± 0.75 ✗ | 0.64 (0.014) | 11 N/mm |
| GT3 | rear wing | 14 | 135 | −0.06 ± 0.19 ✗ | 0.41 (0.15) | 2.1 |
| GT3 | camber (deg) | 14 | 142 | −0.003 ± 0.001 ✗ | −0.26 (0.37) | 0.06° |
| GT3 | diff preload | 14 | 142 | −0.30 ± 0.11 ✗ | 0.22 (0.46) | 5.9 |
| GT3 | TC setting | 14 | 142 | −0.10 ± 0.02 ✗ | 0.55 (0.042) | 0.28 |
| GT3 | dampers (clicks) | 14 | 128 | −0.03 ± 0.01 ✗ | −0.13 (0.66) | 0.8 |
| GTP | ride height / springs / camber | 8 | 37 | all ✗ | −0.12…0.36 | – |
| LMP | ride height / springs / camber | 11 | 14 | all ✗ | −0.24…0.31 | – |

Reading: pro GT3 setups change little from track to track (front ride height ±0.35 mm, camber ±0.06°); the size of the SetupSim moves
is not supported. The direction agrees for springs and TC only (ρ 0.64 and 0.55). All knobs stay labelled assumed. Ride height and
springs do not follow bumpiness either (ρ −0.17…−0.01 against the learned track roughness).
