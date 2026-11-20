// Pit lane speed limits (km/h). Series rule first; an event value from the Race Director's notes overrides it for that track and year.
// Edit by hand with a source for every value. Known evidence (layer 1): official regulations and event documents.
// tracks[id].f1 = {kph, years, src}: the limit applied only in the listed seasons (src = the event notes per season); any other season uses the series rule.
export const lapsimPitSpeed = {
  series: {
    f1: {kph: 80, src: 'FIA F1 Sporting Regulations B1.6.3 a)', note: 'the Race Director may set another limit for an event'},
    wec: {kph: 60, src: 'FIA WEC Sporting Regulations art. 12.1.4'},
    imsa: {kph: 60, src: 'IMSA driver briefings 2025–26'},
  },
  // F1 races 2022–2026 whose Race Director notes set 60 km/h (G2, 2026-11-18: 112 held races, 238 note versions read; every other race 80 by
  // rule). sessions: a session that ran at another limit (Monaco 2023: V3 came after FP1, so FP1 ran at the 80 rule).
  tracks: {
    "monte-carlo": {f1: {kph: 60, years: [2022, 2023, 2024, 2025, 2026], sessions: {2023: {FP1: 80}}, src: {
      2022: "https://www.fia.com/sites/default/files/decision-document/2022 Monaco Grand Prix - Race Director's Event Notes V2.pdf",
      2023: "https://www.fia.com/sites/default/files/decision-document/2023 Monaco Grand Prix - Race Director's Event Notes V3.pdf",
      2024: "https://www.fia.com/sites/default/files/decision-document/2024 Monaco Grand Prix - Race Director's Event Notes V2.pdf",
      2025: "https://www.fia.com/system/files/decision-document/2025_monaco_grand_prix_-_race_directors_event_notes_v2.pdf",
      2026: "https://www.fia.com/system/files/decision-document/2026_monaco_grand_prix_-_race_directors_competition_notes_v3.pdf"}}},
    "paul-ricard-f1": {f1: {kph: 60, years: [2022], src: {
      2022: "https://www.fia.com/sites/default/files/decision-document/2022 French Grand Prix - Race Director's Event Notes V3.pdf"}}},
    singapore: {f1: {kph: 60, years: [2022, 2023, 2024], src: {
      2022: "https://www.fia.com/sites/default/files/decision-document/2022 Singapore Grand Prix - Race Director's Event Notes.pdf",
      2023: "https://www.fia.com/sites/default/files/decision-document/2023 Singapore Grand Prix - Event Notes v2.pdf",
      2024: "https://www.fia.com/sites/default/files/decision-document/2024 Singapore Grand Prix - Race Director's Event Notes V2.pdf"}}},
    zandvoort: {f1: {kph: 60, years: [2022, 2023, 2024], src: {
      2022: "https://www.fia.com/sites/default/files/decision-document/2022 Dutch Grand Prix - Race Director's Event Notes V2.pdf",
      2023: "https://www.fia.com/sites/default/files/decision-document/2023 Dutch Grand Prix - Race Director's Event Notes V3.pdf",
      2024: "https://www.fia.com/sites/default/files/decision-document/2024 Dutch Grand Prix - Race Director's Event Notes.pdf"}}},
  },
};

// The limit for one series, track and season; without a season the series rule (callers pass the season they simulate).
export function pitSpeedKph(series, trackId, year, session) {
  const ev = lapsimPitSpeed.tracks[trackId]?.[series];
  return ev && ev.years.includes(Number(year)) ? ev.sessions?.[year]?.[session] ?? ev.kph : lapsimPitSpeed.series[series]?.kph ?? null;
}
