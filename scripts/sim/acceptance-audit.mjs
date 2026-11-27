// Report only: never imported by the simulator or existing release gates.
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Lanczos log-gamma and regularized incomplete beta continued fraction.
function logGamma(z) {
  const p = [676.5203681218851, -1259.1392167224028, 771.3234287776531,
    -176.6150291621406, 12.507343278686905, -.13857109526572012,
    9.984369578019572e-6, 1.5056327351493116e-7];
  z -= 1;
  let x = .99999999999980993;
  for (let i = 0; i < p.length; i++) x += p[i] / (z + i + 1);
  const t = z + 7.5;
  return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x);
}

function betaFraction(a, b, x) {
  const safe = v => Math.abs(v) < 1e-300 ? 1e-300 : v;
  let c = 1, d = 1 / safe(1 - (a + b) * x / (a + 1)), h = d;
  for (let m = 1; m <= 10000; m++) {
    let aa = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 / safe(1 + aa * d); c = safe(1 + aa / c); h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 / safe(1 + aa * d); c = safe(1 + aa / c);
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-14) return h;
  }
  throw new RangeError('Incomplete beta did not converge');
}

function betaI(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const factor = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b)
    + a * Math.log(x) + b * Math.log1p(-x));
  return x < (a + 1) / (a + b + 2)
    ? factor * betaFraction(a, b, x) / a
    : 1 - factor * betaFraction(b, a, 1 - x) / b;
}

export function tCritical95(df) {
  if (!Number.isInteger(df) || df < 1 || df > 10000) {
    throw new RangeError('df must be an integer from 1 to 10000');
  }
  const cdf = t => 1 - .5 * betaI(df / (df + t * t), df / 2, .5);
  let lo = 0, hi = 8; // t_.95,1 < 8; all supported dfs are bounded by this.
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (cdf(mid) < .95) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

function mean(values) { return values.reduce((a, b) => a + b, 0) / values.length; }
function sumSquares(values) { return values.reduce((a, b) => a + b * b, 0); }
function interval(average, se, df) {
  if (df < 1) return null;
  const upper95Pp = average + tCritical95(df) * se;
  if (![average, se, upper95Pp].every(Number.isFinite)) {
    throw new RangeError('Numerical overflow in interval');
  }
  return {meanPp: average, sePp: se, df, upper95Pp};
}

export function acceptanceAudit(input) {
  if (!input || typeof input.group !== 'string' || !input.group.trim()
      || !Array.isArray(input.rows) || input.rows.length === 0) {
    throw new TypeError('Expected {group: nonempty series/class label, rows: nonempty array}');
  }
  const ids = new Set(), clusters = new Map(), harms = [];
  for (const row of input.rows) {
    if (!row || typeof row.id !== 'string' || !row.id.trim()
        || typeof row.circuit !== 'string' || !row.circuit.trim()
        || ![row.oldErrorPp, row.newErrorPp].every(v => typeof v === 'number' && Number.isFinite(v))) {
      throw new TypeError('Every row needs id, circuit and finite oldErrorPp/newErrorPp');
    }
    if (ids.has(row.id)) throw new TypeError('Duplicate row id');
    ids.add(row.id);
    const harm = Math.abs(row.newErrorPp) - Math.abs(row.oldErrorPp);
    harms.push(harm);
    if (!clusters.has(row.circuit)) clusters.set(row.circuit, []);
    clusters.get(row.circuit).push(harm);
  }
  const n = harms.length, g = clusters.size, average = mean(harms);
  const iid = interval(average, n < 2 ? 0
    : Math.sqrt(sumSquares(harms.map(h => h - average)) / (n * (n - 1))), n - 1);
  // Intercept-only CR1: G/(G-1); (N-1)/(N-K)=1 for K=1.
  const sums = [...clusters.values()].map(values => values.reduce((s, h) => s + h - average, 0));
  const clustered = interval(average, g < 2 ? 0
    : Math.sqrt(g / (g - 1) * sumSquares(sums) / (n * n)), g - 1);
  const trackMeans = [...clusters.values()].map(mean), trackMean = mean(trackMeans);
  const equalCircuit = interval(trackMean, g < 2 ? 0
    : Math.sqrt(sumSquares(trackMeans.map(h => h - trackMean)) / (g * (g - 1))), g - 1);
  const worstRowPp = Math.max(...harms);
  return {
    mode: 'report-only; not a release authorization', group: input.group, n, circuits: g,
    iidRows: iid, rowWeightedCr1: clustered, equalCircuit,
    rowGuard: {limitPp: 1, worstRowPp, withinLimit: worstRowPp <= 1},
    meanMarginPp: .10,
    warnings: [
      ...(g < 2 ? ['No clustered interval: fewer than two independent circuits.'] : []),
      ...(g <= 6 ? ['Very few circuits: nominal t/CR1 coverage is not guaranteed.'] : []),
      'Circuit independence is an assumption; shared fitted models and season effects may violate it.',
      'Equal-circuit and row-weighted estimates differ with unbalanced clusters; predeclare the primary.',
      'No policy change or automatic PASS is inferred from these diagnostics.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    if (process.argv.length !== 3) throw new TypeError('Usage: node scripts/sim/acceptance-audit.mjs input.json');
    const report = acceptanceAudit(JSON.parse(readFileSync(process.argv[2], 'utf8')));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch (error) {
    // Do not echo input records or personal data from malformed files.
    process.stderr.write(`Acceptance audit failed (${error.name}). Check the documented input schema.\n`);
    process.exitCode = 1;
  }
}
