// Step 5b (Project claude/gate-track-state-prereg-2026-11-23.md): gate of the circuit-change factors, run as pre-registered.
//   node scripts/sim/track-state.mjs ti      (once: TI qualifying corner minima → .cache/track-state/corners.json)
//   node scripts/sim/change-gate.mjs         writes worker/lapsim/change-gate-data.js and docs/lapsim-change-gate.md
// Order (prereg section 5): power check first. "Not judgeable" spends no attempt and leaves every type at strength 0.
// Only when judgeable: signFlip of B0 vs C1/C2/C3 per track (section 4), then the learning rule (section 2) decides the strengths.
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {buildRegistry, changeCases, effectTable, clusterMedianCI, DEFAULTS, FULL, LAYOUT} from './track-state.mjs';
import {signFlip} from './gate.mjs';
import {lapsimChangeEffects} from '../../worker/lapsim/change-effects-data.js';

const CACHE = process.env.TRACK_STATE_CACHE || '.cache/track-state', RUN = '2026-11-23';
const TYPES = ['resurfacing', 'bump_removal', 'kerb_lowered', 'kerb_raised', 'kerb_changed'];
const MIN_EFFECT = 0.002; // minimum useful effect, ln corner speed (prereg section 5)
const mean = a => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const sd = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const lnSpeed = e => e ? Math.log(e.kind === 'grip' ? Math.sqrt(e.factor) : e.factor) : 0;

// candidate predictions of ln r for one case (prereg section 4)
const C1 = c => lnSpeed(DEFAULTS[c.type]);
const C2 = c => { const l = lapsimChangeEffects?.learned?.[c.type]; return !DEFAULTS[c.type] ? 0 : l && l.n >= 3 ? lnSpeed(l) : lnSpeed(DEFAULTS[c.type]); };
// learning rule (section 2) on a set of cases: entering types only, median shrunk n/(n+3), wrong-sign defaults removed
export function learnRule(cases) {
  const out = {};
  for (const t of TYPES) {
    const rows = cases.filter(c => c.type === t);
    if (!rows.length) { out[t] = {strength: 0, n: 0, reason: 'no cases'}; continue; }
    const ci = clusterMedianCI(rows), d = DEFAULTS[t], dSign = d ? Math.sign(lnSpeed(d)) : 0;
    const enters = ci.n >= 10 && (ci.ci90[0] > 0 || ci.ci90[1] < 0), wrongSign = dSign !== 0 && ci.median !== 0 && Math.sign(ci.median) !== dSign;
    const lnr = enters ? ci.median * ci.n / (ci.n + 3) : 0;
    out[t] = {strength: enters ? 1 : 0, n: ci.n, circuits: ci.circuits, lnr, wrongSign,
      reason: enters ? 'enters (n ≥ 10, interval excludes 0)' : ci.n < 10 ? 'strength 0 (n < 10)' : 'strength 0 (interval includes 0)'};
  }
  return out;
}
const C3for = rest => { const r = learnRule(rest); return c => r[c.type]?.strength ? r[c.type].lnr : 0; };

export function perTrackGains(cases, pred) {
  const by = new Map(); for (const c of cases) { if (!by.has(c.id)) by.set(c.id, []); by.get(c.id).push(c); }
  return [...by].map(([id, rows]) => {
    const f = pred.loto ? pred.loto(cases.filter(c => c.id !== id)) : pred; // C3 learned without the held-out track
    const e0 = mean(rows.map(c => c.lnr ** 2)), e1 = mean(rows.map(c => (c.lnr - f(c)) ** 2));
    return {id, n: rows.length, err0: e0, err1: e1, gain: e0 - e1};
  });
}

