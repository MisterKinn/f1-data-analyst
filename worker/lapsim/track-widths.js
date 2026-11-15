// Official track widths in metres for the map on /simulation (owner 2026-11-15, task H). The page draws a track with its TUM
// measured edges where they exist, else this table, else the map width (quality.widthM), else 12 m marked "assumed".
// One width per track: the stated width, or the middle of a stated range. Not yet used by the lap simulation (needs a refit).
export const lapsimTrackWidths = {
  'kuala-lumpur': {m: 16, source: 'Sepang circuit specs (MotoGP): 16 m'},
  lusail: {m: 12, source: 'Lusail circuit specs (MotoGP): 12 m'},
  imola: {m: 12.5, source: 'Imola circuit: 10 to 15 m (middle)'},
  baku: {m: 10.3, source: 'Baku City Circuit: 7.6 m (Old Town) to 13 m (middle)'},
  istanbul: {m: 15, source: 'Istanbul Park: average 15 m (14 to 21.5 m)'},
  daytona: {m: 12.2, source: 'Daytona: oval 40 ft, infield and chicane 30 to 50 ft'},
  'watkins-glen': {m: 11.6, source: 'Watkins Glen: 36 to 48 ft, average 38 ft'},
  jeddah: {m: 13, source: 'Jeddah Corniche Circuit: 10 to 16 m (middle)'},
  mosport: {m: 12, source: 'CTMP: repaved and widened to 12 m (40 ft)'},
  vir: {m: 12.2, source: 'VIR: widened to 40 ft'},
  'mid-ohio': {m: 12.2, source: 'Mid-Ohio: 40 ft racing surface'},
};
