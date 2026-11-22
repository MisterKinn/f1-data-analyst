// Gate G v3.1 (AGENTS.md): a PR that changes model code or model data must name its gate in the PR description.
// Accepted markers (one line each): "Ledger: <docs/gate-ledger.md line or pre-registration doc>", "Data fix: <named source>",
// "No model change: <why>". Bot refresh branches (lapsim-learn/**, zones-refresh, sync) and github-actions[bot] are exempt.
export const MODEL_PATHS = [/^worker\/lapsim\//, /^scripts\/sim\//];
export const MARKER = /^\s*(?:[-*]\s*)?(Ledger|Data fix|No model change)\s*:\s*\S/im;

export function ledgerCheck({files = [], body = '', branch = '', author = ''}) {
  const touched = files.filter(f => MODEL_PATHS.some(re => re.test(f)));
  if (!touched.length) return {ok: true, reason: 'no model files changed'};
  if (/\[bot\]$/.test(author) || /^(lapsim-learn\/|lapsim-exp\/|lapsim-cmp\/)/.test(branch)) return {ok: true, reason: 'bot or experiment branch'};
  if (MARKER.test(body || '')) return {ok: true, reason: 'marker found'};
  return {ok: false, reason: `model files changed (${touched.slice(0, 5).join(', ')}${touched.length > 5 ? ', …' : ''}) but the PR description has no ` +
    '"Ledger: …", "Data fix: …" or "No model change: …" line (AGENTS.md Gate G v3.1)'};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  const files = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
  const r = ledgerCheck({files, body: ev.pull_request?.body, branch: ev.pull_request?.head?.ref, author: ev.pull_request?.user?.login});
  console.log(r.reason);
  if (!r.ok) process.exit(1);
}
