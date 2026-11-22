// Broken stretches in the OpenF1 speed traces used for track building and calibration (.cache/lapsim/traces.json), report only
// (claude/gate-ti-gaps-siteC-prereg-2026-11-22.md §5). Same rule A+ as the TracingInsights pole laps (worker/lapsim/real-tel-gaps.js),
// on speed alone: OpenF1 traces carry no rpm or brake, so the decel step test is off (brake treated as on). Markdown to stdout.
import {readFileSync} from 'node:fs';
import {telGaps} from '../../worker/lapsim/real-tel-gaps.js';

const traces = JSON.parse(readFileSync(process.argv[2] || '.cache/lapsim/traces.json', 'utf8')), by = {};
for (const t of traces) {
  if (!t.s?.length || !t.v?.length) continue;
  // positions as share of the lap, in order (a trace can start before the line or hold repeated positions)
  const ix = t.s.map((_, i) => i).filter(i => Number.isFinite(t.s[i])).sort((a, b) => t.s[a] - t.s[b]), s0 = t.s[ix[0]], len = Math.max(1, t.s[ix.at(-1)] - s0);
  const r = {len, f: ix.map(i => Math.round((t.s[i] - s0) / len * 1e4)), speed: ix.map(i => t.v[i]), brake: ix.map(() => 1)};
  const g = telGaps(r), share = Math.min(1, g.reduce((s, [a, b]) => s + Math.max(0, b - a), 0) / 1e4), k = t.year;
  const o = by[k] ||= {laps: 0, broken: 0, share: 0, worst: []}; o.laps++; if (g.length) { o.broken++; o.share += share; o.worst.push([share, t.track, t.position]); }
}
console.log('### OpenF1 traces: broken stretches (rule A+, speed only; report only)\n\n| season | laps | laps with a broken stretch | mean broken share | worst |\n|---|---|---|---|---|');
for (const [y, o] of Object.entries(by).sort()) console.log(`| ${y} | ${o.laps} | ${o.broken} | ${o.broken ? (o.share / o.broken * 100).toFixed(1) + ' %' : '–'} | ${o.worst.sort((a, b) => b[0] - a[0]).slice(0, 3).map(([s, id, p]) => `${id} P${p} ${(s * 100).toFixed(0)} %`).join(', ') || '–'} |`);
