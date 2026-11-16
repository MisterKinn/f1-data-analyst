# Formula E Attack Zones on the simulator maps (Gen3 Evo, Gen4)

Built by `scripts/sim/fe-zones.mjs` into `worker/lapsim/fe-zones-data.js` (owner 2026-11-16). Shown on the track map (blue outer band, AZ) when a Formula E car is chosen.

## Rules

Formula E has no DRS or Straight Mode. The only track zone is the Attack Mode zone.

| Rule set | Zone | Power | 4WD | Source |
|---|---|---|---|---|
| Gen3 Evo (2024-26) | activation zone, shape and place per circuit, visible on track and TV | 300 kW rear (Normal Mode) → 350 kW in Attack Mode | only in Attack Mode, front max 50kW / 60Nm | 2025-26 Sporting Regulations (27.02.2026) Art. 37.3 a), b), g) |
| Gen4 (2026-27) | Attack Zone, three timing loops (Appendix 4) | Race Mode (max 450kW, Bulletin) + 150kW | always | 2026-27 Sporting Regulations Art. 27.3 d), 27.4, Appendix 4 |

Both: quantity of Attack Mode per race in a Bulletin; not in the driver's first 2 laps, not under FCY/SC, not when the zone is under yellow. Gen4: the timer can be paused under neutralisation and resumes after the Attack Zone. Pit Boost is a pit stop, not a track zone. The zone only arms Attack Mode; the power lasts a set time, so the simulated lap does not change.

## Positions

- Formula E tracks: the "ATTACK (ZONE)" label of the official circuit map that gave the track line, put on the nearest point of the line. A label more than 80 m from the line (leader arrow) is marked approximate. Length is not printed: every zone is drawn 60 m.
- Gen4: no Gen4 event map yet, so each track keeps its Gen3 Evo zone (estimate) until the Gen4 map is published.
- Other tracks (virtual, like the F1 estimated SM zones): the corner whose sharpness rank is closest to the printed zones' median (0.43), 12 m from its apex. Learned from 7 printed zones: fe-london rank 0.18 +28 m; fe-sanya rank 0.43 +12 m; fe-berlin rank 0.29 +14 m; fe-miami rank 0.22 +12 m; fe-valencia rank 0.64 -87 m; fe-jakarta rank 0.91 -36 m; jarama-2025 rank 0.50 +36 m.

| Track | Gen3 Evo zone | Lap distance |
|---|---|---|
| fe-london | printed | 1678–1738 m |
| fe-tokyo | approximate | 1619–1679 m |
| fe-shanghai | approximate | 197–257 m |
| fe-sanya | printed | 57–117 m |
| fe-berlin | printed | 1033–1093 m |
| jarama | approximate | 1706–1766 m |
| fe-jeddah | approximate | 2882–2942 m |
| fe-miami | printed | 451–511 m |
| fe-mexico | approximate | 1256–1316 m |
| fe-sao-paulo | approximate | 2362–2422 m |
| fe-valencia | printed | 388–448 m |
| fe-jakarta | printed | 1474–1534 m |
| fe-miami-2025 | approximate | 1537–1597 m |
| fe-mexico-2023 | approximate | 1267–1327 m |
| jarama-2025 | printed | 2511–2571 m |
