// Step 27: compare the change-effects table of a track-state build with the shipped one (field by field) and list the case counts.
//   node scripts/sim/track-state-diff.mjs <shipped track-state-data.js> <new track-state-data.js> [cases.json] > diff.json
import {pathToFileURL} from 'node:url';
import {readFileSync, existsSync} from 'node:fs';

export function effectsDiff(a, b) {
  const out = [];
  for (const t of new Set([...Object.keys(a || {}), ...Object.keys(b || {})]))
    for (const k of new Set([...Object.keys(a?.[t] || {}), ...Object.keys(b?.[t] || {})])) {
      const x = a?.[t]?.[k], y = b?.[t]?.[k];
      if (JSON.stringify(x) !== JSON.stringify(y)) out.push({type: t, field: k, shipped: x ?? null, new: y ?? null});
    }
  return out;
}

if (process.argv[1]?.endsWith('track-state-diff.mjs')) {
  const [aF, bF, casesF] = process.argv.slice(2), load = async f => (await import(pathToFileURL(f).href)).lapsimTrackState;
  const [a, b] = [await load(aF), await load(bF)], cases = casesF && existsSync(casesF) ? JSON.parse(readFileSync(casesF, 'utf8')) : null;
  const tracks = new Set([...Object.keys(a.tracks), ...Object.keys(b.tracks)]), registryChanged = [...tracks].filter(id => JSON.stringify(a.tracks[id]) !== JSON.stringify(b.tracks[id]));
  console.log(JSON.stringify({effects: effectsDiff(a.effects, b.effects), identical: !effectsDiff(a.effects, b.effects).length,
    registryTracksChanged: registryChanged, pairsChanged: JSON.stringify(a.selectablePairs) !== JSON.stringify(b.selectablePairs),
    cases: cases && {n: cases.cases.length, circuits: new Set(cases.cases.map(c => c.id)).size, skipped: cases.skipped.length,
      skippedWhy: cases.skipped.reduce((o, s) => (o[s.why] = (o[s.why] || 0) + 1, o), {})}}, null, 1));
}
