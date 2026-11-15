// real circuit of an event held away from its usual venue: track id, null (circuit not in the simulator), or undefined (usual venue)
export function movedVenue(e) {
  const where = /_in_([a-z]+)_-_/i.exec(e.docs.map(d => d.url || '').join(' '))?.[1] || / in ([A-Z][a-z]+)\b/.exec(e.docs.map(d => d.title || '').join(' '))?.[1];
  if (e.year >= 2026 && /spanish/i.test(e.docs.map(d => d.url || '').join(' ') + ' ' + (e.event || ''))) return 'madring';
  if (!where) return undefined;
  return {}[where.toLowerCase()] ?? null; // add a mapping when the simulator gets that circuit (e.g. malaysia: 'sepang')
}
