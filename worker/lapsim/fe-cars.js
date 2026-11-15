// Formula E cars of the lap simulator, one per rule set (owner 2026-11-14: FE learned per car type, shown per regulation).
// Gen4 is the prior of fe-gen4.js (no Gen4 lap exists yet). Gen3 Evo is a reference car from the regulation values; its bias and
// every track's factor are learned from the Al Kamel laps (scripts/sim/learn/build-fe.mjs). Older rule sets are not modelled (owner 2026-11-15).
import {modeCar, gen3EvoCar} from './fe-gen4.js';

export const FE_GENS = {
  'fe-gen4': {gen: 'gen4', label: 'Formula E Gen4 (2026-27, prior)', seasons: [2027], car: modeCar('qualifying')},
  'fe-gen3evo': {gen: 'gen3evo', label: 'Formula E Gen3 Evo (2024-26)', seasons: [2025, 2026], car: gen3EvoCar(1.5)},
  // owner 2026-11-15: Formula E from Gen3 Evo on only (Gen3 and Gen2 are not shown)
};
// Not shown: Gen3 (2023-24) laps only help the fit learn each track's factor on layouts Gen3 Evo shares (without them the Gen3 Evo
// event-hidden error rises from 2.0 to 2.5 %). 350 kW qualifying, rear drive, 854 kg with driver, Hankook iON Race.
export const FE_FIT_ONLY = {'fe-gen3': {gen: 'gen3', label: 'Formula E Gen3 (2022-24)', seasons: [2023, 2024], car: {...gen3EvoCar(1.42), awdAboveKph: null, label: 'Gen3 350 kW (reference)', mass: 854}}};
export const feKeyOf = season => season >= 2027 ? 'fe-gen4' : season >= 2025 ? 'fe-gen3evo' : season >= 2023 ? 'fe-gen3' : null; // Gen2 is not modelled

// Qualifying power (owner 2026-11-15): the groups run below full power, the duels (and free practice) at full power.
// fiaformulae.com, "How does Formula E's Groups and Duels qualifying format work?": Gen3 and Gen3 Evo groups 300 kW, duels 350 kW;
// Season 8 (2021-22, Gen2, first year of the duels) groups 220 kW, duels 250 kW. Seasons 5-7 (Gen2): 250 kW in every qualifying
// session (groups and Super Pole). The `car` of each rule set is the full-power car; a group lap is simulated at the group power.
export const FE_QUALI_KW = season => season >= 2027 ? null : season >= 2023 ? {group: 300, duel: 350} : season >= 2022 ? {group: 220, duel: 250} : {group: 250, duel: 250};
export const feIsGroup = session => /qualifying[ -]group/i.test(session || '');
// power of the session a lap was set in (kW), or null when it is the full power of the rule-set car
export function feSessionKW(season, session, type) { const q = FE_QUALI_KW(season); if (!q || type !== 'Q') return null; return feIsGroup(session) ? q.group : q.duel; }
export function feCarFor(key, season, session, type) { const car = (FE_GENS[key] || FE_FIT_ONLY[key]).car, kw = feSessionKW(season, session, type);
  return kw == null || kw * 1e3 === car.pIce ? car : {...car, pIce: kw * 1e3, label: car.label.replace(/\d+ kW/, kw + ' kW')}; }
