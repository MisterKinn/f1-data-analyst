// See kernel.js; this module re-exports the track helpers.
import {lapsimKernel} from './kernel.js';
import {lapsimTracks, lapsimExtraTracks} from './tracks-data.js';
import {lapsimFeTracks} from './fe-tracks-data.js';
export const {autoStraights, trackFromData} = lapsimKernel();
// Every track the page and the tool can show: the fitted F1-position tracks plus the extra circuits (docs/lapsim-tracks-extra.md).
// Fit scripts keep reading lapsimTracks only.
// Formula E street circuits from the official circuit maps (scripts/sim/learn/build-fe.mjs).
export const lapsimAllTracks = {...lapsimTracks, ...lapsimExtraTracks, ...lapsimFeTracks};
