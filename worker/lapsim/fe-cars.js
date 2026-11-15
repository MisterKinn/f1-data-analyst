// Formula E cars of the lap simulator, one per rule set (owner 2026-11-14: FE learned per car type, shown per regulation).
// Gen4 is the prior of fe-gen4.js (no Gen4 lap exists yet). Gen3 Evo, Gen3 and Gen2 are reference cars from the regulation
// values; their bias and every track's factor are learned from the Al Kamel laps (scripts/sim/learn/build-fe.mjs).
import {modeCar, gen3EvoCar} from './fe-gen4.js';

const rwd = c => ({...c, awdAboveKph: null}); // Gen3 and Gen2: only the rear motor drives
export const FE_GENS = {
  'fe-gen4': {gen: 'gen4', label: 'Formula E Gen4 (2026-27, prior)', seasons: [2027], car: modeCar('qualifying')},
  'fe-gen3evo': {gen: 'gen3evo', label: 'Formula E Gen3 Evo (2024-26)', seasons: [2025, 2026], car: gen3EvoCar(1.5)},
  // Gen3: 350 kW qualifying, rear drive, 854 kg with driver (840 kg car minimum + the 2024 ballast change), Hankook iON Race
  'fe-gen3': {gen: 'gen3', label: 'Formula E Gen3 (2022-24)', seasons: [2023, 2024], car: rwd({...gen3EvoCar(1.42), label: 'Gen3 350 kW (reference)', mass: 854})},
  // Gen2: 250 kW qualifying, rear drive, 903 kg with driver, Michelin Pilot Sport EV
  'fe-gen2': {gen: 'gen2', label: 'Formula E Gen2 (2018-22)', seasons: [2019, 2020, 2021, 2022], car: rwd({...gen3EvoCar(1.3, {clA: 1.4, cdA: 0.85}), label: 'Gen2 250 kW (reference)', mass: 903, pIce: 250e3, wheelbase: 3.1, vMax: 280 / 3.6, regen: {maxW: 250e3, share: 0.6, eta: 0.95}})},
};
export const feKeyOf = season => season >= 2027 ? 'fe-gen4' : season >= 2025 ? 'fe-gen3evo' : season >= 2023 ? 'fe-gen3' : 'fe-gen2';

// Qualifying power (owner 2026-11-15): the groups run below full power, the duels (and free practice) at full power.
// fiaformulae.com, "How does Formula E's Groups and Duels qualifying format work?": Gen3 and Gen3 Evo groups 300 kW, duels 350 kW;
// Season 8 (2021-22, Gen2, first year of the duels) groups 220 kW, duels 250 kW. Seasons 5-7 (Gen2): 250 kW in every qualifying
// session (groups and Super Pole). The `car` of each rule set is the full-power car; a group lap is simulated at the group power.
export const FE_QUALI_KW = season => season >= 2027 ? null : season >= 2023 ? {group: 300, duel: 350} : season >= 2022 ? {group: 220, duel: 250} : {group: 250, duel: 250};
export const feIsGroup = session => /qualifying[ -]group/i.test(session || '');
// power of the session a lap was set in (kW), or null when it is the full power of the rule-set car
export function feSessionKW(season, session, type) { const q = FE_QUALI_KW(season); if (!q || type !== 'Q') return null; return feIsGroup(session) ? q.group : q.duel; }
export function feCarFor(key, season, session, type) { const car = FE_GENS[key].car, kw = feSessionKW(season, session, type);
  return kw == null || kw * 1e3 === car.pIce ? car : {...car, pIce: kw * 1e3, label: car.label.replace(/\d+ kW/, kw + ' kW')}; }
