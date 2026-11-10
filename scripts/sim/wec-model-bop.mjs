// Exact event-entry joins keep different models of one manufacturer separate.
export const modelKey = value => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
export function modelBopLookup(identities, verified) {
  const entries = new Map(), rows = new Map();
  for (const r of identities.rows) {
    const key = JSON.stringify([r.year, r.track, String(r.entry)]);
    if (entries.has(key)) throw Error(`Duplicate model identity ${key}`);
    entries.set(key, r.model);
  }
  for (const r of verified.rows) {
    const key = JSON.stringify([r.year, r.track, modelKey(r.model)]);
    if (rows.has(key)) throw Error(`Duplicate model BoP ${key}`);
    rows.set(key, r);
  }
  return (year, track, entry) => {
    if (Number(year) !== 2025 || entry === '') return null; // no invented 2026 or old Timing71 identity
    const model = entries.get(JSON.stringify([Number(year), track, String(entry)]));
    if (!model) throw Error(`Missing exact car model: ${year}/${track}/#${entry}`);
    return rows.get(JSON.stringify([Number(year), track, modelKey(model)])) || null;
  };
}