// power check (section 5): MDE = 1.84 SD(per-track gain) / √n. A perfect predictor of an effect δ gains δ², so the minimum useful
// effect of 0.2 % corner speed is a gain of 0.002² = 4e-6; the MDE is also shown as the equivalent effect √MDE.
export function powerCheck(cases) {
  const out = {};
  for (const [k, pred] of [['C1', C1], ['C2', C2], ['C3', {loto: C3for}]]) {
    const g = perTrackGains(cases, pred).map(r => r.gain), n = g.length, mde = 1.84 * sd(g) / Math.sqrt(n);
    out[k] = {nTracks: n, sdGain: sd(g), mde, mdeEffectPct: 100 * Math.sqrt(mde), minGain: MIN_EFFECT ** 2, judgeable: mde <= MIN_EFFECT ** 2};
  }
  // effect-scale reading (same formula on the per-track mean ln r): reported, so neither reading can hide the other
  const by = new Map(); for (const c of cases) { if (!by.has(c.id)) by.set(c.id, []); by.get(c.id).push(c.lnr); }
  const m = [...by.values()].map(mean), mdeE = 1.84 * sd(m) / Math.sqrt(m.length);
  out.effectScale = {nTracks: m.length, sdTrackMeanLnr: sd(m), mdeEffectPct: 100 * mdeE, judgeable: mdeE <= MIN_EFFECT};
  out.judgeable = out.C1.judgeable && out.C2.judgeable && out.C3.judgeable && out.effectScale.judgeable;
  return out;
}

