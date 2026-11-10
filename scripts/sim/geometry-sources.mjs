// Geometry source policy. Rain is a session-level veto, not a lap-level guess.
export const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Owner decision 2026-11-10: replacing these existing models needs a separate experiment.
export const DEFERRED_SOURCES = Object.freeze({'las-vegas': 9854, montreal: 11287, zandvoort: 11349});
// The checked-in tracks predate projection metadata. Their chosen smoothing is recorded
// in docs/lapsim-geometry.md (2026-11-07). New geometry carries its own settings.
export const LEGACY_PROJECTION = Object.freeze({sigma: 7, posK: 0.4, sigmaMin: 3});

export function zeroRain(session, wet = {}) {
  const id = slug(session.circuit ?? session.circuit_short_name);
  if (wet.f1?.[String(session.session_key)] || wet.f1?.[`${session.year} ${id}`]) return false;
  const rows = session.weather;
  return Array.isArray(rows) && rows.length > 0 && rows.every(r =>
    (Array.isArray(r) ? r[5] : r.rainfall) === 0);
}

export function chooseGeometrySources(sessions, existing = {}, wet = {}) {
  const byTrack = new Map();
  for (const s of sessions) {
    const id = slug(s.circuit ?? s.circuit_short_name);
    if (!byTrack.has(id)) byTrack.set(id, []);
    byTrack.get(id).push(s);
  }
  const choices = {};
  for (const id of new Set([...Object.keys(existing), ...byTrack.keys()])) {
    const old = existing[id], rows = byTrack.get(id) || [];
    const dry = rows.filter(s => zeroRain(s, wet)).sort((a, b) =>
      b.year - a.year || (Date.parse(b.date_start) || 0) - (Date.parse(a.date_start) || 0) || b.session_key - a.session_key)[0];
    const deferred = old && DEFERRED_SOURCES[id] === old.sessionKey;
    const keep = !!old && (deferred || !dry || dry.session_key === old.sessionKey);
    const source = keep ? rows.find(s => s.session_key === old.sessionKey) : dry;
    const warning = deferred ? `${id}: retaining source session ${old.sessionKey}; replacement deferred by owner (latest zero-rain: ${dry?.session_key ?? 'none'})`
      : !dry ? `${id}: no zero-rain session; ${old ? `retaining source session ${old.sessionKey}` : 'no existing geometry; skipped'}`
      : null;
    choices[id] = {source, dryCandidate: dry, keep, warning};
  }
  return choices;
}

export function serializeGeometry(tracks, originalTracks, originalText, generatedText) {
  return JSON.stringify(tracks) === JSON.stringify(originalTracks) ? originalText : generatedText;
}
