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
