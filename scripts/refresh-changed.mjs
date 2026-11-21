// Exit 0 when one of the given files differs from HEAD in more than its build date (generatedAt / generated / checkedAt).
// Used by scripts/publish-refresh.sh -c so a refresh that only stamps a new date publishes nothing.
import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
export const stripDates = s => s.replace(/"(?:generatedAt|generated|checkedAt|built)"\s*:\s*"[^"]*"/g, '');
const head = f => { try { return execFileSync('git', ['show', 'HEAD:' + f], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}); } catch { return null; } };
if (import.meta.url === `file://${process.argv[1]}`) {
  const changed = process.argv.slice(2).filter(f => { const now = existsSync(f) ? readFileSync(f, 'utf8') : null, was = head(f); return now !== was && (now == null || was == null || stripDates(now) !== stripDates(was)); });
  if (changed.length) console.log('changed:', changed.join(' '));
  process.exit(changed.length ? 0 : 1);
}
