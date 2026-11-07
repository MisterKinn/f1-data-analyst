// Per-event ERS recharge limit for a qualifying lap (MJ), 2026 F1 (Article C5.2.10 with the
// per-Competition values the FIA sets under B7.2.1b). The regulation default is 8.5 MJ; the FIA
// lowers it per circuit and cut the qualifying baseline from 8 to 7 MJ from Miami 2026.
// The FIA sends these values to teams; the public figures come from press reports listed in
// `sources`. They may differ slightly from the final values.
export const ENERGY_LIMITS = {
  2026: {
    quali: {
      melbourne: 7, shanghai: 9, suzuka: 8, miami: 8, montreal: 6, 'monte-carlo': 9, catalunya: 7,
      spielberg: 6, silverstone: 7.5, 'spa-francorchamps': 8, hungaroring: 9, zandvoort: 7.5, monza: 5,
      madring: 8, baku: 8.5, singapore: 9, austin: 8, 'mexico-city': 8.5, interlagos: 6.5, 'las-vegas': 6,
      lusail: 8, 'yas-marina-circuit': 7,
    },
    defaultQuali: 7,
    sources: [
      {title: 'RaceFans: FIA cuts F1 qualifying energy limit at Suzuka (Melbourne, Shanghai, Suzuka)', url: 'https://www.racefans.net/2026/03/26/theyre-making-us-even-slower-fia-cuts-f1-qualifying-energy-limit-at-suzuka/'},
      {title: "The Race: F1's new energy rankings for qualifying revealed (Miami onward)", url: 'https://www.the-race.com/formula-1/f1s-new-energy-rankings-for-qualifying-revealed/'},
    ],
  },
};

// Recharge limit (MJ) for a qualifying lap of `year` cars on track `id`. Seasons after the latest
// listed one reuse its per-circuit values (the FIA keeps the circuit ranking; the default changes).
export function rechargeLimitMJ(id, year) {
  const years = Object.keys(ENERGY_LIMITS).map(Number).filter(y => y <= year);
  if (!years.length) return null;
  const e = ENERGY_LIMITS[Math.max(...years)];
  return e.quali[id] ?? e.defaultQuali;
}
