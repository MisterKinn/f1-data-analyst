// Series and classes the simulator calibrates with one common rule set:
// values fixed by the rules or BoP stay fixed; only drag (cdA), downforce (clA) and tyre grip (muY)
// are fitted, inside physical bounds, with a holdout test on tracks left out of the fit.
// Track factors (asphalt, line) come from the richest data (F1) and are shared by every series.

// F1 cars are in cars.js (2019 TUM base, 2025/2026 priors, 2027/2028 rule changes).
const common = {cRoll: 0.015, etaDrive: 0.95, inertiaFactor: 1.06, vSubtractCorner: 0.3, dmuDfz: -5e-5, fz0: 3000, ers: {}};

export const SERIES = {
  f1: {label: {ko: 'F1', en: 'F1'}, status: 'calibrated', data: 'OpenF1 speed traces and lap times (pole laps)'},
  wec: {label: {ko: 'WEC', en: 'WEC'}, status: 'calibrated', data: 'Al Kamel lap times and speed traps (best qualifying/Hyperpole lap per class)',
    classes: {
      hypercar: {
        label: {ko: '하이퍼카', en: 'Hypercar'},
        // Class-level car: BoP minimum weight about 1030 kg (dry) + driver + light fuel; power held by
        // the BoP near 500 kW at the wheels' side of the hybrid split, so no separate ERS deployment.
        prior: {...common, label: 'Hypercar', mass: 1120, wheelbase: 3.15, cogHeight: 0.32, rearWeight: 0.53, rearAero: 0.52,
          clA: 3.4, cdA: 1.05, clALow: 3.4, cdALow: 1.05, muX: 1.6, muY: 1.75, muXTrac: 1.7, pIce: 500e3, vMax: 345 / 3.6, noLowDrag: true},
        bounds: {muY: [1.3, 2.2], clA: [2, 7], cdA: [0.7, 1.6]},
      },
      lmgt3: {
        label: {ko: 'LMGT3', en: 'LMGT3'},
        // GT3 to BoP: about 1300–1350 kg + driver, roughly 380 kW
        prior: {...common, label: 'LMGT3', mass: 1400, wheelbase: 2.7, cogHeight: 0.42, rearWeight: 0.52, rearAero: 0.5,
          clA: 1.4, cdA: 0.9, clALow: 1.4, cdALow: 0.9, muX: 1.45, muY: 1.55, muXTrac: 1.5, pIce: 380e3, vMax: 300 / 3.6, noLowDrag: true},
        bounds: {muY: [1.1, 2.0], clA: [0.6, 3.5], cdA: [0.6, 1.3]},
      },
    },
    // Al Kamel event names -> simulator track ids (tracks without a built line are skipped)
    events: {'LOSAIL': 'lusail', 'QATAR': 'lusail', 'IMOLA': 'imola', 'SPA FRANCORCHAMPS': 'spa-francorchamps', 'SAO PAULO': 'interlagos',
      'CIRCUIT OF THE AMERICAS': 'austin', 'BAHRAIN INTERNATIONAL CIRCUIT': 'sakhir', 'BARCELONA-CATALUNYA': 'catalunya',
      'AUTODROMO NAZIONALE DI MONZA': 'monza', 'MONZA': 'monza'},
  },
  gt3: {label: {ko: '기타 GT3 (IMSA GTD·DTM·SP9)', en: 'Other GT3 (IMSA GTD, DTM, SP9)'}, status: 'coming-soon'},
  fe: {label: {ko: '포뮬러 E Gen4', en: 'Formula E Gen4'}, status: 'coming-soon'},
};

// Al Kamel season ids for the seasons the simulator uses
export const WEC_SEASONS = {2025: '14_2025', 2026: '15_2026'};