async function main() {
  const f = join(CACHE, 'corners.json');
  if (!existsSync(f)) throw new Error(`${f} missing: run node scripts/sim/track-state.mjs ti first`);
  const ti = JSON.parse(readFileSync(f, 'utf8'));
  const {lapsimAllTracks} = await import('../../worker/lapsim/tracks.js');
  const {lapsimTrackChanges: stored} = await import('../../worker/lapsim/track-changes-data.js');
  const ids = [...new Set([...Object.keys(lapsimAllTracks), ...Object.keys(FULL), ...Object.keys(LAYOUT)])].sort();
  const reg = buildRegistry({stored, ti, ids});
  // locked set (section 3): events after 2026-11-23 00:00 KST are not in the notes or TI yet; guard anyway
  const all = changeCases(reg, ti).cases.filter(c => c.year <= 2026 && !(c.year === 2026 && ['lusail', 'yas-marina-circuit'].includes(c.id)));
  const desc = effectTable(all), power = powerCheck(all);
  let verdict, decision = null, types;
  if (!power.judgeable) {
    verdict = 'not judgeable at this n (power check): no attempt spent, every type at strength 0';
    types = Object.fromEntries(TYPES.map(t => [t, {strength: 0}]));
  } else {
    decision = Object.fromEntries([['C1', C1], ['C2', C2], ['C3', {loto: C3for}]].map(([k, p]) => [k, signFlip(perTrackGains(all, p).map(r => r.gain), {m: 3})]));
    const rule = learnRule(all), pass = decision.C3.accept;
    verdict = pass ? 'pass (C3): entering types only' : 'fail: every type at strength 0';
    types = Object.fromEntries(TYPES.map(t => [t, pass && rule[t].strength ? {strength: 1, kind: 'cornerSpeed', factor: +Math.exp(rule[t].lnr).toFixed(4)} : {strength: 0}]));
  }
  for (const t of TYPES) {
    const d = desc[t] || {n: 0};
    Object.assign(types[t], {n: d.n || 0, circuits: d.circuits || 0, medianSpeedPct: d.medianPct == null ? null : +d.medianPct.toFixed(3),
      ci90SpeedPct: d.ci90Pct ? d.ci90Pct.map(x => +x.toFixed(3)) : null, defaultSignContradicts: !!d.defaultSignContradicts,
      reason: types[t].strength ? d.rule : d.defaultSignContradicts ? 'strength 0: default sign is opposite to the measured median (removed)' : `strength 0: ${power.judgeable ? '' : 'not judgeable at this n; '}${d.rule?.replace(/^strength 0 \(|\)$/g, '') || 'no cases'}`});
  }
  const coverage = Object.fromEntries(Object.entries(reg).map(([id, tr]) => [id, tr.coverage]));
  const r6 = x => +x.toPrecision(4);
  const pw = Object.fromEntries(Object.entries(power).map(([k, v]) => [k, typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([a, b]) => [a, typeof b === 'number' ? r6(b) : b])) : v]));
  const gate = {generated: RUN, prereg: 'Project claude/gate-track-state-prereg-2026-11-23.md', ledger: '2026-11-23 | 5b', cases: all.length,
    circuits: new Set(all.map(c => c.id)).size, power: pw, verdict, decision, types,
    heldBack: 'The rebuilt change-effects.mjs output (learned factors at n ≥ 3, e.g. bump removal grip ×1.047 from 6 cases) is not shipped: it fails the rule.',
    coverage};
  writeFileSync('worker/lapsim/change-gate-data.js', `// Generated by scripts/sim/change-gate.mjs (step 5b, ${gate.prereg}). Do not edit by hand.\n`
    + '// types[t].strength 0 = the change type has no lap effect (information only); only a type that passed the gate has a factor.\n'
    + '// coverage: track-state coverage label per track (fia-documented, hand-entered, no-history).\n'
    + `export const lapsimChangeGate=${JSON.stringify(gate)};\n`);
  const pct = x => x == null ? '–' : (x >= 0 ? '+' : '') + x.toFixed(2) + ' %';
  const L = ['# LapSim circuit-change gate (step 5b)', '', `Generated by \`scripts/sim/change-gate.mjs\` on ${RUN}. Pre-registration: ${gate.prereg}. Ledger: "${gate.ledger}".`, '',
    `Cases: ${gate.cases} on ${gate.circuits} circuits (TI qualifying top 5, FIA notes 2019–2026; same cases as step 5a).`, '',
    '## Power check (run first)', '', 'MDE = 1.84 × SD(per-track gain) / √n. Minimum useful effect 0.2 % corner speed = gain 4e-6 (a perfect predictor of δ gains δ²).', '',
    '| Candidate | Tracks | SD gain | MDE (gain) | MDE as effect | Judgeable |', '|---|---|---|---|---|---|',
    ...['C1', 'C2', 'C3'].map(k => `| ${k} | ${pw[k].nTracks} | ${pw[k].sdGain} | ${pw[k].mde} | ${pct(pw[k].mdeEffectPct)} | ${pw[k].judgeable ? 'yes' : 'no'} |`),
    `| effect scale (per-track mean ln r) | ${pw.effectScale.nTracks} | – | – | ${pct(pw.effectScale.mdeEffectPct)} | ${pw.effectScale.judgeable ? 'yes' : 'no'} |`, '',
    `**Verdict:** ${verdict}.`, '', '## Strength per type', '', '| Type | n | Circuits | Median corner speed | 90 % interval | Strength | Reason |', '|---|---|---|---|---|---|---|',
    ...TYPES.map(t => { const x = types[t]; return `| ${t} | ${x.n} | ${x.circuits} | ${pct(x.medianSpeedPct)} | ${x.ci90SpeedPct ? x.ci90SpeedPct.map(pct).join(' … ') : '–'} | ${x.strength} | ${x.reason} |`; }), '',
    '## What the page and the tool do', '', '- A change of a type at strength 0 is shown as "information only, no lap effect"; it has no switch and moves no lap.',
    '- The tool (`apply_fia_changes`) and the page read the same gate (`worker/lapsim/scenario.js` `gateChange`; tool hook `track.changeFactors`).',
    '- The coverage label of the track (step 5a registry) is shown under the list.', `- ${gate.heldBack}`,
    '- The kernel defaults (`CHANGE_EFFECTS` in kernel.js, owned by step 1) are no longer reached by any lap; removing them is sent to step 1.', ''];
  writeFileSync('docs/lapsim-change-gate.md', L.join('\n'));
  console.log(JSON.stringify({cases: gate.cases, circuits: gate.circuits, power: pw, verdict, decision, types: Object.fromEntries(TYPES.map(t => [t, types[t].strength]))}, null, 1));
}
if (process.argv[1]?.endsWith('change-gate.mjs')) await main();
