// Start/finish lines that differ by series (owner 2026-11-15). The track data starts at the F1 line; cars of every other series
// (sel.series set: WEC, ELMS, IMSA, GT3, ...) start `m` metres further along the F1 lap.
// silverstone: F1 uses the Hamilton Straight (Wing, since 2011); ELMS 2025 (Appendix 1: parc fermé on the National Straight, pit exit
// after the National straight) and British GT use the National Pits Straight. Line placed mid-straight between Woodcote (T8, 2518 m)
// and Copse (T9, 3042 m) on the F1 lap: estimated, ±150 m.
export const lapsimStartLines = {
  silverstone: {m: 2780, line: 'National Pits Straight', estimated: true},
};
