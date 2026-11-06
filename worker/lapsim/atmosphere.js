// See kernel.js; this module re-exports the air and wind part.
import {lapsimKernel} from './kernel.js';
export const {RD, RV, RHO_REF, saturationVapourPressure, pressureFromAltitude, airDensity, tailwind, gripFromTrackTemp, icePowerFactor, conditionsFromWeather} = lapsimKernel();
