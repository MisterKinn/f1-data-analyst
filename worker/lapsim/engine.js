// See kernel.js; this module re-exports the engine part.
import {lapsimKernel} from './kernel.js';
export const {erskLimitW, makeTyre, capacity, simulateLap} = lapsimKernel();
