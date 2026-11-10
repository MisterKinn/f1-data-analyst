// Owner-authorized experiment rule, 2026-11-11. Production defaults are unchanged.
export function f1FoldStop(scores, mainRounds) {
  if (!Number.isInteger(mainRounds) || mainRounds < 5 || mainRounds > 10)
    throw Error('Expected a verified main-fit stopping round from 5 through 10');
  if (!scores.every(Number.isFinite)) throw Error('Nonfinite fold score');
  const previous = scores.at(-2), current = scores.at(-1);
  const decreasePct = scores.length < 2 ? null : previous === 0 ? (current === 0 ? 0 : null) : 100*(previous-current)/previous;
  const converged = decreasePct !== null && decreasePct >= 0 && decreasePct < 1;
  const atMainRoundLimit = scores.length >= mainRounds;
  return {complete:converged || atMainRoundLimit, converged, decreasePct,
    stopReason:converged ? 'score-decrease-below-one-percent' : atMainRoundLimit ? 'main-round-limit' : null};
}
