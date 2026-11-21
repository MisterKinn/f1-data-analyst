// Exit 0 when one of the given files differs from HEAD in more than its build date (generatedAt / generated / checkedAt).
// Used by scripts/publish-refresh.sh -c so a refresh that only stamps a new date publishes nothing.
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {gunzipSync} from 'node:zlib';
// .gz outputs are compared unzipped, so a new date inside them is ignored like in plain files
export const text = (buf, name) => buf == null ? null : (name.endsWith('.gz') ? gunzipSync(buf) : buf).toString('utf8');
export const stripDates = s => s.replace(/"(?:generatedAt|generated|checkedAt|built|fetched)"\s*:\s*"[^"]*"/g, '')
  .replace(/\bGenerated \d{4}-\d{2}-\d{2}T[\d:.]+Z/g, 'Generated');  // report headers (docs/lapsim-race.md)
const head = f => { try { return text(execFileSync('git', ['show', 'HEAD:' + f], {stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 1 << 30}), f); } catch { return null; } };
if (import.meta.url === `file://${process.argv[1]}`) {
  const changed = process.argv.slice(2).filter(f => { const now = existsSync(f) ? text(readFileSync(f), f) : null, was = head(f); return now !== was && (now == null || was == null || stripDates(now) !== stripDates(was)); });
  if (changed.length) console.log('changed:', changed.join(' '));
  process.exit(changed.length ? 0 : 1);
}
