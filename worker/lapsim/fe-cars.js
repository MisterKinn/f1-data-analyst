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
